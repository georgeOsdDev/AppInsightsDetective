import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../utils/logger';

export interface ApplicationInsightsResource {
  id: string;
  name: string;
  resourceGroup: string;
  subscriptionId: string;
  type: string;
  tenantId?: string;
  properties?: {
    AppId: string;
    ApplicationId: string;
    [key: string]: any;
  };
}

export class ResourceGraphService {
  private client: ResourceGraphClient;

  constructor() {
    const credential = new DefaultAzureCredential();
    this.client = new ResourceGraphClient(credential);
  }

  /**
   * Find Application Insights resource by Application ID
   */
  async findApplicationInsightsResource(applicationId: string): Promise<ApplicationInsightsResource | null> {
    try {
      const query = `Resources 
        | where type == 'microsoft.insights/components' 
        | where properties.AppId == '${applicationId}' 
        | project id, name, resourceGroup, subscriptionId, type, properties, tenantId`;

      logger.debug(`Querying Resource Graph for Application ID: ${applicationId}`);
      
      const response = await this.client.resources({
        query,
        subscriptions: [], // Query across all accessible subscriptions
      });

      if (!response.data || response.data.length === 0) {
        logger.warn(`No Application Insights resource found with Application ID: ${applicationId}`);
        return null;
      }

      if (response.data.length > 1) {
        logger.warn(`Multiple Application Insights resources found with Application ID: ${applicationId}. Using the first one.`);
      }

      const resource = response.data[0] as any;
      
      // Parse the resource ID to extract components
      const resourceIdParts = resource.id.split('/');
      const subscriptionId = resourceIdParts[2];
      const resourceGroup = resourceIdParts[4];
      const resourceName = resourceIdParts[resourceIdParts.length - 1];

      const result: ApplicationInsightsResource = {
        id: resource.id,
        name: resourceName,
        resourceGroup,
        subscriptionId,
        type: resource.type,
        tenantId: resource.tenantId,
        properties: resource.properties,
      };

      logger.info(`Found Application Insights resource: ${result.name} in ${result.resourceGroup} (${result.subscriptionId})`);
      return result;

    } catch (error) {
      logger.error(`Failed to query Resource Graph for Application ID ${applicationId}:`, error);
      throw new Error(`Failed to find Application Insights resource: ${error}`);
    }
  }

  /**
   * Get complete resource information for an Application ID
   */
  async getResourceInfo(applicationId: string): Promise<{
    subscriptionId: string;
    resourceGroup: string;
    resourceName: string;
    tenantId: string;
  } | null> {
    try {
      // Find the Application Insights resource
      const appInsightsResource = await this.findApplicationInsightsResource(applicationId);
      
      if (!appInsightsResource) {
        return null;
      }

      return {
        subscriptionId: appInsightsResource.subscriptionId,
        resourceGroup: appInsightsResource.resourceGroup,
        resourceName: appInsightsResource.name,
        tenantId: appInsightsResource.tenantId || '', // May need to be obtained from auth context if not available
      };

    } catch (error) {
      logger.error(`Failed to get resource info for Application ID ${applicationId}:`, error);
      throw error;
    }
  }
}