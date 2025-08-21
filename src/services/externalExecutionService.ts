import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';
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

    // Add Data Explorer option if cluster information is available
    if (this.azureResourceInfo.clusterId && this.azureResourceInfo.databaseName) {
      options.push({
        target: 'dataexplorer',
        name: '📊 Azure Data Explorer (Web)',
        description: 'Open query in Azure Data Explorer web interface for advanced analytics'
      });
    }

    return options;
  }

  /**
   * Generate Azure Portal URL with embedded KQL query
   */
  generatePortalUrl(kqlQuery: string): string {
    const { tenantId, subscriptionId, resourceGroup, resourceName } = this.azureResourceInfo;

    // Encode the KQL query for URL
    const encodedQuery = encodeURIComponent(kqlQuery);

    // Generate Azure Portal Application Insights URL
    const portalUrl = `https://portal.azure.com/#@${tenantId}/resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Insights/components/${resourceName}/logs?query=${encodedQuery}`;

    logger.debug(`Generated Azure Portal URL: ${portalUrl}`);
    return portalUrl;
  }

  /**
   * Generate Azure Data Explorer URL with embedded KQL query
   */
  generateDataExplorerUrl(kqlQuery: string): string {
    const { clusterId, databaseName } = this.azureResourceInfo;

    if (!clusterId || !databaseName) {
      throw new Error('Cluster ID and Database Name are required for Data Explorer URLs');
    }

    // Encode the KQL query for URL
    const encodedQuery = encodeURIComponent(kqlQuery);

    // Generate Azure Data Explorer Web URL
    const dataExplorerUrl = `https://dataexplorer.azure.com/clusters/${clusterId}/databases/${databaseName}?query=${encodedQuery}`;

    logger.debug(`Generated Azure Data Explorer URL: ${dataExplorerUrl}`);
    return dataExplorerUrl;
  }

  /**
   * Generate URL for specified target
   */
  generateUrl(target: ExternalExecutionTarget, kqlQuery: string): string {
    switch (target) {
      case 'portal':
        return this.generatePortalUrl(kqlQuery);
      case 'dataexplorer':
        return this.generateDataExplorerUrl(kqlQuery);
      default:
        throw new Error(`Unsupported external execution target: ${target}`);
    }
  }

  /**
   * Execute query in external tool
   */
  async executeExternal(
    target: ExternalExecutionTarget,
    kqlQuery: string,
    displayUrl: boolean = true
  ): Promise<ExternalExecutionResult> {
    try {
      const url = this.generateUrl(target, kqlQuery);
      const targetName = target === 'portal' ? 'Azure Portal' : 'Azure Data Explorer';

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

  /**
   * Check if Data Explorer execution is available
   */
  isDataExplorerAvailable(): boolean {
    return !!(this.azureResourceInfo.clusterId && this.azureResourceInfo.databaseName);
  }
}