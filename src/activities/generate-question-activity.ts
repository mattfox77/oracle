/**
 * Generate Question Activity - Use Claude to generate adaptive questions
 */

import { loggers } from 'the-machina';

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

Generate the next clarifying question to gather important context. Ask about:
- Specific requirements or constraints
- Success criteria
- Timeline and resources
- Stakeholders and dependencies
- Risks or concerns

Return ONLY the question, no explanation.`;

  try {
    // Use Claude CLI (would be actual implementation)
    // For now, generate contextual questions
    const questionNumber = params.exchanges.length + 1;

    if (questionNumber === 1) {
      return `Let's start with the fundamentals: What's the timeline for ${params.domain}, and how flexible is it?`;
    } else if (questionNumber === 2) {
      return `Who are the key stakeholders involved in this ${params.domain}?`;
    } else if (questionNumber === 3) {
      return `What are the main constraints or limitations you're working within?`;
    } else if (questionNumber === 4) {
      return `What does success look like for this ${params.domain}?`;
    } else {
      return `Is there anything else important about ${params.domain} that we haven't covered yet?`;
    }
  } catch (error) {
    loggers.app.error('Failed to generate question', error as Error);
    throw error;
  }
}
