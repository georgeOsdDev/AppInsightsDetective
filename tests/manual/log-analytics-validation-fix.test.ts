import { ConfigManager } from '../../src/utils/config';

/**
 * Manual test to verify the Log Analytics configuration validation fix
 */
describe('Log Analytics Configuration Validation Fix', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Mock the fs module and logger to prevent actual file I/O
    jest.resetModules();
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(false),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
      mkdirSync: jest.fn()
    };
    jest.doMock('fs', () => mockFs);
    jest.doMock('../../src/utils/logger');
    jest.doMock('../../src/services/resourceGraphService');
  });

  it('should validate Log Analytics configuration with workspaceId', () => {
    const validLogAnalyticsConfig = {
      providers: {
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: '87654321-4321-4321-4321-cba987654321'
          }
        },
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'log-analytics',
          'log-analytics': {
            type: 'log-analytics',
            workspaceId: '12345678-1234-1234-1234-123456789abc',
            tenantId: '87654321-4321-4321-4321-cba987654321',
            endpoint: 'https://api.loganalytics.io/v1/workspaces',
            subscriptionId: 'auto-discovered-sub-id',
            resourceGroup: 'DefaultResourceGroup-EJP',
            resourceName: 'DefaultWorkspace-XXXXXXXX'
          }
        }
      },
      logLevel: 'info' as const
    };

    configManager = new ConfigManager();
    (configManager as any).config = validLogAnalyticsConfig;
    
    const isValid = configManager.validateConfig();
    expect(isValid).toBe(true);
    
    console.log('✅ Log Analytics configuration with workspaceId validated successfully');
  });

  it('should reject Log Analytics configuration without workspaceId', () => {
    const invalidLogAnalyticsConfig = {
      providers: {
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: '87654321-4321-4321-4321-cba987654321'
          }
        },
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'log-analytics',
          'log-analytics': {
            type: 'log-analytics',
            workspaceId: '', // Empty workspaceId should fail
            tenantId: '87654321-4321-4321-4321-cba987654321',
            endpoint: 'https://api.loganalytics.io/v1/workspaces',
            subscriptionId: 'auto-discovered-sub-id',
            resourceGroup: 'DefaultResourceGroup-EJP',
            resourceName: 'DefaultWorkspace-XXXXXXXX'
          }
        }
      },
      logLevel: 'info' as const
    };

    configManager = new ConfigManager();
    (configManager as any).config = invalidLogAnalyticsConfig;
    
    const isValid = configManager.validateConfig();
    expect(isValid).toBe(false);
    
    console.log('✅ Invalid Log Analytics configuration properly rejected');
  });

  it('should still validate Application Insights configuration with applicationId', () => {
    const validAppInsightsConfig = {
      providers: {
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: '87654321-4321-4321-4321-cba987654321'
          }
        },
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: 'https://test.openai.azure.com/',
            deploymentName: 'gpt-4'
          }
        },
        dataSources: {
          default: 'application-insights',
          'application-insights': {
            type: 'application-insights',
            applicationId: '12345678-1234-1234-1234-123456789abc',
            tenantId: '87654321-4321-4321-4321-cba987654321',
            endpoint: 'https://api.applicationinsights.io/v1/apps',
            subscriptionId: 'auto-discovered-sub-id',
            resourceGroup: 'DefaultResourceGroup-EJP',
            resourceName: 'DefaultWorkspace-XXXXXXXX'
          }
        }
      },
      logLevel: 'info' as const
    };

    configManager = new ConfigManager();
    (configManager as any).config = validAppInsightsConfig;
    
    const isValid = configManager.validateConfig();
    expect(isValid).toBe(true);
    
    console.log('✅ Application Insights configuration backward compatibility maintained');
  });
});