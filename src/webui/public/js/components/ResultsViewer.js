/**
 * Results Viewer Component for AppInsights Detective WebUI
 * Handles display of query results in multiple formats
 */
class ResultsViewer {
    constructor() {
        this.currentData = null;
        this.currentView = 'table';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.resultsSection = document.getElementById('results-section');
        this.resultsInfo = document.getElementById('results-info');
        this.tableContainer = document.getElementById('table-container');
        this.chartContainer = document.getElementById('chart-container');
        this.rawJsonElement = document.getElementById('raw-json');
        
        // View tabs
        this.tableTab = document.getElementById('table-tab');
        this.chartTab = document.getElementById('chart-tab');
        this.rawTab = document.getElementById('raw-tab');
        
        // View containers
        this.tableView = document.getElementById('table-view');
        this.chartView = document.getElementById('chart-view');
        this.rawView = document.getElementById('raw-view');
        
        // Export buttons
        this.exportJsonBtn = document.getElementById('export-json-btn');
        this.exportCsvBtn = document.getElementById('export-csv-btn');
    }

    bindEvents() {
        // Tab switching
        this.tableTab.addEventListener('click', () => this.switchView('table'));
        this.chartTab.addEventListener('click', () => this.switchView('chart'));
        this.rawTab.addEventListener('click', () => this.switchView('raw'));

        // Export functions
        this.exportJsonBtn.addEventListener('click', () => this.exportAsJson());
        this.exportCsvBtn.addEventListener('click', () => this.exportAsCsv());
    }

    /**
     * Display query results
     */
    displayResults(response) {
        this.currentData = response;
        
        // Update results info
        this.updateResultsInfo(response);
        
        // Show results section
        this.resultsSection.classList.remove('hidden');
        
        // Render in current view
        this.renderCurrentView();

        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    updateResultsInfo(response) {
        if (!this.resultsInfo) return;

        // Extract data from nested result structure
        const resultData = response.result?.result || response.result || response;
        const tables = resultData.tables || [];
        const totalRows = tables.reduce((sum, table) => sum + (table.rows?.length || 0), 0);
        
        const count = totalRows;
        const executionTime = response.executionTime || response.result?.executionTime || 0;
        const formattedCount = window.dataFormatter.formatResultsCount(count, executionTime);
        
        let statusInfo = '';
        if (response.confidence !== undefined) {
            const confidence = window.dataFormatter.formatConfidence(response.confidence);
            statusInfo = ` • Confidence: ${confidence}`;
        }

        this.resultsInfo.textContent = formattedCount + statusInfo;
    }

    switchView(viewType) {
        this.currentView = viewType;
        
        // Update tab states
        document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
        document.getElementById(`${viewType}-tab`).classList.add('active');
        
        // Update view states
        document.querySelectorAll('.results-view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewType}-view`).classList.add('active');
        
        // Render content for the new view
        this.renderCurrentView();
    }

    renderCurrentView() {
        if (!this.currentData) return;

        switch (this.currentView) {
            case 'table':
                this.renderTableView();
                break;
            case 'chart':
                this.renderChartView();
                break;
            case 'raw':
                this.renderRawView();
                break;
        }
    }

    renderTableView() {
        // Extract data from nested result structure
        const resultData = this.currentData.result?.result || this.currentData.result || this.currentData;
        const tables = resultData.tables || [];
        
        if (!tables.length || tables.every(table => !table.rows || table.rows.length === 0)) {
            this.tableContainer.innerHTML = '<div class="empty-state">No data to display</div>';
            return;
        }

        // For now, render the first table. In the future, we might want to handle multiple tables
        const primaryTable = tables[0];
        const tableData = primaryTable.rows.map(row => {
            const rowObj = {};
            primaryTable.columns.forEach((column, index) => {
                rowObj[column.name] = row[index];
            });
            return rowObj;
        });

        window.chartRenderer.renderTable(this.tableContainer, tableData);
    }

    renderChartView() {
        // Extract data from nested result structure
        const resultData = this.currentData.result?.result || this.currentData.result || this.currentData;
        const tables = resultData.tables || [];
        
        if (!tables.length || tables.every(table => !table.rows || table.rows.length === 0)) {
            this.chartContainer.innerHTML = '<div class="empty-state">No data available for charting</div>';
            return;
        }

        // Convert first table to flat data structure for charting
        const primaryTable = tables[0];
        const tableData = primaryTable.rows.map(row => {
            const rowObj = {};
            primaryTable.columns.forEach((column, index) => {
                rowObj[column.name] = row[index];
            });
            return rowObj;
        });

        // Get chart suggestions and render the best one
        const suggestions = window.chartRenderer.getChartSuggestions(tableData);
        const chartType = suggestions[0] === 'table' ? suggestions[1] || 'bar' : suggestions[0];
        
        if (chartType === 'table' || !chartType) {
            this.chartContainer.innerHTML = `
                <div class="chart-message">
                    <p>This data is better suited for table view.</p>
                    <button onclick="window.resultsViewer.switchView('table')" class="btn-secondary">View as Table</button>
                </div>
            `;
            return;
        }

        window.chartRenderer.renderChart(this.chartContainer, tableData, {
            type: chartType,
            title: primaryTable.name || 'Query Results'
        });
    }

    renderRawView() {
        if (!this.currentData) {
            this.rawJsonElement.textContent = 'No data to display';
            return;
        }

        // Show the complete response data with proper structure
        this.rawJsonElement.innerHTML = window.dataFormatter.formatJSON(this.currentData);
    }

    /**
     * Export results as JSON
     */
    exportAsJson() {
        // Extract data from nested result structure
        const resultData = this.currentData?.result?.result || this.currentData?.result || this.currentData;
        const tables = resultData?.tables || [];
        
        if (!tables.length) {
            alert('No data to export');
            return;
        }

        // Convert tables to more user-friendly format
        const exportData = tables.map(table => ({
            name: table.name,
            columns: table.columns,
            rows: table.rows,
            totalRows: table.rows?.length || 0
        }));

        const dataStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(dataStr, 'query-results.json', 'application/json');
    }

    /**
     * Export results as CSV
     */
    exportAsCsv() {
        // Extract data from nested result structure
        const resultData = this.currentData?.result?.result || this.currentData?.result || this.currentData;
        const tables = resultData?.tables || [];
        
        if (!tables.length || !tables[0].rows || tables[0].rows.length === 0) {
            alert('No data to export');
            return;
        }

        // Use the first table for CSV export
        const primaryTable = tables[0];
        const headers = primaryTable.columns.map(col => col.name);
        
        let csv = headers.join(',') + '\n';
        
        primaryTable.rows.forEach(row => {
            const values = row.map(value => {
                if (value === null || value === undefined) return '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        this.downloadFile(csv, 'query-results.csv', 'text/csv');
    }

    /**
     * Download file helper
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Hide results section
     */
    hide() {
        this.resultsSection.classList.add('hidden');
        this.currentData = null;
    }

    /**
     * Check if results are currently visible
     */
    isVisible() {
        return !this.resultsSection.classList.contains('hidden');
    }

    /**
     * Get current results data
     */
    getCurrentData() {
        return this.currentData;
    }
}

// Global results viewer instance
window.resultsViewer = new ResultsViewer();