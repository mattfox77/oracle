/**
 * Generate Question Activity - Use Claude to generate adaptive questions
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';

export interface GenerateQuestionParams {
  domain: string;
  objective: string;
  exchanges: Array<{ question: string; answer: string }>;
}

export async function generateQuestion(params: GenerateQuestionParams): Promise<string> {
  loggers.app.info('Generating interview question', { exchangeCount: params.exchanges.length });

  const conversationHistory = params.exchanges
    .map(e => `Q: ${e.question}\nA: ${e.answer}`)
    .join('\n\n');

  const prompt = `You are conducting a discovery interview about: ${params.domain}

User's objective: ${params.objective}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}
Generate the next clarifying question to gather important context. Consider asking about:
- Specific requirements or constraints
- Success criteria
- Timeline and resources
- Stakeholders and dependencies
- Risks or concerns

Build naturally on the previous answers. Ask ONE focused question. Return ONLY the question text, no explanation or preamble.`;

  try {
    const question = await claudeCompletion({
      prompt,
      systemSuffix: 'You are in interview mode. Generate exactly one clear, focused question. Do not include any prefix, numbering, or explanation — just the question itself.',
      maxTokens: 256,
    });

    return question.trim();
  } catch (error) {
    loggers.app.error('Failed to generate question via Claude', error as Error);
    // Fallback to a reasonable generic question
    const n = params.exchanges.length;
    if (n === 0) {
      return `Let's start with the fundamentals: What's the timeline for ${params.domain}, and how flexible is it?`;
    }
    return `What else is important about ${params.domain} that we haven't covered yet?`;
  }
}
