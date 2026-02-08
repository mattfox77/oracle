import { SessionManager } from '../sessions/session-manager';
import { MemoryStorage } from './helpers';

describe('SessionManager', () => {
  let storage: MemoryStorage;
  let manager: SessionManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new SessionManager(storage);
  });

  describe('createSession', () => {
    it('creates a session with valid params', async () => {
      const session = await manager.createSession({
        userId: 'user-1',
        interviewType: 'general'
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-1');
      expect(session.interviewType).toBe('general');
      expect(session.status).toBe('active');
      expect(session.currentStep).toBe(0);
      expect(session.responses).toEqual({});
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('creates sessions for all valid interview types', async () => {
      const types = ['general', 'tenant-screening', 'customer-onboarding', 'maintenance-request'];
      for (const type of types) {
        const session = await manager.createSession({ userId: 'user-1', interviewType: type });
        expect(session.interviewType).toBe(type);
      }
    });

    it('throws for invalid interview type', async () => {
      await expect(
        manager.createSession({ userId: 'user-1', interviewType: 'invalid-type' })
      ).rejects.toThrow('Invalid interview type: invalid-type');
    });

    it('persists session to storage', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      expect(storage.size).toBe(1);
      const loaded = await storage.load(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.userId).toBe('user-1');
    });

    it('sets initial context if provided', async () => {
      const session = await manager.createSession({
        userId: 'user-1',
        interviewType: 'general',
        initialContext: { source: 'web' }
      });
      expect(session.contextData).toEqual({ source: 'web' });
    });

    it('generates unique session IDs', async () => {
      const s1 = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      const s2 = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('getSession', () => {
    it('returns session by ID', async () => {
      const created = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      const retrieved = await manager.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('returns null for non-existent session', async () => {
      const result = await manager.getSession('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('updates session fields', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      const updated = await manager.updateSession(session.id, { currentStep: 2 });
      expect(updated.currentStep).toBe(2);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(session.updatedAt.getTime());
    });

    it('throws for non-existent session', async () => {
      await expect(
        manager.updateSession('non-existent', { currentStep: 1 })
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('sets completedAt when status changes to completed', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      const updated = await manager.updateSession(session.id, { status: 'completed' });
      expect(updated.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('listSessions', () => {
    it('lists all sessions', async () => {
      await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.createSession({ userId: 'user-2', interviewType: 'tenant-screening' });
      const all = await manager.listSessions();
      expect(all.length).toBe(2);
    });

    it('filters by userId', async () => {
      await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.createSession({ userId: 'user-2', interviewType: 'general' });
      const filtered = await manager.listSessions({ userId: 'user-1' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].userId).toBe('user-1');
    });

    it('filters by interviewType', async () => {
      await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.createSession({ userId: 'user-1', interviewType: 'tenant-screening' });
      const filtered = await manager.listSessions({ interviewType: 'tenant-screening' });
      expect(filtered.length).toBe(1);
    });

    it('filters by status', async () => {
      const s1 = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.createSession({ userId: 'user-2', interviewType: 'general' });
      await manager.pauseSession(s1.id);
      const paused = await manager.listSessions({ status: 'paused' });
      expect(paused.length).toBe(1);
    });
  });

  describe('pauseSession', () => {
    it('pauses an active session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      const paused = await manager.pauseSession(session.id);
      expect(paused.status).toBe('paused');
    });

    it('throws for non-existent session', async () => {
      await expect(manager.pauseSession('non-existent')).rejects.toThrow('Session not found');
    });

    it('throws for completed session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.updateSession(session.id, { status: 'completed' });
      await expect(manager.pauseSession(session.id)).rejects.toThrow('Cannot pause completed session');
    });
  });

  describe('resumeSession', () => {
    it('resumes a paused session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.pauseSession(session.id);
      const resumed = await manager.resumeSession(session.id);
      expect(resumed.status).toBe('active');
    });

    it('throws for completed session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.updateSession(session.id, { status: 'completed' });
      await expect(manager.resumeSession(session.id)).rejects.toThrow('Cannot resume completed session');
    });
  });

  describe('deleteSession', () => {
    it('deletes an existing session', async () => {
      const session = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.deleteSession(session.id);
      const result = await manager.getSession(session.id);
      expect(result).toBeNull();
    });

    it('throws for non-existent session', async () => {
      await expect(manager.deleteSession('non-existent')).rejects.toThrow('Session not found: non-existent');
    });

    it('removes session from list results', async () => {
      const s1 = await manager.createSession({ userId: 'user-1', interviewType: 'general' });
      await manager.createSession({ userId: 'user-2', interviewType: 'general' });
      await manager.deleteSession(s1.id);
      const all = await manager.listSessions();
      expect(all.length).toBe(1);
      expect(all[0].userId).toBe('user-2');
    });
  });

  describe('listSessions pagination', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await manager.createSession({ userId: `user-${i}`, interviewType: 'general' });
      }
    });

    it('returns all sessions when no limit set', async () => {
      const all = await manager.listSessions();
      expect(all.length).toBe(5);
    });

    it('respects limit', async () => {
      const page = await manager.listSessions({ limit: 2 });
      expect(page.length).toBe(2);
    });

    it('respects offset', async () => {
      const all = await manager.listSessions();
      const page = await manager.listSessions({ offset: 3 });
      expect(page.length).toBe(2);
      expect(page[0].id).toBe(all[3].id);
    });

    it('respects limit and offset together', async () => {
      const all = await manager.listSessions();
      const page = await manager.listSessions({ limit: 2, offset: 1 });
      expect(page.length).toBe(2);
      expect(page[0].id).toBe(all[1].id);
      expect(page[1].id).toBe(all[2].id);
    });

    it('returns empty array when offset exceeds total', async () => {
      const page = await manager.listSessions({ offset: 100 });
      expect(page.length).toBe(0);
    });

    it('combines filters with pagination', async () => {
      // Create one extra session with a different type
      await manager.createSession({ userId: 'user-extra', interviewType: 'tenant-screening' });
      const page = await manager.listSessions({ interviewType: 'general', limit: 3 });
      expect(page.length).toBe(3);
      page.forEach(s => expect(s.interviewType).toBe('general'));
    });
  });
});
