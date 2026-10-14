/* ---------------- Game shell: story flow, menus, input, saving ---------------- */

const Q = new URLSearchParams(location.search);
window.TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');

const Save = {
  key: 'umbral.save.v1',
  data: { unlocked: 1, current: 1, embers: {}, deaths: 0, time: 0, finished: false, vol: { master: 0.9, music: 0.55, sfx: 1 } },
  load() { try { const s = JSON.parse(localStorage.getItem(this.key)); if (s) Object.assign(this.data, s); } catch (e) {} },
  store() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
  totalEmbers() { return Object.values(this.data.embers).reduce((a, b) => a + b, 0); }
};

const Input = {
  keys: {}, pressed: {}, touch: {}, pad: {},
  init() {
    addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.pressed[e.code] = true; this.keys[e.code] = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    document.querySelectorAll('[data-touch]').forEach(b => {
      const k = b.dataset.touch;
      const on = e => { e.preventDefault(); if (!this.touch[k]) this.pressed['T' + k] = true; this.touch[k] = true; b.classList.add('on'); Game.unlockAudio(); };
      const off = e => { e.preventDefault(); this.touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
      b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
    });
  },
  read() {
    const k = this.keys, t = this.touch, P = this.pressed;
    let gp = null; try { gp = (navigator.getGamepads && navigator.getGamepads()[0]) || null; } catch (e) {}
    const ax = gp ? gp.axes[0] : 0, gb = i => gp && gp.buttons[i] && gp.buttons[i].pressed;
    const padJump = gb(0), padAct = gb(2) || gb(1);
    const inp = {
      left: k.ArrowLeft || k.KeyA || t.left || ax < -0.4 || gb(14),
      right: k.ArrowRight || k.KeyD || t.right || ax > 0.4 || gb(15),
      jump: k.Space || k.ArrowUp || k.KeyW || t.jump || padJump,
      jumpPressed: P.Space || P.ArrowUp || P.KeyW || P.Tjump || (padJump && !this.pad.j),
      act: k.KeyE || k.ArrowDown || k.KeyS || k.ShiftLeft || t.act || padAct
    };
    this.pad.j = padJump; this.pad.start = gb(9);
    this.pressed = {};
    return inp;
  }
};

const $ = s => document.querySelector(s);

const Game = {
  state: 'title', world: null, lvl: 1, fade: 1, fadeTo: 0, acc: 0, last: 0, story: null, card: null, attract: null, levelTime: 0,
  init() {
    Save.load();
    this.canvas = $('#game');
    const VW = 1280, VH = 720;
    this.R = new Renderer(this.canvas, VW, VH, this.dpr());
    addEventListener('resize', () => this.R.resize(VW, VH, this.dpr()));
    Input.init();
    this.bindUI();
    this.attractWorld();
    if (Q.has('level')) { this.startLevel(+Q.get('level')); }
    requestAnimationFrame(t => this.loop(t));
  },
  dpr() { const r = this.canvas.getBoundingClientRect(); return clamp(Math.max(r.width / 1280, (window.devicePixelRatio || 1) * r.width / 1280), 0.6, 2); },
  unlockAudio() {
    if (SND.ready) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; const ctx = new AC();
      SND.init(ctx); ['master', 'music', 'sfx'].forEach(k => SND.setVol(k, Save.data.vol[k]));
      SND.play('title');
      setInterval(() => SND.schedule(SND.ctx.currentTime + 2), 500);
    } catch (e) { console.warn('audio unavailable', e); }
  },
  attractWorld() {
    const L = buildLevel(1 + Math.floor(Math.random() * 5) * 20 + 1);
    this.attract = new World(L); this.attract.bot = { wantDie: 0 };
    this.R.updateCam(this.attract, 1, true);
  },
  bindUI() {
    const show = id => { document.querySelectorAll('.panel').forEach(p => p.classList.toggle('hidden', p.id !== id)); };
    this.show = show;
    $('#btn-continue').classList.toggle('hidden', Save.data.current <= 1 && !Save.data.finished);
    $('#btn-continue').textContent = `Continue  ·  ${Save.data.current}`;
    document.body.addEventListener('pointerdown', () => this.unlockAudio(), { once: false });
    document.body.addEventListener('keydown', () => this.unlockAudio());
    const click = (sel, fn) => $(sel).addEventListener('click', e => { this.unlockAudio(); SND.play('ui'); fn(e); });
    click('#btn-continue', () => this.startLevel(Save.data.current));
    click('#btn-new', () => { Save.data.current = 1; Save.store(); this.startLevel(1); });
    click('#btn-chapters', () => { this.buildChapters(); show('chapters'); });
    click('#btn-settings', () => show('settings'));
    click('#btn-how', () => show('how'));
    document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => { SND.play('ui'); show(this.state === 'paused' ? 'pause' : 'menu'); }));
    click('#btn-resume', () => this.resume());
    click('#btn-restart', () => { this.resume(); this.world.kill('fall'); });
    click('#btn-pchapters', () => { this.buildChapters(); show('chapters'); });
    click('#btn-psettings', () => show('settings'));
    click('#btn-quit', () => this.toTitle());
    click('#btn-end', () => this.toTitle());
    ['master', 'music', 'sfx'].forEach(k => {
      const el = $('#vol-' + k); el.value = Save.data.vol[k];
      el.addEventListener('input', () => { Save.data.vol[k] = +el.value; SND.setVol(k, +el.value); Save.store(); });
    });
    $('#pausebtn').addEventListener('click', () => this.pause());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
  },
  buildChapters() {
    const box = $('#chapter-grid'); box.innerHTML = '';
    CHAPTERS.forEach((C, ci) => {
      const sec = document.createElement('section');
      sec.innerHTML = `<h3><span>${C.roman}</span>${C.name}</h3><div class="lv"></div>`;
      const lv = sec.querySelector('.lv');
      for (let i = 1; i <= 20; i++) {
        const n = ci * 20 + i, b = document.createElement('button');
        b.textContent = n; b.disabled = n > Save.data.unlocked;
        if (Save.data.embers[n]) b.classList.add('lit');
        if (n % 20 === 0) b.classList.add('boss');
        b.addEventListener('click', () => { SND.play('ui'); this.startLevel(n); });
        lv.appendChild(b);
      }
      box.appendChild(sec);
    });
  },
  startLevel(n) {
    n = clamp(n, 1, 100);
    this.lvl = n; this.state = 'play'; this.levelTime = 0;
    document.body.classList.add('playing');
    this.show(null);
    const L = buildLevel(n);
    this.world = new World(L);
    this.R.parts = [];
    this.R.updateCam(this.world, 1, true);
    this.fade = 1; this.fadeTo = 0;
    Save.data.current = n; Save.store();
    if (SND.ready && SND.chapter !== L.ch) SND.startAmbience(L.ch);
    else if (SND.ready && n === 1) SND.startAmbience(0);
    const first = (n - 1) % 20 === 0;
    this.card = first ? { t: 0, ch: L.ch } : null;
    this.story = { t: first ? -4.5 : 0, txt: STORY[n - 1], n };
  },
  resume() { this.state = 'play'; this.show(null); if (SND.ready) SND.ctx.resume(); },
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.show('pause'); },
  toTitle() {
    this.state = 'title'; document.body.classList.remove('playing'); this.show('menu');
    $('#btn-continue').classList.toggle('hidden', Save.data.current <= 1 && !Save.data.finished);
    $('#btn-continue').textContent = `Continue  ·  ${Save.data.current}`;
    this.attractWorld();
  },
  complete() {
    const W = this.world, n = this.lvl;
    Save.data.embers[n] = Math.max(Save.data.embers[n] || 0, W.embers);
    Save.data.deaths += W.deaths; Save.data.time += this.levelTime;
    Save.data.unlocked = Math.max(Save.data.unlocked, n + 1);
    if (n === 100) { Save.data.finished = true; Save.data.current = 100; Save.store(); this.ending(); return; }
    Save.data.current = n + 1; Save.store();
    this.startLevel(n + 1);
  },
  ending() {
    this.state = 'ending'; this.endT = 0;
    $('#end-stats').textContent = `${Save.data.deaths} deaths  ·  ${Save.totalEmbers()} embers  ·  ${Math.round(Save.data.time / 60)} minutes in the dark`;
  },
  handleEvents(W, live) {
    for (const e of W.events) {
      this.R.onEvent(e, W);
      if (!live || !SND.ready) continue;
      const vol = e.x !== undefined ? clamp(1.15 - Math.abs(e.x - W.p.x) / 750, 0, 1) : 1;
      SND.play(e.name, Object.assign({}, e, { vol }));
      if (e.name === 'exit') this.fadeTo = 1;
    }
    W.events.length = 0;
  },
  loop(ts) {
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
    const P = Input.pressed;
    if ((P.Escape || P.KeyP || (Input.pad.start && !this._ps)) && this.state === 'play') this.pause();
    else if ((P.Escape) && this.state === 'paused') this.resume();
    this._ps = Input.pad.start;
    let W = this.world;
    if (this.state === 'title' || (this.state !== 'play' && this.state !== 'paused' && this.state !== 'ending')) {
      W = this.attract; Input.read();
      W.step(dt, botInput(W)); this.handleEvents(W, false);
      if (W.done || W.p.x > W.L.exitX - 200) this.attractWorld();
      this.R.updateCam(W, dt); this.R.frame(W, dt, { fade: 0.25 });
    } else if (this.state === 'play') {
      this.acc += dt;
      while (this.acc >= 1 / 60) {
        const inp = Input.read();
        if (this.card && this.card.t < 4) { inp.left = inp.right = inp.jump = inp.jumpPressed = inp.act = false; }
        W.step(1 / 60, inp); this.acc -= 1 / 60;
      }
      this.levelTime += dt;
      this.handleEvents(W, true);
      if (W.done && this.fadeTo === 0) this.fadeTo = 1;
      this.fade += clamp(this.fadeTo - this.fade, -dt * 1.2, dt * 1.2);
      if (W.done && this.fade >= 1) this.complete();
      this.R.updateCam(W, dt); this.R.frame(W, dt, { fade: this.fade });
      this.overlays(dt);
    } else if (this.state === 'paused') {
      this.R.frame(W, 0, { fade: 0.5 });
    } else if (this.state === 'ending') {
      this.endT += dt; this.drawEnding();
    }
    requestAnimationFrame(t => this.loop(t));
  },
  overlays(dt) {
    const g = this.R.g, VW = 1280, VH = 720;
    g.setTransform(this.R.S, 0, 0, this.R.S, 0, 0);
    if (this.card) {
      const c = this.card; c.t += dt;
      const a = c.t < 1 ? c.t : c.t > 3.6 ? Math.max(0, 1 - (c.t - 3.6)) : 1;
      if (a > 0) {
        g.fillStyle = `rgba(0,0,0,${a * 0.85})`; g.fillRect(0, 0, VW, VH);
        g.textAlign = 'center'; g.fillStyle = `rgba(235,233,226,${a})`;
        g.font = '300 22px "Josefin Sans", sans-serif'; g.fillText(`CHAPTER  ${CHAPTERS[c.ch].roman}`, VW / 2, VH / 2 - 50);
        g.font = '700 54px "Josefin Sans", sans-serif'; g.fillText(CHAPTERS[c.ch].name.toUpperCase(), VW / 2, VH / 2 + 10);
        g.font = 'italic 300 20px "Josefin Sans", sans-serif'; g.fillStyle = `rgba(200,198,190,${a})`; g.fillText(CHAPTERS[c.ch].intro, VW / 2, VH / 2 + 60);
      } else this.card = null;
    }
    const s = this.story;
    if (s) {
      s.t += dt;
      const a = s.t < 0 ? 0 : s.t < 1.2 ? s.t / 1.2 : s.t > 5 ? Math.max(0, 1 - (s.t - 5) / 1.5) : 1;
      if (a > 0) {
        g.textAlign = 'center';
        g.fillStyle = `rgba(10,10,10,${a * 0.6})`; g.font = '600 14px "Josefin Sans", sans-serif';
        g.fillText(`${s.n}  /  100`, VW / 2, 64);
        g.font = 'italic 300 24px "Josefin Sans", sans-serif'; g.fillStyle = `rgba(12,12,12,${a * 0.9})`;
        g.save(); g.shadowColor = `rgba(235,233,226,${a})`; g.shadowBlur = 14; g.fillText(s.txt, VW / 2, 100); g.fillText(s.txt, VW / 2, 100); g.restore();
      }
      if (s.t > 7) this.story = null;
    }
  },
  drawEnding() {
    const g = this.R.g, VW = 1280, VH = 720, t = this.endT;
    g.setTransform(this.R.S, 0, 0, this.R.S, 0, 0);
    const k = clamp(t / 10, 0, 1);
    const gr = g.createRadialGradient(VW / 2, VH * 0.45, 0, VW / 2, VH * 0.45, 900 * k + 10);
    gr.addColorStop(0, '#fffdf5'); gr.addColorStop(0.5, '#e8e2cf'); gr.addColorStop(1, '#000');
    g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH); g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    g.textAlign = 'center';
    ENDING.forEach((line, i) => {
      const a = clamp((t - 2 - i * 3) / 1.5, 0, 1); g.fillStyle = `rgba(20,20,18,${a})`;
      g.font = i === ENDING.length - 1 ? '700 34px "Josefin Sans", sans-serif' : 'italic 300 28px "Josefin Sans", sans-serif';
      g.fillText(line, VW / 2, VH * 0.36 + i * 54);
    });
    if (t > 15) $('#ending').classList.remove('hidden');
  }
};

// ---------- test mode: bot plays all 100 levels headless ----------
function runTests() {
  const out = [];
  for (let n = 1; n <= 100; n++) {
    const W = new World(buildLevel(n)); let s = 0;
    while (!W.done && s < 60 * 240 && W.deaths < 40) { W.step(1 / 60, botInput(W)); W.events.length = 0; s++; }
    out.push({ n, ok: W.done, deaths: W.deaths, secs: +(s / 60).toFixed(1) });
  }
  return out;
}

// ---------- reel mode: deterministic frame-by-frame capture ----------
const REEL = {
  init(VW, VH, S) {
    const c = $('#game'); c.style.width = VW + 'px'; c.style.height = VH + 'px';
    this.R = new Renderer(c, VW, VH, S); this.T = 0; this.events = [];
    document.body.classList.add('reel');
  },
  clip(def) {
    const L = buildLevel(def.n || 1, def);
    this.W = new World(L, { t0: def.t0 || 0 }); this.W.bot = { wantDie: def.die || 0 };
    for (let i = 0; i < (def.skip || 0) * 60; i++) { this.W.step(1 / 60, botInput(this.W)); this.W.events.length = 0; }
    this.R.parts = []; this.R.updateCam(this.W, 1, true); this.events.push({ name: 'chapter', ch: L.ch, T: this.T });
    this.def = def; this.ct = 0;
  },
  step(fade) {
    const W = this.W, dt = 1 / 30;
    for (let k = 0; k < 2; k++) {
      const inp = botInput(W);
      if (this.def.die && W.deaths >= 1) W.bot.wantDie = 0;
      W.step(1 / 60, inp);
      for (const e of W.events) { this.R.onEvent(e, W); this.events.push(Object.assign({}, e, { T: this.T + k / 60, vol: e.x !== undefined ? clamp(1.15 - Math.abs(e.x - W.p.x) / 750, 0, 1) : 1 })); }
      W.events.length = 0;
    }
    this.T += dt; this.ct += dt;
    this.R.updateCam(W, dt); this.R.frame(W, dt, { fade: fade || 0 });
  },
  grab(q) { return $('#game').toDataURL('image/jpeg', q || 0.92); },
  async audio(dur, events) {
    const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    SND.manual = true; SND.ready = false; SND.init(ctx);
    let ch = -1;
    for (const e of events) {
      if (e.name === 'chapter') { if (e.ch !== ch) { SND.startAmbience(e.ch, e.T); ch = e.ch; } continue; }
      SND.play(e.name, Object.assign({}, e, { at: e.T + 0.02 }));
    }
    SND.schedule(dur);
    const buf = await ctx.startRendering();
    // encode 16-bit WAV
    const n = buf.length, data = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
    for (let i = 0; i < n; i++) { data.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true); data.setInt16(46 + i * 4, clamp(Rr[i], -1, 1) * 32767, true); }
    const bytes = new Uint8Array(data.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
};

window.addEventListener('load', () => {
  if (Q.has('reel')) { window.REEL = REEL; window.reelReady = true; return; }
  if (Q.has('test')) { const r = runTests(); window.testResult = r; document.title = 'TEST ' + r.filter(x => x.ok).length + '/100'; return; }
  Game.init();
});
