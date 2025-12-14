# ClientServiceBot — URA Excellence Blueprint RAG Chatbot

ClientServiceBot is a full‑stack Retrieval Augmented Generation (RAG) solution to turn the Uganda Revenue Authority (URA) "Excellence Blueprint" handbook into a searchable knowledge base and conversational assistant. It provides role‑aware dashboards (Executive, Technical, Client Service, Client) with insights, session tracking, NPS & QoE computation, alerts, and escalation workflows (to Touchpoint/Helpdesk) and can run tax calculations (e.g., rental tax computations) from textual instructions.

This repository contains the reference architecture, bootstrap ingestion tooling, API surface, and recommended stack to implement a production‑ready system using an OpenAI API key for embeddings / generation.

Key features
- Ingests Word or PDF handbook pages, chunks & embeds content, stores vectors in a Vector DB (PGVector, Pinecone, Weaviate, Milvus).
- Semantic search + RAG pipeline to produce answers with provenance (source page, snippet, confidence).
- Role‑based dashboards:
  - Executive Dashboard: daily/monthly/financial‑year totals, most asked category, risk areas (from sentiment & classification), locations, device breakdown, NPS, detractors/passives, session lifecycle (active/complete/incomplete), QoE metric, alerts.
  - Technical Dashboard: backend KPIs, escalated technical tickets, performance and error heatmaps.
  - Client Service Dashboard: escalated queries requiring human follow up, active sessions needing attention, ticket management.
  - Client Dashboard: personal interaction history, FAQs, QOE, interaction frequencies.
- Sentiment analysis and risk tagging (OpenAI-based or lightweight local model).
- Session management with lifecycle and status (active, complete, incomplete); handoff to agents.
- Calculators: text-driven parsers and computation modules (examples: Rental tax computations).
- Alerts & notification flows (email, Slack/MS Teams, SMS) for executives/teams.
- Secure RBAC, audit logs, traceability of answers.

Contents of this repo (proposed)
- README.md (this file)
- ARCHITECTURE.md — architecture and component interactions
- ingest/ingest_doc.py — sample ingestion script for Word docs
- backend/ — Node/Express or FastAPI backend scaffold (APIs, ingestion webhook, connectors)
- frontend/ — React + dashboard UI scaffold
- infra/docker-compose.yml — local dev stack (Postgres, Redis, vector DB option)
- examples/.env.example — environment variables

Quick start (local dev, minimal)
1. Copy .env (see examples/.env.example).
2. Start local infra (Postgres + Redis + vector DB). For dev you can use PGVector in Postgres.
   - docker compose up -d
3. Install backend & frontend dependencies:
   - cd backend && npm install
   - cd frontend && npm install
4. Ingest the excellence blueprint (Word or PDF):
   - python ingest/ingest_doc.py --file path/to/excellence_blueprint.docx
5. Start backend and frontend:
   - cd backend && npm run dev
   - cd frontend && npm start
6. Visit http://localhost:3000 for dashboards.

Environment (example variables)
- OPENAI_API_KEY — OpenAI API key used for embeddings & generation
- VECTOR_DB_TYPE — pinecone | weaviate | pgvector | milvus
- VECTOR_DB_URL / PINECONE_API_KEY / WEAVIATE_URL etc.
- DATABASE_URL — Postgres DB
- REDIS_URL — Redis for session cache
- SESSION_SECRET — cookie/session secret
- SENTRY_DSN — (optional) error reporting
- GEOIP_API_KEY — (optional) IP -> location
- NOTIFY_WEBHOOK — alerts webhook (Slack/email service)

Security & compliance
- Role-based Access Control (RBAC): roles: admin, executive, technical, client_service, client.
- PII handling: redact/sanitize PII on ingest (configurable). Retain provenance mapping to original document positions.
- Audit logging of queries, model outputs, and agent edits.
- Rate limiting on endpoints and prompt usage.
- Encryption at rest (database & object store) and in transit (TLS).

What's inside (high level)
- Ingestion pipeline:
  - Source connectors (Word/PDF, S3, SharePoint).
  - Text extraction and clean-up (python-docx, pdfminer, OCR fallback).
  - Chunking (overlap, semantic-aware).
  - Embedding generation (OpenAI embeddings or alternative).
  - Vector DB upsert with metadata (page, section, TOC entry, doc URL).
- Query pipeline (RAG):
  - User query -> vector retrieval (top-k) -> rerank (optional) -> build prompt with selected snippets -> call LLM -> produce answer with citations + confidence + potential follow-up questions.
  - If uncertain threshold or “no confident answer” -> escalate to Client Service queue.
  - For certain tax computations: attempt deterministic parse + compute via dedicated calculator module; include worked steps and references.
- Session & metrics:
  - Each user conversation stored as session with messages, start/end timestamps, end reason (resolved/escalated/timeout).
  - Events emitted to analytics (message_received, vector_hits, llm_response_time, escalation_created).
  - Aggregation pipeline produces KPIs for dashboards.
- Sentiment & Risk:
  - Sentiment per message and aggregated per session.
  - Risk classifier that flags legal/compliance/tax risk phrases (configurable list + model).
- Alerts:
  - Rule-based alerts (e.g., spike in unresolved sessions, high negative sentiment in certain location, NPS below threshold).
  - Exec notifications via Slack/Email + alert dashboard card with playbook & owner assignment.

APIs (selected)
- POST /api/v1/query
  - body: { session_id?, user_id?, role?, text, metadata? }
  - returns: { answer, sources: [{docId, page, excerpt, score}], follow_up? }
- GET /api/v1/sessions/:id
- GET /api/v1/dashboards/executive?from=&to=
- GET /api/v1/dashboards/technical?from=&to=
- POST /api/v1/escalations — create helpdesk ticket (integrate Touchpoint)
- POST /api/v1/feedback — NPS feedback, rating, comments
- POST /api/v1/ingest (admin) — upload doc / start ingestion job

Data model (core tables)
- users (id, name, email, role, org_unit, created_at)
- sessions (id, user_id, start_at, end_at, status, resolution, assigned_agent)
- messages (id, session_id, from, text, sentiment_score, created_at)
- docs (id, title, source_url, uploaded_by)
- documents_chunks (id, doc_id, chunk_text, page, position, embedding_id, metadata)
- vectors (managed by vector DB; metadata references chunk id)
- escalations (id, session_id, owner_team, priority, status)
- feedback (id, session_id, user_id, nps_score, comment)
- alerts (id, rule, triggered_at, severity, resolved)

QoE metric (suggested)
- QoE = weighted_normalize(0.5 * Technical_KPI + 0.5 * Interaction_Quality)
  - Technical_KPI = combine(normalized_response_latency, error_rate, api_success_rate)
  - Interaction_Quality = combine(normalized_resolution_rate, ∼1 - negative_sentiment_share, NPS_scaled)
- Provide configurable weights in admin settings. Use deciles to normalize.

Tax computation example (rental)
- Extraction: detect "rental" related query via classifier.
- If detected: run structured parser to extract fields (rental_amount, frequency, exemptions) or ask clarifying Qs.
- Run deterministic computation module (JS/Python) to compute payable tax and return worked steps and receipts with references to the handbook pages.

Extensibility & infra recommendation
- Production stack:
  - Frontend: React + TypeScript + Recharts/D3
  - Backend: Node (NestJS/Express) or Python (FastAPI) — both work; include workers in Python for embeddings if using OpenAI Python SDK.
  - Database: Postgres with PGVector for vector storage (self-host) or Pinecone/Weaviate for managed service.
  - Cache/state: Redis
  - Object storage: S3 (or S3-compatible)
  - Analytics/eventing: Kafka or cloud pubsub for telemetry
  - Observability: Prometheus + Grafana, Sentry
  - Auth: OIDC / Azure AD or internal identity provider for staff
  - Deploy: Kubernetes (recommended) or ECS/Fargate for cloud-managed
- Cost & scale: offload embeddings & vector search to managed providers (Pinecone, Weaviate Cloud, OpenSearch with k-NN) if traffic grows.

Next steps (suggested MVP phases)
1. MVP ingestion + RAG:
   - Implement ingestion pipeline for Word doc.
   - Deploy Postgres+PGVector, run ingestion.
   - Build query endpoint returning answer + citations.
2. Session tracking & handoffs:
   - Implement sessions, sentiment, escalate path to a simple ticket queue.
3. Dashboards (basic):
   - Executive: total queries/day, top categories, NPS summary.
   - Client Service: active escalations, session list.
   - Technical: API latency & error rate.
4. Expand analytics & QoE formula; add alerts.
5. Harden security, RBAC, audit logs; deploy to staging.

Contact / Ownership
- Owner: Client Experience Team (URA)
- Tech lead: (to be assigned)
- For onboarding & architecture decisions, schedule discovery session with stakeholders (Executives, Technical Ops, Client Service Team).

License
- Add organization-appropriate license (e.g., proprietary or MIT depending on URA policy).
