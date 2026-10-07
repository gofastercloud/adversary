// Authoring helper: generates content/core/{doctrines,relics,events,tuning}.json
import { writeFileSync } from 'node:fs';
const w = (n, o) => writeFileSync(new URL(`../content/core/${n}.json`, import.meta.url), JSON.stringify(o, null, 1) + '\n');

// ───────── Doctrines (starting archetypes) ─────────
const doctrines = [
  { id: 'architect', name: 'Zero Trust Architect', icon: 'shield-ban', blurb: 'Build walls that hold. Strong wards, layered controls and intelligence about where attackers will push.', focus: ['protect', 'identify'], maxResilience: 40, money: 60,
    power: { name: 'Harden', cost: 1, target: 'asset', fx: [{ op: 'shield', n: 2 }], text: 'Target asset gains +2 ward against everything until the end of the adversary’s turn.' },
    deck: ['c.protect.spoofing', 'c.protect.tampering', 'c.protect.elevation', 'c.protect.disclosure', 'c.protect.dos', 'c.protect.repudiation', 'c.identify.spoofing', 'c.identify.repudiation', 'c.detect.spoofing', 'c.respond.tampering', 'c.recover.dos', 'x.patch'], relic: 'r.zero-trust-seed' },
  { id: 'hunter', name: 'Threat Hunter', icon: 'radar', blurb: 'Find them early. Layered detection and swift containment turn dwell time into an adversary’s problem.', focus: ['detect', 'respond'], maxResilience: 36, money: 60, unlock: 'ach.first-evict',
    power: { name: 'Hunt', cost: 1, target: 'none', fx: [{ op: 'reveal', n: 1, str: 4 }], text: 'Reveal one hidden foothold anywhere (stealth up to 4).' },
    deck: ['c.detect.spoofing', 'c.detect.tampering', 'c.detect.repudiation', 'c.respond.spoofing', 'c.respond.tampering', 'c.respond.elevation', 'c.protect.spoofing', 'c.protect.tampering', 'c.identify.repudiation', 'c.recover.dos', 'x.threathunt', 'c.protect.elevation'], relic: 'r.mdr' },
  { id: 'phoenix', name: 'Resilience Engineer', icon: 'heart-pulse', blurb: 'Assume you will be hit and make it survivable: recovery, redundancy and graceful degradation.', focus: ['recover', 'protect'], maxResilience: 44, money: 60, unlock: 'ach.restore-hero',
    power: { name: 'Failover', cost: 1, target: 'asset', fx: [{ op: 'heal', n: 2 }], text: 'Restore 2 integrity to an asset.' },
    deck: ['c.recover.dos', 'c.recover.dos', 'c.recover.spoofing', 'c.recover.disclosure', 'c.protect.dos', 'c.protect.spoofing', 'c.protect.elevation', 'c.detect.tampering', 'c.respond.dos', 'c.identify.dos', 'c.govern.dos', 'x.patch'], relic: 'r.golden-image' },
  { id: 'governor', name: 'GRC Lead', icon: 'scale', blurb: 'Win with policy. Cheap, broad, persistent effects and a steady drumbeat of cards — slow to start, hard to stop.', focus: ['govern', 'identify'], maxResilience: 38, money: 75, unlock: 'ach.policy-wonk',
    power: { name: 'Mandate', cost: 1, target: 'none', fx: [{ op: 'draw', n: 1 }, { op: 'nextPolicyFree' }], text: 'Draw a card; your next Policy this turn costs 0.' },
    deck: ['c.govern.spoofing', 'c.govern.disclosure', 'c.govern.repudiation', 'c.govern.elevation', 'c.identify.repudiation', 'c.identify.dos', 'x.training', 'c.protect.spoofing', 'c.protect.tampering', 'c.detect.repudiation', 'c.respond.disclosure', 'c.recover.repudiation'], relic: 'r.board-sponsor' },
  { id: 'responder', name: 'Incident Commander', icon: 'siren', blurb: 'Take the hit, then take control. Contain fast, scrub clean and keep the business running.', focus: ['respond', 'recover'], maxResilience: 40, money: 60, unlock: 'ach.contain-5',
    power: { name: 'Contain', cost: 1, target: 'asset', fx: [{ op: 'isolate' }], text: 'Isolate an asset until your next turn: nothing can spread into or out of it.' },
    deck: ['c.respond.spoofing', 'c.respond.tampering', 'c.respond.dos', 'c.respond.disclosure', 'c.detect.spoofing', 'c.detect.tampering', 'c.recover.spoofing', 'c.recover.dos', 'c.protect.spoofing', 'c.protect.elevation', 'c.identify.spoofing', 'x.soar'], relic: 'r.runbooks' }
];

// ───────── Relics ─────────
const rel = (id, name, icon, rarity, hooks, desc, lesson, refs) => ({ id, name, icon, rarity, hooks, desc, lesson, refs });
const relics = [
  rel('r.zero-trust-seed', 'Zero Trust Roadmap', 'shield-ban', 'starter', { battleStart: [{ op: 'wardRandomAsset', n: 1 }] }, 'Battle start: a random asset gains a permanent +1 ward (all properties).', 'A roadmap beats a product: start by protecting the assets that matter most.', ['nist:800-207']),
  rel('r.mdr', 'Managed Detection & Response', 'cctv', 'starter', { roundStart: [{ op: 'reveal', n: 1, str: 2 }] }, 'Each round start: reveal 1 hidden foothold with stealth up to 2.', 'MDR gives smaller teams a 24×7 monitoring floor — but a floor is not a ceiling.', ['nist-csf:DE.CM-01']),
  rel('r.golden-image', 'Golden Image Pipeline', 'copy-plus', 'starter', { passive: { reviveOnce: 3 } }, 'The first asset to go down each battle is rebuilt at 3 integrity.', 'Rebuild from a known-good, signed image rather than cleaning a compromised host.', ['nist-800-53:CM-2', 'nist-csf:RC.RP-05']),
  rel('r.board-sponsor', 'Executive Sponsor', 'landmark', 'starter', { passive: { maxResilience: 6 }, battleWin: [{ op: 'money', n: 5 }] }, '+6 max Resilience. +$5 after each battle.', 'Funding and air cover from the board are the control that makes the other controls possible.', ['nist-csf:GV.RR-01']),
  rel('r.runbooks', 'IR Runbooks', 'book-open', 'starter', { passive: { discountFirst: { fn: 'respond', n: 1 } } }, 'The first Respond card you play each round costs 1 less.', 'Rehearsed runbooks make the first ten minutes of an incident boringly fast.', ['nist-csf:RS.MA-01', 'nist:800-61']),
  rel('r.threat-intel', 'Threat Intel Feed', 'radio-tower', 'common', { roundStart: [{ op: 'intel', n: 1 }] }, 'Each round start: +1 intel (see the adversary’s plans more clearly).', 'Intelligence is only valuable when it changes what you do next.', ['nist-csf:ID.RA-02', 'attack:M1019']),
  rel('r.kev', 'KEV Subscription', 'bell-ring', 'common', { passive: { firstBreachMinus: 1 } }, 'The adversary’s first Breach each battle has 1 less power.', 'Patch what is known to be exploited first; CISA’s KEV catalogue is the shortlist.', ['nist-csf:ID.RA-01', 'attack:M1051']),
  rel('r.pentest', 'Penetration Test Report', 'file-search', 'common', { battleStart: [{ op: 'intel', n: 2 }] }, 'Battle start: +2 intel.', 'A good pen test report is a map of the adversary’s likeliest path.', ['nist-800-53:CA-8']),
  rel('r.bug-bounty', 'Bug Bounty Programme', 'bug', 'common', { reveal: [{ op: 'money', n: 1 }] }, 'Gain $1 each time a foothold is revealed.', 'Pay researchers for finding flaws before adversaries do.', ['nist-csf:ID.RA-08', 'owasp:samm']),
  rel('r.soc247', '24×7 SOC', 'siren', 'uncommon', { passive: { draw: 1 } }, 'Draw 1 additional card each turn.', 'Round-the-clock coverage widens what you can see and act on.', ['nist-csf:DE.CM-01']),
  rel('r.honeynet', 'Honeynet', 'bug-play', 'uncommon', { reveal: [{ op: 'exposure', n: 1 }] }, 'Revealing a foothold also gives +1 Exposure.', 'Deception turns every adversary mistake into a detection.', ['d3fend:DecoyEnvironment']),
  rel('r.purple-budget', 'Purple Team Budget', 'swords', 'uncommon', { evict: [{ op: 'draw', n: 1 }] }, 'Draw a card each time you remove a foothold.', 'Every eviction should teach you something to feed back into detections.', ['nist-csf:ID.IM-02']),
  rel('r.siem-license', 'SIEM Licence Uplift', 'activity', 'uncommon', { passive: { detectStr: 1 } }, 'All your monitors have +1 detection strength.', 'Telemetry volume is a budget line; detection value comes from correlation.', ['nist-csf:DE.AE-03', 'nist-800-53:AU-6']),
  rel('r.crisis-comms', 'Crisis Communications Plan', 'megaphone', 'uncommon', { passive: { beaconMinus: 1 } }, 'Beacons drain 1 less Resilience each round.', 'Calm, pre-agreed communications keep an incident from becoming a second incident.', ['nist-csf:RS.CO-02']),
  rel('r.cyber-range', 'Cyber Range Training', 'graduation-cap', 'uncommon', { passive: { maxResilience: 10 } }, '+10 max Resilience.', 'Teams that have rehearsed under pressure recover faster and make fewer errors.', ['nist-csf:PR.AT']),
  rel('r.change-freeze', 'Change Freeze', 'snowflake', 'uncommon', { passive: { advTax: { tactics: ['persistence', 'defense-impairment', 'stealth'], n: 1 } } }, 'Adversary Persistence, Stealth and Defense Impairment cards cost 1 more.', 'Tight change control makes unauthorised change loud.', ['nist-800-53:CM-3']),
  rel('r.vault', 'Backup Vault Contract', 'database-backup', 'rare', { battleStart: [{ op: 'healAll', n: 1 }], passive: { strikeMinus: 1 } }, 'Strike and Impair cards deal 1 less damage. Battle start: heal all assets 1.', 'Tested, immutable backups are what turn a ransom demand into an inconvenience.', ['e8:backups', 'attack:M1053']),
  rel('r.zero-day-fund', 'Emergency Patch Fund', 'wrench', 'rare', { passive: { energy: 1 } }, '+1 energy each turn.', 'Pre-approved emergency budget removes the argument from the first hour.', ['nist-csf:GV.RR-03']),
  rel('r.resilience-board', 'Cyber Resilience Committee', 'users', 'rare', { roundStart: [{ op: 'resilience', n: 1 }] }, 'Each round start: restore 1 Resilience.', 'Resilience is governed: someone owns the impact tolerances and tests them.', ['nist-csf:GV.OV-01', 'iso27001:A.5.30'])
];

// ───────── Events ─────────
const ev = (id, title, text, choices, lesson) => ({ id, title, text, choices, lesson });
const ch = (text, fx, result, extra = {}) => ({ text, fx, result, ...extra });
const events = [
  ev('e.audit', 'Audit Finding', 'Internal audit has flagged an unmanaged exception on a critical system: a legacy service that bypasses your MFA policy.', [
    ch('Remediate now', [{ op: 'money', n: -20 }, { op: 'upgradeRandom' }], 'You pay for the fix and tighten a control while you are at it.', { lesson: 'Closing the finding removes a real path; budget it as risk reduction, not overhead.' }),
    ch('Accept the risk (document it)', [{ op: 'money', n: 15 }, { op: 'addStatus', id: 'status.techdebt' }], 'You bank the saving and sign the exception. The risk is now yours.', { lesson: 'Risk acceptance is legitimate when explicit, time-boxed and owned by someone with authority.' })
  ], 'Exceptions that nobody reviews become the attack path.'),
  ev('e.zeroday', 'Zero-Day in the VPN Appliance', 'A vendor advisory lands at 02:10: an edge appliance you run is being exploited in the wild. No patch yet.', [
    ch('Take it offline until a patch ships', [{ op: 'resilience', n: -6 }], 'Staff lose remote access for two days — painful, but nobody is in your network.', { lesson: 'When exploitation is active and no patch exists, removing exposure is the control.' }),
    ch('Apply the vendor’s mitigation and watch closely', [{ op: 'money', n: -10 }, { op: 'addCard', id: 'x.waf' }], 'You deploy virtual patching and add monitoring.', { lesson: 'Mitigations buy time; verify them and hunt for prior compromise.' }),
    ch('Leave it up — revenue first', [{ op: 'money', n: 20 }, { op: 'flag', id: 'preBreach' }], 'Nothing happens… that you can see. Your next fight starts with an intruder already inside.', { lesson: 'Known-exploited edge devices are a favourite of state actors: assume compromise if you could not patch.', refs: ['attack:T1190', 'attack:T1133'] })
  ], 'Edge devices are repeatedly exploited as initial access; ASD/CISA advisories are the early warning.'),
  ev('e.phish', 'Staff Report a Phish', 'A finance officer reported a convincing invoice email in minutes — the SOC has triaged and blocked it.', [
    ch('Publicly thank and reward them', [{ op: 'money', n: -5 }, { op: 'flag', id: 'intel1' }], 'Reporting culture strengthens. Next battle you start with extra intelligence.', { lesson: 'People who report quickly are a sensor network; punishing clicks silences it.' }),
    ch('Quietly close the ticket', [{ op: 'money', n: 5 }], 'Efficient. Also forgettable.')
  ], 'Make reporting easy, rewarded and blame-free.'),
  ev('e.vendor', 'The Silver-Bullet Pitch', 'A vendor promises an “AI-native autonomous SOC” that makes detection engineering unnecessary.', [
    ch('Buy it at list price', [{ op: 'money', n: -40 }, { op: 'addRandomCard', rarity: 'rare' }, { op: 'addStatus', id: 'status.techdebt' }], 'You get a powerful tool and an integration headache.', { lesson: 'Tools do not remove the need to engineer detections and own the outcomes.' }),
    ch('Run a scoped pilot', [{ op: 'money', n: -15 }, { op: 'upgradeRandom' }], 'The pilot sharpens an existing control and teaches your team where the gaps are.', { lesson: 'Proofs of value with success criteria beat roadmap promises.' }),
    ch('Decline politely', [{ op: 'money', n: 10 }], 'You keep the budget for people and process.')
  ], 'Evaluate tools against the techniques you actually face.'),
  ev('e.regulator', 'Regulator Information Request', 'A regulator asks for evidence of your incident notification procedure and last test.', [
    ch('Respond fully and share your last exercise report', [{ op: 'resilience', n: -3 }, { op: 'upgradeRandom' }], 'It takes your team away from the console, but the exercise findings drive real changes.', { lesson: 'Evidence of exercising is evidence of capability. In Australia obligations differ by sector — e.g. SOCI critical-infrastructure reporting and APRA CPS 234 notification.', refs: ['soci:csirp', 'apra:cps234', 'privacy:ndb'] }),
    ch('Send a minimal response', [{ op: 'money', n: 10 }, { op: 'addStatus', id: 'status.techdebt' }], 'You save effort now and create a follow-up later.')
  ], 'Know your notification clocks before the incident.'),
  ev('e.msp', 'MSP Offers “Free” Remote Access', 'Your managed service provider wants always-on, privileged remote access “to speed up tickets”, at a discount.', [
    ch('Accept — the discount is attractive', [{ op: 'money', n: 25 }, { op: 'flag', id: 'vendorFoothold' }], 'Costs fall. A third party now holds standing admin into your estate.', { lesson: 'Trusted relationships are a documented initial access path.', refs: ['attack:T1199', 'nist-csf:GV.SC-07'] }),
    ch('Insist on just-in-time, recorded sessions', [{ op: 'money', n: -10 }, { op: 'addCard', id: 'a.pam-jit' }], 'The MSP grumbles but complies.', { lesson: 'Vendor access should be time-boxed, MFA-gated and logged.' })
  ], 'Third-party access is your attack surface.'),
  ev('e.training', 'Security Awareness Week', 'You can run a company-wide awareness and phishing-simulation week.', [
    ch('Run it', [{ op: 'resilience', n: -2 }, { op: 'addCard', id: 'x.training' }], 'Productivity dips slightly; click rates drop.', { lesson: 'Training is a layer, not a wall.' }),
    ch('Skip it', [{ op: 'money', n: 10 }], 'You save the time.')
  ], 'People are controls too.'),
  ev('e.restoretest', 'Backup Restore Test', 'It is time for the quarterly restore test of your critical systems.', [
    ch('Run a full restore in a sandbox', [{ op: 'money', n: -10 }, { op: 'ifHasCard', id: 'c.recover.dos', then: [{ op: 'upgradeCard', id: 'c.recover.dos' }], else: [{ op: 'addStatus', id: 'status.techdebt' }] }], 'You find out what really works.', { lesson: 'A backup you have not restored is a hope. The test either upgrades your confidence or exposes the gap.' }),
    ch('Mark it “passed” from the dashboard', [{ op: 'money', n: 5 }, { op: 'flag', id: 'brokenBackups' }], 'The dashboard is green. Is the data?', { lesson: 'Backup success ≠ restore success.' })
  ], 'Test restoration, not just backup jobs.'),
  ev('e.bounty', 'Bug Bounty Submission', 'A researcher has reported a serious flaw in your customer portal and asks for a bounty and a public thank-you.', [
    ch('Pay and fix within a week', [{ op: 'money', n: -15 }, { op: 'removeStatus', id: 'status.techdebt' }, { op: 'relicChance', id: 'r.bug-bounty' }], 'You close the hole and build goodwill.', { lesson: 'Coordinated disclosure only works if researchers are treated well.', refs: ['nist-csf:ID.RA-08'] }),
    ch('Threaten legal action', [{ op: 'money', n: 5 }, { op: 'flag', id: 'preBreach' }], 'The researcher goes public. So does everyone else.', { lesson: 'Hostile responses push findings to the open market.' })
  ], 'Make it safe to tell you about your bugs.'),
  ev('e.merger', 'Merger: Integrate the Acquisition', 'You have acquired a smaller firm. Leadership wants the networks joined by Friday.', [
    ch('Join them now', [{ op: 'money', n: 40 }, { op: 'addStatus', id: 'status.techdebt' }, { op: 'addStatus', id: 'status.techdebt' }], 'A flat, unmapped network and two new problems.', { lesson: 'M&A inherits risk; integrate through a segmented, monitored interconnect.' }),
    ch('Phase it: segment, assess, then connect', [{ op: 'money', n: 10 }, { op: 'addCard', id: 'x.segment' }], 'Slower and safer.')
  ], 'Acquisitions import the target’s vulnerabilities.'),
  ev('e.tabletop', 'Executive Tabletop', 'The executive team agrees to a half-day tabletop on a ransomware scenario.', [
    ch('Facilitate it properly', [{ op: 'resilience', n: -2 }, { op: 'flag', id: 'intel1' }, { op: 'addCard', id: 'x.tabletop' }], 'Decision rights, comms and legal triggers all get tested.', { lesson: 'Executives who have rehearsed the decisions make them faster under pressure.', refs: ['nist:800-61', 'nist-csf:ID.IM-02'] }),
    ch('Reschedule indefinitely', [{ op: 'money', n: 5 }], 'Everyone is relieved.')
  ], 'Exercise the decisions, not just the tooling.'),
  ev('e.insider', 'Insider Tip-off', 'An anonymous message warns that a contractor has been selling access to your VPN.', [
    ch('Reset all contractor credentials and review access', [{ op: 'resilience', n: -3 }, { op: 'flag', id: 'intel1' }], 'Disruptive, but you find two dormant accounts.', { lesson: 'Dormant and shared accounts are routinely sold: valid accounts is the most reused technique.', refs: ['attack:T1078', 'attack:T1133'] }),
    ch('Ignore it — probably noise', [{ op: 'money', n: 5 }, { op: 'flag', id: 'preBreach' }], 'Quiet… for now.')
  ], 'Valid accounts are the quiet way in.')
];

const tuning = {
  schema: 2,
  battle: { handSize: 5, energy: 3, policySlots: 2, assetSlots: 3, maxRounds: 10, energyCap: 6, startResilience: 40, questions: 3 },
  adversary: {
    tiers: {
      1: { name: 'Opportunistic', exposureMax: 10, energy: [3, 3, 4, 4, 4, 5], hand: 5, powerBonus: 0, rounds: 7 },
      2: { name: 'Targeted',      exposureMax: 14, energy: [4, 4, 5, 5, 5, 6], hand: 5, powerBonus: 0, rounds: 8 },
      3: { name: 'Apex',          exposureMax: 18, energy: [5, 5, 6, 6, 7, 7], hand: 6, powerBonus: 1, rounds: 9 }
    }
  },
  assurance: [
    { id: 0, name: 'Training', note: 'Gentler adversaries. Learn the loop.', advPower: -1, advEnergy: -1, resilienceBonus: 10 },
    { id: 1, name: 'Maturity Level 1', note: 'The intended experience.', advPower: 0, advEnergy: 0, resilienceBonus: 0 },
    { id: 2, name: 'Maturity Level 2', note: 'Adversaries start with a foothold and tools.', advPower: 0, advEnergy: 0, resilienceBonus: 0, startFoothold: 1 },
    { id: 3, name: 'Maturity Level 3', note: 'Targeted, resourced, patient.', advPower: 1, advEnergy: 0, resilienceBonus: -4, startFoothold: 1 }
  ],
  rewards: { battle: [18, 24, 30], elite: [30, 40, 50], boss: [60, 80, 100], fastBonus: 10 },
  shop: { cardCost: { common: 25, uncommon: 45, rare: 75 }, relicCost: { common: 120, uncommon: 160, rare: 220 }, removeCost: 50, removeStep: 25, healCost: 40, healAmount: 12 },
  xp: { win: 250, battle: 40, achievement: { bronze: 25, silver: 60, gold: 120, platinum: 250 } },
  clearance: [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8200, 10500, 14000]
};

w('doctrines', { schema: 2, doctrines });
w('relics', { schema: 2, relics });
w('events', { schema: 2, events });
w('tuning', tuning);
console.log('doctrines', doctrines.length, 'relics', relics.length, 'events', events.length);
