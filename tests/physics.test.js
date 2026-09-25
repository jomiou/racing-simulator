// Physics regression tests: run with `node --test tests/`
const test = require('node:test');
const assert = require('node:assert');
const S = require('./load.js');

const DT = 1 / 1000;
const kmh = c => c.fwdSpeed() * 3.6;
const slipDeg = c => {
  const vl = c.fwdSpeed(), vlat = -c.vx * Math.cos(c.psi) + c.vz * Math.sin(c.psi);
  return c.speed > 5 ? Math.abs(Math.atan2(vlat, Math.abs(vl))) * 57.3 : 0;
};
// a car on an endless flat road, rolling at v km/h in the given gear
function rolling(v, gear, setup = {}) {
  const c = new S.Car(null); c.reset(0, 0); Object.assign(c.setup, setup);
  c.vz = v / 3.6; for (const w of c.wheels) w.w = c.vz / S.P.R;
  c.gear = c.pendingGear = gear; c.clutchLocked = true; c.we = c.wheels[2].w * c.ratio;
  return c;
}
const upshift = c => { if (c.rpm > 8250 && c.gear < 6 && c.shiftT <= 0) c.shift(1); };

test('Spa builds: about 7 km, 19 named corners, realistic gradients', () => {
  const T = S.buildTrack();
  assert.ok(Math.abs(T.length - 7004) < 30, `length ${T.length}`);
  assert.strictEqual(T.corners.length, 19);
  assert.strictEqual(T.corners[0].name, 'La Source');
  const maxGrade = Math.max(...T.GR) * 100;
  assert.ok(maxGrade > 12 && maxGrade < 19, `Raidillon grade ${maxGrade.toFixed(1)} %`);
});

test('standing start: 0-100 km/h in 3.3-4.3 s, top speed 270-300 km/h', () => {
  const c = new S.Car(null); c.reset(0, 0);
  const inp = { steer: 0, throttle: 1, brake: 0 };
  let t = 0, t100 = null;
  while (t < 45) { c.step(DT, inp); t += DT; upshift(c); if (t100 === null && kmh(c) >= 100) t100 = t; }
  assert.ok(t100 > 3.3 && t100 < 4.3, `0-100 ${t100}`);
  assert.ok(kmh(c) > 270 && kmh(c) < 300, `vmax ${kmh(c)}`);
});

test('ABS stop from 200 km/h: under 95 m and dead straight', () => {
  const c = rolling(200, 5); const z0 = c.z;
  while (c.fwdSpeed() > 0.5) { c.step(DT, { steer: 0, throttle: 0, brake: 1 }); if (c.gear > 1 && c.shiftT <= 0 && c.rpm < 4500) c.shift(-1); }
  assert.ok(c.z - z0 < 95, `distance ${(c.z - z0).toFixed(1)}`);
  assert.ok(Math.abs(c.psi) < 0.02, `yaw ${c.psi}`);
});

test('default brake balance locks the fronts before the rears', () => {
  const c = rolling(240, 6, { abs: false }); let first = null, pb = 0;
  while (c.fwdSpeed() > 3 && !first) {
    pb = Math.min(1, pb + DT * 4.5); c.step(DT, { steer: 0, throttle: 0, brake: pb });
    if (c.wheels[0].k < -0.3 || c.wheels[1].k < -0.3) first = 'front'; else if (c.wheels[2].k < -0.3 || c.wheels[3].k < -0.3) first = 'rear';
  }
  assert.strictEqual(first, 'front');
});

test('lateral grip: ~1.5 g at 80 km/h rising to ~2 g at 220 km/h with downforce', () => {
  for (const [v, gear, lo, hi] of [[80, 2, 1.35, 1.7], [220, 5, 1.85, 2.25]]) {
    const c = rolling(v, gear, { tc: 0 }); const v0 = v / 3.6;
    let t = 0, best = 0, it = 0.3;
    while (t < 25) {
      const e = v0 - c.fwdSpeed(); it = Math.max(0, Math.min(1, it + e * DT * 0.8));
      c.step(DT, { steer: Math.min(1, t * 0.02), throttle: Math.max(0, Math.min(1, it + e * 0.4)), brake: 0 }); t += DT;
      best = Math.max(best, Math.abs(c.ay) / 9.81);
      if (Math.abs(c.fwdSpeed() - v0) > 8) break;
    }
    assert.ok(best > lo && best < hi, `${v} km/h: ${best.toFixed(2)} g`);
  }
});

test('traction control holds a hard corner exit; without it a 500 hp car spins', () => {
  const exit = tc => {
    const c = rolling(60, 2, { tc }); const R = 40, v0 = 60 / 3.6; let t = 0, worst = 0, it = 0.2, thr = 0.2;
    while (t < 6) {
      const vl = c.fwdSpeed(), vlat = -c.vx * Math.cos(c.psi) + c.vz * Math.sin(c.psi), beta = Math.atan2(vlat, Math.abs(vl));
      const steer = (S.P.L / R + 0.02 + (v0 / R * vl / v0 + c.w) * 0.08 + beta * 0.8) / (S.P.steerLock * S.DEG / S.P.steerRatio);
      if (t < 3) { const e = v0 - vl; it = Math.max(0, Math.min(1, it + e * DT * 0.8)); thr = Math.max(0, Math.min(1, it + e * 0.3)); } else thr = Math.min(1, thr + DT / 0.5);
      c.step(DT, { steer: Math.max(-1, Math.min(1, steer)), throttle: thr, brake: 0 }); t += DT; upshift(c);
      worst = Math.max(worst, slipDeg(c)); if (worst > 25) break;
    }
    return worst;
  };
  assert.ok(exit(3) < 10, `TC 3: ${exit(3).toFixed(1)}°`);
  assert.ok(exit(0) > 20, 'TC off should be able to spin');
});

test('keyboard easy mode catches a full-throttle, full-lock abuse', () => {
  const run = assist => {
    const c = rolling(70, 2, { tc: 0, abs: false }); let t = 0, steer = 0, worst = 0;
    while (t < 5) {
      steer = Math.min(0.6, steer + DT * 2.3);
      const vl = c.fwdSpeed(), vlat = -c.vx * Math.cos(c.psi) + c.vz * Math.sin(c.psi), beta = Math.atan2(vlat, Math.abs(vl));
      const s = assist ? steer + beta * 1.4 / (S.P.steerLock * S.DEG / S.P.steerRatio) : steer;
      c.step(DT, { steer: Math.max(-1, Math.min(1, s)), throttle: t > 0.6 ? 1 : 0.3, brake: 0, assist }); t += DT; upshift(c);
      worst = Math.max(worst, slipDeg(c));
    }
    return worst;
  };
  assert.ok(run(true) < 8, `easy mode slide ${run(true).toFixed(1)}°`);
  assert.ok(run(false) > 30, 'without assists the same inputs spin the car');
});

test('a steady driver laps Spa cleanly', () => {
  const T = S.buildTrack(), N = T.N, c = new S.Car(T);
  // target speed from centre-line curvature at 1.3 g, with braking/traction limits
  const v = new Float64Array(N);
  for (let i = 0; i < N; i++) { let k = 0; for (let q = -4; q <= 4; q++) k = Math.max(k, Math.abs(T.K[(i + q + N) % N])); v[i] = Math.min(80, Math.sqrt(1.3 * 9.81 / Math.max(k, 1e-6))); }
  for (let it = 0; it < 3; it++) {
    for (let i = N - 1; i >= 0; i--) { const j = (i + 1) % N; v[i] = Math.min(v[i], Math.sqrt(v[j] ** 2 + 2 * 1.5 * 9.81 * T.SEG[i])); }
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; v[j] = Math.min(v[j], Math.sqrt(v[i] ** 2 + 2 * 0.7 * 9.81 * T.SEG[i])); }
  }
  let t = 0, start = null, lap = null, prevS = c.loc.s, walls = 0;
  while (t < 400 && lap === null) {
    const i = c.loc.i, j = (i + Math.round(Math.max(6, c.speed * 0.55) / 2)) % N;
    const dx = T.X[j] - c.x, dz = T.Z[j] - c.z, sn = Math.sin(c.psi), cs = Math.cos(c.psi);
    const f = dx * sn + dz * cs, r = -dx * cs + dz * sn;
    const vl = c.fwdSpeed(), vlat = -c.vx * cs + c.vz * sn, beta = c.speed > 3 ? Math.atan2(vlat, Math.abs(vl)) : 0;
    const delta = Math.atan(2 * r / (f * f + r * r) * S.P.L) + beta * 0.9 - 0.012 * c.loc.d;
    const e = v[(i + 3) % N] - vl;
    c.step(DT, { steer: Math.max(-1, Math.min(1, delta / (S.P.steerLock * S.DEG / S.P.steerRatio))), throttle: e > 0 ? Math.min(1, e * 0.25) : 0, brake: e < -0.5 ? Math.min(1, -e * 0.35) : 0 });
    t += DT; upshift(c);
    if (c.gear > 1 && c.shiftT <= 0 && c.rpm * S.P.gears[c.gear] / S.P.gears[c.gear + 1] < 7300 && c.rpm < 5600) c.shift(-1);
    if (c.impact > 0) walls++;
    if (prevS > T.length - 60 && c.loc.s < 60) { if (start === null) start = t; else lap = t - start; }
    prevS = c.loc.s;
  }
  assert.strictEqual(walls, 0, 'no wall contact');
  assert.ok(lap !== null && lap > 140 && lap < 200, `lap ${lap && lap.toFixed(1)} s`);
});
