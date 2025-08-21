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
   * Find Data Explorer cluster that might be associated with the Application Insights resource
   * This is a best-effort attempt to find a Data Explorer cluster in the same resource group
   */
  async findDataExplorerCluster(subscriptionId: string, resourceGroup: string): Promise<{
    clusterId?: string;
    databaseName?: string;
  }> {
    try {
      const query = `Resources 
        | where type == 'microsoft.kusto/clusters' 
        | where subscriptionId == '${subscriptionId}' 
        | where resourceGroup == '${resourceGroup}'
        | project name, properties`;

      logger.debug(`Searching for Data Explorer cluster in ${resourceGroup} (${subscriptionId})`);
      
      const response = await this.client.resources({
        query,
        subscriptions: [subscriptionId],
      });

      if (!response.data || response.data.length === 0) {
        logger.debug(`No Data Explorer cluster found in resource group: ${resourceGroup}`);
        return {};
      }

      const cluster = response.data[0] as any;
      const clusterId = cluster.name;
      const databaseName = 'ApplicationInsights'; // Default database name

      logger.info(`Found Data Explorer cluster: ${clusterId} in ${resourceGroup}`);
      return {
        clusterId,
        databaseName,
      };

    } catch (error) {
      logger.warn(`Failed to find Data Explorer cluster in ${resourceGroup}:`, error);
      return {}; // Return empty object instead of throwing, as this is optional
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
    clusterId?: string;
    databaseName?: string;
  } | null> {
    try {
      // Find the Application Insights resource
      const appInsightsResource = await this.findApplicationInsightsResource(applicationId);
      
      if (!appInsightsResource) {
        return null;
      }

      // Try to find associated Data Explorer cluster
      const dataExplorerInfo = await this.findDataExplorerCluster(
        appInsightsResource.subscriptionId,
        appInsightsResource.resourceGroup
      );

      return {
        subscriptionId: appInsightsResource.subscriptionId,
        resourceGroup: appInsightsResource.resourceGroup,
        resourceName: appInsightsResource.name,
        tenantId: appInsightsResource.tenantId || '', // May need to be obtained from auth context if not available
        ...dataExplorerInfo,
      };

    } catch (error) {
      logger.error(`Failed to get resource info for Application ID ${applicationId}:`, error);
      throw error;
    }
  }
}