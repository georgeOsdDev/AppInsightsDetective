import { LogAnalyticsExternalProvider } from '../../../src/providers/external-execution/LogAnalyticsExternalProvider';
import { ExternalExecutionProviderConfig } from '../../../src/core/types/ProviderTypes';
import { gzipSync } from 'zlib';

describe('LogAnalyticsExternalProvider', () => {
  const validConfig: ExternalExecutionProviderConfig = {
    type: 'log-analytics',
    tenantId: 'test-tenant-id',
    subscriptionId: 'test-subscription-id',
    resourceGroup: 'test-resource-group',
    workspaceId: 'test-workspace-id'
  };

  const testKQLQuery = 'Heartbeat | where TimeGenerated > ago(1h) | count';

  let provider: LogAnalyticsExternalProvider;

  beforeEach(() => {
    provider = new LogAnalyticsExternalProvider(validConfig);
  });

  describe('Constructor', () => {
    it('should initialize successfully with valid config', () => {
      expect(provider).toBeInstanceOf(LogAnalyticsExternalProvider);
    });

    it('should throw error with invalid provider type', () => {
      const invalidConfig = { ...validConfig, type: 'application-insights' as any };
      expect(() => new LogAnalyticsExternalProvider(invalidConfig))
        .toThrow('Invalid provider type for LogAnalyticsExternalProvider');
    });
  });

  describe('getAvailableOptions', () => {
    it('should return Log Analytics portal option', () => {
      const options = provider.getAvailableOptions();

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        target: 'portal',
        name: '🌐 Azure Portal (Log Analytics)',
        description: 'Open query in Azure Portal Log Analytics workspace'
      });
    });
  });

  describe('generateUrl', () => {
    it('should generate correct Log Analytics Portal URL for portal target', async () => {
      // Expected encoding: gzip + base64
      const gzippedQuery = gzipSync(Buffer.from(testKQLQuery, 'utf8'));
      const encodedQuery = encodeURIComponent(gzippedQuery.toString('base64'));
      const expectedUrl = `https://portal.azure.com/#@${validConfig.tenantId}/blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/resourceId/%2Fsubscriptions%2F${validConfig.subscriptionId}%2FresourceGroups%2F${validConfig.resourceGroup}%2Fproviders%2Fmicrosoft.operationalinsights%2Fworkspaces%2F${validConfig.workspaceId}/source/LogsBlade.AnalyticsShareLinkToQuery/q/${encodedQuery}`;

      const actualUrl = await provider.generateUrl('portal', testKQLQuery);

      expect(actualUrl).toBe(expectedUrl);
    });

    it('should throw error for unsupported target', async () => {
      await expect(provider.generateUrl('unknown' as any, testKQLQuery))
        .rejects.toThrow('Unsupported external execution target: unknown');
    });

    it('should handle complex Log Analytics queries', async () => {
      const complexQuery = `Heartbeat
        | where Computer startswith "web-"
        | extend LastSeen = TimeGenerated
        | summarize count() by bin(TimeGenerated, 1h), Computer`;

      const url = await provider.generateUrl('portal', complexQuery);

      expect(url).toContain('portal.azure.com');
      expect(url).toContain(validConfig.tenantId);
      expect(url).toContain(validConfig.subscriptionId);
      expect(url).toContain('microsoft.operationalinsights');
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
      const incompleteProvider = new LogAnalyticsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('tenantId');
    });

    it('should detect missing workspaceId', () => {
      const incompleteConfig = { ...validConfig, workspaceId: undefined };
      const incompleteProvider = new LogAnalyticsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('workspaceId');
    });

    it('should detect multiple missing fields', () => {
      const incompleteConfig = {
        ...validConfig,
        tenantId: '',
        subscriptionId: '',
        workspaceId: ''
      };
      const incompleteProvider = new LogAnalyticsExternalProvider(incompleteConfig);

      const validation = incompleteProvider.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toHaveLength(3);
      expect(validation.missingFields).toContain('tenantId');
      expect(validation.missingFields).toContain('subscriptionId');
      expect(validation.missingFields).toContain('workspaceId');
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = provider.getMetadata();

      expect(metadata).toEqual({
        name: 'Log Analytics External Provider',
        type: 'log-analytics',
        description: 'Provides external execution options for Azure Log Analytics',
        supportedTargets: ['portal']
      });
    });
  });
});