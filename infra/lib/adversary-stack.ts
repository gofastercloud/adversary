import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput, Fn, Tags, aws_s3 as s3, aws_s3_deployment as s3deploy, aws_cloudfront as cf, aws_cloudfront_origins as origins, aws_dynamodb as ddb, aws_lambda as lambda, aws_logs as logs, aws_cloudwatch as cw, aws_apigatewayv2 as apigw, aws_apigatewayv2_integrations as integ } from 'aws-cdk-lib';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

export interface AdversaryStackProps extends StackProps {
  /** ARN of a us-east-1 WAFv2 web ACL (see WafStack). */
  webAclArn?: string;
  /** Optional custom domain: ACM certificate (us-east-1) + domain name. DNS is left to you. */
  domainName?: string;
  certificateArn?: string;
  /** Destroy data on stack deletion (dev/ephemeral environments only). */
  ephemeral?: boolean;
}

export class AdversaryStack extends Stack {
  constructor(scope: Construct, id: string, props: AdversaryStackProps = {}) {
    super(scope, id, props);
    const ephemeral = !!props.ephemeral;
    const dist = path.join(repo, 'dist/web');
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/web not found. Run `npm run build` from the repository root first.');

    // ───────────────────────── data ─────────────────────────
    const table = new ddb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING }, sortKey: { name: 'sk', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST, timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: !ephemeral },
      deletionProtection: !ephemeral, removalPolicy: ephemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      encryption: ddb.TableEncryption.AWS_MANAGED
    });
    table.addGlobalSecondaryIndex({ indexName: 'gsi1', partitionKey: { name: 'gsi1pk', type: ddb.AttributeType.STRING }, sortKey: { name: 'gsi1sk', type: ddb.AttributeType.STRING }, projectionType: ddb.ProjectionType.INCLUDE, nonKeyAttributes: ['playerId', 'handle', 'points'] });

    // ───────────────────────── api ─────────────────────────
    const fn = (name: string, entry: string, o: { memory: number; timeout: number }) => {
      const logGroup = new logs.LogGroup(this, `${name}Logs`, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
      return new NodejsFunction(this, name, {
        entry: path.join(repo, 'api', entry), projectRoot: repo, depsLockFilePath: path.join(repo, 'package-lock.json'),
        runtime: lambda.Runtime.NODEJS_22_X, architecture: lambda.Architecture.ARM_64, memorySize: o.memory, timeout: Duration.seconds(o.timeout),
        environment: { TABLE_NAME: table.tableName, NODE_OPTIONS: '--enable-source-maps' }, logGroup, tracing: lambda.Tracing.ACTIVE,
        bundling: { format: OutputFormat.ESM, target: 'node22', minify: true, sourceMap: true, externalModules: ['@aws-sdk/*'], mainFields: ['module', 'main'], banner: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" }
      });
    };
    const readFn = fn('ReadFn', 'read.mjs', { memory: 256, timeout: 10 });
    const writeFn = fn('WriteFn', 'write.mjs', { memory: 1024, timeout: 20 });   // replays whole runs: CPU-bound, tens of ms
    table.grantReadData(readFn);
    table.grantReadWriteData(writeFn);

    const api = new apigw.HttpApi(this, 'Api', { apiName: 'adversary-api', createDefaultStage: true, description: 'ADVERSARY leaderboard, daily seed and verified run submission' });
    const R = new integ.HttpLambdaIntegration('Read', readFn), W = new integ.HttpLambdaIntegration('Write', writeFn);
    api.addRoutes({ path: '/api/daily', methods: [apigw.HttpMethod.GET], integration: R });
    api.addRoutes({ path: '/api/leaderboard', methods: [apigw.HttpMethod.GET], integration: R });
    api.addRoutes({ path: '/api/profile', methods: [apigw.HttpMethod.GET], integration: R });
    api.addRoutes({ path: '/api/profile', methods: [apigw.HttpMethod.PUT], integration: W });
    api.addRoutes({ path: '/api/runs', methods: [apigw.HttpMethod.POST], integration: W });
    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
    const stage = api.defaultStage!.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 100, throttlingRateLimit: 50 };
    // NB: RouteSettings is an untyped bag in CDK; CloudFormation requires PascalCase keys.
    stage.routeSettings = { 'POST /api/runs': { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 }, 'PUT /api/profile': { ThrottlingBurstLimit: 10, ThrottlingRateLimit: 5 } };
    stage.accessLogSettings = { destinationArn: accessLogs.logGroupArn, format: JSON.stringify({ t: '$context.requestTime', ip: '$context.identity.sourceIp', m: '$context.httpMethod', p: '$context.path', s: '$context.status', lat: '$context.responseLatency', err: '$context.error.message' }) };
    accessLogs.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // ───────────────────────── site ─────────────────────────
    const bucket = new s3.Bucket(this, 'Site', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: ephemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN, autoDeleteObjects: ephemeral, versioned: true, lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(30) }] });

    const headers = new cf.ResponseHeadersPolicy(this, 'Headers', {
      securityHeadersBehavior: {
        contentSecurityPolicy: { override: true, contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests" },
        strictTransportSecurity: { override: true, accessControlMaxAge: Duration.days(730), includeSubdomains: true, preload: false },
        contentTypeOptions: { override: true }, frameOptions: { override: true, frameOption: cf.HeadersFrameOption.DENY },
        referrerPolicy: { override: true, referrerPolicy: cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN }
      },
      customHeadersBehavior: { customHeaders: [{ header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', override: true }, { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true }] }
    });
    const shortCache = new cf.CachePolicy(this, 'ShortCache', { minTtl: Duration.seconds(0), defaultTtl: Duration.seconds(30), maxTtl: Duration.seconds(60), queryStringBehavior: cf.CacheQueryStringBehavior.all(), enableAcceptEncodingGzip: true, enableAcceptEncodingBrotli: true });
    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const apiOrigin = new origins.HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint)), { protocolPolicy: cf.OriginProtocolPolicy.HTTPS_ONLY, readTimeout: Duration.seconds(30) });
    const apiBehavior = (cache: cf.ICachePolicy, methods: cf.AllowedMethods): cf.BehaviorOptions => ({ origin: apiOrigin, allowedMethods: methods, cachePolicy: cache, originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY, responseHeadersPolicy: headers });
    const distribution = new cf.Distribution(this, 'Cdn', {
      comment: 'ADVERSARY SPA + API', defaultRootObject: 'index.html', httpVersion: cf.HttpVersion.HTTP2_AND_3, priceClass: cf.PriceClass.PRICE_CLASS_ALL, webAclId: props.webAclArn,
      ...(props.domainName && props.certificateArn ? { domainNames: [props.domainName], certificate: acm.Certificate.fromCertificateArn(this, 'Cert', props.certificateArn), minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021 } : {}),
      defaultBehavior: { origin: siteOrigin, viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED, responseHeadersPolicy: headers, compress: true },
      additionalBehaviors: {
        '/api/leaderboard': apiBehavior(shortCache, cf.AllowedMethods.ALLOW_GET_HEAD),
        '/api/daily': apiBehavior(shortCache, cf.AllowedMethods.ALLOW_GET_HEAD),
        '/api/*': apiBehavior(cf.CachePolicy.CACHING_DISABLED, cf.AllowedMethods.ALLOW_ALL)
      },
      errorResponses: [{ httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(10) }, { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(10) }]
    });

    // Three deployments so each object class gets the right Cache-Control. Hashed assets are immutable; content is versioned via ?v=; entry points never cache.
    const src = [s3deploy.Source.asset(dist)];
    const common = { destinationBucket: bucket, prune: false, memoryLimit: 512 };
    new s3deploy.BucketDeployment(this, 'DeployAssets', { ...common, sources: src, exclude: ['*'], include: ['assets/*'], cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')] });
    new s3deploy.BucketDeployment(this, 'DeployContent', { ...common, sources: src, exclude: ['*'], include: ['content/core.json', 'content/attack.json', 'content/packs/*', 'content/adversaries/*', 'content/dossiers/*', 'content/NOTICE-ATTACK.md'], cacheControl: [s3deploy.CacheControl.fromString('public, max-age=3600')] });
    new s3deploy.BucketDeployment(this, 'DeployEntry', { ...common, sources: src, exclude: ['*'], include: ['index.html', 'config.json', 'content/manifest.json'], cacheControl: [s3deploy.CacheControl.fromString('no-cache')], distribution, distributionPaths: ['/index.html', '/config.json', '/content/manifest.json'] });

    // ───────────────────────── alarms ─────────────────────────
    for (const [name, f] of [['Read', readFn], ['Write', writeFn]] as const) {
      new cw.Alarm(this, `${name}Errors`, { metric: f.metricErrors({ period: Duration.minutes(5) }), threshold: 5, evaluationPeriods: 1, treatMissingData: cw.TreatMissingData.NOT_BREACHING, alarmDescription: `${name} Lambda errors` });
    }
    new cw.Alarm(this, 'Api5xx', { metric: new cw.Metric({ namespace: 'AWS/ApiGateway', metricName: '5xx', dimensionsMap: { ApiId: api.apiId }, statistic: 'Sum', period: Duration.minutes(5) }), threshold: 10, evaluationPeriods: 1, treatMissingData: cw.TreatMissingData.NOT_BREACHING });

    Tags.of(this).add('app', 'adversary');
    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
