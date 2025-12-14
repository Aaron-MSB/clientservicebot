# Technical Dashboard — ClientServiceBot (Static Demo)

This folder contains a runnable, static Technical Teams Dashboard for the ClientServiceBot. It's designed to run inside GitHub Codespaces or any environment that can serve static files (for example, VS Code Live Server). The dashboard consumes local mock API JSON file in `/api/technical.json` so you can iterate without a backend.

How to run in GitHub Codespaces / VS Code with Live Server
1. Open this repository in Codespaces or VS Code.
2. Install the Live Server extension (if not already installed).
3. Open `technical.html`.
4. Right-click and choose "Open with Live Server" (or click "Go Live" in the status bar).
5. The default browser will open the dashboard. The page fetches `api/technical.json` to populate the UI.

What you get
- KPI tiles for critical technical metrics: API Latency P95, LLM Avg Latency, Vector DB Latency, Worker Queue Length, Error Rate.
- Time-series charts for error rate and ingest throughput.
- Table of technical escalations with quick actions (demo).
- Ingest jobs panel and vector DB health panel.
- Recent error logs preview with clickable stacktrace preview (demo-only).
- All data comes from `api/technical.json` (mock) and can be replaced with real endpoints.

Files included
- technical.html — main HTML and layout for the Technical dashboard
- technical_styles.css — styling and responsive grid
- technical_app.js — frontend logic, fetches mock API and renders tables & charts
- api/technical.json — mock data used by the dashboard

Notes
- This is a static frontend demo. To connect to a real backend, change the fetch URL in `technical_app.js` to your API endpoints or run a small proxy.
- Actions like "Claim", "Restart Job", and "Open Log" are demo placeholders and trigger sample alerts.

If you'd like, I can:
- scaffold a small Node/Express backend to serve the same API plus endpoints to mutate escalations / jobs,
- convert this to a React app with the same pages and components,
- or add simulated real-time updates using WebSockets.

Which should I generate next?
