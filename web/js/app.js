// Application controller: state, run lifecycle (deterministic save/resume), achievements, effects dispatch.
import { store, sleep } from './ui.js';
import { loadBase, loadContent, getManifest } from './loader.js';
import { newRun, tryRunAction, replay } from '../../engine/run.js';
import { evaluate, emptyProfile, clearanceOf } from '../../engine/achievements.js';
import { dailyConfig, sydneyDate } from '../../engine/rng.js';
import { setAudio, sfx, unlock } from './audio.js';
import { setPalette, initBg, setBgEnabled, setBgQuality, setRain, setBgMotion, setIntensity, flashBg } from './bg.js';
import { toastAchievement, setFxSettings, confetti, banner, flash } from './fx.js';
import * as api from './api.js';

const K = { profile: 'adversary.profile.v1', run: 'adversary.run.v1', settings: 'adversary.settings.v1' };
const jget = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private */ } };
export const S = () => store.get();

const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DEFAULT_SETTINGS = { volume: 0.5, mute: false, crt: true, motion: !prefersReduced, shake: !prefersReduced, rain: true, glitch: true, typing: true, bg: 'medium', hints: true, handle: null, tutorialSeen: false };

export async function boot() {
  await api.initApi();
  const settings = { ...DEFAULT_SETTINGS, ...(jget(K.settings) || {}) };
  const profile = { ...emptyProfile(), ...(jget(K.profile) || {}) };
  store.set({ settings, profile, screen: 'loading', runCtx: { progress: {} }, log: [], stage: null });
  applySettings(settings);
  initBg(document.getElementById('bg'));
  const manifest = await loadBase();
  store.set({ manifest });
  setPalette(null);
  loadContent(manifest.scenarios[0].id).then(content => { if (!S().run) store.set({ content }); });
  const saved = jget(K.run);
  store.set({ screen: 'title', saved: saved && saved.fp ? { scenario: saved.scenario, ts: saved.ts, doctrine: saved.init.doctrine, n: saved.log.length } : null });
  const d = await api.getDaily();
  if (d.ok) store.set({ daily: d.data });
  // opportunistic cloud profile merge (best effort)
  api.getProfileRemote().then(r => { if (r.ok && r.data?.profile) { const merged = mergeProfiles(S().profile, r.data.profile); store.set({ profile: merged }); jset(K.profile, merged); } });
}

export function applySettings(s) {
  setAudio({ volume: s.volume, mute: s.mute });
  document.body.classList.toggle('no-crt', !s.crt);
  document.body.classList.toggle('no-motion', !s.motion);
  document.body.classList.toggle('no-glitch', !s.glitch || !s.motion);
  setFxSettings({ motion: s.motion, shake: s.shake, glitch: s.glitch });
  setBgQuality(s.bg); setBgMotion(s.motion); setRain(s.rain); setBgEnabled(true);
}
export function saveSettings(patch) { const settings = { ...S().settings, ...patch }; store.set({ settings }); jset(K.settings, settings); applySettings(settings); }

function mergeProfiles(a, b) {
  if (!b?.ach) return a;
  const out = structuredClone(a);
  for (const [k, v] of Object.entries(b.ach.unlocked || {})) if (!out.ach.unlocked[k]) out.ach.unlocked[k] = v;
  for (const [k, v] of Object.entries(b.ach.progress || {})) out.ach.progress[k] = Math.max(out.ach.progress[k] || 0, v);
  out.xp = Math.max(a.xp, b.xp || 0);
  for (const bag of ['adv', 'tech', 'card', 'relic', 'ref']) for (const [k, v] of Object.entries(b.codex?.[bag] || {})) out.codex[bag][k] = Math.max(out.codex[bag][k] || 0, v);
  out.unlocks.doctrines = [...new Set([...a.unlocks.doctrines, ...(b.unlocks?.doctrines || [])])];
  out.unlocks.assurance = Math.max(a.unlocks.assurance, b.unlocks?.assurance || 1);
  out.stats = { ...a.stats, runs: Math.max(a.stats.runs, b.stats?.runs || 0), wins: Math.max(a.stats.wins, b.stats?.wins || 0), battles: Math.max(a.stats.battles, b.stats?.battles || 0), bestPoints: Math.max(a.stats.bestPoints, b.stats?.bestPoints || 0) };
  if ((b.daily?.best || 0) > (out.daily.best || 0)) out.daily = { ...out.daily, ...b.daily };
  return out;
}
export function saveProfile(profile) { store.set({ profile }); jset(K.profile, profile); }
export function syncProfile() { api.putProfile(S().profile); }

// ───────────────────────── run lifecycle ─────────────────────────
export async function startRun({ scenario, doctrine, assurance = 1, seed, mode = 'run', ttxId = null, daily = false }) {
  store.set({ loading: true });
  const content = await loadContent(scenario);
  seed = seed || `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const init = { seed, doctrine, assurance, mode, ttxId };
  const run = newRun(content, init);
  setPalette(content.theme);
  store.set({ content, run, init, scenario, daily: daily ? true : S().dailyRun && false, isDaily: daily, log: [], runLog: [], screen: 'run', loading: false, runCtx: { progress: {} }, evlog: [], stage: null });
  persistRun();
  sfx.turn();
  return run;
}
export function persistRun() {
  if (S().isTutorial) return;
  const { run, init, scenario, content, runLog } = S();
  if (!run || ['won', 'lost'].includes(run.phase)) { try { localStorage.removeItem(K.run); } catch { /* ignore */ } return; }
  jset(K.run, { v: 2, scenario, init, fp: content.fingerprint, log: runLog, ts: Date.now(), daily: !!S().isDaily });
}
export async function resumeRun() {
  const saved = jget(K.run); if (!saved) return false;
  store.set({ loading: true });
  try {
    const content = await loadContent(saved.scenario);
    if (content.fingerprint !== saved.fp) throw new Error('content changed');
    const rp = replay(content, saved.init, saved.log);
    if (!rp.ok) throw new Error(rp.error);
    setPalette(content.theme);
    store.set({ content, run: rp.run, init: saved.init, scenario: saved.scenario, isDaily: !!saved.daily, runLog: saved.log, log: [], screen: 'run', loading: false, runCtx: { progress: {} }, evlog: [], stage: null });
    return true;
  } catch (e) {
    try { localStorage.removeItem(K.run); } catch { /* ignore */ }
    store.set({ loading: false, saved: null, notice: 'Your saved run was created with different content and could not be resumed.' });
    return false;
  }
}

/** Execute an engine action; returns {ok, error, events, prev, next}. */
export function step(action) {
  const { content, run } = S();
  const r = tryRunAction(content, run, action);
  if (!r.ok) { sfx.error(); return r; }
  return { ...r, prev: run };
}
export function commit(r, action) {
  const { content } = S();
  const runLog = [...S().runLog, action];
  const seen = new Set(S().runTechs || []); for (const e of r.events) if (e.t === 'adv_play') seen.add(e.tech);
  store.set({ run: r.run, runLog, runTechs: [...seen] });
  // achievements & codex
  const { profile, unlocked, xpGained, levelUp } = evaluate(content, S().profile, S().runCtx, r.events);
  saveProfile(profile);
  unlocked.forEach((a, i) => setTimeout(() => toastAchievement(a), 700 + i * 1100));
  if (levelUp) setTimeout(() => store.set({ levelup: clearanceOf(content, profile.xp) }), 900 + unlocked.length * 1100);
  persistRun();
  if (['won', 'lost'].includes(r.run.phase) && !S().isTutorial) finalizeRun(r);
  return { unlocked, xpGained };
}
export function act(action) { const r = step(action); if (!r.ok) return r; commit(r, action); return r; }

export function emitUi(ev) { // UI-level events (dossier views, tutorial, daily) feed achievements too
  const { content } = S(); if (!content) return;
  const { profile, unlocked } = evaluate(content, S().profile, S().runCtx, [ev]);
  saveProfile(profile); unlocked.forEach((a, i) => setTimeout(() => toastAchievement(a), 300 + i * 1100));
}

async function finalizeRun(r) {
  const { content, init, runLog, isDaily } = S();
  const res = r.run.result;
  sfx[res.won ? 'win' : 'lose']();
  if (res.won) { confetti(180); flashBg(1); }
  let board = null;
  if (isDaily) {
    const date = sydneyDate();
    const prev = S().profile.daily; const streak = prev.last && daysBetween(prev.last, date) === 1 ? prev.streak + 1 : prev.last === date ? prev.streak : 1;
    const profile = { ...S().profile, daily: { ...prev, streak, best: Math.max(prev.best, res.points), last: date, done: { ...prev.done, [date]: res.points } } };
    saveProfile(profile);
    emitUi({ t: 'daily_done', streak, points: res.points });
  }
  const submit = await api.submitRun({ init, scenario: S().scenario, log: runLog, fingerprint: content.fingerprint, version: getManifest().version, daily: isDaily ? sydneyDate() : null });
  store.set({ submitted: submit });
  syncProfile();
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function goto(screen, extra = {}) { sfx.click(); store.set({ screen, ...extra }); }
export function quitToTitle() { store.set({ screen: 'title', run: null, content: S().content, saved: jget(K.run) ? { scenario: jget(K.run).scenario, doctrine: jget(K.run).init.doctrine, n: jget(K.run).log.length } : null }); }
export async function dailyRunConfig() {
  const m = getManifest(); const core = (await import('./loader.js')).getCore();
  const date = sydneyDate();
  return { date, ...dailyConfig(date, m.scenarios.map(s => s.id), core.doctrines.doctrines.map(d => d.id)) };
}
export { clearanceOf, sleep };

export async function startTutorial() {
  store.set({ loading: true });
  const content = await loadContent('enterprise');
  const { tutorialRun } = await import('../../engine/tutorial.js');
  setPalette(content.theme);
  store.set({ content, run: tutorialRun(content), init: { seed: 'tutorial', doctrine: 'architect', assurance: 0 }, scenario: 'enterprise', isTutorial: true, isDaily: false, runLog: [], screen: 'run', loading: false, tutorial: { i: 0 }, runCtx: { progress: {} }, stage: null, holdBattle: false });
}
export function finishTutorial(skipped = false) {
  if (!skipped) { emitUi({ t: 'tutorial_done' }); confetti(100); sfx.win(); }
  store.set({ tutorial: null, isTutorial: false, run: null, screen: 'title', holdBattle: false });
  saveSettings({ tutorialSeen: true });
}
