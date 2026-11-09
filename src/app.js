(() => {
const S = SIM;
const $ = id => document.getElementById(id);
const fmt = (v, d = 0) => { if (!isFinite(v)) return '–'; const x = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ','); return x.replace(/^-/, '−').replace(/^−0(,0+)?$/, '0$1'); };
const fmtK = v => Math.round(v).toLocaleString('de-DE');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PRE = () => S.PRESETS[st.engine];

/* ================= Zustand ================= */
function blankCyl(n) { const z = () => Array(n).fill(false); return { plug: z(), inj: z(), comp: z(), rings: z() }; }
function blankAcc() { return { heater: false, charger: false, fuelHeat: false, light: false, blower: false, rear: false }; }
function defaults(engine = 'd6') {
  const P = S.PRESETS[engine];
  return { engine, ambient: -25, overnight: true, soc: .9, soh: 1, starterCond: 1, oil: P.oil, fuel: 'arktis', clutch: true, throttle: 0, hand: 0, brake: 0, clutchHeld: false, load: 0, choke: 0,
    noInject: false, wetTest: false, smode: 'auto', volume: .7, tune: {}, acc: blankAcc(), vfaults: { cyl: blankCyl(P.cyl) }, mystery: null, scale: 1, sound: true };
}
const KEY = 'engine-simulator-v1';
let st = defaults(), saved = null, savedTs = 0;
let job = { active: false, min: 0, used: {}, result: null }, best = null;
try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o && o.st && S.PRESETS[o.st.engine]) {
    st = Object.assign(defaults(o.st.engine), o.st, { throttle: 0, hand: 0, brake: 0, clutchHeld: false, load: 0, scale: 1, noInject: false, wetTest: false });
    if (!st.vfaults.cyl || !st.vfaults.cyl.rings) st.vfaults.cyl = blankCyl(PRE().cyl);
    saved = o.saved; savedTs = o.ts || 0;
    if (o.job && o.job.active && st.mystery) job = o.job;
  }
  if (o) best = o.best || null;
} catch (e) {}
function effFaults() {
  const f = JSON.parse(JSON.stringify(st.vfaults));
  if (!f.cyl) f.cyl = blankCyl(PRE().cyl);
  const m = st.mystery;
  if (m) { if (m.cyl != null) f.cyl[m.key][m.cyl] = true; else f[m.key] = true; }
  return f;
}
st.faults = effFaults();
let snap = null, lastExp = null;
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ st, saved: lastExp, ts: Date.now(), job, best })); } catch (e) {} }

/* ================= Runner (Web Worker, Rückfall Hauptthread) ================= */
let worker = null, local = null, gotSnap = false, lastInit = null;
try {
  const src = `const SIM=(${SIM_FACTORY.toString()})();const core=(${runnerCore.toString()})(SIM);let last=performance.now();
self.onmessage=e=>core.handle(e.data);
setInterval(()=>{const now=performance.now();const dt=(now-last)/1000;if(dt<.004)return;last=now;const sn=core.tick(dt);if(sn)self.postMessage(sn);},16);`;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = e => { gotSnap = true; receive(e.data); };
  worker.onerror = () => { if (!local) startLocal(); };
} catch (e) { worker = null; }
function startLocal() {
  if (worker) { try { worker.terminate(); } catch (e) {} }
  worker = null;
  local = runnerCore(SIM_FACTORY());
  if (lastInit) { local.handle(JSON.parse(JSON.stringify(lastInit))); local.handle({ type: 'scale', v: st.scale }); }
  let last = performance.now();
  setInterval(() => { const now = performance.now(), dt = (now - last) / 1000; if (dt < .004) return; last = now; const sn = local.tick(dt); if (sn) receive(sn); }, 16);
}
setTimeout(() => { if (!gotSnap && !local) startLocal(); }, 1500);
function send(m) { m = JSON.parse(JSON.stringify(m)); if (m.type === 'init') lastInit = m; if (worker) worker.postMessage(m); else if (local) local.handle(m); }
function cfgPayload() { const o = Object.assign({}, st); delete o.vfaults; delete o.mystery; return o; }
function sendCfg(force) { st.faults = effFaults(); send({ type: 'cfg', st: cfgPayload(), force }); }
const trace = [], evQueue = [];
let scopeBuf = [], logArr = [], dtcObj = {}, lastAtt = null;
function sendInit(useSaved, logTxt) {
  st.faults = effFaults();
  const m = { type: 'init', st: cfgPayload(), logTxt };
  if (useSaved && saved && saved.engine === st.engine) { m.saved = saved; m.elapsed = savedTs ? (Date.now() - savedTs) / 1000 : 0; }
  send(m); send({ type: 'scale', v: st.scale });
  snap = null; trace.length = 0; scopeBuf = []; logArr = []; dtcObj = {}; lastAtt = null;
}
if (!worker) startLocal();

/* ================= Audio: physikalisch angelehnter Motorklang (engine_audio.js) ================= */
const AU = { ctx: null, es: null };
function audioInit() {
  if (AU.ctx || !st.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = volGain();
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const es = makeEngineSynth(ctx.sampleRate, S.valveLift);
    const node = ctx.createScriptProcessor(1024, 0, 2);
    node.onaudioprocess = e => es.process(e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1));
    node.connect(master);
    Object.assign(AU, { ctx, master, buf, node, es, sr: ctx.sampleRate });
  } catch (e) { AU.ctx = null; }
}
const volGain = () => st.sound ? Math.pow(clamp(st.volume ?? .7, 0, 1), 1.6) * .95 : 0;
function setVolume() { if (AU.ctx) AU.master.gain.setTargetAtTime(volGain(), AU.ctx.currentTime, .05); }
let auThrPrev = 0, auKnock = .3;
function audioSnap(sn) {
  if (!AU.ctx || !AU.es || !st.sound || document.hidden) return;
  const P = S.PRESETS[sn.key], T = Object.assign({}, S.TUNE_DEF, st.tune || {});
  const cyc = 120 / Math.max(sn.rpm, 30), fire = [], mis = [], str = [];
  sn.cylS.forEach((c, i) => {
    const recent = sn.t - c.lastEvt < cyc * 1.6;
    fire[i] = recent && c.state === 'fire' ? 1 : 0; mis[i] = recent && c.state === 'misfire' ? 1 : 0; str[i] = 0;
  });
  for (const e of sn.events) if (e.type === 'fire') { str[e.cyl] = .35 + .65 * clamp(e.str ?? .7, 0, 1.2); if (P.diesel && e.knock != null) auKnock = auKnock * .7 + e.knock * .3; }
  // kalter Diesel nagelt deutlich lauter (steiler Druckanstieg durch langen Zündverzug)
  const knock = P.diesel ? Math.max(auKnock, clamp((45 - sn.Tb) / 70, 0, 1) * .9) : 0;
  const thr = Math.max(st.throttle, (st.hand || 0) * .6);
  let bov = 0;
  if (P.turbo && !P.diesel && auThrPrev - thr > .3 && sn.boost > .3) bov = clamp(sn.boost / P.boostMax, .35, 1); // Schubumluftventil bläst ab
  auThrPrev = thr;
  let ping = 0;
  const now = AU.ctx.currentTime;
  for (const e of sn.events) {
    if (e.type === 'knock') ping = Math.max(ping, .35 + .4 * (e.str || .5));
    else if (e.type === 'solenoid') { burst(now + .01, { f: 260, type: 'lowpass', gain: .9, dur: .12, thump: .6, tf: 60 }); burst(now + .01, { f: 3500, q: 3, gain: .25, dur: .02 }); }
    else if (e.type === 'click') burst(now + .01, { f: 2800, q: 4, gain: .45, dur: .025, thump: .2, tf: 120 });
    else if (e.type === 'relay') burst(now + .01, { f: 4200, q: 5, gain: .18, dur: .015 });
    else if (e.type === 'grind') { for (let i = 0; i < 7; i++) burst(now + .01 + i * .04, { f: 1600 + Math.random() * 2800, q: 2.5, gain: .45, dur: .05 }); burst(now + .01, { f: 650, q: 1.5, gain: .3, dur: .3 }); }
  }
  AU.es.set({
    P, tune: T, tuneKey: T.cam + '|' + T.exhaust, rpmT: sn.rpm, load: clamp(sn.q, 0, 1.3), thr,
    diesel: P.diesel, turbo: !!P.turbo, carb: !!P.carb, lumpy: (S.CAMS[T.cam] || S.CAMS.serie).idle, wear: sn.wear,
    running: sn.running, crank: sn.starterEng, ign: sn.ign,
    stAmp: sn.starterEng ? clamp(Math.pow(sn.Is / (P.sysV === 24 ? 1400 : 650), .7), .1, 1) : 0,
    grind: sn.starterGrind > 0 && sn.starterEng ? 1 : 0,
    boost: sn.boost, boostMax: (P.boostMax || 1) * (T.turboBig ? 1.35 : 1), turboRpm: P.turbo ? sn.turboRpm : 0,
    tWob: st.faults.turboBearing || (sn.dyn && sn.dyn.turboBearing) ? 1 : 0, fan: sn.fanOn ? 1 : 0,
    hiss: (P.turbo && st.faults.turboHose && sn.running ? clamp(sn.q * sn.rpm / P.maxRpm, 0, 1) * .25 : 0) + (sn.boiling ? .06 : 0),
    knock, fire, mis, str, ping, bov,
  });
}
function burst(at, { f = 1800, q = .9, type = 'bandpass', gain = .5, dur = .06, thump = 0, tf = 90 } = {}) {
  const { ctx, master, buf } = AU;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .003); g.gain.exponentialRampToValueAtTime(.0005, at + dur);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(at, Math.random() * 1.5); src.stop(at + dur + .02);
  if (thump > 0) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(tf * 1.7, at); o.frequency.exponentialRampToValueAtTime(tf, at + dur * 1.5);
    const og = ctx.createGain(); og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(thump, at + .005); og.gain.exponentialRampToValueAtTime(.0005, at + dur * 2.2);
    o.connect(og); og.connect(master); o.start(at); o.stop(at + dur * 2.6);
  }
}
function audioOff() { if (AU.es) AU.es.silence(); }

/* ================= Navigation ================= */
const VIEWS = ['cockpit', 'motor', 'tuning', 'werkstatt', 'fehler', 'einstellungen'];
let view = 'cockpit';
function route() {
  const h = location.hash.replace('#', '');
  view = VIEWS.includes(h) ? h : 'cockpit';
  for (const v of VIEWS) $('view-' + v).classList.toggle('on', v === view);
  for (const a of document.querySelectorAll('.tab')) a.setAttribute('aria-current', a.dataset.v === view ? 'page' : 'false');
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ================= Aufbau ================= */
const engSel = $('engine'), fuelSel = $('fuel'), oilSel = $('oil');
for (const k in S.PRESETS) engSel.add(new Option(S.PRESETS[k].label, k));
for (const k in S.FUELS) fuelSel.add(new Option(S.FUELS[k].label, k));
for (const k in S.OILS) oilSel.add(new Option(k, k));
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); parent && parent.appendChild(e); return e; };

let cylEls = [];
function buildCylinders() {
  const P = PRE(), box = $('cyls');
  box.innerHTML = ''; box.className = 'cyls c' + P.cyl;
  $('orderTxt').textContent = 'Zündfolge ' + P.order.join('-');
  cylEls = Array.from({ length: P.cyl }, (_, i) => {
    const d = document.createElement('div'); d.className = 'cyl';
    const svg = mk('svg', { viewBox: '0 0 80 112', 'aria-hidden': 'true' }, d);
    mk('rect', { x: 15, y: 18, width: 50, height: 54, rx: 2, fill: '#0a0e11', stroke: '#32424f', 'stroke-width': 1.2 }, svg);
    for (let k = 0; k < 6; k++) { mk('line', { x1: 15, x2: 11, y1: 24 + k * 8, y2: 24 + k * 8, stroke: '#24303a', 'stroke-width': 1.5 }, svg); mk('line', { x1: 65, x2: 69, y1: 24 + k * 8, y2: 24 + k * 8, stroke: '#24303a', 'stroke-width': 1.5 }, svg); }
    const gas = mk('rect', { x: 16, y: 19, width: 48, height: 10, fill: '#f3a53c', opacity: 0 }, svg);
    const comp = mk('rect', { x: 16, y: 19, width: 48, height: 10, fill: '#8cd2ef', opacity: 0 }, svg);
    mk('rect', { x: 12, y: 8, width: 56, height: 11, rx: 2, fill: '#24303a' }, svg);
    const vIn = mk('line', { x1: 27, x2: 27, y1: 12, y2: 20, stroke: '#8293a0', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    const vEx = mk('line', { x1: 53, x2: 53, y1: 12, y2: 20, stroke: '#8293a0', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    mk('rect', { x: 37.5, y: 1, width: 5, height: 12, rx: 1, fill: '#56656f' }, svg);
    const tip = mk('circle', { cx: 40, cy: 20, r: 2.4, fill: '#32424f' }, svg);
    const rod = mk('line', { x1: 40, y1: 40, x2: 40, y2: 80, stroke: '#9fb0bc', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    const pis = mk('g', {}, svg);
    mk('rect', { x: 17, y: 0, width: 46, height: 16, rx: 2, fill: '#9fb0bc' }, pis);
    mk('line', { x1: 17, x2: 63, y1: 3.5, y2: 3.5, stroke: '#56656f', 'stroke-width': 1 }, pis);
    mk('line', { x1: 17, x2: 63, y1: 6.5, y2: 6.5, stroke: '#56656f', 'stroke-width': 1 }, pis);
    mk('circle', { cx: 40, cy: 10, r: 2.2, fill: '#56656f' }, pis);
    mk('circle', { cx: 40, cy: 88, r: 19, fill: '#0f1519', stroke: '#24303a', 'stroke-width': 1.2 }, svg);
    const web = mk('line', { x1: 40, y1: 88, x2: 40, y2: 74, stroke: '#56656f', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
    mk('circle', { cx: 40, cy: 88, r: 4, fill: '#32424f' }, svg);
    const pin = mk('circle', { cx: 40, cy: 74, r: 3.2, fill: '#c9d5dd' }, svg);
    d.insertAdjacentHTML('beforeend', `<div class="nm">Zylinder ${i + 1}</div><div class="tw"><span></span><small>°C</small></div><div class="s"></div><div class="m"></div>`);
    box.appendChild(d);
    return { d, gas, comp, vIn, vEx, tip, rod, pis, web, pin, twv: d.querySelector('.tw span'), stt: d.querySelector('.s'), meta: d.querySelector('.m'), last: {} };
  });
  const cb = $('cbars'); cb.innerHTML = '';
  for (let i = 0; i < P.cyl; i++) cb.insertAdjacentHTML('beforeend', `<div class="cbar" id="cb${i}"><span>Zyl. ${i + 1}</span><div class="tr"><i style="width:0%"></i></div><span>–</span></div>`);
}

/* ---------- Schnittbild ---------- */
let SX = {};
function buildSchematic() {
  const P = PRE(), n = P.cyl, bx = 300, bw = 380, cw = bw / n, T = !!P.turbo;
  const cx = i => bx + cw * (i + .5);
  const flowPath = (id, d, w = 9) => `<path d="${d}" id="${id}" fill="none" stroke="var(--cool)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" id="${id}F" fill="none" stroke="#ffffff" stroke-opacity="0" stroke-width="2.5" stroke-dasharray="6 12" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pipe = (id, d, w = 12, col = 'var(--line2)') => `<path d="${d}" id="${id}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const label = (x, y, t, id, anchor = 'middle', cls = 'sx-l') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}"${id ? ` id="${id}"` : ''}>${t}</text>`;
  let s = `<svg viewBox="0 0 1000 570" role="img" aria-label="Schnittbild des Motors">
  <style>.sx-l{font:500 14px var(--f-body);fill:var(--mute)}.sx-v{font:600 20px var(--f-num);fill:var(--text)}.sx-v2{font:600 16px var(--f-num);fill:var(--text)}.sx-t{font:600 12px var(--f-num);fill:var(--mute);letter-spacing:.08em;text-transform:uppercase}</style>
  <defs><clipPath id="sumpClip"><path d="M320 402 H660 L645 464 H335 Z"/></clipPath><clipPath id="expClip"><rect x="40" y="40" width="80" height="56" rx="6"/></clipPath><clipPath id="tankClip"><rect x="800" y="462" width="150" height="58" rx="6"/></clipPath>
  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--mute)"/></marker></defs>`;
  /* Kühler, Lüfter, Ausgleichsbehälter */
  s += `<rect x="40" y="130" width="60" height="270" rx="5" fill="var(--panel3)" stroke="var(--line2)"/>`;
  for (let y = 142; y < 395; y += 11) s += `<line x1="44" x2="96" y1="${y}" y2="${y}" stroke="var(--line2)" stroke-width="1.5"/>`;
  s += `<rect id="sxRad" x="40" y="130" width="60" height="270" rx="5" fill="var(--cool)" opacity=".12"/>`;
  s += `<path id="sxRadF" d="M70 140 V390" fill="none" stroke="#fff" stroke-opacity="0" stroke-width="2.5" stroke-dasharray="5 11"/>`;
  s += `<g id="sxFan" transform="translate(140 300)"><circle r="32" fill="none" stroke="var(--line2)" stroke-dasharray="3 4"/>`;
  for (let k = 0; k < 5; k++) s += `<path d="M0 0 C 7 -8, 8 -22, 2 -29 C -5 -22, -5 -10, 0 0 Z" fill="var(--line2)" transform="rotate(${k * 72})"/>`;
  s += `<circle r="5" fill="var(--panel3)" stroke="var(--line2)"/></g>`;
  s += `<rect x="40" y="40" width="80" height="56" rx="6" fill="var(--panel2)" stroke="var(--line2)"/><rect id="sxExp" clip-path="url(#expClip)" x="40" y="40" width="80" height="56" fill="var(--cool)" opacity=".55"/><line x1="44" x2="116" y1="58" y2="58" stroke="var(--mute)" stroke-dasharray="3 3"/><path d="M60 96 V130" stroke="var(--line2)" stroke-width="4"/>`;
  /* Kühlkreis: Kopf → Thermostat → (großer Kreis: Kühler) / (kleiner Kreis: Bypass) / Heizung → Pumpe → Block */
  s += flowPath('sxHotA', 'M290 176 H242');
  s += flowPath('sxHotB', 'M222 176 H118 V150 H100');
  s += flowPath('sxBy', 'M232 186 V322 H236', 6);
  s += flowPath('sxHeatA', 'M290 194 H262 V214 H206', 5);
  s += flowPath('sxHeatB', 'M178 226 V262 H226', 5);
  s += flowPath('sxCold', 'M100 384 H176 V330 H236');
  s += flowPath('sxCold2', 'M264 330 H300');
  s += `<rect x="150" y="202" width="56" height="24" rx="4" fill="var(--panel3)" stroke="var(--line2)"/><rect id="sxHeat" x="150" y="202" width="56" height="24" rx="4" fill="var(--hot)" opacity="0"/>${label(178, 219, 'Heizung', null, 'middle', 'sx-t')}`;
  s += `<g transform="translate(232 176)"><rect x="-11" y="-11" width="22" height="22" rx="4" fill="var(--panel3)" stroke="var(--line2)"/><rect id="sxThermo" x="-6" y="-3" width="12" height="6" rx="2" fill="var(--mute)"/></g>`;
  s += `<g id="sxPump" transform="translate(250 330)"><circle r="15" fill="var(--panel3)" stroke="var(--line2)" stroke-width="2"/><path d="M0 -11 V11 M-11 0 H11 M-8 -8 L8 8 M-8 8 L8 -8" stroke="var(--mute)" stroke-width="2"/></g>`;
  /* Ansaugtrakt */
  if (T) {
    s += `<rect x="894" y="72" width="98" height="36" rx="6" fill="var(--panel2)" stroke="var(--line2)"/>${label(943, 95, 'Luftfilter', null, 'middle', 'sx-t')}`;
    s += pipe('sxAirIn', 'M894 90 H882', 12);
    s += pipe('sxBoost', 'M820 90 H800 V58 H277', 12) + `<path id="sxBoostF" d="M820 90 H800 V58 H277" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width="2.5" stroke-dasharray="5 11" stroke-linecap="round"/>`;
    s += `<g id="sxLeak" opacity="0"><circle cx="560" cy="58" r="11" fill="none" stroke="var(--red)" stroke-width="2.5"/><path d="M553 51 L567 65 M567 51 L553 65" stroke="var(--red)" stroke-width="2.5"/></g>`;
    s += `<rect x="150" y="42" width="127" height="32" rx="5" fill="var(--panel3)" stroke="var(--line2)"/>`;
    for (let x = 160; x < 272; x += 9) s += `<line x1="${x}" x2="${x}" y1="46" y2="70" stroke="var(--line2)"/>`;
    s += label(213, 94, 'Ladeluftkühler', null, 'middle', 'sx-t');
  } else s += `<rect x="150" y="42" width="110" height="32" rx="6" fill="var(--panel2)" stroke="var(--line2)"/>${label(205, 63, 'Luftfilter', null, 'middle', 'sx-t')}`;
  s += pipe('sxIntake', 'M150 58 H136 V118 H320', 12) + `<path id="sxIntakeF" d="M150 58 H136 V118 H320" fill="none" stroke="#fff" stroke-opacity="0" stroke-width="2.5" stroke-dasharray="5 11"/>`;
  s += `<rect x="320" y="109" width="300" height="18" rx="7" fill="var(--line2)"/>`;
  for (let i = 0; i < n; i++) s += `<rect x="${cx(i) - cw * .2 - 4}" y="125" width="8" height="14" fill="var(--line2)"/>`;
  if (P.pre === 'grid') s += `<rect id="sxGrid" x="298" y="106" width="20" height="24" rx="3" fill="var(--panel3)" stroke="var(--line2)"/>${label(308, 100, 'Heizflansch', null, 'middle', 'sx-t')}`;
  if (P.carb) s += `<rect x="296" y="94" width="28" height="36" rx="4" fill="var(--panel3)" stroke="var(--line2)"/>${label(310, 88, 'Vergaser', null, 'middle', 'sx-t')}`;
  if (P.efi) s += `<rect x="300" y="104" width="16" height="28" rx="3" fill="var(--panel3)" stroke="var(--line2)"/><line id="sxThrottle" x1="308" y1="108" x2="308" y2="128" stroke="var(--mute)" stroke-width="3"/>${label(308, 98, 'Drossel', null, 'middle', 'sx-t')}`;
  /* Abgasstrang & Turbo */
  if (T) {
    s += pipe('sxExh', 'M690 186 H816', 14, 'var(--hot)') + pipe('sxTail', 'M850 220 V316 H986', 14, 'var(--hot)');
    s += `<path id="sxExhF" d="M690 186 H816" fill="none" stroke="#fff" stroke-opacity="0" stroke-width="2.5" stroke-dasharray="5 11"/>`;
    s += `<line x1="850" y1="120" x2="850" y2="154" stroke="var(--mute)" stroke-width="6"/>`;
    s += `<g transform="translate(850 90)"><circle r="31" fill="var(--panel2)" stroke="var(--ice)" stroke-width="2.5"/><g id="sxComp">`;
    for (let k = 0; k < 7; k++) s += `<path d="M0 0 Q 10 -12 4 -26" fill="none" stroke="var(--ice)" stroke-width="3" transform="rotate(${k * 51.4})"/>`;
    s += `</g></g><g transform="translate(850 188)"><circle r="33" fill="var(--panel2)" stroke="var(--amber)" stroke-width="2.5"/><g id="sxTurb">`;
    for (let k = 0; k < 7; k++) s += `<path d="M0 0 Q -10 -12 -4 -28" fill="none" stroke="var(--amber)" stroke-width="3" transform="rotate(${k * 51.4})"/>`;
    s += `</g></g>${label(850, 46, 'Turbolader', null, 'middle', 'sx-t')}`;
    s += label(894, 184, '0,0 bar', 'sxTurboV', 'start', 'sx-v') + label(894, 206, '', 'sxTurboR', 'start', 'sx-l');
    s += `<path id="sxTOil" d="M690 300 H818 V156" fill="none" stroke="var(--oil)" stroke-width="2" stroke-dasharray="3 3" opacity=".5"/>`;
  } else {
    s += pipe('sxExh', 'M690 186 H850 V316 H986', 14, 'var(--hot)');
    s += `<path id="sxExhF" d="M690 186 H850 V316 H986" fill="none" stroke="#fff" stroke-opacity="0" stroke-width="2.5" stroke-dasharray="5 11"/>`;
  }
  for (let k = 0; k < 4; k++) s += `<circle id="sxSmk${k}" cx="${975 - k * 2}" cy="${310 - k * 14}" r="${8 + k * 5}" fill="#c8d0d6" opacity="0"/>`;
  s += label(940, 340, 'Abgas', null, 'middle', 'sx-t') + label(940, 360, '', 'sxEgt', 'middle', 'sx-l');
  /* Kraftstoff */
  s += `<rect x="800" y="462" width="150" height="58" rx="6" fill="var(--panel2)" stroke="var(--line2)"/><rect clip-path="url(#tankClip)" x="800" y="480" width="150" height="40" fill="var(--amber-dim)"/>${label(875, 496, 'Tank', null, 'middle', 'sx-t')}`;
  s += `<path d="M800 490 H744 V${P.carb ? 96 : 140} H${P.carb ? 324 : 674}" fill="none" stroke="var(--amber-dim)" stroke-width="4" stroke-linejoin="round"/>`;
  s += `<rect x="736" y="330" width="16" height="30" rx="3" fill="var(--panel3)" stroke="var(--line2)"/>`;
  if (!P.carb) s += `<rect x="312" y="136" width="362" height="5" rx="2.5" fill="var(--amber-dim)"/>`;
  /* Zylinderkopf mit Nockenwellen, Ventiltrieb */
  s += `<rect x="290" y="139" width="400" height="61" rx="5" fill="var(--panel2)" stroke="var(--line2)"/><rect id="sxHeadHeat" x="290" y="139" width="400" height="61" rx="5" fill="var(--hot)" opacity="0"/>`;
  const dohc = P.cam === 'DOHC';
  if (P.cam !== 'OHV') {
    if (dohc) s += `<line x1="300" x2="680" y1="150" y2="150" stroke="var(--dim)" stroke-width="3"/>`;
    else s += `<line x1="300" x2="680" y1="150" y2="150" stroke="var(--dim)" stroke-width="3"/>`;
  }
  /* Steuertrieb: Kurbelwellenrad → Nockenwellenrad(er) */
  s += `<path id="sxChain" d="M282 372 V150 A14 14 0 0 1 310 150 V372 A14 14 0 0 1 282 372 Z" fill="none" stroke="var(--mute)" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>`;
  s += `<g id="sxCamS" transform="translate(296 150)"><circle r="14" fill="var(--panel3)" stroke="var(--mute)" stroke-width="2"/><line x1="0" y1="0" x2="0" y2="-11" stroke="var(--amber)" stroke-width="2.5"/></g>`;
  s += `<g id="sxCrankS" transform="translate(296 374)"><circle r="7" fill="var(--panel3)" stroke="var(--mute)" stroke-width="2"/><line x1="0" y1="0" x2="0" y2="-6" stroke="var(--amber)" stroke-width="2"/></g>`;
  s += `<rect x="300" y="200" width="380" height="150" rx="5" fill="var(--panel2)" stroke="var(--line2)"/><rect x="300" y="350" width="380" height="52" rx="4" fill="var(--panel3)" stroke="var(--line2)"/>`;
  for (let i = 0; i < n; i++) {
    const x = cx(i), w = cw * .66, xi = x - cw * .2, xe = x + cw * .2, vw = Math.max(5, cw * .14);
    s += `<rect x="${x - w / 2}" y="206" width="${w}" height="70" fill="#0a0e11" stroke="var(--line2)"/>`;
    s += `<rect id="sxG${i}" x="${x - w / 2 + 1}" y="207" width="${w - 2}" height="5" fill="var(--amber)" opacity="0"/>`;
    s += `<line id="sxR${i}" x1="${x}" y1="230" x2="${x}" y2="372" stroke="#9fb0bc" stroke-width="${Math.max(4, cw * .07)}" stroke-linecap="round"/>`;
    s += `<rect id="sxP${i}" x="${x - w / 2 + 2}" y="212" width="${w - 4}" height="20" rx="2" fill="#9fb0bc"/>`;
    s += `<circle cx="${x}" cy="374" r="17" fill="none" stroke="var(--line2)"/><circle id="sxW${i}" cx="${x}" cy="384" r="8" fill="var(--dim)"/><circle id="sxK${i}" cx="${x}" cy="360" r="4.5" fill="#c9d5dd"/>`;
    for (const [id, vx] of [['Vi', xi], ['Ve', xe]]) {
      s += `<g id="sx${id}${i}"><line x1="${vx}" x2="${vx}" y1="162" y2="198" stroke="var(--mute)" stroke-width="2.5"/><line x1="${vx - vw}" x2="${vx + vw}" y1="198" y2="198" stroke="var(--mute)" stroke-width="3" stroke-linecap="round"/><path d="M${vx - 4} 166 l8 3 l-8 3 l8 3 l-8 3 l8 3" fill="none" stroke="var(--dim)" stroke-width="1.5"/></g>`;
      if (P.cam !== 'OHV') s += `<g transform="translate(${vx} 150)"><ellipse id="sxC${id}${i}" cx="0" cy="0" rx="${Math.max(4, cw * .09)}" ry="${Math.max(3, cw * .065)}" fill="var(--panel3)" stroke="var(--amber)" stroke-width="1.5"/></g>`;
      else s += `<rect id="sxC${id}${i}" x="${vx - 2}" y="150" width="4" height="10" fill="var(--mute)"/>`;
    }
    if (P.diesel || P.efi) s += `<rect x="${x - 3}" y="141" width="6" height="22" rx="2" fill="var(--amber-dim)"/><path id="sxSpray${i}" d="M${x} 200 l-${w * .25} 18 h${w * .5} z" fill="var(--amber)" opacity="0"/>`;
    if (P.pre === 'plug') s += `<circle id="sxGl${i}" cx="${x - cw * .06}" cy="201" r="3" fill="var(--line2)"/>`;
    if (!P.diesel) s += `<circle id="sxSp${i}" cx="${x + cw * .07}" cy="201" r="3" fill="var(--line2)"/>`;
    s += `<text x="${x - cw * .26}" y="292" text-anchor="middle" class="sx-t">${i + 1}</text>`;
  }
  if (P.layout !== 'R') s += label(490, 334, P.layout === 'V' ? 'V-Motor abgewickelt · Bank A: 1–4 · Bank B: 5–8' : 'Boxer abgewickelt · gegenüberliegende Zylinder', null, 'middle', 'sx-t');
  s += label(698, 156, 'Kopf', 'sxHead', 'start', 'sx-l');
  /* Ölwanne & Ölkreislauf */
  s += `<path d="M320 402 H660 L645 464 H335 Z" fill="var(--panel2)" stroke="var(--line2)"/><rect id="sxOil" clip-path="url(#sumpClip)" x="320" y="402" width="340" height="62" fill="var(--oil)" opacity=".7"/>`;
  s += `<line x1="330" x2="650" y1="424" y2="424" stroke="var(--mute)" stroke-dasharray="3 3" opacity=".7"/>`;
  s += `<circle cx="385" cy="444" r="9" fill="var(--panel3)" stroke="var(--oil)" stroke-width="2"/>`;
  s += `<path id="sxGal" d="M385 435 V414 H316 V158 H330" fill="none" stroke="var(--oil)" stroke-width="5" stroke-linejoin="round" opacity=".35"/><path id="sxGalF" d="M385 435 V414 H316 V158 H330" fill="none" stroke="#ffffff" stroke-opacity=".4" stroke-width="2" stroke-dasharray="4 9" stroke-linejoin="round"/>`;
  s += `<rect x="304" y="282" width="24" height="34" rx="5" fill="var(--panel3)" stroke="var(--oil)" stroke-width="1.5"/>${label(316, 276, 'Filter', null, 'middle', 'sx-t')}`;
  s += label(490, 488, 'Ölwanne', 'sxOilL', 'middle', 'sx-l');
  /* Schwungrad, Anlasser, Riementrieb, Lichtmaschine, Batterie */
  s += `<g id="sxFly" transform="translate(702 374)"><circle r="31" fill="var(--panel3)" stroke="var(--line2)" stroke-width="2"/><circle r="31" fill="none" stroke="var(--mute)" stroke-dasharray="2 3" opacity=".6"/><line x1="0" y1="0" x2="0" y2="-24" stroke="var(--dim)" stroke-width="4"/></g>`;
  s += `<rect id="sxStarter" x="716" y="404" width="58" height="26" rx="6" fill="var(--panel3)" stroke="var(--line2)" stroke-width="2"/><circle id="sxPinion" cx="718" cy="404" r="6" fill="var(--line2)"/>${label(745, 448, 'Anlasser', null, 'middle', 'sx-t')}`;
  s += `<path id="sxBelt" d="M286 380 L236 410 M296 388 L254 438" stroke="var(--dim)" stroke-width="3" stroke-dasharray="6 4"/>`;
  s += `<g id="sxAlt" transform="translate(246 421)"><circle r="18" fill="var(--panel3)" stroke="var(--line2)" stroke-width="2"/><path d="M0 -12 V12 M-12 0 H12" stroke="var(--mute)" stroke-width="2"/></g>${label(222, 425, 'LiMa', 'sxAltL', 'end', 'sx-l')}`;
  s += `<rect x="130" y="466" width="96" height="54" rx="6" fill="var(--panel2)" stroke="var(--line2)" stroke-width="2"/><rect x="142" y="459" width="14" height="7" fill="var(--line2)"/><rect x="200" y="459" width="14" height="7" fill="var(--line2)"/>`;
  s += label(178, 500, '0,0 V', 'sxBat', 'middle', 'sx-v2') + label(178, 540, P.nBat > 1 ? '2 × 12 V in Reihe' : '12 V', null, 'middle', 'sx-t');
  s += `<path d="M226 512 H690 V430" fill="none" stroke="var(--red-dim)" stroke-width="3"/>`;
  /* Beschriftungen Kühlkreis */
  s += label(70, 420, 'Kühler', null, 'middle', 'sx-t') + label(70, 442, '–', 'sxRadT', 'middle', 'sx-v2');
  s += label(140, 352, 'Lüfter aus', 'sxFanL', 'middle', 'sx-l');
  s += label(40, 30, 'Ausgleichsbehälter', null, 'start', 'sx-t') + label(80, 76, '–', 'sxExpL', 'middle', 'sx-v2');
  s += label(218, 147, 'Thermostat', 'sxThL', 'middle', 'sx-l');
  s += label(233, 300, 'Bypass', null, 'end', 'sx-t');
  s += label(250, 362, 'Wasserpumpe', null, 'middle', 'sx-t');
  s += label(80, 560, '', 'sxCircL', 'start', 'sx-l');
  s += `</svg>`;
  $('schemBox').innerHTML = s;
  const g = id => $(id);
  SX = { cyl: [], rad: g('sxRad'), radF: g('sxRadF'), fan: g('sxFan'), exp: g('sxExp'), thermo: g('sxThermo'), pump: g('sxPump'), heat: g('sxHeat'),
    boost: g('sxBoost'), boostF: g('sxBoostF'), leak: g('sxLeak'), grid: g('sxGrid'), exh: g('sxExh'), exhF: g('sxExhF'), tail: g('sxTail'), comp: g('sxComp'), turb: g('sxTurb'),
    turboV: g('sxTurboV'), turboR: g('sxTurboR'), head: g('sxHead'), headHeat: g('sxHeadHeat'), oil: g('sxOil'), gal: g('sxGal'), galF: g('sxGalF'), oilL: g('sxOilL'), tOil: g('sxTOil'),
    starter: g('sxStarter'), pinion: g('sxPinion'), alt: g('sxAlt'), altL: g('sxAltL'), bat: g('sxBat'), radT: g('sxRadT'), fanL: g('sxFanL'), expL: g('sxExpL'), thL: g('sxThL'),
    intakeF: g('sxIntakeF'), throttle: g('sxThrottle'), chain: g('sxChain'), camS: g('sxCamS'), crankS: g('sxCrankS'), fly: g('sxFly'), belt: g('sxBelt'), egtL: g('sxEgt'), circL: g('sxCircL'),
    smk: [0, 1, 2, 3].map(k => g('sxSmk' + k)), cx: Array.from({ length: n }, (_, i) => cx(i)),
    hoses: Object.fromEntries(['HotA', 'HotB', 'By', 'HeatA', 'HeatB', 'Cold', 'Cold2'].map(k => [k, { p: g('sx' + k), f: g('sx' + k + 'F') }])),
    ang: { fan: 0, comp: 0, pump: 0, alt: 0, cool: 0, by: 0, heat: 0, rad: 0, oil: 0, boost: 0, air: 0, exh: 0, chain: 0 } };
  for (let i = 0; i < n; i++) SX.cyl.push({ g: g('sxG' + i), r: g('sxR' + i), p: g('sxP' + i), k: g('sxK' + i), w: g('sxW' + i), vi: g('sxVi' + i), ve: g('sxVe' + i), ci: g('sxCVi' + i), ce: g('sxCVe' + i), gl: g('sxGl' + i), sp: g('sxSp' + i), spray: g('sxSpray' + i) });
}

/* ---------- Schnittbild & Systemkarten zeichnen ---------- */
function flowAnim(h, speed, key, A, k, colorT) {
  if (!h.p) return;
  A[key] = (A[key] || 0) - speed * k * 70;
  h.f.setAttribute('stroke-dashoffset', A[key].toFixed(1));
  h.f.setAttribute('stroke-opacity', speed > .02 ? (.25 + .25 * Math.min(1, speed)).toFixed(2) : 0);
  if (colorT != null) h.p.setAttribute('stroke', tempColor(colorT));
}
function renderMotor(dtR) {
  const s = snap, P = PRE(), n = P.cyl, T = Object.assign({}, S.TUNE_DEF, st.tune || {});
  const r = 14, L = 132, theta = s.theta || 0;
  s.cylS.forEach((c, i) => {
    const e = SX.cyl[i]; if (!e) return;
    const th = c.phi * Math.PI / 180, x = SX.cx[i];
    const px = x + r * Math.sin(th), py = 374 - r * Math.cos(th);
    const pinY = py - Math.sqrt(L * L - (r * Math.sin(th)) ** 2);
    const top = pinY - 10;
    e.p.setAttribute('y', top.toFixed(1)); e.r.setAttribute('y1', pinY.toFixed(1)); e.r.setAttribute('x2', px.toFixed(1)); e.r.setAttribute('y2', py.toFixed(1));
    e.k.setAttribute('cx', px.toFixed(1)); e.k.setAttribute('cy', py.toFixed(1));
    e.w.setAttribute('cx', (x - 10 * Math.sin(th)).toFixed(1)); e.w.setAttribute('cy', (374 + 10 * Math.cos(th)).toFixed(1));
    e.g.setAttribute('height', Math.max(0, top - 207).toFixed(1)); e.g.setAttribute('opacity', (c.burn * .9).toFixed(2));
    const li = S.valveLift(c.phi, 'in', T.cam) * 7, le = S.valveLift(c.phi, 'ex', T.cam) * 7;
    e.vi.setAttribute('transform', `translate(0 ${li.toFixed(1)})`); e.ve.setAttribute('transform', `translate(0 ${le.toFixed(1)})`);
    if (P.cam !== 'OHV') { e.ci.setAttribute('transform', `rotate(${(c.phi / 2 - 225 + 90).toFixed(1)})`); e.ce.setAttribute('transform', `rotate(${(c.phi / 2 - 135 + 90).toFixed(1)})`); }
    else { e.ci.setAttribute('y', 150 - li * .5); e.ce.setAttribute('y', 150 - le * .5); }
    if (e.spray) e.spray.setAttribute('opacity', (c.burn > .75 && s.q > .01 && !st.noInject ? (c.burn - .75) * 3 : 0).toFixed(2));
    if (e.gl) e.gl.setAttribute('fill', job.active ? (s.glowOn ? css('--amber') : css('--line2')) : (st.faults.cyl.plug[i] ? css('--line2') : glowColor(c.Tg)));
    if (e.sp) e.sp.setAttribute('fill', c.burn > .85 ? '#cfe9ff' : css('--line2'));
  });
  const A = SX.ang, k = Math.min(dtR, .1);
  // Steuertrieb, Schwungrad, Riemen
  const crankDeg = theta * 180 / Math.PI;
  SX.crankS.setAttribute('transform', `translate(296 374) rotate(${(crankDeg % 360).toFixed(1)})`);
  SX.camS.setAttribute('transform', `translate(296 150) rotate(${((crankDeg / 2) % 360).toFixed(1)})`);
  SX.fly.setAttribute('transform', `translate(702 374) rotate(${(crankDeg % 360).toFixed(1)})`);
  A.chain -= s.rpm * k * .35; SX.chain.setAttribute('stroke-dashoffset', (A.chain % 80).toFixed(1));
  SX.belt.setAttribute('stroke-dashoffset', ((A.chain * .8) % 50).toFixed(1));
  // Kühlkreis
  const vc = vis('cool'), lv = vis('live'), vo = vis('oil'), amb = st.ambient;
  const coldT = s.Tb - 18 * s.thermo - (s.fanOn ? 5 : 0);
  const H = SX.hoses;
  flowAnim(H.HotA, s.circ, 'hA', A, k, s.Tb);
  flowAnim(H.HotB, s.flowRad, 'hB', A, k, s.flowRad > .02 ? s.Tb : Math.min(s.Tb, amb + 8));
  flowAnim(H.By, s.flowBy, 'by', A, k, s.Tb);
  flowAnim(H.HeatA, s.flowHeat, 'heA', A, k, s.Tb);
  flowAnim(H.HeatB, s.flowHeat, 'heB', A, k, st.acc.blower ? s.Tb - 12 : s.Tb - 2);
  flowAnim(H.Cold, s.flowRad, 'co', A, k, s.flowRad > .02 ? coldT : Math.min(s.Tb, amb + 8));
  flowAnim(H.Cold2, s.circ, 'c2', A, k, s.flowRad > .02 ? (coldT * s.thermo + s.Tb * (1 - s.thermo)) : s.Tb);
  A.rad = (A.rad || 0) - s.flowRad * k * 50; SX.radF.setAttribute('stroke-dashoffset', A.rad.toFixed(1)); SX.radF.setAttribute('stroke-opacity', s.flowRad > .02 ? .35 : 0);
  SX.rad.setAttribute('fill', tempColor(s.flowRad > .02 ? coldT + 8 : amb)); SX.rad.setAttribute('opacity', .22);
  SX.heat.setAttribute('opacity', s.flowHeat > 0 ? clamp((s.Tb - 20) / 120, 0, .5).toFixed(2) : 0);
  A.pump += s.rpm * k * 3; SX.pump.setAttribute('transform', `translate(250 330) rotate(${A.pump % 360})`);
  if (s.fanOn) A.fan += k * 900; SX.fan.setAttribute('transform', `translate(140 300) rotate(${A.fan % 360})`);
  SX.fanL.textContent = s.fanOn ? 'Lüfter an' : 'Lüfter aus';
  SX.thermo.setAttribute('height', (6 + 6 * s.thermo).toFixed(1)); SX.thermo.setAttribute('y', (-3 - 3 * s.thermo).toFixed(1));
  SX.thermo.setAttribute('fill', s.thermo > .02 ? tempColor(s.Tb) : css('--mute'));
  SX.thL.textContent = `Thermostat ${s.thermo > .98 ? 'offen' : s.thermo < .02 ? 'zu' : fmt(s.thermo * 100) + ' %'}`;
  SX.circL.textContent = !s.running ? 'Kühlmittel steht · Wasserpumpe läuft nur mit dem Motor' : s.thermo < .02 ? 'Kleiner Kühlkreis: Kopf → Thermostat (zu) → Bypass → Pumpe → Block. Der Kühler bleibt kalt.' : s.thermo > .98 ? 'Großer Kühlkreis: Thermostat ganz offen, alles Kühlmittel fließt über den Kühler.' : `Mischbetrieb: ${fmt(s.thermo * 100)} % über den Kühler, Rest über den Bypass.`;
  SX.exp.setAttribute('y', (96 - 56 * clamp(vc ? s.coolLevel : .7, 0, 1)).toFixed(1)); SX.exp.setAttribute('fill', vc ? css('--cool') : css('--line2'));
  SX.expL.textContent = vc ? `${fmt(s.coolLevel * 100)} %` : '?';
  SX.expL.style.fill = vc && (s.coolLevel < .35 || s.boiling) ? css('--red') : '';
  SX.radT.textContent = `${fmt(s.TbSens)} °C`;
  SX.headHeat.setAttribute('opacity', clamp((s.Thead - 90) / 70, 0, .6).toFixed(2));
  SX.head.textContent = lv ? `Kopf ${fmt(s.Thead)} °C` : 'Kopf';
  SX.head.style.fill = lv && s.Thead > 130 ? css('--red') : '';
  // Öl
  SX.oil.setAttribute('y', (464 - 62 * .8 * clamp(vo ? s.oilLevel : .7, 0, 1)).toFixed(1)); SX.oil.setAttribute('fill', vo ? (s.milky > .3 ? '#d9c8a0' : css('--oil')) : css('--line2'));
  SX.gal.setAttribute('opacity', (.25 + .75 * clamp(s.oilP / 4, 0, 1)).toFixed(2));
  A.oil -= s.oilP * k * 25; SX.galF.setAttribute('stroke-dashoffset', A.oil.toFixed(1)); SX.galF.setAttribute('stroke-opacity', s.oilP > .2 ? .45 : 0);
  if (SX.tOil) SX.tOil.setAttribute('opacity', (.2 + .6 * clamp(s.oilP / 4, 0, 1)).toFixed(2));
  SX.oilL.textContent = vo ? `Ölstand ${fmt(s.oilLevel * 100)} % · ${fmt(s.oilP, 1)} bar · ${fmt(s.To)} °C` : `Ölwanne · ${fmt(s.To)} °C`;
  SX.oilL.style.fill = vo && (s.oilLevel < .4 || (s.running && s.oilP < .6)) ? css('--red') : '';
  // Luft, Ladeluft, Abgas
  const airSp = s.rpm / P.maxRpm * (P.turbo ? (1 + s.boost) : (.3 + .7 * Math.max(st.throttle, st.hand || 0)));
  A.air -= airSp * k * 120; SX.intakeF.setAttribute('stroke-dashoffset', A.air.toFixed(1)); SX.intakeF.setAttribute('stroke-opacity', s.rpm > 30 ? .3 : 0);
  A.exh -= (s.rpm / P.maxRpm) * k * 160; SX.exhF.setAttribute('stroke-dashoffset', A.exh.toFixed(1)); SX.exhF.setAttribute('stroke-opacity', s.running ? .3 : 0);
  if (SX.throttle) SX.throttle.setAttribute('transform', `rotate(${(-80 * Math.max(st.throttle, s.q * .7)).toFixed(0)} 308 118)`);
  if (P.turbo) {
    const b = clamp(s.boost / P.boostMax, 0, 1.6);
    A.comp += (s.turboRpm > 0 ? 120 + b * 1100 : 0) * k;
    SX.comp.setAttribute('transform', `rotate(${A.comp % 360})`); SX.turb.setAttribute('transform', `rotate(${(-A.comp) % 360})`);
    SX.boost.setAttribute('stroke', b > .05 ? tempColor(40 + b * 50) : css('--line2'));
    A.boost -= b * k * 120; SX.boostF.setAttribute('stroke-dashoffset', A.boost.toFixed(1)); SX.boostF.setAttribute('stroke-opacity', b > .05 ? .3 : 0);
    SX.leak.setAttribute('opacity', st.faults.turboHose && !job.active ? 1 : 0);
    SX.turboV.textContent = lv ? `${fmt(s.boost, 2)} bar` : '? bar';
    SX.turboR.textContent = lv && s.turboRpm > 0 ? `${fmtK(Math.round(s.turboRpm / 1000) * 1000)} /min` : '';
  }
  SX.exh.setAttribute('stroke', tempColor(clamp(s.egt, 0, 900) / 7.2)); if (SX.tail) SX.tail.setAttribute('stroke', tempColor(clamp(s.egt, 0, 900) / 9));
  SX.egtL.textContent = lv ? `${fmt(s.egt)} °C` : '';
  const sm = s.smoke, dens = s.rpm < 5 ? 0 : clamp(sm.white * .3 + sm.black * .8 + sm.blue * .6 + sm.sweet * .4 + (s.Tb < 40 && s.running ? .15 : 0), 0, .8);
  const sc = sm.black > .25 ? '#2a2a2c' : sm.blue > .4 ? '#9fb3e6' : '#d5dce1';
  SX.smk.forEach((c, i) => { c.setAttribute('opacity', (dens * (1 - i * .2)).toFixed(2)); c.setAttribute('fill', sc); });
  if (SX.grid) SX.grid.setAttribute('fill', s.glowOn ? glowColor(s.Tgrid + 300) : css('--panel3'));
  SX.starter.setAttribute('fill', s.starterEng ? css('--amber-dim') : css('--panel3')); SX.starter.setAttribute('stroke', s.starterEng ? css('--amber') : css('--line2'));
  SX.pinion.setAttribute('fill', s.starterEng ? css('--amber') : css('--line2'));
  A.alt += s.rpm * k * 8; SX.alt.setAttribute('transform', `translate(246 421) rotate(${A.alt % 360})`);
  SX.altL.textContent = `LiMa ${fmt(s.Ialt)} A`;
  SX.bat.textContent = `${fmt(Math.max(0, s.Vt), 1)} V`;
  setT('motorNote', s.running ? `${fmt(s.rpm)} U/min · ${fmt(s.powerKW)} kW` : 'Motor steht');
  if (P.turbo) {
    kvGrid($('kvTurbo'), 'kvT', [
      ['Ladedruck', lv ? fmt(s.boost, 2) : '?', 'bar', lv ? s.boost / (P.boostMax * 1.5) : 0],
      ['Turbodrehzahl', lv ? fmtK(Math.round(s.turboRpm / 1000)) : '?', 'Tsd./min'],
      ['Ladeluft', lv ? fmt(s.Tin) : '?', '°C'],
      ['Abgastemperatur', lv ? fmt(s.egt) : '?', '°C', lv ? s.egt / 1000 : 0, s.egt > (P.diesel ? 760 : 960) ? css('--red') : css('--amber')],
    ]);
    setT('bTurbo', s.limp ? 'Notlauf' : '');
  } else {
    kvGrid($('kvTurbo'), 'kvT', [['Füllungsgrad', lv ? fmt(s.veNow * 100) : '?', '%', lv ? s.veNow : 0], [P.carb ? 'Gemischmenge' : 'Einspritzmenge', lv ? fmt(s.q * 100) : '?', '%'], ['Abgastemperatur', lv ? fmt(s.egt) : '?', '°C', lv ? s.egt / 1100 : 0, s.egt > 960 ? css('--red') : css('--amber')], ['Abgas', smokeShort(), '']]);
    setT('bTurbo', '');
  }
  kvGrid($('kvCool'), 'kvC', [
    ['Kühlmittel', fmt(s.TbSens), '°C', (s.TbSens - 20) / 110, tempColor(s.TbSens)],
    ['Zylinderkopf', lv ? fmt(s.Thead) : '?', '°C', lv ? (s.Thead - 20) / 170 : 0, tempColor(s.Thead)],
    ['Stand', vc ? fmt(s.coolLevel * 100) : '?', '%', vc ? s.coolLevel : 0, s.coolLevel < .35 ? css('--red') : css('--cool')],
    ['Kühlerdurchfluss', s.running ? fmt(s.thermo * 100) : '0', '%', s.running ? s.thermo : 0],
  ]);
  setT('bCool', s.boiling ? 'kocht!' : s.TbSens > 110 ? 'zu heiß' : s.fanOn ? 'Lüfter an' : s.running ? (s.thermo < .02 ? 'kleiner Kreis' : 'großer Kreis') : '');
  $('bCool').className = 'badge' + (s.boiling || s.TbSens > 110 ? ' warn' : '');
  kvGrid($('kvOil'), 'kvO', [
    ['Öldruck', vo ? fmt(s.oilP, 1) : '?', 'bar', vo ? s.oilP / 6 : 0, s.running && s.oilP < .6 ? css('--red') : css('--oil')],
    ['Öltemperatur', fmt(s.To), '°C'],
    ['Ölstand', vo ? fmt(s.oilLevel * 100) : '?', '%', vo ? s.oilLevel : 0, s.oilLevel < .4 ? css('--red') : css('--oil')],
    ['Verschleiß', fmt(s.wear, s.wear < 10 ? 1 : 0), '%', s.wear / 100, s.wear > 30 ? css('--red') : css('--yellow')],
  ]);
  setT('bOil', s.seized ? 'Motor fest' : '');
  $('bOil').className = 'badge' + (s.seized ? ' warn' : '');
  kvGrid($('kvEl'), 'kvE', [
    [P.nBat > 1 ? 'Bordnetz (2 × 12 V)' : 'Bordnetz', fmt(Math.max(0, s.Vt), 1), 'V'],
    ['Ladezustand', fmt(s.soc * 100), '%', s.soc],
    ['Lichtmaschine', fmt(s.Ialt), 'A'],
    ['Anlasser', s.starterEng ? fmt(s.Is) : '0', 'A'],
  ]);
  setT('bEl', s.frozen ? 'Batterie gefroren' : P.nBat > 1 ? `je Batterie ${fmt(Math.max(0, s.Vt) / 2, 1)} V` : '');
  let firing = 0;
  if (vis('ir')) firing = drawCylinders();
  setT('firingN', vis('ir') ? `${firing}/${n}` : '?');
  drawPV();
}
let pvData = null;
function drawPV() {
  const cv = $('pv'); if (!cv) return;
  const H = 260, { g, W } = prepCanvas(cv, H);
  const L = 50, R = 14, Tp = 12, B = 30, w = W - L - R, h = H - Tp - B;
  const P = PRE(), maxP = P.diesel ? (P.turbo ? 200 : 120) : (P.turbo ? 120 : 80);
  const ly = p => Tp + h - Math.log10(clamp(p, .5, maxP)) / Math.log10(maxP) * h;
  const lx = v => L + v * w;
  const line = css('--line'), mute = css('--mute');
  g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = mute; g.textBaseline = 'middle'; g.textAlign = 'right';
  for (const p of [1, 2, 5, 10, 20, 50, 100, 200].filter(x => x <= maxP)) { const y = ly(p); g.beginPath(); g.moveTo(L, Math.round(y) + .5); g.lineTo(L + w, Math.round(y) + .5); g.stroke(); g.fillText(p + ' bar', L - 6, y); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let v = 0; v <= 1.001; v += .25) { const x = lx(v); g.fillText(v === 0 ? '0' : fmt(v * 100) + ' %', x, Tp + h + 6); }
  g.fillText('Zylindervolumen (bezogen auf UT)', L + w / 2, Tp + h + 18);
  if (pvData && pvData.length > 10) {
    g.lineWidth = 2; g.lineJoin = 'round';
    const seg = (cond, col) => { g.strokeStyle = col; g.beginPath(); let st0 = false; pvData.forEach((pt, i) => { const [v, p, ph] = pt; const ok = cond(ph); if (!ok) { st0 = false; return; } const x = lx(v), y = ly(p); if (!st0) { g.moveTo(x, y); st0 = true; } else g.lineTo(x, y); }); g.stroke(); };
    seg(ph => ph >= 540 || ph < 4, css('--ice')); seg(ph => ph < 184, css('--amber')); seg(ph => ph >= 180 && ph < 364, css('--hot')); seg(ph => ph >= 360 && ph < 544, css('--cool'));
    let wsum = 0; for (let i = 1; i < pvData.length; i++) wsum += (pvData[i][1] + pvData[i - 1][1]) / 2 * (pvData[i][0] - pvData[i - 1][0]);
    const Vbdc = 1, Vc = 1 / (P.cr), imep = wsum * Vbdc / (1 - Vc);
    const pmax = Math.max(...pvData.map(x => x[1]));
    setT('pvNote', `p max ${fmt(pmax)} bar · indizierter Mitteldruck ${fmt(imep, 1)} bar`);
  } else setT('pvNote', 'Motor starten, um das Diagramm zu sehen');
}

/* ---------- Fehlerkatalog ---------- */
function buildFaultUI() {
  const P = PRE(), box = $('faultGroups'); box.innerHTML = '';
  for (const g in S.GROUPS) {
    const sys = Object.keys(S.FAULTS).filter(k => S.FAULTS[k].g === g && S.applies(S.FAULTS[k].need, P));
    const cyl = Object.keys(S.CYL_FAULTS).filter(k => S.CYL_FAULTS[k].g === g && S.cylFaultLabel(k, P));
    if (!sys.length && !cyl.length) continue;
    const card = document.createElement('article'); card.className = 'card';
    card.innerHTML = `<div class="card-h"><h2>${S.GROUPS[g]}</h2><span class="badge" data-gb="${g}"></span></div><div class="card-b tight"></div>`;
    const body = card.querySelector('.card-b');
    for (const key of cyl) {
      const label = S.cylFaultLabel(key, P);
      const row = document.createElement('div'); row.className = 'frow';
      row.innerHTML = `<span>${label}<br><small class="hint">je Zylinder</small></span>`;
      const bs = document.createElement('div'); bs.className = 'cbtns';
      for (let i = 0; i < P.cyl; i++) {
        const b = document.createElement('button'); b.textContent = i + 1;
        b.setAttribute('aria-label', `${label} Zylinder ${i + 1}`);
        b.setAttribute('aria-pressed', String(!!st.vfaults.cyl[key][i]));
        b.onclick = () => { st.vfaults.cyl[key][i] = !st.vfaults.cyl[key][i]; b.setAttribute('aria-pressed', String(st.vfaults.cyl[key][i])); faultsChanged(); };
        bs.appendChild(b);
      }
      row.appendChild(bs); body.appendChild(row);
    }
    for (const key of sys) {
      const F = S.FAULTS[key];
      const row = document.createElement('div'); row.className = 'frow';
      const lab = document.createElement('label'); lab.className = 'check red';
      lab.innerHTML = `<input type="checkbox" id="f_${key}"${st.vfaults[key] ? ' checked' : ''}><span>${F.label}</span>`;
      row.appendChild(lab);
      const right = document.createElement('span');
      if (F.prog) right.innerHTML = '<span class="pill prog">schleichend</span>';
      row.appendChild(right);
      lab.querySelector('input').onchange = e => {
        st.vfaults[key] = e.target.checked;
        if (key === 'airFuel') send({ type: 'set', v: { air: e.target.checked ? 1 : 0 } });
        if (key === 'float' && e.target.checked) send({ type: 'set', v: { bowl: 0 } });
        if (key === 'oilLow') send({ type: 'set', v: { oilLevel: e.target.checked ? .3 : 1 } });
        faultsChanged();
      };
      body.appendChild(row);
    }
    box.appendChild(card);
  }
  updateFaultBadges();
}
function faultsChanged() { sendCfg(); updateFaultBadges(); persist(); }
function updateFaultBadges() {
  const f = st.vfaults;
  for (const el of document.querySelectorAll('[data-gb]')) {
    const g = el.dataset.gb; let n = 0;
    for (const k in S.FAULTS) if (S.FAULTS[k].g === g && f[k]) n++;
    for (const k in S.CYL_FAULTS) if (S.CYL_FAULTS[k].g === g) n += f.cyl[k].filter(Boolean).length;
    el.textContent = n ? n + ' aktiv' : ''; el.className = 'badge' + (n ? ' warn' : '');
  }
}
function buildAcc() {
  const P = PRE(), ac = $('accs'); ac.innerHTML = '';
  const ACC = [
    ['heater', 'Motorvorwärmer 230 V', `${P.heaterW} W Heizpatrone im Kühlkreislauf`],
    ['charger', 'Batterieladegerät', '10 A, nur bei stehendem Motor. Eine gefrorene Batterie nimmt nichts an.'],
    ...(P.diesel ? [['fuelHeat', 'Kraftstofffilterheizung', `${P.fuelHeatA} A bei Zündung an, bis zu +18 °C am Filter`]] : []),
    ['light', 'Abblendlicht', `${P.acc.light} A`], ['blower', 'Gebläse Stufe 4', `${P.acc.blower} A`], ['rear', 'Heckscheiben- und Spiegelheizung', `${P.acc.rear} A`],
  ];
  for (const [k, t, sub] of ACC) {
    const lab = document.createElement('label'); lab.className = 'check';
    lab.innerHTML = `<input type="checkbox" id="a_${k}"${st.acc[k] ? ' checked' : ''}><span>${t}<small>${sub}</small></span>`;
    lab.querySelector('input').onchange = e => { st.acc[k] = e.target.checked; sendCfg(); persist(); };
    ac.appendChild(lab);
  }
}
function buildEngineUI() {
  const P = PRE();
  $('engLabel').textContent = P.label;
  $('fuelField').hidden = !P.diesel;
  $('preBtn').hidden = !P.diesel; $('lpGlow').hidden = !P.diesel; $('lpWater').hidden = !P.diesel;
  $('lpMil').hidden = !!P.carb; $('lpLimp').hidden = !P.turbo;
  $('carbBox').hidden = !P.carb;
  $('noInjLbl').textContent = P.diesel ? 'Einspritzung aus (Prüfmodus)' : 'Kraftstoff und Zündung aus (Prüfmodus)';
  $('sysPill').textContent = P.sysV === 24 ? '24-V-Bordnetz · 2 Batterien in Reihe · Ladespannung 28,4 V' : '12-V-Bordnetz · Ladespannung 14,2 V';
  $('qVk').textContent = 'Volt';
  $('batInfo').textContent = P.sysV === 24 ? `2 × ${P.batAh} Ah · 24 V` : `${P.batAh} Ah · 12 V`;
  $('sysTurboH').textContent = P.turbo ? 'Aufladung' : 'Ansaugung';
  $('pBk').textContent = P.turbo ? 'Ladedruck' : 'Einspritzmenge';
  const Vd = Math.PI * P.bore * P.bore / 4 * P.stroke * P.cyl * 1000;
  $('engInfo').innerHTML = `${P.cyl} Zylinder, ${fmt(Vd, 1)} l Hubraum, Verdichtung ${fmt(P.cr, 1)} : 1, ${P.turbo ? `Turbolader bis ${fmt(P.boostMax, 1)} bar` : 'Saugmotor'}. ${P.sysV}-V-Bordnetz${P.sysV === 24 ? ': zwei 12-V-Batterien in Reihe, Ladespannung 28,4 V ist normal.' : ', Ladespannung 14,2 V.'}`;
  buildCylinders(); buildSchematic(); buildFaultUI(); buildAcc(); buildScen(); buildTuning();
}

/* ---------- Szenarien ---------- */
const SCEN = [
  { t: 'Frostiger Morgen', s: '−18 °C, alles gesund', d: 'Normales Winterwetter. So startet ein gesunder Motor bei Frost.', p: { ambient: -18, fuel: 'winter' } },
  { t: 'Sibirien', s: '−35 °C, Arktisdiesel', d: 'Ohne Vorwärmen wird es eng. Motorvorwärmer einschalten und Zeitraffer 600× nutzen.', p: { ambient: -35, fuel: 'arktis' } },
  { t: 'Sommerdiesel im Winter', s: '−14 °C, Paraffin flockt', d: 'Der Filter verstopft. Die Filterheizung hilft.', p: { ambient: -14, fuel: 'sommer' }, need: 'diesel' },
  { t: 'Schwache Batterie', s: '45 % Ladung, gealtert', d: 'Der Magnetschalter klackert, die Spannung bricht ein.', p: { ambient: -12, soc: .45, soh: .55 } },
  { t: 'Batterie eingefroren', s: '12 % Ladung bei −22 °C', d: 'Der Elektrolyt ist gefroren. Erst auftauen, dann laden.', p: { ambient: -22, soc: .12 } },
  { t: 'Vorglühen defekt', s: 'schlechter Kaltstart', d: 'Springt schlecht an, läuft unrund, qualmt weiß.', p: { ambient: -15, cyl: { plug: [1, 3] } }, need: 'diesel' },
  { t: 'Luft im System', s: 'nach dem Filterwechsel', d: 'Lange orgeln oder per Handpumpe entlüften (Einstellungen › Zubehör).', p: { ambient: 6, faults: { airFuel: true } }, need: 'diesel' },
  { t: 'Sensor lügt', s: 'Kühlmittelsensor meldet warm', d: 'Kein Vorglühen, keine Kaltstartanreicherung.', p: { ambient: -16, faults: { coolSensor: true } }, need: 'ecu' },
  { t: 'Kühlerschlauch undicht', s: 'Kühlwasser geht verloren', d: 'Gas 50 %, Last 50 %, Zeitraffer 60×. Ausgleichsbehälter und Temperatur beobachten. Rechtzeitig abstellen, sonst brennt die Kopfdichtung durch.', p: { ambient: 15, faults: { coolLeak: true } } },
  { t: 'Ölwanne leckt', s: 'Öldruck fällt nach und nach', d: 'Unter Last mit Zeitraffer laufen lassen. Wenn die Öldrucklampe flackert: sofort abstellen.', p: { ambient: 10, faults: { oilLeak: true } } },
  { t: 'Zylinderkopfdichtung', s: 'Wasserschlag am Morgen', d: 'Der Anlasser blockiert: Kühlmittel im Zylinder. Werkstatt › Kerzen raus & durchdrehen. Danach: weißer süßlicher Rauch, Druck im Kühlsystem, CO₂-Test positiv.', p: { ambient: 5, faults: { headGasket: true } } },
  { t: 'Kolbenringe gebrochen', s: 'Zylinder 3, Ölverbrauch', d: 'Blauer Rauch, Kurbelgehäusedruck. Kompressionstest trocken und nass vergleichen.', p: { ambient: 2, cyl: { rings: [2] } } },
  { t: 'Ladeluftschlauch geplatzt', s: 'kaum Ladedruck', d: 'Vollgas mit Last: Zischen, wenig Leistung, Fehlercode P0299.', p: { ambient: 15, faults: { turboHose: true } }, need: 'turbo' },
  { t: 'Turbolader-Lagerschaden', s: 'Pfeifen, blauer Rauch', d: 'Lagerspiel: Öl gelangt in Ansaugung und Abgas.', p: { ambient: 12, faults: { turboBearing: true } }, need: 'turbo' },
  { t: 'Kühlerlüfter defekt', s: 'Sommer, 32 °C', d: 'Mit Last und Zeitraffer 60×: Die Temperatur steigt, weil am Prüfstand kein Fahrtwind kühlt.', p: { ambient: 32, faults: { fan: true } } },
  { t: 'Zu wenig Öl', s: 'Öldrucklampe flackert', d: 'Springt an, aber im Leerlauf flackert die Lampe. Nicht lange laufen lassen.', p: { ambient: 2, faults: { oilLow: true } } },
  { t: 'Thermostat klemmt', s: 'Motor wird nicht warm', d: 'Mit Zeitraffer 60× laufen lassen und Kühlmittel beobachten.', p: { ambient: -5, faults: { thermostat: true } } },
  { t: 'Oldtimer im Frost', s: 'Vergaser bei −8 °C', d: 'Choke ziehen, einmal Gas durchtreten, starten. Zu viel Pumpen säuft ihn ab. Nach dem Anspringen Choke langsam zurücknehmen.', p: { ambient: -8 }, need: 'carb' },
  { t: 'Warmer Motor', s: '+20 °C, Referenz', d: 'So sollte ein gesunder Start klingen.', p: { ambient: 20, fuel: 'winter' } },
];
function applyScenario(sc) {
  const P = PRE();
  st.ambient = sc.p.ambient; st.soc = sc.p.soc ?? .9; st.soh = sc.p.soh ?? 1; st.starterCond = 1;
  if (sc.p.fuel) st.fuel = sc.p.fuel;
  st.oil = P.oil; st.mystery = null; st.choke = 0; st.throttle = 0; st.hand = 0; st.load = 0;
  st.vfaults = { cyl: blankCyl(P.cyl) };
  if (sc.p.faults) for (const k in sc.p.faults) if (S.applies(S.FAULTS[k].need, P)) st.vfaults[k] = true;
  if (sc.p.cyl) for (const k in sc.p.cyl) for (const i of sc.p.cyl[k]) {
    if (i >= P.cyl) continue;
    if (k === 'plug' && P.pre === 'grid') st.vfaults.grid = true; else st.vfaults.cyl[k][i] = true;
  }
  st.acc = blankAcc();
  sendInit(false, `Szenario: ${sc.t}`);
  buildEngineUI(); syncInputs();
  $('scenHint').innerHTML = `<b style="color:var(--text)">${esc(sc.t)}:</b> ${esc(sc.d)}`;
  persist();
}
function buildScen() {
  const box = $('scen'); box.innerHTML = '';
  for (const sc of SCEN) {
    if (sc.need && !S.applies(sc.need, PRE())) continue;
    const b = document.createElement('button'); b.innerHTML = `<b>${esc(sc.t)}</b><span>${esc(sc.s)}</span>`; b.title = sc.d; b.onclick = () => applyScenario(sc); box.appendChild(b);
  }
}

/* ---------- Diagnose-Auftrag ---------- */
const TOOLS = [
  { k: 'dtc', t: 'Fehlerspeicher auslesen', m: 5 },
  { k: 'live', t: 'Diagnosegerät: Live-Daten', m: 10 },
  { k: 'ir', t: 'IR-Thermometer, Endoskop, Kerzen', m: 10 },
  { k: 'cool', t: 'Kühlsystem-Prüfset (Druck, CO₂)', m: 10 },
  { k: 'oil', t: 'Ölmessstab & Öldruck-Manometer', m: 5 },
  { k: 'batt', t: 'Batterietester', m: 5 },
  { k: 'scope', t: 'Stromzange & Kompressionstest', m: 15 },
];
const vis = k => !job.active || !!job.used[k];
function candidates() {
  const P = PRE(), list = [];
  for (const k in S.FAULTS) { const F = S.FAULTS[k]; if (F.noMystery || !S.applies(F.need, P)) continue; list.push({ key: k, label: F.label }); }
  for (const k in S.CYL_FAULTS) { const l = S.cylFaultLabel(k, P); if (!l) continue; for (let i = 0; i < P.cyl; i++) list.push({ key: k, cyl: i, label: `${l} · Zylinder ${i + 1}` }); }
  return list;
}
const isTruth = (p, m) => p.key === m.key && (p.cyl ?? null) === (m.cyl ?? null);
function jobStartFn() {
  const P = PRE(), pool = candidates();
  const m = pool[Math.floor(Math.random() * pool.length)];
  st.mystery = { key: m.key, cyl: m.cyl ?? null };
  st.vfaults = { cyl: blankCyl(P.cyl) }; st.acc = blankAcc(); st.soc = .85; st.soh = 1; st.starterCond = 1; st.choke = 0; st.noInject = false; st.wetTest = false; st.throttle = 0; st.hand = 0; st.load = 0;
  if (P.diesel && S.FUELS[st.fuel].cfpp > st.ambient + 3) st.fuel = 'arktis';
  job = { active: true, min: 0, used: {}, result: null };
  sendInit(false, 'Diagnose-Auftrag angenommen · Fahrzeug stand über Nacht draußen');
  if (st.mystery.key === 'airFuel') send({ type: 'set', v: { air: 1 } });
  if (st.mystery.key === 'oilLow') send({ type: 'set', v: { oilLevel: .3 } });
  buildEngineUI(); syncInputs(); renderJob(); persist();
}
function jobEnd(guessIdx, aborted) {
  const pool = candidates(), g = pool[guessIdx], m = st.mystery;
  const ok = !aborted && g && isTruth(g, m);
  const truth = pool.find(p => isTruth(p, m));
  const score = ok ? Math.max(10, Math.round(100 - Math.max(0, job.min - 10) * 1.2)) : 0;
  job.result = { ok, score, truth: truth ? truth.label : '?', min: job.min, aborted };
  if (ok && (!best || score > best)) best = score;
  job.active = false; st.mystery = null;
  sendCfg(); renderJob(); persist();
}
function renderJob() {
  document.body.classList.toggle('job', job.active);
  $('tbJob').hidden = !job.active;
  $('jobBadge').textContent = job.active ? `läuft · ${job.min} min` : '';
  $('jobPill').textContent = `Auftrag läuft · ${job.min} min`;
  $('bestTxt').textContent = best ? `Bestwert: ${best} Punkte` : '';
  if (job.active) {
    $('tools').innerHTML = TOOLS.map(t => `<span>${t.t}</span>${job.used[t.k] ? '<span class="used">benutzt</span>' : `<button class="btn sm" data-use="${t.k}">+${t.m} min</button>`}`).join('');
    const sel = $('guess');
    if (sel.dataset.eng !== st.engine || !sel.options.length) { sel.innerHTML = ''; candidates().forEach((c, i) => sel.add(new Option(c.label, i))); sel.dataset.eng = st.engine; }
  }
  const r = job.result;
  $('jobResult').innerHTML = r ? `<div class="result ${r.ok ? 'ok' : 'bad'}">${r.ok ? `<b style="color:var(--green)">Richtig!</b> ${r.score} Punkte nach ${r.min} min Werkstattzeit.` : `<b style="color:var(--red)">${r.aborted ? 'Auftrag abgebrochen.' : 'Leider falsch.'}</b> Verbaut war: <b>${esc(r.truth)}</b>.`}</div>` : '';
  for (const el of document.querySelectorAll('.lockable')) {
    const k = el.dataset.tool, need = !vis(k);
    let lk = el.querySelector(':scope > .lock');
    if (need && !lk) {
      const t = TOOLS.find(x => x.k === k);
      lk = document.createElement('div'); lk.className = 'lock';
      lk.innerHTML = `<span>Gesperrt im Auftrag · ${t.t}</span><button class="btn sm" data-use="${k}">Benutzen · +${t.m} min</button>`;
      el.appendChild(lk);
    } else if (!need && lk) lk.remove();
  }
}
document.addEventListener('click', e => {
  const k = e.target.closest('[data-use]'); if (!k || !job.active) return;
  const t = TOOLS.find(x => x.k === k.dataset.use); if (!t || job.used[t.k]) return;
  job.used[t.k] = true; job.min += t.m; renderJob(); persist();
});
$('jobStart').onclick = jobStartFn;
$('jobSubmit').onclick = () => jobEnd(+$('guess').value, false);
$('jobAbort').onclick = () => jobEnd(-1, true);

/* ================= Tuning ================= */
const tuneGet = () => Object.assign({}, S.TUNE_DEF, st.tune || {});
let dynoRes = null, dynoBusy = false;
function tunePresets() {
  const P = PRE(), lim = (d) => Math.min(P.mechMax, P.maxRpm + d);
  if (P.turbo) return [
    ['Serie', {}],
    ['Stage 1', { boost: 1.2, fuel: 1.15, timing: 2 }],
    ['Stage 2', { boost: 1.3, fuel: 1.25, timing: 3, turboBig: true, intercooler: true, exhaust: 'sport' }],
    ['Übertrieben', { boost: 1.5, fuel: 1.4, timing: 8, turboBig: false, exhaust: 'straight', limiter: P.mechMax + 200 }],
  ];
  return [
    ['Serie', {}],
    ['Stage 1', { timing: 3, exhaust: 'sport', limiter: lim(300) }],
    ['Stage 2', { timing: 4, cam: 'sport', exhaust: 'sport', limiter: lim(500) }],
    ['Rennmotor', { timing: 6, cam: 'race', exhaust: 'straight', limiter: P.mechMax, radiator: true }],
  ];
}
function buildTuning() {
  const P = PRE();
  $('tBoostRow').hidden = !P.turbo; $('tTurboHW').hidden = !P.turbo; $('tIcHW').hidden = !P.turbo; $('tKnockRow').hidden = P.diesel;
  $('tTimingLbl').textContent = P.diesel ? 'Einspritzbeginn' : 'Zündzeitpunkt';
  const lim = $('tLimit'); lim.min = Math.round((P.idle + 1500) / 100) * 100; lim.max = Math.round(P.mechMax * 1.15 / 100) * 100;
  const cam = $('tCam'); cam.innerHTML = ''; for (const k in S.CAMS) cam.add(new Option(S.CAMS[k].label + (k === 'serie' ? '' : ''), k));
  const ex = $('tExh'); ex.innerHTML = ''; for (const k in S.EXH) ex.add(new Option(S.EXH[k].label, k));
  const pb = $('tPresets'); pb.innerHTML = '';
  for (const [name, t] of tunePresets()) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = name; b.onclick = () => { st.tune = Object.assign({}, t); syncTuning(); sendCfg(); persist(); }; pb.appendChild(b); }
  dynoRes = null; drawDyno(); syncTuning();
}
function syncTuning() {
  const P = PRE(), T = tuneGet();
  $('tBoost').value = Math.round(T.boost * 100); $('tFuel').value = Math.round(T.fuel * 100); $('tTiming').value = T.timing;
  $('tLimit').value = T.limiter || P.maxRpm; $('tKnock').checked = T.knockCtl;
  $('tCam').value = T.cam; $('tExh').value = T.exhaust; $('tTurboBig').checked = T.turboBig; $('tIc').checked = T.intercooler; $('tRad').checked = T.radiator;
  const bm = P.turbo ? P.boostMax * T.boost * (T.turboBig ? 1.35 : 1) : 0;
  $('tBoostO').textContent = `${fmt(T.boost * 100)} %`;
  $('tFuelO').textContent = `${fmt(T.fuel * 100)} %`;
  $('tTimingO').textContent = `${T.timing > 0 ? '+' : ''}${fmt(T.timing)}°`;
  $('tLimitO').textContent = fmtK(T.limiter || P.maxRpm);
  const lim = T.limiter || P.maxRpm;
  $('tSwHint').innerHTML = [
    P.turbo ? `Ladedruck-Soll: <b>${fmt(bm, 2)} bar</b> (Serie ${fmt(P.boostMax, 1)} bar).` : '',
    P.diesel ? 'Mehr Einspritzmenge als die Luft verbrennen kann gibt schwarzen Rauch und heißes Abgas.' : 'Früher zünden bringt Leistung, bis der Motor klopft.',
    lim > P.mechMax ? `<span style="color:var(--red)">Begrenzer über der mechanischen Grenze von ${fmtK(P.mechMax)} U/min: Die Ventile können den Kolben treffen.</span>` : `Mechanische Grenze: ${fmtK(P.mechMax)} U/min.`,
  ].filter(Boolean).join(' ');
  const cm = S.CAMS[T.cam];
  $('tHwHint').textContent = T.cam === 'serie' ? 'Seriennocken: ruhiger Leerlauf, gute Füllung untenrum.' : `${cm.label}: mehr Überschneidung, Leistung verschiebt sich nach oben, Leerlauf ${T.cam === 'race' ? 'stark unrund und höher' : 'leicht unrund'}, beim Kaltstart weniger Kompression.`;
}
const tSet = (id, key, f) => { $(id).oninput = e => { st.tune = Object.assign({}, st.tune || {}, { [key]: f(e.target) }); syncTuning(); sendCfg(); }; $(id).onchange = persist; };
tSet('tBoost', 'boost', el => +el.value / 100); tSet('tFuel', 'fuel', el => +el.value / 100); tSet('tTiming', 'timing', el => +el.value);
tSet('tLimit', 'limiter', el => +el.value); tSet('tKnock', 'knockCtl', el => el.checked);
tSet('tCam', 'cam', el => el.value); tSet('tExh', 'exhaust', el => el.value);
tSet('tTurboBig', 'turboBig', el => el.checked); tSet('tIc', 'intercooler', el => el.checked); tSet('tRad', 'radiator', el => el.checked);
$('dynoBtn').onclick = () => { if (dynoBusy) return; dynoBusy = true; $('dynoBtn').disabled = true; setT('dynoNote', 'Messung läuft …'); send({ type: 'dyno', compare: true }); };
function onDyno(d) {
  dynoBusy = false; $('dynoBtn').disabled = false;
  if (d.key !== st.engine) return;
  dynoRes = d; setT('dynoNote', 'Volllastkurve bei warmem Motor'); drawDyno();
}
function drawDyno() {
  const cv = $('dyno'); if (!cv || !cv.clientWidth) return;
  const H = 300, { g, W } = prepCanvas(cv, H);
  const L = 52, R = 52, T = 22, B = 34, w = W - L - R, h = H - T - B;
  const mute = css('--mute'), line = css('--line'), ice = css('--ice'), amber = css('--amber');
  g.fillStyle = mute; g.textAlign = 'left'; g.textBaseline = 'top'; g.font = '12px ' + css('--f-body');
  if (!dynoRes) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Noch keine Messung. „Messung starten“ fährt eine Volllastkurve.', W / 2, H / 2); setT('dPmax', '–'); setT('dMmax', '–'); setT('dGain', '–'); return; }
  const all = [...dynoRes.tuned, ...(dynoRes.serie || [])];
  const rMin = Math.min(...all.map(p => p.rpm)), rMax = Math.max(...all.map(p => p.rpm));
  const nmMax = Math.ceil(Math.max(...all.map(p => p.nm)) * 1.12 / 50) * 50 || 100, kwMax = Math.ceil(Math.max(...all.map(p => p.kw)) * 1.12 / 10) * 10 || 10;
  const X = r => L + (r - rMin) / (rMax - rMin || 1) * w, Yn = v => T + h - v / nmMax * h, Yk = v => T + h - v / kwMax * h;
  g.strokeStyle = line; g.lineWidth = 1; g.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) { const y = T + h - i / 5 * h; g.beginPath(); g.moveTo(L, Math.round(y) + .5); g.lineTo(L + w, Math.round(y) + .5); g.stroke(); g.fillStyle = ice; g.textAlign = 'right'; g.fillText(fmtK(nmMax * i / 5), L - 6, y); g.fillStyle = amber; g.textAlign = 'left'; g.fillText(fmtK(kwMax * i / 5), L + w + 6, y); }
  g.fillStyle = mute; g.textAlign = 'center'; g.textBaseline = 'top';
  const step = (rMax - rMin) > 3000 ? 1000 : 500;
  for (let r = Math.ceil(rMin / step) * step; r <= rMax; r += step) g.fillText(fmtK(r), X(r), T + h + 6);
  g.fillText('U/min', L + w / 2, T + h + 20);
  g.textBaseline = 'top'; g.fillStyle = ice; g.textAlign = 'left'; g.fillText('Drehmoment Nm', 4, 2); g.fillStyle = amber; g.textAlign = 'right'; g.fillText('Leistung kW', W - 4, 2);
  const curve = (pts, key, Y, col, dash) => { g.strokeStyle = col; g.lineWidth = dash ? 1.6 : 2.5; g.setLineDash(dash ? [5, 4] : []); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.rpm), Y(p[key])) : g.moveTo(X(p.rpm), Y(p[key]))); g.stroke(); g.setLineDash([]); };
  if (dynoRes.serie) { g.globalAlpha = .55; curve(dynoRes.serie, 'nm', Yn, ice, true); curve(dynoRes.serie, 'kw', Yk, amber, true); g.globalAlpha = 1; }
  curve(dynoRes.tuned, 'nm', Yn, ice, false); curve(dynoRes.tuned, 'kw', Yk, amber, false);
  const pk = dynoRes.tuned.reduce((a, b) => b.kw > a.kw ? b : a), mk2 = dynoRes.tuned.reduce((a, b) => b.nm > a.nm ? b : a);
  g.fillStyle = amber; g.beginPath(); g.arc(X(pk.rpm), Yk(pk.kw), 4, 0, 7); g.fill(); g.fillStyle = ice; g.beginPath(); g.arc(X(mk2.rpm), Yn(mk2.nm), 4, 0, 7); g.fill();
  g.font = '11.5px ' + css('--f-body'); g.fillStyle = mute; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (dynoRes.serie) g.fillText('gestrichelt: Serie · durchgezogen: aktueller Stand', L + 6, T + 14);
  setT('dPmax', `${fmt(pk.kw)}`); setT('dPmaxU', `kW · ${fmt(pk.kw * 1.36)} PS bei ${fmtK(pk.rpm)}`);
  setT('dMmax', `${fmtK(mk2.nm)}`); setT('dMmaxU', `Nm bei ${fmtK(mk2.rpm)}`);
  if (dynoRes.serie) { const ps = dynoRes.serie.reduce((a, b) => b.kw > a.kw ? b : a); setT('dGain', `${(pk.kw >= ps.kw ? '+' : '') + fmt((pk.kw / ps.kw - 1) * 100)}`); }
}
function renderTuning() {
  const s = snap, P = PRE(), T = tuneGet();
  const lim = T.limiter || P.maxRpm;
  const egtW = P.diesel ? 760 : 960, egtD = P.diesel ? 830 : 1030;
  const items = [
    ['Abgastemperatur', fmt(s.egt), '°C', s.egt / egtD, s.egt > egtW ? css('--red') : css('--amber')],
    ['Drehzahl', fmtK(s.rpm), `von ${fmtK(P.mechMax)} mech.`, s.rpm / P.mechMax, s.rpm > P.mechMax ? css('--red') : s.rpm > lim - 100 ? css('--yellow') : css('--ice')],
  ];
  if (P.turbo) items.push(['Ladedruck', fmt(s.boost, 2), `Soll ${fmt(P.boostMax * T.boost * (T.turboBig ? 1.35 : 1), 2)} bar`, s.boost / (P.boostMax * 1.55 * (T.turboBig ? 1.45 : 1)), s.boost > P.boostMax * 1.55 * (T.turboBig ? 1.45 : 1) ? css('--red') : css('--ice')]);
  if (P.diesel) items.push(['Kraftstoff ggü. Luft', fmt(s.rich * 100), '% der Rauchgrenze', s.rich / 1.5, s.rich > 1.02 ? css('--red') : css('--green')]);
  else items.push(['Klopfregelung', s.knockRetard > .2 ? `−${fmt(s.knockRetard, 1)}` : '0', '° Rücknahme', s.knockRetard / 14, s.knockRetard > 3 ? css('--red') : css('--yellow')]);
  items.push(['Füllungsgrad', fmt(s.veNow * 100), '%', s.veNow / 1.1]);
  kvGrid($('limKv'), 'lim', items);
  const msgs = [];
  if (s.egt > egtW) msgs.push(`Abgas über ${egtW} °C: Turbolader und Kolben leiden.`);
  if (P.turbo && s.boost > P.boostMax * 1.55 * (T.turboBig ? 1.45 : 1)) msgs.push('Turbolader läuft über seiner Höchstdrehzahl.');
  if (P.diesel && s.rich > 1.02 && s.running) msgs.push('Mehr Diesel als Luft: schwarzer Rauch.');
  if (!P.diesel && snap.t - (s.knockEvt || -9) < 1) msgs.push(T.knockCtl ? 'Klopfen erkannt, die Zündung wird zurückgenommen.' : 'Klopfen ohne Regelung: Kolbenschaden droht!');
  if (s.rpm > P.mechMax) msgs.push('Überdrehzahl: Ventilflattern.');
  if (snap.t - (s.limiterHit || -9) < .5) msgs.push('Drehzahlbegrenzer greift.');
  setT('limTxt', msgs.length ? msgs.join(' ') : s.running ? 'Alles im grünen Bereich.' : 'Starte den Motor, gib Vollgas und Last, um die Grenzen zu sehen.');
  $('limTxt').style.color = msgs.length ? css('--yellow') : '';
  setT('limBadge', msgs.length ? 'Warnung' : ''); $('limBadge').className = 'badge' + (msgs.length ? ' warn' : '');
}

/* ================= Eingaben ================= */
function syncInputs() {
  engSel.value = st.engine; fuelSel.value = st.fuel; oilSel.value = st.oil;
  $('ambient').value = st.ambient; $('ambOut').textContent = fmt(st.ambient) + ' °C';
  $('overnight').checked = st.overnight;
  $('socIn').value = Math.round(st.soc * 100); $('socOut').textContent = Math.round(st.soc * 100) + ' %';
  $('soh').value = Math.round(st.soh * 100); $('sohOut').textContent = Math.round(st.soh * 100) + ' %';
  $('starter').value = Math.round(st.starterCond * 100); $('stOut').textContent = Math.round(st.starterCond * 100) + ' %';
  $('clutch').checked = st.clutch; $('noInject').checked = st.noInject; $('wetTest').checked = st.wetTest;
  $('throttle').value = Math.round((st.hand || 0) * 100); $('thrOut').textContent = Math.round((st.hand || 0) * 100) + ' %';
  $('load').value = Math.round(st.load * 100); $('loadOut').textContent = Math.round(st.load * 100) + ' %';
  $('choke').value = Math.round(st.choke * 100); $('chokeOut').textContent = Math.round(st.choke * 100) + ' %';
  for (const b of $('scaleSeg').children) b.setAttribute('aria-pressed', String(+b.dataset.s === st.scale));
  $('soundChk').checked = st.sound;
  for (const id of ['vol', 'vol2']) { $(id).value = Math.round((st.volume ?? .7) * 100); $(id + 'O').textContent = Math.round((st.volume ?? .7) * 100) + ' %'; }
  for (const r of document.querySelectorAll('input[name=smode]')) r.checked = r.value === st.smode;
  $('modeNote').textContent = st.smode === 'auto' ? 'Komfortstart' : 'Anlasser halten';
}
engSel.onchange = () => {
  if (job.active) { engSel.value = st.engine; return; }
  const keep = { ambient: st.ambient, overnight: st.overnight, sound: st.sound, volume: st.volume, scale: st.scale, smode: st.smode, fuel: st.fuel || 'arktis' };
  st = Object.assign(defaults(engSel.value), keep); sendInit(false, `Motor gewechselt: ${PRE().label}`); buildEngineUI(); syncInputs(); renderJob(); persist();
};
fuelSel.onchange = () => { st.fuel = fuelSel.value; sendCfg(); persist(); };
oilSel.onchange = () => { st.oil = oilSel.value; sendCfg(); persist(); };
$('ambient').oninput = e => {
  st.ambient = +e.target.value; $('ambOut').textContent = fmt(st.ambient) + ' °C'; sendCfg();
  if (st.overnight && snap && !snap.running && snap.rpm < 1 && !st.acc.heater) send({ type: 'cool', T: st.ambient });
};
$('ambient').onchange = persist;
$('overnight').onchange = e => { st.overnight = e.target.checked; persist(); };
let socDrag = false, stDrag = false;
$('socIn').oninput = e => { socDrag = true; st.soc = +e.target.value / 100; $('socOut').textContent = e.target.value + ' %'; send({ type: 'set', v: { soc: st.soc } }); };
$('socIn').onchange = () => { socDrag = false; persist(); };
$('soh').oninput = e => { st.soh = +e.target.value / 100; $('sohOut').textContent = e.target.value + ' %'; sendCfg(true); persist(); };
$('starter').oninput = e => { stDrag = true; st.starterCond = +e.target.value / 100; $('stOut').textContent = e.target.value + ' %'; sendCfg(true); };
$('starter').onchange = () => { stDrag = false; persist(); };
const slide = (id, key, out) => { $(id).oninput = e => { st[key] = +e.target.value / 100; $(out).textContent = e.target.value + ' %'; sendCfg(); }; };
$('throttle').oninput = e => { st.hand = +e.target.value / 100; $('thrOut').textContent = e.target.value + ' %'; sendCfg(); };
slide('load', 'load', 'loadOut'); slide('choke', 'choke', 'chokeOut');
$('pumpBtn').onclick = e => { e.currentTarget.blur(); const base = st.throttle; st.throttle = 1; sendCfg(); setTimeout(() => { st.throttle = base; sendCfg(); }, 260); };
$('clutch').onchange = e => { st.clutch = e.target.checked; sendCfg(); persist(); };
$('noInject').onchange = e => { st.noInject = e.target.checked; sendCfg(); };
$('wetTest').onchange = e => { st.wetTest = e.target.checked; sendCfg(); send({ type: 'compReset' }); send({ type: 'log', txt: e.target.checked ? 'Nasstest: etwas Motoröl in jeden Zylinder gegeben' : 'Nasstest beendet' }); };
$('compReset').onclick = () => send({ type: 'compReset' });
for (const b of $('scaleSeg').children) b.onclick = () => { st.scale = +b.dataset.s; send({ type: 'scale', v: st.scale }); syncInputs(); };
$('soundChk').onchange = e => { st.sound = e.target.checked; if (st.sound) { audioInit(); AU.ctx && AU.ctx.resume(); } setVolume(); persist(); };
for (const id of ['vol', 'vol2']) { $(id).oninput = e => { st.volume = +e.target.value / 100; if (st.volume > 0 && !st.sound) { st.sound = true; $('soundChk').checked = true; } audioInit(); AU.ctx && AU.ctx.resume(); setVolume(); syncInputs(); }; $(id).onchange = persist; }
for (const r of document.querySelectorAll('input[name=smode]')) r.onchange = () => { st.smode = r.value; syncInputs(); persist(); };
$('resetBtn').onclick = () => { send({ type: 'cool', T: st.ambient }); send({ type: 'log', txt: `Über Nacht bei ${fmt(st.ambient)} °C abgekühlt` }); };
$('repairBtn').onclick = () => send({ type: 'repair' });
$('wipeBtn').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} const keep = { sound: st.sound }; st = Object.assign(defaults('d6'), keep); job = { active: false, min: 0, used: {}, result: null }; sendInit(false, 'Alles zurückgesetzt'); buildEngineUI(); syncInputs(); renderJob(); persist(); };
$('clearDtc').onclick = () => send({ type: 'clearDtc' });
$('purgeBtn').onclick = () => { if (snap && snap.rpm > 5) return; send({ type: 'purge' }); };
$('coolFill').onclick = () => send({ type: 'refill', what: 'cool' });
$('oilFill').onclick = () => send({ type: 'refill', what: 'oil' });
$('bleedBtn').onclick = () => { if (!snap) return; const a = Math.max(0, snap.air - .2); send({ type: 'set', v: { air: a } }); send({ type: 'log', txt: a > 0 ? `Handpumpe: noch etwa ${Math.round(a * 100)} % Luft im System` : 'Kraftstoffsystem entlüftet' }); };
$('co2Btn').onclick = () => {
  if (!snap) return;
  const g = st.faults.headGasket || (snap.dyn && snap.dyn.headGasket);
  const pos = g && snap.running;
  $('co2Res').innerHTML = !snap.running ? '<div class="result">Motor läuft nicht · Test nicht aussagekräftig. Erst starten und warmlaufen lassen.</div>'
    : `<div class="result ${pos ? 'bad' : 'ok'}"><b style="color:${pos ? 'var(--yellow)' : 'var(--blue)'}">${pos ? 'Prüfflüssigkeit wird gelb' : 'Prüfflüssigkeit bleibt blau'}</b> · ${pos ? 'Verbrennungsgase im Kühlwasser. Zylinderkopfdichtung oder Riss im Kopf.' : 'Keine Verbrennungsgase im Kühlwasser.'}</div>`;
  send({ type: 'log', txt: `CO₂-Tropfentest: ${!snap.running ? 'nicht aussagekräftig' : pos ? 'positiv (gelb)' : 'negativ (blau)'}` });
};
$('battTest').onclick = () => {
  if (!snap) return;
  const P = PRE(), k12 = P.sysV / 12;
  const busy = snap.ign || snap.rpm > 5;
  const Rref = snap.Rb / (1 + .02 * Math.max(0, 25 - snap.Tbat)) * (1 + .02 * 43);
  const cca = Math.max(0, (snap.ocv - 7.2 * k12) / Math.max(1e-4, Rref));
  const rated = (12.7 - 7.2) * k12 / (P.rb12 * k12 * 1.86);
  const pct = clamp(cca / rated * 100, 0, 150);
  const ocv12 = snap.ocv / k12;
  let verdict, col;
  if (snap.frozen) { verdict = 'Batterie eingefroren · nicht laden, langsam auftauen lassen'; col = 'var(--red)'; }
  else if (ocv12 < 11.4 && pct < 80) { verdict = 'Zellenschluss oder tiefentladen · Batterie ersetzen'; col = 'var(--red)'; }
  else if (ocv12 < 12.3) { verdict = 'Gut, aber laden'; col = 'var(--yellow)'; }
  else if (pct < 65) { verdict = 'Verschlissen · ersetzen'; col = 'var(--red)'; }
  else { verdict = 'Gut'; col = 'var(--green)'; }
  const per = P.nBat > 1 ? `<div class="kv"><div class="k">je Batterie</div><div class="v">${fmt(snap.ocv / 2, 2)}<small>V</small></div></div>` : '';
  $('battRes').innerHTML = `<div class="kvs">
    <div class="kv"><div class="k">Ruhespannung ${P.nBat > 1 ? 'gesamt' : ''}</div><div class="v">${fmt(snap.ocv, 2)}<small>V</small></div></div>${per}
    <div class="kv"><div class="k">Innenwiderstand</div><div class="v">${fmt(snap.Rb * 1000, 1)}<small>mΩ</small></div></div>
    <div class="kv"><div class="k">Kaltstartstrom (geschätzt)</div><div class="v">${fmt(cca)}<small>A</small></div></div>
    <div class="kv"><div class="k">Leistung ggü. Neuzustand</div><div class="v">${fmt(pct)}<small>%</small></div></div>
    <div class="kv"><div class="k">Gefrierpunkt Elektrolyt</div><div class="v">${fmt(snap.fz)}<small>°C</small></div></div>
  </div><div class="verdict" style="color:${col};margin-top:10px">${verdict}</div>${busy ? '<div class="hint">Messung unter Last oder mit Zündung an ist ungenau.</div>' : ''}${snap.Vp < -.15 ? '<div class="hint">Oberflächenladung vom Laden hebt die Ruhespannung noch an.</div>' : ''}`;
  $('battBadge').textContent = verdict.split(' ·')[0];
};

/* Zündung & Start */
function ign(on) { audioInit(); send({ type: 'ign', on }); }
$('ignBtn').onclick = () => ign(!(snap && snap.ign));
$('qIgn').onclick = () => ign(!(snap && snap.ign));
$('preBtn').onclick = () => send({ type: 'preheat' });
let holdSent = false;
function setHold(on) { if (on !== holdSent) { holdSent = on; send({ type: 'start', on }); } }
function bindStart(btn) {
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); audioInit(); AU.ctx && AU.ctx.resume();
    if (st.smode === 'auto') { send({ type: 'autostart' }); return; }
    if (!snap || !snap.ign) { ign(true); return; }
    try { btn.setPointerCapture(e.pointerId); } catch (x) {}
    setHold(true);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => { if (st.smode === 'hold') setHold(false); });
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (e.repeat) return; if (st.smode === 'auto') send({ type: 'autostart' }); else setHold(true); } });
  btn.addEventListener('keyup', e => { if ((e.key === 'Enter' || e.key === ' ') && st.smode === 'hold') setHold(false); });
}
bindStart($('bigStart')); bindStart($('qStart'));
/* Pedale und Schaltung
   Gas: W / Pfeil hoch · Bremse: Pfeil runter · Kupplung: Leertaste · Schalten: Pfeil rechts / links */
const ped = { gas: { v: 0, key: false, btn: false, up: 3.2, dn: 4.5 }, brake: { v: 0, key: false, btn: false, up: 4, dn: 6 } };
let clutchKey = false, clutchBtn = false;
function pedalTick(dtR) {
  let changed = false;
  for (const k in ped) {
    const p = ped[k], tgt = (p.key || p.btn) ? 1 : 0;
    if (tgt === p.v) continue;
    const r = tgt > p.v ? p.up : p.dn;
    p.v = clamp(p.v + clamp(tgt - p.v, -r * dtR, r * dtR), 0, 1); changed = true;
  }
  const cl = clutchKey || clutchBtn;
  if (cl !== !!st.clutchHeld) { st.clutchHeld = cl; changed = true; }
  if (!changed) return;
  st.throttle = ped.gas.v < .004 ? 0 : ped.gas.v; st.brake = ped.brake.v < .004 ? 0 : ped.brake.v;
  sendCfg();
  $('gasBtn').classList.toggle('on', ped.gas.v > .02); $('brBtn').classList.toggle('on', ped.brake.v > .02); $('clBtn').classList.toggle('on', cl);
}
function shiftGear(dir) { audioInit(); pedalTick(0); send({ type: 'shift', dir }); }
function holdBtn(id, on) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); on(true); audioInit(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => on(false));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
holdBtn('gasBtn', v => ped.gas.btn = v); holdBtn('brBtn', v => ped.brake.btn = v); holdBtn('clBtn', v => { clutchBtn = v; pedalTick(0); });
$('gUp').onclick = () => shiftGear(1); $('gDown').onclick = () => shiftGear(-1);
const KEYMAP = { w: 'gas', arrowup: 'gas', arrowdown: 'brake' };
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'select' || tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'radio'].includes(e.target.type))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) { e.preventDefault(); ped[KEYMAP[k]].key = true; return; }
  if (k === ' ') { e.preventDefault(); e.stopPropagation(); if (!clutchKey) { clutchKey = true; pedalTick(0); } return; }
  if (k === 'arrowright' || k === 'arrowleft') { e.preventDefault(); if (!e.repeat) shiftGear(k === 'arrowright' ? 1 : -1); return; }
  if (e.repeat) return;
  if (k === 'z') ign(!(snap && snap.ign));
  else if (k === 'v') send({ type: 'preheat' });
  else if (k === 's') { audioInit(); if (st.smode === 'auto') send({ type: 'autostart' }); else if (snap && snap.ign) setHold(true); }
}, true);
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) ped[KEYMAP[k]].key = false;
  if (k === ' ') { e.preventDefault(); e.stopPropagation(); clutchKey = false; pedalTick(0); }
  if (k === 's' && st.smode === 'hold') setHold(false);
}, true);
window.addEventListener('blur', () => { setHold(false); for (const k in ped) ped[k].key = ped[k].btn = false; clutchKey = clutchBtn = false; });
document.addEventListener('pointerdown', () => { if (st.sound) { audioInit(); AU.ctx && AU.ctx.state === 'suspended' && AU.ctx.resume(); } }, { passive: true });
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); audioOff(); } });

/* ================= Empfang ================= */
function receive(sn) {
  if (sn.key !== st.engine) return;
  if (sn.log) logArr = sn.log;
  if (sn.dtc) dtcObj = sn.dtc;
  if (sn.scope) scopeBuf = sn.scope;
  if (sn.exp) lastExp = sn.exp;
  if (sn.dyno) onDyno(sn.dyno);
  if (sn.pv) pvData = sn.pv;
  if (!socDrag) st.soc = sn.soc;
  if (!stDrag) st.starterCond = sn.starterCond;
  st.soh = sn.soh;
  if (lastAtt === null) lastAtt = sn.attempts;
  if (job.active && sn.attempts > lastAtt) { job.min += sn.attempts - lastAtt; renderJob(); }
  lastAtt = sn.attempts;
  if (!trace.length || sn.t - trace[trace.length - 1].t > .02) { trace.push({ t: sn.t, rpm: sn.rpm, v: sn.Vt }); while (trace.length && trace[0].t < sn.t - 9) trace.shift(); }
  for (const e of sn.events) if (e.type === 'fire' || e.type === 'misfire') evQueue.push(e);
  if (evQueue.length > 200) evQueue.splice(0, evQueue.length - 200);
  audioSnap(sn);
  snap = sn;
}

/* ================= Zeichnen: Hilfen ================= */
const cache = {};
function setT(id, v) { if (cache[id] !== v) { cache[id] = v; const el = $(id); if (el) el.textContent = v; } }
function setH(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }
function glowColor(T) {
  if (T < 450) return '#32424f';
  const k = clamp((T - 450) / 600, 0, 1);
  const r = Math.round(120 + 135 * Math.min(1, k * 1.6)), g = Math.round(40 + 190 * Math.max(0, k - .35) / .65), b = Math.round(30 + 60 * Math.max(0, k - .8) / .2);
  return `rgb(${r},${g},${b})`;
}
function tempColor(T) {
  const stops = [[0, [79, 179, 232]], [50, [110, 190, 200]], [85, [230, 170, 80]], [105, [239, 106, 79]], [125, [255, 50, 40]]];
  T = clamp(T, 0, 125);
  for (let i = 1; i < stops.length; i++) if (T <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const k = (T - a) / (b - a); return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(',')})`; }
  return 'rgb(255,50,40)';
}
function prepCanvas(cv, H) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.font = '11px ' + css('--f-body'); return { g, W };
}
function clockStr(c) { const hh = Math.floor(c / 3600), mm = Math.floor(c / 60) % 60, ss = Math.floor(c) % 60; return [hh, mm, ss].map(x => String(x).padStart(2, '0')).join(':'); }
function kvGrid(box, key, items) {
  const sig = items.map(i => i[0] + (i[3] != null ? '*' : '')).join('|');
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    box.innerHTML = items.map((it, i) => `<div class="kv"><div class="k">${it[0]}</div><div class="v"><span id="${key}v${i}"></span><small id="${key}u${i}"></small></div>${it[3] != null ? `<div class="meter"><i id="${key}m${i}"></i></div>` : ''}</div>`).join('');
    for (const k in cache) if (k.startsWith(key)) delete cache[k];
  }
  items.forEach((it, i) => {
    setT(`${key}v${i}`, it[1]); setT(`${key}u${i}`, it[2] || '');
    if (it[3] != null) { const m = $(`${key}m${i}`); if (m) { m.style.width = clamp(it[3], 0, 1) * 100 + '%'; m.style.background = it[4] || ''; } }
  });
}

/* ================= Status ================= */
function statusOf() {
  const P = PRE(), s = snap;
  if (s.seized) return [`Motor sitzt fest · ${s.seizeWhy || 'Schaden'}`, 'red'];
  if (s.auto === 'wait') return [`${P.pre === 'grid' ? 'Ansaugluft vorwärmen' : P.diesel ? 'Vorglühen' : 'Startvorbereitung'} … ${fmt(Math.max(0, s.preheat), 1)} s`, 'amber'];
  if (s.cutout && s.startReq) return ['Anlasser überhitzt · Thermoschutz', 'red'];
  if (s.ecuReset > 0 && s.ign) return ['Steuergerät startet neu (Unterspannung)', 'red'];
  if (s.startReq && s.ign && !s.starterEng && s.solOff > 0) return ['Magnetschalter klackert …', 'red'];
  if (s.starterEng && s.running) return ['Springt an …', 'green'];
  if (s.starterEng) {
    if (s.rpm < 25) return [s.hydro >= 0 ? 'Anlasser blockiert · Wasserschlag?' : 'Anlasser dreht kaum', 'red'];
    if (s.t - s.lastFire < .5) return ['Zündet vereinzelt …', 'amber'];
    return [s.auto ? `Anlasser dreht … ${fmt(s.autoT, 0)} s` : 'Anlasser dreht …', 'ice'];
  }
  if (s.running) {
    if (s.oilP < .5) return ['Läuft · kein Öldruck!', 'red'];
    if (s.TbSens > 112 || s.boiling) return ['Läuft · Motor überhitzt!', 'red'];
    if (s.limp) return ['Läuft · Notlauf', 'amber'];
    const mis = s.cylS.filter(c => c.mis > .5).length;
    if (mis) return [vis('ir') ? `Läuft unrund · ${mis} Zylinder mit Aussetzern` : 'Läuft unrund', 'yellow'];
    if (st.load > .05) return ['Läuft · unter Last', 'green'];
    return [st.throttle > .05 ? 'Läuft · Gas' : (s.Tb < 40 ? 'Läuft · Kaltlauf' : 'Läuft · Leerlauf'), 'green'];
  }
  if (s.rpm > 5) return ['Läuft aus …', 'mute'];
  if (s.ign && P.diesel && s.preheat > 0) return [`${P.pre === 'grid' ? 'Ansaugluft vorwärmen' : 'Vorglühen'} … ${fmt(s.preheat, 1)} s`, 'amber'];
  if (s.ign) return ['Zündung an · startbereit', 'ice'];
  return ['Motor aus', 'mute'];
}

/* ================= Kopfleiste ================= */
function renderTop() {
  const s = snap;
  const [txt, col] = statusOf();
  setT('qSt', txt); $('qDot').style.background = `var(--${col === 'mute' ? 'dim' : col})`;
  setT('qRpm', fmt(s.rpm)); setT('qGear', gearName(s.gear || 0)); setT('qV', fmt(Math.max(0, s.Vt), 1));
  $('qIgn').setAttribute('aria-pressed', String(s.ign)); setT('qIgnT', s.ign ? 'Zündung an' : 'Zündung');
  const label = s.auto ? 'Abbrechen' : s.running ? 'Läuft' : (st.smode === 'hold' && holdSent && s.ign ? 'Dreht …' : 'Start');
  setT('qStart', label);
  $('qStart').classList.toggle('stop', !!s.auto); $('qStart').classList.toggle('busy', !s.auto && holdSent && s.ign);
  const n = Object.keys(dtcObj).length;
  $('tbDtc').hidden = !n || !vis('dtc'); setT('tbDtc', String(n));
}

/* ================= Cockpit ================= */
const gearName = g => g === 0 ? 'N' : g < 0 ? 'R' : String(g);
function renderDrive(s, P) {
  const kmh = Math.abs(s.v * 3.6), V = S.VEH[s.key];
  setT('dGear', gearName(s.gear)); setT('gearTxt', gearName(s.gear)); setT('dKmh', fmt(kmh));
  const slipping = s.gear !== 0 && Math.abs(s.slip) > 8;
  const cl = s.clutchPos < .25 ? ['getreten', 'mute'] : slipping ? (s.clutchPos < .99 ? ['schleift', 'amber'] : ['rutscht', 'red']) : ['greift', 'green'];
  setT('dClutch', cl[0]); $('dClutch').style.color = `var(--${cl[1] === 'mute' ? 'mute' : cl[1]})`;
  $('dClBar').style.width = (s.clutchPos * 100).toFixed(0) + '%';
  const wheel = s.gear !== 0 && s.clutchPos > .25 ? Math.max(0, s.powerKW) : 0;
  setT('dKw', fmt(wheel));
  setT('gearHint', `${V.g.length} Gänge · ${s.gear > 0 ? fmt(1000 / (V.g[s.gear - 1] * V.fd) * V.r * Math.PI / 30 * 3.6, 1) + ' km/h je 1000 U/min' : s.gear < 0 ? 'Rückwärtsgang' : 'Leerlauf'}`);
  $('gUp').disabled = s.gear >= V.g.length; $('gDown').disabled = s.gear <= -1;
}

function drawDial(g, cx, cy, r, v, min, max, step, minor, red, label, unit, valTxt, opts = {}) {
  const a0 = Math.PI * .75, a1 = Math.PI * 2.25, ang = x => a0 + (clamp(x, min, max) - min) / (max - min) * (a1 - a0);
  const line = css('--line2'), mute = css('--mute'), text = css('--text');
  g.lineCap = 'round';
  g.strokeStyle = css('--line'); g.lineWidth = r * .08; g.beginPath(); g.arc(cx, cy, r * .92, a0, a1); g.stroke();
  if (red != null) { g.strokeStyle = css('--red'); g.globalAlpha = .55; g.beginPath(); g.arc(cx, cy, r * .92, ang(red), a1); g.stroke(); g.globalAlpha = 1; }
  if (v > min) { g.strokeStyle = opts.color || css('--ice'); g.beginPath(); g.arc(cx, cy, r * .92, a0, ang(v)); g.stroke(); }
  g.lineCap = 'butt';
  for (let x = min; x <= max + 1e-9; x += minor) {
    const a = ang(x), maj = Math.abs((x - min) / step - Math.round((x - min) / step)) < 1e-6;
    g.strokeStyle = maj ? text : line; g.lineWidth = maj ? 2 : 1;
    const r1 = r * .8, r2 = r * (maj ? .7 : .75);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    if (maj) { g.fillStyle = mute; g.font = `500 ${Math.round(r * .12)}px ${css('--f-num')}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opts.tick ? opts.tick(x) : String(x), cx + Math.cos(a) * r * .57, cy + Math.sin(a) * r * .57); }
  }
  const a = ang(v);
  g.strokeStyle = css('--amber'); g.lineWidth = Math.max(2.5, r * .025); g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - Math.cos(a) * r * .1, cy - Math.sin(a) * r * .1); g.lineTo(cx + Math.cos(a) * r * .82, cy + Math.sin(a) * r * .82); g.stroke();
  g.fillStyle = css('--panel3'); g.beginPath(); g.arc(cx, cy, r * .07, 0, 7); g.fill();
  g.fillStyle = text; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `600 ${Math.round(r * .27)}px ${css('--f-num')}`; g.fillText(valTxt, cx, cy + r * .52);
  g.fillStyle = mute; g.font = `500 ${Math.max(11, Math.round(r * .1))}px ${css('--f-body')}`; g.fillText(`${label} · ${unit}`, cx, cy + r * .72);
}
function drawBar(g, x, y, w, label, v, min, max, txt, red, color) {
  g.fillStyle = css('--mute'); g.font = `500 12.5px ${css('--f-body')}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(label, x, y);
  g.fillStyle = css('--text'); g.font = `600 21px ${css('--f-num')}`; g.textAlign = 'right'; g.fillText(txt, x + w, y + 2);
  const by = y + 10, h = 8;
  g.fillStyle = css('--line'); g.beginPath(); g.roundRect(x, by, w, h, 4); g.fill();
  if (red != null) { g.fillStyle = css('--red-dim'); const rx = x + (red - min) / (max - min) * w; g.beginPath(); g.roundRect(rx, by, x + w - rx, h, 4); g.fill(); }
  const k = clamp((v - min) / (max - min), 0, 1);
  g.fillStyle = color || css('--ice'); g.beginPath(); g.roundRect(x, by, Math.max(4, k * w), h, 4); g.fill();
}
function drawCluster() {
  const cv = $('cluster'), Wc = cv.clientWidth, wide = Wc >= 640;
  const H = wide ? 300 : Math.round(Math.min(Wc * .24, 130) * 2 + 205);
  const { g, W } = prepCanvas(cv, H);
  const s = snap, P = PRE();
  const rTop = Math.ceil((P.maxRpm + 400) / 1000) * 1000;
  const right = P.turbo ? { v: s.boost, min: 0, max: Math.ceil(P.boostMax + .6), step: 1, minor: .25, red: P.boostMax * 1.15, label: 'Ladedruck', unit: 'bar', txt: fmt(s.boost, 1) }
    : { v: vis('oil') ? s.oilP : 0, min: 0, max: 6, step: 1, minor: .5, red: null, label: 'Öldruck', unit: 'bar', txt: vis('oil') ? fmt(s.oilP, 1) : '?' };
  const Tsens = st.faults.coolSensor && !P.carb ? 80 : s.TbSens;
  const vmin = P.sysV === 24 ? 18 : 9, vmax = P.sysV === 24 ? 30 : 15;
  const bars = [
    ['Kühlmittel', Tsens, 40, 130, fmt(Tsens) + ' °C', 110, tempColor(Tsens)],
    ['Öltemperatur', s.To, 40, 150, fmt(s.To) + ' °C', 130, css('--oil')],
    [`Bordnetz ${P.sysV} V${P.nBat > 1 ? ' (2 × 12 V)' : ''}`, s.Vt, vmin, vmax, fmt(Math.max(0, s.Vt), 1) + ' V', null, s.Vt < (P.sysV === 24 ? 22 : 11.5) ? css('--red') : css('--green')],
  ];
  if (wide) {
    const r1 = Math.min(H * .46, W * .2), cy = H * .5;
    drawDial(g, r1 + 6, cy, r1, s.rpm, 0, rTop, 1000, 250, P.maxRpm, 'Drehzahl', '× 1000 U/min', fmt(s.rpm), { tick: x => String(x / 1000) });
    const r2 = r1 * .84;
    drawDial(g, W - r2 - 6, cy, r2, right.v, right.min, right.max, right.step, right.minor, right.red, right.label, right.unit, right.txt);
    const bx = r1 * 2 + 44, bw = W - bx - r2 * 2 - 44;
    bars.forEach((b, i) => drawBar(g, bx, cy - 68 + i * 64, bw, ...b));
  } else {
    const r = Math.min(W * .24, 130), cy = r + 8;
    drawDial(g, W * .26, cy, r, s.rpm, 0, rTop, 1000, 250, P.maxRpm, 'U/min', '× 1000', fmt(s.rpm), { tick: x => String(x / 1000) });
    drawDial(g, W * .75, cy, r * .86, right.v, right.min, right.max, right.step, right.minor, right.red, right.label, right.unit, right.txt);
    bars.forEach((b, i) => drawBar(g, 2, cy + r + 32 + i * 56, W - 4, ...b));
  }
}
function renderCockpit(dtR) {
  const s = snap, P = PRE();
  drawCluster();
  const [txt, col] = statusOf();
  setT('stTxt', txt); $('stDot').style.background = `var(--${col === 'mute' ? 'dim' : col})`;
  const test = s.ign && s.t - ignOnAt < 1.5, charging = s.Ialt > 0;
  const L = (id, on, c) => { $(id).className = 'lamp' + (s.ign && (test || on) ? ' on-' + c : ''); };
  L('lpGlow', s.preheat > 0, 'amber'); L('lpBatt', !charging, 'red'); L('lpOil', s.oilP < .5, 'red');
  L('lpCool', s.TbSens > 112 || s.coolLevel < .3, 'red'); L('lpMil', Object.keys(dtcObj).length > 0, 'amber');
  L('lpLimp', s.limp, 'amber'); L('lpWater', !!st.faults.water, 'amber');
  const bs = $('bigStart'), auto = st.smode === 'auto';
  let t1, t2;
  if (s.auto === 'wait') { t1 = 'Abbrechen'; t2 = `${P.pre === 'grid' ? 'Ansaugluft wird vorgewärmt' : P.diesel ? 'Vorglühen' : 'Startvorbereitung'} · ${fmt(Math.max(0, s.preheat), 1)} s`; }
  else if (s.auto === 'crank') { t1 = 'Abbrechen'; t2 = `Anlasser läuft · ${fmt(s.autoT, 1)} von 15 s`; }
  else if (s.running) { t1 = 'Läuft'; t2 = 'Abstellen: Zündung aus'; }
  else if (auto) { t1 = 'Start'; t2 = s.ign ? 'Klick: Anlasser läuft, bis der Motor anspringt' : 'Klick: Zündung, Vorglühen, Anlasser'; }
  else { t1 = s.ign ? (holdSent ? 'Dreht …' : 'Start') : 'Zündung an'; t2 = s.ign ? 'Gedrückt halten · loslassen, wenn er läuft' : 'Erst Zündung einschalten'; }
  setT('bigStartT', t1); setT('bigStartS', t2);
  bs.classList.toggle('stop', !!s.auto); bs.classList.toggle('busy', !s.auto && holdSent && s.ign);
  $('ignBtn').setAttribute('aria-pressed', String(s.ign)); setT('ignTxt', s.ign ? 'Zündung aus' : 'Zündung an');
  $('preBtn').disabled = !s.ign || s.running;
  const kwP = Math.max(0, s.powerKW), wR = s.rpm * Math.PI / 30;
  setT('pTq', fmt(wR > 20 ? kwP * 1000 / wR : 0)); setT('pKw', fmt(kwP)); setT('pPs', `kW · ${fmt(kwP * 1.36)} PS`);
  renderDrive(s, P);
  if (P.turbo) { setT('pBoost', fmt(s.boost, 2)); setT('pBu', 'bar'); } else { setT('pBoost', fmt(s.q * 100)); setT('pBu', '%'); }
  setT('limitNote', s.limp ? 'Notlauf aktiv' : P.turbo && s.running && s.q >= s.qMax * .98 && s.qMax < .95 ? 'Rauchbegrenzung: wartet auf Ladedruck' : '');
  drawChart(); drawSmoke(dtR);
}
function drawChart() {
  const H = 190, { g, W } = prepCanvas($('chart'), H);
  const L = 44, R = 38, T = 18, B = 22, w = W - L - R, h = H - T - B;
  const span = 8, t0 = snap.t - span;
  let peak = 300; for (const p of trace) if (p.t > t0 && p.rpm > peak) peak = p.rpm;
  const steps = [100, 200, 250, 500, 1000];
  const ymax = Math.ceil(peak * 1.12 / 100) * 100, stp = steps.find(s => ymax / s <= 5) || 1000, top = Math.ceil(ymax / stp) * stp;
  const vmax = PRE().sysV === 24 ? 30 : 15, vstep = PRE().sysV === 24 ? 10 : 5;
  const line = css('--line'), mute = css('--mute'), ice = css('--ice'), amber = css('--amber');
  g.textBaseline = 'middle'; g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = mute;
  for (let v = 0; v <= top; v += stp) { const y = T + h - v / top * h; g.beginPath(); g.moveTo(L, Math.round(y) + .5); g.lineTo(L + w, Math.round(y) + .5); g.stroke(); g.textAlign = 'right'; g.fillText(fmtK(v), L - 6, y); }
  g.fillStyle = amber; g.textAlign = 'left';
  for (let v = 0; v <= vmax; v += vstep) g.fillText(v + ' V', L + w + 6, T + h - v / vmax * h);
  g.fillStyle = mute; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let s = 0; s <= span; s += 2) g.fillText(s === span ? 'jetzt' : `−${span - s} s`, L + (s / span) * w, T + h + 6);
  const pts = trace.filter(p => p.t >= t0);
  if (pts.length > 1) {
    const X = p => L + (p.t - t0) / span * w;
    g.lineJoin = 'round'; g.strokeStyle = amber; g.setLineDash([4, 3]); g.lineWidth = 1.3; g.beginPath();
    pts.forEach((p, i) => { const y = T + h - clamp(p.v, 0, vmax) / vmax * h; i ? g.lineTo(X(p), y) : g.moveTo(X(p), y); }); g.stroke(); g.setLineDash([]);
    g.beginPath(); pts.forEach((p, i) => { const y = T + h - p.rpm / top * h; i ? g.lineTo(X(p), y) : g.moveTo(X(p), y); });
    g.strokeStyle = ice; g.lineWidth = 2; g.stroke();
    const lx = X(pts[pts.length - 1]);
    g.lineTo(lx, T + h); g.lineTo(X(pts[0]), T + h); g.closePath(); g.fillStyle = ice; g.globalAlpha = .1; g.fill(); g.globalAlpha = 1;
    g.fillStyle = ice; g.beginPath(); g.arc(lx, T + h - pts[pts.length - 1].rpm / top * h, 3, 0, 7); g.fill();
  }
  g.textBaseline = 'top'; g.fillStyle = ice; g.textAlign = 'left'; g.fillText('U/min', 4, 0); g.fillStyle = amber; g.textAlign = 'right'; g.fillText('Volt', W - 2, 0);
}
const parts = [];
function drawSmoke(dtR) {
  const H = 64, { g, W } = prepCanvas($('smoke'), H);
  g.fillStyle = css('--line2'); g.fillRect(0, H - 28, 34, 12); g.fillStyle = css('--dim'); g.fillRect(30, H - 30, 6, 16);
  const sm = snap.smoke;
  while (evQueue.length) {
    const e = evQueue.shift();
    const mis = e.type === 'misfire', cold = clamp((60 - snap.Tb) / 80, 0, 1), blk = sm.black > .25, blue = sm.blue > .4, sweet = sm.sweet > .5;
    const col = mis || sweet ? [236, 241, 245] : blk ? [40, 40, 42] : blue ? [150, 175, 230] : [200, 208, 214];
    const a = mis ? .55 : sweet ? .5 : blue ? .45 : .12 + cold * .35 * (1 - (e.str || 0) * .5) + (blk ? .3 : 0);
    if (parts.length < 260) parts.push({ x: 38, y: H - 22, vx: 50 + Math.random() * 40 + snap.rpm / 25, vy: -6 - Math.random() * 10, r: mis ? 5 : 3.5, a, col });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.x += p.vx * dtR; p.y += p.vy * dtR; p.vx *= .985; p.r += dtR * 9; p.a *= Math.pow(.45, dtR);
    if (p.a < .01 || p.x > W + 20) { parts.splice(i, 1); continue; }
    g.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${p.a.toFixed(3)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
  }
  setT('smokeTxt', smokeText());
}
function smokeText() {
  const s = snap, sm = s.smoke;
  if (s.rpm < 5) return 'Kein Abgas';
  if (sm.sweet > .8) return 'Dichter weißer Rauch, riecht süßlich · Kühlmittel verbrennt';
  if (sm.blue > .5) return 'Bläulicher Rauch · Motoröl verbrennt';
  if (sm.black > .25) return 'Schwarzer Rauch · zu viel Kraftstoff';
  if (sm.white > 1.2) return 'Dichter Weißrauch · unverbrannter Kraftstoff';
  if (sm.white > .3) return 'Leichter Weißrauch';
  return s.running ? (s.Tb < 40 ? 'Kondensdampf · Motor noch kalt' : 'Sauber') : 'Nur Luft';
}

function smokeShort() { const t = smokeText(); return t.split(' ·')[0].replace('Dichter weißer Rauch, riecht süßlich', 'weiß, süßlich'); }
const STROKE = ['Arbeiten', 'Ausstoßen', 'Ansaugen', 'Verdichten'];
function drawCylinders() {
  const P = PRE(); let firing = 0;
  snap.cylS.forEach((c, i) => {
    const e = cylEls[i]; if (!e) return;
    const th = c.phi * Math.PI / 180, rV = 14, lV = 40, cx = 40, cy = 88;
    const px = cx + rV * Math.sin(th), py = cy - rV * Math.cos(th);
    const pinY = py - Math.sqrt(lV * lV - (rV * Math.sin(th)) ** 2);
    const top = pinY - 10;
    e.pis.setAttribute('transform', `translate(0 ${top.toFixed(2)})`);
    e.rod.setAttribute('y1', pinY.toFixed(2)); e.rod.setAttribute('x2', px.toFixed(2)); e.rod.setAttribute('y2', py.toFixed(2));
    e.web.setAttribute('x2', px.toFixed(2)); e.web.setAttribute('y2', py.toFixed(2));
    e.pin.setAttribute('cx', px.toFixed(2)); e.pin.setAttribute('cy', py.toFixed(2));
    const h = Math.max(0, top - 19);
    e.gas.setAttribute('height', h.toFixed(2)); e.comp.setAttribute('height', h.toFixed(2));
    const closed = c.phi >= 540 || c.phi < 180;
    e.gas.setAttribute('opacity', (c.burn * .95).toFixed(2));
    e.comp.setAttribute('opacity', (snap.rpm > 2 && closed ? clamp(1 - (top - 24) / 28, 0, 1) * .28 : 0).toFixed(2));
    const camK = tuneGet().cam, li = S.valveLift(c.phi, 'in', camK) * 5, le = S.valveLift(c.phi, 'ex', camK) * 5;
    e.vIn.setAttribute('y2', (20 + li).toFixed(1)); e.vIn.setAttribute('y1', (12 + li).toFixed(1));
    e.vEx.setAttribute('y2', (20 + le).toFixed(1)); e.vEx.setAttribute('y1', (12 + le).toFixed(1));
    if (P.pre === 'plug') e.tip.setAttribute('fill', st.faults.cyl.plug[i] ? '#32424f' : glowColor(c.Tg));
    else e.tip.setAttribute('fill', !P.diesel && c.burn > .85 ? '#cfe9ff' : '#32424f');
    const recent = snap.t - c.lastEvt < Math.max(.35, 2 * 120 / Math.max(snap.rpm, 30));
    const state = snap.rpm < 5 ? 'stopped' : recent ? c.state : 'comp';
    if (state === 'fire') firing++;
    const mis = state === 'misfire' || (snap.running && c.mis > .5);
    if (e.last.mis !== mis) { e.d.classList.toggle('mis', mis); e.last.mis = mis; }
    const fire = state === 'fire' && !mis;
    if (e.last.fire !== fire) { e.d.classList.toggle('fire', fire); e.last.fire = fire; }
    const tw = fmt(c.Tir);
    if (e.last.tw !== tw) { e.twv.textContent = tw; e.last.tw = tw; }
    const [txt, col] = state === 'stopped' ? ['steht', 'var(--mute)'] : mis ? ['Aussetzer', 'var(--red)'] : state === 'fire' ? ['zündet', 'var(--amber)'] : ['verdichtet', 'var(--ice)'];
    if (e.last.txt !== txt) { e.stt.textContent = txt; e.stt.style.color = col; e.last.txt = txt; }
    const meta = snap.rpm < 5 ? (snap.hydro === i ? 'Flüssigkeit im Brennraum' : P.pre === 'plug' ? `Glühkerze ${fmt(Math.max(c.Tg, c.Tw))} °C` : '–') : `${STROKE[Math.floor(c.phi / 180) % 4]} · ${fmt(c.pmaxShow / 1e5)} bar`;
    if (e.last.meta !== meta) { e.meta.textContent = meta; e.last.meta = meta; }
  });
  return firing;
}

/* ================= Werkstatt ================= */
function renderWerkstatt() {
  const s = snap, P = PRE(), f = st.faults;
  const codes = Object.values(dtcObj);
  setT('dtcBadge', `${codes.length} ${codes.length === 1 ? 'Eintrag' : 'Einträge'}`);
  $('dtcBadge').className = 'badge' + (codes.length ? ' warn' : '');
  const key = codes.map(c => c.code).join();
  if (cache.dtcKey !== key) {
    cache.dtcKey = key;
    const D = P.diesel;
    $('dtcs').innerHTML = codes.length ? codes.map(c => { const q = c.ff || {}; return `<details class="dtc"><summary><code>${c.code}</code><span>${esc(c.txt)}</span></summary><div class="ff">
      <div>Zeit<b>${clockStr(q.t || 0)}</b></div><div>Drehzahl<b>${q.rpm ?? '–'} U/min</b></div><div>Spannung<b>${fmt(q.Vt ?? 0, 1)} V</b></div><div>Ladezustand<b>${q.soc ?? '–'} %</b></div>
      <div>Kühlmittel<b>${fmt(q.Tb ?? 0)} °C</b></div><div>Öl<b>${fmt(q.To ?? 0)} °C</b></div><div>Außen<b>${fmt(q.Ta ?? 0)} °C</b></div><div>Öldruck<b>${fmt(q.oilP ?? 0, 1)} bar</b></div>
      <div>${D ? 'Raildruck' : P.carb ? 'Schwimmer' : 'Kraftstoff'}<b>${P.carb ? fmt((q.rail ?? 0) * 100) + ' %' : fmt(q.rail ?? 0, D ? 0 : 1) + ' bar'}</b></div><div>Ladedruck<b>${fmt(q.boost ?? 0, 2)} bar</b></div><div>Last<b>${q.load ?? 0} %</b></div><div>Anlasser<b>${q.starter ? 'dreht' : 'aus'}</b></div></div></details>`; }).join('') : '<div class="empty">Kein Fehler gespeichert.</div>';
  }
  const vf = S.viscFactor(s.To, S.OILS[st.oil]);
  const Ts = f.coolSensor && !P.carb ? 80 : s.TbSens;
  const avgTend = s.cylS.reduce((a, c) => a + (c.TendEff || 0), 0) / P.cyl - 273.15;
  const glowPct = P.pre === 'plug' ? s.cylS.reduce((a, c) => a + clamp((c.Tg - 20) / 1030, 0, 1), 0) / P.cyl * 100 : 0;
  kvGrid($('diag'), 'dg', [
    ['Drehzahl', fmt(s.rpm), 'U/min'],
    ['Klemmenspannung', fmt(s.Vt, 1), 'V'],
    ['Batteriestrom', fmt(-s.Ib), 'A'],
    ['Lichtmaschine', fmt(s.Ialt), 'A'],
    ['Anlasserstrom', fmt(s.Is), 'A'],
    P.pre === 'plug' ? ['Glühkerzen', `${fmt(s.Iglow)} A · ${fmt(glowPct)}`, '%'] : P.pre === 'grid' ? ['Heizflansch', `${fmt(s.Iglow)} A · ${fmt(s.Tgrid)}`, '°C'] : ['Zündspannung', f.coil ? '0' : s.Vt > 9 ? 'ok' : 'schwach', ''],
    P.diesel ? ['Raildruck', fmt(s.rail), 'bar'] : P.carb ? ['Schwimmerkammer', fmt(s.bowl * 100), '%'] : ['Kraftstoffdruck', fmt(s.rail, 1), 'bar'],
    ['Ladedruck', P.turbo ? fmt(s.boost, 2) : '–', P.turbo ? 'bar' : ''],
    ['Ansaugluft', fmt(s.Tin), '°C'],
    ['Kompressionsende Ø', s.rpm > 5 ? fmt(avgTend) : '–', '°C'],
    ['Kühlmittel (Sensor)', fmt(Ts), '°C'],
    ['Öltemperatur', fmt(s.To), '°C'],
    [P.carb ? 'Gemischmenge' : 'Einspritzmenge', fmt(s.q * 100), '%'],
    ['Mengenbegrenzung', fmt(s.qMax * 100), '%'],
    ['Reibmoment', fmt(s.frictionNm), 'Nm'],
    ['Öl-Viskosität', '×' + fmt(vf, vf < 10 ? 1 : 0), 'ggü. 90 °C'],
    ...(P.diesel ? [['Kraftstoff-Fließfähigkeit', fmt(s.fuelFlow * 100), '%'], ['Filtertemperatur', fmt(s.Tfuel + s.fuelHeat), `°C · CFPP ${fmt(S.FUELS[st.fuel].cfpp)}`]]
      : [['Gemisch Zyl. 1', s.cylS[0].mix ? fmt(s.cylS[0].mix, 2) : '–', '1 = ideal'], ['Zündkerzen nass', String(s.cylS.filter(c => c.wet > .6).length), `von ${P.cyl}`]]),
  ]);
  drawScope();
  kvGrid($('coolKv'), 'ck', [
    ['Stand Ausgleichsbehälter', fmt(s.coolLevel * 100), '%', s.coolLevel, s.coolLevel < .35 ? css('--red') : css('--cool')],
    ['Systemdruck', fmt(s.coolPress, 2), 'bar', s.coolPress / 1.6, s.coolPress > 1.3 ? css('--red') : css('--cool')],
    ['Kühlmittel', fmt(s.Tb), '°C'],
    ['Zylinderkopf', fmt(s.Thead), '°C'],
    ['Thermostat', s.thermo > .98 ? 'offen' : s.thermo < .02 ? 'zu' : fmt(s.thermo * 100), s.thermo > .02 && s.thermo < .98 ? '%' : ''],
    ['Umwälzung', !s.running ? 'steht' : s.circ < .3 ? 'schwach' : 'normal', ''],
  ]);
  setT('coolBadge', s.boiling ? 'kocht' : s.coolPress > 1.3 ? 'Überdruck' : s.coolLevel < .35 ? 'Stand niedrig' : '');
  $('coolBadge').className = 'badge' + (s.boiling || s.coolPress > 1.3 || s.coolLevel < .35 ? ' warn' : '');
  kvGrid($('oilKv'), 'okv', [
    ['Ölstand am Messstab', fmt(s.oilLevel * 100), '%', s.oilLevel, s.oilLevel < .4 ? css('--red') : css('--oil')],
    ['Öldruck (Manometer)', fmt(s.oilP, 2), 'bar', s.oilP / 6, s.running && s.oilP < .6 ? css('--red') : css('--oil')],
    ['Ölzustand', s.milky > .3 ? 'milchig' : s.milky > .1 ? 'leicht trüb' : s.wear > 30 ? 'Metallabrieb' : 'normal', ''],
    ['Kurbelgehäusedruck', fmt(s.crankcase), 'mbar'],
  ]);
  setT('oilBadge', s.oilLevel < .4 ? 'unter Minimum' : s.milky > .3 ? 'Kühlmittel im Öl' : '');
  $('oilBadge').className = 'badge' + (s.oilLevel < .4 || s.milky > .3 ? ' warn' : '');
  const gk = st.faults.headGasket || (s.dyn && s.dyn.headGasket);
  const rows = s.cylS.map((c, i) => {
    const recent = s.t - c.lastEvt < Math.max(.35, 2 * 120 / Math.max(s.rpm, 30));
    const state = s.rpm < 5 ? 'steht' : recent && c.state === 'fire' ? 'zündet' : recent && c.state === 'misfire' ? 'Aussetzer' : 'verdichtet';
    const endo = s.hydro === i ? 'Flüssigkeit im Brennraum' : f.cyl.rings[i] ? 'Riefen an der Laufbahn' : gk && S.GASKET.includes(i) ? 'Kolben auffällig sauber' : f.cyl.comp[i] ? 'Ventilteller verbrannt' : 'unauffällig';
    return `<tr><td>Zylinder ${i + 1}</td><td class="r">${fmt(c.Tir)} °C</td><td>${state}</td><td>${endo}</td></tr>`;
  }).join('');
  setH($('irTable'), 'irT', `<thead><tr><th>Zylinder</th><th class="r">Krümmer</th><th>Zustand</th><th>Endoskop</th></tr></thead><tbody>${rows}</tbody>`);
  $('purgeBtn').disabled = s.rpm > 5;
  const lk = logArr.length + ':' + (logArr[0] ? logArr[0].t + logArr[0].txt : '');
  if (cache.logKey !== lk) { cache.logKey = lk; $('log').innerHTML = logArr.map(l => `<div class="${l.lvl}"><span>${clockStr(l.t)}</span><span>${esc(l.txt)}</span></div>`).join(''); }
}
function drawScope() {
  const H = 130, { g, W } = prepCanvas($('scope'), H);
  const L = 56, R = 8, T = 8, B = 18, w = W - L - R, h = H - T - B;
  const P = PRE(), n = 1500, data = scopeBuf.slice(-n);
  let mx = P.sysV === 24 ? 1500 : 800; for (const v of data) if (v > mx) mx = v;
  const top = Math.ceil(mx / 400) * 400;
  const line = css('--line'), mute = css('--mute'), amber = css('--amber');
  g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = mute; g.textBaseline = 'middle'; g.textAlign = 'right';
  for (let v = 0; v <= top; v += top / 4) { const y = T + h - v / top * h; g.beginPath(); g.moveTo(L, Math.round(y) + .5); g.lineTo(L + w, Math.round(y) + .5); g.stroke(); g.fillText(fmtK(v) + ' A', L - 6, y); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let s = 0; s <= 3; s++) g.fillText(s === 3 ? 'jetzt' : `−${3 - s} s`, L + s / 3 * w, T + h + 4);
  if (data.length > 1) {
    g.strokeStyle = amber; g.lineWidth = 1.4; g.lineJoin = 'round'; g.beginPath();
    const off = n - data.length;
    data.forEach((v, i) => { const x = L + (off + i) / (n - 1) * w, y = T + h - v / top * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  const hump = snap.comp.avg.map(a => Math.max(0, a)), mh = Math.max(...hump);
  hump.forEach((v, i) => {
    const el = $('cb' + i); if (!el) return;
    const has = snap.comp.n[i] > 0, pct = mh > 0 && has ? v / mh * 100 : 0;
    el.querySelector('i').style.width = pct.toFixed(0) + '%';
    el.lastElementChild.textContent = has ? fmt(pct) + ' %' : '–';
    el.classList.toggle('low', has && pct < 80);
  });
  setT('scopeHint', snap.starterEng ? `${fmtK(snap.Is)} A` : 'Anlasserstrom · 3 s');
}

/* ================= Einstellungen ================= */
function renderSettings() {
  const s = snap;
  if (!socDrag) { $('socIn').value = Math.round(s.soc * 100); setT('socOut', Math.round(s.soc * 100) + ' %'); }
  if (!stDrag) { $('starter').value = Math.round(st.starterCond * 100); setT('stOut', Math.round(st.starterCond * 100) + ' %'); }
  $('soh').value = Math.round(st.soh * 100); setT('sohOut', Math.round(st.soh * 100) + ' %');
  setT('clock', clockStr(s.clock));
  $('bleedBtn').hidden = !(PRE().diesel && s.air > 0);
}

/* ================= Hauptschleife ================= */
let ignOnAt = -9, lastIgn = false, uiTick = 0, lastTs = performance.now();
function frame(ts) {
  const dtR = Math.min(.1, (ts - lastTs) / 1000); lastTs = ts;
  requestAnimationFrame(frame);
  if (!snap || snap.key !== st.engine || document.hidden) return;
  if (snap.ign && !lastIgn) ignOnAt = snap.t; lastIgn = snap.ign;
  pedalTick(dtR);
  renderTop();
  const slow = ++uiTick % 10 === 0;
  if (view === 'cockpit') renderCockpit(dtR); else evQueue.length = 0;
  if (view === 'motor') { renderMotor(dtR); try { e3Render(dtR); } catch (err) { if (!E3.errShown) { E3.errShown = true; console.error(err); } } }
  if (view === 'tuning') renderTuning();
  if (view === 'werkstatt' && uiTick % 3 === 0) renderWerkstatt();
  if (view === 'einstellungen' && slow) renderSettings();
  if (slow && job.active) { $('jobBadge').textContent = `läuft · ${job.min} min`; $('jobPill').textContent = `Auftrag läuft · ${job.min} min`; }
}

/* ================= Start ================= */
route();
buildEngineUI(); syncInputs(); renderJob();
sendInit(true, saved && saved.engine === st.engine ? null : `Bereit · ${PRE().label} · ${fmt(st.ambient)} °C`);
requestAnimationFrame(frame);
setInterval(persist, 3000);
})();
