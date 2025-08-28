/**
 * Formatting Utilities for AppInsights Detective WebUI
 * Custom KQL syntax highlighting implementation
 */
class DataFormatter {
    constructor() {
        // No external dependencies needed
    }

    /**
     * Apply KQL syntax highlighting using simple, safe pattern matching
     */
    highlightKQL(query) {
        if (!query) return '';

        // Split the query into tokens to avoid nested replacements
        const tokens = this.tokenizeKQL(query);
        return tokens.map(token => {
            if (token.type === 'text') {
                return this.escapeHtml(token.value);
            } else {
                return `<span class="${token.type}">${this.escapeHtml(token.value)}</span>`;
            }
        }).join('');
    }

    /**
     * Tokenize KQL query for syntax highlighting
     */
    tokenizeKQL(query) {
        const tokens = [];
        let i = 0;
        
        while (i < query.length) {
            const char = query[i];
            
            // Handle comments
            if (query.substr(i, 2) === '//') {
                const endIndex = query.indexOf('\n', i);
                const end = endIndex === -1 ? query.length : endIndex;
                tokens.push({ type: 'kql-comment', value: query.slice(i, end) });
                i = end;
                continue;
            }
            
            if (query.substr(i, 2) === '/*') {
                const endIndex = query.indexOf('*/', i + 2);
                const end = endIndex === -1 ? query.length : endIndex + 2;
                tokens.push({ type: 'kql-comment', value: query.slice(i, end) });
                i = end;
                continue;
            }
            
            // Handle strings
            if (char === '"' || char === "'") {
                const quote = char;
                let j = i + 1;
                while (j < query.length && query[j] !== quote) {
                    if (query[j] === '\\' && j + 1 < query.length) {
                        j += 2; // Skip escaped character
                    } else {
                        j++;
                    }
                }
                if (j < query.length) j++; // Include closing quote
                tokens.push({ type: 'kql-string', value: query.slice(i, j) });
                i = j;
                continue;
            }
            
            // Handle words (keywords, tables, functions)
            if (/[a-zA-Z_]/.test(char)) {
                let j = i;
                while (j < query.length && /[a-zA-Z0-9_-]/.test(query[j])) {
                    j++;
                }
                const word = query.slice(i, j);
                const lowerWord = word.toLowerCase();
                
                let type = 'text';
                if (['let', 'where', 'summarize', 'project', 'extend', 'join', 'union', 'sort', 'top', 'limit', 'count', 'sum', 'avg', 'min', 'max', 'distinct', 'by', 'asc', 'desc', 'and', 'or', 'not', 'between', 'contains', 'startswith', 'endswith', 'matches', 'regex', 'in', 'has', 'has_any', 'ago', 'now', 'datetime', 'timespan', 'bin', 'floor', 'ceiling', 'round', 'abs', 'sqrt', 'take', 'sample', 'evaluate', 'invoke', 'as', 'on', 'kind', 'with', 'parse', 'serialize', 'mv-expand', 'mv-apply', 'make-series', 'render', 'fork', 'facet', 'range', 'print', 'order'].includes(lowerWord)) {
                    type = 'kql-keyword';
                } else if (['requests', 'dependencies', 'exceptions', 'traces', 'pageviews', 'customevents', 'custommetrics', 'availabilityresults', 'browsertimings', 'performancecounters', 'heartbeat', 'usage'].includes(lowerWord)) {
                    type = 'kql-table';
                } else if (['tostring', 'toint', 'toreal', 'tobool', 'todatetime', 'totimespan', 'strlen', 'substring', 'split', 'strcat', 'tolower', 'toupper', 'trim', 'parse_json', 'parse_xml', 'parse_url', 'format_datetime', 'format_timespan'].includes(lowerWord)) {
                    type = 'kql-function';
                }
                
                tokens.push({ type, value: word });
                i = j;
                continue;
            }
            
            // Handle numbers
            if (/\d/.test(char)) {
                let j = i;
                while (j < query.length && /[\d.]/.test(query[j])) {
                    j++;
                }
                tokens.push({ type: 'kql-number', value: query.slice(i, j) });
                i = j;
                continue;
            }
            
            // Handle operators
            if (/[=!<>+\-*\/%|&]/.test(char)) {
                let j = i + 1;
                // Check for two-character operators
                if (j < query.length && /[=]/.test(query[j])) {
                    j++;
                }
                tokens.push({ type: 'kql-operator', value: query.slice(i, j) });
                i = j;
                continue;
            }
            
            // Everything else is text
            tokens.push({ type: 'text', value: char });
            i++;
        }
        
        return tokens;
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