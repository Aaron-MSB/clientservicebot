# Client Service Dashboard — ClientServiceBot (Static Demo)

This folder contains a runnable, static Client Service Teams Dashboard for the ClientServiceBot. It's designed to run inside GitHub Codespaces or any environment that can serve static files (for example, VS Code Live Server). The dashboard consumes local mock API JSON files in `/api/` so you can iterate without a backend.

How to run in GitHub Codespaces / VS Code with Live Server
1. Open this repository in Codespaces or VS Code.
2. Install the Live Server extension (if not already installed).
3. Open `client_service.html`.
4. Right-click and choose "Open with Live Server" (or click "Go Live" in the status bar).
5. The default browser will open the dashboard. The page fetches `api/client_service.json` to populate the UI.

Files included
- client_service.html — main HTML and layout for the Client Service dashboard
- client_service_styles.css — styling and responsive grid
- client_service_app.js — frontend logic, fetches mock API and renders tables & charts
- api/client_service.json — mock data used by the dashboard

Notes
- This is a static frontend demo. To connect to a real backend, point the fetch calls in `client_service_app.js` to your API endpoints or run a small proxy.
- Buttons like "Claim", "Join", and "Resolve" are demo actions and will show a placeholder alert. They do not call a backend.

If you'd like, I can:
- scaffold a small Node/Express backend to serve these APIs,
- convert this into a React app with the same pages,
- or add websockets / simulated live updates.
