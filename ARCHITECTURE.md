# SurveiLens Architecture

## Overview

SurveiLens is a security monitoring system that uses computer vision (CV) to detect threats in real-time, stores events in Snowflake for analytics, and provides a web UI for visualization and management.

## Architecture Diagram

```
┌─────────────────┐
│  CV Workers     │  (Run on edge devices or servers)
│  - Video Capture│
│  - Audio Record │
│  - Gemini AI    │
│  - Threat Detect│
└────────┬────────┘
         │
         │ HTTP POST (JSON)
         ▼
┌─────────────────┐
│  CV Event API   │  (Vultr - Lightweight API)
│  - Validate     │
│  - Forward      │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌──────────────┐
│   Snowflake     │  │   Redis      │
│   - Store Events│  │   - Pub/Sub  │
│   - Analytics   │  │   - Real-time│
│   - Dashboards  │  │     Alerts   │
└────────┬────────┘  └──────┬───────┘
         │                  │
         │                  │
         ▼                  ▼
┌─────────────────────────────┐
│      Web UI (Vultr)         │
│  - Auth0 Authentication     │
│  - Real-time Alerts (SSE)   │
│  - Dashboards (Snowflake)   │
│  - Query & Analysis         │
└─────────────────────────────┘
```

## Components

### 1. CV Workers

**Location**: Edge devices or servers
**Purpose**: Continuous threat detection

**Responsibilities**:
- Capture video from cameras (RTSP/webcam)
- Record audio in 10-second batches
- Take snapshots at 4s and 8s intervals
- Transcribe audio using ElevenLabs STT
- Analyze threats using Gemini AI
- Send events to CV Event API

**Technology**:
- Python 3.11
- OpenCV (video capture)
- SoundDevice (audio recording)
- ElevenLabs API (speech-to-text)
- Google Gemini API (threat analysis)

### 2. CV Event API

**Location**: Vultr (App Platform or VPS)
**Purpose**: Receive, validate, and forward CV events to Snowflake

**Responsibilities**:
- Receive JSON events from CV workers
- Validate event structure and data
- Insert events into Snowflake
- Handle errors and retries
- Provide health check endpoint

**Endpoints**:
- `POST /api/cv/event` - Single event
- `POST /api/cv/events/batch` - Batch events
- `GET /health` - Health check

**Technology**:
- Python 3.11
- Flask (lightweight web framework)
- Snowflake Connector (database)
- Flask-CORS (CORS support)

### 3. Snowflake

**Location**: Cloud (Snowflake)
**Purpose**: Data warehouse for events and analytics

**Schema**:
- `CORE.CV_EVENTS` - Raw CV detection events
- `CORE.INFERENCES` - Processed alerts
- `CORE.OBSERVATIONS` - Audio/video observations
- `AUDIT.ACTIONS` - User actions on alerts
- `ANALYTICS.*` - Dashboard views

**Views**:
- `ANALYTICS.CV_EVENTS_DASHBOARD` - Main dashboard view
- `ANALYTICS.CV_DANGER_SUMMARY` - Danger level summary
- `ANALYTICS.CV_HOURLY_STATS` - Hourly aggregation
- `ANALYTICS.CV_HIGH_DANGER_EVENTS` - Recent high-danger events

### 4. Redis

**Location**: Local or cloud
**Purpose**: Real-time event distribution

**Responsibilities**:
- Pub/Sub for real-time alerts
- Channel: `events:{site_id}`
- Frontend subscribes via SSE

### 5. Web UI

**Location**: Vultr (App Platform or Static Site)
**Purpose**: User interface for monitoring and management

**Features**:
- Auth0 authentication
- Real-time alerts (SSE from Redis)
- Dashboards (queries Snowflake)
- Alert management
- Policy configuration

**Technology**:
- React + TypeScript
- Vite (build tool)
- Auth0 React SDK
- Server-Sent Events (SSE)
- Snowflake queries (via API)

## Data Flow

### 1. Event Ingestion

```
CV Worker → CV Event API → Snowflake
```

1. CV worker detects threat
2. Creates event JSON with:
   - Event ID, site ID, camera ID
   - Timestamp, danger level, danger score
   - Gemini analysis (people count, weapons, actions)
   - Transcript, snapshots, audio clip
3. Sends to CV Event API via HTTP POST
4. API validates event
5. API inserts into Snowflake `CORE.CV_EVENTS` table

### 2. Real-time Alerts

```
CV Worker → Redis → Web UI (SSE)
```

1. CV worker detects HIGH/MEDIUM danger
2. Publishes alert to Redis channel `events:{site_id}`
3. Web UI subscribes via Server-Sent Events (SSE)
4. Alert appears as notification in UI

### 3. Dashboard Queries

```
Web UI → Snowflake API → Snowflake → Results
```

1. User opens dashboard in Web UI
2. UI queries Snowflake via API
3. Snowflake executes query on `ANALYTICS` views
4. Results returned to UI
5. UI displays charts and graphs

## Security

### Authentication

- **Web UI**: Auth0 (OAuth 2.0)
- **CV Event API**: API key (optional, can be added)
- **Snowflake**: Username/password or key pair

### Authorization

- **Web UI**: Auth0 roles and permissions
- **Snowflake**: Role-based access control (RBAC)

### Data Protection

- **In Transit**: HTTPS/TLS for all API calls
- **At Rest**: Snowflake encryption
- **API Keys**: Stored in environment variables

## Scalability

### Horizontal Scaling

- **CV Workers**: Can run on multiple devices/servers
- **CV Event API**: Can scale horizontally (load balancer)
- **Snowflake**: Auto-scales compute resources
- **Web UI**: Static site, can use CDN

### Performance

- **Event Ingestion**: ~100-1000 events/second (depends on API)
- **Snowflake**: Handles millions of events
- **Real-time Alerts**: Sub-second latency (Redis)
- **Dashboard Queries**: Seconds to minutes (depends on data size)

## Monitoring

### Metrics

- **CV Event API**: Request count, error rate, latency
- **Snowflake**: Query performance, storage usage
- **CV Workers**: Detection rate, error rate
- **Web UI**: Page load time, error rate

### Logging

- **CV Event API**: Application logs (Vultr)
- **Snowflake**: Query logs, audit logs
- **CV Workers**: Detection logs, error logs

## Deployment

### Vultr App Platform (Recommended)

- **CV Event API**: Python app on App Platform
- **Web UI**: Static site on App Platform
- **Benefits**: Easy deployment, auto-scaling, SSL

### Vultr VPS (More Control)

- **CV Event API**: Flask app on VPS
- **Web UI**: Nginx static site on VPS
- **Benefits**: Full control, custom configuration

### Docker (Advanced)

- **CV Event API**: Docker container
- **Web UI**: Docker container
- **Benefits**: Containerization, easy deployment

## Cost Estimation

### Vultr
- **CV API**: ~$12/month (App Platform Basic)
- **Web UI**: ~$6/month (Static Site)
- **Total**: ~$18/month

### Snowflake
- **Storage**: ~$40/TB/month
- **Compute**: ~$2-5 per TB scanned
- **Estimated**: ~$50-100/month (depending on usage)

### Total
- **Estimated Monthly Cost**: ~$68-118/month

## Future Enhancements

1. **API Authentication**: Add API keys for CV workers
2. **Rate Limiting**: Prevent abuse
3. **Caching**: Cache frequent queries
4. **CDN**: Add CDN for web UI
5. **Monitoring**: Add monitoring (Datadog, New Relic)
6. **Alerting**: Add alerting for errors
7. **Backup**: Setup Snowflake backups
8. **Scaling**: Plan for horizontal scaling

## Documentation

- **Setup**: `DEMO_SETUP.md`
- **Deployment**: `VULTR_DEPLOYMENT.md`
- **Dashboard Queries**: `sql/dashboard_queries.sql`
- **Snowflake Schema**: `sql/snowflake_schema.sql`

