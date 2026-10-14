/* ---------------- Autopilot (used for playtesting all 100 levels and the reel) ---------------- */

function supportAt(W, x, feetY) {
  // is there a surface roughly at feet level under x?
  const L = W.L;
  for (const s of W.solidsNear(x - 1, x + 1)) if (x >= s.x && x <= s.x + s.w && Math.abs(s.y - feetY) < 14) return true;
  for (const c of L.crates) if (x >= c.x && x <= c.x + c.w && Math.abs(c.y - feetY) < 14) return true;
  for (const c of L.plats) if (c.kind === 'log' && x >= c.x && x <= c.x + c.w && Math.abs(c.y - feetY) < 14) return true;
  return false;
}
function safeDropAt(W, x, feetY) {
  const L = W.L;
  for (const w of L.water) if (x >= w.x && x <= w.x + w.w) return false;
  for (const s of W.solidsNear(x - 1, x + 1)) if (x >= s.x && x <= s.x + s.w && s.y > feetY && s.y < feetY + 420 && s.kind !== 'bed') return true;
  return false;
}

function predictSafe(W, mode, horizon) {
  const p = W.p, L = W.L, dt = 1 / 30;
  let x = p.x, y = p.y, vy = 0, vx = p.vx;
  const gy = p.y;
  if (mode === 'jump') vy = -PHYS.JUMP;
  for (let k = 1; k <= horizon * 30; k++) {
    const t = W.t + k * dt;
    if (mode === 'run' || mode === 'jump') vx = Math.min(PHYS.RUN, vx + (mode === 'jump' ? PHYS.AIRACC : PHYS.GROUNDACC) * dt);
    else if (mode === 'wait') vx = 0;
    else vx = -PHYS.RUN;
    x += vx * dt;
    if (mode === 'jump') { vy += PHYS.G * dt; y += vy * dt; if (y > gy) { y = gy; vy = 0; } }
    const pr = { x: x + 2, y: y + 2, w: PHYS.PW - 4, h: PHYS.PH - 4 };
    for (const dz of dangersAt(L, t, x - 60, x + 80)) if (overlap(pr, { x: dz.x - 4, y: dz.y - 4, w: dz.w + 8, h: dz.h + 8 })) return false;
  }
  return true;
}

function botInput(W) {
  const p = W.p, L = W.L;
  if (!W.bot || W.bot.reset) W.bot = Object.assign(W.bot || {}, { reset: false, hold: 0, wantDie: W.bot ? W.bot.wantDie : 0 });
  const B = W.bot;
  const inp = { left: false, right: true, jump: false, jumpPressed: false, act: false };
  if (p.dead || W.done) return { left: false, right: false, jump: false, jumpPressed: false, act: false };
  const cx = p.x + PHYS.PW / 2, feet = p.y + PHYS.PH, g = !!p.ground;
  const doJump = () => { if (g) { inp.jumpPressed = true; inp.jump = true; B.hold = 0.4; } };
  if (B.hold > 0) { B.hold -= 1 / 60; if (p.vy < 0) inp.jump = true; }
  if (!g && p.air > 0) { inp.right = !B.ridePause; return inp; } // committed while airborne

  // 1. moving platforms
  for (const pl of L.rides) {
    if (cx > pl.a - 70 && cx < pl.b + 10) {
      const onIt = p.ground === pl;
      if (!onIt && cx < pl.a) {
        if (p.x + PHYS.PW < pl.a - 2) { inp.right = true; }
        else {
          inp.right = false;
          // predict landing
          const tl = 2 * PHYS.JUMP / PHYS.G, land = cx + PHYS.RUN * tl * 0.92, px = platX(pl, W.t + tl);
          if (g && land > px + 14 && land < px + pl.w - 10) { inp.right = true; doJump(); }
        }
        return inp;
      }
      if (onIt) {
        inp.right = false;
        if (pl.x + pl.w >= pl.b - 26) { inp.right = true; doJump(); }
        else if (cx < pl.x + 30) inp.right = true; // stay central
        return inp;
      }
    }
  }
  // 2. levers
  for (const l of L.levers) {
    if (!l.on && l.gate.x > cx - 10 && cx > l.x - 160 && l.x - cx < 160) {
      if (Math.abs(cx - l.x) < 10 && g) { inp.right = false; inp.act = !B.actHeld; B.actHeld = !B.actHeld; return inp; }
      if (cx < l.x) { inp.right = true; return inp; }
      if (cx > l.x) { inp.right = false; inp.left = true; return inp; }
    }
  }
  // gate still opening: wait
  for (const gt of L.gates) if (gt.open < 0.95 && gt.x > cx && gt.x - (p.x + PHYS.PW) < 30) {
    const pl = L.plates.find(q => q.gate === gt);
    if (!pl || gt.target === 1) { inp.right = false; return inp; }
  }
  // 3. timed hazards — predictive
  const near = dangersAt(L, W.t, cx - 40, cx + 320).length > 0 || L.husks.some(h => Math.abs(huskX(h, W.t) - cx) < 320);
  if (near) {
    if (B.wantDie > 0 && dangersAt(L, W.t, cx - 40, cx + 140).length) { /* deliberately reckless (reel) */ inp.right = true; return inp; }
    if (predictSafe(W, 'run', 0.9)) { inp.right = true; }
    else if (g && predictSafe(W, 'jump', 0.9)) { inp.right = true; doJump(); B.why = 'pjump'; return inp; }
    else if (predictSafe(W, 'wait', 0.9)) { inp.right = false; return inp; }
    else { inp.right = false; inp.left = true; return inp; }
  }
  // 4. terrain
  if (g && inp.right) {
    const ahead = p.x + PHYS.PW + 3;
    if (!supportAt(W, ahead, feet) && !safeDropAt(W, ahead, feet)) { doJump(); B.why = 'edge'; }
    for (const s of L.spikes) if (s.x - ahead > 0 && s.x - ahead < 14 && Math.abs(s.y + s.h - feet) < 20) doJump();
    for (const s of L.traps) if (!s.shut && s.x - ahead > 0 && s.x - ahead < 16 && Math.abs(s.y + s.h - feet) < 20) doJump();
    if (p.blocked > 0.06) { doJump(); B.why = 'blocked'; }
  }
  return inp;
}
