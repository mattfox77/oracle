/**
 * Oracle Core - Session Types
 *
 * Shared interfaces for interview session management
 * Framework-agnostic, used by both standalone and gateway implementations
 */

export interface InterviewSession {
  id: string;
  userId: string;
  interviewType: string;
  status: 'active' | 'completed' | 'paused';
  currentStep: number;
  responses: Record<string, ResponseData>;
  contextData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ResponseData {
  response: any;
  metadata: any;
  timestamp: string;
}

export interface CreateSessionParams {
  userId: string;
  interviewType: string;
  initialContext?: Record<string, any>;
}

export interface SessionFilters {
  userId?: string;
  interviewType?: string;
  status?: InterviewSession['status'];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ProgressInfo {
  currentStep: number;
  totalSteps: number;
  completionPercentage: number;
  estimatedTimeRemaining?: number;
}

export interface ProcessResult {
  success: boolean;
  nextQuestion?: Question;
  completed: boolean;
  error?: string;
  /** Session fields that changed — caller should persist these */
  updates?: Partial<InterviewSession>;
}

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'scale' | 'yes_no' | 'number' | 'date' | 'multiple_choice' | 'multiple_select';
  required: boolean;
  options?: string[];
  metadata?: Record<string, any>;
}

// Storage interface for dependency injection
export interface ISessionStorage {
  save(session: InterviewSession): Promise<void>;
  load(sessionId: string): Promise<InterviewSession | null>;
  list(filters?: SessionFilters): Promise<InterviewSession[]>;
  delete(sessionId: string): Promise<void>;
}

// Core service interfaces
export interface ISessionManager {
  createSession(params: CreateSessionParams): Promise<InterviewSession>;
  getSession(sessionId: string): Promise<InterviewSession | null>;
  updateSession(sessionId: string, updates: Partial<InterviewSession>): Promise<InterviewSession>;
  listSessions(filters?: SessionFilters): Promise<InterviewSession[]>;
  pauseSession(sessionId: string): Promise<InterviewSession>;
  resumeSession(sessionId: string): Promise<InterviewSession>;
}

export interface IInterviewEngine {
  getNextQuestion(session: InterviewSession): Promise<Question | null>;
  processResponse(session: InterviewSession, response: any): Promise<ProcessResult>;
  checkCompletion(session: InterviewSession): Promise<boolean>;
  getProgress(session: InterviewSession): Promise<ProgressInfo>;
}

export interface IAnalyzer {
  generateAnalysis(session: InterviewSession): Promise<AnalysisResult>;
  calculateScore(session: InterviewSession): Promise<number>;
  extractInsights(session: InterviewSession): Promise<string[]>;
}

export interface AnalysisResult {
  completionTime: number;
  responseCount: number;
  completionRate: number;
  insights: string[];
  score: number;
  recommendations?: Recommendation[];
}

export interface Recommendation {
  title: string;
  rationale: string;
  nextSteps: string[];
  priority?: 'high' | 'medium' | 'low';
  agentToExecute?: string;
}