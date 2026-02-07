/**
 * Oracle Core - Analysis Engine
 *
 * Interview analysis and scoring implementation
 */

import {
  InterviewSession,
  AnalysisResult,
  Recommendation,
  IAnalyzer
} from '../sessions/types';
import { getInterviewType } from '../types/index';

export class Analyzer implements IAnalyzer {
  async generateAnalysis(session: InterviewSession): Promise<AnalysisResult> {
    if (session.status !== 'completed') {
      throw new Error(`Cannot analyze incomplete session: ${session.id}`);
    }

    const score = await this.calculateScore(session);
    const insights = await this.extractInsights(session);
    const recommendations = await this.generateRecommendations(session);

    const completionTime = session.completedAt && session.createdAt
      ? session.completedAt.getTime() - session.createdAt.getTime()
      : 0;

    return {
      completionTime,
      responseCount: Object.keys(session.responses).length,
      completionRate: 1.0, // Completed sessions have 100% completion rate
      insights,
      score,
      recommendations
    };
  }

  async calculateScore(session: InterviewSession): Promise<number> {
    const interviewType = getInterviewType(session.interviewType);
    if (!interviewType) {
      return 0;
    }

    // Base scoring algorithm (can be enhanced with type-specific logic)
    let score = 0;

    // Response completeness (40% of score)
    const responseCount = Object.keys(session.responses).length;
    const maxQuestions = interviewType.maxSteps;
    const completenessScore = Math.min((responseCount / maxQuestions) * 40, 40);
    score += completenessScore;

    // Response quality (30% of score)
    const qualityScore = await this.calculateQualityScore(session);
    score += qualityScore;

    // Completion time (30% of score) - faster completion gets higher score
    const timeScore = await this.calculateTimeScore(session);
    score += timeScore;

    return Math.round(Math.min(score, 100));
  }

  async extractInsights(session: InterviewSession): Promise<string[]> {
    const insights: string[] = [];
    const interviewType = getInterviewType(session.interviewType);

    if (!interviewType) {
      return insights;
    }

    // Generic insights based on session data
    const responseCount = Object.keys(session.responses).length;
    const completionTime = session.completedAt && session.createdAt
      ? session.completedAt.getTime() - session.createdAt.getTime()
      : 0;

    if (responseCount === interviewType.maxSteps) {
      insights.push('Completed all interview questions');
    } else {
      insights.push(`Completed ${responseCount} of ${interviewType.maxSteps} questions`);
    }

    if (completionTime > 0) {
      const minutes = Math.round(completionTime / (1000 * 60));
      if (minutes < 5) {
        insights.push('Completed interview quickly, indicating clear objectives');
      } else if (minutes > 30) {
        insights.push('Took considerable time, suggesting thoughtful consideration');
      } else {
        insights.push('Completed interview at a normal pace');
      }
    }

    // Type-specific insights
    switch (session.interviewType) {
      case 'tenant-screening':
        insights.push(...await this.extractTenantScreeningInsights(session));
        break;
      case 'maintenance-request':
        insights.push(...await this.extractMaintenanceInsights(session));
        break;
      case 'customer-onboarding':
        insights.push(...await this.extractOnboardingInsights(session));
        break;
      case 'general':
        insights.push(...await this.extractGeneralInsights(session));
        break;
    }

    return insights;
  }

  private async calculateQualityScore(session: InterviewSession): Promise<number> {
    let qualityPoints = 0;
    let totalResponses = 0;

    for (const [questionId, response] of Object.entries(session.responses)) {
      totalResponses++;

      // Points for non-empty responses
      if (response.response && response.response.toString().trim().length > 0) {
        qualityPoints += 2;
      }

      // Bonus points for detailed responses (text responses > 20 characters)
      if (typeof response.response === 'string' && response.response.length > 20) {
        qualityPoints += 1;
      }

      // Bonus points for specific response types
      if (Array.isArray(response.response) && response.response.length > 1) {
        qualityPoints += 1; // Multiple selections show engagement
      }
    }

    // Calculate percentage (max 3 points per response = 30 total)
    const maxPossiblePoints = totalResponses * 3;
    return maxPossiblePoints > 0 ? Math.min((qualityPoints / maxPossiblePoints) * 30, 30) : 0;
  }

  private async calculateTimeScore(session: InterviewSession): Promise<number> {
    const completionTime = session.completedAt && session.createdAt
      ? session.completedAt.getTime() - session.createdAt.getTime()
      : 0;

    if (completionTime === 0) {
      return 15; // Default score if no time data
    }

    const minutes = completionTime / (1000 * 60);

    // Optimal time range: 5-15 minutes gets full points
    if (minutes >= 5 && minutes <= 15) {
      return 30;
    }

    // Less than 5 minutes - might be rushed
    if (minutes < 5) {
      return Math.max(10, 30 - (5 - minutes) * 4);
    }

    // More than 15 minutes - diminishing returns
    if (minutes > 15) {
      return Math.max(10, 30 - (minutes - 15) * 2);
    }

    return 15;
  }

  private async extractTenantScreeningInsights(session: InterviewSession): Promise<string[]> {
    const insights: string[] = [];
    const responses = session.responses;

    if (responses.employment_status) {
      const employment = responses.employment_status.response;
      if (employment === 'Employed full-time') {
        insights.push('Stable employment status');
      } else if (employment === 'Self-employed') {
        insights.push('Self-employed - may require additional income verification');
      }
    }

    if (responses.monthly_income) {
      const income = Number(responses.monthly_income.response);
      if (income > 5000) {
        insights.push('Strong financial profile');
      } else if (income < 2000) {
        insights.push('May need additional financial documentation');
      }
    }

    if (responses.rental_history) {
      const history = responses.rental_history.response.toString().toLowerCase();
      if (history.includes('no') || history.includes('first time')) {
        insights.push('First-time renter - may need additional references');
      }
    }

    return insights;
  }

  private async extractMaintenanceInsights(session: InterviewSession): Promise<string[]> {
    const insights: string[] = [];
    const responses = session.responses;

    if (responses.urgency_level) {
      const urgency = responses.urgency_level.response;
      if (urgency === 'Emergency (immediate)') {
        insights.push('Emergency request - immediate attention required');
      } else if (urgency === 'Urgent (within 24 hours)') {
        insights.push('Urgent request - prioritize scheduling');
      }
    }

    if (responses.issue_category) {
      const category = responses.issue_category.response;
      insights.push(`${category} maintenance request identified`);

      if (category === 'Plumbing' || category === 'Electrical') {
        insights.push('May require specialized technician');
      }
    }

    return insights;
  }

  private async extractOnboardingInsights(session: InterviewSession): Promise<string[]> {
    const insights: string[] = [];
    const responses = session.responses;

    if (responses.urgency) {
      const urgencyScore = Number(responses.urgency.response);
      if (urgencyScore >= 4) {
        insights.push('High urgency customer - prioritize follow-up');
      }
    }

    if (responses.welcome) {
      const source = responses.welcome.response;
      insights.push(`Acquired via ${source.toLowerCase()}`);
    }

    if (responses.budget_range) {
      const budget = responses.budget_range.response;
      if (budget === 'Over $5000') {
        insights.push('High-value customer prospect');
      } else if (budget === 'Not sure') {
        insights.push('May need budget discussion and guidance');
      }
    }

    return insights;
  }

  private async extractGeneralInsights(session: InterviewSession): Promise<string[]> {
    const insights: string[] = [];
    const responses = session.responses;

    if (responses.experience) {
      const experienceLevel = Number(responses.experience.response);
      if (experienceLevel <= 2) {
        insights.push('New to this type of interaction - may need additional guidance');
      } else if (experienceLevel >= 4) {
        insights.push('Experienced user - can handle advanced topics');
      }
    }

    if (responses.goals) {
      const goals = responses.goals.response.toString();
      if (goals.length > 50) {
        insights.push('Clear and detailed goals provided');
      }
    }

    return insights;
  }

  private async generateRecommendations(session: InterviewSession): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const insights = await this.extractInsights(session);

    // Generate recommendations based on interview type and insights
    switch (session.interviewType) {
      case 'tenant-screening':
        recommendations.push({
          title: 'Review Application',
          rationale: 'Complete tenant screening interview ready for review',
          nextSteps: ['Verify employment information', 'Check references', 'Review financial documents'],
          priority: 'high'
        });
        break;

      case 'maintenance-request':
        const urgencyInsight = insights.find(i => i.includes('Emergency') || i.includes('Urgent'));
        const priority = urgencyInsight ? 'high' : 'medium';

        recommendations.push({
          title: 'Schedule Maintenance',
          rationale: 'Maintenance request details collected and categorized',
          nextSteps: ['Assign appropriate technician', 'Schedule access time', 'Prepare required tools/parts'],
          priority,
          agentToExecute: 'Agent Smith'
        });
        break;

      case 'customer-onboarding':
        recommendations.push({
          title: 'Follow-up Contact',
          rationale: 'Customer onboarding information collected',
          nextSteps: ['Prepare service proposal', 'Schedule follow-up call', 'Send welcome materials'],
          priority: 'medium'
        });
        break;

      case 'general':
        recommendations.push({
          title: 'Process Context',
          rationale: 'General context gathering completed successfully',
          nextSteps: ['Review responses for key themes', 'Identify next best action', 'Schedule appropriate follow-up'],
          priority: 'medium'
        });
        break;
    }

    return recommendations;
  }
}