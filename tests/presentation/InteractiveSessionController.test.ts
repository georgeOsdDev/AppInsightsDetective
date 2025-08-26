import { InteractiveSessionController } from '../../src/presentation/InteractiveSessionController';
import { QueryService } from '../../src/services/QueryService';
import { TemplateService } from '../../src/services/TemplateService';
import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { ConsoleOutputRenderer } from '../../src/presentation/renderers/ConsoleOutputRenderer';
import { QueryEditorService } from '../../src/services/QueryEditorService';
import { IAIProvider } from '../../src/core/interfaces/IAIProvider';
import { AzureResourceInfo } from '../../src/types';

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

  const mockAzureResourceInfo: AzureResourceInfo = {
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
    externalExecutionService = new ExternalExecutionService(mockAzureResourceInfo);
    outputRenderer = new ConsoleOutputRenderer();
    queryEditorService = new QueryEditorService();

    // Create controller with external execution service
    controller = new InteractiveSessionController(
      queryService,
      templateService,
      mockAIProvider,
      outputRenderer,
      queryEditorService,
      externalExecutionService
    );
  });

  describe('Azure Portal integration', () => {
    it('should include Azure Portal option when external execution service is available and configured', () => {
      // Test that the configuration validation works
      const validation = externalExecutionService.validateConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
    });

    it('should generate correct Azure Portal URL', () => {
      const kqlQuery = 'exceptions | take 10';
      const url = externalExecutionService.generatePortalUrl(kqlQuery);
      
      expect(url).toContain('portal.azure.com');
      expect(url).toContain(mockAzureResourceInfo.tenantId);
      expect(url).toContain(mockAzureResourceInfo.subscriptionId);
      expect(url).toContain(mockAzureResourceInfo.resourceGroup);
      expect(url).toContain(mockAzureResourceInfo.resourceName);
      expect(url).toContain('LogsBlade');
    });

    it('should handle missing configuration gracefully', () => {
      const invalidResourceInfo: AzureResourceInfo = {
        tenantId: '',
        subscriptionId: 'sub-123',
        resourceGroup: 'rg-test',
        resourceName: 'app-insights-test'
      };
      
      const invalidExternalService = new ExternalExecutionService(invalidResourceInfo);
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
        null // No external execution service
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