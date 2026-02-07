/**
 * Oracle - Strategic Interview & Analysis AI Agent
 *
 * Main entry point for the Oracle application.
 * Dual-mode interview server:
 * - /interviews/* : Temporal workflow-based interviews (long-running, adaptive)
 * - /sessions/*   : oracle-core session-based interviews (step-based, typed)
 */

import 'dotenv/config';
import * as path from 'path';
import express from 'express';
import { loggers, BaseHealthServer } from 'the-machina';
import { getTemporalClient } from './temporal/client';
import { OracleDataStore } from './data/store';
import { interviewWorkflow, respondSignal, editContextSignal, getStateQuery, InterviewState } from './workflows/interview-workflow';
import {
  SessionManager,
  InterviewEngine,
  Analyzer,
  ISessionStorage,
  InterviewSession,
  SessionFilters,
  getAllInterviewTypes,
  validateCreateSessionParams
} from './core';

// Configuration
const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'oracle',
    user: process.env.DB_USER || 'oracle',
    password: process.env.DB_PASSWORD || ''
  },
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  },
  server: {
    port: parseInt(process.env.PORT || '3001')
  },
  workspace: {
    path: path.join(__dirname, '..', 'workspace')
  }
};

// In-Memory Session Storage for oracle-core
class MemorySessionStorage implements ISessionStorage {
  private sessions: Map<string, InterviewSession> = new Map();

  async save(session: InterviewSession): Promise<void> {
    this.sessions.set(session.id, { ...session, responses: { ...session.responses } });
  }

  async load(sessionId: string): Promise<InterviewSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session, responses: { ...session.responses } } : null;
  }

  async list(filters?: SessionFilters): Promise<InterviewSession[]> {
    let sessions = Array.from(this.sessions.values());
    if (filters) {
      if (filters.userId) sessions = sessions.filter(s => s.userId === filters.userId);
      if (filters.interviewType) sessions = sessions.filter(s => s.interviewType === filters.interviewType);
      if (filters.status) sessions = sessions.filter(s => s.status === filters.status);
    }
    return sessions.map(s => ({ ...s, responses: { ...s.responses } }));
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

// Oracle-core service instances
const sessionStorage = new MemorySessionStorage();
const sessionManager = new SessionManager(sessionStorage);
const interviewEngine = new InterviewEngine();
const analyzer = new Analyzer();

// Create API router
function createApiRouter(deps: { dataStore: OracleDataStore }): express.Router {
  const router = express.Router();
  const { dataStore } = deps;

  // ===== Temporal Workflow Endpoints =====

  // Start interview
  router.post('/interviews', async (req, res) => {
    try {
      const { domain, objective, constraints } = req.body;

      if (!domain || !objective) {
        return res.status(400).json({ error: 'domain and objective are required' });
      }

      const client = await getTemporalClient();
      const workflowId = `interview-${Date.now()}`;

      await client.workflow.start(interviewWorkflow, {
        taskQueue: 'oracle-queue',
        workflowId,
        args: [domain, objective, constraints]
      });

      // Persist initial state
      await dataStore.saveInterview(workflowId, {
        phase: 'prime',
        domain,
        objective,
        constraints,
        exchanges: [],
        sentinelId: 'oracle'
      });

      loggers.app.info('Interview started', { workflowId });

      res.json({
        interviewId: workflowId,
        status: 'started'
      });
    } catch (error: any) {
      loggers.app.error('Failed to start interview', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Respond to interview
  router.post('/interviews/:id/respond', async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (!response) {
        return res.status(400).json({ error: 'response is required' });
      }

      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);

      await handle.signal(respondSignal, response);

      // Persist updated state after processing
      setTimeout(async () => {
        try {
          const state = await handle.query(getStateQuery);
          await dataStore.saveInterview(id, { ...state, sentinelId: 'oracle' });
        } catch (e) {
          loggers.app.warn('Could not persist state after response', { workflowId: id });
        }
      }, 500);

      loggers.app.info('Response sent to interview', { workflowId: id });
      res.json({ status: 'response_received' });
    } catch (error: any) {
      loggers.app.error('Failed to send response', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get interview status
  router.get('/interviews/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);
      const state = await handle.query(getStateQuery);
      res.json(state);
    } catch (error: any) {
      loggers.app.error('Failed to get interview status', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all interviews
  router.get('/interviews', async (req, res) => {
    try {
      const client = await getTemporalClient();
      const workflows = client.workflow.list({
        query: `WorkflowType = 'interviewWorkflow'`
      });

      const interviews = [];
      for await (const workflow of workflows) {
        try {
          const handle = client.workflow.getHandle(workflow.workflowId);
          if (workflow.status.name === 'RUNNING') {
            const state = await handle.query(getStateQuery);
            interviews.push({
              workflowId: workflow.workflowId,
              status: workflow.status.name,
              startTime: workflow.startTime,
              ...state
            });
          } else {
            interviews.push({
              workflowId: workflow.workflowId,
              status: workflow.status.name,
              startTime: workflow.startTime,
              closeTime: workflow.closeTime
            });
          }
        } catch (queryError) {
          interviews.push({
            workflowId: workflow.workflowId,
            status: workflow.status.name,
            startTime: workflow.startTime,
            closeTime: workflow.closeTime
          });
        }
      }

      loggers.app.info('Listed interviews', { count: interviews.length });
      res.json({ interviews, total: interviews.length });
    } catch (error: any) {
      loggers.app.error('Failed to list interviews', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Edit context document
  router.patch('/interviews/:id/context', async (req, res) => {
    try {
      const { id } = req.params;
      const { contextDocument } = req.body;

      if (!contextDocument) {
        return res.status(400).json({ error: 'contextDocument is required' });
      }

      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);
      await handle.signal(editContextSignal, contextDocument);

      setTimeout(async () => {
        try {
          const state = await handle.query(getStateQuery);
          await dataStore.saveInterview(id, { ...state, sentinelId: 'oracle' });
        } catch (e) {
          loggers.app.warn('Could not persist state after context edit', { workflowId: id });
        }
      }, 500);

      loggers.app.info('Context edited', { workflowId: id });
      res.json({ status: 'context_updated' });
    } catch (error: any) {
      loggers.app.error('Failed to edit context', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Oracle-Core Session Endpoints =====

  // List available interview types
  router.get('/sessions/types', (req, res) => {
    res.json({ types: getAllInterviewTypes() });
  });

  // Start oracle-core interview session
  router.post('/sessions/start', async (req, res) => {
    try {
      const { userId, interviewType, initialContext } = req.body;

      const validation = validateCreateSessionParams({ userId, interviewType, initialContext });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const session = await sessionManager.createSession({ userId, interviewType, initialContext });
      const firstQuestion = await interviewEngine.getNextQuestion(session);
      const progress = await interviewEngine.getProgress(session);

      loggers.app.info('Oracle-core session started', { sessionId: session.id, type: interviewType });

      res.json({
        sessionId: session.id,
        status: session.status,
        interviewType: session.interviewType,
        currentQuestion: firstQuestion,
        progress
      });
    } catch (error: any) {
      loggers.app.error('Failed to start session', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Respond to session question
  router.post('/sessions/:id/respond', async (req, res) => {
    try {
      const { id } = req.params;
      const { response } = req.body;

      if (response === undefined || response === null) {
        return res.status(400).json({ error: 'response is required' });
      }

      const session = await sessionManager.getSession(id);
      if (!session) {
        return res.status(404).json({ error: `Session not found: ${id}` });
      }

      if (session.status !== 'active') {
        return res.status(400).json({ error: `Session is ${session.status}, cannot respond` });
      }

      const result = await interviewEngine.processResponse(session, response);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const updated = await sessionManager.updateSession(id, {
        currentStep: session.currentStep,
        responses: session.responses,
        status: result.completed ? 'completed' : session.status,
        completedAt: result.completed ? new Date() : undefined
      });

      const progress = await interviewEngine.getProgress(updated);

      loggers.app.info('Session response processed', { sessionId: id, completed: result.completed });

      res.json({
        sessionId: id,
        status: updated.status,
        nextQuestion: result.nextQuestion || null,
        completed: result.completed,
        progress
      });
    } catch (error: any) {
      loggers.app.error('Failed to process session response', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause session
  router.post('/sessions/:id/pause', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.pauseSession(id);
      loggers.app.info('Session paused', { sessionId: id });
      res.json({ sessionId: id, status: session.status });
    } catch (error: any) {
      loggers.app.error('Failed to pause session', error);
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  // Resume session
  router.post('/sessions/:id/resume', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.resumeSession(id);
      const nextQuestion = await interviewEngine.getNextQuestion(session);
      const progress = await interviewEngine.getProgress(session);

      loggers.app.info('Session resumed', { sessionId: id });
      res.json({
        sessionId: id,
        status: session.status,
        currentQuestion: nextQuestion,
        progress
      });
    } catch (error: any) {
      loggers.app.error('Failed to resume session', error);
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ error: error.message });
    }
  });

  // Get session state
  router.get('/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.getSession(id);

      if (!session) {
        return res.status(404).json({ error: `Session not found: ${id}` });
      }

      const progress = await interviewEngine.getProgress(session);
      const currentQuestion = session.status === 'active'
        ? await interviewEngine.getNextQuestion(session)
        : null;

      res.json({
        ...session,
        currentQuestion,
        progress
      });
    } catch (error: any) {
      loggers.app.error('Failed to get session', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get analysis for completed session
  router.get('/sessions/:id/analysis', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.getSession(id);

      if (!session) {
        return res.status(404).json({ error: `Session not found: ${id}` });
      }

      if (session.status !== 'completed') {
        return res.status(400).json({ error: 'Analysis only available for completed sessions' });
      }

      const analysis = await analyzer.generateAnalysis(session);

      loggers.app.info('Analysis generated', { sessionId: id, score: analysis.score });
      res.json(analysis);
    } catch (error: any) {
      loggers.app.error('Failed to generate analysis', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all sessions
  router.get('/sessions', async (req, res) => {
    try {
      const filters: SessionFilters = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.interviewType) filters.interviewType = req.query.interviewType as string;
      if (req.query.status) filters.status = req.query.status as any;

      const sessions = await sessionManager.listSessions(filters);
      res.json({ sessions, total: sessions.length });
    } catch (error: any) {
      loggers.app.error('Failed to list sessions', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create issue from completed maintenance-request interview
  router.post('/sessions/:id/create-issue', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await sessionManager.getSession(id);

      if (!session) {
        return res.status(404).json({ error: `Session not found: ${id}` });
      }

      if (session.interviewType !== 'maintenance-request') {
        return res.status(400).json({ error: 'Only maintenance-request sessions can create issues' });
      }

      if (session.status !== 'completed') {
        return res.status(400).json({ error: 'Interview must be completed before creating an issue' });
      }

      const responses = session.responses;
      const unitInfo = responses.unit_identification?.response || 'Unknown unit';
      const issueDesc = responses.issue_description?.response || 'No description provided';
      const category = responses.issue_category?.response || 'Other';
      const urgency = responses.urgency_level?.response || 'Normal (within a week)';

      let priority = 'routine';
      if (urgency.includes('Emergency')) priority = 'emergency';
      else if (urgency.includes('Urgent')) priority = 'urgent';

      const description = `[${category}] ${issueDesc} (Unit: ${unitInfo})`;
      const tenantId = req.body.tenant_id || parseInt(session.userId) || null;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenant_id required (pass in body or use numeric userId)' });
      }

      const issueId = await dataStore.createIssue(tenantId, description, priority);

      loggers.app.info('Issue created from maintenance interview', {
        sessionId: id,
        issueId,
        priority,
        category
      });

      res.json({
        issueId,
        description,
        priority,
        status: 'open',
        sessionId: id,
        category
      });
    } catch (error: any) {
      loggers.app.error('Failed to create issue from session', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Agent function endpoint (for cross-agent calls)
  router.post('/functions/:functionName', async (req, res) => {
    try {
      const { functionName } = req.params;
      const params = req.body;

      loggers.app.info('Function called', { functionName, params });

      res.json({
        success: true,
        message: `Function ${functionName} executed`,
        data: {}
      });
    } catch (error: any) {
      loggers.app.error('Function execution failed', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

// Health server extending BaseHealthServer
class OracleHealthServer extends BaseHealthServer {
  private dataStore: OracleDataStore;

  constructor(deps: { dataStore: OracleDataStore }) {
    super({
      port: config.server.port,
      enableMetrics: true,
      serviceName: 'oracle',
      version: '1.0.0'
    });
    this.dataStore = deps.dataStore;
  }

  protected async checkDependencies(): Promise<Record<string, { name: string; status: 'up' | 'down'; message?: string; responseTime?: number }>> {
    const checks: Record<string, { name: string; status: 'up' | 'down'; message?: string; responseTime?: number }> = {};

    // Check database
    try {
      const start = Date.now();
      await this.dataStore.query('SELECT 1 as health_check');
      checks.database = {
        name: 'database',
        status: 'up',
        responseTime: Date.now() - start
      };
    } catch (error) {
      checks.database = {
        name: 'database',
        status: 'down',
        message: (error as Error).message
      };
    }

    // Check Temporal
    try {
      const start = Date.now();
      await getTemporalClient();
      checks.temporal = {
        name: 'temporal',
        status: 'up',
        responseTime: Date.now() - start
      };
    } catch (error) {
      checks.temporal = {
        name: 'temporal',
        status: 'down',
        message: (error as Error).message
      };
    }

    return checks;
  }
}

// Main application
async function main(): Promise<void> {
  loggers.app.info('Starting Oracle - Strategic Interview & Analysis Agent');

  // Initialize data store
  const dataStore = new OracleDataStore();
  await dataStore.connect({ db: config.database });
  loggers.app.info('Connected to database');

  // Create API router
  const apiRouter = createApiRouter({ dataStore });

  // Start health check server
  const healthServer = new OracleHealthServer({ dataStore });

  // Mount API routes
  healthServer.use('/api', apiRouter);
  loggers.app.info('API routes mounted');

  await healthServer.start(config.server.port);
  loggers.app.info('Oracle started', { port: config.server.port });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    loggers.app.info('Shutting down...');
    await healthServer.stop();
    await dataStore.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    loggers.app.info('Shutting down...');
    await healthServer.stop();
    await dataStore.close();
    process.exit(0);
  });
}

// Run the application
main().catch(error => {
  loggers.app.error('Failed to start Oracle', { error });
  process.exit(1);
});

// Export for testing
export { OracleDataStore, createApiRouter };
export { SessionManager, InterviewEngine, Analyzer } from './core';
