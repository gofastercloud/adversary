import { Stack, StackProps } from 'aws-cdk-lib';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

/** CloudFront WAFs must live in us-east-1. Optional: enable with `-c waf=true`. */
export class WafStack extends Stack {
  public readonly webAclArn: string;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const vis = (name: string) => ({ cloudWatchMetricsEnabled: true, metricName: name, sampledRequestsEnabled: true });
    const acl = new CfnWebACL(this, 'Acl', {
      scope: 'CLOUDFRONT', defaultAction: { allow: {} }, visibilityConfig: vis('adversary-acl'),
      rules: [
        { name: 'RateLimitPerIp', priority: 1, action: { block: {} }, statement: { rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' } }, visibilityConfig: vis('rate-limit') },
        { name: 'RateLimitRunSubmit', priority: 2, action: { block: {} }, statement: { rateBasedStatement: { limit: 100, aggregateKeyType: 'IP', scopeDownStatement: { byteMatchStatement: { searchString: '/api/runs', fieldToMatch: { uriPath: {} }, textTransformations: [{ priority: 0, type: 'NONE' }], positionalConstraint: 'STARTS_WITH' } } } }, visibilityConfig: vis('rate-limit-runs') },
        { name: 'AwsCommon', priority: 10, overrideAction: { none: {} }, statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } }, visibilityConfig: vis('aws-common') },
        { name: 'AwsIpReputation', priority: 11, overrideAction: { none: {} }, statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesAmazonIpReputationList' } }, visibilityConfig: vis('aws-ip-rep') }
      ]
    });
    this.webAclArn = acl.attrArn;
  }
}
