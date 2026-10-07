# Design

## One-paragraph pitch

Slay-the-Spire pacing, Hearthstone's persistent board, Balatro's run meta, and real adversary tradecraft. Each battle is a
two-sided card game over an organisation's assets. You deploy **controls** onto assets (they stay in play), the adversary
telegraphs an **intent** each turn, and hidden **footholds** appear on your assets until you find and evict them. The
adversary wins by reaching its **goal** or draining your **Resilience**. You win by burning its operation (**Exposure**) or
surviving the window.

## The defender taxonomy: 36 cards = NIST CSF 2.0 function × STRIDE property

| | Spoofing | Tampering | Repudiation | Disclosure | DoS | Elevation |
|---|---|---|---|---|---|---|
| **Govern** | policy | policy | policy | policy | policy | policy |
| **Identify** | intel | intel | intel | intel | intel | intel |
| **Protect** | ward | ward | ward | ward | ward | ward |
| **Detect** | monitor | monitor | monitor | monitor | monitor | monitor |
| **Respond** | evict | evict | evict | evict | evict | evict |
| **Recover** | heal | heal | heal | heal | heal | heal |

The function decides what the card does (Govern = persistent policy, Identify = intel, Protect = ward, Detect = monitor,
Respond = evict, Recover = heal/aegis). The STRIDE property decides which class of attack it wards. Card types: control,
action, policy, augment, status. Sector packs re-skin the 36 cells (names, lessons, links) without changing mechanics.

## Real data drives the numbers

- **Wards**: a control gets +1 when its ATT&CK mitigation list (`mit`) overlaps the attacking technique's mitigations
  (STIX `mitigates`), or when it cites a NIST 800-53 control that CTID maps to the technique, or (AWS cards) when CTID
  scores it as covering the technique (minimal/partial/significant → +1/+1/+2). One bonus per control, two per attack.
- **Augments** ("boost cards": FIDO2 on MFA, post-quantum crypto on encryption) carry `resists` techniques with a +3 counter.
  The validator only allows an ATT&CK-backed `resists`; anything else must be an `expert` mapping with a citation
  (EMB3D mitigations are cited this way; EMB3D's maturity tier sets rarity and cost).
- **Adversary decks** are compiled from ATT&CK groups and campaigns plus their software. Observables shown in dossiers are
  behaviours (command lines, filenames), never IPs, hashes or URLs, because indicators rot.
- **Baseline tradecraft**: each battle also draws a few commodity techniques at random, weighted by prevalence
  (70% ATT&CK group breadth, 30% frequency in documented incidents from CTID's Attack Flow corpus). Payoffs are never
  baseline; they come from the adversary's signature or its goal.
- **Goals** (below) make the adversary's objective explicit and give groups with no impact techniques a way to win.

## Adversary goals (win conditions)

| Goal | Rule | Teaches |
|---|---|---|
| Pre-position | +1/turn while it holds an *undetected* foothold on OT, servers, identity or data; −1 otherwise | Dwell time is the damage |
| Sell access | Breach if undetected footholds on 5 assets at once | Brokers monetise breadth |
| Steal data | Successful exfiltrations score (jewel ×2) | Exfil-only extortion ignores backups |
| Encrypt & extort | Successful strikes score | Remove recovery first, so protect recovery |
| Destroy | As above, fewer needed | Wipers have no key |
| Disrupt service | Strike/impair/inhibit; OT or jewel ×2 | Safety and availability first |
| Steal money | Only crown-jewel hits score | Dual control and out-of-band checks |
| Hijack resources | ≥2 undetected footholds for several turns | Bills, not SIEM alerts |

Progress is always visible. Detection and isolation matter because only *undetected* footholds count for the dwell rules.

## Consumables and "expert knowledge" cards

No technique data behind these; the trade-off is the lesson. `consume: 'battle'` exhausts for the fight, `'run'` is spent
for the rest of the run. Examples: **Activate Security Retainer**, **Disable System** (isolate + purge at 3 integrity cost;
the lesson text covers OT safe-state), **Restore from Backup** (full rebuild only if a working recovery control is on the
board), **Engage Breach Counsel**, **ISAC/ACSC Tip-off**.

## Meta-progression

- **Run**: 3 acts of map nodes (battle, elite, boss, shop, rest, event, whiteboard), relics, five doctrines
  (Zero Trust Architect, Threat Hunter, Resilience Engineer, GRC Lead, Incident Commander), card maturity ML1–3.
- **Assurance levels** 0–3 (Training, ML1, ML2, ML3) scale difficulty.
- **Whiteboard**: STRIDE-per-element threat modelling on a data-flow diagram. Each pack ships two DFDs of 8 scenarios.
- **TTX mode**: facilitator-style exercises with timed injects, decisions rated best/ok/poor with lessons, and objectives.
- **Progress**: clearance XP, codex (adversaries, techniques, controls), 122 achievements (20 hidden), daily challenge.

## Determinism and verification

The engine is a pure function of (content, seed, actions). A run's action log replays exactly; the server replays it to
verify score and rejects tampered, truncated or wrong-content logs (content fingerprint). RNG is counter-based per named
stream so new features do not reshuffle old ones.

## Educational model

Every card, relic, event, scenario and decision carries a `lesson` and 2–6 `refs`. The UI shows *why* an attack was
stopped (ward breakdown with sources) and what an adversary's intent is before it lands, so the game explains itself.
Fiction is kept honest: assessed intents are labelled, goals are editorial, STRIDE mapping of techniques is a heuristic.
