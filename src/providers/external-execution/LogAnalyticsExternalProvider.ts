import { IExternalExecutionProvider, ExternalExecutionValidationResult, ExternalExecutionProviderMetadata } from '../../core/interfaces/IExternalExecutionProvider';
import { ExternalExecutionProviderConfig } from '../../core/types/ProviderTypes';
import { ExternalExecutionTarget, ExternalExecutionOption } from '../../types';
import { logger } from '../../utils/logger';
import { gzipSync } from 'zlib';

/**
 * Azure Log Analytics external execution provider implementation
 */
export class LogAnalyticsExternalProvider implements IExternalExecutionProvider {
  constructor(private config: ExternalExecutionProviderConfig) {
    if (this.config.type !== 'log-analytics') {
      throw new Error('Invalid provider type for LogAnalyticsExternalProvider');
    }
  }

  getAvailableOptions(): ExternalExecutionOption[] {
    return [
      {
        target: 'portal',
        name: '🌐 Azure Portal (Log Analytics)',
        description: 'Open query in Azure Portal Log Analytics workspace'
      }
    ];
  }

  async generateUrl(target: ExternalExecutionTarget, query: string): Promise<string> {
    switch (target) {
      case 'portal':
        return this.generateLogAnalyticsPortalUrl(query);
      default:
        throw new Error(`Unsupported external execution target: ${target}`);
    }
  }

  validateConfiguration(): ExternalExecutionValidationResult {
    const requiredFields = ['tenantId', 'subscriptionId', 'resourceGroup', 'workspaceId'];
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
      name: 'Log Analytics External Provider',
      type: 'log-analytics',
      description: 'Provides external execution options for Azure Log Analytics',
      supportedTargets: ['portal']
    };
  }

  /**
   * Generate Azure Portal URL for Log Analytics workspace
   */
  private generateLogAnalyticsPortalUrl(kqlQuery: string): string {
    const { tenantId, subscriptionId, resourceGroup, workspaceId } = this.config;

    // Validate that all required fields are present for URL generation
    const missingFields: string[] = [];
    if (!tenantId) missingFields.push('tenantId');
    if (!subscriptionId) missingFields.push('subscriptionId');
    if (!resourceGroup) missingFields.push('resourceGroup');
    if (!workspaceId) missingFields.push('workspaceId');

    if (missingFields.length > 0) {
      throw new Error(
        `Cannot generate Azure Portal URL. Missing required configuration: ${missingFields.join(', ')}. ` +
        `Please ensure these values are configured in your data source settings.`
      );
    }

    // Compress and encode the KQL query using gzip + base64
    const gzippedQuery = gzipSync(Buffer.from(kqlQuery, 'utf8'));
    const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));

    // Generate Azure Portal Log Analytics URL
    const portalUrl = `https://portal.azure.com/#@${tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${subscriptionId}%2FresourceGroups%2F${resourceGroup}%2Fproviders%2Fmicrosoft.operationalinsights%2Fworkspaces%2F${workspaceId}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;

    logger.debug(`Generated Log Analytics Portal URL: ${portalUrl}`);
    return portalUrl;
  }
}