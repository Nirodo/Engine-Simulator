/* ===== Motorklang: physikalisch angelehntes Modell =====
   Quelle je Zylinder: Abgasstoß beim Öffnen des Auslassventils (Zylinderdruck entweicht über den Ventilspalt),
   Ansaugstrom, Verbrennungsstoß in die Motorstruktur. Die Stöße laufen durch Krümmerrohre (Laufzeiten),
   ein Abgasrohr mit Reflexionen (Wellenleiter), Schalldämpfer und Mündungsabstrahlung (Ableitung des Volumenstroms).
   Dazu Strukturresonanzen (Block), Ventiltrieb, Injektoren, Ansauggeräusch, Turbolader, Anlasser und ein kleiner Prüfstandsraum. */
function makeEngineSynth(sr, liftFn) {
  const TAU = Math.PI * 2;
  const clampA = (v, a, b) => v < a ? a : v > b ? b : v;
  const nz = () => Math.random() * 2 - 1;
  const lp1 = fc => 1 - Math.exp(-TAU * fc / sr);
  // Zweipol-Resonator
  const reso = (f, decayS, g = 1) => { const r = Math.exp(-1 / (decayS * sr)); return { a1: 2 * r * Math.cos(TAU * Math.min(f, sr * .45) / sr), a2: r * r, g: g * (1 - r), y1: 0, y2: 0 }; };
  const rs = (z, x) => { const y = z.g * x + z.a1 * z.y1 - z.a2 * z.y2; z.y2 = z.y1; z.y1 = y; return y; };
  const delay = n => ({ b: new Float32Array(Math.max(4, n | 0) + 4), w: 0 });
  const dw = (d, x) => { d.b[d.w] = x; d.w = (d.w + 1) % d.b.length; };
  const dr = (d, n) => { const L = d.b.length; let p = d.w - 1 - n; while (p < 0) p += L; const i = p | 0, f = p - i; return d.b[i] * (1 - f) + d.b[(i + 1) % L] * f; };

  const S = { key: null, ok: false, rpm: 0, rpmT: 0, phi: 0, load: 0, thr: 0, thrPrev: 0, diesel: false, turbo: false, carb: false,
    exh: 'serie', cam: 'serie', lumpy: 0, knock: .3, wear: 0, running: false, crank: false, ign: false, stAmp: 0, grind: 0,
    boost: 0, boostMax: 1, turboRpm: 0, tWob: 0, fan: 0, hiss: 0, bov: 0, pingEnv: 0, agc: 0, vol: 1, mEx: 1, mIn: 1, mMech: 1, mTu: 1, raw: false };
  let C = null; // Konfiguration je Motor

  function configure(P, tune) {
    const n = P.cyl, Vc = Math.PI / 4 * P.bore * P.bore * P.stroke * 1000; // Liter je Zylinder
    const truck = P.sysV === 24;
    const c = { n, Vc, truck, P };
    c.off = []; for (let i = 0; i < n; i++) c.off[i] = P.order.indexOf(i + 1) * 720 / n;
    c.bank = P.banks.slice(); c.layout = P.layout || 'R';
    c.nOut = c.layout === 'V' ? 2 : 1; // V8: zwei Endrohre, Boxer: Y-Rohr zu einem Strang
    // Ventilhub-Tabellen (1/2 Grad)
    c.lutIn = new Float32Array(1441); c.lutEx = new Float32Array(1441);
    for (let k = 0; k <= 1440; k++) { c.lutIn[k] = liftFn(k / 2, 'in', tune.cam); c.lutEx[k] = liftFn(k / 2, 'ex', tune.cam); }
    // Krümmerlaufzeiten: Abgas ca. 550 m/s
    const cEx = 550, Lr = truck ? .7 : P.turbo ? .3 : .45;
    c.run = []; c.runD = [];
    for (let i = 0; i < n; i++) {
      let L = Lr * (1 + .06 * Math.sin(i * 2.3));
      if (c.layout === 'B' && c.bank[i]) L += .32; // ungleich lange Krümmer: typisches Boxer-Brabbeln
      c.runD[i] = L / cEx * sr; c.run[i] = delay(c.runD[i] + 2);
    }
    // Abgasrohr als Wellenleiter mit Reflexion an der offenen Mündung
    const Lp = truck ? 4.2 : 2.4;
    c.pipes = [];
    for (let o = 0; o < c.nOut; o++) {
      const D = (Lp * (1 + o * .04)) / cEx * sr;
      c.pipes.push({ D, line: delay(2 * D + 4), lpLoop: 0, pre: 0, muf: delay(Math.round(sr * .0011) + 4), mufLp: 0, mufLp2: 0, mPrev: 0, hp: 0, hpX: 0 });
    }
    // Schalldämpfer je Abgasanlage
    const ex = tune.exhaust || 'serie';
    c.mufFc = ex === 'straight' ? 3200 : ex === 'sport' ? 1050 : (P.diesel ? 520 : 680);
    c.mufFb = ex === 'straight' ? 0 : ex === 'sport' ? .32 : .55;
    c.exGain = ex === 'straight' ? 1.9 : ex === 'sport' ? 1.4 : 1;
    c.turboFc = P.turbo ? (P.diesel ? 1100 : 1500) : 0;
    // Strukturmoden (Block, Kopf, Ölwanne): größere Zylinder klingen tiefer
    const sz = Math.pow(.5 / Vc, .22);
    const modes = [[310, .03, .5], [640, .022, .7], [1080, .016, .8], [1620, .012, .7], [2450, .009, .55], [3500, .007, .4], [5200, .005, .25], [7400, .0035, .15]];
    c.modes = modes.map(([f, d, g]) => reso(f * sz * (.97 + .06 * Math.random()), d * (truck ? 1.4 : 1), g));
    c.valveModes = [reso(4300 * sz, .004, 1), reso(6100 * sz, .003, .8), reso(8300, .0022, .5)];
    c.injModes = [reso(6800, .0025, 1), reso(9400, .0018, .7)];
    // Ansaugtrakt: Helmholtz-Resonanz des Sammlers und Strömungsrauschen
    const fh = truck ? 75 : clampA(170 - 90 * Math.sqrt(Vc), 85, 170);
    c.helm = reso(fh, .02, 1); c.inTurb = reso(1300, .0009, 1); c.inTurb2 = reso(2600, .0007, .7);
    c.inPrev = 0;
    // Turbo, Anlasser, Raum
    c.tu = { ph: 0, ph2: 0, wh: reso(3800, .0006, 1), wh2: reso(6200, .0005, 1), bov: reso(3200, .0005, 1), bov2: reso(5400, .0004, 1) };
    c.stw = { ph: 0, ph2: 0, brush: reso(2400, .0006, 1), mesh: reso(900, .003, 1) };
    c.chainPh = 0; c.altPh = 0;
    c.combs = [1116, 1188, 1277, 1356].map(d => ({ d: delay(Math.round(d * sr / 44100)), n: Math.round(d * sr / 44100), lp: 0 }));
    c.aps = [556, 441].map(d => ({ d: delay(Math.round(d * sr / 44100)), n: Math.round(d * sr / 44100) }));
    // Zustand je Zylinder
    c.pc = new Float32Array(n); c.le = new Float32Array(n); c.li = new Float32Array(n); c.ph = new Float32Array(n);
    c.exc = new Float32Array(n); c.excT = new Float32Array(n);
    c.tau = .0008 * Math.cbrt(Vc / .5);
    c.exTurb = [reso(700, .0012, 1), reso(1500, .0008, 1)];
    c.qPrev = new Float32Array(n);
    c.mechHp = 0; c.mechLp = 0; c.out = [0, 0]; c.hpL = 0; c.hpR = 0; c.hpXL = 0; c.hpXR = 0;
    c.fire = new Uint8Array(n); c.mis = new Uint8Array(n); c.str = new Float32Array(n).fill(.7);
    C = c; S.key = P.key; S.ok = true;
    return c;
  }
  const lut = (t, ph) => { const x = ph * 2, i = x | 0, f = x - i; return t[i] * (1 - f) + t[i + 1] * f; };

  /* ----- Erzeugung ----- */
  function process(L, R) {
    const N = L.length;
    if (!C || !S.ok) { L.fill(0); R.fill(0); return; }
    const c = C, n = c.n, dt = 1 / sr;
    const kRpm = 1 - Math.exp(-1 / (.045 * sr));
    const aLoop = lp1(1900), aMuf = lp1(c.mufFc), aMuf2 = lp1(c.mufFc * 1.8), aTurbo = c.turboFc ? lp1(c.turboFc) : 1;
    const aHp = Math.exp(-TAU * 55 / sr), aMechHp = lp1(350), aMechLp = lp1(2600);
    const tauK = dt / c.tau;
    const rpmNorm = Math.pow(clampA(S.rpm, 300, 9000) / 900, -.45);
    for (let k = 0; k < N; k++) {
      S.rpm += (S.rpmT - S.rpm) * kRpm;
      // Drehungleichförmigkeit: beim Anlassen stark (Verdichtungstakte bremsen), im Leerlauf leicht
      let comp = 0;
      for (let i = 0; i < n; i++) { const a = c.ph[i]; if (a > 600) comp += Math.pow((a - 600) / 120, 2); else if (a < 60 && !c.fire[i]) comp -= Math.pow(1 - a / 60, 2) * .7; }
      const flutter = S.crank ? .32 : S.running ? (.035 + .02 * S.lumpy) * clampA(1.4 - S.rpm / 2500, .2, 1.4) : .05;
      const rpmI = Math.max(0, S.rpm * (1 - flutter * (comp / Math.max(1, n / 4) - .35)));
      const dPhi = rpmI * 6 / sr;
      S.phi = (S.phi + dPhi) % 720;
      let exIn = [0, 0], intake = 0, excMech = 0, excValve = 0, excInj = 0;
      for (let i = 0; i < n; i++) {
        const prev = c.ph[i], ph = ((S.phi - c.off[i]) % 720 + 720) % 720; c.ph[i] = ph;
        const wrapped = ph < prev - 360;
        // Verbrennung bzw. Verdichtung am OT
        if (wrapped && S.rpm > 20) {
          if (c.fire[i]) {
            const str = c.str[i] * (1 + (Math.random() - .5) * (.12 + S.lumpy * .8));
            c.exc[i] = (S.diesel ? (.5 + 1.1 * S.knock) * (.55 + .45 * S.load) : (.1 + .32 * S.load)) * str;
            c.excT[i] = S.diesel ? .0012 : .0022;
          } else c.exc[i] = S.crank ? .05 : .02, c.excT[i] = .002;
        }
        // Injektor-Ticken kurz vor OT
        if (S.ign && S.rpm > 20 && prev < 712 && ph >= 712) excInj += S.diesel ? .055 : (S.carb ? 0 : .012);
        // Auslass: Druckstoß beim Öffnen, Ausschieben danach
        const le = lut(c.lutEx, ph), li = lut(c.lutIn, ph);
        if (le > 0 && c.le[i] === 0) {
          c.pc[i] = c.fire[i] ? (1.1 + 3.4 * S.load) * c.str[i] * (1 + (Math.random() - .5) * (.1 + S.lumpy * .7))
            : c.mis[i] ? .45 : (S.crank ? .1 : .16);
        }
        if (le === 0 && c.le[i] > 0) excValve += .025 + S.wear * .003;
        if (li === 0 && c.li[i] > 0) excValve += .02 + S.wear * .003;
        c.le[i] = le; c.li[i] = li;
        let q = 0;
        if (le > 0) {
          const A = Math.sqrt(le); // Ventilspalt-Fläche wächst am Anfang schnell, kritische Strömung
          const dp = c.pc[i] * A * tauK; c.pc[i] -= dp; q = dp * sr * c.tau;
          q += (rs(c.exTurb[0], nz()) + rs(c.exTurb[1], nz()) * .7) * q * .3; // Strömungsrauschen im Ventilspalt
          if (ph > 180 && ph < 360) q += le * Math.sin((ph - 180) * Math.PI / 180) * .05;
        }
        dw(c.run[i], q * rpmNorm);
        exIn[c.nOut > 1 ? c.bank[i] : 0] += dr(c.run[i], c.runD[i]);
        if (li > 0 && ph > 360 && ph < 540) intake += li * Math.sin((ph - 360) * Math.PI / 180);
        // Verbrennungsstoß als kurzer Rauschimpuls in die Struktur
        if (c.exc[i] > .0005) { excMech += c.exc[i] * nz(); c.exc[i] *= Math.exp(-dt / c.excT[i]); }
      }
      // Abgasanlage
      const outs = [0, 0];
      for (let o = 0; o < c.nOut; o++) {
        const p = c.pipes[o];
        let x = exIn[o];
        if (c.turboFc) { p.pre += (x - p.pre) * aTurbo; x = p.pre * .7; }
        const back = dr(p.line, 2 * p.D);
        p.lpLoop += (back - p.lpLoop) * aLoop;
        const w = x - .72 * p.lpLoop;
        dw(p.line, w);
        let t = dr(p.line, p.D) * .75;
        // Schalldämpfer: Kammer (Kammfilter) und Tiefpass
        const mfb = dr(p.muf, p.muf.b.length - 5);
        const m0 = t + c.mufFb * mfb; dw(p.muf, m0 * .5);
        p.mufLp += (m0 - p.mufLp) * aMuf; p.mufLp2 += (p.mufLp - p.mufLp2) * aMuf2;
        const m = p.mufLp2;
        // Abstrahlung an der Mündung: proportional zur Änderung des Volumenstroms
        const rad = (m - p.mPrev) * sr / 3800 + m * .14; p.mPrev = m;
        p.hp = aHp * (p.hp + rad - p.hpX); p.hpX = rad;
        p.hp2 = aHp * ((p.hp2 || 0) + p.hp - (p.hpX2 || 0)); p.hpX2 = p.hp;
        outs[o] = p.hp2 * c.exGain * 3;
      }
      // Ansaugen: Sammler-Resonanz + Strömungsrauschen, stärker bei offener Drosselklappe
      const thrF = S.diesel ? .55 : (.12 + .88 * S.thr);
      const inFlow = intake * rpmNorm * S.rpm / 2000;
      const dIn = inFlow - c.inPrev; c.inPrev = inFlow;
      const inSnd = (rs(c.helm, dIn * 2.4) * .9 + (rs(c.inTurb, nz() * inFlow) + rs(c.inTurb2, nz() * inFlow)) * .02) * thrF;
      // Mechanik: Strukturmoden, Ventiltrieb, Injektoren, Lager- und Kettengeräusch
      let mech = 0;
      for (const z of c.modes) mech += rs(z, excMech);
      for (const z of c.valveModes) mech += rs(z, excValve * nz() * 6) * .6;
      for (const z of c.injModes) mech += rs(z, excInj * nz() * 8) * .7;
      excValve = 0; excInj = 0;
      const rpmF = S.rpm / 3000;
      c.chainPh = (c.chainPh + S.rpm / 60 * 21 / sr) % 1;
      c.altPh = (c.altPh + S.rpm / 60 * 2.6 * 12 / sr) % 1;
      const bed = nz() * .006 * Math.pow(rpmF, 1.4);
      c.mechLp += (bed - c.mechLp) * aMechLp; c.mechHp += (c.mechLp - c.mechHp) * aMechHp;
      mech += (c.mechLp - c.mechHp) + Math.sin(c.chainPh * TAU) * .0025 * Math.min(1, rpmF) + Math.sin(c.altPh * TAU) * .0012 * Math.min(1, rpmF * 1.5);
      if (S.pingEnv > .001) { mech += rs(c.valveModes[2], nz() * S.pingEnv) * 3; S.pingEnv *= Math.exp(-dt / .03); }
      // Turbolader: Pfeifen, Strömungsrauschen, Schubumluftventil
      let tu = 0;
      if (S.turbo) {
        const bf = clampA(S.boost / S.boostMax, 0, 1.6), tr = clampA(S.turboRpm / 150000, 0, 1.4);
        c.tu.ph = (c.tu.ph + (1400 + 6400 * tr + (S.tWob ? Math.sin(S.phi * .05) * 260 : 0)) / sr) % 1;
        c.tu.ph2 = (c.tu.ph2 + (2 * (1400 + 6400 * tr) * 1.003) / sr) % 1;
        tu = (Math.sin(c.tu.ph * TAU) * .6 + Math.sin(c.tu.ph2 * TAU) * .25) * tr * tr * .028 * (S.tWob ? 2.4 : 1)
          + (rs(c.tu.wh, nz()) + rs(c.tu.wh2, nz()) * .6) * bf * bf * .05;
        if (S.bov > .001) { tu += (rs(c.tu.bov, nz()) + rs(c.tu.bov2, nz())) * S.bov * .35; S.bov *= Math.exp(-dt / .18); }
      }
      if (S.hiss > 0) tu += rs(c.tu.wh2, nz()) * S.hiss * .3;
      // Anlasser: Ankerpfeifen, Zahneingriff am Zahnkranz, Bürsten
      let stv = 0;
      if (S.stAmp > .001) {
        const fArm = rpmI / 60 * 12 * 16, fMesh = rpmI / 60 * 125;
        c.stw.ph = (c.stw.ph + fArm / sr) % 1; c.stw.ph2 = (c.stw.ph2 + fMesh / sr) % 1;
        const load = clampA(.6 + comp * .35, .3, 1.5);
        stv = (Math.sin(c.stw.ph * TAU) * .35 + Math.sin(c.stw.ph * TAU * 2) * .12 + (c.stw.ph2 < .5 ? .25 : -.25) * .3 + rs(c.stw.brush, nz()) * 1.8) * S.stAmp * load * .22;
        stv += rs(c.stw.mesh, nz()) * S.stAmp * .25;
        if (S.grind) stv += rs(c.valveModes[1], nz()) * 2.5 * S.grind;
      }
      // Lüfter
      const fan = S.fan ? (rs(c.inTurb2, nz()) * .015) : 0;
      // Mischung: Prüfstand, Mikrofon zwischen Motor und Endrohr
      const mechG = S.diesel ? 3.4 : 2.6;
      let l, r;
      if (c.nOut > 1) { l = outs[0] * .95 + outs[1] * .45; r = outs[1] * .95 + outs[0] * .45; }
      else { l = outs[0] * .8; r = outs[0] * .95; }
      l *= S.mEx; r *= S.mEx;
      const centre = mech * mechG * S.mMech + stv + tu * 2 * S.mTu + fan;
      l += centre + inSnd * .9 * S.mIn; r += centre + inSnd * .6 * S.mIn;
      // kleiner Raumhall (Schroeder)
      const mono = (l + r) * .5;
      let rev = 0;
      for (const cb of c.combs) { const y = dr(cb.d, cb.n - 1); cb.lp += (y - cb.lp) * .35; dw(cb.d, mono + cb.lp * .74); rev += y; }
      rev *= .25;
      for (const ap of c.aps) { const y = dr(ap.d, ap.n - 1), v = rev + y * .5; dw(ap.d, v); rev = y - v * .5; }
      l += rev * .16; r += rev * .16;
      // weiche Pegelregelung und Begrenzer
      S.agc += (Math.max(Math.abs(l), Math.abs(r)) * 2.2 - S.agc) * (1 - Math.exp(-1 / (sr * .12)));
      if (S.raw) { L[k] = l; R[k] = r; continue; }
      l *= 2.2; r *= 2.2;
      const gA = S.agc > .42 ? .42 / S.agc : 1;
      L[k] = Math.tanh(l * 1.3 * gA) * .92; R[k] = Math.tanh(r * 1.3 * gA) * .92;
    }
  }

  /* ----- Parameter aus dem Simulationszustand ----- */
  function set(o) {
    if (o.P && (o.P.key !== S.key || o.tuneKey !== S.tuneKey)) { configure(o.P, o.tune); S.tuneKey = o.tuneKey; }
    if (!C) return;
    for (const k of ['rpmT', 'load', 'thr', 'diesel', 'turbo', 'carb', 'lumpy', 'wear', 'running', 'crank', 'ign', 'stAmp', 'grind', 'boost', 'boostMax', 'turboRpm', 'tWob', 'fan', 'hiss']) if (o[k] !== undefined) S[k] = o[k];
    if (o.knock !== undefined) S.knock = S.knock * .8 + o.knock * .2;
    if (o.fire) for (let i = 0; i < C.n; i++) { C.fire[i] = o.fire[i]; C.mis[i] = o.mis[i]; if (o.str[i]) C.str[i] = o.str[i]; }
    if (o.ping) S.pingEnv = Math.max(S.pingEnv, o.ping);
    if (o.bov) S.bov = Math.max(S.bov, o.bov);
  }
  function silence() { S.rpmT = 0; S.stAmp = 0; S.turboRpm = 0; S.boost = 0; S.fan = 0; S.hiss = 0; if (C) { C.fire.fill(0); C.mis.fill(0); } }
  return { set, process, silence, S, get C() { return C; } };
}
if (typeof module !== 'undefined') module.exports = { makeEngineSynth };
