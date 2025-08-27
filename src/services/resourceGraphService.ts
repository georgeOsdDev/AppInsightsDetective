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

export interface LogAnalyticsWorkspaceResource {
  id: string;
  name: string;
  resourceGroup: string;
  subscriptionId: string;
  type: string;
  tenantId?: string;
  properties?: {
    customerId: string;
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

  /**
   * Find Log Analytics workspace resource by workspace ID (customerId)
   */
  async findLogAnalyticsWorkspaceResource(workspaceId: string): Promise<LogAnalyticsWorkspaceResource | null> {
    try {
      const query = `Resources 
        | where type == 'microsoft.operationalinsights/workspaces' 
        | where properties.customerId == '${workspaceId}' 
        | project id, name, resourceGroup, subscriptionId, type, properties, tenantId`;

      logger.debug(`Querying Resource Graph for Log Analytics Workspace ID: ${workspaceId}`);
      
      const response = await this.client.resources({
        query,
        subscriptions: [], // Query across all accessible subscriptions
      });

      if (!response.data || response.data.length === 0) {
        logger.warn(`No Log Analytics workspace found with Workspace ID: ${workspaceId}`);
        return null;
      }

      if (response.data.length > 1) {
        logger.warn(`Multiple Log Analytics workspaces found with Workspace ID: ${workspaceId}. Using the first one.`);
      }

      const resource = response.data[0] as any;
      
      // Parse the resource ID to extract components
      const resourceIdParts = resource.id.split('/');
      const subscriptionId = resourceIdParts[2];
      const resourceGroup = resourceIdParts[4];
      const resourceName = resourceIdParts[resourceIdParts.length - 1];

      const result: LogAnalyticsWorkspaceResource = {
        id: resource.id,
        name: resourceName,
        resourceGroup,
        subscriptionId,
        type: resource.type,
        tenantId: resource.tenantId,
        properties: resource.properties,
      };

      logger.info(`Found Log Analytics workspace: ${result.name} in ${result.resourceGroup} (${result.subscriptionId})`);
      return result;

    } catch (error) {
      logger.error(`Failed to query Resource Graph for Log Analytics Workspace ID ${workspaceId}:`, error);
      throw new Error(`Failed to find Log Analytics workspace: ${error}`);
    }
  }

  /**
   * Get complete resource information for a Log Analytics Workspace ID
   */
  async getLogAnalyticsResourceInfo(workspaceId: string): Promise<{
    subscriptionId: string;
    resourceGroup: string;
    resourceName: string;
    tenantId: string;
  } | null> {
    try {
      // Find the Log Analytics workspace resource
      const workspaceResource = await this.findLogAnalyticsWorkspaceResource(workspaceId);
      
      if (!workspaceResource) {
        return null;
      }

      return {
        subscriptionId: workspaceResource.subscriptionId,
        resourceGroup: workspaceResource.resourceGroup,
        resourceName: workspaceResource.name,
        tenantId: workspaceResource.tenantId || '', // May need to be obtained from auth context if not available
      };

    } catch (error) {
      logger.error(`Failed to get resource info for Log Analytics Workspace ID ${workspaceId}:`, error);
      throw error;
    }
  }
}