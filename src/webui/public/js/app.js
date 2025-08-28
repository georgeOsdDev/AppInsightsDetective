/**
 * Main Application Controller for AppInsights Detective WebUI
 * Coordinates all components and manages application state
 */
class AppInsightsDetectiveApp {
    constructor() {
        this.currentPanel = 'query';
        this.isInitialized = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Initialize components
            this.initializeElements();
            this.bindEvents();
            
            // Start session with backend
            await this.startSession();
            
            // Load initial data
            await this.loadInitialData();
            
            // Mark as initialized
            this.isInitialized = true;
            this.updateSessionStatus('Connected');
            
            console.log('AppInsights Detective WebUI initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.updateSessionStatus('Connection Failed');
            this.showInitializationError(error);
        }
    }

    initializeElements() {
        // Navigation elements
        this.queryTab = document.getElementById('query-tab');
        this.templatesTab = document.getElementById('templates-tab');
        this.historyTab = document.getElementById('history-tab');
        
        // Panel elements
        this.queryPanel = document.getElementById('query-panel');
        this.templatesPanel = document.getElementById('templates-panel');
        this.historyPanel = document.getElementById('history-panel');
        
        // Settings elements
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.cancelSettingsBtn = document.getElementById('cancel-settings-btn');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        
        // Session status
        this.sessionStatus = document.querySelector('#session-info .session-status');
    }

    bindEvents() {
        // Navigation tabs
        this.queryTab.addEventListener('click', () => this.switchPanel('query'));
        this.templatesTab.addEventListener('click', () => this.switchPanel('templates'));
        this.historyTab.addEventListener('click', () => this.switchPanel('history'));
        
        // Settings modal
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.cancelSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        // Close modal on backdrop click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.switchPanel('query');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchPanel('templates');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchPanel('history');
                        break;
                    case ',':
                        e.preventDefault();
                        this.openSettings();
                        break;
                }
            }
        });

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        window.addEventListener('focus', () => {
            // Refresh data when window regains focus
            if (this.isInitialized) {
                this.refreshCurrentPanel();
            }
        });
    }

    async startSession() {
        try {
            const sessionConfig = this.getSessionConfig();
            const response = await window.apiClient.startSession(sessionConfig);
            
            console.log('Session started:', response.sessionId);
            return response;
            
        } catch (error) {
            console.error('Failed to start session:', error);
            throw new Error(`Session initialization failed: ${error.message}`);
        }
    }

    getSessionConfig() {
        try {
            const settings = JSON.parse(localStorage.getItem('aidx-settings') || '{}');
            return {
                language: settings.language || 'en',
                defaultMode: settings.defaultMode || 'smart',
                timeRange: settings.defaultTimeRange || '24h'
            };
        } catch (error) {
            return {
                language: 'en',
                defaultMode: 'smart',
                timeRange: '24h'
            };
        }
    }



    async loadInitialData() {
        // Load templates in background
        try {
            await window.templatePanel.loadTemplates();
        } catch (error) {
            console.warn('Failed to load templates:', error);
        }
    }

    /**
     * Switch between panels
     */
    switchPanel(panelName) {
        if (this.currentPanel === panelName) return;

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById(`${panelName}-tab`).classList.add('active');

        // Update panels
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${panelName}-panel`).classList.add('active');

        this.currentPanel = panelName;

        // Initialize panel if needed
        this.initializeCurrentPanel();
    }

    async initializeCurrentPanel() {
        switch (this.currentPanel) {
            case 'templates':
                if (window.templatePanel && !window.templatePanel.isVisible()) {
                    await window.templatePanel.show();
                }
                break;
            case 'history':
                if (window.historyPanel && !window.historyPanel.isVisible()) {
                    await window.historyPanel.show();
                }
                break;
        }
    }

    async refreshCurrentPanel() {
        switch (this.currentPanel) {
            case 'templates':
                await window.templatePanel.refresh();
                break;
            case 'history':
                await window.historyPanel.loadHistoryFromAPI();
                break;
        }
    }

    /**
     * Settings management
     */
    openSettings() {
        this.loadCurrentSettings();
        this.settingsModal.classList.remove('hidden');
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    loadCurrentSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('aidx-settings') || '{}');
            
            // Load settings into form
            const defaultMode = document.getElementById('default-mode');
            if (defaultMode) {
                defaultMode.value = settings.defaultMode || 'smart';
            }
            
            const defaultTimeRange = document.getElementById('default-time-range');
            if (defaultTimeRange) {
                defaultTimeRange.value = settings.defaultTimeRange || '24h';
            }
            
            const showEmptyColumns = document.getElementById('show-empty-columns');
            if (showEmptyColumns) {
                showEmptyColumns.checked = settings.showEmptyColumns || false;
            }
            
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            const settings = {
                defaultMode: document.getElementById('default-mode')?.value || 'smart',
                defaultTimeRange: document.getElementById('default-time-range')?.value || '24h',
                showEmptyColumns: document.getElementById('show-empty-columns')?.checked || false,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem('aidx-settings', JSON.stringify(settings));
            
            // Update API client session if needed
            if (window.apiClient.sessionId) {
                window.apiClient.updateSession(settings).catch(error => {
                    console.warn('Failed to update session settings:', error);
                });
            }
            
            // Apply settings to query editor
            window.queryEditor.setMode(settings.defaultMode);
            
            this.closeSettings();
            this.showSuccess('Settings saved successfully');
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings');
        }
    }

    /**
     * Update session status display
     */
    updateSessionStatus(status) {
        if (this.sessionStatus) {
            this.sessionStatus.textContent = status;
            
            // Update status class
            this.sessionStatus.className = 'session-status';
            if (status === 'Connected') {
                this.sessionStatus.classList.add('connected');
            } else if (status.includes('Error') || status.includes('Failed')) {
                this.sessionStatus.classList.add('error');
            }
        }
    }

    /**
     * Show initialization error
     */
    showInitializationError(error) {
        const errorMessage = `
            <div class="initialization-error">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Initialization Failed</div>
                <div class="error-description">
                    Failed to connect to the AppInsights Detective backend.
                    <br><br>
                    <strong>Error:</strong> ${error.message}
                    <br><br>
                    Please check that the server is running and try refreshing the page.
                </div>
                <button class="btn-primary" onclick="window.location.reload()">
                    Refresh Page
                </button>
            </div>
        `;
        
        document.getElementById('app').innerHTML = errorMessage;
    }

    /**
     * Show success message
     */
    showSuccess(message) {
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

    /**
     * Show error message
     */
    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'temporary-notification error';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    /**
     * Get application state for debugging
     */
    getState() {
        return {
            currentPanel: this.currentPanel,
            isInitialized: this.isInitialized,
            sessionId: window.apiClient?.sessionId,
            historyCount: window.historyPanel?.history?.length || 0,
            templatesCount: window.templatePanel?.templates?.length || 0
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AppInsights Detective WebUI...');
    window.app = new AppInsightsDetectiveApp();
});

// Global app instance for debugging
window.app = null;