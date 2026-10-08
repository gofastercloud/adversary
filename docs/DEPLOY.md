# Deploying to AWS (CDK)

Stack: private S3 bucket + CloudFront (OAC) for the SPA, HTTP API (API Gateway v2) with two ARM64 Node 22 Lambdas
(read: 256 MB, write: 1024 MB because it replays runs), a single-table DynamoDB table, throttling, access logs and alarms.
Default region `ap-southeast-2` (Sydney).

```bash
npm ci && npm --prefix infra ci
npm run synth                                  # builds the SPA and synthesises; fails on CDK assertion errors
npx --prefix infra cdk bootstrap               # once per account/region
npm run deploy                                 # `cdk deploy --all --require-approval broadening`
```

Outputs: `SiteUrl`, `ApiEndpoint`, `TableName`, `BucketName`. CloudFront routes `/api/*` to the API, so the SPA uses same-origin
calls and the CSP can stay `connect-src 'self'`.

## Context flags

| Flag | Effect |
|---|---|
| `-c ephemeral=true` | Dev stacks: no deletion protection or PITR, destroy removes data. Never use in production. |
| `-c waf=true` | Adds a us-east-1 WAFv2 web ACL (managed rule groups + rate rule) and attaches it to CloudFront. |
| `-c domainName=play.example.com -c certificateArn=arn:aws:acm:us-east-1:...` | Custom domain; also enables `TLSv1.2_2021` minimum protocol. DNS is yours to create. |

## Before you share the URL

1. Custom domain + certificate (TLS 1.2 minimum is impossible on the default CloudFront certificate).
2. Turn on the WAF flag, and consider a reserved-concurrency cap on the write function (see [SECURITY.md](SECURITY.md)).
3. Subscribe an SNS topic to the stack alarms.
4. Decide your data stance: logs include IPs; retention is capped but not zero.

## Cost shape

On-demand DynamoDB, Lambda per-request and CloudFront egress; an idle deployment costs cents per month. The write function
is the only meaningful cost driver (one replay per submitted run).

## SAM

CDK is the supported path. `cdk synth` emits `infra/cdk.out/*.template.json`, which SAM CLI can use for `sam local invoke`
if you prefer SAM tooling; no separate SAM template is maintained.
