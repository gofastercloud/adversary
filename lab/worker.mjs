import { parentPort } from 'node:worker_threads';
import { getContent, simBattle } from './sim.mjs';
import { playRunLab } from './agents/run.mjs';

function runMetrics(run, battles, spec) {
  const s = run.stats;
  return { won: run.phase === 'won', act: run.phase === 'won' ? 4 : run.act, battles: s.battles, points: run.result?.points || 0, doctrine: spec.doctrine, skill: spec.skill, scenario: spec.scenario, assurance: spec.assurance,
    deck: run.deck.length, relics: run.relics.length, resMax: run.res.max, killer: run.phase === 'lost' ? (run.battle?.adv?.id || null) : null, killerHow: run.phase === 'lost' ? run.battle?.result?.how : null, bl: battles.map(b => [b.adv, b.tier, b.won ? 1 : 0, b.how, b.rounds, b.resLost, b.act, b.node]),
    deckIds: run.deck.map(c => c.id + ':' + c.ml), relicIds: run.relics };
}

parentPort.on('message', async ({ id, kind, specs, planner }) => {
  try {
    if (!globalThis.__makePlanner && (planner || specs.some(s => s.skill === 'expert' || s.skill === 'lite'))) await import('./agents/planner.mjs');
    const out = [];
    for (const spec of specs) {
      const content = getContent(spec.scenario || 'enterprise', spec.overrides || null);
      if (kind === 'battle') out.push(simBattle(content, spec));
      else if (kind === 'run') { const { run, battles, picks, snaps, offers } = playRunLab(content, { seed: spec.seed, doctrine: spec.doctrine, assurance: spec.assurance ?? 1 }, { skill: spec.skill, seed: spec.seed }); const m = runMetrics(run, battles, spec); m.picks = picks.map(p => p.id); m.snaps = spec.keepSnaps ? snaps : undefined; m.offers = spec.keepOffers ? offers : undefined; out.push(m); }
    }
    parentPort.postMessage({ id, ok: true, out });
  } catch (e) { parentPort.postMessage({ id, ok: false, error: e.stack || String(e) }); }
});
