/**
 * Process Response Activity - Store answer and determine if interview is complete
 */

import { loggers } from 'the-machina';

export interface ProcessResponseParams {
  question: string;
  answer: string;
  exchanges: Array<{ question: string; answer: string }>;
}

export interface ProcessResponseResult {
  complete: boolean;
  reason?: string;
}

export async function processResponse(params: ProcessResponseParams): Promise<ProcessResponseResult> {
  loggers.app.info('Processing interview response', {
    questionLength: params.question.length,
    answerLength: params.answer.length
  });

  // Check completion criteria
  const totalExchanges = params.exchanges.length + 1;

  // Complete if:
  // 1. User indicates they're done
  // 2. Minimum exchanges met (5) and answer suggests completion
  // 3. Maximum exchanges reached (20)

  const answerLower = params.answer.toLowerCase();
  const userDone = answerLower.includes('that\'s all') ||
                   answerLower.includes('nothing else') ||
                   answerLower.includes('that covers it');

  if (userDone && totalExchanges >= 3) {
    return { complete: true, reason: 'User indicated completion' };
  }

  if (totalExchanges >= 5 && answerLower.includes('no')) {
    return { complete: true, reason: 'Sufficient context gathered' };
  }

  if (totalExchanges >= 20) {
    return { complete: true, reason: 'Maximum questions reached' };
  }

  return { complete: false };
}
