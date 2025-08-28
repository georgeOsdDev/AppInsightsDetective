/**
 * Formatting Utilities for AppInsights Detective WebUI
 * Provides text formatting, syntax highlighting, and data formatting
 */
class DataFormatter {
    constructor() {
        // KQL keywords for syntax highlighting
        this.kqlKeywords = [
            'let', 'where', 'summarize', 'project', 'extend', 'join', 'union', 'sort', 'top', 'limit',
            'count', 'sum', 'avg', 'min', 'max', 'distinct', 'by', 'asc', 'desc', 'and', 'or', 'not',
            'between', 'contains', 'startswith', 'endswith', 'matches', 'regex', 'in', 'has', 'has_any',
            'ago', 'now', 'datetime', 'timespan', 'bin', 'floor', 'ceiling', 'round', 'abs', 'sqrt',
            'requests', 'dependencies', 'exceptions', 'traces', 'pageViews', 'customEvents', 'customMetrics'
        ];

        this.kqlOperators = [
            '==', '!=', '<', '>', '<=', '>=', '=~', '!~', '=', '+', '-', '*', '/', '%'
        ];

        this.kqlFunctions = [
            'tostring', 'toint', 'toreal', 'tobool', 'todatetime', 'totimespan',
            'strlen', 'substring', 'split', 'strcat', 'tolower', 'toupper', 'trim',
            'parse_json', 'parse_xml', 'parse_url', 'format_datetime', 'format_timespan'
        ];
    }

    /**
     * Apply KQL syntax highlighting
     */
    highlightKQL(query) {
        if (!query) return '';

        let highlighted = this.escapeHtml(query);

        // Highlight keywords
        this.kqlKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            highlighted = highlighted.replace(regex, `<span class="kql-keyword">${keyword}</span>`);
        });

        // Highlight operators
        this.kqlOperators.forEach(op => {
            const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedOp, 'g');
            highlighted = highlighted.replace(regex, `<span class="kql-operator">${op}</span>`);
        });

        // Highlight functions
        this.kqlFunctions.forEach(func => {
            const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
            highlighted = highlighted.replace(regex, `<span class="kql-function">${func}</span>(`);
        });

        // Highlight strings
        highlighted = highlighted.replace(/"([^"\\]|\\.)*"/g, '<span class="kql-string">$&</span>');
        highlighted = highlighted.replace(/'([^'\\]|\\.)*'/g, '<span class="kql-string">$&</span>');

        // Highlight numbers
        highlighted = highlighted.replace(/\b\d+(\.\d+)?\b/g, '<span class="kql-number">$&</span>');

        // Highlight comments
        highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="kql-comment">$&</span>');
        highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, '<span class="kql-comment">$&</span>');

        return highlighted;
    }

    /**
     * Format JSON data for display
     */
    formatJSON(data, indent = 2) {
        try {
            const formatted = JSON.stringify(data, null, indent);
            return this.highlightJSON(formatted);
        } catch (error) {
            return this.escapeHtml(String(data));
        }
    }

    /**
     * Apply JSON syntax highlighting
     */
    highlightJSON(json) {
        return json
            .replace(/(".*?")\s*:/g, '<span class="json-key">$1</span>:')
            .replace(/:\s*(".*?")/g, ': <span class="json-string">$1</span>')
            .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
            .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
    }

    /**
     * Format timestamps for display
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return timestamp;
            
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMinutes < 1) return 'just now';
            if (diffMinutes < 60) return `${diffMinutes}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString();
        } catch (error) {
            return timestamp;
        }
    }

    /**
     * Format duration in a human-readable way
     */
    formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '0ms';

        const ms = milliseconds;
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        if (seconds > 0) {
            return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
        }
        return `${ms}ms`;
    }

    /**
     * Format file sizes
     */
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Truncate text to specified length
     */
    truncateText(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format confidence score
     */
    formatConfidence(confidence) {
        if (typeof confidence !== 'number' || isNaN(confidence)) return '0%';
        return Math.round(confidence * 100) + '%';
    }

    /**
     * Format query execution time
     */
    formatExecutionTime(startTime, endTime) {
        if (!startTime || !endTime) return '';
        
        const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
        return this.formatDuration(duration);
    }

    /**
     * Format error messages for user display
     */
    formatError(error) {
        if (!error) return 'Unknown error';
        
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        if (error.error) return error.error;
        
        return 'An unexpected error occurred';
    }

    /**
     * Format query results count
     */
    formatResultsCount(count, totalTime) {
        if (!count && count !== 0) return '';
        
        let text = count === 1 ? '1 result' : `${count.toLocaleString()} results`;
        
        if (totalTime) {
            text += ` (${this.formatDuration(totalTime)})`;
        }
        
        return text;
    }

    /**
     * Format table name for display
     */
    formatTableName(tableName) {
        if (!tableName) return '';
        
        // Convert camelCase to Title Case
        return tableName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * Format KQL query for better readability
     */
    formatKQLQuery(query) {
        if (!query) return '';
        
        return query
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n');
    }
}

// Global formatter instance
window.dataFormatter = new DataFormatter();