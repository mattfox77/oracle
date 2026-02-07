import { validateCreateSessionParams, validateSessionId, validateUserId } from '../utils/validation';

describe('Validation utilities', () => {
  describe('validateCreateSessionParams', () => {
    it('accepts valid params', () => {
      const result = validateCreateSessionParams({
        userId: 'user-1',
        interviewType: 'general'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing userId', () => {
      const result = validateCreateSessionParams({
        userId: '',
        interviewType: 'general'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('userId is required and must be a string');
    });

    it('rejects missing interviewType', () => {
      const result = validateCreateSessionParams({
        userId: 'user-1',
        interviewType: ''
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid interview type', () => {
      const result = validateCreateSessionParams({
        userId: 'user-1',
        interviewType: 'nonexistent'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid interview type');
    });

    it('accepts valid initialContext', () => {
      const result = validateCreateSessionParams({
        userId: 'user-1',
        interviewType: 'general',
        initialContext: { key: 'value' }
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-object initialContext', () => {
      const result = validateCreateSessionParams({
        userId: 'user-1',
        interviewType: 'general',
        initialContext: 'not an object' as any
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('initialContext must be an object');
    });
  });

  describe('validateSessionId', () => {
    it('accepts valid session ID', () => {
      const result = validateSessionId('abc-123');
      expect(result.valid).toBe(true);
    });

    it('rejects empty session ID', () => {
      const result = validateSessionId('');
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only session ID', () => {
      const result = validateSessionId('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateUserId', () => {
    it('accepts valid user ID', () => {
      const result = validateUserId('user-123');
      expect(result.valid).toBe(true);
    });

    it('rejects empty user ID', () => {
      const result = validateUserId('');
      expect(result.valid).toBe(false);
    });
  });
});
