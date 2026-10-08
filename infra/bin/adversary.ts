#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AdversaryStack } from '../lib/adversary-stack.js';
import { WafStack } from '../lib/waf-stack.js';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT, region = process.env.CDK_DEFAULT_REGION || 'ap-southeast-2';
const waf = String(app.node.tryGetContext('waf')) === 'true';
let webAclArn: string | undefined;
if (waf) { webAclArn = new WafStack(app, 'AdversaryWaf', { env: { account, region: 'us-east-1' }, crossRegionReferences: true }).webAclArn; }
new AdversaryStack(app, 'Adversary', {
  env: { account, region }, crossRegionReferences: waf, webAclArn,
  ephemeral: String(app.node.tryGetContext('ephemeral')) === 'true',
  domainName: app.node.tryGetContext('domainName'), certificateArn: app.node.tryGetContext('certificateArn'),
  description: 'ADVERSARY: serverless card battler (S3 + CloudFront + HTTP API + Lambda + DynamoDB)'
});
