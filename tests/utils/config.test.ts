import { ConfigManager } from '../../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('../../src/utils/logger');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalHome: string | undefined;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    originalHome = process.env.HOME;

    // Reset mocks
    mockFs.existsSync.mockClear();
    mockFs.readFileSync.mockClear();
    mockFs.writeFileSync.mockClear();
    mockFs.mkdirSync.mockClear();

    // Set test environment
    process.env.HOME = '/test/home';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should load user config when user config exists', () => {
      const mockConfig = {
        appInsights: { applicationId: 'test-id', tenantId: 'test-tenant' },
        openAI: { endpoint: 'test-endpoint' },
        logLevel: 'info' as const
      };

      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('.aidx');
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configManager = new ConfigManager();

      expect(configManager.getConfig()).toEqual(mockConfig);
    });

    it('should load default config when no user config exists', () => {
      const mockConfig = {
        appInsights: { applicationId: 'default-id', tenantId: 'default-tenant' },
        openAI: { endpoint: 'default-endpoint' },
        logLevel: 'info' as const
      };

      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('config/default.json');
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configManager = new ConfigManager();

      expect(configManager.getConfig()).toEqual(mockConfig);
    });

    it('should build config from environment variables when no config files exist', () => {
      process.env.AZURE_APPLICATION_INSIGHTS_ID = 'env-app-id';
      process.env.AZURE_TENANT_ID = 'env-tenant-id';
      process.env.AZURE_OPENAI_ENDPOINT = 'env-openai-endpoint';
      process.env.LOG_LEVEL = 'debug';

      mockFs.existsSync.mockReturnValue(false);

      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.appInsights.applicationId).toBe('env-app-id');
      expect(config.appInsights.tenantId).toBe('env-tenant-id');
      expect(config.openAI.endpoint).toBe('env-openai-endpoint');
      expect(config.logLevel).toBe('debug');
    });

    it('should throw error if config loading fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      expect(() => new ConfigManager()).toThrow('Configuration could not be loaded');
    });
  });

  describe('updateConfig', () => {
    let configManager: ConfigManager;

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false); // Use env config
      configManager = new ConfigManager();
      mockFs.existsSync.mockClear(); // Clear for updateConfig tests
    });

    it('should update config and save to user config file', () => {
      const updates = {
        logLevel: 'debug' as const,
      };

      mockFs.existsSync.mockReturnValue(true); // Config dir exists
      mockFs.writeFileSync.mockImplementation(() => {});

      configManager.updateConfig(updates);

      expect(configManager.getConfig().logLevel).toBe('debug');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should create config directory if it does not exist', () => {
      const updates = { logLevel: 'debug' as const };

      mockFs.existsSync.mockReturnValue(false); // Config dir does not exist
      mockFs.mkdirSync.mockImplementation(() => '');
      mockFs.writeFileSync.mockImplementation(() => {});

      configManager.updateConfig(updates);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.aidx'),
        { recursive: true }
      );
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error if save fails', () => {
      const updates = { logLevel: 'debug' as const };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => configManager.updateConfig(updates)).toThrow('Failed to save configuration');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      const mockConfig = {
        appInsights: { applicationId: 'test-id', tenantId: 'test-tenant' },
        openAI: { endpoint: 'test-endpoint' },
        logLevel: 'info' as const
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configManager = new ConfigManager();

      expect(configManager.validateConfig()).toBe(true);
    });

    it('should return false for invalid Application Insights config', () => {
      const mockConfig = {
        appInsights: { applicationId: '', tenantId: 'test-tenant' },
        openAI: { endpoint: 'test-endpoint' },
        logLevel: 'info' as const
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configManager = new ConfigManager();

      expect(configManager.validateConfig()).toBe(false);
    });

    it('should return false for invalid OpenAI config', () => {
      const mockConfig = {
        appInsights: { applicationId: 'test-id', tenantId: 'test-tenant' },
        openAI: { endpoint: '' },
        logLevel: 'info' as const
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configManager = new ConfigManager();

      expect(configManager.validateConfig()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should throw error if config is not loaded', () => {
      // Create a broken ConfigManager
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      expect(() => {
        const configManager = new ConfigManager();
      }).toThrow('Configuration could not be loaded');
    });
  });
});
