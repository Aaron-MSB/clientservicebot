// Technical Dashboard Demo — fetches mock data from /api/technical.json
// Renders KPI tiles, health overview, error & ingest charts, escalations, ingest jobs, and logs preview

const DATA_URL = './api/technical.json';
let charts = {};

async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
}

function renderKpis(kpis) {
  const container = document.getElementById('kpi-tiles');
  container.innerHTML = '';
  const tiles = [
    { label: 'API Latency P95 (ms)', key: 'api_p95' },
    { label: 'LLM Avg Latency (ms)', key: 'llm_avg_latency' },
    { label: 'VectorDB Latency (ms)', key: 'vectordb_latency' },
    { label: 'Worker Queue Length', key: 'worker_queue_len' },
    { label: 'Error Rate (%)', key: 'error_rate_pct' }
  ];
  tiles.forEach(t => {
    const el = document.createElement('div');
    el.className = 'kpi';
    const value = kpis[t.key] !== undefined ? kpis[t.key] : '-';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value">${value}</div>`;
    container.appendChild(el);
  });
}

function renderHealthOverview(health) {
  document.getElementById('apiP95').textContent = health.api_p95_ms + ' ms';
  document.getElementById('apiP95Sub').textContent = `${health.requests_per_sec} req/s`;
  document.getElementById('llmLatency').textContent = health.llm_avg_latency_ms + ' ms';
  document.getElementById('llmModel').textContent = health.llm_model;
  document.getElementById('vecLatency').textContent = health.vectordb_latency_ms + ' ms';
  document.getElementById('vecStatus').textContent = health.vectordb_status;
  document.getElementById('queueLen').textContent = health.worker_queue_len;
  document.getElementById('workerJobs').textContent = `${health.worker_running_jobs} running`;
}

function makeLineChart(ctx, labels, datasets, options = {}) {
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { display: true }, y: { beginAtZero: true } },
      ...options
    }
  });
}

function renderErrorChart(series) {
  const ctx = document.getElementById('errorChart').getContext('2d');
  if (charts.error) charts.error.destroy();
  const labels = series.map(s => s.date);
  const datasets = series[0] ? Object.keys(series[0].services).map((svc, idx) => ({
    label: svc,
    data: series.map(s => s.services[svc] || 0),
    borderColor: ['#E53E3E','#005A9C','#00A99D','#6B7280'][idx % 4],
    backgroundColor: 'transparent',
    tension: 0.2
  })) : [];
  charts.error = makeLineChart(ctx, labels, datasets);
}

function renderIngestChart(series) {
  const ctx = document.getElementById('ingestChart').getContext('2d');
  if (charts.ingest) charts.ingest.destroy();
  const labels = series.map(s => s.date);
  const data = series.map(s => s.docs_per_day);
  charts.ingest = makeLineChart(ctx, labels, [{ label: 'Docs/day', data, borderColor: '#005A9C', backgroundColor: '#005A9C22' }]);
}

function renderVecDetails(details) {
  const el = document.getElementById('vecDetails');
  el.innerHTML = '';
  details.forEach(d => {
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div style="flex:1"><div style="font-weight:700">${d.name}</div><div class="sub">${d.status} • ${d.indexed_vectors} vectors</div></div><div><button class="btn ghost" onclick='viewIndex("${d.name}")'>View</button></div>`;
    el.appendChild(it);
  });
}

function renderEscalations(escs) {
  const tbody = document.querySelector('#escalationsTable tbody');
  tbody.innerHTML = '';
  escs.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.session_id || '-'}</td>
      <td>${e.priority}</td>
      <td>${e.owner_team}</td>
      <td>${e.status}</td>
      <td>${e.created_at}</td>
      <td>
        <button class="btn" onclick='claim("${e.id}")'>Claim</button>
        <button class="btn ghost" onclick='escalate("${e.id}")'>Escalate</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderIngestJobs(jobs) {
  const el = document.getElementById('ingestJobs');
  el.innerHTML = '';
  jobs.forEach(j => {
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div style="flex:1"><div style="font-weight:700">${j.name}</div><div class="sub">${j.status} • ${j.started_at}</div></div><div><button class="btn" onclick='restartJob("${j.id}")'>Restart</button></div>`;
    el.appendChild(it);
  });
}

function renderLogs(logs) {
  const el = document.getElementById('logsList');
  el.innerHTML = '';
  logs.forEach(l => {
    const it = document.createElement('div'); it.className='log';
    it.innerHTML = `<div style="font-weight:700">${l.level.toUpperCase()} • ${l.timestamp} • ${l.service}</div><div style="margin-top:6px">${l.message}</div><div style="margin-top:6px"><button class="btn ghost" onclick='openLog("${l.id}")'>Open</button></div>`;
    el.appendChild(it);
  });
}

// Demo handlers
window.claim = (id) => alert('Claimed escalation (demo): ' + id);
window.escalate = (id) => alert('Escalated to higher priority (demo): ' + id);
window.viewIndex = (name) => alert('Open index view (demo): ' + name);
window.restartJob = (id) => alert('Restart job (demo): ' + id);
window.openLog = (id) => alert('Open log (demo): ' + id);
window.reindex = () => alert('Trigger re-index (demo)');
window.repairIndex = () => alert('Repair index (demo)');

async function init() {
  try {
    const data = await fetchData();
    renderKpis(data.kpis);
    renderHealthOverview(data.health);
    renderVecDetails(data.vector_db);
    renderErrorChart(data.timeseries.errors);
    renderIngestChart(data.timeseries.ingest);
    renderEscalations(data.escalations);
    renderIngestJobs(data.ingest_jobs);
    renderLogs(data.recent_logs);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;color:red">Failed to load demo data. Ensure /api/technical.json is present.</div>';
  }
}

document.getElementById('refresh').addEventListener('click', init);
document.getElementById('range').addEventListener('change', init);

init();
