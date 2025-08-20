import chalk from 'chalk';

/**
 * Chart visualization utilities for AppInsights Detective
 * 
 * ⚠️ EXPERIMENTAL FEATURE: Chart visualization in CLI is experimental
 * and may not provide optimal readability for all data types.
 */
export class ChartRenderer {
  /**
   * Display chart with experimental warning
   */
  public static displayChart(data: any[], chartType: 'line' | 'bar' = 'line'): void {
    // Simple ASCII chart display (implementation simplified)
    if (!data || data.length === 0) {
      console.log(chalk.yellow('No data available for chart'));
      return;
    }

    // Display experimental warning
    console.log(chalk.bold.magenta('\n📈 Chart Visualization'));
    console.log(chalk.yellow.bold('⚠️  EXPERIMENTAL FEATURE'));
    console.log(chalk.dim('(ASCII chart - simplified)'));

    if (chartType === 'bar') {
      this.displayBarChart(data);
    } else if (chartType === 'line') {
      this.displayLineChart(data);
    }
  }

  /**
   * Display bar chart (existing functionality)
   */
  private static displayBarChart(data: any[]): void {
    data.slice(0, 10).forEach((item, index) => {
      const value = typeof item === 'object' ? Object.values(item)[1] : item;
      const label = typeof item === 'object' ? Object.values(item)[0] : `Item ${index + 1}`;
      const barLength = Math.min(Math.floor(Number(value) / 100), 50);
      const bar = '█'.repeat(barLength);
      console.log(`${String(label).padEnd(15)} ${chalk.blue(bar)} ${value}`);
    });
  }

  /**
   * Display line chart with time-series support
   */
  private static displayLineChart(data: any[]): void {
    // Normalize data to consistent format
    const normalizedData = this.normalizeChartData(data);
    
    if (normalizedData.length === 0) {
      console.log(chalk.yellow('No valid data points for line chart'));
      return;
    }

    // Detect if this is time-series data
    const isTimeSeries = this.isTimeSeriesData(normalizedData);
    
    if (normalizedData.length <= 20) {
      // For smaller datasets, show detailed ASCII line chart
      this.displayAsciiLineChart(normalizedData, isTimeSeries);
    } else {
      // For larger datasets, show sparkline
      this.displaySparkline(normalizedData, isTimeSeries);
    }
  }

  /**
   * Normalize different data formats to consistent structure
   */
  private static normalizeChartData(data: any[]): Array<{ label: string; value: number; timestamp?: Date }> {
    return data.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        // Extract values from object
        const values = Object.values(item);
        const keys = Object.keys(item);
        
        let label: string;
        let value: number;
        let timestamp: Date | undefined;

        if ('label' in item && 'value' in item) {
          // Format: { label: string, value: number }
          label = String(item.label);
          value = Number(item.value) || 0;
        } else if ('time' in item || 'timestamp' in item) {
          // Format: { time: string, value: number } or similar
          const timeKey = 'time' in item ? 'time' : 'timestamp';
          const valueKey = Object.keys(item).find(k => k !== timeKey && !isNaN(Number(item[k])));
          
          label = String(item[timeKey]);
          value = valueKey ? Number(item[valueKey]) || 0 : 0;
          
          // Try to parse as date
          const parsedTime = new Date(item[timeKey]);
          if (!isNaN(parsedTime.getTime())) {
            timestamp = parsedTime;
          }
        } else if (values.length >= 2) {
          // Generic object with multiple values - use first as label, second as value
          label = String(values[0]);
          value = Number(values[1]) || 0;
          
          // Check if first value might be a timestamp
          try {
            const parsedTime = new Date(String(values[0]));
            if (!isNaN(parsedTime.getTime())) {
              timestamp = parsedTime;
            }
          } catch {
            // Ignore parsing errors
          }
        } else {
          label = `Item ${index + 1}`;
          value = Number(values[0]) || 0;
        }

        return { label, value, timestamp };
      } else {
        // Primitive value
        return {
          label: `Item ${index + 1}`,
          value: Number(item) || 0,
        };
      }
    });
  }

  /**
   * Detect if data represents time-series
   */
  private static isTimeSeriesData(data: Array<{ label: string; value: number; timestamp?: Date }>): boolean {
    // Check if we have timestamp information
    if (data.some(d => d.timestamp)) {
      return true;
    }

    // Check if labels look like timestamps or dates
    const timePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}:\d{2}/, // HH:MM
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, // ISO datetime
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/, // Month names
      /^\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY
    ];

    const timePatternMatches = data.filter(d =>
      timePatterns.some(pattern => pattern.test(d.label))
    );

    return timePatternMatches.length / data.length > 0.5; // More than 50% look like timestamps
  }

  /**
   * Display sparkline using Unicode block characters
   */
  private static displaySparkline(data: Array<{ label: string; value: number; timestamp?: Date }>, isTimeSeries: boolean): void {
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (max === min) {
      // All values are the same
      const sparkline = '▄'.repeat(Math.min(data.length, 50));
      console.log(`Trend: ${chalk.blue(sparkline)} (${data.length} points, constant value: ${max})`);
      return;
    }

    const range = max - min;
    const sparkChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    const sparkline = values.map(value => {
      const normalized = (value - min) / range; // 0-1
      const charIndex = Math.min(Math.floor(normalized * sparkChars.length), sparkChars.length - 1);
      return sparkChars[charIndex];
    }).join('');

    // Show time range if time-series
    let timeInfo = '';
    if (isTimeSeries && data.length > 1) {
      const first = data[0];
      const last = data[data.length - 1];
      
      if (first.timestamp && last.timestamp) {
        timeInfo = ` (${this.formatTimeLabel(first.timestamp)} → ${this.formatTimeLabel(last.timestamp)})`;
      } else {
        timeInfo = ` (${first.label} → ${last.label})`;
      }
    }

    console.log(`Trend: ${chalk.blue(sparkline)} (${data.length} points)${timeInfo}`);
    console.log(`Range: ${chalk.dim(`${min.toLocaleString()} - ${max.toLocaleString()}`)}`);
  }

  /**
   * Display detailed ASCII line chart
   */
  private static displayAsciiLineChart(data: Array<{ label: string; value: number; timestamp?: Date }>, isTimeSeries: boolean): void {
    if (data.length < 2) {
      console.log(chalk.yellow('Need at least 2 data points for line chart'));
      return;
    }

    // Sort data by timestamp if time-series
    let sortedData = [...data];
    if (isTimeSeries) {
      sortedData = data
        .filter(d => d.timestamp)
        .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
      
      if (sortedData.length === 0) {
        sortedData = [...data]; // Fallback to original order
      }
    }

    const values = sortedData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) {
      // All values are the same - show flat line
      const flatLine = '─'.repeat(Math.min(sortedData.length * 2, 40));
      console.log(`${max.toLocaleString().padStart(8)} ${chalk.blue(flatLine)}`);
      return;
    }

    const chartHeight = 8; // Number of rows for the chart
    const chartWidth = Math.min(sortedData.length * 2, 50); // Width of chart area
    const range = max - min;

    // Create chart grid
    const rows: string[][] = Array(chartHeight).fill(0).map(() => Array(chartWidth).fill(' '));

    // Plot points and lines
    for (let i = 0; i < sortedData.length && i * 2 < chartWidth; i++) {
      const value = sortedData[i].value;
      const x = i * 2;
      const y = chartHeight - 1 - Math.floor(((value - min) / range) * (chartHeight - 1));
      
      // Plot point
      rows[y][x] = '●';
      
      // Draw line to next point
      if (i < sortedData.length - 1 && (i + 1) * 2 < chartWidth) {
        const nextValue = sortedData[i + 1].value;
        const nextY = chartHeight - 1 - Math.floor(((nextValue - min) / range) * (chartHeight - 1));
        
        // Simple line drawing - horizontal or diagonal
        if (y === nextY) {
          // Horizontal line
          rows[y][x + 1] = '─';
        } else if (y < nextY) {
          // Going down
          rows[y][x + 1] = '╮';
          for (let lineY = y + 1; lineY < nextY; lineY++) {
            rows[lineY][x + 1] = '│';
          }
          rows[nextY][x + 1] = '╰';
        } else {
          // Going up
          rows[y][x + 1] = '╭';
          for (let lineY = nextY + 1; lineY < y; lineY++) {
            rows[lineY][x + 1] = '│';
          }
          rows[nextY][x + 1] = '╯';
        }
      }
    }

    // Display chart with Y-axis labels
    for (let y = 0; y < chartHeight; y++) {
      const valueAtRow = max - ((y / (chartHeight - 1)) * range);
      const label = valueAtRow.toLocaleString().padStart(8);
      const rowString = rows[y].join('');
      console.log(`${chalk.dim(label)} ${chalk.blue(rowString)}`);
    }

    // Display X-axis labels if time-series
    if (isTimeSeries && sortedData.length > 1) {
      const timeLabels = this.generateTimeAxisLabels(sortedData, chartWidth);
      if (timeLabels.length > 0) {
        console.log(' '.repeat(9) + chalk.dim(timeLabels));
      }
    }
  }

  /**
   * Generate time axis labels
   */
  private static generateTimeAxisLabels(data: Array<{ label: string; value: number; timestamp?: Date }>, width: number): string {
    const maxLabels = Math.floor(width / 8); // Space labels apart
    const step = Math.max(1, Math.floor(data.length / maxLabels));
    
    let labels: string[] = [];
    for (let i = 0; i < data.length; i += step) {
      const item = data[i];
      let timeLabel: string;
      
      if (item.timestamp) {
        timeLabel = this.formatTimeLabel(item.timestamp);
      } else {
        // Try to extract time from label
        const timeMatch = item.label.match(/(\d{2}:\d{2})/);
        if (timeMatch) {
          timeLabel = timeMatch[1];
        } else if (item.label.match(/\d{4}-\d{2}-\d{2}/)) {
          timeLabel = item.label.substring(0, 10); // Extract date part
        } else {
          timeLabel = item.label.substring(0, 6); // Truncate long labels
        }
      }
      
      labels.push(timeLabel.padEnd(8));
    }
    
    return labels.join('').substring(0, width);
  }

  /**
   * Format timestamp for display
   */
  private static formatTimeLabel(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);

    if (diffDays < 1) {
      // Same day - show time
      return timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    } else if (diffDays < 7) {
      // This week - show day and time
      return timestamp.toLocaleDateString('en-US', { 
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      // Older - show date
      return timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  }
}