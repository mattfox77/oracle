import { Analyzer } from '../analysis/analyzer';
import { InterviewEngine } from '../interviews/interview-engine';
import { SessionManager } from '../sessions/session-manager';
import { InterviewSession } from '../sessions/types';
import { MemoryStorage, completeInterview } from './helpers';

describe('Analyzer', () => {
  let analyzer: Analyzer;
  let engine: InterviewEngine;
  let storage: MemoryStorage;
  let manager: SessionManager;

  beforeEach(() => {
    analyzer = new Analyzer();
    engine = new InterviewEngine();
    storage = new MemoryStorage();
    manager = new SessionManager(storage);
  });

  async function completedSession(type: string = 'general', answers?: Record<string, any>): Promise<InterviewSession> {
    const session = await manager.createSession({ userId: 'user-1', interviewType: type });
    return completeInterview(manager, engine, session, answers);
  }

  describe('generateAnalysis', () => {
    it('returns analysis for completed general interview', async () => {
      const session = await completedSession('general');
      const analysis = await analyzer.generateAnalysis(session);

      expect(analysis.responseCount).toBe(5);
      expect(analysis.completionRate).toBe(1.0);
      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.score).toBeLessThanOrEqual(100);
      expect(analysis.insights.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations!.length).toBeGreaterThan(0);
    });

    it('throws for incomplete session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await expect(analyzer.generateAnalysis(session)).rejects.toThrow('Cannot analyze incomplete session');
    });

    it('generates analysis for tenant-screening', async () => {
      const session = await completedSession('tenant-screening');
      const analysis = await analyzer.generateAnalysis(session);
      expect(analysis.responseCount).toBe(8);
      expect(analysis.recommendations![0].title).toBe('Review Application');
    });

    it('generates analysis for maintenance-request', async () => {
      const session = await completedSession('maintenance-request');
      const analysis = await analyzer.generateAnalysis(session);
      expect(analysis.responseCount).toBe(7);
      expect(analysis.recommendations![0].title).toBe('Schedule Maintenance');
      expect(analysis.recommendations![0].agentToExecute).toBe('Agent Smith');
    });

    it('generates analysis for customer-onboarding', async () => {
      const session = await completedSession('customer-onboarding');
      const analysis = await analyzer.generateAnalysis(session);
      expect(analysis.responseCount).toBe(6);
      expect(analysis.recommendations![0].title).toBe('Follow-up Contact');
    });

    it('includes completion time in analysis', async () => {
      const session = await completedSession('general');
      const analysis = await analyzer.generateAnalysis(session);
      expect(analysis.completionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateScore', () => {
    it('returns score between 0 and 100', async () => {
      const session = await completedSession('general');
      const score = await analyzer.calculateScore(session);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('scores higher for more complete responses', async () => {
      const session = await completedSession('general');
      const score = await analyzer.calculateScore(session);
      // All questions answered = at least 40% completeness score
      expect(score).toBeGreaterThanOrEqual(40);
    });

    it('returns 0 for invalid interview type', async () => {
      const session = await completedSession('general');
      session.interviewType = 'nonexistent';
      const score = await analyzer.calculateScore(session);
      expect(score).toBe(0);
    });
  });

  describe('extractInsights', () => {
    it('returns insights for completed session', async () => {
      const session = await completedSession('general');
      const insights = await analyzer.extractInsights(session);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights).toContain('Completed all interview questions');
    });

    it('reports partial completion', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      // Manually mark as completed with only 3 responses
      session.status = 'completed';
      session.responses = {
        purpose: { response: 'a', metadata: {}, timestamp: '' },
        experience: { response: '3', metadata: {}, timestamp: '' },
        goals: { response: 'b', metadata: {}, timestamp: '' }
      };
      session.completedAt = new Date();
      const insights = await analyzer.extractInsights(session);
      expect(insights.some(i => i.includes('3 of 5'))).toBe(true);
    });

    it('includes type-specific insights for tenant-screening', async () => {
      const session = await completedSession('tenant-screening');
      const insights = await analyzer.extractInsights(session);
      expect(insights.length).toBeGreaterThanOrEqual(2);
    });

    it('includes urgency insights for maintenance-request', async () => {
      const session = await completedSession('maintenance-request', {
        urgency_level: 'Emergency (immediate)'
      });
      const insights = await analyzer.extractInsights(session);
      expect(insights.some(i => i.includes('Emergency') || i.includes('immediate'))).toBe(true);
    });
  });
});
