// Real OS algorithm implementations (pure JS) used by the OS Control Center.

// ---- CPU SCHEDULING: FCFS, SJF (non-preemptive), PRIORITY (non-preemptive, low number = high), RR ----
export function schedule(ps, algo, q = 2) {
  if (!Array.isArray(ps) || ps.length === 0) throw new Error('Add at least one process.');
  if (!['FCFS', 'SJF', 'PRIORITY', 'RR'].includes(algo)) throw new Error('Choose a supported scheduling algorithm.');
  if (algo === 'RR' && (!Number.isInteger(q) || q < 1)) throw new Error('Round Robin quantum must be a positive integer.');
  const ids = new Set();
  for (const process of ps) {
    if (typeof process.id !== 'string' || !process.id.trim() || ids.has(process.id)) throw new Error('Process IDs must be non-empty and unique.');
    if (![process.at, process.bt, process.pr].every(Number.isInteger) || process.at < 0 || process.bt < 1) {
      throw new Error('Arrival, burst, and priority must be whole numbers; arrival must be non-negative and burst must be positive.');
    }
    ids.add(process.id);
  }
  const p = ps.map(x => ({ ...x, rem: x.bt, start: null, ct: 0 })); const n = p.length;
  let t = 0, done = 0; const g = [];
  const push = (id, s, e) => { const l = g[g.length - 1]; if (l && l.id === id && l.e === s) l.e = e; else g.push({ id, s, e }); };
  if (algo === 'RR') {
    const queue = [], added = new Set();
    const admit = () => p.forEach(x => { if (x.at <= t && !added.has(x.id)) { added.add(x.id); queue.push(x); } });
    admit();
    while (done < n) {
      if (!queue.length) { t = Math.min(...p.filter(x => !added.has(x.id)).map(x => x.at)); admit(); continue; } // CPU idle
      const c = queue.shift(); if (c.start === null) c.start = t;
      const run = Math.min(q, c.rem); push(c.id, t, t + run); t += run; c.rem -= run;
      admit();                                          // new arrivals enter before the preempted process
      if (c.rem > 0) queue.push(c); else { c.ct = t; done++; }
    }
  } else {
    const cmp = algo === 'SJF' ? (a, b) => a.bt - b.bt || a.at - b.at
      : algo === 'PRIORITY' ? (a, b) => a.pr - b.pr || a.at - b.at : (a, b) => a.at - b.at;
    while (done < n) {
      const ready = p.filter(x => x.at <= t && x.rem > 0);
      if (!ready.length) { t = Math.min(...p.filter(x => x.rem > 0).map(x => x.at)); continue; }
      ready.sort(cmp); const c = ready[0];
      c.start = t; push(c.id, t, t + c.bt); t += c.bt; c.rem = 0; c.ct = t; done++;
    }
  }
  const rows = p.map(x => ({ id: x.id, at: x.at, bt: x.bt, ct: x.ct, tat: x.ct - x.at, wt: x.ct - x.at - x.bt, rt: x.start - x.at }));
  const avg = k => +(rows.reduce((s, r) => s + r[k], 0) / n).toFixed(2);
  return { rows, g, avg: { wt: avg('wt'), tat: avg('tat'), rt: avg('rt') } };
}

// ---- MEMORY: First / Best / Worst Fit over splittable free holes ----
export function allocate(blocks, procs, algo) {
  if (!Array.isArray(blocks) || !blocks.length || !Array.isArray(procs) || !procs.length) {
    throw new Error('Enter at least one memory block and one process.');
  }
  if (!['FIRST', 'BEST', 'WORST'].includes(algo)) throw new Error('Choose First Fit, Best Fit, or Worst Fit.');
  if ([...blocks, ...procs].some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Block sizes and process sizes must be positive finite numbers.');
  }
  const b = blocks.map((size, i) => ({ i, size, free: size, ps: [] }));
  const res = procs.map((s, k) => {
    const fit = b.filter(x => x.free >= s); let pick = null;
    if (fit.length) pick = algo === 'BEST' ? fit.reduce((a, x) => x.free < a.free ? x : a)      // smallest hole that fits
      : algo === 'WORST' ? fit.reduce((a, x) => x.free > a.free ? x : a) : fit[0];              // largest hole / first hole
    if (pick) { pick.free -= s; pick.ps.push({ id: 'P' + (k + 1), s }); }
    return { id: 'P' + (k + 1), size: s, block: pick ? pick.i + 1 : null };
  });
  const unalloc = res.some(r => r.block === null);
  const allocated = b.reduce((s, x) => s + (x.size - x.free), 0);
  const free = b.reduce((s, x) => s + x.free, 0);
  // Free remainders stay available in variable-sized holes; they are not internal fragmentation.
  const internal = 0;
  const external = unalloc ? free : 0;
  return { blocks: b, res, internal, external, allocated, free };
}

// ---- PAGE REPLACEMENT: FIFO / LRU / OPT ----
export function pageRep(ref, f, algo) {
  if (!Array.isArray(ref) || ref.length === 0 || ref.some(page => !Number.isInteger(page))) {
    throw new Error('Enter a non-empty reference string of whole-number page IDs.');
  }
  if (!Number.isInteger(f) || f < 1) throw new Error('Frame count must be a positive whole number.');
  if (!['FIFO', 'LRU', 'OPT'].includes(algo)) throw new Error('Choose FIFO, LRU, or Optimal.');
  let fr = []; const steps = []; let faults = 0;
  ref.forEach((pg, i) => {
    const hit = fr.includes(pg);
    if (hit) { if (algo === 'LRU') { fr = fr.filter(x => x !== pg); fr.push(pg); } }  // LRU: move to most-recent end
    else {
      faults++;
      if (fr.length < f) fr.push(pg);
      else if (algo === 'OPT') {                      // evict page used farthest in future
        let far = -1, v = fr[0];
        fr.forEach(x => { const n = ref.indexOf(x, i + 1), d = n < 0 ? Infinity : n; if (d > far) { far = d; v = x; } });
        fr[fr.indexOf(v)] = pg;
      } else { fr.shift(); fr.push(pg); }             // FIFO: oldest first; LRU: least recently used first
    }
    steps.push({ pg, frames: [...fr], hit });
  });
  const n = ref.length;
  return { steps, faults, hits: n - faults, hitRatio: +((n - faults) / n).toFixed(2), faultRatio: +(faults / n).toFixed(2) };
}

// ---- BANKER'S ALGORITHM (safety algorithm) ----
export function banker(alloc, max, avail) {
  if (!Array.isArray(alloc) || alloc.length === 0 || !Array.isArray(max) || max.length !== alloc.length
      || !Array.isArray(avail) || avail.length === 0) throw new Error('Allocation, maximum, and available data are required.');
  const resources = avail.length;
  if ([...alloc, ...max].some(row => !Array.isArray(row) || row.length !== resources
      || row.some(value => !Number.isInteger(value) || value < 0))
      || avail.some(value => !Number.isInteger(value) || value < 0)) {
    throw new Error('Resource counts must be non-negative whole numbers with matching matrix dimensions.');
  }
  if (alloc.some((row, i) => row.some((value, j) => value > max[i][j]))) {
    throw new Error('Allocation cannot exceed a process maximum.');
  }
  const n = alloc.length, need = max.map((r, i) => r.map((v, j) => v - alloc[i][j]));
  let work = [...avail]; const fin = Array(n).fill(false), seq = []; let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++)
      if (!fin[i] && need[i].every((v, j) => v <= work[j])) {   // Need <= Work -> process can finish
        work = work.map((v, j) => v + alloc[i][j]); fin[i] = true; seq.push('P' + i); changed = true;
      }
  }
  return { need, seq, safe: fin.every(Boolean) };
}
