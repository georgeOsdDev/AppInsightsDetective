import { ResourceGraphService, ApplicationInsightsResource } from '../../src/services/resourceGraphService';

// Mock the Azure SDK
jest.mock('@azure/arm-resourcegraph');
jest.mock('@azure/identity');

describe('ResourceGraphService', () => {
  let service: ResourceGraphService;
  let mockClient: any;

  const mockApplicationInsightsResource = {
    id: '/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/test-appinsights',
    name: 'test-appinsights',
    type: 'microsoft.insights/components',
    subscriptionId: 'test-sub',
    resourceGroup: 'test-rg',
    tenantId: 'test-tenant',
    properties: {
      AppId: 'test-app-id',
      ApplicationId: 'test-app-id'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the ResourceGraphClient
    mockClient = {
      resources: jest.fn()
    };
    
    const { ResourceGraphClient } = require('@azure/arm-resourcegraph');
    ResourceGraphClient.mockImplementation(() => mockClient);

    service = new ResourceGraphService();
  });

  describe('findApplicationInsightsResource', () => {
    test('should find Application Insights resource by Application ID', async () => {
      mockClient.resources.mockResolvedValue({
        data: [mockApplicationInsightsResource]
      });

      const result = await service.findApplicationInsightsResource('test-app-id');

      expect(result).toEqual({
        id: mockApplicationInsightsResource.id,
        name: 'test-appinsights',
        resourceGroup: 'test-rg',
        subscriptionId: 'test-sub',
        type: 'microsoft.insights/components',
        tenantId: 'test-tenant',
        properties: mockApplicationInsightsResource.properties
      });

      expect(mockClient.resources).toHaveBeenCalledWith({
        query: expect.stringContaining("where properties.AppId == 'test-app-id'"),
        subscriptions: []
      });
    });

    test('should return null when no resource is found', async () => {
      mockClient.resources.mockResolvedValue({
        data: []
      });

      const result = await service.findApplicationInsightsResource('non-existent-id');

      expect(result).toBeNull();
    });

    test('should handle API errors', async () => {
      mockClient.resources.mockRejectedValue(new Error('API Error'));

      await expect(service.findApplicationInsightsResource('test-app-id'))
        .rejects.toThrow('Failed to find Application Insights resource: Error: API Error');
    });

    test('should use first resource when multiple found', async () => {
      const multipleResources = [
        mockApplicationInsightsResource,
        { ...mockApplicationInsightsResource, name: 'another-resource' }
      ];

      mockClient.resources.mockResolvedValue({
        data: multipleResources
      });

      const result = await service.findApplicationInsightsResource('test-app-id');

      expect(result?.name).toBe('test-appinsights');
    });
  });

  describe('findDataExplorerCluster', () => {
    test('should find Data Explorer cluster in same resource group', async () => {
      mockClient.resources.mockResolvedValue({
        data: [{ name: 'test-cluster', properties: {} }]
      });

      const result = await service.findDataExplorerCluster('test-sub', 'test-rg');

      expect(result).toEqual({
        clusterId: 'test-cluster',
        databaseName: 'ApplicationInsights'
      });

      expect(mockClient.resources).toHaveBeenCalledWith({
        query: expect.stringContaining("where subscriptionId == 'test-sub'"),
        subscriptions: ['test-sub']
      });
    });

    test('should return empty object when no cluster found', async () => {
      mockClient.resources.mockResolvedValue({
        data: []
      });

      const result = await service.findDataExplorerCluster('test-sub', 'test-rg');

      expect(result).toEqual({});
    });

    test('should handle API errors gracefully', async () => {
      mockClient.resources.mockRejectedValue(new Error('API Error'));

      const result = await service.findDataExplorerCluster('test-sub', 'test-rg');

      expect(result).toEqual({});
    });
  });

  describe('getResourceInfo', () => {
    test('should get complete resource information', async () => {
      // Mock the first call (find App Insights)
      mockClient.resources
        .mockResolvedValueOnce({
          data: [mockApplicationInsightsResource]
        })
        // Mock the second call (find Data Explorer)
        .mockResolvedValueOnce({
          data: [{ name: 'test-cluster', properties: {} }]
        });

      const result = await service.getResourceInfo('test-app-id');

      expect(result).toEqual({
        subscriptionId: 'test-sub',
        resourceGroup: 'test-rg',
        resourceName: 'test-appinsights',
        tenantId: 'test-tenant',
        clusterId: 'test-cluster',
        databaseName: 'ApplicationInsights'
      });
    });

    test('should return null when App Insights resource not found', async () => {
      mockClient.resources.mockResolvedValue({
        data: []
      });

      const result = await service.getResourceInfo('non-existent-id');

      expect(result).toBeNull();
    });

    test('should work without Data Explorer cluster', async () => {
      // Mock the first call (find App Insights)
      mockClient.resources
        .mockResolvedValueOnce({
          data: [mockApplicationInsightsResource]
        })
        // Mock the second call (no Data Explorer found)
        .mockResolvedValueOnce({
          data: []
        });

      const result = await service.getResourceInfo('test-app-id');

      expect(result).toEqual({
        subscriptionId: 'test-sub',
        resourceGroup: 'test-rg',
        resourceName: 'test-appinsights',
        tenantId: 'test-tenant'
      });
    });
  });
});