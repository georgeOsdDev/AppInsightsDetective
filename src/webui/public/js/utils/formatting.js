/**
 * Formatting Utilities for AppInsights Detective WebUI
 * Provides text formatting, syntax highlighting, and data formatting
 */
class DataFormatter {
    constructor() {
        // Initialize improved KQL highlighting
        this.initializeKQLTokens();
    }

    /**
     * Initialize KQL syntax tokens for better highlighting
     */
    initializeKQLTokens() {
        this.kqlTokens = {
            keywords: new Set([
                'let', 'where', 'summarize', 'project', 'extend', 'join', 'union', 'sort', 'top', 'limit',
                'count', 'sum', 'avg', 'min', 'max', 'distinct', 'by', 'asc', 'desc', 'and', 'or', 'not',
                'between', 'contains', 'startswith', 'endswith', 'matches', 'regex', 'in', 'has', 'has_any',
                'ago', 'now', 'datetime', 'timespan', 'bin', 'floor', 'ceiling', 'round', 'abs', 'sqrt',
                'take', 'sample', 'evaluate', 'invoke', 'as', 'on', 'kind', 'with', 'parse', 'serialize',
                'mv-expand', 'mv-apply', 'make-series', 'render', 'fork', 'facet', 'range', 'print', 'order'
            ]),
            tables: new Set([
                'requests', 'dependencies', 'exceptions', 'traces', 'pageViews', 'customEvents', 'customMetrics',
                'availabilityResults', 'browserTimings', 'performanceCounters', 'heartbeat', 'usage'
            ]),
            operators: [
                '==', '!=', '<=', '>=', '<>', '<', '>', '=~', '!~', '+', '-', '*', '/', '%', '|'
            ],
            functions: new Set([
                'tostring', 'toint', 'toreal', 'tobool', 'todatetime', 'totimespan',
                'strlen', 'substring', 'split', 'strcat', 'tolower', 'toupper', 'trim',
                'parse_json', 'parse_xml', 'parse_url', 'format_datetime', 'format_timespan'
            ])
        };
    }

    /**
     * Apply KQL syntax highlighting with proper tokenization to avoid HTML escaping issues
     */
    highlightKQL(query) {
        if (!query) return '';

        // Simple but robust tokenization approach
        // This avoids the HTML escaping conflicts by processing tokens individually
        
        // Split the query into tokens while preserving whitespace and structure
        const tokens = this.tokenizeKQL(query);
        
        return tokens.map(token => {
            if (token.type === 'whitespace' || token.type === 'newline') {
                return token.value;
            }
            
            // Escape HTML for the token content
            const escapedValue = this.escapeHtml(token.value);
            
            // Apply appropriate styling based on token type
            switch (token.type) {
                case 'keyword':
                    return `<span class="hljs-keyword">${escapedValue}</span>`;
                case 'table':
                    return `<span class="hljs-built_in">${escapedValue}</span>`;
                case 'function':
                    return `<span class="hljs-function">${escapedValue}</span>`;
                case 'operator':
                    return `<span class="hljs-operator">${escapedValue}</span>`;
                case 'string':
                    return `<span class="hljs-string">${escapedValue}</span>`;
                case 'number':
                    return `<span class="hljs-number">${escapedValue}</span>`;
                case 'comment':
                    return `<span class="hljs-comment">${escapedValue}</span>`;
                default:
                    return escapedValue;
            }
        }).join('');
    }

    /**
     * Tokenize KQL query into meaningful parts
     */
    tokenizeKQL(query) {
        const tokens = [];
        let i = 0;
        
        while (i < query.length) {
            const char = query[i];
            
            // Handle whitespace
            if (/\s/.test(char)) {
                let whitespace = '';
                while (i < query.length && /\s/.test(query[i])) {
                    whitespace += query[i];
                    i++;
                }
                tokens.push({
                    type: whitespace.includes('\n') ? 'newline' : 'whitespace',
                    value: whitespace
                });
                continue;
            }
            
            // Handle strings
            if (char === '"' || char === "'") {
                const quote = char;
                let string = quote;
                i++;
                
                while (i < query.length) {
                    const current = query[i];
                    string += current;
                    i++;
                    
                    if (current === quote) {
                        // Check if it's escaped
                        let backslashCount = 0;
                        let j = i - 2;
                        while (j >= 0 && query[j] === '\\') {
                            backslashCount++;
                            j--;
                        }
                        
                        // If even number of backslashes (including 0), the quote is not escaped
                        if (backslashCount % 2 === 0) {
                            break;
                        }
                    }
                }
                
                tokens.push({ type: 'string', value: string });
                continue;
            }
            
            // Handle comments
            if (char === '/' && i + 1 < query.length) {
                if (query[i + 1] === '/') {
                    // Single line comment
                    let comment = '';
                    while (i < query.length && query[i] !== '\n') {
                        comment += query[i];
                        i++;
                    }
                    tokens.push({ type: 'comment', value: comment });
                    continue;
                } else if (query[i + 1] === '*') {
                    // Multi-line comment
                    let comment = '/*';
                    i += 2;
                    
                    while (i < query.length - 1) {
                        comment += query[i];
                        if (query[i] === '*' && query[i + 1] === '/') {
                            comment += '/';
                            i += 2;
                            break;
                        }
                        i++;
                    }
                    
                    tokens.push({ type: 'comment', value: comment });
                    continue;
                }
            }
            
            // Handle operators (multi-character first)
            const twoCharOp = query.substr(i, 2);
            const multiCharOps = ['==', '!=', '<=', '>=', '<>', '=~', '!~'];
            if (multiCharOps.includes(twoCharOp)) {
                tokens.push({ type: 'operator', value: twoCharOp });
                i += 2;
                continue;
            }
            
            // Single character operators
            if ('+-*/%|<>=()[]{},.'.includes(char)) {
                tokens.push({ type: 'operator', value: char });
                i++;
                continue;
            }
            
            // Handle numbers
            if (/\d/.test(char)) {
                let number = '';
                while (i < query.length && /[\d.eE+-]/.test(query[i])) {
                    number += query[i];
                    i++;
                }
                tokens.push({ type: 'number', value: number });
                continue;
            }
            
            // Handle identifiers (keywords, functions, table names, etc.)
            if (/[a-zA-Z_]/.test(char)) {
                let identifier = '';
                while (i < query.length && /[a-zA-Z0-9_-]/.test(query[i])) {
                    identifier += query[i];
                    i++;
                }
                
                // Classify the identifier
                const lowerIdentifier = identifier.toLowerCase();
                let tokenType = 'identifier';
                
                if (this.kqlTokens.keywords.has(lowerIdentifier)) {
                    tokenType = 'keyword';
                } else if (this.kqlTokens.tables.has(identifier)) {
                    tokenType = 'table';
                } else if (this.kqlTokens.functions.has(lowerIdentifier)) {
                    // Check if it's followed by parentheses to confirm it's a function
                    let j = i;
                    while (j < query.length && /\s/.test(query[j])) j++;
                    if (j < query.length && query[j] === '(') {
                        tokenType = 'function';
                    }
                }
                
                tokens.push({ type: tokenType, value: identifier });
                continue;
            }
            
            // Default: treat as regular character
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