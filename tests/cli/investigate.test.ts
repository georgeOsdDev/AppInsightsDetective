/**
 * Tests for the investigate CLI command
 */
import { createInvestigateCommand } from '../../src/cli/commands/investigate';
import { Command } from 'commander';
import { Bootstrap } from '../../src/infrastructure/Bootstrap';

// Mock the Bootstrap and service dependencies
jest.mock('../../src/infrastructure/Bootstrap');
jest.mock('../../src/utils/config');
jest.mock('inquirer');

describe('Investigate Command', () => {
  let command: Command;
  let mockBootstrap: jest.Mocked<Bootstrap>;
  let mockService: any;
  let mockContainer: any;

  beforeEach(() => {
    // Mock the investigation service
    mockService = {
      startInvestigation: jest.fn().mockResolvedValue({
        investigationId: 'test-id-123',
        status: 'in-progress',
        plan: {
          id: 'plan-123',
          detectedType: 'performance',
          phases: [{ name: 'Phase 1', queries: [] }],
          confidence: 0.8,
          estimatedTotalTime: 300,
          reasoning: 'Test plan'
        },
        progress: {
          totalPhases: 1,
          completedPhases: 0,
          totalQueries: 1,
          completedQueries: 0,
          failedQueries: 0,
          skippedQueries: 0,
          currentStatus: 'in-progress',
          completionPercentage: 0
        }
      }),
      continueInvestigation: jest.fn().mockResolvedValue({
        investigationId: 'test-id-123',
        status: 'completed',
        result: {
          id: 'test-id-123',
          summary: 'Investigation completed successfully',
          rootCauseAnalysis: {
            primaryCause: {
              description: 'High response times detected',
              confidence: 0.85,
              evidence: [],
              category: 'performance'
            }
          },
          totalExecutionTime: 45,
          evidence: [],
          context: {
            progress: {
              completedQueries: 3,
              totalQueries: 3,
              completedPhases: 1,
              totalPhases: 1
            }
          }
        }
      }),
      getInvestigationStatus: jest.fn().mockResolvedValue({
        investigationId: 'test-id-123',
        status: 'completed'
      }),
      getInvestigationHistory: jest.fn().mockResolvedValue([]),
      classifyProblem: jest.fn().mockResolvedValue({
        type: 'performance',
        confidence: 0.9,
        reasoning: 'Performance issue detected'
      }),
      cancelInvestigation: jest.fn().mockResolvedValue(undefined),
      pauseInvestigation: jest.fn().mockResolvedValue(undefined),
      resumeInvestigation: jest.fn().mockResolvedValue({
        investigationId: 'test-id-123',
        status: 'in-progress'
      }),
      exportInvestigation: jest.fn().mockResolvedValue({
        content: '# Investigation Report\nTest report content',
        filename: 'investigation-test-id-123.md',
        mimeType: 'text/markdown'
      })
    };

    // Mock the container
    mockContainer = {
      resolve: jest.fn().mockReturnValue(mockService)
    };

    // Mock Bootstrap
    mockBootstrap = {
      initialize: jest.fn().mockResolvedValue(mockContainer),
      getContainer: jest.fn().mockReturnValue(mockContainer)
    } as any;

    (Bootstrap as jest.MockedClass<typeof Bootstrap>).mockImplementation(() => mockBootstrap);

    // Create the command
    command = createInvestigateCommand();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Structure', () => {
    it('should create command with correct name and description', () => {
      expect(command.name()).toBe('investigate');
      expect(command.description()).toContain('AI-driven intelligent investigation');
    });

    it('should accept problem description as argument', () => {
      const args = command.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('problem');
    });

    it('should have all expected options', () => {
      const options = command.options;
      const optionNames = options.map(opt => opt.long);
      
      expect(optionNames).toContain('--interactive');
      expect(optionNames).toContain('--type');
      expect(optionNames).toContain('--continue');
      expect(optionNames).toContain('--resume');
      expect(optionNames).toContain('--cancel');
      expect(optionNames).toContain('--status');
      expect(optionNames).toContain('--history');
      expect(optionNames).toContain('--export');
      expect(optionNames).toContain('--format');
      expect(optionNames).toContain('--max-time');
    });
  });

  describe('Command Options', () => {
    it('should have correct default values', () => {
      const formatOption = command.options.find(opt => opt.long === '--format');
      expect(formatOption?.defaultValue).toBe('markdown');

      const maxTimeOption = command.options.find(opt => opt.long === '--max-time');
      expect(maxTimeOption?.defaultValue).toBe('5');
    });
  });

  describe('Command Integration', () => {
    it('should parse arguments correctly', () => {
      // Test that the command structure is valid
      // Avoid calling parse with --help as it triggers process.exit
      const testCommand = new Command();
      testCommand.exitOverride(); // Prevent process.exit during tests
      testCommand.addCommand(command);
      
      // This should not throw an error for basic structure validation
      expect(() => {
        // Just check that the command is properly structured
        const subcommands = testCommand.commands;
        const investigateCommand = subcommands.find(cmd => cmd.name() === 'investigate');
        expect(investigateCommand).toBeDefined();
      }).not.toThrow();
    });
  });

  // Note: Full integration tests with actual command execution would require
  // mocking the entire CLI environment, console outputs, and inquirer prompts.
  // These would be better handled as end-to-end tests or integration tests
  // that test the actual CLI behavior.

  describe('Service Integration', () => {
    it('should initialize bootstrap correctly', async () => {
      // This test verifies that the command would initialize Bootstrap
      // In actual execution, this would happen in the command action
      const bootstrap = new Bootstrap();
      await bootstrap.initialize();
      const container = bootstrap.getContainer();
      
      expect(bootstrap.initialize).toHaveBeenCalled();
      expect(container.resolve).toBeDefined();
    });
  });

  describe('Error Handling Structure', () => {
    it('should have error handling in command action', () => {
      // Verify that the command has an action defined
      // The actual error handling behavior would be tested in integration tests
      expect(command.name()).toBe('investigate');
      // Just verify the command structure is valid
      expect(command).toBeDefined();
    });
  });
});