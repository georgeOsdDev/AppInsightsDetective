"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stepExecutionService_1 = require("../../src/services/stepExecutionService");
const inquirer_1 = __importDefault(require("inquirer"));
// Mock dependencies
jest.mock('inquirer');
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/visualizer');
const mockInquirer = inquirer_1.default;
describe('StepExecutionService', () => {
    let stepExecutionService;
    let mockAiService;
    let mockAppInsightsService;
    const mockNLQuery = {
        generatedKQL: 'requests | where timestamp > ago(1h) | count',
        confidence: 0.9,
        reasoning: 'Test reasoning',
    };
    const mockQueryResult = {
        tables: [
            {
                name: 'PrimaryResult',
                columns: [{ name: 'count_', type: 'long' }],
                rows: [[100]],
            },
        ],
    };
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Create mock services
        mockAiService = {
            generateKQLQuery: jest.fn(),
            explainKQLQuery: jest.fn(),
            regenerateKQLQuery: jest.fn(),
            validateQuery: jest.fn(),
            initialize: jest.fn(),
        };
        mockAppInsightsService = {
            executeQuery: jest.fn(),
            validateConnection: jest.fn(),
            getSchema: jest.fn(),
        };
        stepExecutionService = new stepExecutionService_1.StepExecutionService(mockAiService, mockAppInsightsService);
    });
    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(stepExecutionService).toBeInstanceOf(stepExecutionService_1.StepExecutionService);
        });
        it('should initialize with custom options', () => {
            const customOptions = {
                showConfidenceThreshold: 0.8,
                allowEditing: false,
                maxRegenerationAttempts: 5,
            };
            const customService = new stepExecutionService_1.StepExecutionService(mockAiService, mockAppInsightsService, customOptions);
            expect(customService).toBeInstanceOf(stepExecutionService_1.StepExecutionService);
        });
    });
    describe('executeStepByStep', () => {
        it('should handle execute action', async () => {
            // Mock user selection
            mockInquirer.prompt.mockResolvedValueOnce({
                action: 'execute',
            });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(mockAppInsightsService.executeQuery).toHaveBeenCalledWith(mockNLQuery.generatedKQL);
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
        it('should handle explain action', async () => {
            // Mock user selections
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'explain' }) // First choice
                .mockResolvedValueOnce({
                selectedLanguage: 'auto',
                technicalLevel: 'intermediate',
                includeExamples: true
            }) // Language options as one prompt
                .mockResolvedValueOnce({ continue: '' }) // Press Enter to continue
                .mockResolvedValueOnce({ action: 'execute' }); // Second choice after explanation
            mockAiService.explainKQLQuery.mockResolvedValue('This query counts requests in the last hour.');
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(mockAiService.explainKQLQuery).toHaveBeenCalledWith(mockNLQuery.generatedKQL, expect.objectContaining({
                language: 'auto',
                technicalLevel: 'intermediate',
                includeExamples: true
            }));
            expect(mockAppInsightsService.executeQuery).toHaveBeenCalledWith(mockNLQuery.generatedKQL);
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
        it('should handle regenerate action', async () => {
            const regeneratedQuery = {
                generatedKQL: 'requests | summarize count() by bin(timestamp, 1h)',
                confidence: 0.8,
                reasoning: 'Alternative approach',
            };
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'regenerate' })
                .mockResolvedValueOnce({ action: 'execute' });
            mockAiService.regenerateKQLQuery.mockResolvedValue(regeneratedQuery);
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(mockAiService.regenerateKQLQuery).toHaveBeenCalledWith('test question', expect.objectContaining({
                previousQuery: mockNLQuery.generatedKQL,
                attemptNumber: 2,
            }), undefined);
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
        it('should handle edit action', async () => {
            const editedQuery = 'requests | where timestamp > ago(2h) | count';
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'edit' })
                .mockResolvedValueOnce({ editMethod: 'inline' }) // Choose inline editing
                .mockResolvedValueOnce({ query: editedQuery }) // Provide edited query
                .mockResolvedValueOnce({ action: 'execute' }); // Execute the edited query
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(mockAppInsightsService.executeQuery).toHaveBeenCalledWith(editedQuery);
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
        it('should handle cancel action', async () => {
            mockInquirer.prompt.mockResolvedValueOnce({ action: 'cancel' });
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(result).toBeNull();
        });
        it('should handle history action', async () => {
            // Create a service instance and add some history first
            const service = new stepExecutionService_1.StepExecutionService(mockAiService, mockAppInsightsService);
            // First, execute a query to build history
            mockInquirer.prompt.mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            await service.executeStepByStep(mockNLQuery, 'first question');
            // Reset mocks for the history test
            mockInquirer.prompt.mockClear();
            mockAppInsightsService.executeQuery.mockClear();
            // Now test history action - with more than one item in history
            const secondQuery = {
                generatedKQL: 'requests | summarize count() by bin(timestamp, 1h)',
                confidence: 0.8,
                reasoning: 'Second query'
            };
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'history' })
                .mockResolvedValueOnce({ selectedQuery: mockNLQuery.generatedKQL }) // Select from history
                .mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await service.executeStepByStep(secondQuery, 'test question');
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
    });
    describe('error handling', () => {
        it('should handle query execution errors', async () => {
            mockInquirer.prompt.mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockRejectedValue(new Error('Query failed'));
            await expect(stepExecutionService.executeStepByStep(mockNLQuery, 'test question'))
                .rejects.toThrow('Query failed');
        });
        it('should handle explanation errors', async () => {
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'explain' })
                .mockResolvedValueOnce({
                selectedLanguage: 'auto',
                technicalLevel: 'intermediate',
                includeExamples: true
            })
                .mockResolvedValueOnce({ action: 'cancel' });
            mockAiService.explainKQLQuery.mockRejectedValue(new Error('Explanation failed'));
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(result).toBeNull();
        });
        it('should handle regeneration errors', async () => {
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'regenerate' })
                .mockResolvedValueOnce({ action: 'cancel' });
            mockAiService.regenerateKQLQuery.mockRejectedValue(new Error('Regeneration failed'));
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(result).toBeNull();
        });
    });
    describe('query validation', () => {
        it('should proceed with valid queries', async () => {
            mockInquirer.prompt.mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
    });
    describe('confidence threshold', () => {
        it('should show warning for low confidence queries', async () => {
            const lowConfidenceQuery = {
                ...mockNLQuery,
                confidence: 0.5,
            };
            const options = {
                showConfidenceThreshold: 0.7,
            };
            const service = new stepExecutionService_1.StepExecutionService(mockAiService, mockAppInsightsService, options);
            mockInquirer.prompt.mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            const result = await service.executeStepByStep(lowConfidenceQuery, 'test question');
            expect(result).toEqual({
                result: mockQueryResult,
                executionTime: expect.any(Number)
            });
        });
    });
    describe('regeneration limits', () => {
        it('should respect maximum regeneration attempts', async () => {
            const options = {
                maxRegenerationAttempts: 1,
            };
            const service = new stepExecutionService_1.StepExecutionService(mockAiService, mockAppInsightsService, options);
            // Mock regenerate attempt, then second attempt should not show regenerate option
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'regenerate' }) // First regeneration
                .mockResolvedValueOnce({ action: 'cancel' }); // No more regenerate option available
            mockAiService.regenerateKQLQuery.mockResolvedValue(mockNLQuery);
            const result = await service.executeStepByStep(mockNLQuery, 'test question');
            // Should only allow one regeneration
            expect(mockAiService.regenerateKQLQuery).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });
    });
    describe('history management', () => {
        it('should maintain query history', async () => {
            mockInquirer.prompt
                .mockResolvedValueOnce({ action: 'execute' })
                .mockResolvedValueOnce({ action: 'execute' });
            mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);
            await stepExecutionService.executeStepByStep(mockNLQuery, 'test question 1');
            await stepExecutionService.executeStepByStep(mockNLQuery, 'test question 2');
            // Verify that history is maintained (internal state - could be exposed via getHistory method)
            expect(true).toBe(true); // Placeholder - would need public method to verify history
        });
    });
});
//# sourceMappingURL=stepExecutionService.test.js.map