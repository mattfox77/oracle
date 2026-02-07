/**
 * Oracle Core - Interview Types Index
 *
 * Central registry for all interview types
 */

export * from './types';
export { GeneralInterviewType } from './general';
export { TenantScreeningInterviewType } from './tenant-screening';
export { CustomerOnboardingInterviewType } from './customer-onboarding';
export { MaintenanceRequestInterviewType } from './maintenance-request';

import { InterviewDefinition, InterviewTypeRegistry } from './types';
import { GeneralInterviewType } from './general';
import { TenantScreeningInterviewType } from './tenant-screening';
import { CustomerOnboardingInterviewType } from './customer-onboarding';
import { MaintenanceRequestInterviewType } from './maintenance-request';

/**
 * Global registry of all available interview types
 */
export const INTERVIEW_TYPES: InterviewTypeRegistry = {
  'general': GeneralInterviewType,
  'tenant-screening': TenantScreeningInterviewType,
  'customer-onboarding': CustomerOnboardingInterviewType,
  'maintenance-request': MaintenanceRequestInterviewType
};

/**
 * Get interview definition by type
 */
export function getInterviewType(type: string): InterviewDefinition | null {
  return INTERVIEW_TYPES[type] || null;
}

/**
 * Get all available interview types
 */
export function getAllInterviewTypes(): string[] {
  return Object.keys(INTERVIEW_TYPES);
}

/**
 * Validate if interview type exists
 */
export function isValidInterviewType(type: string): boolean {
  return type in INTERVIEW_TYPES;
}