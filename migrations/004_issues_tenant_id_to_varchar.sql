-- Change tenant_id from INTEGER to VARCHAR to support UUID/string user IDs
ALTER TABLE issues ALTER COLUMN tenant_id TYPE VARCHAR(255) USING tenant_id::VARCHAR;
