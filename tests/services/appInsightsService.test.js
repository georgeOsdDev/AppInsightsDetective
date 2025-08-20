"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const appInsightsService_1 = require("../../src/services/appInsightsService");
const axios_1 = __importDefault(require("axios"));
// Mock axios
jest.mock('axios');
jest.mock('../../src/utils/logger');
const mockAxios = axios_1.default;
const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
        request: {
            use: jest.fn(),
        },
        response: {
            use: jest.fn(),
        },
    },
};
describe('AppInsightsService', () => {
    let appInsightsService;
    let mockAuthService;
    let mockConfigManager;
    beforeEach(() => {
        // Reset mocks
        mockAxios.create.mockClear();
        mockAxiosInstance.post.mockClear();
        mockAxiosInstance.get.mockClear();
        mockAxiosInstance.interceptors.request.use.mockClear();
        mockAxiosInstance.interceptors.response.use.mockClear();
        // Setup axios mock
        mockAxios.create.mockReturnValue(mockAxiosInstance);
        // Create mock services
        mockAuthService = {
            getAccessToken: jest.fn().mockResolvedValue('mock-token'),
            getOpenAIToken: jest.fn(),
        };
        mockConfigManager = {
            getConfig: jest.fn().mockReturnValue({
                appInsights: {
                    applicationId: 'test-app-id',
                    tenantId: 'test-tenant',
                    endpoint: 'https://api.applicationinsights.io/v1/apps',
                },
                openAI: { endpoint: 'test-endpoint' },
                logLevel: 'info',
            }),
        };
        appInsightsService = new appInsightsService_1.AppInsightsService(mockAuthService, mockConfigManager);
    });
    describe('constructor', () => {
        it('should create axios instance with correct configuration', () => {
            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://api.applicationinsights.io/v1/apps',
                timeout: 30000,
            });
        });
        it('should setup request and response interceptors', () => {
            expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
            expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
        });
        it('should use default endpoint if not configured', () => {
            mockConfigManager.getConfig.mockReturnValue({
                appInsights: {
                    applicationId: 'test-app-id',
                    tenantId: 'test-tenant',
                    // No endpoint specified
                },
                openAI: { endpoint: 'test-endpoint' },
                logLevel: 'info',
            });
            new appInsightsService_1.AppInsightsService(mockAuthService, mockConfigManager);
            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://api.applicationinsights.io/v1/apps',
                timeout: 30000,
            });
        });
    });
    describe('executeQuery', () => {
        it('should execute KQL query successfully', async () => {
            const mockResult = {
                tables: [
                    {
                        name: 'PrimaryResult',
                        columns: [
                            { name: 'count_', type: 'long' },
                        ],
                        rows: [[100]],
                    },
                ],
            };
            mockAxiosInstance.post.mockResolvedValue({ data: mockResult });
            const result = await appInsightsService.executeQuery('requests | count');
            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-app-id/query', {
                query: 'requests | count',
            });
            expect(result).toEqual(mockResult);
        });
        it('should throw error if query execution fails', async () => {
            mockAxiosInstance.post.mockRejectedValue(new Error('API Error'));
            await expect(appInsightsService.executeQuery('invalid query')).rejects.toThrow('Query execution failed');
        });
        it('should handle axios error responses', async () => {
            const axiosError = {
                response: {
                    data: { error: { message: 'Invalid query' } },
                },
                message: 'Request failed',
            };
            mockAxiosInstance.post.mockRejectedValue(axiosError);
            await expect(appInsightsService.executeQuery('invalid query')).rejects.toThrow('Query execution failed');
        });
    });
    describe('validateConnection', () => {
        it('should return true when connection is valid', async () => {
            mockAxiosInstance.post.mockResolvedValue({ data: { tables: [] } });
            const result = await appInsightsService.validateConnection();
            expect(result).toBe(true);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-app-id/query', {
                query: 'requests | take 1',
            });
        });
        it('should return false when connection fails', async () => {
            mockAxiosInstance.post.mockRejectedValue(new Error('Connection failed'));
            const result = await appInsightsService.validateConnection();
            expect(result).toBe(false);
        });
    });
    describe('getSchema', () => {
        it('should retrieve schema successfully', async () => {
            const mockSchema = {
                tables: [
                    {
                        name: 'requests',
                        columns: [
                            { name: 'timestamp', type: 'datetime' },
                            { name: 'name', type: 'string' },
                        ],
                    },
                ],
            };
            mockAxiosInstance.get.mockResolvedValue({ data: mockSchema });
            const result = await appInsightsService.getSchema();
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-app-id/metadata');
            expect(result).toEqual(mockSchema);
        });
        it('should throw error if schema retrieval fails', async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error('Schema error'));
            await expect(appInsightsService.getSchema()).rejects.toThrow('Schema retrieval failed');
        });
    });
    describe('interceptors', () => {
        it('should add authorization header to requests', async () => {
            // Get the request interceptor
            const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
            const mockConfig = { headers: {} };
            const result = await requestInterceptor(mockConfig);
            expect(mockAuthService.getAccessToken).toHaveBeenCalled();
            expect(result.headers.Authorization).toBe('Bearer mock-token');
        });
        it('should handle auth token errors in request interceptor', async () => {
            const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
            mockAuthService.getAccessToken.mockRejectedValue(new Error('Auth failed'));
            const mockConfig = { headers: {} };
            await expect(requestInterceptor(mockConfig)).rejects.toThrow('Auth failed');
        });
        it('should handle response errors in response interceptor', () => {
            // Get the response interceptor error handler
            const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
            const mockError = {
                response: {
                    data: { error: { message: 'API Error' } },
                },
                message: 'Request failed',
            };
            expect(() => responseErrorHandler(mockError)).toThrow();
        });
        it('should handle response errors without response data', () => {
            const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
            const mockError = {
                message: 'Network Error',
            };
            expect(() => responseErrorHandler(mockError)).toThrow();
        });
    });
});
//# sourceMappingURL=appInsightsService.test.js.map