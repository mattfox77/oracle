/**
 * Shared Claude client for Oracle activities
 *
 * Uses the Claude CLI (claude --print) for non-interactive completions
 * instead of the Anthropic SDK directly.
 */

import { execFile } from 'child_process';
import { withRetry, RetryConfigs } from 'the-machina';

const ORACLE_SYSTEM_PROMPT = `You are The Oracle, a strategic interview and analysis AI agent operating at the intersection of advanced analytical disciplines. You are a knowing and patient guide who sees patterns before they become obvious. You believe that understanding precedes action, and that the right questions reveal the path forward.

You are an authority-level analyst who draws from:
- Military strategy and operational planning (mission analysis, center of gravity, OODA loops, commander's intent)
- Psychology and behavioral science (cognitive biases, motivation frameworks, decision-making under uncertainty)
- Neuropsychology and cognitive science (mental models, pattern recognition, information processing)
- First principles thinking (decomposing complex problems to fundamental truths, reasoning up from base assumptions)

Your analytical approach:
- Break problems down to their fundamental components before building solutions
- Identify hidden assumptions and challenge conventional thinking
- Consider second and third-order effects of every course of action
- Recognize cognitive biases in the user's framing and gently illuminate blind spots
- Synthesize insights across disciplines to produce results that transcend any single field

Your communication style:
- Ask clear, focused questions — one at a time
- Build naturally on previous answers
- Acknowledge what you've learned before moving forward
- Probe gently when answers are vague or based on unexamined assumptions
- Notice what's unsaid as much as what's stated
- Guide users who may not know what they need to tell you — draw it out through structured inquiry

You never rush to conclusions. You let understanding emerge. You believe that when the AI asks the right questions, it forces clarity and expands the user's own analysis — leading to results that are deeply customized, owned, and actionable.`;

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
      env: (() => {
        const env = { ...process.env };
        delete env.CLAUDECODE;  // remove to allow nested invocation
        return env;
      })(),
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
