# Client Dashboard — ClientServiceBot (Static Demo)

This folder contains a runnable, static Client (Customer) Dashboard for the ClientServiceBot. It's intended to be opened inside GitHub Codespaces or any editor that can serve static files with Live Server.

What you get
- A responsive Client Dashboard UI (HTML/CSS/JS).
- Personal KPIs (interactions this month, avg QoE, most recent NPS).
- Interaction history (session timeline) with ability to view/download sanitized transcript (demo).
- Most asked questions for the client with quick "Ask again" links.
- Recommended documents and quick actions.
- Local mock API data in `api/client.json`.

Run in GitHub Codespaces / VS Code with Live Server
1. Open this repository in Codespaces or VS Code.
2. Install the Live Server extension if needed.
3. Open `client.html`.
4. Right-click and choose "Open with Live Server" (or click "Go Live").
5. The page will fetch `api/client.json` and populate the dashboard.

Files included
- client.html — main HTML and layout
- client_styles.css — styling and responsive layout
- client_app.js — frontend logic and mock interactions
- api/client.json — mock data

Notes
- This is a static demo. To attach to a real backend, point fetch calls in `client_app.js` to your endpoints and implement authentication.
- Transcript download is sanitized in demo code. In production, ensure PII policies are followed.

If you'd like, I can:
- scaffold a small Node/Express backend to serve the API,
- convert the UI to React with authentication flows,
- add simulated live updates or WebSocket session streaming.
