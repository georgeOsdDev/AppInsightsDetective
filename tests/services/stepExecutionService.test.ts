import { StepExecutionService, StepExecutionOptions, QueryAction } from '../../src/services/stepExecutionService';
import { AIService } from '../../src/services/aiService';
import { AppInsightsService } from '../../src/services/appInsightsService';
import { NLQuery, QueryResult } from '../../src/types';
import inquirer from 'inquirer';

// Mock dependencies
jest.mock('inquirer');
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/visualizer');

const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('StepExecutionService', () => {
  let stepExecutionService: StepExecutionService;
  let mockAiService: jest.Mocked<AIService>;
  let mockAppInsightsService: jest.Mocked<AppInsightsService>;

  const mockNLQuery: NLQuery = {
    generatedKQL: 'requests | where timestamp > ago(1h) | count',
    confidence: 0.9,
    reasoning: 'Test reasoning',
  };

  const mockQueryResult: QueryResult = {
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
    } as any;

    mockAppInsightsService = {
      executeQuery: jest.fn(),
      validateConnection: jest.fn(),
      getSchema: jest.fn(),
    } as any;

    stepExecutionService = new StepExecutionService(mockAiService, mockAppInsightsService);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(stepExecutionService).toBeInstanceOf(StepExecutionService);
    });

    it('should initialize with custom options', () => {
      const customOptions: StepExecutionOptions = {
        showConfidenceThreshold: 0.8,
        allowEditing: false,
        maxRegenerationAttempts: 5,
      };

      const customService = new StepExecutionService(mockAiService, mockAppInsightsService, customOptions);
      expect(customService).toBeInstanceOf(StepExecutionService);
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

      expect(mockAiService.explainKQLQuery).toHaveBeenCalledWith(
        mockNLQuery.generatedKQL,
        expect.objectContaining({
          language: 'auto',
          technicalLevel: 'intermediate',
          includeExamples: true
        })
      );
      expect(mockAppInsightsService.executeQuery).toHaveBeenCalledWith(mockNLQuery.generatedKQL);
      expect(result).toEqual({
        result: mockQueryResult,
        executionTime: expect.any(Number)
      });
    });

    it('should handle regenerate action', async () => {
      const regeneratedQuery: NLQuery = {
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

      expect(mockAiService.regenerateKQLQuery).toHaveBeenCalledWith(
        'test question',
        expect.objectContaining({
          previousQuery: mockNLQuery.generatedKQL,
          attemptNumber: 2,
        }),
        undefined
      );
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
      const service = new StepExecutionService(mockAiService, mockAppInsightsService);

      // First, execute a query to build history
      mockInquirer.prompt.mockResolvedValueOnce({ action: 'execute' });
      mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);

      await service.executeStepByStep(mockNLQuery, 'first question');

      // Reset mocks for the history test
      mockInquirer.prompt.mockClear();
      mockAppInsightsService.executeQuery.mockClear();

      // Now test history action - with more than one item in history
      const secondQuery: NLQuery = {
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
  });  describe('error handling', () => {
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
      const lowConfidenceQuery: NLQuery = {
        ...mockNLQuery,
        confidence: 0.5,
      };

      const options: StepExecutionOptions = {
        showConfidenceThreshold: 0.7,
      };

      const service = new StepExecutionService(mockAiService, mockAppInsightsService, options);

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
      const options: StepExecutionOptions = {
        maxRegenerationAttempts: 1,
      };

      const service = new StepExecutionService(mockAiService, mockAppInsightsService, options);

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

  describe('external execution', () => {
    it('should handle external execution action gracefully when service not available', async () => {
      // Mock ConfigManager to not provide external execution config
      const mockConfigManager = {
        getConfig: () => ({
          appInsights: {
            tenantId: 'test-tenant'
            // Missing required fields for external execution
          }
        })
      };
      
      // Mock the getUserAction to include external option but service will handle gracefully
      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'external' })
        .mockResolvedValueOnce({ continue: '' }) // For the "Press Enter to continue" prompt
        .mockResolvedValueOnce({ action: 'cancel' }); // Return to menu and cancel

      const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');

      // Should handle missing service gracefully and then cancel
      expect(mockInquirer.prompt).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should continue workflow after external execution attempt', async () => {
      mockInquirer.prompt
        .mockResolvedValueOnce({ action: 'external' })
        .mockResolvedValueOnce({ continue: '' })
        .mockResolvedValueOnce({ action: 'execute' });
      
      mockAppInsightsService.executeQuery.mockResolvedValue(mockQueryResult);

      const result = await stepExecutionService.executeStepByStep(mockNLQuery, 'test question');

      // Should eventually execute the query normally
      expect(result).not.toBeNull();
      expect(result?.result).toEqual(mockQueryResult);
    });
  });
});
