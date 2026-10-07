# ADVERSARY pack format (schema v1)

Packs are plain JSON in `packs/`. `core.json` holds the rules (deck matrix, hand types,
frameworks, playbooks, core doctrines). Every other file is an **expansion pack**: a
*campaign* (an organisation under attack) plus extra doctrines. A run = `core` + one
**campaign pack** (sets theme, org, 8-ante campaign, DFD systems, card re-skins) + 0–2
**extra packs** (only their `jokers` and `playbooks` join the shop pool).

Run `npm run validate` — it checks everything below, including that every MITRE ID exists in
the offline ATT&CK (Enterprise + ICS) and D3FEND indexes in `scripts/data/`.

## Vocabulary

| Game term | Real concept |
|---|---|
| Card (control) | One cell of the 6×6 matrix: NIST CSF 2.0 *function* × STRIDE *property* |
| Function (rank) | `govern identify protect detect respond recover` (in that order — straights use it) |
| Property (suit) | `spoofing tampering repudiation disclosure dos elevation` = Authentication, Integrity, Non-repudiation, Confidentiality, Availability, Authorisation |
| Cell id | `<function>.<property>`, e.g. `protect.spoofing` |
| ML (1–3) | Essential Eight style maturity level of a card instance |
| Doctrine (joker) | Passive modifier backed by a real practice/standard |
| Playbook (tarot) | One-shot consumable that edits cards/economy |
| Framework (planet) | Levels up a hand type (core only) |
| Blind | An attack stage (small/big) or a named technique (boss) |
| Whiteboard | STRIDE-per-element threat-modelling mini-game on a DFD |

## References (`refs`)

Everywhere a `refs` array appears it holds compact strings `source:id`. The resolver
(`engine/refs.js`) turns them into labelled links. Unknown sources/ids fail validation.

| source | id format | example |
|---|---|---|
| `attack` | Enterprise technique/sub-technique/mitigation/tactic/group/software | `attack:T1078.004`, `attack:M1032`, `attack:TA0006`, `attack:G0016` |
| `ics` | ATT&CK for ICS ids | `ics:T0855`, `ics:M0802`, `ics:TA0108` |
| `d3fend` | exact D3FEND id | `d3fend:Multi-factorAuthentication` |
| `capec` / `cwe` | number | `capec:66`, `cwe:89` |
| `owasp-top10` | `A01`..`A10` (2021) | `owasp-top10:A03` |
| `owasp-api` | `API1`..`API10` (2023) | `owasp-api:API1` |
| `owasp-llm` | `LLM01`..`LLM10` (2025) | `owasp-llm:LLM01` |
| `owasp` | `asvs`, `samm`, `threat-dragon`, `threat-modeling-manifesto`, `cheatsheets`, `devsecops`, `mas` | `owasp:asvs` |
| `nist-csf` | CSF 2.0 category/subcategory | `nist-csf:PR.AA-03` |
| `nist-800-53` | Rev 5 control | `nist-800-53:AC-6`, `nist-800-53:AC-6(9)` |
| `nist` | publication keys: `800-30 800-37 800-39 800-61 800-82 800-160v2 800-161 800-171 800-207 800-218 1800-?` | `nist:800-82` |
| `e8` | `app-control patch-apps macros hardening restrict-admin patch-os mfa backups maturity-model` | `e8:mfa` |
| `iec62443` | part e.g. `3-3`, `2-1`, `3-2`, `4-2`, `overview` | `iec62443:3-3` |
| `aescsf` / `soci` / `apra` / `iso27001` / `cis` / `pci` / `swift` / `cloud` / `stride` / `purdue` | free-form short id (shown as label, links to a landing page) | `soci:csirp`, `apra:cps234`, `iso27001:A.8.5`, `cis:5`, `pci:8.4`, `cloud:shared-responsibility`, `stride:S` |

Only cite what you are confident is correct. Prefer fewer, accurate refs (1–4 per item).

## `core.json` (rules; do not add campaign content here)

```
{ "schema":1, "id":"core", "kind":"core", "name", "version",
  "functions":[{id,name,short,csf,color,icon,blurb}] x6,
  "properties":[{id,name,stride,letter,property,color,icon,blurb}] x6,
  "cells": { "<fn>.<prop>": {name, flavour, desc, refs} } x36,
  "handTypes": [{id,name,real,desc,chips,mult,lchips,lmult,refs}],
  "frameworks":[{id,name,hand,desc,refs,icon}],
  "playbooks": [...], "jokers": [...], "tags":[...], "economy": {...}, "bosses": {...} }
```

## Campaign / expansion pack

```
{
  "schema": 1, "id": "utilities", "kind": "campaign", "name": "Utilities", "version": "1.0.0",
  "tagline": "≤60 chars",
  "icon": "<icon key>",                       // from web/icons (see allowed list below)
  "theme": { "accent": "#hex", "accent2": "#hex", "bg": ["#hex","#hex","#hex"] },  // dark, moody bg colours for the shader
  "org": { "name": "Gridline Energy", "sector": "...", "brief": "2–4 sentences, who they are, what matters",
           "crownJewels": ["..."], 
           "regimes": [ { "name": "SOCI Act 2018 (Cth)", "note": "1–2 sentences: what it actually requires", "refs": [] } ] },
  "cardOverrides": { "protect.spoofing": { "name": "...", "flavour": "≤48 chars", "desc": "1–2 sentences, sector-specific", "refs": [] } },   // 10–14 cells; NAME must keep the same security meaning of that cell
  "jokers": [ Joker × 8 ],
  "playbooks": [ Playbook × 0–2 ],            // optional
  "campaign": { "antes": [ Ante × 8 ] },
  "systems": [ System, System ],              // DFD "systems" for the Whiteboard (antes 1–4 use system 0, 5–8 use system 1)
  "reading": [ { "title": "...", "url": "https://...", "note": "optional" } ]   // 3–6 official, stable URLs only
}
```

Extra packs (used only as shop additions) still need `jokers` (and may have `playbooks`); they
may omit `campaign`/`systems`/`org`.

### Ante / Blind

```
Ante  = { "name": "Initial Foothold", "small": Blind, "big": Blind, "boss": Boss }
Blind = { "name": "Spear-phishing Wave", "tactic": "attack:TA0001", "technique": "attack:T1566.001",
          "blurb": "1–2 sentences of how it plays out in THIS org (concrete, not generic)",
          "counters": ["protect.spoofing","detect.spoofing"],     // 1–4 cell ids that counter it (+bonus when scored)
          "mitigations": ["attack:M1017","attack:M1032"],          // real mitigation refs
          "refs": [] }
Boss  = Blind + { "rule": {…}, "lesson": "2–3 sentences: what defenders should do; shown in debrief" }
```
Use `ics:` ids for `tactic`/`technique`/`mitigations` in OT packs where appropriate (ICS ids). The
`tactic` must be a TA id; `technique` a T id. A boss's `rule` must be *causally honest*: the
debuff should reflect what that technique really defeats. 8 bosses must use ≥5 distinct rule types.

#### Boss `rule` keys (combine at most 2)

| key | meaning |
|---|---|
| `debuffFn`: id or [ids] | cards of that CSF function score nothing |
| `debuffProp`: id or [ids] | cards of that STRIDE property score nothing |
| `handsSet`: n | you only get n hands |
| `discardsSet`: n | you only get n replacements (0 = none) |
| `handSizeDelta`: -n | smaller hand |
| `playMin`: n | every hand must contain ≥ n cards |
| `halveBase`: true | hand base chips & mult are halved |
| `moneyPerCard`: -n | lose $n per card played |
| `noRepeatHand`: true | a hand type can't be played twice |
| `oneHandType`: true | after the first hand, only that hand type may be played |
| `disableJoker`: "random" | one random doctrine is disabled each hand |
| `targetMult`: x | boss target = ante base × x (default 2; use 1.5–3) |

### Joker (Doctrine)

```
{ "id": "utilities.outage-drill", "name": "Outage Drill", "rarity": "common|uncommon|rare",
  "icon": "<icon key>", "init": 0,
  "rules": [ Rule, … ],
  "lesson": "1–2 sentences: the real-world practice/standard this represents and why it works",
  "refs": [] }
```
`id` must be prefixed with the pack id. `cost` is derived from rarity (5/7/9). **Do not write
effect text** — the engine generates it from `rules`, so it can't drift.

#### Rule

```
Rule = { "on": Trigger, "if": Cond?, "per": Counter?, "do": Effect?, "grow": Grow? }
```

Triggers: `card` (each scoring, non-debuffed card, L→R), `held` (each card still in hand
when a hand is played), `hand` (once per played hand, after cards), `retrigger` (re-score matching
scoring cards; `do:{times:1}`), `discard`, `round_end`, `boss_defeated`, `passive`.

`if` (all must hold) — *card conditions* (for `card`/`held`/`retrigger`, matched against that
card): `fn` (id or list), `prop` (id or list), `ml` (exact), `mlMin`, `counter` (true = card's
cell is in the blind's `counters`).
*Hand conditions*: `hand` (list of hand type ids, exact), `contains` (list; played cards contain
that pattern: `pair two_pair three four five flush straight full_house`), `playedMax`,
`playedMin`, `scoringMin`, `handsLeft` (hands remaining *after* this one; 0 = final hand),
`firstHand` (true), `noDiscardsUsed` (true), `distinctFnsMin`, `distinctPropsMin`,
`distinctPropsMax`, `moneyMin`, `moneyMax`, `jokersMax`, `boss` (true = only on boss blinds).
For `discard` rules `cardsMin` / `fn` apply to the discarded set.

`per` — scales every numeric value in `do` by a count: `{ "count": C, …filters }` where C is one
of `scoringCards playedCards heldCards discardedCards jokers money(step:n) deckSize handLevel
distinctProps distinctFns handsLeft discardsLeft v`, with optional filters `fn prop ml`. For
`xmult` the result is `1 + xmult × count`.

`do` — `chips`, `mult`, `xmult`, `money` (dollars), `times` (retrigger), and for `passive`:
`handSize`, `hands`, `discards`, `jokerSlots`, `consumableSlots`, `interestCap`. A value of
`"$v"` means the joker's own counter.

`grow` — `{ "by": n, "reset": Cond? }` increments the joker's counter `v` when the rule's trigger
fires and its `if` holds (use with a separate `do:{mult:"$v"}` rule on `hand`). `reset` zeroes it.

Balance guidance (will be re-tuned centrally): card rules chips +10…+40 / mult +1…+4; hand rules
mult +3…+15, xmult 1.5…3 (conditional only), money +$1…+5; passives ±1. Rare = strong but
conditional. Don't write unconditional `xmult`.

### Playbook (consumable, used from the play screen)

```
{ "id","name","icon","cost": 3,
  "op": "setProp|setFn|upgrade|destroy|clone|copyFn|money|createJoker",
  "target": { "min":1,"max":2 },                 // selected hand cards (omit for money/createJoker)
  "params": { "prop":"spoofing" } | { "fn":"detect" } | { "cap": 20 } | {},
  "lesson","refs" }
```

### System (Whiteboard DFD) and Scenarios

```
System = { "id": "gridline-scada", "name": "Historian & SCADA gateway", "blurb": "…",
  "elements": [ { "id":"hist", "type":"process|store|external", "label":"Historian", "x":540, "y":280 } ],
  "flows":    [ { "id":"f1", "from":"eng", "to":"hist", "label":"Tag writes" } ],
  "boundaries": [ { "id":"b1", "label":"Corporate zone", "x":20, "y":20, "w":450, "h":520 } ],
  "scenarios": [ Scenario × 8 ] }
Scenario = { "id":"s1", "target": {"kind":"element"|"flow","id":"hist"},
  "text": "A concrete attacker story, 1–2 sentences, written as an observation about the system",
  "answer": "S|T|R|I|D|E",  "why": "2–3 sentences: why this STRIDE category and not the neighbours",
  "refs": [] }
```
Canvas is **1000 × 560**. Elements are drawn as 170×64 boxes centred on (x,y): use columns
x∈{110,320,530,740,900…} and rows y∈{110,280,450}; keep ≥190 px between centres horizontally and
≥140 vertically. Boundaries are dashed rectangles; every element must lie fully inside or fully
outside each boundary. 5–9 elements, 6–12 flows per system. Flows connect distinct elements and
there is at most one flow per ordered pair. STRIDE-per-element applicability: external → S,R;
process → S,T,R,I,D,E; store → T,R(if it is a log),I,D; flow → T,I,D. Each of the 8 scenarios must
have **one clearly best** answer; cover ≥5 of the 6 letters across a system's 8 scenarios, and at
least two scenarios on flows and two on stores.

## Allowed icon keys

Any filename (without `.svg`) in `web/icons/`. `npm run validate` prints the list on failure.
