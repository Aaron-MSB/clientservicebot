// Client Dashboard demo — fetches ./api/client.json and renders UI
// Demo-only handlers: downloads sanitized transcript, "Ask again" creates a new session placeholder

const DATA_URL = './api/client.json';
let charts = {};

async function fetchData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Failed to fetch client data');
  return res.json();
}

function renderKpis(kpis) {
  const container = document.getElementById('kpi-tiles');
  container.innerHTML = '';
  const tiles = [
    { label: 'Interactions (This Month)', value: kpis.interactions_month },
    { label: 'Avg QoE', value: `${Math.round(kpis.avg_qoe*100)}%` },
    { label: 'Most Recent NPS', value: kpis.recent_nps },
    { label: 'Interaction Frequency', value: kpis.interaction_frequency }
  ];
  tiles.forEach(t => {
    const el = document.createElement('div'); el.className = 'kpi';
    el.innerHTML = `<div class="label">${t.label}</div><div class="value">${t.value}</div>`;
    container.appendChild(el);
  });
}

function renderHistory(sessions) {
  const el = document.getElementById('historyList');
  el.innerHTML = '';
  if (!sessions.length) { el.innerHTML = '<div class="item">No interactions yet</div>'; return; }
  sessions.forEach(s => {
    const node = document.createElement('div'); node.className = 'session';
    node.innerHTML = `
      <div>
        <div style="font-weight:700">${s.summary}</div>
        <div class="meta">${s.started_at} • ${s.category} • Status: ${s.status}</div>
      </div>
      <div class="actions">
        <button class="btn small" onclick='viewTranscript("${s.id}")'>View</button>
        <button class="btn small ghost" onclick='downloadTranscript("${s.id}")'>Download</button>
        <button class="btn small" onclick='followUp("${s.id}")'>Ask follow-up</button>
      </div>
    `;
    el.appendChild(node);
  });
}

function renderFaqs(faqs) {
  const el = document.getElementById('faqList'); el.innerHTML = '';
  faqs.forEach(f => {
    const it = document.createElement('div'); it.className = 'item';
    it.innerHTML = `<div><div class="title">${f.question}</div><div class="sub">${f.usage_count} times • last asked ${f.last_asked}</div></div><div><button class="btn small" onclick='askAgain("${f.id}")'>Ask again</button></div>`;
    el.appendChild(it);
  });
}

function makeQoeChart(ctx, timeseries) {
  if (charts.qoe) charts.qoe.destroy();
  charts.qoe = new Chart(ctx, {
    type: 'line',
    data: { labels: timeseries.map(t=>t.date), datasets: [{ label: 'QoE (%)', data: timeseries.map(t=>Math.round(t.qoe*100)), borderColor:'#005A9C', backgroundColor:'#005A9C22', fill:true }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min:0, max:100 } } }
  });
}

function renderDocs(docs) {
  const el = document.getElementById('docsList'); el.innerHTML = '';
  docs.forEach(d => {
    const it = document.createElement('div'); it.className = 'item';
    it.innerHTML = `<div style="flex:1"><div style="font-weight:700">${d.title}</div><div class="sub">${d.excerpt}</div></div><div><a class="btn small" href="${d.link}" target="_blank">Open</a></div>`;
    el.appendChild(it);
  });
}

// Demo actions
window.viewTranscript = (id) => {
  const data = window.__clientData.sessions.find(s=>s.id===id);
  if (!data) return alert('Transcript not found');
  const sanitized = sanitizeTranscript(data.transcript);
  const win = window.open('', '_blank', 'noopener');
  win.document.write(`<pre style="font-family:monospace;padding:16px">${escapeHtml(sanitized)}</pre>`);
};

window.downloadTranscript = (id) => {
  const data = window.__clientData.sessions.find(s=>s.id===id);
  if (!data) return alert('Transcript not found');
  const sanitized = sanitizeTranscript(data.transcript);
  const blob = new Blob([sanitized], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

window.followUp = (id) => {
  alert('Starting follow-up chat (demo) with context from session ' + id);
};

window.askAgain = (faqId) => {
  const faq = window.__clientData.faqs.find(f=>f.id===faqId);
  if (!faq) return;
  alert('Asking again (demo): ' + faq.question);
};

window.startChat = () => {
  alert('Open chat window (demo). In production this would open an authenticated chat session.');
};

function sanitizeTranscript(text) {
  // Simple PII redaction demo: redact patterns that look like TIN or email or phone numbers
  return text
    .replace(/\bTIN[:\s]*\d{2,3}[-\s]\d{3}[-\s]\d{3}\b/gi, '[REDACTED_TIN]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{9,12}\b/g, '[REDACTED_ID]');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function init() {
  try {
    const data = await fetchData();
    window.__clientData = data; // expose for demo handlers
    document.getElementById('clientName').textContent = `${data.client.name} • ${data.client.tin}`;
    document.getElementById('clientSub').textContent = `Member since ${data.client.since}`;
    renderKpis(data.kpis);
    renderHistory(data.sessions);
    renderFaqs(data.faqs);
    makeQoeChart(document.getElementById('qoeChart').getContext('2d'), data.timeseries);
    renderDocs(data.recommended_docs);
    document.getElementById('startChat').addEventListener('click', startChat);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;color:red">Failed to load client demo data. Ensure /api/client.json is present.</div>';
  }
}

init();
