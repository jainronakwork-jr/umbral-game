/* ---------------- Level generation ----------------
   Every level is built from hand-tuned segments whose sizes are derived from
   the player's jump arc (height ~102px, reach ~147px), so each one is
   solvable by construction. A bot verifies all 100 in test mode. */

const SEG_POOLS = [
  { flat: 2, gap: 3, step: 2, spikes: 3, trap: 2, crate: 2, lever: 2, rocks: 2 },
  { flat: 1, gap: 2, step: 1, spikes: 1, trap: 1, crate: 1, water: 3, husk: 3, plate: 2, lever: 1, platform: 1 },
  { flat: 1, gap: 2, step: 1, spikes: 2, crate: 2, lever: 2, plate: 2, crusher: 3, platform: 2, rocks: 1, husk: 1 },
  { flat: 1, gap: 2, step: 1, spikes: 1, crusher: 3, saw: 3, sawH: 2, platform: 2, crate: 1, plate: 1, lever: 1, husk: 1 },
  { gap: 2, step: 1, spikes: 2, trap: 1, crate: 1, lever: 1, plate: 1, crusher: 2, saw: 2, sawH: 2, platform: 3, water: 1, husk: 2, rocks: 1 }
];
const CHASE_SAFE = { flat: 1, gap: 3, step: 2, spikes: 3, trap: 2, rocks: 2 };

const CURATED = {
  1: ['flat', 'gap', 'flat', 'spikes', 'step', 'flat', 'gap'],
  2: ['trap', 'gap', 'crate', 'flat', 'spikes', 'step'],
  3: ['lever', 'gap', 'rocks', 'trap', 'crate', 'gap'],
  21: ['water', 'flat', 'husk', 'gap', 'water', 'step'],
  22: ['plate', 'husk', 'water', 'spikes', 'lever', 'gap'],
  41: ['crusher', 'gap', 'lever', 'crusher', 'plate', 'step', 'platform'],
  61: ['saw', 'gap', 'crusher', 'sawH', 'platform', 'saw', 'step'],
  81: ['platform', 'saw', 'water', 'husk', 'sawH', 'crusher', 'gap', 'platform']
};

function pickWeighted(rng, pool, avoid) {
  const keys = Object.keys(pool).filter(k => k !== avoid);
  let tot = 0; for (const k of keys) tot += pool[k];
  let r = rng() * tot;
  for (const k of keys) { r -= pool[k]; if (r <= 0) return k; }
  return keys[0];
}

function roughEdge(rng, w, amp) {
  const pts = []; const n = Math.max(2, Math.floor(w / 14));
  for (let i = 0; i <= n; i++) pts.push([i / n * w, i === 0 || i === n ? 0 : (rng() - 0.5) * amp]);
  return pts;
}

function buildLevel(n, opt) {
  opt = opt || {};
  const ch = opt.ch !== undefined ? opt.ch : Math.floor((n - 1) / 20);
  const d = opt.d !== undefined ? opt.d : (n - 1) / 99;
  const rng = mulberry32(n * 7919 + 13);
  const chase = opt.chase !== undefined ? opt.chase : n % 20 === 0;
  const L = {
    n, ch, d, chase, solids: [], spikes: [], traps: [], water: [], crates: [], plats: [], saws: [],
    crushers: [], levers: [], gates: [], plates: [], rocks: [], husks: [], embers: [], checkpoints: [],
    rides: [], decor: [], signs: [], segs: []
  };
  const b = { x: -1100, gy: GY, seg: 0 };
  const ground = (w, kind) => {
    L.solids.push({ x: b.x, y: b.gy, w, h: 1400 - b.gy, kind: kind || 'ground', edge: roughEdge(rng, w, 5), seed: rng() * 1e6 | 0 });
    b.x += w;
  };
  const cp = () => L.checkpoints.push({ x: b.x + 30, y: b.gy, seg: b.seg });
  const ember = (x, y) => { if (rng() < 0.55) L.embers.push({ x, y, taken: false, seg: b.seg }); };

  const S = {
    flat() { ember(b.x + 120, b.gy - 70); ground(160 + rng() * 120 | 0); },
    gap() {
      ground(100);
      const w = Math.min(116, lerp(64, 112, d) + rng() * 10) | 0;
      L.decor.push({ t: 'pit', x: b.x, w, y: b.gy });
      ember(b.x + w / 2, b.gy - 100);
      b.x += w; ground(120);
    },
    step() {
      ground(110);
      let up = rng() < 0.55;
      if (b.gy < GY - 200) up = false; if (b.gy > GY + 80) up = true;
      const r = 40 + rng() * 40 | 0;
      b.gy += up ? -r : r + 30;
      ground(150);
    },
    spikes() {
      ground(90);
      const w = lerp(40, 92, d) + rng() * 6 | 0;
      L.spikes.push({ x: b.x, y: b.gy - 16, w, h: 16, seg: b.seg, pts: roughEdge(rng, w, 0) });
      ground(w); ground(130);
    },
    trap() {
      ground(110);
      L.traps.push({ x: b.x, y: b.gy - 12, w: 34, h: 12, shut: 0, seg: b.seg });
      ground(34); ground(130);
    },
    crate() {
      if (b.gy - 135 < GY - 270) { S.step(); return; }
      ground(70);
      L.crates.push({ x: b.x + 40, y: b.gy - 50, w: 50, h: 50, vx: 0, vy: 0, seg: b.seg, x0: b.x + 40, y0: b.gy - 50 });
      ground(240);
      L.signs.push({ x: b.x - 200, y: b.gy - 140, txt: 'push', lvl: n });
      b.gy -= 120 + rng() * 14 | 0;
      ground(150);
    },
    lever() {
      ground(80);
      const gate = { x: b.x + 160, y: b.gy - 280, w: 24, h: 280, open: 0, target: 0, seg: b.seg };
      L.levers.push({ x: b.x + 50, y: b.gy, on: false, gate, seg: b.seg, ang: 0 });
      L.gates.push(gate);
      ground(320);
    },
    plate() {
      ground(60);
      L.crates.push({ x: b.x + 30, y: b.gy - 50, w: 50, h: 50, vx: 0, vy: 0, seg: b.seg, x0: b.x + 30, y0: b.gy - 50 });
      ground(180);
      // recessed pressure plate
      const rx = b.x;
      L.solids.push({ x: rx, y: b.gy + 10, w: 56, h: 1390 - b.gy, kind: 'ground', edge: [[0, 0], [56, 0]], seed: 1 });
      const gate = { x: rx + 56 + 110, y: b.gy - 280, w: 24, h: 280, open: 0, target: 0, seg: b.seg };
      L.plates.push({ x: rx + 2, y: b.gy + 4, w: 52, h: 6, gate, seg: b.seg, down: 0 });
      L.gates.push(gate);
      b.x += 56; ground(260);
    },
    crusher() {
      ground(70);
      const count = d > 0.45 && rng() < 0.6 ? 2 : 1;
      const P = lerp(2.7, 1.9, d) + rng() * 0.3, ph = rng() * P;
      for (let i = 0; i < count; i++) {
        L.crushers.push({ x: b.x + 70 + i * 150, w: 76, h: 120, top: b.gy - 320, bot: b.gy - 120, P, ph: ph + i * P * 0.45, seg: b.seg, gy: b.gy, last: 0 });
      }
      ground(140 + count * 150);
    },
    saw() {
      ground(70);
      const P = lerp(2.5, 1.7, d) + rng() * 0.3;
      L.saws.push({ kind: 'v', x: b.x + 90, r: 30, y1: b.gy - 230, y2: b.gy - 8, P, ph: rng() * P, seg: b.seg, gy: b.gy, last: 0 });
      if (d > 0.7 && rng() < 0.5) L.saws.push({ kind: 'v', x: b.x + 220, r: 30, y1: b.gy - 230, y2: b.gy - 8, P, ph: rng() * P, seg: b.seg, gy: b.gy, last: 0 });
      ground(330);
    },
    sawH() {
      ground(80);
      const P = lerp(3.2, 2.2, d);
      L.saws.push({ kind: 'h', x1: b.x + 30, x2: b.x + 230, y: b.gy - 20, r: 26, P, ph: rng() * P, seg: b.seg, gy: b.gy, last: 0 });
      ground(340);
    },
    platform() {
      ground(100);
      const W = lerp(220, 330, d) + rng() * 20 | 0;
      const p = { a: b.x, b: b.x + W, w: 96, h: 16, y: b.gy, P: W / 70, ph: 0, seg: b.seg, kind: 'plat' };
      p.x = p.a + 6;
      L.plats.push(p);
      L.rides.push(p);
      L.decor.push({ t: 'pit', x: b.x, w: W, y: b.gy });
      b.x += W; ground(130);
    },
    water() {
      ground(90);
      const pads = 1 + (rng() < d + 0.2 ? 1 : 0);
      const gaps = []; for (let i = 0; i <= pads; i++) gaps.push(lerp(50, 96, d) + rng() * 12 | 0);
      const start = b.x; let x = start;
      for (let i = 0; i < pads; i++) {
        x += gaps[i];
        L.plats.push({ kind: 'log', x, a: x, w: 90, h: 14, y: b.gy + 4, y0: b.gy + 4, P: 2.6 + rng(), ph: rng() * 3, seg: b.seg });
        x += 90;
      }
      x += gaps[pads];
      L.water.push({ x: start, y: b.gy + 14, w: x - start, h: 300, seg: b.seg });
      L.solids.push({ x: start, y: b.gy + 300, w: x - start, h: 1000, kind: 'bed', edge: [[0, 0], [x - start, 0]], seed: 2 });
      b.x = x; ground(130);
    },
    rocks() {
      ground(60);
      const k = 2 + (rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const x = b.x + 60 + i * 80 + rng() * 20;
        L.rocks.push({ x, y: b.gy - 420, w: 40, h: 44, y0: b.gy - 420, gy: b.gy, state: 0, t: 0, vy: 0, seg: b.seg });
      }
      ground(140 + k * 80);
    },
    husk() {
      ground(90);
      const range = 160 + rng() * 60 | 0;
      L.husks.push({ x1: b.x + 110, range, y: b.gy - 40, w: 26, h: 40, speed: lerp(55, 90, d), ph: rng() * 2, seg: b.seg });
      ground(110 + range + 110);
    }
  };

  // start area
  ground((opt.start || 520) + 800);
  if (n === 1) {
    L.signs.push({ x: -40, y: GY - 150, txt: 'move' });
  }
  if (chase) L.signs.push({ x: 40, y: GY - 170, txt: 'run' });
  const count = chase ? 9 + Math.floor(d * 6) : Math.min(18, 5 + Math.floor(n / 6));
  const seq = opt.seq ? opt.seq.slice() : CURATED[n] ? CURATED[n].slice() : [];
  let prev = null;
  const pool = chase ? CHASE_SAFE : SEG_POOLS[ch];
  while (seq.length < count) { const k = pickWeighted(rng, pool, prev); seq.push(k); prev = k; }
  for (const k of seq) {
    b.seg++;
    cp();
    if (n === 1 && k === 'gap' && !L.signs.some(s => s.txt === 'jump')) L.signs.push({ x: b.x - 10, y: b.gy - 160, txt: 'jump' });
    if (k === 'lever' && n <= 3) L.signs.push({ x: b.x + 30, y: b.gy - 160, txt: 'act' });
    S[k]();
    L.segs.push(k);
  }
  b.seg++; cp();
  ground(420);
  L.exitX = b.x - 160; L.exitY = b.gy;
  ground(600);
  L.width = b.x;
  L.startX = 0; L.startY = GY;
  if (chase) L.chaseInfo = { x0: -620, speed: 168 + d * 22, delay: 1.6 };
  // midground decor (trees / reeds / pillars / chimneys / floating stones)
  for (let x = -400; x < L.width; x += 90 + rng() * 220) L.decor.push({ t: 'mid', x, s: 0.6 + rng() * 0.9, r: rng() });
  for (let x = -400; x < L.width; x += 500 + rng() * 700) L.decor.push({ t: 'fore', x, s: 0.8 + rng() * 0.8, r: rng() });
  return L;
}
