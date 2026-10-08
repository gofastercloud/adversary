import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AdversaryStack } from '../lib/adversary-stack.js';

const synth = (props = {}) => Template.fromStack(new AdversaryStack(new App(), 'T', { env: { account: '111111111111', region: 'ap-southeast-2' }, ...props }));
const t = synth();

test('site bucket is private, TLS-only and encrypted', () => {
  t.hasResourceProperties('AWS::S3::Bucket', { PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true }, BucketEncryption: Match.anyValue() });
  t.hasResourceProperties('AWS::S3::BucketPolicy', { PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]) } });
});
test('CloudFront uses origin access control (not legacy OAI) and redirects to HTTPS', () => {
  t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  t.hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: Match.objectLike({ DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }), HttpVersion: 'http2and3' }) });
});
test('security headers include a strict CSP, HSTS, nosniff and frame denial', () => {
  t.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', { ResponseHeadersPolicyConfig: Match.objectLike({ SecurityHeadersConfig: Match.objectLike({ ContentSecurityPolicy: Match.objectLike({ ContentSecurityPolicy: Match.stringLikeRegexp("script-src 'self'.*object-src 'none'.*frame-ancestors 'none'") }), StrictTransportSecurity: Match.objectLike({ AccessControlMaxAgeSec: 63072000 }), ContentTypeOptions: { Override: true }, FrameOptions: { FrameOption: 'DENY', Override: true } }) }) });
});
test('DynamoDB: on-demand, PITR, deletion protection, TTL, one GSI', () => {
  t.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST', DeletionProtectionEnabled: true, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }, TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true }, GlobalSecondaryIndexes: Match.arrayWith([Match.objectLike({ IndexName: 'gsi1' })]) });
});
test('Lambdas are Node 22 on arm64 with the table name wired in', () => {
  const fns = t.findResources('AWS::Lambda::Function', { Properties: { Runtime: 'nodejs22.x' } });
  assert.equal(Object.keys(fns).length, 2);
  for (const f of Object.values(fns) as any[]) { assert.deepEqual(f.Properties.Architectures, ['arm64']); assert.ok(f.Properties.Environment.Variables.TABLE_NAME); }
});
test('the read function cannot write to the table; neither has wildcard resources on actions', () => {
  const pols = t.findResources('AWS::IAM::Policy');
  const byRole = (needle: string) => Object.values(pols).filter((p: any) => JSON.stringify(p.Properties.Roles).includes(needle)).flatMap((p: any) => p.Properties.PolicyDocument.Statement);
  const read = byRole('ReadFn'); const write = byRole('WriteFn');
  const actions = (st: any[]): string[] => st.flatMap(s => ([] as string[]).concat(s.Action));
  assert.ok(!actions(read).filter(a => !a.startsWith('xray:')).some(a => /Put|Update|Delete|BatchWrite/.test(a)), 'read fn must not have write actions');
  assert.ok(actions(write).some(a => /PutItem|UpdateItem/.test(a)));
  for (const s of [...read, ...write]) if (s.Resource === '*') assert.ok(/xray|logs/i.test(JSON.stringify(s.Action)), 'only X-Ray may use *');
});
test('API: five routes, throttled, access-logged', () => {
  t.resourceCountIs('AWS::ApiGatewayV2::Route', 5);
  t.hasResourceProperties('AWS::ApiGatewayV2::Stage', { DefaultRouteSettings: { ThrottlingBurstLimit: 100, ThrottlingRateLimit: 50 }, RouteSettings: Match.objectLike({ 'POST /api/runs': { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 } }), AccessLogSettings: Match.anyValue() });
});
test('ephemeral mode destroys data; default retains it', () => {
  const e = synth({ ephemeral: true });
  e.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Delete', Properties: { DeletionProtectionEnabled: false } });
  t.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Retain' });
});
