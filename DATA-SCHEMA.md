# ClientServiceBot — Detailed Data Schema (Postgres + PGVector)

This file provides a detailed relational schema for the core application data, recommended indexes, vector column setup for PGVector, materialized views for KPIs, sample SQL snippets for common metrics, and guidance for retention/partitioning.

Notes
- Replace EMBEDDING_DIM with the dimension of your embedding model (e.g., 1536).
- Use Postgres + pgvector (CREATE EXTENSION IF NOT EXISTS vector).
- Use JSONB for flexible metadata and to support later schema changes.
- Add appropriate RBAC and column-level encryption for PII fields.

-- Setup
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

Variables
- EMBEDDING_DIM = 1536

DDL (core tables)

```sql
-- Documents and chunks (vector store metadata)
CREATE TABLE docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_url text,
  uploaded_by uuid, -- users.id
  uploaded_at timestamptz DEFAULT now(),
  doc_type text, -- docx/pdf/page
  raw_text text, -- optional, for audit
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid REFERENCES docs(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  chunk_html text, -- optional
  page_num int,
  section text,
  position int, -- order within doc
  token_count int,
  metadata jsonb DEFAULT '{}'::jsonb, -- { toc: "...", headings: ["..."], original_pos: "p15" }
  embedding vector(EMBEDDING_DIM),
  created_at timestamptz DEFAULT now()
);

-- Create an index for fast cosine search (pgvector)
-- Example for ivfflat -- requires training for large datasets
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full text index for fallback
CREATE INDEX doc_chunks_text_idx ON doc_chunks USING gin (to_tsvector('english', chunk_text));

-- Users and roles
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text,
  email text UNIQUE,
  role text NOT NULL CHECK (role IN ('admin','executive','technical','client_service','client','ingest_bot')),
  org_unit text,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb -- e.g., device prefs, permissions
);

-- Sessions and messages (conversations)
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  external_client_id text, -- billing system or TIN for a client
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL CHECK (status IN ('active','complete','incomplete','escalated','timed_out')),
  assigned_agent uuid REFERENCES users(id),
  category text, -- top-level category tag derived from classifier (e.g., "Registration","Payments")
  intent text,
  device_type text,
  location jsonb, -- {country, region, city, geoip_source}
  nps_score int, -- nullable - set after session ends if user responds
  qoe_score numeric, -- cached QoE for session
  confidence_score numeric, -- aggregated confidence from LLMs
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX sessions_started_at_idx ON sessions (started_at);
CREATE INDEX sessions_status_idx ON sessions (status);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  sender text CHECK (sender IN ('user','bot','agent','system')) NOT NULL,
  text text,
  llm_response jsonb, -- raw LLM output + tokens + model + latency + sources
  sentiment jsonb, -- {score: -1..1, label: 'negative'|'neutral'|'positive'}
  risk_flags jsonb, -- {legal: true, tax: false, personal_data: true}
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX messages_session_idx ON messages (session_id);

-- Escalations / Ticketing
CREATE TABLE escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_team text, -- 'technical'|'client_service' etc.
  priority text CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
  status text CHECK (status IN ('open','in_progress','resolved','closed','cancelled')) DEFAULT 'open',
  external_ticket_id text, -- Touchpoint ticket ref
  summary text,
  details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX escalations_status_idx ON escalations (status);
CREATE INDEX escalations_owner_idx ON escalations (owner_team);

-- Feedback & NPS
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id),
  user_id uuid REFERENCES users(id),
  nps_score int CHECK (nps_score BETWEEN 0 AND 10),
  rating int CHECK (rating BETWEEN 1 AND 5),
  comments text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Events for analytics (append-only)
CREATE TABLE events (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_type text NOT NULL, -- e.g., message_received, ingestion_completed, llm_call
  session_id uuid,
  user_id uuid,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX events_created_at_idx ON events (created_at);

-- Alerts / Rules engine
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule jsonb NOT NULL, -- serialized rule definition
  severity text CHECK (severity IN ('info','warning','critical')) DEFAULT 'warning',
  triggered_at timestamptz,
  resolved_at timestamptz,
  payload jsonb,
  status text CHECK (status IN ('triggered','acknowledged','resolved')) DEFAULT 'triggered',
  created_by uuid REFERENCES users(id),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for frequent aggregations
CREATE INDEX idx_sessions_started_day ON sessions ((date_trunc('day', started_at)));
CREATE INDEX idx_feedback_created_day ON feedback ((date_trunc('day', created_at)));
```

Materialized views / aggregated tables (examples)
- sessions_daily_metrics (used by exec dashboard)
- category_daily_counts

```sql
-- daily session counts by status & category
CREATE MATERIALIZED VIEW mv_sessions_daily AS
SELECT
  date_trunc('day', started_at)::date AS day,
  category,
  status,
  count(*) AS sessions_count,
  avg((metadata->>'avg_llm_latency')::numeric) AS avg_llm_latency,
  avg(qoe_score) AS avg_qoe
FROM sessions
GROUP BY 1,2,3
WITH DATA;

-- refresh daily or via triggers
CREATE INDEX mv_sessions_daily_idx ON mv_sessions_daily (day, category, status);
```

QoE examples (stored procedure / view)
- QoE formula (example weights: technical 0.5, interaction 0.5):

Technical KPI components (derived):
- latency_score = 1 - min(1, avg_latency_ms / SLA_MS)
- error_rate_score = 1 - error_rate (0..1)
Interaction components:
- resolution_rate = resolved_sessions / total_sessions
- sentiment_score = normalized average sentiment (-1..1 -> 0..1)

Example SQL to compute QoE (simplified):

```sql
WITH agg AS (
  SELECT
    date_trunc('day', started_at)::date AS day,
    count(*) FILTER (WHERE status = 'complete')::numeric / NULLIF(count(*),0) AS resolution_rate,
    avg((metadata->>'avg_llm_latency')::numeric) AS avg_latency_ms,
    avg((SELECT (m->>'score')::numeric FROM jsonb_array_elements((SELECT jsonb_agg(sentiment) FROM messages WHERE messages.session_id = sessions.id)) m)) AS avg_sentiment -- simplified
  FROM sessions
  GROUP BY 1
)
SELECT
  day,
  ((0.5 * (1 - LEAST(1, avg_latency_ms / 1000))) + (0.5 * ((resolution_rate + ((avg_sentiment + 1) / 2)) / 2))) AS qoe_estimate
FROM agg;
```

Example queries used by dashboards
- Total queries per day (executive):

```sql
SELECT date_trunc('day', started_at)::date AS day, count(*) AS queries
FROM sessions
WHERE started_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
```

- Cumulative month-to-date:

```sql
SELECT count(*) FROM sessions
WHERE date_trunc('month', started_at) = date_trunc('month', now());
```

- Financial year cumulative (assumes FY starts July 1):

```sql
SELECT count(*) FROM sessions
WHERE started_at >= (CASE WHEN extract(month from now()) >= 7
                           THEN make_date(extract(year from now())::int, 7, 1)
                           ELSE make_date(extract(year from now())::int - 1, 7, 1) END);
```

- Most asked category (top 10):

```sql
SELECT category, count(*) as cnt
FROM sessions
WHERE started_at >= now() - interval '30 days'
GROUP BY category
ORDER BY cnt DESC
LIMIT 10;
```

- Locations & devices breakdown:

```sql
SELECT location->>'country' as country, device_type, count(*) AS cnt
FROM sessions
WHERE location IS NOT NULL
GROUP BY 1,2
ORDER BY cnt DESC
LIMIT 50;
```

- NPS summary:

```sql
SELECT
  sum(CASE WHEN nps_score BETWEEN 9 AND 10 THEN 1 ELSE 0 END) AS promoters,
  sum(CASE WHEN nps_score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) AS passives,
  sum(CASE WHEN nps_score BETWEEN 0 AND 6 THEN 1 ELSE 0 END) AS detractors,
  count(*) AS total,
  ( (promoters::numeric - detractors::numeric) / NULLIF(total,0) ) * 100 AS nps_percent
FROM feedback;
```

Event-driven metrics & sampling
- Log LLM calls (model, latency, tokens_in/out) to events for spike detection and cost accounting.
- Use message-level sampling (e.g., 1% of messages store full LLM transcript) to limit storage costs.

Retention & partitioning
- Partition messages/events by time (monthly) for large datasets.
- Retain raw embeddings and full_text for a configurable retention period (e.g., 3–7 years depending on policy).
- Anonymize or redact PII at ingest if required.

Appendix: Example JSON shape for API responses (for dashboards)

- Executive KPI endpoint: GET /api/v1/dashboards/executive?from=2025-11-01&to=2025-11-30

```json
{
  "kpis": {
    "queries_today": 1245,
    "queries_mtd": 24357,
    "queries_fy": 123456,
    "avg_qoe": 0.78,
    "nps": 34
  },
  "timeseries": {
    "queries": [{"date":"2025-11-01","count":1200}, ...],
    "qoe": [{"date":"2025-11-01","value":0.77}, ...]
  },
  "top_categories": [{"category":"Payments","count":2345},{"category":"Registration","count":1987}],
  "top_locations": [{"country":"UG","region":"Kampala","count":1234}],
  "device_breakdown": [{"device":"mobile","count":800},{"device":"desktop","count":445}]
}
```

Guidance: indexes & performance
- Use ivfflat index for vector similarity when > 10k vectors; choose lists (nlist) based on dataset size and run `pgvector` training.
- Keep token_count stored to choose chunk size distribution.
- Use materialized views for expensive aggregates and refresh them frequently (or update incrementally with triggers).
- Use read replicas for heavy reporting queries.

Security & privacy
- Store PII encrypted using pgcrypto or column-level encryption.
- Ensure audit logs for reads of doc_chunks and messages.
- Provide a process to redact or delete user data (right-to-be-forgotten).
