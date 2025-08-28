/**
 * Formatting Utilities for AppInsights Detective WebUI
 * Uses highlight.js library for proper syntax highlighting
 */
class DataFormatter {
    constructor() {
        // Initialize highlight.js for KQL support
        this.initializeHighlightJS();
    }

    /**
     * Initialize highlight.js and register KQL language if needed
     */
    initializeHighlightJS() {
        // KQL language definition for highlight.js
        if (window.hljs && !window.hljs.getLanguage('kql')) {
            // Define KQL language for highlight.js
            const kqlLanguage = {
                name: 'KQL',
                aliases: ['kusto', 'kql'],
                keywords: {
                    keyword: [
                        'let', 'where', 'summarize', 'project', 'extend', 'join', 'union', 'sort', 'top', 'limit',
                        'count', 'sum', 'avg', 'min', 'max', 'distinct', 'by', 'asc', 'desc', 'and', 'or', 'not',
                        'between', 'contains', 'startswith', 'endswith', 'matches', 'regex', 'in', 'has', 'has_any',
                        'ago', 'now', 'datetime', 'timespan', 'bin', 'floor', 'ceiling', 'round', 'abs', 'sqrt',
                        'take', 'sample', 'evaluate', 'invoke', 'as', 'on', 'kind', 'with', 'parse', 'serialize',
                        'mv-expand', 'mv-apply', 'make-series', 'render', 'fork', 'facet', 'range', 'print', 'order'
                    ].join(' '),
                    built_in: [
                        'requests', 'dependencies', 'exceptions', 'traces', 'pageViews', 'customEvents', 'customMetrics',
                        'availabilityResults', 'browserTimings', 'performanceCounters', 'heartbeat', 'usage',
                        'tostring', 'toint', 'toreal', 'tobool', 'todatetime', 'totimespan',
                        'strlen', 'substring', 'split', 'strcat', 'tolower', 'toupper', 'trim',
                        'parse_json', 'parse_xml', 'parse_url', 'format_datetime', 'format_timespan'
                    ].join(' ')
                },
                contains: [
                    window.hljs.COMMENT('//', '$'),
                    window.hljs.COMMENT('/\\*', '\\*/'),
                    window.hljs.QUOTE_STRING_MODE,
                    window.hljs.APOS_STRING_MODE,
                    window.hljs.C_NUMBER_MODE,
                    {
                        className: 'operator',
                        begin: /[=!<>]=?|[+\-*/%|&]/
                    }
                ]
            };

            // Register the KQL language
            window.hljs.registerLanguage('kql', () => kqlLanguage);
        }
    }

    /**
     * Apply KQL syntax highlighting using highlight.js
     */
    highlightKQL(query) {
        if (!query) return '';

        // Use highlight.js for proper syntax highlighting
        if (window.hljs) {
            try {
                const result = window.hljs.highlight(query, { language: 'kql' });
                return result.value;
            } catch (error) {
                console.warn('KQL highlighting failed, using fallback:', error);
                // Fallback to auto-detection
                const result = window.hljs.highlightAuto(query);
                return result.value;
            }
        }

        // Fallback: just escape HTML if highlight.js is not available
        return this.escapeHtml(query);
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