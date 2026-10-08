# Playtest lab (automated balance and QA)

`lab/` is a deterministic simulation rig built on the same engine the browser and the Lambda run. It answers three questions:
*Is the game fair, does skill matter, and is anything broken?* Everything is seeded: a result is a function of
(content, seed), so every finding is reproducible and comparable across balance changes (common random numbers).

```bash
node lab/cli.mjs ladder --n 40 --scenarios all   # full runs by skill, doctrine and scenario
node lab/cli.mjs adversaries --n 40              # per-adversary win rate at realistic decks, by skill
node lab/cli.mjs cards --n 60                    # card power by paired ablation
node lab/cli.mjs relics --n 80                   # relic power by paired ablation
node lab/cli.mjs fuzz --n 200                    # random legal/illegal actions + invariants + replay equality
node lab/tune.mjs --n 24 [--apply]               # calibrate goals and per-adversary knobs to target win rates
node lab/report.mjs                              # lab/out/report.html (heat maps, intervals, flags)
```

## Agents (the skill ladder)

| Skill | What it is | Role |
|---|---|---|
| `random` | Uniform over legal plays, ends turn at random | The floor. A good game crushes it. |
| `novice` | Heuristic with large score noise, skips turns, holds no consumables | A first-hour player |
| `standard` | Heuristic that reads the briefing (adversary mitigations, goal, intent), values reveals/evictions by goal relevance, holds consumables for emergencies | An attentive player |
| `sharp` | Same heuristic with almost no noise | A careful player |
| `expert` | Determinised Monte-Carlo planner: for each candidate play it clones the battle, re-seeds future randomness, finishes with the `sharp` policy and averages outcomes | Skill ceiling |

The expert sees hidden footholds and the adversary's current hand, so it is an upper bound, not a human proxy. It is also
about 150x slower, so it is used on samples. Run-level agents (`lab/agents/run.mjs`) add map routing, card picks that balance the
deck and cover the act's mitigations, shop spending, rest/upgrade choices, event scoring and whiteboard accuracy.

## What it measures

- **Skill ladder**: win rate of full runs per skill with 95% Wilson intervals. Target shape: random about 0%, novice single digits,
  standard 15-20%, sharp about 30%, expert 50%+.
- **Adversary matrix**: win rate by adversary and skill at *realistic* decks (`lab/decks.mjs` builds the deck a player has by
  act and node). Flags: easy (>95%), brutal (<25%), flat (play barely matters).
- **Card and relic power**: paired ablation on identical seeds, one slot swapped for the card; reports win-rate lift with a CI.
- **Loss causes**: goal vs resilience vs crown-jewel loss, which tells you whether a clock or attrition is the problem.
- **Where runs die**: pass rate by act and node (battle/elite/boss).

## Calibration

`lab/tune.mjs` minimises squared error between simulated win rates and a target table (`TARGET`, by act and node) over every
(scenario, act, node, adversary, tier) appearance in every pack roster. Stage G sets one need-offset per goal kind; stage A
calibrates per-adversary knobs (`goalNeed`, `energy`, `power`, `exposure`) with small ranges so the *shape* of difficulty
comes from the global rules, not from per-adversary patches. Adversaries that still need the edge of their range are
reported as structural problems. `--apply` writes `scripts/balance.json`; `gen-meta.mjs` and `gen-adversary-meta.mjs` merge it
into `content/core`, so the numbers are committed, reviewable data.

Other global knobs live in `tuning.balance` (`wardAdd`, `detectStrAdd`, `detectNAdd`, `evictAdd`, `healAdd`, `shieldAdd`) and in
tier tables; any content override can be tried without editing files by passing `overrides` (tuning, adversaryMeta, cards,
doctrines) to `getContent` in `lab/sim.mjs`.

## QA

`lab/fuzz.mjs` plays random legal moves and deliberately illegal ones against every pack. After each action it checks:
finite numbers, hit points in range, every card in exactly one zone, slots not exceeded, illegal actions rejected without
mutating state, JSON-serialisable state, termination, and that the action log replays to an identical final state. The first
run found a real bug (a replaced policy stayed listed as in play).

## Reading results honestly

- Bots are not people. Use the ladder for *shape* (monotonic, steep) and the matrix for *outliers*, then play the outliers.
- Targets are design choices, not measurements. Change them in `TARGET` when the design intent changes.
- `standard` and `sharp` share a policy; the gap to `expert` is the room a human has to be better than the heuristic.

## Balance pass (current baseline)

Rule baseline (`scripts/balance.json`): hand 6, ward +1, detection reach +1, adversary energy +2, rounds +2, adversary exposure −3, count-mode goals, no goalAI. Per-adversary goal clocks, energy, power and exposure come from `node lab/tune.mjs --n 30 --apply`, then `node lab/adjust.mjs <adversaries.log> --apply` nudges outliers from the adversary matrix.

Full-run clear rate (enterprise, fresh seeds): random ≈ 0–1%, novice ≈ 17–18%, standard ≈ 38–41%, sharp ≈ 37–39%.

### What the doctrine experiments (`lab/doctrine.mjs`) showed
- Hero powers do not move win rates: capping Contain at cost 2, +1 Harden and +1 Failover left every doctrine's standard clear rate unchanged to the percentage point. The design-review hypothesis that powers drive the spread was falsified.
- The Runbooks relic (first Respond card each round −1) was responsible for most of the responder's lead: swapping it out took responder from 82% to 45%. It now never reduces a card below 1 (82% → 55%).
- Starting resilience is a strong lever (about 1.4pp per HP at the margin). Architect 60, phoenix 58, governor 44, hunter 36, responder 30 gives a standard-skill spread of 22–47% (was 6–68%).

### Mechanics ablation (standard agent, one capability banned)
Evict −8pp, isolate −7pp, detect −6pp. Ward, heal, policies, augments, intel and consumables are within ±1.5pp: they are inert at the margin for this player. That is the main source of low decision depth.

### Skill expression
sharp ≤ standard and lite (the Monte-Carlo planner) = standard over full runs. Better play than the heuristic is not rewarded. Candidates: retain-1 card, interest economy, boss pools (see docs/DESIGN_REVIEW_2.md).

### Known outliers
Adversaries still under 65% for standard: G0007, G0129 (Mustang Panda), C0028, C0024, C0063 (Poland wiper). Their goal-clock knobs are at or near their limits, so the cause is structural (destroy/disrupt payoffs against few defender answers). About 15 T1/T2 adversaries are flat (random ≥ 85%): they never threaten a good deck.
