import { ExternalExecutionTarget, ExternalExecutionOption } from '../../types';

/**
 * Configuration validation result
 */
export interface ExternalExecutionValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings?: string[];
}

/**
 * Provider metadata for external execution
 */
export interface ExternalExecutionProviderMetadata {
  name: string;
  type: string;
  description: string;
  supportedTargets: ExternalExecutionTarget[];
}

/**
 * Core interface for external execution providers (Application Insights, Log Analytics, etc.)
 */
export interface IExternalExecutionProvider {
  /**
   * Get provider-specific execution options
   */
  getAvailableOptions(): ExternalExecutionOption[];

  /**
   * Generate URL for external execution
   */
  generateUrl(target: ExternalExecutionTarget, query: string): Promise<string>;

  /**
   * Validate provider configuration
   */
  validateConfiguration(): ExternalExecutionValidationResult;

  /**
   * Get provider metadata
   */
  getMetadata(): ExternalExecutionProviderMetadata;
}