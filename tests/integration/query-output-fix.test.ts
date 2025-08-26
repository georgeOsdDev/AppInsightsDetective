// Integration test to verify the specific issue is fixed
import { handleOutput } from '../../src/cli/commands/query';
import { QueryResult } from '../../src/types';
import fs from 'fs';
import path from 'path';

describe('Query Command Output Bug Fix', () => {
  const testDir = '/tmp/integration-test-output';

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  it('should create output file for the exact failing command scenario', async () => {
    // Simulate the exact user scenario:
    // aidx query 今日のリクエスト数 --output queryresult.txt --format json
    const mockResult: QueryResult = {
      tables: [{
        name: 'results',
        columns: [{ name: 'Count', type: 'int' }],
        rows: [[46]]
      }]
    };

    const options = {
      format: 'json',
      output: path.join(testDir, 'queryresult.txt'),
      pretty: false
    };

    const executionTime = 3413; // Same as user's output

    // This should now work with the fix
    await (handleOutput as any)(mockResult, options, executionTime);

    // Verify file was created
    const outputPath = options.output;
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify file content is correct JSON
    const content = fs.readFileSync(outputPath, 'utf8');
    const parsedContent = JSON.parse(content);
    expect(parsedContent.tables).toBeDefined();
    expect(parsedContent.tables[0].rows).toHaveLength(1);
    expect(parsedContent.tables[0].rows[0][0]).toBe(46);
  });

  it('should create output file for CSV format', async () => {
    const mockResult: QueryResult = {
      tables: [{
        name: 'results',
        columns: [{ name: 'Count', type: 'int' }],
        rows: [[46]]
      }]
    };

    const options = {
      format: 'csv',
      output: path.join(testDir, 'queryresult.csv')
    };

    await (handleOutput as any)(mockResult, options, 1000);

    // Verify file was created
    const outputPath = options.output;
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify CSV content
    const content = fs.readFileSync(outputPath, 'utf8');
    expect(content).toContain('Count');
    expect(content).toContain('46');
  });

  it('should create output file for table format', async () => {
    const mockResult: QueryResult = {
      tables: [{
        name: 'results',
        columns: [{ name: 'Count', type: 'int' }],
        rows: [[46]]
      }]
    };

    const options = {
      format: 'table',
      output: path.join(testDir, 'queryresult.txt')
    };

    await (handleOutput as any)(mockResult, options, 1000);

    // Verify file was created
    const outputPath = options.output;
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify table content exists
    const content = fs.readFileSync(outputPath, 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });
});