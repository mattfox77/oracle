/**
 * Oracle Core Library
 *
 * Framework-agnostic interview session management and analysis
 * Used by both standalone Oracle and gateway Oracle (machina)
 */

// Export all types and interfaces
export * from './sessions/types';
export * from './types/types';

// Export core implementations
export { SessionManager } from './sessions/session-manager';
export { InterviewEngine } from './interviews/interview-engine';
export { Analyzer } from './analysis/analyzer';

// Export interview types
export {
  INTERVIEW_TYPES,
  getInterviewType,
  getAllInterviewTypes,
  isValidInterviewType,
  GeneralInterviewType,
  TenantScreeningInterviewType,
  CustomerOnboardingInterviewType,
  MaintenanceRequestInterviewType
} from './types/index';

// Export utilities
export * from './utils/validation';

// Re-export everything from modules
export * from './sessions/index';
export * from './interviews/index';
export * from './analysis/index';
export * from './types/index';
export * from './utils/index';