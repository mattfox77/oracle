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
    { key: 'ai', label: 'AI Configuration', description: 'API keys and model settings for AI providers' },
    { key: 'interview', label: 'Interview Settings', description: 'Controls for interview behavior' },
    { key: 'rate-limiting', label: 'Rate Limiting', description: 'API rate limiting configuration' }
  ],
  fields: [
    // AI Configuration
    {
      key: 'anthropic_api_key',
      label: 'Anthropic API Key',
      type: 'password',
      group: 'ai',
      description: 'API key for the Anthropic Claude API',
      required: true,
      sensitive: true,
      placeholder: 'sk-ant-...'
    },
    {
      key: 'anthropic_model',
      label: 'Default Model',
      type: 'select',
      group: 'ai',
      description: 'Claude model to use for interviews and analysis',
      defaultValue: 'claude-sonnet-4-5-20250929',
      options: [
        { label: 'Claude Opus 4', value: 'claude-opus-4-0-20250514' },
        { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
        { label: 'Claude Haiku 3.5', value: 'claude-haiku-4-5-20251001' }
      ]
    },
    {
      key: 'max_tokens',
      label: 'Max Tokens',
      type: 'number',
      group: 'ai',
      description: 'Maximum tokens per AI response',
      defaultValue: 4096,
      validation: { min: 256, max: 32768 }
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
