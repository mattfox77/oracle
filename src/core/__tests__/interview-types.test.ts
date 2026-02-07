import {
  INTERVIEW_TYPES,
  getInterviewType,
  getAllInterviewTypes,
  isValidInterviewType,
  GeneralInterviewType,
  TenantScreeningInterviewType,
  CustomerOnboardingInterviewType,
  MaintenanceRequestInterviewType
} from '../types/index';

describe('Interview Types', () => {
  describe('type registry', () => {
    it('registers all 4 interview types', () => {
      const types = getAllInterviewTypes();
      expect(types).toHaveLength(4);
      expect(types).toContain('general');
      expect(types).toContain('tenant-screening');
      expect(types).toContain('customer-onboarding');
      expect(types).toContain('maintenance-request');
    });

    it('validates known types', () => {
      expect(isValidInterviewType('general')).toBe(true);
      expect(isValidInterviewType('tenant-screening')).toBe(true);
      expect(isValidInterviewType('customer-onboarding')).toBe(true);
      expect(isValidInterviewType('maintenance-request')).toBe(true);
    });

    it('rejects unknown types', () => {
      expect(isValidInterviewType('invalid')).toBe(false);
      expect(isValidInterviewType('')).toBe(false);
    });

    it('returns definitions by type', () => {
      expect(getInterviewType('general')).toBe(GeneralInterviewType);
      expect(getInterviewType('tenant-screening')).toBe(TenantScreeningInterviewType);
      expect(getInterviewType('invalid')).toBeNull();
    });
  });

  describe('GeneralInterviewType', () => {
    it('has 5 steps', () => {
      expect(GeneralInterviewType.maxSteps).toBe(5);
      expect(GeneralInterviewType.questions).toHaveLength(5);
    });

    it('has correct question types', () => {
      const types = GeneralInterviewType.questions.map(q => q.type);
      expect(types).toEqual(['text', 'scale', 'text', 'text', 'text']);
    });

    it('marks 4 required, 1 optional', () => {
      const required = GeneralInterviewType.questions.filter(q => q.required);
      expect(required.length).toBe(4);
    });

    it('has scale question with options', () => {
      const scale = GeneralInterviewType.questions.find(q => q.type === 'scale');
      expect(scale!.options).toEqual(['1', '2', '3', '4', '5']);
    });
  });

  describe('TenantScreeningInterviewType', () => {
    it('has 8 steps', () => {
      expect(TenantScreeningInterviewType.maxSteps).toBe(8);
      expect(TenantScreeningInterviewType.questions).toHaveLength(8);
    });

    it('has diverse question types', () => {
      const types = new Set(TenantScreeningInterviewType.questions.map(q => q.type));
      expect(types.has('text')).toBe(true);
      expect(types.has('multiple_choice')).toBe(true);
      expect(types.has('number')).toBe(true);
      expect(types.has('date')).toBe(true);
      expect(types.has('yes_no')).toBe(true);
    });

    it('all questions are required', () => {
      const required = TenantScreeningInterviewType.questions.filter(q => q.required);
      expect(required.length).toBe(8);
    });

    it('includes employment and financial questions', () => {
      const ids = TenantScreeningInterviewType.questions.map(q => q.id);
      expect(ids).toContain('employment_status');
      expect(ids).toContain('monthly_income');
    });
  });

  describe('MaintenanceRequestInterviewType', () => {
    it('has 7 steps', () => {
      expect(MaintenanceRequestInterviewType.maxSteps).toBe(7);
      expect(MaintenanceRequestInterviewType.questions).toHaveLength(7);
    });

    it('covers all required maintenance fields', () => {
      const ids = MaintenanceRequestInterviewType.questions.map(q => q.id);
      expect(ids).toContain('unit_identification');
      expect(ids).toContain('issue_description');
      expect(ids).toContain('issue_category');
      expect(ids).toContain('urgency_level');
      expect(ids).toContain('access_availability');
      expect(ids).toContain('contact_preference');
      expect(ids).toContain('photos_description');
    });

    it('has correct urgency options', () => {
      const urgency = MaintenanceRequestInterviewType.questions.find(q => q.id === 'urgency_level');
      expect(urgency!.options).toContain('Emergency (immediate)');
      expect(urgency!.options).toContain('Urgent (within 24 hours)');
    });

    it('has correct issue categories', () => {
      const category = MaintenanceRequestInterviewType.questions.find(q => q.id === 'issue_category');
      expect(category!.options).toContain('Plumbing');
      expect(category!.options).toContain('Electrical');
      expect(category!.options).toContain('HVAC');
    });

    it('has 6 required and 1 optional question', () => {
      const required = MaintenanceRequestInterviewType.questions.filter(q => q.required);
      const optional = MaintenanceRequestInterviewType.questions.filter(q => !q.required);
      expect(required.length).toBe(6);
      expect(optional.length).toBe(1);
      expect(optional[0].id).toBe('photos_description');
    });
  });

  describe('CustomerOnboardingInterviewType', () => {
    it('has 6 steps', () => {
      expect(CustomerOnboardingInterviewType.maxSteps).toBe(6);
      expect(CustomerOnboardingInterviewType.questions).toHaveLength(6);
    });

    it('has description', () => {
      expect(CustomerOnboardingInterviewType.description).toBeTruthy();
    });
  });

  describe('all interview types', () => {
    const allTypes = [
      GeneralInterviewType,
      TenantScreeningInterviewType,
      CustomerOnboardingInterviewType,
      MaintenanceRequestInterviewType
    ];

    it('all have completion criteria', () => {
      for (const type of allTypes) {
        expect(type.completionCriteria.length).toBeGreaterThan(0);
      }
    });

    it('all have unique question IDs per type', () => {
      for (const type of allTypes) {
        const ids = type.questions.map(q => q.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      }
    });

    it('all questions have text', () => {
      for (const type of allTypes) {
        for (const q of type.questions) {
          expect(q.text.length).toBeGreaterThan(0);
        }
      }
    });

    it('all have descriptions', () => {
      for (const type of allTypes) {
        expect(type.description).toBeDefined();
        expect(type.description.length).toBeGreaterThan(0);
      }
    });
  });
});
