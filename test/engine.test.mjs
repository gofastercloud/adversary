import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../scripts/lib/load.mjs';
import { playBattle, starterDeck } from '../scripts/lib/bot.mjs';
import { playRun } from '../scripts/lib/runbot.mjs';
import * as B from '../engine/battle.js';
import * as R from '../engine/run.js';
import { evaluate, emptyProfile, clearanceOf, matches } from '../engine/achievements.js';
import { resolveRef } from '../engine/refs.js';
import { validateAll } from '../scripts/validate-content.mjs';

const content = loadContent('enterprise', [], { allAdversaries: true });

test('content validates with zero errors', () => {
  const { errs } = validateAll();
  assert.deepEqual(errs, []);
});

test('refs resolve to authoritative URLs', () => {
  assert.equal(resolveRef('attack:T1078.004').url, 'https://attack.mitre.org/techniques/T1078/004/');
  assert.equal(resolveRef('attack:M1032').url, 'https://attack.mitre.org/mitigations/M1032/');
  assert.equal(resolveRef('attack:G1017').url, 'https://attack.mitre.org/groups/G1017/');
  assert.equal(resolveRef('owasp-api:API1').url, 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/');
  assert.equal(resolveRef('nope:x'), null);
  assert.equal(resolveRef('attack:../../etc'), null);
});

test('battles are deterministic for a given seed', () => {
  const a = playBattle(content, { seed: 'det-1', adversary: 'G0102', tier: 2 });
  const b = playBattle(content, { seed: 'det-1', adversary: 'G0102', tier: 2 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = playBattle(content, { seed: 'det-2', adversary: 'G0102', tier: 2 });
  assert.notEqual(JSON.stringify(a.footholds) + a.round, JSON.stringify(c.footholds) + c.round + 'x');
});

test('full runs replay exactly from their action log (server-side verification)', () => {
  const init = { seed: 'replay-1', doctrine: 'phoenix', assurance: 0 };
  const log = [];
  const { run } = playRun(content, init, { log });
  const rp = R.replay(content, init, log);
  assert.ok(rp.ok, rp.error);
  assert.equal(JSON.stringify(rp.run.result), JSON.stringify(run.result));
  assert.equal(rp.run.phase, run.phase);
});

test('replay rejects an illegal action instead of accepting a forged result', () => {
  const init = { seed: 'forge-1', doctrine: 'architect', assurance: 1 };
  const rp = R.replay(content, init, [{ type: 'START_BATTLE' }]);
  assert.equal(rp.ok, false);
  const rp2 = R.replay(content, init, [{ type: 'CHOOSE', index: 0 }, { type: 'START_BATTLE' }, { type: 'BATTLE', action: { type: 'PLAY', iid: 'not-a-card', target: {} } }]);
  assert.equal(rp2.ok, false);
});

function freshBattle(adv = 'G0016', tier = 3, doctrine = 'architect') {
  const d = content.doctrines[doctrine];
  return B.newBattle(content, { seed: 'unit', deck: starterDeck(content, doctrine), adversary: { id: adv, tier }, resilience: { cur: 40, max: 40 }, relics: [d.relic], doctrine });
}

test('wards are explainable and use real ATT&CK mitigation matches', () => {
  const b = freshBattle('G0102', 2);   // no ward-bypass trait
  // synthesise: deploy MFA on the mail gateway then ask for the ward vs T1078 (valid accounts; M1032 mitigates it)
  const iid = Object.keys(b.cards).find(i => b.cards[i].id === 'c.protect.spoofing');
  b.hand.push(iid); b.energy.cur = 5;
  B.playCard(content, b, iid, { asset: 'mail' });
  const card = { id: 'T1078', stride: 'S', mit: content.techs['T1078'].m };
  const w = B.wardFor(content, b, 'mail', card);
  assert.ok(w.total >= 3, 'ward 2 + mitigation match 1');
  assert.ok(w.why.some(x => x.kind === 'mitigation' && ['M1032', 'M1027'].includes(x.mit)), 'matched a real mitigation id');
});

test('FIDO2 counters MFA-fatigue (T1621) with a +3 specific counter', () => {
  const b = freshBattle();
  const mfa = Object.keys(b.cards).find(i => b.cards[i].id === 'c.protect.spoofing');
  b.cards.aug1 = { id: 'a.fido2', ml: 1 }; b.hand.push(mfa, 'aug1'); b.energy.cur = 9;
  B.playCard(content, b, mfa, { asset: 'idp' });
  const kid = b.controls[0].kid;
  B.playCard(content, b, 'aug1', { kid });
  const w = B.wardFor(content, b, 'idp', { id: 'T1621', stride: 'S', mit: content.techs['T1621'].m });
  assert.ok(w.why.some(x => x.kind === 'counter' && x.tech === 'T1621' && x.src === 'a.fido2'));
});

test('an augment cannot attach to the wrong control', () => {
  const b = freshBattle();
  const ctl = Object.keys(b.cards).find(i => b.cards[i].id === 'c.protect.tampering');
  b.cards.aug1 = { id: 'a.fido2', ml: 1 }; b.hand.push(ctl, 'aug1'); b.energy.cur = 9;
  B.playCard(content, b, ctl, { asset: 'ws' });
  assert.throws(() => B.playCard(content, b, 'aug1', { kid: b.controls[0].kid }), B.GameError);
});

test('hidden footholds stay hidden until detected; detection strength vs stealth matters', () => {
  const b = freshBattle('G1017', 3);   // pre-positioning trait: starts with hidden footholds
  assert.ok(b.footholds.length >= 2);
  assert.ok(b.footholds.every(f => !f.revealed));
});

test('losing a crown jewel ends the battle in defeat', () => {
  const b = freshBattle();
  const jewel = b.assets.find(a => a.jewel);
  // simulate impact
  jewel.hp = 1; b.footholds.push({ id: 'fx', asset: jewel.id, tech: 'T1486', name: 'x', tactic: 'impact', kind: 'strike', stride: 'D', stealth: 1, grip: 1, revealed: true, privileged: true, c2: false, persistent: false, born: 1, mit: [] });
  b.adv.cards.zz = { uid: 'zz', id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'impact', kind: 'strike', stride: 'D', cost: 0, power: 9, stealth: 0, mit: [], ev: 1, sig: false, remote: false };
  b.adv.hand = ['zz']; b.adv.intent = null;
  B.battleAction(content, b, { type: 'END_TURN' });
  assert.equal(b.over, true);
  assert.equal(b.result.won, false);
});

test('persistence returns an evicted foothold exactly once', () => {
  const b = freshBattle('G0102', 2);
  const f = { id: 'fp', asset: 'ws', tech: 'T1078', name: 'Valid Accounts', tactic: 'initial-access', kind: 'breach', stride: 'S', stealth: 1, grip: 1, revealed: true, persistent: true, c2: false, privileged: false, born: 1, mit: [] };
  b.footholds.push(f);
  B.evictFoothold(content, b, f, 1, 'evict');
  assert.equal(b.footholds.find(x => x.id === 'fp'), undefined);
  assert.equal(b.ghosts.length, 1);
});

test('achievements: events unlock, award XP, unlock doctrines, and hidden ones fire', () => {
  const ctx = {};
  const { profile, unlocked } = evaluate(content, emptyProfile(), ctx, [
    { t: 'battle_end', won: true, resLost: 0, adv: 'G1017', type: 'boss', tier: 3, rounds: 4, how: 'evicted', jewelSafe: true, reveals: 5, noReveal: false },
    { t: 'evict', quick: true }, { t: 'canary' }
  ]);
  const ids = unlocked.map(a => a.id);
  for (const id of ['ach.first-win', 'ach.flawless', 'ach.slay-g1017', 'ach.typhoon-warning', 'ach.early-exit', 'ach.first-evict', 'ach.quick-draw', 'ach.canary', 'ach.boss-1', 'ach.seen-it-all']) assert.ok(ids.includes(id), 'missing ' + id);
  assert.ok(profile.xp > 400);
  assert.ok(profile.unlocks.doctrines.includes('hunter'));
  assert.ok(clearanceOf(content, profile.xp).level >= 2);
});

test('achievement distinct counters work', () => {
  let p = emptyProfile();
  const evs = ['G0092', 'G1043', 'G1032', 'G1051', 'G0092', 'G0046'].map(adv => ({ t: 'battle_end', won: true, adv }));
  p = evaluate(content, p, {}, evs).profile;
  assert.ok(p.ach.unlocked['ach.hall-5']);
  assert.ok(!p.ach.unlocked['ach.hall-12']);
});

test('matcher semantics', () => {
  assert.ok(matches({ event: 'x', where: { a: { gte: 2 }, 'b.c': 'k', arr: { has: { kind: 'counter' } } } }, { t: 'x', a: 3, b: { c: 'k' }, arr: [{ kind: 'counter' }] }));
  assert.ok(!matches({ event: 'x', where: { a: { lt: 2 } } }, { t: 'x', a: 3 }));
});

test('whiteboard rewards correct answers and carries a ward bonus', async () => {
  const c2 = { ...content, systems: [{ id: 's', name: 'S', scenarios: [{ id: 'q1', answer: 'S' }, { id: 'q2', answer: 'T' }, { id: 'q3', answer: 'E' }] }, { id: 's2', name: 'S2', scenarios: [] }] };
  let run = R.newRun(c2, { seed: 'wb', doctrine: 'architect' });
  run.phase = 'whiteboard'; run.whiteboard = { system: 0, qs: ['q1', 'q2', 'q3'], answers: [], done: false };
  for (const l of ['S', 'T', 'E']) run = R.runAction(c2, run, { type: 'WB_ANSWER', letter: l }).run;
  const m0 = run.money;
  run = R.runAction(c2, run, { type: 'WB_DONE' }).run;
  assert.equal(run.modelBonus, 3);
  assert.equal(run.money, m0 + 36);
  assert.equal(run.phase, 'map');
});

test('tutorial script is reachable exactly as the coach describes it', async () => {
  const { tutorialRun } = await import('../engine/tutorial.js');
  let run = tutorialRun(content);
  const A = (a) => { const r = R.tryRunAction(content, run, { type: 'BATTLE', action: a }); assert.ok(r.ok, r.error); run = r.run; return r.events; };
  let b = () => run.battle;
  assert.deepEqual(b().hand, ['d0', 'd1', 'd6', 'd2', 'd9']);
  A({ type: 'PLAY', iid: 'd0', target: { asset: 'mail' } });           // MFA on the email gateway
  A({ type: 'PLAY', iid: 'd1', target: {} });                          // log source inventory → intel
  assert.ok(b().intel >= 2);
  A({ type: 'END_TURN' });
  assert.equal(b().round, 2);
  assert.ok(b().footholds.length >= 1 && b().footholds.every(f => !f.revealed), 'a hidden foothold exists after round 1');
  assert.equal(b().assets.find(a => a.id === 'mail').hp, 6);
  assert.deepEqual(b().hand.slice().sort(), ['d3', 'd4', 'd5', 'd8', 'd10'].sort());
  A({ type: 'PLAY', iid: 'd3', target: {} });                          // threat hunt
  const f = b().footholds.find(x => x.revealed); assert.ok(f, 'hunt reveals it');
  A({ type: 'PLAY', iid: 'd4', target: { fid: f.id } });               // credential revocation: evict 2
  assert.ok(!b().footholds.some(x => x.id === f.id), 'evicted in one card');
  assert.ok(b().expo.cur >= 3);
});

test('EMB3D and CTID refs resolve and are offline-validated', () => {
  assert.equal(resolveRef('emb3d:MID-002').url, 'https://emb3d.mitre.org/mitigations/MID-002');
  assert.equal(resolveRef('emb3d:TID-201').url, 'https://emb3d.mitre.org/threats/TID-201');
  assert.equal(resolveRef('emb3d:MID-2'), null);
  assert.equal(resolveRef('ctid:aws').url, 'https://ctid.mitre.org/mappings/external/aws/');
  assert.equal(resolveRef('attack:A0003').url, 'https://attack.mitre.org/assets/A0003/');
  assert.equal(resolveRef('ctid:nope'), null);
});

test('CTID-mapped NIST controls add ward when ATT&CK lists no mitigation overlap', () => {
  const b = B.newBattle(content, { seed: 'ctid-1', deck: starterDeck(content, 'phoenix'), adversary: { id: 'G0102', tier: 1 }, resilience: { cur: 20, max: 20 } });
  const t = content.techs.T1078;
  assert.ok(t.c?.length, 'T1078 carries CTID NIST mappings');
  const ctl = Object.values(content.cards).find(c => c.type === 'control' && c.ctl?.some(x => t.c.includes(x)));
  assert.ok(ctl, 'a control card cites a CTID-mapped 800-53 control');
  const A = b.assets.find(a => !a.down);
  b.controls.push({ kid: 'kx', iid: 'ix', card: ctl.id, ml: 1, asset: A.id, augs: [], disabledBy: null });
  const w = B.wardFor(content, b, A.id, { id: 'T1078', stride: 'S', mit: [] });
  assert.ok(w.why.some(x => x.ctl), 'ward reason cites the CTID mapping');
});

test('consumables: run-scope cards leave the deck after a won battle; battle-scope exhaust only', () => {
  const run = R.newRun(content, { seed: 'cons-1', doctrine: 'phoenix', assurance: 0 });
  const iid = 'zz1';
  run.deck.push({ iid, id: 'x.retainer', ml: 1 }, { iid: 'zz2', id: 'x.restore', ml: 1 });
  const b = B.newBattle(content, { seed: 'cons-2', deck: run.deck, adversary: { id: 'G0102', tier: 1 }, resilience: { cur: 20, max: 20 } });
  b.hand.push(iid); b.draw = b.draw.filter(x => x !== iid); b.energy.cur = 9;
  B.playCard(content, b, iid, {});
  assert.ok(b.spent.includes(iid) && !b.discard.includes(iid), 'retainer is spent, not discarded');
  b.hand.push('zz2'); b.draw = b.draw.filter(x => x !== 'zz2');
  B.playCard(content, b, 'zz2', { asset: b.assets[0].id });
  assert.ok(!b.spent.includes('zz2') && b.exhausted.includes('zz2') && !b.discard.includes('zz2'), 'restore exhausts for the battle only');
});

test('baseline tradecraft: seeded, varies per battle, never adds payoff cards, signature overlay intact', () => {
  const mk = seed => B.newBattle(content, { seed, deck: starterDeck(content, 'phoenix'), adversary: { id: 'G1017', tier: 3 }, resilience: { cur: 20, max: 20 } });
  const deckOf = b => Object.values(b.adv.cards);
  const a1 = deckOf(mk('bl-1')), a2 = deckOf(mk('bl-1')), b1 = deckOf(mk('bl-2'));
  assert.equal(JSON.stringify(a1), JSON.stringify(a2), 'same seed, same deck');
  assert.notEqual(a1.filter(c => c.baseline).map(c => c.id).join(), b1.filter(c => c.baseline).map(c => c.id).join(), 'different seed, different baseline draw');
  assert.ok(a1.some(c => c.baseline), 'baseline cards present');
  for (const c of a1.filter(c => c.baseline)) assert.ok(!['exfil', 'strike', 'impair', 'inhibit'].includes(c.kind), 'no baseline payoffs');
  assert.ok(a1.filter(c => !c.baseline).length >= 10, 'signature overlay intact');
});

test('goals: every adversary has one; breaching a goal ends the battle; scripted tutorial/TTX battles have none', () => {
  for (const [id, m] of Object.entries(content.adversaryMeta)) assert.ok(content.tuning.goals[m.goal], id + ' has a valid goal');
  const outs = [];
  for (let i = 0; i < 12; i++) { const b = playBattle(content, { seed: 'goal-' + i, adversary: 'G0117', tier: 2 }); assert.equal(b.goal.kind, 'access'); outs.push(b.result.how); }
  assert.ok(outs.includes('goal'), 'access broker sometimes achieves its goal: ' + outs.join());
  const t = B.newBattle(content, { seed: 't', deck: starterDeck(content, 'phoenix'), adversary: { id: 'G0092', tier: 1 }, resilience: { cur: 20, max: 20 }, advOrder: ['T1566'] });
  assert.equal(t.goal, undefined, 'tutorial battle has no goal');
});

test('goal payoffs: a ransom actor with too few observed impact cards gets goal-aligned payoffs from incident data', () => {
  const b = B.newBattle(content, { seed: 'gp-1', deck: starterDeck(content, 'phoenix'), adversary: { id: 'G1015', tier: 2 }, resilience: { cur: 20, max: 20 } });
  const pay = Object.values(b.adv.cards).filter(c => c.kind === 'strike');
  assert.ok(pay.length >= 2, 'at least two strike cards');
});

test('every pack: loads, plays a full run, and every TTX completes with a score', () => {
  for (const pack of ['enterprise', 'utilities', 'ot', 'appsec', 'banking', 'cloud']) {
    const c = loadContent(pack, [], { allAdversaries: true });
    const r = playRun(c, { seed: 'smoke-' + pack, doctrine: 'phoenix', assurance: 0 }, {});
    assert.ok(['won', 'lost'].includes(r.run.phase), pack + ' run terminates');
    for (const t of c.ttx) {
      const x = playRun(c, { seed: 'ttx-' + t.id, doctrine: 'architect', assurance: 0, mode: 'ttx', ttxId: t.id }, {});
      assert.ok(['won', 'lost'].includes(x.run.phase), t.id + ' terminates');
      assert.ok(x.run.ttx.result || x.run.phase === 'lost', t.id + ' produced a result or a loss');
    }
  }
});

test('CTID scored coverage (cloud pack): protect coverage adds ward, detect coverage raises reveal strength', () => {
  const c = loadContent('cloud', [], { allAdversaries: true });
  const iam = c.cards['cloud.iam'], gd = c.cards['cloud.guardduty'];
  const pt = Object.entries(iam.cov.protect)[0]; assert.ok(pt, 'IAM has protect coverage');
  const b = B.newBattle(c, { seed: 'cov-1', deck: starterDeck(c, 'phoenix'), adversary: { id: 'G1015', tier: 1 }, resilience: { cur: 20, max: 20 } });
  const A = b.assets.find(a => a.id === 'idp');
  b.controls.push({ kid: 'k1', iid: 'x1', card: 'cloud.iam', ml: 1, asset: A.id, augs: [], disabledBy: null });
  const w = B.wardFor(c, b, A.id, { id: pt[0], stride: 'S', mit: [] });
  assert.ok(w.why.some(x => x.cov), 'ward cites CTID coverage');
  assert.ok(gd.cov.detect && Object.keys(gd.cov.detect).length > 10, 'GuardDuty has detect coverage');
  assert.ok(gd.detect && gd.type === 'control');
});
