/**
 * Oracle Core - Interview Type Definitions
 *
 * Shared interview type interfaces and definitions
 */

import { Question } from '../sessions/types';

export interface InterviewDefinition {
  type: string;
  maxSteps: number;
  questions: Question[];
  completionCriteria: CompletionRule[];
  description: string;
}

export interface CompletionRule {
  type: 'all_required_answered' | 'step_limit_reached' | 'user_indicated_done' | 'timeout';
  metadata?: Record<string, any>;
}

export type InterviewTypeRegistry = Record<string, InterviewDefinition>;