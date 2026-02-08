/**
 * Generate Recommendations Activity - Create strategic recommendations using Claude
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';
import type { ContextDocument } from './synthesize-context-activity';
import type { Recommendation } from '../core/sessions/types';

export type { Recommendation };

export interface GenerateRecommendationsParams {
  contextDocument: ContextDocument;
  objective: string;
}

export async function generateRecommendations(
  params: GenerateRecommendationsParams
): Promise<Recommendation[]> {
  loggers.temporal.info('Generating recommendations');

  const contextSummary = `
Summary: ${params.contextDocument.summary}

Facts:
${params.contextDocument.facts.map(f => `- ${f}`).join('\n')}

Constraints:
${params.contextDocument.constraints.map(c => `- ${c}`).join('\n') || '- None identified'}

Priorities:
${params.contextDocument.priorities.map(p => `- ${p}`).join('\n') || '- None identified'}

Assumptions:
${params.contextDocument.assumptions.map(a => `- ${a}`).join('\n')}

Uncertainties:
${params.contextDocument.uncertainties.map(u => `- ${u}`).join('\n') || '- None identified'}`;

  const prompt = `Based on the following context document, generate 2-4 strategic recommendations.

Objective: ${params.objective}

Context:
${contextSummary}

Respond with ONLY a JSON array (no markdown fences) of recommendation objects:
[
  {
    "title": "Short action-oriented title",
    "rationale": "Why this recommendation matters, grounded in the context",
    "nextSteps": ["Concrete step 1", "Concrete step 2", "Concrete step 3"]
  }
]

Requirements:
- Each recommendation must be grounded in facts from the context, not generic advice
- Next steps should be specific and actionable
- Order recommendations by priority (most important first)
- Rationale should reference specific facts, constraints, or priorities from the context`;

  try {
    const raw = await claudeCompletion({
      prompt,
      systemSuffix: 'You are in recommendation mode. Output valid JSON only. No markdown code fences, no commentary. Generate actionable, context-specific recommendations.',
      maxTokens: 2048,
      temperature: 0.4,
    });

    const parsed = JSON.parse(raw) as Recommendation[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid recommendations structure');
    }

    // Validate each recommendation has required fields
    return parsed.map(r => ({
      title: r.title || 'Untitled Recommendation',
      rationale: r.rationale || '',
      nextSteps: Array.isArray(r.nextSteps) ? r.nextSteps : [],
      ...(r.agentToExecute ? { agentToExecute: r.agentToExecute } : {}),
    }));
  } catch (error) {
    loggers.temporal.error('Failed to generate recommendations via Claude', error as Error);
    // Fallback: build basic recommendations from context
    return buildFallbackRecommendations(params);
  }
}

function buildFallbackRecommendations(params: GenerateRecommendationsParams): Recommendation[] {
  const recs: Recommendation[] = [];
  const ctx = params.contextDocument;

  if (ctx.constraints.length > 0) {
    recs.push({
      title: 'Address Identified Constraints',
      rationale: `${ctx.constraints.length} constraint(s) were identified during discovery that could impact success`,
      nextSteps: [
        'Review each constraint for mitigation options',
        'Determine which constraints are negotiable vs fixed',
        'Build contingency plans for fixed constraints',
      ],
    });
  }

  if (ctx.priorities.length > 0) {
    recs.push({
      title: 'Align on Priorities',
      rationale: 'Clear priorities were identified and should drive planning',
      nextSteps: [
        'Confirm priority ordering with stakeholders',
        'Map priorities to concrete deliverables',
        'Establish success metrics for each priority',
      ],
    });
  }

  if (ctx.uncertainties.length > 0) {
    recs.push({
      title: 'Resolve Open Questions',
      rationale: `${ctx.uncertainties.length} uncertainty(ies) remain that could affect the approach`,
      nextSteps: [
        'Identify who can answer each open question',
        'Set deadlines for resolving each uncertainty',
        'Define fallback plans for unresolved items',
      ],
    });
  }

  // Always include at least one recommendation
  if (recs.length === 0) {
    recs.push({
      title: 'Define Next Steps',
      rationale: `Context for "${params.objective}" has been gathered and is ready for action planning`,
      nextSteps: [
        'Review the synthesized context document with stakeholders',
        'Identify the highest-impact first action',
        'Set a timeline for execution',
      ],
    });
  }

  return recs;
}
