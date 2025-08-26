import { ApplicationInsightsExternalProvider } from '../../../src/providers/external-execution/ApplicationInsightsExternalProvider';
import { ExternalExecutionProviderConfig } from '../../../src/core/types/ProviderTypes';
import { gzipSync } from 'zlib';

describe('ApplicationInsightsExternalProvider', () => {
  const validConfig: ExternalExecutionProviderConfig = {
    type: 'application-insights',
    tenantId: 'test-tenant-id',
    subscriptionId: 'test-subscription-id',
    resourceGroup: 'test-resource-group',
    resourceName: 'test-app-insights'
  };

  const testKQLQuery = 'requests | where timestamp > ago(1h) | summarize count() by resultCode';

  let provider: ApplicationInsightsExternalProvider;

  beforeEach(() => {
    provider = new ApplicationInsightsExternalProvider(validConfig);
  });

  describe('Constructor', () => {
    it('should initialize successfully with valid config', () => {
      expect(provider).toBeInstanceOf(ApplicationInsightsExternalProvider);
    });

    it('should throw error with invalid provider type', () => {
      const invalidConfig = { ...validConfig, type: 'log-analytics' as any };
      expect(() => new ApplicationInsightsExternalProvider(invalidConfig))
        .toThrow('Invalid provider type for ApplicationInsightsExternalProvider');
    });
  });

  describe('getAvailableOptions', () => {
    it('should return Application Insights portal option', () => {
      const options = provider.getAvailableOptions();

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        target: 'portal',
        name: '🌐 Azure Portal (Application Insights)',
        description: 'Open query in Azure Portal Logs blade with full visualization capabilities'
      });
    });
  });

  describe('generateUrl', () => {
    it('should generate correct Azure Portal URL for portal target', async () => {
      // Expected encoding: gzip + base64
      const gzippedQuery = gzipSync(Buffer.from(testKQLQuery, 'utf8'));
      const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));
      const expectedUrl = `https://portal.azure.com/#@${validConfig.tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${validConfig.subscriptionId}%2FresourceGroups%2F${validConfig.resourceGroup}%2Fproviders%2FMicrosoft.Insights%2Fcomponents%2F${validConfig.resourceName}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;

      const actualUrl = await provider.generateUrl('portal', testKQLQuery);

      expect(actualUrl).toBe(expectedUrl);
    });

    it('should throw error for unsupported target', async () => {
      await expect(provider.generateUrl('unknown' as any, testKQLQuery))
        .rejects.toThrow('Unsupported external execution target: unknown');
    });

    it('should handle complex queries with special characters', async () => {
      const complexQuery = `requests 
        | where name contains "api/test" and resultCode != 200
        | extend duration_ms = duration * 1000
        | summarize count() by bin(timestamp, 1h)`;

      const url = await provider.generateUrl('portal', complexQuery);

      expect(url).toContain('portal.azure.com');
      expect(url).toContain(validConfig.tenantId);
      expect(url).toContain(validConfig.subscriptionId);
      expect(url).toContain('LogsBlade');
    });

    it('should throw error when generating URL with missing required fields', async () => {
      const incompleteConfig = { 
        ...validConfig, 
        subscriptionId: '', 
        resourceGroup: '', 
        resourceName: '' 
      };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      await expect(incompleteProvider.generateUrl('portal', testKQLQuery))
        .rejects.toThrow('Cannot generate Azure Portal URL. Missing required configuration: subscriptionId, resourceGroup, resourceName');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate complete configuration', () => {
      const validation = provider.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
    });

    it('should detect missing tenantId', () => {
      const incompleteConfig = { ...validConfig, tenantId: '' };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('tenantId');
    });

    it('should detect missing subscriptionId but still be valid with tenantId', () => {
      const incompleteConfig = { ...validConfig, subscriptionId: undefined };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(true); // Valid because tenantId is present
      expect(validation.missingFields).toContain('subscriptionId');
    });

    it('should detect missing resourceGroup but still be valid with tenantId', () => {
      const incompleteConfig = { ...validConfig, resourceGroup: '' };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(true); // Valid because tenantId is present
      expect(validation.missingFields).toContain('resourceGroup');
    });

    it('should detect missing resourceName but still be valid with tenantId', () => {
      const incompleteConfig = { ...validConfig, resourceName: '' };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(true); // Valid because tenantId is present
      expect(validation.missingFields).toContain('resourceName');
    });

    it('should detect multiple missing fields', () => {
      const incompleteConfig = {
        ...validConfig,
        tenantId: '',
        subscriptionId: '',
        resourceGroup: ''
      };
      const incompleteProvider = new ApplicationInsightsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toHaveLength(3);
      expect(validation.missingFields).toContain('tenantId');
      expect(validation.missingFields).toContain('subscriptionId');
      expect(validation.missingFields).toContain('resourceGroup');
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = provider.getMetadata();

      expect(metadata).toEqual({
        name: 'Application Insights External Provider',
        type: 'application-insights',
        description: 'Provides external execution options for Azure Application Insights',
        supportedTargets: ['portal']
      });
    });
  });
});