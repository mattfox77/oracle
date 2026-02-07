import { InterviewEngine } from '../interviews/interview-engine';
import { SessionManager } from '../sessions/session-manager';
import { InterviewSession } from '../sessions/types';
import { MemoryStorage, completeInterview } from './helpers';

describe('InterviewEngine', () => {
  let engine: InterviewEngine;
  let storage: MemoryStorage;
  let manager: SessionManager;

  beforeEach(() => {
    engine = new InterviewEngine();
    storage = new MemoryStorage();
    manager = new SessionManager(storage);
  });

  async function createSession(type: string = 'general'): Promise<InterviewSession> {
    return manager.createSession({ userId: 'user-1', interviewType: type });
  }

  describe('getNextQuestion', () => {
    it('returns the first question for a new general session', async () => {
      const session = await createSession();
      const question = await engine.getNextQuestion(session);
      expect(question).not.toBeNull();
      expect(question!.id).toBe('purpose');
      expect(question!.text).toContain('What brings you here');
      expect(question!.type).toBe('text');
    });

    it('returns null when all questions answered', async () => {
      const session = await createSession();
      session.currentStep = 5; // general has 5 steps
      const question = await engine.getNextQuestion(session);
      expect(question).toBeNull();
    });

    it('throws for invalid interview type', async () => {
      const session = await createSession();
      session.interviewType = 'nonexistent';
      await expect(engine.getNextQuestion(session)).rejects.toThrow('Invalid interview type');
    });

    it('returns questions in order for tenant-screening', async () => {
      const session = await createSession('tenant-screening');
      const q1 = await engine.getNextQuestion(session);
      expect(q1!.id).toBe('contact_info');

      session.currentStep = 1;
      const q2 = await engine.getNextQuestion(session);
      expect(q2!.id).toBe('employment_status');
      expect(q2!.type).toBe('multiple_choice');
    });

    it('returns questions in order for maintenance-request', async () => {
      const session = await createSession('maintenance-request');
      const q1 = await engine.getNextQuestion(session);
      expect(q1!.id).toBe('unit_identification');

      session.currentStep = 3;
      const q4 = await engine.getNextQuestion(session);
      expect(q4!.id).toBe('urgency_level');
      expect(q4!.options).toContain('Emergency (immediate)');
    });
  });

  describe('processResponse', () => {
    it('processes a text response and advances step', async () => {
      const session = await createSession();
      const result = await engine.processResponse(session, 'I need help with apartment management');

      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);
      expect(session.currentStep).toBe(1);
      expect(session.responses['purpose']).toBeDefined();
      expect(session.responses['purpose'].response).toBe('I need help with apartment management');
    });

    it('returns next question after processing', async () => {
      const session = await createSession();
      const result = await engine.processResponse(session, 'test answer');
      expect(result.nextQuestion).toBeDefined();
      expect(result.nextQuestion!.id).toBe('experience');
    });

    it('rejects empty response for required question', async () => {
      const session = await createSession();
      const result = await engine.processResponse(session, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('validates scale responses', async () => {
      const session = await createSession();
      session.currentStep = 1; // experience (scale)
      const result = await engine.processResponse(session, '3');
      expect(result.success).toBe(true);
    });

    it('validates multiple_choice responses', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 1; // employment_status
      const result = await engine.processResponse(session, 'Employed full-time');
      expect(result.success).toBe(true);
    });

    it('rejects invalid multiple_choice option', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 1; // employment_status
      const result = await engine.processResponse(session, 'Invalid Option');
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('validates yes_no responses', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 7; // references (yes_no)
      const result = await engine.processResponse(session, 'yes');
      expect(result.success).toBe(true);
    });

    it('validates number responses', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 2; // monthly_income (number)
      const result = await engine.processResponse(session, 5000);
      expect(result.success).toBe(true);
    });

    it('validates date responses', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 5; // preferred_move_date (date)
      const result = await engine.processResponse(session, '2026-03-15');
      expect(result.success).toBe(true);
    });

    it('rejects invalid date', async () => {
      const session = await createSession('tenant-screening');
      session.currentStep = 5;
      const result = await engine.processResponse(session, 'not-a-date');
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid date');
    });

    it('completes interview after all questions answered', async () => {
      const session = await createSession();
      const completed = await completeInterview(manager, engine, session);
      expect(completed.status).toBe('completed');
    });

    it('returns error when no current question exists', async () => {
      const session = await createSession();
      session.currentStep = 99;
      const result = await engine.processResponse(session, 'test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No current question');
    });
  });

  describe('checkCompletion', () => {
    it('returns false for new session', async () => {
      const session = await createSession();
      const completed = await engine.checkCompletion(session);
      expect(completed).toBe(false);
    });

    it('returns true when step limit reached', async () => {
      const session = await createSession();
      session.currentStep = 5;
      session.responses = {
        purpose: { response: 'a', metadata: {}, timestamp: '' },
        experience: { response: '3', metadata: {}, timestamp: '' },
        goals: { response: 'b', metadata: {}, timestamp: '' },
        timeline: { response: 'c', metadata: {}, timestamp: '' },
        additional: { response: 'd', metadata: {}, timestamp: '' }
      };
      const completed = await engine.checkCompletion(session);
      expect(completed).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('returns 0% for new session', async () => {
      const session = await createSession();
      const progress = await engine.getProgress(session);
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(5);
      expect(progress.completionPercentage).toBe(0);
    });

    it('returns correct progress mid-interview', async () => {
      const session = await createSession();
      session.currentStep = 2;
      const progress = await engine.getProgress(session);
      expect(progress.completionPercentage).toBe(40);
    });

    it('returns 100% for completed session', async () => {
      const session = await createSession();
      session.currentStep = 5;
      const progress = await engine.getProgress(session);
      expect(progress.completionPercentage).toBe(100);
    });

    it('works for different interview types', async () => {
      const session = await createSession('tenant-screening');
      const progress = await engine.getProgress(session);
      expect(progress.totalSteps).toBe(8);
    });

    it('throws for invalid type', async () => {
      const session = await createSession();
      session.interviewType = 'bad';
      await expect(engine.getProgress(session)).rejects.toThrow('Invalid interview type');
    });
  });

  describe('full interview flows', () => {
    it('completes general interview (5 steps)', async () => {
      const session = await createSession('general');
      const completed = await completeInterview(manager, engine, session);
      expect(completed.status).toBe('completed');
      expect(Object.keys(completed.responses).length).toBe(5);
    });

    it('completes tenant-screening interview (8 steps)', async () => {
      const session = await createSession('tenant-screening');
      const completed = await completeInterview(manager, engine, session);
      expect(completed.status).toBe('completed');
      expect(Object.keys(completed.responses).length).toBe(8);
    });

    it('completes maintenance-request interview (7 steps)', async () => {
      const session = await createSession('maintenance-request');
      const completed = await completeInterview(manager, engine, session);
      expect(completed.status).toBe('completed');
      expect(Object.keys(completed.responses).length).toBe(7);
    });

    it('completes customer-onboarding interview (6 steps)', async () => {
      const session = await createSession('customer-onboarding');
      const completed = await completeInterview(manager, engine, session);
      expect(completed.status).toBe('completed');
      expect(Object.keys(completed.responses).length).toBe(6);
    });
  });
});
