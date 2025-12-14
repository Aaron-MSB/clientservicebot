// Executive Dashboard Demo — fetches mock data from /api/executive.json
// Renders KPI tiles, time series, category bar, device donut, locations table, alerts, qoe chart

const DATA_URL = './api/executive.json';

let state = { data: null, charts: {} };

async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
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
    const value = kpis[t.key] !== undefined ? (t.format ? t.format(kpis[t.key]) : kpis[t.key]) : '-';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value">${value}</div>`;
    container.appendChild(el);
  });
}

function makeLineChart(ctx, labels, data, label, color) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        fill: true,
        backgroundColor: color + '33',
        borderColor: color,
        tension: 0.2,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { display: true }, y: { beginAtZero: true } }
    }
  });
}

function makeBarChart(ctx, labels, data, color) {
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data, backgroundColor: color }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function makeDoughnut(ctx, labels, data, colors) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

function renderCharts(data) {
  // queriesChart
  const qctx = document.getElementById('queriesChart').getContext('2d');
  if (state.charts.queries) state.charts.queries.destroy();
  state.charts.queries = makeLineChart(qctx, data.timeseries.queries.map(d => d.date), data.timeseries.queries.map(d => d.count), 'Queries', '#005A9C');

  // categories chart (top 6)
  const cats = data.top_categories.slice(0, 6);
  const cctx = document.getElementById('categoriesChart').getContext('2d');
  if (state.charts.categories) state.charts.categories.destroy();
  state.charts.categories = makeBarChart(cctx, cats.map(c=>c.category), cats.map(c=>c.count), '#00A99D');
  const list = document.getElementById('categoriesList');
  list.innerHTML = '';
  data.top_categories.slice(0,8).forEach(c => {
    const it = document.createElement('div'); it.className = 'item';
    it.innerHTML = `<div>${c.category}</div><div><strong>${c.count}</strong></div>`;
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
    it.innerHTML = `<div>${d.device}</div><div><strong>${d.count}</strong></div>`;
    legend.appendChild(it);
  });

  // qoe chart (NPS & QoE over time)
  const qoeCtx = document.getElementById('qoeChart').getContext('2d');
  if (state.charts.qoe) state.charts.qoe.destroy();
  const dates = data.timeseries.qoe.map(d=>d.date);
  const qoeData = data.timeseries.qoe.map(d=>Math.round(d.value*100));
  const npsData = data.timeseries.nps.map(d=>d.value);
  state.charts.qoe = new Chart(qoeCtx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'QoE (%)', data: qoeData, borderColor: '#005A9C', backgroundColor:'#005A9C22', yAxisID: 'y1' },
        { label: 'NPS', data: npsData, borderColor: '#00A99D', backgroundColor:'#00A99D22', yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y1: { type: 'linear', position: 'left', min:0, max:100 },
        y2: { type: 'linear', position:'right', min:-100, max:100, grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderLocations(locations) {
  const tbody = document.querySelector('#locationsTable tbody');
  tbody.innerHTML = '';
  locations.slice(0,10).forEach(loc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${loc.country || '-'}</td><td>${loc.region || '-'}</td><td>${loc.count}</td>`;
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
    el.className = 'alert' + (a.severity === 'critical' ? ' critical' : '');
    el.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:700">${a.name}</div>
        <div class="meta">${a.triggered_at} • ${a.rule_summary || ''}</div>
        <div style="margin-top:6px;font-size:13px;color:#111">${a.payload?.summary || ''}</div>
      </div>
      <div class="actions" style="display:flex;flex-direction:column;align-items:flex-end">
        <div style="font-size:12px;color:${a.severity==='critical'? 'var(--danger)' : 'var(--muted)'}">${a.severity.toUpperCase()}</div>
        <div style="margin-top:8px">
          <button onclick='ack("${a.id}")'>Acknowledge</button>
          <button style="background:var(--accent-2);margin-top:6px" onclick='assign("${a.id}")'>Assign</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

// mock handlers for alert buttons
window.ack = (id) => {
  alert('Acknowledged (demo): ' + id);
};
window.assign = (id) => {
  alert('Assign modal (demo): ' + id);
};

async function init() {
  try {
    const data = await fetchData();
    state.data = data;
    renderKpis(data.kpis);
    renderCharts(data);
    renderLocations(data.top_locations);
    renderAlerts(data.alerts);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;color:red">Failed to load demo data. Ensure /api/executive.json is present.</div>';
  }
}

document.getElementById('refresh').addEventListener('click', () => init());
document.getElementById('range').addEventListener('change', () => init());

init();
