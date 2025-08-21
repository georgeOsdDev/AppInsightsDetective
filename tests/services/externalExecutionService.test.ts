import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { AzureResourceInfo } from '../../src/types';
import { gzipSync } from 'zlib';

describe('ExternalExecutionService', () => {
  const mockAzureResourceInfo: AzureResourceInfo = {
    tenantId: 'test-tenant-id',
    subscriptionId: 'test-subscription-id',
    resourceGroup: 'test-resource-group',
    resourceName: 'test-app-insights'
  };

  const testKQLQuery = 'requests | where timestamp > ago(1h) | summarize count() by resultCode';

  let service: ExternalExecutionService;

  beforeEach(() => {
    service = new ExternalExecutionService(mockAzureResourceInfo);
  });

  describe('URL Generation', () => {
    test('should generate correct Azure Portal URL with base64/gzip encoding', () => {
      // Expected encoding: gzip + base64
      const gzippedQuery = gzipSync(Buffer.from(testKQLQuery, 'utf8'));
      const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));
      const expectedUrl = `https://portal.azure.com/#@${mockAzureResourceInfo.tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${mockAzureResourceInfo.subscriptionId}%2FresourceGroups%2F${mockAzureResourceInfo.resourceGroup}%2Fproviders%2FMicrosoft.Insights%2Fcomponents%2F${mockAzureResourceInfo.resourceName}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;
      const actualUrl = service.generatePortalUrl(testKQLQuery);

      expect(actualUrl).toBe(expectedUrl);
    });

    test('should generate URL for portal target', () => {
      const portalUrl = service.generateUrl('portal', testKQLQuery);

      expect(portalUrl).toContain('portal.azure.com');
      expect(portalUrl).toContain(mockAzureResourceInfo.tenantId);
      expect(portalUrl).toContain(mockAzureResourceInfo.subscriptionId);
    });

    test('should throw error for unsupported target', () => {
      expect(() => {
        service.generateUrl('unknown' as any, testKQLQuery);
      }).toThrow('Unsupported external execution target');
    });
  });

  describe('Available Options', () => {
    test('should return only Azure Portal option', () => {
      const options = service.getAvailableOptions();

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        target: 'portal',
        name: '🌐 Azure Portal (Application Insights)',
        description: 'Open query in Azure Portal Logs blade with full visualization capabilities'
      });
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
        tenantId: '',
        subscriptionId: 'test-sub',
        resourceGroup: 'test-rg',
        resourceName: 'test-name'
      });

      const validation = incompleteService.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('tenantId');
    });
  });

  describe('External Execution', () => {
    test('should execute external portal successfully', async () => {
      const launchBrowserSpy = jest.spyOn(service as any, 'launchBrowser').mockResolvedValue(undefined);

      const result = await service.executeExternal('portal', testKQLQuery, false);

      expect(result.launched).toBe(true);
      expect(result.target).toBe('portal');
      expect(result.url).toContain('portal.azure.com');
      expect(launchBrowserSpy).toHaveBeenCalledWith(result.url);

      launchBrowserSpy.mockRestore();
    });

    test('should handle browser launch failure', async () => {
      const launchBrowserSpy = jest.spyOn(service as any, 'launchBrowser').mockRejectedValue(new Error('Browser launch failed'));

      const result = await service.executeExternal('portal', testKQLQuery, false);

      expect(result.launched).toBe(false);
      expect(result.error).toContain('Failed to open query in portal');

      launchBrowserSpy.mockRestore();
    });
  });
});
