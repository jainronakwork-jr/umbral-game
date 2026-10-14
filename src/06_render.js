/* ---------------- Renderer: silhouettes, parallax, light, fog, grain ---------------- */

const INK = '#070707';
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

// ---------- procedural silhouette painters (layers & decor) ----------
const ART = {
  trunk(g, rng, x, base, w, h) {
    const n = 14, lean = (rng() - 0.5) * 40, L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, y = base - h * k, wob = Math.sin(k * 5 + x) * w * 0.15 + lean * k * k;
      const ww = w * (1 - k * 0.45) * (i === 0 ? 1.8 : 1);
      L.push([x + wob - ww / 2, y]); R.push([x + wob + ww / 2, y]);
    }
    g.beginPath(); g.moveTo(L[0][0] - w * 0.6, base + 4);
    L.forEach(p => g.lineTo(p[0], p[1])); R.reverse().forEach(p => g.lineTo(p[0], p[1])); g.lineTo(R[R.length - 1][0] + w * 0.6, base + 4); g.fill();
    const nb = 2 + rng() * 5 | 0;
    for (let b = 0; b < nb; b++) {
      const k = 0.35 + rng() * 0.6, y = base - h * k, dir = rng() < 0.5 ? -1 : 1, len = w * (2 + rng() * 4);
      this.branch(g, rng, x + lean * k * k, y, dir, len, Math.max(1.2, w * 0.28 * (1 - k * 0.5)), 2);
    }
  },
  branch(g, rng, x, y, dir, len, w, depth) {
    const ex = x + dir * len, ey = y - len * (0.3 + rng() * 0.5);
    g.lineCap = 'round'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dir * len * 0.5, y - len * 0.05, ex, ey); g.stroke();
    if (depth > 0) for (let i = 0; i < 2; i++) this.branch(g, rng, lerp(x, ex, 0.5 + rng() * 0.5), lerp(y, ey, 0.6), dir * (rng() < 0.3 ? -1 : 1), len * (0.35 + rng() * 0.3), w * 0.55, depth - 1);
  },
  hills(g, rng, W, base, amp, H) {
    g.beginPath(); g.moveTo(0, H);
    const seeds = [rng() * 6, rng() * 6, rng() * 6];
    for (let x = 0; x <= W; x += 20) {
      const k = x / W * Math.PI * 2;
      g.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(k * 2 + seeds[0]) + 0.15 * Math.sin(k * 5 + seeds[1]) + 0.05 * Math.sin(k * 13 + seeds[2])));
    }
    g.lineTo(W, H); g.fill();
  },
  reeds(g, rng, x, base, h) {
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const xx = x + (rng() - 0.5) * 40, hh = h * (0.5 + rng() * 0.6), bend = (rng() - 0.3) * 18;
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(xx, base); g.quadraticCurveTo(xx + bend * 0.2, base - hh * 0.6, xx + bend, base - hh); g.stroke();
      if (rng() < 0.4) { g.beginPath(); g.ellipse(xx + bend * 0.9, base - hh * 0.92, 2.6, 8, bend * 0.02, 0, 7); g.fill(); }
    }
  },
  deadTree(g, rng, x, base, h) {
    g.lineCap = 'round'; const bend = (rng() - 0.5) * h * 0.5;
    g.lineWidth = h * 0.06; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + bend * 0.2, base - h * 0.6, x + bend, base - h); g.stroke();
    for (let i = 0; i < 4; i++) { const k = 0.4 + rng() * 0.5; this.branch(g, rng, x + bend * k * k, base - h * k, rng() < 0.5 ? -1 : 1, h * 0.3, h * 0.025, 1); }
  },
  building(g, rng, x, base, w, h) {
    g.fillRect(x, base - h, w, h + 4);
    const roof = rng();
    if (roof < 0.3) { g.beginPath(); g.moveTo(x - 4, base - h); g.lineTo(x + w / 2, base - h - w * 0.6); g.lineTo(x + w + 4, base - h); g.fill(); }
    else if (roof < 0.5) { g.beginPath(); g.arc(x + w / 2, base - h, w / 2, Math.PI, 0); g.fill(); g.fillRect(x + w / 2 - 1, base - h - w / 2 - 18, 2, 18); }
    else if (roof < 0.7) { for (let i = 0; i < w; i += 8) g.fillRect(x + i, base - h - 6 - (rng() * 14 | 0), 6, 20); }
    if (rng() < 0.35) { const tw = w * 0.3; g.fillRect(x + w * 0.6, base - h - h * 0.5, tw, h * 0.5); g.beginPath(); g.moveTo(x + w * 0.6 - 3, base - h * 1.5); g.lineTo(x + w * 0.6 + tw / 2, base - h * 1.5 - tw * 1.6); g.lineTo(x + w * 0.6 + tw + 3, base - h * 1.5); g.fill(); }
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let yy = base - h + 12; yy < base - 18; yy += 22) for (let xx = x + 6; xx < x + w - 10; xx += 14) if (rng() < 0.18) { g.globalAlpha = 0.25 + rng() * 0.4; g.fillRect(xx, yy, 6, 10); }
    if (rng() < 0.4) { g.globalAlpha = 0.5; g.beginPath(); g.arc(x + w / 2, base - 26, 12, Math.PI, 0); g.rect(x + w / 2 - 12, base - 26, 24, 26); g.fill(); }
    g.restore();
  },
  chimney(g, rng, x, base, w, h, tone) {
    g.beginPath(); g.moveTo(x - w * 0.6, base + 4); g.lineTo(x - w / 2, base - h); g.lineTo(x + w / 2, base - h); g.lineTo(x + w * 0.6, base + 4); g.fill();
    g.fillRect(x - w * 0.62, base - h - 6, w * 1.24, 8);
  },
  gear(g, x, y, r, teeth, rot) {
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a = rot + i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r : r * 1.14; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) { const a = rot + i / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66, r * 0.16, 0, 7); g.fill(); }
    g.restore();
  },
  island(g, rng, x, y, w) {
    g.beginPath(); g.moveTo(x - w / 2, y);
    for (let i = 0; i <= 8; i++) g.lineTo(x - w / 2 + w * i / 8, y - rng() * 6);
    const depth = w * (0.6 + rng() * 0.6);
    g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.3, y + depth * 0.35); g.lineTo(x + w * 0.1, y + depth * 0.7); g.lineTo(x - w * 0.02, y + depth); g.lineTo(x - w * 0.2, y + depth * 0.5); g.lineTo(x - w * 0.42, y + depth * 0.2); g.closePath(); g.fill();
    if (rng() < 0.7) this.deadTree(g, rng, x + (rng() - 0.5) * w * 0.4, y - 2, w * (0.3 + rng() * 0.4));
  }
};

function paintLayer(ch, depth, seed, W, H, base) {
  const rng = mulberry32(seed), c = mkCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = g.strokeStyle = '#000';
  const sc = [0.45, 0.7, 1][depth];
  if (ch === 0) {
    ART.hills(g, rng, W, base, 60 * sc, H);
    for (let x = 0; x < W; x += (28 + rng() * 90) / sc) ART.trunk(g, rng, x, base - 10, (8 + rng() * 26) * sc, H);
  } else if (ch === 1) {
    ART.hills(g, rng, W, base + 10, 26 * sc, H);
    for (let x = 0; x < W; x += (60 + rng() * 140) / sc) rng() < 0.4 ? ART.deadTree(g, rng, x, base, (120 + rng() * 260) * sc) : ART.reeds(g, rng, x, base + 6, (40 + rng() * 50) * sc);
  } else if (ch === 2) {
    ART.hills(g, rng, W, base, 20 * sc, H);
    for (let x = 0; x < W;) { const w = (50 + rng() * 120) * sc; ART.building(g, rng, x, base, w, (80 + rng() * 300) * sc * (depth === 0 ? 1.4 : 1)); x += w + rng() * 30 * sc; }
  } else if (ch === 3) {
    ART.hills(g, rng, W, base, 30 * sc, H);
    for (let x = 0; x < W; x += (90 + rng() * 200) / sc) {
      const r = rng();
      if (r < 0.4) ART.chimney(g, rng, x, base, (22 + rng() * 26) * sc, (200 + rng() * 300) * sc);
      else if (r < 0.75) ART.gear(g, x, base - (80 + rng() * 200) * sc, (30 + rng() * 70) * sc, 10 + rng() * 8 | 0, rng() * 6);
      else { g.fillRect(x, base - 260 * sc, 10 * sc, 260 * sc); g.fillRect(x - 60 * sc, base - 260 * sc, 160 * sc, 8 * sc); g.lineWidth = 2; g.beginPath(); g.moveTo(x + 90 * sc, base - 252 * sc); g.lineTo(x + 90 * sc, base - 120 * sc); g.stroke(); }
    }
  } else {
    for (let x = 0; x < W; x += (120 + rng() * 260) / sc) ART.island(g, rng, x, base - (rng() * 380 + 40) * sc, (60 + rng() * 160) * sc);
    ART.hills(g, rng, W, base + 120, 30 * sc, H);
  }
  return c;
}

class Renderer {
  constructor(canvas, VW, VH, S) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.resize(VW, VH, S);
    this.parts = []; this.shake = 0; this.flash = 0; this.layerCache = {};
    this.grain = [];
    for (let k = 0; k < 4; k++) {
      const c = mkCanvas(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0); this.grain.push(c);
    }
    const fs = mkCanvas(256, 256), fg = fs.getContext('2d'), gr = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 256, 256); this.fogSprite = fs;
    this.cam = { x: 0, y: 0 }; this.time = 0; this.Z = 1.45;
  }
  resize(VW, VH, S) {
    this.VW = VW; this.VH = VH; this.S = S;
    this.cv.width = Math.round(VW * S); this.cv.height = Math.round(VH * S);
    this.layerCache = {};
  }
  layers(ch) {
    if (this.layerCache[ch]) return this.layerCache[ch];
    const tones = [CHAPTERS[ch].sky[1], '#4b4b49', '#262625'];
    const blur = [5, 2.5, 1.1], out = [];
    const q = Math.min(this.S, 1.6);
    for (let d = 0; d < 3; d++) {
      const W = 2600, H = 1100, base = 820;
      const raw = paintLayer(ch, d, ch * 100 + d * 17 + 5, W, H, base);
      const c = mkCanvas(W * q, H * q), g = c.getContext('2d');
      g.filter = `blur(${blur[d] * q}px)`;
      g.drawImage(raw, 0, 0, W * q, H * q);
      g.filter = 'none'; g.globalCompositeOperation = 'source-in'; g.fillStyle = tones[d]; g.fillRect(0, 0, c.width, c.height);
      out.push({ c, W, H, base, q });
    }
    return (this.layerCache[ch] = out);
  }
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.dir !== undefined ? o.dir : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread || 6.28);
      const sp = (o.speed || 200) * (0.3 + Math.random() * 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp, life: (o.life || 1) * (0.5 + Math.random()), age: 0,
        size: (o.size || 3) * (0.5 + Math.random()), g: o.g === undefined ? 900 : o.g, col: o.col || INK, kind: o.kind || 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, drag: o.drag || 0 });
    }
  }
  onEvent(e, W) {
    const p = W.p;
    switch (e.name) {
      case 'land': if (e.v > 300) this.burst(p.x + 9, p.y + PHYS.PH, 6, { speed: 60, spread: 1.6, life: 0.5, size: 2, g: 100, col: 'rgba(40,40,40,0.8)', drag: 3 }); break;
      case 'death': {
        this.shake = Math.max(this.shake, e.kind === 'crush' || e.kind === 'dark' ? 14 : 8);
        if (e.kind !== 'water' && e.kind !== 'dark' && e.kind !== 'fall') {
          this.burst(e.x, e.y, 26, { speed: 330, life: 1.6, size: 4, kind: 'shard', vx: e.vx * 0.3 });
          this.burst(e.x, e.y, 12, { speed: 120, life: 1.2, size: 2, g: -20, col: 'rgba(255,250,235,0.9)', kind: 'glow', drag: 1.5 });
        }
        if (e.kind === 'dark') this.burst(e.x, e.y, 40, { speed: 80, life: 2, size: 5, g: -60, kind: 'smoke', drag: 1 });
        this.flash = 0.35; break;
      }
      case 'splash': this.burst(e.x + 9, p.y + PHYS.PH, 26, { speed: 300, spread: 1.4, life: 0.9, size: 2.5, col: 'rgba(30,30,30,0.9)' }); break;
      case 'slam': { const d = Math.abs(e.x - p.x); if (d < 700) this.shake = Math.max(this.shake, 9 * (1 - d / 700)); this.burst(e.x, W.L.crushers.find(c => Math.abs(c.x + c.w / 2 - e.x) < 2).gy, 14, { speed: 160, spread: 2.6, life: 0.8, size: 3, g: 300, col: 'rgba(30,30,30,0.7)', kind: 'smoke', drag: 2 }); break; }
      case 'rockLand': this.shake = Math.max(this.shake, 5); this.burst(e.x + 20, p.y + PHYS.PH, 10, { speed: 140, spread: 2.4, life: 0.7, size: 3, col: 'rgba(30,30,30,0.8)', kind: 'smoke', drag: 2 }); break;
      case 'ember': this.burst(e.x, p.y + 10, 18, { speed: 140, life: 1, size: 2, g: -40, col: 'rgba(255,248,225,1)', kind: 'glow', drag: 2 }); break;
      case 'saw': break;
    }
  }
  sky(ch, t) {
    const g = this.g, { VW, VH } = this, C = CHAPTERS[ch];
    const gr = g.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, C.sky[2]); gr.addColorStop(0.45, C.sky[0]); gr.addColorStop(0.75, C.sky[1]); gr.addColorStop(1, C.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    const lx = VW * C.light, ly = VH * 0.32, r = Math.max(VW, VH) * 0.75;
    const rg = g.createRadialGradient(lx, ly, 0, lx, ly, r);
    rg.addColorStop(0, 'rgba(255,255,250,0.55)'); rg.addColorStop(0.35, 'rgba(255,255,250,0.12)'); rg.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = rg; g.fillRect(0, 0, VW, VH);
  }
  rays(ch, t, a) {
    const g = this.g, { VW, VH } = this, lx = VW * CHAPTERS[ch].light - this.cam.x * 0.02 % 200, ly = -VH * 0.1;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const ang = 0.35 + i * 0.13 + Math.sin(t * 0.13 + i * 1.7) * 0.03, w = 0.035 + (i % 3) * 0.018;
      const L = VH * 1.6;
      const gr = g.createLinearGradient(lx, ly, lx + Math.sin(ang - 0.5) * L, ly + Math.cos(ang - 0.5) * L);
      const al = a * (0.05 + 0.04 * Math.sin(t * 0.4 + i * 2.1));
      gr.addColorStop(0, `rgba(255,255,245,${al})`); gr.addColorStop(1, 'rgba(255,255,245,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(lx, ly);
      g.lineTo(lx + Math.sin(ang - 0.5 - w) * L, ly + Math.cos(ang - 0.5 - w) * L);
      g.lineTo(lx + Math.sin(ang - 0.5 + w) * L, ly + Math.cos(ang - 0.5 + w) * L); g.fill();
    }
    g.restore();
  }
  fog(ch, t, amount, near) {
    const g = this.g, { VW, VH } = this;
    g.save(); g.globalAlpha = amount * (near ? 0.5 : 1);
    for (let i = 0; i < 7; i++) {
      const s = (near ? 900 : 700) + i * 90, sp = near ? 26 : 9;
      const x = ((i * 523 - this.cam.x * (near ? 1.2 : 0.4) + t * sp * (i % 2 ? 1 : 0.6)) % (VW + s * 1.5) + VW + s * 1.5) % (VW + s * 1.5) - s * 0.75;
      const y = (near ? VH * 0.82 : VH * 0.55) + Math.sin(t * 0.2 + i) * 30 + (i % 3) * 40;
      g.drawImage(this.fogSprite, x - s / 2, y - s * 0.22, s, s * 0.44);
    }
    g.restore();
  }
  drawLayers(ch) {
    const g = this.g, { VW, VH } = this, Ls = this.layers(ch), pfs = [0.12, 0.3, 0.55];
    for (let d = 0; d < 3; d++) {
      const Ly = Ls[d], pf = pfs[d];
      const horizon = lerp(VH * 0.62, (GY - this.cam.y) * this.Z, pf) - (2 - d) * 40;
      const y = horizon - Ly.base, ox = -((this.cam.x * pf) % Ly.W + Ly.W) % Ly.W;
      for (let x = ox; x < VW; x += Ly.W) g.drawImage(Ly.c, x, y, Ly.W, Ly.H);
      if (d === 1) this.fog(ch, this.time, CHAPTERS[ch].fog * 0.8, false);
    }
  }
  groundPath(s) {
    if (s._p) return s._p;
    const p = new Path2D(), rng = mulberry32(s.seed || 7);
    p.moveTo(s.x - 0.8, s.y + s.h);
    if (s.kind === 'ground') {
      p.lineTo(s.x - 0.8, s.y);
      for (const [ex, ey] of s.edge) p.lineTo(s.x + ex, s.y + ey * 0.6);
      p.lineTo(s.x + s.w + 0.8, s.y); p.lineTo(s.x + s.w + 0.8, s.y + s.h); p.closePath();
      for (let x = s.x + 2; x < s.x + s.w - 2; x += 3 + rng() * 5) {
        const h = 4 + rng() * 11 + (rng() < 0.08 ? 14 : 0), lean = (rng() - 0.5) * 7;
        p.moveTo(x - 1.6, s.y + 2); p.lineTo(x + lean, s.y - h); p.lineTo(x + 1.6, s.y + 2); p.closePath();
      }
      for (let i = 0; i < s.w / 140; i++) { // little mushrooms & stones
        const x = s.x + 10 + rng() * (s.w - 20); if (rng() < 0.5) { p.moveTo(x, s.y); p.ellipse(x, s.y, 5 + rng() * 6, 3 + rng() * 3, 0, Math.PI, 0); } }
      // hanging roots on cliff edges
      for (const side of [0, 1]) { const ex = side ? s.x + s.w : s.x; for (let i = 0; i < 3; i++) { const yy = s.y + 20 + rng() * 120; p.moveTo(ex, yy); p.quadraticCurveTo(ex + (side ? 6 : -6), yy + 20, ex + (side ? 2 : -2), yy + 30 + rng() * 40); p.lineTo(ex, yy + 4); } }
    } else { p.rect(s.x, s.y, s.w, s.h); }
    return (s._p = p);
  }
  drawPlayer(W, alpha) {
    const g = this.g, p = W.p, cx = p.x + PHYS.PW / 2, fy = p.y + PHYS.PH, f = p.face, t = W.t;
    const run = p.ground ? p.run : 0, ph = p.stepPh * Math.PI * 2, air = !p.ground;
    g.save(); g.globalAlpha = alpha; g.translate(cx, fy); g.scale(f, 1);
    const lean = p.push ? 0.28 : run * 0.12 + (air ? 0.05 : 0);
    const bob = p.ground ? Math.abs(Math.sin(ph)) * 2 * run : 0;
    g.fillStyle = g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    // legs
    const hipY = -13 - bob;
    const leg = (s) => {
      let th, kn;
      if (air) { th = p.vy < 0 ? -0.9 + s * 0.5 : -0.4 + s * 0.4; kn = 1.1; }
      else { th = Math.sin(ph + s * Math.PI) * 0.75 * run; kn = (0.3 + Math.max(0, -Math.cos(ph + s * Math.PI)) * 1.1) * run; }
      const kx = Math.sin(th) * 7.5, ky = hipY + Math.cos(th) * 7.5;
      const fx = kx + Math.sin(th - kn) * 7, fyy = ky + Math.cos(th - kn) * 7;
      g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, hipY); g.lineTo(kx, ky); g.lineTo(fx, Math.min(fyy, 0)); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(fx - 1, Math.min(fyy, 0)); g.lineTo(fx + 3.5, Math.min(fyy, 0)); g.stroke();
    };
    leg(1);
    g.save(); g.rotate(lean);
    // cloak body
    g.beginPath(); g.moveTo(-5, -26 - bob); g.quadraticCurveTo(-8, -18, -8.5 - run * 2, -9 - bob); g.lineTo(7, -10 - bob); g.quadraticCurveTo(6, -19, 5, -26 - bob); g.closePath(); g.fill();
    // hood + head
    g.beginPath(); g.arc(0.5, -31 - bob, 7.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-5, -36 - bob); g.quadraticCurveTo(-11 - run * 3, -37 - bob + Math.sin(t * 9) * run, -15 - run * 5, -31 - bob); g.quadraticCurveTo(-9, -30, -6, -26 - bob); g.fill();
    // arms
    const sw = air ? -0.8 : p.push ? -1.3 : Math.sin(ph) * 0.9 * run;
    g.lineWidth = 2.8;
    g.beginPath(); g.moveTo(0, -24 - bob); g.lineTo(Math.sin(-sw) * 9, -24 - bob + Math.cos(-sw) * 9); g.stroke();
    const la = p.push ? -1.45 : air ? -1.1 : -0.35 + sw * 0.3;
    const hx = Math.sin(-la) * 10 + 1, hy = -24 - bob + Math.cos(-la) * 10;
    g.beginPath(); g.moveTo(1, -24 - bob); g.lineTo(hx, hy); g.stroke();
    g.restore();
    leg(0);
    // lantern hangs from hand (swing)
    const lean2 = lean;
    const hxw = Math.cos(lean2) * 0 + (p.push ? 9 : 4 + run * 3), hyw = -14 - bob + (p.push ? -6 : 0);
    const sway = Math.sin(t * 3 + p.x * 0.05) * 0.15 - p.vx / PHYS.RUN * 0.25 * f;
    const lx = hxw + Math.sin(sway) * 7, ly = hyw + Math.cos(sway) * 7;
    g.lineWidth = 1; g.beginPath(); g.moveTo(hxw, hyw); g.lineTo(lx, ly); g.stroke();
    g.fillRect(lx - 3.5, ly, 7, 9); g.fillRect(lx - 4.5, ly - 1, 9, 2);
    g.restore();
    const wx = cx + lx * f, wy = fy + ly + 5;
    this.lantern = { x: wx, y: wy };
    // lantern core (drawn after, glows)
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'lighter';
    const fl = 0.85 + Math.sin(t * 17) * 0.06 + Math.sin(t * 7.3) * 0.08;
    const rg = g.createRadialGradient(wx, wy, 0, wx, wy, 26 * fl);
    rg.addColorStop(0, 'rgba(255,250,232,0.95)'); rg.addColorStop(0.15, 'rgba(255,245,220,0.55)'); rg.addColorStop(1, 'rgba(255,245,220,0)');
    g.fillStyle = rg; g.fillRect(wx - 30, wy - 30, 60, 60);
    g.restore();
  }
  drawHusk(h, t) {
    const g = this.g, x = huskX(h, t), dir = huskDir(h, t), w = h.w, base = h.y + h.h;
    const ph = t * h.speed / 9;
    g.save(); g.translate(x + w / 2, base); g.scale(dir, 1);
    g.fillStyle = g.strokeStyle = INK; g.lineCap = 'round';
    g.lineWidth = 3;
    for (let i = 0; i < 2; i++) { const a = Math.sin(ph + i * Math.PI) * 0.6; g.beginPath(); g.moveTo(0, -18); g.lineTo(Math.sin(a) * 9, -9); g.lineTo(Math.sin(a) * 12 + 2, 0); g.stroke(); }
    g.beginPath(); g.ellipse(2, -26, 12, 11, 0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(13, -32 + Math.sin(ph * 2) * 1.2, 7, 6, 0.2, 0, 7); g.fill();
    g.lineWidth = 2.2;
    for (let i = 0; i < 2; i++) { const a = Math.sin(ph + i * Math.PI + 1) * 0.7; g.beginPath(); g.moveTo(8, -28); g.quadraticCurveTo(18, -18, 16 + Math.sin(a) * 8, -4); g.stroke(); }
    g.fillStyle = 'rgba(190,190,180,0.55)'; g.beginPath(); g.arc(17, -33, 1.4, 0, 7); g.fill();
    g.restore();
  }
  drawSaw(s, t) {
    const g = this.g, p = sawPos(s, t), r = s.r;
    g.save(); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6;
    if (s.kind === 'v') { g.beginPath(); g.moveTo(s.x, s.y1 - 60); g.lineTo(s.x, s.gy); g.stroke(); }
    else { g.beginPath(); g.moveTo(s.x1 - 20, s.y); g.lineTo(s.x2 + 20, s.y); g.stroke(); }
    g.translate(p.x, p.y); g.rotate(t * 14); g.fillStyle = INK;
    g.beginPath();
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const rr = i % 2 ? r * 0.86 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(0, 0, r * 0.18, 0, 7); g.fill();
    g.restore();
  }
  drawWorld(W) {
    const g = this.g, L = W.L, t = W.t, x0 = this.cam.x - 200, x1 = this.cam.x + this.VW / this.Z + 200;
    const vis = o => o.x + (o.w || 0) > x0 && o.x < x1;
    // midground decor (parallax 0.85)
    g.save(); g.fillStyle = g.strokeStyle = 'rgba(28,28,27,0.85)';
    for (const d of L.decor) {
      if (d.t !== 'mid') continue;
      const sx = d.x - this.cam.x * 0.85 + this.cam.x; if (sx < x0 - 300 || sx > x1 + 300) continue;
      if (!d._c) d._c = this.decorSprite(L.ch, d);
      const s = d._c; g.drawImage(s.c, sx - s.ox, GY + 30 - s.oy - (this.cam.y - (GY - this.VH / this.Z * 0.62)) * 0.15, s.c.width / s.q, s.c.height / s.q);
    }
    g.restore();
    // water
    for (const w of L.water) if (vis(w)) {
      const gr = g.createLinearGradient(0, w.y, 0, w.y + 220); gr.addColorStop(0, 'rgba(26,26,26,0.94)'); gr.addColorStop(1, 'rgba(4,4,4,1)');
      g.fillStyle = gr; g.fillRect(w.x, w.y, w.w, w.h);
      g.strokeStyle = 'rgba(200,200,195,0.18)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = w.x; x <= w.x + w.w; x += 8) g.lineTo(x, w.y + 3 + i * 7 + Math.sin(x * 0.05 + t * (1.5 + i) + i) * 1.5); g.stroke(); }
    }
    // gates
    g.fillStyle = INK;
    for (const gt of L.gates) if (vis(gt)) {
      const y = gt.y - gt.open * (gt.h - 10);
      g.fillRect(gt.x, y, gt.w, gt.h);
      g.fillStyle = '#2a2a2a'; for (let k = 1; k < 3; k++) g.fillRect(gt.x + k * gt.w / 3 - 0.5, y, 1, gt.h);
      g.fillRect(gt.x - 2, y + 40, gt.w + 4, 4); g.fillRect(gt.x - 2, y + gt.h - 60, gt.w + 4, 4);
      g.fillStyle = INK; g.fillRect(gt.x - 10, gt.y - 30, gt.w + 20, 14); // lintel
    }
    // solids
    g.fillStyle = INK;
    for (const s of L.solids) if (vis(s) && s.kind !== 'bed') g.fill(this.groundPath(s));
    // hanging ropes of platforms
    g.strokeStyle = '#151515'; g.lineWidth = 1.5;
    for (const pl of L.plats) if (vis(pl)) {
      if (pl.kind === 'plat') {
        g.beginPath(); g.moveTo(pl.x + 8, pl.y); g.lineTo(pl.x + 8 - 30, this.cam.y - 10); g.moveTo(pl.x + pl.w - 8, pl.y); g.lineTo(pl.x + pl.w - 8 + 30, this.cam.y - 10); g.stroke();
        g.fillStyle = INK; g.fillRect(pl.x, pl.y, pl.w, pl.h); g.fillRect(pl.x + 6, pl.y + pl.h, 4, 6); g.fillRect(pl.x + pl.w - 10, pl.y + pl.h, 4, 6);
      } else {
        g.fillStyle = INK; g.beginPath(); g.ellipse(pl.x + pl.w / 2, pl.y + 7, pl.w / 2, 8, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(pl.x + 20, pl.y + 2); g.lineTo(pl.x + 14, pl.y - 12); g.lineTo(pl.x + 24, pl.y + 2); g.fill();
      }
    }
    // spikes / thorns
    for (const s of L.spikes) if (vis(s)) {
      if (!s._p) { const p = new Path2D(), rng = mulberry32(s.x | 0); for (let x = s.x; x < s.x + s.w; x += 5 + rng() * 3) { const h = 10 + rng() * 10; p.moveTo(x - 3, s.y + s.h + 1); p.lineTo(x + (rng() - 0.5) * 6, s.y + s.h - h - 2); p.lineTo(x + 3, s.y + s.h + 1); p.closePath(); } s._p = p; }
      g.fill(s._p);
    }
    // traps
    for (const tr of L.traps) if (vis(tr)) {
      g.save(); g.translate(tr.x + tr.w / 2, tr.y + tr.h);
      g.fillRect(-tr.w / 2 - 3, -3, tr.w + 6, 3);
      for (const sgn of [-1, 1]) {
        g.save(); g.rotate(sgn * (tr.shut ? 0.05 : 1.15));
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, tr.w / 2, sgn > 0 ? -Math.PI : -Math.PI / 2, sgn > 0 ? -Math.PI / 2 : 0); g.lineTo(0, 0); g.fill();
        g.restore();
      }
      g.restore();
    }
    // plates
    for (const pl of L.plates) if (vis(pl)) { g.fillStyle = '#2b2b2b'; g.fillRect(pl.x, pl.y + (pl.down ? 3 : 0), pl.w, pl.h); g.fillStyle = INK; }
    // levers
    for (const l of L.levers) if (vis(l)) {
      l.ang = lerp(l.ang, l.on ? 0.7 : -0.7, 0.15);
      g.beginPath(); g.ellipse(l.x, l.y, 14, 7, 0, Math.PI, 0); g.fill();
      g.save(); g.translate(l.x, l.y - 4); g.rotate(l.ang); g.fillRect(-2, -34, 4, 34); g.beginPath(); g.arc(0, -35, 4.5, 0, 7); g.fill(); g.restore();
    }
    // crates
    for (const c of L.crates) if (vis(c)) {
      g.fillStyle = INK; g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeStyle = '#262626'; g.lineWidth = 1.5;
      g.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      g.beginPath(); g.moveTo(c.x + 4, c.y + 4); g.lineTo(c.x + c.w - 4, c.y + c.h - 4); g.stroke();
    }
    // rocks
    for (const r of L.rocks) if (vis(r)) {
      g.strokeStyle = '#141414'; g.lineWidth = 2;
      if (r.state < 2) { g.beginPath(); g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2 + (r.state ? Math.sin(r.t * 40) * 3 : 0), this.cam.y - 10); g.stroke(); }
      g.fillStyle = INK; g.beginPath(); g.moveTo(r.x + 4, r.y + r.h); g.lineTo(r.x, r.y + r.h * 0.5); g.lineTo(r.x + r.w * 0.3, r.y + 2); g.lineTo(r.x + r.w * 0.75, r.y); g.lineTo(r.x + r.w, r.y + r.h * 0.45); g.lineTo(r.x + r.w - 3, r.y + r.h); g.fill();
    }
    // crushers
    for (const c of L.crushers) if (vis(c)) {
      const y = crusherY(c, t);
      g.strokeStyle = '#141414'; g.lineWidth = 3;
      for (const cx of [c.x + 14, c.x + c.w - 14]) { g.beginPath(); g.setLineDash([6, 3]); g.moveTo(cx, this.cam.y - 10); g.lineTo(cx, y); g.stroke(); }
      g.setLineDash([]);
      g.fillStyle = INK; g.fillRect(c.x, y, c.w, c.h);
      g.fillStyle = '#2b2b2b'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(c.x + 12 + i * (c.w - 24) / 2, y + 14 + j * (c.h - 28), 2.5, 0, 7); g.fill(); }
      g.fillStyle = INK; g.fillRect(c.x - 6, y + c.h - 10, c.w + 12, 10);
    }
    for (const s of L.saws) if ((s.kind === 'v' ? s.x : s.x2) > x0 && (s.kind === 'v' ? s.x : s.x1) < x1) this.drawSaw(s, t);
    for (const h of L.husks) if (h.x1 + h.range > x0 && h.x1 < x1) this.drawHusk(h, t);
    // embers
    for (const e of L.embers) if (!e.taken && e.x > x0 && e.x < x1) {
      const y = e.y + Math.sin(t * 2 + e.x) * 5;
      g.save(); g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(e.x, y, 0, e.x, y, 22); rg.addColorStop(0, 'rgba(255,250,235,0.9)'); rg.addColorStop(0.2, 'rgba(255,248,230,0.35)'); rg.addColorStop(1, 'rgba(255,248,230,0)');
      g.fillStyle = rg; g.fillRect(e.x - 24, y - 24, 48, 48); g.restore();
    }
    // tutorial glyphs
    g.save(); g.fillStyle = 'rgba(20,20,20,0.55)'; g.textAlign = 'center'; g.font = '600 15px "Josefin Sans", sans-serif';
    const lab = { move: (window.TOUCH ? '◀  ▶' : '←  →   or   A  D') + '  ·  walk', jump: (window.TOUCH ? 'JUMP' : 'SPACE') + '  ·  jump', act: (window.TOUCH ? 'GRAB' : 'E') + '  ·  pull the lever', push: 'walk into the crate to push it', run: 'RUN' };
    for (const s of L.signs) if (s.x > x0 && s.x < x1 && (s.lvl === undefined || s.lvl <= 3 || s.txt === 'run')) g.fillText(lab[s.txt].toUpperCase().split('').join(' '), s.x, s.y);
    g.restore();
    // exit light
    const ex = L.exitX, ey = L.exitY;
    if (ex > x0 && ex < x1 + 400) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(ex - 90, 0, ex + 90, 0);
      gr.addColorStop(0, 'rgba(255,255,245,0)'); gr.addColorStop(0.5, `rgba(255,255,245,${0.28 + Math.sin(t * 2) * 0.05})`); gr.addColorStop(1, 'rgba(255,255,245,0)');
      g.fillStyle = gr; g.fillRect(ex - 90, this.cam.y - 20, 180, ey - this.cam.y + 20);
      const rg = g.createRadialGradient(ex, ey - 40, 0, ex, ey - 40, 160); rg.addColorStop(0, 'rgba(255,255,245,0.5)'); rg.addColorStop(1, 'rgba(255,255,245,0)');
      g.fillStyle = rg; g.fillRect(ex - 170, ey - 200, 340, 260);
      g.restore();
      if (Math.random() < 0.3) this.burst(ex + (Math.random() - 0.5) * 80, ey, 1, { speed: 30, life: 2.5, size: 1.6, g: -50, col: 'rgba(255,255,240,0.9)', kind: 'glow' });
    }
  }
  decorSprite(ch, d) {
    const rng = mulberry32(d.x | 0), q = Math.min(this.S, 1.6), H = 760, Wd = 420;
    const c = mkCanvas(Wd * q, H * q), g = c.getContext('2d'); g.scale(q, q); g.fillStyle = g.strokeStyle = '#000';
    const base = H - 20, cx = Wd / 2, s = d.s;
    if (ch === 0) ART.trunk(g, rng, cx, base, 14 * s + 8, H);
    else if (ch === 1) { if (rng() < 0.5) ART.reeds(g, rng, cx, base, 90 * s); else ART.deadTree(g, rng, cx, base, 300 * s); }
    else if (ch === 2) { const h = 140 + 200 * s; g.fillRect(cx - 9, base - h, 18, h); g.fillRect(cx - 16, base - h - 8, 32, 10); g.fillRect(cx - 16, base - 10, 32, 10); if (rng() < 0.5) { g.lineWidth = 3; g.beginPath(); g.moveTo(cx, base - h - 8); g.quadraticCurveTo(cx + 30, base - h - 40, cx + 40, base - h - 20); g.stroke(); g.fillRect(cx + 34, base - h - 22, 12, 16); } }
    else if (ch === 3) { const h = 300 + 300 * s; g.fillRect(cx - 30, base - h, 9, h); g.fillRect(cx + 30, base - h, 9, h); g.lineWidth = 2.5; g.beginPath(); for (let y = base - h, k = 0; y < base; y += 46, k++) { g.moveTo(cx - 25, y); g.lineTo(cx + 34, y + 46); g.moveTo(cx + 34, y); g.lineTo(cx - 25, y + 46); } g.stroke(); g.fillRect(cx - 40, base - h, 90, 10); if (rng() < 0.6) { g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 45, base - h); g.lineTo(cx + 45, base - h + 120 + rng() * 140); g.stroke(); g.fillRect(cx + 38, base - h + 120, 14, 14); } }
    else { if (rng() < 0.6) { g.fillRect(cx - 3, base - 60 - 80 * s, 6, 60 + 80 * s); g.beginPath(); g.moveTo(cx - 12, base - 60 - 80 * s); g.lineTo(cx, base - 100 - 100 * s); g.lineTo(cx + 12, base - 60 - 80 * s); g.fill(); } else ART.island(g, rng, cx, base - 260 - 200 * rng(), 40 + 50 * s); }
    const out = mkCanvas(c.width, c.height), og = out.getContext('2d'); og.filter = `blur(${0.8 * q}px)`; og.drawImage(c, 0, 0);
    og.filter = 'none'; og.globalCompositeOperation = 'source-in'; og.fillStyle = '#1e1e1d'; og.fillRect(0, 0, out.width, out.height);
    return { c: out, ox: cx, oy: base, q };
  }
  drawParts(dt) {
    const g = this.g;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.age += dt; if (p.age > p.life) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.5; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = 1 - p.age / p.life;
      g.save(); g.globalAlpha = a;
      if (p.kind === 'glow') { g.globalCompositeOperation = 'lighter'; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill(); }
      else if (p.kind === 'shard') { g.fillStyle = p.col; g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.moveTo(-p.size, -p.size * 0.4); g.lineTo(p.size, 0); g.lineTo(-p.size * 0.3, p.size * 0.7); g.fill(); }
      else if (p.kind === 'smoke') { g.globalAlpha = a * 0.5; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + p.age * 4), 0, 7); g.fill(); }
      else if (p.kind === 'rain') { g.strokeStyle = p.col; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke(); }
      else { g.fillStyle = p.col; g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
      g.restore();
    }
  }
  ambientParts(ch, dt, W) {
    const r = Math.random, VW = this.VW / this.Z, VH = this.VH / this.Z, cx = this.cam.x, cy = this.cam.y;
    const rate = [0.6, 1.2, 0.5, 1.4, 1][ch];
    if (r() < rate * dt * 6) {
      if (ch === 0) this.burst(cx + r() * VW * 1.2, cy - 20, 1, { speed: 20, life: 7, size: 3.5, g: 25, col: 'rgba(10,10,10,0.8)', kind: 'shard', drag: 0.6, vx: -20 });
      if (ch === 1) for (let i = 0; i < 6; i++) this.parts.push({ x: cx + r() * VW * 1.3, y: cy - 10, vx: -60, vy: 700, life: 1.4, age: 0, size: 1, g: 0, col: 'rgba(30,30,30,0.35)', kind: 'rain', rot: 0, vr: 0, drag: 0 });
      if (ch === 2 || ch === 4) this.burst(cx + r() * VW, cy + r() * VH, 1, { speed: 8, life: 6, size: 1.4, g: -4, col: ch === 4 ? 'rgba(255,255,255,0.8)' : 'rgba(240,240,230,0.5)', kind: 'glow', drag: 0.2 });
      if (ch === 3) this.burst(cx + r() * VW * 1.2, cy - 10, 1, { speed: 15, life: 6, size: 2, g: 20, col: 'rgba(25,25,25,0.6)', kind: 'dot', drag: 0.4, vx: -25 });
    }
  }
  fore(W) {
    const g = this.g, L = W.L;
    for (const d of L.decor) {
      if (d.t !== 'fore') continue;
      const sx = d.x - this.cam.x * 1.35; if (sx < -500 || sx > this.VW + 500) continue;
      if (!d._f) {
        const q = Math.min(this.S, 1.5), c = mkCanvas(500 * q, 700 * q), cg = c.getContext('2d'); cg.scale(q, q); cg.fillStyle = cg.strokeStyle = '#000';
        const rng = mulberry32(d.x | 0);
        if (d.r < 0.5) { for (let i = 0; i < 26; i++) { const x = 250 + (rng() - 0.5) * 300, h = 80 + rng() * 220 * d.s; cg.beginPath(); cg.moveTo(x - 7, 700); cg.quadraticCurveTo(x + (rng() - 0.5) * 60, 700 - h * 0.6, x + (rng() - 0.5) * 80, 700 - h); cg.lineTo(x + 7, 700); cg.fill(); } d._fy = 'bottom'; }
        else { ART.branch(cg, rng, 0, 30, 1, 360 * d.s, 22, 3); cg.fillRect(0, 0, 500, 30); d._fy = 'top'; }
        const o = mkCanvas(c.width, c.height), og = o.getContext('2d'); og.filter = `blur(${5 * q}px)`; og.drawImage(c, 0, 0); d._f = o; d._q = q;
      }
      const h = d._f.height / d._q, w = d._f.width / d._q;
      g.drawImage(d._f, sx, d._fy === 'bottom' ? this.VH - h + 120 : -40, w, h);
    }
  }
  post(ch, t, W, fade) {
    const g = this.g, { VW, VH } = this;
    // lantern bloom in screen space
    if (this.lantern && !W.p.dead) {
      const lx = (this.lantern.x - this.cam.x) * this.Z, ly = (this.lantern.y - this.cam.y) * this.Z;
      g.save(); g.globalCompositeOperation = 'screen';
      const fl = 1 + Math.sin(t * 13) * 0.04 + Math.sin(t * 5.1) * 0.05;
      const rg = g.createRadialGradient(lx, ly, 0, lx, ly, 230 * fl);
      rg.addColorStop(0, 'rgba(255,248,226,0.30)'); rg.addColorStop(0.4, 'rgba(255,248,226,0.08)'); rg.addColorStop(1, 'rgba(255,248,226,0)');
      g.fillStyle = rg; g.fillRect(0, 0, VW, VH); g.restore();
    }
    // chase darkness
    if (W.chaseX !== null && W.chaseX !== undefined) {
      const sx = (W.chaseX - this.cam.x) * this.Z;
      if (sx > -400) {
        g.save();
        const gr = g.createLinearGradient(sx - 300, 0, sx + 120, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, Math.max(0, sx + 120), VH);
        g.fillStyle = '#000';
        for (let i = 0; i < 18; i++) { const y = i / 17 * VH, len = 60 + Math.sin(t * 3 + i * 1.3) * 40 + Math.sin(t * 7 + i) * 15; g.beginPath(); g.moveTo(sx - 20, y - 30); g.quadraticCurveTo(sx + len * 0.6, y + Math.sin(t * 4 + i) * 20, sx + len, y); g.quadraticCurveTo(sx + len * 0.5, y + 20, sx - 20, y + 30); g.fill(); }
        g.restore();
      }
    }
    // vignette
    const vg = g.createRadialGradient(VW / 2, VH * 0.5, Math.min(VW, VH) * 0.3, VW / 2, VH * 0.5, Math.max(VW, VH) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    // death flash (desaturate dim)
    if (this.flash > 0) { g.fillStyle = `rgba(0,0,0,${this.flash * 0.6})`; g.fillRect(0, 0, VW, VH); }
    // film grain + flicker
    g.save(); g.globalAlpha = 0.085; g.globalCompositeOperation = 'overlay';
    const gc = this.grain[(t * 24 | 0) % 4], pat = g.createPattern(gc, 'repeat');
    g.translate(-Math.random() * 256, -Math.random() * 256); g.fillStyle = pat; g.fillRect(0, 0, VW + 256, VH + 256);
    g.restore();
    const fl = 0.025 * (Math.sin(t * 23) * 0.5 + Math.sin(t * 61) * 0.5);
    if (fl > 0) { g.fillStyle = `rgba(0,0,0,${fl})`; g.fillRect(0, 0, VW, VH); }
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, VW, VH); }
  }
  updateCam(W, dt, snap) {
    const p = W.p, VW = this.VW / this.Z, VH = this.VH / this.Z;
    const look = clamp(p.vx * 0.35, -90, 90);
    const tx = p.x + PHYS.PW / 2 - VW * (VW > VH ? 0.4 : 0.3) + look;
    let gy = p.ground ? p.y + PHYS.PH : (this.lastGy || p.y + PHYS.PH);
    if (p.ground) this.lastGy = gy;
    if (!p.ground && p.y + PHYS.PH > gy + 60) gy = p.y + PHYS.PH;
    const ty = gy - VH * (VW > VH ? 0.68 : 0.62);
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 2.4);
  }
  frame(W, dt, opts = {}) {
    const g = this.g, L = W.L, ch = L.ch, t = W.t;
    this.time = t;
    this.shake = Math.max(0, this.shake - dt * 30); this.flash = Math.max(0, this.flash - dt * 0.5);
    g.setTransform(this.S, 0, 0, this.S, 0, 0);
    this.sky(ch, t);
    this.rays(ch, t, 1);
    this.drawLayers(ch);
    this.fog(ch, t, CHAPTERS[ch].fog * 0.6, false);
    const sh = this.shake, sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    g.save(); g.scale(this.Z, this.Z); const SZ = this.S * this.Z; g.translate(-Math.round((this.cam.x + sx) * SZ) / SZ, -Math.round((this.cam.y + sy) * SZ) / SZ);
    this.drawWorld(W);
    const p = W.p;
    if (!p.dead) this.drawPlayer(W, 1);
    else if (p.dtype === 'water') this.drawPlayer(W, Math.max(0, 1 - p.deadT));
    this.ambientParts(ch, dt, W);
    this.drawParts(dt);
    g.restore();
    this.fog(ch, t, CHAPTERS[ch].fog * 0.45, true);
    this.fore(W);
    this.post(ch, t, W, opts.fade || 0);
  }
}
