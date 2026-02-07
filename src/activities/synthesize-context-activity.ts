/**
 * Synthesize Context Activity - Generate structured summary using Claude
 */

import { loggers } from 'the-machina';

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
}

export async function synthesizeContext(params: SynthesizeContextParams): Promise<ContextDocument> {
  loggers.app.info('Synthesizing context', { exchangeCount: params.exchanges.length });

  // In production, would use Claude CLI to generate synthesis
  // For now, extract from exchanges

  const facts: string[] = [];
  const constraints: string[] = [];
  const priorities: string[] = [];

  params.exchanges.forEach(e => {
    if (e.question.toLowerCase().includes('timeline')) {
      facts.push(`Timeline: ${e.answer}`);
    } else if (e.question.toLowerCase().includes('stakeholder')) {
      facts.push(`Stakeholders: ${e.answer}`);
    } else if (e.question.toLowerCase().includes('constraint')) {
      constraints.push(e.answer);
    } else if (e.question.toLowerCase().includes('success')) {
      priorities.push(e.answer);
    }
  });

  return {
    summary: `Context for ${params.domain}: ${params.objective}`,
    facts,
    constraints,
    priorities,
    assumptions: ['Assuming standard industry practices'],
    uncertainties: []
  };
}
