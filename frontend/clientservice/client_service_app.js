// Client Service Dashboard Demo — fetches mock data from /api/client_service.json
// Renders KPI tiles, escalations table, sessions table, feedback, KB suggestions

const DATA_URL = './api/client_service.json';
let state = { data: null };

async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
}

function renderKpis(kpis) {
  const container = document.getElementById('kpi-tiles');
  container.innerHTML = '';
  const tiles = [
    { label: 'Open Escalations', key: 'open_escalations' },
    { label: 'Avg SLA (mins)', key: 'avg_sla_minutes' },
    { label: 'Resolved Today', key: 'resolved_today' },
    { label: 'Avg First Response (mins)', key: 'avg_first_response' }
  ];
  tiles.forEach(t => {
    const el = document.createElement('div');
    el.className = 'kpi';
    const value = kpis[t.key] !== undefined ? kpis[t.key] : '-';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value">${value}</div>`;
    container.appendChild(el);
  });
}

function renderEscalations(escalations) {
  const tbody = document.querySelector('#escalationsTable tbody');
  tbody.innerHTML = '';
  escalations.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.session_id || '-'}</td>
      <td>${e.priority}</td>
      <td>${e.owner_team}</td>
      <td>${e.summary}</td>
      <td>${e.age}</td>
      <td>
        <button class="btn" onclick='claimEsc("${e.id}")'>Claim</button>
        <button class="btn ghost" onclick='commentEsc("${e.id}")'>Comment</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummary(summary) {
  const el = document.getElementById('summaryList');
  el.innerHTML = '';
  Object.entries(summary).forEach(([k,v])=>{
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div style="font-weight:600">${k}</div><div>${v}</div>`;
    el.appendChild(it);
  });
}

function renderSessions(sessions) {
  const tbody = document.querySelector('#sessionsTable tbody');
  tbody.innerHTML = '';
  sessions.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${s.client}</td>
      <td>${s.category}</td>
      <td>${s.started_at}</td>
      <td>${s.last_message}</td>
      <td>${s.assigned || '-'}</td>
      <td>
        <button class="btn" onclick='joinSession("${s.id}")'>Join</button>
        <button class="btn ghost" onclick='claimSession("${s.id}")'>Claim</button>
        <button class="btn danger" onclick='escalateToTech("${s.id}")'>Escalate</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFeedback(feedback) {
  const el = document.getElementById('feedbackList');
  el.innerHTML = '';
  if (!feedback.length) { el.innerHTML = '<div class="item">No recent feedback</div>'; return; }
  feedback.forEach(f => {
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div style="flex:1"><div style="font-weight:600">${f.nps_score} • ${f.comments || ''}</div><div class="sub">${f.created_at} • Session ${f.session_id}</div></div><div style="font-size:12px;color:var(--muted)">${f.rating}★</div>`;
    el.appendChild(it);
  });
}

function renderKbSuggestions(suggestions) {
  const el = document.getElementById('kbSuggestions');
  el.innerHTML = '';
  if (!suggestions.length) { el.innerHTML = '<div class="item">No KB suggestions</div>'; return; }
  suggestions.forEach(s => {
    const it = document.createElement('div'); it.className='item';
    it.innerHTML = `<div style="flex:1"><div style="font-weight:700">${s.title}</div><div class="sub">${s.reason}</div></div><div><button class="btn" onclick='openKb("${s.doc_id}")'>Edit</button></div>`;
    el.appendChild(it);
  });
}

// Demo handlers
window.claimEsc = (id) => alert(`Claim escalation (demo): ${id}`);
window.commentEsc = (id) => alert(`Comment on escalation (demo): ${id}`);
window.joinSession = (id) => alert(`Join session (demo): ${id}`);
window.claimSession = (id) => alert(`Claim session (demo): ${id}`);
window.escalateToTech = (id) => alert(`Escalate session to technical team (demo): ${id}`);
window.openKb = (docId) => alert(`Open KB editor (demo): ${docId}`);

async function init() {
  try {
    const data = await fetchData();
    state.data = data;
    renderKpis(data.kpis);
    renderEscalations(data.escalations);
    renderSummary(data.summary);
    renderSessions(data.active_sessions);
    renderFeedback(data.recent_feedback);
    renderKbSuggestions(data.kb_suggestions);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;color:red">Failed to load demo data. Ensure /api/client_service.json is present.</div>';
  }
}

document.getElementById('refresh').addEventListener('click', () => init());
document.getElementById('range').addEventListener('change', () => init());

init();
