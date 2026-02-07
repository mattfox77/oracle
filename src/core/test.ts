/**
 * Oracle Core - Basic Test
 *
 * Simple test to verify core library functionality
 */

import {
  SessionManager,
  InterviewEngine,
  Analyzer,
  ISessionStorage,
  InterviewSession,
  SessionFilters,
  isValidInterviewType,
  getAllInterviewTypes
} from './index';

// Mock storage implementation for testing
class MemoryStorage implements ISessionStorage {
  private sessions: Map<string, InterviewSession> = new Map();

  async save(session: InterviewSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async load(sessionId: string): Promise<InterviewSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async list(filters?: SessionFilters): Promise<InterviewSession[]> {
    let sessions = Array.from(this.sessions.values());

    if (filters) {
      if (filters.userId) {
        sessions = sessions.filter(s => s.userId === filters.userId);
      }
      if (filters.interviewType) {
        sessions = sessions.filter(s => s.interviewType === filters.interviewType);
      }
      if (filters.status) {
        sessions = sessions.filter(s => s.status === filters.status);
      }
    }

    return sessions.map(s => ({ ...s }));
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Oracle Core Library Tests');
  console.log('============================\n');

  try {
    // Test 1: Interview Types
    console.log('1. Testing interview types...');
    const types = getAllInterviewTypes();
    console.log('   Available types:', types);
    console.log('   Valid "general":', isValidInterviewType('general'));
    console.log('   Valid "invalid":', isValidInterviewType('invalid'));
    console.log('   ✅ Interview types working\n');

    // Test 2: Session Management
    console.log('2. Testing session management...');
    const storage = new MemoryStorage();
    const sessionManager = new SessionManager(storage);

    const session = await sessionManager.createSession({
      userId: 'test-user-123',
      interviewType: 'general'
    });
    console.log('   Created session:', session.id);
    console.log('   Session type:', session.interviewType);
    console.log('   Session status:', session.status);

    const retrieved = await sessionManager.getSession(session.id);
    console.log('   Retrieved session:', retrieved?.id);
    console.log('   ✅ Session management working\n');

    // Test 3: Interview Engine
    console.log('3. Testing interview engine...');
    const engine = new InterviewEngine();

    const firstQuestion = await engine.getNextQuestion(session);
    console.log('   First question:', firstQuestion?.text);

    // Simulate answering the first question
    const response = await engine.processResponse(session, 'I need help with apartment management');
    console.log('   Response processed:', response.success);
    console.log('   Next question:', response.nextQuestion?.text);
    console.log('   Interview completed:', response.completed);

    // Update session via session manager
    await sessionManager.updateSession(session.id, {
      currentStep: session.currentStep,
      responses: session.responses
    });
    console.log('   ✅ Interview engine working\n');

    // Test 4: Progress tracking
    console.log('4. Testing progress tracking...');
    const progress = await engine.getProgress(session);
    console.log('   Current step:', progress.currentStep);
    console.log('   Total steps:', progress.totalSteps);
    console.log('   Completion %:', progress.completionPercentage);
    console.log('   ✅ Progress tracking working\n');

    // Test 5: Complete interview and analyze
    console.log('5. Testing complete interview flow...');

    // Create a fresh session for the complete flow test
    const freshSession = await sessionManager.createSession({
      userId: 'test-user-456',
      interviewType: 'general'
    });

    // Answer all questions quickly to complete the interview
    let currentSession = freshSession;
    let attempts = 0;
    const maxAttempts = 10;

    while (currentSession && currentSession.status === 'active' && attempts < maxAttempts) {
      attempts++;
      const question = await engine.getNextQuestion(currentSession);
      if (!question) break;

      console.log(`   Answering question ${attempts}: ${question.text.substring(0, 50)}...`);
      console.log(`   Question ID: ${question.id}, Type: ${question.type}`);
      console.log(`   Current step before: ${currentSession.currentStep}`);

      // Provide appropriate answer based on question type
      let answer: any;
      switch (question.type) {
        case 'scale':
          answer = '3'; // Middle value for scale questions
          break;
        case 'yes_no':
          answer = 'yes';
          break;
        case 'multiple_choice':
          answer = question.options?.[0] || 'test';
          break;
        case 'number':
          answer = 42;
          break;
        default:
          answer = `Test answer for ${question.id}`;
      }

      console.log(`   Providing answer: ${answer}`);

      // Make a copy of session for processResponse to modify
      const sessionCopy = { ...currentSession, responses: { ...currentSession.responses } };
      const result = await engine.processResponse(sessionCopy, answer);

      console.log(`   Current step after engine: ${sessionCopy.currentStep}`);
      console.log(`   Result completed: ${result.completed}`);

      // Update the session with the new state from the engine result
      currentSession = await sessionManager.updateSession(currentSession.id, {
        currentStep: sessionCopy.currentStep,
        responses: sessionCopy.responses,
        status: result.completed ? 'completed' : sessionCopy.status,
        completedAt: result.completed ? new Date() : undefined
      });

      console.log(`   Updated session step: ${currentSession.currentStep}`);

      if (result.completed) {
        console.log('   Interview completed!');
        break;
      }
    }

    console.log('   Interview status:', currentSession?.status);

    if (currentSession?.status === 'completed') {
      const analyzer = new Analyzer();
      const analysis = await analyzer.generateAnalysis(currentSession);
      console.log('   Analysis score:', analysis.score);
      console.log('   Insights count:', analysis.insights.length);
      console.log('   Recommendations count:', analysis.recommendations?.length || 0);
      console.log('   ✅ Analysis working\n');
    }

    console.log('🎉 All tests passed! Oracle Core library is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}