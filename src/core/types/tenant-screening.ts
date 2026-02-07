/**
 * Oracle Core - Tenant Screening Interview Type
 *
 * Apartment rental qualification interview (8 steps)
 */

import { InterviewDefinition } from './types';

export const TenantScreeningInterviewType: InterviewDefinition = {
  type: 'tenant-screening',
  maxSteps: 8,
  description: 'Apartment rental qualification and tenant screening process',
  questions: [
    {
      id: 'contact_info',
      text: 'Please provide your full name and contact information.',
      type: 'text',
      required: true,
      metadata: { category: 'identification' }
    },
    {
      id: 'employment_status',
      text: 'What is your current employment status?',
      type: 'multiple_choice',
      required: true,
      options: ['Employed full-time', 'Employed part-time', 'Self-employed', 'Student', 'Retired', 'Unemployed'],
      metadata: { category: 'employment' }
    },
    {
      id: 'monthly_income',
      text: 'What is your gross monthly income?',
      type: 'number',
      required: true,
      metadata: { category: 'financial' }
    },
    {
      id: 'rental_history',
      text: 'Do you have previous rental experience? If yes, please describe.',
      type: 'text',
      required: true,
      metadata: { category: 'history' }
    },
    {
      id: 'reason_for_moving',
      text: 'What is your primary reason for moving?',
      type: 'multiple_choice',
      required: true,
      options: ['Job relocation', 'Upgrading space', 'Downsizing', 'Financial reasons', 'Lifestyle change', 'Other'],
      metadata: { category: 'motivation' }
    },
    {
      id: 'preferred_move_date',
      text: 'When would you like to move in?',
      type: 'date',
      required: true,
      metadata: { category: 'timeline' }
    },
    {
      id: 'pets',
      text: 'Do you have any pets? If yes, please provide details.',
      type: 'text',
      required: true,
      metadata: { category: 'lifestyle' }
    },
    {
      id: 'references',
      text: 'Can you provide references from previous landlords or employers?',
      type: 'yes_no',
      required: true,
      metadata: { category: 'verification' }
    }
  ],
  completionCriteria: [
    { type: 'all_required_answered' },
    { type: 'step_limit_reached' }
  ]
};