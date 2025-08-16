import chalk from 'chalk';
import { QueryResult, QueryTable } from '../types';
import { logger } from './logger';

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

      this.displayTable(table);
    });
  }

  private static displayTable(table: QueryTable): void {
    if (table.rows.length === 0) {
      console.log(chalk.yellow('No rows in result'));
      return;
    }

    // カラム幅を計算
    const columnWidths = table.columns.map((col, index) => {
      const headerWidth = col.name.length;
      const dataWidth = Math.max(...table.rows.map(row =>
        String(row[index] || '').length
      ));
      return Math.min(Math.max(headerWidth, dataWidth), 50); // 最大50文字で制限
    });

    // ヘッダーを表示
    const header = table.columns.map((col, index) =>
      this.padString(col.name, columnWidths[index])
    ).join(' | ');

    console.log(chalk.bold.cyan(header));
    console.log(chalk.gray('-'.repeat(header.length)));

    // データ行を表示
    table.rows.forEach((row, rowIndex) => {
      if (rowIndex >= 100) {
        console.log(chalk.yellow(`... and ${table.rows.length - 100} more rows`));
        return;
      }

      const rowString = row.map((cell, colIndex) => {
        const cellStr = this.formatCell(cell, table.columns[colIndex].type);
        return this.padString(cellStr, columnWidths[colIndex]);
      }).join(' | ');

      console.log(rowString);
    });

    console.log(chalk.dim(`\nTotal rows: ${table.rows.length}`));
  }

  private static padString(str: string, width: number): string {
    if (str.length > width) {
      return str.substring(0, width - 3) + '...';
    }
    return str.padEnd(width);
  }

  private static formatCell(value: unknown, type: string): string {
    if (value === null || value === undefined) {
      return chalk.dim('null');
    }

    switch (type.toLowerCase()) {
      case 'datetime':
        return chalk.green(new Date(value as string).toLocaleString());
      case 'timespan':
        return chalk.blue(String(value));
      case 'real':
      case 'long':
      case 'int':
        return chalk.yellow(String(value));
      case 'bool':
      case 'boolean':
        return value ? chalk.green('true') : chalk.red('false');
      default:
        return String(value);
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
