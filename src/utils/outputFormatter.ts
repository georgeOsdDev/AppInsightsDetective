import { QueryResult, QueryTable, OutputFormat, FormattedOutput } from '../types';
import { logger } from './logger';

export class OutputFormatter {
  /**
   * Format query result to specified format
   */
  public static formatResult(result: QueryResult, format: OutputFormat, options: {
    pretty?: boolean;
    includeHeaders?: boolean;
  } = {}): FormattedOutput {
    logger.debug(`Formatting result to ${format} format`);

    switch (format) {
      case 'json':
        return this.formatAsJSON(result, options.pretty);
      case 'csv':
        return this.formatAsCSV(result, options.includeHeaders !== false);
      case 'tsv':
        return this.formatAsTSV(result, options.includeHeaders !== false);
      case 'raw':
        return this.formatAsRaw(result);
      case 'table':
      default:
        return this.formatAsTable(result);
    }
  }

  /**
   * Format as JSON
   */
  private static formatAsJSON(result: QueryResult, pretty = false): FormattedOutput {
    const content = pretty 
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    return {
      content,
      extension: 'json',
      mimeType: 'application/json'
    };
  }

  /**
   * Format as CSV
   */
  private static formatAsCSV(result: QueryResult, includeHeaders = true): FormattedOutput {
    const lines: string[] = [];

    result.tables.forEach((table, tableIndex) => {
      // Add table separator for multiple tables
      if (result.tables.length > 1) {
        if (tableIndex > 0) lines.push(''); // Empty line between tables
        lines.push(`# Table: ${table.name || `Table ${tableIndex + 1}`}`);
      }

      // Add headers
      if (includeHeaders) {
        const headers = table.columns.map(col => this.escapeCsvField(col.name));
        lines.push(headers.join(','));
      }

      // Add data rows
      table.rows.forEach(row => {
        const csvRow = row.map(cell => this.escapeCsvField(this.formatCellValue(cell)));
        lines.push(csvRow.join(','));
      });
    });

    return {
      content: lines.join('\n'),
      extension: 'csv',
      mimeType: 'text/csv'
    };
  }

  /**
   * Format as TSV
   */
  private static formatAsTSV(result: QueryResult, includeHeaders = true): FormattedOutput {
    const lines: string[] = [];

    result.tables.forEach((table, tableIndex) => {
      // Add table separator for multiple tables
      if (result.tables.length > 1) {
        if (tableIndex > 0) lines.push(''); // Empty line between tables
        lines.push(`# Table: ${table.name || `Table ${tableIndex + 1}`}`);
      }

      // Add headers
      if (includeHeaders) {
        const headers = table.columns.map(col => this.escapeTsvField(col.name));
        lines.push(headers.join('\t'));
      }

      // Add data rows
      table.rows.forEach(row => {
        const tsvRow = row.map(cell => this.escapeTsvField(this.formatCellValue(cell)));
        lines.push(tsvRow.join('\t'));
      });
    });

    return {
      content: lines.join('\n'),
      extension: 'tsv',
      mimeType: 'text/tab-separated-values'
    };
  }

  /**
   * Format as raw data
   */
  private static formatAsRaw(result: QueryResult): FormattedOutput {
    const lines: string[] = [];
    
    lines.push('=== Query Result ===');
    lines.push(`Tables: ${result.tables.length}`);
    lines.push('');

    result.tables.forEach((table, tableIndex) => {
      lines.push(`--- Table ${tableIndex + 1}: ${table.name || 'Unnamed'} ---`);
      lines.push(`Columns: ${table.columns.length}, Rows: ${table.rows.length}`);
      lines.push('');

      // Column definitions
      lines.push('Columns:');
      table.columns.forEach((col, index) => {
        lines.push(`  ${index + 1}. ${col.name} (${col.type})`);
      });
      lines.push('');

      // Raw data dump
      lines.push('Data:');
      table.rows.forEach((row, rowIndex) => {
        lines.push(`Row ${rowIndex + 1}:`);
        row.forEach((cell, cellIndex) => {
          const columnName = table.columns[cellIndex]?.name || `Column${cellIndex}`;
          lines.push(`  ${columnName}: ${this.formatCellValue(cell)}`);
        });
        lines.push('');
      });
    });

    return {
      content: lines.join('\n'),
      extension: 'txt',
      mimeType: 'text/plain'
    };
  }

  /**
   * Format as table (for console display)
   */
  private static formatAsTable(result: QueryResult): FormattedOutput {
    // This is a placeholder - actual table formatting is handled by Visualizer
    const summary = `Query returned ${result.tables.length} table(s) with ${
      result.tables.reduce((sum, table) => sum + table.rows.length, 0)
    } total rows`;

    return {
      content: summary,
      extension: 'txt',
      mimeType: 'text/plain'
    };
  }

  /**
   * Escape CSV field
   */
  private static escapeCsvField(field: string): string {
    const strField = String(field);
    if (strField.includes(',') || strField.includes('"') || strField.includes('\n') || strField.includes('\r')) {
      return `"${strField.replace(/"/g, '""')}"`;
    }
    return strField;
  }

  /**
   * Escape TSV field
   */
  private static escapeTsvField(field: string): string {
    const strField = String(field);
    // Replace tabs, newlines, and carriage returns
    return strField
      .replace(/\t/g, '    ') // Replace tabs with spaces
      .replace(/\n/g, '\\n')  // Escape newlines
      .replace(/\r/g, '\\r'); // Escape carriage returns
  }

  /**
   * Format cell value consistently
   */
  private static formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // For objects and other types, stringify
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Get file extension for format
   */
  public static getExtensionForFormat(format: OutputFormat): string {
    switch (format) {
      case 'json': return 'json';
      case 'csv': return 'csv';
      case 'tsv': return 'tsv';
      case 'raw': return 'txt';
      case 'table':
      default: return 'txt';
    }
  }

  /**
   * Determine output format from file extension
   */
  public static getFormatFromExtension(filePath: string): OutputFormat | null {
    const ext = filePath.toLowerCase().split('.').pop();
    switch (ext) {
      case 'json': return 'json';
      case 'csv': return 'csv';
      case 'tsv': return 'tsv';
      case 'txt': return 'raw';
      default: return null;
    }
  }
}