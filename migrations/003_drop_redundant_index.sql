-- No-op: The redundant idx_interviews_workflow_id index was removed from 001_initial_schema.sql.
-- This migration is kept for compatibility with databases that already applied it.
DROP INDEX IF EXISTS idx_interviews_workflow_id;
