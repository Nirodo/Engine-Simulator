/* ===== Simulations-Runner (läuft im Web Worker oder als Rückfall im Hauptthread) ===== */
function runnerCore(SIM) {
  let s = null, st = null, scale = 1, tickN = 0, sentLog = -1, sentDtc = -1, sentPv = -1;
  let auto = null, dynoRes = null; // Komfortstart: { phase: 'wait' | 'crank', crankT }
  const DT = .0004;
  function blankComp(n) { return { base: 1e9, mins: Array(n).fill(1e9), peaks: Array(n).fill(0), hist: Array.from({ length: n }, () => []) }; }
  function stopAuto(msg, lvl) { if (auto) { auto = null; s.startReq = false; if (msg) SIM.log(s, msg, lvl); } }
  function handle(m) {
    switch (m.type) {
      case 'init':
        st = m.st; s = SIM.create(st); s.cfg = st; auto = null;
        if (m.saved) SIM.importState(s, m.saved, m.elapsed); else SIM.coolTo(s, st.ambient);
        if (!m.saved) s.soc = st.soc;
        if (st.faults.airFuel) s.air = 1;
        if (m.logTxt) SIM.log(s, m.logTxt);
        sentLog = sentDtc = -1;
        break;
      case 'cfg': { const keepSC = st.starterCond, keepSOH = st.soh; Object.assign(st, m.st); if (!m.force) { st.starterCond = keepSC; st.soh = keepSOH; } break; }
      case 'ign': if (!m.on) stopAuto(); SIM.setIgnition(s, m.on); break;
      case 'start': stopAuto(); s.startReq = m.on; break;
      case 'autostart':
        if (auto) { stopAuto('Startvorgang abgebrochen'); break; }
        if (s.running) { SIM.log(s, 'Motor läuft bereits'); break; }
        if (!s.ign) SIM.setIgnition(s, true);
        auto = { phase: 'wait', crankT: 0 };
        break;
      case 'preheat': SIM.preheatAgain(s); break;
      case 'cool': SIM.coolTo(s, m.T); break;
      case 'set': Object.assign(s, m.v); break;
      case 'clearDtc': s.dtc = {}; s.dtcVer++; s.limp = false; SIM.log(s, 'Fehlerspeicher gelöscht'); break;
      case 'log': SIM.log(s, m.txt, m.lvl); break;
      case 'scale': scale = m.v; break;
      case 'compReset': s.comp = blankComp(s.n); s.scope = []; break;
      case 'purge': SIM.purge(s); break;
      case 'refill': SIM.refill(s, m.what); break;
      case 'shift': SIM.shift(s, m.dir); break;
      case 'dyno': {
        const cfgS = JSON.parse(JSON.stringify(st)); const cfgT = JSON.parse(JSON.stringify(st)); cfgS.tune = {};
        dynoRes = { tuned: SIM.dyno(cfgT), serie: m.compare ? SIM.dyno(cfgS) : null, key: s.P.key, at: s.clock };
        SIM.log(s, 'Leistungsmessung abgeschlossen'); break;
      }
      case 'repair':
        s.wear = 0; s.seized = false; s.seizeWhy = ''; s.warned = {}; s.dyn = {}; s.hydro = -1; s.coolLevel = 1; s.oilLevel = st.faults.oilLow ? .3 : 1; s.milky = 0; s.limp = false; s.knockDmg = 0; s.clHeat = 0;
        SIM.log(s, 'Motor instand gesetzt · Lager, Kolben, Ventile, Kopfdichtung und Turbolader erneuert, Flüssigkeiten aufgefüllt', 'good');
        break;
    }
  }
  function autoTick(dt) {
    if (!auto) return;
    if (!s.ign) { stopAuto(); return; }
    if (auto.phase === 'wait') {
      s.startReq = false;
      if (s.preheat <= 0) { auto.phase = 'crank'; SIM.log(s, 'Komfortstart · Anlasser läuft bis der Motor anspringt (max. 15 s)'); }
      return;
    }
    s.startReq = true;
    if (s.starterEng) auto.crankT += dt;
    if (s.running && s.rpm > s.P.crankRpm * 1.05) { stopAuto(); return; }
    if (auto.crankT > 15 || s.cutout) stopAuto('Komfortstart abgebrochen · Motor nicht angesprungen. Vor dem nächsten Versuch kurz warten.', 'bad');
    else if (s.seized || s.hydro >= 0) { if (auto.crankT > 2) stopAuto('Komfortstart abgebrochen · Anlasser blockiert', 'bad'); }
  }
  function snap(t0) {
    const o = {
      key: s.P.key, t0, t: s.t, clock: s.clock, rpm: s.rpm, Vt: s.Vt, Ib: s.Ib, Is: s.Is, Iglow: s.Iglow, Ialt: s.Ialt, soc: s.soc,
      Tb: s.Tb, TbSens: SIM.coolSensor(s), To: s.To, Tst: s.Tst, Tbat: s.Tbat, Tfuel: s.Tfuel, fuelHeat: s.fuelHeat, Thead: s.Thead,
      rail: s.rail, q: s.q, qMax: s.qMax, fuelFlow: s.fuelFlow, limp: s.limp,
      frictionNm: s.frictionNm, Tload: s.Tload, powerKW: s.powerKW, running: s.running, starterEng: s.starterEng, startReq: s.startReq,
      solOff: s.solOff, cutout: s.cutout, ecuReset: s.ecuReset, ign: s.ign, preheat: s.preheat, glowOn: s.glowOn, afterglow: s.afterglow,
      air: s.air, lastFire: s.lastFire, smoke: Object.assign({}, s.smoke), starterGrind: s.starterGrind, oilP: s.oilP, oilLevel: s.oilLevel,
      milky: s.milky, crankcase: s.crankcase, wear: s.wear, seized: s.seized, seizeWhy: s.seizeWhy, frozen: s.frozen, hydro: s.hydro,
      coolLevel: s.coolLevel, coolPress: s.coolPress, thermo: s.thermo, fanOn: s.fanOn, circ: s.circ, boiling: s.boiling, dyn: Object.assign({}, s.dyn),
      Tgrid: s.Tgrid, dTin: s.dTin, boost: s.boost, turboRpm: s.turboRpm, puddle: s.puddle, bowl: s.bowl, Vp: s.Vp,
      ocv: SIM.OCV(s) - s.Vp, Rb: SIM.battR(s), fz: SIM.freezeT(s.soc), attempts: s.attempts, starterCond: st.starterCond, soh: st.soh,
      Tin: SIM.tIn(s) - 273.15, egt: s.egt, knockRetard: s.knockRetard, knockEvt: s.knockEvt, smokeLim: s.smokeLim, rich: s.rich, veNow: s.veNow, theta: s.theta,
      gear: s.gear, v: s.v, clutchPos: s.clutchPos, slip: s.slip, vHeld: s.vHeld, clHeat: s.clHeat, cut: s.cut, Tc: s.Tc,
      flowRad: s.flowRad, flowBy: s.flowBy, flowHeat: s.flowHeat, limiterHit: s.limiterHit || -9, floatT: s.floatT, Tind: s.Tind, auto: auto ? auto.phase : null, autoT: auto ? auto.crankT : 0,
      cylS: s.cylS.map(c => ({ phi: c.phi, burn: c.burn, Tw: c.Tw, Tir: c.Tir, Tg: c.Tg, state: c.state, lastEvt: c.lastEvt, mis: c.mis,
        pmaxShow: c.pmaxShow, TendEff: c.TendEff, mix: c.mix, wet: c.wet })),
      comp: { avg: s.comp.hist.map(h => h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0), n: s.comp.hist.map(h => h.length) },
      events: s.events.slice(),
    };
    s.events.length = 0;
    if (dynoRes) { o.dyno = dynoRes; dynoRes = null; }
    if (s.pvVer !== sentPv) { o.pv = s.pvDone; sentPv = s.pvVer; }
    if (tickN % 5 === 0) o.scope = s.scope.slice();
    if (s.logVer !== sentLog) { o.log = s.log.slice(); sentLog = s.logVer; }
    if (s.dtcVer !== sentDtc) { o.dtc = JSON.parse(JSON.stringify(s.dtc)); sentDtc = s.dtcVer; }
    if (tickN % 60 === 0) o.exp = SIM.exportState(s);
    return o;
  }
  function tick(dtR) {
    if (!s) return null;
    tickN++;
    dtR = Math.min(dtR, .25);
    const t0 = s.t;
    autoTick(dtR);
    const n = Math.round(dtR / DT);
    for (let i = 0; i < n; i++) SIM.step(s, DT);
    const sc = (s.running || s.starterEng || s.rpm > 1) && scale > 60 ? 60 : scale;
    SIM.thermal(s, dtR, sc);
    return snap(t0);
  }
  return { handle, tick };
}
