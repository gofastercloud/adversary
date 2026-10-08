// Authoring helper: content/core/adversary-meta.json — gameplay layer on top of MITRE data.
// Traits are *interpretations* of documented behaviour (see each adversary's MITRE page and dossier).
import { writeFileSync, readFileSync } from 'node:fs';
const idx = JSON.parse(readFileSync(new URL('../data/adversaries/index.json', import.meta.url)));
const names = Object.fromEntries(idx.map(a => [a.id, a.name]));

const t = (id, name, text, spec) => ({ id, name, text, ...spec });
const M = {};
const adv = (id, o) => { if (!names[id]) throw new Error('unknown adversary ' + id); M[id] = { name: names[id], icon: 'skull', ...o }; };

// ── Tier 3: apex
adv('G1017', { tier: 3, role: 'espionage / pre-positioning', icon: 'ghost', color: '#7be0d6', motive: 'Pre-position in critical infrastructure to enable disruption in a crisis.',
  blurb: 'PRC state-sponsored actor that lives off the land inside critical-infrastructure networks, often for years, and has been assessed as pre-positioning for disruptive action against OT.',
  assessed: ['T1485'],
  traits: [
    t('prepos', 'Pre-positioning', 'Operates inside networks for long periods before acting: begins the battle with two hidden footholds.', { op: 'startFootholds', n: 2 }),
    t('lotl', 'Living off the Land', 'Prefers built-in tools (vssadmin, netsh, ntdsutil, wmic) over malware, so Execute and Stealth cards cost 1 less.', { op: 'discount', kinds: ['arm', 'evade'], n: 1 }),
    t('valid', 'Valid Accounts & Edge Devices', 'Relies on valid credentials and internet-facing devices: its footholds start harder to see.', { op: 'stealthBonus', n: 1 }),
    t('activate', 'Activation', 'When its secrecy erodes it shifts from pre-positioning to disruption and gains +1 energy.', { op: 'phase', at: 0.55, effects: [{ op: 'energyBonus', n: 1 }] })
  ], note: 'Destructive impact is an *assessed intent* (CISA AA24-038A), not an observed technique — its Strike card is marked as such.' });
adv('G0034', { tier: 3, role: 'destructive / state', icon: 'bomb', color: '#ff6b4a', motive: 'Disruption and destruction in support of Russian state objectives.',
  blurb: 'GRU-linked actor responsible for the Ukrainian grid attacks, NotPetya and numerous destructive operations; combines supply-chain access, valid accounts and wipers.',
  traits: [
    t('state', 'State Resources', 'Well-resourced and patient: +1 energy each turn.', { op: 'energyBonus', n: 1 }),
    t('wiper', 'Escalation to Destruction', 'From round 5 its Strike and Impair cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 5 }),
    t('trusted', 'Trusted Relationships', 'Abuses supply-chain and vendor trust: starts with one hidden foothold.', { op: 'startFootholds', n: 1 })
  ] });
adv('G0016', { tier: 3, role: 'espionage / state', icon: 'eye', color: '#9b8cff', motive: 'Long-term intelligence collection.',
  blurb: 'SVR-linked actor known for SolarWinds, extensive cloud and identity abuse, and exceptional operational security.',
  traits: [
    t('tradecraft', 'Operational Security', 'Exceptional tradecraft: its footholds start with +2 stealth.', { op: 'stealthBonus', n: 2 }),
    t('cloud', 'Identity Abuse', 'Targets identity and cloud tokens: ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 }),
    t('hndl', 'Strategic Collection', 'Gameplay trait: data it exfiltrates from assets without post-quantum protection becomes “quantum debt” — future decryption risk that costs Resilience after the battle.', { op: 'hndl', note: 'Illustrates the general harvest-now-decrypt-later risk for strategic collectors; not an APT29-specific finding.' })
  ] });
adv('G0032', { tier: 3, role: 'financial / state', icon: 'coins', color: '#ffd23d', motive: 'Revenue generation and espionage for the DPRK regime.',
  blurb: 'DPRK-linked group behind destructive attacks, large-scale cryptocurrency theft and long-running social-engineering campaigns such as Operation Dream Job.',
  traits: [
    t('lure', 'Targeted Lures', 'Convincing social engineering: ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 }),
    t('extort', 'Revenue Pressure', 'From round 4 its Strike cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 4 }),
    t('dual', 'Dual Mission', 'Draws one extra card per turn.', { op: 'drawBonus', n: 1 })
  ] });
adv('G0096', { tier: 3, role: 'espionage + crime', icon: 'package', color: '#ff5fa2', motive: 'State espionage alongside financially motivated intrusions.',
  blurb: 'Chinese state-sponsored actor that also conducts financially motivated operations; known for supply-chain compromise and rapid exploitation of internet-facing software.',
  traits: [
    t('exploit', 'Rapid Exploitation', 'Breach cards cost 1 less: quick to weaponise public flaws.', { op: 'discount', kinds: ['breach'], n: 1 }),
    t('dual', 'Dual Mission', 'Draws one extra card per turn.', { op: 'drawBonus', n: 1 })
  ] });
adv('G0007', { tier: 3, role: 'espionage / state', icon: 'mail-warning', color: '#ff7a5c', motive: 'Political and military intelligence collection.',
  blurb: 'GRU-linked actor known for credential harvesting, password spraying and exploiting edge devices.',
  traits: [
    t('spray', 'Password Spraying', 'Ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 }),
    t('state', 'State Resources', '+1 energy each turn.', { op: 'energyBonus', n: 1 })
  ] });
adv('G0045', { tier: 3, role: 'espionage / MSP compromise', icon: 'handshake', color: '#c77dff', motive: 'Intellectual-property theft by compromising managed service providers.', blurb: 'Chinese state-linked actor known for “Operation Cloud Hopper”: compromising managed service providers to reach their customers’ networks.',
  traits: [t('msp', 'Trusted Relationship', 'Reaches victims through their service providers: begins with one hidden foothold.', { op: 'startFootholds', n: 1 }), t('stealth', 'Patient Tradecraft', 'Footholds start with +1 stealth.', { op: 'stealthBonus', n: 1 })] });
adv('G0129', { tier: 3, role: 'espionage / state', icon: 'link', color: '#d9a441', motive: 'Intelligence collection, often via USB and phishing lures.',
  blurb: 'PRC-linked actor with a large toolset and broad targeting, frequently using phishing and removable-media propagation.',
  traits: [
    t('tools', 'Large Toolset', 'Draws one extra card per turn.', { op: 'drawBonus', n: 1 }),
    t('stealth', 'Custom Loaders', 'Footholds start with +1 stealth.', { op: 'stealthBonus', n: 1 })
  ] });
// ── Tier 2: intrusion sets
adv('G0046', { tier: 2, role: 'financial / crime', icon: 'credit-card', color: '#ffb02e', motive: 'Payment-card and financial data theft.', blurb: 'Financially motivated group known for phishing, point-of-sale malware and later ransomware affiliations.',
  traits: [t('phish', 'Phishing at Scale', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })] });
adv('G0102', { tier: 2, role: 'ransomware / crime', icon: 'lock', color: '#ff4d6d', motive: 'Big-game ransomware.', blurb: 'Cybercriminal group behind TrickBot, Ryuk and Conti: human-operated ransomware against large organisations.',
  traits: [t('bgh', 'Big-Game Hunting', 'From round 5 its Strike cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 5 }), t('arsenal', 'Commodity Arsenal', 'Credential-access cards cost 1 less.', { op: 'discount', kinds: ['creds'], n: 1 })] });
adv('G1015', { tier: 2, role: 'social engineering / crime', icon: 'phone', color: '#c77dff', motive: 'Data theft, extortion and ransomware.', blurb: 'Native-English-speaking group that social-engineers help desks, abuses MFA fatigue and SIM swapping, then pivots through cloud and SaaS.',
  traits: [t('helpdesk', 'Help-Desk Social Engineering', 'Ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 }), t('speed', 'Fast Operators', '+1 energy each turn.', { op: 'energyBonus', n: 1 })] });
adv('G0035', { tier: 2, role: 'espionage / ICS', icon: 'factory', color: '#4de1ff', motive: 'Energy-sector reconnaissance and access.', blurb: 'Long-running actor targeting energy and industrial organisations, using trusted-relationship and watering-hole access.',
  traits: [t('relationship', 'Trusted Relationships', 'Starts with one hidden foothold.', { op: 'startFootholds', n: 1 }), t('patient', 'Patient Tradecraft', 'Footholds start with +1 stealth.', { op: 'stealthBonus', n: 1 })] });
adv('G0117', { tier: 2, role: 'espionage / state', icon: 'unplug', color: '#ff9f43', motive: 'Access via VPN and edge-device exploitation.', blurb: 'Iran-linked actor that exploits VPN and other edge appliances to gain and sell access.',
  traits: [t('vpn', 'Edge-Device Exploits', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })] });
adv('G0082', { tier: 2, role: 'financial / state', icon: 'landmark', color: '#ffd23d', motive: 'Theft from banks via payment systems.', blurb: 'DPRK-linked group targeting banks and SWIFT-connected payment infrastructure.',
  traits: [t('swift', 'Payment-System Knowledge', 'Exfiltration cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 3 })] });
adv('G1057', { tier: 2, role: 'extortion / crime', icon: 'cloud-off', color: '#ff7a5c', motive: 'Data theft and extortion from SaaS and cloud platforms.', blurb: 'Data-extortion crew that abuses stolen credentials and OAuth/API access to bulk-export SaaS data.',
  traits: [t('saas', 'SaaS Bulk Export', 'Collection and Exfiltration cards cost 1 less.', { op: 'discount', kinds: ['stage', 'exfil'], n: 1 })] });
adv('G0125', { tier: 2, role: 'espionage / state', icon: 'mail', color: '#7be0d6', motive: 'Exploit public-facing servers for data theft.', blurb: 'State-sponsored actor that exploited zero-days in on-premises Exchange servers at scale.',
  traits: [t('zeroday', 'Zero-Day Exploitation', 'Breach cards cost 1 less and footholds start with +1 stealth.', { op: 'discount', kinds: ['breach'], n: 1 }), t('quiet', 'Web-Shell Persistence', 'Footholds start with +1 stealth.', { op: 'stealthBonus', n: 1 })] });
adv('G0114', { tier: 2, role: 'espionage / state', icon: 'cpu', color: '#8bd450', motive: 'Theft of semiconductor and aviation IP.', blurb: 'Actor known for patient, targeted intrusions against technology firms using stolen credentials and Cobalt Strike.',
  traits: [t('creds', 'Credential Reuse', 'Credential-access cards cost 1 less.', { op: 'discount', kinds: ['creds'], n: 1 })] });
adv('G0049', { tier: 2, role: 'espionage / state', icon: 'globe', color: '#4de1ff', motive: 'Regional intelligence collection.', blurb: 'Iran-linked actor with a broad toolset and heavy use of spearphishing and credential theft.',
  traits: [t('tools', 'Broad Toolset', 'Draws one extra card per turn.', { op: 'drawBonus', n: 1 })] });
adv('G0088', { tier: 2, role: 'destructive / ICS', icon: 'radiation', color: '#ff4d4d', motive: 'Targeting of safety instrumented systems.', blurb: 'Actor associated with the Triton/Trisis malware targeting safety instrumented systems at an industrial facility.',
  assessed: [], traits: [t('safety', 'Safety-System Focus', 'Inhibit and Impair cards cost 1 less.', { op: 'discount', kinds: ['inhibit', 'impair'], n: 1 })] });
// ── Tier 1: opportunistic / commodity
adv('G0139', { tier: 1, role: 'cryptomining / crime', icon: 'pickaxe', color: '#5eead4', motive: 'Cloud and container compromise for cryptomining.', blurb: 'Cloud-focused group that exploits exposed Docker/Kubernetes and steals cloud credentials to run cryptominers.',
  traits: [t('noisy', 'Noisy Operators', 'Footholds start with 1 less stealth.', { op: 'stealthBonus', n: -1 })] });
adv('G0106', { tier: 1, role: 'cryptomining / crime', icon: 'pickaxe', color: '#a3e635', motive: 'Cryptojacking via unpatched servers.', blurb: 'Cryptojacking group that exploits unpatched public-facing services and persists with cron jobs.',
  traits: [t('opportunist', 'Opportunist', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })] });
adv('G0092', { tier: 1, role: 'crime', icon: 'mail-warning', color: '#ff9f43', motive: 'Mass phishing, banking malware and ransomware affiliations.', blurb: 'Financially motivated actor known for large-scale phishing campaigns and distribution of banking trojans and ransomware.',
  traits: [t('mass', 'Mass Campaigns', 'Draws one extra card per turn.', { op: 'drawBonus', n: 1 })] });
adv('G0037', { tier: 1, role: 'crime', icon: 'credit-card', color: '#ffb02e', motive: 'Payment-card theft from retail and hospitality.', blurb: 'Financially motivated actor that compromises point-of-sale systems to steal card data.',
  traits: [t('pos', 'Point-of-Sale Focus', 'Collection cards cost 1 less.', { op: 'discount', kinds: ['stage'], n: 1 })] });
adv('G0091', { tier: 1, role: 'financial / crime', icon: 'landmark', color: '#38bdf8', motive: 'Theft from banks via payment and ATM systems.', blurb: 'Financially motivated group targeting banks in Eastern Europe and beyond.',
  traits: [t('bank', 'Bank Insiders’ Knowledge', 'Credential-access cards cost 1 less.', { op: 'discount', kinds: ['creds'], n: 1 })] });
adv('G0080', { tier: 1, role: 'financial / crime', icon: 'banknote', color: '#4ade80', motive: 'ATM and banking-system theft.', blurb: 'Financially motivated group known for ATM jackpotting and bank intrusions using Cobalt Strike.',
  traits: [t('atm', 'Cash-Out Focus', 'Exfiltration cards gain +1 power from round 3.', { op: 'ransomPressure', n: 1, round: 3 })] });
adv('G1004', { tier: 1, role: 'extortion / crime', icon: 'users', color: '#c77dff', motive: 'Data theft and extortion; recruits insiders.', blurb: 'Extortion group known for social engineering, SIM swapping and recruiting insiders to obtain access.',
  traits: [t('insider', 'Insider Recruitment', 'Ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 })] });
adv('G1051', { tier: 1, role: 'ransomware / crime', icon: 'lock', color: '#ff4d6d', motive: 'Ransomware and data extortion.', blurb: 'Ransomware operation with a data-leak site and an affiliate model.',
  traits: [t('leak', 'Double Extortion', 'From round 4 its Strike cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 4 })] });
adv('G1043', { tier: 1, role: 'ransomware / crime', icon: 'lock', color: '#ff7a5c', motive: 'Ransomware.', blurb: 'Ransomware group that exploits public-facing services and abuses legitimate tooling.',
  traits: [t('tools', 'Legitimate Tooling', 'Execute cards cost 1 less.', { op: 'discount', kinds: ['arm'], n: 1 })] });
adv('G1032', { tier: 1, role: 'ransomware / crime', icon: 'lock', color: '#ff6b4a', motive: 'Ransomware and data extortion.', blurb: 'Ransomware operation using valid accounts and legitimate remote tools.',
  traits: [t('valid', 'Valid Accounts', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })] });

adv('X0001', { tier: 3, role: 'supply chain / crime', icon: 'package', color: '#ff9f1c', motive: 'Credential theft at scale, monetised through ransomware and extortion partners.',
  blurb: 'Financially motivated group behind the 2026 cascade of poisoned developer and security tools (Trivy, KICS, LiteLLM, Telnyx). Each victim’s stolen secrets seed the next compromise. Not yet in ATT&CK; this profile follows vendor reporting.',
  assessed: ['T1486'],
  traits: [
    t('cascade', 'Cascading Compromise', 'Credentials stolen from one victim open the next: starts with one hidden foothold on a trusted third party.', { op: 'startFootholds', n: 1 }),
    t('harvest', 'Secret Harvesting', 'Credential Access cards cost 1 less.', { op: 'discount', kinds: ['creds'], n: 1 }),
    t('deaddrop', 'Dead-Drop C2', 'Uses public repositories as command-and-control: its footholds start harder to see.', { op: 'stealthBonus', n: 1 })
  ], note: 'Destructive impact is an *assessed* downstream step through a ransomware partner (Sophos), not observed in the TeamPCP intrusions themselves.' });

// ── Campaign-based TTX adversaries (tier set by the scenario)
const camp = (id, tier, blurb, traits = [], extra = {}) => adv(id, { tier, role: 'campaign', icon: 'flag', color: '#f5c542', motive: 'Replay of a documented campaign.', blurb, traits, ...extra });
camp('C0025', 3, 'Documented December 2016 attack on Ukrainian electric power: Industroyer-style manipulation of substation protocols.', [t('ics', 'ICS Protocol Knowledge', 'Impair cards cost 1 less.', { op: 'discount', kinds: ['impair'], n: 1 })]);
camp('C0028', 3, 'Documented December 2015 attack on Ukrainian distribution utilities: remote HMI control and breaker opening.', [t('remote', 'Remote Operation', 'Starts with one hidden foothold.', { op: 'startFootholds', n: 1 })]);
camp('C0030', 3, 'Documented 2017 attack that compromised a safety instrumented system at an industrial plant.', [t('sis', 'Safety-System Focus', 'Inhibit cards cost 1 less.', { op: 'discount', kinds: ['inhibit'], n: 1 })]);
camp('C0024', 3, 'SolarWinds Compromise (2019–2021): a software supply-chain intrusion that enabled access to many downstream victims.', [t('trojan', 'Trojanised Update', 'Starts with one hidden foothold.', { op: 'startFootholds', n: 1 }), t('oper', 'Operational Security', 'Footholds start with +1 stealth.', { op: 'stealthBonus', n: 1 })]);
camp('C0034', 2, 'Documented 2022 attack on Ukrainian electric power using Industroyer2 and wipers.', [t('wipe', 'Destructive Payload', 'From round 5 its Strike cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 5 })]);
camp('C0063', 3, 'Documented 2025 wiper attacks against Polish organisations.', [t('wipe', 'Destructive Payload', 'From round 4 its Strike cards gain +1 power.', { op: 'ransomPressure', n: 1, round: 4 })]);
camp('C0057', 2, '3CX supply-chain attack (2022–2023): a trojanised desktop application used to reach downstream victims.', [t('trojan', 'Trojanised Application', 'Starts with one hidden foothold.', { op: 'startFootholds', n: 1 })]);
camp('C0029', 2, 'Cutting Edge: exploitation of edge-device zero-days (Ivanti) in 2023–2024.', [t('edge', 'Edge-Device Zero-Days', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })]);
camp('C0012', 2, 'Operation CuckooBees: long-running theft of intellectual property from technology and manufacturing firms.', [t('ip', 'IP Theft Focus', 'Exfiltration cards cost 1 less.', { op: 'discount', kinds: ['exfil'], n: 1 })]);
camp('C0059', 1, 'Salesforce data exfiltration: extortion following bulk export from SaaS tenants.', [t('saas', 'SaaS Bulk Export', 'Collection and Exfiltration cards cost 1 less.', { op: 'discount', kinds: ['stage', 'exfil'], n: 1 })]);
camp('C0058', 2, 'SharePoint ToolShell exploitation (2025): remote code execution against on-premises SharePoint.', [t('exploit', 'Server Exploitation', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })]);
camp('C0020', 1, 'Maroochy Water Breach (2000): an insider used radio-controlled equipment to release sewage in Queensland — an Australian ICS case study.', [t('insider', 'Insider Knowledge', 'Impair cards cost 1 less.', { op: 'discount', kinds: ['impair'], n: 1 })]);
camp('C0031', 2, 'Documented 2023 defacement of internet-exposed Unitronics PLCs, including at water utilities, using default credentials on exposed HMIs.', [t('default', 'Default Credentials', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 }), t('exposed', 'Internet-Exposed OT', 'Starts with one hidden foothold.', { op: 'startFootholds', n: 1 })]);
camp('C0049', 2, 'Leviathan Australian Intrusions (2022): a documented campaign against Australian targets.', [t('web', 'Web-Facing Exploitation', 'Breach cards cost 1 less.', { op: 'discount', kinds: ['breach'], n: 1 })]);
camp('C0014', 2, 'Operation Wocao (2017–2019): wide-ranging intrusions using legitimate tools and credentials.', [t('tools', 'Legitimate Tooling', 'Execute cards cost 1 less.', { op: 'discount', kinds: ['arm'], n: 1 })]);
camp('C0041', 1, 'FrostyGoop incident (2024): ICS malware manipulating Modbus on heating controllers.', [t('modbus', 'Modbus Manipulation', 'Impair cards cost 1 less.', { op: 'discount', kinds: ['impair'], n: 1 })]);
camp('C0022', 2, 'Operation Dream Job: fake job offers used to deliver malware and steal data and cryptocurrency.', [t('lure', 'Targeted Lures', 'Ignores 1 Authentication ward.', { op: 'bypass', stride: 'S', n: 1 })]);


// ── Goals (see tuning.goals). Editorial: based on each actor's documented objectives; see dossier and ATT&CK pages.
const GOAL = { X0001: 'exfil', G1017: 'preposition', G0035: 'preposition', G0034: 'disrupt', G0088: 'disrupt', C0025: 'disrupt', C0028: 'disrupt', C0034: 'disrupt', C0030: 'disrupt', C0020: 'disrupt', C0031: 'disrupt', C0041: 'disrupt',
  G0016: 'exfil', G0096: 'exfil', G0007: 'exfil', G0045: 'exfil', G0129: 'exfil', G1057: 'exfil', G0125: 'exfil', G0114: 'exfil', G0049: 'exfil', G1004: 'exfil', C0024: 'exfil', C0012: 'exfil', C0049: 'exfil', C0014: 'exfil', C0022: 'exfil', C0059: 'exfil', C0058: 'exfil', C0029: 'access',
  G0032: 'fraud', G0046: 'fraud', G0082: 'fraud', G0037: 'fraud', G0091: 'fraud', G0080: 'fraud', C0057: 'fraud',
  G0102: 'ransom', G1015: 'ransom', G0092: 'ransom', G1051: 'ransom', G1043: 'ransom', G1032: 'ransom', C0063: 'destroy',
  G0117: 'access', G0139: 'resource', G0106: 'resource' };
for (const [id, m] of Object.entries(M)) { if (!GOAL[id]) throw new Error('no goal for ' + id); m.goal = GOAL[id]; }
import { existsSync } from 'node:fs';
const balPath = new URL('./balance.json', import.meta.url);
if (existsSync(balPath)) for (const [id, b] of Object.entries(JSON.parse(readFileSync(balPath, 'utf8')).adversaryMeta || {})) if (M[id]) M[id].balance = { ...(M[id].balance || {}), ...(b.balance || b) };
writeFileSync(new URL('../content/core/adversary-meta.json', import.meta.url), JSON.stringify(M, null, 1) + '\n');
console.log('adversary meta:', Object.keys(M).length);
