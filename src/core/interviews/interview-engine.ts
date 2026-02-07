/**
 * Oracle Core - Interview Engine
 *
 * Core interview flow logic - framework agnostic
 */

import {
  InterviewSession,
  Question,
  ProcessResult,
  ProgressInfo,
  IInterviewEngine,
  ResponseData
} from '../sessions/types';
import { getInterviewType } from '../types/index';

export class InterviewEngine implements IInterviewEngine {
  async getNextQuestion(session: InterviewSession): Promise<Question | null> {
    const interviewType = getInterviewType(session.interviewType);
    if (!interviewType) {
      throw new Error(`Invalid interview type: ${session.interviewType}`);
    }

    // Check if interview is complete
    if (session.currentStep >= interviewType.maxSteps) {
      return null;
    }

    // Return the question for the current step
    const question = interviewType.questions[session.currentStep];
    return question || null;
  }

  async processResponse(session: InterviewSession, response: any): Promise<ProcessResult> {
    const interviewType = getInterviewType(session.interviewType);
    if (!interviewType) {
      throw new Error(`Invalid interview type: ${session.interviewType}`);
    }

    const currentQuestion = interviewType.questions[session.currentStep];
    if (!currentQuestion) {
      return {
        success: false,
        completed: false,
        error: 'No current question found'
      };
    }

    // Validate response based on question type
    const validationResult = this.validateResponse(currentQuestion, response);
    if (!validationResult.valid) {
      return {
        success: false,
        completed: false,
        error: validationResult.error
      };
    }

    // Store the response
    const responseData: ResponseData = {
      response,
      metadata: {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        step: session.currentStep
      },
      timestamp: new Date().toISOString()
    };

    // Update session with response (this would be done by the caller)
    session.responses[currentQuestion.id] = responseData;
    session.currentStep += 1;
    session.updatedAt = new Date();

    // Check if interview is complete
    const completed = await this.checkCompletion(session);
    if (completed) {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    // Get next question
    const nextQuestion = completed ? null : await this.getNextQuestion(session);

    return {
      success: true,
      nextQuestion: nextQuestion || undefined,
      completed
    };
  }

  async checkCompletion(session: InterviewSession): Promise<boolean> {
    const interviewType = getInterviewType(session.interviewType);
    if (!interviewType) {
      return false;
    }

    // Check all completion criteria
    for (const criteria of interviewType.completionCriteria) {
      switch (criteria.type) {
        case 'step_limit_reached':
          if (session.currentStep >= interviewType.maxSteps) {
            return true;
          }
          break;

        case 'all_required_answered':
          const requiredQuestions = interviewType.questions
            .filter(q => q.required)
            .map(q => q.id);

          const answeredQuestions = Object.keys(session.responses);
          const allRequiredAnswered = requiredQuestions.every(qId =>
            answeredQuestions.includes(qId)
          );

          if (allRequiredAnswered && session.currentStep >= interviewType.questions.length) {
            return true;
          }
          break;

        case 'user_indicated_done':
          // Check if user response indicates they're done
          const lastResponse = Object.values(session.responses).pop();
          if (lastResponse && typeof lastResponse.response === 'string') {
            const response = lastResponse.response.toLowerCase();
            if (response.includes('done') || response.includes('finished') ||
                response.includes('complete') || response.includes('no more')) {
              return true;
            }
          }
          break;
      }
    }

    return false;
  }

  async getProgress(session: InterviewSession): Promise<ProgressInfo> {
    const interviewType = getInterviewType(session.interviewType);
    if (!interviewType) {
      throw new Error(`Invalid interview type: ${session.interviewType}`);
    }

    const completionPercentage = Math.min(
      Math.round((session.currentStep / interviewType.maxSteps) * 100),
      100
    );

    return {
      currentStep: session.currentStep,
      totalSteps: interviewType.maxSteps,
      completionPercentage
    };
  }

  private validateResponse(question: Question, response: any): { valid: boolean; error?: string } {
    // Required question check
    if (question.required && (response === null || response === undefined || response === '')) {
      return { valid: false, error: 'Response is required for this question' };
    }

    // Skip validation if not required and empty
    if (!question.required && (response === null || response === undefined || response === '')) {
      return { valid: true };
    }

    // Type-specific validation
    switch (question.type) {
      case 'text':
        if (typeof response !== 'string') {
          return { valid: false, error: 'Response must be text' };
        }
        break;

      case 'number':
        if (typeof response !== 'number' && !Number.isFinite(Number(response))) {
          return { valid: false, error: 'Response must be a number' };
        }
        break;

      case 'yes_no':
        if (!['yes', 'no', 'true', 'false', true, false].includes(response)) {
          return { valid: false, error: 'Response must be yes/no or true/false' };
        }
        break;

      case 'scale':
        const scaleValue = Number(response);
        if (!Number.isFinite(scaleValue)) {
          return { valid: false, error: 'Scale response must be a number' };
        }
        if (question.options && !question.options.includes(response.toString())) {
          return { valid: false, error: `Response must be one of: ${question.options.join(', ')}` };
        }
        break;

      case 'multiple_choice':
        if (question.options && !question.options.includes(response)) {
          return { valid: false, error: `Response must be one of: ${question.options.join(', ')}` };
        }
        break;

      case 'multiple_select':
        if (!Array.isArray(response)) {
          return { valid: false, error: 'Multiple select response must be an array' };
        }
        if (question.options) {
          const invalidOptions = response.filter(r => !question.options!.includes(r));
          if (invalidOptions.length > 0) {
            return { valid: false, error: `Invalid options: ${invalidOptions.join(', ')}` };
          }
        }
        break;

      case 'date':
        const dateValue = new Date(response);
        if (isNaN(dateValue.getTime())) {
          return { valid: false, error: 'Response must be a valid date' };
        }
        break;

      default:
        return { valid: false, error: `Unknown question type: ${question.type}` };
    }

    return { valid: true };
  }
}