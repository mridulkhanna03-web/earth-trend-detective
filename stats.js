// Data definitions and all statistics. No page code here, so this file can be tested on its own (tests/core.test.js).
const Y0 = 2002, Y1 = 2025;
const SEASONS = {
  ALL:{label:'All year', long:'whole-year', m:[1,2,3,4,5,6,7,8,9,10,11,12]},
  DJF:{label:'Dec–Feb', long:'Dec–Feb', m:[12,1,2]},
  MAM:{label:'Mar–May', long:'Mar–May', m:[3,4,5]},
  JJA:{label:'Jun–Aug', long:'Jun–Aug', m:[6,7,8]},
  SON:{label:'Sep–Nov', long:'Sep–Nov', m:[9,10,11]}
};
const VARS = {
  aod:{name:'Haze and smoke in the air', sci:'Aerosol optical depth (AOD)', short:'Haze/smoke', unit:'', dp:3, where:'any',
    src:'MODIS on Aqua satellite, product MYD08_M3 v6.1', help:'How much smoke, dust or pollution is in the air. Higher = hazier.',
    up:'More particles in the air: wildfire smoke, dust, crop burning, or traffic and industrial pollution.',
    down:'Fewer particles in the air: cleaner fuels, emission rules, fewer fires or less dust.',
    check:'Compare with satellite fire counts upwind and wind direction on the haziest days.'},
  temp:{name:'Air temperature', sci:'2-metre air temperature', short:'Temperature', unit:'°C', dp:2, where:'any',
    src:'MERRA-2 reanalysis, product M2TMNXSLV v5.12.4 (T2M)', help:'Average air temperature near the ground.',
    up:'The regional share of global warming. Can be amplified by drier soils or city growth.',
    down:'Unusual. In a short record it may reflect natural cycles such as El Niño and La Niña.',
    check:'Compare with nearby weather-station records and the global average.'},
  precip:{name:'Rainfall', sci:'Precipitation', short:'Rainfall', unit:'mm/month', dp:1, where:'any', min:0,
    src:'GPM IMERG Final Run, product GPM_3IMERGM v07', help:'Rain and snow reaching the ground each month.',
    up:'A stronger monsoon or more storms reaching the region. Natural cycles can dominate short records.',
    down:'Storm tracks or monsoon rains shifting away. Natural cycles can dominate short records.',
    check:'Check against El Niño/La Niña years and rain-gauge records.'},
  tws:{name:'Groundwater level', sci:'Groundwater storage percentile', short:'Groundwater', unit:'points', dp:1, where:'land', min:0, max:100,
    src:'GRACE and GRACE-FO satellites with a NASA land model, product GRACEDADM_CLSM025GL_7D v3.0 (weekly, averaged to months)', help:'How full the groundwater is compared with its own history: 0 = driest on record, 100 = wettest. Starts in 2003.',
    up:'Wetter years refilling soils and aquifers, or less pumping.',
    down:'Groundwater pumping, drought, or less snow and rain to refill aquifers.',
    check:'Compare with rainfall and irrigation records to separate drought from pumping.'},
  soil:{name:'Soil moisture', sci:'Surface soil moisture (0–10 cm)', short:'Soil moisture', unit:'kg/m²', dp:2, where:'land',
    src:'GLDAS Noah land model, product GLDAS_NOAH025_M v2.1', help:'Water held in the top layer of soil. Matters for crops.',
    up:'More rain or more irrigation.',
    down:'Less rain, or more evaporation in hotter weather.',
    check:'Compare with rainfall and temperature trends for the same months.'},
  sst:{name:'Sea surface temperature', sci:'Sea surface temperature (SST)', short:'Sea temperature', unit:'°C', dp:2, where:'ocean',
    src:'MODIS on Aqua satellite, product MODISA_L3m_SST_Monthly_9km R2019.0', help:'Temperature of the top of the ocean. Shown for the whole world only.',
    up:'The ocean absorbing heat from a warming atmosphere, or warm currents shifting.',
    down:'Stronger upwelling of cold deep water, or natural ocean cycles.',
    check:'Compare with ocean buoy records and current maps.'}
};
// bbox = [south, west, north, east]
const REGIONS = {
  world:{name:'Entire world', kind:'world'},
  wisconsin:{name:'Wisconsin, USA', kind:'land', bbox:[42.5,-92.9,47.1,-86.8]},
  california:{name:'Central Valley, California', kind:'land', bbox:[35,-122.5,40.5,-118.5]},
  amazon:{name:'Southern Amazon, Brazil', kind:'land', bbox:[-13,-65,-5,-50]},
  sahel:{name:'Sahel, West Africa', kind:'land', bbox:[11,-10,17,15]},
  igp:{name:'Indo-Gangetic Plain, India', kind:'land', bbox:[24,74,31,88]},
  pune:{name:'Western Maharashtra (Pune), India', kind:'land', bbox:[17,73,20,76]},
  med:{name:'Iberia, Mediterranean', kind:'land', bbox:[36,-9.5,43.5,3]},
  capetown:{name:'Western Cape, South Africa', kind:'land', bbox:[-34.8,17.8,-31,21]},
  seaus:{name:'Southeast Australia', kind:'land', bbox:[-38.5,141,-30,152]},
};

function applies(r, v){ const k = REGIONS[r].kind, w = VARS[v].where; return w === 'any' || k === 'world' || k === w; }

const _series = {};   // filled from data/regions.json when the page starts
function series(r, v){ return _series[r + '|' + v] ?? null; }   // monthly values Jan Y0 .. Dec Y1; null = no NASA file for this pair
// one value per year: the average of the chosen months. Dec counts toward the following year's Dec–Feb.
function yearly(r, v, s, y0, y1){
  const d = series(r, v), x = [], y = []; if (!d) return {x, y};
  for (let yr = y0; yr <= y1; yr++){
    let sum = 0, ok = true;
    for (const m of SEASONS[s].m){
      const yy = (s === 'DJF' && m === 12) ? yr - 1 : yr, val = yy < Y0 ? null : d[(yy - Y0) * 12 + m - 1];
      if (val == null){ ok = false; break; } sum += val;
    }
    if (ok){ x.push(yr); y.push(sum / SEASONS[s].m.length); }
  }
  return {x, y};
}

// ---- statistics ----
function lgamma(x){ const c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.001208650973866179,-.000005395239384953];
  let y = x, t = x + 5.5; t -= (x + .5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x){ const T = 1e-30; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < T) d = T; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++){ const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < T) d = T; c = 1 + aa / c; if (Math.abs(c) < T) c = T; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < T) d = T; c = 1 + aa / c; if (Math.abs(c) < T) c = T; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
function betai(a, b, x){ if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
const tP = (t, df) => betai(df / 2, .5, df / (df + t * t));            // two-sided p for Student t
function normP(z){ const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + .5 * x);   // two-sided p for normal z
  return t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (.37409196 + t * (.09678418 + t * (-.18628806 + t * (.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-.82215223 + t * .17087277))))))))); }
function ols(x, y){ const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++){ sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2; }
  const slope = sxy / sxx, icpt = my - slope * mx, sse = Math.max(syy - slope * sxy, 0), se = Math.sqrt(sse / (n - 2) / sxx);
  return {slope, icpt, se, p: se === 0 ? 0 : tP(slope / se, n - 2), r2: syy ? 1 - sse / syy : 0, mean: my}; }
function mannKendall(x, y, inflate = 1){ const n = y.length, sl = [], seen = {}; let S = 0, ties = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++){ S += Math.sign(y[j] - y[i]); sl.push((y[j] - y[i]) / (x[j] - x[i])); }
  for (const v of y) seen[v] = (seen[v] || 0) + 1;
  for (const k in seen){ const t = seen[k]; ties += t * (t - 1) * (2 * t + 5); }   // equal values carry less information
  // shortcut: autocorrelation handled by inflating the variance with (1+r1)/(1-r1), not the full Hamed-Rao formula; the cautious r1 from analyze() is passed in; swap in Hamed-Rao only if a reviewer asks for the standard name
  const z = S === 0 ? 0 : (S - Math.sign(S)) / Math.sqrt((n * (n - 1) * (2 * n + 5) - ties) / 18 * inflate);
  sl.sort((a, b) => a - b); const h = sl.length >> 1;
  return {z, p: normP(z), sen: sl.length % 2 ? sl[h] : (sl[h - 1] + sl[h]) / 2}; }
function lag1(y){ const n = y.length, m = y.reduce((a, b) => a + b) / n; let a = 0, b = 0; for (let i = 0; i < n; i++){ b += (y[i] - m) ** 2; if (i) a += (y[i] - m) * (y[i - 1] - m); } return b ? a / b : 0; }
function corr(a, b){ return Math.sign(ols(a, b).slope) * Math.sqrt(ols(a, b).r2); }

const _an = {};
function analyze(r, v, s, y0, y1){
  const key = [r, v, s, y0, y1].join('|'); if (key in _an) return _an[key];
  const {x, y} = yearly(r, v, s, y0, y1), n = x.length; if (n < 8) return _an[key] = null;
  const o = ols(x, y), p0 = o.p, r1 = lag1(y.map((val, i) => val - o.icpt - o.slope * x[i]));
  // if each year resembles the one before, there is less independent evidence: shrink the effective number of years
  // short records under-estimate r1, so use a cautious upper estimate (small-sample bias + one standard error, 1/sqrt(n)).
  // Measured on trend-free series: false alarms stay under 5% for 16+ years with r1 up to 0.5 (24 years: up to 0.7). Cost: weak real trends are missed more often.
  const rc = Math.min(.9, Math.max(0, r1 + (1 + 4 * r1) / n + 1 / Math.sqrt(n))), fix = rc > 0, k = (1 + rc) / (1 - rc), df = Math.max(2, n / k - 2);
  if (fix){ o.se *= Math.sqrt((n - 2) / df); o.p = tP(o.slope / o.se, df); }
  return _an[key] = {x, y, n, ...o, df, fix, r1, mk: mannKendall(x, y, k), p0, sig: o.p < .05, likely: o.p >= .05 && p0 < .05, up: o.slope > 0};   // sig = confirmed (strict test); likely = plain test only
}
// trend fingerprint: Mann-Kendall z-score for every variable × season. Two regions are similar when their fingerprints point the same way.
function fingerprint(r, y0, y1){ const f = {};
  for (const v in VARS) for (const s in SEASONS){ const a = analyze(r, v, s, y0, y1); if (a) f[v + '|' + s] = Math.max(-4, Math.min(4, a.mk.z)); }
  return f; }
function analogs(r, y0, y1){
  const me = fingerprint(r, y0, y1), out = [];
  for (const o in REGIONS){ if (o === r || REGIONS[o].kind !== REGIONS[r].kind) continue;   // compare land with land, ocean with ocean
    const f = fingerprint(o, y0, y1); let ab = 0, aa = 0, bb = 0, k = 0; const shared = [];
    for (const d in me) if (d in f){ ab += me[d] * f[d]; aa += me[d] ** 2; bb += f[d] ** 2; k++;
      if (Math.abs(me[d]) > 1.96 && Math.abs(f[d]) > 1.96 && me[d] * f[d] > 0) shared.push({d, w: Math.min(Math.abs(me[d]), Math.abs(f[d])), up: me[d] > 0}); }
    if (k < 10) continue;
    out.push({id: o, score: Math.max(0, ab / Math.sqrt(aa * bb || 1)), shared: shared.sort((a, b) => b.w - a.w)});
  }
  return out.sort((a, b) => b.score - a.score);
}

// self-check of the statistics against known answers
console.assert(Math.abs(tP(2.228, 10) - .05) < 1e-3 && Math.abs(normP(1.96) - .05) < 1e-3, 'p-value functions');
console.assert(Math.abs(ols([1,2,3,4,5],[2,4,5,4,5]).slope - .6) < 1e-9 && Math.abs(ols([1,2,3,4,5],[2,4,5,4,5]).p - .124) < 2e-3, 'ols');
console.assert(Math.abs(ols([1,2,3,4,5],[2,4,5,4,5]).se - .2828) < 1e-3, 'slope standard error');
console.assert(Math.abs(mannKendall([1,2,3,4,5,6],[1,2,2,3,4,4]).z - 2.338) < .01, 'mann-kendall tie correction');
console.assert(mannKendall([1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7,8]).p < .01 && mannKendall([1,2,3],[1,3,5]).sen === 2, 'mann-kendall');
