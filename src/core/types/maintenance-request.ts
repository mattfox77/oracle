/**
 * Oracle Core - Maintenance Request Interview Type
 *
 * Apartment maintenance request gathering process (7 steps)
 */

import { InterviewDefinition } from './types';

export const MaintenanceRequestInterviewType: InterviewDefinition = {
  type: 'maintenance-request',
  maxSteps: 7,
  description: 'Apartment maintenance request gathering and classification process',
  questions: [
    {
      id: 'unit_identification',
      text: 'Please provide your unit number and building address.',
      type: 'text',
      required: true,
      metadata: { category: 'location' }
    },
    {
      id: 'issue_description',
      text: 'Please describe the maintenance issue in detail.',
      type: 'text',
      required: true,
      metadata: { category: 'description' }
    },
    {
      id: 'issue_category',
      text: 'What type of maintenance issue is this?',
      type: 'multiple_choice',
      required: true,
      options: ['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Structural', 'Pest control', 'Other'],
      metadata: { category: 'classification' }
    },
    {
      id: 'urgency_level',
      text: 'How urgent is this maintenance request?',
      type: 'multiple_choice',
      required: true,
      options: ['Emergency (immediate)', 'Urgent (within 24 hours)', 'Normal (within a week)', 'Low priority (when convenient)'],
      metadata: { category: 'urgency' }
    },
    {
      id: 'access_availability',
      text: 'When are you available to provide access to maintenance staff?',
      type: 'text',
      required: true,
      metadata: { category: 'scheduling' }
    },
    {
      id: 'contact_preference',
      text: 'How would you prefer to be contacted about this request?',
      type: 'multiple_choice',
      required: true,
      options: ['Phone call', 'Text message', 'Email', 'In-person visit'],
      metadata: { category: 'communication' }
    },
    {
      id: 'photos_description',
      text: 'Would you be able to provide photos of the issue to help maintenance staff prepare?',
      type: 'yes_no',
      required: false,
      metadata: { category: 'documentation' }
    }
  ],
  completionCriteria: [
    { type: 'all_required_answered' },
    { type: 'step_limit_reached' }
  ]
};