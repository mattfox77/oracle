/**
 * PostgreSQL Session Storage
 *
 * Persistent ISessionStorage implementation backed by PostgreSQL.
 */

import { Pool } from 'pg';
import {
  ISessionStorage,
  InterviewSession,
  SessionFilters
} from '../core/sessions/types';

export class PostgresSessionStorage implements ISessionStorage {
  constructor(private pool: Pool) {}

  async save(session: InterviewSession): Promise<void> {
    await this.pool.query(`
      INSERT INTO sessions (id, user_id, interview_type, status, current_step, responses, context_data, created_at, updated_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id)
      DO UPDATE SET
        status = EXCLUDED.status,
        current_step = EXCLUDED.current_step,
        responses = EXCLUDED.responses,
        context_data = EXCLUDED.context_data,
        updated_at = EXCLUDED.updated_at,
        completed_at = EXCLUDED.completed_at
    `, [
      session.id,
      session.userId,
      session.interviewType,
      session.status,
      session.currentStep,
      JSON.stringify(session.responses),
      JSON.stringify(session.contextData),
      session.createdAt,
      session.updatedAt,
      session.completedAt || null,
    ]);
  }

  async load(sessionId: string): Promise<InterviewSession | null> {
    const result = await this.pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToSession(result.rows[0]);
  }

  async list(filters?: SessionFilters): Promise<InterviewSession[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(filters.userId);
      }
      if (filters.interviewType) {
        conditions.push(`interview_type = $${paramIndex++}`);
        params.push(filters.interviewType);
      }
      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }
      if (filters.createdAfter) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.createdAfter);
      }
      if (filters.createdBefore) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.createdBefore);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let sql = `SELECT * FROM sessions ${where} ORDER BY created_at DESC`;

    if (filters?.limit != null && filters.limit > 0) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    if (filters?.offset != null && filters.offset > 0) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.pool.query(sql, params);

    return result.rows.map(row => this.rowToSession(row));
  }

  async delete(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  private rowToSession(row: any): InterviewSession {
    return {
      id: row.id,
      userId: row.user_id,
      interviewType: row.interview_type,
      status: row.status,
      currentStep: row.current_step,
      responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses,
      contextData: typeof row.context_data === 'string' ? JSON.parse(row.context_data) : row.context_data,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}
