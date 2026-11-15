// Unit tests for stats.js. Run: node --test tests/
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'stats.js'), 'utf8');
const C = new Function(core + '; return {Y0, Y1, SEASONS, VARS, REGIONS, _series, _an, series, yearly, tP, normP, ols, mannKendall, lag1, analyze, fingerprint, analogs};')();
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const put = (r, v, months) => { C._series[r + '|' + v] = months; for (const k in C._an) delete C._an[k]; };
const flatYears = vals => vals.flatMap(v => Array(12).fill(v));          // same value in all 12 months of each year
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;   // fixed seed: same numbers every run
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

test('p-value functions match textbook values', () => {
  near(C.tP(2.228, 10), .05, 1e-3); near(C.tP(2.074, 22), .05, 1e-3); near(C.normP(1.96), .05, 1e-3); near(C.normP(0), 1, 1e-6);
});

test('straight-line fit: slope, standard error, p-value', () => {
  const o = C.ols([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
  near(o.slope, .6, 1e-9); near(o.icpt, 2.2, 1e-9); near(o.se, .2828, 1e-3); near(o.p, .124, 2e-3);
  assert.strictEqual(C.ols([1, 2, 3], [5, 5, 5]).slope, 0);
});

test('Mann-Kendall: direction, ties, Sen slope', () => {
  assert.ok(C.mannKendall([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]).p < .01);
  assert.ok(C.mannKendall([1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1]).z < 0);
  near(C.mannKendall([1, 2, 3, 4, 5, 6], [1, 2, 2, 3, 4, 4]).z, 2.338, .01);
  assert.strictEqual(C.mannKendall([1, 2, 3], [1, 3, 5]).sen, 2);
  assert.strictEqual(C.mannKendall([1, 2, 3, 4], [3, 3, 3, 3]).z, 0);
});

test('Sen slope ignores one extreme year; the line fit does not', () => {
  const x = [...Array(12).keys()], y = x.map(i => i); y[6] = 500;
  near(C.mannKendall(x, y).sen, 1, .2); assert.ok(Math.abs(C.ols(x, y).slope - 1) > .5);
});

test('months become one value per year', () => {
  const m = []; for (let y = C.Y0; y <= C.Y1; y++) for (let k = 1; k <= 12; k++) m.push(k);   // value = month number
  put('wisconsin', 'aod', m);
  assert.strictEqual(C.yearly('wisconsin', 'aod', 'ALL', 2002, 2004).y[0], 6.5);
  assert.strictEqual(C.yearly('wisconsin', 'aod', 'JJA', 2002, 2004).y[0], 7);
  const djf = C.yearly('wisconsin', 'aod', 'DJF', 2002, 2004);
  assert.deepStrictEqual(djf.x, [2003, 2004]);          // 2002 needs December 2001, which is before the record
  assert.strictEqual(djf.y[0], 5);                      // (12 + 1 + 2) / 3
});

test('a year with a missing month is skipped, not guessed', () => {
  const m = flatYears([...Array(24).keys()]); m[12 * 5 + 6] = null;   // July 2007 missing
  put('wisconsin', 'aod', m);
  assert.ok(!C.yearly('wisconsin', 'aod', 'ALL', 2002, 2025).x.includes(2007));
  assert.ok(!C.yearly('wisconsin', 'aod', 'JJA', 2002, 2025).x.includes(2007));
  assert.ok(C.yearly('wisconsin', 'aod', 'MAM', 2002, 2025).x.includes(2007));
});

test('fewer than 8 usable years: no test', () => {
  put('wisconsin', 'aod', flatYears([...Array(24).keys()]));
  assert.strictEqual(C.analyze('wisconsin', 'aod', 'ALL', 2002, 2008), null);
  assert.ok(C.analyze('wisconsin', 'aod', 'ALL', 2002, 2009));
});

test('a pair with no NASA file gives nothing, never sample data', () => {
  put('wisconsin', 'sst', null);
  assert.strictEqual(C.series('wisconsin', 'sst'), null);
  assert.strictEqual(C.series('wisconsin', 'never_loaded'), null);
  assert.strictEqual(C.analyze('wisconsin', 'sst', 'ALL', 2002, 2025), null);
});

test('three verdict levels', () => {
  put('wisconsin', 'aod', flatYears([...Array(24).keys()].map(i => i + (i % 2 ? .4 : -.4))));   // clear steady rise
  let a = C.analyze('wisconsin', 'aod', 'ALL', 2002, 2025);
  assert.ok(a.sig && !a.likely && a.up);
  // slow rise hidden in long warm and cool spells: passes the plain test only
  put('wisconsin', 'aod', flatYears([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2].map((v, i) => v + (i % 2) * .01)));
  a = C.analyze('wisconsin', 'aod', 'ALL', 2002, 2025);
  assert.ok(!a.sig && a.likely && a.p0 < .05 && a.p >= .05);
  put('wisconsin', 'aod', flatYears([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4]));   // noise
  a = C.analyze('wisconsin', 'aod', 'ALL', 2002, 2025);
  assert.ok(!a.sig && !a.likely);
});

for (const phi of [0, .5]) test(`"confirmed" false alarms stay below 5% on trend-free series (year-to-year memory ${phi})`, () => {
  let line = 0, mk = 0; const N = 3000;
  for (let k = 0; k < N; k++){ const yrs = []; let e = gauss();
    for (let i = 0; i < 24; i++){ e = phi * e + Math.sqrt(1 - phi * phi) * gauss(); yrs.push(e); }
    put('wisconsin', 'aod', flatYears(yrs));
    const a = C.analyze('wisconsin', 'aod', 'ALL', 2002, 2025); if (a.sig) line++; if (a.mk.p < .05) mk++; }
  assert.ok(line / N < .05, `line fit ${(100 * line / N).toFixed(1)}%`); assert.ok(mk / N < .05, `Mann-Kendall ${(100 * mk / N).toFixed(1)}%`);
});

test('real NASA data: known results', () => {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data', 'regions.json'), 'utf8'));
  for (const r in C.REGIONS) for (const v in C.VARS) put(r, v, d.series[r] && d.series[r][v] ? d.series[r][v] : null);
  const A = (r, v, s) => C.analyze(r, v, s, C.Y0, C.Y1);
  assert.deepStrictEqual(Object.keys(C.REGIONS).sort(), Object.keys(d.series).sort());      // app regions = data regions
  let a = A('wisconsin', 'aod', 'JJA'); assert.ok(a.sig && a.up); near(a.slope * 10, .041, .002); near(a.p, .047, .003);
  assert.ok(!A('wisconsin', 'aod', 'DJF').sig);
  a = A('amazon', 'tws', 'ALL'); assert.ok(a.sig && !a.up);
  a = A('world', 'temp', 'ALL'); assert.ok(!a.sig && a.likely && a.up); near(a.slope * 10, .19, .01);
  a = A('pune', 'precip', 'JJA'); assert.ok(!a.sig && !a.likely);
  assert.strictEqual(A('world', 'tws', 'ALL'), null);
  const sim = C.analogs('igp', C.Y0, C.Y1);
  assert.ok(sim.every(o => o.id !== 'igp' && o.id !== 'world' && o.score >= 0 && o.score <= 1));
  assert.ok(sim.every((o, i) => !i || sim[i - 1].score >= o.score));                         // best match first
});
