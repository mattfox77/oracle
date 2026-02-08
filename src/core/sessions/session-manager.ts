/**
 * Oracle Core - Session Manager
 *
 * Framework-agnostic session management implementation
 */

import { v4 as uuidv4 } from 'uuid';
import {
  InterviewSession,
  CreateSessionParams,
  SessionFilters,
  ISessionManager,
  ISessionStorage
} from './types';
import { isValidInterviewType } from '../types/index';

export class SessionManager implements ISessionManager {
  constructor(private storage: ISessionStorage) {}

  async createSession(params: CreateSessionParams): Promise<InterviewSession> {
    // Validate interview type
    if (!isValidInterviewType(params.interviewType)) {
      throw new Error(`Invalid interview type: ${params.interviewType}`);
    }

    const now = new Date();
    const session: InterviewSession = {
      id: uuidv4(),
      userId: params.userId,
      interviewType: params.interviewType,
      status: 'active',
      currentStep: 0,
      responses: {},
      contextData: params.initialContext || {},
      createdAt: now,
      updatedAt: now
    };

    await this.storage.save(session);
    return session;
  }

  async getSession(sessionId: string): Promise<InterviewSession | null> {
    return await this.storage.load(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<InterviewSession>): Promise<InterviewSession> {
    const session = await this.storage.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge updates
    const updatedSession: InterviewSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    // If completing the session, set completedAt
    if (updates.status === 'completed' && !session.completedAt) {
      updatedSession.completedAt = new Date();
    }

    await this.storage.save(updatedSession);
    return updatedSession;
  }

  async listSessions(filters?: SessionFilters): Promise<InterviewSession[]> {
    return await this.storage.list(filters);
  }

  async pauseSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.storage.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status === 'completed') {
      throw new Error(`Cannot pause completed session: ${sessionId}`);
    }

    return await this.updateSession(sessionId, { status: 'paused' });
  }

  async resumeSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.storage.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status === 'completed') {
      throw new Error(`Cannot resume completed session: ${sessionId}`);
    }

    return await this.updateSession(sessionId, { status: 'active' });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.storage.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.storage.delete(sessionId);
  }
}