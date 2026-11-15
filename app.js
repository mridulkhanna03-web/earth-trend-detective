// Page code: loads data/regions.json, then menus, globe, chart and the answer panels. Uses stats.js.
(async () => {
const $ = id => document.getElementById(id);
// Real NASA data only. data/regions.json is made by giovanni_to_regions.py; format: {"source", "start": "2002-01", "series": {region: {variable: [monthly values, null = missing]}}}
let DATA = null; try { const res = await fetch('data/regions.json'); if (res.ok) DATA = await res.json(); } catch (e) {}
if (!DATA){ document.querySelector('main').innerHTML = '<p style="max-width:70ch;font-size:18px"><b>The NASA data file could not be loaded.</b> This page needs <code>data/regions.json</code> next to it and must be opened through a web address (http), not as a local file.</p>'; return; }
{ const [sy, sm] = DATA.start.split('-').map(Number), skip = (Y0 - sy) * 12 - (sm - 1);
  for (const r in REGIONS){ if (!DATA.series[r]){ delete REGIONS[r]; continue; }   // regions without NASA files are not offered
    for (const v in VARS){ const m = DATA.series[r][v];
      _series[r + '|' + v] = m ? Array.from({length: (Y1 - Y0 + 1) * 12}, (_, i) => m[i + skip] ?? null) : null; } } }
const state = {v:'aod', r:'wisconsin', y0:Y0, y1:Y1, s:'JJA'};
const EXAMPLES = [
  {t:'Smoke summers over Wisconsin', v:'aod', r:'wisconsin', s:'JJA'},
  {t:'Amazon groundwater is falling', v:'tws', r:'amazon', s:'ALL'},
  {t:'Hazier air over north India', v:'aod', r:'igp', s:'ALL'},
  {t:'Is the whole world warming?', v:'temp', r:'world', s:'ALL'},
  {t:'Pune monsoon rain: no clear trend', v:'precip', r:'pune', s:'JJA'}
];
const COL = {up:'#eb6834', down:'#2a78d6', flat:'#8A93A0', ink:'#10233F'};
const fmt = (x, dp) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(dp);
const signed = (x, dp) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(dp);
function tCrit(df){ let lo = 0, hi = 60; for (let i = 0; i < 50; i++){ const m = (lo + hi) / 2; tP(m, df) > .05 ? lo = m : hi = m; } return hi; }   // t value for a 95% range
const pTxt = p => p < .001 ? '< 0.001' : p.toFixed(3);
const unit = v => VARS[v].unit ? ' ' + VARS[v].unit : '';
const icon = a => !a ? '' : a.sig || a.likely   // filled = confirmed, outline = likely
  ? `<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="${a.up ? 'M7 2l5 8H2z' : 'M7 12l5-8H2z'}" fill="${a.sig ? (a.up ? COL.up : COL.down) : '#fff'}" stroke="${a.up ? COL.up : COL.down}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
  : '<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="6" width="10" height="2" fill="#8A93A0"/></svg>';
const word = a => !a ? 'No data' : a.sig ? (a.up ? 'Rising' : 'Falling') : a.likely ? (a.up ? 'Likely rising' : 'Likely falling') : 'No clear trend';

// ---- controls ----
$('varSel').innerHTML = Object.entries(VARS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
$('regSel').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('');
const years = Array.from({length: Y1 - Y0 + 1}, (_, i) => `<option>${Y0 + i}</option>`).join('');
$('y0Sel').innerHTML = years; $('y1Sel').innerHTML = years;
$('seaSel').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<option value="${k}">${k === 'ALL' ? 'Whole year' : s.label + ' only'}</option>`).join('');
$('examples').insertAdjacentHTML('beforeend', EXAMPLES.map((e, i) => `<button type="button" class="chip" data-ex="${i}">${e.t}</button>`).join(''));
$('varSel').onchange = e => set({v: e.target.value});
$('regSel').onchange = e => set({r: e.target.value});
$('seaSel').onchange = e => set({s: e.target.value});
$('y0Sel').onchange = $('y1Sel').onchange = () => {
  const y0 = +$('y0Sel').value, y1 = +$('y1Sel').value, bad = y1 - y0 < 7;
  $('yrErr').hidden = !bad; if (!bad) set({y0, y1});
};
document.addEventListener('click', e => {
  const ex = e.target.closest('[data-ex]'); if (ex){ const {v, r, s} = EXAMPLES[ex.dataset.ex]; return set({v, r, s, y0: Y0, y1: Y1}, true); }
  const t = e.target.closest('[data-set]'); if (t) set(JSON.parse(t.dataset.set));
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr[data-set]')) set(JSON.parse(e.target.dataset.set)); });
function set(patch, fly){ const moved = fly || (patch.r && patch.r !== state.r); Object.assign(state, patch); render(); if (moved) flyTo(); }

// ---- Earth: drawn here from coastline data, so no map-tile server is needed ----
const svg = d3.select('#globe');
svg.append('defs').html('<radialGradient id="shade" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#10233F" stop-opacity=".16"/></radialGradient>');
const gSea = svg.append('path').attr('fill', '#D5E4F3'),
      gGrat = svg.append('path').attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', .7).attr('stroke-opacity', .8),
      gLand = svg.append('path').attr('fill', '#FCFCF9').attr('stroke', '#9DB2C9').attr('stroke-width', .7),
      gShade = svg.append('path').attr('fill', 'url(#shade)').attr('pointer-events', 'none'),
      gEdge = svg.append('path').attr('fill', 'none').attr('stroke', '#9DB2C9'),
      gReg = svg.append('g'), gOver = svg.append('g').attr('pointer-events', 'none');
const graticule = d3.geoGraticule10(), sphere = {type:'Sphere'};
let land = null, mode = 'globe', zoom = 1, rot = [150, -20], proj, path;
function box([s, w, n, e]){   // lat/lon box as a polygon with points every 2°, so edges follow the grid lines
  const r = []; for (let x = w; x < e; x += 2) r.push([x, s]); for (let y = s; y < n; y += 2) r.push([e, y]);
  for (let x = e; x > w; x -= 2) r.push([x, n]); for (let y = n; y > s; y -= 2) r.push([w, y]); r.push(r[0]);
  const g = {type:'Polygon', coordinates:[r]}; if (d3.geoArea(g) > 2 * Math.PI) r.reverse(); return g;
}
const centre = id => { const [s, w, n, e] = REGIONS[id].bbox; return [(w + e) / 2, (s + n) / 2]; };   // [lon, lat]
const shapes = Object.entries(REGIONS).filter(([, r]) => r.bbox).map(([id, r]) => ({id, geo: box(r.bbox)}));
const regSel = gReg.selectAll('path').data(shapes).join('path').attr('class', 'region')
  .on('click', (e, d) => set({r: d.id}))
  .on('mousemove', (e, d) => { const b = $('globe').getBoundingClientRect(), t = $('tipbox'); t.hidden = false; t.innerHTML = d.tip; t.style.left = (e.clientX - b.left) + 'px'; t.style.top = (e.clientY - b.top) + 'px'; })
  .on('mouseleave', () => $('tipbox').hidden = true);

function setProj(){
  const flat = mode === 'flat', H = flat ? 320 : 600;
  svg.attr('viewBox', `0 0 600 ${H}`).classed('flatmode', flat);
  proj = flat ? d3.geoNaturalEarth1().fitExtent([[4, 4], [596, H - 4]], sphere)
              : d3.geoOrthographic().scale(292 * zoom).translate([300, 300]).clipAngle(90).rotate(rot);
  path = d3.geoPath(proj);
  $('dragHint').textContent = flat ? 'Click a coloured box to choose it.' : 'Drag to spin. Click a coloured box to choose it.';
  $('zIn').parentElement.hidden = flat;
}
const visible = c => mode === 'flat' || d3.geoDistance(c, [-rot[0], -rot[1]]) < 1.4;
function draw(){   // positions only; colours are set in render()
  gSea.attr('d', path(sphere)); gShade.attr('d', mode === 'flat' ? null : path(sphere)); gEdge.attr('d', path(sphere));
  gGrat.attr('d', path(graticule)); gLand.attr('d', land ? path(land) : null);
  regSel.attr('d', d => path(d.geo));
  gOver.selectAll('*').remove();
  const R = REGIONS[state.r];
  (state.an || []).forEach((o, i) => { const c = centre(o.id); if (!visible(c)) return; const [x, y] = proj(c);
    gOver.append('circle').attr('cx', x).attr('cy', y).attr('r', 12).attr('fill', COL.ink).attr('stroke', '#fff').attr('stroke-width', 2);
    gOver.append('text').attr('x', x).attr('y', y + 5).attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 14).attr('font-weight', 700).text(i + 1); });
  if (R.bbox && visible(centre(state.r))){ const [x, y] = proj([centre(state.r)[0], R.bbox[0]]); label(x, y + 22, R.name); }
}
function label(x, y, text){
  const t = gOver.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('font-size', 15).attr('font-weight', 700).attr('fill', COL.ink)
    .attr('stroke', '#fff').attr('stroke-width', 4).attr('paint-order', 'stroke').attr('stroke-linejoin', 'round').text(text);
}
function flyTo(){
  const R = REGIONS[state.r]; if (mode === 'flat' || !R.bbox) return draw();
  let [lon, lat] = centre(state.r);
  const target = [-lon, -lat * .8]; target[0] += 360 * Math.round((rot[0] - target[0]) / 360);   // spin the short way round
  const i = d3.interpolate(rot, target), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  svg.interrupt().transition().duration(still ? 0 : 1100).ease(d3.easeCubicInOut).tween('spin', () => t => { rot = i(t); proj.rotate(rot); draw(); });
}
svg.call(d3.drag().on('drag', e => { if (mode === 'flat') return; svg.interrupt(); const k = 75 / proj.scale();
  rot = [rot[0] + e.dx * k, Math.max(-80, Math.min(80, rot[1] - e.dy * k))]; proj.rotate(rot); draw(); }));
$('zIn').onclick = () => { zoom = Math.min(3, zoom * 1.4); setProj(); draw(); };
$('zOut').onclick = () => { zoom = Math.max(1, zoom / 1.4); setProj(); draw(); };
$('mGlobe').onclick = $('mFlat').onclick = e => { mode = e.target.id === 'mFlat' ? 'flat' : 'globe';
  $('mGlobe').setAttribute('aria-pressed', mode === 'globe'); $('mFlat').setAttribute('aria-pressed', mode === 'flat'); setProj(); draw(); };
fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then(r => r.json())
  .then(t => { land = topojson.feature(t, t.objects.land); draw(); }).catch(() => $('mapNote').hidden = false);

// ---- chart ----
let chart;
Chart.defaults.font.family = '"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.font.size = 13;
function drawChart(a){
  const V = VARS[state.v], S = SEASONS[state.s], canvas = $('chart');
  $('chartEmpty').hidden = !!a; canvas.hidden = !a; $('tableWrap').hidden = !a;
  if (chart){ chart.destroy(); chart = null; }
  if (!a){ $('chartEmpty').textContent = applies(state.r, state.v)
      ? 'Not enough complete years in this period to test a trend. Choose a longer period.'
      : `${V.name} is only measured over ${V.where === 'ocean' ? 'ocean' : 'land'}. Choose ${V.where === 'ocean' ? 'an ocean region (Arabian Sea, Gulf of Maine)' : 'a land region'} or the entire world.`; return; }
  const yLabel = `${S.label} average`, line = x => a.icpt + a.slope * x;
  let labels = [], sets;
  if (state.s === 'ALL'){   // show the monthly detail behind the yearly averages
    const d = series(state.r, state.v), MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], mon = [], yr = [], tr = [];
    for (let y = state.y0; y <= state.y1; y++) for (let m = 1; m <= 12; m++){
      labels.push(MON[m - 1] + ' ' + y); mon.push(d[(y - Y0) * 12 + m - 1]);
      const i = a.x.indexOf(y); yr.push(m === 7 && i >= 0 ? a.y[i] : null); tr.push(line(y + (m - 7) / 12));
    }
    sets = [
      {label:'Each month', data: mon, borderColor:'#B9C6DA', borderWidth: 1, pointRadius: 0},
      {label:'Yearly average', data: yr, borderColor: COL.ink, backgroundColor: COL.ink, borderWidth: 2, pointRadius: 3, spanGaps: true},
      {label:'Trend line', data: tr, borderColor: a.sig || a.likely ? (a.up ? COL.up : COL.down) : COL.flat, borderWidth: 3, borderDash:[8, 5], pointRadius: 0}
    ];
  } else {
    const yr = [], tr = [];
    for (let y = a.x[0]; y <= a.x[a.n - 1]; y++){ const i = a.x.indexOf(y); labels.push(String(y)); yr.push(i >= 0 ? a.y[i] : null); tr.push(line(y)); }
    sets = [
      {label: yLabel, data: yr, borderColor: COL.ink, backgroundColor: COL.ink, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6},
      {label:'Trend line', data: tr, borderColor: a.sig || a.likely ? (a.up ? COL.up : COL.down) : COL.flat, borderWidth: 3, borderDash:[8, 5], pointRadius: 0}
    ];
  }
  chart = new Chart(canvas, {type:'line', data:{labels, datasets: sets}, options:{
    responsive: true, maintainAspectRatio: false, animation: false, interaction:{mode:'index', intersect: false},
    plugins:{legend:{position:'bottom', labels:{boxWidth: 28, boxHeight: 2, color:'#3B4A60'}},
      tooltip:{callbacks:{label: c => c.parsed.y == null ? null : `${c.dataset.label}: ${fmt(c.parsed.y, V.dp)}${unit(state.v)}`}}},
    scales:{x:{grid:{display: false}, ticks:{maxTicksLimit: 12, maxRotation: 0, color:'#5F6E84'}},
      y:{title:{display: true, text: V.sci + (V.unit ? ` (${V.unit})` : ' (no unit)'), color:'#3B4A60'}, grid:{color:'#EDF1F6'}, ticks:{color:'#5F6E84'}}}
  }});
  $('dataTable').innerHTML = `<table><thead><tr><th>Year</th><th class="n">${yLabel}${V.unit ? ' (' + V.unit + ')' : ''}</th><th class="n">Trend line</th></tr></thead><tbody>${
    a.x.map((x, i) => `<tr><td>${x}</td><td class="n">${fmt(a.y[i], V.dp)}</td><td class="n">${fmt(line(x), V.dp)}</td></tr>`).join('')}</tbody></table>`;
}

// ---- render everything from state ----
function render(){
  const {v, r, y0, y1, s} = state, V = VARS[v], R = REGIONS[r], S = SEASONS[s], a = analyze(r, v, s, y0, y1);
  const place = r === 'world' ? 'the world as a whole' : R.name;
  $('varSel').value = v; $('regSel').value = r; $('y0Sel').value = y0; $('y1Sel').value = y1; $('seaSel').value = s; $('yrErr').hidden = true;
  $('varHelp').textContent = `${V.help} Scientists call it "${V.sci}". Source: ${V.src}.`;
  $('deepName').textContent = place;
  $('chartTitle').innerHTML = `<span class="src real">NASA data</span>${V.name} in ${place}. Each point is the ${S.long} average for one year, ${y0} to ${y1}. The dashed line is the trend.`;
  document.querySelectorAll('[data-ex]').forEach(b => { const e = EXAMPLES[b.dataset.ex]; b.setAttribute('aria-pressed', e.v === v && e.r === r && e.s === s && y0 === Y0 && y1 === Y1); });

  // Earth colours
  state.an = r === 'world' ? [] : analogs(r, y0, y1).filter(o => o.score >= .3).slice(0, 3);   // below 30% is not a meaningful match
  const an = state.an;
  regSel.each(function(d){
    const t = analyze(d.id, v, s, y0, y1), col = !t ? 'none' : !t.sig ? COL.flat : t.up ? COL.up : COL.down, sel = d.id === r;
    d3.select(this).attr('fill', t ? col : '#fff').attr('fill-opacity', t ? .78 : .01)
      .attr('stroke', sel ? COL.ink : t ? '#fff' : '#9DB2C9').attr('stroke-width', sel ? 3 : 1).attr('stroke-dasharray', t ? null : '4 3');
    d.tip = `<b>${REGIONS[d.id].name}</b><br>${t ? `${V.short}: ${word(t).toLowerCase()} (${signed(t.slope * 10, V.dp)}${unit(v)} per decade)` : V.short + ' is not measured here'}`;
  });
  gEdge.attr('stroke-width', r === 'world' ? 4 : 1).attr('stroke', r === 'world' ? COL.ink : '#9DB2C9');
  draw();
  drawChart(a);

  // the answer
  const seasonRows = Object.keys(SEASONS).map(k => ({k, a: analyze(r, v, k, y0, y1)}));
  if (!a) $('verdict').innerHTML = `<div class="verdict"><h3>Nothing to test yet</h3><p>${$('chartEmpty').textContent}</p></div>`;
  else {
    const half = tCrit(a.df) * a.se * 10, per = a.slope * 10, total = a.slope * (a.x[a.n - 1] - a.x[0]), better = seasonRows.filter(x => x.a && x.a.sig && x.k !== s);
    const starts = []; for (let ys = Y0; ys <= y1 - 7; ys++){ const t = analyze(r, v, s, ys, y1); if (t) starts.push({ys, t}); }
    const odds = a.p < .001 ? 'less than 1 time in 1,000' : a.p < .01 ? 'less than 1 time in 100' : `about ${Math.round(a.p * 100)} times in 100`;
    $('verdict').innerHTML = `
      <div class="verdict">
        <h3>${a.sig ? `Yes. ${V.short} is ${a.up ? 'rising' : 'falling'} here, and it is unlikely to be chance.` : a.likely ? `Likely ${a.up ? 'rising' : 'falling'}, but not confirmed.` : `Not proven. ${V.short} shows no clear trend here.`}</h3>
        <p>${a.likely
          ? `From ${a.x[0]} to ${a.x[a.n - 1]} the ${S.long} average ${a.up ? 'rose' : 'fell'} by ${fmt(Math.abs(total), V.dp)}${unit(v)} in total, and the ordinary test calls that significant (p ${pTxt(a.p0)}). But here each year resembles the year before, so ${a.n} years hold less evidence than they seem to. Our stricter test, which keeps false alarms below 5%, cannot rule out chance yet.`
          : a.sig
          ? `From ${a.x[0]} to ${a.x[a.n - 1]} the ${S.long} average ${a.up ? 'rose' : 'fell'} by ${fmt(Math.abs(total), V.dp)}${unit(v)} in total.`
          : `The line tilts ${a.up ? 'up' : 'down'} a little, but the swings from year to year are too large to rule out chance. <b>That does not prove nothing is changing.</b> A longer record, or a single season, may reveal a trend.`}</p>
      </div>
      <div class="facts">
        <div><span>How fast (slope)</span><b>${signed(per, V.dp)}</b><em>${V.unit || 'AOD units'} every 10 years. Likely range ${signed(per - half, V.dp)} to ${signed(per + half, V.dp)}.</em></div>
        <div><span>How sure (p-value)</span><b>${pTxt(a.p)}</b><em>${a.sig ? 'below 0.05, so significant' : a.likely ? `strict test: above 0.05. Ordinary test: ${pTxt(a.p0)}` : 'above 0.05, so not significant'}</em></div>
      </div>
      <div class="meter" role="img" aria-label="p-value ${pTxt(a.p)} on a scale from 0 to 1; the bar for significance is 0.05">
        <div class="track"><span class="mark"></span><span class="dot ${a.sig ? '' : 'no'}" style="left:${Math.max(1.5, Math.min(98.5, Math.sqrt(a.p) * 100))}%"></span></div>
        <div class="ends"><span>Almost surely real</span><span>Could easily be chance</span></div>
      </div>
      <p class="note">If nothing were really changing, a trend this strong would turn up ${odds}. The dark part of the bar is the "significant" zone (p below 0.05).</p>
      ${a.sig !== (a.mk.p < .05) ? `<div class="tip">A second test (Mann-Kendall) ${a.mk.p < .05 ? 'does find' : 'does not find'} a significant trend (p ${pTxt(a.mk.p)}). When two tests disagree, treat the result as borderline.</div>` : ''}
      ${!a.sig && better.length ? `<div class="tip">Clue: the trend <b>is</b> significant in ${better.map(x => SEASONS[x.k].label).join(' and ')}. Try it below.</div>` : ''}
      ${a.sig && Math.abs(a.mk.sen - a.slope) > .35 * Math.abs(a.slope) ? `<div class="tip">A few extreme years are pulling the line. The outlier-proof slope (Sen's) is ${signed(a.mk.sen * 10, V.dp)} per decade, against ${signed(per, V.dp)} for the straight-line fit.</div>` : ''}
      ${a.n < 15 ? `<div class="tip">Only ${a.n} years of data. Short records often fail the test even when a real trend exists.</div>` : ''}
      <p class="sub">Does the starting year matter?</p>
      <div class="strip" role="group" aria-label="Verdict for each possible start year">${starts.map(o => `<button type="button" class="${o.t.sig ? 'yes' : o.t.likely ? 'maybe' : ''}" aria-pressed="${o.ys === y0}" data-set='{"y0":${o.ys}}' title="${o.ys} to ${y1}: ${word(o.t)}, p ${pTxt(o.t.p)}" aria-label="Start in ${o.ys}: ${word(o.t)}"></button>`).join('')}</div>
      <div class="ends"><span>Start ${starts[0].ys}</span><span>Start ${starts[starts.length - 1].ys}</span></div>
      <p class="note">${starts.filter(o => o.t.sig).length} of ${starts.length} start years (all ending ${y1}) give a confirmed trend. Dark = confirmed, striped = likely, white = no clear trend. Shorter records fail more often. Click a square to try it.</p>
      <details><summary>Show the statistics</summary>
        <table><tbody>
          <tr><td>Years used (n)</td><td class="n">${a.n}</td></tr>
          <tr><td>Linear regression slope</td><td class="n">${signed(a.slope, V.dp + 1)}${unit(v)} / year</td></tr>
          <tr><td>95% confidence interval of slope, per decade</td><td class="n">${signed(per - half, V.dp)} to ${signed(per + half, V.dp)}</td></tr>
          <tr><td>Linear regression p-value (two-sided t-test)</td><td class="n">${pTxt(a.p)}</td></tr>
          <tr><td>R² (share of variation the line explains)</td><td class="n">${a.r2.toFixed(2)}</td></tr>
          <tr><td>Mann-Kendall Z / p-value</td><td class="n">${a.mk.z.toFixed(2)} / ${pTxt(a.mk.p)}</td></tr>
          <tr><td>Sen's slope</td><td class="n">${signed(a.mk.sen, V.dp + 1)}${unit(v)} / year</td></tr>
          <tr><td>Lag-1 autocorrelation of leftovers</td><td class="n">${a.r1.toFixed(2)}</td></tr>
          <tr><td>Autocorrelation correction</td><td class="n">${a.fix ? 'applied' : 'not needed'}</td></tr>
        </tbody></table>
        <p class="note">Tests run on one value per year, which keeps neighbouring points nearly independent. Years can still resemble each other, and short records hide this, so both tests are always made stricter using a cautious estimate of that resemblance. This keeps false alarms under 5%.</p>
      </details>`;
  }
  $('seasons').innerHTML = seasonRows.map(({k, a}) => `<button type="button" aria-pressed="${k === s}" data-set='{"s":"${k}"}'><b>${SEASONS[k].label}</b>${icon(a)}<span>${word(a)}</span><span>${a ? 'p ' + pTxt(a.p) : ''}</span></button>`).join('');

  // everything measured here
  $('regTrends').innerHTML = `<table><thead><tr><th>Measurement</th><th>Direction</th><th class="n">Per decade</th><th class="n">p-value</th></tr></thead><tbody>${
    Object.keys(VARS).filter(k => applies(r, k)).map(k => { const t = analyze(r, k, s, y0, y1);
      return `<tr class="pick ${k === v ? 'on' : ''}" tabindex="0" data-set='{"v":"${k}"}'><td>${VARS[k].short}${VARS[k].unit ? ` <span style="color:var(--muted)">(${VARS[k].unit})</span>` : ''}</td><td><span class="dir">${icon(t)}${word(t)}</span></td><td class="n">${t ? signed(t.slope * 10, VARS[k].dp) : '–'}</td><td class="n">${t ? pTxt(t.p) : '–'}</td></tr>`; }).join('')}</tbody></table>`;

  // similar places
  const describe = sh => { const [vk, sk] = sh.d.split('|'); return `${VARS[vk].short.toLowerCase()} ${sh.up ? 'rising' : 'falling'}${sk === 'ALL' ? '' : ' in ' + SEASONS[sk].label}`; };
  $('analogs').innerHTML = r === 'world'
    ? '<p class="story">This compares one region with the others. Choose a region on the Earth to use it.</p>'
    : !an.length ? '<p class="story">No other region here matches closely enough (30% or more) for these years.</p>'
    : an.map((o, i) => `<button type="button" class="analog" data-set='{"r":"${o.id}"}'>
        <div class="top"><span>${i + 1}. ${REGIONS[o.id].name}</span><span>${Math.round(o.score * 100)}% match</span></div>
        <div class="bar"><i style="width:${Math.round(o.score * 100)}%"></i></div>
        <div class="shared">${o.shared.length ? 'Both have ' + o.shared.slice(0, 3).map(describe).join(', ') + '.' : 'Similar overall pattern, with no single strong shared trend.'}</div>
      </button>`).join('') + `<p class="note">Match compares the direction and strength of trends across ${Object.keys(VARS).length} measurements and 5 parts of the year. Click a place to explore it.</p>`;

  // scenario
  $('scenario').innerHTML = (a && a.sig
      ? `<p class="story"><b>If the current rate simply continued</b> (it may not), the ${S.long} average would reach about <b>${fmt(Math.min(V.max ?? Infinity, Math.max(V.min ?? -Infinity, a.icpt + a.slope * 2035)), V.dp)}${unit(v)} by 2035</b>${a.icpt + a.slope * 2035 < V.min || a.icpt + a.slope * 2035 > V.max ? ' (the end of the scale)' : ''}, from about ${fmt(a.icpt + a.slope * a.x[a.n - 1], V.dp)}${unit(v)} now.</p>`
      : `<p class="story">There is no confirmed trend in ${V.short.toLowerCase()} for these years, so there is nothing reliable to extend into the future.</p>`)
    + (an.length ? `<p class="sub">What the data shows in similar places</p><ul class="clean">${an.map(o => { const found = Object.keys(VARS).map(k => [k, analyze(o.id, k, 'ALL', y0, y1)]).filter(([, t]) => t && (t.sig || t.likely));
        return `<li><b>${REGIONS[o.id].name}.</b> ${found.length ? found.map(([k, t]) => `${VARS[k].short} ${t.up ? 'rising' : 'falling'}${t.sig ? '' : ' (likely)'}`).join(', ') + ', whole year.' : 'No whole-year trend in any measurement.'}</li>`; }).join('')}</ul>` : '')
    + `<p class="note">Similar trends do not mean the same future. Geography, policy and local climate differ. Use this to decide what to watch.</p>`;

  // causes
  const others = !a ? [] : Object.keys(VARS).filter(k => k !== v && applies(r, k)).map(k => { const t = analyze(r, k, s, y0, y1); if (!t) return null;
      const yrs = a.x.filter(x => t.x.includes(x)); if (yrs.length < 6) return null;
      return {k, c: corr(yrs.map(x => a.y[a.x.indexOf(x)]), yrs.map(x => t.y[t.x.indexOf(x)]))}; }).filter(o => o && Math.abs(o.c) >= .45).sort((p, q) => Math.abs(q.c) - Math.abs(p.c));
  const strongest = seasonRows.filter(x => x.a && x.k !== 'ALL').sort((p, q) => Math.abs(q.a.mk.z) - Math.abs(p.a.mk.z))[0];
  const known = a ? [a.up ? V.up : V.down] : [];
  $('causes').innerHTML = !a ? '<p class="story">No trend to explain for this choice.</p>' : `
    <p class="sub" style="margin-top:4px">Clues in the data</p><ul class="clean">
      ${strongest && strongest.a.sig ? `<li>The change is strongest in <b>${SEASONS[strongest.k].label}</b>. A cause that acts in those months fits best.</li>` : '<li>No single season stands out.</li>'}
      ${others.length ? others.slice(0, 2).map(o => `<li><b>${VARS[o.k].short}</b> moved ${o.c > 0 ? 'the same way' : 'the opposite way'} over these years (correlation ${o.c.toFixed(2)}).</li>`).join('') : '<li>No other measurement here moves closely with it.</li>'}
    </ul>
    <p class="sub">Common drivers of this kind of change</p><ul class="clean">${known.map(c => `<li>${c}</li>`).join('')}</ul>
    <p class="sub">How to check</p><p class="story">${V.check}</p>
    <p class="note">Two things moving together does not prove one causes the other.</p>`;
}
setProj();
render();
flyTo();

})();
