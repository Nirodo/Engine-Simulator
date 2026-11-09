/* ================= 3D-Motor: echte Kinematik aus Bohrung, Hub, Pleuellänge, Zündfolge und Nockenprofil ================= */
const E3 = { ok: false, failed: false, key: null, thetaV: 0, slow: 20, paused: false, housing: false, thermal: false, flowAir: true, flowCool: true,
  az: -.85, el: .38, zoom: 1, drag: null, pinch: null, hoverT: 0, mouse: null, built: null, lastInfoT: 0 };
const E3_PHASE = [
  { a: 0, b: 180, name: 'Arbeiten', col: 'amber' }, { a: 180, b: 360, name: 'Ausstoßen', col: 'hot' },
  { a: 360, b: 540, name: 'Ansaugen', col: 'cool' }, { a: 540, b: 720, name: 'Verdichten', col: 'ice' }];
const e3Phase = phi => E3_PHASE.find(p => phi >= p.a && phi < p.b) || E3_PHASE[0];

function e3TempColor(T, out) {
  const stops = [[-30, 0x2a4fd8], [10, 0x2fa8e0], [50, 0x37c58a], [85, 0xe6c840], [120, 0xf08a2c], [300, 0xe23b2b], [700, 0xffe6a8]];
  let i = 0; while (i < stops.length - 2 && T > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], k = clamp((T - t0) / (t1 - t0), 0, 1);
  const a = new THREE.Color(c0), b = new THREE.Color(c1);
  return (out || new THREE.Color()).copy(a).lerp(b, k);
}

function e3Init() {
  if (E3.ok) return true;
  if (E3.failed) return false;
  const box = $('e3Box');
  if (typeof THREE === 'undefined') { E3.failed = true; box.classList.add('e3-fail'); $('e3Msg').hidden = false; return false; }
  try {
    const canvas = $('e3');
    const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .82;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c1014);
    scene.environment = e3Env(R);
    const cam = new THREE.PerspectiveCamera(32, 2, 1, 5000);
    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a140e, .25));
    const key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(-300, 500, 400); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8cc8ff, .45); rim.position.set(400, 200, -500); scene.add(rim);
    const fireLight = new THREE.PointLight(0xff8a3a, 0, 120, 2); scene.add(fireLight);
    Object.assign(E3, { ok: true, R, scene, cam, fireLight, ray: new THREE.Raycaster(), M: e3Materials() });
    E3.ray.params.Line = { threshold: .01 }; E3.ray.params.Points = { threshold: .01 };
    e3Controls(canvas);
    new ResizeObserver(() => e3Resize()).observe(box);
    e3Resize();
    return true;
  } catch (err) { E3.failed = true; box.classList.add('e3-fail'); $('e3Msg').hidden = false; $('e3Msg').textContent = '3D-Ansicht nicht verfügbar: WebGL wird von diesem Browser nicht unterstützt.'; return false; }
}
function e3Env(R) {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(100, 32, 16), pos = g.attributes.position, col = [];
  const top = new THREE.Color(0x7d8ea3), mid = new THREE.Color(0x2b3440), bot = new THREE.Color(0x0a0c0f), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 100; if (y > 0) c.copy(mid).lerp(top, y); else c.copy(mid).lerp(bot, -y); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (x, y, z, w, h, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(-40, 70, 40, 60, 30, 6); box(70, 30, -30, 30, 50, 2.5); box(0, 20, -90, 80, 20, 1.2);
  const pm = new THREE.PMREMGenerator(R); const tex = pm.fromScene(s, .02).texture; pm.dispose();
  return tex;
}
function e3Materials() {
  const std = (color, metal, rough, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness: metal, roughness: rough, envMapIntensity: .75 }, extra));
  const glass = (color, op) => new THREE.MeshStandardMaterial({ color, metalness: .1, roughness: .2, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
  return {
    steel: std(0x9aa3ad, .92, .26), forged: std(0x6f7781, .85, .42), dark: std(0x3b4047, .7, .5), iron: std(0x5a6068, .55, .7),
    alu: std(0xc4c9cf, .7, .42), piston: std(0xb9bfc6, .7, .34), ring: std(0x2a2d31, .8, .35), ringBad: std(0xd8402f, .4, .5, { emissive: 0x5a0d05 }),
    crown: std(0x8f8676, .5, .7), bowl: std(0x4a4036, .4, .8), burnt: std(0x1c1410, .2, .95, { emissive: 0x401000 }),
    bronze: std(0xb08a4a, .9, .35), spring: std(0x9fb4c8, .8, .35), chain: std(0x8d949c, .9, .4), belt: std(0x18191b, .1, .85),
    rubber: std(0x222326, .1, .8), copper: std(0xc77b4b, .9, .35), black: std(0x15171a, .3, .6), red: std(0xb7302a, .4, .5),
    exhaust: std(0x6b5a4e, .6, .55, { emissive: 0x000000 }), turbo: std(0x9a9184, .7, .45, { emissive: 0x000000 }),
    oil: new THREE.MeshStandardMaterial({ color: 0x6b4510, metalness: .1, roughness: .12, transparent: true, opacity: .62, depthWrite: false }),
    blockG: glass(0x7f8a96, .1), headG: glass(0x9aa8b6, .1), panG: glass(0x6e7680, .14), caseG: glass(0x7a8590, .08),
    edge: new THREE.LineBasicMaterial({ color: 0x8fa4b8, transparent: true, opacity: .35 }),
    liner: glass(0xaab6c2, .08),
    gas: new THREE.MeshBasicMaterial({ color: 0x5fb8e8, transparent: true, opacity: .2, depthWrite: false }),
    gasket: new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0 }),
    water: new THREE.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: .55, depthWrite: false }),
    spray: new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    glow: e3GlowTex(),
  };
}
function e3GlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(.25, 'rgba(255,190,90,.9)'); gr.addColorStop(.6, 'rgba(255,90,20,.35)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

/* ---------- Geometrie-Helfer ---------- */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function cylX(r, len, mat, seg = 28) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return new THREE.Mesh(g, mat); }
function cylY(rt, rb, h, mat, seg = 32, open = false) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat); }
function pick(m, name, info) { m.userData.part = { name, info }; return m; }
function edged(mesh, M) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), M.edge); e.userData.noPick = true; mesh.add(e); return mesh; }
function camLobeGeo(base, lift, width, halfW) {
  const sh = new THREE.Shape(), N = 64;
  for (let k = 0; k <= N; k++) {
    const ang = k / N * Math.PI * 2, d = Math.atan2(Math.sin(ang), Math.cos(ang));
    const b = Math.abs(d) < halfW ? Math.pow(Math.cos(d / halfW * Math.PI / 2), 2) : 0, R = base + lift * b;
    const x = R * Math.sin(ang), y = R * Math.cos(ang);
    if (k === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -width / 2); g.rotateY(Math.PI / 2); return g;
}
function webGeo(r, rb, Rc, t) {
  const sh = new THREE.Shape();
  sh.moveTo(-rb, r); sh.absarc(0, r, rb, Math.PI, 0, true);
  sh.lineTo(Rc * Math.cos(-.35), Rc * Math.sin(-.35)); sh.absarc(0, 0, Rc, -.35, -Math.PI + .35, true); sh.lineTo(-rb, r);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * .08, bevelSize: t * .08, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -t / 2); g.rotateY(Math.PI / 2); return g;
}
function helixCurve(R, h, turns) {
  const c = new THREE.Curve();
  c.getPoint = (t, o = new THREE.Vector3()) => { const a = t * turns * Math.PI * 2; return o.set(R * Math.cos(a), t * h, R * Math.sin(a)); };
  return c;
}
function hull2(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
/* geschlossene Kette/Riemen um Räder in der YZ-Ebene bei x */
function loopCurve(x, wheels) {
  const pts = [];
  for (const w of wheels) for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; pts.push([w.y + w.r * Math.cos(a), w.z + w.r * Math.sin(a)]); }
  const h = hull2(pts), out = [];
  // gleichmäßig nachrastern, damit gerade Trums gerade bleiben
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]), nS = Math.max(1, Math.ceil(d / 1.2));
    for (let k = 0; k < nS; k++) out.push(V3(x, a[0] + (b[0] - a[0]) * k / nS, a[1] + (b[1] - a[1]) * k / nS));
  }
  return new THREE.CatmullRomCurve3(out, true, 'centripetal', .1);
}

function e3ToW(betaDeg, x, y, z) { const b = betaDeg * Math.PI / 180, cb = Math.cos(b), sb = Math.sin(b); return V3(x, y * cb - z * sb, y * sb + z * cb); }
const crv = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
function sweepGeo(curve, rFn, seg = 48, rad = 14) {
  const fr = curve.computeFrenetFrames(seg, false), Pp = V3(), pos = [], nor = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg; curve.getPointAt(u, Pp); const N = fr.normals[i], Bn = fr.binormals[i], r = rFn(u);
    for (let j = 0; j <= rad; j++) {
      const v = j / rad * Math.PI * 2, s = Math.sin(v), c = -Math.cos(v);
      const nx = c * N.x + s * Bn.x, ny = c * N.y + s * Bn.y, nz = c * N.z + s * Bn.z;
      nor.push(nx, ny, nz); pos.push(Pp.x + r * nx, Pp.y + r * ny, Pp.z + r * nz);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = (rad + 1) * i + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
/* ---------- Aufbau des Motors ---------- */
function e3Build(key) {
  const M = E3.M, P = S.PRESETS[key], n = P.cyl;
  if (E3.built) { E3.scene.remove(E3.built.root); E3.built.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const B = P.bore * 100, Sx = P.stroke * 100, r = Sx / 2, L = P.rod * 100;
  const pitch = B * (P.diesel ? 1.28 : 1.2), pinW = B * .3, webT = B * .13;
  const hp = B * (P.diesel ? .95 : .72), pinUp = hp * (P.diesel ? .55 : .5); // Kolbenhöhe, Bolzen → Boden
  const deck = r + L + pinUp + B * .02;
  const camType = P.cam === 'OHV' ? 'OHV' : P.cam === 'OHC' ? 'OHC' : 'DOHC';
  const nV = camType === 'OHV' ? 1 : 2;
  const layout = P.layout || 'R';
  const bankAng = b => layout === 'V' ? (b ? 45 : -45) : layout === 'B' ? (b ? 90 : -90) : 0;
  const nBank = P.banks.some(b => b) ? 2 : 1;
  const sideIn = b => layout === 'R' ? -1 : (b ? -1 : 1);
  const root = new THREE.Group(); E3.scene.add(root);
  const crank = new THREE.Group(); root.add(crank);
  const deg = Math.PI / 180;
  // Zylinderpositionen
  const slot = [0, 0], cyl = [];
  for (let i = 0; i < n; i++) {
    const b = P.banks[i] || 0, k = slot[b]++;
    cyl.push({ i, b, k, off: P.order.indexOf(i + 1) * 720 / n, beta: bankAng(b) });
  }
  const perBank = [0, 1].map(b => cyl.filter(c => c.b === b).length);
  const bankOff = nBank > 1 ? pinW * 1.1 : 0;
  for (const c of cyl) c.x = (c.k - (perBank[c.b] - 1) / 2) * pitch + (c.b ? bankOff / 2 : -bankOff / 2);
  const xs = cyl.map(c => c.x), minX = Math.min(...xs) - pitch * .55, maxX = Math.max(...xs) + pitch * .55;
  const T = { B, r, L, hp, pinUp, deck, camType, nV, cyl, minX, maxX, P, crank, root, banks: [], valves: [], cams: [], rods: [], pistons: [], gas: [], flames: [], sprays: [], sparks: [] };

  /* Kurbelwelle */
  const jr = B * .25, pr = B * .21;
  const xsU = [...new Set(cyl.map(c => c.x))].sort((a, b) => a - b);
  const jPts = [minX + pitch * .2, ...xsU.slice(1).map((x, i) => (x + xsU[i]) / 2), maxX - pitch * .2];
  const crankInfo = () => `Kurbelwelle · ${fmtK(snap.rpm)} U/min · ${fmt(r * 2 * 10)} mm Hub`;
  for (const jx of jPts) { const j = cylX(jr, webT * 1.6, M.steel); j.position.x = jx; crank.add(pick(j, 'Hauptlager', crankInfo)); }
  const wg = webGeo(r, pr * 1.45, r * 1.25, webT);
  for (const c of cyl) {
    c.alpha = (c.beta - c.off) * deg;
    const pin = cylX(pr, pinW + (nBank > 1 && layout === 'V' ? 0 : 0), M.steel);
    pin.position.set(c.x, r * Math.cos(c.alpha), r * Math.sin(c.alpha)); crank.add(pick(pin, 'Hubzapfen', () => `Hubzapfen Zylinder ${c.i + 1} · Kurbelradius ${fmt(r * 10)} mm`));
    for (const sgn of [-1, 1]) {
      const w = new THREE.Mesh(wg, M.forged); w.position.x = c.x + sgn * (pinW / 2 + webT / 2); w.rotation.x = c.alpha; crank.add(pick(w, 'Kurbelwange mit Gegengewicht', crankInfo));
    }
  }
  const sh = cylX(jr, maxX - minX, M.steel); sh.position.x = (minX + maxX) / 2; sh.scale.set(1, .98, .98); crank.add(pick(sh, 'Kurbelwelle', crankInfo));
  // Schwungrad mit Zahnkranz
  const flyR = r * 2.4 + B * .55, flyX = maxX + B * .45;
  const fly = cylX(flyR, B * .22, M.iron, 64); fly.position.x = flyX; crank.add(pick(fly, 'Schwungrad', () => `Schwungrad · ${fmtK(snap.rpm)} U/min · speichert Drehimpuls zwischen den Zündungen`));
  const nT = Math.round(flyR * 2.2), tooth = new THREE.InstancedMesh(new THREE.BoxGeometry(B * .2, B * .07, B * .06), M.steel, nT), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc1 = V3(1, 1, 1);
  for (let k = 0; k < nT; k++) { const a = k / nT * Math.PI * 2; qq.setFromAxisAngle(V3(1, 0, 0), a); mm.compose(V3(flyX, (flyR + B * .03) * Math.cos(a), (flyR + B * .03) * Math.sin(a)), qq, sc1); tooth.setMatrixAt(k, mm); }
  tooth.userData.noPick = true; crank.add(tooth);
  // Riemenscheibe vorne und Kettenrad
  const frontX = minX - B * .25;
  const cSpr = cylX(r * .55, B * .1, M.dark, 30); cSpr.position.x = frontX - B * .15; crank.add(cSpr);
  const pul = cylX(r * 1.15, B * .2, M.black, 40); pul.position.x = frontX - B * .55; crank.add(pick(pul, 'Riemenscheibe mit Schwingungsdämpfer', crankInfo));
  const snout = cylX(jr * .8, B * .7, M.steel); snout.position.x = frontX - B * .3; crank.add(snout);

  /* Bänke: Block, Kolben, Pleuel, Kopf, Ventiltrieb */
  for (let b = 0; b < nBank; b++) {
    const g = new THREE.Group(); g.rotation.x = bankAng(b) * deg; root.add(g);
    const bc = cyl.filter(c => c.b === b), x0 = Math.min(...bc.map(c => c.x)) - pitch * .55, x1 = Math.max(...bc.map(c => c.x)) + pitch * .55;
    const bank = { g, b, beta: bankAng(b), side: sideIn(b), x0, x1 }; T.banks.push(bank);
    const blkH = deck - r * 1.05, blk = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, blkH, B * 1.42), M.blockG);
    blk.position.set((x0 + x1) / 2, r * 1.05 + blkH / 2, 0); g.add(pick(edged(blk, M), 'Zylinderblock', () => `Zylinderblock · Kühlmittel ${fmt(snap.TbSens)} °C`)); bank.block = blk;
    const headH = B * (camType === 'OHV' ? 1.05 : 1.25);
    const head = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, headH, B * 1.38), M.headG);
    head.position.set((x0 + x1) / 2, deck + headH / 2 + B * .02, 0); g.add(pick(edged(head, M), 'Zylinderkopf', () => `Zylinderkopf · ${fmt(snap.Thead)} °C`)); bank.head = head;
    const vc = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - B * .1, B * .22, B * 1.2), M.caseG);
    vc.position.set((x0 + x1) / 2, deck + headH + B * .13, 0); g.add(edged(vc, M)); bank.cover = vc;
    const gk = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, B * .025, B * 1.4), M.gasket.clone()); gk.position.set((x0 + x1) / 2, deck + B * .012, 0); g.add(pick(gk, 'Zylinderkopfdichtung', () => (st.faults.headGasket || (snap.dyn && snap.dyn.headGasket)) ? 'Zylinderkopfdichtung · DURCHGEBRANNT zwischen Zyl. 2 und 3' : 'Zylinderkopfdichtung · dicht')); bank.gasket = gk;
    for (const c of bc) {
      // Laufbuchse
      const lin = cylY(B / 2 * 1.02, B / 2 * 1.02, Sx + hp + B * .1, M.liner, 40, true); lin.position.set(c.x, deck - (Sx + hp + B * .1) / 2, 0); lin.userData.noPick = true; g.add(lin);
      const lr = new THREE.Mesh(new THREE.TorusGeometry(B / 2 * 1.04, B * .02, 8, 40), M.dark); lr.rotation.x = Math.PI / 2; lr.position.set(c.x, deck, 0); g.add(lr);
      // Kolben
      const pg = new THREE.Group(); g.add(pg);
      const body = cylY(B / 2 * .985, B / 2 * .97, hp, M.piston, 40); body.position.y = hp / 2 - pinUp * 0 - (hp - pinUp); pg.add(pick(body, 'Kolben', () => e3PistonInfo(c)));
      const top = hp - (hp - pinUp); // Bolzen bei y=0, Boden bei y=pinUp
      body.position.y = pinUp - hp / 2;
      const crownM = new THREE.Mesh(new THREE.CircleGeometry(B / 2 * .97, 40), M.crown); crownM.rotation.x = -Math.PI / 2; crownM.position.y = pinUp + .05; pg.add(crownM);
      if (P.diesel) { const bowl = new THREE.Mesh(new THREE.CircleGeometry(B * .3, 32), M.bowl); bowl.rotation.x = -Math.PI / 2; bowl.position.y = pinUp + .1; pg.add(bowl); }
      const rings = [];
      for (let k = 0; k < 3; k++) { const rg = new THREE.Mesh(new THREE.TorusGeometry(B / 2 * .99, B * .012, 6, 40), M.ring); rg.rotation.x = Math.PI / 2; rg.position.y = pinUp - B * (.07 + k * .065); pg.add(pick(rg, 'Kolbenring', () => e3RingInfo(c, k))); rings.push(rg); }
      const burnt = new THREE.Mesh(new THREE.CircleGeometry(B * .16, 20), M.burnt); burnt.rotation.x = -Math.PI / 2; burnt.position.set(B * .12, pinUp + .15, B * .08); burnt.visible = false; pg.add(burnt);
      const ppin = cylX(B * .11, B * .9, M.steel, 16); pg.add(ppin);
      // Pleuel
      const rod = new THREE.Group(); g.add(rod);
      const big = cylX(pr * 1.42, pinW * .92, M.forged, 28); rod.add(pick(big, 'Pleuel', () => `Pleuelstange Zylinder ${c.i + 1} · ${fmt(L * 10)} mm`));
      const capB = new THREE.Mesh(new THREE.BoxGeometry(pinW * .9, pr * .5, pr * 3.4), M.forged); capB.position.y = -pr * 1.2; rod.add(capB);
      const shank = new THREE.Mesh(new THREE.BoxGeometry(pinW * .55, L - pr * 1.6, B * .2), M.forged); shank.position.y = L / 2; rod.add(pick(shank, 'Pleuel', () => `Pleuelstange Zylinder ${c.i + 1} · ${fmt(L * 10)} mm · Stangenverhältnis ${fmt(L / r, 2)}`));
      const small = cylX(B * .16, pinW * .6, M.forged, 20); small.position.y = L; rod.add(small);
      for (const z of [-1, 1]) { const bolt = cylY(B * .025, B * .025, pr * 1.4, M.dark, 8); bolt.position.set(0, -pr * .9, z * pr * 1.25); rod.add(bolt); }
      // Brennraum-Gas
      const gas = cylY(B / 2 * .96, B / 2 * .96, 1, M.gas.clone(), 32); gas.geometry.translate(0, .5, 0); g.add(pick(gas, 'Brennraum', () => e3PistonInfo(c))); gas.userData.noPick = true;
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glow, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); fl.scale.setScalar(B * 1.1); g.add(fl);
      // Zündkerze bzw. Injektor in der Mitte des Brennraums
      const plugLen = headH * .95;
      const tip = new THREE.Group(); tip.position.set(c.x, deck, 0); g.add(tip);
      if (P.diesel) {
        const inj = cylY(B * .05, B * .035, plugLen, M.steel, 12); inj.position.y = plugLen / 2; tip.add(pick(inj, 'Injektor', () => `Injektor Zylinder ${c.i + 1} · Raildruck ${fmtK(snap.rail)} bar`));
        const top2 = cylY(B * .09, B * .09, B * .25, M.dark, 12); top2.position.y = plugLen; tip.add(top2);
        const spray = new THREE.Group(); tip.add(spray);
        for (let k = 0; k < 6; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(B * .05, B * .38, 10, 1, true), M.spray.clone()); cn.geometry.translate(0, -B * .19, 0); cn.rotation.y = k / 6 * Math.PI * 2; const pv = new THREE.Group(); pv.rotation.y = k / 6 * Math.PI * 2; cn.rotation.set(0, 0, 1.15); pv.add(cn); spray.add(pv); }
        T.sprays.push(spray);
      } else {
        const ins = cylY(B * .06, B * .06, plugLen * .55, new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: .3 }), 12); ins.position.y = plugLen * .7; tip.add(pick(ins, 'Zündkerze', () => `Zündkerze Zylinder ${c.i + 1} · ${c.i < (st.faults.cyl.plug || []).length && st.faults.cyl.plug[c.i] ? 'DEFEKT' : 'in Ordnung'}`));
        const hex = cylY(B * .08, B * .08, B * .12, M.steel, 6); hex.position.y = plugLen * .38; tip.add(hex);
        const thr = cylY(B * .045, B * .045, plugLen * .32, M.steel, 10); thr.position.y = plugLen * .16; tip.add(thr);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glow, color: 0x9fd8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); sp.scale.setScalar(B * .35); sp.position.y = -B * .02; tip.add(sp); T.sparks.push(sp);
      }
      T.pistons.push({ c, pg, rings, burnt, rod, gas, fl, bank });
      // Ventile
      for (const kind of ['in', 'ex']) {
        const zSide = (kind === 'in' ? bank.side : -bank.side) * B * .22;
        for (let v = 0; v < nV; v++) {
          const vx = c.x + (nV === 2 ? (v ? .2 : -.2) * B : 0);
          const vg = new THREE.Group(); vg.position.set(vx, deck, zSide); g.add(vg);
          const dR = B * (kind === 'in' ? (nV === 2 ? .155 : .21) : (nV === 2 ? .135 : .18));
          const vh = cylY(dR, dR * .7, B * .045, M.steel, 24); vh.position.y = -B * .02; vg.add(pick(vh, kind === 'in' ? 'Einlassventil' : 'Auslassventil', () => e3ValveInfo(c, kind)));
          const stem = cylY(B * .028, B * .028, B * .66, M.steel, 10); stem.position.y = B * .31; vg.add(stem);
          const spring = new THREE.Mesh(new THREE.TubeGeometry(helixCurve(B * .075, 1, 6), 120, B * .011, 6), M.spring); spring.position.y = B * .28; spring.userData.noPick = true; vg.add(spring);
          const ret = cylY(B * .085, B * .085, B * .03, M.steel, 16); ret.position.y = B * .6; vg.add(ret);
          let tap = null;
          if (camType === 'DOHC') { tap = cylY(B * .1, B * .1, B * .08, M.dark, 20); tap.position.y = B * .66; vg.add(pick(tap, 'Tassenstößel', () => e3ValveInfo(c, kind))); }
          if (P.diesel === false && kind === 'ex' && P.turbo) vh.material = M.copper;
          T.valves.push({ c, kind, vg, spring, base: deck, bank, v, vx, zSide, bent: false });
        }
      }
    }
    /* Nockenwellen */
    const camKey = () => (Object.assign({}, S.TUNE_DEF, st.tune || {})).cam;
    const halfW = ((230 + ((S.CAMS[camKey()] || S.CAMS.serie).dur)) / 4) * deg;
    const baseR = B * .15, liftV = B * .1;
    const mkCam = (kindList, z, y, label, up) => {
      const cg = new THREE.Group(); cg.position.set(0, y, z); g.add(cg);
      const shaft = cylX(B * .07, x1 - x0 + B * .3, M.steel, 16); shaft.position.x = (x0 + x1) / 2 - B * .15; cg.add(pick(shaft, label, () => `${label} · ${fmtK(snap.rpm / 2)} U/min (halbe Kurbelwellendrehzahl)`));
      for (const vv of T.valves.filter(v => v.bank === bank && kindList.includes(v.kind))) {
        const peak = vv.kind === 'in' ? 450 : 270;
        const lobe = new THREE.Mesh(camLobeGeo(baseR, liftV, B * .13, halfW), M.forged); lobe.position.x = vv.vx;
        lobe.rotation.x = ((up ? 0 : 180) - (vv.c.off + peak) / 2) * deg; cg.add(pick(lobe, 'Nocken', () => `${vv.kind === 'in' ? 'Einlass' : 'Auslass'}nocken Zylinder ${vv.c.i + 1} · Profil ${(S.CAMS[camKey()] || S.CAMS.serie).label}`));
      }
      const spr = cylX(B * .42, B * .07, M.dark, 36); spr.position.x = x0 - B * .02; cg.add(spr);
      T.cams.push({ cg, bank, y, z });
      return cg;
    };
    const tapTop = deck + B * .7;
    if (camType === 'DOHC') {
      mkCam(['in'], bank.side * B * .22, tapTop + baseR, 'Einlassnockenwelle');
      mkCam(['ex'], -bank.side * B * .22, tapTop + baseR, 'Auslassnockenwelle');
    } else if (camType === 'OHC') {
      const yC = tapTop + baseR + B * .18;
      mkCam(['in', 'ex'], 0, yC, 'Nockenwelle');
      for (const vv of T.valves.filter(v => v.bank === bank)) { // Schlepphebel
        const arm = new THREE.Mesh(new THREE.BoxGeometry(B * .08, B * .06, Math.abs(vv.zSide) + B * .12), M.forged); arm.position.set(vv.vx, tapTop + B * .03, vv.zSide / 2); g.add(pick(arm, 'Kipphebel', () => e3ValveInfo(vv.c, vv.kind))); vv.arm = arm;
      }
    } else { // OHV: Nockenwelle im Block, Stoßstangen, Kipphebel
      const zc = bank.side * B * .85, yc = r * 1.7;
      mkCam(['in', 'ex'], zc, yc, 'Nockenwelle (untenliegend)', true);
      for (const vv of T.valves.filter(v => v.bank === bank)) {
        const top3 = V3(vv.vx, deck + B * .78, zc * .6), bot = V3(vv.vx, yc + baseR, zc);
        const len = top3.distanceTo(bot), prod = cylY(B * .025, B * .025, len, M.steel, 8);
        const pgp = new THREE.Group(); pgp.position.copy(bot); pgp.rotation.x = Math.atan2(top3.z - bot.z, top3.y - bot.y); prod.position.y = len / 2; pgp.add(pick(prod, 'Stoßstange', () => e3ValveInfo(vv.c, vv.kind))); g.add(pgp);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(B * .08, B * .06, Math.abs(zc * .6 - vv.zSide) + B * .1), M.forged); arm.position.set(vv.vx, deck + B * .74, (zc * .6 + vv.zSide) / 2); g.add(pick(arm, 'Kipphebel', () => e3ValveInfo(vv.c, vv.kind)));
        vv.push = pgp; vv.arm = arm;
      }
    }
    // Kanäle im Kopf: Lage der Ein- und Auslassöffnungen (Welt), Flansche
    const portY = deck + B * .45;
    bank.portY = portY; bank.headH = headH;
    const toWb = (x, y, z) => e3ToW(bank.beta, x, y, z);
    for (const c of bc) {
      c.inPort = toWb(c.x, portY, bank.side * B * .74); c.inDir = toWb(0, 0, bank.side);
      c.exPort = toWb(c.x, portY, -bank.side * B * .74); c.exDir = toWb(0, 0, -bank.side); c.upW = toWb(0, 1, 0);
    }
    for (const sd of [1, -1]) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - B * .15, B * .46, B * .07), sd === bank.side ? M.alu : M.iron);
      fl.position.set((x0 + x1) / 2, portY, sd * B * .72); g.add(fl);
    }
    if (P.carb) { // Zündverteiler mit Zündkabeln
      const dz = -bank.side * B * .55, dpos = V3(x0 + B * .35, deck + headH + B * .55, dz);
      const dist = cylY(B * .2, B * .16, B * .35, M.black, 20); dist.position.copy(dpos); g.add(pick(dist, 'Zündverteiler', () => `Zündverteiler · Zündfolge ${P.order.join('-')}`));
      for (const c of bc) e3Tube(g, [dpos.clone().add(V3(0, B * .18, 0)), V3((dpos.x + c.x) / 2, deck + headH + B * .75, dz * .5), V3(c.x, deck + headH * .95 + B * .12, 0)], B * .025, M.red);
    }
    if (!P.diesel && !P.carb) for (const c of bc) { // Einzelzündspulen auf den Kerzen
      const coil = new THREE.Mesh(new THREE.BoxGeometry(B * .2, B * .42, B * .26), M.black); coil.position.set(c.x, deck + headH + B * .4, 0); g.add(pick(coil, 'Zündspule', () => `Zündspule Zylinder ${c.i + 1} · ${snap.ign ? 'aktiv' : 'aus'}`));
      const plugC = new THREE.Mesh(new THREE.BoxGeometry(B * .12, B * .1, B * .12), M.red); plugC.position.set(c.x, deck + headH + B * .65, B * .08); g.add(plugC);
    } else { // Common-Rail: Rail und Hochdruckleitungen
      const railZ = bank.side * B * .5, railY = deck + headH + B * .3;
      const rail = cylX(B * .09, x1 - x0 - B * .3, M.steel, 16); rail.position.set((x0 + x1) / 2, railY, railZ); g.add(pick(rail, 'Rail', () => `Common-Rail · ${fmtK(snap.rail)} bar`));
      for (const c of bc) {
        const hp = new THREE.Mesh(sweepGeo(crv([V3(c.x, railY, railZ), V3(c.x, railY + B * .12, railZ * .6), V3(c.x, deck + headH * .95 + B * .1, B * .05)]), () => B * .025, 20, 6), M.steel);
        g.add(pick(hp, 'Hochdruckleitung', () => `Hochdruckleitung Zylinder ${c.i + 1} · ${fmtK(snap.rail)} bar`));
      }
    }
  }

  /* Kurbelgehäuse, Ölwanne, Öl */
  const caseW = layout === 'B' ? deck * 1.1 : layout === 'V' ? deck * 1.25 : B * 1.5;
  const cH = r * 1.9, cs = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, cH, caseW), M.caseG); cs.position.set((minX + maxX) / 2, layout === 'B' ? 0 : -r * .1, 0);
  root.add(pick(edged(cs, M), 'Kurbelgehäuse', () => `Kurbelgehäuse · Blow-by ${fmt(snap.crankcase)} l/min`));
  const panTop = -r * 1.1, panD = r * 1.6 + B * .5, panW = Math.max(caseW * .9, B * 1.4);
  const pan = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, panD, panW), M.panG); pan.position.set((minX + maxX) / 2, panTop - panD / 2, 0); root.add(pick(edged(pan, M), 'Ölwanne', () => `Ölwanne · Ölstand ${fmt(snap.oilLevel * 100)} % · ${fmt(snap.To)} °C · ${fmt(snap.oilP, 1)} bar${snap.milky > .3 ? ' · Öl milchig (Kühlmittel!)' : ''}`));
  const oil = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX - B * .1, 1, panW - B * .1), M.oil.clone()); oil.geometry.translate(0, .5, 0); oil.position.set((minX + maxX) / 2, panTop - panD + B * .05, 0); root.add(oil); oil.userData.noPick = true;
  const pickup = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(minX + pitch * .6, panTop - panD + B * .15, 0), V3(minX + pitch * .6, panTop - B * .2, 0), V3(minX + pitch * .25, -r * .4, 0)]), 12, B * .06, 8), M.dark); root.add(pick(pickup, 'Ölansaugrohr', () => `Ölpumpe · ${fmt(snap.oilP, 1)} bar`));
  T.oil = oil; T.panTop = panTop; T.panD = panD;

  /* Steuertrieb vorne: Kette um Kurbelwellenrad und Nockenwellenräder */
  const chX = minX - B * .4;
  const wheels = [{ y: 0, z: 0, r: r * .55 }];
  for (const cm of T.cams) { const bt = cm.bank.beta * deg, y = cm.y * Math.cos(bt) - cm.z * Math.sin(bt), z = cm.y * Math.sin(bt) + cm.z * Math.cos(bt); wheels.push({ y, z, r: B * .42 }); }
  if (T.cams.length === 1 && camType !== 'OHV') wheels.push({ y: wheels[1].y * .55, z: wheels[1].z * .55 + B * .55, r: B * .12 }); // Spanner
  const chain = loopCurve(chX, wheels), chLen = chain.getLength(), nL = Math.round(chLen / (B * .095));
  const link = new THREE.InstancedMesh(new THREE.BoxGeometry(B * .09, B * .04, B * .085), M.chain, nL); link.userData.noPick = true; root.add(link);
  T.chain = { curve: chain, len: chLen, n: nL, mesh: link, wheelR: r * .55 };
  const tc = new THREE.Mesh(new THREE.BoxGeometry(B * .5, 1, 1), M.caseG); root.add(tc); tc.userData.noPick = true;
  { const yy = wheels.map(w => w.y), zz = wheels.map(w => w.z); const h = Math.max(...yy) - Math.min(...yy) + B, w = Math.max(...zz) - Math.min(...zz) + B; tc.scale.set(1, h, w); tc.position.set(chX, (Math.max(...yy) + Math.min(...yy)) / 2, (Math.max(...zz) + Math.min(...zz)) / 2); edged(tc, M); }
  /* Nebenaggregate: Riementrieb mit Wasserpumpe und Lichtmaschine */
  const beltX = minX - B * .8, wpY = r * 1.4 + B * .5, alt = { y: r * .9 + B * .4, z: -(caseW / 2 + B * .55) };
  const bw = [{ y: 0, z: 0, r: r * 1.15 }, { y: wpY, z: 0, r: B * .32 }, { y: alt.y, z: alt.z, r: B * .22 }, { y: wpY * .75, z: B * .9 + caseW * .15, r: B * .14 }];
  const belt = new THREE.Mesh(new THREE.TubeGeometry(loopCurve(beltX, bw), 200, B * .04, 6, true), M.belt); belt.scale.set(1, 1, 1); root.add(pick(belt, 'Keilrippenriemen', () => `Keilrippenriemen · treibt Wasserpumpe und Lichtmaschine`));
  const wp = cylX(B * .32, B * .14, M.alu, 30); wp.position.set(beltX, wpY, 0); root.add(pick(wp, 'Wasserpumpe', () => `Wasserpumpe · ${snap.running ? 'fördert Kühlmittel' : 'steht'} · Thermostat ${snap.thermo > .98 ? 'offen' : snap.thermo < .02 ? 'zu' : fmt(snap.thermo * 100) + ' %'}`));
  const altG = new THREE.Group(); altG.position.set(beltX, alt.y, alt.z); root.add(altG);
  const altP = cylX(B * .22, B * .14, M.dark, 24); altG.add(altP);
  const altB = cylX(B * .42, B * .9, M.alu, 30); altB.position.x = B * .55; altG.add(pick(altB, 'Lichtmaschine', () => `Lichtmaschine · ${fmt(snap.Ialt)} A Ladestrom · ${fmt(snap.Vt, 1)} V`));
  const idl = cylX(B * .14, B * .12, M.dark, 20); idl.position.set(beltX, bw[3].y, bw[3].z); root.add(idl);
  T.pulleys = [{ m: wp, k: (r * 1.15) / (B * .32) }, { m: altP, k: (r * 1.15) / (B * .22) }, { m: idl, k: (r * 1.15) / (B * .14) }];

  /* Anlasser am Zahnkranz */
  const stA = -2.3, pinR = B * .14, stDist = flyR + B * .03 + pinR;
  const stG = new THREE.Group(); stG.position.set(flyX, stDist * Math.cos(stA), stDist * Math.sin(stA)); root.add(stG);
  const stBody = cylX(B * .35, B * 1.3, M.dark, 28); stBody.position.x = B * .95; stG.add(pick(stBody, 'Anlasser', () => `Anlasser · ${snap.starterEng ? fmtK(snap.Is) + ' A' : 'aus'}`));
  const sol = cylX(B * .17, B * .8, M.dark, 18); sol.position.set(B * .9, B * .45, 0); stG.add(sol);
  const pinion = cylX(pinR, B * .2, M.steel, 12); stG.add(pick(pinion, 'Anlasserritzel', () => snap.starterEng ? 'Ritzel eingespurt · dreht den Zahnkranz' : 'Ritzel ausgespurt'));
  T.starter = { pinion };

  Object.assign(T, { caseW, panW, panTop, panD, beltX, wpY, flyR, flyX, frontX, pitch, layout, nBank });
  T.coreBox = new THREE.Box3().setFromObject(root);
  e3Periphery(T);

  T.pistons.sort((a, b) => a.c.i - b.c.i);
  // OT-Markierung auf der Riemenscheibe
  const notch = new THREE.Mesh(new THREE.BoxGeometry(B * .22, B * .1, B * .05), M.red); notch.position.set(frontX - B * .55, r * 1.15, 0); crank.add(notch);
  // Kamera auf Motorgröße einstellen
  const bb = T.coreBox.clone().expandByObject(T.frontGroup), cen = bb.getCenter(V3()), size = bb.getSize(V3());
  T.center = cen; T.radius = size.length() / 2;
  E3.built = T; E3.key = key;
  e3Housing(); e3Resize();
  return T;
}
function e3PistonInfo(c) {
  const phi = e3Phi(c), ph = e3Phase(phi), T = E3.built, a = phi % 360 * Math.PI / 180;
  const x = T.r * Math.cos(a) + Math.sqrt(T.L * T.L - (T.r * Math.sin(a)) ** 2), fromTdc = (T.r + T.L - x) * 10;
  const toTdc = phi < 360 ? phi : phi - 360, otTxt = phi % 360 < 180 ? `${fmt(phi % 360)}° nach OT` : `${fmt(360 - phi % 360)}° vor OT`;
  const cs = snap.cylS[c.i] || {};
  return `Kolben Zylinder ${c.i + 1} · ${ph.name} · ${otTxt} · ${fmt(fromTdc)} mm unter OT · Kolbenboden ${fmt(cs.Tw || 0)} °C${snap.dyn && snap.dyn.burntPiston === c.i ? ' · KOLBEN DURCHGEBRANNT' : ''}`;
}
function e3RingInfo(c, k) {
  const bad = st.faults.cyl.rings && st.faults.cyl.rings[c.i];
  return `${['Verdichtungsring', 'Nasen-Minutenring', 'Ölabstreifring'][k]} Zylinder ${c.i + 1} · ${bad ? 'GEBROCHEN, bläst durch' : 'dicht'}`;
}
function e3ValveInfo(c, kind) {
  const T = Object.assign({}, S.TUNE_DEF, st.tune || {}), l = S.valveLift(e3Phi(c), kind, T.cam);
  return `${kind === 'in' ? 'Einlass' : 'Auslass'}ventil Zylinder ${c.i + 1} · Hub ${fmt(l * E3.built.B * .1 * 10, 1)} mm${snap.dyn && snap.dyn.bentValve === c.i && kind === 'in' ? ' · VERBOGEN' : ''}`;
}
const e3Phi = c => (((E3.thetaV * 180 / Math.PI) - c.off) % 720 + 720) % 720;

function e3Housing() {
  const T = E3.built; if (!T) return; const M = E3.M, solid = E3.housing;
  for (const m of [M.blockG, M.headG, M.panG, M.caseG]) { m.opacity = solid ? .96 : (m === M.panG ? .14 : m === M.caseG ? .08 : .1); m.depthWrite = solid; m.metalness = solid ? .5 : .1; m.roughness = solid ? .6 : .2; m.needsUpdate = true; }
  M.liner.opacity = solid ? 0 : .08;
}

/* ---------- Bedienung: Drehen, Zoomen, Bauteil-Info ---------- */
function e3Controls(cv) {
  const pts = new Map();
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); E3.drag = { moved: 0 }; });
  cv.addEventListener('pointermove', e => {
    const rect = cv.getBoundingClientRect(); E3.mouse = { x: (e.clientX - rect.left) / rect.width * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1, cx: e.clientX - rect.left, cy: e.clientY - rect.top };
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; E3.az -= dx * .008; E3.el = clamp(E3.el + dy * .006, -1.2, 1.35); E3.drag.moved += Math.abs(dx) + Math.abs(dy); }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY;
      const [c2, d2] = [...pts.values()], d1 = Math.hypot(c2.x - d2.x, c2.y - d2.y); if (d0 > 0) E3.zoom = clamp(E3.zoom * d0 / d1, .35, 2.2); E3.drag.moved += 10; return;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const end = e => { pts.delete(e.pointerId); if (E3.drag && E3.drag.moved < 6 && e.type === 'pointerup') E3.hoverT = 0; if (!pts.size) E3.drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!pts.size) { E3.mouse = null; $('e3Tip').hidden = true; } });
  cv.addEventListener('wheel', e => { e.preventDefault(); E3.zoom = clamp(E3.zoom * Math.exp(e.deltaY * .001), .35, 2.2); }, { passive: false });
  cv.addEventListener('dblclick', () => { E3.az = -.85; E3.el = .38; E3.zoom = 1; });
}
function e3Resize() {
  if (!E3.ok) return;
  const box = $('e3Box'), w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  E3.R.setSize(w, h, false); E3.cam.aspect = w / h; E3.cam.updateProjectionMatrix();
}

/* ---------- Bild für Bild ---------- */
function e3Render(dtR) {
  if (!e3Init()) return;
  if (E3.key !== snap.key) e3Build(snap.key);
  const T = E3.built, s = snap, P = T.P, deg = Math.PI / 180;
  // Kurbelwinkel: Echtzeit, Zeitlupe oder Standbild
  if (E3.paused) E3.thetaV = (+$('e3Ang').value) * deg + 0;
  else if (E3.slow <= 1) E3.thetaV = (s.theta || 0) % (4 * Math.PI);
  else E3.thetaV = (E3.thetaV + s.rpm * Math.PI / 30 * dtR / E3.slow) % (4 * Math.PI);
  const th = E3.thetaV;
  T.crank.rotation.x = th;
  // Motor wackelt in den Lagern: beim Anlassen, im kalten Leerlauf und bei Aussetzern
  const misN = s.cylS.filter(c => c.state === 'misfire').length;
  const shake = (s.starterEng ? .006 : 0) + (s.running ? (.0015 + misN * .006) * clamp(1.6 - s.rpm / 2000, .3, 1.6) : 0);
  T.root.rotation.x = shake * Math.sin(th * P.cyl / 2) + (misN ? shake * .6 * Math.sin(th * .5) : 0);
  const tune = Object.assign({}, S.TUNE_DEF, st.tune || {});
  const dyn = s.dyn || {};
  let bestFire = 0, bestPos = null;
  const tmpC = new THREE.Color();
  for (const p of T.pistons) {
    const c = p.c, phi = e3Phi(c), a = phi % 360 * deg;
    const x = T.r * Math.cos(a) + Math.sqrt(T.L * T.L - (T.r * Math.sin(a)) ** 2);
    p.pg.position.set(c.x, x, 0);
    const py = T.r * Math.cos(a), pz = T.r * Math.sin(a);
    p.rod.position.set(c.x, py, pz); p.rod.rotation.x = Math.atan2(-pz, x - py);
    if (dyn.bentRod === c.i) p.rod.rotation.x += .06;
    const crownY = x + T.pinUp, gap = Math.max(.2, T.deck - crownY);
    p.gas.position.set(c.x, crownY, 0); p.gas.scale.set(1, gap, 1);
    const ph = e3Phase(phi), cs = s.cylS[c.i] || {}, firing = s.running && cs.state === 'fire';
    const gm = p.gas.material;
    if (s.hydro === c.i) { gm.color.set(0x3a8cff); gm.opacity = .65; }
    else if (ph.name === 'Arbeiten' && firing) { const k = Math.max(0, 1 - phi / 120); gm.color.setRGB(1, .45 + .4 * k, .12 * k); gm.opacity = .25 + .5 * k; }
    else if (ph.name === 'Ausstoßen') { gm.color.set(firing ? 0x8a6a58 : 0x6f7f8c); gm.opacity = .22; }
    else if (ph.name === 'Ansaugen') { gm.color.set(P.diesel ? 0x7cc8f0 : 0x9ad8a8); gm.opacity = .18; }
    else { const k = (phi - 540) / 180; gm.color.set(P.diesel ? 0x7cc8f0 : 0x9ad8a8); gm.opacity = .18 + .3 * Math.max(0, k); }
    if (!s.running && s.rpm < 1) gm.opacity *= .6;
    // Flamme
    let fl = 0;
    if (firing && (phi < 70 || phi > 715)) fl = phi > 715 ? (phi - 715) / 5 * .6 : 1 - phi / 70;
    if (!firing && s.starterEng && cs.state === 'fire' && phi < 50) fl = (1 - phi / 50) * .5;
    p.fl.material.opacity = fl * (E3.slow <= 1 ? .5 : 1);
    p.fl.scale.setScalar(T.B * (.6 + .7 * fl));
    p.fl.position.set(c.x, T.deck - Math.max(gap, .5) * .45, 0);
    if (fl > bestFire) { bestFire = fl; bestPos = p.fl.getWorldPosition(V3()); }
    // Schäden und Ringe
    const ringBad = st.faults.cyl.rings && st.faults.cyl.rings[c.i];
    for (const rg of p.rings) rg.material = ringBad ? E3.M.ringBad : E3.M.ring;
    p.burnt.visible = dyn.burntPiston === c.i;
    if (E3.thermal) { const pm = p.pg.children[0].material === E3.M.piston ? (p.pg.children[0].material = E3.M.piston.clone()) : p.pg.children[0].material; e3TempColor(cs.Tw || s.Tb, pm.color); pm.emissive = pm.color.clone().multiplyScalar(.25); }
    else if (p.pg.children[0].material !== E3.M.piston) p.pg.children[0].material = E3.M.piston;
  }
  // Zündfunke bzw. Einspritzstrahl
  T.pistons.forEach((p, idx) => {
    const phi = e3Phi(p.c), cs = s.cylS[p.c.i] || {}, on = (s.running || s.starterEng) && s.ign;
    if (P.diesel) {
      const sp = T.sprays[idx]; if (!sp) return;
      const inj = on && cs.state !== 'stopped' && (phi > 705 || phi < 18) && !(st.faults.cyl.inj && st.faults.cyl.inj[p.c.i]);
      const k = inj ? (phi > 705 ? (phi - 705) / 15 : 1 - phi / 18) : 0;
      sp.children.forEach(pv => { pv.children[0].material.opacity = k * .55; pv.children[0].scale.y = .5 + k; });
    } else {
      const sp = T.sparks[idx]; if (!sp) return;
      const plugBad = st.faults.cyl.plug && st.faults.cyl.plug[p.c.i];
      const adv = P.ignOpt || 25, ign = 720 - adv * .6;
      const k = on && !plugBad && Math.abs(((phi - ign + 360) % 720) - 360) < 6 ? 1 : 0;
      sp.material.opacity = k; sp.scale.setScalar(T.B * (.25 + .25 * k));
    }
  });
  E3.fireLight.intensity = bestFire * (E3.slow <= 1 ? 1 : 2.5); if (bestPos) E3.fireLight.position.copy(bestPos);
  // Ventile, Federn, Stößel, Kipphebel, Nockenwellen
  const liftMax = T.B * .1;
  for (const v of T.valves) {
    let l = S.valveLift(e3Phi(v.c), v.kind, tune.cam) * liftMax;
    if (dyn.bentValve === v.c.i && v.kind === 'in' && v.v === 0) { v.vg.rotation.z = .08; l = Math.min(l, liftMax * .3); } else v.vg.rotation.z = 0;
    if (s.floatT > 0) l += liftMax * .25 * Math.random();
    v.vg.position.y = v.base - l;
    v.spring.position.y = T.B * .28 + l; v.spring.scale.y = T.B * .32 - l; // Feder zwischen Sitz im Kopf (fest) und Federteller (bewegt)
    if (v.arm) v.arm.rotation.x = (v.zSide > 0 ? -1 : 1) * l / T.B * .9;
    if (v.push) v.push.children[0].position.y = (v.push.children[0].geometry.parameters.height / 2) + l;
  }
  for (const cm of T.cams) cm.cg.rotation.x = th / 2;
  // Steuerkette
  const ch = T.chain, travel = (th * ch.wheelR) / ch.len, mx = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V3(1, 1, 1), tg = V3(), pp = V3();
  for (let k = 0; k < ch.n; k++) {
    const u = ((k / ch.n - travel) % 1 + 1) % 1;
    ch.curve.getPointAt(u, pp); ch.curve.getTangentAt(u, tg);
    q.setFromAxisAngle(V3(1, 0, 0), Math.atan2(tg.z, tg.y)); mx.compose(pp, q, one); ch.mesh.setMatrixAt(k, mx);
  }
  ch.mesh.instanceMatrix.needsUpdate = true;
  for (const pl of T.pulleys) pl.m.rotation.x = th * pl.k;
  // Anlasser
  const sp = T.starter.pinion; sp.position.x = snap.starterEng ? 0 : T.B * .4; if (snap.starterEng) sp.rotation.x -= dtR * 20;
  // Öl
  const oilH = Math.max(.3, T.panD * .55 * clamp(s.oilLevel, 0, 1.2)); T.oil.scale.y = oilH;
  T.oil.material.color.set(s.milky > .3 ? 0xc9b48a : s.To > 60 ? 0x5a3608 : 0x6b4510);
  // Turbo
  e3PeriphUpdate(T, s, dtR);
  // Glühen von Krümmer und Turbine, Wärmebild für Block und Kopf
  const egt = s.egt || 20, glow = clamp((egt - 480) / 420, 0, 1);
  E3.M.exhaust.emissive.setRGB(glow * .9, glow * .22, glow * .03); E3.M.turbo.emissive.setRGB(glow * .8, glow * .2, glow * .03);
  for (const bk of T.banks) {
    const gk = bk.gasket.material, bad = st.faults.headGasket || dyn.headGasket; gk.opacity = bad ? .55 + .35 * Math.sin(performance.now() / 200) : 0;
    if (E3.thermal) {
      for (const [m, temp] of [[bk.block, s.Tb], [bk.head, s.Thead]]) { if (!m.userData.thMat) { m.userData.thMat = m.material.clone(); } m.material = m.userData.thMat; e3TempColor(temp, m.material.color); m.material.opacity = E3.housing ? .96 : .32; m.material.emissive = m.material.color.clone().multiplyScalar(.2); }
      E3.M.exhaust.color.copy(e3TempColor(egt, tmpC));
    } else {
      bk.block.material = E3.M.blockG; bk.head.material = E3.M.headG; E3.M.exhaust.color.set(0x6b5a4e);
    }
  }
  // Kamera
  const R0 = T.radius * 2.8 * E3.zoom * Math.max(1, 1.45 / E3.cam.aspect), cen = T.center;
  E3.cam.position.set(cen.x + R0 * Math.cos(E3.el) * Math.sin(E3.az), cen.y + R0 * Math.sin(E3.el), cen.z + R0 * Math.cos(E3.el) * Math.cos(E3.az));
  E3.cam.lookAt(cen); E3.cam.near = R0 / 50; E3.cam.far = R0 * 6; E3.cam.updateProjectionMatrix();
  E3.R.render(E3.scene, E3.cam);
  // Bauteil-Info unter dem Zeiger
  E3.hoverT -= dtR;
  if (E3.mouse && !E3.drag && E3.hoverT <= 0) {
    E3.hoverT = .12;
    E3.ray.setFromCamera(E3.mouse, E3.cam);
    const hits = E3.ray.intersectObject(T.root, true);
    let part = null;
    for (const pass of [0, 1]) { // erst massive Teile, dann durchsichtige Gehäuse
      for (const h of hits) { let o = h.object; const m = o.material; if (o.userData.noPick || (m && m.opacity === 0) || (!pass && m && m.transparent && m.opacity < .5)) continue; while (o && !o.userData.part) o = o.parent; if (o) { part = o.userData.part; break; } }
      if (part) break;
    }
    const tip = $('e3Tip');
    if (part) { tip.hidden = false; tip.textContent = part.info ? part.info() : part.name; tip.style.left = clamp(E3.mouse.cx + 14, 4, $('e3Box').clientWidth - tip.offsetWidth - 4) + 'px'; tip.style.top = clamp(E3.mouse.cy + 14, 4, $('e3Box').clientHeight - tip.offsetHeight - 4) + 'px'; }
    else tip.hidden = true;
  }
  // Takt je Zylinder
  if (performance.now() - E3.lastInfoT > 120) {
    E3.lastInfoT = performance.now();
    const ang = ((th * 180 / Math.PI) % 720 + 720) % 720;
    setT('e3AngT', `${fmt(ang)}° KW`);
    if (!E3.paused) $('e3Ang').value = Math.round(ang);
    const box = $('e3Cyl');
    if (box.dataset.key !== E3.key) { box.dataset.key = E3.key; box.innerHTML = ''; }
    if (box.childElementCount !== T.pistons.length) box.innerHTML = T.pistons.map((p, i) => `<span class="e3c" id="e3c${i}"><b>${p.c.i + 1}</b><i></i></span>`).join('');
    T.pistons.forEach((p, i) => {
      const ph = e3Phase(e3Phi(p.c)), el = $('e3c' + i), cs = s.cylS[p.c.i] || {};
      const txt = cs.state === 'misfire' ? 'Aussetzer' : ph.name;
      if (el.dataset.t !== txt) { el.dataset.t = txt; el.lastChild.textContent = txt; el.style.setProperty('--c', `var(--${cs.state === 'misfire' ? 'red' : ph.col})`); }
    });
  }
}
function e3Bind() {
  for (const b of document.querySelectorAll('#e3Slow button')) b.onclick = () => {
    for (const x of document.querySelectorAll('#e3Slow button')) x.setAttribute('aria-pressed', String(x === b));
    const v = b.dataset.v; E3.paused = v === 'p'; if (!E3.paused) E3.slow = +v;
    $('e3AngRow').hidden = !E3.paused;
  };
  $('e3Ang').oninput = e => { $('e3AngO').textContent = e.target.value + '°'; };
  $('e3House').onchange = e => { E3.housing = e.target.checked; e3Housing(); };
  const leg = () => { $('e3ThLeg').hidden = !(E3.thermal || E3.flowAir || E3.flowCool); };
  $('e3Therm').onchange = e => { E3.thermal = e.target.checked; leg(); };
  $('e3Air').onchange = e => { E3.flowAir = e.target.checked; leg(); };
  $('e3Cool').onchange = e => { E3.flowCool = e.target.checked; leg(); };
  leg();
}

/* ================= Peripherie: Ansaugtrakt, Turbolader, Ladeluftkühler, Abgasanlage, Kühlkreislauf, Strömung ================= */
function e3PMats() {
  const M = E3.M; if (M.pm) return M.pm;
  const std = (color, metal, rough, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness: metal, roughness: rough, envMapIntensity: .75 }, extra));
  const tr = (color, op, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness: .2, roughness: .35, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }, extra));
  const finTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3a4048'; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#8a929b'; g.lineWidth = 1; for (let y = 0; y < 256; y += 3) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(64, y + 1.5); g.stroke(); } g.fillStyle = '#5a626b'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 256); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t; })();
  M.pm = {
    plastic: std(0x1e2125, .1, .65), plasticT: tr(0x2a2f36, .38), hose: std(0x1a1b1d, .05, .75), hoseCool: std(0x1a1b1d, .05, .75),
    chrome: std(0xeef1f4, 1, .08), comp: tr(0xc9ced4, .4, { metalness: .6, roughness: .3 }), compS: std(0xc9ced4, .7, .35),
    turbine: std(0x5d5650, .6, .6, { emissive: 0x000000 }), inconel: std(0x75706a, .8, .4, { emissive: 0x000000 }),
    exMan: std(0x6b5a4e, .6, .55, { emissive: 0x000000 }), exMid: std(0x8a8580, .7, .45, { emissive: 0x000000 }), exCool: std(0x9aa0a6, .8, .35, { emissive: 0x000000 }),
    cat: std(0xb4b8bc, .8, .3, { emissive: 0x000000 }), heatShield: std(0xc8ccd0, .9, .25),
    charge: std(0xb8bec6, .75, .3), chargeHot: std(0xb8bec6, .75, .3),
    core: new THREE.MeshStandardMaterial({ map: finTex, metalness: .5, roughness: .55, envMapIntensity: .6 }),
    coreIc: new THREE.MeshStandardMaterial({ map: finTex, metalness: .6, roughness: .45, color: 0xbfc6cf, envMapIntensity: .6 }),
    tank: tr(0xe8eef4, .35), coolant: new THREE.MeshStandardMaterial({ color: 0x2f9be0, transparent: true, opacity: .7, roughness: .1, depthWrite: false }),
    filter: std(0xd9c79a, .0, .9), dot: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(),
  };
  return M.pm;
}
function e3Tube(parent, pts, r, mat, name, info, opt = {}) {
  const c = pts instanceof THREE.Curve ? pts : crv(pts), rf = typeof r === 'function' ? r : () => r;
  const m = new THREE.Mesh(sweepGeo(c, rf, opt.seg || 48, opt.rad || 14), mat);
  if (name) pick(m, name, info); parent.add(m); m.userData.curve = c; return m;
}
const ribbed = (r0, n, a = .08) => u => r0 * (1 + a * Math.max(0, Math.sin(u * n * Math.PI * 2)));
function voluteGeo(R0, r0, r1, turns = .86) {
  const pts = [];
  for (let k = 0; k <= 48; k++) { const t = k / 48, a = t * turns * Math.PI * 2, R = R0 * (.82 + .32 * t); pts.push(V3(0, R * Math.cos(a), R * Math.sin(a))); }
  const c = crv(pts); return { geo: sweepGeo(c, u => r0 + (r1 - r0) * Math.pow(u, .8), 80, 16), curve: c };
}
function bladeWheel(R, len, nMain, mat, twist, hubR) {
  const w = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR * .45, hubR, len, 24), mat); hub.rotation.z = Math.PI / 2; w.add(hub);
  const mk = (h, l, x0) => { const g = new THREE.BoxGeometry(l, h, R * .045, 8, 4, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = (x / l + .5) * twist * (y / h + 1); p.setY(i, y * Math.cos(a) - z * Math.sin(a)); p.setZ(i, y * Math.sin(a) + z * Math.cos(a)); } g.computeVertexNormals(); g.translate(x0, 0, 0); return g; };
  const gMain = mk(R - hubR * .6, len, 0), gSplit = mk((R - hubR * .6) * .8, len * .6, len * .2);
  for (let k = 0; k < nMain * 2; k++) {
    const holder = new THREE.Group(); holder.rotation.x = k / (nMain * 2) * Math.PI * 2;
    const b = new THREE.Mesh(k % 2 ? gSplit : gMain, mat); b.position.y = hubR * .6 + (R - hubR * .6) / 2 * (k % 2 ? .8 : 1); holder.add(b); w.add(holder);
  }
  return w;
}
function e3Periphery(T) {
  const M = E3.M, PM = e3PMats(), P = T.P, B = T.B, r = T.r, root = T.root, deg = Math.PI / 180;
  const X = V3(1, 0, 0), UP = V3(0, 1, 0), DN = V3(0, -1, 0);
  const cyl = T.cyl, front = new THREE.Group(); root.add(front); T.frontGroup = front;
  const air = new THREE.Group(); root.add(air); T.airGroup = air;
  const paths = []; T.paths = paths;
  const addPath = (kind, curve, o = {}) => { const pts = curve.getSpacedPoints(120); const p = Object.assign({ kind, curve, pts, len: curve.getLength(), spread: B * .06, density: 1, gate: () => 1, temp: () => 20, speed: () => 30 }, o); paths.push(p); return p; };
  const mean = arr => arr.reduce((a, v) => a.add(v), V3()).multiplyScalar(1 / arr.length);
  const Ta = () => st.ambient ?? 20;
  const flowLps = () => { const s = snap, Vd = P.cyl * Math.PI / 4 * P.bore * P.bore * P.stroke * 1000; return Vd * s.rpm / 120 * (s.veNow || .9) * (1 + Math.max(0, s.boost)); };
  const airSpeed = (area = 1) => () => { const sl = E3.paused ? 0 : Math.max(1, E3.slow); return clamp(flowLps() * 9 / area / Math.sqrt(sl), 0, 320); };
  const mdot = () => flowLps() * 1.2 * 273 / (273 + (snap.Tin ?? 20));
  const T2 = () => { const tin = Ta() + 273; return tin * (1 + (Math.pow(1 + Math.max(0, snap.boost), .2857) - 1) / .72) - 273; };
  const minX = T.minX, maxX = T.maxX, cx = (minX + maxX) / 2;
  const deckTop = T.deck + B * 1.2;

  /* ---------- Ansaugtrakt: Sammler und Schwingrohre ---------- */
  const inPorts = cyl.map(c => c.inPort), inDirAvg = mean(cyl.map(c => c.inDir.clone())).normalize();
  let P0; // Sammler-Achse (entlang X)
  if (T.layout === 'R') P0 = mean(inPorts).add(inDirAvg.clone().multiplyScalar(B * 1.45)).add(UP.clone().multiplyScalar(B * .55));
  else P0 = V3(cx, Math.max(...inPorts.map(p => p.y)) + B * (T.layout === 'B' ? 1.2 : 1.0), 0);
  const plenR = B * (T.layout === 'R' ? .34 : .46), plenL = (maxX - minX) - B * .3;
  const plen = new THREE.Mesh(new THREE.CapsuleGeometry(plenR, plenL - plenR * 2, 10, 24), P.diesel ? PM.compS : M.alu);
  plen.rotation.z = Math.PI / 2; plen.position.copy(P0); air.add(pick(plen, 'Ansaugsammler', () => `Ansaugsammler · ${fmt(snap.Tin)} °C · ${P.turbo ? fmt(snap.boost, 2) + ' bar Ladedruck' : fmt(-(1 - Math.max(st.throttle, snap.q)) * .65, 2) + ' bar Unterdruck'} · ${fmt(mdot())} g/s Luft`));
  T.runners = [];
  for (const c of cyl) {
    const a = c.inPort, d = c.inDir, pe = V3(c.x, P0.y, P0.z);
    const toPl = pe.clone().sub(a); const m1 = a.clone().add(d.clone().multiplyScalar(B * .45)), m2 = pe.clone().add(toPl.clone().normalize().multiplyScalar(-plenR * 1.35)).add(UP.clone().multiplyScalar(-B * .1));
    const cv = crv([a, m1, m2, pe]);
    e3Tube(air, cv, u => B * (.125 + .05 * Math.pow(u, 3)), M.alu, 'Schwingrohr', () => `Ansaug-Schwingrohr Zylinder ${c.i + 1} · Einlassventil ${S.valveLift(e3Phi(c), 'in', (Object.assign({}, S.TUNE_DEF, st.tune || {})).cam) > .02 ? 'offen, Luft strömt ein' : 'zu'}`);
    if (!P.diesel && !P.carb) { // Saugrohr-Einspritzventil
      const ip = cv.getPointAt(.28), inj = cylY(B * .05, B * .05, B * .32, PM.plastic, 10); inj.position.copy(ip).add(UP.clone().multiplyScalar(B * .18)); air.add(inj);
    }
    addPath('air', crv([pe, m2, m1, a]), { temp: () => snap.Tin ?? 20, speed: airSpeed(.35), gate: () => S.valveLift(e3Phi(c), 'in', 'serie'), density: 1.3, spread: B * .05, cylI: c.i });
    T.runners.push(cv);
  }
  addPath('air', crv([V3(minX + B * .1, P0.y, P0.z), V3(cx, P0.y + plenR * .3, P0.z), V3(maxX - B * .1, P0.y, P0.z)]), { temp: () => snap.Tin ?? 20, speed: airSpeed(1), spread: plenR * .6, density: .7 });
  const plenIn = V3(minX - B * .05, P0.y, P0.z);
  // Drosselklappe (Benziner mit Einspritzung) bzw. Vergaser
  let airTarget = plenIn.clone().sub(X.clone().multiplyScalar(B * .55));
  if (!P.diesel && !P.carb) {
    const tb = new THREE.Group(); tb.position.copy(plenIn).sub(X.clone().multiplyScalar(B * .28)); air.add(tb);
    const body = cylX(B * .27, B * .38, PM.comp, 28); tb.add(pick(body, 'Drosselklappe', () => `Drosselklappe · ${fmt(Math.max(st.throttle, snap.q * .7) * 100)} % offen`));
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(B * .24, B * .24, B * .02, 28), M.steel); plate.rotation.z = Math.PI / 2; tb.add(plate);
    const shaft = cylY(B * .025, B * .025, B * .6, M.steel, 8); tb.add(shaft);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(B * .3, B * .25, B * .2), PM.plastic); motor.position.set(0, -B * .32, 0); tb.add(motor);
    T.throttlePlate = plate; airTarget = tb.position.clone().sub(X.clone().multiplyScalar(B * .25));
  } else if (P.carb) {
    const cb = new THREE.Group(); cb.position.copy(P0).add(UP.clone().multiplyScalar(plenR + B * .3)); air.add(cb);
    cb.add(pick(cylY(B * .3, B * .34, B * .55, M.alu, 24), 'Vergaser', () => `Vergaser · Drosselklappe ${fmt(Math.max(st.throttle, (st.hand || 0) * .5) * 100)} % · Choke ${fmt((st.choke || 0) * 100)} %`));
    const filt = new THREE.Mesh(new THREE.CylinderGeometry(B * .95, B * .95, B * .35, 40), PM.plasticT); filt.position.y = B * .45; cb.add(pick(filt, 'Luftfilter', () => `Rundluftfilter · Ansaugluft ${fmt(Ta())} °C`));
    const elem = new THREE.Mesh(new THREE.CylinderGeometry(B * .8, B * .8, B * .28, 48, 1, true), PM.filter); elem.position.y = B * .45; cb.add(elem);
    const snork = e3Tube(cb, [V3(0, B * .45, B * .9), V3(0, B * .45, B * 1.5), V3(-B * .3, B * .4, B * 1.9)], B * .18, PM.plastic);
    const top = cb.position.clone();
    addPath('air', crv([top.clone().add(V3(-B * .3, B * .4, B * 1.9)), top.clone().add(V3(0, B * .45, B * 1.2)), top.clone().add(V3(0, B * .5, B * .3)), top.clone().add(V3(0, B * .1, 0)), P0.clone()]), { temp: Ta, speed: airSpeed(.7), density: 1.2 });
  }

  /* ---------- Luftfilterkasten vorne ---------- */
  let abOut = null;
  if (!P.carb) {
    const exSide = -Math.sign(inDirAvg.z || 1);
    const abPos = T.layout === 'R' ? (P.turbo ? V3(minX - B * 1.15, T.deck + B * .2, exSide * (T.caseW / 2 + B * 1.9)) : V3(minX - B * 1.25, P0.y + B * .9, P0.z + inDirAvg.z * B * .4)) : V3(minX - B * 1.3, P0.y + B * .9, 0);
    const ab = new THREE.Group(); ab.position.copy(abPos); front.add(ab);
    const box = new THREE.Mesh(new THREE.BoxGeometry(B * 1.1, B * .75, B * 1.5), PM.plasticT); ab.add(pick(edged(box, M), 'Luftfilterkasten', () => `Luftfilterkasten · Ansaugluft ${fmt(Ta())} °C · ${fmt(mdot())} g/s`));
    for (let k = 0; k < 16; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(B * .9, B * .04, B * .06), PM.filter); pl.position.set(0, (k % 2 ? .02 : -.02) * B, -B * .6 + k * B * .08); pl.rotation.x = (k % 2 ? .5 : -.5); ab.add(pl); }
    const sn = e3Tube(ab, [V3(-B * .55, -B * .1, -B * .45), V3(-B * 1.0, -B * .1, -B * .55), V3(-B * 1.25, -B * .25, -B * .55)], B * .2, PM.plastic, 'Ansaugschnorchel', () => 'Ansaugschnorchel · Frischluft');
    const maf = cylX(B * .22, B * .35, PM.plastic, 20); maf.position.set(B * .72, B * .05, B * .35); ab.add(pick(maf, 'Luftmassenmesser', () => `Luftmassenmesser · ${fmt(mdot())} g/s`));
    abOut = abPos.clone().add(V3(B * .9, B * .05, B * .35));
    const abIn = abPos.clone().add(V3(-B * 1.25, -B * .25, -B * .55));
    addPath('air', crv([abIn, abPos.clone().add(V3(-B * .7, -B * .1, -B * .5)), abPos.clone().add(V3(0, 0, -B * .1)), abPos.clone().add(V3(B * .4, B * .05, B * .3)), abOut]), { temp: Ta, speed: airSpeed(1.4), spread: B * .14, density: 1.1 });
  }

  /* ---------- Kühler, Lüfter, Ausgleichsbehälter, Ladeluftkühler ---------- */
  const radX = minX - B * 2.45, yBot = T.panTop - B * .2, yTop = T.deck + B * .35, H = yTop - yBot, W = Math.max(T.caseW + B * 1.6, B * 3.6);
  const rad = new THREE.Group(); front.add(rad);
  const core = new THREE.Mesh(new THREE.BoxGeometry(B * .32, H - B * .5, W), PM.core); core.position.set(radX, (yTop + yBot) / 2, 0);
  core.material.map.repeat.set(1, 1); rad.add(pick(core, 'Wasserkühler', () => `Wasserkühler · Eintritt ${fmt(snap.TbSens)} °C · Austritt ${fmt(snap.TbSens - radDT())} °C · Thermostat ${snap.thermo > .98 ? 'ganz offen' : snap.thermo < .02 ? 'zu, Kühler wird nicht durchströmt' : fmt(snap.thermo * 100) + ' % offen'}`));
  const radDT = () => snap.thermo * (5 + (snap.fanOn ? 7 : 3) + Math.max(0, 20 - Ta()) * .08);
  for (const yy of [yTop - B * .13, yBot + B * .13]) { const tk = new THREE.Mesh(new THREE.BoxGeometry(B * .42, B * .26, W + B * .1), PM.plastic); tk.position.set(radX, yy, 0); rad.add(tk); }
  const neckIn = V3(radX + B * .25, yTop - B * .13, W * .38), neckOut = V3(radX + B * .25, yBot + B * .13, -W * .38);
  for (const nk of [neckIn, neckOut]) { const n = cylX(B * .13, B * .3, PM.plastic, 14); n.position.copy(nk); rad.add(n); }
  // Lüfter mit Zarge
  const fanX = (T.beltX + radX) / 2 + B * .15, fanR = Math.min(H, W) * .4;
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(fanR * 1.04, B * .06, 8, 48), PM.plastic); shroud.rotation.y = Math.PI / 2; shroud.position.set(fanX, (yTop + yBot) / 2, 0); front.add(shroud);
  const fan = new THREE.Group(); fan.position.copy(shroud.position); front.add(fan);
  fan.add(cylX(fanR * .18, B * .25, PM.plastic, 20));
  for (let k = 0; k < 7; k++) { const h = new THREE.Group(); h.rotation.x = k / 7 * Math.PI * 2; const bl = new THREE.Mesh(new THREE.BoxGeometry(B * .03, fanR * .82, fanR * .32), PM.plastic); bl.position.y = fanR * .55; bl.rotation.y = .45; h.add(bl); fan.add(h); }
  pick(fan.children[0], 'Lüfter', () => `Kühlerlüfter · ${snap.fanOn ? 'läuft' : P.sysV === 24 ? 'Visco-Kupplung, schleppt mit' : 'aus'}`);
  T.fan = fan;
  // Ausgleichsbehälter
  const tank = new THREE.Group(); tank.position.set(radX + B * 1.05, yTop + B * .45, -W * .36); front.add(tank);
  tank.add(pick(new THREE.Mesh(new THREE.BoxGeometry(B * .7, B * .55, B * .45), PM.tank), 'Ausgleichsbehälter', () => `Ausgleichsbehälter · Füllstand ${fmt(snap.coolLevel * 100)} % · ${fmt(snap.coolPress, 1)} bar`));
  const liq = new THREE.Mesh(new THREE.BoxGeometry(B * .66, 1, B * .41), PM.coolant); liq.geometry.translate(0, .5, 0); liq.position.y = -B * .26; tank.add(liq); T.coolTank = liq;
  e3Tube(front, [tank.position.clone().add(V3(-B * .2, -B * .25, 0)), V3(radX + B * .4, yTop + B * .1, -W * .2), V3(radX + B * .2, yTop - B * .05, 0)], B * .04, PM.hose);
  // Thermostatgehäuse am Kopf vorne
  const b0 = T.banks[0];
  const TH = T.layout === 'R' ? V3(minX + B * .05, T.deck + B * .75, 0) : e3ToW(b0.beta, minX + B * .05, T.deck + B * .5, 0);
  const th = cylX(B * .2, B * .35, M.alu, 18); th.position.copy(TH).sub(X.clone().multiplyScalar(B * .15)); front.add(pick(th, 'Thermostat', () => `Thermostat · öffnet ab 83 °C · jetzt ${snap.thermo > .98 ? 'ganz offen' : snap.thermo < .02 ? 'zu (kleiner Kreislauf)' : fmt(snap.thermo * 100) + ' % offen'} · Kühlmittel ${fmt(snap.TbSens)} °C`));
  const thOut = TH.clone().sub(X.clone().multiplyScalar(B * .35));
  const pumpIn = V3(T.beltX + B * .3, T.wpY - B * .3, -B * .25), pumpTop = V3(T.beltX + B * .3, T.wpY + B * .3, B * .1);
  const upper = crv([thOut, thOut.clone().add(V3(-B * .5, B * .25, 0)), V3(radX + B * .9, yTop + B * .05, W * .3), neckIn.clone().add(V3(B * .12, 0, 0))]);
  e3Tube(front, upper, B * .13, PM.hose, 'Oberer Kühlerschlauch', () => `Kühlerschlauch oben (Vorlauf zum Kühler) · ${fmt(snap.TbSens)} °C · ${snap.thermo > .02 ? 'durchströmt' : 'steht'}`).userData.temp = () => snap.TbSens;
  const lower = crv([neckOut.clone().add(V3(B * .12, 0, 0)), V3(radX + B * .9, yBot + B * .1, -W * .3), V3(T.beltX + B * .5, T.wpY - B * .7, -B * .5), pumpIn]);
  e3Tube(front, lower, B * .13, PM.hoseCool, 'Unterer Kühlerschlauch', () => `Kühlerschlauch unten (Rücklauf zur Pumpe) · ${fmt(snap.TbSens - radDT())} °C`).userData.temp = () => snap.TbSens - radDT();
  const byp = crv([thOut.clone().add(V3(0, -B * .1, B * .1)), V3(T.beltX + B * .45, (TH.y + T.wpY) / 2, B * .3), pumpTop]);
  e3Tube(front, byp, B * .075, PM.hose, 'Bypass', () => `Bypass (kleiner Kühlkreislauf) · ${snap.thermo < .98 ? 'durchströmt, solange das Thermostat nicht ganz offen ist' : 'zu'}`);
  // Heizungswärmetauscher hinten
  const hc = new THREE.Mesh(new THREE.BoxGeometry(B * .25, B * .7, B * 1.0), PM.core); hc.position.set(maxX + B * 1.5, T.layout === 'R' ? T.deck + B * 1.0 : P0.y + B * .2, 0); root.add(pick(hc, 'Heizungswärmetauscher', () => `Heizungswärmetauscher · Gebläse ${st.acc && st.acc.blower ? 'an' : 'aus'} · ${fmt(snap.TbSens)} °C`));
  const hStart = T.layout === 'R' ? V3(maxX - B * .1, T.deck + B * .6, B * .25) : e3ToW(b0.beta, maxX - B * .1, T.deck + B * .4, 0);
  const heatA = crv([hStart, hStart.clone().add(V3(B * .6, B * .4, 0)), hc.position.clone().add(V3(-B * .15, B * .2, B * .3))]);
  const heatB = crv([hc.position.clone().add(V3(-B * .15, -B * .2, -B * .3)), V3(maxX + B * .4, T.wpY, -B * .6), V3(cx, T.wpY - B * .2, -T.caseW * .5 - B * .3), pumpIn.clone().add(V3(B * .2, 0, -B * .1))]);
  e3Tube(root, heatA, B * .055, PM.hose, 'Heizungsschlauch', () => 'Heizungsvorlauf');
  e3Tube(root, heatB, B * .055, PM.hose, 'Heizungsschlauch', () => 'Heizungsrücklauf zur Wasserpumpe');
  // Kühlmittelpfade für die Strömungsanzeige
  const circSpeed = k => () => (snap.circ || 0) * k * B * 2.2 * (E3.paused ? 0 : 1);
  for (const bk of T.banks) {
    const pts = [V3(T.beltX + B * .3, T.wpY, 0), e3ToW(bk.beta, bk.x0 + B * .2, T.deck - T.r * 1.0, 0), e3ToW(bk.beta, (bk.x0 + bk.x1) / 2, T.deck - T.r * .9, B * .5), e3ToW(bk.beta, bk.x1 - B * .2, T.deck - T.r * .8, 0), e3ToW(bk.beta, bk.x1 - B * .25, T.deck + B * .3, 0), e3ToW(bk.beta, (bk.x0 + bk.x1) / 2, T.deck + B * .35, -B * .3), e3ToW(bk.beta, bk.x0 + B * .1, T.deck + B * .4, 0), TH.clone()];
    addPath('cool', crv(pts), { temp: () => snap.TbSens - 3, speed: circSpeed(1), spread: B * .25, density: .55 });
  }
  addPath('cool', upper, { temp: () => snap.TbSens, speed: circSpeed(1.2), gate: () => snap.thermo, spread: B * .06, density: .9 });
  for (let k = 0; k < 6; k++) { const zk = -W * .42 + k * W * .84 / 5; addPath('cool', crv([neckIn.clone(), V3(radX, yTop - B * .15, zk), V3(radX, (yTop + yBot) / 2, zk), V3(radX, yBot + B * .15, zk), neckOut.clone()]), { temp: () => snap.TbSens - radDT() * .5, speed: circSpeed(.7), gate: () => snap.thermo, spread: B * .06, density: .5, tempGrad: () => [snap.TbSens, snap.TbSens - radDT()] }); }
  addPath('cool', lower, { temp: () => snap.TbSens - radDT(), speed: circSpeed(1.2), gate: () => snap.thermo, spread: B * .06, density: .9 });
  addPath('cool', byp, { temp: () => snap.TbSens, speed: circSpeed(1.5), gate: () => 1 - snap.thermo, spread: B * .04, density: 1 });
  addPath('cool', heatA, { temp: () => snap.TbSens, speed: circSpeed(.6), spread: B * .03, density: .8 });
  addPath('cool', heatB, { temp: () => snap.TbSens - 6, speed: circSpeed(.6), spread: B * .03, density: .6 });

  /* ---------- Abgaskrümmer, Turbolader, Ladeluftkühler ---------- */
  const exGroup = new THREE.Group(); root.add(exGroup);
  const egt = () => snap.egt || Ta();
  const exT = k => () => Ta() + (egt() - Ta()) * k;
  const exSpeed = (area = 1) => () => { const sl = E3.paused ? 0 : Math.max(1, E3.slow); return clamp(flowLps() * 14 * (273 + egt()) / 293 / area / Math.sqrt(sl), 0, 380); };
  const outs = []; // Startpunkte der Abgasanlage je Strang
  if (P.turbo) {
    const exPorts = cyl.map(c => c.exPort), e = mean(cyl.map(c => c.exDir.clone())).normalize();
    const T0 = mean(exPorts).add(e.clone().multiplyScalar(B * 1.55)).add(DN.clone().multiplyScalar(B * .55)).add(X.clone().multiplyScalar(B * .35));
    const tIn = T0.clone().sub(e.clone().multiplyScalar(B * .55)).add(UP.clone().multiplyScalar(B * .1));
    for (const c of cyl) {
      const a = c.exPort, m1 = a.clone().add(c.exDir.clone().multiplyScalar(B * .4)), m2 = V3(c.x * .45 + tIn.x * .55, tIn.y + B * .15, a.z * .3 + tIn.z * .7);
      const cv = crv([a, m1, m2, tIn]);
      e3Tube(exGroup, cv, B * .12, PM.exMan, 'Abgaskrümmer', () => `Abgaskrümmer Zylinder ${c.i + 1} · ${fmt(egt() + 60)} °C · Auslassventil ${S.valveLift(e3Phi(c), 'ex', 'serie') > .02 ? 'offen' : 'zu'}`);
      addPath('exh', cv, { temp: () => egt() + 70, speed: exSpeed(.3), gate: () => S.valveLift(e3Phi(c), 'ex', 'serie'), density: 1.3, cylI: c.i });
    }
    const tg = new THREE.Group(); tg.position.copy(T0); exGroup.add(tg);
    const vt = voluteGeo(B * .36, B * .07, B * .2), tHouse = new THREE.Mesh(vt.geo, PM.turbine); tg.add(pick(tHouse, 'Turbinengehäuse', () => `Turbine · ${fmt(egt())} °C Abgas · ${fmtK(snap.turboRpm)} U/min · treibt über die Welle den Verdichter`));
    const tBack = cylX(B * .36, B * .12, PM.turbine, 30); tBack.position.x = -B * .12; tg.add(tBack);
    const tOut = cylX(B * .19, B * .45, PM.turbine, 24); tOut.position.x = B * .25; tg.add(tOut);
    e3Tube(exGroup, [tIn, T0.clone().add(V3(0, B * .45, 0)).sub(e.clone().multiplyScalar(B * .05))], B * .14, PM.turbine);
    const tWheel = bladeWheel(B * .27, B * .2, 6, PM.inconel, -.6, B * .1); tWheel.position.x = B * .05; tg.add(tWheel);
    // Lagergehäuse, Öl- und Wasseranschlüsse
    const chra = cylX(B * .17, B * .55, M.iron, 20); chra.position.set(-B * .45, 0, 0); tg.add(pick(chra, 'Turbolader-Lagergehäuse', () => `Lagergehäuse · Welle ${fmtK(snap.turboRpm)} U/min · Öldruck ${fmt(snap.oilP, 1)} bar${st.faults.turboBearing || (snap.dyn && snap.dyn.turboBearing) ? ' · LAGERSPIEL!' : ''}`));
    for (let k = 0; k < 3; k++) { const fn = new THREE.Mesh(new THREE.TorusGeometry(B * .18, B * .02, 6, 24), M.iron); fn.rotation.y = Math.PI / 2; fn.position.x = -B * (.3 + k * .14); tg.add(fn); }
    const oilFeed = e3Tube(tg, [V3(-B * .45, B * .17, 0), V3(-B * .45, B * .8, 0), V3(-B * .6, B * 1.3, -e.z * B * .6)], B * .03, M.steel);
    const oilRet = e3Tube(tg, [V3(-B * .45, -B * .17, 0), V3(-B * .45, -B * .9, -e.z * B * .2), V3(-B * .7, -B * 1.6, -e.z * B * .7)], B * .07, PM.hose);
    // Verdichter
    const cg = new THREE.Group(); cg.position.set(-B * 1.0, 0, 0); tg.add(cg);
    const vc = voluteGeo(B * .42, B * .07, B * .22), cHouse = new THREE.Mesh(vc.geo, PM.comp); cg.add(pick(cHouse, 'Verdichtergehäuse', () => `Verdichter · ${fmt(snap.boost, 2)} bar · Luft ${fmt(Ta())} → ${fmt(T2())} °C durch Verdichtung · ${fmt(mdot())} g/s`));
    const cBack = cylX(B * .42, B * .1, PM.comp, 30); cBack.position.x = B * .12; cg.add(cBack);
    const cInlet = new THREE.Mesh(new THREE.CylinderGeometry(B * .23, B * .3, B * .5, 28, 1, true), PM.comp); cInlet.rotation.z = Math.PI / 2; cInlet.position.x = -B * .3; cg.add(cInlet);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(B * .3, B * .03, 8, 28), PM.compS); lip.rotation.y = Math.PI / 2; lip.position.x = -B * .55; cg.add(lip);
    const cWheel = bladeWheel(B * .24, B * .32, 6, PM.compS, .9, B * .08); cWheel.position.x = -B * .02; cg.add(cWheel);
    // Wastegate-Dose
    const wg = new THREE.Group(); wg.position.set(-B * .9, -B * .55, e.z * B * .2); tg.add(wg);
    wg.add(pick(cylX(B * .17, B * .18, M.dark, 20), 'Wastegate', () => `Wastegate-Dose · öffnet bei Überschreiten des Ladedrucks · Soll ${fmt(P.boostMax * (Object.assign({}, S.TUNE_DEF, st.tune || {})).boost, 2)} bar`));
    const wgRod = cylX(B * .02, B * .75, M.steel, 6); wgRod.position.x = B * .45; wg.add(wgRod);
    T.turbo = { tWheel, cWheel, wgRod, ang: 0 };
    const cOutW = T0.clone().add(V3(-B * 1.0, vc.curve.getPointAt(1).y + B * .05, vc.curve.getPointAt(1).z));
    const cInW = T0.clone().add(V3(-B * 1.6, 0, 0));
    outs.push(T0.clone().add(V3(B * .48, 0, 0)));
    // Ladeluftkühler vor dem Wasserkühler
    const icX = radX - B * .55, icH = H * .48, icY = yBot + icH / 2 + B * .05, icW = W * .92;
    const ic = new THREE.Mesh(new THREE.BoxGeometry(B * .38, icH, icW - B * .5), PM.coreIc); ic.position.set(icX, icY, 0); front.add(pick(ic, 'Ladeluftkühler', () => `Ladeluftkühler · Eintritt ${fmt(T2())} °C → Austritt ${fmt(snap.Tin)} °C`));
    for (const sz of [1, -1]) { const ec = new THREE.Mesh(new THREE.BoxGeometry(B * .45, icH * .9, B * .28), M.alu); ec.position.set(icX, icY, sz * (icW / 2 - B * .1)); front.add(ec); }
    const sgn = Math.sign(e.z) || 1;
    const icIn = V3(icX + B * .2, icY, sgn * icW / 2), icOut = V3(icX + B * .2, icY, -sgn * icW / 2);
    const pipeA = crv([cOutW, cOutW.clone().add(V3(-B * .2, B * .35, sgn * B * .25)), V3(minX - B * .9, cOutW.y, sgn * (icW / 2 + B * .35)), V3(icX + B * .8, icY + icH * .2, sgn * (icW / 2 + B * .35)), icIn]);
    e3Tube(air, pipeA, B * .15, PM.chargeHot, 'Ladeluftrohr (heiß)', () => `Ladeluftrohr vom Verdichter · ${fmt(T2())} °C · ${fmt(snap.boost, 2)} bar`);
    const pipeB = crv([icOut, V3(icX + B * .7, icY + icH * .3, -sgn * (icW / 2 + B * .35)), V3(icX + B * 1.0, airTarget.y, -sgn * (icW / 2 + B * .3)), V3(airTarget.x - B * .9, airTarget.y, airTarget.z), airTarget.clone()]);
    e3Tube(air, pipeB, B * .15, PM.charge, 'Ladeluftrohr (gekühlt)', () => `Ladeluftrohr zum Motor · ${fmt(snap.Tin)} °C · ${fmt(snap.boost, 2)} bar`);
    if (!P.diesel) { const bov = cylY(B * .12, B * .12, B * .25, M.alu, 16); bov.position.copy(pipeB.getPointAt(.75)).add(UP.clone().multiplyScalar(B * .2)); air.add(pick(bov, 'Schubumluftventil', () => 'Schubumluftventil · bläst beim Gaswegnehmen den Ladedruck ab')); }
    addPath('air', pipeA, { temp: T2, speed: airSpeed(.6), density: 1 });
    for (let k = 0; k < 5; k++) { const yk = icY - icH * .4 + k * icH * .2; addPath('air', crv([icIn.clone(), V3(icX, yk, sgn * icW * .3), V3(icX, yk, 0), V3(icX, yk, -sgn * icW * .3), icOut.clone()]), { temp: T2, tempGrad: () => [T2(), snap.Tin ?? 20], speed: airSpeed(1.4), density: .45 }); }
    addPath('air', pipeB, { temp: () => snap.Tin ?? 20, speed: airSpeed(.6), density: 1 });
    if (abOut) {
      const hoseC = crv([abOut, abOut.clone().add(V3(B * .45, 0, 0)), V3(cInW.x - B * .6, (cInW.y + abOut.y) / 2, (abOut.z + cInW.z) / 2), V3(cInW.x - B * .35, cInW.y, cInW.z), cInW.clone().add(V3(B * .1, 0, 0))]);
      e3Tube(air, hoseC, ribbed(B * .2, 14), PM.hose, 'Ansaugschlauch', () => `Ansaugschlauch zum Verdichter · ${fmt(Ta())} °C · ${fmt(mdot())} g/s`, { seg: 140 });
      addPath('air', hoseC, { temp: Ta, speed: airSpeed(.8), density: 1 });
    }
  } else {
    // Saugmotor: Ansaugschlauch zur Drosselklappe, Fächerkrümmer je Bank
    if (abOut) {
      const hoseN = crv([abOut, abOut.clone().add(V3(B * .45, 0, 0)), airTarget.clone().add(V3(-B * .5, B * .15, 0)), airTarget.clone()]);
      e3Tube(air, hoseN, ribbed(B * .2, 9), PM.hose, 'Ansaugschlauch', () => `Ansaugschlauch · ${fmt(Ta())} °C · ${fmt(mdot())} g/s`, { seg: 100 });
      addPath('air', hoseN, { temp: Ta, speed: airSpeed(.8), density: 1 });
    }
    for (const bk of T.banks) {
      const bc = cyl.filter(c => c.b === bk.b), e = bc[0].exDir.clone();
      const down = T.layout === 'R' ? DN.clone() : T.layout === 'V' ? e.clone().multiplyScalar(.5).add(DN).normalize() : DN.clone();
      const colP = mean(bc.map(c => c.exPort)).add(e.clone().multiplyScalar(B * (T.layout === 'B' ? .6 : 1.0))).add(down.clone().multiplyScalar(B * (T.layout === 'B' ? 1.2 : 1.35)));
      const merge = colP.clone().add(down.clone().multiplyScalar(-B * .5));
      for (const c of bc) {
        const a = c.exPort, m1 = a.clone().add(c.exDir.clone().multiplyScalar(B * .45)), m2 = V3(c.x * .35 + colP.x * .65, merge.y + (a.y - merge.y) * .35, merge.z + (a.z - merge.z) * .35);
        const cv = crv([a, m1, a.clone().add(c.exDir.clone().multiplyScalar(B * .6)).add(down.clone().multiplyScalar(B * .45)), m2, merge]);
        e3Tube(exGroup, cv, B * .11, PM.exMan, 'Fächerkrümmer', () => `Fächerkrümmer Zylinder ${c.i + 1} · ${fmt(egt() + 50)} °C · Auslassventil ${S.valveLift(e3Phi(c), 'ex', 'serie') > .02 ? 'offen' : 'zu'}`);
        addPath('exh', cv, { temp: () => egt() + 60, speed: exSpeed(.3), gate: () => S.valveLift(e3Phi(c), 'ex', 'serie'), density: 1.3, cylI: c.i });
      }
      const cone = crv([merge, colP]);
      e3Tube(exGroup, cone, u => B * (.3 - .13 * u), PM.exMan, 'Sammler', () => `Krümmersammler · ${fmt(egt())} °C`, { seg: 12 });
      outs.push(colP);
    }
  }

  /* ---------- Abgasanlage: Hosenrohr, Katalysator, Mittelrohr, Schalldämpfer, Endrohr ---------- */
  const yLow = T.panTop - T.panD - B * .45;
  const strands = T.layout === 'V' ? outs.map(o => [o]) : [outs];
  const sysPaths = [];
  strands.forEach((group, si) => {
    const zS = T.layout === 'V' ? Math.sign(group[0].z) * (T.panW / 2 + B * .55) : T.layout === 'B' ? (T.panW / 2 + B * .55) : Math.sign(group[0].z || 1) * (T.panW / 2 + B * .55);
    const join = V3(maxX - B * .6, yLow, zS);
    group.forEach((o, gi) => {
      const dp = crv([o, o.clone().add(V3(B * .2, -B * .6, 0)), V3((o.x + join.x) / 2, (o.y + yLow) / 2, (o.z + zS) / 2), V3(join.x - B * .9, yLow, zS), join.clone()]);
      e3Tube(exGroup, dp, B * .15, PM.exMid, 'Hosenrohr', () => `Hosenrohr · ${fmt(exT(.88)())} °C`);
      addPath('exh', dp, { temp: exT(.9), speed: exSpeed(.7), density: .9 });
    });
    const catA = join.clone().add(V3(B * .25, 0, 0)), catB = catA.clone().add(V3(B * 1.7, 0, 0));
    e3Tube(exGroup, [join, catA], u => B * (.15 + .25 * u * u), PM.exMid, null, null, { seg: 10 });
    const cat = new THREE.Mesh(new THREE.CapsuleGeometry(B * .42, B * 1.2, 8, 24), PM.cat); cat.rotation.z = Math.PI / 2; cat.position.copy(catA).add(V3(B * .85, 0, 0)); cat.scale.set(1, 1, .75); exGroup.add(pick(cat, 'Katalysator', () => { const t = exT(.8)(); return `Katalysator · ${fmt(t)} °C · ${t > 250 ? 'arbeitet (über 250 °C Anspringtemperatur)' : 'noch kalt, wandelt kaum um'}`; }));
    const lam = cylY(B * .05, B * .05, B * .35, M.steel, 8); lam.position.copy(catA).add(V3(0, B * .4, 0)); exGroup.add(pick(lam, 'Lambdasonde', () => `Lambdasonde · ${snap.rich > .2 ? 'meldet fett' : 'regelt'}`));
    const mufA = catB.clone().add(V3(B * 1.5, 0, 0)), mufLen = B * 2.6;
    const mid = crv([catB, catB.clone().add(V3(B * .6, -B * .05, 0)), mufA]);
    e3Tube(exGroup, mid, B * .14, PM.exMid, 'Mittelrohr', () => `Mittelrohr · ${fmt(exT(.65)())} °C`);
    const flex = e3Tube(exGroup, crv([catB.clone().add(V3(B * .2, 0, 0)), catB.clone().add(V3(B * .7, -B * .02, 0))]), ribbed(B * .17, 10, .12), PM.heatShield, 'Flexrohr', () => 'Flexrohr · entkoppelt die Motorbewegung', { seg: 60 });
    const muf = new THREE.Mesh(new THREE.CapsuleGeometry(B * .62, mufLen - B * 1.24, 8, 28), PM.exCool); muf.rotation.z = Math.PI / 2; muf.position.copy(mufA).add(V3(mufLen / 2, 0, 0)); muf.scale.set(1, .75, 1.25); exGroup.add(pick(muf, 'Schalldämpfer', () => { const ex = (Object.assign({}, S.TUNE_DEF, st.tune || {})).exhaust; return `${ex === 'straight' ? 'Gerades Rohr ohne Dämpfung' : ex === 'sport' ? 'Sport-Schalldämpfer' : 'Serien-Schalldämpfer'} · ${fmt(exT(.45)())} °C`; }));
    const tA = mufA.clone().add(V3(mufLen, 0, 0)), tB = tA.clone().add(V3(B * 1.3, B * .15, 0));
    e3Tube(exGroup, [tA, tA.clone().add(V3(B * .6, 0, 0)), tB], B * .12, PM.exCool, 'Endrohr', () => `Endrohr · ${fmt(exT(.35)())} °C`);
    const tip = cylX(B * .19, B * .45, PM.chrome, 24); tip.position.copy(tB).add(V3(B * .2, 0, 0)); exGroup.add(tip);
    const sys = crv([join, catA, catA.clone().add(V3(B * .85, 0, 0)), catB, mufA, mufA.clone().add(V3(mufLen * .5, 0, 0)), tA, tB.clone().add(V3(B * .45, 0, 0))]);
    sysPaths.push(addPath('exh', sys, { tempGrad: () => [exT(.8)(), exT(.3)()], temp: exT(.6), speed: exSpeed(.8), density: .8, spread: B * .1 }));
  });
  T.exMats = PM;

  /* ---------- Partikel für Luft, Abgas und Kühlmittel ---------- */
  let total = 0;
  for (const p of paths) { p.count = Math.max(3, Math.round(p.len / (B * .28) * p.density)); total += p.count; }
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: B * .55, map: PM.dot, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, sizeAttenuation: true, alphaTest: .05 });
  const pts = new THREE.Points(geo, mat); pts.renderOrder = 10; pts.frustumCulled = false; pts.userData.noPick = true; root.add(pts);
  const parts = []; let k0 = 0;
  for (const p of paths) for (let k = 0; k < p.count; k++) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * p.spread; parts.push({ p, u: k / p.count + Math.random() / p.count, ox: (Math.random() - .5) * p.spread * .4, oy: Math.cos(a) * rr, oz: Math.sin(a) * rr, i: k0++ }); }
  T.flow = { pts, pos, col, parts, geo };
}

function e3PeriphUpdate(T, s, dtR) {
  const PM = T.exMats, B = T.B;
  if (T.turbo) {
    const vis = E3.slow <= 1 ? 1 : 1 / E3.slow;
    T.turbo.ang += clamp(s.turboRpm / 60 * Math.PI * 2 * dtR * vis, 0, .9);
    T.turbo.tWheel.rotation.x = T.turbo.ang; T.turbo.cWheel.rotation.x = T.turbo.ang;
    if (st.faults.turboBearing || (s.dyn && s.dyn.turboBearing)) { T.turbo.cWheel.position.y = Math.sin(T.turbo.ang * 3) * B * .015; }
    T.turbo.wgRod.position.x = B * .45 + clamp(s.boost / (T.P.boostMax || 1) - .85, 0, .3) * B * .4;
  }
  if (T.throttlePlate) T.throttlePlate.rotation.x = Math.max(st.throttle, s.q * .7, .04) * Math.PI / 2 * .95;
  if (T.fan) T.fan.rotation.x += (s.fanOn ? 9 : T.P.sysV === 24 ? s.rpm / 60 * 2 : 0) * dtR * (E3.slow <= 1 ? 1 : .4);
  if (T.coolTank) T.coolTank.scale.y = Math.max(.2, B * .5 * clamp(s.coolLevel, 0, 1.1));
  // Glühen: Krümmer, Turbine, Hosenrohr, Kat
  const egt = s.egt || 20;
  const glow = (m, t) => { const g = clamp((t - 480) / 420, 0, 1); m.emissive.setRGB(g * .95, g * .24, g * .03); };
  glow(PM.exMan, egt + 40); glow(PM.turbine, egt); glow(PM.inconel, egt); glow(PM.exMid, egt * .85); glow(PM.cat, egt * .8 + (egt > 300 ? 40 : 0));
  if (E3.thermal) {
    e3TempColor(egt + 40, PM.exMan.color); e3TempColor(egt * .85, PM.exMid.color); e3TempColor(egt * .45, PM.exCool.color);
    e3TempColor(s.TbSens, PM.hose.color); e3TempColor(s.TbSens - 8 * s.thermo, PM.hoseCool.color);
    const T2 = ((st.ambient ?? 20) + 273) * (1 + (Math.pow(1 + Math.max(0, s.boost), .2857) - 1) / .72) - 273;
    e3TempColor(T2, PM.chargeHot.color); e3TempColor(s.Tin ?? 20, PM.charge.color);
  } else {
    PM.exMan.color.set(0x6b5a4e); PM.exMid.color.set(0x8a8580); PM.exCool.color.set(0x9aa0a6); PM.hose.color.set(0x1a1b1d); PM.hoseCool.color.set(0x1a1b1d); PM.chargeHot.color.set(0xb8bec6); PM.charge.color.set(0xb8bec6);
  }
  // Strömungspartikel
  const F = T.flow; if (!F) return;
  const showAir = E3.flowAir, showCool = E3.flowCool;
  F.pts.visible = showAir || showCool;
  if (!F.pts.visible) return;
  const pos = F.pos, col = F.col, c = new THREE.Color(), dtV = Math.min(dtR, .05);
  for (const p of T.paths) {
    const on = p.kind === 'cool' ? showCool : showAir;
    p._on = on; if (!on) continue;
    p._g = clamp(p.gate(), 0, 1);
    p._v = p.speed() * (p.cylI !== undefined ? (.15 + 2.2 * p._g) : (.3 + .7 * p._g)) / p.len;
    if (p.kind === 'cool') p._v = p.speed() * p._g / p.len;
    p._tg = p.tempGrad ? p.tempGrad() : null; p._t = p._tg ? 0 : p.temp();
    p._bright = p.kind === 'cool' ? (.25 + .75 * p._g) * (s.circ > 0 ? 1 : .35) : (p.cylI !== undefined ? .35 + .65 * p._g : .55 + .45 * Math.min(1, s.rpm / 600));
  }
  for (const q of F.parts) {
    const p = q.p, i3 = q.i * 3;
    if (!p._on) { col[i3] = col[i3 + 1] = col[i3 + 2] = 0; continue; }
    q.u += p._v * dtV; if (q.u >= 1) q.u -= 1;
    const f = q.u * 120, i = f | 0, w = f - i, a = p.pts[i], b = p.pts[Math.min(120, i + 1)];
    pos[i3] = a.x + (b.x - a.x) * w + q.ox; pos[i3 + 1] = a.y + (b.y - a.y) * w + q.oy; pos[i3 + 2] = a.z + (b.z - a.z) * w + q.oz;
    const t = p._tg ? p._tg[0] + (p._tg[1] - p._tg[0]) * q.u : p._t;
    e3TempColor(t, c); const br = p._bright * (p.kind === 'exh' ? 1.3 : 1.1);
    col[i3] = c.r * br; col[i3 + 1] = c.g * br; col[i3 + 2] = c.b * br;
  }
  F.geo.attributes.position.needsUpdate = true; F.geo.attributes.color.needsUpdate = true;
}
