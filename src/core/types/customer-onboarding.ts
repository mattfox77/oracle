/**
 * Oracle Core - Customer Onboarding Interview Type
 *
 * New customer onboarding process (6 steps)
 */

import { InterviewDefinition } from './types';

export const CustomerOnboardingInterviewType: InterviewDefinition = {
  type: 'customer-onboarding',
  maxSteps: 6,
  description: 'New customer onboarding and preference gathering process',
  questions: [
    {
      id: 'welcome',
      text: 'Welcome! How did you hear about our services?',
      type: 'multiple_choice',
      required: true,
      options: ['Search engine', 'Social media', 'Referral from friend', 'Advertisement', 'Website', 'Other'],
      metadata: { category: 'acquisition' }
    },
    {
      id: 'primary_need',
      text: 'What is your primary need or interest in our services?',
      type: 'text',
      required: true,
      metadata: { category: 'intent' }
    },
    {
      id: 'urgency',
      text: 'How urgent is your need for our services?',
      type: 'scale',
      required: true,
      options: ['1', '2', '3', '4', '5'],
      metadata: { category: 'urgency', scale: '1-5 (1=low, 5=urgent)' }
    },
    {
      id: 'budget_range',
      text: 'What is your budget range for this service?',
      type: 'multiple_choice',
      required: true,
      options: ['Under $500', '$500-$1000', '$1000-$2500', '$2500-$5000', 'Over $5000', 'Not sure'],
      metadata: { category: 'budget' }
    },
    {
      id: 'communication_preference',
      text: 'What is your preferred method of communication?',
      type: 'multiple_select',
      required: true,
      options: ['Email', 'Phone', 'Text message', 'Video call', 'In-person meeting'],
      metadata: { category: 'communication' }
    },
    {
      id: 'questions',
      text: 'Do you have any questions about our services or the onboarding process?',
      type: 'text',
      required: false,
      metadata: { category: 'questions' }
    }
  ],
  completionCriteria: [
    { type: 'all_required_answered' },
    { type: 'step_limit_reached' }
  ]
};