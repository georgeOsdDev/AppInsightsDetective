import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { AzureResourceInfo } from '../../src/types';

describe('ExternalExecutionService', () => {
  const mockAzureResourceInfo: AzureResourceInfo = {
    tenantId: 'test-tenant-id',
    subscriptionId: 'test-subscription-id',
    resourceGroup: 'test-resource-group',
    resourceName: 'test-app-insights',
    clusterId: 'test-cluster-id',
    databaseName: 'ApplicationInsights'
  };

  const testKQLQuery = 'requests | where timestamp > ago(1h) | summarize count() by resultCode';

  let service: ExternalExecutionService;

  beforeEach(() => {
    service = new ExternalExecutionService(mockAzureResourceInfo);
    jest.clearAllMocks();
  });

  describe('URL Generation', () => {
    test('should generate correct Azure Portal URL', () => {
      const expectedUrl = `https://portal.azure.com/#@${mockAzureResourceInfo.tenantId}/resource/subscriptions/${mockAzureResourceInfo.subscriptionId}/resourceGroups/${mockAzureResourceInfo.resourceGroup}/providers/Microsoft.Insights/components/${mockAzureResourceInfo.resourceName}/logs?query=${encodeURIComponent(testKQLQuery)}`;
      
      const actualUrl = service.generatePortalUrl(testKQLQuery);
      
      expect(actualUrl).toBe(expectedUrl);
    });

    test('should generate correct Azure Data Explorer URL', () => {
      const expectedUrl = `https://dataexplorer.azure.com/clusters/${mockAzureResourceInfo.clusterId}/databases/${mockAzureResourceInfo.databaseName}?query=${encodeURIComponent(testKQLQuery)}`;
      
      const actualUrl = service.generateDataExplorerUrl(testKQLQuery);
      
      expect(actualUrl).toBe(expectedUrl);
    });

    test('should throw error for Data Explorer URL without cluster info', () => {
      const serviceWithoutCluster = new ExternalExecutionService({
        ...mockAzureResourceInfo,
        clusterId: undefined,
        databaseName: undefined
      });

      expect(() => {
        serviceWithoutCluster.generateDataExplorerUrl(testKQLQuery);
      }).toThrow('Cluster ID and Database Name are required for Data Explorer URLs');
    });

    test('should generate URL for specified target', () => {
      const portalUrl = service.generateUrl('portal', testKQLQuery);
      const dataExplorerUrl = service.generateUrl('dataexplorer', testKQLQuery);

      expect(portalUrl).toContain('portal.azure.com');
      expect(dataExplorerUrl).toContain('dataexplorer.azure.com');
    });

    test('should throw error for unsupported target', () => {
      expect(() => {
        service.generateUrl('unknown' as any, testKQLQuery);
      }).toThrow('Unsupported external execution target: unknown');
    });
  });

  describe('Available Options', () => {
    test('should return portal and data explorer options when cluster info is available', () => {
      const options = service.getAvailableOptions();

      expect(options).toHaveLength(2);
      expect(options[0].target).toBe('portal');
      expect(options[0].name).toContain('Azure Portal');
      expect(options[1].target).toBe('dataexplorer');
      expect(options[1].name).toContain('Azure Data Explorer');
    });

    test('should return only portal option when cluster info is missing', () => {
      const serviceWithoutCluster = new ExternalExecutionService({
        ...mockAzureResourceInfo,
        clusterId: undefined,
        databaseName: undefined
      });

      const options = serviceWithoutCluster.getAvailableOptions();

      expect(options).toHaveLength(1);
      expect(options[0].target).toBe('portal');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate complete configuration', () => {
      const validation = service.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const incompleteService = new ExternalExecutionService({
        ...mockAzureResourceInfo,
        subscriptionId: '',
        resourceGroup: ''
      });

      const validation = incompleteService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('subscriptionId');
      expect(validation.missingFields).toContain('resourceGroup');
    });

    test('should check Data Explorer availability', () => {
      expect(service.isDataExplorerAvailable()).toBe(true);

      const serviceWithoutCluster = new ExternalExecutionService({
        ...mockAzureResourceInfo,
        clusterId: undefined
      });

      expect(serviceWithoutCluster.isDataExplorerAvailable()).toBe(false);
    });
  });

  describe('External Execution', () => {
    test('should execute external portal successfully', async () => {
      // Spy on the launchBrowser method
      const launchBrowserSpy = jest.spyOn(service as any, 'launchBrowser').mockResolvedValue(undefined);

      const result = await service.executeExternal('portal', testKQLQuery, false);

      expect(result.launched).toBe(true);
      expect(result.target).toBe('portal');
      expect(result.url).toContain('portal.azure.com');
      expect(result.error).toBeUndefined();
      expect(launchBrowserSpy).toHaveBeenCalledWith(result.url);
      
      launchBrowserSpy.mockRestore();
    });

    test('should handle browser launch failure', async () => {
      const mockError = new Error('Browser launch failed');
      const launchBrowserSpy = jest.spyOn(service as any, 'launchBrowser').mockRejectedValue(mockError);

      const result = await service.executeExternal('portal', testKQLQuery, false);

      expect(result.launched).toBe(false);
      expect(result.error).toContain('Failed to open query in portal');
      
      launchBrowserSpy.mockRestore();
    });

    test('should execute Data Explorer successfully', async () => {
      const launchBrowserSpy = jest.spyOn(service as any, 'launchBrowser').mockResolvedValue(undefined);

      const result = await service.executeExternal('dataexplorer', testKQLQuery, false);

      expect(result.launched).toBe(true);
      expect(result.target).toBe('dataexplorer');
      expect(result.url).toContain('dataexplorer.azure.com');
      
      launchBrowserSpy.mockRestore();
    });
  });
});