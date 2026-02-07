/**
 * Prime Activity - Validate and store initial context
 */

import { loggers } from 'the-machina';

export interface PrimeParams {
  domain: string;
  objective: string;
  constraints?: string;
}

export async function primeInterview(params: PrimeParams): Promise<void> {
  loggers.app.info('Priming interview', params);

  // Validate inputs
  if (!params.domain || params.domain.trim().length === 0) {
    throw new Error('Domain is required');
  }

  if (!params.objective || params.objective.trim().length === 0) {
    throw new Error('Objective is required');
  }

  // Store in activity context (would persist to DB in production)
  loggers.app.info('Interview primed successfully');
}
