import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';
import { withLoadingIndicator } from '../utils/loadingIndicator';
import {
  ExternalExecutionTarget,
  ExternalExecutionResult,
  ExternalExecutionOption
} from '../types';
import { IExternalExecutionProvider } from '../core/interfaces/IExternalExecutionProvider';

export class ExternalExecutionService {
  constructor(private externalProvider: IExternalExecutionProvider) {}

  /**
   * Browser launcher abstraction to allow for testing
   */
  private async launchBrowser(url: string): Promise<void> {
    const open = await import('open');
    await open.default(url);
  }

  /**
   * Get available external execution options
   */
  getAvailableOptions(): ExternalExecutionOption[] {
    return this.externalProvider.getAvailableOptions();
  }

  /**
   * Generate URL for specified target
   */
  async generateUrl(target: ExternalExecutionTarget, kqlQuery: string): Promise<string> {
    return await this.externalProvider.generateUrl(target, kqlQuery);
  }

  async executeExternal(
    target: ExternalExecutionTarget,
    kqlQuery: string,
    displayUrl: boolean = true
  ): Promise<ExternalExecutionResult> {
    const url = await this.generateUrl(target, kqlQuery);
    const targetName = this.getTargetDisplayName(target);

    // Display URL for sharing/manual access
    if (displayUrl) {
      Visualizer.displayInfo(`\n🔗 ${targetName} URL:`);
      console.log(`   ${url}`);
      console.log('');
    }

    return withLoadingIndicator(
      `Opening query in ${targetName}...`,
      async () => {
        // Open URL in default browser
        await this.launchBrowser(url);

        return {
          url,
          target,
          launched: true
        };
      },
      {
        successMessage: `Successfully opened query in ${targetName}`,
        errorMessage: `Failed to open query in ${targetName}`
      }
    ).catch((error) => {
      const errorMessage = `Failed to open query in ${target}: ${error}`;
      logger.error(errorMessage, error);

      return {
        url: '',
        target,
        launched: false,
        error: errorMessage
      };
    });
  }

  /**
   * Open query in Azure Portal (convenience method)
   */
  async openInPortal(kqlQuery: string): Promise<string> {
    return await this.generateUrl('portal', kqlQuery);
  }

  /**
   * Validate provider configuration for external execution
   */
  validateConfiguration(): { isValid: boolean; missingFields: string[] } {
    const validationResult = this.externalProvider.validateConfiguration();
    return {
      isValid: validationResult.isValid,
      missingFields: validationResult.missingFields
    };
  }

  /**
   * Get display name for target
   */
  private getTargetDisplayName(target: ExternalExecutionTarget): string {
    const metadata = this.externalProvider.getMetadata();
    const options = this.externalProvider.getAvailableOptions();
    const option = options.find(opt => opt.target === target);
    return option ? option.name.replace(/🌐 /, '') : `${metadata.name} (${target})`;
  }
}
