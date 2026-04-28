-- =============================================================================
-- Recovery: add `deleted_at` to people + series
-- Filed: 2026-04-28 (Session 1.5d)
--
-- Background: 20260425160000_library_delta_v1.sql was amended after its first
-- application to prod to add `ALTER TABLE people / series ADD COLUMN
-- IF NOT EXISTS deleted_at TIMESTAMPTZ`. Supabase tracks migrations by
-- filename and skips already-applied files, so the amended SQL never ran.
-- The Authors column in /library has been blank ever since because
-- loadPeople's `.is('deleted_at', null)` filter throws 42703.
--
-- Lesson (now codified in .cursor/rules/db-changes.mdc): never edit a
-- migration file after it's been applied to prod. Write a new file with
-- idempotent guards instead.
--
-- This file is the recovery: idempotent IF NOT EXISTS so it's safe to apply
-- in the unlikely event the columns DO exist on a different environment.
-- =============================================================================

ALTER TABLE public.people  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.series  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
