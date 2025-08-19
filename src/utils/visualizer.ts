import chalk from 'chalk';
import { QueryResult, QueryTable } from '../types';

export class Visualizer {
  public static displayResult(result: QueryResult): void {
    if (!result.tables || result.tables.length === 0) {
      console.log(chalk.yellow('No data returned from query'));
      return;
    }

    result.tables.forEach((table, index) => {
      if (result.tables.length > 1) {
        console.log(chalk.bold.blue(`\n=== Table ${index + 1}: ${table.name || 'Unnamed'} ===`));
      }

      // テーブル情報の表示
      console.log(chalk.dim(`Columns: ${table.columns.length}, Rows: ${table.rows.length}`));

      this.displayTable(table);
    });
  }

  private static displayTable(table: QueryTable): void {
    if (table.rows.length === 0) {
      console.log(chalk.yellow('No rows in result'));
      return;
    }

    // ターミナル幅を取得（利用可能な場合）
    const terminalWidth = process.stdout.columns || 120;
    const availableWidth = Math.max(terminalWidth - 10, 80); // マージンを考慮

    // カラム幅を計算（改善版）
    const columnWidths = this.calculateOptimalColumnWidths(table, availableWidth);

    // ヘッダーを表示
    const header = table.columns.map((col, index) =>
      this.padString(col.name, columnWidths[index], col.type)
    ).join(' | ');

    console.log(chalk.bold.cyan('\n' + header));
    console.log(chalk.gray('-'.repeat(Math.min(header.length, availableWidth))));

    // データ行を表示（最初の100行まで）
    const displayRows = Math.min(table.rows.length, 100);
    for (let rowIndex = 0; rowIndex < displayRows; rowIndex++) {
      const row = table.rows[rowIndex];
      const rowString = row.map((cell, colIndex) => {
        const cellStr = this.formatCell(cell, table.columns[colIndex].type);
        return this.padString(cellStr, columnWidths[colIndex], table.columns[colIndex].type);
      }).join(' | ');

      console.log(rowString);
    }

    // 行数が多い場合の省略表示
    if (table.rows.length > 100) {
      console.log(chalk.yellow(`\n... and ${table.rows.length - 100} more rows (use LIMIT clause to see more)`));
    }

    console.log(chalk.dim(`\nDisplayed ${Math.min(displayRows, table.rows.length)} of ${table.rows.length} rows`));
  }

  /**
   * 最適なカラム幅を計算
   */
  private static calculateOptimalColumnWidths(table: QueryTable, availableWidth: number): number[] {
    const columnCount = table.columns.length;
    const separatorSpace = (columnCount - 1) * 3; // ' | ' separators
    const usableWidth = availableWidth - separatorSpace;

    // 各カラムの理想的な幅を計算
    const idealWidths = table.columns.map((col, index) => {
      const headerWidth = col.name.length;
      const sampleRows = table.rows.slice(0, Math.min(10, table.rows.length)); // サンプル行で計算

      const dataWidths = sampleRows.map(row => {
        const cell = row[index];
        if (cell === null || cell === undefined) {
          return 4; // "null"の長さ
        }

        // 日付型の場合は固定長
        if (col.type.toLowerCase() === 'datetime') {
          return 19; // "YYYY-MM-DD HH:mm:ss"形式
        }

        return String(cell).length;
      });

      const maxDataWidth = Math.max(0, ...dataWidths);
      return Math.max(headerWidth, maxDataWidth);
    });

    // 幅を調整
    const totalIdealWidth = idealWidths.reduce((sum, width) => sum + width, 0);

    if (totalIdealWidth <= usableWidth) {
      // 十分なスペースがある場合
      return idealWidths.map(width => Math.min(width, 60)); // 最大60文字制限
    } else {
      // スペースが不足している場合はタイプを考慮した配分
      const minWidths = table.columns.map((col, index) => {
        const isNumeric = ['int', 'long', 'real'].includes(col.type.toLowerCase());
        const headerWidth = col.name.length;
        
        if (isNumeric) {
          // 数値カラムは実際のデータ幅を優先（最小4文字）
          const actualDataWidth = idealWidths[index];
          return Math.max(Math.min(actualDataWidth, 15), 4); // 数値は最大15文字まで
        } else {
          // 文字列カラムは従来通り（最小6文字）
          return Math.max(headerWidth, 6);
        }
      });
      
      const minTotalWidth = minWidths.reduce((sum, width) => sum + width, 0);

      if (minTotalWidth >= usableWidth) {
        // 最小幅でも収まらない場合
        return table.columns.map((col, index) => {
          const isNumeric = ['int', 'long', 'real'].includes(col.type.toLowerCase());
          if (isNumeric) {
            // 数値カラムは最低限のスペースを確保
            return Math.max(minWidths[index], 4);
          } else {
            // 文字列カラムは調整可能
            return Math.max(col.name.length, 4);
          }
        });
      }

      // 比例配分で調整（数値カラムを優先）
      const extraSpace = usableWidth - minTotalWidth;
      const totalExtraNeeded = idealWidths.reduce((sum, ideal, index) => sum + Math.max(0, ideal - minWidths[index]), 0);

      return idealWidths.map((ideal, index) => {
        const minWidth = minWidths[index];
        const extraNeeded = Math.max(0, ideal - minWidth);
        const isNumeric = ['int', 'long', 'real'].includes(table.columns[index].type.toLowerCase());
        
        // 数値カラムには追加スペースを多く割り当て
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
      // 数値カラムの場合、短い数値は切り詰めない
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
      
      // 重要な情報を保持するため、より賢い省略を行う
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

    // 空文字列の場合
    if (value === '') {
      return chalk.dim('(empty)');
    }

    switch (type.toLowerCase()) {
      case 'datetime':
        try {
          const date = new Date(value as string);
          // より短い日時形式を使用
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
        // 数値の場合、適切にフォーマット
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return chalk.red(String(value)); // 無効な数値
        }

        // 整数の場合は小数点を表示しない
        if (type.toLowerCase() === 'int' || type.toLowerCase() === 'long') {
          return chalk.yellow(Math.floor(numValue).toString());
        } else {
          // 実数の場合は適切な精度で表示
          return chalk.yellow(numValue.toLocaleString());
        }
      case 'bool':
      case 'boolean':
        const boolValue = Boolean(value);
        return boolValue ? chalk.green('true') : chalk.red('false');
      case 'string':
      default:
        const strValue = String(value);
        // 長い文字列の場合は制限
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
    // 簡単なASCIIチャート表示（実装は簡略化）
    if (!data || data.length === 0) {
      console.log(chalk.yellow('No data available for chart'));
      return;
    }

    console.log(chalk.bold.magenta('\n📈 Chart Visualization'));
    console.log(chalk.dim('(ASCII chart - simplified)'));

    // 簡単なバーチャート
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
