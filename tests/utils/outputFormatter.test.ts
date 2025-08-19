import { OutputFormatter } from '../../src/utils/outputFormatter';
import { QueryResult } from '../../src/types';

describe('OutputFormatter', () => {
  const mockQueryResult: QueryResult = {
    tables: [
      {
        name: 'TestTable',
        columns: [
          { name: 'name', type: 'string' },
          { name: 'count', type: 'int' },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'datetime' }
        ],
        rows: [
          ['John Doe', 42, true, '2024-01-01T12:00:00Z'],
          ['Jane Smith', 37, false, '2024-01-02T13:30:00Z'],
          ['Bob Johnson', null, true, '2024-01-03T14:45:00Z']
        ]
      }
    ]
  };

  const mockMultiTableResult: QueryResult = {
    tables: [
      {
        name: 'Table1',
        columns: [{ name: 'col1', type: 'string' }, { name: 'col2', type: 'int' }],
        rows: [['A', 1], ['B', 2]]
      },
      {
        name: 'Table2',
        columns: [{ name: 'col3', type: 'string' }],
        rows: [['X'], ['Y']]
      }
    ]
  };

  describe('formatResult', () => {
    it('should format as JSON with pretty printing', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'json', { pretty: true });
      
      expect(result.extension).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.content).toContain('{\n  "tables"');
      expect(JSON.parse(result.content)).toEqual(mockQueryResult);
    });

    it('should format as compact JSON', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'json', { pretty: false });
      
      expect(result.extension).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.content).not.toContain('\n  ');
      expect(JSON.parse(result.content)).toEqual(mockQueryResult);
    });

    it('should format as CSV with headers', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'csv', { includeHeaders: true });
      
      expect(result.extension).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('name,count,active,created');
      expect(lines[1]).toBe('John Doe,42,true,2024-01-01T12:00:00Z');
      expect(lines[2]).toBe('Jane Smith,37,false,2024-01-02T13:30:00Z');
      expect(lines[3]).toBe('Bob Johnson,,true,2024-01-03T14:45:00Z');
    });

    it('should format as CSV without headers', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'csv', { includeHeaders: false });
      
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('John Doe,42,true,2024-01-01T12:00:00Z');
      expect(lines[0]).not.toContain('name,count');
    });

    it('should format as TSV with headers', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'tsv', { includeHeaders: true });
      
      expect(result.extension).toBe('tsv');
      expect(result.mimeType).toBe('text/tab-separated-values');
      
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('name\tcount\tactive\tcreated');
      expect(lines[1]).toBe('John Doe\t42\ttrue\t2024-01-01T12:00:00Z');
    });

    it('should format as raw data', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'raw');
      
      expect(result.extension).toBe('txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.content).toContain('=== Query Result ===');
      expect(result.content).toContain('Tables: 1');
      expect(result.content).toContain('--- Table 1: TestTable ---');
      expect(result.content).toContain('Columns: 4, Rows: 3');
      expect(result.content).toContain('name: John Doe');
    });

    it('should handle multiple tables in CSV format', () => {
      const result = OutputFormatter.formatResult(mockMultiTableResult, 'csv', { includeHeaders: true });
      
      const lines = result.content.split('\n');
      expect(lines).toContain('# Table: Table1');
      expect(lines).toContain('# Table: Table2');
      expect(result.content).toContain('col1,col2');
      expect(result.content).toContain('col3');
    });

    it('should default to table format for unknown format', () => {
      const result = OutputFormatter.formatResult(mockQueryResult, 'unknown' as any);
      
      expect(result.extension).toBe('txt');
      expect(result.mimeType).toBe('text/plain');
    });
  });

  describe('CSV field escaping', () => {
    it('should escape CSV fields with commas', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'text', type: 'string' }],
          rows: [['hello, world'], ['no commas']]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'csv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('"hello, world"');
      expect(lines[2]).toBe('no commas');
    });

    it('should escape CSV fields with quotes', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'text', type: 'string' }],
          rows: [['say "hello"'], ['normal text']]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'csv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('"say ""hello"""');
      expect(lines[2]).toBe('normal text');
    });

    it('should escape CSV fields with newlines', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'text', type: 'string' }],
          rows: [['line1\nline2']]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'csv');
      
      // The content should contain the escaped field
      expect(result.content).toContain('"line1\nline2"');
      expect(result.content).toContain('text\n"line1\nline2"');
    });
  });

  describe('TSV field escaping', () => {
    it('should escape tabs in TSV fields', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'text', type: 'string' }],
          rows: [['hello\tworld'], ['normal text']]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'tsv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('hello    world'); // tabs replaced with spaces
      expect(lines[2]).toBe('normal text');
    });

    it('should escape newlines in TSV fields', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'text', type: 'string' }],
          rows: [['line1\nline2']]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'tsv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('line1\\nline2');
    });
  });

  describe('utility methods', () => {
    it('should get correct extension for format', () => {
      expect(OutputFormatter.getExtensionForFormat('json')).toBe('json');
      expect(OutputFormatter.getExtensionForFormat('csv')).toBe('csv');
      expect(OutputFormatter.getExtensionForFormat('tsv')).toBe('tsv');
      expect(OutputFormatter.getExtensionForFormat('raw')).toBe('txt');
      expect(OutputFormatter.getExtensionForFormat('table')).toBe('txt');
    });

    it('should get format from extension', () => {
      expect(OutputFormatter.getFormatFromExtension('data.json')).toBe('json');
      expect(OutputFormatter.getFormatFromExtension('data.csv')).toBe('csv');
      expect(OutputFormatter.getFormatFromExtension('data.tsv')).toBe('tsv');
      expect(OutputFormatter.getFormatFromExtension('data.txt')).toBe('raw');
      expect(OutputFormatter.getFormatFromExtension('data.xyz')).toBeNull();
    });
  });

  describe('cell value formatting', () => {
    it('should handle null and undefined values', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [{ name: 'val', type: 'string' }],
          rows: [[null], [undefined]]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'csv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('');
    });

    it('should handle different data types', () => {
      const testResult: QueryResult = {
        tables: [{
          name: 'Test',
          columns: [
            { name: 'str', type: 'string' },
            { name: 'num', type: 'int' },
            { name: 'bool', type: 'bool' },
            { name: 'obj', type: 'dynamic' }
          ],
          rows: [['text', 42, true, { key: 'value' }]]
        }]
      };

      const result = OutputFormatter.formatResult(testResult, 'csv');
      const lines = result.content.split('\n');
      
      expect(lines[1]).toBe('text,42,true,"{""key"":""value""}"');
    });
  });
});