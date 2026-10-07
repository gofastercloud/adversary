// Authoring helper: generates packs/core.json from compact tables so the 36-cell matrix stays reviewable.
// Run: node scripts/gen-core.mjs   (the JSON is the source of truth at runtime; this just makes edits sane)
import { writeFileSync } from 'node:fs';

const functions = [
  { id: 'govern',   name: 'Govern',   short: 'GV', csf: 'GV', color: '#f5c542', icon: 'scale',     blurb: 'Risk strategy, roles, policy, oversight and supply-chain risk. New in CSF 2.0 — the function that makes the rest accountable.' },
  { id: 'identify', name: 'Identify', short: 'ID', csf: 'ID', color: '#5ad1ff', icon: 'search',    blurb: 'Know your assets, data flows, threats and weaknesses. You cannot defend what you cannot enumerate.' },
  { id: 'protect',  name: 'Protect',  short: 'PR', csf: 'PR', color: '#58e07a', icon: 'shield',    blurb: 'Safeguards that prevent or limit impact: identity, data security, platform hardening, resilient infrastructure.' },
  { id: 'detect',   name: 'Detect',   short: 'DE', csf: 'DE', color: '#ffa94d', icon: 'radar',     blurb: 'Continuous monitoring and adverse-event analysis so compromise is found in minutes, not months.' },
  { id: 'respond',  name: 'Respond',  short: 'RS', csf: 'RS', color: '#ff5a6e', icon: 'siren',     blurb: 'Incident management, analysis, communication and mitigation once a detection is declared an incident.' },
  { id: 'recover',  name: 'Recover',  short: 'RC', csf: 'RC', color: '#b58cff', icon: 'refresh-cw', blurb: 'Restore assets and operations, verify integrity, and communicate recovery.' }
];
const properties = [
  { id: 'spoofing',    name: 'Authentication',  stride: 'Spoofing',               letter: 'S', property: 'Authenticity',    color: '#ff5470', icon: 'fingerprint', blurb: 'Spoofing — pretending to be someone or something else. Countered by strong authentication.' },
  { id: 'tampering',   name: 'Integrity',       stride: 'Tampering',              letter: 'T', property: 'Integrity',       color: '#ffb02e', icon: 'wrench',      blurb: 'Tampering — modifying data, code or configuration without authority. Countered by integrity controls.' },
  { id: 'repudiation', name: 'Non-repudiation', stride: 'Repudiation',            letter: 'R', property: 'Non-repudiability', color: '#a78bfa', icon: 'scroll-text', blurb: 'Repudiation — denying an action because nobody can prove it. Countered by trustworthy audit trails.' },
  { id: 'disclosure',  name: 'Confidentiality', stride: 'Information disclosure', letter: 'I', property: 'Confidentiality', color: '#38bdf8', icon: 'eye-off',     blurb: 'Information disclosure — exposing data to those not authorised to see it. Countered by encryption and access control.' },
  { id: 'dos',         name: 'Availability',    stride: 'Denial of service',      letter: 'D', property: 'Availability',    color: '#4ade80', icon: 'zap',         blurb: 'Denial of service — degrading or denying legitimate use. Countered by capacity, redundancy and recovery.' },
  { id: 'elevation',   name: 'Authorisation',   stride: 'Elevation of privilege', letter: 'E', property: 'Authorisation',   color: '#f472d0', icon: 'key-round',   blurb: 'Elevation of privilege — gaining capabilities without authorisation. Countered by least privilege and separation of duties.' }
];

// [name, flavour, desc, refs]
const c = (name, flavour, desc, refs) => ({ name, flavour, desc, refs });
const cells = {
  'govern.spoofing':    c('Identity & Access Policy', 'Who may be who, and how we prove it', 'Board-endorsed policy that sets identity assurance levels, MFA expectations and account lifecycle rules. Without it, authentication controls are optional in practice.', ['nist-csf:GV.PO-01', 'nist-800-53:IA-1', 'e8:mfa']),
  'govern.tampering':   c('Change Management Board', 'Nothing ships without a name on it', 'Formal change control: approvals, separation between requester and deployer, and rollback plans. Unauthorised change is Tampering by another name.', ['nist-csf:PR.PS-01', 'nist-800-53:CM-3', 'cis:4']),
  'govern.repudiation': c('Logging & Retention Standard', 'If it is not logged it did not happen', 'Defines what must be logged, for how long, and who may delete it. Sets the evidentiary baseline for every investigation and regulator question.', ['nist-csf:GV.PO-01', 'nist-800-53:AU-11', 'cis:8']),
  'govern.disclosure':  c('Data Classification Policy', 'Label it before you lose it', 'A classification scheme with handling rules per tier. Drives encryption, access and DLP decisions and decides what a breach actually costs.', ['nist-csf:ID.AM-07', 'nist-800-53:RA-2', 'iso27001:A.5.12']),
  'govern.dos':         c('Resilience & Impact Tolerance', 'How long can we be down? Write it down', 'Board-set maximum tolerable downtime for critical services, funded and tested. Turns “availability” from a wish into a requirement.', ['nist-csf:GV.OC-04', 'nist-800-53:CP-2', 'iso27001:A.5.30']),
  'govern.elevation':   c('Separation of Duties', 'No one person holds every key', 'Policy that splits request, approve and execute for sensitive actions. Limits what a single stolen or malicious privileged account can do.', ['nist-csf:PR.AA-05', 'nist-800-53:AC-5', 'iso27001:A.5.3']),

  'identify.spoofing':    c('Identity Inventory', 'Humans, services, keys, bots — all of them', 'A complete inventory of human, service and machine identities and their owners. Orphaned service accounts are a favourite foothold.', ['nist-csf:ID.AM-02', 'nist-800-53:IA-4', 'cis:5']),
  'identify.tampering':   c('Software Bill of Materials', 'Know what is inside the box', 'SBOMs and provenance records for software and firmware so a poisoned component can be found and scoped in hours.', ['nist-csf:ID.AM-02', 'nist-800-53:SR-4', 'nist:800-218']),
  'identify.repudiation': c('Log Source Inventory', 'Map every blind spot', 'An inventory of what generates telemetry, what is collected and what is silent. Gaps here become “we cannot tell what happened”.', ['nist-csf:ID.AM-03', 'nist-800-53:AU-2', 'cis:8']),
  'identify.disclosure':  c('Data Flow Mapping', 'Where does the sensitive stuff actually go?', 'Diagrams and discovery tooling showing where sensitive data is stored, processed and transmitted. The raw material of every threat model.', ['nist-csf:ID.AM-03', 'nist-800-53:CM-12', 'owasp:threat-modeling-manifesto']),
  'identify.dos':         c('Critical Dependency Map', 'The thing the thing depends on', 'Maps the services, suppliers and utilities each critical function needs — including the boring ones like DNS, power and the one SaaS nobody remembers.', ['nist-csf:ID.AM-05', 'nist-800-53:RA-9', 'nist-csf:GV.OC-05']),
  'identify.elevation':   c('Attack Path Mapping', 'See the route to Domain Admin first', 'Graph-based analysis of privilege relationships and attack paths, plus authenticated vulnerability scanning, so the shortest path to crown jewels is closed before an attacker walks it.', ['nist-csf:ID.RA-01', 'nist-800-53:RA-5', 'attack:M1016']),

  'protect.spoofing':    c('Phishing-Resistant MFA', 'FIDO2 beats a lookalike login page', 'Hardware-bound, origin-checked authenticators (FIDO2/passkeys) that cannot be replayed by an adversary-in-the-middle. The single highest-value identity control.', ['nist-csf:PR.AA-03', 'nist-800-53:IA-2', 'attack:M1032', 'e8:mfa', 'd3fend:Multi-factorAuthentication']),
  'protect.tampering':   c('Code Signing & Integrity Checks', 'Trust the signature, not the filename', 'Cryptographic signing of code, firmware and configuration, verified at install and boot. Stops unauthorised modification being silently accepted.', ['nist-csf:PR.PS-05', 'nist-800-53:SI-7', 'attack:M1045']),
  'protect.repudiation': c('Tamper-Evident Audit Logging', 'Logs the intruder cannot quietly edit', 'Logs shipped off-host to append-only storage with integrity protection, so an intruder with local admin cannot erase their trail.', ['nist-csf:PR.PS-04', 'nist-800-53:AU-9', 'attack:M1029']),
  'protect.disclosure':  c('Encryption In Transit & At Rest', 'Make a stolen disk a boring disk', 'TLS everywhere and strong at-rest encryption with managed keys. Turns many data-theft events into non-events.', ['nist-csf:PR.DS-01', 'nist-800-53:SC-28', 'attack:M1041', 'd3fend:MessageEncryption']),
  'protect.dos':         c('Rate Limiting & DDoS Shield', 'Absorb the flood, serve the humans', 'Upstream scrubbing, rate limits, autoscaling and sane timeouts so volumetric and application-layer floods degrade gracefully.', ['nist-csf:PR.IR-04', 'nist-800-53:SC-5', 'attack:M1037']),
  'protect.elevation':   c('Least Privilege & PAM', 'Admin rights are a loan, not a gift', 'Role-based access with just-in-time elevation, vaulted privileged credentials and no standing admin. Limits blast radius when any one account falls.', ['nist-csf:PR.AA-05', 'nist-800-53:AC-6', 'attack:M1026', 'e8:restrict-admin']),

  'detect.spoofing':    c('Identity Threat Detection', 'Impossible travel, impossible Tuesday', 'Behavioural analytics on sign-ins and sessions: impossible travel, token replay, MFA fatigue patterns and anomalous consent grants.', ['nist-csf:DE.CM-03', 'nist-800-53:AC-2', 'd3fend:UserGeolocationLogonPatternAnalysis']),
  'detect.tampering':   c('File Integrity Monitoring', 'Tell me when the binary changes', 'Baseline hashes and alerts on unexpected changes to critical files, configs and firmware. Catches implants and web shells.', ['nist-csf:DE.CM-09', 'nist-800-53:SI-7', 'd3fend:FileIntegrityMonitoring']),
  'detect.repudiation': c('SIEM Correlation', 'One alert is noise, five is a story', 'Correlates events across sources to turn scattered log lines into a timeline. The heart of a SOC.', ['nist-csf:DE.AE-03', 'nist-800-53:AU-6', 'cis:8']),
  'detect.disclosure':  c('DLP & Egress Anomaly Detection', 'Why is the file server talking to Moldova?', 'Content-aware and volumetric detection of data leaving the environment, including slow-drip exfiltration over allowed channels.', ['nist-csf:DE.CM-01', 'nist-800-53:AU-13', 'attack:TA0010']),
  'detect.dos':         c('Saturation & Health Monitoring', 'The graph went vertical at 03:12', 'Capacity, latency and error-budget monitoring that spots degradation before customers do and separates attack from success.', ['nist-csf:DE.CM-01', 'nist-800-53:SI-4', 'cis:13']),
  'detect.elevation':   c('Privilege Escalation Analytics', 'Why did svc-backup become Domain Admin?', 'Alerts on privilege grants, group changes, token manipulation and use of privileged functions outside change windows.', ['nist-csf:DE.AE-02', 'nist-800-53:AC-6(9)', 'attack:TA0004']),

  'respond.spoofing':    c('Credential Revocation & Session Kill', 'Reset it all. Now.', 'Rapid, rehearsed ability to revoke sessions, tokens, API keys and passwords for suspected-compromised identities across every system.', ['nist-csf:RS.MI-02', 'nist-800-53:IR-4', 'nist-800-53:AC-2']),
  'respond.tampering':   c('Host Isolation & Quarantine', 'Pull the cable, keep the evidence', 'EDR-driven network containment of compromised hosts that preserves memory and disk state for analysis.', ['nist-csf:RS.MI-01', 'nist-800-53:IR-4', 'd3fend:NetworkIsolation']),
  'respond.repudiation': c('Forensic Evidence Preservation', 'Chain of custody or it never happened', 'Collect and protect volatile and persistent evidence with integrity guarantees so findings stand up to regulators, insurers and courts.', ['nist-csf:RS.AN-07', 'nist-800-53:IR-4', 'nist:800-61']),
  'respond.disclosure':  c('Breach Notification Playbook', 'The 72-hour clock is already running', 'Pre-agreed decision tree, drafts and contacts for regulator, customer and partner notification. Legal duties start at awareness, not at root cause.', ['nist-csf:RS.CO-02', 'nist-800-53:IR-6', 'nist:800-61']),
  'respond.dos':         c('Traffic Scrubbing & Failover', 'Shift the load before the pager melts', 'Runbooks to activate scrubbing, traffic diversion and failover regions during a sustained attack.', ['nist-csf:RS.MI-01', 'nist-800-53:CP-10', 'nist-800-53:SC-5']),
  'respond.elevation':   c('Emergency Privilege Revocation', 'Break glass, then break their access', 'Break-glass procedures to strip standing and delegated privilege, rotate privileged secrets and lock down admin tiers mid-incident.', ['nist-csf:RS.MI-02', 'nist-800-53:AC-2', 'attack:M1026']),

  'recover.spoofing':    c('Identity Rebuild & Re-proofing', 'Trust no one until re-verified', 'Re-issue credentials and re-verify identities after compromise, including help-desk procedures resistant to social engineering.', ['nist-csf:RC.RP-03', 'nist-800-53:IA-12', 'nist-800-53:IA-5']),
  'recover.tampering':   c('Golden Image Rebuild', 'Rebuild, do not clean', 'Rebuild compromised systems from known-good, signed images and verified config rather than trusting a “cleaned” host.', ['nist-csf:RC.RP-05', 'nist-800-53:CP-10', 'nist-800-53:CM-2']),
  'recover.repudiation': c('Post-Incident Review', 'Blameless, evidence-led, actually actioned', 'Structured lessons-learned that feed back into detections, playbooks and risk register. Closes the loop to Govern.', ['nist-csf:ID.IM-03', 'nist-800-53:IR-4', 'nist:800-61']),
  'recover.disclosure':  c('Secret & Key Rotation', 'Assume every key in memory is burned', 'Fast, automated rotation of keys, certificates and secrets that may have been exposed, with revocation of the old material.', ['nist-csf:RC.RP-03', 'nist-800-53:SC-12', 'nist-800-53:IA-5']),
  'recover.dos':         c('Immutable Backups & Tested Restore', 'A backup you have not restored is a hope', 'Offline or immutable backups with regular restoration tests against defined recovery objectives. Your answer to ransomware.', ['nist-csf:PR.DS-11', 'nist-800-53:CP-9', 'attack:M1053', 'e8:backups']),
  'recover.elevation':   c('Directory & Trust Rebuild', 'Reset krbtgt. Twice.', 'Procedures to recover the identity plane itself — forest recovery, trust re-establishment, tiered rebuild — when the attacker owned the directory.', ['nist-csf:RC.RP-03', 'nist-800-53:CP-10', 'attack:M1026'])
};

const handTypes = [
  { id: 'high_card',      name: 'Point Solution',        real: 'High Card',      chips: 5,   mult: 1,  lchips: 10, lmult: 1, desc: 'A single, unconnected control. Better than nothing; not a strategy.', refs: ['cis:1'] },
  { id: 'pair',           name: 'Compensating Controls', real: 'Pair',           chips: 10,  mult: 2,  lchips: 15, lmult: 1, desc: 'Two controls from the same CSF function but different properties: where one is imperfect, another covers the gap.', refs: ['iso27001:A.5.1'] },
  { id: 'two_pair',       name: 'Layered Pairs',         real: 'Two Pair',       chips: 20,  mult: 2,  lchips: 20, lmult: 1, desc: 'Two independent pairs of compensating controls — overlapping coverage in two places.', refs: ['nist-800-53:PL-8'] },
  { id: 'three',          name: 'Function Stack',        real: 'Three of a Kind', chips: 30,  mult: 3,  lchips: 20, lmult: 2, desc: 'Three controls within one CSF function, each guarding a different property. Deep in one capability.', refs: ['nist-csf:overview'] },
  { id: 'straight',       name: 'Full Lifecycle',        real: 'Straight',       chips: 30,  mult: 4,  lchips: 30, lmult: 3, desc: 'Five consecutive CSF functions, e.g. Identify→Protect→Detect→Respond→Recover. Coverage across the whole incident lifecycle.', refs: ['nist-csf:overview'] },
  { id: 'flush',          name: 'Property Hardening',    real: 'Flush',          chips: 35,  mult: 4,  lchips: 15, lmult: 2, desc: 'Five controls that all protect the same security property. A concentrated hardening effort against one STRIDE category.', refs: ['stride:overview', 'e8:maturity-model'] },
  { id: 'full_house',     name: 'Defence in Depth',      real: 'Full House',     chips: 40,  mult: 4,  lchips: 25, lmult: 2, desc: 'A function stack plus a compensating pair: layered, redundant controls so no single failure is fatal.', refs: ['iec62443:overview', 'nist-800-53:SA-8'] },
  { id: 'four',           name: 'Control Saturation',    real: 'Four of a Kind', chips: 60,  mult: 7,  lchips: 30, lmult: 3, desc: 'Four controls in one function. Overwhelming strength in one capability — at the price of neglecting the rest.', refs: ['nist-csf:overview'] },
  { id: 'straight_flush', name: 'Resilience Programme',  real: 'Straight Flush', chips: 100, mult: 8,  lchips: 40, lmult: 4, desc: 'Full lifecycle coverage of a single property: prevent, detect, respond and recover — an engineered, end-to-end capability.', refs: ['nist:800-160v2'] },
  { id: 'five',           name: 'Tooling Sprawl',        real: 'Five of a Kind', chips: 120, mult: 12, lchips: 35, lmult: 3, desc: 'Five controls in the same function. Impressive on a slide; usually overlapping tools nobody has time to operate.', refs: ['cis:1'] },
  { id: 'monoculture',    name: 'Monoculture',           real: 'Flush Five',     chips: 140, mult: 14, lchips: 40, lmult: 3, desc: 'Five copies of the same control. Spectacular when it works, catastrophic when one flaw fells every instance — common-mode failure.', refs: ['cisa:secure-by-design'], secret: true }
];

const frameworks = [
  ['high_card', 'CIS Controls v8', 'cis:1', 'clipboard-check'],
  ['pair', 'ISO/IEC 27002:2022', 'iso27001:A.5.1', 'book-open'],
  ['two_pair', 'NIST SP 800-53 Rev. 5', 'nist-800-53:PL-8', 'layers'],
  ['three', 'ASD Information Security Manual', 'ism:overview', 'file-text'],
  ['straight', 'NIST CSF 2.0', 'nist-csf:overview', 'route'],
  ['flush', 'ACSC Essential Eight', 'e8:maturity-model', 'shield-check'],
  ['full_house', 'IEC 62443', 'iec62443:overview', 'factory'],
  ['four', 'NIST SP 800-207 Zero Trust', 'nist:800-207', 'shield-ban'],
  ['straight_flush', 'NIST SP 800-160 Vol. 2', 'nist:800-160v2', 'heart-pulse'],
  ['five', 'MITRE D3FEND', 'd3fend:Multi-factorAuthentication', 'radar'],
  ['monoculture', 'CISA Secure by Design', 'cisa:secure-by-design', 'gem']
].map(([hand, name, ref, icon]) => ({ id: 'fw.' + hand, name, hand, icon, refs: [ref], desc: 'Study it, and your hands of this type get stronger.' }));

const R = (rarity) => rarity;
const j = (id, name, rarity, icon, rules, lesson, refs, init) => ({ id: 'core.' + id, name, rarity, icon, ...(init != null ? { init } : {}), rules, lesson, refs });
const jokers = [
  j('asset-register', 'Asset Register', 'common', 'clipboard-list', [{ on: 'card', if: { fn: 'identify' }, do: { mult: 2 } }], 'You cannot protect what you do not know you have. Accurate inventories underpin every other control.', ['nist-csf:ID.AM-01', 'cis:1']),
  j('policy-framework', 'Policy Framework', 'common', 'scroll-text', [{ on: 'card', if: { fn: 'govern' }, do: { chips: 25 } }], 'Governance does not stop attacks by itself, but it makes every other control funded, owned and auditable.', ['nist-csf:GV.PO-01']),
  j('patch-tuesday', 'Patch Tuesday', 'common', 'wrench', [{ on: 'hand', if: { firstHand: true }, do: { chips: 30, mult: 5 } }], 'Patching exploited vulnerabilities quickly removes the most common initial-access path. ACSC expects 48 hours when exploits exist.', ['e8:patch-apps', 'e8:patch-os', 'attack:M1051']),
  j('mfa-everywhere', 'MFA Everywhere', 'common', 'fingerprint', [{ on: 'card', if: { prop: 'spoofing' }, do: { mult: 3 } }], 'Stolen credentials are the top intrusion vector. Strong MFA turns a password leak from a breach into an alert.', ['e8:mfa', 'attack:M1032', 'attack:T1078']),
  j('code-signing', 'Code Signing', 'common', 'badge-check', [{ on: 'card', if: { prop: 'tampering' }, do: { chips: 30 } }], 'Verify before you execute. Signed artefacts make supply-chain and implant tampering visible.', ['attack:M1045', 'nist-800-53:SI-7']),
  j('immutable-audit-log', 'Immutable Audit Log', 'common', 'file-lock', [{ on: 'card', if: { prop: 'repudiation' }, do: { chips: 10, mult: 2 } }], 'Attackers erase logs (T1070). Off-host, append-only logging preserves the truth.', ['attack:T1070', 'attack:M1029']),
  j('dlp', 'Data Loss Prevention', 'common', 'eye-off', [{ on: 'card', if: { prop: 'disclosure' }, do: { chips: 25 } }], 'Egress controls and content inspection catch exfiltration that perimeter prevention missed.', ['attack:TA0010', 'nist-800-53:AU-13']),
  j('rate-limiting', 'Rate Limiting', 'common', 'gauge', [{ on: 'card', if: { prop: 'dos' }, do: { mult: 3 } }], 'Throttle per client and per endpoint; it defeats brute-force, scraping and many resource-exhaustion attacks cheaply.', ['owasp-api:API4', 'attack:M1037']),
  j('least-privilege', 'Least Privilege', 'common', 'key-round', [{ on: 'card', if: { prop: 'elevation' }, do: { mult: 3 } }], 'Every permission not granted is an escalation path not available. Review privilege continuously.', ['e8:restrict-admin', 'nist-800-53:AC-6', 'attack:M1026']),
  j('siem-correlation', 'SIEM Correlation', 'common', 'activity', [{ on: 'card', if: { fn: 'detect' }, do: { mult: 3 } }], 'Detection value comes from correlation across sources, not volume of alerts.', ['nist-csf:DE.AE-03', 'nist-800-53:AU-6']),
  j('immutable-backups', 'Offline Backups', 'common', 'database-backup', [{ on: 'held', if: { fn: 'recover' }, do: { mult: 2 } }], 'Backups held out of reach are worth the most when everything else is on fire — like cards you hold rather than play.', ['e8:backups', 'attack:M1053', 'attack:T1490']),
  j('need-to-know', 'Need-to-Know', 'common', 'lock', [{ on: 'hand', if: { playedMax: 3 }, do: { mult: 8 } }], 'Small, tightly scoped access beats broad access. Fewer people, fewer systems, fewer ways to lose data.', ['nist-800-53:AC-6', 'iso27001:A.5.15']),
  j('cyber-insurance', 'Cyber Insurance', 'common', 'shield-half', [{ on: 'round_end', do: { money: 3 } }], 'Risk transfer funds recovery but does not remove the risk, and underwriters increasingly demand MFA, EDR and tested backups.', ['nist-csf:ID.RA-06', 'nist:800-39']),
  j('honeypot', 'Honeypot', 'common', 'bug', [{ on: 'discard', per: { count: 'discardedCards', fn: 'detect' }, do: { money: 1 } }], 'Decoys and canaries produce high-fidelity alerts from low-cost assets.', ['d3fend:DecoyEnvironment', 'attack:M1019']),
  j('bug-bounty', 'Bug Bounty', 'common', 'coins', [{ on: 'hand', if: { hand: ['high_card'] }, do: { money: 2 } }], 'Crowd-sourced testing finds the odd flaw your point solutions miss — pay for results, not hours.', ['owasp:samm', 'nist-csf:ID.RA-08']),
  j('threat-intel-feed', 'Threat Intel Feed', 'uncommon', 'radio-tower', [{ on: 'hand', per: { count: 'handLevel' }, do: { mult: 2 } }], 'Intelligence is only valuable when it tunes controls. The more mature a capability, the more intel multiplies it.', ['nist-csf:ID.RA-02', 'attack:M1019']),
  j('purple-team', 'Purple Team', 'uncommon', 'swords', [{ on: 'hand', if: { distinctFnsMin: 4 }, grow: { by: 1 } }, { on: 'hand', do: { mult: '$v' } }], 'Red and blue working together turn every simulated attack into a detection or control improvement.', ['nist-csf:ID.IM-02', 'attack:TA0043'], 0),
  j('zero-trust', 'Zero Trust', 'uncommon', 'shield-ban', [{ on: 'hand', if: { distinctPropsMin: 5 }, do: { xmult: 1.8 } }], 'Never trust, always verify — across identity, device, network, data and application. Breadth of verification is the point.', ['nist:800-207', 'e8:maturity-model']),
  j('segmentation', 'Network Segmentation', 'uncommon', 'fence', [{ on: 'hand', if: { contains: ['flush'] }, do: { mult: 10 } }], 'Isolating zones turns a single foothold into a contained incident.', ['attack:M1030', 'iec62443:3-2', 'd3fend:NetworkIsolation']),
  j('allowlisting', 'Application Allowlisting', 'uncommon', 'package-check', [{ on: 'hand', if: { contains: ['three'] }, do: { xmult: 1.5 } }], 'Only approved code runs. The most effective of the Essential Eight against commodity malware.', ['e8:app-control', 'attack:M1038']),
  j('board-reporting', 'Board Reporting', 'uncommon', 'landmark', [{ on: 'retrigger', if: { fn: 'govern' }, do: { times: 1 } }], 'Directors are accountable. Regular, plain-language risk reporting keeps Govern cards working twice as hard.', ['nist-csf:GV.OV-01', 'nist-csf:GV.RR-01']),
  j('mttd', 'Mean Time to Detect', 'uncommon', 'timer', [{ on: 'hand', per: { count: 'handsLeft' }, do: { mult: 4 } }], 'Early detection is worth more than late perfection: dwell time drives impact.', ['nist-csf:DE.AE-02']),
  j('continuous-improvement', 'Continuous Improvement', 'uncommon', 'refresh-cw', [{ on: 'round_end', grow: { by: 12 } }, { on: 'hand', do: { chips: '$v' } }], 'Each exercise, incident and audit should leave a permanent improvement behind.', ['nist-csf:ID.IM-01', 'iso27001:A.5.35'], 0),
  j('ir-retainer', 'IR Retainer', 'uncommon', 'handshake', [{ on: 'round_end', if: { moneyMax: 5 }, do: { money: 4 } }], 'Pre-negotiated incident response support means help arrives before the invoice debate does.', ['nist-csf:RS.MA-01', 'nist:800-61']),
  j('sbom', 'SBOM Programme', 'uncommon', 'package', [{ on: 'hand', per: { count: 'distinctFns' }, do: { mult: 2 } }], 'Breadth of component knowledge across the lifecycle makes the next Log4Shell a query, not a crisis.', ['nist:800-218', 'attack:T1195']),
  j('runbook', 'Runbooks', 'uncommon', 'book-open', [{ on: 'passive', do: { discards: 1 } }], 'Rehearsed runbooks give responders more safe moves under pressure.', ['nist-csf:RS.MA-01']),
  j('tabletop', 'Tabletop Exercise', 'uncommon', 'clipboard-check', [{ on: 'boss_defeated', do: { money: 6 } }], 'Exercising the big scenario before it happens pays for itself the first time it does.', ['nist-csf:ID.IM-02', 'nist:800-61']),
  j('counter-intel', 'Know Your Adversary', 'uncommon', 'scan-eye', [{ on: 'card', if: { counter: true }, do: { mult: 4 } }], 'Map controls to the exact technique you are facing. Defence-in-depth works best when each layer is chosen against a known TTP.', ['attack:TA0043', 'd3fend:Multi-factorAuthentication']),
  j('red-team', 'Red Team', 'rare', 'crosshair', [{ on: 'hand', if: { handsLeft: 0 }, do: { xmult: 2 } }], 'Adversary emulation under pressure reveals how controls perform in the last stand, not on the slide deck.', ['nist-csf:ID.IM-02', 'attack:TA0001']),
  j('assume-breach', 'Assume Breach', 'rare', 'skull', [{ on: 'hand', if: { noDiscardsUsed: true }, do: { xmult: 1.8 } }], 'Design as if the attacker is already inside, then you do not need to react — you have already prepared.', ['nist:800-207', 'nist-csf:DE.CM-01']),
  j('resilience-engineering', 'Resilience Engineering', 'rare', 'heart-pulse', [{ on: 'hand', if: { contains: ['straight'] }, do: { xmult: 2.5 } }], 'Resilience is a lifecycle property: anticipate, withstand, recover, adapt.', ['nist:800-160v2', 'nist-csf:overview']),
  j('risk-appetite', 'Risk Appetite Statement', 'rare', 'scale', [{ on: 'passive', do: { hands: 1, handSize: -1 } }], 'An explicit appetite trades breadth for focus: more plays, fewer options in hand.', ['nist-csf:GV.RM-02']),
  j('soc-247', '24×7 SOC', 'rare', 'cctv', [{ on: 'passive', do: { handSize: 1 } }], 'Round-the-clock monitoring widens what you can see and act on.', ['nist-csf:DE.CM-01']),
  j('ciso', 'The CISO', 'rare', 'crown', [{ on: 'hand', per: { count: 'jokers' }, do: { xmult: 0.2 } }], 'A programme is more than the sum of its controls: leadership aligns doctrines into one coherent strategy.', ['nist-csf:GV.RR-01', 'nist-csf:GV.RM-03'])
];

const pb = (id, name, icon, op, target, params, lesson, refs, cost = 3) => ({ id: 'core.pb-' + id, name, icon, cost, op, ...(target ? { target } : {}), params, lesson, refs });
const playbooks = [
  pb('mfa', 'Deploy MFA', 'fingerprint', 'setProp', { min: 1, max: 3 }, { prop: 'spoofing' }, 'Spoofing is countered by authentication. Selected controls now defend the Authentication property.', ['stride:S', 'attack:M1032']),
  pb('integrity', 'Integrity Monitoring', 'wrench', 'setProp', { min: 1, max: 3 }, { prop: 'tampering' }, 'Tampering is countered by integrity controls: signing, hashing, change control.', ['stride:T', 'nist-800-53:SI-7']),
  pb('audit', 'Enable Audit Logging', 'scroll-text', 'setProp', { min: 1, max: 3 }, { prop: 'repudiation' }, 'Repudiation is countered by trustworthy logs with attributable identities.', ['stride:R', 'nist-800-53:AU-10']),
  pb('encrypt', 'Encrypt Everything', 'eye-off', 'setProp', { min: 1, max: 3 }, { prop: 'disclosure' }, 'Information disclosure is countered by encryption and access control.', ['stride:I', 'attack:M1041']),
  pb('ddos', 'Buy DDoS Protection', 'zap', 'setProp', { min: 1, max: 3 }, { prop: 'dos' }, 'Denial of service is countered by capacity, filtering and redundancy.', ['stride:D', 'attack:M1037']),
  pb('privrev', 'Privilege Review', 'key-round', 'setProp', { min: 1, max: 3 }, { prop: 'elevation' }, 'Elevation of privilege is countered by authorisation controls and least privilege.', ['stride:E', 'attack:M1026']),
  pb('uplift', 'Maturity Uplift', 'trending-up', 'upgrade', { min: 1, max: 2 }, {}, 'Raise selected controls one maturity level (max ML3). Essential Eight maturity levels measure how well, not just whether.', ['e8:maturity-model']),
  pb('decom', 'Decommission Legacy', 'trash-2', 'destroy', { min: 1, max: 2 }, {}, 'Retiring unneeded systems shrinks the attack surface and thins your deck so good cards come up more often.', ['nist-csf:ID.AM-08', 'nist-800-53:CM-7']),
  pb('dr', 'DR Failover Copy', 'copy-plus', 'clone', { min: 1, max: 1 }, {}, 'Duplicate a control into your deck. Redundancy helps — but five identical copies is a Monoculture.', ['nist-800-53:CP-6']),
  pb('reorg', 'Reorganisation', 'shuffle', 'copyFn', { min: 2, max: 3 }, {}, 'Every selected control except the right-most takes on the right-most one’s CSF function. Re-orgs move capability between functions.', ['nist-csf:GV.RR-02']),
  pb('capex', 'Capex Approval', 'hand-coins', 'money', null, { cap: 20 }, 'Double your budget (up to +$20). Security investment is a risk decision.', ['nist-csf:GV.RR-03'], 3),
  pb('rfp', 'Request for Proposal', 'handshake', 'createJoker', null, {}, 'Run a procurement and onboard a random doctrine (needs a free slot).', ['nist-csf:GV.SC-06'], 4)
];

const tags = [
  { id: 'budget', name: 'Budget Carry-over', icon: 'piggy-bank', money: 8, desc: 'Gain $8.' },
  { id: 'playbook', name: 'Free Playbook', icon: 'clipboard-list', desc: 'Receive a random Playbook.' },
  { id: 'framework', name: 'Free Framework', icon: 'book-open', desc: 'Receive a random Framework.' },
  { id: 'doctrine', name: 'Free Doctrine', icon: 'sparkles', desc: 'Receive a random common Doctrine.' }
];

const economy = {
  hands: 4, discards: 3, handSize: 8, startMoney: 4, jokerSlots: 5, consumableSlots: 2,
  interestStep: 5, interestCap: 5, blindReward: [3, 4, 5], handBonus: 1,
  anteBase: [100, 300, 800, 2000, 5000, 11000, 20000, 35000], blindMult: [1, 1.5, 2],
  rerollBase: 5, rerollStep: 1, rarityCost: { common: 5, uncommon: 7, rare: 9 }, packCost: 4,
  mlChips: { 1: 6, 2: 16, 3: 30 }, counterChips: 40, winAnte: 8,
  modelReward: 3, modelPerfectBonusHands: 1, modelQuestions: 2
};

const core = {
  schema: 1, id: 'core', kind: 'core', name: 'Core Rules', version: '1.0.0',
  tagline: 'Six functions. Six threats. Thirty-six controls.',
  functions, properties, cells, handTypes, frameworks, playbooks, jokers, tags, economy
};
writeFileSync(new URL('../packs/core.json', import.meta.url), JSON.stringify(core, null, 1) + '\n');
console.log('core.json written:', Object.keys(cells).length, 'cells,', jokers.length, 'jokers,', playbooks.length, 'playbooks');
