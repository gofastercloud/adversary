# ADVERSARY design review 2

Basis: engine/run.js, engine/battle.js, engine/tactics.js, content/core/*.json, content/packs/*.json, lab/out/ladder.json (400 runs, enterprise, assurance 1), lab/experiments.mjs, lab/sim.mjs. All lab commands below exist today; "override" means the `overrides` argument of `getContent` (lab/sim.mjs), so experiments 1 and 3a need no engine edits.

## Top 5 problems (read from mechanics and ladder.json)

1. **Contain is a free, unconditional "delete one asset from the fight" button.** `doctrines.json` responder power: cost 1, every round, `isolate` (battle.js:332). Isolated assets cannot be targeted by breach, spread, creds, stage, exfil, strike or impair (battle.js:567-584). Responder wins 18/20 standard runs with the lowest resilience (34), architect 3/20 with the highest (48). Fix: make Contain cost 2 or give it a 2-round cooldown, and let isolation block only adversary plays *originating* from or *into* the asset, not beacons already running.
2. **Whole hand discarded every turn, 12-card starter, 3 energy.** `endTurn` discards the hand. With hand 6 and energy 3 the deck cycles in two turns, so there is little sequencing, hold-or-play or hand-reading, which is why `sharp` (same policy, less noise) equals `standard`. Fix: Retain 1 card (and optionally carry 1 energy via the existing `energyNext`); this creates a genuine "what do I save" decision.
3. **Act 2 is an attrition wall.** Of 54 standard-skill losses in ladder.json, 30 are in Act 2 and the top killers are G0096 and G0125 by *resilience* (15 losses), then G1015/G0032/G0016 by crown-jewel. Resilience only recovers via rest (30%), a 40-gold shop heal, or the 50% act-clear heal; `genMap` does not guarantee a rest node. Fix: guarantee one rest-or-shop node in step 4 of every act and let beacon drain be visibly capped (e.g. 3/round) so players can plan.
4. **Economy gives no Balatro-style compounding.** Start gold 60-75, battle reward 18-30, relics cost 120-220 (`tuning.json` shop/rewards), so relics are almost only found as elite/boss rewards; shop choices collapse to "remove a card" or "buy one common". Nothing scales. Fix: add interest (+1 gold per 10 held, cap 5) and cut shop relic prices about 30%, making spend-vs-save a real choice.
5. **Fixed spine limits replayability.** `genMap` always produces battle, 2 of 4 types, elite-or-X, 2 of 3-4 types, boss; each act's boss is a single id in `roster.acts[].boss`; each pack has only 3-4 battle adversaries per act, and `chooseAdversary` picks uniformly among them. After about 10 runs per pack the player has seen everything. Fix: `bossPool` of 2-3 per act, visible next-node adversary ("forecast"), and optional heat mutators (see Experiment 3).

Secondary: 87 cards total (about 17 controls usable on the board, 26 actions), reward = pick 1 of 3 or skip, doctrine focus weight 2.2x (run.js `cardWeight`), so deck identity is mostly decided at turn zero by the starter list.

## Part 1: Three experiments

All use common random numbers (same seeds across arms; `seedOf` in lab/experiments.mjs is arm-independent) and the paired-difference helper `pairedDiff` in lab/stats.mjs.

### Experiment 1: Hero-power parity (addresses doctrine imbalance)
- **Hypothesis**: doctrine spread is driven by the hero power and starter list, not resilience (PLAYTEST_LAB says resilience tweaks barely move it). Capping Contain and strengthening the weakest powers compresses the spread to under 25pp without lowering the overall clear rate.
- **Change** (arm B, override-only first):
  - `doctrines.responder.power.cost: 2`.
  - `doctrines.architect.power.fx[0].n: 3` and `cost: 1`.
  - `doctrines.governor.power`: add `{op:"energyNext", n:1}` on top of draw (the op exists, battle.js:316).
  - `doctrines.phoenix.power.fx[0].n: 3`.
  - Arm C (needs about 6 lines): Contain 2-round cooldown via `b.powerCd` in `usePower`/`startRound`.
- **Measure**: `node lab/cli.mjs ladder --n 100 --scenarios enterprise` for arms A (baseline), B, C; skills standard and sharp (500 runs per skill per arm, 100 per doctrine). Report per-doctrine win with Wilson 95% CI, spread = max minus min, overall clear. Then `cards --n 60` to check `x.soar` and the c.respond cells did not become the new outlier. Repeat on `ot` and `banking` for generality (n=60).
- **Success**: every doctrine 20-50% (standard skill), spread at most 25pp, overall standard clear 30-40%, and no more than 1 doctrine's CI excluding the pooled mean. Failure: responder stays above 55%, which implies the problem is the starter deck (6 respond/detect cards) rather than the power, and the next step is a starter-deck swap.

### Experiment 2: Retain-1 plus energy carry (addresses weak skill expression)
- **Hypothesis**: skill is capped because the opponent telegraphs a greedy move and the hand is wiped each turn. Retain adds sequencing and information-value decisions, so higher-skill agents beat lower ones.
- **Change**: `tuning.battle.retain: 1` (default 0). In `endTurn` (battle.js:505) move up to `retain` chosen iids to a `b.kept` list instead of discarding; `startRound` draws `handSize - kept.length`. Add action `{type:'RETAIN', iid}` before END_TURN, valid only when `b.phase==='defender'`. Heuristic agent: retain the highest-scoring unplayed card whose cost exceeds the remaining energy or whose target does not yet exist (reuse `scorePlay`). Add `retain` to `fuzz.mjs` invariants (card in exactly one zone). Optional arm: `energyCarry: 1`, via `energyNext`.
- **Measure**: `ladder --n 100` with skills `standard, sharp, lite` and `expert` at n=20 (expert is about 150x slower, per PLAYTEST_LAB); `adversaries --n 40` for per-adversary flat flags (play barely matters); `fuzz --n 200` for invariants and replay equality. Metrics: skill gap `sharp - standard`, `lite - sharp`, `expert - lite`, and the "flat" flag count in lab/out/adversaries.json.
- **Success**: monotonic ladder with sharp at least +5pp over standard and lite at least +5pp over sharp (current sharp-minus-standard is about -3pp), standard clear stays 30-40%, flat-adversary count drops by at least a third, fuzz clean. If the gap stays near 0, the heuristic does not use retain well; then check the gap in `expert` (which clones battles, so it exploits retain automatically) to prove the *design* has depth even if the bot does not.

### Experiment 3: Variety and run-level decision depth (addresses replayability)
- **Hypothesis**: players' run-level choices barely change outcomes, and run structure repeats. Boss pools, a forecast and optional heat make choices matter and runs diverge.
- **Change**:
  - (a) Measurement only: add to `lab/agents/run.mjs` a "pick-regret" counterfactual. At each reward, fork the run and force (i) agent's best pick, (ii) random pick, (iii) skip, and compare final win rate over 100 seeds.
  - (b) Content: `roster.acts[i].bossPool: [a,b]` (pick via `randInt(...,'boss')` in `chooseAdversary`); show `next.adv` for battle/elite nodes on the map; `genMap` gives 3 options at steps 2 and 4.
  - (c) Heat: `run.heat` 0-3 chosen at setup, each point adds a named mutator (OT legacy asset with -1 ward, outsourced SOC with -1 detect reach, audit pending with +1 goal need), paying +15% points via `finish()` multiplier.
- **Measure**: `ladder --n 100` standard. New metrics: unique (boss, elite) sequences per 100 seeds (target at least 40 against about 4 now), mean pairwise Jaccard of final decks (lower is better), pick-regret (best minus random), win rate by heat level, and routing value (agent that uses forecast vs agent that ignores it).
- **Success**: pick-regret at least +4pp (best vs random pick), forecast routing value at least +3pp, unique sequences at least 10x baseline, heat 0..3 win rates spaced about 8-10pp apart (monotone), overall heat-0 clear unchanged within 3pp.

## Part 2: Five new packs / addons

Common note: new adversaries should be built through the `build-custom-adversaries.mjs` path where ATT&CK has no group (as with TeamPCP). Verify every group/campaign ID against the STIX bundle in `data/attack/` before authoring; IDs below marked (v) are from memory and must be checked.

### Pack 1: Hospital and Clinical Care
- **Premise**: a regional hospital network hit by ransomware during a clinical shift; downtime procedures vs restoring EHR.
- **Assets**: EHR, PACS/imaging, pharmacy dispensing, patient-facing medical devices (unpatchable), biomed network, theatre scheduling, backup, identity, MSP remote access.
- **Adversaries**: FIN12 G1016 (v), Wizard Spider G0102 (in game), Indrik Spider G0119 (v), INC Ransom G1032 (in game), Lazarus G0032 (WannaCry, in game), a custom "healthcare extortion crew" profile.
- **Mechanics**: *Patient-safety clock* (a secondary resilience that only clinical-asset damage drains; reaching 0 is a loss, mirroring safety over confidentiality); *Downtime procedures* action (exchange integrity for safety clock stabilisation); *Unpatchable device* asset flag (compensating-control cards only, citing EMB3D properties; the engine already supports EMB3D `expert` mappings).
- **Learning**: safety-first triage, segmentation of biomed, compensating controls, backup and downtime planning, notification decisions.
- **Frameworks, legally required (AU)**: Privacy Act 1988 NDB scheme (OAIC); SOCI Act 2018 (health care and medical sector is a defined critical infrastructure sector; risk management program and cyber incident reporting apply to specific assets); My Health Records Act 2012; state health-records laws (e.g. NSW HRIP Act 2002); Cyber Security Act 2024 ransomware payment reporting where thresholds apply. **Good practice**: Essential Eight, AESCSF is energy-only so not applicable, HHS 405(d) HICP, ISO 27799, TGA medical device cybersecurity guidance, NIST CSF 2.0.

### Pack 2: Telecommunications Carrier (edge devices and management plane)
- **Premise**: a mid-size carrier discovers implants on routers and in lawful-intercept infrastructure.
- **Assets**: core routers, provider-edge routers, OSS/BSS, lawful intercept (LI) gateway, subscriber database (jewel), NOC jump hosts, vendor remote access, SIM provisioning.
- **Adversaries**: Salt Typhoon G1045 (v), Volt Typhoon G1017 (in game), APT41 G0096 (in game), APT40 G0065 (v), Mustang Panda G0129 (in game).
- **Mechanics**: *Management-plane* asset zone (reachable only via exposed jump host; ACLs are cards); *Firmware integrity* augment ("verify image hash") that resists specific persistence techniques; *Lawful-intercept leak* goal: espionage "reach" goal fires when a foothold sits on the LI asset undetected (reuses the preposition/dwell rule).
- **Learning**: edge-device exposure, out-of-band management, logging off-box, vendor patch cadence, why implants on routers evade EDR.
- **Legal (AU)**: Telecommunications Act 1997 Part 14 (Telecommunications Sector Security Reforms: security obligation and notification of changes); SOCI Act (communications sector); Telecommunications (Interception and Access) Act 1979; Privacy Act and TCP Code (consumer). **Good practice**: ASD/ACSC joint advisories on network device hardening, NIST CSF 2.0, GSMA FS.31 baseline, 3GPP SCAS.

### Pack 3: Ransomware Crisis and Extortion Decision (TTX-first addon)
- **Premise**: a mid-market company is 36 hours into a double-extortion event; the board must decide on negotiation, payment and disclosure. Plays as a battle plus decision injects.
- **Assets**: file servers, ERP, backup, customer data (jewel), email, leak-site exposure, insurer and counsel relationships.
- **Adversaries**: Wizard Spider G0102, Scattered Spider G1015, FIN12 G1016 (v), INC Ransom G1032, Akira and Play as custom profiles (cite vendor reports; behaviours only, as with TeamPCP).
- **Mechanics**: *Ransom demand* decision card (pay: goal clock resets, but a `status.techdebt`-style Reputation/Reoffer card enters the deck and exfil leak goal still scores; refuse: demand escalates); *Evidence preservation vs rapid restore* trade-off (restoring wipes forensic value, lowering the fast-evict bonus); *Regulator clock* (72-hour report as a visible countdown mapped to rounds).
- **Learning**: pay/not-pay is a risk decision with legal, insurance and sanction constraints; backups protect against encryption but not extortion; immutable and offline backups; comms discipline.
- **Legal (AU)**: Cyber Security Act 2024 ransomware payment reporting (72-hour report for covered entities, in force from 30 May 2025; confirm current thresholds); Privacy Act NDB scheme; SOCI incident reports (12h critical / 72h other for covered assets); OFAC-style sanctions screening via Australian autonomous sanctions law (DFAT). **Good practice**: ACSC ransomware guidance, Essential Eight (backups, MFA, patching), NIST SP 800-61r3, insurer panels and breach counsel (already cards).

### Pack 4: Research and Defence Industry (espionage and IP)
- **Premise**: a university research institute with defence-adjacent contracts; slow, stealthy collection.
- **Assets**: research data lake (jewel), HPC cluster, collaboration email, student/staff identity federation (e.g. eduroam/AAF-style), lab OT instruments, partner VPN, cloud storage.
- **Adversaries**: APT40 G0065 (v), Silent Librarian G0122 (v), APT10 G0045 (in game), Lazarus Operation Dream Job (campaign C0022 in game), APT41 G0096 (in game), Mustang Panda G0129 (in game).
- **Mechanics**: *Low-and-slow exfil* goal variant: data leaves in small increments, so only DLP-style detection (a new `detect.scope:'data'` monitor) counts; *Collaboration trust* edge (partner links bypass wards, mirroring tprm's vendor foothold flag); *Classification labels* on data assets that change the score of an exfil hit.
- **Learning**: espionage patience, federated identity phishing, collaboration risk, data classification, export-control awareness.
- **Legal (AU)**: SOCI Act (higher education and research; defence industry sectors); Defence Industry Security Program for defence contractors; Defence Trade Controls Act 2012 (technology export). **Good practice**: Essential Eight, ISM, Guidelines to Counter Foreign Interference in the Australian University Sector, NIST SP 800-171 (for US-linked contracts).

### Pack 5: Insider and Privileged Access
- **Premise**: a financial or energy operator with a malicious or coerced insider plus helpdesk social engineering.
- **Assets**: PAM vault, helpdesk and IdP, HR system, source repositories, finance approval workflow (jewel), HSM/keys, leavers' accounts.
- **Adversaries**: LAPSUS$ G1004 (in game, insider recruitment), Scattered Spider G1015 (in game, helpdesk), a custom "malicious insider" profile (like Maroochy in the TTX), Volt Typhoon G1017 (valid accounts).
- **Mechanics**: *Insider* trait: starts with a **legitimate-credential foothold** that is not an exposed-asset breach; ward cards cannot stop it, only detection and least-privilege (JIT/dual control) reduce its power; *Behavioural baseline* monitor that gets stronger the longer it runs; *Joiner-mover-leaver* action that revokes dormant footholds.
- **Learning**: preventing vs detecting insiders, privilege creep, separation of duties, helpdesk verification, privacy limits of monitoring.
- **Legal (AU)**: SOCI Act risk management program covers personnel hazards; Privacy Act; Fair Work Act and state workplace-surveillance laws (e.g. NSW Workplace Surveillance Act 2005) constrain monitoring; APRA CPS 234 and CPS 230 for regulated entities. **Good practice**: Essential Eight (restrict admin privileges, MFA), CERT insider threat guide, NIST CSF 2.0, ISM personnel security.

## Part 3: Five new data sources (all verified reachable from this environment on 2026-10-08)

| # | Source | URL | Licence / offline | Feeds | Effort |
|---|---|---|---|---|---|
| 1 | **CISA Known Exploited Vulnerabilities (KEV)** | https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json (also github.com/cisagov/kev-data) | CC0 1.0 (LICENSE in kev-data verified). Static JSON, can be snapshotted at build time; `knownRansomwareCampaignUse` field | Adversary "initial access" card flavour and weights (which products are really exploited), ransomware-use flag as breach-card weight, daily-challenge themes, "patch SLA" event cards (E8 48-hour rule) | S |
| 2 | **MITRE D3FEND ontology** | https://d3fend.mitre.org/ontologies/d3fend.json (v1.6.0, release 2026-08-31) | `dcterms:license: MIT` in the file's ontology header (verified); MITRE site Terms of Use also apply; one 4.8 MB JSON-LD file, offline OK | Defender card `mit` list: map each of the 36 controls to D3FEND techniques and ATT&CK-to-D3FEND links, so wards cite D3FEND instead of only ATT&CK mitigations; richer codex; "why it blocks" explanations | M |
| 3 | **FIRST EPSS** | https://epss.cyentia.com/epss_scores-current.csv.gz (daily); info https://www.first.org/epss/ | FIRST states scores are published "freely and openly accessible" via CSV, API and GitHub; no formal SPDX licence found, so cite FIRST and check the Terms of Use before redistribution. Daily CSV, snapshot at build | Joined to KEV to produce a likelihood weight on CVE-themed events and a "Vulnerability triage" whiteboard question type (KEV vs EPSS vs CVSS) | S |
| 4 | **CISA ICS advisories as CSAF 2.0** | https://github.com/cisagov/CSAF (index: raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/index.txt, per-advisory JSON verified) | Distribution marked TLP:WHITE "Disclosure is not limited"; legal notice "as is, no endorsement" (verified in file). Static files; snapshot at build and cite advisory IDs | OT/utilities/hospital events and TTX injects based on real vendor advisories, device-type assets with CVSS, "unpatchable device" flags for Pack 1, achievements ("read 10 advisories") | M |
| 5 | **Atomic Red Team** | https://github.com/redcanaryco/atomic-red-team (index: atomics/Indexes/index.yaml, HTTP 200 verified) | MIT (LICENSE.txt verified). YAML, offline at build | Per-technique "how a purple team would test this" text, command-line observables for dossiers (behaviours only, as DESIGN says), detect-card lesson text, "Purple Team" action flavour (`x.purple`), per-technique testability weight | M |

Not recommended without further verification: OAIC Notifiable Data Breaches reports (https://www.oaic.gov.au/privacy/notifiable-data-breaches/notifiable-data-breaches-statistics lists half-yearly reports but they are PDF/HTML summaries; licence and machine-readability not confirmed; usable only as hand-cited statistics for AU event cards); VERIS Community Database (github.com/vz-risk/VCDB is reachable but I could not find a licence statement in its README, so do not ingest until one is confirmed).

## Suggested order
1. Experiment 1 (override-only, one afternoon) and data source 1 (KEV, small).
2. Experiment 2 (about 40 lines plus agent change); Pack 3 (TTX-first, least new engine).
3. Experiment 3 and Pack 5 (needs the "legitimate-credential foothold" flag in `plantFoothold`).
