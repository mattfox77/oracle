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
  const exchangeCount = params.exchanges.length;

  // Early exchanges (first 1-2 after intro) focus on understanding the user's situation
  // before diving into domain-specific deep questions
  let phaseGuidance: string;
  if (hasGuide) {
    phaseGuidance = `\nThis interview has a structured question guide. Follow this guide to ensure all topics are covered, but ask the questions naturally and adapt based on previous answers. If the user's response already covers an upcoming topic, skip it. If an answer is vague, probe deeper before moving on.\n\nQuestion guide:\n${buildGuidingSpec(params.guidingQuestions!, exchangeCount)}\n`;
  } else if (exchangeCount <= 2) {
    phaseGuidance = `\nYou are in the early context-gathering phase. The user has just introduced themselves. Focus on understanding:
- Their specific situation and what drove them to seek this analysis
- What success looks like to them — concrete outcomes, not abstract goals
- Any time pressure, resource constraints, or dependencies they're working within

Do NOT jump to domain-specific technical questions yet. Build understanding of the person and their situation first.\n`;
  } else {
    phaseGuidance = `\nYou are in the deep discovery phase. You now understand who the user is and their situation. Apply first principles thinking — break down their objective into fundamental components and probe each one. Consider asking about:
- Hidden assumptions in their current approach
- Second and third-order effects they may not have considered
- Stakeholders, dependencies, and competing priorities
- Risks, failure modes, and what they'd do if their primary approach doesn't work
- What they've already tried and what they learned from it

Challenge conventional thinking gently. Ask questions that force clarity and expand the user's own analysis.\n`;
  }

  const prompt = `You are conducting a strategic discovery interview about: ${params.domain}

User's objective: ${params.objective}
${phaseGuidance}
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
