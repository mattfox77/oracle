/**
 * Generate Question Activity - Use Claude to generate adaptive questions
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';

interface GuidingQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface GenerateQuestionParams {
  domain: string;
  objective: string;
  exchanges: Array<{ question: string; answer: string }>;
  guidingQuestions?: GuidingQuestion[];
}

function buildGuidingSpec(questions: GuidingQuestion[], asked: number): string {
  // Show which topics have been covered and which remain
  const lines = questions.map((q, i) => {
    const covered = i < asked;
    const opts = q.options?.length ? ` [options: ${q.options.join(', ')}]` : '';
    const req = q.required ? ' (required)' : ' (optional)';
    return `${covered ? '[DONE]' : '[TODO]'} ${q.id}: "${q.text}" — type: ${q.type}${opts}${req}`;
  });
  return lines.join('\n');
}

export async function generateQuestion(params: GenerateQuestionParams): Promise<string> {
  loggers.temporal.info('Generating interview question', { exchangeCount: params.exchanges.length });

  const conversationHistory = params.exchanges
    .map(e => `Q: ${e.question}\nA: ${e.answer}`)
    .join('\n\n');

  const hasGuide = params.guidingQuestions && params.guidingQuestions.length > 0;
  const guideSection = hasGuide
    ? `\nThis interview has a structured question guide. Follow this guide to ensure all topics are covered, but ask the questions naturally and adapt based on previous answers. If the user's response already covers an upcoming topic, skip it. If an answer is vague, probe deeper before moving on.\n\nQuestion guide:\n${buildGuidingSpec(params.guidingQuestions!, params.exchanges.length)}\n`
    : `\nGenerate the next clarifying question to gather important context. Consider asking about:\n- Specific requirements or constraints\n- Success criteria\n- Timeline and resources\n- Stakeholders and dependencies\n- Risks or concerns\n`;

  const prompt = `You are conducting a discovery interview about: ${params.domain}

User's objective: ${params.objective}
${guideSection}
${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}Build naturally on the previous answers. Ask ONE focused question. Return ONLY the question text, no explanation or preamble.`;

  try {
    const question = await claudeCompletion({
      prompt,
      systemSuffix: 'You are in interview mode. Generate exactly one clear, focused question. Do not include any prefix, numbering, or explanation — just the question itself.',
      maxTokens: 256,
    });

    return question.trim();
  } catch (error) {
    loggers.temporal.error('Failed to generate question via Claude', error as Error);
    // Fallback to a reasonable generic question
    const n = params.exchanges.length;
    if (n === 0) {
      return `Let's start with the fundamentals: What's the timeline for ${params.domain}, and how flexible is it?`;
    }
    return `What else is important about ${params.domain} that we haven't covered yet?`;
  }
}
