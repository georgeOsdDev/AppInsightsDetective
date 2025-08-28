/**
 * History Panel Component for AppInsights Detective WebUI
 * Handles query history display and management
 */
class HistoryPanel {
    constructor() {
        this.history = [];
        this.filteredHistory = [];
        this.searchTerm = '';
        
        this.initializeElements();
        this.bindEvents();
        this.loadHistory();
    }

    initializeElements() {
        this.panel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.clearHistoryBtn = document.getElementById('clear-history-btn');
    }

    bindEvents() {
        // Clear history button
        this.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all query history?')) {
                this.clearHistory();
            }
        });
    }

    /**
     * Load history from localStorage and API
     */
    loadHistory() {
        try {
            // Load from localStorage first
            const localHistory = JSON.parse(localStorage.getItem('aidx-history') || '[]');
            this.history = localHistory;
            this.filteredHistory = [...this.history];
            this.renderHistory();
            
            // Then try to load from API if session exists
            this.loadHistoryFromAPI();
        } catch (error) {
            console.error('Failed to load history from localStorage:', error);
            this.history = [];
            this.filteredHistory = [];
            this.renderHistory();
        }
    }

    async loadHistoryFromAPI() {
        try {
            if (window.apiClient.sessionId) {
                const response = await window.apiClient.getHistory();
                
                if (response.history) {
                    // Merge with local history, avoiding duplicates
                    const serverHistory = response.history.map(item => ({
                        ...item,
                        source: 'server'
                    }));
                    
                    const mergedHistory = [...this.history];
                    serverHistory.forEach(serverItem => {
                        const exists = mergedHistory.some(localItem => 
                            localItem.query === serverItem.query && 
                            localItem.timestamp === serverItem.timestamp
                        );
                        if (!exists) {
                            mergedHistory.unshift(serverItem);
                        }
                    });
                    
                    this.history = mergedHistory.slice(0, 100); // Keep only recent 100 items
                    this.filteredHistory = [...this.history];
                    this.renderHistory();
                    this.saveToLocalStorage();
                }
            }
        } catch (error) {
            console.warn('Failed to load history from API:', error);
        }
    }

    /**
     * Add new history item
     */
    addHistoryItem(item) {
        // Add to beginning of history
        this.history.unshift({
            ...item,
            source: 'local'
        });
        
        // Keep only recent 100 items
        this.history = this.history.slice(0, 100);
        this.filteredHistory = [...this.history];
        
        this.saveToLocalStorage();
        this.renderHistory();
    }

    /**
     * Save history to localStorage
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem('aidx-history', JSON.stringify(this.history));
        } catch (error) {
            console.error('Failed to save history to localStorage:', error);
        }
    }

    /**
     * Clear all history
     */
    clearHistory() {
        this.history = [];
        this.filteredHistory = [];
        this.saveToLocalStorage();
        this.renderHistory();
    }

    /**
     * Filter history based on search term
     */
    filterHistory(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase();
        
        if (!this.searchTerm) {
            this.filteredHistory = [...this.history];
        } else {
            this.filteredHistory = this.history.filter(item => 
                (item.userInput && item.userInput.toLowerCase().includes(this.searchTerm)) ||
                (item.query && item.query.toLowerCase().includes(this.searchTerm))
            );
        }
        
        this.renderHistory();
    }

    /**
     * Render history list
     */
    renderHistory() {
        if (!this.historyList) return;

        if (this.filteredHistory.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🕐</div>
                    <div class="empty-title">No History</div>
                    <div class="empty-description">
                        ${this.searchTerm ? 'No queries match your search' : 'Your query history will appear here'}
                    </div>
                </div>
            `;
            return;
        }

        const historyHTML = this.filteredHistory.map(item => `
            <div class="history-item ${item.success === false ? 'failed' : ''}" data-history-id="${item.id}">
                <div class="history-header">
                    <div class="history-timestamp">
                        ${window.dataFormatter.formatTimestamp(item.timestamp)}
                    </div>
                    <div class="history-mode-badge mode-${item.mode}">
                        ${item.mode?.toUpperCase() || 'UNKNOWN'}
                    </div>
                    ${item.success === false ? '<div class="history-status error">Failed</div>' : ''}
                </div>
                
                <div class="history-content">
                    ${item.userInput ? `
                        <div class="history-user-input">
                            <div class="history-label">Query:</div>
                            <div class="history-text">${window.dataFormatter.truncateText(item.userInput, 150)}</div>
                        </div>
                    ` : ''}
                    
                    <div class="history-kql">
                        <div class="history-label">KQL:</div>
                        <div class="history-code">${window.dataFormatter.truncateText(item.query, 200)}</div>
                    </div>
                    
                    <div class="history-metadata">
                        ${item.resultCount !== undefined ? `
                            <span class="history-meta-item">
                                ${item.resultCount} ${item.resultCount === 1 ? 'result' : 'results'}
                            </span>
                        ` : ''}
                        
                        ${item.executionTime ? `
                            <span class="history-meta-item">
                                ${window.dataFormatter.formatDuration(item.executionTime)}
                            </span>
                        ` : ''}
                        
                        ${item.confidence !== undefined ? `
                            <span class="history-meta-item">
                                Confidence: ${window.dataFormatter.formatConfidence(item.confidence)}
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="history-actions">
                    <button class="btn-icon rerun-btn" data-history-id="${item.id}" title="Rerun Query">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z"/>
                        </svg>
                    </button>
                    <button class="btn-icon copy-btn" data-history-id="${item.id}" title="Copy Query">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete-btn" data-history-id="${item.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        this.historyList.innerHTML = historyHTML;
        
        // Bind history item events
        this.bindHistoryEvents();
    }

    bindHistoryEvents() {
        // Rerun buttons
        document.querySelectorAll('.rerun-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const historyId = parseInt(e.target.closest('[data-history-id]').dataset.historyId);
                this.rerunQuery(historyId);
            });
        });

        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const historyId = parseInt(e.target.closest('[data-history-id]').dataset.historyId);
                this.copyQuery(historyId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const historyId = parseInt(e.target.closest('[data-history-id]').dataset.historyId);
                this.deleteHistoryItem(historyId);
            });
        });

        // Click on history item to view details
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger on button clicks
                if (e.target.closest('.history-actions')) return;
                
                const historyId = parseInt(item.dataset.historyId);
                this.viewHistoryDetails(historyId);
            });
        });
    }

    /**
     * Rerun a query from history
     */
    async rerunQuery(historyId) {
        const item = this.history.find(h => h.id === historyId);
        if (!item) return;

        // Switch to query panel
        window.app.switchPanel('query');
        
        // Set the mode and input
        window.queryEditor.setMode(item.mode || 'smart');
        
        if (item.userInput) {
            window.queryEditor.setQueryText(item.userInput);
        } else {
            window.queryEditor.setQueryText(item.query);
        }
        
        // Auto-execute if it was a direct query
        if (!item.userInput && item.query) {
            setTimeout(() => {
                window.queryEditor.executeQuery();
            }, 500);
        }
    }

    /**
     * Copy query from history
     */
    copyQuery(historyId) {
        const item = this.history.find(h => h.id === historyId);
        if (!item) return;

        const textToCopy = item.userInput || item.query;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showSuccess('Query copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Query copied to clipboard!');
        });
    }

    /**
     * Delete history item
     */
    deleteHistoryItem(historyId) {
        this.history = this.history.filter(h => h.id !== historyId);
        this.filteredHistory = this.filteredHistory.filter(h => h.id !== historyId);
        this.saveToLocalStorage();
        this.renderHistory();
    }

    /**
     * View detailed information about a history item
     */
    viewHistoryDetails(historyId) {
        const item = this.history.find(h => h.id === historyId);
        if (!item) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal large-modal">
                <div class="modal-header">
                    <h3>Query Details</h3>
                    <button class="btn-icon modal-close">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="history-details">
                        <div class="detail-group">
                            <h4>Execution Info</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <strong>Timestamp:</strong>
                                    <span>${new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Mode:</strong>
                                    <span class="mode-badge mode-${item.mode}">${item.mode?.toUpperCase() || 'UNKNOWN'}</span>
                                </div>
                                <div class="detail-item">
                                    <strong>Status:</strong>
                                    <span class="status-badge ${item.success === false ? 'error' : 'success'}">
                                        ${item.success === false ? 'Failed' : 'Success'}
                                    </span>
                                </div>
                                ${item.executionTime ? `
                                    <div class="detail-item">
                                        <strong>Execution Time:</strong>
                                        <span>${window.dataFormatter.formatDuration(item.executionTime)}</span>
                                    </div>
                                ` : ''}
                                ${item.resultCount !== undefined ? `
                                    <div class="detail-item">
                                        <strong>Results:</strong>
                                        <span>${item.resultCount} ${item.resultCount === 1 ? 'result' : 'results'}</span>
                                    </div>
                                ` : ''}
                                ${item.confidence !== undefined ? `
                                    <div class="detail-item">
                                        <strong>AI Confidence:</strong>
                                        <span>${window.dataFormatter.formatConfidence(item.confidence)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${item.userInput ? `
                            <div class="detail-group">
                                <h4>User Input</h4>
                                <div class="code-block user-input">${item.userInput}</div>
                            </div>
                        ` : ''}
                        
                        <div class="detail-group">
                            <h4>Generated KQL Query</h4>
                            <pre class="code-block kql-code">${window.dataFormatter.highlightKQL(item.query)}</pre>
                        </div>
                        
                        ${item.reasoning ? `
                            <div class="detail-group">
                                <h4>AI Reasoning</h4>
                                <div class="reasoning-text">${item.reasoning}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary close-btn">Close</button>
                    <button class="btn-secondary copy-query-btn">Copy Query</button>
                    <button class="btn-primary rerun-query-btn">Rerun Query</button>
                </div>
            </div>
        `;

        // Bind modal events
        const closeModal = () => modal.remove();
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.close-btn').addEventListener('click', closeModal);
        
        modal.querySelector('.copy-query-btn').addEventListener('click', () => {
            this.copyQuery(item.id);
            closeModal();
        });
        
        modal.querySelector('.rerun-query-btn').addEventListener('click', () => {
            this.rerunQuery(item.id);
            closeModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.body.appendChild(modal);
    }

    /**
     * Show panel and load history if needed
     */
    async show() {
        this.panel.classList.add('active');
        
        // Refresh history from API if we have a session
        if (window.apiClient.sessionId) {
            await this.loadHistoryFromAPI();
        }
    }

    /**
     * Hide panel
     */
    hide() {
        this.panel.classList.remove('active');
    }

    /**
     * Check if panel is visible
     */
    isVisible() {
        return this.panel.classList.contains('active');
    }

    /**
     * Get history statistics
     */
    getStats() {
        const total = this.history.length;
        const successful = this.history.filter(h => h.success !== false).length;
        const failed = total - successful;
        
        return { total, successful, failed };
    }

    showSuccess(message) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'temporary-notification success';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global history panel instance
window.historyPanel = new HistoryPanel();