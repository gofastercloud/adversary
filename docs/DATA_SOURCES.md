# Data sources and regeneration

All real data is committed under `data/` so the game builds offline. Rebuild from upstream with `npm run data`.

| Dataset | Upstream | Script | Output |
|---|---|---|---|
| MITRE ATT&CK Enterprise + ICS (STIX) | `mitre-attack/attack-stix-data` | `build-attack-data.mjs` | `data/attack/*`, `data/adversaries/*`, `data/dossiers/*` |
| Non-ATT&CK adversaries (e.g. TeamPCP) | vendor reports, cited in the script | `build-custom-adversaries.mjs` | `data/adversaries/X*.json` |
| MITRE EMB3D (STIX 2.1) | `emb3d.mitre.org/assets/emb3d-stix-2.0.1.json` | `build-mapping-data.mjs` | `data/emb3d/*` (59 properties, 81 threats, 89 mitigations) |
| CTID Mappings Explorer: NIST 800-53 and AWS | `ctid.mitre.org/mappings/data/...` | `build-mapping-data.mjs` | `data/ctid/nist-800-53.json`, `aws.json`; `c` folded into techniques |
| CTID Defending OT with ATT&CK | `center-for-threat-informed-defense.github.io/defending-ot-with-attack` | `build-mapping-data.mjs` | `data/ctid/ot-assets.json` (22 reference-architecture assets) |
| CTID Attack Flow corpus | `.../attack-flow/corpus` | `build-flows.mjs` | `data/flows/*` (40 incidents, transitions, goal tags) |
| Baseline prevalence | derived from ATT&CK + flows | `build-baseline.mjs` | `p`, `pg`, `po`, `g` on `data/attack/techniques.json`, `data/baseline/summary.json` |

Run order matters (`npm run data` does it): attack data, custom adversaries, mapping data, flows, baseline. The attack-data
step rewrites the technique table, so the later steps must run after it.

## What each derived field means

- `m`: ATT&CK mitigations of the technique (STIX `mitigates`). `c`: NIST 800-53 controls mapped by CTID.
- `pg`: percent of intrusion sets (directly or via software) using the technique, per domain. `po`: percent of the 40
  documented incidents using it. `p = 0.7·pg + 0.3·po`. `g`: percent of incidents with a given goal using it.
- Goal tags on flows are editorial (a heuristic over terminal techniques plus overrides where it misread an incident).
- ATT&CK v19 renumbered some ICS techniques; CTID's OT collection predates that, so only ids that still exist are kept.

## Licences

ATT&CK and EMB3D: © The MITRE Corporation, used under their terms of use. CTID projects: Apache-2.0. See `data/attack/NOTICE.md`.
The prevalence and goal fields are the project's own derived figures, not MITRE content. Vendor-sourced profiles (TeamPCP) cite
Trend Micro, Sophos and the Cloud Security Alliance and record behaviours only.

## Known gaps

- CTID's Sightings Ecosystem (6M+ sightings; 15 techniques make 90% of observations) is only published as a report, so it
  is not ingested. If a raw dataset is released, it should replace the 30% incident-frequency term.
- Attack Flow descriptions are the corpus authors' summaries; the game quotes and links them but does not re-verify them.
