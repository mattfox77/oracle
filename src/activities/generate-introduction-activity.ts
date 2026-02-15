/**
 * Generate Introduction Activity - Establish Oracle's domain authority
 *
 * Produces an opening message that:
 * 1. Establishes the Oracle as an authority in the user's domain
 * 2. Frames the analytical perspective (first principles, strategic disciplines)
 * 3. Asks the user to establish their own context (identity, objectives, situation)
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';

export interface GenerateIntroductionParams {
  domain: string;
  objective: string;
  constraints?: string;
}

export async function generateIntroduction(params: GenerateIntroductionParams): Promise<string> {
  loggers.temporal.info('Generating authority introduction', { domain: params.domain });

  const constraintNote = params.constraints
    ? `\nKnown constraints: ${params.constraints}`
    : '';

  const prompt = `Generate an opening message for a strategic interview session.

Domain: ${params.domain}
User's stated objective: ${params.objective}${constraintNote}

Your opening message should:
1. Briefly establish yourself as a knowledgeable authority in "${params.domain}" — reference the specific analytical lenses you'll apply (strategic planning, behavioral insights, first principles analysis) as they relate to this domain
2. Explain that you'll be conducting a structured interview to deeply understand the user's situation before providing analysis and recommendations
3. Explain that this approach produces far better results than conventional Q&A because it forces clarity, eliminates assumptions, and leads to customized insights
4. Ask the user to introduce themselves and share: who they are, what their role/relationship to this objective is, and any immediate context about their situation

Keep it concise but authoritative — 3-4 short paragraphs. Be warm but professional. End with a clear question asking the user to establish their context.`;

  try {
    const intro = await claudeCompletion({
      prompt,
      systemSuffix: 'You are establishing your authority and beginning an interview. Write a compelling, authoritative opening that makes the user confident in the process. Do not use bullet points or lists — write in natural paragraphs. End with one clear question.',
      maxTokens: 1024,
    });

    return intro.trim();
  } catch (error) {
    loggers.temporal.error('Failed to generate introduction via Claude', error as Error);
    return `Welcome. I'm The Oracle, and I specialize in strategic analysis for ${params.domain}. I'll be conducting a structured interview to deeply understand your situation — your goals, constraints, and the full context around "${params.objective}." This approach produces far more actionable results than conventional Q&A because it eliminates assumptions and forces the kind of clarity that leads to real insight.\n\nTo begin, tell me about yourself — who are you, what's your role in relation to this objective, and what's driving this initiative right now?`;
  }
}
