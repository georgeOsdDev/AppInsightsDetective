import { AzureDataExplorerProvider } from '../../src/providers/datasource/AzureDataExplorerProvider';
import { DataSourceConfig } from '../../src/core/types/ProviderTypes';
import { QueryExecutionRequest } from '../../src/core/interfaces/IDataSourceProvider';

// Mock the entire azure-kusto-data module
const mockExecute = jest.fn();
const mockSetOption = jest.fn();

jest.mock('azure-kusto-data', () => ({
  Client: jest.fn().mockImplementation(() => ({
    execute: mockExecute
  })),
  KustoConnectionStringBuilder: {
    withAccessToken: jest.fn().mockReturnValue('mock-connection-string-with-token'),
    withTokenCredential: jest.fn().mockReturnValue('mock-connection-string-with-credential'),
    withAadManagedIdentity: jest.fn().mockReturnValue('mock-connection-string-managed-identity'),
    withSystemManagedIdentity: jest.fn().mockReturnValue('mock-connection-string-system-managed-identity')
  },
  ClientRequestProperties: jest.fn().mockImplementation(() => ({
    setOption: mockSetOption
  }))
}));

// Mock @azure/identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

describe('AzureDataExplorerProvider', () => {
  const mockConfig: DataSourceConfig = {
    type: 'azure-data-explorer',
    clusterUri: 'https://help.kusto.windows.net',
    database: 'Samples',
    requiresAuthentication: true // All ADX clusters now require authentication
  };

  const mockAuthProvider = {
    getAccessToken: jest.fn().mockResolvedValue('mock-auth-token'),
    validateCredentials: jest.fn().mockResolvedValue(true),
    getOpenAIToken: jest.fn().mockResolvedValue('mock-openai-token')
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(() => new AzureDataExplorerProvider(mockConfig)).not.toThrow();
    });

    it('should throw error with invalid provider type', () => {
      const invalidConfig = { ...mockConfig, type: 'invalid' as any };
      expect(() => new AzureDataExplorerProvider(invalidConfig)).toThrow(
        'Invalid provider type for AzureDataExplorerProvider'
      );
    });

    it('should throw error without clusterUri', () => {
      const invalidConfig = { ...mockConfig, clusterUri: undefined };
      expect(() => new AzureDataExplorerProvider(invalidConfig)).toThrow(
        'Azure Data Explorer provider requires clusterUri'
      );
    });

    it('should throw error without database', () => {
      const invalidConfig = { ...mockConfig, database: undefined };
      expect(() => new AzureDataExplorerProvider(invalidConfig)).toThrow(
        'Azure Data Explorer provider requires database'
      );
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);
      
      const mockResponse = {
        primaryResults: [{
          columns: [
            { columnName: 'State', dataType: 'string' },
            { columnName: 'EventCount', dataType: 'long' }
          ],
          rows: [
            ['CALIFORNIA', 100],
            ['TEXAS', 75]
          ]
        }]
      };

      mockExecute.mockResolvedValueOnce(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'StormEvents | summarize EventCount = count() by State | top 2 by EventCount'
      };

      const result = await provider.executeQuery(request);

      expect(result).toMatchObject({
        tables: [{
          name: 'PrimaryResult',
          columns: [
            { name: 'State', type: 'string' },
            { name: 'EventCount', type: 'long' }
          ],
          rows: [
            ['CALIFORNIA', 100],
            ['TEXAS', 75]
          ]
        }]
      });
    });

    it('should handle query execution errors', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);
      
      mockExecute.mockRejectedValueOnce(new Error('Query failed'));

      const request: QueryExecutionRequest = {
        query: 'invalid query'
      };

      await expect(provider.executeQuery(request)).rejects.toThrow(
        'Azure Data Explorer query execution failed'
      );
    });

    it('should handle empty response', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);
      
      const mockResponse = {
        primaryResults: []
      };

      mockExecute.mockResolvedValueOnce(mockResponse);

      const request: QueryExecutionRequest = {
        query: 'StormEvents | limit 0'
      };

      const result = await provider.executeQuery(request);

      expect(result).toMatchObject({
        tables: [{
          name: 'PrimaryResult',
          columns: [],
          rows: []
        }]
      });
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      const mockResponse = {
        primaryResults: [{
          columns: [{ columnName: 'BuildVersion', dataType: 'string' }],
          rows: [['1.0.0']]
        }]
      };

      mockExecute.mockResolvedValueOnce(mockResponse);

      const result = await provider.validateConnection();

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockExecute).toHaveBeenCalledWith('Samples', '.show version', expect.any(Object));
    });

    it('should handle connection validation errors', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      mockExecute.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await provider.validateConnection();

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Connection validation failed');
    });
  });

  describe('getSchema', () => {
    it('should retrieve schema successfully', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      const mockTablesResponse = {
        primaryResults: [{
          columns: [{ columnName: 'TableName', dataType: 'string' }],
          rows: [['StormEvents'], ['PopulationData']]
        }]
      };

      const mockSchemaResponse = {
        primaryResults: [{
          columns: [
            { columnName: 'TableName', dataType: 'string' },
            { columnName: 'ColumnName', dataType: 'string' },
            { columnName: 'ColumnType', dataType: 'string' }
          ],
          rows: [
            ['StormEvents', 'State', 'string'],
            ['StormEvents', 'EventType', 'string'],
            ['PopulationData', 'State', 'string'],
            ['PopulationData', 'Population', 'long']
          ]
        }]
      };

      // Mock sequential responses for tables and schema queries
      mockExecute
        .mockResolvedValueOnce(mockTablesResponse)
        .mockResolvedValueOnce(mockSchemaResponse);

      const result = await provider.getSchema();

      expect(result.tables).toEqual(['StormEvents', 'PopulationData']);
      expect(result.schema).toMatchObject({
        StormEvents: {
          State: 'string',
          EventType: 'string'
        },
        PopulationData: {
          State: 'string',
          Population: 'long'
        }
      });
    });

    it('should handle schema retrieval errors', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      mockExecute.mockRejectedValueOnce(new Error('Schema failed'));

      const result = await provider.getSchema();

      expect(result.error).toContain('Schema retrieval failed');
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata successfully', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      const mockVersionResponse = {
        primaryResults: [{
          columns: [{ columnName: 'BuildVersion', dataType: 'string' }],
          rows: [['1.0.0']]
        }]
      };

      const mockDatabaseResponse = {
        primaryResults: [{
          columns: [{ columnName: 'DatabaseName', dataType: 'string' }],
          rows: [['Samples']]
        }]
      };

      // Mock sequential responses
      mockExecute
        .mockResolvedValueOnce(mockVersionResponse)
        .mockResolvedValueOnce(mockDatabaseResponse);

      const result = await provider.getMetadata();

      expect(result.name).toBe('https://help.kusto.windows.net/Samples');
      expect(result.type).toBe('azure-data-explorer');
      expect(result.properties).toMatchObject({
        clusterUri: 'https://help.kusto.windows.net',
        database: 'Samples',
        requiresAuthentication: true
      });
    });

    it('should handle metadata retrieval errors', async () => {
      const provider = new AzureDataExplorerProvider(mockConfig);

      mockExecute.mockRejectedValueOnce(new Error('Metadata failed'));

      const result = await provider.getMetadata();

      expect(result.error).toContain('Metadata retrieval failed');
    });
  });

  describe('authentication modes', () => {
    it('should handle Microsoft Help cluster with Azure AD authentication', () => {
      const helpConfig = { ...mockConfig, clusterUri: 'https://help.kusto.windows.net', requiresAuthentication: true };
      expect(() => new AzureDataExplorerProvider(helpConfig)).not.toThrow();
    });

    it('should handle authenticated cluster with auth provider', () => {
      const authConfig = { ...mockConfig, requiresAuthentication: true };
      expect(() => new AzureDataExplorerProvider(authConfig, mockAuthProvider)).not.toThrow();
    });

    it('should handle authenticated cluster without auth provider (uses managed identity)', () => {
      const authConfig = { ...mockConfig, requiresAuthentication: true };
      expect(() => new AzureDataExplorerProvider(authConfig)).not.toThrow();
    });
  });
});