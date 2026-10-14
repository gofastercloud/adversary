# Deploying

Two targets. The GitHub Pages build is a static playtest of the full game. The AWS stack is the full online version,
with leaderboards, server-side verification and profile sync.

## Static playtest build (GitHub Pages)

The playtest build is the full game as a static site at https://gofastercloud.github.io/adversary/. It is built with the
API switched off, so there is no server behind it.

### What works and what is off

Works:
- The full game, the tutorial and the Guide.
- The daily challenge. The seed is computed in the browser from the Australia/Sydney date, so it needs no server.
- Progress, saved in the browser's localStorage only.

Off:
- Leaderboards, server-side score verification and cross-device profile sync. The build writes `apiBase: null` to
  `config.json`, and the SPA then makes no `/api` requests. The UI treats this as offline.
- Feedback goes through the **Give feedback** link on the title and result screens. It opens a GitHub issue form titled
  "Playtest feedback" with the `playtest` label. Players need a GitHub account. The game sends nothing itself.

### One-time setup

In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Until this
is set, the deploy job cannot publish the site.

### How deploys run

`.github/workflows/pages.yml` runs on every push to `main`. It can also be started by hand with `workflow_dispatch`
from the Actions tab. The workflow runs the content validation, the tests and the icon check, then builds with
`API_BASE=off npm run build` and deploys `dist/web` with `actions/deploy-pages`. The deploy job only runs after the build
job passes, so a failing check leaves the live site as it was.

Workflow hardening: the workflow token is `contents: read`, and only the deploy job adds `pages: write` and `id-token:
write`. Actions are pinned to commit SHAs, checkout does not persist credentials, and `npm ci --ignore-scripts` stops
dependency install scripts running on the runner. There are no pull request triggers, so forks cannot run it. After the
first deploy, check **Settings → Environments → github-pages**: **Deployment branches and tags** should allow `main`
only (GitHub sets this by default).

### Build the same thing locally

```bash
npm ci
API_BASE=off npm run build           # writes dist/web with no backend
python3 -m http.server 8000 --directory dist/web
```

Then open http://localhost:8000/. `dist/web` is shared by every build, and `npm run dev`, `npm run synth` and
`npm run deploy` rebuild it with the API on (`/api`). Run the `API_BASE=off` build again before serving the playtest
build from that folder. `npm run dev` is not a substitute: it always mounts the in-process API.

### Roll back

- **Revert on `main`.** Run `git revert <sha>` and push. The push deploys the reverted tree. This is the usual route,
  because `main` stays the source of truth.
- **Re-run an earlier run.** In the Actions tab, re-run an earlier successful `pages.yml` run. A re-run uses the commit
  and the workflow file from that run, so it republishes that older build. Use it for an urgent rollback, then revert
  on `main` so the next push does not bring the bad build back.

### Security notes

- **No write surface.** GitHub Pages serves static files only. Nothing on the playtest site accepts a score, a profile
  or feedback.
- **CSP is a meta tag.** The policy comes from the `<meta http-equiv="Content-Security-Policy">` tag in
  `web/index.html`:

  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
  ```

  Both builds ship the same HTML, so the same policy applies to the AWS version.
- **Headers that Pages cannot set.** GitHub Pages does not let the repository set HTTP response headers, so these are
  not available here:
  - `frame-ancestors` cannot be set by a meta tag, and browsers ignore it there. Other sites can frame the game. The
    practical risk is clickjacking of in-game buttons, such as **Erase local data** in Settings.
  - HSTS is controlled by GitHub for github.io, not by this repository.
  - The CloudFront response headers policy described in [SECURITY.md](SECURITY.md) has no equivalent on Pages.
- **Player data stays in the browser.** Progress is stored in localStorage under `adversary.profile.v1`,
  `adversary.run.v1`, `adversary.settings.v1` and `adversary.player.v1`. The offline build does not send these anywhere.
  **Erase local data** in Settings removes only the `adversary.*` keys. All project sites under `gofastercloud.github.io`
  share one browser origin, so the game must not clear storage it does not own, and any other page on that origin can read
  these keys. GitHub still serves the page files, so it sees ordinary request data such as IP addresses, as any static
  host does.
- **Feedback is public.** Issues on the repository are public and need a GitHub account. Players should not put personal
  information in them.
- **Not checked live.** The header behaviour above comes from the CSP and GitHub Pages documentation. It has not been
  tested against a live Pages site.

## Full online version on AWS (CDK)

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

### Context flags

| Flag | Effect |
|---|---|
| `-c ephemeral=true` | Dev stacks: no deletion protection or PITR, destroy removes data. Never use in production. |
| `-c waf=true` | Adds a us-east-1 WAFv2 web ACL (managed rule groups + rate rule) and attaches it to CloudFront. |
| `-c domainName=play.example.com -c certificateArn=arn:aws:acm:us-east-1:...` | Custom domain; also enables `TLSv1.2_2021` minimum protocol. DNS is yours to create. |

### Before you share the URL

1. Custom domain + certificate (TLS 1.2 minimum is impossible on the default CloudFront certificate).
2. Turn on the WAF flag, and consider a reserved-concurrency cap on the write function (see [SECURITY.md](SECURITY.md)).
3. Subscribe an SNS topic to the stack alarms.
4. Decide your data stance: logs include IPs; retention is capped but not zero.

### Cost shape

On-demand DynamoDB, Lambda per-request and CloudFront egress; an idle deployment costs cents per month. The write function
is the only meaningful cost driver (one replay per submitted run).

### SAM

CDK is the supported path. `cdk synth` emits `infra/cdk.out/*.template.json`, which SAM CLI can use for `sam local invoke`
if you prefer SAM tooling; no separate SAM template is maintained.
