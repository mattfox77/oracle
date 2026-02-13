/**
 * Oracle Settings Schema
 *
 * Defines all configurable settings for the Oracle service.
 * Used by the admin UI to render dynamic forms.
 */

import { SettingsSchema } from 'the-machina';

export const oracleSettingsSchema: SettingsSchema = {
  serviceName: 'oracle',
  version: '1.0.0',
  groups: [
    { key: 'ai', label: 'AI Configuration', description: 'Claude CLI and model settings' },
    { key: 'interview', label: 'Interview Settings', description: 'Controls for interview behavior' },
    { key: 'rate-limiting', label: 'Rate Limiting', description: 'API rate limiting configuration' }
  ],
  fields: [
    // AI Configuration
    {
      key: 'claude_model',
      label: 'Claude Model',
      type: 'select',
      group: 'ai',
      description: 'Model to use for interviews and analysis (passed to claude --model)',
      defaultValue: 'sonnet',
      options: [
        { label: 'Opus', value: 'opus' },
        { label: 'Sonnet (Recommended)', value: 'sonnet' },
        { label: 'Haiku', value: 'haiku' }
      ]
    },
    {
      key: 'claude_max_budget_usd',
      label: 'Max Budget per Call ($)',
      type: 'number',
      group: 'ai',
      description: 'Maximum dollar amount to spend per Claude CLI invocation',
      defaultValue: 1,
      validation: { min: 0.01, max: 10 }
    },

    // Interview Settings
    {
      key: 'max_interview_exchanges',
      label: 'Max Interview Exchanges',
      type: 'number',
      group: 'interview',
      description: 'Maximum number of back-and-forth exchanges per interview',
      defaultValue: 20,
      validation: { min: 1, max: 100 }
    },
    {
      key: 'interview_timeout_minutes',
      label: 'Interview Timeout (minutes)',
      type: 'number',
      group: 'interview',
      description: 'Auto-close interviews after this many minutes of inactivity',
      defaultValue: 60,
      validation: { min: 5, max: 1440 }
    },
    {
      key: 'auto_summarize',
      label: 'Auto-Summarize',
      type: 'boolean',
      group: 'interview',
      description: 'Automatically generate a summary when an interview completes',
      defaultValue: true
    },

    // Rate Limiting
    {
      key: 'rate_limit_window_ms',
      label: 'Rate Limit Window (ms)',
      type: 'number',
      group: 'rate-limiting',
      description: 'Time window for rate limiting in milliseconds',
      defaultValue: 60000,
      validation: { min: 1000, max: 3600000 }
    },
    {
      key: 'rate_limit_max_requests',
      label: 'Max Requests per Window',
      type: 'number',
      group: 'rate-limiting',
      description: 'Maximum requests allowed per time window',
      defaultValue: 100,
      validation: { min: 1, max: 10000 }
    }
  ]
};
