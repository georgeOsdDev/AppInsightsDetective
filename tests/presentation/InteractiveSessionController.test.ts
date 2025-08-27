import { InteractiveSessionController } from '../../src/presentation/InteractiveSessionController';
import { QueryService } from '../../src/services/QueryService';
import { TemplateService } from '../../src/services/TemplateService';
import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { ApplicationInsightsExternalProvider } from '../../src/providers/external-execution/ApplicationInsightsExternalProvider';
import { ConsoleOutputRenderer } from '../../src/presentation/renderers/ConsoleOutputRenderer';
import { QueryEditorService } from '../../src/services/QueryEditorService';
import { ConfigManager } from '../../src/utils/config';
import { IAIProvider } from '../../src/core/interfaces/IAIProvider';
import { ExternalExecutionProviderConfig } from '../../src/core/types/ProviderTypes';

// Mock dependencies
jest.mock('inquirer');
jest.mock('../../src/utils/logger');

const mockAIProvider: jest.Mocked<IAIProvider> = {
  initialize: jest.fn(),
  generateQuery: jest.fn(),
  explainQuery: jest.fn(),
  regenerateQuery: jest.fn(),
  analyzeQueryResult: jest.fn(),
  generateResponse: jest.fn()
};

describe('InteractiveSessionController - Azure Portal Integration', () => {
  let controller: InteractiveSessionController;
  let queryService: QueryService;
  let templateService: TemplateService;
  let externalExecutionService: ExternalExecutionService;
  let outputRenderer: ConsoleOutputRenderer;
  let queryEditorService: QueryEditorService;
  let configManager: ConfigManager;

  const mockExternalConfig: ExternalExecutionProviderConfig = {
    type: 'application-insights',
    tenantId: 'tenant-123',
    subscriptionId: 'sub-123',
    resourceGroup: 'rg-test',
    resourceName: 'app-insights-test'
  };

  beforeEach(() => {
    // Create mock services
    queryService = {
      createSession: jest.fn(),
      executeQuery: jest.fn(),
      explainQuery: jest.fn(),
    } as any;

    templateService = new TemplateService();
    const externalProvider = new ApplicationInsightsExternalProvider(mockExternalConfig);
    externalExecutionService = new ExternalExecutionService(externalProvider);
    outputRenderer = new ConsoleOutputRenderer();
    queryEditorService = new QueryEditorService();
    
    // Mock ConfigManager
    configManager = {
      getConfig: jest.fn().mockReturnValue({
        providers: {
          dataSources: {
            default: 'application-insights'
          }
        }
      })
    } as any;

    // Create controller with external execution service
    controller = new InteractiveSessionController(
      queryService,
      templateService,
      mockAIProvider,
      outputRenderer,
      queryEditorService,
      externalExecutionService,
      configManager
    );
  });

  describe('Azure Portal integration', () => {
    it('should include Azure Portal option when external execution service is available and configured', () => {
      // Test that the configuration validation works
      const validation = externalExecutionService.validateConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
    });

    it('should generate correct Azure Portal URL', async () => {
      const kqlQuery = 'exceptions | take 10';
      const url = await externalExecutionService.generateUrl('portal', kqlQuery);
      
      expect(url).toContain('portal.azure.com');
      expect(url).toContain(mockExternalConfig.tenantId);
      expect(url).toContain(mockExternalConfig.subscriptionId);
      expect(url).toContain(mockExternalConfig.resourceGroup);
      expect(url).toContain(mockExternalConfig.resourceName);
      expect(url).toContain('LogsBlade');
    });

    it('should handle missing configuration gracefully', () => {
      const invalidConfig: ExternalExecutionProviderConfig = {
        type: 'application-insights',
        tenantId: '',
        subscriptionId: 'sub-123',
        resourceGroup: 'rg-test',
        resourceName: 'app-insights-test'
      };
      
      const invalidProvider = new ApplicationInsightsExternalProvider(invalidConfig);
      const invalidExternalService = new ExternalExecutionService(invalidProvider);
      const validation = invalidExternalService.validateConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('tenantId');
    });

    it('should work without external execution service (graceful degradation)', () => {
      // Create controller without external execution service
      const controllerWithoutExternal = new InteractiveSessionController(
        queryService,
        templateService,
        mockAIProvider,
        outputRenderer,
        queryEditorService,
        null, // No external execution service
        configManager
      );

      // Should not throw errors when external service is not available
      expect(controllerWithoutExternal).toBeDefined();
    });
  });

  describe('External execution options', () => {
    it('should return correct external execution options', () => {
      const options = externalExecutionService.getAvailableOptions();
      
      expect(options).toHaveLength(1);
      expect(options[0].target).toBe('portal');
      expect(options[0].name).toContain('Azure Portal');
      expect(options[0].description).toContain('full visualization capabilities');
    });
  });
});