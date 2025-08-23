import axios, { AxiosResponse } from 'axios';
import { IDataSourceProvider } from '../../core/interfaces/IDataSourceProvider';
import { QueryResult, Config } from '../../types';
import { logger } from '../../utils/logger';
import { withLoadingIndicator } from '../../utils/loadingIndicator';
import { AuthService } from '../../services/authService';

export interface ApplicationInsightsConfig {
  applicationId: string;
  tenantId?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  resourceName?: string;
}

/**
 * Application Insights implementation of IDataSourceProvider
 */
export class ApplicationInsightsProvider implements IDataSourceProvider {
  constructor(
    private config: ApplicationInsightsConfig,
    private authService: AuthService
  ) {}

  async executeQuery(query: string): Promise<QueryResult> {
    logger.info(`Executing query on Application Insights: ${query.substring(0, 100)}...`);

    return withLoadingIndicator(
      'Executing query on Application Insights...',
      async () => {
        try {
          const accessToken = await this.authService.getAccessToken();
          const url = `https://api.applicationinsights.io/v1/apps/${this.config.applicationId}/query`;

          const response: AxiosResponse = await axios.post(
            url,
            { query },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          const data = response.data;

          if (!data.tables || data.tables.length === 0) {
            return {
              tables: []
            };
          }

          const table = data.tables[0];
          const columns = table.columns.map((col: any) => ({
            name: col.name,
            type: col.type
          }));

          return {
            tables: [
              {
                name: 'PrimaryResult',
                columns,
                rows: table.rows || []
              }
            ]
          };
        } catch (error: any) {
          logger.error('Query execution failed:', error);
          if (error.response) {
            const errorMessage = error.response.data?.error?.message || 'Unknown API error';
            throw new Error(`Application Insights API error: ${errorMessage}`);
          }
          throw new Error(`Failed to execute query: ${error.message}`);
        }
      },
      {
        successMessage: 'Query executed successfully',
        errorMessage: 'Failed to execute query'
      }
    );
  }

  async validateConnection(): Promise<{ isValid: boolean; error?: string }> {
    return withLoadingIndicator(
      'Validating Application Insights connection...',
      async () => {
        try {
          const accessToken = await this.authService.getAccessToken();
          const url = `https://api.applicationinsights.io/v1/apps/${this.config.applicationId}/metadata`;

          await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });

          return { isValid: true };
        } catch (error: any) {
          logger.error('Connection validation failed:', error);
          const errorMessage = error.response?.data?.error?.message || error.message;
          return { 
            isValid: false, 
            error: `Failed to connect to Application Insights: ${errorMessage}` 
          };
        }
      },
      {
        successMessage: 'Connection validated successfully',
        errorMessage: 'Connection validation failed'
      }
    );
  }

  async getSchema(): Promise<any> {
    return withLoadingIndicator(
      'Retrieving Application Insights schema...',
      async () => {
        try {
          const accessToken = await this.authService.getAccessToken();
          const url = `https://api.applicationinsights.io/v1/apps/${this.config.applicationId}/metadata`;

          const response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });

          return response.data;
        } catch (error: any) {
          logger.error('Failed to retrieve schema:', error);
          throw new Error(`Failed to retrieve Application Insights schema: ${error.message}`);
        }
      },
      {
        successMessage: 'Schema retrieved successfully',
        errorMessage: 'Failed to retrieve schema'
      }
    );
  }

  async getMetadata(): Promise<{
    name: string;
    type: string;
    version?: string;
    capabilities: string[];
  }> {
    return {
      name: 'Azure Application Insights',
      type: 'application-insights',
      version: '1.0',
      capabilities: [
        'kql-queries',
        'real-time-monitoring',
        'custom-events',
        'performance-counters',
        'dependency-tracking',
        'exception-tracking',
        'user-analytics'
      ]
    };
  }

  async getResourceId(): Promise<string | null> {
    if (!this.config.subscriptionId || !this.config.resourceGroup || !this.config.resourceName) {
      return null;
    }

    return `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/microsoft.insights/components/${this.config.resourceName}`;
  }
}