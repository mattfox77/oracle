-- Drop redundant index on workflow_id
-- The UNIQUE constraint on interviews.workflow_id already creates an implicit index.
DROP INDEX IF EXISTS idx_interviews_workflow_id;
