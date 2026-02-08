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
  const answerTrimmed = params.answer.trim();
  const answerLower = answerTrimmed.toLowerCase();

  // 1. Maximum exchanges reached
  if (totalExchanges >= 20) {
    return { complete: true, reason: 'Maximum questions reached' };
  }

  // 2. User explicitly indicates they're done (short answers only to avoid false positives)
  if (answerTrimmed.length <= 80 && totalExchanges >= 3) {
    const donePatterns = /\b(done|finished|that'?s all|no more|that covers it|nothing else|that'?s it|i'?m good|all set)\b/;
    if (donePatterns.test(answerLower)) {
      return { complete: true, reason: 'User indicated completion' };
    }
  }

  // 3. Short negative response after sufficient context (5+ exchanges)
  //    Only trigger on brief "no" / "no thanks" style replies, not long answers containing "no"
  if (totalExchanges >= 5 && answerTrimmed.length <= 30) {
    const negativePatterns = /^(no|nope|no thanks|not really|nothing|none)\.?$/;
    if (negativePatterns.test(answerLower)) {
      return { complete: true, reason: 'Sufficient context gathered' };
    }
  }

  return { complete: false };
}
