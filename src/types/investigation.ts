/**
 * Types and interfaces for the AI-Driven Intelligent Investigation System
 */
import { SupportedLanguage, QueryResult } from './index';

/**
 * Investigation types supported by the system
 */
export type InvestigationType = 'performance' | 'availability' | 'data-quality' | 'dependencies';

/**
 * Investigation problem description
 */
export interface InvestigationProblem {
  description: string;
  type?: InvestigationType;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedServices?: string[];
  tags?: string[];
}

/**
 * Investigation plan phase
 */
export interface InvestigationPhase {
  id: string;
  name: string;
  description: string;
  queries: InvestigationQuery[];
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: number; // in seconds
  dependencies?: string[]; // IDs of phases that must complete first
}

/**
 * Investigation query within a phase
 */
export interface InvestigationQuery {
  id: string;
  purpose: string;
  kqlQuery: string;
  expectedOutcome: string;
  confidence: number;
  required: boolean; // true if failure blocks the investigation
}

/**
 * Generated investigation plan
 */
export interface InvestigationPlan {
  id: string;
  problem: InvestigationProblem;
  detectedType: InvestigationType;
  phases: InvestigationPhase[];
  estimatedTotalTime: number; // in seconds
  confidence: number;
  reasoning: string;
  createdAt: Date;
}

/**
 * Investigation execution context
 */
export interface InvestigationContext {
  planId: string;
  sessionId: string;
  currentPhaseId?: string;
  currentQueryId?: string;
  evidence: InvestigationEvidence[];
  progress: InvestigationProgress;
  startedAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Evidence collected during investigation
 */
export interface InvestigationEvidence {
  id: string;
  phaseId: string;
  queryId: string;
  result: QueryResult;
  analysisResult?: any; // Analysis results from AI
  significance: 'critical' | 'important' | 'informational';
  summary: string;
  collectedAt: Date;
}

/**
 * Investigation progress tracking
 */
export interface InvestigationProgress {
  totalPhases: number;
  completedPhases: number;
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  skippedQueries: number;
  currentStatus: 'created' | 'in-progress' | 'completed' | 'failed' | 'paused';
  completionPercentage: number;
}

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  primaryCause: {
    description: string;
    confidence: number;
    evidence: string[]; // Evidence IDs supporting this cause
    category: 'infrastructure' | 'application' | 'dependencies' | 'data' | 'configuration';
  };
  contributingFactors: {
    description: string;
    confidence: number;
    evidence: string[];
    impact: 'high' | 'medium' | 'low';
  }[];
  timeline: {
    timestamp: Date;
    event: string;
    evidence?: string;
  }[];
  affectedComponents: string[];
  businessImpact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedUsers?: number;
    downtime?: number; // in minutes
    estimatedCost?: string;
  };
}

/**
 * Actionable recommendations
 */
export interface InvestigationRecommendations {
  immediate: {
    action: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    estimatedTime: string;
    risk: 'low' | 'medium' | 'high';
    description: string;
  }[];
  shortTerm: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    estimatedEffort: string;
    impact: string;
    description: string;
  }[];
  longTerm: {
    action: string;
    category: 'monitoring' | 'architecture' | 'process' | 'tooling';
    description: string;
    benefit: string;
  }[];
  prevention: {
    strategy: string;
    description: string;
    implementation: string;
  }[];
}

/**
 * Complete investigation result
 */
export interface InvestigationResult {
  id: string;
  context: InvestigationContext;
  plan: InvestigationPlan;
  evidence: InvestigationEvidence[];
  rootCauseAnalysis: RootCauseAnalysis;
  recommendations: InvestigationRecommendations;
  summary: string;
  completedAt: Date;
  totalExecutionTime: number; // in seconds
}

/**
 * Investigation request for the service
 */
export interface InvestigationRequest {
  problem: InvestigationProblem;
  options?: {
    language?: SupportedLanguage;
    interactive?: boolean;
    resumeFromId?: string; // Resume existing investigation
    maxExecutionTime?: number; // Maximum time in minutes
    skipConfirmation?: boolean;
  };
}

/**
 * Investigation service response
 */
export interface InvestigationResponse {
  investigationId: string;
  status: 'created' | 'in-progress' | 'completed' | 'failed' | 'paused';
  plan?: InvestigationPlan;
  progress?: InvestigationProgress;
  result?: InvestigationResult;
  nextAction?: {
    type: 'wait' | 'confirm' | 'input' | 'complete';
    message: string;
    options?: string[];
  };
}