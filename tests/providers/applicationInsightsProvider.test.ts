import { ApplicationInsightsProvider } from '../../src/providers/datasource/ApplicationInsightsProvider';
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
      },
      response: {
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

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('ApplicationInsightsProvider', () => {
  let mockConfig: DataSourceConfig;
  let applicationInsightsProvider: ApplicationInsightsProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockConfig = {
      type: 'application-insights',
      applicationId: 'test-app-id',
      tenantId: 'test-tenant',
      endpoint: 'https://api.applicationinsights.io/v1/apps'
    };

    const axios = require('axios');
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    };
    axios.create.mockReturnValue(mockAxiosInstance);

    applicationInsightsProvider = new ApplicationInsightsProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should create ApplicationInsightsProvider with valid config', () => {
      expect(applicationInsightsProvider).toBeInstanceOf(ApplicationInsightsProvider);
    });

    it('should throw error for invalid provider type', () => {
      const invalidConfig = { ...mockConfig, type: 'invalid' } as any;
      expect(() => new ApplicationInsightsProvider(invalidConfig)).toThrow('Invalid provider type for ApplicationInsightsProvider');
    });

    it('should throw error for missing applicationId', () => {
      const incompleteConfig = { ...mockConfig, applicationId: undefined };
      expect(() => new ApplicationInsightsProvider(incompleteConfig)).toThrow('Application Insights provider requires applicationId');
    });

    it('should use default endpoint when not provided', () => {
      const configWithoutEndpoint = { ...mockConfig, endpoint: undefined };
      const provider = new ApplicationInsightsProvider(configWithoutEndpoint);
      expect(provider).toBeInstanceOf(ApplicationInsightsProvider);
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'timestamp', type: 'datetime' },
              { name: 'name', type: 'string' },
              { name: 'resultCode', type: 'string' }
            ],
            rows: [
              ['2023-01-01T00:00:00.000Z', '/api/users', '200'],
              ['2023-01-01T00:01:00.000Z', '/api/orders', '404']
            ]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'requests | where timestamp > ago(1h) | project timestamp, name, resultCode',
        timespan: 'PT1H'
      };

      const result = await applicationInsightsProvider.executeQuery(request);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-app-id/query', {
        query: request.query,
        timespan: request.timespan
      });
    });

    it('should execute query without timespan', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [
              { name: 'timestamp', type: 'datetime' },
              { name: 'name', type: 'string' }
            ],
            rows: [
              ['2023-01-01T00:00:00.000Z', '/api/test']
            ]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'requests | take 1'
      };

      const result = await applicationInsightsProvider.executeQuery(request);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-app-id/query', {
        query: request.query
      });
    });

    it('should handle query execution errors', async () => {
      const mockError = new Error('Query failed');
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const request: QueryExecutionRequest = {
        query: 'invalid query'
      };

      await expect(applicationInsightsProvider.executeQuery(request)).rejects.toThrow('Application Insights query execution failed: Error: Query failed');
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      const mockResponse = {
        data: {
          tables: [{
            name: 'PrimaryResult',
            columns: [{ name: 'timestamp', type: 'datetime' }],
            rows: [['2023-01-01T00:00:00.000Z']]
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await applicationInsightsProvider.validateConnection();

      expect(result).toEqual({ isValid: true });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-app-id/query', {
        query: 'requests | take 1'
      });
    });

    it('should handle connection validation failure', async () => {
      const mockError = new Error('Connection failed');
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await applicationInsightsProvider.validateConnection();

      expect(result).toEqual({
        isValid: false,
        error: 'Connection validation failed: Error: Connection failed'
      });
    });
  });

  describe('getSchema', () => {
    it('should retrieve schema successfully', async () => {
      const mockSchema = {
        data: {
          tables: {
            requests: {
              columns: {
                timestamp: { type: 'datetime' },
                name: { type: 'string' },
                resultCode: { type: 'string' }
              }
            },
            dependencies: {
              columns: {
                timestamp: { type: 'datetime' },
                name: { type: 'string' },
                success: { type: 'bool' }
              }
            }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockSchema);

      const result = await applicationInsightsProvider.getSchema();

      expect(result).toEqual({ 
        schema: mockSchema.data,
        tables: ['requests', 'dependencies'] 
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-app-id/metadata');
    });

    it('should handle schema retrieval failure', async () => {
      const mockError = new Error('Schema retrieval failed');
      mockAxiosInstance.get.mockRejectedValue(mockError);

      const result = await applicationInsightsProvider.getSchema();

      expect(result).toEqual({
        schema: null,
        tables: [],
        error: 'Schema retrieval failed: Error: Schema retrieval failed'
      });
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata successfully', async () => {
      const mockMetadataResponse = {
        data: {
          properties: {
            applicationName: 'Test Application',
            instrumentationKey: 'test-key',
            appId: 'test-app-id',
            createdDate: '2023-01-01T00:00:00.000Z',
            flowType: 'Bluefield',
            applicationType: 'web',
            requestSource: 'rest'
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockMetadataResponse);

      const result = await applicationInsightsProvider.getMetadata();

      expect(result).toEqual({
        metadata: {
          applicationId: 'test-app-id',
          applicationName: 'Test Application',
          tenantId: 'test-tenant',
          endpoint: 'https://api.applicationinsights.io/v1/apps',
          instrumentationKey: 'test-key',
          appId: 'test-app-id',
          createdDate: '2023-01-01T00:00:00.000Z',
          flowType: 'Bluefield',
          applicationType: 'web',
          requestSource: 'rest'
        }
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-app-id');
    });

    it('should handle missing properties in metadata response', async () => {
      const mockMetadataResponse = {
        data: {
          properties: {}
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockMetadataResponse);

      const result = await applicationInsightsProvider.getMetadata();

      expect(result).toEqual({
        metadata: {
          applicationId: 'test-app-id',
          applicationName: 'Unknown',
          tenantId: 'test-tenant',
          endpoint: 'https://api.applicationinsights.io/v1/apps',
          instrumentationKey: undefined,
          appId: undefined,
          createdDate: undefined,
          flowType: undefined,
          applicationType: undefined,
          requestSource: undefined
        }
      });
    });

    it('should handle metadata retrieval failure', async () => {
      const mockError = new Error('Metadata retrieval failed');
      mockAxiosInstance.get.mockRejectedValue(mockError);

      const result = await applicationInsightsProvider.getMetadata();

      expect(result).toEqual({
        metadata: null,
        error: 'Metadata retrieval failed: Error: Metadata retrieval failed'
      });
    });
  });
});