import { LogAnalyticsProvider } from '../../src/providers/datasource/LogAnalyticsProvider';
import { DataSourceConfig } from '../../src/core/types/ProviderTypes';
import { QueryExecutionRequest } from '../../src/core/interfaces/IDataSourceProvider';

// Mock @azure/monitor-query-logs
const mockQueryWorkspace = jest.fn();

jest.mock('@azure/monitor-query-logs', () => ({
  LogsQueryClient: jest.fn(() => ({
    queryWorkspace: mockQueryWorkspace
  })),
  LogsQueryResultStatus: {
    Success: 'Success',
    PartialFailure: 'PartialFailure',
    Failure: 'Failure'
  }
}));

// Mock axios (still needed for metadata operations)
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
    // Reset all mocks
    jest.clearAllMocks();
    
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
      // Mock workspace metadata response (for getWorkspaceId)
      const mockWorkspaceResponse = {
        data: {
          properties: {
            customerId: 'test-workspace-id'
          }
        }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      // Mock LogsQueryClient response
      const mockQueryResponse = {
        status: 'Success',
        tables: [{
          name: 'PrimaryResult',
          columnDescriptors: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Count', type: 'int' }
          ],
          rows: [
            ['2023-01-01T00:00:00Z', 100],
            ['2023-01-01T01:00:00Z', 150]
          ]
        }]
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

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

      // Verify workspace metadata was fetched
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/subscriptions/test-subscription/resourceGroups/test-rg/providers/Microsoft.OperationalInsights/workspaces/test-workspace?api-version=2022-10-01'
      );

      // Verify LogsQueryClient was called correctly
      expect(mockQueryWorkspace).toHaveBeenCalledWith(
        'test-workspace-id',
        'Heartbeat | summarize count() by bin(TimeGenerated, 1h)',
        { duration: 'PT24H' }
      );
    });

    it('should use default timespan when not provided', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      // Mock LogsQueryClient response
      const mockQueryResponse = {
        status: 'Success',
        tables: []
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

      const request: QueryExecutionRequest = {
        query: 'Heartbeat | count'
      };

      await logAnalyticsProvider.executeQuery(request);

      expect(mockQueryWorkspace).toHaveBeenCalledWith(
        'test-workspace-id',
        'Heartbeat | count',
        { duration: 'PT24H' }
      );
    });

    it('should handle query execution errors', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);
      
      mockQueryWorkspace.mockRejectedValue(new Error('Query failed'));

      const request: QueryExecutionRequest = {
        query: 'invalid query'
      };

      await expect(logAnalyticsProvider.executeQuery(request)).rejects.toThrow('Log Analytics query execution failed');
    });

    it('should execute query successfully with actual Log Analytics API format (capital Table)', async () => {
      // Mock workspace metadata response (for getWorkspaceId)
      const mockWorkspaceResponse = {
        data: {
          properties: {
            customerId: 'test-workspace-id'
          }
        }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      // Mock LogsQueryClient response (this test uses the actual Log Analytics API response format with capital "Table")
      const mockQueryResponse = {
        status: 'Success',
        tables: [{
          name: 'PrimaryResult',
          columnDescriptors: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Count', type: 'int' }
          ],
          rows: [
            ['2023-01-01T00:00:00Z', 100],
            ['2023-01-01T01:00:00Z', 150]
          ]
        }]
      };

      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

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
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      // Mock successful query response
      const mockQueryResponse = {
        status: 'Success',
        tables: []
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

      const result = await logAnalyticsProvider.validateConnection();

      expect(result).toEqual({ isValid: true });
      expect(mockQueryWorkspace).toHaveBeenCalledWith(
        'test-workspace-id',
        'print "connection_test"',
        { duration: 'PT1H' }
      );
    });

    it('should handle connection validation errors', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);
      
      mockQueryWorkspace.mockRejectedValue(new Error('Connection failed'));

      const result = await logAnalyticsProvider.validateConnection();

      expect(result).toEqual({
        isValid: false,
        error: 'Connection validation failed: Error: Connection failed'
      });
    });
  });

  describe('getSchema', () => {
    it('should get schema successfully', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      // Mock schema query response
      const mockQueryResponse = {
        status: 'Success',
        tables: [{
          name: 'PrimaryResult',
          columnDescriptors: [
            { name: 'TableName', type: 'string' },
            { name: 'ColumnCount', type: 'int' },
            { name: 'Columns', type: 'dynamic' }
          ],
          rows: [
            ['Heartbeat', 10, ['TimeGenerated:datetime', 'Computer:string']],
            ['Event', 8, ['TimeGenerated:datetime', 'EventLog:string']]
          ]
        }]
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

      const result = await logAnalyticsProvider.getSchema();

      expect(result.schema).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockQueryWorkspace).toHaveBeenCalledWith(
        'test-workspace-id',
        expect.stringContaining('getschema'),
        { duration: 'PT1H' }
      );
    });

    it('should handle schema retrieval errors', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);
      
      mockQueryWorkspace.mockRejectedValue(new Error('Schema failed'));

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
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      const mockQueryResponse = {
        status: 'Success',
        tables: [{
          name: 'PrimaryResult',
          columnDescriptors: [
            { name: 'StringCol', type: 'string' },
            { name: 'IntCol', type: 'int' },
            { name: 'LongCol', type: 'long' },
            { name: 'RealCol', type: 'real' },
            { name: 'DecimalCol', type: 'decimal' },
            { name: 'DateCol', type: 'datetime' },
            { name: 'BoolCol', type: 'bool' },
            { name: 'DynamicCol', type: 'dynamic' },
            { name: 'TimespanCol', type: 'timespan' },
            { name: 'UnknownCol', type: 'unknown' }
          ],
          rows: []
        }]
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

      const request: QueryExecutionRequest = { query: 'test' };
      const result = await logAnalyticsProvider.executeQuery(request);

      expect(result.tables[0].columns).toEqual([
        { name: 'StringCol', type: 'string' },
        { name: 'IntCol', type: 'long' },
        { name: 'LongCol', type: 'long' },
        { name: 'RealCol', type: 'real' },
        { name: 'DecimalCol', type: 'real' },
        { name: 'DateCol', type: 'datetime' },
        { name: 'BoolCol', type: 'bool' },
        { name: 'DynamicCol', type: 'dynamic' },
        { name: 'TimespanCol', type: 'string' },
        { name: 'UnknownCol', type: 'unknown' }
      ]);
    });

    it('should handle partial failure responses', async () => {
      // Mock workspace metadata response
      const mockWorkspaceResponse = {
        data: { properties: { customerId: 'test-workspace-id' } }
      };
      mockAxiosInstance.get.mockResolvedValue(mockWorkspaceResponse);

      const mockQueryResponse = {
        status: 'PartialFailure',
        partialTables: [{
          name: 'PrimaryResult',
          columnDescriptors: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Count', type: 'int' }
          ],
          rows: [
            ['2023-01-01T00:00:00Z', 100]
          ]
        }],
        partialError: {
          code: 'PartialError',
          message: 'Query completed with warnings'
        }
      };
      mockQueryWorkspace.mockResolvedValue(mockQueryResponse);

      const request: QueryExecutionRequest = { query: 'test query' };
      const result = await logAnalyticsProvider.executeQuery(request);

      expect(result.tables[0].columns).toEqual([
        { name: 'TimeGenerated', type: 'datetime' },
        { name: 'Count', type: 'long' }
      ]);
    });
  });
});