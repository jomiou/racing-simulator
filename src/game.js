import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

await Promise.race([Promise.all(['italic 700 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '500 20px "IBM Plex Mono"'].map(f => document.fonts.load(f))).catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
const S = window.SIM, P = S.P, DEG = S.DEG, clamp = S.clamp;
const T = S.buildTrack();
const N = T.N, L = T.length;
const $ = id => document.getElementById(id);
const approach = (v, t, rate, dt) => v < t ? Math.min(t, v + rate * dt) : Math.max(t, v - rate * dt);
const fmt = t => { if (t == null || !isFinite(t)) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ============================ SETTINGS ============================ */
const DEFAULTS = { padCurve: 1.6, wheelRot: 900, invSteer: false, binds: {}, fov: 62, mirror: true, shadows: true, mph: false, vol: 75, assist: true, easy: true, cam: 0, setup: S.defaultSetup() };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const saved = store.get('hollowmere.settings') || {};
const settings = { ...structuredClone(DEFAULTS), ...saved, setup: { ...S.defaultSetup(), ...(saved.setup || {}) }, binds: { ...(saved.binds || {}) } };
const saveSettings = () => store.set('hollowmere.settings', settings);
// setup revision 2 moved brake bias to a torque split that matches this car's weight transfer
if ((settings.setupRev || 1) < 2) { settings.setup.brakeBias = S.defaultSetup().brakeBias; settings.setupRev = 2; saveSettings(); }
// revision 3: automatic gearbox and keyboard easy mode become the defaults
if (settings.setupRev < 3) { settings.setup.autoShift = true; settings.easy = true; settings.setupRev = 3; saveSettings(); }

/* ============================ RENDERER ============================ */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfdbe6, 450, 4600);
const camera = new THREE.PerspectiveCamera(62, 1, 0.04, 12000);

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function speckle(g, w, h, n, colors, rmin, rmax, rnd) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[(rnd() * colors.length) | 0]; const r = rmin + rnd() * (rmax - rmin); g.fillRect(rnd() * w, rnd() * h, r, r); }
}
const R0 = mulberry32(1234);
const asphaltTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3d4045'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 30000, ['#383b40', '#44474c', '#35383c', '#4a4d52', '#323539'], 1, 2, R0);
  g.globalAlpha = 0.035; for (let i = 0; i < 30; i++) { g.fillStyle = R0() < 0.5 ? '#000' : '#fff'; g.beginPath(); g.ellipse(R0() * w, R0() * h, 20 + R0() * 60, 8 + R0() * 30, R0() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});
const grassTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4f7a34'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,230,0.045)'; g.fillRect(0, 0, w / 2, h);
  speckle(g, w, h, 30000, ['#46702d', '#5a8a3c', '#3f662a', '#628f42', '#557f37'], 1, 2.6, R0);
}, { repeat: [700, 700] });
const gravelTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b7a88a'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 9000, ['#a8987a', '#c9bb9d', '#9a8b6f', '#d6caae', '#8f8166'], 1.5, 3.5, R0);
});
const armcoTex = canvasTex(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#4b5057'; for (const x of [0, 256]) g.fillRect(x + 4, 30, 14, 98);
  const gr = g.createLinearGradient(0, 22, 0, 78);
  gr.addColorStop(0, '#dfe3e6'); gr.addColorStop(0.3, '#9ca3aa'); gr.addColorStop(0.5, '#e8ecef'); gr.addColorStop(0.7, '#8e959c'); gr.addColorStop(1, '#c7ccd1');
  g.fillStyle = gr; g.fillRect(0, 22, w, 56);
}, { srgb: true });
const concreteTex = canvasTex(1024, 128, (g, w, h) => {
  g.fillStyle = '#d9dcd8'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, ['#cfd2ce', '#e4e6e2', '#c4c7c3'], 1, 2, R0);
  g.fillStyle = '#16181b'; g.fillRect(40, 30, 440, 68); g.fillRect(552, 30, 440, 68);
  g.font = 'italic 700 52px "Barlow Condensed", Arial Narrow, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = '#ffc629'; g.fillText('HOLLOWMERE RACING', 260, 66); g.fillStyle = '#ffffff'; g.fillText('HOLLOWMERE GT', 772, 66);
});
const fenceTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,0.9)'; g.lineWidth = 2;
  for (let i = -w; i < w * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
});
const crowdTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2c3440'; g.fillRect(0, 0, w, h);
  const cols = ['#e8e2d0', '#c43b35', '#2f63b8', '#f2c230', '#1f1f1f', '#5d8a4c', '#e07b39', '#ffffff'];
  for (let y = 4; y < h; y += 16) for (let x = 2; x < w; x += 7) { if (R0() < 0.18) continue; g.fillStyle = cols[(R0() * cols.length) | 0]; g.fillRect(x, y + R0() * 2, 5, 7); g.fillStyle = '#e0b38c'; g.fillRect(x + 1, y - 3, 3, 3); }
});

/* ============================ SKY & LIGHT ============================ */
const sunDir = new THREE.Vector3(-0.42, 0.72, -0.55).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(10000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x2f6fc4) }, hor: { value: new THREE.Color(0xcfdbe6) }, sunDir: { value: sunDir } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, top, pow(h, 0.5));
      float s = max(dot(d, sunDir), 0.0);
      c += vec3(1.0,0.92,0.75) * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.18);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);
// image-based lighting: reflections of this sky and a forest-green ground for paint, glass and metal
{
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), sky.material));
  const eg = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: 0x33412c })); eg.rotation.x = -Math.PI / 2; eg.position.y = -3; envScene.add(eg);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
}
scene.add(new THREE.HemisphereLight(0xdde8f5, 0x55653f, 0.6));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.7);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 500 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

/* ============================ TRACK GEOMETRY ============================ */
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (let i = 0; i < N; i++) { minX = Math.min(minX, T.X[i]); maxX = Math.max(maxX, T.X[i]); minZ = Math.min(minZ, T.Z[i]); maxZ = Math.max(maxZ, T.Z[i]); }
const cX = (minX + maxX) / 2, cZ = (minZ + maxZ) / 2;
const at = (i, d) => [T.X[i] + T.NX[i] * d, T.Z[i] + T.NZ[i] * d];
function idxAtS(s) {
  s = ((s % L) + L) % L;
  let i = Math.min(N - 1, Math.floor(s / L * N));
  while (i > 0 && T.S[i] > s) i--;
  while (i < N - 1 && T.S[i + 1] <= s) i++;
  return i;
}
function pointAt(s, d) {
  s = ((s % L) + L) % L; const i = idxAtS(s), j = (i + 1) % N, f = (s - T.S[i]) / T.SEG[i];
  const nx = T.NX[i] + (T.NX[j] - T.NX[i]) * f, nz = T.NZ[i] + (T.NZ[j] - T.NZ[i]) * f;
  return [T.X[i] + (T.X[j] - T.X[i]) * f + nx * d, T.Z[i] + (T.Z[j] - T.Z[i]) * f + nz * d, i, T.Y[i] + (T.Y[j] - T.Y[i]) * f];
}
const hAt = s => S.heightAt(T, s);
function ribbon(i0, count, dA, dB, yA, yB, uvMode) {
  const pos = [], uv = [], idx = [];
  let acc = T.S[i0];
  for (let k = 0; k <= count; k++) {
    const i = (i0 + k) % N;
    if (k > 0) acc += T.SEG[(i0 + k - 1) % N];
    const a = dA(i), b = dB(i), [ax, az] = at(i, a), [bx, bz] = at(i, b);
    pos.push(ax, yA + T.Y[i], az, bx, yB + T.Y[i], bz);
    if (uvMode === 'track') uv.push(a / 6, acc / 6, b / 6, acc / 6);
    else if (uvMode === 'wall') uv.push(acc / 4, 0, acc / 4, 1);
    else if (uvMode === 'wallR') uv.push(-acc / 4, 0, -acc / 4, 1);
    else uv.push(a / 3, acc / 3, b / 3, acc / 3);
    if (k < count) { const o = k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function runs(flag) {
  const out = []; const z0 = Array.prototype.indexOf.call(flag, 0);
  if (z0 < 0) return [[0, N]];
  let start = -1;
  for (let k = 1; k <= N; k++) {
    const i = (z0 + k) % N;
    if (flag[i] && start < 0) start = i;
    if (!flag[i] && start >= 0) { out.push([start, (i - start + N) % N]); start = -1; }
  }
  return out;
}
const KW = T.KERB_W, WL = T.WL, WR = T.WR, edgeW = (side, i) => side ? WR[i] : WL[i];
const inMain = i => T.mainA <= T.mainB ? (i >= T.mainA && i < T.mainB) : (i >= T.mainA || i < T.mainB);
const mainFlag = new Uint8Array(N); for (let i = 0; i < N; i++) mainFlag[i] = inMain(i) ? 1 : 0;
const notMain = new Uint8Array(N); for (let i = 0; i < N; i++) notMain[i] = 1 - mainFlag[i];
const PIT_SIDE = 0, PIT_SG = -1; // the Spa pit lane sits on the left of the start straight

const trackGroup = new THREE.Group(); scene.add(trackGroup);
const surfMat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, envMapIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra });
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* terrain: a height grid that follows the road near the circuit and blends into rolling
   Ardennes hills further out. Built by splatting track samples onto the grid (fast). */
const TERR_HALF = Math.max(maxX - minX, maxZ - minZ) / 2 + 950, FAR_Y = -70, TSEG = 340;
const tStep = 2 * TERR_HALF / TSEG, tN = TSEG + 1, tX0 = cX - TERR_HALF, tZ0 = cZ - TERR_HALF;
const baseH = (x, z) => 26 * Math.sin(x / 420 + 1.3) * Math.cos(z / 510 - 0.4) + 14 * Math.sin((x + z) / 260) + 6 * Math.cos((x - 2 * z) / 170) - 10;
const terrH = new Float32Array(tN * tN), terrD = new Float32Array(tN * tN).fill(1e9);
{
  const R = 380, rc = Math.ceil(R / tStep), samp = []; for (let i = 0; i < N; i += 3) samp.push(i);
  const each = (i, fn) => {
    const x = T.X[i], z = T.Z[i], cx = Math.round((x - tX0) / tStep), cz = Math.round((z - tZ0) / tStep);
    for (let gz = Math.max(0, cz - rc); gz <= Math.min(TSEG, cz + rc); gz++) for (let gx = Math.max(0, cx - rc); gx <= Math.min(TSEG, cx + rc); gx++) {
      const dx = tX0 + gx * tStep - x, dz = tZ0 + gz * tStep - z, d2 = dx * dx + dz * dz;
      if (d2 < R * R) fn(gz * tN + gx, Math.sqrt(d2));
    }
  };
  for (const i of samp) each(i, (v, d) => { if (d < terrD[v]) terrD[v] = d; });
  const ws = new Float32Array(tN * tN), hs = new Float32Array(tN * tN);
  for (const i of samp) each(i, (v, d) => { const dm = terrD[v], lam = 6 + 0.12 * dm; if (d - dm > 5 * lam) return; const w = Math.exp(-(d - dm) / lam); ws[v] += w; hs[v] += w * T.Y[i]; });
  for (let gz = 0; gz < tN; gz++) for (let gx = 0; gx < tN; gx++) {
    const v = gz * tN + gx, x = tX0 + gx * tStep, z = tZ0 + gz * tStep, dm = terrD[v];
    const edge = 1 - smooth(0.8, 0.99, Math.max(Math.abs(x - cX), Math.abs(z - cZ)) / TERR_HALF);
    let h = ws[v] > 0 ? hs[v] / ws[v] : 0;
    h += (baseH(x, z) * edge + FAR_Y * (1 - edge) - h) * smooth(35, 340, dm);
    terrH[v] = h - 0.12 * (1 - smooth(11, 18, dm)) - 0.03;
  }
}
function terrainAt(x, z) {
  const fx = clamp((x - tX0) / tStep, 0, TSEG - 1e-3), fz = clamp((z - tZ0) / tStep, 0, TSEG - 1e-3);
  const gx = Math.floor(fx), gz = Math.floor(fz), u = fx - gx, w = fz - gz, v = gz * tN + gx;
  // match the triangle split used by the mesh (diagonal from (gx+1,gz) to (gx,gz+1))
  if (u + w <= 1) return terrH[v] + (terrH[v + 1] - terrH[v]) * u + (terrH[v + tN] - terrH[v]) * w;
  return terrH[v + tN + 1] + (terrH[v + tN] - terrH[v + tN + 1]) * (1 - u) + (terrH[v + 1] - terrH[v + tN + 1]) * (1 - w);
}
const distToTrack = (x, z) => { const fx = clamp(Math.round((x - tX0) / tStep), 0, TSEG), fz = clamp(Math.round((z - tZ0) / tStep), 0, TSEG); return terrD[fz * tN + fx]; };
{
  const pos = new Float32Array(tN * tN * 3), uv = new Float32Array(tN * tN * 2), idx = [];
  for (let gz = 0; gz < tN; gz++) for (let gx = 0; gx < tN; gx++) {
    const v = gz * tN + gx; pos[v * 3] = tX0 + gx * tStep; pos[v * 3 + 1] = terrH[v]; pos[v * 3 + 2] = tZ0 + gz * tStep;
    uv[v * 2] = gx * tStep / 13; uv[v * 2 + 1] = gz * tStep / 13;
  }
  for (let gz = 0; gz < TSEG; gz++) for (let gx = 0; gx < TSEG; gx++) { const a = gz * tN + gx, b = a + 1, c = a + tN, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const tTex = grassTex.clone(); tTex.repeat.set(1, 1); tTex.needsUpdate = true;
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tTex }));
  terrain.receiveShadow = true; trackGroup.add(terrain);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshLambertMaterial({ map: grassTex }));
  grassTex.repeat.set(1230, 1230);
  ground.rotation.x = -Math.PI / 2; ground.position.set(cX, FAR_Y - 0.05, cZ); ground.receiveShadow = true;
  trackGroup.add(ground);
}
// asphalt, lines, pit lane, gravel
{
  const m = new THREE.Mesh(ribbon(0, N, i => -WL[i], i => WR[i], 0.0, 0.0, 'track'), surfMat(asphaltTex, { roughness: 0.86 }));
  m.receiveShadow = true; trackGroup.add(m);
  for (const [a, n] of runs(mainFlag)) {
    const w0 = i => T.wall[PIT_SIDE][i];
    const pm = new THREE.Mesh(ribbon(a, n, i => PIT_SG * (w0(i) + 12), i => PIT_SG * (w0(i) + 0.4), 0.0, 0.0, 'track'), surfMat(asphaltTex));
    pm.receiveShadow = true; trackGroup.add(pm);
  }
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  trackGroup.add(new THREE.Mesh(ribbon(0, N, i => WR[i] - 0.32, i => WR[i] - 0.1, 0.004, 0.004, 'x'), lineMat));
  trackGroup.add(new THREE.Mesh(ribbon(0, N, i => -(WL[i] - 0.1), i => -(WL[i] - 0.32), 0.004, 0.004, 'x'), lineMat));
  const gMat = surfMat(gravelTex, { roughness: 1 });
  for (let side = 0; side < 2; side++) {
    for (const [a, n] of runs(T.gravel[side])) {
      const inner = i => edgeW(side, i) + KW + 0.5, outer = i => T.wall[side][i] - 0.9;
      const g = side ? ribbon(a, n, inner, outer, 0.0, 0.0, 'x') : ribbon(a, n, i => -outer(i), i => -inner(i), 0.0, 0.0, 'x');
      const mm = new THREE.Mesh(g, gMat); mm.receiveShadow = true; trackGroup.add(mm);
    }
  }
}
// kerbs: 1.25 m red/white blocks; profile matches the physics (SIM.roadInput)
{
  const pos = [], col = [], red = new THREE.Color(0xc41e2a), white = new THREE.Color(0xf1f1ef);
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1;
    for (const [a, n] of runs(T.kerb[side])) {
      const s0 = T.S[a], s1 = s0 + n * (L / N);
      let k = 0;
      for (let s = s0; s < s1; s += 1.25, k++) {
        const c = k % 2 ? white : red, se = Math.min(s + 1.25, s1), w0 = edgeW(side, idxAtS(s)), w1 = edgeW(side, idxAtS(se));
        const prof = [[0, 0.004], [KW * 0.45, 0.05], [KW, 0.012]];
        for (let q = 0; q < 2; q++) {
          const [d0, y0] = prof[q], [d1, y1] = prof[q + 1];
          const A = pointAt(s, sg * (w0 + d0)), B = pointAt(s, sg * (w0 + d1)), C = pointAt(se, sg * (w1 + d0)), D = pointAt(se, sg * (w1 + d1));
          const quad = sg > 0 ? [A, y0, B, y1, C, y0, B, y1, D, y1, C, y0] : [B, y1, A, y0, D, y1, A, y0, C, y0, D, y1];
          for (let v = 0; v < 12; v += 2) { pos.push(quad[v][0], quad[v + 1] + quad[v][3], quad[v][1]); col.push(c.r, c.g, c.b); }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true; trackGroup.add(m);
}
// start/finish line + grid slots
{
  const chk = canvasTex(64, 16, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 4, y * 4, 4, 4); } });
  chk.magFilter = THREE.NearestFilter; chk.repeat.set(1, 1);
  const i = 0, ang = Math.atan2(T.TX[i], T.TZ[i]), [lx, lz] = at(0, (WR[0] - WL[0]) / 2);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(WL[0] + WR[0], 1.2), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  line.rotation.set(-Math.PI / 2, 0, ang); line.position.set(lx, T.Y[i] + 0.006, lz);
  trackGroup.add(line);
  const slotMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (let k = 0; k < 10; k++) {
    const s = -26 - k * 8, d = k % 2 ? 2.8 : -2.8, [x, z, , y] = pointAt(s + 2.3, d);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), slotMat);
    slot.rotation.set(-Math.PI / 2, 0, ang); slot.position.set(x, y + 0.006, z); trackGroup.add(slot);
  }
}
// walls and tyre barriers
{
  const armco = new THREE.MeshStandardMaterial({ map: armcoTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5 });
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.4 });
  concreteTex.repeat.set(0.5, 1);
  const fence = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
  fenceTex.repeat.set(4, 3);
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1, w = i => sg * T.wall[side][i];
    for (const [a, n] of runs(notMain)) {
      const m = new THREE.Mesh(ribbon(a, n, w, w, -0.35, 0.95, side ? 'wallR' : 'wall'), armco); m.castShadow = true; m.receiveShadow = true; trackGroup.add(m);
      trackGroup.add(new THREE.Mesh(ribbon(a, n, w, w, 0.95, 3.2, side ? 'wallR' : 'wall'), fence));
    }
    for (const [a, n] of runs(mainFlag)) {
      const m = new THREE.Mesh(ribbon(a, n, w, w, -0.35, 1.15, side ? 'wallR' : 'wall'), concrete); m.castShadow = true; m.receiveShadow = true; trackGroup.add(m);
      if (side !== PIT_SIDE) trackGroup.add(new THREE.Mesh(ribbon(a, n, w, w, 1.15, 4.2, side ? 'wallR' : 'wall'), fence));
    }
  }
  const spots = [];
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1;
    for (const [a, n] of runs(T.gravel[side])) {
      const s0 = T.S[a], s1 = s0 + n * (L / N);
      for (let s = s0; s < s1; s += 0.66) { const i = idxAtS(s); const [x, z, , y] = pointAt(s, sg * (T.wall[side][i] - 0.42)); spots.push([x, z, spots.length, y]); }
    }
  }
  const tyre = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.92, 10), new THREE.MeshStandardMaterial({ roughness: 0.9, envMapIntensity: 0.2 }), spots.length);
  const mtx = new THREE.Matrix4(), c1 = new THREE.Color(0x1d1e20), c2 = new THREE.Color(0xe9e9e6), c3 = new THREE.Color(0xc22a2a);
  spots.forEach(([x, z, k, y]) => { mtx.makeTranslation(x, y + 0.46, z); tyre.setMatrixAt(k, mtx); tyre.setColorAt(k, (k >> 2) % 6 === 0 ? c2 : (k >> 2) % 6 === 3 ? c3 : c1); });
  tyre.castShadow = true; tyre.receiveShadow = true; trackGroup.add(tyre);
}
// buildings: pit garages, grandstands (start straight, La Source, Raidillon), start gantry
{
  const placeAt = (obj, i, d, y = 0, flip = false) => { const [x, z] = at(i, d); obj.position.set(x, y + T.Y[i], z); obj.rotation.y = Math.atan2(T.TX[i], T.TZ[i]) + (flip ? Math.PI : 0); trackGroup.add(obj); return obj; };
  const pitMat = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.8, envMapIntensity: 0.4 });
  const doorTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 64) { g.fillStyle = '#2b2f36'; g.fillRect(x, 34, 52, 94); g.fillStyle = '#3a404a'; for (let y = 40; y < 128; y += 8) g.fillRect(x + 2, y, 48, 3); }
    g.fillStyle = '#ffc629'; g.fillRect(0, 0, w, 14);
  });
  doorTex.repeat.set(12, 1);
  const mainLen = (T.mainB - T.mainA + N) % N, iPit = (T.mainA + Math.round(mainLen * 0.45)) % N;
  // local +x is the left side of the track; the garage doors face the track (right, -x)
  const pit = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 300), [pitMat, new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8, envMapIntensity: 0.4 }), pitMat, pitMat, pitMat, pitMat]);
  pit.castShadow = true; pit.receiveShadow = true;
  placeAt(pit, iPit, PIT_SG * (T.wall[PIT_SIDE][iPit] + 20), 3.5);
  const standShape = new THREE.Shape([[0, 0], [16, 0], [16, 12], [14.5, 12], [0, 1.2]].map(p => new THREE.Vector2(p[0], p[1])));
  const standMats = [new THREE.MeshStandardMaterial({ color: 0x5b636e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 })];
  crowdTex.repeat.set(0.12, 0.25);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf1f2f3, roughness: 0.5, metalness: 0.2 });
  function stand(i, side, len) {
    const geo = new THREE.ExtrudeGeometry(standShape, { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2);
    const st = new THREE.Mesh(geo, standMats); st.castShadow = true; st.receiveShadow = true;
    const off = T.wall[side][i] + 5;
    // profile x points away from the track: left side as built, right side turned around
    placeAt(st, i, (side ? 1 : -1) * off, -1.2, side === 1);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, len + 2), roofMat);
    placeAt(roof, i, (side ? 1 : -1) * (off + 8), 14.3).castShadow = true;
  }
  for (const f of [0.25, 0.5, 0.75]) stand((T.mainA + Math.round(mainLen * f)) % N, 1 - PIT_SIDE, 70);
  const cn = name => T.corners.find(c => c.name === name);
  if (cn('La Source')) stand(cn('La Source').mid, 0, 60);
  if (cn('Raidillon')) stand((cn('Raidillon').i0 - 20 + N) % N, 0, 80);
  const gMat = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.6, metalness: 0.4 });
  for (const d of [-(WL[0] + 3.2), WR[0] + 3.2]) placeAt(new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.4, 0.5), gMat), 0, d, 3.7).castShadow = true;
  const banner = canvasTex(1024, 128, (g, w, h) => { g.fillStyle = '#15181c'; g.fillRect(0, 0, w, h); g.font = 'italic 700 86px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffc629'; g.fillText('HOLLOWMERE', w / 2 - 120, h / 2 + 4); g.fillStyle = '#fff'; g.fillText('GT', w / 2 + 210, h / 2 + 4); });
  banner.wrapS = banner.wrapT = THREE.ClampToEdgeWrapping;
  const gw = WL[0] + WR[0] + 7;
  const beamM = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.3, 0.5), [gMat, gMat, gMat, gMat, new THREE.MeshStandardMaterial({ map: banner, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: banner, roughness: 0.6 })]);
  placeAt(beamM, 0, (WR[0] - WL[0]) / 2, 7.2).castShadow = true;
}
// brake marker boards
{
  const mats = {};
  for (const lab of ['150', '100', '50']) {
    mats[lab] = new THREE.MeshStandardMaterial({ roughness: 0.7, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#111'; g.font = '700 64px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, w / 2, h / 2 + 3); }) });
  }
  const post = new THREE.MeshStandardMaterial({ color: 0x777c82, roughness: 0.6 });
  for (const b of T.boards) {
    const sg = b.side ? 1 : -1, [x, z] = at(b.i, sg * (edgeW(b.side, b.i) + KW + 3.2));
    const grp = new THREE.Group(); grp.position.set(x, T.Y[b.i], z); grp.rotation.y = Math.atan2(-T.TX[b.i], -T.TZ[b.i]);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mats[b.label]); board.position.y = 1.5; grp.add(board);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), post); p.position.set(0, 0.5, -0.05); grp.add(p);
    board.castShadow = true; trackGroup.add(grp);
  }
}
// Ardennes forest: spruce stands in patches, broadleaf at the fringes; distant hills
{
  const rnd = mulberry32(99), pines = [], rounds = [];
  const patch = (x, z) => Math.sin(x / 140 + 0.7) * Math.cos(z / 170 - 1.1) + 0.6 * Math.sin((x - z) / 90) + 0.35 * Math.cos((x + 2 * z) / 60);
  for (let tries = 0; tries < 60000 && pines.length + rounds.length < 9000; tries++) {
    const x = cX + (rnd() * 2 - 1) * (TERR_HALF - 60), z = cZ + (rnd() * 2 - 1) * (TERR_HALF - 60);
    const md = distToTrack(x, z);
    if (md < 44 || patch(x, z) < -0.15) continue;
    if (md < 90 && rnd() < 0.5) continue;
    const y = terrainAt(x, z) - 0.2;
    (rnd() < 0.78 ? pines : rounds).push([x, z, 0.8 + rnd() * 0.9, rnd() * 6.28, y]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 3, 5); trunkGeo.translate(0, 1.5, 0);
  const pineGeo = new THREE.ConeGeometry(2.4, 11, 7); pineGeo.translate(0, 8.2, 0);
  const roundGeo = new THREE.IcosahedronGeometry(3.4, 1); roundGeo.translate(0, 6, 0);
  const all = [...pines, ...rounds];
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x4d3b2a }), all.length);
  const pineM = new THREE.InstancedMesh(pineGeo, new THREE.MeshLambertMaterial({ color: 0x2b4a2c }), pines.length);
  const roundM = new THREE.InstancedMesh(roundGeo, new THREE.MeshLambertMaterial({ color: 0x4d7a36, flatShading: true }), rounds.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  all.forEach((t, k) => { q.setFromAxisAngle(up, t[3]); sc.set(t[2], t[2], t[2]); p.set(t[0], t[4], t[1]); m.compose(p, q, sc); trunks.setMatrixAt(k, m); });
  pines.forEach((t, k) => { q.setFromAxisAngle(up, t[3]); sc.set(t[2], t[2] * (0.9 + (k % 5) * 0.09), t[2]); p.set(t[0], t[4], t[1]); m.compose(p, q, sc); pineM.setMatrixAt(k, m); pineM.setColorAt(k, col.setHSL(0.33 + (k % 7) * 0.008, 0.32, 0.17 + (k % 5) * 0.018)); });
  rounds.forEach((t, k) => { q.setFromAxisAngle(up, t[3]); sc.set(t[2], t[2] * 0.9, t[2]); p.set(t[0], t[4], t[1]); m.compose(p, q, sc); roundM.setMatrixAt(k, m); roundM.setColorAt(k, col.setHSL(0.24 + (k % 9) * 0.01, 0.4, 0.28 + (k % 4) * 0.03)); });
  for (const im of [trunks, pineM, roundM]) { im.castShadow = true; im.receiveShadow = true; trackGroup.add(im); }
  const seg = 180, rings = 5, pos = [], idx = [], R0 = TERR_HALF * 1.45;
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
    const a = s / seg * Math.PI * 2, rad = R0 + r * 320;
    const hgt = (Math.sin(a * 3 + 1) * 0.5 + Math.sin(a * 7 + 2) * 0.3 + Math.sin(a * 13) * 0.2 + 1) * (r === 0 ? 0 : r === rings ? 110 : 150 + r * 45) * (0.6 + 0.4 * Math.sin(a * 2 + r));
    pos.push(cX + Math.cos(a) * rad, FAR_Y + Math.max(0, hgt), cZ + Math.sin(a) * rad);
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx); hg.computeVertexNormals();
  trackGroup.add(new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ color: 0x3f5a3c, side: THREE.DoubleSide })));
}

/* ============================ CAR MODEL ============================
   Body is lofted from cross-sections along the car (z forward, x left, y up):
   each section is a rounded profile whose width, floor, fender crown and centre
   height come from smooth curves, and which opens into a wheel arch over each wheel. */
const car = new S.Car(T);
car.setup = settings.setup;
function beam(p1, p2, r, mat) {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
// smooth 1-D curve through [z, value] keys (Catmull-Rom style tangents)
function curve(keys) {
  return z => {
    if (z <= keys[0][0]) return keys[0][1];
    const n = keys.length; if (z >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 1; while (keys[i][0] < z) i++;
    const [z0, v0] = keys[i - 1], [z1, v1] = keys[i];
    const m0 = i > 1 ? (v1 - keys[i - 2][1]) / (z1 - keys[i - 2][0]) : (v1 - v0) / (z1 - z0);
    const m1 = i < n - 1 ? (keys[i + 1][1] - v0) / (keys[i + 1][0] - z0) : (v1 - v0) / (z1 - z0);
    const d = z1 - z0, u = (z - z0) / d, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * d * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * d * m1;
  };
}
const ZT = -2.31, ZN = 2.37;
const bodyW = curve([[ZT, 0.83], [-2.22, 0.93], [-2.0, 0.975], [-1.5, 1.0], [-1.24, 1.0], [-0.8, 0.98], [-0.3, 0.955], [0.3, 0.955], [0.8, 0.975], [1.39, 0.99], [1.9, 0.965], [2.2, 0.9], [ZN, 0.76]]);
const bodyFloor = curve([[ZT, 0.36], [-2.0, 0.24], [-1.75, 0.12], [2.0, 0.11], [ZN, 0.17]]);
const bodyCrown = curve([[ZT, 0.84], [-2.05, 0.92], [-1.24, 0.94], [-0.75, 0.87], [-0.1, 0.8], [0.55, 0.78], [1.0, 0.8], [1.39, 0.84], [1.85, 0.75], [2.2, 0.58], [ZN, 0.42]]);
const bodyTop = curve([[ZT, 0.95], [-2.1, 0.94], [-1.7, 0.9], [-1.2, 0.86], [-0.4, 0.8], [0.5, 0.765], [0.9, 0.745], [1.5, 0.665], [2.0, 0.575], [2.28, 0.47], [ZN, 0.4]]);
const ARCH_R = 0.405, WHEEL_Z = [P.a, -P.b];
function archAt(z) {
  let a = 0, yA = 0.345;
  for (const zw of WHEEL_Z) {
    const dz = Math.abs(z - zw);
    if (dz < ARCH_R + 0.07) { const f = dz < ARCH_R ? 1 : 1 - (dz - ARCH_R) / 0.07; if (f > a) { a = f; yA = 0.345 + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - Math.min(dz, ARCH_R) ** 2)); } }
  }
  return [a, yA];
}
// right half of a section (x >= 0), from bottom centre to top centre
function sectionHalf(z) {
  const W = bodyW(z), yB = bodyFloor(z), yS = bodyCrown(z), yT = bodyTop(z), [a, yA] = archAt(z);
  const lerp = (p, q, t) => p + (q - p) * t;
  const p3y = lerp(yB + 0.07, yA, a), p4y = Math.max(lerp(yB + 0.18, yA + 0.025, a), p3y + 0.01);
  const p5y = Math.max(yS - 0.13, p4y + 0.012), p6y = Math.max(yS - 0.035, p5y + 0.01);
  const pts = [
    [0, yB], [lerp(0.78 * W, 0.6, a), yB], [lerp(0.8 * W, 0.6, a), lerp(yB + 0.015, yA, a)],
    [lerp(0.965 * W, W - 0.012, a), p3y], [W, p4y], [W, p5y], [W * 0.985, p6y], [W * 0.9, yS], [W * 0.72, lerp(yS, yT, 0.72)], [W * 0.42, yT + 0.006], [0, yT + 0.012],
  ];
  // one Chaikin pass rounds the corners (keep the floor and centre points fixed)
  const out = [pts[0], pts[1]];
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]); }
  out.push(pts[pts.length - 1]);
  return out;
}
// height of the body's upper surface at (x, z), for placing parts on it
function bodySurfaceY(x, z) {
  const h = sectionHalf(z); x = Math.abs(x);
  for (let i = h.length - 1; i > 0; i--) { const [x0, y0] = h[i], [x1, y1] = h[i - 1]; if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y0 > 0.5) return y0 + (y1 - y0) * ((x - x0) / ((x1 - x0) || 1)); }
  return bodyTop(z);
}
function loft(stations, ringFn, closeEnds) {
  const rings = stations.map(ringFn), M = rings[0].length, pos = [], uv = [], idx = [];
  rings.forEach((ring, si) => {
    let tot = 0; const acc = [0]; for (let k = 1; k < M; k++) { tot += Math.hypot(ring[k][0] - ring[k - 1][0], ring[k][1] - ring[k - 1][1]); acc.push(tot); }
    ring.forEach((p, k) => { pos.push(p[0], p[1], stations[si]); uv.push((stations[si] - stations[0]) / (stations[stations.length - 1] - stations[0]), acc[k] / tot); });
  });
  for (let si = 0; si < stations.length - 1; si++) for (let k = 0; k < M - 1; k++) {
    const a = si * M + k, b = a + 1, c = a + M, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  if (closeEnds) for (const si of [0, stations.length - 1]) {
    const ring = rings[si], cy = ring.reduce((s, p) => s + p[1], 0) / M, ci = pos.length / 3;
    pos.push(0, cy, stations[si]); uv.push(si ? 1 : 0, 0.4);
    for (let k = 0; k < M - 1; k++) { const a = si * M + k; if (si) idx.push(ci, a, a + 1); else idx.push(ci, a + 1, a); }
    for (let k = 0; k < M; k++) uv[(si * M + k) * 2 + 1] = 0.4; // end rings take the plain body colour
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const fullRing = half => { const r = half.slice(); for (let k = half.length - 2; k >= 0; k--) r.push([-half[k][0], half[k][1]]); return r; };

// livery: canvas u = along the car (tail -> nose), v = around the section (right side up, over the top, down the left)
function liveryTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const U = z => (z - ZT) / (ZN - ZT) * W, V = v => (1 - v) * H;
  g.fillStyle = '#16463a'; g.fillRect(0, 0, W, H);
  // bonnet/deck twin stripes along the centre line (v = 0.5)
  g.fillStyle = '#ffc629'; g.fillRect(0, V(0.535), W, V(0.515) - V(0.535)); g.fillRect(0, V(0.485), W, V(0.465) - V(0.485));
  g.fillStyle = '#f2efe6'; g.fillRect(0, V(0.515), W, V(0.485) - V(0.515));
  // lower body in satin black, a yellow flash sweeping up from the sill toward the rear on each side
  g.fillStyle = '#121416'; g.fillRect(0, V(0.13), W, V(0) - V(0.13)); g.fillRect(0, V(1), W, V(0.87) - V(1));
  for (const side of [0, 1]) {
    const vy = v => V(side ? 1 - v : v);
    g.fillStyle = '#ffc629'; g.beginPath();
    g.moveTo(U(1.9), vy(0.13)); g.lineTo(U(-0.2), vy(0.13)); g.lineTo(U(-1.9), vy(0.3)); g.lineTo(U(-2.31), vy(0.3)); g.lineTo(U(-2.31), vy(0.25)); g.lineTo(U(-1.95), vy(0.25)); g.lineTo(U(-0.35), vy(0.165)); g.lineTo(U(1.9), vy(0.165)); g.closePath(); g.fill();
  }
  // door number roundel and names. v < 0.5 is the car's left flank (seen with the nose to the viewer's
  // left, so mirrored in u); v > 0.5 is the right flank (v runs downward there, so flipped in v).
  const sy = (H / 4.0) / (W / (ZN - ZT)); // canvas px per metre differ along u and v; keep shapes round on the body
  const decal = (z, v, draw) => {
    for (const side of [0, 1]) {
      g.save(); g.translate(U(z), V(side ? 1 - v : v)); g.scale(side ? 1 : -1, (side ? -1 : 1) * sy); draw(); g.restore();
    }
  };
  decal(-0.1, 0.235, () => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.fill();
    g.fillStyle = '#111'; g.font = 'italic 700 150px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('27', 0, 8);
  });
  decal(-1.35, 0.2, () => { g.fillStyle = '#f4f1e8'; g.font = 'italic 700 64px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HOLLOWMERE', 0, 0); });
  decal(1.0, 0.21, () => { g.fillStyle = '#f4f1e8'; g.font = '600 38px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GT3 · ARDENNES', 0, 0); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}
function glassTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gz0 = 0.9, gz1 = -2.0, U = z => (z - gz1) / (gz0 - gz1) * W, V = v => (1 - v) * H;
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#0c1216'); grad.addColorStop(0.5, '#141d24'); grad.addColorStop(1, '#0c1216');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // painted roof with the centre stripes, black window frames, sun strip on the screen
  g.fillStyle = '#16463a'; g.fillRect(U(0.02), V(0.72), U(-1.25) - U(0.02), V(0.28) - V(0.72));
  g.fillStyle = '#ffc629'; g.fillRect(U(0.02), V(0.56), U(-1.25) - U(0.02), V(0.53) - V(0.56)); g.fillRect(U(0.02), V(0.47), U(-1.25) - U(0.02), V(0.44) - V(0.47));
  g.fillStyle = '#f2efe6'; g.fillRect(U(0.02), V(0.53), U(-1.25) - U(0.02), V(0.47) - V(0.53));
  g.fillStyle = '#07090b'; g.fillRect(U(0.22), V(0.8), U(0.02) - U(0.22), V(0.2) - V(0.8));
  g.fillStyle = '#f4f1e8'; g.font = 'italic 700 40px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate((U(0.22) + U(0.02)) / 2, V(0.5)); g.rotate(-Math.PI / 2); g.fillText('HOLLOWMERE', 0, 0); g.restore();
  g.fillStyle = '#07090b'; for (const v of [0.02, 0.98]) g.fillRect(0, V(v + 0.02), W, 14);
  g.fillRect(U(-0.72), 0, 16, H); // B-pillar
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}
function rimShape() {
  const sh = new THREE.Shape(); sh.absarc(0, 0, 0.236, 0, Math.PI * 2, false);
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a0 = (k + 0.14) / n * Math.PI * 2, a1 = (k + 0.86) / n * Math.PI * 2;
    const h = new THREE.Path();
    h.moveTo(Math.cos(a0) * 0.085, Math.sin(a0) * 0.085);
    h.absarc(0, 0, 0.212, a0 + 0.03, a1 - 0.03, false);
    h.lineTo(Math.cos(a1) * 0.085, Math.sin(a1) * 0.085);
    h.absarc(0, 0, 0.085, a1, a0, true);
    sh.holes.push(h);
  }
  return sh;
}
function tyreSidewallTexture() {
  // lathe v runs across the profile: the outer 20 % on each end is sidewall, the middle is tread
  const c = document.createElement('canvas'); c.width = 2048; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#18191b'; g.fillRect(0, 0, 2048, 320);
  g.fillStyle = '#d9d6cc'; g.font = '700 30px "Barlow Condensed", Arial Narrow, sans-serif'; g.textBaseline = 'middle';
  for (const y of [34, 286]) for (const x of [80, 1104]) { g.fillText('HOLLOWMERE  RACING SLICK', x, y); g.fillText('305/680 R18', x + 520, y); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.wrapS = THREE.RepeatWrapping;
  return t;
}
const carParts = (() => {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ map: liveryTexture(), metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x131518, roughness: 0.42, metalness: 0.35 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.7, metalness: 0.1 });
  const glass = new THREE.MeshPhysicalMaterial({ map: glassTexture(), metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 });
  const add = (m, cast = true, parent = body) => { m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  // body shell
  const st = []; for (let z = ZT; z <= ZN + 1e-6; z += 0.03) st.push(Math.min(z, ZN));
  add(new THREE.Mesh(loft(st, z => fullRing(sectionHalf(z)), true), paint));
  // glasshouse: windscreen, side glass and painted roof in one lofted shell
  const ghRoof = curve([[-2.0, 0.9], [-1.7, 0.975], [-1.3, 1.08], [-0.85, 1.17], [-0.4, 1.185], [0.05, 1.155], [0.3, 1.06], [0.62, 0.9], [0.9, 0.765]]);
  const ghHalf = z => {
    const yb = Math.min(bodyTop(z), bodyCrown(z)) - 0.02, yr = Math.max(ghRoof(z), yb + 0.02), h = yr - yb;
    const wb = 0.74 - Math.max(0, z - 0.5) * 0.25 - Math.max(0, -1.3 - z) * 0.35, wr = Math.min(wb - 0.02, 0.52);
    return [[wb, yb], [wb - 0.035, yb + h * 0.4], [wr + 0.05, yr - 0.045], [wr * 0.7, yr - 0.012], [0, yr]];
  };
  const gst = []; for (let z = 0.9; z >= -2.0 - 1e-6; z -= 0.03) gst.push(z);
  gst.reverse();
  add(new THREE.Mesh(loft(gst, z => fullRing(ghHalf(z)), false), glass));
  // aero: splitter, canards, diffuser with fins, side skirts, hood vents
  const splitter = add(new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.028, 0.4), carbon)); splitter.position.set(0, 0.095, 2.2);
  for (const sx of [-1, 1]) {
    const cnd = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), carbon)); cnd.position.set(sx * 0.9, 0.36, 2.1); cnd.rotation.set(0.15, sx * 0.3, sx * -0.18);
    const skirt = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.72), carbon)); skirt.position.set(sx * 0.97, 0.15, 0.08);
    const vent = add(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), satin), false);
    const vz = 1.72, vx = sx * 0.34, vy = bodySurfaceY(vx, vz);
    vent.position.set(vx, vy + 0.006, vz); vent.rotation.set(-Math.PI / 2 + Math.atan2(bodySurfaceY(vx, vz + 0.1) - bodySurfaceY(vx, vz - 0.1), 0.2), 0, 0);
  }
  const diff = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.46), carbon)); diff.position.set(0, 0.2, -2.12); diff.rotation.x = -0.22;
  for (let k = -2; k <= 2; k++) { const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.42), carbon)); fin.position.set(k * 0.3, 0.2, -2.14); fin.rotation.x = -0.22; }
  const grille = add(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.15, 0.06), satin), false); grille.position.set(0, 0.26, 2.33);
  // rear wing: aerofoil section on swan-neck mounts
  const af = new THREE.Shape(); const chord = 0.34;
  // inverted aerofoil: flat top, cambered underside (the suction side)
  af.moveTo(0, 0); for (let t = 0; t <= 1.0001; t += 0.1) af.lineTo(t * chord, 0.012 * chord * Math.sin(Math.PI * t)); for (let t = 1; t >= -0.0001; t -= 0.1) af.lineTo(t * chord, -0.06 * chord * Math.sqrt(t) * (1 - t) * 3.2);
  const wingGeo = new THREE.ExtrudeGeometry(af, { depth: 1.84, bevelEnabled: false }); wingGeo.translate(0, 0, -0.92); wingGeo.rotateY(Math.PI / 2);
  const wing = add(new THREE.Mesh(wingGeo, carbon)); wing.position.set(0, 1.21, -1.93); wing.rotation.x = 0.16 + settings.setup.wing * 0.02;
  for (const sx of [-1, 1]) {
    const ep = add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.3, 0.46), carbon)); ep.position.set(sx * 0.93, 1.19, -2.06);
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.36, 0.9, -1.82), new THREE.Vector3(sx * 0.36, 1.12, -1.84), new THREE.Vector3(sx * 0.36, 1.3, -1.95), new THREE.Vector3(sx * 0.36, 1.27, -2.08)]);
    add(new THREE.Mesh(new THREE.TubeGeometry(neck, 16, 0.016, 6), carbon));
    const neckPlate = add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.2), carbon)); neckPlate.position.set(sx * 0.36, 1.13, -1.9);
  }
  // lights, mirrors, exhausts, tow hooks
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 2.2, roughness: 0.2 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa4ad, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 0.8 });
  for (const sx of [-1, 1]) {
    const hz = 2.08, hx = sx * 0.66, hy = bodySurfaceY(hx, hz), slope = Math.atan2(bodySurfaceY(hx, hz + 0.1) - bodySurfaceY(hx, hz - 0.1), 0.2);
    const hl = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), headMat), false); hl.position.set(hx, hy - 0.004, hz); hl.rotation.x = -slope;
    const lens = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.012, 0.26), lensMat), false); lens.position.set(hx, hy + 0.01, hz); lens.rotation.x = -slope;
    const mirG = new THREE.SphereGeometry(0.1, 16, 10); mirG.scale(1, 0.55, 0.7);
    const mir = add(new THREE.Mesh(mirG, paint)); mir.position.set(sx * 1.02, 0.9, 0.52);
    add(beam([sx * 0.75, 0.82, 0.55], [sx * 0.97, 0.89, 0.53], 0.012, carbon));
    const ex = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.14, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x8e8479, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide })), false);
    ex.rotation.x = Math.PI / 2; ex.position.set(sx * 0.22, 0.27, -2.28);
  }
  const tail = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.03), tailMat), false); tail.position.set(0, 0.84, -2.3);
  for (const sx of [-1, 1]) { const tl = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.03), tailMat), false); tl.position.set(sx * 0.66, 0.78, -2.29); }
  const rain = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), tailMat), false); rain.position.set(0, 0.36, -2.34);
  const hookMat = new THREE.MeshStandardMaterial({ color: 0xe0321e, roughness: 0.5 });
  for (const z of [2.36, -2.33]) { const hk = add(new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), hookMat), false); hk.position.set(0.5, 0.2, z); }
  const scoop = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.22), carbon)); scoop.position.set(0, 1.2, -0.25);
  // wheels: lathed tyre with rounded shoulders and sidewall lettering, 10-spoke rim, drilled disc, caliper
  const prof = [[0.232, 0.132], [0.27, 0.142], [0.305, 0.15], [0.33, 0.145], [0.343, 0.125], [0.345, 0.0], [0.343, -0.125], [0.33, -0.145], [0.305, -0.15], [0.27, -0.142], [0.232, -0.132]];
  const tyreGeo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 48); tyreGeo.rotateZ(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ map: tyreSidewallTexture(), roughness: 0.88, metalness: 0 });
  const rimGeo = new THREE.ExtrudeGeometry(rimShape(), { depth: 0.018, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 40 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.85, roughness: 0.3 });
  const barrelGeo = new THREE.CylinderGeometry(0.234, 0.234, 0.26, 36, 1, true); barrelGeo.rotateZ(Math.PI / 2);
  const discTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f7275'; g.fillRect(0, 0, w, h); g.fillStyle = '#4c4f53';
    for (let r = 50; r < 120; r += 16) for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2 + r * 0.03; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3, 0, 7); g.fill(); }
    g.fillStyle = '#35383c'; g.beginPath(); g.arc(128, 128, 46, 0, 7); g.fill();
  });
  const discGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.034, 32); discGeo.rotateZ(Math.PI / 2);
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.35, metalness: 0.2 });
  const nutMat = new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.4, metalness: 0.5 });
  const wheels = car.wheels.map((wh) => {
    const hub = new THREE.Group(); hub.position.set(-wh.py, P.R, wh.px); root.add(hub);
    const out = -wh.py > 0 ? 1 : -1;
    const spin = new THREE.Group(); hub.add(spin);
    add(new THREE.Mesh(tyreGeo, tyreMat), true, spin);
    const rim = add(new THREE.Mesh(rimGeo, rimMat), false, spin); rim.rotation.y = out * Math.PI / 2; rim.position.x = out * 0.1;
    add(new THREE.Mesh(barrelGeo, rimMat), false, spin);
    const nut = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6), nutMat), false, spin); nut.rotation.z = Math.PI / 2; nut.position.x = out * 0.13;
    const disc = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.6, roughness: 0.45, emissive: 0xff4a00, emissiveIntensity: 0 }));
    disc.position.x = out * 0.02; spin.add(disc);
    const cal = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.22), caliperMat), false, hub); cal.position.set(out * 0.045, 0.1, -0.1); cal.rotation.x = 0.5;
    return { hub, spin, disc };
  });
  // cockpit interior (only drawn in the cockpit view)
  const interior = new THREE.Group(); body.add(interior);
  const trim = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.85 });
  const cage = new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.5, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffc629, roughness: 0.35 });
  const box = (w, h, d, x, y, z, mat = trim) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); interior.add(m); return m; };
  box(1.3, 0.16, 0.42, 0, 0.75, 0.66);
  box(0.42, 0.07, 0.2, 0.37, 0.84, 0.54).rotation.x = -0.25;
  box(1.0, 0.03, 1.0, 0, 1.16, -0.42);
  box(0.94, 0.06, 0.08, 0, 1.13, 0.06);
  for (const sx of [-1, 1]) {
    interior.add(beam([sx * 0.66, 0.77, 0.84], [sx * 0.5, 1.14, 0.07], 0.026, trim));
    interior.add(beam([sx * 0.56, 0.35, -0.6], [sx * 0.48, 1.12, -0.6], 0.025, cage));
    box(0.05, 0.3, 1.6, sx * 0.64, 0.66, -0.05);
    interior.add(beam([sx * 0.6, 0.55, 0.55], [sx * 0.6, 0.55, -0.6], 0.02, cage));
  }
  interior.add(beam([-0.48, 1.12, -0.6], [0.48, 1.12, -0.6], 0.025, cage));
  interior.add(beam([-0.48, 1.12, -0.6], [0.5, 0.4, -0.6], 0.022, cage));
  interior.add(beam([0.37, 0.76, 0.62], [0.37, 0.725, 0.42], 0.025, trim));
  const wheelG = new THREE.Group(); wheelG.position.set(0.37, 0.72, 0.4); wheelG.rotation.x = -0.28; interior.add(wheelG);
  const swheel = new THREE.Group(); wheelG.add(swheel);
  const grip = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.95 });
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.019, 10, 40, Math.PI * 1.35), grip); rimT.rotation.z = -Math.PI * 0.175; swheel.add(rimT);
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), grip); flat.position.y = -0.125; swheel.add(flat);
  const hubBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.04), trim); swheel.add(hubBox);
  for (const sx of [-1, 1]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.025), cage); sp.position.set(sx * 0.12, 0, 0); swheel.add(sp); }
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.04), accent); mark.position.y = 0.165; swheel.add(mark);
  const lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 256; lcdCanvas.height = 128;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
  lcd.position.set(0, 0.005, -0.021); lcd.rotation.y = Math.PI; swheel.add(lcd);
  const mirrorMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mirrorMesh.position.set(0.02, 1.065, 0.2); mirrorMesh.rotation.set(-0.08, Math.PI - 0.16, 0); interior.add(mirrorMesh);
  box(0.28, 0.085, 0.02, 0.02, 1.065, 0.21).rotation.set(-0.08, -0.16, 0);
  // driver: helmet and shoulders, seen through the glass from outside
  const driver = new THREE.Group(); body.add(driver);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.25, clearcoat: 1 }));
  helmet.position.set(0.37, 1.0, -0.14); driver.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.142, 20, 10, -0.9, 1.8, 1.2, 0.55), new THREE.MeshStandardMaterial({ color: 0x111418, metalness: 0.6, roughness: 0.1 }));
  visor.position.copy(helmet.position); visor.rotation.y = 0; driver.add(visor);
  const suit = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x1d4f3f, roughness: 0.8 })); suit.position.set(0.37, 0.76, -0.22); driver.add(suit);
  interior.visible = false;
  scene.add(root);
  return { root, body, wheels, interior, driver, swheel, lcdCanvas, lcdTex, mirrorMesh, tailMat, wing };
})();

/* ============================ MIRROR ============================ */
const mirrorRT = new THREE.WebGLRenderTarget(1024, 256, { samples: 2 });
mirrorRT.texture.repeat.set(-1, 1); mirrorRT.texture.offset.set(1, 0);
const mirrorCam = new THREE.PerspectiveCamera(19, 4, 0.2, 2500);
carParts.mirrorMesh.material.map = mirrorRT.texture; carParts.mirrorMesh.material.needsUpdate = true;
const overlayScene = new THREE.Scene(), overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: mirrorRT.texture })));

/* ============================ PARTICLES & SKID MARKS ============================ */
const SMOKE = 320;
const smoke = { pos: new Float32Array(SMOKE * 3), vel: new Float32Array(SMOKE * 3), size: new Float32Array(SMOKE), alpha: new Float32Array(SMOKE), col: new Float32Array(SMOKE * 3), life: new Float32Array(SMOKE), max: new Float32Array(SMOKE), next: 0 };
const smokeGeo = new THREE.BufferGeometry();
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smoke.pos, 3));
smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(smoke.size, 1));
smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(smoke.alpha, 1));
smokeGeo.setAttribute('aCol', new THREE.BufferAttribute(smoke.col, 3));
const smokePts = new THREE.Points(smokeGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { scale: { value: 600 } },
  vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float scale; void main(){ vA = aAlpha; vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * scale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * (1.0 - r * 4.0)); }',
}));
smokePts.frustumCulled = false; scene.add(smokePts);
function puff(x, y, z, vx, vz, strength, dusty) {
  const k = smoke.next; smoke.next = (k + 1) % SMOKE;
  smoke.pos.set([x, y, z], k * 3); smoke.vel.set([vx * 0.25 + (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, vz * 0.25 + (Math.random() - 0.5) * 1.2], k * 3);
  smoke.life[k] = 0; smoke.max[k] = 1.4 + strength * 1.6; smoke.size[k] = 0.6;
  if (dusty) smoke.col.set([0.55, 0.47, 0.36], k * 3); else smoke.col.set([0.86, 0.87, 0.88], k * 3);
  smoke.alpha[k] = 0.001 + strength * 0.5;
}
function updateSmoke(dt) {
  for (let k = 0; k < SMOKE; k++) {
    if (smoke.life[k] >= smoke.max[k]) { smoke.alpha[k] = 0; continue; }
    smoke.life[k] += dt; const f = smoke.life[k] / smoke.max[k];
    for (let a = 0; a < 3; a++) smoke.pos[k * 3 + a] += smoke.vel[k * 3 + a] * dt;
    smoke.vel[k * 3] *= 1 - dt * 1.5; smoke.vel[k * 3 + 2] *= 1 - dt * 1.5;
    smoke.size[k] = 0.6 + f * 4.5;
    smoke.alpha[k] = Math.max(0, smoke.alpha[k] - dt * 0.3 * (1 + f));
  }
  smokeGeo.attributes.position.needsUpdate = true; smokeGeo.attributes.aSize.needsUpdate = true; smokeGeo.attributes.aAlpha.needsUpdate = true; smokeGeo.attributes.aCol.needsUpdate = true;
}
const SKID = 4000;
const skidPos = new Float32Array(SKID * 18), skidCol = new Float32Array(SKID * 24);
const skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
skidGeo.setAttribute('color', new THREE.BufferAttribute(skidCol, 4));
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
skidMesh.frustumCulled = false; scene.add(skidMesh);
let skidNext = 0, skidDirty = false;
const skidLast = [null, null, null, null];
function addSkid(n, x, z, hx, hz, a, gy) {
  const last = skidLast[n];
  if (!last) { skidLast[n] = [x, z, gy]; return; }
  const dx = x - last[0], dz = z - last[1]; const d2 = dx * dx + dz * dz;
  if (d2 < 0.35 * 0.35) return;
  if (d2 > 4) { skidLast[n] = [x, z, gy]; return; }
  const w = 0.14, px = hz * w, pz = -hx * w, y = gy + 0.008, y0 = last[2] + 0.008, k = skidNext; skidNext = (k + 1) % SKID;
  const v = [last[0] - px, y0, last[1] - pz, last[0] + px, y0, last[1] + pz, x - px, y, z - pz, last[0] + px, y0, last[1] + pz, x + px, y, z + pz, x - px, y, z - pz];
  skidPos.set(v, k * 18);
  for (let q = 0; q < 6; q++) skidCol.set([0.02, 0.02, 0.02, a], k * 24 + q * 4);
  skidLast[n] = [x, z, gy]; skidDirty = true;
}

/* ============================ AUDIO ============================ */
class Sound {
  constructor() { this.ctx = null; this.popT = 0; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = settings.vol / 100;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    this.master.connect(comp); comp.connect(ctx.destination);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, Math.random() * 1.9); return s; };
    const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    // engine: cam-order fundamental with a V8 harmonic profile (firing order = 8th)
    const H = 48, re = new Float32Array(H), im = new Float32Array(H);
    const amp = { 1: 0.22, 2: 0.4, 3: 0.18, 4: 0.75, 5: 0.12, 6: 0.3, 7: 0.1, 8: 1, 9: 0.12, 10: 0.22, 12: 0.4, 14: 0.12, 16: 0.55, 20: 0.16, 24: 0.28, 32: 0.14, 40: 0.06 };
    for (let h = 1; h < H; h++) im[h] = amp[h] ?? 0.035;
    this.eo = ctx.createOscillator(); this.eo.setPeriodicWave(ctx.createPeriodicWave(re, im, { disableNormalization: false }));
    this.eo2 = ctx.createOscillator(); this.eo2.type = 'sawtooth';
    const shaper = ctx.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2); } shaper.curve = curve;
    this.eFilt = filt('lowpass', 1500, 0.9); this.eGain = gain(0);
    this.eo.connect(gain(0.7)).connect(shaper); this.eo2.connect(gain(0.06)).connect(shaper);
    shaper.connect(this.eFilt).connect(this.eGain).connect(this.master);
    this.iFilt = filt('bandpass', 400, 1.2); this.iGain = gain(0); noise().connect(this.iFilt).connect(this.iGain).connect(this.master);
    this.eo.start(); this.eo2.start();
    // tyres
    this.tGain = gain(0); this.tF1 = filt('bandpass', 950, 7); this.tF2 = filt('bandpass', 1550, 11);
    const tn = noise(); tn.connect(this.tF1).connect(this.tGain); tn.connect(this.tF2).connect(this.tGain); this.tGain.connect(this.master);
    this.lGain = gain(0); noise().connect(filt('bandpass', 520, 2)).connect(this.lGain).connect(this.master);
    // wind, kerb rumble, gravel
    this.wGain = gain(0); noise().connect(filt('lowpass', 420, 0.5)).connect(this.wGain).connect(this.master);
    this.rOsc = ctx.createOscillator(); this.rOsc.type = 'square'; this.rGain = gain(0); this.rOsc.connect(filt('lowpass', 160, 1)).connect(this.rGain).connect(this.master); this.rOsc.start();
    this.gGain = gain(0); noise().connect(filt('bandpass', 1900, 0.5)).connect(this.gGain).connect(this.master);
    this.bump = gain(0); noise().connect(filt('lowpass', 90, 1)).connect(this.bump).connect(this.master);
  }
  burst(freq, dur, g, type = 'lowpass') {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const gg = ctx.createGain();
    gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(gg).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  thump(g) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), gg = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(gg).connect(this.master); o.start(t); o.stop(t + 0.16);
  }
  update(dt, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.03;
    this.master.gain.setTargetAtTime(active ? settings.vol / 100 : 0, t, 0.08);
    const rpm = car.rpm, thr = car.thrEff || 0, spd = car.speed;
    this.eo.frequency.setTargetAtTime(Math.max(6, rpm / 120), t, 0.012);
    this.eo2.frequency.setTargetAtTime(Math.max(20, rpm / 15), t, 0.012);
    const load = 0.25 + 0.75 * thr;
    this.eGain.gain.setTargetAtTime(0.1 + 0.26 * load * (0.55 + rpm / 17000), t, k);
    this.eFilt.frequency.setTargetAtTime(350 + rpm * 0.22 + thr * 2600, t, k);
    this.iFilt.frequency.setTargetAtTime(200 + rpm * 0.12, t, k);
    this.iGain.gain.setTargetAtTime(thr * 0.06 * (rpm / 8000), t, k);
    let sq = 0, lock = 0, kerb = 0, off = 0;
    for (const wh of car.wheels) {
      const sl = Math.hypot(wh.w * P.R - wh.Vx, wh.Vy);
      const ld = Math.min(1.4, wh.Fz / 3500);
      if (wh.surf.id <= 1) { sq += clamp((wh.util - 0.82) * 1.6, 0, 1.2) * ld * clamp(sl / 3, 0, 1); if (wh.k < -0.3) lock += ld; }
      if (wh.surf.id === 1) kerb++;
      if (wh.surf.id >= 2) off += 1;
    }
    sq *= clamp(spd / 6, 0, 1);
    this.tGain.gain.setTargetAtTime(Math.min(0.55, sq * 0.22), t, 0.04);
    this.tF1.frequency.setTargetAtTime(850 + 180 * Math.min(1, sq), t, 0.05);
    this.lGain.gain.setTargetAtTime(Math.min(0.4, lock * 0.12 * clamp(spd / 10, 0, 1)), t, 0.03);
    this.wGain.gain.setTargetAtTime(0.28 * (spd / 80) ** 2, t, 0.1);
    this.rOsc.frequency.setTargetAtTime(Math.max(8, spd / 1.25), t, 0.02);
    this.rGain.gain.setTargetAtTime(kerb * 0.1 * clamp(spd / 10, 0, 1), t, 0.02);
    this.gGain.gain.setTargetAtTime(off * 0.05 * clamp(spd / 15, 0, 1), t, 0.05);
    this.bump.gain.setTargetAtTime(off * 0.12 * clamp(spd / 20, 0, 1), t, 0.05);
    // overrun pops
    this.popT -= dt;
    if (active && thr < 0.05 && rpm > 4800 && this.popT <= 0 && Math.random() < dt * 7) { this.burst(700 + Math.random() * 500, 0.06, 0.35 + Math.random() * 0.3); this.popT = 0.05; }
  }
}
const sound = new Sound();

/* ============================ INPUT ============================ */
const keys = new Set();
const kb = { thr: 0, brk: 0, steer: 0 };
const input = { steer: 0, throttle: 0, brake: 0, clutch: 0 };
let lastSteerSrc = 'kb', padSteerSm = 0, lookYaw = 0, revHold = 0, fwdHold = 0;
const padPrev = new Map();
function pads() { const out = []; const list = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of list) if (g && g.connected) out.push(g); return out; }
const padById = id => pads().find(g => g.id === id);
function steerLimit(v, beta, dir) {
  const dmax = P.steerLock * DEG / P.steerRatio;
  // extra lock is only granted in the countersteer direction
  const d = P.L * 1.9 * 9.81 / Math.max(v * v, 1) + 1.05 * S.A_PEAK + (dir * beta > 0 ? Math.abs(beta) * 1.1 : 0);
  return clamp(d / dmax, 0.22, 1);
}
function pedal(b, gp) { if (!b || !gp) return 0; const v = gp.axes[b.axis]; if (v === undefined) return 0; return clamp((v - b.rest) / (b.full - b.rest || 1), 0, 1); }
function carBeta() { const vl = car.fwdSpeed(), vlat = -car.vx * Math.cos(car.psi) + car.vz * Math.sin(car.psi); return car.speed > 2 ? Math.atan2(vlat, Math.abs(vl)) : 0; }
function updateInput(dt) {
  const up = keys.has('KeyW') || keys.has('ArrowUp'), dn = keys.has('KeyS') || keys.has('ArrowDown');
  const lf = keys.has('KeyA') || keys.has('ArrowLeft'), rt = keys.has('KeyD') || keys.has('ArrowRight');
  kb.thr = approach(kb.thr, up ? 1 : 0, up ? (settings.easy ? 2.2 : 3.2) : 9, dt);
  kb.brk = approach(kb.brk, dn ? 1 : 0, dn ? 4.5 : 10, dt);
  const beta = carBeta(), spd = car.speed;
  const dir = (rt ? 1 : 0) - (lf ? 1 : 0);
  const lim = settings.assist ? steerLimit(spd, beta, dir) : 1, target = dir * lim;
  const rate = dir === 0 ? 3.4 : (kb.steer * dir < 0 ? 5 : 2.3);
  kb.steer = approach(kb.steer, target, rate, dt);
  if (dir) lastSteerSrc = 'kb';
  let thr = kb.thr, brk = kb.brk, clu = 0, steer = kb.steer;
  let digiThr = thr, digiBrk = brk;
  const B = settings.binds;
  // standard-mapping gamepads
  for (const gp of pads()) {
    if (gp.mapping !== 'standard' || (B.steer && B.steer.id === gp.id)) continue;
    let x = gp.axes[0] || 0; const dz = 0.06;
    x = Math.abs(x) < dz ? 0 : Math.sign(x) * ((Math.abs(x) - dz) / (1 - dz)) ** settings.padCurve;
    if (Math.abs(x) > 0.02) lastSteerSrc = 'pad';
    const lim2 = settings.assist ? steerLimit(spd, beta, Math.sign(x)) : 1;
    padSteerSm = approach(padSteerSm, x * lim2, 7, dt);
    if (lastSteerSrc === 'pad') steer = padSteerSm;
    thr = Math.max(thr, gp.buttons[7]?.value || 0); brk = Math.max(brk, gp.buttons[6]?.value || 0);
    digiThr = thr; digiBrk = brk;
    const prev = padPrev.get(gp.index) || [];
    const edge = b => gp.buttons[b]?.pressed && !prev[b];
    if (edge(5) || edge(0)) doShift(1);
    if (edge(4) || edge(2)) doShift(-1);
    if (edge(3)) setCam(camIdx + 1);
    if (edge(8)) resetCar();
    if (edge(9)) togglePause();
    padPrev.set(gp.index, gp.buttons.map(b => b.pressed));
  }
  // reverse, arcade style for keys and gamepads: hold brake at a standstill to select R,
  // then brake drives backwards and throttle brakes; throttle at a standstill selects 1st again
  let pedThr = 0, pedBrk = 0;
  if (B.thr) pedThr = pedal(B.thr, padById(B.thr.id));
  if (B.brk) pedBrk = pedal(B.brk, padById(B.brk.id));
  const stopped = Math.abs(car.fwdSpeed()) < 0.8 && car.shiftT <= 0;
  if (car.gear !== -1) {
    if (stopped && digiBrk > 0.5 && digiThr < 0.05 && pedThr < 0.05) { revHold += dt; if (revHold > 0.45) { revHold = 0; if (car.selectGear(-1)) toast('Reverse', 800); } } else revHold = 0;
    thr = Math.max(digiThr, pedThr); brk = Math.max(digiBrk, pedBrk);
  } else {
    thr = Math.max(Math.min(digiBrk, 0.45), pedThr); brk = Math.max(digiThr, pedBrk);
    if (stopped && digiThr > 0.5 && digiBrk < 0.05) { fwdHold += dt; if (fwdHold > 0.3) { fwdHold = 0; if (car.selectGear(1)) toast('1st gear', 700); } } else fwdHold = 0;
  }
  // bound wheel / pedals
  if (B.steer) { const gp = padById(B.steer.id); if (gp) { let v = gp.axes[B.steer.axis] || 0; if (settings.invSteer) v = -v; steer = clamp(v * settings.wheelRot / 2 / P.steerLock, -1, 1); lastSteerSrc = 'wheel'; } }
  if (B.clu) clu = pedal(B.clu, padById(B.clu.id));
  for (const [act, fn] of [['up', () => doShift(1)], ['down', () => doShift(-1)], ['cam', () => setCam(camIdx + 1)]]) {
    const b = B[act]; if (!b) continue; const gp = padById(b.id); if (!gp) continue;
    const key = 'b:' + act, pressed = !!gp.buttons[b.button]?.pressed;
    if (pressed && !padPrev.get(key)) fn();
    padPrev.set(key, pressed);
  }
  // easy mode (keyboard only): catch slides with automatic countersteer, and let the car's
  // stability control, strong traction control and ABS do the rest (SIM step, inp.assist)
  const easy = settings.easy && lastSteerSrc === 'kb';
  if (easy && spd > 6) steer += clamp(beta * 1.4 / (P.steerLock * DEG / P.steerRatio), -0.6, 0.6);
  input.assist = easy;
  input.steer = clamp(steer, -1, 1); input.throttle = thr; input.brake = brk; input.clutch = clu;
  const lookT = keys.has('KeyZ') ? 1 : keys.has('KeyX') ? -1 : 0;
  lookYaw = approach(lookYaw, lookT * 1.05, 5, dt);
}
let binding = null;
function startBind(action, btn) {
  const type = ['up', 'down', 'cam'].includes(action) ? 'button' : action === 'steer' ? 'axis' : 'pedal';
  const base = new Map(); for (const gp of pads()) base.set(gp.id + '#' + gp.index, { axes: [...gp.axes], buttons: gp.buttons.map(b => b.pressed) });
  binding = { action, type, base, t0: performance.now(), best: null, btn };
  btn.classList.add('wait'); btn.textContent = 'Move it…';
}
function bindTick() {
  if (!binding) return;
  const bd = binding;
  if (performance.now() - bd.t0 > 8000) { finishBind(null); return; }
  for (const gp of pads()) {
    const base = bd.base.get(gp.id + '#' + gp.index); if (!base) { bd.base.set(gp.id + '#' + gp.index, { axes: [...gp.axes], buttons: gp.buttons.map(b => b.pressed) }); continue; }
    if (bd.type === 'button') { gp.buttons.forEach((b, i) => { if (b.pressed && !base.buttons[i]) finishBind({ id: gp.id, button: i }); }); continue; }
    gp.axes.forEach((v, a) => {
      const dv = v - base.axes[a];
      if (bd.type === 'axis' && Math.abs(dv) > 0.4) finishBind({ id: gp.id, axis: a });
      if (bd.type === 'pedal') {
        if (Math.abs(dv) > 0.4 && (!bd.best || (bd.best.id === gp.id && bd.best.axis === a))) { if (!bd.best || Math.abs(dv) > Math.abs(bd.best.full - bd.best.rest)) bd.best = { id: gp.id, axis: a, rest: base.axes[a], full: v }; }
        if (bd.best && bd.best.id === gp.id && bd.best.axis === a && Math.abs(dv) < 0.12) finishBind(bd.best);
      }
    });
  }
}
function finishBind(result) {
  if (!binding) return;
  const bd = binding; binding = null;
  if (result) { settings.binds[bd.action] = result; saveSettings(); }
  renderBinds();
}
function doShift(dir) {
  if (!running || paused) return;
  const r = car.shift(dir);
  if (r === 'over-rev') toast('Downshift blocked: over-rev', 900);
  else if (r === 'reverse-lock') toast('Stop the car to select reverse', 900);
  else if (r === true) sound.thump(0.25);
}
const HOLD = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyZ', 'KeyX']);
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') && e.code !== 'Escape') return;
  if (HOLD.has(e.code) || e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (!running || paused) return;
  switch (e.code) {
    case 'KeyE': case 'ShiftLeft': case 'ShiftRight': doShift(1); break;
    case 'KeyQ': doShift(-1); break;
    case 'KeyC': setCam(camIdx + 1); break;
    case 'KeyV': setCam(camIdx - 1); break;
    case 'KeyR': resetCar(); break;
    case 'KeyM': settings.mirror = !settings.mirror; saveSettings(); syncForm(); toast(settings.mirror ? 'Mirror on' : 'Mirror off', 700); break;
    case 'KeyH': $('hud').classList.toggle('min'); break;
    case 'BracketLeft': settings.setup.brakeBias = clamp(+(settings.setup.brakeBias - 0.005).toFixed(3), 0.55, 0.8); saveSettings(); toast('Brake bias ' + (settings.setup.brakeBias * 100).toFixed(1) + '%', 700); break;
    case 'BracketRight': settings.setup.brakeBias = clamp(+(settings.setup.brakeBias + 0.005).toFixed(3), 0.55, 0.8); saveSettings(); toast('Brake bias ' + (settings.setup.brakeBias * 100).toFixed(1) + '%', 700); break;
    case 'KeyT': settings.setup.tc = (settings.setup.tc + 1) % 6; saveSettings(); toast(settings.setup.tc ? 'TC ' + settings.setup.tc : 'TC off', 700); break;
    case 'KeyB': settings.setup.abs = !settings.setup.abs; saveSettings(); toast(settings.setup.abs ? 'ABS on' : 'ABS off', 700); break;
    default: if (/^Digit[1-7]$/.test(e.code)) setCam(+e.code.slice(5) - 1);
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/* ============================ CAMERAS ============================ */
const CAMS = [
  { name: 'Cockpit', type: 'mount', pos: [0.37, 1.0, -0.12], tilt: -0.05, cockpit: true, mirror: true },
  { name: 'Roof', type: 'mount', pos: [0, 1.46, -0.6], tilt: -0.07, fov: 64 },
  { name: 'Nose', type: 'mount', pos: [0, 0.5, 2.3], tilt: -0.02, fov: 66, mirror: true },
  { name: 'Side pod', type: 'mount', pos: [1.18, 0.62, -1.1], tilt: -0.06, fov: 62, yaw: 0.05 },
  { name: 'Chase', type: 'chase', dist: 6.2, height: 1.85, fov: 60 },
  { name: 'Chase far', type: 'chase', dist: 11, height: 3.4, fov: 55 },
  { name: 'TV', type: 'tv' },
];
let camIdx = clamp(settings.cam | 0, 0, CAMS.length - 1);
const chase = { yaw: 0, pos: new THREE.Vector3(), init: false };
const head = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
let tvCur = -1, shake = 0;
const tvSpots = T.tv.map(t => { const sg = t.side ? 1 : -1, [x, z] = at(t.i, sg * (T.wall[t.side][t.i] + 7)); return new THREE.Vector3(x, T.Y[t.i] + t.h, z); });
function setCam(i) {
  camIdx = (i + CAMS.length) % CAMS.length; settings.cam = camIdx; saveSettings();
  const el = $('camName'); el.textContent = CAMS[camIdx].name; el.classList.add('show');
  clearTimeout(setCam.t); setCam.t = setTimeout(() => el.classList.remove('show'), 1200);
  chase.init = false; tvCur = -1;
}
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
function updateCamera(dt, menuMode) {
  const root = carParts.root, body = carParts.body;
  root.updateMatrixWorld(true);
  const cam = CAMS[camIdx];
  carParts.interior.visible = !menuMode && !!cam.cockpit;
  carParts.driver.visible = menuMode || !cam.cockpit;
  if (menuMode) {
    const t = performance.now() / 1000 * 0.12;
    camera.position.set(car.x + Math.cos(t) * 7.5, groundY + 1.7, car.z + Math.sin(t) * 7.5);
    camera.lookAt(car.x, groundY + 0.7, car.z); camera.fov = 45; camera.near = 0.1; camera.updateProjectionMatrix(); return;
  }
  // head movement from g-forces (cockpit only), a sprung mass on the driver's neck
  const ax = car.ax, ay = car.ay;
  const tx = clamp(ay * 0.0045, -0.06, 0.06), tz = clamp(-ax * 0.004, -0.05, 0.05);
  head.vx += ((tx - head.x) * 90 - head.vx * 12) * dt; head.x += head.vx * dt;
  head.vz += ((tz - head.z) * 90 - head.vz * 12) * dt; head.z += head.vz * dt;
  let kerbShake = 0; for (const wh of car.wheels) if (wh.surf.id >= 1) kerbShake += wh.surf.id === 1 ? 0.6 : 0.35;
  shake = Math.max(shake * Math.exp(-dt * 6), 0);
  const jig = (kerbShake * 0.0022 * clamp(car.speed / 20, 0, 1) + shake * 0.02);
  if (cam.type === 'mount') {
    const p = cam.pos;
    tmpV.set(p[0] + (cam.cockpit ? head.x : 0), p[1] + (Math.random() - 0.5) * jig, p[2] + (cam.cockpit ? head.z : 0));
    body.updateMatrixWorld(true);
    tmpV.applyMatrix4(body.matrixWorld);
    camera.position.copy(tmpV);
    body.getWorldQuaternion(tmpQ);
    tmpE.set(cam.tilt + (Math.random() - 0.5) * jig * 0.5, Math.PI + (cam.yaw || 0) + (cam.cockpit ? lookYaw : lookYaw * 0.7), cam.cockpit ? -head.x * 0.4 : 0);
    camera.quaternion.copy(tmpQ).multiply(new THREE.Quaternion().setFromEuler(tmpE));
    camera.fov = cam.cockpit ? settings.fov : cam.fov; camera.near = cam.cockpit ? 0.03 : 0.08;
  } else if (cam.type === 'chase') {
    let dyaw = car.psi - chase.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    if (!chase.init) { chase.yaw = car.psi; dyaw = 0; }
    chase.yaw += dyaw * (1 - Math.exp(-dt * 5.5));
    const fx = Math.sin(chase.yaw + lookYaw * 2.5), fz = Math.cos(chase.yaw + lookYaw * 2.5);
    const want = tmpV.set(car.x - fx * cam.dist, groundY + cam.height, car.z - fz * cam.dist);
    if (!chase.init) { chase.pos.copy(want); chase.init = true; }
    chase.pos.lerp(want, 1 - Math.exp(-dt * 14));
    camera.position.copy(chase.pos); camera.position.y += (Math.random() - 0.5) * jig * 2;
    camera.lookAt(car.x + fx * 2.5, groundY + 0.85, car.z + fz * 2.5);
    camera.fov = cam.fov; camera.near = 0.1;
  } else {
    let best = tvCur, bd = tvCur >= 0 ? tvSpots[tvCur].distanceTo(tmpV.set(car.x, groundY + 1, car.z)) * 0.75 : 1e9;
    tvSpots.forEach((p, k) => { const d = p.distanceTo(tmpV.set(car.x, groundY + 1, car.z)); if (d < bd) { bd = d; best = k; } });
    tvCur = best;
    const p = tvSpots[tvCur]; camera.position.copy(p);
    camera.lookAt(car.x, groundY + 0.7, car.z);
    const dist = p.distanceTo(tmpV.set(car.x, groundY + 0.7, car.z));
    camera.fov = clamp(2 * Math.atan(5.5 / dist) / DEG, 4, 60); camera.near = 0.5;
  }
  camera.updateProjectionMatrix();
}

/* ============================ HUD ============================ */
const lights = $('lights'); for (let i = 0; i < 12; i++) lights.appendChild(document.createElement('i'));
const lightEls = [...lights.children];
const tireEls = ['FL', 'FR', 'RL', 'RR'].map(n => { const d = document.createElement('div'); d.className = 'tire'; d.innerHTML = `<div><b>--</b><small>--</small></div><div class="util"><i></i></div>`; d.title = n; $('tires').appendChild(d); return d; });
function tempColor(t) {
  const stops = [[40, [74, 163, 255]], [70, [74, 200, 220]], [85, [52, 210, 123]], [100, [120, 220, 90]], [112, [255, 170, 40]], [125, [255, 80, 60]]];
  if (t <= stops[0][0]) return `rgb(${stops[0][1]})`;
  for (let i = 1; i < stops.length; i++) if (t < stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], f = (t - t0) / (t1 - t0); return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(',')})`; }
  return `rgb(${stops[stops.length - 1][1]})`;
}
// map
const mapCanvas = $('map'), mapCtx = mapCanvas.getContext('2d');
function mapXform(size, pad) { const sc = (size - 2 * pad) / Math.max(maxX - minX, maxZ - minZ); const ox = pad + ((size - 2 * pad) - (maxX - minX) * sc) / 2, oz = pad + ((size - 2 * pad) - (maxZ - minZ) * sc) / 2; return (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc]; }
function drawTrackPath(g, f, width, color) {
  g.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = f(T.X[i % N], T.Z[i % N]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.lineWidth = width; g.strokeStyle = color; g.lineJoin = 'round'; g.stroke();
}
const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 400;
const mapF = mapXform(400, 28);
{
  const g = mapBase.getContext('2d');
  drawTrackPath(g, mapF, 14, 'rgba(255,255,255,0.14)'); drawTrackPath(g, mapF, 5, '#dfe4ea');
  const [sx, sy] = mapF(T.X[0], T.Z[0]); g.save(); g.translate(sx, sy); g.rotate(Math.atan2(T.TZ[0], T.TX[0]) + Math.PI / 2); g.fillStyle = '#ffc629'; g.fillRect(-10, -2, 20, 4); g.restore();
  g.font = '600 17px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8a94a0';
  T.corners.forEach((c, k) => { const sg = c.dir > 0 ? -1 : 1; const [x, y] = mapF(...at(c.mid, sg * 60)); g.fillText(String(k + 1), x, y); });
}
function drawMap() {
  const g = mapCtx; g.clearRect(0, 0, 400, 400); g.drawImage(mapBase, 0, 0);
  const [x, y] = mapF(car.x, car.z);
  g.save(); g.translate(x, y); g.rotate(-car.psi); g.fillStyle = '#ffc629'; g.beginPath(); g.moveTo(0, 12); g.lineTo(8, -8); g.lineTo(0, -3); g.lineTo(-8, -8); g.closePath(); g.fill(); g.restore();
}
function drawMenuMap() {
  const c = $('menuMap'), g = c.getContext('2d'), f = mapXform(720, 60);
  g.clearRect(0, 0, 720, 720);
  drawTrackPath(g, f, 26, 'rgba(255,255,255,0.08)'); drawTrackPath(g, f, 7, '#eef1f4');
  const [sx, sy] = f(T.X[0], T.Z[0]); g.save(); g.translate(sx, sy); g.rotate(Math.atan2(T.TZ[0], T.TX[0]) + Math.PI / 2); g.fillStyle = '#ffc629'; g.fillRect(-16, -3, 32, 6); g.restore();
  g.font = '700 26px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 22px "Barlow Condensed", Arial Narrow, sans-serif';
  T.corners.forEach((cn, k) => {
    if (k > 0 && T.corners[k - 1].name === cn.name) return;
    const sg = cn.dir > 0 ? -1 : 1; const [x, y] = f(...at(cn.mid, sg * 110));
    g.fillStyle = '#ffc629'; g.fillText(cn.name, x, y);
  });
}
// g-meter
const gm = $('gmeter').getContext('2d'), gTrail = [];
function drawG() {
  const g = gm, W = 220, c = W / 2, sc = 40;
  g.clearRect(0, 0, W, W);
  g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 2;
  for (const r of [1, 2]) { g.beginPath(); g.arc(c, c, r * sc, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(c - 2.5 * sc, c); g.lineTo(c + 2.5 * sc, c); g.moveTo(c, c - 2.5 * sc); g.lineTo(c, c + 2.5 * sc); g.stroke();
  const gx = car.ay / 9.81, gy = -car.ax / 9.81;
  gTrail.push([gx, gy]); if (gTrail.length > 60) gTrail.shift();
  g.fillStyle = 'rgba(255,198,41,0.25)'; for (const [x, y] of gTrail) { g.beginPath(); g.arc(c + x * sc, c + y * sc, 3, 0, 7); g.fill(); }
  g.fillStyle = '#ffc629'; g.beginPath(); g.arc(c + gx * sc, c + gy * sc, 8, 0, 7); g.fill();
  g.fillStyle = '#8a94a0'; g.font = '500 20px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText(Math.hypot(gx, gy).toFixed(2) + 'g', 6, 20);
}
let toastT = 0;
function toast(msg, ms = 1400, color = '') { const el = $('toast'); el.textContent = msg; el.style.color = color; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
function updateLcd(delta) {
  const g = carParts.lcdCanvas.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffc629'; g.font = '700 88px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(car.gear === 0 ? 'N' : car.gear < 0 ? 'R' : String(car.gear), 128, 60);
  g.font = '600 30px "Barlow Condensed", Arial Narrow, sans-serif'; g.fillStyle = '#eef1f4'; g.textAlign = 'left'; g.fillText(Math.round(car.speed * (settings.mph ? 2.237 : 3.6)), 10, 26);
  if (delta != null) { g.textAlign = 'right'; g.fillStyle = delta <= 0 ? '#34d27b' : '#ff5047'; g.fillText((delta > 0 ? '+' : '') + delta.toFixed(2), 248, 26); }
  const r = clamp((car.rpm - 5000) / 3300, 0, 1); g.fillStyle = r > 0.97 ? '#3f8cff' : '#34d27b'; g.fillRect(10, 112, 236 * r, 8);
  carParts.lcdTex.needsUpdate = true;
}

/* ============================ TIMING & INCIDENTS ============================ */
const NB = Math.ceil(L / 10) + 2;
const bestSaved = store.get('hollowmere.best.spa');
const timing = {
  lap: 0, started: false, lapStart: 0, valid: true, passedHalf: false, sector: 0, sectorStart: 0, cur: [null, null, null],
  last: null, lastValid: true, best: bestSaved?.time ?? null, bestTrace: bestSaved?.trace ? Float32Array.from(bestSaved.trace) : null,
  bestSec: bestSaved?.sectors ?? [Infinity, Infinity, Infinity], lastSec: [null, null, null], trace: new Float32Array(NB).fill(-1),
  inc: 0, incT: -9, incPts: 0, offTrack: false, offClear: 0, spin: false,
};
let simTime = 0;
function invalidate(msg) { if (timing.started && timing.valid) { timing.valid = false; if (msg) toast(msg, 1300, 'var(--bad)'); } }
function incident(pts, msg) {
  if (simTime - timing.incT < 2.5) { if (pts > timing.incPts) { timing.inc += pts - timing.incPts; timing.incPts = pts; } }
  else { timing.inc += pts; timing.incPts = pts; timing.incT = simTime; }
  toast(msg + ' · ' + pts + 'x', 1400, 'var(--bad)');
}
function onLine(tc) {
  if (timing.started && timing.passedHalf) {
    const lt = tc - timing.lapStart; timing.cur[2] = tc - timing.sectorStart;
    timing.last = lt; timing.lastValid = timing.valid; timing.lastSec = [...timing.cur];
    if (timing.valid) {
      for (let k = 0; k < 3; k++) if (timing.cur[k] != null && timing.cur[k] < timing.bestSec[k]) timing.bestSec[k] = timing.cur[k];
      if (timing.best == null || lt < timing.best) {
        timing.best = lt;
        const tr = Float32Array.from(timing.trace); let lastV = 0;
        for (let b = 0; b < NB; b++) { if (tr[b] < 0) tr[b] = lastV; lastV = tr[b]; }
        tr[NB - 1] = Math.max(tr[NB - 2], lt);
        timing.bestTrace = tr;
        store.set('hollowmere.best.spa', { time: lt, trace: Array.from(tr), sectors: timing.bestSec });
        toast('Personal best · ' + fmt(lt), 2400, 'var(--pb)');
      } else toast('Lap ' + timing.lap + ' · ' + fmt(lt), 2000);
    } else toast('Lap ' + timing.lap + ' · ' + fmt(lt) + ' (invalid)', 2000, 'var(--dim)');
    store.set('hollowmere.best.spa', { time: timing.best, trace: timing.bestTrace ? Array.from(timing.bestTrace) : null, sectors: timing.bestSec });
  }
  timing.started = true; timing.lap++; timing.lapStart = tc; timing.sectorStart = tc; timing.sector = 0; timing.cur = [null, null, null];
  timing.valid = true; timing.passedHalf = false; timing.trace.fill(-1); timing.trace[0] = 0;
}
function timingStep(prevS, s, dt) {
  const t = simTime;
  if (prevS > L - 80 && s < 80) { const f = (L - prevS) / (s + L - prevS); onLine(t - dt + dt * f); }
  else if (prevS < 80 && s > L - 80) { timing.passedHalf = false; }
  if (!timing.started) return;
  for (const k of [1, 2]) {
    const b = L * k / 3;
    if (prevS < b && s >= b && s - prevS < 80 && timing.sector === k - 1) { const tc = t - dt + dt * (b - prevS) / (s - prevS); timing.cur[k - 1] = tc - timing.sectorStart; timing.sectorStart = tc; timing.sector = k; }
  }
  if (s > L * 0.45 && s < L * 0.55) timing.passedHalf = true;
  const bi = Math.floor(s / 10); if (bi < NB && timing.trace[bi] < 0) timing.trace[bi] = t - timing.lapStart;
}
function currentDelta() {
  if (!timing.started || !timing.bestTrace) return null;
  const s = car.loc.s, b = s / 10, i0 = Math.min(NB - 2, Math.floor(b)), f = b - i0;
  const ref = timing.bestTrace[i0] + (timing.bestTrace[i0 + 1] - timing.bestTrace[i0]) * f;
  return (simTime - timing.lapStart) - ref;
}
function watchIncidents(dt) {
  if (car.nOff === 4) { if (!timing.offTrack) { timing.offTrack = true; invalidate(); incident(1, 'Off track'); } timing.offClear = 0; }
  else if (timing.offTrack) { timing.offClear += dt; if (timing.offClear > 1) timing.offTrack = false; }
  const beta = Math.abs(carBeta());
  if (car.speed > 8 && beta > 1.2) { if (!timing.spin) { timing.spin = true; invalidate(); incident(2, 'Loss of control'); } }
  else if (beta < 0.3) timing.spin = false;
}

/* ============================ GAME STATE ============================ */
let running = false, paused = true, started = false;
function resetCar() {
  const i = car.loc.i;
  car.reset(i, clamp(car.loc.d, -3, 3) * 0.5);
  invalidate('Car reset · lap invalid');
  for (let n = 0; n < 4; n++) skidLast[n] = null;
}
function restartGrid() {
  car.reset(T.N - 14, -2.8); car.refuel(settings.setup.fuel);
  Object.assign(timing, { lap: 0, started: false, valid: true, passedHalf: false, sector: 0, cur: [null, null, null], inc: 0, incT: -9, incPts: 0, offTrack: false, spin: false });
  for (let n = 0; n < 4; n++) skidLast[n] = null;
  prevS = car.loc.s;
}
let prevS = 0;
restartGrid();
function openMenu() {
  paused = true; $('menu').hidden = false;
  $('goBtn').textContent = started ? 'Resume' : 'Start driving';
  $('fBest').textContent = fmt(timing.best);
}
function closeMenu() {
  $('menu').hidden = true; paused = false; running = true; started = true;
  $('hud').hidden = false; sound.start(); canvas.focus();
}
function togglePause() { if (!started) return; if (paused) closeMenu(); else openMenu(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && started && !paused) openMenu(); });

/* ============================ MENU WIRING ============================ */
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('.tab').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
}));
$('goBtn').addEventListener('click', closeMenu);
$('gridBtn').addEventListener('click', () => { restartGrid(); closeMenu(); });
$('fsBtn').addEventListener('click', () => { const el = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.())?.catch?.(() => toast('Fullscreen is not available here', 1200)); });
$('clearBest').addEventListener('click', () => { timing.best = null; timing.bestTrace = null; timing.bestSec = [Infinity, Infinity, Infinity]; store.set('hollowmere.best.spa', null); $('fBest').textContent = '—'; });
$('setupReset').addEventListener('click', () => { const d = S.defaultSetup(); for (const k of ['brakeBias', 'diffPreload', 'arbFront', 'wing']) settings.setup[k] = d[k]; saveSettings(); syncForm(); });
$('clearBinds').addEventListener('click', () => { settings.binds = {}; saveSettings(); renderBinds(); });
const FORM = [
  ['bb', v => settings.setup.brakeBias = v / 100, () => settings.setup.brakeBias * 100, v => (+v).toFixed(1) + '%'],
  ['diff', v => settings.setup.diffPreload = +v, () => settings.setup.diffPreload, v => v + ' Nm'],
  ['arb', v => settings.setup.arbFront = v / 100, () => Math.round(settings.setup.arbFront * 100), v => v + '%'],
  ['fuel', v => settings.setup.fuel = +v, () => settings.setup.fuel, v => v + ' L · ' + Math.round(v * 0.745) + ' kg'],
  ['wing', v => settings.setup.wing = +v, () => settings.setup.wing, v => { const w = +v; return `${w} · ClA ${(P.ClA0 + P.ClAw * w).toFixed(2)}`; }],
  ['tc', v => settings.setup.tc = +v, () => settings.setup.tc, v => +v ? 'Level ' + v : 'Off'],
  ['padCurve', v => settings.padCurve = +v, () => settings.padCurve, v => (+v).toFixed(1)],
  ['wheelRot', v => settings.wheelRot = +v, () => settings.wheelRot, v => v + '°'],
  ['fov', v => settings.fov = +v, () => settings.fov, v => v + '° vert.'],
  ['vol', v => settings.vol = +v, () => settings.vol, v => v + '%'],
];
const CHECKS = [['easy', 'easy'], ['abs', 'setup.abs'], ['autoShift', 'setup.autoShift'], ['protect', 'setup.shiftProtect'], ['assist', 'assist'], ['mirror', 'mirror'], ['shadows', 'shadows'], ['mph', 'mph'], ['invSteer', 'invSteer']];
const getPath = p => p.split('.').reduce((o, k) => o[k], settings);
const setPath = (p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], settings)[last] = v; };
function syncForm() {
  for (const [id, , get, show] of FORM) { $(id).value = get(); $(id + 'Out').textContent = show(get()); }
  for (const [id, path] of CHECKS) $(id).checked = !!getPath(path);
}
for (const [id, set, , show] of FORM) $(id).addEventListener('input', e => { set(e.target.value); $(id + 'Out').textContent = show(e.target.value); saveSettings(); });
for (const [id, path] of CHECKS) $(id).addEventListener('change', e => { setPath(path, e.target.checked); saveSettings(); if (id === 'shadows') { renderer.shadowMap.enabled = e.target.checked; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); } });
const BIND_LABELS = [['steer', 'Steering axis'], ['thr', 'Throttle pedal'], ['brk', 'Brake pedal'], ['clu', 'Clutch pedal (optional)'], ['up', 'Shift up'], ['down', 'Shift down'], ['cam', 'Next camera']];
function renderBinds() {
  const host = $('binds'); host.innerHTML = '';
  for (const [key, label] of BIND_LABELS) {
    const b = settings.binds[key];
    const row = document.createElement('div'); row.className = 'bind';
    const desc = b ? (b.axis !== undefined ? `axis ${b.axis}` : `button ${b.button}`) : 'not set';
    row.innerHTML = `<span>${label}</span><code>${desc}</code>`;
    const btn = document.createElement('button'); btn.textContent = 'Bind'; btn.id = 'bind-' + key;
    btn.addEventListener('click', () => { if (binding) finishBind(null); startBind(key, btn); });
    row.appendChild(btn); host.appendChild(row);
  }
}
function padStatus() {
  const ps = pads();
  $('padStatus').textContent = ps.length ? ps.map(g => `● ${g.id.slice(0, 60)}${g.mapping === 'standard' ? ' (gamepad)' : ''}`).join('\n') : 'No controller detected. Press a button on it to wake it up.';
}
addEventListener('gamepadconnected', padStatus); addEventListener('gamepaddisconnected', padStatus);
syncForm(); renderBinds(); padStatus(); drawMenuMap();
$('fLen').textContent = (L / 1000).toFixed(3) + ' km';
$('fElev').textContent = (Math.max(...T.Y) - Math.min(...T.Y)).toFixed(0) + ' m';
$('fBest').textContent = fmt(timing.best);

/* ============================ RESIZE ============================ */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ============================ MAIN LOOP ============================ */
const DT = 1 / 1000;
let acc = 0, lastT = performance.now(), hudT = 0, lcdT = 0, lastGear = car.gear, fpsCount = 0;
function autoShift() {
  if (!settings.setup.autoShift || car.shiftT > 0) return;
  const rpm = car.rpm;
  if (car.gear === 0 && input.throttle > 0.2) car.shift(1);
  else if (car.gear >= 1 && car.gear < 6 && rpm > 8250) doShift(1);
  else if (car.gear > 1) {
    const ratioDown = P.gears[car.gear] / P.gears[car.gear + 1];
    if (rpm * ratioDown < (input.brake > 0.2 ? 7600 : 6200) && rpm < (input.throttle > 0.5 ? 4300 : 5400)) doShift(-1);
  }
}
function simulate(dtF) {
  acc += dtF;
  let steps = 0;
  while (acc >= DT && steps < 70) {
    car.step(DT, input);
    simTime += DT;
    timingStep(prevS, car.loc.s, DT); prevS = car.loc.s;
    if (car.impact > 1.2) { shake = Math.max(shake, Math.min(1.5, car.impact / 6)); sound.burst(500 + Math.min(600, car.impact * 60), 0.25, Math.min(1, 0.15 + car.impact * 0.06)); rumble(Math.min(1, car.impact / 8), 140); }
    acc -= DT; steps++;
  }
  if (steps >= 70) acc = 0;
  autoShift();
  watchIncidents(dtF);
  if (car.gear !== lastGear) { lastGear = car.gear; }
  if (Math.abs(car.x - T.X[car.loc.i]) > 200 || Math.abs(car.z - T.Z[car.loc.i]) > 200 || !isFinite(car.x)) resetCar();
}
let rumbleT = 0;
function rumble(strength, ms) {
  const now = performance.now(); if (now - rumbleT < 60) return; rumbleT = now;
  for (const gp of pads()) gp.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch?.(() => {});
}
const _v = new THREE.Vector3();
let groundY = 0;
function updateVisuals(dtF) {
  const { root, body, wheels } = carParts;
  const hw = car.wheels.map(wh => hAt(wh.loc.s));
  const hF = (hw[0] + hw[1]) / 2, hR = (hw[2] + hw[3]) / 2, hL = (hw[0] + hw[2]) / 2, hRt = (hw[1] + hw[3]) / 2;
  groundY = (hF * P.b + hR * P.a) / P.L;
  root.position.set(car.x, groundY, car.z);
  root.rotation.set(-Math.atan2(hF - hR, P.L), car.psi, Math.atan2(hL - hRt, (P.tf + P.tr) / 2), 'YXZ');
  body.position.y = car.zb; body.rotation.set(car.pitch, 0, -car.roll, 'YXZ');
  car.wheels.forEach((wh, n) => {
    const w = wheels[n];
    w.hub.rotation.y = -wh.steer; w.spin.rotation.x = wh.rot; w.hub.position.y = P.R + wh.zu;
    w.disc.material.emissiveIntensity = Math.max(0, (wh.brakeT - 520) / 260) ** 1.5 * 2;
  });
  carParts.tailMat.emissiveIntensity = input.brake > 0.05 ? 5 : 0.8;
  carParts.wing.rotation.x = 0.16 + settings.setup.wing * 0.02;
  carParts.swheel.rotation.z = input.steer * P.steerLock * DEG;
  // smoke, dust and rubber
  const sn = Math.sin(car.psi), cs = Math.cos(car.psi), spd = car.speed;
  car.wheels.forEach((wh, n) => {
    const x = car.x + wh.px * sn - wh.py * cs, z = car.z + wh.px * cs + wh.py * sn;
    const sl = Math.hypot(wh.w * P.R - wh.Vx, wh.Vy), gy = hAt(wh.loc.s);
    if (wh.surf.id <= 1) {
      const str = clamp((sl - 3.5) / 10, 0, 1) * clamp(wh.Fz / 3000, 0, 1.2);
      if (str > 0.02 && Math.random() < str * 2.2) puff(x, gy + 0.25, z, car.vx, car.vz, str, false);
      if (sl > 3 && wh.Fz > 900 && wh.surf.id === 0) addSkid(n, x, z, sn, cs, clamp((sl - 3) / 8, 0.15, 0.6), gy); else skidLast[n] = null;
    } else {
      skidLast[n] = null;
      if (spd > 4 && Math.random() < clamp(spd / 25, 0, 1) * 0.6) puff(x, gy + 0.2, z, car.vx, car.vz, 0.35 + (wh.surf.id === 3 ? 0.35 : 0), true);
    }
  });
  if (skidDirty) { skidGeo.attributes.position.needsUpdate = true; skidGeo.attributes.color.needsUpdate = true; skidDirty = false; }
  updateSmoke(dtF);
  // gamepad rumble: kerbs, lock-ups
  let rb = 0; for (const wh of car.wheels) { if (wh.surf.id === 1) rb += 0.12; if (wh.lock) rb += 0.15; if (wh.surf.id >= 2) rb += 0.08; }
  if (rb > 0 && spd > 5) rumble(Math.min(1, rb), 70);
  // shadow camera follows the car
  sun.position.set(car.x + sunDir.x * 200, groundY + sunDir.y * 200, car.z + sunDir.z * 200); sun.target.position.set(car.x, groundY, car.z); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);
}
function updateHud(dtF) {
  const rpm = car.rpm;
  // shift lights every frame
  const on = clamp((rpm - 6200) / (8150 - 6200), 0, 1) * 12, flash = rpm > 8180 && car.gear > 0;
  const blink = (performance.now() / 70 | 0) % 2 === 0;
  lightEls.forEach((el, i) => { el.className = flash ? (blink ? 'b' : '') : i < on ? (i < 5 ? 'g' : i < 9 ? 'y' : 'r') : ''; });
  $('pThr').firstChild.style.height = (input.throttle * 100) + '%';
  $('pBrk').firstChild.style.height = (input.brake * 100) + '%';
  $('pClu').firstChild.style.height = ((1 - car.clutch) * (car.gear !== 0 ? 100 : 0)) + '%';
  $('steerRot').setAttribute('transform', `rotate(${(input.steer * P.steerLock).toFixed(1)})`);
  hudT -= dtF; if (hudT > 0) return; hudT = 1 / 20;
  $('gear').textContent = car.shiftT > 0 ? '·' : car.gear === 0 ? 'N' : car.gear < 0 ? 'R' : car.gear;
  $('speed').textContent = Math.round(Math.abs(car.fwdSpeed()) * (settings.mph ? 2.237 : 3.6));
  $('speedUnit').textContent = settings.mph ? 'mph' : 'km/h';
  $('rpm').textContent = Math.round(rpm / 10) * 10;
  $('steerDeg').textContent = Math.round(input.steer * P.steerLock) + '°';
  $('lAbs').className = 'lamp' + (car.absActive > 0 ? ' on' : settings.setup.abs ? ' set' : '');
  $('lTc').className = 'lamp' + (car.tcActive > 0 ? ' on' : settings.setup.tc ? ' set' : '');
  $('lTc').textContent = settings.setup.tc ? 'TC ' + settings.setup.tc : 'TC off';
  $('lAbs').textContent = settings.setup.abs ? 'ABS' : 'ABS off';
  $('lBb').textContent = 'BB ' + (settings.setup.brakeBias * 100).toFixed(1);
  $('lEsc').hidden = !input.assist; $('lEsc').className = 'lamp' + (car.escActive > 0 ? ' on' : ' set');
  $('lFuel').textContent = car.fuel.toFixed(1) + ' L'; $('lFuel').className = 'lamp set' + (car.fuel < 5 ? ' low' : '');
  // timing
  const cur = timing.started ? simTime - timing.lapStart : null;
  $('curTime').textContent = timing.started ? fmt(cur) : '0:00.000';
  $('lapNo').textContent = timing.started ? 'LAP ' + timing.lap : 'OUT LAP';
  const flag = $('lapFlag');
  if (!timing.started) { flag.className = 'flag out'; flag.textContent = 'Out lap'; }
  else if (timing.valid) { flag.className = 'flag ok'; flag.textContent = 'Valid'; }
  else { flag.className = 'flag bad'; flag.textContent = 'Invalid'; }
  $('lastTime').textContent = timing.last != null ? fmt(timing.last) + (timing.lastValid ? '' : ' ✕') : '—';
  $('bestTime').textContent = fmt(timing.best);
  $('inc').textContent = timing.inc + 'x';
  for (let k = 0; k < 3; k++) {
    const el = $('sec' + k), v = timing.cur[k];
    let cls = timing.started && timing.sector === k ? 'cur' : '';
    if (v != null) { el.textContent = v.toFixed(2); cls += v <= timing.bestSec[k] + 1e-6 && timing.valid ? ' pb' : ' slow'; }
    else if (timing.lastSec[k] != null) el.textContent = timing.lastSec[k].toFixed(2);
    else el.textContent = 'S' + (k + 1);
    el.className = cls;
  }
  const d = currentDelta();
  const dt = $('deltaTxt'), fill = $('deltaFill');
  if (d == null) { dt.textContent = timing.best == null ? 'No reference lap' : '—'; dt.style.color = 'var(--dim)'; fill.style.width = '0'; }
  else {
    dt.textContent = (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(2); dt.style.color = d <= 0 ? 'var(--good)' : 'var(--bad)';
    const w = clamp(Math.abs(d) / 2, 0, 1) * 50;
    fill.style.width = w + '%'; fill.style.left = d <= 0 ? (50 - w) + '%' : '50%'; fill.style.background = d <= 0 ? 'var(--good)' : 'var(--bad)';
  }
  // tyres
  car.wheels.forEach((wh, n) => {
    const el = tireEls[n], te = 0.55 * wh.ts + 0.45 * wh.tc;
    el.style.background = tempColor(te);
    el.firstChild.firstChild.textContent = Math.round(te) + '°';
    el.firstChild.lastChild.textContent = 'BRK ' + Math.round(wh.brakeT);
    el.lastChild.firstChild.style.width = clamp(wh.util / 1.2, 0, 1) * 100 + '%';
    el.classList.toggle('lock', !!wh.lock || !!wh.spin);
  });
  drawMap(); drawG();
  lcdT -= 1 / 20; if (lcdT <= 0 && CAMS[camIdx].cockpit) { lcdT = 0.1; updateLcd(d); }
  $('mirrorFrame').hidden = !(settings.mirror && CAMS[camIdx].mirror);
}
function renderFrame() {
  const cam = CAMS[camIdx], menuMode = !started;
  renderer.shadowMap.needsUpdate = true;
  smokePts.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
  const wantMirror = !menuMode && (cam.cockpit || (settings.mirror && cam.mirror));
  if (wantMirror) {
    const body = carParts.body; body.updateMatrixWorld(true);
    mirrorCam.position.set(0, 1.12, 0.15).applyMatrix4(body.matrixWorld);
    body.getWorldQuaternion(tmpQ); mirrorCam.quaternion.copy(tmpQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.02, 0, 0)));
    carParts.mirrorMesh.visible = false; const intVis = carParts.interior.visible; carParts.interior.visible = false;
    renderer.setRenderTarget(mirrorRT); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
    carParts.mirrorMesh.visible = true; carParts.interior.visible = intVis;
  }
  renderer.render(scene, camera);
  if (wantMirror && settings.mirror && cam.mirror && !paused) {
    const r = $('mirrorFrame').getBoundingClientRect(), H = innerHeight;
    renderer.autoClear = false; renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(r.left + 2, H - r.bottom + 2, r.width - 4, r.height - 4); renderer.setScissor(r.left + 2, H - r.bottom + 2, r.width - 4, r.height - 4);
    renderer.render(overlayScene, overlayCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.autoClear = true;
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dtF = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  bindTick();
  if (!paused) { updateInput(dtF); simulate(dtF); }
  else { input.throttle = 0; input.brake = 0; if (Math.random() < 0.02) padStatus(); }
  updateVisuals(paused ? 0 : dtF);
  updateCamera(dtF, !started);
  if (started) updateHud(dtF);
  sound.update(dtF, !paused);
  renderFrame();
}
requestAnimationFrame(frame);
// handle for debugging in the browser console
window.__hollowmere = { car, timing, input, T, settings, frame, closeMenu, setCam };
