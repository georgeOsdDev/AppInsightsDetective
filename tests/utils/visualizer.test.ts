import { Visualizer } from '../../src/utils/visualizer';
import { QueryResult, QueryColumn } from '../../src/types';
import chalk from 'chalk';

// Mock chalk - more complete mock to match actual usage
jest.mock('chalk', () => {
  const createMockFn = (color: string) => jest.fn((text: string) => `${color}(${text})`);

  return {
    yellow: Object.assign(createMockFn('yellow'), {
      bold: createMockFn('yellow.bold')
    }),
    green: Object.assign(createMockFn('green'), {
      bold: createMockFn('green.bold')
    }),
    red: Object.assign(createMockFn('red'), {
      bold: createMockFn('red.bold')
    }),
    blue: Object.assign(createMockFn('blue'), {
      bold: createMockFn('blue.bold')
    }),
    cyan: createMockFn('cyan'),
    magenta: Object.assign(createMockFn('magenta'), {
      bold: createMockFn('magenta.bold')
    }),
    white: createMockFn('white'),
    gray: createMockFn('gray'),
    dim: createMockFn('dim'),
    bold: Object.assign(createMockFn('bold'), {
      cyan: createMockFn('bold.cyan'),
      blue: createMockFn('bold.blue'),
      magenta: createMockFn('bold.magenta'),
    }),
  };
});

jest.mock('../../src/utils/logger');

describe('Visualizer', () => {
  beforeEach(() => {
    // Clear console spy before each test
    jest.clearAllMocks();
  });

  describe('displayResult', () => {
    it('should display simple table data', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'PrimaryResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'count_', type: 'long' },
            ],
            rows: [
              ['Page1', 100],
              ['Page2', 200],
              ['Page3', 150],
            ],
          },
        ],
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty table data', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'PrimaryResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'count_', type: 'long' },
            ],
            rows: [],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle multiple tables', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'Table1',
            columns: [{ name: 'col1', type: 'string' }],
            rows: [['value1']],
          },
          {
            name: 'Table2',
            columns: [{ name: 'col2', type: 'long' }],
            rows: [[123]],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty result sets', () => {
      const mockResult: QueryResult = {
        tables: [],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No data returned'));
      consoleSpy.mockRestore();
    });

    it('should handle null tables', () => {
      const mockResult: QueryResult = {
        tables: null as any,
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No data returned'));
      consoleSpy.mockRestore();
    });
  });

  describe('displayChart', () => {
    it('should display bar chart for count data', () => {
      const mockData = [
        { category: 'A', count: 10 },
        { category: 'B', count: 20 },
        { category: 'C', count: 15 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(mockData, 'bar');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should display line chart', () => {
      const mockData = [
        { time: '2024-01-01', value: 10 },
        { time: '2024-01-02', value: 15 },
        { time: '2024-01-03', value: 12 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(mockData, 'line');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart([], 'bar');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No data available'));
      consoleSpy.mockRestore();
    });

    it('should handle null data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(null as any, 'bar');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No data available'));
      consoleSpy.mockRestore();
    });

    // New line chart tests
    it('should display sparkline for large datasets', () => {
      const largeData = Array.from({ length: 25 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: Math.sin(i * 0.5) * 100 + 100 // Generate wave pattern
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(largeData, 'line');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Trend:');
      expect(output).toContain('25 points');
      expect(output).toContain('Range:');
      
      consoleSpy.mockRestore();
    });

    it('should display ASCII line chart for small datasets', () => {
      const smallData = [
        { label: '10:00', value: 50 },
        { label: '11:00', value: 75 },
        { label: '12:00', value: 40 },
        { label: '13:00', value: 90 }
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(smallData, 'line');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Chart Visualization');
      // Should contain chart elements
      expect(output).toMatch(/[●─╮╰╭╯│]/); // Chart characters
      
      consoleSpy.mockRestore();
    });

    it('should detect time-series data correctly', () => {
      const timeSeriesData = [
        { time: '2024-01-01T10:00:00Z', value: 100 },
        { time: '2024-01-01T11:00:00Z', value: 120 },
        { time: '2024-01-01T12:00:00Z', value: 90 },
        { time: '2024-01-01T13:00:00Z', value: 150 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(timeSeriesData, 'line');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Chart Visualization');
      
      consoleSpy.mockRestore();
    });

    it('should handle constant values gracefully', () => {
      const constantData = [
        { label: 'A', value: 100 },
        { label: 'B', value: 100 },
        { label: 'C', value: 100 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(constantData, 'line');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      // For small constant datasets, it should show a flat ASCII line
      expect(output).toContain('100');
      
      consoleSpy.mockRestore();
    });

    it('should handle large constant datasets with sparkline', () => {
      const largeConstantData = Array.from({ length: 25 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: 100
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(largeConstantData, 'line');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('constant value: 100');
      expect(output).toContain('25 points');
      
      consoleSpy.mockRestore();
    });

    it('should handle mixed data formats', () => {
      const mixedData = [
        { category: 'A', count: 10 }, // Object with different keys
        { label: 'B', value: 20 },    // Standard format
        50,                           // Primitive number
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(mixedData, 'line');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should normalize data correctly', () => {
      const dateData = [
        ['2024-01-01', 10],
        ['2024-01-02', 15],
        ['2024-01-03', 12],
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(dateData.map(([date, value]) => ({ date, value })), 'line');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle single data point', () => {
      const singleData = [{ label: 'Only', value: 42 }];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(singleData, 'line');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should preserve bar chart functionality', () => {
      const mockData = [
        { category: 'A', count: 10 },
        { category: 'B', count: 20 },
        { category: 'C', count: 15 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayChart(mockData, 'bar');

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      // Should still contain bar chart elements
      expect(output).toContain('A');
      expect(output).toContain('B');
      expect(output).toContain('C');
      expect(output).toContain('10');
      expect(output).toContain('20');
      expect(output).toContain('15');
      
      consoleSpy.mockRestore();
    });
  });

  describe('displaySummary', () => {
    it('should display execution summary', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displaySummary(1500, 42);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1500ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('42 rows'));
      consoleSpy.mockRestore();
    });

    it('should handle zero execution time', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displaySummary(0, 0);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0 rows'));
      consoleSpy.mockRestore();
    });
  });

  describe('displayError', () => {
    it('should display error messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayError('Test error message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test error message'));
      consoleSpy.mockRestore();
    });
  });

  describe('displayWarning', () => {
    it('should display warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayWarning('Test warning message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Warning:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test warning message'));
      consoleSpy.mockRestore();
    });
  });

  describe('displayInfo', () => {
    it('should display info messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayInfo('Test info message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Info:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test info message'));
      consoleSpy.mockRestore();
    });
  });

  describe('displaySuccess', () => {
    it('should display success messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displaySuccess('Test success message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Success:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test success message'));
      consoleSpy.mockRestore();
    });
  });

  describe('displayKQLQuery', () => {
    it('should display KQL query with confidence', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayKQLQuery('requests | count', 0.85);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Generated KQL Query'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('requests | count'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('85%'));
      consoleSpy.mockRestore();
    });

    it('should handle low confidence queries', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayKQLQuery('complex query', 0.3);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('30%'));
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases and data types', () => {
    it('should handle large datasets (over 100 rows)', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'LargeTable',
            columns: [{ name: 'id', type: 'long' }],
            rows: Array.from({ length: 150 }, (_, i) => [i + 1]),
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('more rows'));
      consoleSpy.mockRestore();
    });

    it('should handle different data types in table display', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'MixedTypes',
            columns: [
              { name: 'str_col', type: 'string' },
              { name: 'int_col', type: 'long' },
              { name: 'bool_col', type: 'bool' },
              { name: 'date_col', type: 'datetime' },
              { name: 'null_col', type: 'string' },
            ],
            rows: [
              ['test string', 123, true, '2024-01-01T12:00:00Z', null],
              ['another', 456, false, '2024-01-02T13:30:00Z', undefined],
              ['', 0, null, 'invalid-date', ''],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle very long strings in data', () => {
      const longString = 'a'.repeat(150);
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'LongStrings',
            columns: [{ name: 'long_text', type: 'string' }],
            rows: [[longString]],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle tables with many columns', () => {
      const columns = Array.from({ length: 15 }, (_, i) => ({
        name: `col_${i + 1}`,
        type: 'string',
      }));

      const mockResult: QueryResult = {
        tables: [
          {
            name: 'WideTable',
            columns,
            rows: [Array.from({ length: 15 }, (_, i) => `value_${i + 1}`)],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('terminal width handling', () => {
    it('should adapt to different terminal widths', () => {
      const originalColumns = process.stdout.columns;
      process.stdout.columns = 80; // Simulate narrow terminal

      const mockResult: QueryResult = {
        tables: [
          {
            name: 'NarrowTerminal',
            columns: [
              { name: 'very_long_column_name_here', type: 'string' },
              { name: 'another_long_column', type: 'string' },
            ],
            rows: [
              ['Long content that should be truncated', 'More long content'],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      expect(consoleSpy).toHaveBeenCalled();

      // Restore original columns
      process.stdout.columns = originalColumns;
      consoleSpy.mockRestore();
    });
  });

  describe('numeric column display', () => {
    it('should display small integers completely without truncation', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'NumericTest',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'count_', type: 'long' }
            ],
            rows: [
              ['HTTPExample', 16],
              ['APICall', 25],
              ['Test', 156]
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalColumns = process.stdout.columns;
      process.stdout.columns = 40; // Simulate narrow terminal

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      // The numeric values should appear completely, not truncated
      expect(output).toContain('16');
      expect(output).toContain('25'); 
      expect(output).toContain('156');
      
      // Should not contain truncated versions
      expect(output).not.toMatch(/HTTPExample.*1[^6]/); // Should not be just "1" instead of "16"

      process.stdout.columns = originalColumns;
      consoleSpy.mockRestore();
    });

    it('should display large numbers completely when space allows', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'LargeNumbers',
            columns: [
              { name: 'id', type: 'long' },
              { name: 'count', type: 'long' }
            ],
            rows: [
              [12345, 67890],
              [98765, 43210]
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      expect(output).toContain('12345');
      expect(output).toContain('67890');
      expect(output).toContain('98765');
      expect(output).toContain('43210');

      consoleSpy.mockRestore();
    });

    it('should prioritize numeric columns over text in tight spaces', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'MixedContent',
            columns: [
              { name: 'very_long_description_column', type: 'string' },
              { name: 'num', type: 'int' }
            ],
            rows: [
              ['This is a very long text that should be truncated when space is tight', 42],
              ['Another long description that exceeds available space', 123]
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const originalColumns = process.stdout.columns;
      process.stdout.columns = 50; // Very narrow terminal

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      // Numeric values should be preserved
      expect(output).toContain('42');
      expect(output).toContain('123');
      
      // Text might be truncated but numbers should not
      expect(output).not.toMatch(/42.*4[^2]/); // Should not be truncated
      expect(output).not.toMatch(/123.*12[^3]/); // Should not be truncated

      process.stdout.columns = originalColumns;
      consoleSpy.mockRestore();
    });
  });

  describe('hide empty columns feature', () => {
    it('should hide columns with all null values by default', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'count', type: 'long' },
              { name: 'empty_col', type: 'string' }, // All null
            ],
            rows: [
              ['Page1', 100, null],
              ['Page2', 200, null],
              ['Page3', 150, null],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      // Should show only name and count columns
      expect(output).toContain('name');
      expect(output).toContain('count');
      expect(output).not.toContain('empty_col');

      // Should show summary with hidden columns info
      expect(output).toContain('1 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should hide columns with all empty strings by default', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'empty_str', type: 'string' }, // All empty strings
            ],
            rows: [
              ['Page1', ''],
              ['Page2', ''],
              ['Page3', ''],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).not.toContain('empty_str');
      expect(output).toContain('1 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should hide columns with all whitespace-only strings', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'whitespace', type: 'string' }, // All whitespace
            ],
            rows: [
              ['Page1', '   '],
              ['Page2', '\t  '],
              ['Page3', ' \n '],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).not.toContain('whitespace');
      expect(output).toContain('1 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should hide columns with mix of null, undefined, and empty strings', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'mixed_empty', type: 'string' }, // Mix of null, undefined, empty
            ],
            rows: [
              ['Page1', null],
              ['Page2', undefined],
              ['Page3', ''],
              ['Page4', '   '],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).not.toContain('mixed_empty');
      expect(output).toContain('1 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should keep columns that have at least one non-empty value', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'mixed', type: 'string' }, // Has some data
            ],
            rows: [
              ['Page1', null],
              ['Page2', ''],
              ['Page3', 'data'], // This makes the column visible
              ['Page4', '   '],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).toContain('mixed');
      expect(output).toContain('data');
      expect(output).not.toContain('empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should show all columns when hideEmptyColumns is false', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'empty_col', type: 'string' },
            ],
            rows: [
              ['Page1', null],
              ['Page2', null],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult, { hideEmptyColumns: false });

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).toContain('empty_col');
      expect(output).not.toContain('empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should handle case where all columns are empty', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'null_col', type: 'string' },
              { name: 'empty_col', type: 'string' },
            ],
            rows: [
              [null, ''],
              [null, ''],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('All columns contain empty data');
      expect(output).not.toContain('null_col');
      expect(output).not.toContain('empty_col');

      consoleSpy.mockRestore();
    });

    it('should handle multiple empty columns', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'empty1', type: 'string' },
              { name: 'count', type: 'long' },
              { name: 'empty2', type: 'string' },
              { name: 'empty3', type: 'string' },
            ],
            rows: [
              ['Page1', null, 100, '', '   '],
              ['Page2', null, 200, '', '   '],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).toContain('count');
      expect(output).not.toContain('empty1');
      expect(output).not.toContain('empty2');
      expect(output).not.toContain('empty3');
      expect(output).toContain('3 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should handle numeric columns with zeros vs nulls correctly', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'TestResult',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'zero_col', type: 'long' }, // Has zeros, should be visible
              { name: 'null_col', type: 'long' }, // Has nulls, should be hidden
            ],
            rows: [
              ['Page1', 0, null],
              ['Page2', 0, null],
            ],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('name');
      expect(output).toContain('zero_col');
      expect(output).not.toContain('null_col');
      expect(output).toContain('1 empty columns hidden');

      consoleSpy.mockRestore();
    });

    it('should work with multiple tables', () => {
      const mockResult: QueryResult = {
        tables: [
          {
            name: 'Table1',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'empty1', type: 'string' },
            ],
            rows: [['value1', null]],
          },
          {
            name: 'Table2',
            columns: [
              { name: 'name', type: 'string' },
              { name: 'empty2', type: 'string' },
            ],
            rows: [['value2', '']],
          },
        ],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayResult(mockResult);

      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');

      expect(output).toContain('value1');
      expect(output).toContain('value2');
      expect(output).not.toContain('empty1');
      expect(output).not.toContain('empty2');

      consoleSpy.mockRestore();
    });
  });

  describe('displayAnalysisResult', () => {
    const sampleAnalysisResult = {
      statistical: {
        summary: {
          totalRows: 100,
          uniqueValues: { 'column1': 50, 'column2': 25 },
          nullPercentage: { 'column1': 10.5, 'column2': 0 }
        },
        numerical: {
          mean: 125.5,
          median: 120,
          stdDev: 15.2,
          outliers: [200, 250],
          distribution: 'normal' as const
        },
        temporal: {
          timeRange: { start: new Date('2023-01-01'), end: new Date('2023-01-02') },
          trends: 'increasing' as const,
          gaps: []
        }
      },
      patterns: {
        trends: [{
          description: 'Response times increasing',
          confidence: 0.85,
          visualization: 'upward trend'
        }],
        anomalies: [{
          type: 'spike' as const,
          description: 'High response time detected',
          severity: 'medium' as const,
          affectedRows: [10, 11, 12]
        }],
        correlations: [{
          columns: ['requests', 'errors'] as [string, string],
          coefficient: 0.75,
          significance: 'strong' as const
        }]
      },
      insights: {
        dataQuality: {
          completeness: 95.5,
          consistency: ['Some missing timestamps'],
          recommendations: ['Filter out incomplete records']
        },
        businessInsights: {
          keyFindings: ['Peak usage at 2 PM'],
          potentialIssues: ['High error rate during peak'],
          opportunities: ['Optimize for peak hours']
        },
        followUpQueries: []
      },
      aiInsights: 'Your application shows increasing response times during peak hours.',
      recommendations: ['Consider scaling up during peak hours', 'Investigate slow queries'],
      followUpQueries: [{
        query: 'requests | where duration > 1000',
        purpose: 'Investigate slow requests',
        priority: 'high' as const
      }]
    };

    it('should display complete analysis result', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayAnalysisResult(sampleAnalysisResult, 'full');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      // Check that all sections are displayed
      expect(output).toContain('Analysis Results');
      expect(output).toContain('Statistical Summary');
      expect(output).toContain('Pattern Analysis');
      expect(output).toContain('Contextual Insights');
      expect(output).toContain('AI-Powered Insights');
      expect(output).toContain('Recommendations');
      expect(output).toContain('Follow-up Queries');

      consoleSpy.mockRestore();
    });

    it('should display statistical analysis only', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statsOnly = { statistical: sampleAnalysisResult.statistical };
      Visualizer.displayAnalysisResult(statsOnly, 'statistical');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Statistical Summary');
      expect(output).toContain('Total Rows: 100');
      expect(output).toContain('Mean: 125.5');
      expect(output).toContain('Distribution: normal');
      expect(output).not.toContain('Pattern Analysis');

      consoleSpy.mockRestore();
    });

    it('should display pattern analysis with anomalies', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const patternsOnly = { patterns: sampleAnalysisResult.patterns };
      Visualizer.displayAnalysisResult(patternsOnly, 'patterns');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Pattern Analysis');
      expect(output).toContain('Response times increasing');
      expect(output).toContain('High response time detected');
      expect(output).toContain('MEDIUM severity');
      expect(output).toContain('Affected Rows: [10, 11, 12]');

      consoleSpy.mockRestore();
    });

    it('should display insights and recommendations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const insightsWithRecommendations = {
        insights: sampleAnalysisResult.insights,
        aiInsights: sampleAnalysisResult.aiInsights,
        recommendations: sampleAnalysisResult.recommendations,
        followUpQueries: sampleAnalysisResult.followUpQueries
      };
      
      Visualizer.displayAnalysisResult(insightsWithRecommendations, 'insights');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('Contextual Insights');
      expect(output).toContain('Completeness: 95.5%');
      expect(output).toContain('Peak usage at 2 PM');
      expect(output).toContain('AI-Powered Insights');
      expect(output).toContain('increasing response times');
      expect(output).toContain('Recommendations');
      expect(output).toContain('scaling up');
      expect(output).toContain('Follow-up Queries');

      consoleSpy.mockRestore();
    });

    it('should handle empty analysis results gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Visualizer.displayAnalysisResult({}, 'statistical');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Analysis Results');

      consoleSpy.mockRestore();
    });

    it('should format trends with appropriate icons', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statsWithDifferentTrends = {
        statistical: {
          ...sampleAnalysisResult.statistical,
          temporal: {
            ...sampleAnalysisResult.statistical!.temporal!,
            trends: 'decreasing' as const
          }
        }
      };

      Visualizer.displayAnalysisResult(statsWithDifferentTrends, 'statistical');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('📉'); // Decreasing trend icon

      consoleSpy.mockRestore();
    });
  });
});
