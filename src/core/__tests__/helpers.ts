import { InterviewSession, ISessionStorage, SessionFilters } from '../sessions/types';

/**
 * In-memory storage for testing
 */
export class MemoryStorage implements ISessionStorage {
  private sessions: Map<string, InterviewSession> = new Map();

  async save(session: InterviewSession): Promise<void> {
    this.sessions.set(session.id, JSON.parse(JSON.stringify(session)));
  }

  async load(sessionId: string): Promise<InterviewSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const parsed = JSON.parse(JSON.stringify(session));
    parsed.createdAt = new Date(parsed.createdAt);
    parsed.updatedAt = new Date(parsed.updatedAt);
    if (parsed.completedAt) parsed.completedAt = new Date(parsed.completedAt);
    return parsed;
  }

  async list(filters?: SessionFilters): Promise<InterviewSession[]> {
    let sessions = Array.from(this.sessions.values()).map(s => {
      const parsed = JSON.parse(JSON.stringify(s));
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.updatedAt = new Date(parsed.updatedAt);
      if (parsed.completedAt) parsed.completedAt = new Date(parsed.completedAt);
      return parsed;
    });

    if (filters) {
      if (filters.userId) sessions = sessions.filter(s => s.userId === filters.userId);
      if (filters.interviewType) sessions = sessions.filter(s => s.interviewType === filters.interviewType);
      if (filters.status) sessions = sessions.filter(s => s.status === filters.status);
    }

    return sessions;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  get size() { return this.sessions.size; }
}

/**
 * Run a complete interview flow through all questions
 */
export async function completeInterview(
  sessionManager: any,
  engine: any,
  session: InterviewSession,
  answers?: Record<string, any>
): Promise<InterviewSession> {
  let current = session;
  let attempts = 0;

  while (current.status === 'active' && attempts < 20) {
    attempts++;
    const question = await engine.getNextQuestion(current);
    if (!question) break;

    let answer: any;
    if (answers && answers[question.id]) {
      answer = answers[question.id];
    } else {
      switch (question.type) {
        case 'scale': answer = '3'; break;
        case 'yes_no': answer = 'yes'; break;
        case 'multiple_choice': answer = question.options?.[0] || 'test'; break;
        case 'number': answer = 5000; break;
        case 'date': answer = '2026-03-15'; break;
        case 'multiple_select': answer = [question.options?.[0] || 'test']; break;
        default: answer = `Test answer for ${question.id}`;
      }
    }

    const sessionCopy = { ...current, responses: { ...current.responses } };
    const result = await engine.processResponse(sessionCopy, answer);

    current = await sessionManager.updateSession(current.id, {
      currentStep: sessionCopy.currentStep,
      responses: sessionCopy.responses,
      status: result.completed ? 'completed' : sessionCopy.status,
      completedAt: result.completed ? new Date() : undefined
    });

    if (result.completed) break;
  }

  return current;
}
