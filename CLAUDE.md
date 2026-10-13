# CLAUDE.md

ADVERSARY: a roguelike deckbuilder that teaches threat modelling. You play NIST CSF 2.0 × STRIDE controls against an
AI adversary that plays real MITRE ATT&CK techniques. Australian context (SOCI, AESCSF, APRA, Essential Eight). Start
with `README.md`; the `docs/` index there is authoritative.

## Delegation model (read this first)

This project runs on a three-tier model. The session model (Opus) **orchestrates and plans; it does not write code or
docs**. Almost all hands-on work goes to Haiku 5.5 subagents, with Sonnet 5.5 as the escalation tier.

| Tier | Model | Role | Writes repo files? |
|---|---|---|---|
| Orchestrator | Opus (the main session) | Understand the ask, plan, split into briefs, dispatch, review diffs, run final checks, commit, push, open PRs | **No** |
| Default worker | Haiku 5.5 (`model: haiku`) | Implement, author content, write and update docs, run checks, run sims and e2e | Yes |
| Escalation | Sonnet 5.5 (`model: sonnet`) | Tricky problems (see escalation triggers), root-causing, design trade-offs with code attached | Yes |

`game-designer` is a Sonnet specialist, not an escalation tier: use it directly for design questions, and its proposals are implemented by Haiku agents.

The subagents in `.claude/agents/` pin these models in their frontmatter, so use them rather than passing `model` by hand:

| Agent | Model | Use for |
|---|---|---|
| `implementer` | haiku | Code changes in `engine/`, `web/`, `api/`, `lab/`, `scripts/`, `infra/`, tests |
| `content-author` | haiku | Cards, relics, packs, adversaries, TTX in `scripts/packs/*.mjs` and `scripts/gen-*.mjs`, then regenerate and validate |
| `doc-writer` | haiku | Anything in `docs/`, `README.md`, code comments that are the whole task, and this file when the user asks |
| `senior-engineer` | sonnet | Escalations only (see below) |
| `game-designer` | sonnet | Game design, playability, pacing, reward loops, balance intent, onboarding; produces lab-backed proposals, not code. |
| `Explore` (built-in) | haiku | Broad read-only searches when Opus needs a conclusion, not file dumps |

The `haiku` and `sonnet` aliases resolve to the latest models in each family (currently Haiku 5.5 and Sonnet 5.5). If
the aliases ever move to a model you don't want, pin the full IDs (`claude-haiku-5-5`, `claude-sonnet-5-5`) in the
agent frontmatter.

### What the orchestrator may and may not do

May:
- Read files, `grep`/`glob`, inspect `git log`/`git diff`, read docs and lab output.
- Run short, read-only or verification commands: `npm run validate`, `npm test`, `npm run ci`, `git status`.
- Write plans and briefs in the scratchpad (outside the repo).
- Stage, commit, push and open PRs once a diff has passed review and checks. Commit messages and PR bodies are
  orchestration, not docs.

May not:
- Use `Edit`, `Write` or `NotebookEdit` on any file in the repo, or modify repo files through `sed`, heredocs or scripts.
  This includes one-line fixes, typo fixes and doc tweaks: they go to a Haiku agent, which is cheap and fast.
- Take over a task a subagent failed. Failure means re-brief or escalate, not "I'll just do it".
- Delegate to an Opus-model subagent or the `fork` agent type for implementation work.

If the user explicitly tells Opus to make an edit itself, that instruction wins for that edit only.

### Workflow

1. **Understand.** Read enough to scope the ask. Use `Explore` for broad sweeps so the orchestrator's context stays
   small. If the ask is ambiguous in a way the code can't resolve, ask the user before dispatching.
2. **Plan.** Break the work into tasks that each touch a coherent set of files and can be verified on their own. For
   anything over ~3 tasks, write the plan to the scratchpad and track it with the task list.
3. **Brief.** One brief per task, using the template below. Haiku performs well with tight, explicit briefs and badly
   with vague ones; the quality of the brief is the orchestrator's main lever.
4. **Dispatch.** Send independent tasks in parallel (multiple `Agent` calls in one message). Never let two agents edit
   the same file concurrently; if parallel tasks must share files, sequence them or give each `isolation: "worktree"`.
5. **Review.** Do not trust the agent's self-report. Read the actual `git diff`, check it against the brief's
   acceptance criteria and the project rules below, and re-run the brief's checks. Anything wrong goes back to the same
   agent (via `SendMessage`, so it keeps its context) with specific feedback.
6. **Verify.** `npm run ci` must pass before any commit. Add `npm --prefix infra test` when `infra/` changed, and
   delegate `npm run e2e` (needs `npm run dev` running) when `web/` changed in ways tests don't cover.
7. **Ship.** Commit with a clear message, push, open the PR.

### Brief template

Every delegated task gets a brief in this shape. Subagents start with no conversation context, so the brief must stand
alone.

```
Goal: <one sentence: the outcome, not the activity>
Context: <why this is needed; relevant findings so far; links to docs sections>
Files: <exact paths to change; paths to read for reference>
Constraints: <project rules that apply, e.g. "engine must stay deterministic", "edit scripts/packs/ot.mjs, not content/packs/ot.json">
Out of scope: <what not to touch, even if it looks wrong; report it instead>
Acceptance: <observable checks, e.g. "npm run validate passes", "new test in test/engine.test.mjs covers X and passes">
Report: <what to return: files changed, check output summary, anything surprising, open questions>
```

Name exact files and exact commands. "Fix the balance" is not a brief; "Lower `T1486` impact for the `ot` pack's act-3
boss in `scripts/packs/ot.mjs` until `node lab/cli.mjs adversaries --n 40 --scenarios ot` shows the standard agent at
15-25% against it" is.

### Escalation to Sonnet

Default every task to a Haiku agent. Escalate to `senior-engineer` when any of these hold:

- **Two strikes.** A Haiku agent has failed the same task twice after re-briefing (checks still red, or the diff is
  wrong in the same way). Pass the failed attempts and their error output in the escalation brief.
- **Determinism and verification.** Changes to `engine/rng.js`, the action/replay model in `engine/battle.js` or
  `engine/run.js` (including `replay`), or the server-side run verification in `api/app.mjs`. A subtle bug here silently breaks leaderboard
  verification and every seeded lab result.
- **Security-sensitive surface.** IAM, CSP, CloudFront/S3 policy or throttles in `infra/`; input validation and write
  paths in `api/app.mjs`, `api/write.mjs` and `api/lib/`; anything touching `docs/SECURITY.md` claims. Have Sonnet review even if Haiku
  wrote it.
- **Cross-cutting change.** A refactor across more than ~3 modules, or a change to a shared schema (content schema v2,
  DynamoDB single-table keys, the API contract).
- **Non-obvious root cause.** Flaky e2e, nondeterminism, a test that fails only in CI, a performance regression.
- **Interpretation, not execution.** Reading lab/sim output to decide a balance change, or weighing design
  trade-offs where the answer needs code-level judgement. Haiku runs the sims; Sonnet interprets them when the call
  isn't obvious. If the question is about feel, fairness or what the target should be, use `game-designer` instead.

Escalation is per task, not per session: once the hard part is solved, hand follow-up mechanical work back to Haiku. If
Sonnet also fails, the orchestrator re-plans (split the task smaller, gather missing context, or ask the user); it does
not escalate implementation to Opus.

### Game design work

Use `game-designer` directly (not via escalation) for:
- new mechanics, cards, relics, doctrines or packs at the design stage;
- balance intent ("what should this feel like", "which win rate is right");
- onboarding and tutorial;
- reward, progression and feedback/juice;
- reviewing playtest or e2e output for feel.

The loop:
1. `game-designer` proposes, with a measurable hypothesis and the lab metric that would confirm or refute it.
2. The orchestrator turns the implementation sketch into Haiku briefs.
3. `implementer` or `content-author` builds it and runs the lab commands the proposal names.
4. `game-designer` reviews the results against the hypothesis.

Statistical or code-level root-causing of odd lab results still goes to `senior-engineer`. The designer does not write
code, and the no-dark-patterns guardrail in its definition applies to every proposal.

### Cost and context discipline

- Long-running or noisy commands (`npm run sim`, `lab:*`, `npm run e2e`, `npm run data`) go to a Haiku agent with an
  instruction to return a summary, not raw output.
- Prefer one well-scoped agent over several overlapping ones. Prefer `SendMessage` to an existing agent over spawning a
  fresh one for follow-ups on the same task.
- Do not ask agents to "explore and decide". Opus decides; agents execute.

## Project rules every agent must follow

Include the relevant ones in each brief. Subagent definitions already carry the core set.

- **Generated content is not hand-edited.** `content/core/*.json` comes from `scripts/gen-*.mjs`; `content/packs/<id>.json`
  comes from `scripts/packs/<id>.mjs` via `node scripts/gen-packs.mjs <id>`. Edit the source, regenerate, then
  `npm run validate`. Delete `content/packs/<id>.json` first if `base` changed (see `docs/CONTENT_AUTHORING.md`).
- **`data/` is never hand-edited.** It is regenerated by `npm run data` from real datasets (`docs/DATA_SOURCES.md`).
- **The engine is pure and deterministic.** No `Math.random`, wall-clock time, I/O or environment access in `engine/`
  rule paths; use the counter-based RNG in `engine/rng.js`. State must stay JSON-serialisable. The same code runs in the
  browser, the Lambda verifier and the lab.
- **Every claim is sourced.** Cards need a `lesson` and `refs`; refs must resolve offline (`npm run validate` fails
  otherwise). Gameplay interpretations are labelled as such; MITRE data is not paraphrased into something it isn't.
- **No new dependencies** without the orchestrator's explicit approval (and the orchestrator asks the user). The SPA
  self-hosts fonts and icons under a strict CSP; do not add CDN loads.
- **Icons** used by UI or content must exist in `web/icons` (`npm run icons`).
- **Australian English** in docs, UI copy and content (organise, defence, licence as a noun).
- **Tests** use `node --test` in `test/*.test.mjs`. New engine behaviour gets a test; never skip or delete a test to get
  green.
- Node 22+.

## Commands

```bash
npm install
npm run dev                 # build + serve http://localhost:5173 with in-process API (in-memory store)
npm test                    # engine, API, DynamoDB (Dynalite), lab, every pack's full run and TTX
npm run validate            # content + offline reference checks
npm run icons               # icon names exist
npm run ci                  # validate + test + icons + build: must pass before commit
npm --prefix infra test     # CDK assertions (when infra/ changes)
npm run e2e                 # Playwright UI bot (needs npm run dev running)
npm run sim                 # balance snapshot
node lab/cli.mjs ladder --n 40 --scenarios all   # see docs/PLAYTEST_LAB.md for the full lab
node scripts/trace.mjs      # event trace for a seed (debugging a battle)
```

## Map

| Area | Path | Notes |
|---|---|---|
| Rules engine | `engine/` | Pure, deterministic; shared by SPA, Lambda verifier and lab |
| Content | `content/core`, `content/packs` | Generated; sources in `scripts/gen-*.mjs`, `scripts/packs/*.mjs` |
| Real data | `data/` | ATT&CK, EMB3D, CTID, flows, baselines, adversary decks and dossiers |
| SPA | `web/` | Preact + htm, esbuild (`scripts/build-web.mjs`) |
| API | `api/` | Read/write Lambda handlers; `api/local.mjs` mounts them in dev |
| Infra | `infra/` | CDK (TypeScript) |
| Playtest lab | `lab/` | Seeded sims, agents, fuzzing, tuning; output in `lab/out/` (git-ignored) |
| Tooling | `scripts/` | Generators, validators, build, e2e, screenshot scenes |
| Docs | `docs/` | Design, guide, authoring, data, local dev, deploy, lab, security |
