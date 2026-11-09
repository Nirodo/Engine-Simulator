// Schnelltest der Physik und des Klangmodells (ohne Browser): node tools/selftest.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../src/sim.js');
const { makeEngineSynth } = require('../src/engine_audio.js');
let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) fail++; };

function start(engine, amb, crankFor = 10) {
  const P = SIM.PRESETS[engine];
  const cfg = { engine, ambient: amb, soc: .9, soh: 1, starterCond: 1, oil: P.oil, fuel: 'arktis', throttle: 0, hand: 0, clutch: true, choke: engine === 'k4' && amb < 5 ? .8 : 0, acc: {},
    faults: { cyl: { plug: Array(P.cyl).fill(false), inj: Array(P.cyl).fill(false), comp: Array(P.cyl).fill(false), rings: Array(P.cyl).fill(false) } }, tune: {} };
  const s = SIM.create(cfg); s.cfg = cfg; SIM.coolTo(s, amb); SIM.setIgnition(s, true);
  const dt = .0004, pre = s.preheat; let t = 0, started = null;
  while (t < pre + crankFor + 4) {
    s.startReq = t >= pre && t < pre + crankFor && started === null;
    SIM.step(s, dt); t += dt;
    if (Math.floor(t / .016) !== Math.floor((t - dt) / .016)) SIM.thermal(s, .016, 1);
    s.events.length = 0;
    if (s.running && s.rpm > P.idle * .8 && started === null) started = t - pre;
  }
  return { started, rpm: s.rpm };
}
for (const e of Object.keys(SIM.PRESETS)) { const r = start(e, 20); ok(r.started !== null && r.rpm > 300, `${e}: Warmstart bei 20 °C (${r.started !== null ? r.started.toFixed(1) + ' s' : 'kein Start'}, ${Math.round(r.rpm)} U/min)`); }
const ex = start('d6', -38, 6); ok(ex.started === null, 'd6: bei −38 °C ohne Hilfe kein Start (erwartet)');
const dy = SIM.dyno({ engine: 'b4', ambient: 20, soc: 1, soh: 1, starterCond: 1, oil: '5W-30', fuel: 'arktis', acc: {}, faults: { cyl: { plug: [0,0,0,0], inj: [0,0,0,0], comp: [0,0,0,0], rings: [0,0,0,0] } }, tune: {} });
const mx = Math.max(...dy.map(p => p.nm)); ok(mx > 100 && mx < 250, `b4: Prüfstand max. Drehmoment ${mx} Nm`);
const es = makeEngineSynth(48000, SIM.valveLift), P = SIM.PRESETS.v8;
es.set({ P, tune: SIM.TUNE_DEF, tuneKey: 'x', rpmT: 3000, load: .8, thr: .8, running: true, ign: true, fire: Array(8).fill(1), mis: Array(8).fill(0), str: Array(8).fill(.8) });
const L = new Float32Array(48000), R = new Float32Array(48000); for (let k = 0; k < 48000; k += 1024) es.process(L.subarray(k, k + 1024), R.subarray(k, k + 1024));
let bad = 0, rms = 0; for (const v of L) { if (!Number.isFinite(v) || Math.abs(v) > 1) bad++; rms += v * v; }
ok(bad === 0 && Math.sqrt(rms / L.length) > .01, `Klangmodell: 1 s V8 ohne Übersteuerung, RMS ${Math.sqrt(rms / L.length).toFixed(3)}`);
if (fail) { console.error(`${fail} Test(s) fehlgeschlagen`); process.exit(1); } else console.log('Alle Tests bestanden.');
