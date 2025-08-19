import chalk from 'chalk';
import { QueryResult, QueryTable, QueryColumn } from '../types';

export class Visualizer {
  public static displayResult(result: QueryResult, options?: { hideEmptyColumns?: boolean }): void {
    if (!result.tables || result.tables.length === 0) {
      console.log(chalk.yellow('No data returned from query'));
      return;
    }

    result.tables.forEach((table, index) => {
      if (result.tables.length > 1) {
        console.log(chalk.bold.blue(`\n=== Table ${index + 1}: ${table.name || 'Unnamed'} ===`));
      }

      // Display table information
      console.log(chalk.dim(`Columns: ${table.columns.length}, Rows: ${table.rows.length}`));

      this.displayTable(table, options);
    });
  }

  private static displayTable(table: QueryTable, options?: { hideEmptyColumns?: boolean }): void {
    if (table.rows.length === 0) {
      console.log(chalk.yellow('No rows in result'));
      return;
    }

    // Get visible columns (filtering empty columns if enabled)
    const hideEmpty = options?.hideEmptyColumns ?? true; // Default: hide empty columns
    const { visibleColumns, visibleColumnIndices, hiddenCount } = this.getVisibleColumns(table, hideEmpty);
    
    // If all columns are empty, show informative message
    if (visibleColumns.length === 0) {
      console.log(chalk.yellow('All columns contain empty data'));
      return;
    }

    // Create filtered table for display
    const filteredTable: QueryTable = {
      ...table,
      columns: visibleColumns
    };

    // Get terminal width (if available)
    const terminalWidth = process.stdout.columns || 120;
    const availableWidth = Math.max(terminalWidth - 10, 80); // Consider margins

    // Calculate column widths for visible columns only
    const columnWidths = this.calculateOptimalColumnWidths(filteredTable, availableWidth);

    // Display header
    const header = visibleColumns.map((col, index) =>
      this.padString(col.name, columnWidths[index], col.type)
    ).join(' | ');

    console.log(chalk.bold.cyan('\n' + header));
    console.log(chalk.gray('-'.repeat(Math.min(header.length, availableWidth))));

    // Display data rows (first 100 rows maximum) - only visible columns
    const displayRows = Math.min(table.rows.length, 100);
    for (let rowIndex = 0; rowIndex < displayRows; rowIndex++) {
      const row = table.rows[rowIndex];
      const rowString = visibleColumnIndices.map((colIndex, visibleIndex) => {
        const cellStr = this.formatCell(row[colIndex], visibleColumns[visibleIndex].type);
        return this.padString(cellStr, columnWidths[visibleIndex], visibleColumns[visibleIndex].type);
      }).join(' | ');

      console.log(rowString);
    }

    // Abbreviated display when there are many rows
    if (table.rows.length > 100) {
      console.log(chalk.yellow(`\n... and ${table.rows.length - 100} more rows (use LIMIT clause to see more)`));
    }

    // Enhanced summary with hidden columns info
    const totalColumns = table.columns.length;
    const visibleColumnsCount = visibleColumns.length;
    
    if (hiddenCount > 0) {
      console.log(chalk.dim(`\nDisplayed ${Math.min(displayRows, table.rows.length)} of ${table.rows.length} rows (${visibleColumnsCount} columns displayed, ${hiddenCount} empty columns hidden)`));
    } else {
      console.log(chalk.dim(`\nDisplayed ${Math.min(displayRows, table.rows.length)} of ${table.rows.length} rows`));
    }
  }

  /**
   * Analyze which columns contain only empty values
   */
  private static analyzeEmptyColumns(table: QueryTable): boolean[] {
    return table.columns.map((_, colIndex) => {
      return table.rows.every(row => {
        const value = row[colIndex];
        
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        
        return false;
      });
    });
  }

  /**
   * Get visible columns (filtering empty columns if enabled)
   */
  private static getVisibleColumns(table: QueryTable, hideEmpty: boolean): {
    visibleColumns: QueryColumn[];
    visibleColumnIndices: number[];
    hiddenCount: number;
  } {
    if (!hideEmpty) {
      return {
        visibleColumns: table.columns,
        visibleColumnIndices: table.columns.map((_, index) => index),
        hiddenCount: 0
      };
    }

    const emptyColumns = this.analyzeEmptyColumns(table);
    const visibleColumnIndices = table.columns
      .map((_, index) => index)
      .filter(index => !emptyColumns[index]);
    
    const hiddenCount = table.columns.length - visibleColumnIndices.length;
    
    return {
      visibleColumns: visibleColumnIndices.map(index => table.columns[index]),
      visibleColumnIndices,
      hiddenCount
    };
  }

  /**
   * Calculate optimal column widths
   */
  private static calculateOptimalColumnWidths(table: QueryTable, availableWidth: number): number[] {
    const columnCount = table.columns.length;
    const separatorSpace = (columnCount - 1) * 3; // ' | ' separators
    const usableWidth = availableWidth - separatorSpace;

    // 各カラムの理想的な幅を計算
    const idealWidths = table.columns.map((col, index) => {
      const headerWidth = col.name.length;
      const sampleRows = table.rows.slice(0, Math.min(10, table.rows.length)); // Calculate with sample rows

      const dataWidths = sampleRows.map(row => {
        const cell = row[index];
        if (cell === null || cell === undefined) {
          return 4; // Length of "null"
        }

        // Fixed length for datetime type
        if (col.type.toLowerCase() === 'datetime') {
          return 19; // "YYYY-MM-DD HH:mm:ss" format
        }

        return String(cell).length;
      });

      const maxDataWidth = Math.max(0, ...dataWidths);
      return Math.max(headerWidth, maxDataWidth);
    });

    // Adjust widths
    const totalIdealWidth = idealWidths.reduce((sum, width) => sum + width, 0);

    if (totalIdealWidth <= usableWidth) {
      // When there is enough space
      return idealWidths.map(width => Math.min(width, 60)); // Maximum 60 characters limit
    } else {
      // When space is insufficient, distribute considering column types
      const minWidths = table.columns.map((col, index) => {
        const isNumeric = ['int', 'long', 'real'].includes(col.type.toLowerCase());
        const headerWidth = col.name.length;
        
        if (isNumeric) {
          // Numeric columns prioritize actual data width (minimum 4 characters)
          const actualDataWidth = idealWidths[index];
          return Math.max(Math.min(actualDataWidth, 15), 4); // Numbers up to 15 characters maximum
        } else {
          // String columns as usual (minimum 6 characters)
          return Math.max(headerWidth, 6);
        }
      });
      
      const minTotalWidth = minWidths.reduce((sum, width) => sum + width, 0);

      if (minTotalWidth >= usableWidth) {
        // When it doesn't fit even with minimum width
        return table.columns.map((col, index) => {
          const isNumeric = ['int', 'long', 'real'].includes(col.type.toLowerCase());
          if (isNumeric) {
            // Secure minimum space for numeric columns
            return Math.max(minWidths[index], 4);
          } else {
            // String columns are adjustable
            return Math.max(col.name.length, 4);
          }
        });
      }

      // Adjust with proportional distribution (prioritize numeric columns)
      const extraSpace = usableWidth - minTotalWidth;
      const totalExtraNeeded = idealWidths.reduce((sum, ideal, index) => sum + Math.max(0, ideal - minWidths[index]), 0);

      return idealWidths.map((ideal, index) => {
        const minWidth = minWidths[index];
        const extraNeeded = Math.max(0, ideal - minWidth);
        const isNumeric = ['int', 'long', 'real'].includes(table.columns[index].type.toLowerCase());
        
        // Allocate more extra space to numeric columns
        const priorityMultiplier = isNumeric ? 2 : 1;
        const adjustedExtraNeeded = extraNeeded * priorityMultiplier;
        
        const extraAllocated = totalExtraNeeded > 0 ? 
          Math.floor((adjustedExtraNeeded / totalExtraNeeded) * extraSpace) : 0;
        
        return Math.min(minWidth + extraAllocated, isNumeric ? 20 : 60);
      });
    }
  }

  private static padString(str: string, width: number, columnType?: string): string {
    if (str.length > width) {
      // For numeric columns, don't truncate short numbers
      const isNumericColumn = columnType && ['int', 'long', 'real'].includes(columnType.toLowerCase());
      
      if (isNumericColumn) {
        // Handle both real chalk codes and mocked chalk formatting
        // Remove chalk formatting: both ANSI codes and mock format like "yellow(16)"
        const cleanStr = str
          .replace(/\x1b\[[0-9;]*m/g, '') // Real ANSI codes
          .replace(/^\w+\((.+)\)$/, '$1'); // Mock format like "yellow(16)" -> "16"
        
        // For simple numeric values (common case), don't truncate if reasonable length
        if (cleanStr.length <= 15 && /^-?\d+(\.\d+)?$/.test(cleanStr)) {
          // Short numeric values should never be truncated, allow overflow
          return str;
        }
      }
      
      // Perform smarter abbreviation to retain important information
      if (width <= 4) {
        return str.substring(0, width);
      }
      return str.substring(0, width - 3) + '...';
    }
    return str.padEnd(width, ' ');
  }

  private static formatCell(value: unknown, type: string): string {
    if (value === null || value === undefined) {
      return chalk.dim('null');
    }

    // In case of empty string
    if (value === '') {
      return chalk.dim('(empty)');
    }

    switch (type.toLowerCase()) {
      case 'datetime':
        try {
          const date = new Date(value as string);
          // Use shorter date/time format
          return chalk.green(date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }));
        } catch {
          return chalk.red(String(value));
        }
      case 'timespan':
        return chalk.blue(String(value));
      case 'real':
      case 'long':
      case 'int':
        // For numbers, format appropriately
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return chalk.red(String(value)); // Invalid number
        }

        // Don't show decimal places for integers
        if (type.toLowerCase() === 'int' || type.toLowerCase() === 'long') {
          return chalk.yellow(Math.floor(numValue).toString());
        } else {
          // For real numbers, display with appropriate precision
          return chalk.yellow(numValue.toLocaleString());
        }
      case 'bool':
      case 'boolean':
        const boolValue = Boolean(value);
        return boolValue ? chalk.green('true') : chalk.red('false');
      case 'string':
      default:
        const strValue = String(value);
        // Limit for long strings
        if (strValue.length > 100) {
          return strValue.substring(0, 97) + '...';
        }
        return strValue;
    }
  }

  public static displaySummary(executionTime: number, rowCount: number): void {
    console.log(chalk.dim(`\n⏱️  Query executed in ${executionTime}ms`));
    console.log(chalk.dim(`📊 Returned ${rowCount} rows`));
  }

  public static displayError(error: string): void {
    console.log(chalk.red.bold('❌ Error:'));
    console.log(chalk.red(error));
  }

  public static displayWarning(warning: string): void {
    console.log(chalk.yellow.bold('⚠️  Warning:'));
    console.log(chalk.yellow(warning));
  }

  public static displayInfo(info: string): void {
    console.log(chalk.blue.bold('ℹ️  Info:'));
    console.log(chalk.blue(info));
  }

  public static displaySuccess(message: string): void {
    console.log(chalk.green.bold('✅ Success:'));
    console.log(chalk.green(message));
  }

  public static displayChart(data: any[], chartType: 'line' | 'bar' = 'line'): void {
    // Simple ASCII chart display (implementation simplified)
    if (!data || data.length === 0) {
      console.log(chalk.yellow('No data available for chart'));
      return;
    }

    console.log(chalk.bold.magenta('\n📈 Chart Visualization'));
    console.log(chalk.dim('(ASCII chart - simplified)'));

    // Simple bar chart
    if (chartType === 'bar') {
      data.slice(0, 10).forEach((item, index) => {
        const value = typeof item === 'object' ? Object.values(item)[1] : item;
        const label = typeof item === 'object' ? Object.values(item)[0] : `Item ${index + 1}`;
        const barLength = Math.min(Math.floor(Number(value) / 100), 50);
        const bar = '█'.repeat(barLength);
        console.log(`${String(label).padEnd(15)} ${chalk.blue(bar)} ${value}`);
      });
    }
  }

  public static displayKQLQuery(query: string, confidence: number): void {
    console.log(chalk.bold.cyan('\n🔍 Generated KQL Query:'));
    console.log(chalk.white(query));
    console.log(chalk.dim(`Confidence: ${Math.round(confidence * 100)}%`));
  }
}
