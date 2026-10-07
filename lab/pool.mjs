// Worker-thread pool. Specs are chunked, every spec carries its own seed, so results are reproducible regardless of worker count.
import { Worker } from 'node:worker_threads';
import os from 'node:os';

export class Pool {
  constructor(n = Math.max(1, Math.min(os.cpus().length, 8))) {
    this.workers = Array.from({ length: n }, () => new Worker(new URL('./worker.mjs', import.meta.url)));
    this.idle = this.workers.slice(); this.queue = []; this.pending = new Map(); this.nextId = 1;
    for (const w of this.workers) {
      w.on('message', m => { const p = this.pending.get(m.id); this.pending.delete(m.id); this.idle.push(w); this._pump(); m.ok ? p.resolve(m.out) : p.reject(new Error(m.error)); });
      w.on('error', e => { for (const p of this.pending.values()) p.reject(e); });
    }
  }
  _pump() { while (this.idle.length && this.queue.length) { const w = this.idle.pop(), job = this.queue.shift(); this.pending.set(job.id, job); w.postMessage({ id: job.id, kind: job.kind, specs: job.specs, planner: job.planner }); } }
  _submit(kind, specs, planner) { return new Promise((resolve, reject) => { this.queue.push({ id: this.nextId++, kind, specs, planner, resolve, reject }); this._pump(); }); }
  /** Runs all specs; returns results in the same order. */
  async map(kind, specs, { chunk = 0, planner = false, onProgress = null } = {}) {
    const size = chunk || Math.max(1, Math.ceil(specs.length / (this.workers.length * 6)));
    const parts = []; for (let i = 0; i < specs.length; i += size) parts.push(specs.slice(i, i + size));
    let done = 0; const res = await Promise.all(parts.map(p => this._submit(kind, p, planner).then(r => { done += p.length; onProgress?.(done, specs.length); return r; })));
    return res.flat();
  }
  async close() { await Promise.all(this.workers.map(w => w.terminate())); }
}
