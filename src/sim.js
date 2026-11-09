/* ===== Engine-Simulator · Physik-Kern ===== */
function SIM_FACTORY() {
  const PRESETS = {
    d6: { key:'d6', label:'Diesel R6 · 12,8 l · Lkw', type:'DIESEL', diesel:true, pre:'grid', cyl:6, order:[1,5,3,6,2,4],
      bore:.131, stroke:.158, rod:.255, cr:17, J:3.2, sysV:24, nBat:2, idle:600, maxRpm:2200, crankRpm:330,
      batAh:225, rb12:.0022, rcable:.0012, st:{Kf:.0026, Isat:600, Rm:.006, eff:.8, C:3200, noload:90},
      gridW:2600, kmax:4.6, startQ:.52, fmep:{s:.5, v:.85}, gear:45, Cblock:6.6e5, hLoss:55, altA:110, ecuA:5,
      acc:{light:9, blower:11, rear:7}, fuelHeatA:10, oil:'15W-40', heaterW:1500, kp:.0016, ki:.0025,
      oilK:3.0, relief:5.2, spool:.42, turbo:true, boostMax:2.4, Tmax:2300, oilL:38, coolL:52 },
    d4: { key:'d4', label:'Diesel R4 · 2,0 l · Pkw', type:'DIESEL', diesel:true, pre:'plug', cyl:4, order:[1,3,4,2],
      bore:.081, stroke:.0955, rod:.144, cr:16.5, J:.30, sysV:12, nBat:1, idle:820, maxRpm:4600, crankRpm:420,
      batAh:72, rb12:.0045, rcable:.0015, st:{Kf:.0027, Isat:300, Rm:.009, eff:.75, C:1400, noload:70},
      glowI:16, kmax:4.6, startQ:.52, fmep:{s:.45, v:.55}, gear:6, Cblock:1.25e5, hLoss:22, altA:140, ecuA:8,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:15, oil:'5W-30', heaterW:600, kp:.0012, ki:.002,
      oilK:2.6, relief:5.5, spool:.36, turbo:true, boostMax:1.9, Tmax:380, oilL:4.7, coolL:8 },
    b4: { key:'b4', label:'Benziner R4 · 1,6 l · Pkw', type:'BENZIN', diesel:false, efi:true, cyl:4, order:[1,3,4,2],
      bore:.079, stroke:.0815, rod:.133, cr:10.5, J:.22, sysV:12, nBat:1, idle:750, maxRpm:6200, crankRpm:400,
      batAh:60, rb12:.0055, rcable:.0015, st:{Kf:.0021, Isat:300, Rm:.010, eff:.75, C:1200, noload:60},
      kmax:3.8, startQ:.8, fmep:{s:.40, v:.5}, gear:5, Cblock:1.0e5, hLoss:20, altA:110, ecuA:9,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:0, oil:'5W-30', heaterW:500, kp:.0010, ki:.0018,
      oilK:2.4, relief:5.0, Tmax:155, oilL:4.2, coolL:6.5 },
    k4: { key:'k4', label:'Vergaser R4 · 1,3 l · Oldtimer', type:'VERGASER', diesel:false, carb:true, cyl:4, order:[1,3,4,2],
      bore:.075, stroke:.072, rod:.125, cr:8.8, J:.17, sysV:12, nBat:1, idle:850, maxRpm:5800, crankRpm:330,
      batAh:45, rb12:.0070, rcable:.002, st:{Kf:.0013, Isat:260, Rm:.013, eff:.72, C:1100, noload:55},
      kmax:3.4, startQ:.9, fmep:{s:.42, v:.55}, gear:5, Cblock:.85e5, hLoss:18, altA:55, ecuA:3,
      acc:{light:9, blower:8, rear:8}, fuelHeatA:0, oil:'20W-50', heaterW:500,
      oilK:2.8, relief:4.5, Tmax:95, oilL:3.5, coolL:6, cam:'OHV', ignOpt:10 },
    d6p: { key:'d6p', label:'Diesel R6 · 3,0 l · Pkw', type:'DIESEL', diesel:true, pre:'plug', cyl:6, order:[1,5,3,6,2,4],
      bore:.084, stroke:.090, rod:.152, cr:16.5, J:.42, sysV:12, nBat:1, idle:650, maxRpm:4800, crankRpm:400,
      batAh:95, rb12:.0036, rcable:.0014, st:{Kf:.0031, Isat:340, Rm:.008, eff:.76, C:1700, noload:75},
      glowI:16, kmax:4.6, startQ:.52, fmep:{s:.45, v:.55}, gear:8, Cblock:1.7e5, hLoss:26, altA:180, ecuA:10,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:15, oil:'5W-30', heaterW:800, kp:.0010, ki:.0018,
      oilK:2.6, relief:5.5, spool:.34, turbo:true, boostMax:2.2, Tmax:620, oilL:7.5, coolL:10, ve:{peak:.45} },
    v8: { key:'v8', label:'Benziner V8 · 5,0 l · Sportwagen', type:'BENZIN V8', diesel:false, efi:true, cyl:8, order:[1,5,4,8,6,3,7,2],
      banks:[0,0,0,0,1,1,1,1], layout:'V', bore:.092, stroke:.0927, rod:.155, cr:11, J:.36, sysV:12, nBat:1, idle:700, maxRpm:7000, crankRpm:380,
      batAh:80, rb12:.0040, rcable:.0014, st:{Kf:.0030, Isat:330, Rm:.008, eff:.76, C:1600, noload:75},
      kmax:3.8, startQ:.8, fmep:{s:.45, v:.55}, gear:8, Cblock:1.6e5, hLoss:30, altA:160, ecuA:10,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:0, oil:'5W-30', heaterW:800, kp:.0010, ki:.0018,
      oilK:2.6, relief:5.5, Tmax:560, oilL:8, coolL:12, ve:{peak:.62}, ignOpt:30 },
    r3: { key:'r3', label:'Benziner R3 Turbo · 1,0 l · Kleinwagen', type:'BENZIN TURBO', diesel:false, efi:true, cyl:3, order:[1,2,3],
      bore:.0715, stroke:.0828, rod:.135, cr:10.5, J:.15, sysV:12, nBat:1, idle:800, maxRpm:6300, crankRpm:420,
      batAh:50, rb12:.0060, rcable:.0015, st:{Kf:.0019, Isat:280, Rm:.011, eff:.75, C:1100, noload:55},
      kmax:2.4, startQ:.8, fmep:{s:.40, v:.5}, gear:5, Cblock:.75e5, hLoss:16, altA:110, ecuA:9,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:0, oil:'0W-30', heaterW:500, kp:.0010, ki:.0018,
      oilK:2.4, relief:5.0, spool:.3, turbo:true, boostMax:1.2, Tmax:200, oilL:4, coolL:5, ve:{peak:.5}, ignOpt:24 },
    bx4: { key:'bx4', label:'Boxer 4 · 2,5 l · Allrad', type:'BOXER', diesel:false, efi:true, cyl:4, order:[1,3,2,4],
      banks:[0,1,0,1], layout:'B', bore:.0995, stroke:.079, rod:.130, cr:10, J:.27, sysV:12, nBat:1, idle:700, maxRpm:6500, crankRpm:400,
      batAh:65, rb12:.0050, rcable:.0015, st:{Kf:.0024, Isat:300, Rm:.009, eff:.75, C:1300, noload:65},
      kmax:3.8, startQ:.8, fmep:{s:.42, v:.52}, gear:6, Cblock:1.1e5, hLoss:22, altA:120, ecuA:9,
      acc:{light:12, blower:15, rear:12}, fuelHeatA:0, oil:'5W-30', heaterW:600, kp:.0010, ki:.0018,
      oilK:2.4, relief:5.0, Tmax:235, oilL:5, coolL:7, ve:{peak:.55}, ignOpt:28 },
  };
  /* Fahrzeug je Motor: Masse kg, Radhalbmesser m, Achsübersetzung, Gänge, Rückwärtsgang, cw·A m², Rollwiderstand */
  const VEH = {
    d6:  { m: 16000, r: .52, fd: 3.7, g: [11.6, 8.0, 5.6, 4.0, 2.9, 2.0, 1.4, 1.0], rev: 11, cda: 6.5, crr: .006 },
    d4:  { m: 1500, r: .31, fd: 3.6, g: [3.8, 2.1, 1.35, .97, .76, .63], rev: 3.6, cda: .66, crr: .011 },
    b4:  { m: 1200, r: .30, fd: 4.1, g: [3.5, 1.95, 1.3, .97, .78], rev: 3.4, cda: .64, crr: .011 },
    k4:  { m: 900, r: .28, fd: 4.1, g: [3.6, 2.1, 1.4, 1.0], rev: 3.6, cda: .78, crr: .013 },
    d6p: { m: 2050, r: .34, fd: 3.4, g: [4.1, 2.4, 1.5, 1.1, .86, .69], rev: 3.7, cda: .82, crr: .011 },
    v8:  { m: 1700, r: .34, fd: 3.6, g: [3.2, 2.2, 1.6, 1.25, 1.0, .8], rev: 3.0, cda: .72, crr: .011 },
    r3:  { m: 1150, r: .30, fd: 4.3, g: [3.6, 1.95, 1.25, .92, .74], rev: 3.5, cda: .62, crr: .011 },
    bx4: { m: 1450, r: .32, fd: 4.1, g: [3.45, 2.06, 1.45, 1.09, .85, .70], rev: 3.3, cda: .70, crr: .012 },
  };
  for (const k in PRESETS) {
    const P = PRESETS[k];
    P.banks = P.banks || Array(P.cyl).fill(0); P.layout = P.layout || 'R';
    P.mechMax = P.mechMax || Math.round(P.maxRpm * 1.12 / 100) * 100;
    P.ve = P.ve || { peak: P.diesel ? .45 : .55 }; P.cam = P.cam || (k === 'd6' ? 'OHC' : 'DOHC'); P.ignOpt = P.ignOpt ?? 28;
    P.veh = VEH[k];
  }
  const CAMS = { serie:{ label:'Serie', dur:0, lowPen:0, idle:0, shift:0, idleUp:0 }, sport:{ label:'Sport (+20°)', dur:20, lowPen:.06, idle:.1, shift:.1, idleUp:80 }, race:{ label:'Rennen (+40°)', dur:40, lowPen:.14, idle:.3, shift:.2, idleUp:250 } };
  const EXH = { serie:{ label:'Serie', ve:0, loud:1 }, sport:{ label:'Sportauspuff', ve:.03, loud:1.6 }, straight:{ label:'Gerades Rohr', ve:.05, loud:2.6 } };
  const TUNE_DEF = { boost:1, fuel:1, limiter:null, timing:0, cam:'serie', exhaust:'serie', intercooler:false, turboBig:false, radiator:false, knockCtl:true };
  const tune = s => Object.assign({}, TUNE_DEF, s.cfg.tune || {});
  function ve(s, rpm) {
    const P = s.P, T = s.T, cm = CAMS[T.cam] || CAMS.serie;
    const x = rpm / P.maxRpm, pk = P.ve.peak + cm.shift;
    let v = 1 - .35 * Math.pow((x - pk) / .6, 2);
    if (x < pk) v -= cm.lowPen * 2.2 * (pk - x);
    v += (EXH[T.exhaust] || EXH.serie).ve;
    if (x > 1.05) v -= (x - 1.05) * 1.5;
    return clamp(v, .3, 1.08);
  }
  function valveLift(phi, kind, camKey) {
    const d = 230 + ((CAMS[camKey] || CAMS.serie).dur);
    const c = kind === 'ex' ? 270 : 450, a = c - d / 2, b = c + d / 2;
    if (phi < a || phi > b) return 0;
    return Math.sin((phi - a) / d * Math.PI) ** 1.4;
  }
  const bmEff = s => s.P.boostMax * s.T.boost * (s.T.turboBig ? 1.35 : 1);
  const OILS = { '0W-30':15, '5W-30':10, '10W-40':5, '15W-40':0, '20W-50':-5 };
  const FUELS = {
    sommer:{ label:'Sommerdiesel (CFPP 0 °C)', cfpp:0 },
    winter:{ label:'Winterdiesel (CFPP −20 °C)', cfpp:-20 },
    arktis:{ label:'Arktisdiesel (CFPP −32 °C)', cfpp:-32 },
  };
  const GROUPS = { el:'Elektrik', fuel:'Kraftstoff & Zündung', mech:'Motormechanik', cool:'Kühlung', oil:'Schmierung', turbo:'Turbolader' };
  const FAULTS = {
    glowRelay:   { g:'el', label:'Vorglührelais defekt', need:'diesel' },
    grid:        { g:'el', label:'Heizflansch durchgebrannt', need:'grid' },
    coolSensor:  { g:'el', label:'Kühlmittelsensor meldet fälschlich +80 °C', need:'ecu' },
    ground:      { g:'el', label:'Massekabel korrodiert' },
    cell:        { g:'el', label:'Batterie: Zellenschluss' },
    alt:         { g:'el', label:'Lichtmaschine lädt nicht' },
    airFuel:     { g:'fuel', label:'Luft im Kraftstoffsystem', need:'diesel' },
    filter:      { g:'fuel', label:'Kraftstofffilter zugesetzt' },
    water:       { g:'fuel', label:'Wasser im Kraftstoff', need:'diesel' },
    tank:        { g:'fuel', label:'Tank leer', noMystery:true },
    pump:        { g:'fuel', label:'Elektrische Kraftstoffpumpe defekt', need:'efi' },
    float:       { g:'fuel', label:'Schwimmerkammer leer (lange gestanden)', need:'carb' },
    chokeCable:  { g:'fuel', label:'Choke-Zug gerissen', need:'carb' },
    points:      { g:'fuel', label:'Unterbrecherkontakt verbrannt', need:'carb' },
    coil:        { g:'fuel', label:'Zündspule defekt (kein Funke)', need:'petrol' },
    headGasket:  { g:'mech', label:'Zylinderkopfdichtung defekt (zwischen Zyl. 2 und 3)', prog:true },
    coolLeak:    { g:'cool', label:'Kühlmittelverlust (Schlauch undicht)', prog:true },
    waterPump:   { g:'cool', label:'Wasserpumpe defekt' },
    fan:         { g:'cool', label:'Kühlerlüfter defekt' },
    thermostat:  { g:'cool', label:'Thermostat klemmt offen' },
    oilLeak:     { g:'oil', label:'Ölverlust (Ölwanne undicht)', prog:true },
    oilLow:      { g:'oil', label:'Ölstand weit unter Minimum' },
    oilPump:     { g:'oil', label:'Ölpumpe verschlissen' },
    turboHose:   { g:'turbo', label:'Ladeluftschlauch geplatzt', need:'turbo' },
    turboBearing:{ g:'turbo', label:'Turbolader Lagerschaden', need:'turbo', prog:true },
    wastegate:   { g:'turbo', label:'Wastegate klemmt zu (Überladedruck)', need:'turbo' },
  };
  const CYL_FAULTS = {
    plug:  { g:'fuel' },
    inj:   { g:'fuel' },
    comp:  { g:'mech' },
    rings: { g:'mech' },
  };
  function applies(need, P) {
    if (!need) return true;
    if (need === 'diesel') return P.diesel;
    if (need === 'petrol') return !P.diesel;
    if (need === 'efi') return !!P.efi;
    if (need === 'carb') return !!P.carb;
    if (need === 'grid') return P.pre === 'grid';
    if (need === 'plug') return P.pre === 'plug';
    if (need === 'ecu') return !P.carb;
    if (need === 'turbo') return !!P.turbo;
    return true;
  }
  function cylFaultLabel(key, P) {
    if (key === 'plug') { if (P.pre === 'grid') return null; return P.diesel ? 'Glühkerze defekt' : 'Zündkerze verrußt'; }
    if (key === 'inj') { if (P.carb) return null; return P.diesel ? 'Injektor verstopft' : 'Einspritzventil verstopft'; }
    if (key === 'comp') return 'Auslassventil undicht';
    if (key === 'rings') return 'Kolbenringe gebrochen';
  }

  const PAMB = 1.013e5;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sig = x => 1 / (1 + Math.exp(-x));
  const de = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const GASKET = [1, 2];

  function viscFactor(T, shift) {
    const te = Math.max(T + shift, -100);
    return Math.exp(900 / (te + 110)) / Math.exp(900 / 200);
  }
  function freezeT(soc) {
    const pts = [[0, -8], [.25, -15], [.5, -25], [.75, -40], [1, -62]];
    soc = clamp(soc, 0, 1);
    for (let i = 1; i < pts.length; i++) if (soc <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]]; return a[1] + (b[1] - a[1]) * (soc - a[0]) / (b[0] - a[0]); }
    return -62;
  }

  function create(cfg) {
    const P = PRESETS[cfg.engine] || PRESETS.d6;
    const n = P.cyl, r = P.stroke / 2, A = Math.PI * P.bore * P.bore / 4;
    const Vd = A * P.stroke, Vc = Vd / (P.cr - 1), Vbdc = Vd + Vc;
    const k12 = P.sysV / 12;
    const R20 = P.glowI ? P.sysV / P.glowI : 1;
    const glowH = P.glowI ? (P.sysV * P.sysV / (R20 * (1 + .0025 * 1030))) / 1030 : 0;
    const Ta = cfg.ambient;
    return {
      P, cfg, n, r, A, Vd, Vc, Vbdc, k12, Rm: P.st.Rm, R20, glowH,
      t: 0, clock: 0, theta: Math.random() * 4 * Math.PI, w: 0, rpm: 0,
      ign: false, startReq: false, starterEng: false, solOff: 0, solDrops: [], cutout: false,
      ecuReset: 0, brown: 0, preheat: 0, preheatSet: 0, afterglow: 0, glowOn: false,
      Tb: Ta, To: Ta, Tst: Ta, Tbat: Ta, Tfuel: Ta, fuelHeat: 0, Tgrid: Ta, dTin: 0, Thead: Ta,
      soc: cfg.soc, Vt: 0, Vf: 12 * k12, Vp: 0, Ib: 0, Is: 0, Iglow: 0, Ialt: 0, Iacc: 0, frozen: false,
      rail: 0, air: cfg.faults.airFuel ? 1 : 0, bowl: cfg.faults.float ? 0 : 1, puddle: 0, lastThr: 0,
      qI: .5, q: 0, qMax: 1, mode: 'off', running: false, runClock: 0, limp: false,
      oilFill: 0, oilP: 0, oilLevel: cfg.faults.oilLow ? .3 : 1, milky: 0, crankcase: 0,
      coolLevel: 1, coolPress: 0, thermo: 0, fanOn: false, circ: 0, boiling: false, overheatT: 0, seep: 0, hydro: -1,
      dyn: {}, wear: 0, seized: false, seizeWhy: '', lowOilT: 0, warned: {},
      boost: 0, turboRpm: 0, boostLowT: 0, T: tune({ cfg }), knockRetard: 0, knockDmg: 0, egt: Ta, egtT: 0, overT: 0, floatT: 0, smokeLim: 1, rich: 0, Tind: 0, hold: 0,
      pvCur: [], pvDone: null, pvVer: 0, pvBin: -1, flowRad: 0, flowBy: 0, flowHeat: 0, veNow: 1, knockEvt: 0, Tload: 0, powerKW: 0, heatW: 0,
      Tf: 0, lastFire: -9, firstFire: null, crankStart: null, attempts: 0,
      gear: 0, v: 0, runSince: -99, qOnT: 0, lugT: 0, stalled: false, clutchPos: 1, slip: 0, Tc: 0, vHeld: true, clHeat: 0, cut: false, lockWarn: 0,
      heatAcc: 0, heatAccW: 0, frictionNm: 0, starterGrind: 0,
      scope: [], scopeT: 0, comp: { base: 1e9, mins: Array(n).fill(1e9), peaks: Array(n).fill(0), hist: Array.from({ length: n }, () => []) },
      cylS: Array.from({ length: n }, (_, i) => ({
        idx: i, pos: P.order.indexOf(i + 1), phi: 0, prevPhi: 0, k: 0, kE: 0, pr: 1, fired: false, state: 'stopped',
        Tw: Ta, Tir: Ta, Tg: Ta, pmax: 0, pmaxShow: 0, mis: 0, wet: 0, lastEvt: -9, TendEff: 0, burn: 0, mix: 0,
      })),
      events: [], log: [], logVer: 0, dtc: {}, dtcVer: 0, smoke: { white: 0, black: 0, blue: 0, sweet: 0 },
    };
  }

  function log(s, txt, lvl = 'info') { s.log.unshift({ t: s.clock, txt, lvl }); if (s.log.length > 150) s.log.pop(); s.logVer++; }
  function freeze(s) {
    return { rpm: Math.round(s.rpm), Vt: +s.Vt.toFixed(1), Tb: +s.Tb.toFixed(0), To: +s.To.toFixed(0), Ta: s.cfg.ambient,
      soc: Math.round(s.soc * 100), oilP: +s.oilP.toFixed(1), boost: +s.boost.toFixed(2), rail: Math.round(s.rail * (s.P.diesel ? 1 : 10)) / (s.P.diesel ? 1 : 10),
      q: Math.round(s.q * 100), load: Math.round((s.cfg.load || 0) * 100), starter: s.starterEng, t: s.clock };
  }
  function dtc(s, code, txt) {
    if (!s.dtc[code]) { s.dtc[code] = { code, txt, t: s.clock, ff: freeze(s) }; s.dtcVer++; log(s, `Fehlercode ${code} gespeichert: ${txt}`, 'warn'); }
  }
  function warnOnce(s, key, txt, lvl = 'bad') { if (!s.warned[key]) { s.warned[key] = true; log(s, txt, lvl); } }
  const F = s => s.cfg.faults;
  const gasket = s => F(s).headGasket || s.dyn.headGasket;

  const sensorT = s => s.cfg.faults.coolSensor ? 80 : coolSensor(s);
  const coolSensor = s => s.coolLevel < .25 ? s.cfg.ambient + (s.Tb - s.cfg.ambient) * .45 : s.Tb;
  const preTime = (s, Ts) => s.P.pre === 'grid' ? clamp((5 - Ts) * .6 + 5, 0, 40) : clamp((10 - Ts) * .35 + 2, 0, 20);

  function setIgnition(s, on) {
    if (on === s.ign) return;
    s.ign = on;
    if (on) {
      const Ts = sensorT(s);
      if (s.P.diesel) {
        const t = preTime(s, Ts);
        s.preheat = s.preheatSet = t;
        const what = s.P.pre === 'grid' ? 'Ansaugluft-Vorwärmung' : 'Vorglühzeit';
        log(s, t > 0 ? `Zündung an · ${what} ${de(t)} s (Kühlmittelsensor ${Ts.toFixed(0)} °C)` : 'Zündung an · kein Vorglühen nötig');
        if (F(s).glowRelay && t > 0) dtc(s, s.P.pre === 'grid' ? 'P0540' : 'P0380', s.P.pre === 'grid' ? 'Ansaugluftheizung · Stromkreis Fehlfunktion' : 'Glühkerzen-Steuerkreis A Fehlfunktion');
      } else if (s.P.carb) log(s, 'Zündung an · Ladekontrolle und Öldrucklampe leuchten');
      else log(s, 'Zündung an · Kraftstoffpumpe baut Druck auf');
      s.events.push({ type: 'relay' });
    } else {
      s.preheat = 0; s.afterglow = 0; s.startReq = false;
      log(s, s.rpm > 50 ? 'Zündung aus · Motor wird abgestellt' : 'Zündung aus');
    }
  }
  function preheatAgain(s) {
    if (!s.ign || !s.P.diesel) return;
    const t = Math.max(3, preTime(s, sensorT(s)));
    s.preheat = s.preheatSet = t;
    log(s, `Erneut vorglühen · ${de(t)} s`);
    s.events.push({ type: 'relay' });
  }

  /* --------- Kinematik & Gasdruck --------- */
  function kin(s, phiDeg) {
    const th = phiDeg * Math.PI / 180, l = s.P.rod, r = s.r;
    const sn = Math.sin(th), cs = Math.cos(th);
    const root = Math.sqrt(l * l - r * r * sn * sn);
    const x = r * (1 - cs) + l - root;
    const dx = r * sn + r * r * sn * cs / root;
    return { x, V: s.Vc + s.A * x, dV: s.A * dx };
  }
  function cylPressure(s, c, phi, V) {
    if (!(phi >= 540 || phi < 180)) return PAMB;
    if (c.idx === s.hydro && V < s.Vc * 1.3) return PAMB * 20 + 2e9 * (s.Vc * 1.3 - V) / (s.Vc * 1.3);
    const ratio = (s.Vbdc - V) / (s.Vbdc - s.Vc);
    let p = PAMB * c.pr * Math.pow(s.Vbdc / V, c.n) * (1 - c.psi * ratio);
    if (phi < 180) p *= c.fired ? 1 + c.k * Math.min(1, phi / 18) : .93;
    return p;
  }
  function cylParams(s, c) {
    const rpmC = Math.max(s.rpm, 2.5), f = F(s);
    let leak = .05 + s.wear * .002;
    if (f.cyl.comp[c.idx]) leak += .32;
    if (f.cyl.rings[c.idx]) leak += s.cfg.wetTest ? .04 : .17;
    if (gasket(s) && GASKET.includes(c.idx)) leak += .2;
    if (s.dyn.bentRod === c.idx) leak += .25;
    if (s.dyn.bentValve === c.idx) leak += .35;
    if (s.dyn.burntPiston === c.idx) leak += .3;
    c.psi = clamp(leak * Math.pow(150 / rpmC, .7) * (1 + .004 * Math.max(0, 20 - c.Tw)), 0, .9);
    const hl = .04 * Math.pow(150 / Math.max(rpmC, 25), .5) * (1 + Math.max(0, 90 - c.Tw) / 120);
    c.n = 1.37 - hl;
    const cm = CAMS[s.T.cam] || CAMS.serie;
    c.pr = (1 + (s.P.turbo ? s.boost : 0)) * (1 - cm.lowPen * clamp(1 - s.rpm / (s.P.maxRpm * .3), 0, 1));
  }
  function tIn(s) { return s.cfg.ambient + 273.15 + (s.Tb - s.cfg.ambient) * .12 + s.dTin + (s.P.turbo ? s.boost * (s.T.intercooler ? 9 : 22) : 0); }
  function tEnd(s, c) { return tIn(s) * Math.pow(1 + (s.P.cr - 1) * (1 - c.psi), c.n - 1); }

  /* --------- Verbrennung am OT --------- */
  function tdc(s, c) {
    const P = s.P, f = F(s), cfg = s.cfg;
    c.fired = false; c.k = 0; c.kE = 0;
    if (s.rpm < 8) return;
    const ecu = s.ign && (P.carb || s.ecuReset <= 0);
    const floodClear = P.efi && s.starterEng && cfg.throttle > .9;
    const fuel = ecu && !floodClear && !cfg.noInject && s.q > .002;
    let fuelQ = s.fuelFlow;
    if (f.cyl.inj[c.idx] && !P.carb) fuelQ *= .12;
    const Te = tEnd(s, c);
    let pIgn = 0, qual = 0, injected = fuel && fuelQ > .05, knock = 0;
    if (P.diesel) {
      const railQ = clamp((s.rail - 150) / 150, 0, 1);
      injected = injected && railQ > 0;
      const bonus = P.pre === 'plug' && !f.cyl.plug[c.idx] ? 230 * clamp((c.Tg - 200) / 850, 0, 1) : 0;
      const Teff = Te + bonus + s.T.timing * 3;
      c.TendEff = Teff;
      pIgn = sig((Teff - 665) / 15) * clamp(fuelQ * 1.3, 0, 1);
      qual = clamp((Teff - 610) / 150, .2, 1) * Math.sqrt(railQ) * clamp(fuelQ, .3, 1);
      if (f.water && s.Tfuel >= 0) pIgn *= .7;
      knock = clamp((880 - Teff) / 170, 0, 1) * (1 + s.T.timing * .06);
    } else {
      c.TendEff = Te;
      let spark;
      if (P.carb) spark = f.coil ? 0 : clamp((s.Vt - (f.points ? 10.6 : 6.8)) / 2.2, 0, 1);
      else spark = !f.coil && s.Vt > .55 * 12 * s.k12 ? 1 : 0;
      if (!s.ign || cfg.noInject) spark = 0;
      if (f.cyl.plug[c.idx]) spark *= .15;
      let m;
      if (P.carb) {
        const vap = clamp(.12 + (s.Tb + (s.running ? 12 : 0) + 30) * .012, .05, 1);
        const choke = f.chokeCable ? 0 : cfg.choke || 0;
        const lean = s.running ? 1 : 1 - .5 * cfg.throttle;
        const pud = Math.min(s.puddle, 1.2);
        m = vap * (1 + (s.running ? 1.3 : 2.6) * choke) * lean * fuelQ + pud * .9;
        s.puddle = Math.max(0, s.puddle - .05);
        injected = ecu && !cfg.noInject && (fuelQ > .05 || pud > .1);
      } else {
        const vap = T => clamp(.25 + (T + 30) * .018, .08, 1);
        const enrich = clamp(1 / vap(sensorT(s)), 1, 4) * (s.mode === 'crank' ? 1.15 : 1);
        m = vap(s.Tb) * enrich * clamp(fuelQ, 0, 1);
      }
      c.mix = m;
      const win = m < .7 ? clamp((m - .35) / .35, 0, 1) : m > 1.6 ? clamp(1 - (m - 1.6) / .8, 0, 1) : 1;
      const foul = c.wet > .6 ? clamp(1 - (c.wet - .6) / .3, 0, 1) : 1;
      const compOK = (f.cyl.comp[c.idx] || f.cyl.rings[c.idx]) && s.Tb < 30 ? .3 : 1;
      pIgn = spark * win * foul * compOK;
      qual = clamp(win, .3, 1) * (f.cyl.comp[c.idx] ? .6 : 1);
      if (injected && Math.random() >= pIgn) c.wet = clamp(c.wet + .045 * Math.max(1, m), 0, 1.2);
      if (m > 1.5 && injected) s.smoke.black += .05 * (m - 1.5);
    }
    if (gasket(s) && GASKET.includes(c.idx) && s.coolLevel > .05) { qual *= .8; s.smoke.sweet += .25; }
    const cmI = CAMS[s.T.cam] || CAMS.serie;
    if (cmI.idle) pIgn *= 1 - cmI.idle * clamp(1 - s.rpm / (P.idle * 1.8), 0, 1);
    if (s.rpm > P.mechMax) pIgn *= .6;
    let eff = 1;
    if (P.diesel) eff = 1 - .4 * Math.pow((s.T.timing - 2) / 15, 2);
    else {
      const tim = s.T.timing - s.knockRetard;
      eff = 1 - .6 * Math.pow((tim - 3) / 18, 2);
      if (s.running && injected && s.q > .45) {
        const kIdx = tim * .06 + s.boost * .55 + (s.Thead - 95) / 50 + s.q * .45 + (s.T.fuel < 1 ? (1 - s.T.fuel) * 2 : 0);
        if (kIdx > 1.05 && Math.random() < (kIdx - 1.05) * 2.2) {
          s.events.push({ type: 'knock', t: s.t, str: clamp(kIdx - 1, 0, 1) }); s.knockEvt = s.t;
          if (s.T.knockCtl) { s.knockRetard = Math.min(14, s.knockRetard + 1.5); warnOnce(s, 'knock' + Math.round(s.clock / 600), 'Klopfen erkannt · Steuergerät nimmt Zündung zurück', 'warn'); }
          else { s.knockDmg += .012 * (kIdx - .9); s.wear += .01; warnOnce(s, 'knockOff', 'Motor klopft ungeregelt · Kolben werden geschädigt', 'bad');
            if (s.knockDmg > 1 && s.dyn.burntPiston == null) { s.dyn.burntPiston = c.idx; log(s, `Klopfschaden · Kolben in Zylinder ${c.idx + 1} angeschmolzen`, 'bad'); } }
        }
      }
    }
    if (f.cyl.rings[c.idx]) s.smoke.blue += .05;
    if (injected && Math.random() < pIgn) {
      c.fired = true;
      if (P.diesel) { const sl = Math.max(.05, s.smokeLim); c.kE = P.kmax * qual * eff * (s.q <= sl ? s.q : sl + (s.q - sl) * .35); if (s.q > sl * 1.02) s.smoke.black += (s.q / sl - 1) * .9; }
      else c.kE = P.kmax * s.q * qual * eff * s.veNow * (1 + s.boost) * (s.T.fuel > 1 ? 1 + (s.T.fuel - 1) * .25 : s.T.fuel);
      c.k = c.kE / c.pr;
      c.burn = 1; c.state = 'fire';
      c.mis *= .85;
      c.wet = Math.max(0, c.wet - .08);
      c.Tw += 5.5 * Math.min(1, s.q * P.kmax / 2.4) * qual * (P.diesel ? 1 : 1.2);
      const heat = c.kE * 4.75 * PAMB * s.Vd * .6;
      s.heatAcc += heat; s.heatAccW += heat;
      s.lastFire = s.t;
      if (s.firstFire === null && !s.hold) { s.firstFire = s.t; log(s, `Erste Zündung in Zylinder ${c.idx + 1} bei ${Math.round(s.rpm)} U/min (Kompressionsend­temperatur ${Math.round(c.TendEff - 273)} °C)`); }
      s.smoke.white += (1 - qual) * .6 * s.q;
      if (P.diesel && s.q > s.qMax * .98 && s.limpBlack) s.smoke.black += .2;
      s.events.push({ type: 'fire', cyl: c.idx, str: clamp(c.kE / P.kmax, .15, 1), knock: knock * clamp(s.q * 1.5, .3, 1), t: s.t });
    } else if (injected) {
      c.state = 'misfire'; c.mis = c.mis * .85 + .15;
      s.smoke.white += .5 * Math.max(s.q, .3);
      s.events.push({ type: 'misfire', cyl: c.idx, t: s.t });
    } else { c.state = 'comp'; c.mis *= .9; }
    c.lastEvt = s.t;
  }

  /* --------- Batterie --------- */
  function battR(s) {
    const cold = 1 + .02 * Math.max(0, 25 - s.Tbat);
    const soh = 1 / clamp(s.cfg.soh, .1, 1);
    const socF = 1 + 1.2 * Math.pow(1 - s.soc, 2);
    let R = s.P.rb12 * s.k12 * cold * soh * socF;
    if (F(s).cell) R *= 1.35;
    if (s.frozen) R *= 18;
    return R;
  }
  function OCV(s) {
    let v = s.k12 * (11.85 + .85 * clamp(s.soc, 0, 1));
    if (F(s).cell) v -= 2.1;
    if (s.frozen) v *= .92;
    return v;
  }

  /* --------- Hauptschritt (Mechanik, dt ≈ 0,4 ms) --------- */
  function step(s, dt) {
    const P = s.P, f = F(s), cfg = s.cfg;
    s.t += dt;
    const nomV = 12 * s.k12;
    if (s.ecuReset > 0) s.ecuReset -= dt;
    // ---- Vorglühen / Ansaugluftheizung
    const Ts = sensorT(s);
    if (s.preheat > 0 && s.ign) s.preheat -= dt;
    const cranking = s.starterEng;
    let glowWant = false;
    if (P.diesel && s.ign && !f.glowRelay) {
      if (s.preheat > 0) glowWant = true;
      else if (cranking && Ts < 60) glowWant = true;
      else if (s.afterglow > 0 && s.rpm < 2500) { glowWant = true; s.afterglow -= dt; }
    }
    s.glowOn = glowWant;
    let Iglow = 0;
    const Vsup = Math.max(0, s.Vt);
    if (P.pre === 'plug') {
      for (const c of s.cylS) {
        if (glowWant && !f.cyl.plug[c.idx]) {
          const R = s.R20 * (1 + .0025 * (c.Tg - 20));
          const I = Vsup * (s.afterglow > 0 && !cranking && s.preheat <= 0 ? .85 : 1) / R;
          Iglow += I;
          c.Tg += (I * I * R - s.glowH * (c.Tg - c.Tw) * (1 + s.rpm / 400)) / 2.2 * dt;
        } else c.Tg += (c.Tw - c.Tg) * dt / 6;
      }
    } else if (P.pre === 'grid') {
      const Tair = cfg.ambient;
      const mdot = 1.29 * 273 / (Tair + 273) * s.Vd * s.n * s.rpm / 120;
      const hA = 3.5 * Math.sqrt(1 + s.rpm / 150);
      let Pel = 0;
      if (glowWant && !f.grid) { const R = P.sysV * P.sysV / P.gridW * (1 + .0006 * (s.Tgrid - 20)); const I = Vsup / R; Iglow = I; Pel = I * I * R; }
      const Qair = hA * (s.Tgrid - Tair);
      s.Tgrid += (Pel - Qair - 1.2 * (s.Tgrid - Tair)) / 180 * dt;
      const target = s.rpm > 15 ? clamp(Qair / (mdot * 1005 + 4), 0, 120) : clamp((s.Tgrid - Tair) * .3, 0, 150);
      s.dTin += (target - s.dTin) * Math.min(1, dt / (s.rpm > 15 ? .25 : 3));
      for (const c of s.cylS) c.Tg = c.Tw;
    } else for (const c of s.cylS) c.Tg = c.Tw;
    s.Iglow = Iglow;
    // ---- Verbraucher
    let Iacc = 0;
    if (s.ign) {
      Iacc += P.ecuA;
      if (cfg.acc.light) Iacc += P.acc.light;
      if (cfg.acc.blower) Iacc += P.acc.blower;
      if (cfg.acc.rear) Iacc += P.acc.rear;
      if (cfg.acc.fuelHeat && P.diesel) Iacc += P.fuelHeatA;
      if (s.fanOn) Iacc += P.sysV === 24 ? 0 : 18;
    }
    Iacc += Iglow;
    s.Iacc = Iacc;
    // ---- Anlasser / Magnetschalter
    const Rb = battR(s), Rc = P.rcable + (f.ground ? .004 : 0);
    const ocv = OCV(s) - s.Vp;
    if (s.solOff > 0) s.solOff -= dt;
    if (s.cutout && s.Tst < 90) { s.cutout = false; log(s, 'Anlasser abgekühlt · Thermoschutz wieder frei'); }
    let want = s.startReq && s.ign && !s.cutout && cfg.starterCond > .02;
    if (want && !s.starterEng && !P.carb && s.gear !== 0 && s.clutchPos > .3) {
      want = false;
      if (s.t - s.lockWarn > 3) { s.lockWarn = s.t; log(s, 'Startsperre · Gang eingelegt. Kupplung treten oder Leerlauf einlegen.', 'warn'); }
    }
    if (want && !s.starterEng && s.solOff <= 0) {
      if (ocv - Iacc * Rb > .55 * nomV) {
        s.starterEng = true; s.events.push({ type: 'solenoid' });
        if (s.crankStart === null) { s.crankStart = s.t; s.firstFire = null; s.peakI = 0; s.minV = 99; s.attempts++; log(s, 'Anlasser eingespurt'); }
        if (s.running || s.rpm > P.crankRpm) { s.starterGrind = .4; log(s, 'Anlasser bei drehendem Motor betätigt · Zahnkranz kratzt!', 'bad'); }
      } else { s.solOff = .25; s.events.push({ type: 'click' }); }
    }
    if (!want && s.starterEng) {
      s.starterEng = false;
      if (s.crankStart !== null) log(s, `Anlasser gelöst nach ${de(s.t - s.crankStart)} s · Spitze ${Math.round(s.peakI)} A, min. ${de(s.minV)} V`);
      s.crankStart = null;
    }
    let Is = 0, Tst = 0;
    const cond = clamp(cfg.starterCond, .02, 1);
    if (s.starterEng) {
      const Rme = s.Rm * (1 + .6 * (1 - cond));
      const effE = P.st.eff * (.45 + .55 * cond);
      const U = Math.max(.5, ocv - Iacc * Rb), Rt = Rb + Rc + Rme, st = P.st;
      const a = Rt / st.Isat, b = Rt + st.Kf * s.w - U / st.Isat;
      Is = (-b + Math.sqrt(b * b + 4 * a * U)) / (2 * a);
      const phi = st.Kf * Is / (1 + Is / st.Isat), phi0 = st.Kf * st.noload / (1 + st.noload / st.Isat);
      Tst = Math.max(0, phi * Is * effE - phi0 * st.noload);
      s.Tst += (Is * Is * Rme) / P.st.C * dt;
      if (s.Tst > 135 && !s.cutout) { s.cutout = true; s.starterEng = false; s.crankStart = null; log(s, 'Anlasser überhitzt (>135 °C) · Thermoschutz trennt', 'bad'); dtc(s, 'P0615', 'Anlasser-Relais / Überlast'); }
      if (s.Tst > 110) cfg.starterCond = Math.max(.02, cfg.starterCond - dt * .004);
      if (s.starterGrind > 0) { s.starterGrind -= dt; cfg.starterCond = Math.max(.02, cfg.starterCond - dt * .02); }
      s.peakI = Math.max(s.peakI || 0, Is);
      if (s.w < .5 && s.t - s.crankStart > 1.2 && (s.hydro >= 0 || s.seized)) warnOnce(s, 'blocked' + s.attempts, s.hydro >= 0 ? 'Anlasser blockiert hart nach wenigen Grad · Flüssigkeit im Zylinder? (Wasserschlag)' : 'Anlasser blockiert · Motor sitzt fest', 'bad');
    }
    s.Is = Is;
    // ---- Lichtmaschine & Klemmenspannung
    let Vt, Ib;
    const altOK = !f.alt && s.running && s.rpm > P.idle * .6 && !s.frozen;
    const regV = 14.2 * s.k12;
    if (altOK) {
      const Imax = P.altA * clamp(s.rpm / (P.idle * 1.8), .35, 1);
      const tf = clamp(.3 + .025 * (s.Tbat + 10), .15, 1);
      const accept = P.batAh * (.04 + .5 * (1 - s.soc)) * tf * (f.cell ? 2 : 1);
      const spare = Imax - Iacc;
      if (spare >= accept) { Ib = -accept; Vt = regV; s.Ialt = Iacc + accept; }
      else { Ib = -spare; Vt = ocv - Ib * Rb; s.Ialt = Imax; if (Vt > regV) Vt = regV; }
      Ib += Is; Vt -= Is * Rb;
    } else {
      s.Ialt = 0;
      Ib = Iacc + Is;
      if (cfg.acc.charger && !s.running && !s.frozen) Ib -= 10;
      Vt = ocv - Ib * Rb;
    }
    Vt = Math.min(Vt, regV + .1 * s.k12);
    const Rp = P.rb12 * s.k12 * (1 + .02 * Math.max(0, 25 - s.Tbat)) * .9;
    s.Vp += (Ib * Rp - s.Vp) * Math.min(1, dt / 25);
    s.Vp = clamp(s.Vp, -.6 * s.k12, 3 * s.k12);
    if (s.ign && s.running && f.alt) dtc(s, 'P0620', 'Generator-Steuerkreis · keine Ladung');
    s.Vt = Vt; s.Ib = Ib;
    s.Vf += (Vt - s.Vf) * Math.min(1, dt / .05);
    if (s.starterEng) s.minV = Math.min(s.minV ?? 99, Vt);
    if (s.starterEng && s.Vf < .5 * nomV) {
      s.starterEng = false; s.solOff = .14;
      s.events.push({ type: 'click' });
      s.solDrops.push(s.t); s.solDrops = s.solDrops.filter(t => s.t - t < 2);
      if (s.solDrops.length === 3) log(s, 'Magnetschalter klackert · Spannung bricht unter Last zusammen', 'bad');
      if (!P.carb) dtc(s, 'P0562', 'Systemspannung zu niedrig');
    }
    if (!P.carb && s.ign && s.Vf < .5 * nomV) { s.brown += dt; if (s.brown > .05 && s.ecuReset <= 0) { s.ecuReset = 1.3; log(s, `Steuergerät-Reset durch Unterspannung (${de(Vt)} V)`, 'bad'); dtc(s, 'P0562', 'Systemspannung zu niedrig'); } }
    else s.brown = 0;
    // ---- Kraftstoff
    const filterT = s.Tfuel + s.fuelHeat;
    let flow = f.tank ? 0 : 1;
    if (P.diesel) {
      const cf = FUELS[cfg.fuel].cfpp;
      flow *= clamp((filterT - (cf - 5)) / 7, 0, 1);
      if (f.water && filterT < 0) flow *= .3;
      if (f.filter) flow *= .35;
      if (s.air > 0) {
        if (s.rpm > 20) s.air = Math.max(0, s.air - s.rpm / 60 * dt * .012);
        flow *= s.air > .15 ? 0 : (1 - s.air / .15) * (Math.random() < .5 ? 1 : .2);
        if (s.air <= 0) log(s, 'Kraftstoffsystem entlüftet');
      }
      const target = s.ign ? flow * Math.min(1800, Math.max(0, s.rpm - 30) * 2.4) : 0;
      s.rail += (target - s.rail) * dt / .4;
      if (s.crankStart !== null && s.t - s.crankStart > 5 && s.rail < 150 && !cfg.noInject) dtc(s, 'P0087', 'Kraftstoffverteilerrohr · Druck zu niedrig');
      if (f.water && s.ign) dtc(s, 'P2269', 'Wasser im Kraftstoff erkannt');
    } else if (P.carb) {
      if (f.filter) flow *= .5;
      if (s.rpm > 10) s.bowl = Math.min(1, s.bowl + s.rpm / 60 * dt * .02 * flow);
      if (s.running) s.bowl = Math.max(0, s.bowl - dt * .01 * (1 - flow));
      const dThr = cfg.throttle - s.lastThr;
      if (dThr > 0 && s.bowl > .1) s.puddle = Math.min(2.5, s.puddle + dThr * .55);
      s.lastThr = cfg.throttle;
      s.rail = s.bowl;
      flow = clamp(s.bowl / .25, 0, 1);
    } else {
      if (f.pump) flow = 0;
      if (f.filter) flow *= .45;
      const target = s.ign && s.ecuReset <= 0 ? flow * 3.5 : 0;
      s.rail += (target - s.rail) * dt / .6;
      flow *= clamp(s.rail / 2.8, 0, 1);
    }
    s.fuelFlow = flow;
    // ---- Turbolader
    if (P.turbo) {
      const fl = clamp(s.rpm / P.maxRpm, 0, 1.1);
      const bmE = bmEff(s), big = s.T.turboBig;
      let cap = bmE;
      if (f.wastegate) cap *= 1.6;
      if (f.turboHose) cap = .12;
      const bear = f.turboBearing || s.dyn.turboBearing;
      if (bear) cap *= .7;
      const sp = (P.spool || .4) * (big ? 1.35 : 1), fs = Math.pow(clamp(fl / sp, 0, 1), 1.3);
      const target = s.running ? clamp(bmE * (.08 + .92 * fs) * (.12 + 1.1 * Math.min(1, s.q)) * (f.wastegate ? 1.6 : 1), 0, cap) : 0;
      const tau = (.3 + 1.4 * (1 - clamp(fl / sp, 0, 1))) * (bear ? 2.5 : 1) * (big ? 1.6 : 1);
      s.boost += (target - s.boost) * Math.min(1, dt / tau);
      s.turboRpm = s.boost > .005 || s.rpm > 50 ? 15000 + s.boost / (P.boostMax * (big ? 1.35 : 1)) * 145000 * (big ? .85 : 1) + s.rpm * 4 : 0;
      if (s.boost > bmE * 1.2) { if (!s.limp) { s.limp = true; log(s, 'Überladedruck · Steuergerät schaltet ins Notlaufprogramm', 'bad'); } dtc(s, 'P0234', 'Ladedruck zu hoch (Überladung)'); }
      const expect = bmE * (.08 + .92 * fs) * (.12 + 1.1 * Math.min(1, s.q));
      if (s.running && cfg.throttle > .6 && s.rpm > P.maxRpm * .45 && s.boost < expect * .4) { s.boostLowT += dt; if (s.boostLowT > 3) dtc(s, 'P0299', 'Ladedruck zu niedrig'); } else s.boostLowT = 0;
    } else { s.boost = 0; s.turboRpm = 0; }
    // ---- Einspritzmenge / Gemischmenge
    const ecu = s.ign && (P.carb || s.ecuReset <= 0);
    s.qMax = 1;
    s.veNow = ve(s, s.rpm);
    const lim = s.T.limiter || P.maxRpm;
    if (P.diesel) s.smokeLim = (P.turbo ? .38 + .62 * clamp(s.boost / bmEff(s), 0, 1) * Math.min(1.25, bmEff(s) / P.boostMax) : 1) * s.veNow;
    if (!ecu) { s.q = 0; s.mode = s.rpm > 5 ? 'coast' : 'off'; }
    else if (P.carb) {
      const choke = f.chokeCable ? 0 : cfg.choke || 0;
      s.mode = s.running ? 'run' : 'crank';
      const thrC = Math.max(cfg.throttle || 0, (cfg.hand || 0) * .5);
      s.cut = s.cut ? s.rpm > lim + 150 : s.rpm > lim + 300;
      if (s.cut) s.limiterHit = s.t;
      s.q = s.cut ? 0 : clamp(.23 + .77 * thrC + .2 * choke, 0, 1);
    } else if (s.rpm < P.crankRpm && !s.running) { s.mode = 'crank'; s.q = P.startQ; s.qI = .45 * P.startQ; }
    else {
      s.mode = 'run';
      if (P.diesel) s.qMax = clamp(s.smokeLim * s.T.fuel, .1, 1.45);
      if (s.limp) s.qMax = Math.min(s.qMax, .4);
      const idleT = P.idle + Math.max(0, 20 - Ts) * 3.5 + ((CAMS[s.T.cam] || CAMS.serie).idleUp);
      // Handgas = Drehzahlregler (Leerlauf bzw. Arbeitsdrehzahl), Gaspedal = Momentenwunsch
      const target = idleT + (cfg.hand || 0) * (lim - idleT);
      const err = target - s.rpm, gk = P.turbo ? .55 : 1;
      s.qI = clamp(s.qI + P.ki * err * dt * gk, 0, s.qMax);
      const qGov = clamp(s.qI + P.kp * err * gk, 0, s.qMax);
      const thr = cfg.throttle || 0;
      let dem = P.diesel ? thr * s.qMax : (thr > 0 ? (.05 + .95 * (1 - Math.pow(1 - thr, 1.8))) * s.qMax : 0);
      if (P.diesel) dem *= clamp((lim + 30 - s.rpm) / 200, 0, 1); // Abregelkurve des Diesels
      let q = Math.max(qGov, dem);
      if (!P.diesel) { s.cut = s.cut ? s.rpm > lim - 160 : s.rpm > lim; if (s.cut) { q = 0; s.limiterHit = s.t; } } // Benziner: harter Begrenzer
      else { if (s.rpm > lim + 80) q = 0; if (thr > .5 && s.rpm > lim - 40) s.limiterHit = s.t; }
      s.q = q;
    }
    // Abwürgen: eingekuppelt unter ca. 45 % der Leerlaufdrehzahl ruckelt der Motor und geht aus
    if (s.running && s.gear !== 0 && s.clutchPos > .6 && s.rpm < P.idle * .5) s.lugT += dt; else s.lugT = Math.max(0, s.lugT - dt * .5);
    if (s.lugT > .35 && !s.stalled) { s.stalled = true; log(s, `Motor abgewürgt · ${s.gear > 0 ? s.gear + '. Gang' : 'Rückwärtsgang'} bei ${Math.round(s.rpm)} U/min eingekuppelt`, 'bad'); }
    if (s.stalled) { s.q = 0; if (s.rpm < 20 || s.starterEng || s.clutchPos < .3) s.stalled = false; }
    // ---- Reibung, Last & Öldruck
    const shift = OILS[cfg.oil] ?? 0;
    const vf = Math.pow(viscFactor(s.To, shift), .35);
    const vg = Math.pow(viscFactor(s.Tb * .7 + cfg.ambient * .3, -5), .35);
    const fm = P.fmep;
    const fmep = fm.s * Math.sqrt(vf) + fm.v * vf * .3 + .6 * (s.rpm / 1000) * Math.pow(vf, .7);
    let Tf = 1e5 * s.Vd * s.n / (4 * Math.PI) * fmep * (1 + Math.max(0, s.wear - 30) * .02);
    const clPressed = cfg.clutchHeld || (cfg.clutch && (s.startReq || s.starterEng || (s.running && s.t - s.runSince < 6)));
    s.clutchPos = clPressed ? Math.max(0, s.clutchPos - dt * 10) : Math.min(1, s.clutchPos + dt * (s.clutchPos < .25 ? 4 : 1.4));
    if (s.clutchPos > .5) Tf += P.gear * (s.starterEng ? vg : .2 * (vg - 1)) * (.6 + s.rpm / 1500); // Getriebeöl: beim Anlassen voll, im Lauf geringer (Schleppmoment)
    if (!P.diesel && s.running && !s.hold && s.q < .1) Tf += 1e5 * s.Vd * s.n / (4 * Math.PI) * .6 * (1 - s.q / .1) * Math.min(1, s.rpm / 2500); // Schub: Drosselklappe zu
    Tf += Math.min(s.Ialt * Vt / .55 / Math.max(s.w, 30), 80 * s.k12);
    s.Tload = s.running && !s.hold ? (cfg.load || 0) * P.Tmax * Math.pow(s.rpm / (P.maxRpm * .75), 2) : 0;
    Tf += s.Tload;
    if (s.seized) Tf = 1e5;
    s.Tf = Tf; s.frictionNm = Tf - s.Tload;
    const pumpC = f.oilPump ? .38 : 1;
    if (s.rpm > 5) s.oilFill = Math.min(1, s.oilFill + dt * s.rpm / 240 / Math.sqrt(vf) * pumpC);
    const L = s.oilLevel;
    const lf = L > .45 ? 1 : L > .18 ? (L - .18) / .27 * (.55 + .45 * Math.random()) : .04;
    s.oilP = s.oilFill * Math.min(P.relief, s.rpm / 1000 * P.oilK * Math.pow(vf, .6) * pumpC) * lf;
    // ---- Gasmomente & Kompressionsmessung
    const cdeg = s.theta * 180 / Math.PI;
    let Tg = 0;
    const cm = s.comp;
    for (const c of s.cylS) {
      const phi = ((cdeg - c.pos * 720 / s.n) % 720 + 720) % 720;
      c.prevPhi = c.phi; c.phi = phi;
      if (s.w > 0 && c.prevPhi > 600 && phi < 120) {
        if (c.idx === 0) { if (s.pvCur.length > 20) { s.pvDone = s.pvCur; s.pvVer++; } s.pvCur = []; s.pvBin = -1; }
        if (s.starterEng && c.pmax > 0 && s.crankStart !== null && s.t - s.crankStart > .6) { const h = cm.hist[c.idx]; h.push((c.pmax - PAMB) * (.97 + .06 * Math.random())); if (h.length > 12) h.shift(); }
        tdc(s, c);
      }
      if (c.prevPhi < 540 && phi >= 540 && phi < 600) { cylParams(s, c); c.pmax = 0; }
      if (c.psi === undefined || s.rpm < 60) cylParams(s, c);
      const k = kin(s, phi);
      const p = cylPressure(s, c, phi, k.V);
      if ((phi >= 540 || phi < 180) && p < 200e5) c.pmax = Math.max(c.pmax, p);
      if (phi > 180 && phi < 200) c.pmaxShow = c.pmax;
      Tg += (p - PAMB) * k.dV;
      if (c.idx === 0 && s.rpm > 30) { const bin = Math.floor(phi / 4); if (bin !== s.pvBin) { s.pvBin = bin; if (s.pvCur.length < 200) s.pvCur.push([+(k.V / s.Vbdc).toFixed(4), +(Math.min(p, 300e5) / 1e5).toFixed(2), Math.round(phi)]); } }
      if (c.burn > 0) c.burn = Math.max(0, c.burn - dt * (2 + s.rpm / 120));
    }
    s.scopeT += dt;
    if (s.scopeT >= .002) { s.scopeT = 0; if (s.starterEng || s.scope.length) { s.scope.push(s.starterEng ? Math.round(Is) : 0); if (s.scope.length > 1500) s.scope.shift(); } }
    // ---- Bewegungsgleichung
    s.Tind = Tg;
    const drive = Tst + Tg, wPrev = s.w;
    const Tc = drivetrain(s, cfg, drive - Tf, dt);
    const net = drive - Tf - Tc;
    if (s.w <= 1e-4 && net <= 0) s.w = 0;
    else s.w = Math.max(0, s.w + net / P.J * dt);
    s.powerKW += ((s.Tload + Tc) * s.w / 1000 - s.powerKW) * Math.min(1, dt / .25);
    if (s.hydro >= 0 && s.w === 0 && wPrev * 30 / Math.PI > 150 && s.dyn.bentRod == null) { s.dyn.bentRod = s.hydro; log(s, `Wasserschlag mit Schwung · Pleuel in Zylinder ${s.hydro + 1} verbogen`, 'bad'); }
    if (s.hold) s.w = s.hold;
    s.theta += s.w * dt;
    if (s.theta > 4 * Math.PI * 1000) s.theta -= 4 * Math.PI * 1000;
    s.rpm = s.w * 30 / Math.PI;
    // ---- Laufzustand
    const sinceFire = s.t - s.lastFire;
    s.qOnT = s.q > .02 ? s.qOnT + dt : 0;
    const wasRun = s.running;
    if (!s.running) s.running = ecu && s.rpm > P.crankRpm * .8 && sinceFire < .3;
    else if (!ecu || s.rpm < P.crankRpm * .35 || (sinceFire > .8 && (s.qOnT > .5 || s.rpm < P.idle * .55))) s.running = false; // Schubabschaltung zählt nicht als Absterben
    if (s.running && !wasRun) {
      log(s, `Motor springt an · ${Math.round(s.rpm)} U/min`, 'good'); if (s.starterEng || s.startReq) s.runSince = s.t;
      if (P.diesel && Ts < 30) s.afterglow = Math.min(P.pre === 'grid' ? 90 : 180, (30 - Ts) * 4);
    }
    if (!s.running && wasRun) { log(s, s.ign ? `Motor ausgegangen bei ${Math.round(s.rpm)} U/min` : 'Motor steht', s.ign ? 'bad' : 'info'); s.limp = false; }
    if (s.rpm < 5) for (const c of s.cylS) c.state = 'stopped';
    if (s.rpm > P.mechMax && !s.hold) {
      s.floatT += dt; warnOnce(s, 'float', 'Überdrehzahl · Ventile schließen nicht mehr sauber (Ventilflattern)', 'bad');
      if (s.floatT > .25 && s.rpm > P.mechMax * 1.04 && s.dyn.bentValve == null) { s.dyn.bentValve = Math.floor(Math.random() * s.n); log(s, `Ventil hat den Kolben berührt · Zylinder ${s.dyn.bentValve + 1}: Ventil verbogen`, 'bad'); }
    } else s.floatT = 0;
  }

  /* --------- Antriebsstrang: Kupplung, Getriebe, Fahrzeug --------- */
  function gearRatio(s) { const V = s.P.veh; return s.gear > 0 ? V.g[s.gear - 1] * V.fd : s.gear < 0 ? -V.rev * V.fd : 0; }
  function drivetrain(s, cfg, Te, dt) {
    const P = s.P, V = P.veh, g = 9.81, iT = gearRatio(s);
    const brake = (cfg.brake || 0) * V.m * g * .85, Froll = V.crr * V.m * g;
    const moving = Math.abs(s.v) > .03, sgn = moving ? Math.sign(s.v) : 0;
    const Faero = .6 * V.cda * s.v * Math.abs(s.v);
    let Tc = 0, held = false;
    if (iT && s.clutchPos > .25 && !s.hold) {
      const cap = 1.6 * P.Tmax * Math.pow(clamp((s.clutchPos - .25) / .75, 0, 1), 1.5);
      const k = iT / V.r, Jv = V.m / (k * k), slip = s.w - s.v * k;
      const Tres = (sgn * (Froll + brake) + Faero) / k;
      Tc = clamp((slip / dt + Te / P.J + Tres / Jv) / (1 / P.J + 1 / Jv), -cap, cap);
      if (!moving && Math.abs(Tc * k) <= Froll + brake) { Tc = clamp(P.J * slip / dt + Te, -cap, cap); held = Math.abs(Tc * k) <= Froll + brake; }
      s.slip = slip;
      if (Math.abs(slip) > 3) {
        s.clHeat += Math.abs(Tc * slip) * dt;
        const h1 = 120e3 * Math.sqrt(P.Tmax / 300);
        if (s.clHeat > h1) warnOnce(s, 'clutch', 'Kupplung rutscht lange · es riecht verbrannt', 'warn');
        else if (s.clHeat < h1 * .4) s.warned.clutch = false;
      }
      if (held) s.v = 0;
      else {
        const F = Tc * k - sgn * (Froll + brake) - Faero, v0 = s.v;
        s.v += F / V.m * dt;
        if (moving && Math.sign(s.v) !== Math.sign(v0) && Math.abs(Tc * k) < Froll + brake) s.v = 0;
      }
    } else {
      s.slip = 0;
      if (moving) { const v0 = s.v; s.v -= (sgn * (Froll + brake) + Faero) / V.m * dt; if (Math.sign(s.v) !== Math.sign(v0)) s.v = 0; }
      else s.v = 0;
      held = !moving;
    }
    s.clHeat *= Math.exp(-dt / 60);
    s.vHeld = held; s.Tc = Tc;
    return Tc;
  }
  function shift(s, dir) {
    const V = s.P.veh, from = s.gear, to = clamp(from + dir, -1, V.g.length);
    if (to === from) return;
    const kmh = s.v * 3.6, pressed = s.clutchPos < .3 || !!s.cfg.clutchHeld;
    const grind = msg => { s.events.push({ type: 'grind' }); log(s, msg, 'bad'); s.gear = 0; };
    if (to === 0) { s.gear = 0; return; }
    if (to === -1 && kmh > 1) return grind('Rückwärtsgang bei rollendem Fahrzeug · Getriebe kracht');
    if (to > 0 && kmh < -2) return grind('Vorwärtsgang beim Rückwärtsrollen · Getriebe kracht');
    if (!pressed && (s.rpm > 30 || Math.abs(kmh) > 1.5)) return grind(`Gang kracht · zum Schalten Kupplung treten`);
    s.gear = to;
    if (to > 0) {
      const rpmNew = s.v / V.r * gearRatio(s) * 30 / Math.PI;
      if (rpmNew > s.P.mechMax) log(s, `Achtung: ${to}. Gang bei ${Math.round(kmh)} km/h ergibt ${Math.round(rpmNew)} U/min · Überdrehzahl beim Einkuppeln`, 'warn');
    }
  }

  /* --------- Thermik, Kühlung, Öl, Batterie, Verschleiß (pro Frame, mit Zeitraffer) --------- */
  function thermal(s, dtR, scale) {
    const P = s.P, cfg = s.cfg, f = F(s), Ta = cfg.ambient;
    const sc = s.starterEng ? 1 : scale, dt = dtR * sc;
    s.clock += dt;
    s.heatW += (s.heatAccW / Math.max(dtR, 1e-3) - s.heatW) * Math.min(1, dtR / 1.5); s.heatAccW = 0;
    // Kühlkreislauf
    s.T = tune(s);
    s.thermo = f.thermostat ? 1 : clamp((s.Tb - 83) / 12, 0, 1);
    s.circ = s.running ? (f.waterPump ? .08 : 1) * clamp(Math.sqrt(s.rpm / P.idle), .6, 2) : 0;
    s.flowRad = s.circ * s.thermo; s.flowBy = s.circ * (1 - s.thermo); s.flowHeat = s.circ > 0 ? .3 * Math.min(1, s.circ) : 0;
    if (s.ign && !f.fan && (s.Tb > 98 || (s.fanOn && s.Tb > 92))) s.fanOn = true; else s.fanOn = false;
    const lvlF = clamp(s.coolLevel / .6, 0, 1);
    let Q = s.heatAcc * sc; s.heatAcc = 0;
    if (cfg.acc.heater) Q += P.heaterW * dt;
    let h = P.hLoss * (s.running ? 1.6 : 1);
    h += P.hLoss * 45 * (s.T.radiator ? 1.4 : 1) * s.thermo * Math.min(1, s.circ) * (s.fanOn ? 1 : .1) * lvlF;
    if (cfg.acc.blower && s.circ > 0) Q -= 2500 * (P.sysV === 24 ? 2 : 1) * clamp((s.Tb - Ta) / 80, 0, 1.5) * Math.min(1, s.circ) * dt;
    Q -= h * (s.Tb - Ta) * dt;
    s.Tb += Q / (P.Cblock * (.75 + .25 * lvlF));
    const hHead = P.Cblock / 70 * (.12 + .88 * clamp(s.coolLevel / .5, 0, 1)) * (.3 + .7 * Math.min(1, s.circ + (s.running ? 0 : 1)));
    const headTarget = s.Tb + (s.running ? s.heatW / hHead : 0);
    s.Thead += (headTarget - s.Thead) * Math.min(1, dt / 25);
    // Abgastemperatur, Klopfregelung, Überladung
    s.rich = P.diesel ? s.q / Math.max(.05, s.smokeLim) : 1;
    const exTarget = s.running ? (P.diesel ? 180 + 480 * clamp(s.q, 0, 1.4) * (.55 + .45 * s.rpm / P.maxRpm) + Math.max(0, s.rich - 1) * 450 - s.T.timing * 9
      : 250 + 560 * Math.min(1, s.q) * (.5 + .5 * s.rpm / P.maxRpm) - (s.T.timing - s.knockRetard) * 7 + Math.max(0, 1 - s.T.fuel) * 350) : Ta + (s.egt - Ta) * .995;
    s.egt += (exTarget - s.egt) * Math.min(1, dtR / 2.5);
    const egtWarn = P.diesel ? 760 : 960, egtDmg = P.diesel ? 830 : 1030;
    if (s.egt > egtWarn) warnOnce(s, 'egt' + Math.round(s.clock / 600), `Abgastemperatur ${Math.round(s.egt)} °C · zu heiß`, 'warn');
    if (s.egt > egtDmg) { s.egtT += dtR; if (s.egtT > 8) { s.egtT = 0; if (P.turbo && !s.dyn.turboBearing) { s.dyn.turboBearing = true; log(s, 'Abgastemperatur zu hoch · Turbinenrad und Lager beschädigt', 'bad'); } else if (s.dyn.burntPiston == null) { s.dyn.burntPiston = Math.floor(Math.random() * s.n); log(s, `Abgastemperatur zu hoch · Kolben in Zylinder ${s.dyn.burntPiston + 1} durchgebrannt`, 'bad'); } } } else s.egtT = Math.max(0, s.egtT - dtR);
    s.knockRetard = Math.max(0, s.knockRetard - dtR * .6);
    if (P.turbo && s.boost > P.boostMax * 1.55 * (s.T.turboBig ? 1.45 : 1)) { s.overT += dtR; warnOnce(s, 'tover', 'Turbolader läuft über der Höchstdrehzahl', 'bad'); if (s.overT > 6 && !s.dyn.turboBearing) { s.dyn.turboBearing = true; log(s, 'Turbolader überdreht · Lagerschaden', 'bad'); } } else s.overT = Math.max(0, s.overT - dtR);
    // Kühlmitteldruck & Verluste
    let pTarget = clamp((s.Tb - 20) / 100, 0, 1) * 1.0 * clamp(s.coolLevel * 1.2, 0, 1);
    if (gasket(s) && s.running) pTarget += .35 + .5 * (cfg.load || 0) + .3 * s.q;
    s.coolPress += (pTarget - s.coolPress) * Math.min(1, dt / 20);
    let loss = 0;
    if (f.coolLeak) loss += .0003 + .0025 * clamp((s.Tb - 50) / 40, 0, 1) * clamp(s.coolPress, .2, 1.5);
    if (s.coolPress > 1.4) loss += .0015 * (s.coolPress - 1.4) * 4;
    if (gasket(s) && s.running) loss += .00035;
    s.boiling = s.Tb > 124 || (s.Thead > 135 && s.coolLevel < .5 && s.running);
    if (s.boiling) { loss += .0015; warnOnce(s, 'boil', 'Kühlmittel kocht · Dampf aus dem Ausgleichsbehälter', 'bad'); }
    s.coolLevel = Math.max(0, s.coolLevel - loss * dt);
    if (s.coolLevel < .35) warnOnce(s, 'cool35', 'Kühlmittelstand unter Minimum', 'warn');
    if (s.Tb > 112) dtc(s, 'P0217', 'Motor-Übertemperatur');
    if (s.Thead > 150 && s.running) { s.overheatT += dt; if (s.overheatT > 20 && !gasket(s)) { s.dyn.headGasket = true; log(s, 'Zylinderkopf überhitzt · Zylinderkopfdichtung durchgebrannt', 'bad'); } } else s.overheatT = Math.max(0, s.overheatT - dt);
    if (s.Thead > 190 && s.running && !s.seized) { s.seized = true; s.seizeWhy = 'Kolbenfresser'; s.w = 0; log(s, 'Kolbenfresser durch Überhitzung · Motor sitzt fest', 'bad'); }
    // Wasserschlag-Gefahr bei defekter Kopfdichtung
    if (gasket(s) && s.rpm < 5 && s.coolLevel > .2 && s.hydro < 0) { s.seep += dt; if (s.seep > 2400) { s.hydro = GASKET[1]; s.seep = 0; } }
    if (s.running) s.seep = 0;
    if (gasket(s) && s.running) s.milky = Math.min(1, s.milky + dt * .0002);
    // Öl
    s.To += ((Math.max(s.Tb, s.Thead - 15) + (s.running ? 4 : 0)) - s.To) * Math.min(1, dt / (s.running ? 420 : 2400));
    let oilLoss = 0;
    if (f.oilLeak) oilLoss += s.running ? .0007 * (.5 + s.oilP / 4) : .00003;
    const nR = f.cyl.rings.filter(Boolean).length;
    if (s.running) oilLoss += nR * .00006 * (s.rpm / 1000) * (1 + (cfg.load || 0) * 2);
    const bear = f.turboBearing || s.dyn.turboBearing;
    if (bear && s.running) { oilLoss += .00012 * (1 + s.boost); s.smoke.blue += .02 * dtR * 60 * (1 + s.boost); }
    s.oilLevel = Math.max(0, s.oilLevel - oilLoss * dt);
    s.crankcase = s.running ? (8 + nR * 35 + (gasket(s) ? 10 : 0)) * (s.rpm / P.idle) * (1 + (cfg.load || 0)) : 0;
    if (s.oilLevel < .4) warnOnce(s, 'oil40', 'Ölstand unter Minimum', 'warn');
    // Zylinderwände & Kleinkram
    for (const c of s.cylS) {
      const tgt = s.running ? s.Thead - 10 : s.Tb;
      c.Tw += (tgt - c.Tw) * Math.min(1, dt / (s.rpm < 5 ? 90 : 22));
      c.Tir += (c.Tw - c.Tir) * Math.min(1, dt / 12);
      if (!P.diesel && c.wet > 0) c.wet = Math.max(0, c.wet - dt * (.002 + (s.rpm > 30 && cfg.throttle > .9 ? .02 * s.rpm / 200 : 0) + Math.max(0, s.Tb) * .0002));
    }
    if (P.pre === 'grid' && !s.glowOn && s.rpm < 5) { s.Tgrid += (Ta - s.Tgrid) * Math.min(1, dt / 60); s.dTin += (0 - s.dTin) * Math.min(1, dt / 60); }
    s.Tst += (Ta - s.Tst) * Math.min(1, dt / 900);
    s.Tbat += ((s.running ? Ta + (s.Tb - Ta) * .3 : Ta) - s.Tbat) * Math.min(1, dt / 10800);
    s.Tfuel += ((s.running && P.diesel ? Ta + (s.Tb - Ta) * .25 : Ta) - s.Tfuel) * Math.min(1, dt / 3600);
    s.fuelHeat += ((cfg.acc.fuelHeat && s.ign && P.diesel ? 18 : 0) - s.fuelHeat) * Math.min(1, dt / 40);
    if (s.rpm < 5) { s.oilFill = Math.max(0, s.oilFill - dt / 2400 * s.oilFill - dt * .00002); s.puddle = Math.max(0, s.puddle - dt * .01); }
    // Batterie
    const capAs = P.batAh * clamp(cfg.soh, .1, 1) * 3600 * (f.cell ? .8 : 1);
    s.soc = clamp(s.soc - s.Ib * (s.starterEng ? dtR : dt) / capAs, 0, 1);
    if (!s.starterEng && scale > 1) s.Vp *= Math.exp(-dt / 25);
    const fz = freezeT(s.soc);
    if (!s.frozen && s.Tbat < fz) { s.frozen = true; log(s, `Batterie eingefroren! Gefrierpunkt bei ${Math.round(s.soc * 100)} % Ladung: ${Math.round(fz)} °C. Nicht laden, erst auftauen.`, 'bad'); }
    if (s.frozen && s.Tbat > fz + 4) { s.frozen = false; log(s, 'Batterie aufgetaut · Kapazität eingeschränkt'); cfg.soh = Math.max(.2, cfg.soh - .15); }
    for (const k of ['white', 'black', 'blue', 'sweet']) s.smoke[k] *= Math.exp(-dtR * 1.5);
    // Verschleiß
    if (s.running) {
      s.runClock += dt;
      if (s.oilP < .6) {
        s.lowOilT += dtR;
        if (s.lowOilT > 2) { s.wear += dt * .03 * (s.rpm / 1000 + .3); warnOnce(s, 'oilp', 'Motor läuft ohne Öldruck · Lagerschaden droht!'); }
        if (s.lowOilT > 3) dtc(s, 'P0524', 'Motoröldruck zu niedrig');
      } else s.lowOilT = 0;
      if (s.To < 15 && s.rpm > P.maxRpm * .55) { s.wear += dt * .004 * (s.rpm / P.maxRpm); warnOnce(s, 'coldrev', 'Hohe Drehzahl mit kaltem Öl · erhöhter Verschleiß', 'warn'); }
      if (s.To < 20 && P.turbo && s.boost > P.boostMax * .7 && s.oilP < 1.5 && !s.dyn.turboBearing) { s.turboAbuse = (s.turboAbuse || 0) + dt; if (s.turboAbuse > 240) { s.dyn.turboBearing = true; log(s, 'Turbolader-Lager trocken gelaufen · Lagerschaden', 'bad'); } }
      if (f.thermostat && s.runClock > 900 && s.Tb < 65) dtc(s, 'P0128', 'Kühlmitteltemperatur unter Thermostat-Sollwert');
    }
    if (s.starterEng && s.oilFill < .1) s.wear += dtR * .0008;
    s.wear = Math.min(100, s.wear);
    if (s.wear >= 100 && !s.seized) { s.seized = true; s.seizeWhy = 'Lagerschaden'; s.w = 0; log(s, 'Pleuellager gefressen · Motor sitzt fest', 'bad'); }
    else if (s.wear > 60) warnOnce(s, 'wear60', 'Motor klopft · Pleuellager stark verschlissen');
    // Codes
    if (s.running) {
      let multi = 0;
      for (const c of s.cylS) if (c.mis > .5) { multi++; if (!P.carb) dtc(s, 'P030' + (c.idx + 1), `Zylinder ${c.idx + 1} · Verbrennungsaussetzer erkannt`); }
      if (multi > 1 && !P.carb) dtc(s, 'P0300', 'Mehrere Zylinder · Verbrennungsaussetzer');
    }
    if (P.pre === 'plug' && s.glowOn) for (const c of s.cylS) if (f.cyl.plug[c.idx]) dtc(s, 'P067' + (c.idx + 1), `Glühkerze Zylinder ${c.idx + 1} · Stromkreis offen`);
    if (P.pre === 'grid' && s.glowOn && f.grid) dtc(s, 'P0541', 'Ansaugluftheizung · Stromkreis offen');
    if (P.efi && s.ign && s.rpm > 50) for (const c of s.cylS) if (c.wet > .75) dtc(s, 'P030' + (c.idx + 1), `Zylinder ${c.idx + 1} · Aussetzer (Zündkerze nass)`);
  }

  function dyno(cfg) {
    const c2 = JSON.parse(JSON.stringify(cfg));
    Object.assign(c2, { throttle: 1, load: 0, clutch: true, noInject: false, ambient: 20, soc: 1, choke: 0 });
    const s = create(c2); s.T = tune(s);
    coolTo(s, 20); s.hydro = -1;
    Object.assign(s, { Tb: 90, To: 95, Thead: 105, oilFill: 1, coolLevel: 1, oilLevel: 1, ign: true, rail: 1800, bowl: 1, running: true, mode: 'run', lastFire: 0, qI: .6, Vt: 14 * s.k12, Vf: 14 * s.k12, egt: 500 });
    s.cylS.forEach(c => { c.Tw = c.Tir = 160; });
    const P = s.P, lim = s.T.limiter || P.maxRpm, r0 = Math.max(P.idle * 1.5, 1000), pts = [];
    const nP = 14;
    for (let i = 0; i <= nP; i++) {
      const rpm = r0 + (lim - r0) * i / nP;
      s.hold = rpm * Math.PI / 30; s.w = s.hold;
      let t = 0, sum = 0, n = 0, b = 0;
      while (t < 2.4) { step(s, .0004); t += .0004; s.events.length = 0; if (t > 1.8) { sum += s.Tind - s.frictionNm; b += s.boost; n++; } }
      const nm = Math.max(0, sum / n);
      pts.push({ rpm: Math.round(rpm), nm: Math.round(nm), kw: +(nm * rpm * Math.PI / 30 / 1000).toFixed(1), boost: +(b / n).toFixed(2) });
    }
    return pts;
  }
  function coolTo(s, T) {
    s.Tb = s.To = s.Tst = s.Tbat = s.Tfuel = s.Tgrid = s.Thead = T; s.fuelHeat = 0; s.dTin = 0; s.oilFill = 0; s.puddle = 0; s.Vp = 0; s.coolPress = 0; s.boost = 0;
    if (F(s).float) s.bowl = 0;
    for (const c of s.cylS) { c.Tw = c.Tg = c.Tir = T; c.wet = 0; }
    s.frozen = s.Tbat < freezeT(s.soc);
    if (gasket(s) && s.coolLevel > .2) s.hydro = GASKET[1];
  }
  function purge(s) {
    if (s.hydro >= 0) { log(s, `Glühkerzen/Zündkerzen raus und durchgedreht · Kühlmittel aus Zylinder ${s.hydro + 1} geschleudert`, 'warn'); s.hydro = -1; s.coolLevel = Math.max(0, s.coolLevel - .03); }
    else log(s, 'Durchgedreht ohne Kerzen · keine Flüssigkeit in den Zylindern');
  }
  function refill(s, what) {
    if (what === 'cool') { s.coolLevel = 1; log(s, 'Kühlmittel aufgefüllt'); }
    if (what === 'oil') { s.oilLevel = 1; s.milky = 0; log(s, 'Motoröl gewechselt und aufgefüllt'); }
  }

  function exportState(s) {
    return { engine: s.P.key, Tb: s.Tb, To: s.To, Tst: s.Tst, Tbat: s.Tbat, Tfuel: s.Tfuel, Thead: s.Thead, soc: s.soc, oilFill: s.oilFill, wear: s.wear,
      seized: s.seized, seizeWhy: s.seizeWhy, frozen: s.frozen, Tw: s.cylS.map(c => c.Tw), clock: s.clock, dtc: s.dtc, log: s.log.slice(0, 40),
      oilLevel: s.oilLevel, coolLevel: s.coolLevel, milky: s.milky, dyn: s.dyn, hydro: s.hydro };
  }
  function importState(s, o, elapsed) {
    Object.assign(s, { Tb: o.Tb, To: o.To, Tst: o.Tst, Tbat: o.Tbat, Tfuel: o.Tfuel, Thead: o.Thead ?? o.Tb, soc: o.soc, oilFill: o.oilFill || 0, wear: o.wear || 0,
      seized: !!o.seized, seizeWhy: o.seizeWhy || '', frozen: !!o.frozen, clock: o.clock || 0, dtc: o.dtc || {}, log: o.log || [],
      oilLevel: o.oilLevel ?? 1, coolLevel: o.coolLevel ?? 1, milky: o.milky || 0, dyn: o.dyn || {}, hydro: o.hydro ?? -1 });
    s.cylS.forEach((c, i) => { c.Tw = c.Tg = c.Tir = o.Tw ? o.Tw[i] : o.Tb; });
    const P = s.P, cfg = s.cfg, Ta = cfg.ambient, e = Math.max(0, elapsed);
    if (e > 1) {
      const h = P.hLoss, Tss = Ta + (cfg.acc.heater ? P.heaterW / h : 0);
      s.Tb = Tss + (s.Tb - Tss) * Math.exp(-e * h / P.Cblock);
      s.Thead = s.Tb;
      s.To = s.Tb + (s.To - s.Tb) * Math.exp(-e / 2400);
      for (const c of s.cylS) c.Tw = c.Tg = c.Tir = s.Tb;
      s.Tst = Ta + (s.Tst - Ta) * Math.exp(-e / 900);
      s.Tbat = Ta + (s.Tbat - Ta) * Math.exp(-e / 10800);
      s.Tfuel = Ta + (s.Tfuel - Ta) * Math.exp(-e / 3600);
      s.oilFill *= Math.exp(-e / 2400);
      if (cfg.acc.charger) s.soc = Math.min(1, s.soc + 10 * e / 3600 / (P.batAh * cfg.soh));
      if (F(s).oilLeak) s.oilLevel = Math.max(0, s.oilLevel - .00003 * e);
      if (gasket(s) && s.coolLevel > .2 && e > 2400) s.hydro = GASKET[1];
      s.clock += e; s.Tgrid = Ta;
      if (s.Tbat < freezeT(s.soc)) s.frozen = true;
      const m = e / 60;
      log(s, `Motor stand ${m < 90 ? Math.round(m) + ' min' : de(m / 60) + ' h'} · Kühlmittel jetzt ${Math.round(s.Tb)} °C`);
    }
  }

  return { VEH, gearRatio, shift, CAMS, EXH, TUNE_DEF, ve, valveLift, dyno, PRESETS, OILS, FUELS, GROUPS, FAULTS, CYL_FAULTS, GASKET, applies, cylFaultLabel, create, step, thermal, setIgnition, preheatAgain, coolTo, purge, refill,
    kin, viscFactor, freezeT, log, sensorT, coolSensor, battR, OCV, exportState, importState, tIn };
}
const SIM = SIM_FACTORY();
if (typeof module !== 'undefined') module.exports = SIM;
