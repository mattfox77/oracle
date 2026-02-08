/**
 * Interview Workflow - 4-phase context gathering workflow
 */

import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  primeInterview,
  generateQuestion,
  processResponse,
  synthesizeContext,
  generateRecommendations
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3
  }
});

export interface InterviewState {
  phase: 'prime' | 'interview' | 'synthesize' | 'recommend' | 'complete';
  domain: string;
  objective: string;
  constraints?: string;
  exchanges: Array<{ question: string; answer: string }>;
  contextDocument?: any;
  recommendations?: any;
  userResponse?: string;
  awaitingResponse: boolean;
}

export const respondSignal = defineSignal<[string]>('respond');
export const editContextSignal = defineSignal<[any]>('editContext');
export const getStateQuery = defineQuery<InterviewState>('getState');

export async function interviewWorkflow(
  domain: string,
  objective: string,
  constraints?: string
): Promise<InterviewState> {
  const state: InterviewState = {
    phase: 'prime',
    domain,
    objective,
    constraints,
    exchanges: [],
    awaitingResponse: false
  };

  // Set up all handlers at the start
  setHandler(getStateQuery, () => state);

  setHandler(respondSignal, (response: string) => {
    state.userResponse = response;
    state.awaitingResponse = false;
  });

  setHandler(editContextSignal, (editedContext: any) => {
    state.contextDocument = editedContext;
    // Only unblock the response wait during the synthesize phase,
    // where the workflow is waiting for the user to review the context.
    // During interview phase, editing context should not disrupt Q&A flow.
    if (state.phase === 'synthesize') {
      state.awaitingResponse = false;
    }
  });

  // Phase 1: Prime
  await primeInterview({ domain, objective, constraints });
  state.phase = 'interview';

  // Phase 2: Interview (adaptive Q&A loop)
  let interviewComplete = false;
  let questionCount = 0;
  const maxQuestions = 20;

  while (!interviewComplete && questionCount < maxQuestions) {
    // Generate next question
    const question = await generateQuestion({
      domain: state.domain,
      objective: state.objective,
      exchanges: state.exchanges
    });

    // Wait for user response
    state.awaitingResponse = true;
    state.userResponse = undefined;

    const responded = await condition(() => !state.awaitingResponse, '24 hours');

    if (!responded) {
      throw new Error('Interview timeout - no response received within 24 hours');
    }

    if (!state.userResponse) {
      throw new Error('Interview response was empty');
    }

    // Process response
    const result = await processResponse({
      question,
      answer: state.userResponse,
      exchanges: state.exchanges
    });

    state.exchanges.push({ question, answer: state.userResponse });
    interviewComplete = result.complete;
    questionCount++;
  }

  state.phase = 'synthesize';

  // Phase 3: Synthesize
  const contextDoc = await synthesizeContext({
    domain: state.domain,
    objective: state.objective,
    exchanges: state.exchanges
  });

  state.contextDocument = contextDoc;

  // Wait for user to review/edit context
  state.awaitingResponse = true;
  const reviewed = await condition(() => !state.awaitingResponse, '24 hours');

  if (!reviewed) {
    throw new Error('Context review timeout - no response received within 24 hours');
  }

  state.phase = 'recommend';

  // Phase 4: Recommend
  const recommendations = await generateRecommendations({
    contextDocument: state.contextDocument,
    objective: state.objective
  });

  state.recommendations = recommendations;
  state.phase = 'complete';

  return state;
}
