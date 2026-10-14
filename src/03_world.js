/* ---------------- World simulation (deterministic, render-free) ---------------- */

const tri = s => { s = ((s % 2) + 2) % 2; return s < 1 ? s : 2 - s; };

function crusherY(c, t) {
  const P = c.P, u = ((t + c.ph) % P + P) % P;
  const fallS = P - 1.2, fallE = fallS + 0.15, downE = fallE + 0.35;
  if (u < fallS) return c.top;
  if (u < fallE) { const k = (u - fallS) / 0.15; return c.top + (c.bot - c.top) * k * k; }
  if (u < downE) return c.bot;
  return c.bot + (c.top - c.bot) * ((u - downE) / 0.7);
}
function sawPos(s, t) {
  const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t + s.ph) / s.P);
  if (s.kind === 'v') return { x: s.x, y: lerp(s.y1, s.y2, k) };
  return { x: lerp(s.x1, s.x2, k), y: s.y };
}
function huskX(h, t) { return h.x1 + h.range * tri(t * h.speed / h.range + h.ph); }
function huskDir(h, t) { const s = ((t * h.speed / h.range + h.ph) % 2 + 2) % 2; return s < 1 ? 1 : -1; }
function platX(p, t) {
  if (p.kind === 'log') return p.x;
  return p.a + 6 + (p.b - p.a - 12 - p.w) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (t + p.ph) / p.P));
}
function platY(p, t) { return p.kind === 'log' ? p.y0 + Math.sin((t + p.ph) * 2 * Math.PI / p.P) * 3 : p.y; }

// danger shapes at time t (rects) — used for collision AND bot prediction
function dangersAt(L, t, x0, x1) {
  const out = [];
  for (const c of L.crushers) if (c.x + c.w > x0 && c.x < x1) { const y = crusherY(c, t); out.push({ x: c.x + 4, y: y + 6, w: c.w - 8, h: c.h - 6, k: 'crush' }); }
  for (const s of L.saws) {
    const p = sawPos(s, t); if (p.x + s.r < x0 || p.x - s.r > x1) continue;
    const r = s.r * 0.8; out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, k: 'blade' });
  }
  for (const h of L.husks) { const x = huskX(h, t); if (x + h.w > x0 && x < x1) out.push({ x: x + 3, y: h.y + 4, w: h.w - 6, h: h.h - 4, k: 'husk' }); }
  return out;
}

class World {
  constructor(L, opts = {}) {
    this.L = L; this.t = opts.t0 || 0; this.events = [];
    this.cp = 0; this.deaths = 0; this.embers = 0; this.done = false;
    this.snap = JSON.stringify({ crates: L.crates, rocks: L.rocks, traps: L.traps, levers: L.levers.map(l => l.on) });
    this.p = { x: 0, y: 0, vx: 0, vy: 0, ground: null, face: 1, coyote: 0, buffer: 0, dead: false, deadT: 0,
      dtype: '', run: 0, stepPh: 0, push: false, blocked: 0, air: 0, landV: 0, alive: 0 };
    this.chaseX = null;
    this.spawn(true);
  }
  emit(name, data) { this.events.push(Object.assign({ name, t: this.t }, data || {})); }
  spawn(full) {
    const L = this.L, c = L.checkpoints[this.cp] || { x: L.startX, y: L.startY, seg: 0 };
    const p = this.p;
    p.x = (this.cp === 0 ? L.startX : c.x) - PHYS.PW / 2; p.y = (this.cp === 0 ? L.startY : c.y) - PHYS.PH;
    p.vx = 0; p.vy = 0; p.dead = false; p.deadT = 0; p.ground = null; p.face = 1; p.alive = 0; p.dtype = '';
    const seg = this.cp === 0 ? 0 : c.seg;
    const s = JSON.parse(this.snap);
    L.crates.forEach((cr, i) => { if (cr.seg >= seg || full) Object.assign(cr, s.crates[i]); });
    L.rocks.forEach((r, i) => { if (r.seg >= seg || full) Object.assign(r, s.rocks[i]); });
    L.traps.forEach((r, i) => { if (r.seg >= seg || full) Object.assign(r, s.traps[i]); });
    L.levers.forEach((l, i) => { if (l.seg >= seg || full) { l.on = false; l.gate.target = 0; l.gate.open = 0; } });
    L.plates.forEach(pl => { if (pl.seg >= seg || full) { pl.gate.open = 0; pl.gate.target = 0; } });
    if (L.chaseInfo) this.chaseX = L.chaseInfo.x0, this.chaseT = 0;
    if (this.bot) this.bot.reset = true;
  }
  kill(type) {
    const p = this.p; if (p.dead) return;
    p.dead = true; p.deadT = 0; p.dtype = type; this.deaths++;
    this.emit('death', { kind: type, x: p.x + PHYS.PW / 2, y: p.y + PHYS.PH / 2, vx: p.vx });
  }
  solidsNear(x0, x1) {
    const L = this.L, out = [];
    for (const s of L.solids) if (s.x < x1 && s.x + s.w > x0) out.push(s);
    for (const g of L.gates) if (g.x < x1 && g.x + g.w > x0) out.push({ x: g.x, y: g.y - g.open * (g.h - 10), w: g.w, h: g.h, kind: 'gate' });
    for (const r of L.rocks) if (r.state === 2 && r.x < x1 && r.x + r.w > x0) out.push({ x: r.x, y: r.y, w: r.w, h: r.h, kind: 'rubble' });
    return out;
  }
  // move a crate horizontally; returns actual displacement
  moveCrate(c, dx) {
    const sol = this.solidsNear(c.x - 60, c.x + c.w + 60);
    const others = this.L.crates.filter(o => o !== c);
    let nx = c.x + dx;
    const r = { x: nx, y: c.y, w: c.w, h: c.h - 0.5 };
    for (const s of sol.concat(others)) if (overlap(r, s)) { nx = dx > 0 ? Math.min(nx, s.x - c.w) : Math.max(nx, s.x + s.w); r.x = nx; }
    const moved = nx - c.x; c.x = nx;
    return moved;
  }
  step(dt, inp) {
    const L = this.L, p = this.p, t0 = this.t;
    this.t += dt; const t = this.t;
    // --- moving platforms & logs
    for (const pl of L.plats) {
      const nx = platX(pl, t), ny = platY(pl, t);
      pl.dx = nx - pl.x; pl.dy = ny - pl.y; pl.x = nx; pl.y = ny;
    }
    if (p.ground && p.ground.kind && (p.ground.kind === 'plat' || p.ground.kind === 'log')) { p.x += p.ground.dx; p.y += p.ground.dy; }
    // --- hazards with events
    for (const c of L.crushers) {
      const P = c.P, u0 = ((t0 + c.ph) % P + P) % P, u1 = ((t + c.ph) % P + P) % P, hit = P - 1.05;
      if (u0 < hit && u1 >= hit) this.emit('slam', { x: c.x + c.w / 2 });
      if (u0 < P - 1.25 && u1 >= P - 1.25) this.emit('creak', { x: c.x + c.w / 2 });
    }
    for (const s of L.saws) {
      const ph = Math.floor((t + s.ph) / s.P), ph0 = Math.floor((t0 + s.ph) / s.P);
      if (ph !== ph0) this.emit('saw', { x: s.kind === 'v' ? s.x : (s.x1 + s.x2) / 2 });
    }
    // gates
    for (const g of L.gates) {
      const prev = g.open; g.open += clamp(g.target - g.open, -dt * 1.5, dt * 1.5);
      if (prev < g.open && prev === 0) this.emit('gate', { x: g.x });
      if (prev > g.open && g.open === 0) this.emit('gateShut', { x: g.x });
    }
    // rocks
    for (const r of L.rocks) {
      if (r.state === 0 && !p.dead && p.x + PHYS.PW / 2 > r.x - 40 && p.x < r.x + 80) { r.state = 1; r.t = 0; this.emit('rockSnap', { x: r.x }); }
      if (r.state === 1) {
        r.t += dt;
        if (r.t > 0.25) {
          r.vy += PHYS.G * dt; r.y += r.vy * dt;
          if (r.y + r.h >= r.gy) { r.y = r.gy - r.h; r.state = 2; this.emit('rockLand', { x: r.x }); }
        }
      }
    }
    // chase darkness
    if (L.chaseInfo && !p.dead) {
      this.chaseT += dt;
      if (this.chaseT > L.chaseInfo.delay) this.chaseX += L.chaseInfo.speed * dt;
      this.chaseX = Math.max(this.chaseX, p.x - 900);
    }

    // --- player
    if (p.dead) {
      p.deadT += dt;
      if (p.dtype === 'water') { p.vy = 40; p.y += p.vy * dt; }
      if (p.deadT > 1.5) { if (L.chaseInfo) this.cp = 0; this.spawn(false); this.emit('respawn', {}); }
      this.crates(dt);
      return;
    }
    p.alive += dt;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) p.face = dir;
    const grounded = !!p.ground;
    let maxV = PHYS.RUN * (p.push ? PHYS.PUSH / PHYS.RUN : 1);
    const acc = grounded ? PHYS.GROUNDACC : PHYS.AIRACC;
    const target = dir * maxV;
    p.vx += clamp(target - p.vx, -acc * dt, acc * dt);
    // jumping
    if (grounded) p.coyote = PHYS.COYOTE; else p.coyote -= dt;
    if (inp.jumpPressed) p.buffer = PHYS.BUFFER; else p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHYS.JUMP; p.buffer = 0; p.coyote = 0; p.ground = null;
      this.emit('jump', { x: p.x });
    }
    if (!inp.jump && p.vy < -260) p.vy = -260;
    p.vy = Math.min(PHYS.MAXFALL, p.vy + PHYS.G * dt);

    // horizontal move & collide
    const sol = this.solidsNear(p.x - 80, p.x + 100);
    const plats = L.plats;
    p.push = false;
    let dx = p.vx * dt; p.x += dx;
    let pr = { x: p.x, y: p.y, w: PHYS.PW, h: PHYS.PH };
    let blockedNow = false;
    for (const s of sol) {
      if (!overlap(pr, s)) continue;
      // step up small ledges
      if (p.ground && s.kind !== 'gate' && s.y >= p.y + PHYS.PH - PHYS.STEP - 0.01) {
        const test = { x: p.x, y: s.y - PHYS.PH - 0.01, w: PHYS.PW, h: PHYS.PH };
        if (!sol.some(o => o !== s && overlap(test, o))) { p.y = s.y - PHYS.PH - 0.01; pr.y = p.y; continue; }
      }
      if (dx > 0) p.x = s.x - PHYS.PW; else if (dx < 0) p.x = s.x + s.w; else p.x = (p.x + PHYS.PW / 2 < s.x + s.w / 2) ? s.x - PHYS.PW : s.x + s.w;
      pr.x = p.x; p.vx = 0; blockedNow = true;
    }
    for (const c of L.crates) {
      if (!overlap(pr, c)) continue;
      if (p.ground && dx !== 0 && p.y + PHYS.PH > c.y + 8) {
        const pen = dx > 0 ? (p.x + PHYS.PW) - c.x : (p.x) - (c.x + c.w);
        const moved = this.moveCrate(c, pen);
        if (Math.abs(moved) > 0.01) { p.push = true; if (!this.pushSnd || t - this.pushSnd > 0.28) { this.pushSnd = t; this.emit('push', { x: c.x }); } }
        p.x -= pen - moved;
        if (Math.abs(moved) < Math.abs(pen) - 0.01) blockedNow = true;
      } else {
        p.x = dx > 0 ? c.x - PHYS.PW : dx < 0 ? c.x + c.w : p.x; blockedNow = true;
      }
      pr.x = p.x;
    }
    for (const pl of plats) {
      if (!overlap(pr, pl)) continue;
      if (p.y + PHYS.PH <= pl.y + 6) continue;
      p.x = (p.x + PHYS.PW / 2 < pl.x + pl.w / 2) ? pl.x - PHYS.PW : pl.x + pl.w; pr.x = p.x;
    }
    p.blocked = blockedNow && dir !== 0 ? p.blocked + dt : 0;

    // vertical move & collide
    const wasGround = p.ground; p.ground = null;
    const vy = p.vy; p.y += vy * dt; pr = { x: p.x, y: p.y, w: PHYS.PW, h: PHYS.PH };
    const all = sol.concat(L.crates);
    for (const s of all) {
      if (!overlap(pr, s)) continue;
      if (vy >= 0) { p.y = s.y - PHYS.PH; p.ground = s; } else { p.y = s.y + s.h; }
      p.vy = 0; pr.y = p.y;
    }
    for (const pl of plats) {
      if (vy >= 0 && pr.x < pl.x + pl.w && pr.x + PHYS.PW > pl.x && p.y + PHYS.PH >= pl.y && p.y + PHYS.PH - vy * dt <= pl.y + 8 + Math.abs(pl.dy || 0)) {
        p.y = pl.y - PHYS.PH; p.vy = 0; p.ground = pl; pr.y = p.y;
      }
    }
    // stay snapped onto descending platforms
    if (!p.ground && wasGround && wasGround.kind === 'log' && p.vy >= 0) {
      const pl = wasGround; if (pr.x < pl.x + pl.w && pr.x + PHYS.PW > pl.x && Math.abs(p.y + PHYS.PH - pl.y) < 6) { p.y = pl.y - PHYS.PH; p.ground = pl; }
    }
    if (p.ground && !wasGround) { this.emit('land', { x: p.x, v: vy }); p.stepPh = 0.5; }
    if (!p.ground) p.air += dt; else p.air = 0;

    // footsteps / animation
    if (p.ground && Math.abs(p.vx) > 20) {
      const ph0 = p.stepPh; p.stepPh += Math.abs(p.vx) * dt / 52;
      if (Math.floor(ph0 * 2) !== Math.floor(p.stepPh * 2)) this.emit('step', { x: p.x, surf: p.ground.kind });
    }
    p.run = Math.abs(p.vx) / PHYS.RUN;

    this.crates(dt);
    this.interact(inp);
    this.hazards();
  }
  crates(dt) {
    for (const c of this.L.crates) {
      c.vy = Math.min(PHYS.MAXFALL, c.vy + PHYS.G * dt);
      const ny = c.y + c.vy * dt;
      const r = { x: c.x + 0.5, y: ny, w: c.w - 1, h: c.h };
      let landed = false;
      for (const s of this.solidsNear(c.x - 10, c.x + c.w + 10).concat(this.L.crates.filter(o => o !== c))) {
        if (overlap(r, s) && c.vy >= 0) { r.y = s.y - c.h; landed = true; }
      }
      if (landed && c.vy > 400) this.emit('crateLand', { x: c.x });
      c.y = r.y; if (landed) c.vy = 0;
    }
  }
  interact(inp) {
    const L = this.L, p = this.p, cx = p.x + PHYS.PW / 2;
    if (inp.act && p.ground) {
      for (const l of L.levers) {
        if (Math.abs(cx - l.x) < 38 && Math.abs(p.y + PHYS.PH - l.y) < 30 && !this.leverLock) {
          l.on = !l.on; l.gate.target = l.on ? 1 : 0; this.emit('lever', { x: l.x, on: l.on }); this.leverLock = true;
        }
      }
    }
    if (!inp.act) this.leverLock = false;
    const pr = { x: p.x, y: p.y, w: PHYS.PW, h: PHYS.PH };
    for (const pl of L.plates) {
      const zone = { x: pl.x, y: pl.y - 4, w: pl.w, h: 12 };
      const w = overlap(pr, zone) || L.crates.some(c => overlap(c, zone));
      if (w && pl.down < 1) { if (pl.down === 0) this.emit('plate', { x: pl.x }); pl.down = 1; }
      if (!w) pl.down = 0;
      pl.gate.target = w ? 1 : 0;
    }
    for (const e of L.embers) {
      if (!e.taken && Math.abs(e.x - cx) < 24 && Math.abs(e.y - (p.y + PHYS.PH / 2)) < 34) { e.taken = true; this.embers++; this.emit('ember', { x: e.x }); }
    }
    while (this.cp + 1 < L.checkpoints.length && cx > L.checkpoints[this.cp + 1].x && p.ground && !L.chaseInfo) { this.cp++; this.emit('checkpoint', {}); }
    if (cx > L.exitX && !this.done) { this.done = true; this.emit('exit', {}); }
  }
  hazards() {
    const L = this.L, p = this.p, t = this.t;
    const pr = { x: p.x + 3, y: p.y + 4, w: PHYS.PW - 6, h: PHYS.PH - 6 };
    if (p.y > 1250) return this.kill('fall');
    for (const s of L.spikes) if (overlap(pr, { x: s.x + 3, y: s.y + 6, w: s.w - 6, h: s.h })) return this.kill('spike');
    for (const tr of L.traps) if (!tr.shut && overlap(pr, { x: tr.x + 6, y: tr.y, w: tr.w - 12, h: tr.h })) { tr.shut = 1; this.emit('trap', { x: tr.x }); return this.kill('trap'); }
    for (const w of L.water) if (overlap(pr, { x: w.x, y: w.y + 10, w: w.w, h: w.h })) { this.emit('splash', { x: p.x }); return this.kill('water'); }
    for (const dz of dangersAt(L, t, p.x - 80, p.x + 100)) if (overlap(pr, dz)) return this.kill(dz.k);
    for (const r of L.rocks) if (r.state === 1 && overlap(pr, r)) return this.kill('crush');
    if (this.chaseX !== null && p.x < this.chaseX) return this.kill('dark');
  }
}
