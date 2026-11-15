// Page layout: tabs, the verdict label, the start-year slider, the download and the short list of other trends.
// Runs before app.js. shortcut: several parts are derived from the HTML that app.js writes (see the notes below), not from the statistics directly; move them into app.js if the page keeps growing.
const q = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role=tab]')];
function show(t){ tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); q(b.getAttribute('aria-controls')).hidden = !on; });
  window.dispatchEvent(new Event('resize')); }
tabs.forEach(b => b.onclick = () => show(b));
q('toNum').onclick = () => show(tabs[4]);
q('startRange').oninput = e => { q('y0Sel').value = e.target.value; q('y0Sel').dispatchEvent(new Event('change')); };
q('csvBtn').onclick = () => { const t = id => q(id).selectedOptions[0].text, V = VARS[q('varSel').value];
  const rows = [...document.querySelectorAll('#dataTable tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim().replace('−', '-')).join(','));
  const csv = [`# AETHER`, `# Measurement: ${t('varSel')}${V.unit ? ' (' + V.unit + ')' : ''}`, `# Region: ${t('regSel')}`, `# Part of year: ${t('seaSel')}`,
    `# Source: NASA Giovanni area average. ${V.src}`, 'year,measured,trend_line', ...rows].join('\n') + '\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
  a.download = `aether-${q('regSel').value}-${q('varSel').value}-${q('seaSel').value}.csv`; a.click(); URL.revokeObjectURL(a.href); };
// shortcut: label, plain row names and the moved statistics table are derived from what app.js writes; in the final build app.js writes them itself
const PLAIN = {'Years used (n)':'Years of data used', 'Linear regression slope':'Change per year|slope of the straight-line fit (linear regression)',
  '95% confidence interval of slope, per decade':'Likely range of the change per 10 years|95% confidence interval', 'Linear regression p-value (two-sided t-test)':'Chance this is only luck, main test|p-value, two-sided t-test',
  'R² (share of variation the line explains)':'Share of the ups and downs the line explains|R²', 'Mann-Kendall Z / p-value':'Second test: score, and chance this is only luck|Mann-Kendall Z and p-value',
  "Sen's slope":"Change per year, ignoring extreme years|Sen's slope", 'Lag-1 autocorrelation of leftovers':'How much each year resembles the year before (−1 to 1)|lag-1 autocorrelation of residuals',
  'Autocorrelation correction':'Stricter test because years resemble each other|autocorrelation correction'};
function tidy(){ const v = q('verdict'), h = v.querySelector('h3'); if (!h || v.querySelector('.vlabel')) return;
  q('srcLine').textContent = 'Source: NASA Giovanni, area average over the region. ' + VARS[q('varSel').value].src + '.';
  const t = h.textContent, up = /rising/.test(t), c = /Nothing|Not proven/.test(t) ? 'var(--flat)' : up ? 'var(--up)' : 'var(--down)';
  const text = /Nothing/.test(t) ? 'NO DATA' : /Not proven/.test(t) ? 'NO CLEAR TREND' : (up ? 'RISING' : 'FALLING') + (/^Likely/.test(t) ? '<small>likely, not confirmed</small>'
    : [...v.querySelectorAll('.tip')].some(x => /second test/.test(x.textContent)) ? '<small>borderline: two tests disagree</small>' : '<small>confirmed</small>');   // the label must not say more than the note under it
  h.insertAdjacentHTML('beforebegin', `<span class="vlabel ${/^Likely/.test(t) ? 'likely' : ''}" style="--c:${c}">${text}</span><br>`);
  const d = v.querySelector('details'), box = q('statsBox'); q('toNum').hidden = !d; box.innerHTML = d ? '' : '<p class="story">Nothing to show for this choice.</p>';
  if (d){ d.querySelector('summary').remove(); box.append(...d.childNodes); d.remove();
    box.querySelectorAll('td:first-child').forEach(td => { const p = PLAIN[td.textContent.trim()]; if (p){ const [a, b] = p.split('|'); td.innerHTML = a + (b ? `<small>${b}</small>` : ''); } }); }
  const strip = v.querySelector(':scope .strip'); q('startCtl').hidden = !strip;
  if (strip){ const B = [...strip.querySelectorAll('button')].map(b => ({y: +JSON.parse(b.dataset.set).y0, c: b.className}));
    const runs = ys => ys.reduce((a, y) => { const l = a[a.length - 1]; l && l[1] === y - 1 ? l[1] = y : a.push([y, y]); return a; }, []).map(([a, b]) => a === b ? a : `${a} to ${b}`).join(', ');
    const yes = B.filter(b => b.c === 'yes').map(b => b.y), no = B.filter(b => b.c !== 'yes').map(b => b.y), R = q('startRange'), n = B.length;
    q('startBlocks').innerHTML = B.map(b => `<i class="${b.c}"></i>`).join('');
    R.min = B[0].y; R.max = B[n - 1].y; R.value = q('y0Sel').value; q('startVal').textContent = q('y0Sel').value; q('startMin').textContent = B[0].y; q('startMax').textContent = B[n - 1].y;
    R.style.left = `calc(${50 / n}% - 11px)`; R.style.width = `calc(${100 - 100 / n}% + 22px)`;   // the handle's centre lands on the middle of each block
    R.setAttribute('aria-valuetext', `${R.value}: ${B.find(b => b.y == R.value)?.c === 'yes' ? 'confirmed trend' : 'not confirmed'}`);
    q('startFind').innerHTML = !no.length ? 'Confirmed whichever year the record starts in. <b>The answer does not depend on the starting year.</b>'
      : !yes.length ? 'Not confirmed for any starting year.'
      : `Confirmed when the record starts in <b>${runs(yes)}</b>, not when it starts in ${runs(no)}. <b>${yes.length >= .7 * n ? 'The answer holds for most starting years.' : 'The answer depends on the starting year, so treat it with care.'}</b>`;
    const ends = strip.nextElementSibling, note = ends.nextElementSibling; strip.previousElementSibling.remove(); note.remove(); ends.remove(); strip.remove(); }
  // one line per other tab, so nothing is hidden: the headline of each tab shows here and a click opens it
  const moving = [...document.querySelectorAll('#regTrends tbody tr:not(.on)')].filter(r => !/No clear trend|No data/.test(r.cells[1].textContent)).map(r => r.cells[0].textContent.replace(/\s*\(.*\)/, '').trim().toLowerCase() + ' ' + r.cells[1].textContent.trim().toLowerCase());
  const top = document.querySelector('#analogs .analog .top'), clue = document.querySelector('#causes li');
  q('also').className = 'also'; q('also').innerHTML = !h || /Nothing/.test(t) ? '' : [
    [1, 'Also changing here', moving.length ? moving.slice(0, 2).join(', ') + (moving.length > 2 ? ` and ${moving.length - 2} more` : '') : 'Nothing else shows a trend'],
    [2, 'Most similar place', top ? top.children[0].textContent.replace(/^\d+\.\s*/, '') + ' (' + top.children[1].textContent + ')' : 'No close match'],
    [3, 'A clue to the cause', clue ? clue.textContent.trim() : 'None found']
  ].map(([i, a, b]) => `<button type="button" data-tab="${i}"><b>${a}</b><span>${b}</span><i>Open</i></button>`).join('');
  const th = document.querySelectorAll('#dataTable th'); if (th.length === 3){ th[1].textContent = 'Measured: ' + th[1].textContent; th[2].textContent = 'Trend line in that year'; } }
new MutationObserver(tidy).observe(q('verdict'), {childList: true});
function grey(){ const r = q('regSel').value; [...q('varSel').options].forEach(o => { const none = series(r, o.value) === null;   // series() comes from stats.js
  o.disabled = none; o.textContent = o.textContent.replace(/ \(no data here\)$/, '') + (none ? ' (no data here)' : ''); }); }
const ready = setInterval(() => { if (!q('varSel').options.length) return; clearInterval(ready); grey(); tidy(); }, 50);   // app.js fills the menus after the data loads
document.addEventListener('click', e => {
  const jump = e.target.closest('#also button'); if (jump) show(tabs[+jump.dataset.tab]);
  const dl = e.target.closest('[data-dl]')?.dataset.dl, src = q('chart');
  if (dl || !e.target.closest('.dl')) document.querySelector('.dl').open = false;   // the menu closes after a choice or a click outside it
  if (dl === 'csv') q('csvBtn').click();   // same file as the button under "Numbers"
  if (dl === 'png' && Chart.getChart(src)){ const c = Object.assign(document.createElement('canvas'), {width: src.width, height: src.height}), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);   // white behind the chart, or the image is see-through
    Object.assign(document.createElement('a'), {href: c.toDataURL('image/png'), download: `aether-${q('regSel').value}-${q('varSel').value}-${q('seaSel').value}.png`}).click(); }
  // a measurement row or an example changes the answer, so go back to it (season tiles and the slider already sit beside the chart)
  if (e.target.closest('tr[data-set], [data-ex]')) show(tabs[0]);
  setTimeout(grey, 0); });
document.addEventListener('change', () => setTimeout(grey, 0));

{ // the answer moves up beside the Earth; the season and start-year tests move beside the chart
  const hero = document.querySelector('main > .top'); hero.classList.add('hero'); hero.append(q('verdict'));
  q('also').before(...document.querySelectorAll('#tp1 .under'));
  // the measurements table sits under the chart it controls, so a click changes the chart in place; its own tab is not needed
  const all = Object.assign(document.createElement('div'), {className: 'under'}); all.append(...q('tp2').children);
  all.querySelector('h2').firstChild.textContent = 'What else is changing in ';   // a comparison of results, not a second "What" list
  all.querySelector('.help').textContent = 'Only the measurements that show a trend, tested over the same years and season. Click a row to chart it above.';
  // the list stays short however many measurements exist: the 5 strongest trends and the chosen one show, the rest sit behind one button
  const more = Object.assign(document.createElement('button'), {type: 'button', className: 'tonum'}); all.append(more); let showAll = false;
  const trim = () => { const rows = [...document.querySelectorAll('#regTrends tbody tr')], p = r => parseFloat(r.cells[3].textContent.replace('<', '')) || 0;
    const keep = new Set(rows.filter(r => !/No clear trend|No data/.test(r.cells[1].textContent)).sort((a, b) => p(a) - p(b)).slice(0, 5));
    rows.forEach(r => r.hidden = !showAll && !keep.has(r) && !r.classList.contains('on'));
    more.hidden = !showAll && !rows.some(r => r.hidden); more.textContent = showAll ? 'Show only the trends' : `Show all ${rows.length} measurements`; };
  more.onclick = () => { showAll = !showAll; trim(); }; new MutationObserver(trim).observe(all.querySelector('#regTrends'), {childList: true});
  q('chart').closest('.result > div').append(all); q('t2').hidden = true;
  const sub = (t, s) => { t.querySelector('small')?.remove(); if (s) t.append(Object.assign(document.createElement('small'), {textContent: s})); };
  q('t1').textContent = 'Evidence'; sub(tabs[0], 'Chart, seasons, starting year'); sub(tabs[4], 'Every value and test');
  // C's script writes one headline per tab into #also; here the same text goes under the tab's name
  new MutationObserver(() => [1, 2, 3].forEach(i => sub(tabs[i], q('also').querySelector(`[data-tab="${i}"] span`)?.textContent.split('. ')[0])))
    .observe(q('also'), {childList: true}); }
