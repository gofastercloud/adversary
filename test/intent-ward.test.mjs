import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../scripts/lib/load.mjs';
import { starterDeck } from '../scripts/lib/bot.mjs';
import * as B from '../engine/battle.js';
import { intentWard } from '../web/js/intent-ward.js';

const content = loadContent('enterprise', [], { allAdversaries: true });
const doctrine = content.doctrines.architect;

function battleWithIntent(seedPrefix = 'iw') {
  for (let i = 1; i <= 60; i++) {
    const b = B.newBattle(content, { seed: `${seedPrefix}-${i}`, deck: starterDeck(content, 'architect'), adversary: { id: 'G1043', tier: 1 }, resilience: { cur: doctrine.maxResilience, max: doctrine.maxResilience }, relics: [doctrine.relic], doctrine: 'architect' });
    b.intel = 3;
    const I = B.intentView(content, b);
    if (I?.asset && ['breach', 'spread', 'strike', 'exfil', 'disable'].includes(I.kind)) return b;
  }
  throw new Error('no seed with a ward-tested intent');
}

test('no chip below intel level 3, or without a planned move', () => {
  const b = battleWithIntent();
  for (const lvl of [0, 1, 2]) {
    b.intel = lvl;
    assert.equal(intentWard(content, b, B.intentView(content, b)), null, `level ${lvl}`);
  }
  b.intel = 3;
  assert.equal(intentWard(content, b, null), null);
  b.adv.intent = null;
  assert.equal(intentWard(content, b, B.intentView(content, b)), null);
});

test('chip numbers are the engine wardFor() total and the panel power', () => {
  const b = battleWithIntent();
  b.intel = 3;
  const I = B.intentView(content, b);
  const card = b.adv.cards[b.adv.intent.uid];
  const w = B.wardFor(content, b, I.asset, card, { useCreds: card.kind === 'spread' }).total;
  const chip = intentWard(content, b, I);
  assert.ok(chip, 'chip expected at level 3');
  assert.equal(chip.asset, I.asset);
  assert.equal(chip.stride, I.stride);
  assert.equal(chip.ward, w);
  assert.equal(chip.power, I.power);
  assert.equal(chip.holds, w >= I.power);
  assert.equal(chip.long, `${I.stride} ward ${w} vs power ${I.power}`);
  assert.equal(chip.aria, `${chip.word} ward ${w} versus attack power ${I.power}: ${chip.holds ? 'holds' : 'breaks'}`);
  assert.match(chip.tip, /^.+ ward \d+ versus attack power \d+: (holds|breaks)\. /);
  assert.ok(chip.tip.endsWith(chip.holds ? 'already stops this attack.' : `Add ${chip.word} ward to this asset to block it.`));
});

test('holds when ward >= power, breaks when below; short form is ASCII', () => {
  const b = battleWithIntent();
  b.intel = 3;
  const I = B.intentView(content, b);
  const A = b.assets.find(a => a.id === I.asset);
  const card = b.adv.cards[b.adv.intent.uid];
  // baseWard is a real engine input to wardFor(); use it to put the ward exactly at, and then just below, the power
  A.baseWard = 0;
  const w0 = B.wardFor(content, b, A.id, card, { useCreds: card.kind === 'spread' }).total;
  A.baseWard = Math.max(0, I.power - w0);
  const atPower = intentWard(content, b, I);
  assert.equal(atPower.ward, Math.max(w0, I.power));
  assert.equal(atPower.holds, true);
  assert.equal(atPower.aria.endsWith(': holds'), true);
  assert.match(atPower.short, /^[A-Z] \d+>=\d+$/);
  if (I.power > 0) {
    A.baseWard = 0;
    const below = intentWard(content, b, I);
    assert.equal(below.holds, w0 >= I.power);
    assert.equal(below.aria.endsWith(below.holds ? ': holds' : ': breaks'), true);
    assert.match(below.short, /^[A-Z] \d+(<|>=)\d+$/);
  }
});

test('non-ward kinds never get a chip', () => {
  const b = battleWithIntent();
  b.intel = 3;
  const I = B.intentView(content, b);
  for (const kind of ['prep', 'arm', 'persist', 'evade', 'map', 'stage', 'beacon', 'creds']) {
    assert.equal(intentWard(content, b, { ...I, kind }), null, kind);
  }
});
