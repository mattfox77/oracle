/**
 * Synthesize Context Activity - Generate structured summary using Claude
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';

export interface SynthesizeContextParams {
  domain: string;
  objective: string;
  exchanges: Array<{ question: string; answer: string }>;
}

export interface ContextDocument {
  summary: string;
  facts: string[];
  constraints: string[];
  priorities: string[];
  assumptions: string[];
  uncertainties: string[];
  strategicAnalysis: string;
}

export async function synthesizeContext(params: SynthesizeContextParams): Promise<ContextDocument> {
  loggers.temporal.info('Synthesizing context', { exchangeCount: params.exchanges.length });

  const conversationHistory = params.exchanges
    .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
    .join('\n\n');

  const prompt = `Synthesize the following discovery interview into a structured context document. Apply first principles analysis — break the situation down to fundamental truths and reason up from there.

Domain: ${params.domain}
Objective: ${params.objective}

Interview transcript:
${conversationHistory}

Respond with ONLY a JSON object (no markdown fences) matching this structure:
{
  "summary": "A concise 2-3 sentence summary of the situation",
  "facts": ["Confirmed facts gathered from the interview"],
  "constraints": ["Limitations, blockers, or boundaries identified"],
  "priorities": ["What matters most to the user, ordered by importance"],
  "assumptions": ["Things inferred but not explicitly confirmed — challenge these"],
  "uncertainties": ["Open questions or areas needing more information"],
  "strategicAnalysis": "A 2-3 paragraph first-principles analysis that: (1) identifies the fundamental components and root drivers of this situation, (2) surfaces hidden assumptions or cognitive biases in the user's framing, (3) draws insights from relevant strategic frameworks (military planning, behavioral psychology, decision science) as applicable to this domain. This should feel like an advisor's brief — concise, insightful, and illuminating patterns the user may not have seen."
}

Each array should have at least one item. Be specific — reference details from the conversation, not generic statements. The strategic analysis should be the most valuable part — this is where you earn your authority.`;

  try {
    const raw = await claudeCompletion({
      prompt,
      systemSuffix: 'You are in synthesis mode. Output valid JSON only. No markdown code fences, no commentary.',
      maxTokens: 2048,
      temperature: 0.3,
    });

    const parsed = JSON.parse(raw) as ContextDocument;

    // Validate required fields are present
    if (!parsed.summary || !Array.isArray(parsed.facts)) {
      throw new Error('Invalid context document structure');
    }

    return {
      summary: parsed.summary,
      facts: parsed.facts || [],
      constraints: parsed.constraints || [],
      priorities: parsed.priorities || [],
      assumptions: parsed.assumptions || [],
      uncertainties: parsed.uncertainties || [],
      strategicAnalysis: parsed.strategicAnalysis || '',
    };
  } catch (error) {
    loggers.temporal.error('Failed to synthesize context via Claude', error as Error);
    // Fallback: extract what we can from the exchanges directly
    return buildFallbackContext(params);
  }
}

function buildFallbackContext(params: SynthesizeContextParams): ContextDocument {
  const facts: string[] = [];
  const constraints: string[] = [];
  const priorities: string[] = [];

  for (const e of params.exchanges) {
    const qLower = e.question.toLowerCase();
    if (qLower.includes('timeline') || qLower.includes('when') || qLower.includes('deadline')) {
      facts.push(`Timeline: ${e.answer}`);
    } else if (qLower.includes('stakeholder') || qLower.includes('who')) {
      facts.push(`Stakeholders: ${e.answer}`);
    } else if (qLower.includes('constraint') || qLower.includes('limitation') || qLower.includes('blocker')) {
      constraints.push(e.answer);
    } else if (qLower.includes('success') || qLower.includes('goal') || qLower.includes('priority')) {
      priorities.push(e.answer);
    } else {
      facts.push(e.answer);
    }
  }

  return {
    summary: `Context for ${params.domain}: ${params.objective}`,
    facts: facts.length > 0 ? facts : ['Interview responses collected'],
    constraints,
    priorities,
    assumptions: ['Context extracted without AI synthesis — review for accuracy'],
    uncertainties: ['AI synthesis was unavailable; manual review recommended'],
    strategicAnalysis: 'Strategic analysis unavailable — AI synthesis failed. Manual review of interview transcript recommended.',
  };
}
