// ===== Hollowmere GT: track model + vehicle dynamics (no rendering) =====
// Depends on SPA_DATA (spa-data.js) being defined first.
const SIM = (() => {
'use strict';
const G = 9.81, RHO = 1.20, DEG = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const SRC = typeof SPA_DATA !== 'undefined' ? SPA_DATA : (typeof globalThis !== 'undefined' ? globalThis.SPA_DATA : null);

/* ---------------------------------------------------------------------------
   TRACK — Spa-Francorchamps centre line (5 m GPS-derived points), splined and
   resampled every 2 m. World x = data x (east), world z = -data y (south), so
   the map reads north-up. Positive curvature = right-hand corner.
   Right normal = (-tz, tx). Track widths vary along the lap as in the data.
--------------------------------------------------------------------------- */
const KERB_W = 1.4, DS = 2;
const CORNER_NAMES = ['La Source', 'Eau Rouge', 'Raidillon', 'Raidillon', 'Les Combes', 'Les Combes', 'Malmedy', 'Rivage', 'Turn 10',
  'Pouhon', 'Pouhon', 'Fagnes', 'Campus', 'Stavelot', 'Paul Frère', 'Blanchimont', 'Blanchimont', 'Bus Stop', 'Bus Stop'];
// [distance from the start line (m), height (m)] — relative elevation, about 80 m from Stavelot up to Les Combes
const HEIGHTS = [[0, 0], [200, -2], [355, -4], [520, -9], [800, -21], [960, -30.5], [1030, -34], [1090, -31.5], [1150, -24], [1200, -16.5],
  [1255, -10.5], [1325, -5.5], [1430, -2], [1600, 1.5], [1900, 8.5], [2350, 27], [2420, 29], [2620, 27], [2800, 21], [2990, 14], [3260, 5], [3500, -5], [3780, -16],
  [3960, -24], [4200, -30], [4450, -35], [4700, -42], [4910, -48], [5110, -52], [5400, -48], [5800, -38], [6150, -22], [6450, -12],
  [6720, -6], [6850, -3]];

function buildTrack() {
  const D = SRC, n = D.length / 4;
  const px = new Float64Array(n), pz = new Float64Array(n), pwr = new Float64Array(n), pwl = new Float64Array(n);
  for (let i = 0; i < n; i++) { px[i] = D[4 * i]; pz[i] = -D[4 * i + 1]; pwr[i] = D[4 * i + 2]; pwl[i] = D[4 * i + 3]; }
  // dense Catmull-Rom (0.5 m), then uniform resample by arc length
  const SUB = 10, dx = [], dz = [], dwr = [], dwl = [];
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n, i2 = (i + 1) % n, i3 = (i + 2) % n;
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dx.push(cr(px[i0], px[i], px[i2], px[i3])); dz.push(cr(pz[i0], pz[i], pz[i2], pz[i3]));
      dwr.push(pwr[i] + (pwr[i2] - pwr[i]) * t); dwl.push(pwl[i] + (pwl[i2] - pwl[i]) * t);
    }
  }
  const M = dx.length, acc = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) { const j = (i + 1) % M; acc[i + 1] = acc[i] + Math.hypot(dx[j] - dx[i], dz[j] - dz[i]); }
  const length = acc[M], N = Math.round(length / DS);
  const X = new Float64Array(N), Z = new Float64Array(N), rawWR = new Float64Array(N), rawWL = new Float64Array(N);
  for (let i = 0, j = 0; i < N; i++) {
    const s = i * length / N;
    while (acc[j + 1] < s) j++;
    const f = (s - acc[j]) / (acc[j + 1] - acc[j]), j2 = (j + 1) % M;
    X[i] = dx[j] + (dx[j2] - dx[j]) * f; Z[i] = dz[j] + (dz[j2] - dz[j]) * f;
    rawWR[i] = dwr[j] + (dwr[j2] - dwr[j]) * f; rawWL[i] = dwl[j] + (dwl[j2] - dwl[j]) * f;
  }
  const TX = new Float64Array(N), TZ = new Float64Array(N), NX = new Float64Array(N), NZ = new Float64Array(N), S = new Float64Array(N + 1), SEG = new Float64Array(N), H = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % N, i0 = (i - 1 + N) % N;
    let tx = X[i1] - X[i0], tz = Z[i1] - Z[i0]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    TX[i] = tx; TZ[i] = tz; NX[i] = -tz; NZ[i] = tx; H[i] = Math.atan2(tz, tx);
    SEG[i] = Math.hypot(X[i1] - X[i], Z[i1] - Z[i]);
    S[i + 1] = S[i] + SEG[i];
  }
  // curvature from heading change, lightly smoothed
  const K0 = new Float64Array(N), K = new Float64Array(N);
  for (let i = 0; i < N; i++) { const a = (i - 2 + N) % N, b = (i + 2) % N; let d = H[b] - H[a]; d = Math.atan2(Math.sin(d), Math.cos(d)); K0[i] = d / (4 * DS); }
  for (let i = 0; i < N; i++) { let s = 0; for (let q = -4; q <= 4; q++) s += K0[(i + q + N) % N]; K[i] = s / 9; }
  // widths (half-width to each edge), smoothed
  const WR = new Float64Array(N), WL = new Float64Array(N);
  for (let i = 0; i < N; i++) { let r = 0, l = 0; for (let q = -8; q <= 8; q++) { r += rawWR[(i + q + N) % N]; l += rawWL[(i + q + N) % N]; } WR[i] = clamp(r / 17, 4.8, 9); WL[i] = clamp(l / 17, 4.8, 9); }

  // corners = runs of consistent curvature tighter than 300 m
  const runs = []; let cur = null;
  for (let i = 0; i < N; i++) {
    const on = Math.abs(K[i]) > 1 / 300, sg = Math.sign(K[i]);
    if (on && (!cur || cur.sg !== sg)) { if (cur) runs.push(cur); cur = { i0: i, i1: i, sg, ang: 0, kmax: 0 }; }
    if (on) { cur.i1 = i; cur.ang += K[i] * SEG[i]; cur.kmax = Math.max(cur.kmax, Math.abs(K[i])); }
    else if (cur && i - cur.i1 > 8) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  const corners = runs.filter(r => Math.abs(r.ang) > 14 * DEG).map((r, k, arr) => {
    const len = r.i1 - r.i0 + 1;
    return { name: arr.length === CORNER_NAMES.length ? CORNER_NAMES[k] : 'Turn ' + (k + 1), num: k + 1, i0: r.i0, i1: r.i1, len, mid: (r.i0 + (len >> 1)) % N, angle: r.ang / DEG, radius: 1 / r.kmax, dir: r.sg };
  });
  // pit straight: from the Bus Stop exit to La Source
  const mainA = (corners[corners.length - 1].i1 + 12) % N, mainB = (corners[0].i0 - 15 + N) % N;
  const inRange = (i, a, b) => a <= b ? (i >= a && i < b) : (i >= a || i < b);

  // surfaces: side 0 = left (d<0), side 1 = right (d>0)
  const kerb = [new Uint8Array(N), new Uint8Array(N)], gravel = [new Uint8Array(N), new Uint8Array(N)];
  const mark = (arr, a, b) => { for (let q = a; q <= b; q++) arr[(q % N + N) % N] = 1; };
  for (const c of corners) {
    const inside = c.dir > 0 ? 1 : 0, outside = 1 - inside;
    mark(kerb[inside], c.i0 + Math.round(c.len * 0.15) - 4, c.i0 + Math.round(c.len * 0.9));
    mark(kerb[outside], c.i0 + Math.round(c.len * 0.55), c.i1 + 10);
    if (c.radius <= 110) mark(gravel[outside], c.i0 - 22, c.i1 + 30);
    else if (Math.abs(c.angle) > 30) mark(gravel[outside], c.i0 + Math.round(c.len * 0.3), c.i1 + 20);
  }
  const wall = [new Float64Array(N), new Float64Array(N)];
  for (let i = 0; i < N; i++) {
    for (let side = 0; side < 2; side++) {
      const sg = side ? 1 : -1, w0 = side ? WR[i] : WL[i];
      let w = w0 + (gravel[side][i] ? 26 : 13);
      if (inRange(i, mainA, mainB)) w = w0 + (side ? 9 : 7.5);
      if (sg * K[i] > 1e-4) w = Math.min(w, 0.8 / Math.abs(K[i]));
      wall[side][i] = w;
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let sep = Math.abs(i - j); sep = Math.min(sep, N - sep); if (sep < 60) continue;
      const vx = X[j] - X[i], vz = Z[j] - Z[i];
      if (vx * vx + vz * vz > 100 * 100) continue;
      const along = vx * TX[i] + vz * TZ[i]; if (Math.abs(along) > 30) continue;
      const lat = vx * NX[i] + vz * NZ[i], side = lat > 0 ? 1 : 0;
      wall[side][i] = Math.min(wall[side][i], Math.abs(lat) / 2 - 1.2);
    }
  }
  for (let side = 0; side < 2; side++) {
    const w = wall[side], ero = new Float64Array(N), out = new Float64Array(N), W = side ? WR : WL;
    for (let i = 0; i < N; i++) { let m = 1e9; for (let q = -14; q <= 14; q++) m = Math.min(m, w[(i + q + N) % N]); ero[i] = m; }
    for (let i = 0; i < N; i++) { let s = 0; for (let q = -10; q <= 10; q++) s += ero[(i + q + N) % N]; out[i] = Math.max(W[i] + KERB_W + 3, s / 21); }
    wall[side] = out;
    for (let i = 0; i < N; i++) if (gravel[side][i] && out[i] < W[i] + KERB_W + 6) gravel[side][i] = 0;
  }

  // brake boards before slow corners that follow a long run
  const boards = [];
  for (const c of corners) {
    if (c.radius > 60) continue;
    let straight = 0; for (let q = 1; q < 150; q++) { if (Math.abs(K[(c.i0 - q + N) % N]) > 1 / 400) break; straight++; }
    if (straight < 60) continue;
    for (const m of [150, 100, 50]) boards.push({ i: (c.i0 - Math.round(m / DS) - 6 + N) % N, side: c.dir > 0 ? 0 : 1, label: String(m) });
  }
  const tv = [];
  for (const c of corners) { const side = c.dir > 0 ? 0 : 1; tv.push({ i: c.mid, side, h: 7 }); }
  const mainLen = (mainB - mainA + N) % N;
  tv.push({ i: (mainA + Math.round(mainLen * 0.3)) % N, side: 1, h: 9 });
  tv.push({ i: (mainA + Math.round(mainLen * 0.75)) % N, side: 1, h: 8 });
  for (let f = 0.1; f < 1; f += 0.1) { const i = Math.round(f * N); if (tv.every(t => Math.abs(t.i - i) > 120)) tv.push({ i, side: 0, h: 7 }); }

  // elevation: Hermite through the height keys, then smoothed over ±40 m
  const T = { N, X, Z, K, H, TX, TZ, NX, NZ, S, SEG, length, corners, kerb, gravel, wall, boards, tv, mainA, mainB, KERB_W, WL, WR };
  const HP = HEIGHTS, nH = HP.length, Y = new Float64Array(N), GR = new Float64Array(N), CV = new Float64Array(N), raw = new Float64Array(N);
  const key = k => { const q = ((k % nH) + nH) % nH; return [HP[q][0] + Math.floor(k / nH) * length, HP[q][1]]; };
  for (let i = 0; i < N; i++) {
    const s = S[i]; let k = 0; while (k < nH - 1 && HP[k + 1][0] <= s) k++;
    const [s0, h0] = key(k), [s1, h1] = key(k + 1), [sm, hm] = key(k - 1), [s2, h2] = key(k + 2);
    const m0 = (h1 - hm) / (s1 - sm), m1 = (h2 - h0) / (s2 - s0);
    const d = s1 - s0, u = (s - s0) / d, u2 = u * u, u3 = u2 * u;
    raw[i] = (2 * u3 - 3 * u2 + 1) * h0 + (u3 - 2 * u2 + u) * d * m0 + (-2 * u3 + 3 * u2) * h1 + (u3 - u2) * d * m1;
  }
  for (let i = 0; i < N; i++) { let a = 0; for (let q = -20; q <= 20; q++) a += raw[(i + q + N) % N]; Y[i] = a / 41; }
  for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; GR[i] = (Y[b] - Y[a]) / (SEG[a] + SEG[i]); }
  for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; CV[i] = (GR[b] - GR[a]) / (SEG[a] + SEG[i]); }
  Object.assign(T, { Y, GR, CV });
  return T;
}

// nearest-point search along the centre line; hint < 0 searches globally
function locate(T, x, z, hint, out) {
  const N = T.N; let best = 0, bd = 1e30;
  if (hint < 0) { for (let i = 0; i < N; i++) { const dx = x - T.X[i], dz = z - T.Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } } }
  else { for (let o = -24; o <= 24; o++) { const i = (hint + o + N) % N, dx = x - T.X[i], dz = z - T.Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } } }
  let i0 = best, i1 = (best + 1) % N;
  let sx = T.X[i1] - T.X[i0], sz = T.Z[i1] - T.Z[i0];
  let t = ((x - T.X[i0]) * sx + (z - T.Z[i0]) * sz) / (sx * sx + sz * sz);
  if (t < 0) {
    i1 = i0; i0 = (best - 1 + N) % N; sx = T.X[i1] - T.X[i0]; sz = T.Z[i1] - T.Z[i0];
    t = ((x - T.X[i0]) * sx + (z - T.Z[i0]) * sz) / (sx * sx + sz * sz);
  }
  t = clamp(t, 0, 1);
  const qx = T.X[i0] + sx * t, qz = T.Z[i0] + sz * t;
  const nx = T.NX[i0] + (T.NX[i1] - T.NX[i0]) * t, nz = T.NZ[i0] + (T.NZ[i1] - T.NZ[i0]) * t;
  out.i = t < 0.5 ? i0 : i1; out.seg = i0; out.t = t;
  out.s = T.S[i0] + T.SEG[i0] * t;
  out.d = (x - qx) * nx + (z - qz) * nz;
  return out;
}
function heightAt(T, s) {
  const N = T.N, L = T.length; s = ((s % L) + L) % L;
  let i = Math.min(N - 1, Math.floor(s / L * N));
  while (i > 0 && T.S[i] > s) i--;
  while (i < N - 1 && T.S[i + 1] <= s) i++;
  const f = (s - T.S[i]) / T.SEG[i];
  return T.Y[i] + (T.Y[(i + 1) % N] - T.Y[i]) * f;
}
const edgeAt = (T, loc) => (loc.d > 0 ? T.WR : T.WL)[loc.i];

const SURF = {
  asphalt: { id: 0, mu: 1.00, rr: 0.013, drag: 0 },
  kerb:    { id: 1, mu: 0.93, rr: 0.016, drag: 0 },
  grass:   { id: 2, mu: 0.52, rr: 0.060, drag: 0.03 },
  gravel:  { id: 3, mu: 0.48, rr: 0.10, drag: 0.30 },
};
function surfaceAt(T, loc) {
  const side = loc.d > 0 ? 1 : 0, ad = Math.abs(loc.d), i = loc.i, w = side ? T.WR[i] : T.WL[i];
  if (ad <= w) return SURF.asphalt;
  if (ad <= w + T.KERB_W && T.kerb[side][i]) return SURF.kerb;
  if (T.gravel[side][i] && ad > w + T.KERB_W + 0.5) return SURF.gravel;
  return SURF.grass;
}
// road surface height under a tyre relative to the smooth road (m): kerb profile, ripples and bumps.
// Kerb shape must match the rendered kerbs (see game.js).
function roadInput(T, loc, surf) {
  const s = loc.s, d = loc.d;
  if (surf.id === 1) {
    const e = (Math.abs(d) - edgeAt(T, loc)) / T.KERB_W;
    const prof = e < 0.45 ? 0.004 + 0.046 * (e / 0.45) : 0.05 - 0.038 * ((e - 0.45) / 0.55);
    return prof + 0.004 * Math.sin(s * TAU / 0.42);
  }
  if (surf.id >= 2) return 0.012 * Math.sin(s * 1.7 + d * 0.9) * Math.sin(s * 0.53 - d * 1.3) + 0.006 * Math.sin(s * 5.1 + d * 3.7);
  // asphalt: long-wave undulation plus patches of sharper bumps in the braking zones
  return 0.003 * Math.sin(s * 0.21 + d * 0.3) + 0.0025 * Math.sin(s * 1.37 + d) + 0.004 * Math.max(0, Math.sin(s * 0.011) - 0.8) * Math.sin(s * 3.1 + d * 2);
}

/* ---------------------------------------------------------------------------
   TYRE — normalised Magic Formula with combined slip, first-order carcass
   relaxation, load sensitivity (friction and slip-at-peak), two-node thermal
   model and wear.
--------------------------------------------------------------------------- */
const MF_LAT = { B: 14.8, C: 1.25, E: -1.4 };
const MF_LON = { B: 12.6, C: 1.35, E: -1.54 };
const mf = (p, x) => { const bx = p.B * x; return Math.sin(p.C * Math.atan(bx - p.E * (bx - Math.atan(bx)))); };
function peakOf(p) { let bx = 0, bv = 0; for (let x = 0.001; x < 0.6; x += 0.0005) { const v = mf(p, x); if (v > bv) { bv = v; bx = x; } } return bx; }
const A_PEAK = peakOf(MF_LAT), K_PEAK = peakOf(MF_LON);

/* ---------------------------------------------------------------------------
   CAR — front-engined, rear-drive GT (≈ 500 hp, 1300 kg with driver, plus fuel).
   Body coordinates: +fwd, +right. World heading psi: forward = (sin psi, cos psi).
--------------------------------------------------------------------------- */
const P = {
  m: 1300, Iz: 2150, L: 2.63, a: 1.39, b: 1.24, h: 0.40, tf: 1.63, tr: 1.61,
  R: 0.345, Iw: 1.25, muF: 45, muR: 50,
  // suspension (wheel rates), dampers, bump stops, tyre vertical stiffness
  kF: 125000, kR: 145000, cBumpF: 3800, cRebF: 6400, cBumpR: 4200, cRebR: 7000,
  bumpGap: 0.042, kBump: 900000, kt: 300000, ct: 250,
  rollTotal: 560000, hs: 0.41, hrcF: 0.05, hrcR: 0.09, hpc: 0.08, Iroll: 520, Ipitch: 1900,
  // aero; ride-height sensitivity per metre of compression
  CdA0: 0.74, CdAw: 0.022, ClA0: 1.75, ClAw: 0.17, aeroF0: 0.45, aeroFw: -0.012, rideSensF: 2.0, rideSensR: 2.0,
  // tyres
  mu: 1.68, Fz0: 3600, loadSens: 0.11, relaxX: 0.18, relaxY: 0.50,
  // engine & driveline
  idle: 1000, redline: 8300, limiter: 8600, Ie: 0.20,
  gears: [-3.05, 0, 3.05, 2.24, 1.77, 1.44, 1.21, 1.04], final: 3.70, clutchCap: 1100,
  // brakes: torque at full pedal, disc heat capacity (J/K)
  brakeMax: 9800, discCF: 5200, discCR: 3800,
  steerLock: 270, steerRatio: 13.5,
  fuelDensity: 0.745, bsfc: 260e-3 / 3.6e6, // kg per J
  halfLen: 2.30, halfWid: 1.00, Tamb: 22,
};
const WPOS = [[P.a, -P.tf / 2], [P.a, P.tf / 2], [-P.b, -P.tr / 2], [-P.b, P.tr / 2]];
const TQ = [[0, 260], [1000, 300], [2000, 380], [3000, 440], [4000, 490], [5000, 530], [6000, 548], [6800, 540], [7500, 505], [8300, 455], [9000, 380]];
function torqueAt(rpm) {
  if (rpm <= TQ[0][0]) return TQ[0][1];
  for (let i = 1; i < TQ.length; i++) if (rpm < TQ[i][0]) { const [r0, t0] = TQ[i - 1], [r1, t1] = TQ[i]; return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0); }
  return TQ[TQ.length - 1][1];
}
const frictionAt = rpm => 18 + rpm * 0.0072 + rpm * rpm * 1.1e-7;
// brake pad friction vs disc temperature: grabby when cold, fades past ~750 °C
const brakeMu = T => T < 350 ? 0.8 + 0.2 * smoothstep(60, 350, T) : 1 - 0.3 * smoothstep(720, 1050, T);

const defaultSetup = () => ({ brakeBias: 0.68, diffPreload: 90, arbFront: 0.55, wing: 4, abs: true, tc: 3, autoShift: true, shiftProtect: true, fuel: 60 });

class Car {
  constructor(track) {
    this.T = track; this.P = P;
    this.setup = defaultSetup();
    this.wheels = WPOS.map((p, n) => ({
      px: p[0], py: p[1], front: n < 2, w: 0, rot: 0, k: 0, t: 0, Fz: 0, Fx: 0, Fy: 0, Vx: 0, Vy: 0,
      mu: 1, surf: SURF.asphalt, loc: { i: 0, s: 0, d: 0, seg: 0, t: 0 }, hint: -1, ts: 70, tc: 70, dirt: 0, abs: 1, util: 0, steer: 0, lock: 0, spin: 0, slipPow: 0,
      zu: 0, vu: 0, road: 0, brakeT: 250, wear: 0, susp: 0,
    }));
    this.corners = [[P.halfLen, -P.halfWid], [P.halfLen, P.halfWid], [-P.halfLen, -P.halfWid], [-P.halfLen, P.halfWid], [0.2, -P.halfWid - 0.02], [0.2, P.halfWid + 0.02]].map(c => ({ fx: c[0], fy: c[1], hint: -1, loc: { i: 0, s: 0, d: 0 } }));
    this.loc = { i: 0, s: 0, d: 0, seg: 0, t: 0 }; this.hint = -1;
    this.fuel = this.setup.fuel;
    this.reset(this.T ? this.T.N - 14 : 0, 0);
  }
  reset(i, offset) {
    this.x = 0; this.z = 0; this.psi = 0;
    if (this.T) {
      const T = this.T;
      this.x = T.X[i] + T.NX[i] * offset; this.z = T.Z[i] + T.NZ[i] * offset;
      this.psi = Math.atan2(T.TX[i], T.TZ[i]);
    }
    this.vx = 0; this.vz = 0; this.w = 0;
    this.ax = 0; this.ay = 0;
    this.zb = 0; this.vzb = 0; this.pitch = 0; this.pitchD = 0; this.roll = 0; this.rollD = 0; this.heave = 0;
    this.we = P.idle * TAU / 60; this.gear = 1; this.shiftT = 0; this.shiftDir = 0; this.pendingGear = 1;
    this.clutchLocked = false; this.clutch = 0; this.limiterCut = false; this.tcF = 1; this.tcActive = 0; this.absActive = 0; this.escActive = 0;
    this.throttle = 0; this.brake = 0; this.steer = 0; this.delta = 0; this.engTorque = 0; this.thrEff = 0;
    this.impact = 0; this.impactPos = null; this.hint = -1; this.odo = 0; this.time = 0; this.grade = 0; this.loadFactor = 1;
    for (const wh of this.wheels) { wh.w = 0; wh.k = 0; wh.t = 0; wh.hint = -1; wh.abs = 1; wh.dirt = 0; wh.zu = 0; wh.vu = 0; }
    for (const c of this.corners) c.hint = -1;
    if (this.T) { locate(this.T, this.x, this.z, -1, this.loc); this.hint = this.loc.i; }
  }
  refuel(litres) { this.fuel = litres; for (const wh of this.wheels) { wh.wear = 0; wh.ts = wh.tc = 70; wh.brakeT = 250; } }
  get mass() { return P.m + this.fuel * P.fuelDensity; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get rpm() { return this.we * 60 / TAU; }
  get ratio() { return P.gears[this.gear + 1] * P.final; }
  shift(dir) {
    if (this.shiftT > 0) return false;
    const ng = this.gear + dir;
    if (ng > 6 || ng < -1) return false;
    if (ng === -1 && this.fwdSpeed() > 1.5) return 'reverse-lock';
    if (dir < 0 && ng > 0 && this.setup.shiftProtect) {
      const wr = (this.wheels[2].w + this.wheels[3].w) / 2, rpmNew = Math.abs(wr * P.gears[ng + 1] * P.final) * 60 / TAU;
      if (rpmNew > P.limiter + 250) return 'over-rev';
    }
    this.pendingGear = ng; this.shiftDir = dir;
    this.shiftT = dir > 0 ? 0.055 : 0.085;
    if (this.gear === 0 || ng === 0 || ng === -1) this.shiftT = 0.12;
    return true;
  }
  selectGear(g) {
    if (this.shiftT > 0 || g === this.gear) return false;
    this.pendingGear = g; this.shiftDir = g > this.gear ? 1 : -1; this.shiftT = 0.2;
    return true;
  }
  fwdSpeed() { return this.vx * Math.sin(this.psi) + this.vz * Math.cos(this.psi); }

  step(dt, inp) {
    const S = this.setup, T = this.T, W = this.wheels;
    const mTot = this.mass, mUns = 2 * P.muF + 2 * P.muR, ms = mTot - mUns, Iz = P.Iz * mTot / P.m;
    this.time += dt;
    // ---------------- controls ----------------
    this.steer = inp.steer; this.throttle = inp.throttle; this.brake = inp.brake;
    const delta = inp.steer * P.steerLock * DEG / P.steerRatio;
    this.delta = delta;
    const ack = 0.075 * Math.abs(delta);
    W[0].steer = delta + (delta > 0 ? -ack : ack) * 0.5; W[1].steer = delta + (delta > 0 ? ack : -ack) * 0.5;
    W[2].steer = 0; W[3].steer = 0;
    const sn = Math.sin(this.psi), cs = Math.cos(this.psi);
    const fX = sn, fZ = cs, rX = -cs, rZ = sn;
    const vLong = this.vx * fX + this.vz * fZ, spd = Math.hypot(this.vx, this.vz);

    // ---------------- slope ----------------
    let gEff = G, gX = 0, gZ = 0;
    if (T) {
      const i = this.loc.seg, j = (i + 1) % T.N, f = this.loc.t;
      const gr = T.GR[i] + (T.GR[j] - T.GR[i]) * f, cv = T.CV[i] + (T.CV[j] - T.CV[i]) * f;
      const cosT = 1 / Math.sqrt(1 + gr * gr), vT = this.vx * T.TX[i] + this.vz * T.TZ[i];
      gEff = G * cosT + vT * vT * cv;      // crests lighten the car, compressions load it
      const gf = -mTot * G * gr * cosT; gX = gf * T.TX[i]; gZ = gf * T.TZ[i];
      this.grade = gr; this.loadFactor = gEff / G;
    }

    // ---------------- aero (ride-height sensitive) ----------------
    const ClA = P.ClA0 + P.ClAw * S.wing, CdA = P.CdA0 + P.CdAw * S.wing, aeroF = P.aeroF0 + P.aeroFw * S.wing;
    const q = 0.5 * RHO * vLong * vLong;
    const rhF = this.zb - P.a * this.pitch, rhR = this.zb + P.b * this.pitch; // + = higher than static
    const downF = q * ClA * aeroF * clamp(1 - P.rideSensF * rhF, 0.85, 1.15);
    const downR = q * ClA * (1 - aeroF) * clamp(1 - P.rideSensR * rhR, 0.9, 1.1);
    this.downforce = downF + downR; this.aeroBalance = downF / Math.max(1, downF + downR);

    // ---------------- suspension: sprung body (heave/pitch/roll) + 4 unsprung masses ----------------
    const arbTot = P.rollTotal, kfs = P.kF * P.tf * P.tf / 2, krs = P.kR * P.tr * P.tr / 2;
    const kArbF = Math.max(0, (S.arbFront * arbTot - kfs) / (P.tf * P.tf)), kArbR = Math.max(0, ((1 - S.arbFront) * arbTot - krs) / (P.tr * P.tr));
    const msF = ms * P.b / P.L / 2, msR = ms * P.a / P.L / 2;
    const defl = [0, 0, 0, 0], Fs = [0, 0, 0, 0];
    for (let n = 0; n < 4; n++) {
      const wh = W[n], front = n < 2;
      const zc = this.zb - wh.px * this.pitch + wh.py * this.roll, vc = this.vzb - wh.px * this.pitchD + wh.py * this.rollD;
      const d = wh.zu - zc, dv = wh.vu - vc; defl[n] = d;
      const k = front ? P.kF : P.kR, c = dv > 0 ? (front ? P.cBumpF : P.cBumpR) : (front ? P.cRebF : P.cRebR);
      let f = (front ? msF : msR) * G + k * d + c * dv;
      if (d > P.bumpGap) f += P.kBump * (d - P.bumpGap);
      Fs[n] = f; wh.susp = d;
    }
    const arbF = kArbF * (defl[0] - defl[1]), arbR = kArbR * (defl[2] - defl[3]);
    Fs[0] += arbF; Fs[1] -= arbF; Fs[2] += arbR; Fs[3] -= arbR;
    // load transfer through the suspension links (roll centres / pitch axis): goes straight to the tyres
    const geoF = (ms * P.b / P.L * P.hrcF + 2 * P.muF * P.R) * this.ay / P.tf;
    const geoR = (ms * P.a / P.L * P.hrcR + 2 * P.muR * P.R) * this.ay / P.tr;
    const geoL = (ms * P.hpc + mUns * P.R) * -this.ax / P.L;
    const geo = [geoF + geoL / 2, -geoF + geoL / 2, geoR - geoL / 2, -geoR - geoL / 2];

    // ---------------- tyres ----------------
    let Fx = 0, Fz = 0, Mz = 0, extraDrag = 0, nOff = 0;
    for (let n = 0; n < 4; n++) {
      const wh = W[n];
      const ox = wh.px * fX + wh.py * rX, oz = wh.px * fZ + wh.py * rZ;
      let surf = SURF.asphalt, road = 0;
      if (T) {
        locate(T, this.x + ox, this.z + oz, wh.hint, wh.loc); wh.hint = wh.loc.i;
        surf = surfaceAt(T, wh.loc);
        if (Math.abs(wh.loc.d) > edgeAt(T, wh.loc) + T.KERB_W) nOff++;
        road = roadInput(T, wh.loc, surf);
      }
      const roadV = (road - wh.road) / dt; wh.road = road; wh.surf = surf;
      // vertical: tyre spring (can leave the ground) and unsprung mass
      const mu_ = n < 2 ? P.muF : P.muR, Ft0 = ((n < 2 ? msF : msR) + mu_) * G;
      const Ft = Math.max(0, Ft0 + P.kt * (road - wh.zu) + P.ct * (roadV - wh.vu));
      wh.vu += (Ft - Fs[n] - mu_ * gEff - geo[n]) / mu_ * dt;
      wh.Fz = Ft;

      const vpx = this.vx + this.w * oz, vpz = this.vz - this.w * ox;
      const pw = this.psi - wh.steer, sw = Math.sin(pw), cw = Math.cos(pw);
      const Vx = vpx * sw + vpz * cw, Vy = -vpx * cw + vpz * sw;
      wh.Vx = Vx; wh.Vy = Vy;
      const aVx = Math.abs(Vx);
      wh.k = clamp((wh.k + dt / P.relaxX * (wh.w * P.R - Vx)) / (1 + dt * aVx / P.relaxX), -1.0, 2.5);
      wh.t = clamp((wh.t + dt / P.relaxY * Vy) / (1 + dt * aVx / P.relaxY), -1.6, 1.6);

      const Teff = 0.55 * wh.ts + 0.45 * wh.tc;
      const tGrip = clamp(1 - 0.000095 * (Teff - 88) * (Teff - 88), 0.78, 1);
      const lsens = clamp(1 - P.loadSens * (wh.Fz - P.Fz0) / P.Fz0, 0.72, 1.15);
      const mu = P.mu * surf.mu * lsens * tGrip * (1 - 0.14 * wh.dirt) * (1 - 0.1 * wh.wear);
      wh.mu = mu;
      const D = mu * wh.Fz;
      // slip at peak grows a little with load (longer contact patch)
      const lr = clamp(wh.Fz / P.Fz0, 0.3, 2.5), aPk = A_PEAK * Math.pow(lr, 0.18), kPk = K_PEAK * Math.pow(lr, 0.08);
      const alpha = Math.atan(wh.t);
      const sx = wh.k / kPk, sy = alpha / aPk;
      const rho = Math.sqrt(sx * sx + sy * sy) + 1e-9;
      const fxn = mf(MF_LON, rho * K_PEAK), fyn = mf(MF_LAT, rho * A_PEAK);
      let tFx = D * 1.04 * fxn * sx / rho;
      let tFy = -D * fyn * sy / rho;
      wh.util = Math.min(rho, 3);
      const fade = clamp(1 - aVx / 4, 0, 1);
      if (fade > 0) {
        tFx += 2600 * fade * (wh.w * P.R - Vx) * Math.min(1, wh.Fz / 2000);
        tFy -= 3200 * fade * Vy * Math.min(1, wh.Fz / 2000);
        const mag = Math.hypot(tFx, tFy), lim = D * 1.05;
        if (mag > lim) { tFx *= lim / mag; tFy *= lim / mag; }
      }
      wh.Fx = tFx; wh.Fy = tFy;
      const wx = tFx * sw - tFy * cw, wz = tFx * cw + tFy * sw;
      Fx += wx; Fz += wz; Mz += oz * wx - ox * wz;
      if (surf.drag > 0 && spd > 0.3) extraDrag += surf.drag * wh.Fz * Math.min(1, spd / 3) * (1 + spd * 0.01);
      wh.slipPow = Math.abs(tFx * (wh.w * P.R - Vx)) + Math.abs(tFy * Vy);
      wh.wear = Math.min(1, wh.wear + wh.slipPow * dt * 2.2e-8);
      if (surf.id >= 2) wh.dirt = Math.min(1, wh.dirt + dt * spd * 0.02); else wh.dirt = Math.max(0, wh.dirt - dt * spd / 800);
    }
    this.nOff = nOff;
    if (spd > 1e-3) {
      const drag = 0.5 * RHO * CdA * spd * spd + extraDrag;
      Fx -= drag * this.vx / spd; Fz -= drag * this.vz / spd;
    }
    Fx += gX; Fz += gZ;

    // ---------------- body integration ----------------
    const axw = Fx / mTot, azw = Fz / mTot;
    this.vx += axw * dt; this.vz += azw * dt;
    this.w += Mz / Iz * dt;
    this.x += this.vx * dt; this.z += this.vz * dt; this.psi += this.w * dt;
    this.ax = axw * fX + azw * fZ; this.ay = axw * rX + azw * rZ;
    this.odo += spd * dt;
    // sprung body: heave, pitch (nose down +), roll (left side down +)
    let sumF = 0, mPitch = 0, mRoll = 0;
    for (let n = 0; n < 4; n++) { sumF += Fs[n]; mPitch -= W[n].px * Fs[n]; mRoll += W[n].py * Fs[n]; }
    const heaveA = (sumF - ms * gEff - downF - downR) / ms;
    const pitchA = (mPitch - ms * this.ax * (P.hs - P.hpc) + P.a * downF - P.b * downR) / P.Ipitch;
    const rollA = (mRoll + ms * this.ay * (P.hs - (P.hrcF + P.hrcR) / 2)) / P.Iroll;
    this.vzb += heaveA * dt; this.zb += this.vzb * dt;
    this.pitchD += pitchA * dt; this.pitch += this.pitchD * dt;
    this.rollD += rollA * dt; this.roll += this.rollD * dt;
    for (const wh of W) wh.zu += wh.vu * dt;
    this.heave = this.zb;

    // ---------------- stability control (easy mode) ----------------
    const esc = [0, 0, 0, 0]; let escThr = 1;
    this.escActive = Math.max(0, this.escActive - dt);
    if (inp.assist && Math.abs(vLong) > 6) {
      const v = Math.abs(vLong);
      const vlat = this.vx * rX + this.vz * rZ, beta = Math.atan2(vlat, v);
      const rMax = 0.85 * P.mu * G / v;
      const rT = clamp(-vLong * delta / (P.L * (1 + 0.0011 * v * v)), -rMax, rMax);
      const same = Math.sign(this.w) === Math.sign(rT) || Math.abs(rT) < 0.02;
      const over = same ? Math.abs(this.w) - Math.abs(rT) : Math.abs(this.w) + Math.abs(rT) * 0.5;
      const mag = clamp((over - 0.04) * 9000, 0, 3200) + clamp((Math.abs(beta) - 0.05) * 20000, 0, 3200);
      if (mag > 0) {
        // braking the outside front wheel yaws the car back into line
        esc[this.w > 0 ? 1 : 0] = Math.min(3600, mag);
        escThr = clamp(1 - mag / 2200, 0, 1);
        this.escActive = 0.2;
      }
      if (!same || over < -0.08) escThr = Math.min(escThr, clamp(1 + (over + 0.08) * 4, 0.4, 1)); // understeer: ease the throttle
    }

    // ---------------- engine ----------------
    let thr = inp.throttle * escThr;
    const rpm = this.rpm;
    let clutchOpen = false;
    if (this.shiftT > 0) {
      this.shiftT -= dt;
      if (this.shiftDir > 0 && this.pendingGear > 1) thr = 0; else if (this.pendingGear > 0) {
        const wr = (W[2].w + W[3].w) / 2, target = Math.abs(wr * P.gears[this.pendingGear + 1] * P.final);
        thr = this.we < target ? 1 : 0;
      }
      clutchOpen = true;
      if (this.shiftT <= 0) { this.gear = this.pendingGear; this.shiftT = 0; }
    }
    if (this.gear === 0 || this.pendingGear !== this.gear) clutchOpen = true;
    if (rpm > P.limiter) this.limiterCut = true; else if (rpm < P.limiter - 180) this.limiterCut = false;
    const tcLevel = inp.assist ? Math.max(S.tc, 4) : S.tc;
    if (tcLevel > 0 && !clutchOpen && this.gear > 0) {
      const latUse = Math.min(0.97, Math.abs(this.ay) / (P.mu * G * 0.95));
      const target = K_PEAK * (1.3 - 0.11 * tcLevel) * Math.sqrt(1 - latUse * latUse * (0.5 + 0.1 * tcLevel));
      const gv = Math.max(3, Math.abs(vLong));
      const ks = Math.max(W[2].w, W[3].w) * P.R / gv - 1;
      const over = ks - target;
      if (over > 0 && Math.abs(vLong) > 1.5) { this.tcF = Math.max(0, this.tcF - dt * (10 + over * 400)); this.tcActive = 0.15; }
      else this.tcF = Math.min(1, this.tcF + dt * (1.2 + 0.4 * (6 - tcLevel)));
      thr = Math.min(thr, this.tcF);
    } else this.tcF = 1;
    this.tcActive = Math.max(0, this.tcActive - dt);
    if (this.limiterCut) thr = 0;
    if (rpm < P.idle + 150) thr = Math.max(thr, clamp((P.idle + 150 - rpm) / 400, 0, 0.3));
    if (this.fuel <= 0) thr = 0;
    this.thrEff = thr;
    const Te = thr * torqueAt(rpm) - (1 - thr) * frictionAt(rpm);
    this.engTorque = Te;
    if (Te > 0) this.fuel = Math.max(0, this.fuel - Te * this.we * P.bsfc * dt / P.fuelDensity);
    let we = Math.max(0, this.we + dt * Te / P.Ie);

    for (const wh of W) {
      let w1 = wh.w - dt * wh.Fx * P.R / P.Iw;
      const rrImp = dt * wh.surf.rr * wh.Fz * P.R / P.Iw;
      w1 = Math.abs(w1) <= rrImp ? 0 : w1 - Math.sign(w1) * rrImp;
      wh.w = w1;
    }
    const RL = W[2], RR = W[3];
    const Gr = P.gears[this.gear + 1] * P.final;
    let a = (RL.w + RR.w) / 2, b = RL.w - RR.w, Tin = 0, c = 0;
    if (!clutchOpen && Gr !== 0) {
      const driveRpm = Math.abs(a * Gr) * 60 / TAU;
      if (this.clutchLocked) { if (rpm < 1250 && driveRpm < 1300) this.clutchLocked = false; }
      else if (driveRpm > 1700) this.clutchLocked = true;
      c = this.clutchLocked ? 1 : smoothstep(1150 + 2300 * inp.throttle, 1900 + 3600 * inp.throttle, rpm);
      c = Math.min(c, 1 - (inp.clutch || 0));
      if (c > 0) {
        const delta_ = we - Gr * a;
        let Pimp = delta_ / (1 / P.Ie + Gr * Gr / (2 * P.Iw));
        const cap = c * P.clutchCap * dt;
        if (Pimp > cap) Pimp = cap; else if (Pimp < -cap) Pimp = -cap;
        we -= Pimp / P.Ie; a += Gr * Pimp / (2 * P.Iw);
        Tin = Gr * Pimp / dt;
        if (!this.clutchLocked && c > 0.98 && Math.abs(we - Gr * a) < 2) this.clutchLocked = true;
      }
    } else if (Gr === 0) this.clutchLocked = false;
    this.clutch = clutchOpen ? 0 : c;
    const lsdCap = (S.diffPreload + (Tin * Math.sign(a) >= 0 ? 0.45 : 0.25) * Math.abs(Tin)) * dt;
    let Pl = b * P.Iw / 2; if (Pl > lsdCap) Pl = lsdCap; else if (Pl < -lsdCap) Pl = -lsdCap;
    b -= 2 * Pl / P.Iw;
    RL.w = a + b / 2; RR.w = a - b / 2;
    this.we = Math.max(we, 0);

    // ---------------- brakes: ABS (select-low rear), disc temperature and fade ----------------
    const bias = S.brakeBias, pedal = inp.brake, absOn = S.abs || inp.assist;
    let absAct = false;
    for (let n = 0; n < 4; n++) {
      const wh = W[n];
      if (absOn && (pedal > 0.05 || esc[n] > 0) && Math.abs(wh.Vx) > 3) {
        const slip = (wh.w * P.R - wh.Vx) / Math.abs(wh.Vx), over = -K_PEAK * 0.85 - slip;
        if (over > 0) { wh.abs = Math.max(0.1, wh.abs - dt * (12 + over * 350)); absAct = true; }
        else wh.abs = Math.min(1, wh.abs + dt * 5);
      } else wh.abs = 1;
    }
    const rearAbs = Math.min(W[2].abs, W[3].abs);
    for (let n = 0; n < 4; n++) {
      const wh = W[n], front = n < 2;
      const share = front ? bias / 2 : (1 - bias) / 2;
      const Tb = (pedal * P.brakeMax * share + esc[n]) * (front ? wh.abs : rearAbs) * brakeMu(wh.brakeT) + (inp.handbrake && !front ? 2500 : 0);
      const imp = Tb * dt / P.Iw;
      const w0 = wh.w;
      wh.w = Math.abs(wh.w) <= imp ? 0 : wh.w - Math.sign(wh.w) * imp;
      // disc temperature: brake work in, convection out (more airflow at speed)
      const C = front ? P.discCF : P.discCR;
      wh.brakeT += (Tb * Math.abs(w0 + wh.w) * 0.5 - (3 + 1.0 * spd) * (wh.brakeT - P.Tamb)) * dt / C;
      wh.rot += wh.w * dt;
      wh.lock = pedal > 0.05 && wh.k < -0.25 ? 1 : 0;
      wh.spin = wh.k > 0.3 ? 1 : 0;
    }
    if (absAct) this.absActive = 0.15; else this.absActive = Math.max(0, this.absActive - dt);

    for (const wh of W) {
      wh.ts += dt * (1.9e-4 * wh.slipPow * clamp(1.6 - wh.ts / 200, 0.2, 1) - (wh.ts - wh.tc) * 0.35 - (wh.ts - P.Tamb) * (0.012 + 0.0011 * spd) + (wh.surf.id === 2 ? -0.5 : 0));
      wh.tc += dt * (3.4e-6 * wh.Fz * Math.abs(wh.Vx) + (wh.ts - wh.tc) * 0.05 - (wh.tc - P.Tamb) * 0.0025);
      wh.ts = Math.min(wh.ts, 190); wh.tc = Math.min(wh.tc, 170);
    }

    // ---------------- walls ----------------
    this.impact = 0;
    if (T) {
      locate(T, this.x, this.z, this.hint, this.loc); this.hint = this.loc.i;
      const sn2 = Math.sin(this.psi), cs2 = Math.cos(this.psi);
      for (const cr of this.corners) {
        const ox = cr.fx * sn2 - cr.fy * cs2, oz = cr.fx * cs2 + cr.fy * sn2;
        locate(T, this.x + ox, this.z + oz, cr.hint, cr.loc); cr.hint = cr.loc.i;
        const side = cr.loc.d > 0 ? 1 : 0, lim = T.wall[side][cr.loc.i] - 0.35;
        const pen = Math.abs(cr.loc.d) - lim;
        if (pen > 0) {
          const i = cr.loc.i, sg = cr.loc.d > 0 ? -1 : 1;
          const nx = T.NX[i] * sg, nz = T.NZ[i] * sg;
          this.x += nx * pen; this.z += nz * pen;
          const vpx = this.vx + this.w * oz, vpz = this.vz - this.w * ox;
          const vn = vpx * nx + vpz * nz;
          if (vn < 0) {
            const rn = oz * nx - ox * nz;
            const kN = 1 / mTot + rn * rn / Iz;
            const e = clamp(0.35 - Math.abs(vn) * 0.02, 0.08, 0.35);
            const J = -(1 + e) * vn / kN;
            const tx = -nz, tz = nx, vt = vpx * tx + vpz * tz, rt = oz * tx - ox * tz;
            const kT = 1 / mTot + rt * rt / Iz;
            let Jt = -vt / kT; const jl = 0.45 * J; if (Jt > jl) Jt = jl; else if (Jt < -jl) Jt = -jl;
            const jx = J * nx + Jt * tx, jz = J * nz + Jt * tz;
            this.vx += jx / mTot; this.vz += jz / mTot;
            this.w += (oz * jx - ox * jz) / Iz;
            this.impact = Math.max(this.impact, -vn);
            this.impactPos = [this.x + ox, this.z + oz];
          }
        }
      }
    }
  }
}

return { buildTrack, heightAt, locate, surfaceAt, roadInput, edgeAt, Car, P, SURF, A_PEAK, K_PEAK, torqueAt, brakeMu, defaultSetup, clamp, DEG, TAU, G };
})();
if (typeof window !== 'undefined') window.SIM = SIM;
if (typeof module !== 'undefined') module.exports = SIM;
