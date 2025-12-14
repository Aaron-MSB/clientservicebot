// Executive Dashboard Demo (updated)
// - Adds loading/error states
// - Range filtering (last N days / MTD / FY) client-side
// - CSV export for visible queries
// - Alert UI updates (acknowledge/assign update state)
// - Improved chart tooltips and accessibility

const DATA_URL = './api/executive.json';

let state = { data: null, charts: {}, currentRange: '14' };

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(msg) {
  const el = document.getElementById('error');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

async function fetchData() {
  showError('');
  showLoading(true);
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch data (${res.status})`);
    const json = await res.json();
    state.data = json;
    showLoading(false);
    return json;
  } catch (err) {
    showLoading(false);
    showError('Failed to load demo data. Ensure /api/executive.json is present and accessible.');
    throw err;
  }
}

function formatNumber(n) {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}

function renderKpis(kpis) {
  const container = document.getElementById('kpi-tiles');
  container.innerHTML = '';
  const tiles = [
    { label: 'Queries (Today)', key: 'queries_today' },
    { label: 'Queries (MTD)', key: 'queries_mtd' },
    { label: 'Queries (FY cumulative)', key: 'queries_fy' },
    { label: 'Avg QoE', key: 'avg_qoe', format: v => `${(v*100).toFixed(0)}%` },
    { label: 'NPS', key: 'nps' },
  ];
  tiles.forEach(t => {
    const el = document.createElement('div');
    el.className = 'kpi';
    const raw = kpis[t.key];
    const value = raw !== undefined ? (t.format ? t.format(raw) : formatNumber(raw)) : '-';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value" role="status">${value}</div>`;
    container.appendChild(el);
  });
}

function parseDateISO(s) {
  // Accept YYYY-MM-DD or full ISO
  return new Date(s + 'T00:00:00Z');
}

function getRangeStart(rangeKey) {
  const now = new Date();
  if (rangeKey === 'mtd') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  if (rangeKey === 'fy') {
    // Assuming financial year starts July 1
    const year = now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return new Date(Date.UTC(year, 6, 1)); // July is month 6 (0-based)
  }
  const days = parseInt(rangeKey, 10) || 14;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  d.setUTCHours(0,0,0,0);
  return d;
}

function filterTimeseriesByRange(timeseries, rangeKey) {
  if (!timeseries || !timeseries.queries) return { queries: [], qoe: [], nps: [] };
  const start = getRangeStart(rangeKey);
  // Filter arrays by date >= start
  const qs = timeseries.queries.filter(d => new Date(d.date + 'T00:00:00Z') >= start);
  const qoe = timeseries.qoe ? timeseries.qoe.filter(d => new Date(d.date + 'T00:00:00Z') >= start) : [];
  const nps = timeseries.nps ? timeseries.nps.filter(d => new Date(d.date + 'T00:00:00Z') >= start) : [];
  return { queries: qs, qoe, nps };
}

function makeLineChart(ctx, labels, datasets, options = {}) {
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              if (typeof val === 'number') return `${ctx.dataset.label}: ${val.toLocaleString()}`;
              return `${ctx.dataset.label}: ${val}`;
            }
          }
        },
        title: { display: false }
      },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { display: true, title: { display: false } },
        y: { display: true, beginAtZero: true }
      },
      ...options
    }
  });
}

function makeBarChart(ctx, labels, data, color) {
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data, backgroundColor: color }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function makeDoughnut(ctx, labels, data, colors) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderCharts(data, rangeKey) {
  const filtered = filterTimeseriesByRange(data.timeseries, rangeKey);

  // queriesChart
  const qctx = document.getElementById('queriesChart').getContext('2d');
  if (state.charts.queries) state.charts.queries.destroy();
  const qLabels = filtered.queries.map(d => d.date);
  const qValues = filtered.queries.map(d => d.count);
  state.charts.queries = makeLineChart(qctx, qLabels, [{ label: 'Queries', data: qValues, borderColor: '#005A9C', backgroundColor: '#005A9C22', tension: 0.2 }], {
    scales: { y: { beginAtZero: true } }
  });

  // categories chart (top 6)
  const cats = data.top_categories.slice(0, 6);
  const cctx = document.getElementById('categoriesChart').getContext('2d');
  if (state.charts.categories) state.charts.categories.destroy();
  state.charts.categories = makeBarChart(cctx, cats.map(c=>c.category), cats.map(c=>c.count), '#00A99D');
  const list = document.getElementById('categoriesList');
  list.innerHTML = '';
  data.top_categories.slice(0,8).forEach(c => {
    const it = document.createElement('div'); it.className = 'item';
    it.innerHTML = `<div>${c.category}</div><div><strong>${formatNumber(c.count)}</strong></div>`;
    list.appendChild(it);
  });

  // devices doughnut
  const dctx = document.getElementById('devicesChart').getContext('2d');
  if (state.charts.devices) state.charts.devices.destroy();
  state.charts.devices = makeDoughnut(dctx, data.device_breakdown.map(d=>d.device), data.device_breakdown.map(d=>d.count), ['#005A9C','#00A99D','#6B7280']);
  const legend = document.getElementById('deviceLegend');
  legend.innerHTML = '';
  data.device_breakdown.forEach(d => {
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div>${d.device}</div><div><strong>${formatNumber(d.count)}</strong></div>`;
    legend.appendChild(it);
  });

  // qoe chart (NPS & QoE over time)
  const qoeCtx = document.getElementById('qoeChart').getContext('2d');
  if (state.charts.qoe) state.charts.qoe.destroy();
  const dates = filtered.qoe.map(d=>d.date);
  const qoeData = filtered.qoe.map(d=>Math.round(d.value*100));
  const npsData = filtered.nps.map(d=>d.value);
  state.charts.qoe = new Chart(qoeCtx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'QoE (%)', data: qoeData, borderColor: '#005A9C', backgroundColor:'#005A9C22', yAxisID: 'y1', tension: 0.2 },
        { label: 'NPS', data: npsData, borderColor: '#00A99D', backgroundColor:'#00A99D22', yAxisID: 'y2', tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y1: { type: 'linear', position: 'left', min:0, max:100, ticks: { callback: v => v + '%' } },
        y2: { type: 'linear', position:'right', min:-100, max:100, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // store last filtered queries for CSV export
  state.lastFilteredQueries = filtered.queries;
}

function renderLocations(locations) {
  const tbody = document.querySelector('#locationsTable tbody');
  tbody.innerHTML = '';
  (locations || []).slice(0,10).forEach(loc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${loc.country || '-'}</td><td>${loc.region || '-'}</td><td>${formatNumber(loc.count)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderAlerts(alerts) {
  const container = document.getElementById('alertsList');
  container.innerHTML = '';
  if (!alerts || alerts.length === 0) {
    container.innerHTML = '<div class="item">No active alerts</div>';
    return;
  }
  alerts.forEach(a => {
    const el = document.createElement('div');
    const css = a.severity === 'critical' ? 'alert critical' : 'alert';
    const acked = a._status === 'acknowledged';
    el.className = `${css} ${acked ? 'acknowledged': ''}`;
    const triggered = new Date(a.triggered_at).toLocaleString();
    el.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:700">${a.name}</div>
        <div class="meta">${triggered} • ${a.rule_summary || ''}</div>
        <div style="margin-top:8px;font-size:13px;color:#111">${a.payload?.summary || ''}</div>
        <div class="status">${acked ? 'Acknowledged' : ''}</div>
      </div>
      <div class="actions" style="display:flex;flex-direction:column;align-items:flex-end">
        <div style="font-size:12px;color:${a.severity==='critical'? 'var(--danger)' : 'var(--muted)'}">${a.severity.toUpperCase()}</div>
        <div style="margin-top:8px">
          <button ${acked ? 'disabled' : ''} onclick='ack("${a.id}")'>Acknowledge</button>
          <button onclick='assign("${a.id}")' style="background:var(--accent-2);margin-top:6px">${a._assigned ? 'Assigned' : 'Assign'}</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

// Persist change in UI state for alerts (demo-only)
window.ack = (id) => {
  const alertObj = state.data.alerts.find(a => a.id === id);
  if (alertObj) {
    alertObj._status = 'acknowledged';
    renderAlerts(state.data.alerts);
  }
};
window.assign = (id) => {
  const alertObj = state.data.alerts.find(a => a.id === id);
  if (alertObj) {
    alertObj._assigned = true;
    // In real app open assignment modal; demo marks assigned and re-renders
    renderAlerts(state.data.alerts);
    alert('Assigned (demo): ' + id);
  }
};

function exportCsv() {
  const rows = state.lastFilteredQueries || state.data.timeseries.queries;
  if (!rows || rows.length === 0) {
    alert('No queries to export for the selected range.');
    return;
  }
  const csv = ['date,count'].concat(rows.map(r => `${r.date},${r.count}`)).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `queries-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  try {
    const data = await fetchData();
    state.currentRange = document.getElementById('range').value || '14';
    renderKpis(data.kpis);
    renderCharts(data, state.currentRange);
    renderLocations(data.top_locations);
    renderAlerts(data.alerts);
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('refresh').addEventListener('click', () => init());
document.getElementById('range').addEventListener('change', (e) => {
  state.currentRange = e.target.value;
  if (state.data) renderCharts(state.data, state.currentRange);
});
document.getElementById('exportCsv').addEventListener('click', exportCsv);

// Initialize on load
init();
