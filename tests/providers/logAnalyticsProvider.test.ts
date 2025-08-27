import { LogAnalyticsProvider } from '../../src/providers/datasource/LogAnalyticsProvider';
import { DataSourceConfig } from '../../src/core/types/ProviderTypes';
import { QueryExecutionRequest } from '../../src/core/interfaces/IDataSourceProvider';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn()
      }
    }
  }))
}));

// Mock Azure Identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

describe('LogAnalyticsProvider', () => {
  let mockConfig: DataSourceConfig;
  let logAnalyticsProvider: LogAnalyticsProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockConfig = {
      type: 'log-analytics',
      subscriptionId: 'test-subscription',
      resourceGroup: 'test-rg',
      resourceName: 'test-workspace',
      tenantId: 'test-tenant'
    };

    const axios = require('axios');
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        }
      }
    };
    axios.create.mockReturnValue(mockAxiosInstance);

    logAnalyticsProvider = new LogAnalyticsProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should create LogAnalyticsProvider with valid config', () => {
      expect(logAnalyticsProvider).toBeInstanceOf(LogAnalyticsProvider);
    });

    it('should throw error for invalid provider type', () => {
      const invalidConfig = { ...mockConfig, type: 'invalid' } as any;
      expect(() => new LogAnalyticsProvider(invalidConfig)).toThrow('Invalid provider type for LogAnalyticsProvider');
    });

    it('should throw error for missing required config', () => {
      const incompleteConfig = { ...mockConfig, subscriptionId: undefined };
      expect(() => new LogAnalyticsProvider(incompleteConfig)).toThrow('Log Analytics provider requires subscriptionId, resourceGroup, and resourceName');
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'TimeGenerated', type: 'datetime' },
              { name: 'Count', type: 'int' }
            ],
            rows: [
              ['2023-01-01T00:00:00Z', 100],
              ['2023-01-01T01:00:00Z', 150]
            ]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'Heartbeat | summarize count() by bin(TimeGenerated, 1h)',
        timespan: 'PT24H'
      };

      const result = await logAnalyticsProvider.executeQuery(request);

      expect(result).toEqual({
        tables: [{
          name: 'PrimaryResult',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Count', type: 'long' }
          ],
          rows: [
            ['2023-01-01T00:00:00Z', 100],
            ['2023-01-01T01:00:00Z', 150]
          ]
        }]
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/subscriptions/test-subscription/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/test-workspace/api/query?api-version=2020-08-01',
        {
          query: 'Heartbeat | summarize count() by bin(TimeGenerated, 1h)',
          timespan: 'PT24H'
        }
      );
    });

    it('should use default timespan when not provided', async () => {
      const mockResponse = { data: { tables: [] } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'Heartbeat | count'
      };

      await logAnalyticsProvider.executeQuery(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timespan: 'PT24H'
        })
      );
    });

    it('should handle query execution errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Query failed'));

      const request: QueryExecutionRequest = {
        query: 'invalid query'
      };

      await expect(logAnalyticsProvider.executeQuery(request)).rejects.toThrow('Log Analytics query execution failed');
    });

    it('should execute query successfully with actual Log Analytics API format (capital Table)', async () => {
      // This test uses the actual Log Analytics API response format with capital "Table"
      const mockResponse = {
        data: {
          Table: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'TimeGenerated', type: 'datetime' },
              { name: 'Count', type: 'int' }
            ],
            rows: [
              ['2023-01-01T00:00:00Z', 100],
              ['2023-01-01T01:00:00Z', 150]
            ]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'Heartbeat | summarize count() by bin(TimeGenerated, 1h)',
        timespan: 'PT24H'
      };

      const result = await logAnalyticsProvider.executeQuery(request);

      expect(result).toEqual({
        tables: [{
          name: 'PrimaryResult',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Count', type: 'long' }
          ],
          rows: [
            ['2023-01-01T00:00:00Z', 100],
            ['2023-01-01T01:00:00Z', 150]
          ]
        }]
      });
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      const result = await logAnalyticsProvider.validateConnection();

      expect(result).toEqual({ isValid: true });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: 'print "connection_test"',
          timespan: 'PT1H'
        })
      );
    });

    it('should handle connection validation errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Connection failed'));

      const result = await logAnalyticsProvider.validateConnection();

      expect(result).toEqual({
        isValid: false,
        error: 'Connection validation failed: Error: Connection failed'
      });
    });
  });

  describe('getSchema', () => {
    it('should get schema successfully', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'TableName', type: 'string' },
              { name: 'ColumnCount', type: 'int' },
              { name: 'Columns', type: 'dynamic' }
            ],
            rows: [
              ['Heartbeat', 10, ['TimeGenerated:datetime', 'Computer:string']],
              ['Event', 8, ['TimeGenerated:datetime', 'EventLog:string']]
            ]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await logAnalyticsProvider.getSchema();

      expect(result.schema).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: expect.stringContaining('getschema')
        })
      );
    });

    it('should handle schema retrieval errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Schema failed'));

      const result = await logAnalyticsProvider.getSchema();

      expect(result.schema).toBeNull();
      expect(result.error).toBe('Schema retrieval failed: Error: Schema failed');
    });
  });

  describe('getMetadata', () => {
    it('should get metadata successfully', async () => {
      const mockResponse = {
        data: {
          name: 'test-workspace',
          location: 'eastus',
          properties: {
            customerId: 'workspace-id',
            provisioningState: 'Succeeded',
            retentionInDays: 30,
            sku: { name: 'PerGB2018' }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await logAnalyticsProvider.getMetadata();

      expect(result.metadata).toEqual({
        workspaceId: 'workspace-id',
        workspaceName: 'test-workspace',
        location: 'eastus',
        resourceGroup: 'test-rg',
        subscriptionId: 'test-subscription',
        provisioningState: 'Succeeded',
        retentionInDays: 30,
        sku: 'PerGB2018'
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/subscriptions/test-subscription/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/test-workspace?api-version=2022-10-01'
      );
    });

    it('should handle metadata retrieval errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Metadata failed'));

      const result = await logAnalyticsProvider.getMetadata();

      expect(result.metadata).toBeNull();
      expect(result.error).toBe('Metadata retrieval failed: Error: Metadata failed');
    });
  });

  describe('type mapping', () => {
    it('should map Log Analytics types to Application Insights format correctly', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'StringCol', type: 'string' },
              { name: 'IntCol', type: 'int' },
              { name: 'LongCol', type: 'long' },
              { name: 'RealCol', type: 'real' },
              { name: 'DateCol', type: 'datetime' },
              { name: 'BoolCol', type: 'bool' },
              { name: 'DynamicCol', type: 'dynamic' },
              { name: 'UnknownCol', type: 'unknown' }
            ],
            rows: []
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = { query: 'test' };
      const result = await logAnalyticsProvider.executeQuery(request);

      expect(result.tables[0].columns).toEqual([
        { name: 'StringCol', type: 'string' },
        { name: 'IntCol', type: 'long' },
        { name: 'LongCol', type: 'long' },
        { name: 'RealCol', type: 'real' },
        { name: 'DateCol', type: 'datetime' },
        { name: 'BoolCol', type: 'bool' },
        { name: 'DynamicCol', type: 'dynamic' },
        { name: 'UnknownCol', type: 'unknown' }
      ]);
    });
  });
});