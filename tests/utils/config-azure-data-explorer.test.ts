import { ConfigManager } from '../../src/utils/config';

describe('ConfigManager Azure Data Explorer Support', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Mock fs to provide a test configuration
    const mockConfig = {
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'azure-data-explorer',
          'azure-data-explorer': {
            type: 'azure-data-explorer',
            clusterUri: 'https://help.kusto.windows.net',
            database: 'Samples',
            requiresAuthentication: false
          }
        },
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: 'test-tenant-id'
          }
        }
      },
      logLevel: 'info'
    };

    jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(JSON.stringify(mockConfig));
    
    configManager = new ConfigManager();
    (configManager as any).config = mockConfig;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should validate azure-data-explorer configuration correctly', () => {
    const result = configManager.validateConfig();
    expect(result).toBe(true);
  });

  it('should return false for invalid azure-data-explorer config (missing clusterUri)', () => {
    const mockConfigInvalid = {
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'azure-data-explorer',
          'azure-data-explorer': {
            type: 'azure-data-explorer',
            database: 'Samples'
          }
        },
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: 'test-tenant-id'
          }
        }
      },
      logLevel: 'info'
    };
    
    (configManager as any).config = mockConfigInvalid;
    const result = configManager.validateConfig();
    expect(result).toBe(false);
  });

  it('should return false for invalid azure-data-explorer config (missing database)', () => {
    const mockConfigInvalid = {
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'azure-data-explorer',
          'azure-data-explorer': {
            type: 'azure-data-explorer',
            clusterUri: 'https://help.kusto.windows.net'
          }
        },
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: 'test-tenant-id'
          }
        }
      },
      logLevel: 'info'
    };
    
    (configManager as any).config = mockConfigInvalid;
    const result = configManager.validateConfig();
    expect(result).toBe(false);
  });
});