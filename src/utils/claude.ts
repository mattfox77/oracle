/**
 * Shared Claude client for Oracle activities
 *
 * Uses the Claude CLI (claude --print) for non-interactive completions
 * instead of the Anthropic SDK directly.
 */

import { execFile } from 'child_process';
import { withRetry, RetryConfigs } from 'the-machina';

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

/**
 * Run the Claude CLI in print mode and return the text output.
 */
function runClaude(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', args, {
      maxBuffer: 1024 * 1024,
      timeout: 5 * 60 * 1000,  // 5 minute timeout matching previous activity config
      env: {
        ...process.env,
        CLAUDECODE: '',  // unset to allow nested invocation
      },
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Claude CLI failed: ${error.message}${stderr ? ` — ${stderr}` : ''}`));
        return;
      }
      resolve(stdout);
    });

    // Send prompt on stdin
    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export async function claudeCompletion(params: ClaudeCompletionParams): Promise<string> {
  const system = params.systemSuffix
    ? `${ORACLE_SYSTEM_PROMPT}\n\n${params.systemSuffix}`
    : ORACLE_SYSTEM_PROMPT;

  const model = process.env.CLAUDE_MODEL || 'sonnet';

  const args = [
    '--print',
    '--model', model,
    '--system-prompt', system,
    '--output-format', 'text',
    '--no-session-persistence',
    '--dangerously-skip-permissions',
  ];

  if (params.maxTokens) {
    args.push('--max-budget-usd', '1');
  }

  const result = await withRetry(
    () => runClaude(args, params.prompt),
    RetryConfigs.anthropic()
  );

  return result.trim();
}
