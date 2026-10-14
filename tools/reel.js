// Renders the 9:16 reel: frames (JPEG) + events.json + audio.wav
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2], S = +(process.argv[3] || 3), ONLY = process.argv[4]; // ONLY = 'probe' renders a few frames; or comma list of clip ids to re-render
fs.mkdirSync(OUT + '/frames', { recursive: true });
const CLIPS = [
  { id: 'intro', n: 2, ch: 0, d: 0.05, seq: ['flat', 'gap', 'spikes', 'flat'], dur: 5.2, start: 260 },
  { id: 'jump', n: 2, ch: 0, d: 0.3, seq: ['trap', 'gap', 'spikes', 'gap'], dur: 4.6, start: 120 },
  { id: 'crate', n: 3, ch: 0, d: 0.2, seq: ['crate', 'flat'], dur: 5.0, start: 360 },
  { id: 'lever', n: 3, ch: 2, d: 0.4, seq: ['lever', 'crusher', 'flat'], dur: 6.4, start: 60 },
  { id: 'die', n: 61, ch: 3, d: 0.6, seq: ['saw', 'flat'], dur: 6.0, start: 60, die: 1 },
  { id: 'marsh', n: 25, ch: 1, d: 0.35, seq: ['water', 'husk', 'flat'], dur: 6.2, start: 60 },
  { id: 'edge', n: 85, ch: 4, d: 0.4, seq: ['platform', 'flat'], dur: 6.0, start: 330 },
  { id: 'chase', n: 40, ch: 1, d: 0.5, seq: ['gap', 'spikes', 'step', 'gap', 'trap', 'gap'], dur: 4.8, start: 60, chase: true },
  { id: 'end', n: 1, ch: 0, d: 0.1, seq: ['flat', 'flat', 'flat'], dur: 4.6, start: 900 }
];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 720, height: 1280 } });
  pg.on('pageerror', e => console.error('PAGEERR', e));
  await pg.goto('file://' + __dirname + '/../index.html?reel');
  await pg.addStyleTag({ content: `@font-face{font-family:"Josefin Sans";src:local("UJ Light");font-weight:300}@font-face{font-family:"Josefin Sans";src:local("UJ SemiBold");font-weight:600}@font-face{font-family:"Josefin Sans";src:local("UJ Bold");font-weight:700}` });
  await pg.waitForFunction('window.reelReady');
  await pg.evaluate(([S]) => { REEL.init(720, 1280, S); REEL.R.Z = 2.05; }, [S]);
  let frame = 0; const marks = [];
  const subset = ONLY && ONLY !== 'probe' ? ONLY.split(',') : null;
  for (const c of CLIPS) {
    marks.push({ id: c.id, T: frame / 30 });
    const nf = Math.round(c.dur * 30);
    if (subset && !subset.includes(c.id)) { frame += nf; continue; }
    await pg.evaluate(T => { REEL.T = T; }, frame / 30);
    await pg.evaluate(c => REEL.clip(c), c);
    for (let i = 0; i < nf; i++) {
      const fade = i < 8 ? 1 - i / 8 : i > nf - 8 ? (i - (nf - 8)) / 8 : 0;
      await pg.evaluate(f => REEL.step(f), c.id === 'end' ? Math.max(fade, Math.min(0.55, i / 20)) : fade);
      if (ONLY === 'probe' && i % 45 !== 20) { frame++; continue; }
      const data = await pg.evaluate(() => REEL.grab(0.93));
      fs.writeFileSync(`${OUT}/frames/f${String(frame).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
      frame++;
      if (frame % 60 === 0) console.log('frame', frame, c.id);
    }
  }
  const dur = frame / 30;
  let events = await pg.evaluate(() => REEL.events);
  if (subset) {
    const old = JSON.parse(fs.readFileSync(OUT + '/events.json', 'utf8')).events;
    const ranges = subset.map(id => { const i = marks.findIndex(m => m.id === id); return [marks[i].T, i + 1 < marks.length ? marks[i + 1].T : dur]; });
    const inR = T => ranges.some(([a, b]) => T >= a - 1e-6 && T < b - 1e-6);
    events = old.filter(e => !inR(e.T) || e.name === 'title' || e.name === 'exit').concat(events).sort((a, b) => a.T - b.T);
  } else {
    events.unshift({ name: 'title', T: 0.2 });
    events.push({ name: 'exit', T: marks.find(m => m.id === 'end').T + 0.3 });
  }
  fs.writeFileSync(OUT + '/events.json', JSON.stringify({ marks, dur, events }, null, 1));
  const wav = await pg.evaluate(([d, e]) => REEL.audio(d, e), [dur, events]);
  fs.writeFileSync(OUT + '/audio.wav', Buffer.from(wav, 'base64'));
  console.log('done frames', frame, 'dur', dur);
  await b.close();
})();
