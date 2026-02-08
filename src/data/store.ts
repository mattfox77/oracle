/**
 * Oracle Data Store - Database operations for Oracle
 */

import { Pool, PoolConfig } from 'pg';
import { loggers } from 'the-machina';

export interface OracleDataStoreConfig {
  db: PoolConfig;
}

export class OracleDataStore {
  private pool: Pool | null = null;

  async connect(config: OracleDataStoreConfig): Promise<void> {
    this.pool = new Pool(config.db);

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      loggers.data.info('Database connected');
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.query(text, params);
  }

  // Interview persistence
  async saveInterview(workflowId: string, state: any): Promise<void> {
    await this.query(`
      INSERT INTO interviews (workflow_id, agent_id, domain, objective, constraints, phase, exchanges, context_document, recommendations, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (workflow_id)
      DO UPDATE SET
        phase = EXCLUDED.phase,
        exchanges = EXCLUDED.exchanges,
        context_document = EXCLUDED.context_document,
        recommendations = EXCLUDED.recommendations,
        updated_at = NOW(),
        completed_at = CASE WHEN EXCLUDED.phase = 'complete' THEN NOW() ELSE interviews.completed_at END
    `, [
      workflowId,
      state.sentinelId || 'oracle',
      state.domain,
      state.objective,
      state.constraints || null,
      state.phase,
      JSON.stringify(state.exchanges || []),
      state.contextDocument ? JSON.stringify(state.contextDocument) : null,
      state.recommendations ? JSON.stringify(state.recommendations) : null
    ]);
  }

  async getInterview(workflowId: string): Promise<any | null> {
    const result = await this.query(
      'SELECT * FROM interviews WHERE workflow_id = $1',
      [workflowId]
    );
    return result.rows[0] || null;
  }

  async listInterviews(limit: number = 100): Promise<any[]> {
    const result = await this.query(
      'SELECT * FROM interviews ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  // Issue creation (for maintenance-request interviews)
  async createIssue(tenantId: string, description: string, priority: string): Promise<number> {
    const result = await this.query(
      `INSERT INTO issues (tenant_id, description, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, description, priority, 'open', new Date()]
    );
    return result.rows[0].id;
  }
}
