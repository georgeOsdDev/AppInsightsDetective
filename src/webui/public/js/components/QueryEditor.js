/**
 * Query Editor Component for AppInsights Detective WebUI
 * Handles query input, mode selection, and execution
 */
class QueryEditor {
    constructor() {
        this.mode = 'smart';
        this.currentQuery = '';
        this.reviewData = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
    }

    initializeElements() {
        this.queryInput = document.getElementById('query-input');
        this.executeBtn = document.getElementById('execute-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.modeRadios = document.querySelectorAll('input[name="execution-mode"]');
        
        // Review section elements
        this.reviewSection = document.getElementById('query-review-section');
        this.generatedQueryCode = document.getElementById('generated-query-code');
        this.confidenceFill = document.getElementById('confidence-fill');
        this.confidenceValue = document.getElementById('confidence-value');
        this.reasoningText = document.getElementById('reasoning-text');
        this.reasoningSection = document.getElementById('reasoning-section');
        
        // Review action buttons
        this.explainBtn = document.getElementById('explain-btn');
        this.regenerateBtn = document.getElementById('regenerate-btn');
        this.portalBtn = document.getElementById('portal-btn');
        this.executeReviewedBtn = document.getElementById('execute-reviewed-btn');
        this.copyQueryBtn = document.getElementById('copy-query-btn');
    }

    bindEvents() {
        // Mode selection
        this.modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = e.target.value;
                this.onModeChanged();
            });
        });

        // Query input
        this.queryInput.addEventListener('input', () => {
            this.validateInput();
        });

        this.queryInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.executeQuery();
            }
        });

        // Action buttons
        this.executeBtn.addEventListener('click', () => this.executeQuery());
        this.clearBtn.addEventListener('click', () => this.clearQuery());
        
        // Review section buttons
        this.explainBtn?.addEventListener('click', () => this.explainQuery());
        this.regenerateBtn?.addEventListener('click', () => this.regenerateQuery());
        this.portalBtn?.addEventListener('click', () => this.openInPortal());
        this.executeReviewedBtn?.addEventListener('click', () => this.executeReviewedQuery());
        this.copyQueryBtn?.addEventListener('click', () => this.copyQuery());
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('aidx-settings') || '{}');
            if (settings.defaultMode) {
                this.setMode(settings.defaultMode);
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    setMode(mode) {
        this.mode = mode;
        const radio = document.querySelector(`input[name="execution-mode"][value="${mode}"]`);
        if (radio) {
            radio.checked = true;
            this.onModeChanged();
        }
    }

    onModeChanged() {
        this.queryInput.placeholder = this.getPlaceholderText();
        this.hideReviewSection();
    }

    getPlaceholderText() {
        switch (this.mode) {
            case 'raw':
                return 'Enter KQL query directly, e.g., "requests | where timestamp > ago(1h) | summarize count() by name"';
            case 'review':
                return 'Describe what you want to analyze - the generated query will be shown for review';
            case 'smart':
            default:
                return 'Ask a question about your application in natural language, e.g., "Show me errors from the last hour"';
        }
    }

    validateInput() {
        const hasInput = this.queryInput.value.trim().length > 0;
        this.executeBtn.disabled = !hasInput;
    }

    async executeQuery() {
        const userInput = this.queryInput.value.trim();
        if (!userInput) return;

        this.setLoading(true);
        this.hideReviewSection();

        try {
            if (this.mode === 'raw') {
                // Direct KQL execution
                await this.executeDirectQuery(userInput);
            } else {
                // Generate and potentially review query
                await this.generateAndExecuteQuery(userInput);
            }
        } catch (error) {
            this.showError('Query execution failed', error);
        } finally {
            this.setLoading(false);
        }
    }

    async generateAndExecuteQuery(userInput) {
        try {
            // Generate query using AI
            const generateResponse = await window.apiClient.generateQuery(userInput, this.mode);
            
            if (generateResponse.error) {
                throw new Error(generateResponse.error || 'Failed to generate query');
            }

            this.currentQuery = generateResponse.query;
            this.reviewData = generateResponse;

            if (this.mode === 'review') {
                // Show review interface
                this.showReviewSection(generateResponse);
            } else {
                // Execute immediately in smart mode
                await this.executeGeneratedQuery(generateResponse.query);
            }

        } catch (error) {
            throw new Error(`Query generation failed: ${error.message}`);
        }
    }

    async executeDirectQuery(query) {
        try {
            const response = await window.apiClient.executeQuery(query, 'raw');
            
            if (!response.error) {
                window.resultsViewer.displayResults(response);
                this.addToHistory(query, 'raw', response);
            } else {
                throw new Error(response.error || 'Query execution failed');
            }
        } catch (error) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    async executeGeneratedQuery(query) {
        try {
            const response = await window.apiClient.executeQuery(query, this.mode);
            
            if (!response.error) {
                window.resultsViewer.displayResults(response);
                this.addToHistory(query, this.mode, response, this.reviewData);
            } else {
                throw new Error(response.error || 'Query execution failed');
            }
        } catch (error) {
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    showReviewSection(generateResponse) {
        // Update confidence indicator
        const confidence = generateResponse.confidence || 0;
        this.confidenceFill.style.width = `${confidence * 100}%`;
        this.confidenceValue.textContent = window.dataFormatter.formatConfidence(confidence);
        
        // Set confidence color based on value
        const confidenceClass = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
        this.confidenceFill.className = `confidence-fill ${confidenceClass}`;

        // Display generated query with syntax highlighting
        this.generatedQueryCode.innerHTML = window.dataFormatter.highlightKQL(generateResponse.query);

        // Show reasoning if available
        if (generateResponse.reasoning) {
            this.reasoningText.textContent = generateResponse.reasoning;
            this.reasoningSection.classList.remove('hidden');
        } else {
            this.reasoningSection.classList.add('hidden');
        }

        // Show the review section
        this.reviewSection.classList.remove('hidden');
    }

    hideReviewSection() {
        this.reviewSection.classList.add('hidden');
    }

    async explainQuery() {
        if (!this.currentQuery) return;

        this.setLoading(true, 'Generating explanation...');

        try {
            const response = await window.apiClient.explainQuery(this.currentQuery);
            
            if (response.error) {
                throw new Error(response.error);
            } else {
                alert(response.explanation); // Simple alert for now
            }
        } catch (error) {
            this.showError('Explanation failed', error);
        } finally {
            this.setLoading(false);
        }
    }

    async regenerateQuery() {
        if (!this.reviewData) return;

        const feedback = prompt('What would you like to change about the query?');
        if (!feedback) return;

        this.setLoading(true, 'Regenerating query...');

        try {
            const response = await window.apiClient.regenerateQuery(
                this.currentQuery,
                this.queryInput.value,
                feedback
            );

            if (!response.error) {
                this.currentQuery = response.query;
                this.reviewData = response;
                this.showReviewSection(response);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showError('Query regeneration failed', error);
        } finally {
            this.setLoading(false);
        }
    }

    async openInPortal() {
        if (!this.currentQuery) return;

        try {
            const response = await window.apiClient.openInPortal(this.currentQuery);
            
            if (!response.error && response.portalUrl) {
                window.open(response.portalUrl, '_blank');
            } else {
                throw new Error(response.error || 'Failed to generate portal URL');
            }
        } catch (error) {
            this.showError('Portal opening failed', error);
        }
    }

    async executeReviewedQuery() {
        if (!this.currentQuery) return;

        this.setLoading(true, 'Executing query...');

        try {
            await this.executeGeneratedQuery(this.currentQuery);
            this.hideReviewSection();
        } catch (error) {
            this.showError('Query execution failed', error);
        } finally {
            this.setLoading(false);
        }
    }

    copyQuery() {
        if (!this.currentQuery) return;

        navigator.clipboard.writeText(this.currentQuery).then(() => {
            this.showTemporaryMessage('Query copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentQuery;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showTemporaryMessage('Query copied to clipboard!');
        });
    }

    clearQuery() {
        this.queryInput.value = '';
        this.currentQuery = '';
        this.reviewData = null;
        this.hideReviewSection();
        this.validateInput();
        this.queryInput.focus();
    }

    setQueryText(text) {
        this.queryInput.value = text;
        this.validateInput();
    }

    addToHistory(query, mode, results, generateData = null) {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            userInput: this.queryInput.value,
            query,
            mode,
            confidence: generateData?.confidence,
            reasoning: generateData?.reasoning,
            resultCount: results.data?.length || 0,
            executionTime: results.executionTime,
            success: !results.error
        };

        window.historyPanel.addHistoryItem(historyItem);
    }

    setLoading(loading, message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        if (loading) {
            text.textContent = message;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }

        // Disable/enable controls
        this.executeBtn.disabled = loading;
        this.queryInput.disabled = loading;
    }

    showError(title, error) {
        const message = window.dataFormatter.formatError(error);
        console.error(title, error);
        
        // Show error in UI (simple alert for now)
        alert(`${title}: ${message}`);
    }

    showTemporaryMessage(message) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = 'temporary-notification';
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

// Global query editor instance
window.queryEditor = new QueryEditor();