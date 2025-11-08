CREATE DATABASE IF NOT EXISTS SURVEILENS;
CREATE SCHEMA IF NOT EXISTS CORE;
CREATE SCHEMA IF NOT EXISTS AUDIT;
CREATE SCHEMA IF NOT EXISTS ANALYTICS;

CREATE TABLE IF NOT EXISTS CORE.CAMERAS(
  site_id STRING,
  camera_id STRING,
  zone STRING,
  lat FLOAT, lon FLOAT,
  status STRING,
  PRIMARY KEY(site_id, camera_id)
);

CREATE TABLE IF NOT EXISTS CORE.OBSERVATIONS(
  site_id STRING,
  camera_id STRING,
  window_start TIMESTAMP_NTZ,
  window_end TIMESTAMP_NTZ,
  transcript_json VARIANT,
  clip_key STRING,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY(site_id, camera_id, window_start);

CREATE TABLE IF NOT EXISTS CORE.INFERENCES(
  alert_id STRING,
  site_id STRING,
  camera_id STRING,
  window_start TIMESTAMP_NTZ,
  window_end TIMESTAMP_NTZ,
  danger_level STRING,
  danger_score FLOAT,
  confidence FLOAT,
  reason STRING,
  policy VARIANT,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS CORE.TRACKS(
  site_id STRING,
  global_id STRING,
  camera_id STRING,
  t_start TIMESTAMP_NTZ,
  t_end TIMESTAMP_NTZ,
  features VARIANT
);

CREATE TABLE IF NOT EXISTS AUDIT.ACTIONS(
  action_id STRING,
  alert_id STRING,
  site_id STRING,
  camera_id STRING,
  action_type STRING,
  actor_user STRING,
  notes STRING,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS AUDIT.AUDIT_LOG(
  audit_id STRING,
  alert_id STRING,
  site_id STRING,
  hash_fingerprint STRING,
  solana_tx_id STRING,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE MATERIALIZED VIEW ANALYTICS.LATEST_BY_CAMERA AS
SELECT site_id, camera_id, MAX_BY(transcript_json, created_at) AS last_transcript, MAX(created_at) AS last_seen
FROM CORE.OBSERVATIONS
GROUP BY site_id, camera_id;
