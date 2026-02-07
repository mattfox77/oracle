/**
 * Oracle Core - General Interview Type
 *
 * General purpose interview for basic context gathering (5 steps)
 */

import { InterviewDefinition } from './types';

export const GeneralInterviewType: InterviewDefinition = {
  type: 'general',
  maxSteps: 5,
  description: 'General purpose interview for basic context gathering',
  questions: [
    {
      id: 'purpose',
      text: 'What brings you here today?',
      type: 'text',
      required: true,
      metadata: { category: 'intent' }
    },
    {
      id: 'experience',
      text: 'How would you rate your experience level with this type of interaction?',
      type: 'scale',
      required: true,
      options: ['1', '2', '3', '4', '5'],
      metadata: { category: 'experience', scale: '1-5' }
    },
    {
      id: 'goals',
      text: 'What are your primary goals for this interaction?',
      type: 'text',
      required: true,
      metadata: { category: 'objectives' }
    },
    {
      id: 'timeline',
      text: 'What is your preferred timeline for achieving these goals?',
      type: 'text',
      required: true,
      metadata: { category: 'timeline' }
    },
    {
      id: 'additional',
      text: 'Is there any additional information you would like to share?',
      type: 'text',
      required: false,
      metadata: { category: 'additional' }
    }
  ],
  completionCriteria: [
    { type: 'all_required_answered' },
    { type: 'step_limit_reached' }
  ]
};