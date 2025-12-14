# ClientServiceBot — Dashboard Mockups & UI Wireframes

This document contains textual wireframes and component specs for the four dashboards:
- Executive Dashboard
- Technical Teams Dashboard
- Client Service Teams Dashboard
- Client / Customer Dashboard

Also includes:
- Chat UI & escalation modal
- Component hierarchy and API contracts
- Sample interactions and drilldowns

Design principles
- Role-aware default view and permissions
- Real-time / near-real-time tiles with auto-refresh (configurable)
- Alert-first UX for executives and teams (banner + action)
- Clean KPI tiles, charts, tables, and drilldown flows
- Accessible color palette and responsive layout

Common UI primitives
- KPI Tile: metric, sparkline, delta vs previous period
- Time Range Picker: presets (Today, 7d, 30d, MTD, FY)
- Chart types: line, area, stacked bar, donuts, heatmap, map (choropleth by region)
- Table: sortable, paginated, server-side
- Session List: baseline rows with quick actions (view, escalate, assign)
- Alert Panel: list of active alerts with ack & resolve actions

1) Executive Dashboard (role: executive)
Layout (single page):
- Top bar: org selector, time-range picker, export button, quick filters
- Row 1: KPI tiles (4 across on desktop)
  - Total Queries (Today) — numeric, sparkline, % delta
  - Queries (MTD) — numeric
  - Queries (FY cumulative) — numeric
  - Avg QoE — numeric (0..1 or 0..100), trend arrow
- Row 2: Secondary KPI tiles (NPS, Promoters/Passives/Detractors counts, Active Sessions)
  - NPS (score) + mini bar of distribution (P/P/D)
  - Active Sessions (count) with breakdown (active/escalated/complete)
- Row 3: Large visual panels
  - Left (2/3 width): Time series — queries by day + stacked by category (line/stacked area). Drilldown: click day -> open day detail modal (top categories, top locations, top devices, sample sessions)
  - Right (1/3 width): Top categories (bar list) + "Most Risky Categories" (from risk classifier)
- Row 4: Map + Device breakdown
  - World/Region map showing query density by location; hover shows negative sentiment ratio
  - Device donut chart (mobile/tablet/desktop)
- Row 5: Alerts & Incidents
  - Active Alerts list (severity icon, name, triggered_at, action buttons: Acknowledge, Assign owner, Open incident)
  - Incident timeline / recent critical alerts
- Row 6: Executive actions & notes
  - Playbook snippet when a critical alert triggers (predefined steps)
  - "Send alert to" quick actions (Slack/email)

Interactions & behaviors
- Clicking a KPI opens a drilldown modal with raw query list + session examples.
- Top categories bar => opens category page with sample sessions and suggested policy edits.
- Map click filters other widgets to selected region.
- Alerts persist; executives can assign to teams with one click.

API endpoints used
- GET /api/v1/dashboards/executive?from=&to=
- GET /api/v1/alerts?status=triggered
- GET /api/v1/sessions?status=escalated&limit=50

Sample data shape (Executive KPI tile)
{
  "label":"Queries (MTD)",
  "value": 24357,
  "sparkline":[120,130,140,...],
  "delta_pct": +7.4
}

2) Technical Teams Dashboard (role: technical)
Purpose: monitor backend health, ingestion, vector DB, LLM call stats, and technical escalations.

Layout:
- Row 1: KPI tiles
  - API Latency P95 (ms)
  - LLM Avg Latency (ms)
  - Vector DB latency (ms)
  - Worker queue length (ingest jobs)
- Row 2: Error rates & logs
  - Error rate time series (% errors) with filters by service (backend/ingest/worker)
  - Recent error list / stacktrace preview (click to open full log)
- Row 3: Ingestion & Vector DB
  - Ingest throughput (docs/day)
  - Vector DB health (uptime, index status)
  - Untrained ivfflat index warning (if applicable)
- Row 4: Technical Escalations
  - Table: escalation id, session id, priority, owner, status, created_at, actions (claim, comment, escalate)
- Row 5: System alerts & maintenance
  - Scheduled maintenance window, metrics per node, memory/cpu charts

Key interactions
- Claim escalation button assigns to current user (POST /api/v1/escalations/:id/assign)
- Replay events: open a session -> click "replay LLM call" to view full transcript and embeddings used.

APIs
- GET /api/v1/dashboards/technical?from=&to=
- GET /api/v1/ingest/jobs?status=running
- GET /api/v1/escalations?owner_team=technical

3) Client Service Teams Dashboard (role: client_service)
Purpose: manage escalations from chatbot, review active sessions that need human intervention, ensure SLA.

Layout:
- Row 1: KPI tiles
  - Open Escalations (count)
  - Avg SLA time (minutes)
  - Resolved Today (count)
  - Avg First Response (minutes)
- Row 2: Active sessions needing attention (table)
  - Columns: session_id, client (TIN or anonymized), started_at, category, priority, assigned_agent, last_message_preview, actions: join session / claim / escalate to tech
  - "Join session" opens an agent view with the chat transcript + bot answer + suggested response templates
- Row 3: Escalations queue
  - Table with filters (priority, age, category)
  - Bulk actions: assign to team member, escalate to technical, mark resolved
- Row 4: Quality panel
  - Recent feedback list (NPS comments)
  - Suggested canned responses improvement (based on frequent edits by agents)
- Row 5: Knowledge Base & suggested updates
  - KB items frequently surfaced that led to escalations; quick link to edit doc or flag to content team

Interactions
- Agent can "take over" session: from agent view, send message as agent (POST messages API), update session status to 'in_progress' and then 'complete'.
- When agent resolves, ask end-user to fill quick NPS prompt (automated).

APIs
- GET /api/v1/escalations?status=open&owner_team=client_service
- POST /api/v1/escalations/:id/assign
- GET /api/v1/sessions?needs_attention=true

4) Client / Customer Dashboard (role: client)
Purpose: personal interaction history, top asked questions for that client, QoE and NPS history.

Layout:
- Top: Welcome card with quick actions (Start chat, View history, Edit profile)
- Row 1: Personal KPIs
  - Interactions this month, Avg QoE (personal), NPS (most recent)
- Row 2: History timeline (accordion)
  - Each session: date, summary, category, status, view transcript, download transcript
- Row 3: Most asked questions (for this user)
  - Top 10 questions with "Start again" quick link
- Row 4: Suggested actions / recommended docs
  - Contextual docs from KB (links to URA pages), e.g., "How to reset Touchpoint password"
- Row 5: Feedback and settings
  - NPS history, privacy controls, data deletion request

Interactions
- Download transcript: returns sanitized transcript (removes PII unless consented).
- Reopen session: "Ask follow-up" which creates new session with context.

APIs
- GET /api/v1/users/:id/sessions
- GET /api/v1/users/:id/recommendations

5) Chat UI (shared across client & agents)
Structure:
- Left column: conversation list (sessions), search
- Main column: conversation view
  - Header: session metadata (category, assigned_agent, status, quick actions)
  - Message area: stacked messages with timestamps, sender badges, and source citations for bot messages (expand to show doc snippet with link).
  - Composer: input with suggestion chips (LLM-suggested follow-ups), file upload, "escalate" button
  - Right pane: context (KB sources used for this response, session QOE, quick reply templates, client profile)

Bot message format
- Main text
- Confidence score badge (e.g., 82%)
- Sources: list of up to 3 with doc title + page + excerpt + link
- "Escalate" and "Give feedback" actions below each bot reply

Agent view extras
- "Edit bot reply" — agent can edit and send improved text; agent edits stored as correction events.
- "Canned responses" & "Suggested actions" from KB.

6) Escalation Modal / Ticket creation flow
- Triggered when bot confidence < threshold, user clicks escalate, or agent chooses.
- Fields:
  - Priority (low/medium/high/critical)
  - Owner team (client_service/technical)
  - Short summary (auto-filled)
  - Detailed description (auto-filled with transcript + user message + bot sources)
  - Attachments (files)
  - Notify channels (email/slack)
- Buttons: Create & assign, Create & send notification, Cancel

7) Visual styling & tokens (suggested)
- Primary: #005A9C (URA blue)
- Accent: #00A99D (teal)
- Danger: #E53935 (critical alerts)
- Neutral text: #1F2937
- Background: #F8FAFC
- Font family: Inter or system UI
- Accessibility: ensure contrast ratio 4.5:1 for text on background tiles

8) Component hierarchy (React/TS)
- App
  - Auth (routes)
  - DashboardLayout
    - Topbar (TimeRangePicker, OrgSelector)
    - Sidebar (role-specific nav)
    - Content
      - DashboardPage (exec/tech/client_service/client)
        - KPIGrid
          - KpiTile
        - ChartsGrid
          - TimeSeries
          - BarList
        - Maps / Heatmaps
        - AlertsPanel
        - SessionTable
  - ChatShell
    - SessionList
    - ConversationView
    - Composer
    - ContextPane
  - EscalationModal
  - KBEditor (admin)

9) Wireframe ASCII examples (Executive — simplified)

[Topbar: URA logo | Org selector | TimeRange: [Today v] | Export ]
--------------------------------------------------------------------------------
| KPI: Queries Today  | KPI: Queries MTD | KPI: Queries FY | KPI: Avg QoE      |
|  1,245 (+3.2%)      |  24,357 (+6%)    |  123,456         |  78% (▲2)         |
--------------------------------------------------------------------------------
| Left: Queries by day (area stacked)                       | Right: Top categories |
| [chart area]                                              | Payments  2,345      |
|                                                           | Registration 1,987   |
--------------------------------------------------------------------------------
| Map: Query density by Region  | Device donut | Most Risky Categories |
| [map]                         | [donut]      | Tax refund delays     |
--------------------------------------------------------------------------------
| Alerts (3 active)                                        | Recent incidents     |
| [critical] Spike in negative sentiment in Kampala (Ack)  | Incident timeline    |
--------------------------------------------------------------------------------

10) Accessibility & Localization
- Support Luganda & English localized content for KB responses.
- Ensure keyboard navigation for tables and modals.
- Screen reader friendly labels for charts.

11) Sample UI API contracts (quick)
- GET /api/v1/dashboards/executive?from=2025-11-01&to=2025-11-30
- GET /api/v1/sessions?status=active&limit=50
- POST /api/v1/escalations { session_id, priority, owner_team, summary, details }
- POST /api/v1/messages { session_id, sender:agent|user, text }
- GET /api/v1/docs/recommendations?session_id=...&k=5

12) Next steps for implementation
- Create design system (tokens & components) and Storybook entries for each KPI tile and chart.
- Implement API stubs and wire up with mock data for front-end development.
- Build the Chat UI with streaming LLM responses and progressive rendering of sources.

If you want, I can:
- generate React component skeletons (TSX) for the main dashboards,
- produce Figma-ready spec (JSON) or SVG wireframes,
- scaffold sample API mocks and seed data to run the UI locally.

Which of these should I produce next?
