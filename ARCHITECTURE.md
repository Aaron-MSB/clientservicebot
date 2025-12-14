# ClientServiceBot — Architecture Overview

This document describes the proposed architecture and data flows for the URA ClientServiceBot.

1) High-level components
- Frontend (React)
  - Role-aware dashboards
  - Conversational UI for clients
  - Admin UI for documents, rules, RBAC
- Backend API (FastAPI or Node/NestJS)
  - Authentication & RBAC
  - Query & RAG orchestration
  - Ingestion endpoints
  - Metrics & alerts endpoints
  - Escalation / ticketing integration
- Ingestion Worker(s)
  - Document parsers (docx/pdf/ocr)
  - Chunking & metadata extraction
  - Embeddings generation (OpenAI)
  - Upsert to vector DB
- Vector Database
  - Stores embeddings + metadata for fast similarity search
  - Options: PGVector (Postgres), Pinecone, Weaviate, Milvus
- Relational DB (Postgres)
  - Stores users, sessions, messages, escalations, feedback, events
- Cache & Realtime (Redis)
  - Session state, locks, pub/sub for notifications
- Analytics / Event Bus
  - Kafka / Cloud PubSub for events -> analytic pipelines
- Observability & Alerting
  - Prometheus, Grafana, Sentry
- External Integrations
  - OpenAI (embeddings + LLM)
  - GeoIP service for location inference
  - Touchpoint/helpdesk API for escalations
  - Email/Slack for alerts

2) Data ingestion flow
User (admin) uploads Word doc -> Ingestion Worker:
- Extract text, split into chunks (configurable size & overlap)
- Extract metadata (page, TOC, section)
- Redact PII (configurable)
- Create embeddings with OpenAI
- Upsert vectors to Vector DB with metadata (doc_id, page, section)
- Index or store the raw document and chunk mapping in Postgres

3) Query (RAG) flow
User query -> Backend:
- Normalize + classify (e.g., detect tax computation intent)
- Retrieve top-k chunks from Vector DB (by similarity)
- Optionally rerank using a relevance model
- Build system & user prompt that includes selected chunks as context + RAG instructions
- If deterministic computation (tax calculators), call calculators before or after LLM
- Call LLM to generate answer
- Post-process: attach citations, sources, confidence score
- Store the message and events for analytics
- Return to frontend

4) Session lifecycle & escalation
- Session state: active -> resolved (complete) | escalated | timed_out (incomplete).
- If LLM confidence < threshold or indicated by user ("escalate"), create escalation ticket.
- Escalations stored in Postgres and pushed to Client Service queue; actionable by human agent.
- Agents can edit model's answer; edits are logged to improve KB & fine‑tune future models.

5) Sentiment, NPS & QoE
- Per‑message sentiment via LLM classification or sentiment model.
- After session end, prompt the user for NPS survey.
- Compute NPS (Promoters [9-10], Passives [7-8], Detractors [0-6]).
- QoE is computed from technical metrics (latency, error rate) and interaction quality (resolution rate, sentiment, NPS). We store both raw metrics and aggregated KPIs for dashboards.

6) Dashboards & KPIs
- Executive Dashboard
  - KPI tiles: total queries per day, month-to-date, FY cumulative
  - Time-series charts (queries, NPS, QoE)
  - Top categories & categories by volume
  - Risk heatmap by location or category (negative sentiment spikes)
  - Device breakdown & sessions by device type
  - Alerts & unresolved escalations
- Technical Dashboard
  - API latency P95, error rate, vector DB latency
  - Worker queue length & ingestion status
  - Top technical escalations & logs
- Client Service Dashboard
  - Escalated tickets, SLA, assigned agents
  - Active sessions needing human attention
- Client Dashboard (for authenticated taxpayers)
  - My interactions, most asked questions, personal NPS & session history

7) Example QoE formula
- QoE = 0.4*ResolutionRate + 0.3*(1 - SessionErrorRate) + 0.2*(NormalizedNPS) + 0.1*(NormalizedLatencyScore)
- Normalizations: map metrics to [0..1] using historical percentiles.

8) Governance & improvements
- Feedback loop: agent corrections and flagged wrong answers feed an "improve" queue to refine documents, add new KB entries, or create clarifying Q&A.
- Model transparency: every answer includes source snippets and a confidence band; logs kept for audits.

9) Scalability & costs
- Use managed vector DB & LLM APIs where possible for scale; if costs too high, evaluate self-hosted LLMs + open-source embedding models.
- Use asynchronous job queues for ingestion and heavy tasks; keep query path low-latency.

10) Example deployment (dev)
- docker-compose: postgres + redis + pgvector + backend + frontend
- For production, move to Kubernetes with horizontal autoscaling, managed PG, and managed vector DB.

Diagrams
- See repository's /docs/diagrams (suggest adding PlantUML or draw.io files) for sequence diagrams: Ingestion flow, Query/RAG flow, Escalation flow.
