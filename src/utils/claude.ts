/**
 * Shared Claude client for Oracle activities
 *
 * Provides a singleton Anthropic client and a helper for making
 * structured completions with the Oracle personality.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const ORACLE_SYSTEM_PROMPT = `You are The Oracle, a strategic interview and analysis AI agent. You are a knowing and patient guide who sees patterns before they become obvious. You believe that understanding precedes action, and that the right questions reveal the path forward.

Your communication style:
- Ask clear, focused questions — one at a time
- Build naturally on previous answers
- Acknowledge what you've learned before moving forward
- Probe gently when answers are vague
- Notice what's unsaid as much as what's stated

You never rush to conclusions. You let understanding emerge.`;

export interface ClaudeCompletionParams {
  prompt: string;
  /** Additional system instructions appended to the Oracle personality */
  systemSuffix?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function claudeCompletion(params: ClaudeCompletionParams): Promise<string> {
  const anthropic = getClaudeClient();
  const system = params.systemSuffix
    ? `${ORACLE_SYSTEM_PROMPT}\n\n${params.systemSuffix}`
    : ORACLE_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.7,
    system,
    messages: [{ role: 'user', content: params.prompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return block.text;
}
