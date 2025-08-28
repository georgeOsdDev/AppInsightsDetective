/**
 * API Client for AppInsights Detective WebUI
 * Handles all communication with the backend API
 */
class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.sessionId = null;
        this.isAuthenticated = false;
    }

    /**
     * Make an authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed [${options.method || 'GET'} ${url}]:`, error);
            throw error;
        }
    }

    /**
     * Session Management
     */
    async startSession(config = {}) {
        try {
            const response = await this.request('/session/start', {
                method: 'POST',
                body: JSON.stringify(config)
            });
            
            this.sessionId = response.sessionId;
            this.isAuthenticated = true;
            return response;
        } catch (error) {
            console.error('Failed to start session:', error);
            throw error;
        }
    }

    async getSessionInfo() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        
        return await this.request(`/session/${this.sessionId}`);
    }

    async updateSession(updates) {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        
        return await this.request(`/session/${this.sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    /**
     * Query Operations
     */
    async generateQuery(userInput, mode = 'smart', extraContext = '') {
        return await this.request('/query/generate', {
            method: 'POST',
            body: JSON.stringify({
                userInput,
                mode,
                dataSourceType: 'applicationInsights',
                extraContext
            })
        });
    }

    async executeQuery(query, mode = 'smart') {
        return await this.request('/query/execute', {
            method: 'POST',
            body: JSON.stringify({
                query,
                mode,
                sessionId: this.sessionId
            })
        });
    }

    async explainQuery(query) {
        return await this.request('/query/explain', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    }

    async regenerateQuery(originalQuery, userInput, feedback) {
        return await this.request('/query/regenerate', {
            method: 'POST',
            body: JSON.stringify({
                originalQuery,
                userInput,
                feedback
            })
        });
    }

    /**
     * Template Operations
     */
    async getTemplates() {
        return await this.request('/templates');
    }

    async getTemplate(id) {
        return await this.request(`/templates/${id}`);
    }

    async useTemplate(id, parameters = {}) {
        return await this.request(`/templates/${id}/use`, {
            method: 'POST',
            body: JSON.stringify({ parameters })
        });
    }

    async createTemplate(template) {
        return await this.request('/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        });
    }

    async updateTemplate(id, updates) {
        return await this.request(`/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteTemplate(id) {
        return await this.request(`/templates/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Configuration
     */
    async getConfig() {
        return await this.request('/config');
    }

    async updateConfig(config) {
        return await this.request('/config', {
            method: 'PUT',
            body: JSON.stringify(config)
        });
    }

    /**
     * Portal Integration
     */
    async openInPortal(query) {
        return await this.request('/portal/open', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    }

    /**
     * History Management
     */
    async getHistory() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        
        return await this.request(`/session/${this.sessionId}/history`);
    }

    /**
     * Health Check
     */
    async healthCheck() {
        return await this.request('/health');
    }
}

// Global API client instance
window.apiClient = new APIClient();