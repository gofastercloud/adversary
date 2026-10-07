// Authoring helper: generates content/core/cards.json (the defender card pool).
// Gameplay numbers live here; names/lessons for the 36 matrix cells come from taxonomy.json.
// Run: node scripts/gen-cards.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const tax = JSON.parse(readFileSync(new URL('../content/core/taxonomy.json', import.meta.url)));
const cards = [];
const add = (c) => cards.push({ rarity: 'common', target: 'none', ...c });

// ───────── 36 matrix cards ─────────
const FN = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
const PR = ['spoofing', 'tampering', 'repudiation', 'disclosure', 'dos', 'elevation'];
const L = { spoofing: 'S', tampering: 'T', repudiation: 'R', disclosure: 'I', dos: 'D', elevation: 'E' };
const cell = (f, p) => `${f}.${p}`;
const base = (f, p, extra) => add({ id: 'c.' + cell(f, p), cell: cell(f, p), fn: f, prop: p, ...extra });

// GOVERN — policies: persistent, global, occupy one of two Programme slots
base('govern', 'spoofing',    { type: 'policy', cost: 1, aura: { ward: { S: 1 } } });
base('govern', 'tampering',   { type: 'policy', cost: 1, aura: { advTax: { tactics: ['persistence', 'defense-impairment'], n: 1 } } });
base('govern', 'repudiation', { type: 'policy', cost: 1, aura: { stealthMinus: 1 } });
base('govern', 'disclosure',  { type: 'policy', cost: 1, aura: { exfilMinus: 2 } });
base('govern', 'dos',         { type: 'policy', cost: 1, aura: { shield: 1 } });
base('govern', 'elevation',   { type: 'policy', cost: 1, aura: { advTax: { tactics: ['privilege-escalation', 'lateral-movement'], n: 1 } } });

// IDENTIFY — intel actions
base('identify', 'spoofing',    { type: 'action', cost: 1, fx: [{ op: 'scanKinds', kinds: ['identity', 'email'], str: 3 }, { op: 'draw', n: 1 }] });
base('identify', 'tampering',   { type: 'action', cost: 1, fx: [{ op: 'scanKinds', kinds: ['app', 'vendor', 'server'], str: 3 }, { op: 'intel', n: 1 }] });
base('identify', 'repudiation', { type: 'action', cost: 1, fx: [{ op: 'intel', n: 2 }, { op: 'draw', n: 1 }] });
base('identify', 'disclosure',  { type: 'action', cost: 1, fx: [{ op: 'scanKinds', kinds: ['data', 'cloud', 'backup', 'server'], str: 3 }, { op: 'draw', n: 1 }] });
base('identify', 'dos',         { type: 'action', cost: 1, fx: [{ op: 'draw', n: 2 }] });
base('identify', 'elevation',   { type: 'action', cost: 1, target: 'asset', fx: [{ op: 'blockPath' }, { op: 'intel', n: 1 }] });

// PROTECT — wards
const ctl = (p, mit, extra = {}) => base('protect', p, { type: 'control', cost: 2, target: 'asset', ward: { [L[p]]: 2 }, mit, ...extra });
ctl('spoofing',    ['M1032', 'M1027'], { tags: ['identity'] });
ctl('tampering',   ['M1045', 'M1038']);
ctl('repudiation', ['M1029', 'M1047'], { flags: ['stealthMinus1'] });
ctl('disclosure',  ['M1041', 'M1057']);
ctl('dos',         ['M1037', 'M1031']);
ctl('elevation',   ['M1026', 'M1018']);

// DETECT — monitors
const mon = (p, detect, extra = {}) => base('detect', p, { type: 'control', cost: 2, target: 'asset', detect, ...extra });
mon('spoofing',    { str: 3, n: 1, scope: 'asset' });
mon('tampering',   { str: 3, n: 1, scope: 'asset' });
mon('repudiation', { str: 2, n: 1, scope: 'global' });
mon('disclosure',  { str: 3, n: 1, scope: 'asset' }, { ward: { I: 1 } });
mon('dos',         { str: 2, n: 1, scope: 'asset' }, { ward: { D: 1 } });
mon('elevation',   { str: 3, n: 1, scope: 'asset', privBonus: 1 });

// RESPOND — actions
base('respond', 'spoofing',    { type: 'action', cost: 1, target: 'foothold', fx: [{ op: 'evict', n: 1 }, { op: 'clearCreds' }] });
base('respond', 'tampering',   { type: 'action', cost: 1, target: 'asset', fx: [{ op: 'isolate' }, { op: 'reveal', n: 1, str: 3 }] });
base('respond', 'repudiation', { type: 'action', cost: 2, target: 'foothold', fx: [{ op: 'evict', n: 1 }, { op: 'exposure', n: 2 }] });
base('respond', 'disclosure',  { type: 'action', cost: 1, fx: [{ op: 'resilience', n: 3 }, { op: 'shieldExfil', n: 2 }] });
base('respond', 'dos',         { type: 'action', cost: 2, target: 'asset', fx: [{ op: 'shield', n: 3 }, { op: 'heal', n: 2 }] });
base('respond', 'elevation',   { type: 'action', cost: 2, target: 'asset', fx: [{ op: 'unprivilege' }, { op: 'evictPrivileged', n: 2 }, { op: 'clearCreds' }] });

// RECOVER — heal / rebuild
base('recover', 'spoofing',    { type: 'action', cost: 2, target: 'asset', fx: [{ op: 'heal', n: 3 }, { op: 'restore' }, { op: 'clearCreds' }] });
base('recover', 'tampering',   { type: 'action', cost: 3, rarity: 'uncommon', target: 'asset', fx: [{ op: 'purge' }, { op: 'heal', n: 3 }, { op: 'restore' }] });
base('recover', 'repudiation', { type: 'action', cost: 1, fx: [{ op: 'draw', n: 2 }, { op: 'energyNext', n: 1 }] });
base('recover', 'disclosure',  { type: 'action', cost: 1, target: 'asset', fx: [{ op: 'clearCreds' }, { op: 'unstage' }, { op: 'shield', n: 1 }] });
base('recover', 'dos',         { type: 'control', cost: 2, target: 'asset', mit: ['M1053'], aegis: { revive: 4 }, tags: ['backup'] });
base('recover', 'elevation',   { type: 'action', cost: 3, rarity: 'rare', target: 'asset', fx: [{ op: 'heal', n: 99 }, { op: 'unprivilegeAll' }, { op: 'clearCreds' }, { op: 'restore' }] });

// ───────── extras (non-matrix) ─────────
add({ id: 'x.patch', fn: 'protect', prop: 'tampering', type: 'action', cost: 1, target: 'asset', mit: ['M1051'], fx: [{ op: 'shield', n: 2 }, { op: 'heal', n: 1 }], name: 'Emergency Patch', desc: 'Patch the exploited component now. ACSC expects exploited vulnerabilities in internet-facing services to be patched within 48 hours.', lesson: 'Patch internet-facing services fast when exploitation is known: Essential Eight “patch applications”.', refs: ['e8:patch-apps', 'attack:M1051'] });
add({ id: 'x.segment', fn: 'protect', prop: 'elevation', type: 'control', cost: 2, rarity: 'uncommon', target: 'asset', ward: { E: 1 }, mit: ['M1030'], flags: ['segment'], name: 'Network Segmentation', desc: 'Zone the asset. Adversary Spread into or out of it costs 1 more energy and has 1 less power.', lesson: 'Segmentation turns one foothold into a contained incident; IEC 62443 calls the boundaries zones and conduits.', refs: ['attack:M1030', 'iec62443:3-2', 'd3fend:NetworkIsolation'] });
add({ id: 'x.edr', fn: 'detect', prop: 'tampering', type: 'control', cost: 3, rarity: 'rare', target: 'asset', detect: { str: 3, n: 2, scope: 'asset' }, ward: { T: 1 }, mit: ['M1049', 'M1040'], flags: ['autoEvict'], name: 'EDR with Auto-Containment', desc: 'Detects on this asset and, each round, reduces the grip of revealed footholds here by 1.', lesson: 'Endpoint detection and response combines telemetry with containment actions; speed matters more than perfect fidelity.', refs: ['attack:M1049', 'attack:M1040', 'd3fend:FileIntegrityMonitoring'] });
add({ id: 'x.waf', fn: 'protect', prop: 'elevation', type: 'control', cost: 2, target: 'asset', ward: { E: 2 }, mit: ['M1050', 'M1016'], name: 'WAF & Virtual Patching', desc: 'Blocks known exploit patterns in front of an internet-facing app while the real fix is prepared.', lesson: 'A WAF buys time for patching; it is not a substitute for fixing the flaw.', refs: ['attack:M1050', 'owasp-top10:A06', 'attack:T1190'] });
add({ id: 'x.training', fn: 'govern', prop: 'spoofing', type: 'control', cost: 1, target: 'asset', ward: { S: 1 }, mit: ['M1017'], name: 'Awareness Training & Phishing Simulation', desc: 'People are a control layer too. Counts against social-engineering techniques that ATT&CK lists User Training for.', lesson: 'User training reduces — never eliminates — social engineering success; pair it with technical controls.', refs: ['attack:M1017', 'attack:T1566'] });
add({ id: 'x.threathunt', fn: 'detect', prop: 'repudiation', type: 'action', cost: 2, rarity: 'uncommon', fx: [{ op: 'reveal', n: 2, str: 5 }], name: 'Threat Hunt', desc: 'Hypothesis-driven hunting: reveal up to 2 hidden footholds anywhere, whatever their stealth (up to 5).', lesson: 'Hunting finds what detection rules miss; it starts from an adversary hypothesis, ideally a specific ATT&CK technique.', refs: ['nist-csf:DE.AE-02', 'attack:TA0043'] });
add({ id: 'x.tabletop', fn: 'identify', prop: 'dos', type: 'action', cost: 1, fx: [{ op: 'intel', n: 3 }, { op: 'draw', n: 1 }], name: 'Tabletop Exercise', desc: 'See the adversary’s next moves clearly and draw a card.', lesson: 'Exercising the scenario before it happens is the cheapest control in the programme.', refs: ['nist-csf:ID.IM-02', 'nist:800-61'] });
add({ id: 'x.purple', fn: 'detect', prop: 'tampering', type: 'action', cost: 2, rarity: 'uncommon', fx: [{ op: 'reveal', n: 1, str: 4 }, { op: 'exposure', n: 2 }, { op: 'draw', n: 1 }], name: 'Purple Team Exercise', desc: 'Reveal a foothold, expose the adversary’s tradecraft (+2 Exposure), draw a card.', lesson: 'Red and blue working together turns each emulated technique into a detection or control improvement.', refs: ['nist-csf:ID.IM-02', 'attack:TA0043'] });
add({ id: 'x.soar', fn: 'respond', prop: 'tampering', type: 'policy', cost: 2, rarity: 'uncommon', aura: { onReveal: { evict: 1, oncePerRound: true } }, name: 'SOAR Automation', desc: 'The first time each round a foothold is revealed, its grip is reduced by 1 automatically.', lesson: 'Automate the first response step — containment in seconds — and keep humans for judgement.', refs: ['nist-csf:RS.MI-01', 'd3fend:NetworkIsolation'] });
add({ id: 'x.zerotrust', fn: 'protect', prop: 'elevation', type: 'policy', cost: 2, rarity: 'rare', aura: { layered: { minControls: 2, ward: 1 } }, name: 'Zero Trust Architecture', desc: 'Assets with 2 or more controls gain +1 ward against every property.', lesson: 'Zero trust is layered verification of identity, device and context for every request, not a single product.', refs: ['nist:800-207', 'e8:maturity-model'] });
add({ id: 'x.e8', fn: 'govern', prop: 'elevation', type: 'policy', cost: 2, rarity: 'uncommon', aura: { protectBonus: 1 }, name: 'Essential Eight Maturity Uplift', desc: 'Every Protect control gains +1 ward on its own property.', lesson: 'The Essential Eight maturity model measures how consistently controls are implemented, not just whether they exist.', refs: ['e8:maturity-model', 'ism:overview'] });
add({ id: 'x.assume', fn: 'detect', prop: 'repudiation', type: 'policy', cost: 2, rarity: 'uncommon', aura: { startReveal: 1 }, name: 'Assume Breach', desc: 'At the start of each of your turns, reveal the hidden foothold with the lowest stealth.', lesson: 'Design and operate as if the adversary is already inside — then compromise is a routine to detect, not a surprise.', refs: ['nist:800-207', 'nist-csf:DE.CM-01'] });
add({ id: 'x.insurance', fn: 'govern', prop: 'disclosure', type: 'policy', cost: 1, aura: { resilienceShield: 2 }, name: 'Cyber Insurance', desc: 'The first Resilience loss each round is reduced by 2.', lesson: 'Insurance transfers financial loss; underwriters increasingly require MFA, EDR and tested backups.', refs: ['nist-csf:ID.RA-06', 'nist:800-39'] });
add({ id: 'status.techdebt', fn: 'govern', prop: 'tampering', type: 'status', cost: 0, rarity: 'status', unplayable: true, name: 'Technical Debt', desc: 'Unplayable. Clogs your hand until you pay it down (Decommission it at a Rest site or shop).', lesson: 'Deferred maintenance and unmanaged exceptions accrue interest in the form of risk.', refs: ['nist-csf:ID.RA-07', 'nist-800-53:CM-7'] });

// ───────── augments ─────────
const aug = (id, name, base, cost, rarity, aug, desc, lesson, refs) => add({ id, name, type: 'augment', fn: 'protect', prop: 'spoofing', cost, rarity, target: 'control', base, aug, desc, lesson, refs });
aug('a.mfa-numbermatch', 'Number Matching', ['protect.spoofing'], 1, 'common', { mit: ['M1032'], resists: ['T1621'] }, 'Push approvals now need the number shown at login. Counters MFA-fatigue (push bombing).', 'Plain push MFA is defeated by Multi-Factor Authentication Request Generation (T1621). Number matching forces the user to prove presence at the login screen.', ['attack:T1621', 'attack:M1032']);
aug('a.fido2', 'FIDO2 / Passkeys', ['protect.spoofing'], 2, 'rare', { ward: { S: 2 }, mit: ['M1032'], resists: ['T1621'], expert: [{ tech: 'T1557', ref: 'nist:800-63' }] }, '+2 Authentication ward. Origin-bound credentials: counters MFA fatigue and adversary-in-the-middle phishing.', 'Phishing-resistant authenticators bind the credential to the legitimate origin, so a lookalike site or a relayed session gets nothing usable. (ATT&CK lists no mitigation for T1557 under MFA; the adversary-in-the-middle resistance here comes from NIST SP 800-63B guidance.)', ['nist:800-63', 'attack:T1557', 'attack:T1621', 'e8:mfa']);
aug('a.cond-access', 'Conditional Access', ['protect.spoofing', 'protect.elevation'], 1, 'uncommon', { ward: { S: 1, E: 1 }, mit: ['M1032', 'M1036'] }, '+1 Authentication and Authorisation ward: sign-ins need a compliant device and acceptable risk.', 'Context-aware policy (device health, location, risk) makes stolen credentials alone insufficient.', ['attack:M1036', 'nist:800-207']);
aug('a.credguard', 'Credential Guard', ['protect.elevation', 'protect.spoofing'], 1, 'uncommon', { mit: ['M1043', 'M1040'], resists: ['T1003', 'T1558'] }, 'Isolates secrets from the OS. Counters OS credential dumping and Kerberos ticket theft.', 'LSASS dumping (T1003.001) is a staple of ransomware and nation-state intrusions; virtualisation-based credential isolation removes the easy target.', ['attack:M1043', 'attack:T1003']);
aug('a.pam-jit', 'Just-in-Time Privilege', ['protect.elevation'], 1, 'uncommon', { ward: { E: 1 }, mit: ['M1026'], flags: ['jit'] }, '+1 Authorisation ward. Privileged footholds on this asset lose their privilege at the start of each round.', 'Standing admin rights are a loan the attacker can call in. Time-boxed elevation shrinks the window.', ['attack:M1026', 'e8:restrict-admin']);
aug('a.tiering', 'Tiered Admin Model', ['protect.elevation'], 2, 'uncommon', { ward: { E: 2 }, mit: ['M1026', 'M1018'] }, '+2 Authorisation ward: domain-admin credentials never touch lower tiers.', 'Credential tiering stops one compromised workstation from handing over the directory.', ['attack:M1026', 'e8:restrict-admin']);
aug('a.tls13', 'TLS 1.3 + HSTS', ['protect.disclosure'], 1, 'common', { ward: { I: 1 }, mit: ['M1041'], resists: ['T1040', 'T1557'] }, '+1 Confidentiality ward. Counters network sniffing and adversary-in-the-middle on this asset.', 'Strong transport encryption with pinned expectations removes passive sniffing and most downgrade tricks.', ['attack:M1041', 'attack:T1040']);
aug('a.kms', 'Customer-Managed Keys (KMS/HSM)', ['protect.disclosure'], 1, 'uncommon', { ward: { I: 1 }, mit: ['M1041'] }, '+1 Confidentiality ward. Keys live in a hardened module with separate access control.', 'Separating key custody from data custody means a data breach is not automatically a key breach.', ['nist-800-53:SC-12', 'attack:M1041']);
aug('a.pqc', 'Post-Quantum Hybrid Crypto', ['protect.disclosure'], 2, 'rare', { ward: { I: 2 }, mit: ['M1041'], flags: ['pqc'] }, '+2 Confidentiality ward. Immunises this asset against “harvest now, decrypt later”.', 'Adversaries can steal encrypted data today and decrypt it once quantum computers mature. NIST has standardised ML-KEM (FIPS 203) and signature schemes (FIPS 204/205) and is planning the retirement of quantum-vulnerable algorithms (NIST IR 8547).', ['nist:fips-203', 'nist:fips-204', 'nist:ir-8547']);
aug('a.allowlist', 'Application Allowlisting', ['protect.tampering'], 2, 'uncommon', { ward: { T: 2 }, mit: ['M1038'], resists: ['T1204', 'T1059', 'T1218', 'T1047'] }, '+2 Integrity ward. Only approved code runs: counters user execution, scripting and LOLBin proxy execution.', 'The Essential Eight’s most effective strategy against commodity malware; also blunts living-off-the-land tradecraft when rules cover script hosts and proxy binaries.', ['e8:app-control', 'attack:M1038', 'attack:T1218']);
aug('a.slsa', 'SBOM + Build Provenance', ['protect.tampering'], 1, 'uncommon', { ward: { T: 1 }, mit: ['M1013', 'M1016'], resists: ['T1195'] }, '+1 Integrity ward. Counters supply-chain compromise by verifying what you build and deploy.', 'You cannot patch or contain a poisoned component you cannot find: inventories and signed provenance make that a query.', ['nist:800-218', 'attack:T1195', 'attack:M1013']);
aug('a.secureboot', 'Secure Boot & Firmware Signing', ['protect.tampering'], 1, 'uncommon', { mit: ['M1046'], resists: ['T1542', 'T1495'] }, 'Counters pre-OS boot implants and firmware corruption.', 'Boot integrity extends trust from silicon up; bootkits and firmware implants survive reinstalls.', ['attack:M1046', 'attack:T1542']);
aug('a.cdn', 'Anycast CDN & DDoS Scrubbing', ['protect.dos'], 2, 'uncommon', { ward: { D: 2 }, mit: ['M1037'], resists: ['T1498'] }, '+2 Availability ward. Counters volumetric network denial of service.', 'Absorb floods upstream where capacity is cheap; protect the origin by only accepting traffic from the edge.', ['attack:M1037', 'attack:T1498']);
aug('a.autoscale', 'Autoscaling & Graceful Degradation', ['protect.dos'], 1, 'common', { ward: { D: 1 }, flags: ['regen1'] }, '+1 Availability ward. The asset recovers 1 integrity at the start of each round.', 'Designing for partial failure keeps core functions up while capacity returns.', ['nist-csf:PR.IR-04', 'nist-800-53:SC-5']);
aug('a.worm-logs', 'WORM Log Storage', ['protect.repudiation'], 1, 'uncommon', { ward: { R: 1 }, mit: ['M1029'], resists: ['T1070', 'T1685.005'] }, '+1 Non-repudiation ward. Counters indicator removal and event-log clearing.', 'Write-once, off-host logging makes evidence deletion an alert instead of a cover-up.', ['attack:M1029', 'attack:T1070']);
aug('a.edr-telemetry', 'EDR Telemetry', ['detect.*'], 1, 'common', { detectStr: 1 }, '+1 detection strength on this monitor.', 'Richer telemetry raises the signal-to-noise ratio of every analytic that sits on top.', ['attack:M1049', 'nist-csf:DE.CM-09']);
aug('a.sigma', 'Detection-as-Code (Sigma)', ['detect.*'], 1, 'uncommon', { detectStr: 1, flags: ['sigma'] }, '+1 detection strength. Footholds created through execution techniques here get 1 less stealth.', 'Treat detections like software: version them, test them against ATT&CK-mapped emulations, and share them as Sigma rules.', ['attack:TA0002', 'nist-csf:DE.AE-02']);
aug('a.hunt', 'Hypothesis-Driven Hunting', ['detect.*'], 2, 'uncommon', { detectN: 1 }, 'This monitor reveals 1 additional foothold each round.', 'Human-led hunting finds the activity your rules were never written for.', ['nist-csf:DE.AE-02', 'attack:TA0043']);
aug('a.ueba', 'UEBA Baselines', ['detect.spoofing', 'detect.elevation'], 1, 'uncommon', { detectStr: 1, privBonus: 1 }, '+1 detection strength, +1 more against privileged footholds.', 'Behavioural baselines catch valid-account abuse that signature matching cannot.', ['attack:T1078', 'd3fend:UserGeolocationLogonPatternAnalysis']);
aug('a.honeytoken', 'Canary Tokens & Honeytokens', ['detect.*'], 1, 'uncommon', { flags: ['canary'] }, 'The first Credential Access or Collection card the adversary plays here reveals its foothold and gives +2 Exposure.', 'Decoy credentials and files produce near-zero-false-positive alerts the moment an intruder touches them.', ['d3fend:DecoyUserCredential', 'd3fend:DecoyFile']);
aug('a.immutable-backup', 'Immutable Backups', ['recover.dos'], 1, 'common', { aegis: { revive: 2 } }, 'Your recovery control revives an asset for 2 more integrity.', 'Backups that cannot be altered or deleted by the production environment survive the ransomware that hits it.', ['e8:backups', 'attack:M1053']);
aug('a.airgap', 'Air-Gapped Vault', ['recover.dos'], 2, 'rare', { mit: ['M1053'], resists: ['T1490', 'T1486', 'T1485', 'T1561'], flags: ['vault'] }, 'Counters ransomware, wipers and recovery inhibition; adjacent Strike spillover cannot reach it.', 'Offline copies sit outside the blast radius; ransomware crews delete reachable backups first (T1490).', ['attack:T1490', 'attack:M1053', 'e8:backups']);

// Fix augment fn/prop from first base
const cellOf = id => id.includes('*') ? null : id;
for (const c of cards) if (c.type === 'augment') { const b = c.base[0]; if (!b.includes('*')) { [c.fn, c.prop] = b.split('.'); } else { c.fn = b.split('.')[0]; c.prop = 'repudiation'; } }

// ── names/lessons for matrix cards come from taxonomy
for (const c of cards) if (c.cell) { const t = tax.cells[c.cell]; c.name ||= t.name; c.flavour ||= t.flavour; c.desc ||= t.desc; c.lesson ||= t.desc; c.refs ||= t.refs; }

writeFileSync(new URL('../content/core/cards.json', import.meta.url), JSON.stringify({ schema: 2, cards }, null, 1) + '\n');
const counts = cards.reduce((a, c) => (a[c.type] = (a[c.type] || 0) + 1, a), {});
console.log('cards:', cards.length, counts);
