import chalk from 'chalk';
import { QueryResult, QueryTable, QueryColumn, AnalysisResult, StatisticalAnalysis, PatternAnalysis, ContextualInsights } from '../types';
import { ChartRenderer } from './chart';

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
    ChartRenderer.displayChart(data, chartType);
  }

  public static displayKQLQuery(query: string, confidence: number): void {
    console.log(chalk.bold.cyan('\n🔍 Generated KQL Query:'));
    console.log(chalk.white(query));
    console.log(chalk.dim(`Confidence: ${Math.round(confidence * 100)}%`));
  }

  /**
   * Display analysis results in formatted output
   */
  public static displayAnalysisResult(analysis: AnalysisResult, analysisType: string): void {
    console.log(chalk.bold.magenta('\n🧠 Analysis Results'));
    console.log(chalk.dim('═'.repeat(50)));

    if (analysis.statistical) {
      this.displayStatisticalAnalysis(analysis.statistical);
    }

    if (analysis.patterns) {
      this.displayPatternAnalysis(analysis.patterns);
    }

    if (analysis.insights) {
      this.displayContextualInsights(analysis.insights);
    }

    if (analysis.aiInsights) {
      this.displayAIInsights(analysis.aiInsights);
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      this.displayRecommendations(analysis.recommendations);
    }

    if (analysis.followUpQueries && analysis.followUpQueries.length > 0) {
      this.displayFollowUpQueries(analysis.followUpQueries);
    }
  }

  private static displayStatisticalAnalysis(stats: StatisticalAnalysis): void {
    console.log(chalk.bold.blue('\n📈 Statistical Summary'));
    console.log(chalk.dim('─'.repeat(30)));

    // Dataset overview
    console.log(chalk.cyan('\n📊 Dataset Overview:'));
    console.log(`   • Total Rows: ${stats.summary.totalRows.toLocaleString()}`);
    
    if (Object.keys(stats.summary.uniqueValues).length > 0) {
      console.log(`   • Columns: ${Object.keys(stats.summary.uniqueValues).length}`);
      
      // Show top columns with unique values
      const topColumns = Object.entries(stats.summary.uniqueValues)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      topColumns.forEach(([col, unique]) => {
        const nullPct = stats.summary.nullPercentage[col]?.toFixed(1) || '0.0';
        console.log(`   • ${col}: ${unique} unique values (${nullPct}% null)`);
      });
    }

    // Numerical analysis
    if (stats.numerical) {
      console.log(chalk.cyan('\n📈 Numerical Analysis:'));
      console.log(`   • Mean: ${stats.numerical.mean}`);
      console.log(`   • Median: ${stats.numerical.median}`);
      console.log(`   • Std Dev: ${stats.numerical.stdDev}`);
      console.log(`   • Distribution: ${stats.numerical.distribution}`);
      
      if (stats.numerical.outliers.length > 0) {
        console.log(`   • Outliers: ${stats.numerical.outliers.length} detected`);
        if (stats.numerical.outliers.length <= 5) {
          console.log(`     Values: [${stats.numerical.outliers.join(', ')}]`);
        } else {
          console.log(`     Sample: [${stats.numerical.outliers.slice(0, 3).join(', ')}, ...]`);
        }
      }
    }

    // Temporal analysis
    if (stats.temporal) {
      console.log(chalk.cyan('\n🕒 Temporal Analysis:'));
      console.log(`   • Time Range: ${stats.temporal.timeRange.start.toISOString().split('T')[0]} - ${stats.temporal.timeRange.end.toISOString().split('T')[0]}`);
      console.log(`   • Trend: ${this.formatTrend(stats.temporal.trends)}`);
      
      if (stats.temporal.gaps.length > 0) {
        console.log(`   • Data Gaps: ${stats.temporal.gaps.length} detected`);
      } else {
        console.log(`   • Data Gaps: None detected`);
      }
    }
  }

  private static displayPatternAnalysis(patterns: PatternAnalysis): void {
    console.log(chalk.bold.blue('\n🔍 Pattern Analysis'));
    console.log(chalk.dim('─'.repeat(30)));

    // Trends
    if (patterns.trends.length > 0) {
      console.log(chalk.cyan('\n📈 Identified Trends:'));
      patterns.trends.forEach((trend, index) => {
        const confidenceColor = trend.confidence > 0.8 ? chalk.green : trend.confidence > 0.6 ? chalk.yellow : chalk.red;
        console.log(`   ${index + 1}. ${chalk.bold(trend.description)}`);
        console.log(`      Confidence: ${confidenceColor(`${Math.round(trend.confidence * 100)}%`)}`);
        if (trend.visualization) {
          console.log(`      ${chalk.dim(trend.visualization)}`);
        }
      });
    }

    // Anomalies
    if (patterns.anomalies.length > 0) {
      console.log(chalk.cyan('\n🚨 Anomalies Detected:'));
      patterns.anomalies.forEach((anomaly, index) => {
        const severityColor = anomaly.severity === 'high' ? chalk.red : anomaly.severity === 'medium' ? chalk.yellow : chalk.cyan;
        const severityIcon = anomaly.severity === 'high' ? '🔴' : anomaly.severity === 'medium' ? '🟡' : '🔵';
        
        console.log(`   ${index + 1}. ${severityIcon} ${chalk.bold(anomaly.description)} ${severityColor(`(${anomaly.severity.toUpperCase()} severity)`)}`);
        console.log(`      Type: ${anomaly.type}`);
        if (anomaly.affectedRows.length > 0) {
          const rowSample = anomaly.affectedRows.slice(0, 5);
          console.log(`      Affected Rows: [${rowSample.join(', ')}${anomaly.affectedRows.length > 5 ? ', ...' : ''}]`);
        }
      });
    }

    // Correlations
    if (patterns.correlations.length > 0) {
      console.log(chalk.cyan('\n🔗 Correlations Found:'));
      patterns.correlations.forEach((correlation, index) => {
        const significanceColor = correlation.significance === 'strong' ? chalk.green : correlation.significance === 'moderate' ? chalk.yellow : chalk.cyan;
        console.log(`   ${index + 1}. ${chalk.bold(`${correlation.columns[0]} ↔ ${correlation.columns[1]}`)} (r=${correlation.coefficient.toFixed(2)})`);
        console.log(`      Significance: ${significanceColor(correlation.significance)}`);
      });
    }

    if (patterns.trends.length === 0 && patterns.anomalies.length === 0 && patterns.correlations.length === 0) {
      console.log(chalk.dim('   No significant patterns detected in the current dataset.'));
    }
  }

  private static displayContextualInsights(insights: ContextualInsights): void {
    console.log(chalk.bold.blue('\n💡 Contextual Insights'));
    console.log(chalk.dim('─'.repeat(30)));

    // Data quality
    console.log(chalk.cyan('\n🎯 Data Quality Assessment:'));
    console.log(`   • Completeness: ${insights.dataQuality.completeness}%`);
    
    if (insights.dataQuality.consistency.length > 0) {
      console.log(`   • Consistency Issues:`);
      insights.dataQuality.consistency.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }

    if (insights.dataQuality.recommendations.length > 0) {
      console.log(`   • Quality Recommendations:`);
      insights.dataQuality.recommendations.forEach(rec => {
        console.log(`     - ${rec}`);
      });
    }

    // Business insights
    if (insights.businessInsights.keyFindings.length > 0) {
      console.log(chalk.cyan('\n🎪 Key Business Findings:'));
      insights.businessInsights.keyFindings.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    if (insights.businessInsights.potentialIssues.length > 0) {
      console.log(chalk.cyan('\n⚠️  Potential Issues:'));
      insights.businessInsights.potentialIssues.forEach(issue => {
        console.log(`   • ${chalk.yellow(issue)}`);
      });
    }

    if (insights.businessInsights.opportunities.length > 0) {
      console.log(chalk.cyan('\n🎪 Opportunities:'));
      insights.businessInsights.opportunities.forEach(opp => {
        console.log(`   • ${chalk.green(opp)}`);
      });
    }
  }

  private static displayAIInsights(insights: string): void {
    console.log(chalk.bold.blue('\n🤖 AI-Powered Insights'));
    console.log(chalk.dim('─'.repeat(30)));
    
    // Split insights into paragraphs for better formatting
    const paragraphs = insights.split('\n').filter(p => p.trim());
    
    paragraphs.forEach(paragraph => {
      if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('•')) {
        console.log(`   ${paragraph.trim()}`);
      } else if (paragraph.trim().match(/^\d+\./)) {
        console.log(`\n${chalk.cyan(paragraph.trim())}`);
      } else {
        console.log(paragraph.trim());
      }
    });
  }

  private static displayRecommendations(recommendations: string[]): void {
    console.log(chalk.bold.blue('\n📋 Recommendations'));
    console.log(chalk.dim('─'.repeat(30)));

    recommendations.forEach((rec, index) => {
      console.log(`   ${chalk.green(`${index + 1}.`)} ${rec}`);
    });
  }

  private static displayFollowUpQueries(queries: Array<{ query: string; purpose: string; priority: 'high' | 'medium' | 'low' }>): void {
    console.log(chalk.bold.blue('\n🔄 Suggested Follow-up Queries'));
    console.log(chalk.dim('─'.repeat(30)));

    const sortedQueries = queries.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    sortedQueries.forEach((query, index) => {
      const priorityColor = query.priority === 'high' ? chalk.red : query.priority === 'medium' ? chalk.yellow : chalk.cyan;
      const priorityIcon = query.priority === 'high' ? '🔴' : query.priority === 'medium' ? '🟡' : '🔵';
      
      console.log(`\n   ${chalk.cyan(`${index + 1}.`)} ${priorityIcon} ${chalk.bold(query.purpose)} ${priorityColor(`(${query.priority.toUpperCase()} priority)`)}`);
      console.log(`      ${chalk.dim('Query:')} ${chalk.white(query.query)}`);
    });
  }

  private static formatTrend(trend: string): string {
    switch (trend) {
      case 'increasing':
        return chalk.green('📈 Increasing');
      case 'decreasing':
        return chalk.red('📉 Decreasing');
      case 'stable':
        return chalk.blue('➡️  Stable');
      case 'seasonal':
        return chalk.magenta('🔄 Seasonal');
      default:
        return chalk.dim('❓ Unknown');
    }
  }
}
