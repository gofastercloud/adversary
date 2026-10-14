# Security model of the game itself

ADVERSARY is a training game with a small public API. The goal is to be a good example: least privilege, no secrets, strict
CSP, verified (not trusted) client data. This page says what is protected, what is not, and what you should add before
exposing it widely.

## Assets and trust boundaries

| Asset | Where | Protection |
|---|---|---|
| Leaderboard integrity | DynamoDB, write Lambda | Every score is **recomputed server-side** by replaying the action log with the same engine. Tampered, truncated, wrong-fingerprint, non-daily-seed or out-of-schema logs are rejected (422/409/400). |
| Player identity | `Authorization: Bearer <id>.<secret>` | Trust on first use: the first submission registers sha256(secret) for that id; later calls need the same secret (timing-safe compare). **This is not authentication**: anyone can mint a new id. Do not use scores as assessment records. |
| Player data | profile JSON | Handle and game progress only. No email, no real names required. Profile is schema-sanitised (key patterns, numeric caps, size limit 64 KB). Handles are stripped of markup. |
| Static site (AWS) | S3 + CloudFront | Private bucket, origin access control, no public ACLs; response headers policy sets CSP (`default-src 'self'`, no inline script, no remote origins), HSTS, frame-ancestors none, nosniff, referrer policy. |
| Static site (playtest) | GitHub Pages | Built with `API_BASE=off`: `config.json` has `apiBase: null` and the client makes no `/api` requests (it fails closed if the config cannot be read). Static files only, so there is no write surface. The CSP is the same meta tag; Pages sets no custom headers, so no `frame-ancestors` (meta cannot set it) and no CloudFront-style response headers policy. HSTS is GitHub's for github.io. Client state is localStorage `adversary.*` keys on a shared `*.github.io` origin: other project pages under the same account can read it, and "Erase local data" removes only the `adversary.*` keys. The anonymous player id and secret are generated but never sent. |
| Playtest feedback | GitHub issue form | Public by design: a plain link opens `.github/ISSUE_TEMPLATE/playtest-feedback.yml`, pre-filled only with the content build id. The game sends nothing itself; players need a GitHub account and are told not to post personal information. |
| Secrets | none | The app holds no API keys. Fonts, icons and data are self-hosted. |

## Abuse and cost controls

- API Gateway stage throttle (50 rps, burst 100); per-player limits of 6 submissions/minute and 120/day; request body caps
  (320 KB run, 64 KB profile, 9,000 actions).
- **Residual risk**: a run replay costs CPU and a player id is free, so a patient attacker can mint many ids. Mitigate with
  the optional WAF stack (`-c waf=true`, rate-based rule), a reserved-concurrency cap on the write function (set it to a value
  your account's unreserved quota allows), and the CloudWatch alarms the stack creates (function errors, API 5xx).
- DynamoDB is on-demand with TTL on runs and rate-limit counters, PITR and deletion protection (non-ephemeral stacks).

## IAM

- The read function has `GetItem/Query` on the table only; the write function has read/write on the table only. Neither can
  touch other AWS services. Logs go to CloudWatch with retention. No wildcard resource policies.
- CloudFront's default certificate cannot enforce TLS 1.2+; set `domainName` + `certificateArn` (ACM in us-east-1) to get a
  `TLSv1.2_2021` minimum protocol version.

## Supply chain (the irony is intended)

The game teaches supply-chain defence, so it follows it: dependencies are few and dev-only except the SDK clients; the build
is a single esbuild bundle; `npm ci` with the lockfile; CI runs `npm audit`-style checks on demand (`npm audit`). Pin GitHub
Actions to commit SHAs if you copy the workflows into a fork.

The Pages workflow (`.github/workflows/pages.yml`) follows the same rules. It triggers on push to `main` and manual
dispatch only (no `pull_request_target`, so forks and PRs cannot run it or reach the deploy job). The token is
`contents: read`; only the deploy job gets `pages: write` and `id-token: write`, via the `github-pages` environment, which
should be limited to the `main` branch. Actions are pinned to full SHAs, checkout does not persist credentials, no
untrusted input is interpolated into `run:` steps, and `npm ci --ignore-scripts` keeps dependency install scripts off the
runner. Validation, tests and the icon check must pass before the deploy job starts. There is no cloud credential in this
path (Pages deploys use a short-lived OIDC token), unlike the CDK deploy, which uses your AWS credentials on your machine.

## Content integrity

Content (cards, scenarios) ships inside the bundle and the Lambda; the **fingerprint** of the content set is part of every
submission, so clients on stale or modified content cannot post scores. Reference links are validated offline by the
validator and online by `npm run links`.

## Privacy

Telemetry: none. The client stores progress in localStorage and, if you opt in, syncs a sanitised profile. Access logs on the
API contain IPs by default API Gateway behaviour; retention is capped. If you deploy in AU for AU users, treat the IP in logs
as personal information under the Privacy Act. The GitHub Pages playtest build has no API or logs of ours; GitHub, as the host, sees ordinary request data such as IP addresses.

## What is out of scope

Account recovery, moderation of handles beyond sanitisation, and anti-cheat beyond replay verification (a bot that plays
legally is a legal player).
