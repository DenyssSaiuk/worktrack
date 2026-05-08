-- WorkTrack — TimescaleDB setup
-- Run after `prisma migrate deploy` against the production/dev database.
-- For local dev the docker-compose Postgres image already loads the
-- timescaledb extension; this script promotes ActivityEvent to a hypertable
-- and enables retention and compression policies.

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

SELECT create_hypertable(
  '"ActivityEvent"',
  'timestamp',
  if_not_exists => TRUE,
  migrate_data  => TRUE
);

-- Default 90-day retention; the daily aggregation worker keeps daily summaries.
SELECT add_retention_policy(
  '"ActivityEvent"',
  INTERVAL '90 days',
  if_not_exists => TRUE
);

-- Compress chunks older than 7 days to save space.
ALTER TABLE "ActivityEvent" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"sessionId"',
  timescaledb.compress_orderby   = '"timestamp" DESC'
);

SELECT add_compression_policy(
  '"ActivityEvent"',
  INTERVAL '7 days',
  if_not_exists => TRUE
);
