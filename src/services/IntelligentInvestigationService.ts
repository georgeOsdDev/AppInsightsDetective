/**
 * AI-Driven Intelligent Investigation Service
 * Core orchestration engine for automated Application Insights problem analysis
 */
import { 
  IIntelligentInvestigationService, 
  IAIProvider, 
  IDataSourceProvider,
  ISessionManager,
  IQuerySession
} from '../core/interfaces';
import { 
  InvestigationRequest,
  InvestigationResponse,
  InvestigationPlan,
  InvestigationType,
  InvestigationContext,
  InvestigationResult,
  InvestigationProblem,
  InvestigationPhase,
  InvestigationQuery,
  InvestigationEvidence,
  InvestigationProgress,
  RootCauseAnalysis,
  InvestigationRecommendations
} from '../types/investigation';
import { QueryResult, SupportedLanguage } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Investigation prompt templates for different problem types
 */
const INVESTIGATION_PROMPTS = {
  classification: {
    system: `You are an expert in Application Insights and system monitoring. Classify the following problem description into one of these categories:
- performance: slow response times, high latency, throughput issues
- availability: service outages, 500 errors, downtime, failures
- data-quality: missing data, data inconsistencies, incomplete telemetry
- dependencies: external service failures, third-party issues, connection problems

Return a JSON response with: {"type": "category", "confidence": 0.0-1.0, "reasoning": "explanation"}`,
    user: (description: string) => `Classify this problem: "${description}"`
  },
  
  planning: {
    performance: `Create a systematic investigation plan for a performance issue. Generate phases with KQL queries for Application Insights data.

Focus on:
1. Baseline performance metrics
2. Response time analysis
3. Dependency performance
4. Resource utilization
5. Error correlation

Return JSON with phases containing queries with realistic KQL.`,
    
    availability: `Create a systematic investigation plan for an availability issue. Generate phases with KQL queries for Application Insights data.

Focus on:
1. Error rate analysis
2. Success rate trends
3. Service health checks
4. Downtime timeline
5. Impact assessment

Return JSON with phases containing queries with realistic KQL.`,
    
    'data-quality': `Create a systematic investigation plan for a data quality issue. Generate phases with KQL queries for Application Insights data.

Focus on:
1. Data completeness analysis
2. Missing telemetry detection
3. Data consistency checks
4. Sampling rate issues
5. Schema validation

Return JSON with phases containing queries with realistic KQL.`,
    
    dependencies: `Create a systematic investigation plan for a dependency issue. Generate phases with KQL queries for Application Insights data.

Focus on:
1. Dependency call analysis
2. External service health
3. Connection failure patterns
4. Timeout analysis
5. Retry behavior

Return JSON with phases containing queries with realistic KQL.`
  }
};

export class IntelligentInvestigationService implements IIntelligentInvestigationService {
  private investigations: Map<string, InvestigationContext> = new Map();
  private results: Map<string, InvestigationResult> = new Map();
  private plans: Map<string, InvestigationPlan> = new Map(); // Add plan storage for testing

  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider,
    private sessionManager: ISessionManager
  ) {}

  async startInvestigation(request: InvestigationRequest): Promise<InvestigationResponse> {
    logger.info('IntelligentInvestigationService: Starting new investigation');
    
    try {
      const investigationId = uuidv4();
      
      // Classify the problem if type not provided
      let problemType = request.problem.type;
      if (!problemType) {
        const classification = await this.classifyProblem(request.problem.description);
        problemType = classification.type;
        logger.info(`Problem classified as: ${problemType} (confidence: ${classification.confidence})`);
      }

      // Generate investigation plan
      const plan = await this.generateInvestigationPlan({
        ...request.problem,
        type: problemType
      });

      // Create session for this investigation
      const session = await this.sessionManager.createSession({
        language: request.options?.language || 'en',
        defaultMode: 'direct'
      });

      // Create investigation context
      const context: InvestigationContext = {
        planId: plan.id,
        sessionId: session.sessionId,
        evidence: [],
        progress: {
          totalPhases: plan.phases.length,
          completedPhases: 0,
          totalQueries: plan.phases.reduce((sum, phase) => sum + phase.queries.length, 0),
          completedQueries: 0,
          failedQueries: 0,
          skippedQueries: 0,
          currentStatus: 'created',
          completionPercentage: 0
        },
        startedAt: new Date(),
        lastUpdatedAt: new Date()
      };

      this.investigations.set(investigationId, context);
      this.plans.set(plan.id, plan); // Store plan for later retrieval

      logger.info(`Investigation started: ${investigationId}`);

      return {
        investigationId,
        status: 'in-progress',
        plan,
        progress: context.progress,
        nextAction: {
          type: request.options?.interactive ? 'confirm' : 'wait',
          message: request.options?.interactive 
            ? `Investigation plan generated with ${plan.phases.length} phases. Would you like to proceed?`
            : 'Investigation started and running automatically.',
          options: request.options?.interactive ? ['Yes, proceed', 'Review plan', 'Cancel'] : undefined
        }
      };

    } catch (error) {
      logger.error('Failed to start investigation:', error);
      throw new Error(`Investigation startup failed: ${error}`);
    }
  }

  async continueInvestigation(investigationId: string, input?: string): Promise<InvestigationResponse> {
    logger.info(`Continuing investigation: ${investigationId}`);
    
    const context = this.investigations.get(investigationId);
    if (!context) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    try {
      // Get the plan (in a real implementation, this would be stored persistently)
      const plan = await this.getStoredPlan(context.planId);
      
      // Execute the next phase
      const nextPhase = this.getNextPhaseToExecute(plan, context);
      if (!nextPhase) {
        // Investigation completed
        const result = await this.completeInvestigation(investigationId, plan, context);
        this.results.set(investigationId, result);
        
        return {
          investigationId,
          status: 'completed',
          result,
          progress: context.progress,
          nextAction: {
            type: 'complete',
            message: 'Investigation completed successfully!'
          }
        };
      }

      // Execute queries in the current phase
      context.currentPhaseId = nextPhase.id;
      await this.executePhase(nextPhase, context, plan);
      
      // Update progress
      context.progress.completedPhases++;
      context.progress.completionPercentage = (context.progress.completedPhases / context.progress.totalPhases) * 100;
      context.lastUpdatedAt = new Date();

      return {
        investigationId,
        status: 'in-progress',
        progress: context.progress,
        nextAction: {
          type: 'wait',
          message: `Completed phase: ${nextPhase.name}. Continuing with next phase...`
        }
      };

    } catch (error) {
      logger.error(`Investigation continuation failed:`, error);
      throw new Error(`Investigation continuation failed: ${error}`);
    }
  }

  async getInvestigationStatus(investigationId: string): Promise<InvestigationResponse> {
    const context = this.investigations.get(investigationId);
    const result = this.results.get(investigationId);
    
    if (!context && !result) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    if (result) {
      return {
        investigationId,
        status: 'completed',
        result,
        progress: result.context.progress
      };
    }

    return {
      investigationId,
      status: context!.progress.currentStatus,
      progress: context!.progress
    };
  }

  async pauseInvestigation(investigationId: string): Promise<void> {
    const context = this.investigations.get(investigationId);
    if (!context) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }
    context.progress.currentStatus = 'paused';
    logger.info(`Investigation paused: ${investigationId}`);
  }

  async resumeInvestigation(investigationId: string): Promise<InvestigationResponse> {
    const context = this.investigations.get(investigationId);
    if (!context) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }
    context.progress.currentStatus = 'in-progress';
    logger.info(`Investigation resumed: ${investigationId}`);
    
    return this.continueInvestigation(investigationId);
  }

  async cancelInvestigation(investigationId: string): Promise<void> {
    const context = this.investigations.get(investigationId);
    if (!context) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }
    
    context.progress.currentStatus = 'failed';
    await this.sessionManager.endSession(context.sessionId);
    this.investigations.delete(investigationId);
    
    // Clean up stored plan
    if (context.planId) {
      this.plans.delete(context.planId);
    }
    
    logger.info(`Investigation cancelled: ${investigationId}`);
  }

  async getInvestigationHistory(): Promise<InvestigationResult[]> {
    return Array.from(this.results.values());
  }

  async classifyProblem(description: string): Promise<{
    type: InvestigationType;
    confidence: number;
    reasoning: string;
  }> {
    logger.info('Classifying problem type using AI');
    
    try {
      const response = await this.aiProvider.generateResponse(
        `${INVESTIGATION_PROMPTS.classification.system}\n\n${INVESTIGATION_PROMPTS.classification.user(description)}`
      );

      const parsed = JSON.parse(response);
      return {
        type: parsed.type as InvestigationType,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      logger.warn('Problem classification failed, defaulting to performance type:', error);
      return {
        type: 'performance',
        confidence: 0.5,
        reasoning: 'Classification failed, defaulted to performance investigation'
      };
    }
  }

  async generateInvestigationPlan(problem: InvestigationProblem): Promise<InvestigationPlan> {
    logger.info(`Generating investigation plan for type: ${problem.type}`);
    
    try {
      const promptTemplate = INVESTIGATION_PROMPTS.planning[problem.type || 'performance'];
      const planPrompt = `${promptTemplate}\n\nProblem: ${problem.description}\n\nReturn a detailed investigation plan as JSON.`;
      
      const response = await this.aiProvider.generateResponse(planPrompt);
      const planData = JSON.parse(response);
      
      const plan: InvestigationPlan = {
        id: uuidv4(),
        problem,
        detectedType: problem.type || 'performance',
        phases: planData.phases || this.getDefaultPhases(problem.type || 'performance'),
        estimatedTotalTime: planData.estimatedTotalTime || 300, // 5 minutes default
        confidence: planData.confidence || 0.8,
        reasoning: planData.reasoning || 'AI-generated investigation plan',
        createdAt: new Date()
      };

      logger.info(`Generated investigation plan with ${plan.phases.length} phases`);
      return plan;
      
    } catch (error) {
      logger.warn('AI plan generation failed, using default plan:', error);
      return this.generateDefaultPlan(problem);
    }
  }

  async validateInvestigationPlan(plan: InvestigationPlan): Promise<{
    isValid: boolean;
    issues?: string[];
    suggestions?: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (!plan.phases || plan.phases.length === 0) {
      issues.push('Investigation plan must have at least one phase');
    }
    
    for (const phase of plan.phases) {
      if (!phase.queries || phase.queries.length === 0) {
        issues.push(`Phase "${phase.name}" has no queries`);
      }
      
      for (const query of phase.queries) {
        if (!query.kqlQuery || !query.kqlQuery.trim()) {
          issues.push(`Query "${query.purpose}" in phase "${phase.name}" is empty`);
        }
      }
    }
    
    if (plan.estimatedTotalTime > 1800) { // 30 minutes
      suggestions.push('Investigation time is quite long, consider optimizing queries');
    }
    
    return {
      isValid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  async exportInvestigation(investigationId: string, format: 'json' | 'markdown' | 'html'): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    const result = this.results.get(investigationId);
    if (!result) {
      throw new Error(`Investigation result not found: ${investigationId}`);
    }

    switch (format) {
      case 'json':
        return {
          content: JSON.stringify(result, null, 2),
          filename: `investigation-${investigationId}.json`,
          mimeType: 'application/json'
        };
        
      case 'markdown':
        return {
          content: this.generateMarkdownReport(result),
          filename: `investigation-${investigationId}.md`,
          mimeType: 'text/markdown'
        };
        
      case 'html':
        return {
          content: this.generateHtmlReport(result),
          filename: `investigation-${investigationId}.html`,
          mimeType: 'text/html'
        };
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async executePhase(phase: InvestigationPhase, context: InvestigationContext, plan: InvestigationPlan): Promise<void> {
    logger.info(`Executing phase: ${phase.name}`);
    
    for (const query of phase.queries) {
      try {
        context.currentQueryId = query.id;
        
        // Execute the query
        const startTime = Date.now();
        const result = await this.dataSourceProvider.executeQuery({ query: query.kqlQuery });
        const executionTime = Date.now() - startTime;
        
        // Analyze the result with AI
        const analysisResult = await this.aiProvider.analyzeQueryResult({
          result,
          originalQuery: query.kqlQuery,
          analysisType: 'insights'
        });
        
        // Create evidence
        const evidence: InvestigationEvidence = {
          id: uuidv4(),
          phaseId: phase.id,
          queryId: query.id,
          result,
          analysisResult,
          significance: this.determineSignificance(result, analysisResult),
          summary: `${query.purpose}: ${analysisResult?.aiInsights || 'Query executed successfully'}`,
          collectedAt: new Date()
        };
        
        context.evidence.push(evidence);
        context.progress.completedQueries++;
        
        logger.info(`Query completed: ${query.purpose}`);
        
      } catch (error) {
        logger.error(`Query failed: ${query.purpose}`, error);
        context.progress.failedQueries++;
        
        if (query.required) {
          throw new Error(`Required query failed: ${query.purpose} - ${error}`);
        }
      }
    }
  }

  private async completeInvestigation(
    investigationId: string, 
    plan: InvestigationPlan, 
    context: InvestigationContext
  ): Promise<InvestigationResult> {
    logger.info(`Completing investigation: ${investigationId}`);
    
    // Generate root cause analysis
    const rootCauseAnalysis = await this.generateRootCauseAnalysis(context.evidence);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(context.evidence, rootCauseAnalysis);
    
    // Generate summary
    const summary = await this.generateInvestigationSummary(plan, context, rootCauseAnalysis);
    
    context.progress.currentStatus = 'completed';
    context.progress.completionPercentage = 100;
    
    const result: InvestigationResult = {
      id: investigationId,
      context,
      plan,
      evidence: context.evidence,
      rootCauseAnalysis,
      recommendations,
      summary,
      completedAt: new Date(),
      totalExecutionTime: Math.floor((new Date().getTime() - context.startedAt.getTime()) / 1000)
    };
    
    // End the session
    await this.sessionManager.endSession(context.sessionId);
    
    return result;
  }

  private async generateRootCauseAnalysis(evidence: InvestigationEvidence[]): Promise<RootCauseAnalysis> {
    // Simplified implementation - in reality, this would use sophisticated AI analysis
    const criticalEvidence = evidence.filter(e => e.significance === 'critical');
    
    return {
      primaryCause: {
        description: criticalEvidence.length > 0 
          ? `Analysis indicates issues found in ${criticalEvidence.length} critical areas`
          : 'No critical issues identified in the investigation',
        confidence: criticalEvidence.length > 0 ? 0.8 : 0.4,
        evidence: criticalEvidence.map(e => e.id),
        category: 'application'
      },
      contributingFactors: [],
      timeline: evidence.map(e => ({
        timestamp: e.collectedAt,
        event: e.summary,
        evidence: e.id
      })),
      affectedComponents: [],
      businessImpact: {
        severity: criticalEvidence.length > 0 ? 'high' : 'low'
      }
    };
  }

  private async generateRecommendations(
    evidence: InvestigationEvidence[], 
    rootCause: RootCauseAnalysis
  ): Promise<InvestigationRecommendations> {
    // Simplified implementation
    return {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      prevention: []
    };
  }

  private async generateInvestigationSummary(
    plan: InvestigationPlan,
    context: InvestigationContext,
    rootCause: RootCauseAnalysis
  ): Promise<string> {
    return `Investigation completed for: ${plan.problem.description}. ` +
           `Executed ${context.progress.completedQueries} queries across ${context.progress.completedPhases} phases. ` +
           `Primary cause: ${rootCause.primaryCause.description}`;
  }

  private determineSignificance(result: QueryResult, analysisResult?: any): 'critical' | 'important' | 'informational' {
    // Simple heuristic - could be enhanced with AI
    if (!result.tables || result.tables.length === 0) return 'informational';
    
    const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
    if (totalRows > 1000) return 'critical';
    if (totalRows > 100) return 'important';
    return 'informational';
  }

  private getNextPhaseToExecute(plan: InvestigationPlan, context: InvestigationContext): InvestigationPhase | null {
    const completedPhases = context.progress.completedPhases;
    if (completedPhases >= plan.phases.length) {
      return null; // All phases completed
    }
    return plan.phases[completedPhases];
  }

  private async getStoredPlan(planId: string): Promise<InvestigationPlan> {
    // For testing, use in-memory storage
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    return plan;
  }

  private getDefaultPhases(type: InvestigationType): InvestigationPhase[] {
    // Default phases based on investigation type
    const basePhase: InvestigationPhase = {
      id: uuidv4(),
      name: 'Initial Analysis',
      description: 'Basic data collection and analysis',
      queries: [{
        id: uuidv4(),
        purpose: 'Get recent data overview',
        kqlQuery: 'requests | where timestamp > ago(1h) | summarize count() by bin(timestamp, 5m) | order by timestamp',
        expectedOutcome: 'Understanding of recent request patterns',
        confidence: 0.9,
        required: true
      }],
      priority: 'high'
    };

    return [basePhase];
  }

  private generateDefaultPlan(problem: InvestigationProblem): InvestigationPlan {
    return {
      id: uuidv4(),
      problem,
      detectedType: problem.type || 'performance',
      phases: this.getDefaultPhases(problem.type || 'performance'),
      estimatedTotalTime: 300,
      confidence: 0.7,
      reasoning: 'Default investigation plan due to AI generation failure',
      createdAt: new Date()
    };
  }

  private generateMarkdownReport(result: InvestigationResult): string {
    return `# Investigation Report

## Problem
${result.plan.problem.description}

## Summary
${result.summary}

## Root Cause Analysis
**Primary Cause:** ${result.rootCauseAnalysis.primaryCause.description}  
**Confidence:** ${(result.rootCauseAnalysis.primaryCause.confidence * 100).toFixed(1)}%

## Evidence Collected
${result.evidence.map(e => `- ${e.summary}`).join('\n')}

## Execution Details
- **Investigation ID:** ${result.id}
- **Total Execution Time:** ${result.totalExecutionTime} seconds
- **Phases Completed:** ${result.context.progress.completedPhases}/${result.context.progress.totalPhases}
- **Queries Executed:** ${result.context.progress.completedQueries}
- **Failed Queries:** ${result.context.progress.failedQueries}

Generated on ${result.completedAt.toISOString()}`;
  }

  private generateHtmlReport(result: InvestigationResult): string {
    const markdown = this.generateMarkdownReport(result);
    // In a real implementation, this would convert markdown to HTML
    return `<html><head><title>Investigation Report</title></head><body><pre>${markdown}</pre></body></html>`;
  }
}