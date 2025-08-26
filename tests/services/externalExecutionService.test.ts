import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { ApplicationInsightsExternalProvider } from '../../src/providers/external-execution/ApplicationInsightsExternalProvider';
import { ExternalExecutionProviderConfig } from '../../src/core/types/ProviderTypes';
import { gzipSync } from 'zlib';

describe('ExternalExecutionService', () => {
  const mockConfig: ExternalExecutionProviderConfig = {
    type: 'application-insights',
    tenantId: 'test-tenant-id',
    subscriptionId: 'test-subscription-id',
    resourceGroup: 'test-resource-group',
    resourceName: 'test-app-insights'
  };

  const testKQLQuery = 'requests | where timestamp > ago(1h) | summarize count() by resultCode';

  let service: ExternalExecutionService;
  let provider: ApplicationInsightsExternalProvider;

  beforeEach(() => {
    provider = new ApplicationInsightsExternalProvider(mockConfig);
    service = new ExternalExecutionService(provider);
  });

  describe('URL Generation', () => {
    test('should generate correct Azure Portal URL with base64/gzip encoding', async () => {
      // Expected encoding: gzip + base64
      const gzippedQuery = gzipSync(Buffer.from(testKQLQuery, 'utf8'));
      const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));
      const expectedUrl = `https://portal.azure.com/#@${mockConfig.tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${mockConfig.subscriptionId}%2FresourceGroups%2F${mockConfig.resourceGroup}%2Fproviders%2FMicrosoft.Insights%2Fcomponents%2F${mockConfig.resourceName}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;
      const actualUrl = await service.generateUrl('portal', testKQLQuery);

      expect(actualUrl).toBe(expectedUrl);
    });

    test('should generate URL for portal target', async () => {
      const portalUrl = await service.generateUrl('portal', testKQLQuery);

      expect(portalUrl).toContain('portal.azure.com');
      expect(portalUrl).toContain(mockConfig.tenantId);
      expect(portalUrl).toContain(mockConfig.subscriptionId);
    });

    test('should throw error for unsupported target', async () => {
      await expect(service.generateUrl('unknown' as any, testKQLQuery))
        .rejects.toThrow('Unsupported external execution target');
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
      const incompleteConfig: ExternalExecutionProviderConfig = {
        type: 'application-insights',
        tenantId: '',
        subscriptionId: 'test-sub',
        resourceGroup: 'test-rg',
        resourceName: 'test-name'
      };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);
      const incompleteService = new ExternalExecutionService(incompleteProvider);

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
