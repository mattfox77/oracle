/**
 * Oracle Core - Validation Utilities
 *
 * Shared validation functions
 */

import { CreateSessionParams } from '../sessions/types';
import { isValidInterviewType } from '../types/index';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate session creation parameters
 */
export function validateCreateSessionParams(params: CreateSessionParams): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!params.userId || typeof params.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!params.interviewType || typeof params.interviewType !== 'string') {
    errors.push('interviewType is required and must be a string');
  } else if (!isValidInterviewType(params.interviewType)) {
    errors.push(`Invalid interview type: ${params.interviewType}`);
  }

  // Optional fields
  if (params.initialContext !== undefined && typeof params.initialContext !== 'object') {
    errors.push('initialContext must be an object if provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate session ID format
 */
export function validateSessionId(sessionId: string): ValidationResult {
  const errors: string[] = [];

  if (!sessionId || typeof sessionId !== 'string') {
    errors.push('sessionId is required and must be a string');
  } else if (sessionId.trim().length === 0) {
    errors.push('sessionId cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate user ID format
 */
export function validateUserId(userId: string): ValidationResult {
  const errors: string[] = [];

  if (!userId || typeof userId !== 'string') {
    errors.push('userId is required and must be a string');
  } else if (userId.trim().length === 0) {
    errors.push('userId cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}