// Authoring helper: content/core/achievements.json
// rule = { event, where?, scope:'lifetime'|'run', gte?, sum? } — see engine/achievements.js
import { writeFileSync, readFileSync } from 'node:fs';
const meta = JSON.parse(readFileSync(new URL('../content/core/adversary-meta.json', import.meta.url)));
const A = [];
let order = 0;
const a = (id, cat, tier, icon, name, desc, rule, o = {}) => A.push({ id: 'ach.' + id, cat, tier, icon, name, desc, rule: { scope: 'lifetime', ...rule }, order: order++, ...o });
const L = (event, where, gte = 1, extra = {}) => ({ event, where, gte, ...extra });
const hidden = { hidden: true };

// ───────────── Combat
a('first-win', 'Combat', 'bronze', 'shield-check', 'First Containment', 'Win your first battle.', L('battle_end', { won: true }));
a('first-evict', 'Combat', 'bronze', 'door-closed', 'Eviction Notice', 'Remove your first foothold.', L('evict'), { unlocks: [{ doctrine: 'hunter' }], reward: 'Unlocks the Threat Hunter doctrine.' });
a('quick-draw', 'Combat', 'bronze', 'zap', 'Quick Draw', 'Evict a foothold in the same round you revealed it.', L('evict', { quick: true }), { lesson: 'Mean time to respond starts when you detect. Rehearse the first move.', refs: ['nist-csf:RS.MA-01'] });
a('contain-5', 'Combat', 'bronze', 'fence', 'Containment Specialist', 'Isolate assets 5 times.', L('isolate', {}, 5), { unlocks: [{ doctrine: 'responder' }], reward: 'Unlocks the Incident Commander doctrine.' });
a('evict-25', 'Combat', 'silver', 'door-open', 'Persistent Housekeeping', 'Remove 25 footholds.', L('evict', {}, 25));
a('evict-100', 'Combat', 'gold', 'skull', 'Threat Hunter', 'Remove 100 footholds.', L('evict', {}, 100), { lesson: 'Dwell time is the metric adversaries fear most.', refs: ['nist-csf:DE.AE-02'] });
a('block-25', 'Combat', 'bronze', 'shield', 'Wall of Wards', 'Block 25 adversary plays.', L('blocked', {}, 25));
a('block-150', 'Combat', 'silver', 'shield-half', 'Bastion', 'Block 150 adversary plays.', L('blocked', {}, 150));
a('block-600', 'Combat', 'gold', 'castle', 'Fortress', 'Block 600 adversary plays.', L('blocked', {}, 600));
a('flawless', 'Combat', 'silver', 'sparkles', 'Flawless', 'Win a battle without losing any Resilience.', L('battle_end', { won: true, resLost: 0 }));
a('untouchable', 'Combat', 'gold', 'gem', 'Untouchable', 'Win 10 battles without losing any Resilience.', L('battle_end', { won: true, resLost: 0 }, 10));
a('early-exit', 'Combat', 'silver', 'timer', 'Early Exit', 'Evict an adversary before round 5.', L('battle_end', { how: 'evicted', rounds: { lt: 5 } }), { lesson: 'Reducing dwell time reduces blast radius.', refs: ['nist-csf:DE.CM-01'] });
a('last-stand', 'Combat', 'silver', 'heart-pulse', 'Last Stand', 'Win a battle with 5 or fewer Resilience left.', L('battle_end', { won: true, resEnd: { lte: 5 } }));
a('seen-it-all', 'Combat', 'silver', 'eye', 'Full Visibility', 'Reveal 4 or more footholds in a single battle.', L('battle_end', { reveals: { gte: 4 } }), { lesson: 'You cannot respond to what you cannot see.', refs: ['nist-csf:DE.CM-01'] });
a('sandbagged', 'Combat', 'bronze', 'bomb', 'Collateral Damage', 'Lose an asset in battle (and live to tell the tale).', L('asset_down'));
a('data-guard', 'Combat', 'silver', 'database', 'Crown Jewels Intact', 'Win 10 battles without a crown-jewel asset going down.', L('battle_end', { won: true, jewelSafe: true }, 10));

// ───────────── Controls & deck
a('first-deploy', 'Controls', 'bronze', 'package-check', 'Defence in Depth, Layer One', 'Deploy your first control.', L('deploy'));
a('fido-wins', 'Controls', 'silver', 'fingerprint', 'Phishing-Resistant', 'Have FIDO2 passkeys negate MFA fatigue (T1621).', L('blocked', { why: { has: { kind: 'counter', tech: 'T1621' } } }), { lesson: 'Plain push MFA fails to MFA-request generation; number matching and FIDO2 do not.', refs: ['attack:T1621', 'attack:M1032'] });
a('allowlist-ace', 'Controls', 'silver', 'package-check', 'Allowlist Ace', 'Block user execution or scripting with application allowlisting.', L('blocked', { why: { has: { kind: 'counter', src: 'a.allowlist' } } }), { lesson: 'Application control is the Essential Eight’s most effective mitigation against commodity malware.', refs: ['e8:app-control'] });
a('credguard', 'Controls', 'silver', 'lock-keyhole', 'No Dumping', 'Stop OS credential dumping with Credential Guard.', L('blocked', { why: { has: { kind: 'counter', tech: 'T1003' } } }), { refs: ['attack:T1003', 'attack:M1043'] });
a('vault-wins', 'Controls', 'gold', 'database-backup', 'Ransomware, Meet Offline Backups', 'Have an air-gapped vault counter recovery inhibition or ransomware.', L('blocked', { why: { has: { kind: 'counter', src: 'a.airgap' } } }), { lesson: 'Ransomware operators delete reachable backups first (T1490). Offline copies sit outside the blast radius.', refs: ['attack:T1490', 'e8:backups'] });
a('full-stack', 'Controls', 'gold', 'layers', 'Full Stack', 'Play controls of all six STRIDE properties in one battle.', L('battle_end', { propsPlayed: { keys: 6 } }), { lesson: 'STRIDE is a checklist: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.', refs: ['stride:overview'] });
a('all-functions', 'Controls', 'gold', 'route', 'Full Lifecycle', 'Play cards of all six CSF functions in one battle.', L('battle_end', { fnsPlayed: { keys: 6 } }), { refs: ['nist-csf:overview'] });
a('augmented', 'Controls', 'bronze', 'wand-sparkles', 'Augmented Reality', 'Attach 5 augments to controls.', L('augment', {}, 5));
a('augmented-more', 'Controls', 'silver', 'sparkles', 'Hardened', 'Attach 40 augments to controls.', L('augment', {}, 40));
a('pqc-ready', 'Controls', 'gold', 'atom', 'Quantum Ready', 'Protect an asset with post-quantum hybrid crypto when the adversary tries to steal its data.', L('exfil_pqc'), { hidden: true, lesson: 'Harvest-now-decrypt-later makes today’s encrypted theft tomorrow’s plaintext. NIST has standardised ML-KEM (FIPS 203).', refs: ['nist:fips-203', 'nist:ir-8547'] });
a('policy-wonk', 'Controls', 'bronze', 'scroll-text', 'Policy Wonk', 'Enact 10 policies.', L('policy', {}, 10), { unlocks: [{ doctrine: 'governor' }], reward: 'Unlocks the GRC Lead doctrine.' });
a('restore-hero', 'Controls', 'bronze', 'database-backup', 'Restore Hero', 'Restore 30 integrity across your assets.', L('heal', {}, 30, { sum: 'n' }), { unlocks: [{ doctrine: 'phoenix' }], reward: 'Unlocks the Resilience Engineer doctrine.' });
a('mature', 'Controls', 'silver', 'trending-up', 'Mature Programme', 'Raise 10 cards to a higher maturity level.', L('upgraded', {}, 10));
a('ml3-army', 'Controls', 'gold', 'award', 'Maturity Level 3', 'Finish a run with 5 or more ML3 cards.', L('run_won', { 'deck.ml3': { gte: 5 } }));
a('minimalist', 'Controls', 'gold', 'eraser', 'Minimum Viable Security', 'Win a run with 14 or fewer cards.', L('run_won', { 'deck.size': { lte: 14 } }), { lesson: 'Fewer, better controls: every unnecessary tool is attack surface.', refs: ['nist-800-53:CM-7'] });
a('specialist', 'Controls', 'gold', 'crosshair', 'Specialist', 'Win a run where 60% or more of your deck shares one CSF function.', L('run_won', { 'deck.topFnShare': { gte: 0.6 } }));
a('debt-collector', 'Controls', 'bronze', 'trash-2', 'Debt Collector', 'Decommission 5 cards.', L('card_removed', {}, 5));

// ───────────── Threat modelling
a('first-workshop', 'Threat Modelling', 'bronze', 'workflow', 'Whiteboard Warrior', 'Complete a threat-modelling workshop.', L('wb_done'));
a('stride-10', 'Threat Modelling', 'silver', 'brain', 'STRIDE Apprentice', 'Answer 10 threat-modelling scenarios correctly.', L('wb_answer', { ok: true }, 10));
a('stride-50', 'Threat Modelling', 'gold', 'microscope', 'STRIDE Master', 'Answer 50 threat-modelling scenarios correctly.', L('wb_answer', { ok: true }, 50));
a('perfect-wb', 'Threat Modelling', 'silver', 'badge-check', 'Perfect Workshop', 'Get every question right in a workshop.', L('wb_perfect'));
a('perfect-wb-5', 'Threat Modelling', 'gold', 'crown', 'Facilitator', 'Get 5 perfect workshops.', L('wb_perfect', {}, 5));
for (const [L2, nm, prop] of [['S', 'Spoofing', 'Authentication'], ['T', 'Tampering', 'Integrity'], ['R', 'Repudiation', 'Non-repudiation'], ['I', 'Information Disclosure', 'Confidentiality'], ['D', 'Denial of Service', 'Availability'], ['E', 'Elevation of Privilege', 'Authorisation']])
  a('stride-' + L2.toLowerCase(), 'Threat Modelling', 'bronze', { S: 'fingerprint', T: 'wrench', R: 'scroll-text', I: 'eye-off', D: 'zap', E: 'key-round' }[L2], `${nm} Spotter`, `Correctly identify 3 ${nm.toLowerCase()} threats (${prop}).`, L('wb_answer', { ok: true, letter: L2 }, 3));
a('stride-complete', 'Threat Modelling', 'gold', 'dices', 'Six Out of Six', 'Correctly identify every STRIDE category at least once.', { event: 'wb_answer', where: { ok: true }, gte: 1, scope: 'lifetime', distinct: 'letter', distinctGte: 6 }, { hidden: true });

// ───────────── Adversaries (generated from the roster)
const names = Object.entries(meta).filter(([k]) => k[0] === 'G');
for (const [id, m] of names) {
  const tier = m.tier;
  a('slay-' + id.toLowerCase(), 'Adversaries', tier >= 3 ? 'gold' : tier === 2 ? 'silver' : 'bronze', m.icon || 'skull', `${m.name} Down`, `Defeat ${m.name} (${id}) in battle.`, L('battle_end', { won: true, adv: id }), { adv: id, lesson: m.blurb, refs: ['attack:' + id] });
}
a('hall-5', 'Adversaries', 'bronze', 'trophy', 'Rogues’ Gallery', 'Defeat 5 different adversaries.', { event: 'battle_end', where: { won: true }, gte: 1, scope: 'lifetime', distinct: 'adv', distinctGte: 5 });
a('hall-12', 'Adversaries', 'silver', 'trophy', 'Hall of Adversaries', 'Defeat 12 different adversaries.', { event: 'battle_end', where: { won: true }, gte: 1, scope: 'lifetime', distinct: 'adv', distinctGte: 12 });
a('hall-24', 'Adversaries', 'platinum', 'trophy', 'Know Your Enemy', 'Defeat 24 different adversaries.', { event: 'battle_end', where: { won: true }, gte: 1, scope: 'lifetime', distinct: 'adv', distinctGte: 24 });
a('read-dossier', 'Adversaries', 'bronze', 'book-open', 'Read the Dossier', 'Open an adversary dossier and follow a source link.', L('dossier_view'));
a('dossier-10', 'Adversaries', 'silver', 'scroll-text', 'Analyst Reading List', 'Open 10 different dossiers.', { event: 'dossier_view', gte: 1, scope: 'lifetime', distinct: 'adv', distinctGte: 10 });
a('typhoon-warning', 'Adversaries', 'gold', 'ghost', 'Typhoon Warning', 'Defeat Volt Typhoon without losing a single crown-jewel asset.', L('battle_end', { won: true, adv: 'G1017', jewelSafe: true }), { lesson: 'Volt Typhoon lives off the land: hunting for valid-account abuse and LOLBins beats looking for malware.', refs: ['attack:G1017'] });
a('boss-1', 'Adversaries', 'silver', 'swords', 'Boss Fight', 'Defeat an apex adversary.', L('battle_end', { won: true, type: 'boss' }));
a('boss-10', 'Adversaries', 'gold', 'swords', 'Boss Hunter', 'Defeat 10 apex adversaries.', L('battle_end', { won: true, type: 'boss' }, 10));
a('elite-10', 'Adversaries', 'silver', 'target', 'Elite Hunter', 'Defeat 10 intrusion sets.', L('battle_end', { won: true, type: 'elite' }, 10));

// ───────────── TTX
a('first-ttx', 'Tabletop', 'bronze', 'clipboard-check', 'Tabletop Participant', 'Complete a tabletop exercise.', L('ttx_complete'));
a('ttx-perfect', 'Tabletop', 'gold', 'trophy', 'Exercise Director', 'Meet every objective in a tabletop exercise.', L('ttx_complete', { objectivesMet: { gte: 1 }, 'perfect': true }));
a('best-decisions', 'Tabletop', 'silver', 'scale', 'Sound Judgement', 'Make 10 best-practice decisions during injects.', L('decision', { quality: 'best' }, 10), { lesson: 'Good incident decisions come from rehearsed roles, authority and criteria.', refs: ['nist:800-61'] });
a('inject-20', 'Tabletop', 'bronze', 'megaphone', 'Injected', 'Respond to 20 scenario injects.', L('inject', {}, 20));

// ───────────── Runs
a('act1', 'Runs', 'bronze', 'flag', 'Act I Cleared', 'Complete Act I.', L('act_cleared', { act: 1 }));
a('act2', 'Runs', 'silver', 'flag', 'Act II Cleared', 'Complete Act II.', L('act_cleared', { act: 2 }));
a('act3', 'Runs', 'gold', 'flag-triangle-right', 'Act III Cleared', 'Complete Act III.', L('act_cleared', { act: 3 }));
a('win-1', 'Runs', 'gold', 'trophy', 'Campaign Won', 'Win a run.', L('run_won'));
a('win-5', 'Runs', 'platinum', 'crown', 'Seasoned Defender', 'Win 5 runs.', L('run_won', {}, 5));
a('win-ml2', 'Runs', 'gold', 'award', 'Maturity Level 2', 'Win a run at Maturity Level 2.', L('run_won', { assurance: { gte: 2 } }));
a('win-ml3', 'Runs', 'platinum', 'gem', 'Maturity Level 3', 'Win a run at Maturity Level 3.', L('run_won', { assurance: 3 }));
for (const [d, n] of [['architect', 'Zero Trust Architect'], ['hunter', 'Threat Hunter'], ['phoenix', 'Resilience Engineer'], ['governor', 'GRC Lead'], ['responder', 'Incident Commander']])
  a('win-' + d, 'Runs', 'gold', content_icon(d), `${n} Ascendant`, `Win a run as the ${n}.`, L('run_won', { doctrine: d }));
function content_icon(d) { return { architect: 'shield-ban', hunter: 'radar', phoenix: 'heart-pulse', governor: 'scale', responder: 'siren' }[d]; }
a('relic-hoard', 'Runs', 'silver', 'gem', 'Capability Portfolio', 'Hold 8 relics at the end of a run.', L('run_won', { relicCount: { gte: 8 } }));
a('rich', 'Runs', 'silver', 'coins', 'Healthy Budget', 'Finish a run with $300 or more unspent.', L('run_won', { money: { gte: 300 } }));
a('daily-1', 'Runs', 'bronze', 'calendar-check', 'Daily Briefing', 'Complete a daily challenge.', L('daily_done'));
a('daily-7', 'Runs', 'gold', 'flame', 'Seven-Day Streak', 'Complete daily challenges 7 days in a row.', L('daily_done', { streak: { gte: 7 } }));
a('tutorial', 'Runs', 'bronze', 'graduation-cap', 'Orientation Complete', 'Finish the tutorial.', L('tutorial_done'));
a('clearance-5', 'Runs', 'silver', 'id-card', 'Clearance Level 5', 'Reach clearance level 5.', L('clearance', { level: { gte: 5 } }));

// ───────────── Hidden
a('canary', 'Secrets', 'silver', 'bug', 'Canary in the Coal Mine', 'Catch an adversary with a canary token.', L('canary'), hidden);
a('techdebt-3', 'Secrets', 'bronze', 'receipt', 'Interest Compounds', 'Hold 3 Technical Debt cards at once.', L('run_won', { 'deck.techdebt': { gte: 3 } }), { ...hidden, lesson: 'Risk accepted without ownership is debt with a variable rate.' });
a('monoculture', 'Secrets', 'silver', 'copy-plus', 'Monoculture', 'Finish a run with 4 or more copies of the same card.', L('run_won', { 'deck.maxDup': { gte: 4 } }), { ...hidden, lesson: 'Five identical controls fail identically: common-mode failure.' });
a('zero-day-gamble', 'Secrets', 'silver', 'dices', 'Risk Appetite', 'Leave a known-exploited edge device online.', L('event_choice', { id: 'e.zeroday', index: 2 }), { ...hidden, lesson: 'Known-exploited internet-facing services are the quietest way in.', refs: ['attack:T1190'] });
a('shiny-object', 'Secrets', 'bronze', 'sparkles', 'Shiny Object Syndrome', 'Buy the silver-bullet AI SOC.', L('event_choice', { id: 'e.vendor', index: 0 }), hidden);
a('msp-trust', 'Secrets', 'silver', 'handshake', 'Trusted Relationship', 'Accept the MSP’s “free” standing remote access.', L('event_choice', { id: 'e.msp', index: 0 }), { ...hidden, refs: ['attack:T1199'] });
a('phoenix-rises', 'Secrets', 'silver', 'flame', 'Phoenix Rises', 'Have an immutable backup revive a downed asset.', L('aegis'), hidden);
a('golden-image', 'Secrets', 'bronze', 'copy-plus', 'Rebuild, Do Not Clean', 'Trigger a revive from golden-image tooling.', L('revive'), hidden);
a('unbothered', 'Secrets', 'gold', 'leaf', 'Unbothered', 'Survive an apex adversary without revealing any footholds and without losing Resilience.', L('battle_end', { won: true, tier: 3, noReveal: true, resLost: 0 }), { ...hidden, lesson: 'Sometimes strong wards and good hygiene mean there is nothing to find.' });
a('long-game', 'Secrets', 'silver', 'hourglass', 'The Long Game', 'Survive 9 rounds against an apex adversary.', L('battle_end', { won: true, tier: 3, rounds: { gte: 9 } }), hidden);
a('quantum-debt', 'Secrets', 'bronze', 'atom', 'Harvested', 'Finish a battle with quantum debt.', L('battle_end', { debt: { gte: 1 } }), { ...hidden, lesson: 'Encrypted data stolen today may be readable tomorrow. Migrate to post-quantum cryptography.', refs: ['nist:ir-8547'] });
a('bossrush', 'Secrets', 'gold', 'rocket', 'Speed Run', 'Evict an apex adversary in 5 rounds or fewer.', L('battle_end', { won: true, how: 'evicted', tier: 3, rounds: { lte: 5 } }), hidden);
a('persist-purge', 'Secrets', 'silver', 'refresh-cw', 'Pull It Out by the Roots', 'Evict a persistent foothold and watch it return — then evict it again.', L('persists', {}, 2), { ...hidden, lesson: 'Persistence mechanisms outlive eviction. Remove the mechanism, not just the process.', refs: ['attack:TA0003'] });
a('phase-two', 'Secrets', 'bronze', 'swords', 'Phase Two', 'Push an adversary into its second phase.', L('phase'), hidden);
a('assume-breach', 'Secrets', 'silver', 'door-open', 'Assume Breach', 'Win a battle while a foothold is still hidden at the end.', L('battle_end', { won: true, how: 'survived', assetsDown: 0 }, 5), { ...hidden, lesson: 'You will not always find everyone. Make sure nothing they hold matters.' });
a('read-manual', 'Secrets', 'bronze', 'book-open', 'RTFM', 'Open the in-game guide.', L('docs_open'), hidden);
a('insider', 'Secrets', 'bronze', 'user-x', 'Insider Threat', 'Ignore the insider tip-off.', L('event_choice', { id: 'e.insider', index: 1 }), hidden);
a('all-cats', 'Secrets', 'platinum', 'gem', 'Completionist', 'Unlock 60 achievements.', { event: 'ach_unlocked', where: {}, gte: 60, scope: 'lifetime' }, hidden);

// ensure unique ids and write
const ids = new Set(); for (const x of A) { if (ids.has(x.id)) throw new Error('dup ' + x.id); ids.add(x.id); }
writeFileSync(new URL('../content/core/achievements.json', import.meta.url), JSON.stringify({ schema: 2, achievements: A }, null, 1) + '\n');
console.log('achievements:', A.length, 'hidden:', A.filter(x => x.hidden).length);
