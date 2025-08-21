import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';
import { gzipSync } from 'zlib';
import {
  AzureResourceInfo,
  ExternalExecutionTarget,
  ExternalExecutionResult,
  ExternalExecutionOption
} from '../types';

export class ExternalExecutionService {
  constructor(private azureResourceInfo: AzureResourceInfo) {}

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
    const options: ExternalExecutionOption[] = [
      {
        target: 'portal',
        name: '🌐 Azure Portal (Application Insights)',
        description: 'Open query in Azure Portal Logs blade with full visualization capabilities'
      }
    ];

    return options;
  }

  /**
   * Generate Azure Portal URL with embedded KQL query using proper base64/gzip encoding
   */
  generatePortalUrl(kqlQuery: string): string {
    const { tenantId, subscriptionId, resourceGroup, resourceName } = this.azureResourceInfo;

    // Compress and encode the KQL query using gzip + base64
    const gzippedQuery = gzipSync(Buffer.from(kqlQuery, 'utf8'));
    const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));

    // Generate Azure Portal Application Insights URL
    const portalUrl = `https://portal.azure.com#@${tenantId}/resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Insights/components/${resourceName}/logs?query=${encodedQuery}`;

    logger.debug(`Generated Azure Portal URL: ${portalUrl}`);
    return portalUrl;
  }

  /**
   * Generate URL for specified target
   */
  generateUrl(target: ExternalExecutionTarget, kqlQuery: string): string {
    if (target === 'portal') {
      return this.generatePortalUrl(kqlQuery);
    }
    throw new Error(`Unsupported external execution target: ${target}`);
  }

  async executeExternal(
    target: ExternalExecutionTarget,
    kqlQuery: string,
    displayUrl: boolean = true
  ): Promise<ExternalExecutionResult> {
    try {
      const url = this.generateUrl(target, kqlQuery);
      const targetName = 'Azure Portal';

      // Display URL for sharing/manual access
      if (displayUrl) {
        Visualizer.displayInfo(`\n🔗 ${targetName} URL:`);
        console.log(`   ${url}`);
        console.log('');
      }

      // Launch browser
      Visualizer.displayInfo(`🚀 Opening query in ${targetName}...`);
      
      // Open URL in default browser
      await this.launchBrowser(url);

      logger.info(`Successfully opened query in ${targetName}`);
      
      return {
        url,
        target,
        launched: true
      };

    } catch (error) {
      const errorMessage = `Failed to open query in ${target}: ${error}`;
      logger.error(errorMessage, error);
      
      return {
        url: '',
        target,
        launched: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate Azure resource configuration for external execution
   */
  validateConfiguration(): { isValid: boolean; missingFields: string[] } {
    const requiredFields = ['tenantId', 'subscriptionId', 'resourceGroup', 'resourceName'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!this.azureResourceInfo[field as keyof AzureResourceInfo]) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
}