import { IExternalExecutionProvider, ExternalExecutionValidationResult, ExternalExecutionProviderMetadata } from '../../core/interfaces/IExternalExecutionProvider';
import { ExternalExecutionProviderConfig } from '../../core/types/ProviderTypes';
import { ExternalExecutionTarget, ExternalExecutionOption, AzureResourceInfo } from '../../types';
import { logger } from '../../utils/logger';
import { gzipSync } from 'zlib';

/**
 * Azure Application Insights external execution provider implementation
 */
export class ApplicationInsightsExternalProvider implements IExternalExecutionProvider {
  private azureResourceInfo: AzureResourceInfo;

  constructor(private config: ExternalExecutionProviderConfig) {
    if (this.config.type !== 'application-insights') {
      throw new Error('Invalid provider type for ApplicationInsightsExternalProvider');
    }

    // Map config to AzureResourceInfo format for backward compatibility
    this.azureResourceInfo = {
      tenantId: this.config.tenantId || '',
      subscriptionId: this.config.subscriptionId || '',
      resourceGroup: this.config.resourceGroup || '',
      resourceName: this.config.resourceName || ''
    };
  }

  getAvailableOptions(): ExternalExecutionOption[] {
    return [
      {
        target: 'portal',
        name: '🌐 Azure Portal (Application Insights)',
        description: 'Open query in Azure Portal Logs blade with full visualization capabilities'
      }
    ];
  }

  async generateUrl(target: ExternalExecutionTarget, query: string): Promise<string> {
    switch (target) {
      case 'portal':
        return this.generateAzurePortalUrl(query);
      default:
        throw new Error(`Unsupported external execution target: ${target}`);
    }
  }

  validateConfiguration(): ExternalExecutionValidationResult {
    const requiredFields = ['tenantId', 'subscriptionId', 'resourceGroup', 'resourceName'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const value = this.config[field as keyof ExternalExecutionProviderConfig];
      if (!value) {
        missingFields.push(field);
      }
    }

    // For backward compatibility, show the external execution option if we have at least tenantId
    // More detailed validation will happen during URL generation
    const hasMinimalConfig = !!this.config.tenantId;

    return {
      isValid: hasMinimalConfig,
      missingFields
    };
  }

  getMetadata(): ExternalExecutionProviderMetadata {
    return {
      name: 'Application Insights External Provider',
      type: 'application-insights',
      description: 'Provides external execution options for Azure Application Insights',
      supportedTargets: ['portal']
    };
  }

  /**
   * Generate Azure Portal URL with embedded KQL query using proper base64/gzip encoding
   */
  private generateAzurePortalUrl(kqlQuery: string): string {
    const { tenantId, subscriptionId, resourceGroup, resourceName } = this.azureResourceInfo;

    // Validate that all required fields are present for URL generation
    const missingFields: string[] = [];
    if (!tenantId) missingFields.push('tenantId');
    if (!subscriptionId) missingFields.push('subscriptionId');
    if (!resourceGroup) missingFields.push('resourceGroup');
    if (!resourceName) missingFields.push('resourceName');

    if (missingFields.length > 0) {
      throw new Error(
        `Cannot generate Azure Portal URL. Missing required configuration: ${missingFields.join(', ')}. ` +
        `Please ensure these values are configured in your data source settings.`
      );
    }

    // Compress and encode the KQL query using gzip + base64
    const gzippedQuery = gzipSync(Buffer.from(kqlQuery, 'utf8'));
    const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));

    // Generate Azure Portal Application Insights URL
    // See also https://stuartleeks.com/posts/deep-linking-to-queries-in-application-insights-with-python/
    const portalUrl = `https://portal.azure.com/#@${tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${subscriptionId}%2FresourceGroups%2F${resourceGroup}%2Fproviders%2FMicrosoft.Insights%2Fcomponents%2F${resourceName}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;

    logger.debug(`Generated Azure Portal URL: ${portalUrl}`);
    return portalUrl;
  }
}