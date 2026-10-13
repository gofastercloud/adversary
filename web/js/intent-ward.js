// Ward-vs-power read-out for the telegraphed move (design review S3). Pure: no DOM, no RNG, no state writes.
// The ward is the engine's own wardFor(), called the way scoreOption() and resolveAdv() call it. The power is the card
// power the intent panel already shows at intel level 3 (intentView), which is the same number the panel displays.
import { wardFor } from '../../engine/battle.js';

export const STRIDE_WORD = { S: 'Spoofing', T: 'Tampering', R: 'Repudiation', I: 'Information disclosure', D: 'Denial of service', E: 'Elevation of privilege' };

// Intent kinds that meet the asset's ward in resolveAdv(). prep, arm, persist, evade, map, stage and beacon never do.
// creds is left out: against identity assets it reduces damage rather than blocking, so holds/breaks would mislead.
const WARD_KINDS = new Set(['breach', 'escalate', 'disable', 'spread', 'exfil', 'strike', 'impair', 'inhibit']);

/**
 * Returns the chip model for the targeted asset, or null. Needs intel level 3: the target asset (shown from level 2)
 * and the STRIDE class and power (shown from level 3) must both be on the intent panel already.
 * `intent` is the B.intentView() result.
 */
export function intentWard(content, b, intent) {
  if (!intent || intent.level < 3 || !intent.asset || !WARD_KINDS.has(intent.kind) || !STRIDE_WORD[intent.stride] || !b.adv.intent) return null;
  const card = b.adv.cards[b.adv.intent.uid];
  const ward = wardFor(content, b, intent.asset, card, { useCreds: card.kind === 'spread' }).total;
  const power = intent.power;
  const holds = ward >= power;
  const s = intent.stride, word = STRIDE_WORD[s], state = holds ? 'holds' : 'breaks';
  const aria = `${word} ward ${ward} versus attack power ${power}: ${state}`;
  return {
    asset: intent.asset, stride: s, word, ward, power, holds,
    long: `${s} ward ${ward} vs power ${power}`,
    short: `${s} ${ward}${holds ? '>=' : '<'}${power}`,
    aria,
    tip: `${aria}. ${holds ? `Your ${word} ward already stops this attack.` : `Add ${word} ward to this asset to block it.`}`
  };
}
