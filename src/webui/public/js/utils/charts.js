/**
 * Chart Rendering Utilities for AppInsights Detective WebUI
 * Provides data visualization functionality
 */
class ChartRenderer {
    constructor() {
        this.supportedChartTypes = ['bar', 'line', 'pie', 'table', 'metrics'];
        this.defaultColors = [
            '#007acc', '#28a745', '#dc3545', '#ffc107', '#6f42c1',
            '#e83e8c', '#fd7e14', '#20c997', '#6610f2', '#17a2b8'
        ];
    }

    /**
     * Render a chart based on data and configuration
     */
    renderChart(container, data, config = {}) {
        if (!container || !data || !data.length) {
            this.showEmptyState(container);
            return;
        }

        const chartType = this.detectOptimalChartType(data, config.type);
        
        switch (chartType) {
            case 'metrics':
                return this.renderMetricsChart(container, data, config);
            case 'bar':
                return this.renderBarChart(container, data, config);
            case 'line':
                return this.renderLineChart(container, data, config);
            case 'pie':
                return this.renderPieChart(container, data, config);
            default:
                return this.renderTable(container, data, config);
        }
    }

    /**
     * Detect optimal chart type based on data structure
     */
    detectOptimalChartType(data, preferredType) {
        if (preferredType && this.supportedChartTypes.includes(preferredType)) {
            return preferredType;
        }

        const columns = Object.keys(data[0] || {});
        const numericColumns = columns.filter(col => 
            data.some(row => typeof row[col] === 'number' && !isNaN(row[col]))
        );
        const timeColumns = columns.filter(col => 
            col.toLowerCase().includes('time') || col.toLowerCase().includes('date')
        );

        // Single numeric value - metrics
        if (data.length === 1 && numericColumns.length >= 1) {
            return 'metrics';
        }

        // Time series data - line chart
        if (timeColumns.length > 0 && numericColumns.length > 0) {
            return 'line';
        }

        // Categorical data with counts - bar chart
        if (numericColumns.length >= 1 && columns.length <= 4) {
            return 'bar';
        }

        // Small categorical dataset - pie chart
        if (data.length <= 10 && numericColumns.length === 1) {
            return 'pie';
        }

        // Default to table for complex data
        return 'table';
    }

    /**
     * Render metrics/KPI style chart
     */
    renderMetricsChart(container, data, config) {
        const columns = Object.keys(data[0] || {});
        const numericColumns = columns.filter(col => 
            data.some(row => typeof row[col] === 'number' && !isNaN(row[col]))
        );

        const html = `
            <div class="metrics-container">
                ${numericColumns.map(col => {
                    const value = data[0][col];
                    const formattedValue = this.formatNumber(value);
                    return `
                        <div class="metric-card">
                            <div class="metric-value">${formattedValue}</div>
                            <div class="metric-label">${col}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render bar chart using CSS
     */
    renderBarChart(container, data, config) {
        const columns = Object.keys(data[0] || {});
        const labelColumn = columns.find(col => typeof data[0][col] === 'string') || columns[0];
        const valueColumn = columns.find(col => typeof data[0][col] === 'number') || columns[1];

        if (!valueColumn) {
            this.showEmptyState(container);
            return;
        }

        const maxValue = Math.max(...data.map(row => row[valueColumn] || 0));
        
        const html = `
            <div class="chart-container">
                <div class="chart-title">${config.title || `${valueColumn} by ${labelColumn}`}</div>
                <div class="bar-chart">
                    ${data.slice(0, 20).map((row, index) => {
                        const value = row[valueColumn] || 0;
                        const label = row[labelColumn] || `Item ${index + 1}`;
                        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                        const color = this.defaultColors[index % this.defaultColors.length];
                        
                        return `
                            <div class="bar-item">
                                <div class="bar-label" title="${label}">${label}</div>
                                <div class="bar-container">
                                    <div class="bar-fill" style="width: ${percentage}%; background-color: ${color}"></div>
                                    <div class="bar-value">${this.formatNumber(value)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render line chart for time series data
     */
    renderLineChart(container, data, config) {
        const columns = Object.keys(data[0] || {});
        const timeColumn = columns.find(col => 
            col.toLowerCase().includes('time') || col.toLowerCase().includes('date')
        ) || columns[0];
        const valueColumn = columns.find(col => typeof data[0][col] === 'number') || columns[1];

        if (!valueColumn) {
            this.showEmptyState(container);
            return;
        }

        const sortedData = data.sort((a, b) => new Date(a[timeColumn]) - new Date(b[timeColumn]));
        const maxValue = Math.max(...sortedData.map(row => row[valueColumn] || 0));
        const minValue = Math.min(...sortedData.map(row => row[valueColumn] || 0));
        const range = maxValue - minValue || 1;

        const points = sortedData.map((row, index) => {
            const value = row[valueColumn] || 0;
            const x = (index / (sortedData.length - 1)) * 100;
            const y = 100 - ((value - minValue) / range) * 100;
            return `${x},${y}`;
        }).join(' ');

        const html = `
            <div class="chart-container">
                <div class="chart-title">${config.title || `${valueColumn} over time`}</div>
                <div class="line-chart">
                    <svg viewBox="0 0 100 100" class="chart-svg">
                        <polyline
                            fill="none"
                            stroke="#007acc"
                            stroke-width="2"
                            points="${points}"
                        />
                        ${sortedData.map((row, index) => {
                            const value = row[valueColumn] || 0;
                            const x = (index / (sortedData.length - 1)) * 100;
                            const y = 100 - ((value - minValue) / range) * 100;
                            return `<circle cx="${x}" cy="${y}" r="2" fill="#007acc" />`;
                        }).join('')}
                    </svg>
                    <div class="chart-legend">
                        <span class="chart-min">${this.formatNumber(minValue)}</span>
                        <span class="chart-max">${this.formatNumber(maxValue)}</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render pie chart for categorical data
     */
    renderPieChart(container, data, config) {
        const columns = Object.keys(data[0] || {});
        const labelColumn = columns.find(col => typeof data[0][col] === 'string') || columns[0];
        const valueColumn = columns.find(col => typeof data[0][col] === 'number') || columns[1];

        if (!valueColumn) {
            this.showEmptyState(container);
            return;
        }

        const total = data.reduce((sum, row) => sum + (row[valueColumn] || 0), 0);
        let currentAngle = 0;

        const slices = data.slice(0, 8).map((row, index) => {
            const value = row[valueColumn] || 0;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            const angle = (value / total) * 360;
            const color = this.defaultColors[index % this.defaultColors.length];
            
            const slice = {
                label: row[labelColumn] || `Item ${index + 1}`,
                value,
                percentage,
                color,
                startAngle: currentAngle,
                endAngle: currentAngle + angle
            };
            
            currentAngle += angle;
            return slice;
        });

        const html = `
            <div class="chart-container">
                <div class="chart-title">${config.title || `${valueColumn} distribution`}</div>
                <div class="pie-chart">
                    <svg viewBox="0 0 200 200" class="pie-svg">
                        ${slices.map(slice => {
                            const x1 = 100 + 80 * Math.cos((slice.startAngle - 90) * Math.PI / 180);
                            const y1 = 100 + 80 * Math.sin((slice.startAngle - 90) * Math.PI / 180);
                            const x2 = 100 + 80 * Math.cos((slice.endAngle - 90) * Math.PI / 180);
                            const y2 = 100 + 80 * Math.sin((slice.endAngle - 90) * Math.PI / 180);
                            const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                            
                            return `
                                <path d="M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z"
                                      fill="${slice.color}"
                                      title="${slice.label}: ${this.formatNumber(slice.value)} (${slice.percentage.toFixed(1)}%)" />
                            `;
                        }).join('')}
                    </svg>
                    <div class="pie-legend">
                        ${slices.map(slice => `
                            <div class="legend-item">
                                <div class="legend-color" style="background-color: ${slice.color}"></div>
                                <div class="legend-text">
                                    <span class="legend-label">${slice.label}</span>
                                    <span class="legend-value">${this.formatNumber(slice.value)} (${slice.percentage.toFixed(1)}%)</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render data as a table
     */
    renderTable(container, data, config) {
        if (!data || data.length === 0) {
            this.showEmptyState(container);
            return;
        }

        const columns = Object.keys(data[0]);
        
        const html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 1000).map(row => `
                            <tr>
                                ${columns.map(col => {
                                    const value = row[col];
                                    const formattedValue = this.formatCellValue(value);
                                    return `<td title="${formattedValue}">${formattedValue}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.length > 1000 ? `<div class="table-note">Showing first 1,000 of ${data.length} rows</div>` : ''}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Format numbers for display
     */
    formatNumber(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return value?.toString() || '';
        }

        if (value === 0) return '0';
        if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B';
        if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
        if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
        if (value % 1 === 0) return value.toString();
        return value.toFixed(2);
    }

    /**
     * Format cell values for table display
     */
    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (typeof value === 'number') {
            return this.formatNumber(value);
        }
        
        if (typeof value === 'boolean') {
            return value.toString();
        }
        
        if (typeof value === 'string' && value.length > 100) {
            return value.substring(0, 100) + '...';
        }
        
        return value.toString();
    }

    /**
     * Show empty state when no data available
     */
    showEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">No Data Available</div>
                <div class="empty-description">No data to display for the current query</div>
            </div>
        `;
    }

    /**
     * Get chart configuration suggestions based on data
     */
    getChartSuggestions(data) {
        if (!data || data.length === 0) {
            return [];
        }

        const columns = Object.keys(data[0]);
        const numericColumns = columns.filter(col => 
            data.some(row => typeof row[col] === 'number' && !isNaN(row[col]))
        );
        const timeColumns = columns.filter(col => 
            col.toLowerCase().includes('time') || col.toLowerCase().includes('date')
        );

        const suggestions = ['table']; // Always suggest table

        if (data.length === 1 && numericColumns.length >= 1) {
            suggestions.unshift('metrics');
        }

        if (timeColumns.length > 0 && numericColumns.length > 0) {
            suggestions.unshift('line');
        }

        if (numericColumns.length >= 1 && data.length <= 50) {
            suggestions.push('bar');
        }

        if (data.length <= 10 && numericColumns.length === 1) {
            suggestions.push('pie');
        }

        return [...new Set(suggestions)]; // Remove duplicates
    }
}

// Global chart renderer instance
window.chartRenderer = new ChartRenderer();