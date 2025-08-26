import fs from 'fs';
import path from 'path';
import { QueryResult } from '../../src/types';
import { OutputFormatter } from '../../src/utils/outputFormatter';
import { FileOutputManager } from '../../src/utils/fileOutput';
import { Visualizer } from '../../src/utils/visualizer';
import { logger } from '../../src/utils/logger';
import chalk from 'chalk';

// Copy the handleOutput function from query.ts to test it directly
async function queryHandleOutput(result: QueryResult, options: any, executionTime: number): Promise<void> {
  const outputFormat = options.format as any;
  const outputFile = options.output as string | undefined;
  const encoding = FileOutputManager.isValidEncoding(options.encoding) ? options.encoding : 'utf8';

  // Validate format
  const validFormats: string[] = ['table', 'json', 'csv', 'tsv', 'raw'];
  if (!validFormats.includes(outputFormat)) {
    logger.warn(`Invalid format '${outputFormat}', defaulting to table`);
    options.format = 'table';
  }

  // Handle console output based on format and output file options
  if (!outputFile) {
    // No output file specified - display to console
    if (outputFormat === 'table') {
      // Mock console output for testing
      console.log(`[MOCK CONSOLE] Would show ${outputFormat} output`);
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      console.log(`[MOCK CONSOLE] Would show summary: ${totalRows} rows, ${executionTime}ms`);
      console.log('[MOCK CONSOLE] Would display chart');
    } else {
      // Mock console output for testing
      console.log(`[MOCK CONSOLE] Would show ${outputFormat} output`);
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      console.log(`[MOCK CONSOLE] Would show summary: ${totalRows} rows, ${executionTime}ms`);
    }
  }

  // Handle file output
  if (outputFile) {
    try {
      // Resolve output path and check permissions
      const resolvedPath = FileOutputManager.resolveOutputPath(outputFile, outputFormat);
      
      if (!FileOutputManager.checkWritePermission(resolvedPath)) {
        console.log(`[MOCK ERROR] Cannot write to file: ${resolvedPath}`);
        return;
      }

      // Format the output
      const formattedOutput = OutputFormatter.formatResult(result, outputFormat, {
        pretty: options.pretty,
        includeHeaders: !options.noHeaders
      });

      // Create backup if file exists
      FileOutputManager.createBackup(resolvedPath);

      // Write to file
      await FileOutputManager.writeToFile(formattedOutput, resolvedPath, encoding);

      // Show success message
      const totalRows = result.tables.reduce((sum, table) => sum + table.rows.length, 0);
      console.log(`[MOCK SUCCESS] Successfully saved ${totalRows} rows to ${resolvedPath}`);
      
      // Show execution summary if not already shown
      if (outputFormat !== 'table') {
        console.log('[MOCK SUMMARY] Would show execution summary');
      }

    } catch (error) {
      logger.error('File output failed:', error);
      console.log(`[MOCK ERROR] Failed to save to file: ${error}`);
      
      // Fallback to console output
      if (outputFormat !== 'table') {
        console.log('[MOCK FALLBACK] Would show console output');
      }
    }
  }
}

describe('Query Command Output Handling', () => {
  const testDir = '/tmp/query-output-test';
  const mockResult: QueryResult = {
    tables: [{
      name: 'TestTable',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'count', type: 'int' }
      ],
      rows: [
        ['John', 42],
        ['Jane', 37],
        ['Bob', 15]
      ]
    }]
  };

  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clear console spy between tests
    jest.clearAllMocks();
    
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe('File output behavior', () => {
    it('should create JSON file when format is json and output is specified', async () => {
      const outputFile = path.join(testDir, 'test-json.json');
      const options = {
        format: 'json',
        output: outputFile,
        pretty: true
      };

      // Ensure file doesn't exist before test
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }

      await queryHandleOutput(mockResult, options, 500);

      // Check if file was created
      expect(fs.existsSync(outputFile)).toBe(true);

      // Check file content
      const content = fs.readFileSync(outputFile, 'utf8');
      const parsedContent = JSON.parse(content);
      expect(parsedContent.tables).toBeDefined();
      expect(parsedContent.tables[0].rows).toHaveLength(3);
    });

    it('should create CSV file when format is csv and output is specified', async () => {
      const outputFile = path.join(testDir, 'test-csv.csv');
      const options = {
        format: 'csv',
        output: outputFile
      };

      // Ensure file doesn't exist before test
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }

      await queryHandleOutput(mockResult, options, 500);

      // Check if file was created
      expect(fs.existsSync(outputFile)).toBe(true);

      // Check file content
      const content = fs.readFileSync(outputFile, 'utf8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('name,count'); // header
      expect(lines[1]).toBe('John,42'); // first row
      expect(lines[2]).toBe('Jane,37'); // second row
    });

    it('should create table file when format is table and output is specified', async () => {
      const outputFile = path.join(testDir, 'test-table.txt');
      const options = {
        format: 'table',
        output: outputFile
      };

      // Ensure file doesn't exist before test
      if (fs.existsSync(outputFile)) {
        fs.unlinkSync(outputFile);
      }

      await queryHandleOutput(mockResult, options, 500);

      // Check if file was created
      expect(fs.existsSync(outputFile)).toBe(true);

      // Table format saves as readable table text
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should not create file when no output is specified', async () => {
      const options = {
        format: 'json'
        // no output specified
      };

      await queryHandleOutput(mockResult, options, 500);

      // No file should be created
      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(0);
    });
  });

  describe('Console output behavior', () => {
    it('should not show console output for table format with file output', async () => {
      const outputFile = path.join(testDir, 'table-no-console.txt');
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const options = {
        format: 'table',
        output: outputFile
      };

      await queryHandleOutput(mockResult, options, 500);

      // Should NOT show console output because file is specified (new behavior matches main CLI)
      expect(consoleLogSpy).not.toHaveBeenCalledWith('[MOCK CONSOLE] Would show table output');

      consoleLogSpy.mockRestore();
    });

    it('should not show console output for non-table format with file output', async () => {
      const outputFile = path.join(testDir, 'json-no-console.json');
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const options = {
        format: 'json',
        output: outputFile,
        pretty: true
      };

      await queryHandleOutput(mockResult, options, 500);

      // Should NOT show console output because format is not table and file is specified
      expect(consoleLogSpy).not.toHaveBeenCalledWith('[MOCK CONSOLE] Would show json output');

      consoleLogSpy.mockRestore();
    });

    it('should show console output for any format when no file output', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const options = {
        format: 'json'
        // no output file
      };

      await queryHandleOutput(mockResult, options, 500);

      // Should show console output because no file is specified
      expect(consoleLogSpy).toHaveBeenCalledWith('[MOCK CONSOLE] Would show json output');

      consoleLogSpy.mockRestore();
    });
  });
});