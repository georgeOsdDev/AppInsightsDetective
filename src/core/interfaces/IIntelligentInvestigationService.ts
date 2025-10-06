/**
 * Interface for the Intelligent Investigation Service
 */
import { 
  InvestigationRequest, 
  InvestigationResponse, 
  InvestigationPlan, 
  InvestigationType, 
  InvestigationContext,
  InvestigationResult
} from '../../types/investigation';

/**
 * Core interface for intelligent investigation service
 */
export interface IIntelligentInvestigationService {
  /**
   * Start a new investigation
   */
  startInvestigation(request: InvestigationRequest): Promise<InvestigationResponse>;

  /**
   * Continue an existing investigation
   */
  continueInvestigation(investigationId: string, input?: string): Promise<InvestigationResponse>;

  /**
   * Get investigation status
   */
  getInvestigationStatus(investigationId: string): Promise<InvestigationResponse>;

  /**
   * Pause an ongoing investigation
   */
  pauseInvestigation(investigationId: string): Promise<void>;

  /**
   * Resume a paused investigation
   */
  resumeInvestigation(investigationId: string): Promise<InvestigationResponse>;

  /**
   * Cancel an investigation
   */
  cancelInvestigation(investigationId: string): Promise<void>;

  /**
   * Get investigation history
   */
  getInvestigationHistory(): Promise<InvestigationResult[]>;

  /**
   * Classify a problem description into investigation type
   */
  classifyProblem(description: string): Promise<{
    type: InvestigationType;
    confidence: number;
    reasoning: string;
  }>;

  /**
   * Generate an investigation plan for a problem
   */
  generateInvestigationPlan(problem: InvestigationRequest['problem']): Promise<InvestigationPlan>;

  /**
   * Validate an investigation plan
   */
  validateInvestigationPlan(plan: InvestigationPlan): Promise<{
    isValid: boolean;
    issues?: string[];
    suggestions?: string[];
  }>;

  /**
   * Export investigation results
   */
  exportInvestigation(investigationId: string, format: 'json' | 'markdown' | 'html'): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }>;
}