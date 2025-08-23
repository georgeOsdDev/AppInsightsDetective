import { ConsoleOutputRenderer } from '../../src/services/ConsoleOutputRenderer';
import { QueryResult, AnalysisResult } from '../../src/types';

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../src/utils/visualizer', () => ({
  Visualizer: {
    displayResult: jest.fn(),
    displaySummary: jest.fn(),
    displayChart: jest.fn(),
    displayError: jest.fn(),
    displayAnalysisResult: jest.fn()
  }
}));

jest.mock('../../src/utils/outputFormatter', () => ({
  OutputFormatter: {
    formatResult: jest.fn(() => 'formatted output')
  }
}));

jest.mock('../../src/utils/fileOutput', () => ({
  FileOutputManager: {
    generateFileName: jest.fn(() => 'test-output.json'),
    resolveOutputPath: jest.fn((path: string) => path),
    checkWritePermission: jest.fn(() => true),
    createBackup: jest.fn(),
    writeToFile: jest.fn()
  }
}));

jest.mock('../../src/utils/chart', () => ({
  detectTimeSeriesData: jest.fn(() => false)
}));

const inquirer = require('inquirer');
const { Visualizer } = require('../../src/utils/visualizer');
const { FileOutputManager } = require('../../src/utils/fileOutput');

describe('ConsoleOutputRenderer', () => {
  let renderer: ConsoleOutputRenderer;
  let mockResult: QueryResult;

  beforeEach(() => {
    renderer = new ConsoleOutputRenderer();
    mockResult = {
      tables: [{
        name: 'test-table',
        columns: [
          { name: 'col1', type: 'string' },
          { name: 'col2', type: 'int' }
        ],
        rows: [
          ['value1', 10],
          ['value2', 20]
        ]
      }]
    };

    jest.clearAllMocks();
  });

  describe('displayResult', () => {
    it('should display result and summary', async () => {
      await renderer.displayResult(mockResult, 1000, 'test query');

      expect(Visualizer.displayResult).toHaveBeenCalledWith(mockResult);
      expect(Visualizer.displaySummary).toHaveBeenCalledWith(1000, 2);
    });
  });

  describe('showChart', () => {
    it('should return false for non-numeric data', async () => {
      const nonNumericResult: QueryResult = {
        tables: [{
          name: 'test-table',
          columns: [{ name: 'col1', type: 'string' }],
          rows: [['text1'], ['text2']]
        }]
      };

      const result = await renderer.showChart(nonNumericResult);
      expect(result).toBe(false);
    });

    it('should prompt for chart when numeric data is present', async () => {
      inquirer.prompt.mockResolvedValueOnce({ showChart: true })
        .mockResolvedValueOnce({ chartType: 'bar' });

      const result = await renderer.showChart(mockResult);

      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(Visualizer.displayChart).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('handleFileOutput', () => {
    it('should skip file output when user declines', async () => {
      inquirer.prompt.mockResolvedValueOnce({ saveToFile: false });

      await renderer.handleFileOutput(mockResult);

      expect(inquirer.prompt).toHaveBeenCalledTimes(1);
      expect(FileOutputManager.writeToFile).not.toHaveBeenCalled();
    });

    it('should save file when user agrees', async () => {
      inquirer.prompt.mockResolvedValueOnce({ saveToFile: true })
        .mockResolvedValueOnce({
          format: 'json',
          filePath: 'test.json',
          pretty: true,
          encoding: 'utf8'
        });

      await renderer.handleFileOutput(mockResult);

      expect(FileOutputManager.writeToFile).toHaveBeenCalled();
    });
  });

  describe('displayAnalysis', () => {
    it('should delegate to Visualizer', () => {
      const mockAnalysis = {} as AnalysisResult;
      
      renderer.displayAnalysis(mockAnalysis, 'statistical');

      expect(Visualizer.displayAnalysisResult).toHaveBeenCalledWith(mockAnalysis, 'statistical');
    });
  });
});