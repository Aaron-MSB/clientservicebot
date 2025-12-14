# Executive Dashboard — ClientServiceBot (Static Demo)

This repository contains a runnable, static Executive Dashboard for the ClientServiceBot. It's designed to run inside GitHub Codespaces or any environment that can serve static files (for example, VS Code Live Server). The dashboard consumes local mock API JSON files in `/api/` so you can iterate without a backend.

What you get
- A responsive Executive Dashboard UI (HTML/CSS/JS).
- Charts powered by Chart.js (time series, bar, donut).
- KPI tiles for: Queries (Today), Queries MTD, Queries (FY), Avg QoE, NPS.
- Alerts panel with actions.
- Top categories and locations table.
- Local mock data in `api/executive.json`.

Run in GitHub Codespaces / VS Code with Live Server
1. Open this repository in Codespaces or VS Code.
2. Install the Live Server extension (if not already installed).
3. In the file explorer, open `index.html`.
4. Right-click and choose "Open with Live Server" (or click "Go Live" in the status bar).
5. The default browser will open the dashboard. The page fetches `api/executive.json` to populate the UI.

Notes
- This is a static frontend demo. To connect to a real backend, point the fetch calls in `app.js` to your API endpoints or run a small proxy.
- The mock API file (`api/executive.json`) demonstrates the expected API shape for the Executive dashboard.

Files
- index.html — main HTML and layout
- styles.css — styling and responsive grid
- app.js — frontend logic, fetches mock API and renders charts
- api/executive.json — mock data used by the dashboard

Customization
- Replace `api/executive.json` with a server-side route returning the same shape.
- Swap Chart.js for another charting library if desired.
- Add authentication, RBAC, and real-time updates (WebSocket or server-sent events) for production.

If you'd like, I can:
- scaffold a small Node/Express backend to serve the same API plus sample server endpoints,
- convert this into a React frontend,
- or add a simple live-update simulation (randomized incoming queries & alerts).
