# Local development and testing

There are three tiers. Start at the first; move down only when you need the real thing.

| Tier | Command | Backing store | Needs |
|---|---|---|---|
| 1. In-process | `npm run dev` | in-memory (resets on restart) | Node 22 |
| 2. DynamoDB emulator | `docker compose up -d dynamodb && npm run local:table && npm run dev:ddb` | DynamoDB Local | Docker |
| 3. Full local AWS | `docker compose --profile floci up -d floci` then `npm run dev:floci` | Floci (MIT, no auth token) | Docker |

`npm run dev` builds the SPA, serves it on `http://localhost:5173` and mounts the **real Lambda handlers** under `/api` via
`api/local.mjs`, so leaderboard, daily challenge and profile sync all work with no AWS account.

## Which local-AWS tool?

LocalStack Community moved to requiring an auth token in 2026, so this project does not depend on it. Floci is an MIT-licensed
emulator that needs no token; for DynamoDB alone, DynamoDB Local or **Dynalite** (pure Node, no Docker) is enough. The test
suite uses Dynalite so the DynamoDB code path runs in CI with nothing installed.

Caveat: the Docker flows (`docker-compose.yml`, Floci) were not executed in the authoring sandbox because it had no Docker
daemon. The table schema is created by `scripts/lib/local-table.mjs`, which mirrors `infra/lib/adversary-stack.ts` and is
exercised by the Dynalite test.

To test the actual deployed topology (API Gateway + Lambda) against an emulator, synthesise with `npm run synth` and point
SAM CLI or Floci at `infra/cdk.out`; this is not wired up here.

## Test suite

```bash
npm test                 # engine rules, determinism, replay verification, API, DynamoDB (Dynalite), every pack's full run and TTX
npm --prefix infra test  # CDK assertions (private bucket, CSP, throttles, PITR, least-privilege IAM)
npm run validate         # content + references offline
npm run icons            # every icon name used by UI and content exists in web/icons
npm run links            # network: checks every authoritative link (run weekly; some sites block bots)
npm run sim              # balance: bot win rates per doctrine and adversary
```

## Debugging a battle

`window.__adv` is exposed in dev builds for the screenshot harness (`scripts/shot.mjs`, `scripts/scene-*.mjs`); `scripts/trace.mjs`
prints an event trace for a seed. Because the engine is deterministic, a bug report is a seed plus an action log.
