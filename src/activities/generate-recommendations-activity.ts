/**
 * Generate Recommendations Activity - Create strategic recommendations using Claude
 */

import { loggers } from 'the-machina';
import { claudeCompletion } from '../utils/claude';
import type { ContextDocument } from './synthesize-context-activity';
import type { Recommendation, RecommendationSet } from '../core/sessions/types';

export type { Recommendation, RecommendationSet };

export interface GenerateRecommendationsParams {
  contextDocument: ContextDocument;
  objective: string;
}

export async function generateRecommendations(
  params: GenerateRecommendationsParams
): Promise<RecommendationSet> {
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
${params.contextDocument.uncertainties.map(u => `- ${u}`).join('\n') || '- None identified'}

Strategic analysis:
${params.contextDocument.strategicAnalysis || 'Not available'}`;

  const prompt = `Based on the following context document, generate 2-4 strategic courses of action as recommendations.

Objective: ${params.objective}

Context:
${contextSummary}

Analyze each course of action through multiple lenses:
- First principles: Does this address root causes or just symptoms?
- Strategic: What are the second and third-order effects?
- Psychological: How will stakeholders respond? What behavioral dynamics are at play?
- Risk: What failure modes exist and how can they be mitigated?

Respond with ONLY a JSON object (no markdown fences) matching this structure:
{
  "recommendations": [
    {
      "title": "Short action-oriented title",
      "rationale": "Why this matters — grounded in context facts and strategic analysis",
      "pros": ["Advantage 1", "Advantage 2", "Advantage 3"],
      "cons": ["Disadvantage or risk 1", "Disadvantage or risk 2"],
      "nextSteps": ["Concrete step 1", "Concrete step 2", "Concrete step 3"]
    }
  ],
  "comparisonMarkdown": "A markdown table comparing all recommendations side-by-side with columns for each recommendation and rows for: Approach, Key Advantage, Key Risk, Time to Impact, Resource Intensity, Confidence Level"
}

Requirements:
- Each recommendation must be grounded in facts from the context, not generic advice
- Pros and cons must be specific to this situation, not abstract
- The comparison markdown should be a clear, concise table enabling quick side-by-side evaluation
- Order recommendations by priority (most important first)
- Rationale should reference specific facts, constraints, or priorities
- The result should condense what would take extensive research into a concise, actionable set`;

  try {
    const raw = await claudeCompletion({
      prompt,
      systemSuffix: 'You are in recommendation mode. Output valid JSON only. No markdown code fences, no commentary. Generate actionable, context-specific recommendations with honest pros and cons for each course of action. Think like a strategic advisor drawing from military planning, psychology, and first principles analysis.',
      maxTokens: 4096,
      temperature: 0.4,
    });

    const parsed = JSON.parse(raw) as RecommendationSet;

    if (!parsed.recommendations || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      throw new Error('Invalid recommendations structure');
    }

    return {
      recommendations: parsed.recommendations.map(r => ({
        title: r.title || 'Untitled Recommendation',
        rationale: r.rationale || '',
        pros: Array.isArray(r.pros) ? r.pros : [],
        cons: Array.isArray(r.cons) ? r.cons : [],
        nextSteps: Array.isArray(r.nextSteps) ? r.nextSteps : [],
        ...(r.agentToExecute ? { agentToExecute: r.agentToExecute } : {}),
      })),
      comparisonMarkdown: parsed.comparisonMarkdown || buildComparisonMarkdown(parsed.recommendations),
    };
  } catch (error) {
    loggers.temporal.error('Failed to generate recommendations via Claude', error as Error);
    return buildFallbackRecommendations(params);
  }
}

function buildComparisonMarkdown(recs: Recommendation[]): string {
  if (recs.length === 0) return '';
  const header = `| Aspect | ${recs.map(r => r.title).join(' | ')} |`;
  const separator = `| --- | ${recs.map(() => '---').join(' | ')} |`;
  const prosRow = `| Key Advantage | ${recs.map(r => r.pros[0] || 'N/A').join(' | ')} |`;
  const consRow = `| Key Risk | ${recs.map(r => r.cons[0] || 'N/A').join(' | ')} |`;
  const stepsRow = `| First Step | ${recs.map(r => r.nextSteps[0] || 'N/A').join(' | ')} |`;
  return [header, separator, prosRow, consRow, stepsRow].join('\n');
}

function buildFallbackRecommendations(params: GenerateRecommendationsParams): RecommendationSet {
  const recs: Recommendation[] = [];
  const ctx = params.contextDocument;

  if (ctx.constraints.length > 0) {
    recs.push({
      title: 'Address Identified Constraints',
      rationale: `${ctx.constraints.length} constraint(s) were identified during discovery that could impact success`,
      pros: ['Removes blockers early', 'Reduces downstream risk'],
      cons: ['May require upfront time investment', 'Some constraints may be non-negotiable'],
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
      pros: ['Creates shared understanding', 'Focuses effort on highest-value items'],
      cons: ['Requires stakeholder time', 'May surface disagreements'],
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
      pros: ['Reduces risk of wrong direction', 'Builds confidence in plan'],
      cons: ['May delay action', 'Some answers may not be available yet'],
      nextSteps: [
        'Identify who can answer each open question',
        'Set deadlines for resolving each uncertainty',
        'Define fallback plans for unresolved items',
      ],
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Define Next Steps',
      rationale: `Context for "${params.objective}" has been gathered and is ready for action planning`,
      pros: ['Maintains momentum', 'Leverages fresh context'],
      cons: ['May need additional stakeholder input'],
      nextSteps: [
        'Review the synthesized context document with stakeholders',
        'Identify the highest-impact first action',
        'Set a timeline for execution',
      ],
    });
  }

  return {
    recommendations: recs,
    comparisonMarkdown: buildComparisonMarkdown(recs),
  };
}
