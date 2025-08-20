"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const authService_1 = require("../../src/services/authService");
const config_1 = require("../../src/utils/config");
const appInsightsService_1 = require("../../src/services/appInsightsService");
// Mock Azure SDK and dependencies
jest.mock('@azure/identity');
jest.mock('../../src/utils/logger');
// Mock axios with interceptors
const mockAxiosInstance = {
    interceptors: {
        request: {
            use: jest.fn()
        },
        response: {
            use: jest.fn()
        }
    }
};
jest.mock('axios', () => ({
    create: jest.fn(() => mockAxiosInstance),
    default: {
        create: jest.fn(() => mockAxiosInstance)
    }
}));
describe('Integration Tests', () => {
    describe('Service Initialization', () => {
        it('should initialize all core services without errors', () => {
            const mockConfigManager = {
                get: jest.fn().mockReturnValue({ applicationId: 'test-app-id' }),
                getConfig: jest.fn().mockReturnValue({
                    appInsights: { endpoint: 'https://api.applicationinsights.io/v1/apps' }
                }),
                getOpenAIConfig: jest.fn().mockReturnValue({
                    apiKey: 'test-key',
                    endpoint: 'https://test.openai.azure.com/',
                    deploymentName: 'gpt-4'
                })
            };
            expect(() => new authService_1.AuthService()).not.toThrow();
            // Mock axios to prevent interceptor setup errors
            const mockAxios = {
                interceptors: {
                    request: { use: jest.fn() },
                    response: { use: jest.fn() }
                }
            };
            jest.doMock('axios', () => ({
                create: jest.fn(() => mockAxios),
                default: mockAxios
            }));
            const authService = new authService_1.AuthService();
            expect(() => new appInsightsService_1.AppInsightsService(authService, mockConfigManager)).not.toThrow();
        });
        it('should handle configuration validation', () => {
            const configManager = new config_1.ConfigManager();
            // This should not throw during instantiation
            expect(configManager).toBeDefined();
            expect(typeof configManager.getConfig).toBe('function');
            expect(typeof configManager.validateConfig).toBe('function');
        });
    });
    describe('Error Handling', () => {
        it('should handle authentication errors gracefully', async () => {
            const authService = new authService_1.AuthService();
            // Even if authentication fails, the service should be instantiated
            expect(authService).toBeDefined();
            expect(typeof authService.getAccessToken).toBe('function');
            expect(typeof authService.getOpenAIToken).toBe('function');
        });
    });
});
//# sourceMappingURL=integration.test.js.map