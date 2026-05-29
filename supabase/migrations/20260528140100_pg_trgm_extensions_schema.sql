-- Security Advisor: extension_in_public — move pg_trgm out of public.
-- GIN indexes on books/people keep gin_trgm_ops; config.toml already lists extensions in search_path.

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
