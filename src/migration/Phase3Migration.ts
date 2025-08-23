import { InteractiveService, InteractiveSessionOptions } from '../services/interactiveService';
import { ServiceFactory } from '../infrastructure/factories/ServiceFactory';
import { logger } from '../utils/logger';

/**
 * Migration wrapper that provides backward compatibility while using the new Phase 3 architecture
 */
export class Phase3InteractiveService {
  private legacy: InteractiveService | null = null;
  private newArchitecture: any = null;

  constructor(
    authService?: any,
    appInsightsService?: any,
    aiService?: any,
    configManager?: any,
    options: InteractiveSessionOptions = {}
  ) {
    // Initialize legacy service for backward compatibility
    if (authService && appInsightsService && aiService && configManager) {
      this.legacy = new InteractiveService(
        authService,
        appInsightsService, 
        aiService,
        configManager,
        options
      );
    }

    // Initialize new architecture asynchronously
    this.initializeNewArchitecture(options).catch(error => {
      logger.warn('Failed to initialize new architecture, falling back to legacy:', error);
    });
  }

  private async initializeNewArchitecture(options: InteractiveSessionOptions): Promise<void> {
    try {
      const services = await ServiceFactory.createServices();
      this.newArchitecture = {
        sessionController: services.sessionController,
        queryOrchestrator: services.queryOrchestrator,
        outputRenderer: services.outputRenderer
      };
      logger.info('Phase 3 architecture initialized successfully');
    } catch (error) {
      logger.warn('Phase 3 architecture initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start interactive session using new or legacy architecture
   */
  async startSession(): Promise<void> {
    // Prefer new architecture if available
    if (this.newArchitecture?.sessionController) {
      logger.info('Using Phase 3 architecture for interactive session');
      return this.newArchitecture.sessionController.startSession();
    }
    
    // Fall back to legacy if new architecture is not available
    if (this.legacy) {
      logger.info('Using legacy architecture for interactive session');
      return this.legacy.startSession();
    }

    throw new Error('Neither new nor legacy interactive service is available');
  }

  /**
   * Check if Phase 3 architecture is available
   */
  isPhase3Available(): boolean {
    return this.newArchitecture?.sessionController !== null;
  }

  /**
   * Get architecture version being used
   */
  getArchitectureVersion(): string {
    if (this.newArchitecture?.sessionController) {
      return 'Phase 3 (Service Architecture Refactoring)';
    } else if (this.legacy) {
      return 'Legacy (Pre-Phase 3)';
    }
    return 'Unknown';
  }
}

/**
 * Example of how to migrate existing CLI commands to use Phase 3 architecture
 */
export async function createInteractiveServiceWithMigration(
  options: InteractiveSessionOptions = {}
): Promise<Phase3InteractiveService> {
  try {
    // Try to create with new architecture first
    const migrationService = new Phase3InteractiveService(
      undefined, undefined, undefined, undefined, options
    );
    
    // Give it a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return migrationService;
  } catch (error) {
    logger.error('Failed to create Phase 3 interactive service:', error);
    
    // Fall back to creating with legacy dependencies
    // This would require actual instances of the legacy services
    throw new Error('Migration to Phase 3 architecture failed');
  }
}

/**
 * Factory function for creating Phase 3 services independently
 */
export class Phase3ServiceMigration {
  /**
   * Create AI provider with backward compatibility
   */
  static async createAIProvider(providerType: string = 'azure-openai') {
    try {
      return await ServiceFactory.createAIProvider(providerType);
    } catch (error) {
      logger.error('Failed to create Phase 3 AI provider:', error);
      throw error;
    }
  }

  /**
   * Create data source provider with backward compatibility  
   */
  static async createDataSourceProvider(providerType: string = 'application-insights') {
    try {
      return await ServiceFactory.createDataSourceProvider(providerType);
    } catch (error) {
      logger.error('Failed to create Phase 3 data source provider:', error);
      throw error;
    }
  }

  /**
   * Create complete query orchestrator
   */
  static async createQueryOrchestrator() {
    try {
      const services = await ServiceFactory.createServices();
      return services.queryOrchestrator;
    } catch (error) {
      logger.error('Failed to create Phase 3 query orchestrator:', error);
      throw error;
    }
  }

  /**
   * Validate that Phase 3 architecture can be used
   */
  static async validatePhase3Readiness(): Promise<{
    isReady: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const result = await ServiceFactory.validateConfiguration();
      return {
        isReady: result.isValid,
        errors: result.errors,
        warnings: result.warnings
      };
    } catch (error) {
      return {
        isReady: false,
        errors: [`Phase 3 validation failed: ${error}`],
        warnings: []
      };
    }
  }
}