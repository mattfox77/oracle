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
import { PostgresSessionStorage } from './data/session-storage';
import { interviewWorkflow, respondSignal, editContextSignal, getStateQuery, InterviewState } from './workflows/interview-workflow';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionManager,
  InterviewEngine,
  Analyzer,
  SessionFilters,
  getAllInterviewTypes,
  validateCreateSessionParams
} from './core';
import { apiKeyAuth, createRateLimiter } from './middleware';

// Input limits (bytes)
const MAX_TEXT_FIELD = 10_000;    // domain, objective, response fields
const MAX_JSON_BODY = 100_000;   // contextDocument and other JSON payloads

function exceedsLimit(value: unknown, limit: number): boolean {
  if (typeof value === 'string') return value.length > limit;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value).length > limit;
  return false;
}

// Configuration
const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'oracle',
    user: process.env.DB_USER || 'oracle',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
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

/**
 * Persist Temporal workflow state to the database after a signal.
 * Retries the query to give Temporal time to process the signal.
 */
async function persistWorkflowState(
  handle: { query: (q: any) => Promise<InterviewState> },
  workflowId: string,
  dataStore: OracleDataStore,
  retries = 3,
  delayMs = 300
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      const state = await handle.query(getStateQuery);
      await dataStore.saveInterview(workflowId, { ...state, sentinelId: 'oracle' });
      return;
    } catch (e) {
      if (attempt === retries - 1) {
        loggers.app.warn('Could not persist state after signal', { workflowId, attempt });
      }
    }
  }
}

interface ApiDeps {
  dataStore: OracleDataStore;
  sessionManager: SessionManager;
  interviewEngine: InterviewEngine;
  analyzer: Analyzer;
}

// Create API router
function createApiRouter(deps: ApiDeps): express.Router {
  const router = express.Router();
  const { dataStore, sessionManager, interviewEngine, analyzer } = deps;

  // Apply middleware to all API routes
  router.use(createRateLimiter());
  router.use(apiKeyAuth);

  // ===== Temporal Workflow Endpoints =====

  // Start interview
  router.post('/interviews', async (req, res) => {
    try {
      const { domain, objective, constraints } = req.body;

      if (!domain || !objective) {
        return res.status(400).json({ error: 'domain and objective are required' });
      }

      if (exceedsLimit(domain, MAX_TEXT_FIELD) || exceedsLimit(objective, MAX_TEXT_FIELD) || exceedsLimit(constraints, MAX_TEXT_FIELD)) {
        return res.status(400).json({ error: `Text fields must not exceed ${MAX_TEXT_FIELD} characters` });
      }

      const client = await getTemporalClient();
      const workflowId = `interview-${uuidv4()}`;

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

      if (exceedsLimit(response, MAX_TEXT_FIELD)) {
        return res.status(400).json({ error: `Response must not exceed ${MAX_TEXT_FIELD} characters` });
      }

      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);

      await handle.signal(respondSignal, response);

      // Persist updated state in the background (non-blocking to the response)
      persistWorkflowState(handle, id, dataStore).catch(e => {
        loggers.app.warn('Background persist failed after respond', { workflowId: id, error: (e as Error).message });
      });

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

  // List all interviews (with optional pagination)
  router.get('/interviews', async (req, res) => {
    try {
      const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit as string, 10) || 50) : undefined;
      const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10) || 0) : 0;

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

      // Apply pagination
      const paginated = limit != null
        ? interviews.slice(offset, offset + limit)
        : interviews.slice(offset);

      loggers.app.info('Listed interviews', { count: paginated.length, total: interviews.length });
      res.json({ interviews: paginated, count: paginated.length, total: interviews.length, limit: limit ?? null, offset });
    } catch (error: any) {
      loggers.app.error('Failed to list interviews', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel interview
  router.post('/interviews/:id/cancel', async (req, res) => {
    try {
      const { id } = req.params;
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);

      // Check workflow is still running before cancelling
      const description = await handle.describe();
      if (description.status.name !== 'RUNNING') {
        return res.status(400).json({
          error: `Interview is not running (status: ${description.status.name})`
        });
      }

      await handle.cancel();

      loggers.app.info('Interview cancelled', { workflowId: id });
      res.json({ status: 'cancelled', workflowId: id });
    } catch (error: any) {
      loggers.app.error('Failed to cancel interview', error);
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

      if (exceedsLimit(contextDocument, MAX_JSON_BODY)) {
        return res.status(400).json({ error: `contextDocument must not exceed ${MAX_JSON_BODY} characters` });
      }

      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(id);
      await handle.signal(editContextSignal, contextDocument);

      // Persist updated state in the background (non-blocking to the response)
      persistWorkflowState(handle, id, dataStore).catch(e => {
        loggers.app.warn('Background persist failed after context edit', { workflowId: id, error: (e as Error).message });
      });

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

      if (exceedsLimit(response, MAX_TEXT_FIELD)) {
        return res.status(400).json({ error: `Response must not exceed ${MAX_TEXT_FIELD} characters` });
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

      const updated = await sessionManager.updateSession(id, result.updates || {});

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

  // Delete session
  router.delete('/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await sessionManager.deleteSession(id);
      loggers.app.info('Session deleted', { sessionId: id });
      res.json({ status: 'deleted', sessionId: id });
    } catch (error: any) {
      loggers.app.error('Failed to delete session', error);
      const status = error.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ error: error.message });
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

  // List all sessions (with optional pagination)
  router.get('/sessions', async (req, res) => {
    try {
      const filters: SessionFilters = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.interviewType) filters.interviewType = req.query.interviewType as string;
      if (req.query.status) {
        const validStatuses = ['active', 'completed', 'paused'];
        if (!validStatuses.includes(req.query.status as string)) {
          return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}` });
        }
        filters.status = req.query.status as any;
      }
      if (req.query.limit) filters.limit = Math.max(1, parseInt(req.query.limit as string, 10) || 50);
      if (req.query.offset) filters.offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

      const sessions = await sessionManager.listSessions(filters);
      res.json({ sessions, count: sessions.length, limit: filters.limit ?? null, offset: filters.offset ?? 0 });
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
      const tenantId: string | undefined = req.body.tenant_id || session.userId;

      if (!tenantId || tenantId.trim().length === 0) {
        return res.status(400).json({ error: 'tenant_id required (pass in body or ensure session has userId)' });
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
  // Dispatches to documented Oracle functions from TOOLS.md
  router.post('/functions/:functionName', async (req, res) => {
    try {
      const { functionName } = req.params;
      const params = req.body;

      loggers.app.info('Function called', { functionName, params });

      switch (functionName) {
        case 'conduct_interview': {
          const { userId, interviewType, initialContext } = params;
          if (!userId || !interviewType) {
            return res.status(400).json({ error: 'userId and interviewType are required' });
          }
          if (exceedsLimit(userId, MAX_TEXT_FIELD) || exceedsLimit(interviewType, MAX_TEXT_FIELD)) {
            return res.status(400).json({ error: `Text fields must not exceed ${MAX_TEXT_FIELD} characters` });
          }
          if (initialContext && exceedsLimit(initialContext, MAX_JSON_BODY)) {
            return res.status(400).json({ error: `initialContext must not exceed ${MAX_JSON_BODY} characters` });
          }
          const validation = validateCreateSessionParams({ userId, interviewType, initialContext });
          if (!validation.valid) {
            return res.status(400).json({ error: validation.errors.join(', ') });
          }
          const session = await sessionManager.createSession({ userId, interviewType, initialContext });
          const firstQuestion = await interviewEngine.getNextQuestion(session);
          res.json({ success: true, data: { sessionId: session.id, firstQuestion } });
          break;
        }

        case 'ask_question': {
          const { sessionId } = params;
          if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
          }
          const session = await sessionManager.getSession(sessionId);
          if (!session) {
            return res.status(404).json({ error: `Session not found: ${sessionId}` });
          }
          const question = await interviewEngine.getNextQuestion(session);
          res.json({ success: true, data: { question } });
          break;
        }

        case 'synthesize_context': {
          const { sessionId } = params;
          if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
          }
          const session = await sessionManager.getSession(sessionId);
          if (!session) {
            return res.status(404).json({ error: `Session not found: ${sessionId}` });
          }
          if (session.status !== 'completed') {
            return res.status(400).json({ error: 'Session must be completed before synthesis' });
          }
          const analysis = await analyzer.generateAnalysis(session);
          res.json({ success: true, data: { analysis } });
          break;
        }

        case 'generate_recommendations': {
          const { sessionId } = params;
          if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
          }
          const session = await sessionManager.getSession(sessionId);
          if (!session) {
            return res.status(404).json({ error: `Session not found: ${sessionId}` });
          }
          if (session.status !== 'completed') {
            return res.status(400).json({ error: 'Session must be completed for recommendations' });
          }
          const analysis = await analyzer.generateAnalysis(session);
          res.json({ success: true, data: { recommendations: analysis.recommendations } });
          break;
        }

        case 'export_context': {
          const { sessionId, format } = params;
          if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
          }
          const session = await sessionManager.getSession(sessionId);
          if (!session) {
            return res.status(404).json({ error: `Session not found: ${sessionId}` });
          }
          const exportFormat = format || 'json';
          if (exportFormat === 'markdown') {
            const progress = await interviewEngine.getProgress(session);
            const lines = [
              `# Interview: ${session.interviewType}`,
              `**User:** ${session.userId}`,
              `**Status:** ${session.status}`,
              `**Progress:** ${progress.completionPercentage}%`,
              '',
              '## Responses',
            ];
            for (const [qId, data] of Object.entries(session.responses)) {
              lines.push(`### ${data.metadata?.questionText || qId}`);
              lines.push(String(data.response));
              lines.push('');
            }
            res.json({ success: true, data: { format: 'markdown', content: lines.join('\n') } });
          } else {
            res.json({ success: true, data: { format: 'json', content: session } });
          }
          break;
        }

        case 'import_context': {
          const { contextData, sessionId: targetSessionId } = params;
          if (!contextData) {
            return res.status(400).json({ error: 'contextData is required' });
          }
          if (exceedsLimit(contextData, MAX_JSON_BODY)) {
            return res.status(400).json({ error: `contextData must not exceed ${MAX_JSON_BODY} characters` });
          }
          if (targetSessionId) {
            const session = await sessionManager.getSession(targetSessionId);
            if (!session) {
              return res.status(404).json({ error: `Session not found: ${targetSessionId}` });
            }
            const updated = await sessionManager.updateSession(targetSessionId, {
              contextData: { ...session.contextData, ...contextData },
            });
            res.json({ success: true, data: { sessionId: updated.id, merged: true } });
          } else {
            // Create a new session with the imported context
            const { userId, interviewType } = params;
            if (!userId || !interviewType) {
              return res.status(400).json({ error: 'userId and interviewType required when creating new session' });
            }
            if (exceedsLimit(userId, MAX_TEXT_FIELD) || exceedsLimit(interviewType, MAX_TEXT_FIELD)) {
              return res.status(400).json({ error: `Text fields must not exceed ${MAX_TEXT_FIELD} characters` });
            }
            const session = await sessionManager.createSession({
              userId,
              interviewType,
              initialContext: contextData,
            });
            res.json({ success: true, data: { sessionId: session.id, created: true } });
          }
          break;
        }

        default:
          res.status(404).json({ error: `Unknown function: ${functionName}` });
      }
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

  // Initialize oracle-core services with PostgreSQL-backed session storage
  const sessionStorage = new PostgresSessionStorage(dataStore.getPool());
  const sessionManager = new SessionManager(sessionStorage);
  const interviewEngine = new InterviewEngine();
  const analyzer = new Analyzer();
  loggers.app.info('Session storage: PostgreSQL');

  // Create API router
  const apiRouter = createApiRouter({ dataStore, sessionManager, interviewEngine, analyzer });

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
