-- Oracle Database Initialization Script
-- This runs automatically when the PostgreSQL container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL UNIQUE,
    agent_id VARCHAR(50) NOT NULL DEFAULT 'oracle',
    domain TEXT NOT NULL,
    objective TEXT NOT NULL,
    constraints TEXT,
    phase VARCHAR(20) NOT NULL CHECK (phase IN ('prime', 'interview', 'synthesize', 'recommend', 'complete')),
    exchanges JSONB DEFAULT '[]',
    context_document JSONB,
    recommendations JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_interviews_workflow_id ON interviews(workflow_id);
CREATE INDEX IF NOT EXISTS idx_interviews_agent_id ON interviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_interviews_phase ON interviews(phase);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);

-- Create issues table (for maintenance-request integration)
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'routine',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issues_tenant_id ON issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Oracle database initialized successfully';
END $$;
