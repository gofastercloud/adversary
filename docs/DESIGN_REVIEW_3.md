# ADVERSARY design review 3: UI clarity, first hour, and what the lab says today

Date: 2026-10-13. Headline question (from the user): "the UI is too busy and confusing". Two open decisions (daily streak, balance targets) are settled in Part 2.

## Evidence and how to read it

Every claim carries a tag. Weigh them differently.

- **[shot]** a screenshot captured 2026-10-13, 1440x900 or 390x844 (`now-<w>-NN-*.png`, `30-tut-*.png`). Caveat: the supplied "390 tutorial" folder (`shots-390-tutorial/`) contains 1440x900 images, so the **phone tutorial was not reviewed visually** (code read only).
- **[code]** read from source (file and line given). Not run on a device.
- **[lab]** `lab/` output, enterprise scenario, bots. Shape and outliers only; it does not prove how a human feels. Win rates are Wilson 95% intervals `[lo-hi]`; paired differences are mean +/- 1.96 SE.
- **[untested]** no evidence either way. There is **no human playtest data** in the repo that I could find; every UI judgement below is expert review, not measurement.

Lab runs for this review (all `--scenarios enterprise`, fresh seeds, n per skill = 20 per doctrine x 5 doctrines = 100 runs unless stated):
`node lab/cli.mjs ladder --n 20 --scenarios enterprise --assurance {0|1|2|3} --skills novice,standard,sharp`; `--skills standard,sharp,lite --n 10` (n=50 per skill); `node lab/cli.mjs mechanics --n 10` (170 battles per arm). The paired mechanics run at ML1 and ML3 and the ML3 tuning arms used scratch scripts outside the repo (they call `getContent(..., overrides)` and `skillLadder(..., { overrides })`, both existing APIs). `mechanics` hard-codes `assurance: 1` (`lab/cli.mjs` line 43), so the ML3 mechanics numbers are not reproducible from the CLI until that flag is added (Rec B1).

## Verdict

The core loop works and the skill ladder has the right floor: random 0% [0-4], novice 18% [12-27], standard 39% [30-49] at ML1 [lab, n=100]. The strongest teaching surface (the post-battle debrief with ATT&CK techniques and mitigations, and the "why it was blocked" breakdown) is good. The UI buries it.

"Too busy and confusing" is right, and it is two separate faults. **Busy:** the battle screen shows about 20 readouts in the HUD before the board, three side panels of equal visual weight, and a full-time layer of rain, scanlines, glows, stamps and toasts. **Confusing:** the three ways a fight ends (Goal, Resilience, Exposure) live in three different panels, one concept is shown three ways (Day/clock, round pips, "Round 2" in the log), the drawer button is called "Intel" which is also the name of a mechanic, and the information that would change a decision (which mitigations this adversary respects) arrives at the briefing, after the last point where the deck can change. On a phone it is worse than busy: it is broken (Resilience bar has zero width, the Intel drawer button is hidden, card text is 7.5px with no way to inspect).

Separately, the lab shows two things the UI cannot fix. At ML3 a standard bot that never plays Protect-function cards wins **more** battles (+10.6pp +/- 7.9), which is a wrong-lesson risk. And no agent above `standard` beats it by an interval-separated margin.

## Top problems, ranked by player impact

| # | Problem | Evidence | Fix | Effort |
|---|---|---|---|---|
| 1 | Phone battle is not playable as designed: HP invisible, drawer unreachable, card text unreadable and uninspectable | [shot] now-390-05/06/07; [code] matrix.css:179-181, battle.css:57, battle.css:66 | UI-1 | S |
| 2 | Battle HUD has no hierarchy; win and lose conditions split across three panels | [shot] now-1440-05/07; [code] battle.js:172-194 | UI-2 | M |
| 3 | Tutorial front-loads concepts, omits the goal bar, Resilience and energy, contradicts itself once, and ends in a Setup screen with 6x5x4 choices and ML1 + Architect preselected | [shot] 30-38; [code] docs.js STEPS, screens-menu.js Setup; [lab] architect novice 0/20 [0-16] | UI-5, B4 | M |
| 4 | Briefing and map show information that cannot be acted on, and bury the actionable part | [shot] now-1440-03/04; [code] screens-run.js:33-65 | UI-3, UI-4, B3 | S to M |
| 5 | Protect (ward) is not rewarded by the bot, and is penalised at ML3: a wrong lesson for a game about defence in depth | [lab] ML3 paired n=170: no-ward +10.6pp +/- 7.9 | B1 | M |
| 6 | Hand and board legibility: occluding hover preview, clipped card text, redundant badges, tiny ward chips | [shot] now-1440-05, 37-tut-evict | UI-6 | S |
| 7 | Skill expression stops at `standard`; ML3 is a cliff | [lab] see D2 and B2 | D2, B2 | M |
| 8 | Keyboard and touch cannot operate asset targeting, map nodes or reward cards; tooltips are hover-only | [code] components.js:29,64; screens-run.js:38; ui.js:30-37 | UI-8 | S to M |
| 9 | Daily streak resets to 1 after a missed day and the Daily screen says "Keep your streak alive" | [code] app.js:139, screens-menu.js:39,48,89 | D1 | S |
| 10 | Lost-run screen gives a generic tip instead of the cause; resilience attrition (not the goal clock) decides most losses | [code] screens-run.js:152; [lab] 35 of 61 standard losses by resilience, 7 by goal | UI-7, B5 | S to M |

---

## Part 1: UI clarity (the main event)

### 1.1 Diagnosis

What competes for attention on the battle screen (desktop, `battle.js` 171-225):

1. **Three HUD panels at equal weight and equal glow.** Left: Resilience, Budget, relic count chip, Clock with Day/time and six round pips. Middle: sigil, tier badge, adversary ID, "5 cards" chip, name, role and motive, Exposure bar, trait chips. Right: Goal bar, Intent card with fidelity pips, an "Intent (fidelity 0)" caption, a settings gear and a red Abandon button. That is about 20 readouts and controls before the player reaches the board [code battle.js:172-194, shot now-1440-05].
2. **Win and lose conditions are scattered.** Resilience (left), Exposure (middle, under the adversary's name), Goal (right). A first-time player cannot answer "how does this end?" at a glance. The Exposure bar does not say that filling it wins; the Goal bar does not say who wins when it fills [code battle.js:182, 257].
3. **One concept, three displays.** The round is shown as "Day 1 · 12:00", as six pips and as "Round 2" in the SOC feed [shot now-1440-07]. The clock is flavour (it matters only in TTX injects).
4. **Items that cannot be used in the current context.** Budget ($) is spent only between battles (the tooltip says so, and calls it "Gold", a third name for the same thing). The relic count chip duplicates the Relics panel ("1 relics"). The clearance XP bar in the top bar is irrelevant mid-fight.
5. **Right-hand column spends 250px on mostly empty panels.** Programme shows "Policies you enact stay in force." for most battles; Relics is a row of unlabelled icons. The one panel that teaches (the SOC feed, 11.5px mono) gets the leftover space [shot now-1440-05].
6. **Board.** Each asset tile carries name, icon, jewel gem, HP bar with a ~8px number, six coloured ward boxes with letters, three control slots, badges and foothold chips. The six ward boxes have more visual weight than HP. Nothing says which ward class matters for the telegraphed move. The dashed adjacency lines are never highlighted (`hot` is declared in the SVG but never set, battle.js:57/200) so their meaning (spread and lateral movement) is invisible [code].
7. **Hand.** Cards overlap by 7px and rotate; the effect text clips (the "Counters: M1037..." line is cut in now-1440-05). Each face shows the CSF function twice (3-letter badge and "PROTECT x AVAILABILITY") and the STRIDE class twice (letter badge and property name), plus a "CORE" pack label and a rarity gem on every card [code components.js:29-40, shot].
8. **Effects with equal weight for unequal events.** A routine block fires a floater, two ripples, a particle burst and a sound; an eviction fires a stamp, glyph burst, ripple, shake and sound. Deploys fire a ripple and burst [code battle.js:71-77]. Over a run the routine events dominate the screen.
9. **Dead time.** The adversary's turn plays as a blocking overlay, 650-1050ms per play, with the End turn button disabled and no skip [code battle.js:104-107]. Several plays per turn across roughly 60 turns per run is minutes of forced waiting; I did not time it [untested].
10. **Jargon load before any definition.** Resilience, Exposure, Intel fidelity, Foothold, Grip, Stealth, Ward, STRIDE letters, CSF function badges, Programme, Doctrine, Assurance/ML, Maturity uplift, Decommission, Skirmish, Intrusion set, Apex. Definitions live in hover tooltips and the Guide.
11. **Overloaded word "Intel".** The drawer button is labelled Intel (it opens Programme, Relics and SOC feed) while "intel" is also the fidelity mechanic and the Identify card effect [code battle.js:175, 191].
12. **Duplicate intent text at fidelity 0.** The headline and the subtitle both read "Initial Access" / "Lateral Movement" [shot now-1440-07, now-390-05; code battle.js:189-190: title is `tname(tactic)` when level < 1 and the subtitle always starts with `tname(tactic)`].

What a first-time player cannot parse (my reading, [untested]): what ends the fight; whether a high or low Exposure is good; which of the six ward chips matters this turn; why the board has lines; what the "5 cards" chip is; what the 3 fidelity squares mean without hovering; why they cannot spend their $ (Budget) here.

Information that should be hidden until needed (progressive disclosure): adversary role/motive/ID/hand count and trait text (one tap on the adversary chip or the Dossier); Programme and Relics (a chip row, one tap); Budget; clock text outside TTX; `Counters:` mitigation lines and the type line on hand cards (kept in the preview and inspector); the six STRIDE letters on tiles until a card is selected or an intent is known.

Redundant or low-value: Budget row and relic chip in battle; "Intent (fidelity 0)" caption; adversary ID chip; "5 cards" chip; card footer "CORE" and gem; the second copy of function and STRIDE on card faces; clearance bar during a run; Abandon and Settings in the HUD.

### 1.2 Battle screen

**Proposed hierarchy (three tiers).**

- **Tier 1, always visible, decision-critical:** hand, energy, End turn; the telegraphed move and the asset it targets; asset HP and the ward value for the class that matters; revealed footholds; the four meters (Round, Resilience, Goal, Exposure).
- **Tier 2, one tap or hover:** adversary traits and role, dossier, Policies, Relics, SOC feed.
- **Tier 3, not in battle:** Budget, settings, abandon, relic count, clearance.

**Structural change S1: one scoreboard strip.** Replace the three HUD panels with one row of four labelled meters plus a compact adversary chip and a "Next move" card:

```
[Round 3/9 pips] [Resilience 48/60] [Goal: Encrypt & extort 6/14 (they win at 14)] [Exposure 2/7 (you win at 7)]
[sigil + name + tier + Dossier]      [Next move: T1190 Exploit Public-Facing App -> Staff Endpoints  (intel 2/3)]
```

A single tooltip or tap on the strip states the rule: "You win: Exposure fills or you survive to round 9 with every jewel standing. You lose: Goal fills, Resilience reaches 0, or a jewel falls." That sentence is the one thing the tutorial never says in one place.

**Structural change S2: collapse the right column.** Programme and Relics become two chips beside the deck pile ("Policies 0/2", "Relics 1"), each opening a popover. The right column keeps only the SOC feed, at a larger size, because it carries the "why" lessons (`logLine`/`whySummary`, eventlog.js). On narrow widths it stays a drawer. Net: the board gains about 250px of width at 1440 and the learning channel gets the space the empty panels held.

**Structural change S3: make the telegraphed move readable on the tile.** When intent level >= 2 the tile already gets an `intent` class (battle.js:201). At level 3 also render a chip on that tile: "S: ward 1 vs power 3" and dim the other five ward boxes. The decision (do I need more S ward on this asset?) is then visible without arithmetic. Keep `.asset`, `.asset.targetable`, `.fh.targetable`, `.hand .card` and `[data-card]` selectors: `scripts/e2e.mjs` clicks them.

### 1.3 Phone (390x844) battle

[shot] now-390-05-battle.png, now-390-06-adv-turn.png, now-390-07-battle-after.png. [code] matrix.css:173-182, battle.css:57.

1. **Resilience has no visible bar or number.** At <=760px `.hud-me:not(:last-child)` becomes a wrapping row; the meter is `flex:1` inside a content-sized `.hud-row`, so it collapses to zero width. The shot shows the label "RESILIENCE |" and nothing else. A lose condition is unreadable for the whole battle.
2. **The Intel drawer button is hidden.** matrix.css:179 hides `.hud-row:nth-child(2)` of that panel, which is the row holding `.side-toggle`. Programme, Relics and the SOC feed are unreachable on a phone. `docs/GUIDE.md` ("On narrow screens ... live behind the Intel button") is false at this width.
3. **Cards are unreadable and uninspectable.** `.card-text` is 7.5px (battle.css:57); about 3.5 cards are visible; the enlarged preview is disabled under `(hover: none)` (battle.css:66) and inspection is right-click only (battle.js:215). Long-press may fire `contextmenu` on Android; unverified on iOS [untested].
4. **The board is scaled to fit** and tile text is about 6px; HP and ward values are unreadable [shot].
5. **Energy is the smallest control** (46px orb, bottom left, crowded by the "Discard" label), though it is the number the player consults every card.
6. **Intent and Goal are present but tight;** the adversary's role, trait text and hand are hidden by CSS (`.hud-adv .sub, .traits { display:none }`), so trait effects ("Draws one extra card per turn") are only learnt in the briefing.
7. **Briefing's Begin button is about 1200px down the page; the reward screen puts a 600px debrief above the card choice** [shot now-390-04, now-390-09].
8. **Tutorial on phone: not reviewed visually.** [code] action steps park the coach at `right:14px; top:210px; width:290px` (docs.js), which on a 390px screen would cover most of the board. Re-shoot required.

### 1.4 Briefing

[shot] now-1440-04-briefing.png, now-390-04-briefing.png; [code] screens-run.js:42-65.

What is there: sigil, tier badge, MITRE link, Dossier button, kicker, name, aliases, blurb, trait paragraph(s), goal box, an explanatory paragraph about commodity techniques, 15 tactic chips, up to 10 mitigation chips with check/cross and a "x18" frequency, up to 10 observables, Begin.

Problems:
- **The mitigation checklist is the lesson, and it is un-actionable.** "Does your deck cover them?" appears after the last point where the deck can change (shops and rewards are behind the player). A red cross is a fact with no verb. Also "x18" (how many of its techniques the mitigation counters) is unexplained.
- **15 tactic chips** (kill-chain coverage) answer "which tactics does it use", which no decision depends on. They sit between the goal and the mitigations, pushing the actionable list down.
- **Observables** are valuable for practitioners but not for the next 90 seconds.
- Hierarchy: the goal (what it wants) is not first; the name, aliases and blurb are.

Proposed order (S4a, markup only): (1) name, tier, one-line goal ("Wants: encrypt systems and destroy recovery. It wins at 14."); (2) "Your coverage: 5 of 10 of its top mitigations" with the missing three named and the card names in the player's deck that supply the covered ones; (3) Begin battle (sticky on phone); (4) `<details>` "More intel": traits, kill chain, observables, baseline explanation. Remove "x18" or explain it ("counters 18 of its techniques").

### 1.5 Map

[shot] now-1440-03-map.png, now-390-03-map.png; [code] screens-run.js:33-40, screens.css:26-36, matrix.css:194-196.

- **Node sizes are inconsistent.** Procurement is stretched to 130-340px, Events and Workshops are irregular. This is the class-collision bug review 1 fixed for `.node.battle`, now present for `.node.shop` (`.shop { width:100%; max-width:1200px }`, screens.css:46) and `.node.event` (`.event { margin:2rem auto; padding:1.6rem }`, screens.css:50). It reads as randomness or a bug. Quick fix below.
- **A route is not a decision.** Nodes show only their type. There are no paths, no adversary name, no reward preview, so choosing between "Skirmish" and "Intrusion Set" is a guess about unlabelled risk. `genMap` offers two options at most steps. Slay the Spire's route choice works because the player sees what each branch costs and pays.
- The boss for each act is **fixed per pack** (`chooseAdversary`: `id = act.boss`, run.js:116), so it can be shown on the map today with no engine change.
- On phone, Acts II and III are cut off at the right with no cue that the map scrolls.
- The relic icon floats alone at the top right of the map [shot].

### 1.6 Tutorial

[shot] 30-tut-welcome to 38-tut-done (1440 only); [code] docs.js `STEPS`, `engine/tutorial.js`.

What works: it is scripted so each message is true; coach cards are short; the action steps are real actions; evicting at the end feels good (stamp, glyph burst, "QUICK RESPONSE").

What fails:
1. **Concept order.** Four read-only steps (welcome, adversary, intent, assets) precede the first action. Step 4 alone introduces integrity, crown jewels, wards, all six STRIDE names and "a technique must beat the ward for its category" [shot 32-tut-assets]. This violates one concept at a time; the six-letter list is a memorisation lecture before the player has seen a ward do anything.
2. **It omits what ends a battle.** The tutorial HUD shows no Goal bar (31-tut-adv.png: right panel is intent only, whereas the same adversary in a real battle shows "Goal: Encrypt & extort 0/17" in now-390-05). Resilience is never mentioned; the round clock is never explained; energy is only implied ("2 energy left"). `docs/GUIDE.md` says the tutorial teaches "what ends a battle": only Exposure and crown jewels are covered.
3. **A false statement.** Step 5 says "The intent says Initial Access is aimed at the Email Gateway", but step 3 has just said that at fidelity 0 only the tactic is shown, and 33-tut-mfa.png shows exactly that: no target. The player is told to trust the coach, not the UI.
4. **No run layer.** The map, reward, shop, rest, deck building and card types (control, action, policy, augment) are never introduced. The first real run therefore meets a 6-scenario by 5-doctrine by 4-assurance Setup screen cold [shot now-1440-02-setup], defaulting to ML1 and Architect. Lab: a first-hour proxy (`novice`) with Architect clears 0 of 20 full runs [0-16%] and Architect pooled over standard and sharp clears 9 of 40 (23% [12-38]).
5. **Effects stack on the lesson.** Achievement toasts overlap the HUD during the intent step (34-tut-intel) and the final step (38-tut-done) alongside a "QUICK RESPONSE" banner and the coach. The big hover preview covers the foothold the player must click in the evict step (37-tut-evict).
6. **The coach covers the log it is about to point at.** For action steps it sits over the top of the SOC feed (33, 34, 37).
7. **Tutorial is not promoted.** `settings.tutorialSeen` is written (app.js:169) but never read; on first launch "New run" is primary and "Tutorial" is a ghost button the same weight as "Guide" [shot now-1440-01-title].
8. **Tutorial differs from a real fight** (energy 4, 30 Resilience, no relics, no goal), so the first real battle introduces new numbers.

Note for the orchestrator: an implementer is editing `web/js/docs.js` and `scripts/scene-tutorial.mjs` in parallel. Reconcile the proposals below with that diff before starting UI-5.

### 1.7 Other screens (skim)

- **Setup:** 6 scenarios, 5 doctrines (4 locked, greyed), 4 assurance levels (3 locked) and a seed box in one scroll; the sticky Begin bar overlays the doctrine row [shot now-1440-02]. Defaults to ML1.
- **Reward:** the debrief is the best teaching content in the game but sits above the card choice; on phone the choice is about 800px down [shot now-390-09]. The three offered cards in now-1440-08 are all augments for controls the deck may not hold; the offer is not tied to what just attacked.
- **Lost run:** `ResultScreen` shows a generic tip ("open the dossier before the fight") whatever the cause, and STRIDE "0/0" tiles on a run with no workshop [shot now-1440-16, code screens-run.js:152]. The player's most teachable moment carries the least information.
- **Achievements:** 137 achievements with some pure counters ("Block 600 adversary plays", "Attach 40 augments"). They award XP only; doctrine unlocks come from small first-time counts (1 eviction, 5 isolations, 10 policies, 30 integrity). I do not flag this as artificial grind because no core content is gated behind the large counters.

### 1.8 Change list, ranked by impact over effort

#### Quick wins (CSS, copy or visibility only; implementer; no engine, no determinism risk)

| ID | Change | Files and exact target | Evidence |
|---|---|---|---|
| QW1 | Phone: restore the Resilience bar and the drawer button. Make the first `.hud-row` of the first `.hud-me` `flex: 1 1 100%` so the meter has width; stop hiding the row that holds `.side-toggle` (hide only `.money` and the relic chip). Rename the button (QW9). | `web/css/matrix.css` lines 179-181 | [shot] now-390-05 |
| QW2 | Intent at fidelity 0: headline "Next move hidden", subtitle "Tactic: Initial Access. Identify cards and relics reveal the technique, then the target." Drop the duplicate. | `web/js/battle.js` 189-190 | [shot] now-1440-07 |
| QW3 | Label end states: Exposure "EXPOSURE 2 / 7 (you win at 7)", Goal "(they win at 14)", Resilience tooltip "you lose at 0". | `web/js/battle.js` 174, 182, 257 | [code] |
| QW4 | Stop the hover preview covering the board: dock it to the right edge above End turn. | `web/css/battle.css` 64-65: `.card-preview { left:auto; right:12px; transform:none }` | [shot] now-1440-05, 37-tut-evict |
| QW5 | Remove Budget row and relic chip from the battle HUD (keep $ on map, shop, rest). Show "Round 3 / 9" instead of "Day 1 12:00" except in TTX (`b.ttx`). Hide the clearance bar during a run. | `web/js/battle.js` 175-176; `web/css/matrix.css` (`body[data-view="battle"] .topbar .clr { display:none }`) | [shot] |
| QW6 | Hand cards: hide `.k-mit`, `.k-note`, `.card-foot` and `.card-type` inside `.hand .card` (they stay in the preview and inspector). Effect lines get the room that the clipped "Counters:" line wasted. | `web/css/cards.css` (new rules scoped to `.hand .card`) | [shot] now-1440-05 |
| QW7 | Map: fix the class collision (`.node.shop, .node.event { width:96px; max-width:none; margin:0; padding:.45rem .3rem }`, boss stays 130px); add a one-line sublabel per node type (Skirmish "fight, card reward"; Intrusion Set "harder fight, relic chance"; Procurement "spend budget"; Rest "heal or upgrade"; Workshop "STRIDE quiz, earns budget and a ward"). | `web/css/screens.css`/`matrix.css`; `web/js/screens-run.js` 38; copy in `engine/run.js` `TYPES` is shared, so add the sublabels in `screens-run.js` | [shot] now-1440-03 |
| QW8 | Reward and briefing order on phone: make the card choice come first (`.reward { display:flex; flex-direction:column } .reward .debrief { order: 5 }` at <=760px); make Begin battle sticky on phone. | `web/css/matrix.css` (<=760px block) | [shot] now-390-04, 09 |
| QW9 | Terminology: drawer button "Intel" becomes "Feed"; "Programme" becomes "Policies" (cards are typed Policy); tooltip "Gold" becomes "Budget"; "1 relics" removed. | `web/js/battle.js` 175, 206; `docs/GUIDE.md` Tips paragraph | [code] |
| QW10 | First launch: when `settings.tutorialSeen` is false, make Tutorial the primary button and demote New run; Setup defaults to Training (ML0) until the profile has a win (see B4); seed box behind an "Advanced" disclosure. | `web/js/screens-menu.js` 39-50 and `Setup` 60 | [code] |
| QW11 | Move Abandon and the gear out of the HUD into Settings (the hamburger already opens Settings during a run). | `web/js/battle.js` 192; `web/js/screens-menu.js` `Settings` | [code] |

Expected effect, all [untested]: a first-time phone player can read Resilience and open the log without help (currently impossible by construction); the HUD loses about 8 of its 20 readouts.

#### Structural (small to medium JS/layout; implementer; senior-engineer only if it touches the action log, which none of these do)

| ID | Change | Effort |
|---|---|---|
| S1 | One scoreboard strip with four labelled meters (section 1.2). | M |
| S2 | Collapse Programme and Relics into chips; give the SOC feed the column (section 1.2). | M |
| S3 | Ward-vs-power chip on the targeted tile; dim the other ward classes (section 1.2). | S |
| S4 | Briefing re-order with a "Your coverage" summary and `<details>` (section 1.4); act boss and its top three mitigations on the map (UI-4). | M |
| S5 | Touch: on selection, show the enlarged card preview as a bottom sheet when `(hover: none)` (battle.js `preview` state currently only set on mouse enter, battle.js:215). | S |
| S6 | Skip and weight: click or Space skips the adversary-turn overlay; a "Fast" option plays it at 40%; routine events (deploy, block) get one small ripple and a sound, significant events (reveal, evict, asset down, jewel hit) keep the full treatment (`present`, battle.js:65-90). | S |
| S7 | Operability: add `role="button"`, `tabindex="0"` and Enter/Space handlers to `.asset.targetable`, `.fh.targetable`, `.node.avail`, reward and shop cards; add `aria-live="polite"` announcements for adversary plays (blocked, landed, no alert) next to the existing toast region. Axe passes (`scripts/a11y.mjs`) are not evidence of keyboard operability [untested]. | S to M |

### UI proposals (one per problem)

#### UI-1 Phone battle (rank 1)

- **Problem:** see 1.3. HP invisible, drawer hidden, 7.5px text, no inspect.
- **Change:** QW1, QW8, S5, plus raise `--card-w`/`--card-h` for phone (battle.css:57) once S5 makes the preview the reading surface; put the energy count in the End turn label ("End turn - 2 energy").
- **Why it works:** removes three blockers with CSS and one small JS state change.
- **Educational effect:** none negative; the SOC feed (the "why" channel) becomes reachable on phone.
- **Hypothesis and measure:** after the change, 5 of 5 first-time phone players name their Resilience and open the feed unaided within 30 seconds (baseline by construction: 0 of 5). Method: think-aloud on a real phone, or at minimum fresh 390x844 captures via `scripts/scene-design.mjs`. Confirm: 5/5. Refute: 2 or more cannot, which means the label or placement is the issue, not width.
- **Implementation:** `implementer`; files above; keep selectors used by `scripts/e2e.mjs` (`.hand .card`, `.asset.targetable`, `.hand .card.selected`).
- **Risk:** the e2e bot clicks `.hand .card` at 390; re-run `npm run e2e` after (delegate to Haiku; needs `npm run dev`).
- **Guardrail check:** pass.

#### UI-2 Battle hierarchy (rank 2)

- **Change:** QW2, QW3, QW5, QW11, S1, S2, S3 as one batch.
- **Why it works:** the player's first question is "how does this end and what is it about to do?". Putting the four end-state meters in one row and the next move beside the board answers both without reading three panels.
- **Educational effect:** states the win and lose conditions in one sentence, which the tutorial and Guide never do. Risk of a wrong lesson: none.
- **Hypothesis and measure:** after S1, 4 of 5 new players can state the three ways a fight ends without help after one battle (baseline unknown, [untested]). Proxy that the lab cannot give: do not use win rate.
- **Implementation:** `implementer`; `web/js/battle.js` (HUD block 172-194 and side block 205-209), `web/css/battle.css`, `web/css/matrix.css` (HUD media blocks at 167-182). Do not rename `.hud-adv`, `.intent`, `.btn.good.big`: tutorial anchors in `docs.js` use them.
- **Risk:** tutorial spotlight anchors; phone media blocks interact with S1, so do UI-1 first.
- **Guardrail check:** pass.

#### UI-3 Briefing (rank 4)

- **Change:** section 1.4 order; QW8.
- **Why it works:** puts one actionable number first and demotes reference material. The briefing is still the place where practitioners get the dossier; it just stops being the wall of chips.
- **Educational effect:** keeps the ATT&CK mitigation lesson but names the verb: "you hold 5 of 10". Wrong-lesson risk: see B1; if Protect is not rewarded, a coverage score that does not move win rate teaches a ritual.
- **Hypothesis and measure:** time on the briefing screen falls (instrument with `emitUi`); coverage-aware card picks rise (B3).
- **Implementation:** `implementer`; `web/js/screens-run.js` 42-65, `web/css/screens.css` `.brief`.
- **Risk:** low. **Guardrail check:** pass.

#### UI-4 Map (rank 4)

- **Change:** QW7 plus S4b: under each act heading show "Boss: <name>" and its top three mitigations with your deck's coverage (`content.roster.acts[ai].boss`, `content.adversaries[id]`, same `mitFreq` logic as the briefing). No engine change: the boss is fixed per pack.
- **Why it works:** gives the shop and reward decisions a target. This is the cheapest half of Review 2's "forecast" recommendation (the other half, showing the next ordinary adversary, needs an RNG peek and is B3).
- **Hypothesis and measure:** [lab] none (bots ignore it). [untested] human: players can say which boss they are preparing for.
- **Implementation:** `implementer`; `web/js/screens-run.js` 33-40; extract `mitFreq`/`deckMit` from `Briefing` into a shared helper in the same file.
- **Risk:** low. **Guardrail check:** pass.

#### UI-5 Tutorial (rank 3)

- **Change (copy and order, then one data change):**
  1. Reorder: welcome, then the first action (play Phishing-Resistant MFA on Email Gateway), then the explanation. Move the adversary and intent steps after the first adversary turn, when the player has seen a move land or be blocked.
  2. Replace the STRIDE list in step 4 with one letter in context: after the deploy, spotlight the Email Gateway S ward going 0 to 3 and say "Phishing is Spoofing (S). An S ward of 3 beats it. The other five letters are on the Guide." Defer the full set to just-in-time hints.
  3. Fix the false line: "Phishing arrives by email, so ward the Email Gateway."
  4. Add one "How this ends" step: spotlight Resilience, Goal and Exposure together with the S1 sentence. Requires the tutorial battle to show a goal bar: `engine/tutorial.js` `newBattle(...)` call; confirm why the goal is absent and give TASOS a small goal clock. The tutorial is not persisted or verified (`isTutorial`, app.js:79), so this does not touch stored runs.
  5. Spotlight the energy orb on the first card step.
  6. End on "Start a Training run": `finishTutorial` goes to Setup with Enterprise, Architect and Training preselected, and sets `settings.tutorialSeen`.
  7. Suppress achievement toasts and the combo banner while `s.tutorial` is set, or queue them until the next step.
  8. Phone: render the coach as a bottom sheet at <=760px.
  9. Just-in-time hints (new): a `settings.hintsSeen` map and one-sentence dismissible tips on first reward ("pick one, or skip to keep the deck lean"), first shop, first rest, first augment and first policy.
- **Why it works:** one concept per step, action before theory, and the missing lose conditions.
- **Educational effect:** teaches STRIDE by one worked example rather than a list; teaches the goal clock, the central security idea (dwell time is the damage).
- **Hypothesis and measure:** [untested] time to first successful deploy at most 90 seconds; 4 of 5 testers state how a fight ends. `npm run e2e` tutorial path must still pass (`scripts/e2e.mjs` lines 56-58 click specific `data-card` ids).
- **Implementation:** `implementer` for docs.js (after the parallel edit lands), `scripts/scene-tutorial.mjs` for the 390 re-shoot (it produced desktop-sized images). Step 4 of the list: `senior-engineer` is not needed unless `engine/tutorial.js` scripted draws change; if they do, re-check `drawOrder` and `advOrder` comments in that file.
- **Risk:** the scripted draw order; "every message is true" must be re-verified after reordering.
- **Guardrail check:** pass.

#### UI-6 Hand and board legibility (rank 6)

- **Change:** QW4, QW6, S3.
- **Hypothesis and measure:** [untested] fewer right-click inspections per battle (instrument `setInspect`). No lab metric.
- **Implementation:** `implementer`; `web/css/cards.css`, `web/css/battle.css`. **Risk:** low. **Guardrail check:** pass.

#### UI-7 Pacing, feedback weight and the loss moment (rank 10)

- **Change:** S6; and a real loss debrief in `ResultScreen`: show the cause (`run.battle.result.how`: goal, resilience or jewel; `run.battle` is still set when the run is lost, `engine/run.js:205-215`, but confirm before relying on it), the adversary and its goal, the three techniques it used that your deck had no mitigation for (reuse `deckMit`/`mitFreq` from the briefing), and name one card or doctrine that supplies each. Replace the generic tip at screens-run.js:152.
- **Why it works:** the loss is the highest-attention learning moment; today it carries the least information. Feedback matches weight: a breach gets a specific cause.
- **Educational effect:** "you lost to dwell time on identity because no detection covered T1078" is the lesson. Wrong-lesson risk: a bot-optimal "skip Protect" (B1) would be reflected here; sort B1 first.
- **Hypothesis and measure:** [untested] after a loss, players start another run at a higher rate, or open the dossier; instrument `emitUi`. No lab metric.
- **Implementation:** `implementer`; `web/js/screens-run.js` `ResultScreen`; `web/js/battle.js` `present`/stage code. **Risk:** low. **Guardrail check:** pass (no loss-streak mechanics; this is information, not punishment).

#### UI-8 Keyboard, touch, screen reader (rank 8)

- **Change:** S5 and S7.
- **Why it works:** hand play already has hotkeys; the rest of the run needs a pointer.
- **Hypothesis and measure:** a keyboard-only run through one scenario completes; verify with Playwright keyboard-only script plus a manual screen-reader pass (VoiceOver or NVDA) [untested]. State plainly: any accessibility claim on keyboard, touch or screen reader is untested today.
- **Implementation:** `implementer`; `web/js/components.js` 29 and 64, `web/js/screens-run.js` 38, `web/js/ui.js` (`tip` is mouse-and-focus; focusable targets will then also show tooltips on focus).
- **Risk:** e2e selectors unchanged. **Guardrail check:** pass.

---

## Part 2: Decisions

### D1 Daily streak: replace with a count-up, never a loss state

**Finding (confirmed against today's code).** `web/js/app.js:139` still sets `streak` to 1 when the last completed date is not yesterday: `prev.last && daysBetween(prev.last, date) === 1 ? prev.streak + 1 : prev.last === date ? prev.streak : 1`. The title shows "N day streak" when `streak > 1` (`screens-menu.js:39,48`), the Daily screen says "Keep your streak alive" (`screens-menu.js:89`), and `ach.daily-7` "Seven-Day Streak" rewards an unbroken chain (`scripts/gen-achievements.mjs:94`). That is streak punishment and loss-framed copy. **The server and leaderboard do not use the streak:** in `api/` the only reference is `cleanProfile` (`api/app.mjs:143`), which clamps `streak`, `best`, `last` and always writes `done: {}`; boards are keyed by date and sorted by points. Submissions are accepted for today and yesterday only (`api/app.mjs:97-99`), which is a grace window, not a punishment; board entries expire after 90 days, which does not touch rewards. So removing the streak is a client-only change plus one achievement.

**Decision.** Show a count that can only rise: **dailies completed** (distinct Sydney dates in `profile.daily.done`) and **best daily score** (`daily.best`). I rejected "best streak" (a record you can see you are below is still a loss state) and a weekly counter (it resets every week, a soft streak). Replay stays allowed and the board keeps the best score.

**Fields in `profile.daily` (shape in `engine/achievements.js` `emptyProfile`).**

| Field | Before | After |
|---|---|---|
| `streak` | written every completion, shown, gates `ach.daily-7` | **deprecated**: no longer written, read or shown. Left in `emptyProfile` and tolerated by `api/app.mjs` `cleanProfile` so old and new clients interoperate |
| `best` | best daily points | unchanged |
| `last` | last completed Sydney date | unchanged (informational) |
| `done` | map date to points (last play wins) | map date to **best** points for that date; the source of "dailies completed" |
| `days` (not stored) | n/a | derived: `Object.keys(done).length` |

**Exact changes.**

1. `engine/achievements.js`: add and export a pure helper next to `emptyProfile`:
   ```js
   export function recordDaily(profile, date, points) {
     const prev = profile.daily || {};
     const done = { ...(prev.done || {}) }; done[date] = Math.max(done[date] || 0, points);
     return { profile: { ...profile, daily: { ...prev, best: Math.max(prev.best || 0, points), last: date, done } }, days: Object.keys(done).length };
   }
   export const dailiesCompleted = (profile) => Object.keys(profile.daily?.done || {}).length;
   ```
2. `web/js/app.js` 137-143: replace the streak lines with
   `const { profile, days } = recordDaily(S().profile, date, res.points); saveProfile(profile); emitUi({ t: 'daily_done', days, points: res.points });` and add `recordDaily` to the existing import from `../../engine/achievements.js` at the top of the file.
3. `web/js/app.js:59` (`mergeProfiles`): the line `if ((b.daily?.best || 0) > (out.daily.best || 0)) out.daily = { ...out.daily, ...b.daily };` overwrites the local `done` with the server's empty `{}` whenever the remote best is higher, which would erase the history that "dailies completed" depends on. Replace with `... out.daily = { ...out.daily, best: b.daily.best };` (adopt the best score only; never overwrite `done` or `last`).
4. `web/js/screens-menu.js`: line 39 replace `streak` with `const doneToday = s.profile.daily?.done?.[sydneyDate()] != null;` (import `sydneyDate` from `../../engine/rng.js`); line 48 chip becomes `${doneToday ? html` <span class="chip good" style="margin-left:.4em">Done today</span>` : ''}`; line 89 copy becomes: "Everyone plays the same seed. Your run is replayed on the server to verify the score. Dailies completed: ${dailiesCompleted(s.profile)}. Best daily score: ${s.profile.daily.best || 0}." Remove "Keep your streak alive".
5. `scripts/gen-achievements.mjs:94`: `a('daily-7', 'Runs', 'gold', 'flame', 'Seven Dailies', 'Complete the daily challenge on 7 different days.', L('daily_done', { days: { gte: 7 } }));` then `node scripts/gen-achievements.mjs && npm run validate`. The id `ach.daily-7` is unchanged, so existing unlocks persist. The content fingerprint does not include achievements (`engine/content.js:52`), so saved runs and replays are unaffected [code]. Players who have completed 7 or more dailies without a 7-day chain unlock it on their next completion, which is the intended reward for play.
6. Optional second step (touches `api/app.mjs`, a validation and write path, so **`senior-engineer` review**): let `cleanProfile` keep `daily.done` (date-shaped keys only, at most 400, values clamped to 1e9) so the count survives a device change. Without it the count is per device; because it only counts up, that understates and never punishes.
7. `docs/GUIDE.md` "Progress" and `docs/DESIGN.md` "Meta-progression": add "The daily challenge shows a running count of dailies completed; it never resets."

**Migration.** None for stored data: `days` is derived from `done`, which existing profiles already hold in full. A player with a 5-day streak sees "Dailies completed: N" with N their full history. Old `streak` values are ignored.

**Test to add** (`test/engine.test.mjs`): (a) `recordDaily` on dates 1 and 6 (a 5-day gap) returns `days === 2` and the date-1 entry is intact; (b) the same date twice keeps one entry and the higher points; (c) a legacy profile `{ streak: 5, done: {six dates} }` plus a new date yields `days === 7` and leaves `streak` untouched; (d) `evaluate(content, profile, ctx, [{ t: 'daily_done', days: 7 }])` unlocks `ach.daily-7`, and with `days: 6` it does not. Add an `api.test.mjs` case only if step 6 is done (cleanProfile keeps valid `done`, drops malformed keys).

**Guardrail check:** pass. Count-up only, no loss state, no urgency copy, replay allowed, no expiring reward.

### D2 Balance targets: a stale document, not a balance bug (with three real balance problems underneath)

**Which numbers I checked against.** `docs/PLAYTEST_LAB.md` has two incompatible lists: "What it measures" (random about 0%, novice single digits, standard 15-20%, sharp about 30%, expert 50%+) and "Balance pass (current baseline)" (novice about 17-18%, standard about 38-41%, sharp about 37-39%). `docs/DESIGN.md` "Balance model" says about 15-20% full-run clears, and the comment on `TARGET` in `lab/tune.mjs` repeats it. **My measurement matches the Balance pass section, so the first list and DESIGN.md are stale.**

**Measured today** (enterprise, full runs, n=100 per skill, Wilson 95%):

| Assurance | random | novice | standard | sharp |
|---|---|---|---|---|
| ML0 Training | not run | 76% [67-83] | 85% [77-91] | 91% [84-95] |
| ML1 (default) | 0% [0-4] | 18% [12-27] | 39% [30-49] | 36% [27-46] |
| ML2 | not run | 22% [15-31] | 31% [23-41] | 34% [25-44] |
| ML3 | not run | 3% [1-8] | 3% [1-8] | 6% [3-12] |

`lite` at ML1 (n=50 per skill, 10 per doctrine): standard 42% [29-56], sharp 42% [29-56], lite 42% [29-56]. (Identical counts across three agents are suspicious: confirm that `lite` is not falling back to the heuristic before treating this as a skill finding; `senior-engineer` should read `lab/agents/planner.mjs`.)

Per-node standard pass rates inside those runs (full runs, n shown): Act 1 normal 99% [95-100] n=139, elite 99% [93-100] n=78, boss 98% [93-99] n=97; Act 2 89% [83-93] n=151, 87% [73-94] n=39, 86% [77-92] n=74; Act 3 88% [81-93] n=109, 78% [55-91] n=18, 83% [70-91] n=47. These sit inside `DESIGN.md`'s per-node ranges (normal 90-96%, elite 80-90%, boss 70-88%), above them for Act 1 bosses and Act 3 bosses. So the per-node targets are met; what is stale is the arithmetic that says they compound to 15-20%. They do not, because players skip elites and rest (by my back-of-envelope the forced path gives roughly 25-30%, the measured 39% reflects routing) [lab plus arithmetic, not separately verified].

**Decision: targets for an educational game whose players are practitioners and students.** The default level (ML1, labelled "the intended experience" in `tuning.assurance[1].note`) should let an attentive reader win about two runs in five, so the 3-act arc, the Act 3 adversaries and the debriefs are seen by most players within a few runs. The "classic roguelike" 15-20% belongs at the top assurance level, which is exactly what the assurance ladder is for. Proposed full-run targets (standard unless stated):

| Assurance | random | novice | standard | sharp |
|---|---|---|---|---|
| ML0 Training | at most 5% | 60-80% | 80-90% | 88-95% |
| ML1 (default) | at most 2% | 10-20% | 35-45% | at least standard + 5pp |
| ML2 | 0% | 5-15% | 25-35% | at least standard + 5pp |
| ML3 | 0% | at most 10% | 12-20% | at least standard + 5pp |
| expert (ML1, hidden info) | | | | 60%+ |

**What is a real balance problem despite the stale doc** (all [lab]):

1. **ML3 is a cliff, not a rung.** ML1 to ML2 costs 8pp (39 to 31, intervals overlap); ML2 to ML3 costs 28pp (31 to 3), and at ML3 novice = standard = 3%: skill does not matter at all. The cause is `advPower: 1` in `scripts/gen-meta.mjs:163`. ML3 arms (n=100 per skill, same seeds, `skillLadder` with `overrides.tuning.assurance`), novice / standard / sharp:

   | Arm | novice | standard | sharp |
   |---|---|---|---|
   | A. today (power +1, resilience -4, foothold 1) | 3% | 3% [1-8] | 6% |
   | C. power 0, resilience -4 | 17% | 24% [17-33] | 31% [23-41] |
   | F. power +1, resilience +10 | 12% | 20% [13-29] | 17% |
   | K. **power 0, resilience -10** | 10% [6-17] | **17% [11-26]** | **21% [14-30]** |
   | M. power 0, resilience -8 | 13% | 21% [14-30] | 27% [19-36] |
   | L. power 0, resilience -4, adversary energy +1 | 11% | 15% | 15% |

   Removing the +1 power restores a monotone ladder; adding resilience to keep +1 power does not (F: sharp below standard). The power bump is what flattens skill.
2. **Standard to sharp has no demonstrated gap anywhere:** +6pp, -3pp, +3pp at ML0, ML1, ML2, all intervals overlapping, lite = standard (above). Novice to standard is large (+9, +21, +9pp). `sharp` differs from `standard` only by less noise, so the ceiling is the game, not the bot. See B2.
3. **Doctrine spread is wide and the only unlocked doctrine is the weakest.** Pooled standard and sharp, n=40 per doctrine: Architect 23% [12-38], Phoenix 35% [22-50], Hunter 40% [26-55], Governor 28% [16-43], Responder 63% [47-76]. Architect and Responder intervals do not overlap. The PLAYTEST_LAB claim of "22-47%" for standard is consistent with my standard-only counts (30%, 40%, 35%, 35%, 55%, n=20 each), but Responder with `sharp` is 14/20. Architect with the `novice` agent is 0/20 [0-16]. Review 2's problem 1 (Contain) is therefore **not** closed.

**Doc text changes (for `doc-writer`; exact).**

1. `docs/PLAYTEST_LAB.md`, "What it measures", first bullet. Replace with:
   > **Skill ladder**: win rate of full runs per skill with 95% Wilson intervals, per assurance level (`--assurance 0..3`). Targets for the default level (ML1, "the intended experience"): random at most 2%, novice 10-20%, standard 35-45%, sharp at least 5pp above standard, expert 60% or more. Training (ML0): novice 60-80%, standard 80-90%. ML2: standard 25-35%. ML3: standard 12-20% with sharp above standard. Players are practitioners and students, so the default should let an attentive player win about two runs in five; the 15-20% curve belongs to ML3.
2. Same file, "Balance pass (current baseline)": replace the line beginning "Full-run clear rate" with:
   > Full-run clear rate (enterprise, fresh seeds, n=100 per skill, 95% Wilson interval, measured 2026-10-13). ML1: random 0% [0-4], novice 18% [12-27], standard 39% [30-49], sharp 36% [27-46]. ML0: novice 76%, standard 85%, sharp 91%. ML2: novice 22%, standard 31%, sharp 34%. ML3 (before the tuning change in DESIGN_REVIEW_3): novice 3%, standard 3%, sharp 6%.
3. Same file, "Skill expression": replace the paragraph with:
   > Standard to sharp is +6pp, -3pp and +3pp at ML0, ML1 and ML2 (n=100, intervals overlap), and `lite` equals `standard` at ML1 (n=50). Novice to standard is +9 to +21pp. Better play than the heuristic is not demonstrated. See docs/DESIGN_REVIEW_3.md for retain-1 and the ML3 power finding.
4. Same file, "Mechanics ablation": append: "At ML3 (paired, 170 battles per arm) banning Protect cards raised the standard bot's win rate by 10.6pp +/- 7.9; see DESIGN_REVIEW_3 B1."
5. `docs/DESIGN.md`, "Balance model", the **Targets** bullet. Replace with:
   > **Targets**: per node, a standard-skill player with a realistic deck should beat normal fights about 90-96% of the time, elites 80-90% and bosses 70-88% depending on the act. Full-run targets are set per assurance level (see PLAYTEST_LAB.md): at ML1, standard 35-45%; at ML3, standard 12-20%. Sharper play and the expert planner should do materially better. Random play clears about 0% of full runs, but it wins roughly half of single battles with a developed deck (53% at ML1, n=170), so the claim "random almost never clears a fight" no longer holds for single fights.
6. `lab/tune.mjs` line 18 comment (a code comment, `implementer`): replace "(full-run clear ≈ 15-20%)" with "(per-node aids under the lab's deckAt deck model; the acceptance test is the full-run ladder, see PLAYTEST_LAB.md)". **Do not change the numbers in `TARGET`**: measured per-node rates already sit at or above them.
7. `docs/GUIDE.md` Tips: delete the sentence about the Intel button or change it to "Feed" if QW1 and QW9 land.

**Tuning proposal (separate; rule-data change).**

- **Hypothesis:** setting ML3 to `advPower: 0, resilienceBonus: -10` (arm K) moves standard ML3 clears from 3% to 12-20% and makes the ladder monotone, with sharp at least 3pp above standard, and leaves ML0, ML1 and ML2 untouched (they do not use these fields).
- **Change:** `scripts/gen-meta.mjs:163` becomes `{ id: 3, name: 'Maturity Level 3', note: 'Targeted, resourced, patient.', advPower: 0, advEnergy: 0, resilienceBonus: -10, startFoothold: 1 }`, then regenerate (`node scripts/gen-meta.mjs`) and `npm run validate`.
- **Measure:** `node lab/cli.mjs ladder --n 40 --scenarios all --assurance 3 --skills novice,standard,sharp` (200 runs per skill per scenario, delegate to a Haiku agent). Confirm: standard 12-20% pooled and per scenario within 8-25%, sharp >= standard + 3pp, novice < standard. Refute: standard below 8% or above 25%, or sharp below standard. Fall back to arm M (resilience -8) if it is too hard. Replicate on `ot` and `banking` at n=20 first.
- **Risk:** `tuning` is in the content fingerprint (`engine/content.js:52`), so this **invalidates saved runs and seeded lab baselines and the server will reject old-fingerprint submissions**: escalate to `senior-engineer` for the release plan. Run `node lab/cli.mjs fuzz --n 200`. The Setup note for ML3 should keep its text; the power bump was the main difficulty so players will notice ML3 is fairer, not softer.
- **Guardrail check:** pass.

---

## Part 3: Broader recommendations (ranked)

### B1 Make Protect pay (educational fit, wrong-lesson risk)

- **Problem:** [lab] standard bot, enterprise, paired seeds, 170 battles per arm. ML1: standard 90.0%; banning Protect-function cards (`standard-no-ward`) +0.6pp +/- 6.0; Detect -5.9 +/- 6.1; Respond -9.4 +/- 5.2; Isolate -5.9 +/- 5.6; Heal, Policy, Augment, Intel, Consumable all within +/-3pp of zero. At ML3 (standard 71.2%): **no-ward +10.6pp +/- 7.9** (CI excludes zero), no-detect -8.8 +/- 7.6, no-evict -11.2 +/- 6.2. Reading: at ML1 prevention is neutral, at ML3 spending energy on wards loses. Caveats: one scenario, a bot whose ward heuristic may be wasteful (check `scorePlay` ward values in `lab/agents/heuristic.mjs` before changing content), and the ML1 baseline is near ceiling (90%), which hides effects. The scratch script is `mech-as.mjs` (not in repo).
- **Why it matters:** the briefing's central instruction is "does your deck cover its mitigations?", and the +1 ward on a matched mitigation (DESIGN.md "Real data drives the numbers") is the game's most distinctive mechanic. If the optimal player ignores it, optimal play teaches "detect and evict, prevention is optional", which contradicts defence in depth and the CSF.
- **Change:** do not tune yet. First extend `mechanics` with `--assurance <0-3>` and `--nodes boss,elite` (edit `lab/cli.mjs:43`), and add a **coverage experiment**: for each adversary, same deck, one arm that holds the cards covering its top three mitigations, one arm that swaps them for non-matching cards. Then decide between (a) strengthening the mitigation match from +1 to +2 per matched control (content knob in `scripts/gen-cards.mjs`/engine ward calc) and (b) raising `tuning.balance.wardAdd` from 1 to 2 (`scripts/balance.json`).
- **Hypothesis and measure:** coverage of the top three mitigations raises per-battle win by at least 8pp on Act 2 and 3 adversaries at ML1 (paired, `pairedDiff`), and `no-ward` becomes at most -5pp at ML1 and at least 0pp at ML3 without moving the standard clear rate more than 3pp. Refute: coverage lift below 3pp (the lesson is cosmetic and the ward model needs rework) or `no-ward` still positive at ML3.
- **Implementation:** `implementer` for the lab flags and experiment; `senior-engineer` interprets (CLAUDE.md "Interpretation, not execution"); any content or tuning change then goes through `tune`.
- **Risk:** rule and fingerprint change if (a) or (b) ships; replays and baselines invalidated; re-tune goals after.
- **Guardrail check:** pass.

### B2 Give the turn a decision: retain one card (Review 2, Experiment 2, still open)

- **Problem:** `lite` = `standard` = `sharp` (42%, n=50); sharp minus standard +6/-3/+3pp at ML0/1/2 [lab]. Whole hand is discarded every turn (hand 6, energy 3), so each turn is close to solved by a greedy heuristic. No `retain` exists in `engine/` or `tuning.battle` [code grep].
- **Change:** as specified in DESIGN_REVIEW_2 (Experiment 2): `tuning.battle.retain: 1`, a `RETAIN` action before `END_TURN` in `engine/battle.js`, `startRound` draws `handSize - kept`, heuristic retains the best unplayed card, `fuzz.mjs` invariant. New here: run it **at ML2 and ML3 as well**, because skill is more visible below ceiling (ML3 arm K shows a +4pp sharp gap where today's ML3 shows none).
- **Hypothesis and measure:** `node lab/cli.mjs ladder --n 40 --scenarios all --skills standard,sharp,lite --assurance {1,2}`; sharp - standard at least +5pp and lite - sharp at least +5pp at ML1, standard ML1 stays 35-45%. Refute: gap under 3pp, then check `expert` at n=5 per doctrine to see whether the design has depth the heuristic cannot use.
- **Implementation:** `senior-engineer` (action log and replay model in `engine/battle.js`); fingerprint, stored runs and the server verifier all change.
- **Risk:** invalidates every stored run and seeded baseline; flag to the orchestrator.
- **Guardrail check:** pass.

### B3 Forecast, so the map and shop are decisions (Review 2, Experiment 3, partly open)

- **Problem:** [code] `genMap` is a fixed spine; nodes show type only; the briefing's mitigation list arrives after the last chance to act. The act boss is already a single fixed id (`act.boss`).
- **Change:** zero-engine half is UI-4 (boss and coverage on the map). The engine half: show the adversary behind each battle and elite node. `chooseAdversary` draws from stream `'adv'` at CHOOSE (run.js:120); to preview without consuming the stream, pre-draw at map generation and store `node.adv` in `run.map` (this changes the RNG consumption order and the action log, so it needs `senior-engineer`). Optionally `bossPool: [a, b]` per act.
- **Hypothesis and measure:** [lab] a forecast-using run agent (`lab/agents/run.mjs` routes by the shown adversary's mitigations) beats the current agent by at least +3pp at ML1 over n=100; unique (elite, boss) sequences per 100 seeds at least 10x today's. Refute: under +1pp.
- **Risk:** engine and replay change. **Guardrail check:** pass.

### B4 Onboarding path and the first-run difficulty

- **Problem:** [lab] the only unlocked doctrine (Architect) is the weakest (23% [12-38], n=40 pooled standard and sharp; 0/20 for `novice`); the default level is ML1; the tutorial stops before the run layer. First-run failure is the most likely place to lose a learner, and the loss screen says almost nothing (UI-7).
- **Change:** QW10 (tutorial promoted, Training as the default until the first win, "Recommended" tag), UI-5 steps 6 and 9, and follow Review 2's failure branch for the doctrine gap: if the starter-deck swap is needed, give Architect two starting Detect/Respond cards (`doctrines.json` `architect.deck`) before touching powers (the lab doc says powers do not move win rates).
- **Hypothesis and measure:** [lab] Architect standard ML1 clear at least 30% and novice at least 5% at n=40 per doctrine (`node lab/cli.mjs ladder --n 40 --skills novice,standard`); Architect-to-Responder spread at most 25pp. [untested] human: 4 of 5 first-timers finish a Training run.
- **Implementation:** UI part `implementer`; deck change `content-author` (`scripts/gen-meta.mjs` doctrine data, regenerate, validate) with `senior-engineer` reading the lab output.
- **Risk:** fingerprint change for the deck edit. **Guardrail check:** pass.

### B5 Resilience attrition decides most losses, the goal clock rarely does

- **Problem:** [lab] standard, n=100 runs, 61 losses: 35 by resilience, 19 by jewel, 7 by goal; 31 in normal battles, 20 at bosses, 10 at elites; by act 5 / 31 / 25. Act 2 remains the wall (Review 2 problem 3). `genMap` still does not guarantee a rest or shop (`engine/run.js:44-57`). The adversary-goal system, the game's best idea (eight goals, each a security lesson), decides 11% of standard losses.
- **Change:** guarantee one rest or shop option in step 4 of every act (replace the random pair at `engine/run.js:53` with one fixed `rest` plus one random other); show resilience cost in the debrief (UI-7).
- **Hypothesis and measure:** the Act 2 share of standard losses falls from 51% (31 of 61) to under 40%, and the goal-caused share rises from 11% (7 of 61) to above 15% as attrition eases (same ladder, n=100 per skill, then n=40 per doctrine across all scenarios); standard ML1 clear stays 35-45%. Refute: clears jump above 50% (then offset with `startResilience` or the rest heal amount in `tuning`).
- **Implementation:** `senior-engineer` (map generation uses the seeded RNG stream `'map'`; the change reorders draws and invalidates stored maps).
- **Risk:** replays and baselines; re-tune afterwards. **Guardrail check:** pass.

### B6 Couple the debrief to the next decision

- **Problem:** [code] the reward screen shows what the adversary did and which mitigations counter it, then offers three cards with no link between the two; [shot] now-1440-08 offers three augments the deck may not be able to use.
- **Change:** on each reward card show a chip "Counters M1017 (used against you)" when its `mit`/`aug.mit` overlaps the debrief techniques' mitigations; bias the three offers toward at least one such card (`run.js` reward generation, `cardWeight`).
- **Hypothesis and measure:** [lab] the fraction of reward picks whose `mit` overlaps the last debrief rises from today's baseline (add counter to `lab/agents/run.mjs` `picks`); win rate within +/-3pp. [untested] humans take a covering card more often.
- **Implementation:** chip is `implementer`; weighting change is `senior-engineer` (RNG draw for offers).
- **Risk:** the lesson depends on B1: do not push players to buy mitigation cards if mitigation does not matter.
- **Guardrail check:** pass; this is earned feedback on a correct decision, not chance.

---

## Part 4: Status of earlier recommendations

| Source | Recommendation | Status (checked in code or lab) |
|---|---|---|
| Review 1 | Side panels as a drawer below 1150px | Done for 761-1150px (Intel button); **broken at <=760px** (matrix.css:179 hides the button) |
| Review 1 | Hover-enlarge for card text | Done (`.card-preview`), but it occludes the board and is off on touch |
| Review 1 | Node-and-path map | Open. The map is still three columns without paths; `.node.shop`/`.node.event` now collide with screen classes |
| Review 1 | Per-adversary portraits, audio sting | Not reviewed here |
| Review 2 | Experiment 1: cap Contain, power parity | Not done as specified (all doctrine powers cost 1). Resilience tweaks and the Runbooks floor were applied instead (PLAYTEST_LAB). Responder still best: 63% [47-76] vs Architect 23% [12-38] |
| Review 2 | Experiment 2: retain 1 | Open (no `retain` in `engine/` or tuning) |
| Review 2 | Experiment 3: bossPool, forecast, heat | Open (`chooseAdversary` boss fixed; `genMap` unchanged) |
| Review 2 | Interest and relic price cut | Open (`tuning.shop.relicCost` 120/160/220) |
| Review 2 | Guarantee a rest or shop per act | Open; Act 2 still holds 31 of 61 standard losses |
| Review 2 | Packs and data sources | Out of scope here |

## Suggested order of work

1. **Today, no engine risk (one `implementer` brief, one PR):** QW1, QW2, QW3, QW4, QW5, QW6, QW7, QW8, QW9, QW11. Then the D1 daily-streak change and its test, and the D2 doc edits (`doc-writer`). Re-shoot 390 and 1440 screenshots, and fix `scene-tutorial.mjs` so its phone run is 390 wide (after the parallel edit lands).
2. **UI-5 tutorial and QW10** once the parallel `docs.js` edit has merged; S5 and S7 (touch and keyboard) in the same PR as UI-1.
3. **S1, S2, S3 battle hierarchy** (after phone fixes, because they share the media blocks); S4 and UI-4 (briefing and map boss); S6 pacing; UI-7 loss debrief.
4. **Lab groundwork (Haiku, no rules change):** add `--assurance` and `--nodes` to `mechanics`; add the coverage experiment; check `lite`. Then `senior-engineer` interprets B1.
5. **Rule changes needing `senior-engineer` and a fingerprint bump, batched as one release:** ML3 tuning (D2), retain (B2), Architect starter deck (B4), forecast and rest guarantee (B3, B5). Run `fuzz --n 200`, `ladder --n 40 --scenarios all` for ML1 and ML3, `adversaries --n 40`. Batching means stored runs are invalidated once.
6. Human check: a five-person think-aloud (three students, two practitioners; two on phones) after steps 1-3; measures listed per proposal. Until then every UI claim above is expert review.

## Open questions for the user

1. **Default difficulty.** Are you content with ML1 standard at about 40% (my target), or do you want the 15-20% roguelike curve as the default? I have placed 12-20% at ML3 and 35-45% at ML1; the whole D2 table follows from this answer.
2. **First run.** Should Training (ML0) be the forced first run, or only the preselected default with a "Recommended" tag? I recommend the latter.
3. **Phone portrait as a first-class target.** Landscape phones have a bespoke layout (battle.css:71-92); portrait is clearly unfinished. If portrait is out of scope say so and I will drop S5 and the 390 work.
4. **Doctrines.** Do you accept starter-deck changes for Architect (B4), given Architect is the only doctrine a new player can pick?
