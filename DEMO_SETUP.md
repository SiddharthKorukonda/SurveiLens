# SurveiLens Demo Setup Guide

Complete setup guide for running the SurveiLens demo with Vultr hosting, CV Event API, and Snowflake analytics.

## Architecture

```
CV Detection Workers → CV Event API (Vultr) → Snowflake
                              ↓
                         Web UI (Vultr) → Queries Snowflake for dashboards
```

## Quick Start

### 1. Setup Snowflake

1. **Create Snowflake Account** (if needed):
   - Sign up at https://signup.snowflake.com
   - Choose your region and edition

2. **Run Schema SQL**:
   ```bash
   # Connect to Snowflake
   snowsql -a YOUR_ACCOUNT -u YOUR_USER

   # Run schema
   !source sql/snowflake_schema.sql
   ```

3. **Verify Tables**:
   ```sql
   USE DATABASE SURVEILENS;
   USE SCHEMA CORE;
   SHOW TABLES;
   SELECT COUNT(*) FROM CV_EVENTS;
   ```

### 2. Deploy CV Event API to Vultr

#### Option A: Vultr App Platform (Easiest)

1. **Create App**:
   - Go to Vultr Dashboard → App Platform
   - Click "Create App"
   - Choose "Python"
   - Connect your GitHub repository

2. **Configure**:
   - **Name**: `surveilens-cv-api`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python backend/cv_event_api.py`
   - **Port**: `8001`

3. **Environment Variables**:
   ```env
   CV_API_PORT=8001
   SNOW_ACCOUNT=your_account
   SNOW_USER=your_user
   SNOW_PASS=your_password
   SNOW_WH=COMPUTE_WH
   SNOW_DB=SURVEILENS
   SNOW_SCHEMA=CORE
   DEMO_MODE=false
   ```

4. **Deploy**: Click "Deploy"

#### Option B: Vultr VPS

See `VULTR_DEPLOYMENT.md` for detailed VPS setup instructions.

### 3. Deploy Web UI to Vultr

1. **Create App**:
   - Go to Vultr Dashboard → App Platform
   - Click "Create App"
   - Choose "Static Site"
   - Connect your GitHub repository

2. **Configure**:
   - **Name**: `surveilens-web`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Node Version**: 18.x

3. **Environment Variables**:
   ```env
   VITE_AUTH0_DOMAIN=your_auth0_domain
   VITE_AUTH0_CLIENT_ID=your_client_id
   VITE_AUTH0_AUDIENCE=https://surveilens/api
   VITE_BACKEND_BASE_URL=https://your-cv-api-url.vultr.app
   ```

4. **Deploy**: Click "Deploy"

### 4. Configure CV Workers

Update your CV workers to send events to the Vultr API:

```bash
# Set CV_API_URL environment variable
export CV_API_URL=https://your-api-url.vultr.app/api/cv/event

# Or in your .env file
CV_API_URL=https://your-api-url.vultr.app/api/cv/event
```

### 5. Test the Setup

#### Test CV Event API

```bash
# Health check
curl https://your-api-url.vultr.app/health

# Send test event
curl -X POST https://your-api-url.vultr.app/api/cv/event \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-123",
    "site_id": "site-01",
    "camera_id": "cam-01",
    "timestamp": 1234567890.0,
    "danger_level": "HIGH",
    "danger_score": 0.85,
    "gemini_json": {
      "people_count": 2,
      "weapons_detected": ["knife"],
      "actions_detected": ["punching"]
    },
    "transcript": "Help me!",
    "snapshot_files": []
  }'
```

#### Verify in Snowflake

```sql
-- Check events were inserted
SELECT COUNT(*) FROM CORE.CV_EVENTS;

-- View recent events
SELECT * FROM ANALYTICS.CV_EVENTS_DASHBOARD 
ORDER BY event_timestamp DESC 
LIMIT 10;

-- Check high-danger events
SELECT * FROM ANALYTICS.CV_HIGH_DANGER_EVENTS 
LIMIT 10;
```

### 6. Create Dashboards in Snowflake

#### Option A: Snowflake Dashboard (Native)

1. **Go to Snowflake Dashboard**:
   - Log into Snowflake
   - Go to "Dashboards" section
   - Click "Create Dashboard"

2. **Add Queries**:
   - Use queries from `sql/dashboard_queries.sql`
   - Create visualizations for:
     - Recent high-danger events
     - Danger level distribution
     - Events by site and camera
     - Hourly event trends

#### Option B: Tableau/Power BI

1. **Connect to Snowflake**:
   - Use Snowflake connector
   - Use your Snowflake credentials
   - Connect to `SURVEILENS.CORE` database

2. **Create Dashboards**:
   - Use views from `ANALYTICS` schema
   - Create visualizations using queries from `sql/dashboard_queries.sql`

#### Option C: Custom Dashboard (Web UI)

1. **Add Snowflake Query Endpoint**:
   - Create API endpoint to query Snowflake
   - Use `snowflake_io.py` as reference
   - Add authentication

2. **Create Dashboard Components**:
   - Use React components to display data
   - Query Snowflake via API
   - Display charts and graphs

### 7. Run Dashboard Queries

Use the queries from `sql/dashboard_queries.sql`:

```sql
-- 1. Recent High-Danger Events (Last 24 Hours)
SELECT * FROM ANALYTICS.CV_HIGH_DANGER_EVENTS;

-- 2. Danger Level Distribution (Last 7 Days)
SELECT 
  danger_level,
  COUNT(*) AS event_count,
  AVG(danger_score) AS avg_danger_score
FROM CORE.CV_EVENTS
WHERE event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY danger_level;

-- 3. Events by Site and Camera (Last 24 Hours)
SELECT 
  site_id,
  camera_id,
  COUNT(*) AS total_events,
  SUM(CASE WHEN danger_level IN ('HIGH', 'MEDIUM', 'MED') THEN 1 ELSE 0 END) AS high_danger_events,
  AVG(danger_score) AS avg_danger_score
FROM CORE.CV_EVENTS
WHERE event_timestamp >= DATEADD('hour', -24, CURRENT_TIMESTAMP())
GROUP BY site_id, camera_id;

-- 4. Hourly Event Trends (Last 7 Days)
SELECT 
  DATE_TRUNC('hour', event_timestamp) AS hour,
  danger_level,
  COUNT(*) AS event_count,
  AVG(danger_score) AS avg_danger_score
FROM CORE.CV_EVENTS
WHERE event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY hour, danger_level
ORDER BY hour DESC;
```

## Demo Scenarios

### Scenario 1: Real-time Event Ingestion

1. **Start CV Worker**:
   ```bash
   python scripts/start_cv_worker.py
   ```

2. **Monitor Events**:
   - Check API logs: `curl https://your-api-url.vultr.app/health`
   - Query Snowflake: `SELECT COUNT(*) FROM CORE.CV_EVENTS;`
   - View dashboard: Open Snowflake dashboard

### Scenario 2: Historical Analysis

1. **Query Historical Data**:
   ```sql
   -- Last 7 days of events
   SELECT * FROM ANALYTICS.CV_EVENTS_DASHBOARD
   WHERE event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
   ORDER BY event_timestamp DESC;
   ```

2. **Analyze Trends**:
   ```sql
   -- Hourly trends
   SELECT * FROM ANALYTICS.CV_HOURLY_STATS
   ORDER BY hour DESC;
   ```

3. **Identify Patterns**:
   ```sql
   -- Top dangerous cameras
   SELECT * FROM ANALYTICS.CV_DANGER_SUMMARY
   ORDER BY event_count DESC;
   ```

### Scenario 3: Join with Other Tables

1. **Join with INFERENCES**:
   ```sql
   SELECT 
     cv.event_id,
     cv.danger_level,
     inf.alert_id,
     inf.confidence
   FROM CORE.CV_EVENTS cv
   LEFT JOIN CORE.INFERENCES inf ON cv.event_id = inf.alert_id
   WHERE cv.event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP());
   ```

2. **Join with ACTIONS**:
   ```sql
   SELECT 
     cv.event_id,
     cv.danger_level,
     act.action_type,
     act.actor_user
   FROM CORE.CV_EVENTS cv
   LEFT JOIN AUDIT.ACTIONS act ON cv.event_id = act.alert_id
   WHERE cv.event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP());
   ```

## Troubleshooting

### CV Events Not Appearing in Snowflake

1. **Check API Logs**:
   ```bash
   # Vultr App Platform
   # Go to App → Logs
   # Check for errors
   ```

2. **Verify Snowflake Connection**:
   ```sql
   -- Test connection
   SELECT CURRENT_USER(), CURRENT_DATABASE(), CURRENT_SCHEMA();
   ```

3. **Check Table Permissions**:
   ```sql
   -- Verify you can insert
   INSERT INTO CORE.CV_EVENTS (event_id, site_id, camera_id, event_timestamp, danger_level, danger_score, people_count, weapons_detected, actions_detected, transcript, gemini_analysis, snapshot_files, audio_clip)
   VALUES ('test-123', 'site-01', 'cam-01', CURRENT_TIMESTAMP(), 'LOW', 0.1, 0, PARSE_JSON('[]'), PARSE_JSON('[]'), '', PARSE_JSON('{}'), PARSE_JSON('[]'), '');
   ```

### API Not Receiving Events

1. **Check CV_API_URL**:
   ```bash
   echo $CV_API_URL
   # Should be: https://your-api-url.vultr.app/api/cv/event
   ```

2. **Test API Endpoint**:
   ```bash
   curl -X POST https://your-api-url.vultr.app/api/cv/event \
     -H "Content-Type: application/json" \
     -d '{"event_id":"test","site_id":"site-01","camera_id":"cam-01","timestamp":1234567890.0,"danger_level":"LOW","danger_score":0.1,"gemini_json":{}}'
   ```

3. **Check Firewall Rules**:
   - Ensure port 443 (HTTPS) is open
   - Check Vultr firewall settings

### Dashboard Not Loading

1. **Check Snowflake Connection**:
   - Verify credentials
   - Check network policy
   - Test query execution

2. **Verify Views Exist**:
   ```sql
   SHOW VIEWS IN SCHEMA ANALYTICS;
   ```

3. **Check Query Performance**:
   - Use `EXPLAIN` to analyze queries
   - Check warehouse size
   - Optimize clustering keys

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

## Next Steps

1. **Add Monitoring**: Setup alerts for API errors
2. **Optimize Queries**: Add clustering and indexes
3. **Scale**: Plan for horizontal scaling
4. **Security**: Add API authentication
5. **Backup**: Setup Snowflake backups

## Support

For issues or questions:
1. Check logs in Vultr dashboard
2. Query Snowflake for data verification
3. Test API endpoints with curl
4. Review `VULTR_DEPLOYMENT.md` for detailed setup

