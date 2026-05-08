-- Loaded once on first container boot via /docker-entrypoint-initdb.d.
-- Enables TimescaleDB; the hypertable + retention/compression policies are
-- created by packages/database/prisma/migrations/manual/timescale.sql after
-- Prisma migrations run.

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
