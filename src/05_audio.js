/* ---------------- Audio: fully synthesized SFX, ambience and music ---------------- */

const SND = {
  ctx: null, ready: false, vol: { master: 0.9, sfx: 1, music: 0.55, amb: 0.8 },
  init(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.out = c.createDynamicsCompressor();
    this.out.threshold.value = -14; this.out.ratio.value = 4; this.out.attack.value = 0.005; this.out.release.value = 0.2;
    this.out.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(this.out);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.4, 2.6);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.55; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.sfxVerb = c.createGain(); this.sfxVerb.gain.value = 0.25; this.sfx.connect(this.sfxVerb); this.sfxVerb.connect(this.verb);
    this.mus = c.createGain(); this.mus.gain.value = this.vol.music; this.mus.connect(this.master);
    this.musVerb = c.createGain(); this.musVerb.gain.value = 0.9; this.mus.connect(this.musVerb); this.musVerb.connect(this.verb);
    this.amb = c.createGain(); this.amb.gain.value = this.vol.amb; this.amb.connect(this.master);
    this.duck = c.createGain(); this.duck.gain.value = 1; this.duck.connect(this.mus);
    // noise
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const bl = c.createBuffer(1, len, c.sampleRate), bd = bl.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bl;
    this.ready = true; this.nextAmb = 0; this.nextMus = 0; this.chord = 0; this.chapter = 0;
    if (!this.manual) this.startAmbience(0);
  },
  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  },
  now(at) { return at !== undefined ? at : this.ctx.currentTime + 0.01; },
  env(g, t, a, peak, dcy, end) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); },
  nz(t, dur, type, f, q, peak, a, dest, buf) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf || this.noise; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    const g = c.createGain(); this.env(g, t, a || 0.005, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
    return fl;
  },
  osc(t, type, f0, f1, dur, peak, a, dest) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); this.env(g, t, a || 0.005, peak, dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.1);
    return o;
  },
  play(name, o = {}) {
    if (!this.ready) return;
    const t = this.now(o.at), v = o.vol === undefined ? 1 : o.vol;
    if (v < 0.02) return;
    const r = () => 0.85 + Math.random() * 0.3;
    switch (name) {
      case 'step':
        if (o.surf === 'gate' || o.surf === 'rubble') this.nz(t, 0.05, 'bandpass', 700 * r(), 1.2, 0.18 * v);
        else { this.nz(t, 0.07, 'bandpass', 1900 * r(), 0.9, 0.09 * v); this.nz(t, 0.05, 'lowpass', 260, 1, 0.22 * v, 0.003, this.sfx, this.brown); }
        break;
      case 'jump': this.nz(t, 0.16, 'bandpass', 1300 * r(), 1.5, 0.06 * v, 0.02); this.nz(t, 0.06, 'highpass', 3500, 0.7, 0.04 * v); break;
      case 'land': this.osc(t, 'sine', 110, 40, 0.14, 0.35 * v); this.nz(t, 0.09, 'lowpass', 500, 0.8, 0.25 * v); break;
      case 'push': this.nz(t, 0.3, 'bandpass', 380 * r(), 3, 0.2 * v, 0.03); this.nz(t, 0.25, 'bandpass', 1500, 4, 0.04 * v, 0.03); break;
      case 'crateLand': this.osc(t, 'sine', 90, 35, 0.25, 0.5 * v); this.nz(t, 0.18, 'lowpass', 700, 1, 0.35 * v); break;
      case 'lever': {
        const f = this.nz(t, 0.35, 'bandpass', 600, 8, 0.25 * v, 0.02); f.frequency.linearRampToValueAtTime(1100, t + 0.3);
        this.osc(t + 0.3, 'square', 180, 60, 0.12, 0.12 * v); this.nz(t + 0.3, 0.12, 'lowpass', 900, 1, 0.3 * v); break;
      }
      case 'gate': case 'gateShut': {
        const f = this.nz(t, 1.3, 'lowpass', 180, 2, 0.35 * v, 0.2, this.sfx, this.brown); f.frequency.linearRampToValueAtTime(320, t + 1.2);
        this.osc(t, 'sawtooth', 48, 42, 1.3, 0.06 * v, 0.2);
        if (name === 'gateShut') this.osc(t + 1.2, 'sine', 70, 30, 0.4, 0.6 * v);
        break;
      }
      case 'plate': this.osc(t, 'sine', 300, 120, 0.12, 0.25 * v); this.nz(t, 0.06, 'bandpass', 2400, 2, 0.12 * v); break;
      case 'slam': this.osc(t, 'sine', 70, 28, 0.6, 0.9 * v); this.nz(t, 0.5, 'lowpass', 400, 0.7, 0.7 * v, 0.003, this.sfx, this.brown); this.nz(t, 0.12, 'bandpass', 2600, 2, 0.12 * v); break;
      case 'creak': for (let i = 0; i < 5; i++) this.nz(t + i * 0.035, 0.03, 'bandpass', 3800 + i * 300, 9, 0.08 * v); break;
      case 'saw': { const o1 = this.osc(t, 'sawtooth', 160, 240, 0.7, 0.07 * v, 0.1); this.nz(t, 0.7, 'bandpass', 4200, 3, 0.07 * v, 0.1); break; }
      case 'rockSnap': this.nz(t, 0.05, 'highpass', 2500, 1, 0.25 * v); this.nz(t + 0.04, 0.4, 'bandpass', 900, 1, 0.06 * v, 0.05); break;
      case 'rockLand': this.osc(t, 'sine', 80, 30, 0.4, 0.8 * v); this.nz(t, 0.35, 'lowpass', 600, 0.8, 0.6 * v, 0.002, this.sfx, this.brown); break;
      case 'trap': this.nz(t, 0.04, 'highpass', 3000, 1, 0.5 * v); this.osc(t, 'square', 1800, 900, 0.08, 0.12 * v); break;
      case 'splash': { const f = this.nz(t, 0.5, 'lowpass', 3000, 0.6, 0.5 * v); f.frequency.exponentialRampToValueAtTime(300, t + 0.5); for (let i = 0; i < 6; i++) this.osc(t + 0.15 + i * 0.09 * r(), 'sine', 500 * r(), 900 * r(), 0.05, 0.06 * v); break; }
      case 'ember': [1320, 1980, 2640].forEach((f, i) => this.osc(t + i * 0.05, 'sine', f, f, 1.6, 0.07 * v, 0.004)); break;
      case 'checkpoint': this.nz(t, 0.9, 'bandpass', 800, 3, 0.04 * v, 0.4); break;
      case 'exit': [220, 277, 330, 440, 554].forEach((f, i) => this.osc(t + i * 0.12, 'sine', f, f, 3.2, 0.08, 0.6, this.mus)); this.nz(t, 2.5, 'highpass', 5000, 0.5, 0.03, 1.2); break;
      case 'respawn': this.nz(t, 0.6, 'bandpass', 900, 1.2, 0.04 * v, 0.4); break;
      case 'ui': this.osc(t, 'sine', 660, 660, 0.12, 0.08); this.osc(t, 'sine', 990, 990, 0.2, 0.03); break;
      case 'title': [110, 165, 220].forEach((f, i) => this.osc(t + i * 0.3, 'sine', f, f, 4, 0.12, 1.2, this.mus)); break;
      case 'death': this.death(t, o.kind, v); break;
    }
  },
  death(t, kind, v) {
    // the world goes quiet, then a low boom swallows everything
    this.duck.gain.cancelScheduledValues(t); this.duck.gain.setValueAtTime(1, t); this.duck.gain.linearRampToValueAtTime(0.15, t + 0.1); this.duck.gain.linearRampToValueAtTime(1, t + 3);
    switch (kind) {
      case 'spike': this.nz(t, 0.12, 'highpass', 1800, 0.7, 0.5 * v); this.osc(t, 'sine', 140, 40, 0.3, 0.6 * v); break;
      case 'trap': this.nz(t, 0.2, 'bandpass', 1200, 2, 0.3 * v); break;
      case 'water': for (let i = 0; i < 10; i++) this.osc(t + 0.2 + i * 0.12, 'sine', 300 + Math.random() * 500, 700 + Math.random() * 400, 0.06, 0.05 * v); this.nz(t, 1.2, 'lowpass', 400, 1, 0.2 * v, 0.1, this.sfx, this.brown); break;
      case 'crush': this.osc(t, 'sine', 60, 25, 0.7, 1 * v); this.nz(t, 0.2, 'bandpass', 1400, 1, 0.5 * v); break;
      case 'blade': { const f = this.nz(t, 0.4, 'bandpass', 3000, 6, 0.35 * v); f.frequency.exponentialRampToValueAtTime(700, t + 0.4); this.osc(t, 'sawtooth', 900, 200, 0.3, 0.1 * v); break; }
      case 'husk': this.osc(t, 'sawtooth', 70, 45, 0.9, 0.18 * v, 0.05); this.nz(t, 0.8, 'lowpass', 300, 4, 0.4 * v, 0.05, this.sfx, this.brown); break;
      case 'dark': { const f = this.nz(t, 1.4, 'lowpass', 200, 1, 0.6 * v, 0.6, this.sfx, this.brown); f.frequency.exponentialRampToValueAtTime(3000, t + 1.2); break; }
      case 'fall': { const f = this.nz(t, 0.9, 'bandpass', 600, 1, 0.2 * v, 0.3); f.frequency.exponentialRampToValueAtTime(200, t + 0.9); break; }
    }
    this.osc(t + 0.05, 'sine', 55, 30, 2.2, 0.55, 0.01);
    this.osc(t + 0.1, 'sine', 3100, 3100, 2.5, 0.012, 0.2);
  },
  // ---------- ambience & generative score ----------
  startAmbience(ch, at) {
    const c = this.ctx, t = at !== undefined ? at : c.currentTime;
    if (this.ambNodes) this.ambNodes.forEach(n => { try { n.g.gain.setTargetAtTime(0.0001, t, 0.6); n.s.stop(t + 3); } catch (e) {} });
    this.ambNodes = [];
    const wind = c.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = [500, 320, 650, 420, 900][ch]; bp.Q.value = 0.8;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t);
    const wg = c.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime([0.10, 0.07, 0.08, 0.06, 0.11][ch], t + 2.5);
    wind.connect(bp); bp.connect(wg); wg.connect(this.amb); wind.start(t);
    this.ambNodes.push({ s: wind, g: wg }, { s: lfo, g: lg });
    const drone = c.createBufferSource(); drone.buffer = this.brown; drone.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    const dg = c.createGain(); dg.gain.setValueAtTime(0.0001, t); dg.gain.exponentialRampToValueAtTime([0.25, 0.3, 0.22, 0.35, 0.2][ch], t + 3);
    drone.connect(lp); lp.connect(dg); dg.connect(this.amb); drone.start(t);
    this.ambNodes.push({ s: drone, g: dg });
    [55, 82.4].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * [1, 0.94, 1.06, 0.89, 1.12][ch];
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 4);
      o.connect(g); g.connect(this.duck); o.start(t); this.ambNodes.push({ s: o, g });
    });
    this.chapter = ch; this.nextAmb = Math.max(this.nextAmb, t + 1); this.nextMus = Math.max(this.nextMus, t + 0.5);
  },
  schedule(until) {
    if (!this.ready) return;
    const ch = this.chapter;
    while (this.nextAmb < until) {
      const t = this.nextAmb;
      if (ch === 0) { const f = 2400 + Math.random() * 1600; for (let i = 0; i < 2 + Math.random() * 3; i++) this.osc(t + i * 0.11, 'sine', f, f * 1.25, 0.07, 0.012, 0.005, this.amb); }
      if (ch === 1) { if (Math.random() < 0.6) this.osc(t, 'sine', 1400 + Math.random() * 900, 400, 0.05, 0.03, 0.002, this.amb); else this.osc(t, 'square', 90, 70, 0.18, 0.01, 0.02, this.amb); }
      if (ch === 2) { const f = [196, 233, 262][Math.random() * 3 | 0]; this.osc(t, 'sine', f, f, 4, 0.02, 0.003, this.amb); this.osc(t, 'sine', f * 2.76, f * 2.76, 2, 0.006, 0.003, this.amb); }
      if (ch === 3) { this.nz(t, 0.15, 'bandpass', 1500 + Math.random() * 2000, 12, 0.05, 0.002, this.amb); this.osc(t, 'sine', 60, 40, 0.4, 0.06, 0.005, this.amb); }
      if (ch === 4) { const f = 880 * Math.pow(2, [0, 3, 7, 10, 12][Math.random() * 5 | 0] / 12); this.osc(t, 'sine', f, f, 5, 0.008, 2, this.amb); }
      this.nextAmb += 3 + Math.random() * 6;
    }
    // score: slow minor progression with sparse piano-like notes
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [52, 55, 59], [53, 57, 60]];
    const mt = n => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextMus < until) {
      const t = this.nextMus, chord = prog[this.chord % prog.length]; this.chord++;
      chord.forEach((n, i) => {
        const c = this.ctx, o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mt(n - 12) * (1 + (i - 1) * 0.002);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 3); g.gain.exponentialRampToValueAtTime(0.0001, t + 9.5);
        o.connect(f); f.connect(g); g.connect(this.duck); o.start(t); o.stop(t + 10);
      });
      for (let k = 0; k < 3; k++) if (Math.random() < 0.7) {
        const n = chord[Math.random() * 3 | 0] + 12 + (Math.random() < 0.3 ? 12 : 0), tt = t + 1 + k * 2.4 + Math.random() * 0.6;
        this.osc(tt, 'sine', mt(n), mt(n), 3.2, 0.045, 0.004, this.duck);
        this.osc(tt, 'sine', mt(n) * 2, mt(n) * 2, 1.2, 0.012, 0.004, this.duck);
      }
      this.nextMus += 8;
    }
  },
  setVol(k, v) { this.vol[k] = v; if (!this.ready) return; const n = { master: this.master, sfx: this.sfx, music: this.mus, amb: this.amb }[k]; n.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
};
