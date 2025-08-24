import { Bootstrap } from '../../src/infrastructure/Bootstrap';
import { ServiceContainer } from '../../src/infrastructure/di/ServiceContainer';
import { ProviderFactory } from '../../src/infrastructure/di/ProviderFactory';
import { IAIProvider, IDataSourceProvider, IAuthenticationProvider } from '../../src/core/interfaces';

// Mock configuration to use multi-provider format
jest.mock('../../src/utils/config', () => {
  return {
    ConfigManager: jest.fn().mockImplementation(() => ({
      getConfig: () => ({
        providers: {
          auth: {
            default: 'azure-managed-identity',
            'azure-managed-identity': {}
          },
          ai: {
            default: 'azure-openai',
            'azure-openai': {
              endpoint: 'https://test.openai.azure.com/',
              deploymentName: 'gpt-4'
            }
          },
          dataSources: {
            default: 'application-insights',
            'application-insights': {
              applicationId: 'test-app-id',
              endpoint: 'https://api.applicationinsights.io/v1/apps'
            }
          }
        }
      }),
      validateConfig: () => true
    }))
  };
});

// Mock Azure Identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: 'requests | take 10' },
            finish_reason: 'stop'
          }]
        })
      }
    }
  }));
});

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    post: jest.fn().mockResolvedValue({ data: { tables: [] } }),
    get: jest.fn().mockResolvedValue({ data: { tables: [] } })
  })),
  default: {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      post: jest.fn().mockResolvedValue({ data: { tables: [] } }),
      get: jest.fn().mockResolvedValue({ data: { tables: [] } })
    }))
  }
}));

describe('Bootstrap and Dependency Injection', () => {
  let bootstrap: Bootstrap;
  let container: ServiceContainer;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    container = await bootstrap.initialize();
  });

  describe('Service Container', () => {
    it('should create a service container', () => {
      expect(container).toBeInstanceOf(ServiceContainer);
    });

    it('should register core services', () => {
      expect(container.isRegistered('configManager')).toBe(true);
      expect(container.isRegistered('authProvider')).toBe(true);
      expect(container.isRegistered('aiProvider')).toBe(true);
      expect(container.isRegistered('dataSourceProvider')).toBe(true);
    });

    it('should resolve providers that implement correct interfaces', () => {
      const authProvider = container.resolve<IAuthenticationProvider>('authProvider');
      const aiProvider = container.resolve<IAIProvider>('aiProvider');
      const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');

      expect(authProvider).toBeDefined();
      expect(typeof authProvider.getAccessToken).toBe('function');
      expect(typeof authProvider.validateCredentials).toBe('function');

      expect(aiProvider).toBeDefined();
      expect(typeof aiProvider.initialize).toBe('function');
      expect(typeof aiProvider.generateQuery).toBe('function');
      expect(typeof aiProvider.explainQuery).toBe('function');

      expect(dataSourceProvider).toBeDefined();
      expect(typeof dataSourceProvider.executeQuery).toBe('function');
      expect(typeof dataSourceProvider.validateConnection).toBe('function');
    });
  });

  describe('Provider Factory', () => {
    it('should register provider factory', () => {
      expect(container.isRegistered('providerFactory')).toBe(true);
    });

    it('should provide working provider factory', () => {
      const factory = container.resolve<ProviderFactory>('providerFactory');
      expect(factory).toBeDefined();
      expect(typeof factory.createAIProvider).toBe('function');
      expect(typeof factory.createDataSourceProvider).toBe('function');
      expect(typeof factory.createAuthProvider).toBe('function');
    });
  });

  describe('AI Provider Integration', () => {
    it('should provide functional AI provider', async () => {
      const aiProvider = container.resolve<IAIProvider>('aiProvider');
      
      await expect(aiProvider.initialize()).resolves.not.toThrow();
      
      const queryResult = await aiProvider.generateQuery({
        userInput: 'show me all requests',
        schema: null
      });
      
      expect(queryResult).toBeDefined();
      expect(queryResult.generatedKQL).toBeDefined();
      expect(queryResult.confidence).toBeGreaterThan(0);
    });
  });

  describe('Data Source Provider Integration', () => {
    it('should provide functional data source provider', async () => {
      const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
      
      const result = await dataSourceProvider.executeQuery({
        query: 'requests | take 1'
      });
      
      expect(result).toBeDefined();
      expect(result.tables).toBeDefined();
    });

    it('should provide schema functionality', async () => {
      const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
      
      const schema = await dataSourceProvider.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.tables).toBeDefined();
      expect(schema.schema).toBeDefined();
    });
  });

  describe('Authentication Provider Integration', () => {
    it('should provide functional auth provider', async () => {
      const authProvider = container.resolve<IAuthenticationProvider>('authProvider');
      
      const token = await authProvider.getAccessToken(['https://api.applicationinsights.io/.default']);
      
      expect(token).toBe('mock-token');
    });
  });
});