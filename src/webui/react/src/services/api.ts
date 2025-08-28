/**
 * API Client for AppInsights Detective WebUI React
 * Handles all communication with the backend API
 */
export class APIClient {
  private baseURL: string;
  public sessionId: string | null = null;
  public isAuthenticated: boolean = false;

  constructor() {
    this.baseURL = '/api';
  }

  /**
   * Make an authenticated API request
   */
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(this.sessionId && { 'X-Session-ID': this.sessionId })
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Session Management
   */
  async startSession(config: any = {}): Promise<any> {
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

  async getSessionInfo(): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    return await this.request(`/session/${this.sessionId}`);
  }

  async updateSession(updates: any): Promise<any> {
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
  async generateQuery(userInput: string, mode: string = 'smart', extraContext: string = ''): Promise<any> {
    return await this.request('/query/generate', {
      method: 'POST',
      body: JSON.stringify({
        userInput,
        mode,
        extraContext,
        sessionId: this.sessionId
      })
    });
  }

  async executeQuery(query: string, mode: string = 'smart'): Promise<any> {
    return await this.request('/query/execute', {
      method: 'POST',
      body: JSON.stringify({
        query,
        mode,
        sessionId: this.sessionId
      })
    });
  }

  async explainQuery(query: string): Promise<any> {
    return await this.request('/query/explain', {
      method: 'POST',
      body: JSON.stringify({
        query,
        sessionId: this.sessionId
      })
    });
  }

  async regenerateQuery(originalQuery: string, userInput: string, feedback: string): Promise<any> {
    return await this.request('/query/regenerate', {
      method: 'POST',
      body: JSON.stringify({
        originalQuery,
        userInput,
        feedback,
        sessionId: this.sessionId
      })
    });
  }

  /**
   * Template Operations
   */
  async getTemplates(): Promise<any> {
    return await this.request('/templates');
  }

  async getTemplate(id: string): Promise<any> {
    return await this.request(`/templates/${id}`);
  }

  async useTemplate(id: string, parameters: any): Promise<any> {
    return await this.request(`/templates/${id}/use`, {
      method: 'POST',
      body: JSON.stringify({ parameters, sessionId: this.sessionId })
    });
  }

  /**
   * Configuration Operations
   */
  async getConfig(): Promise<any> {
    return await this.request('/config');
  }

  async getConfigStatus(): Promise<any> {
    return await this.request('/config/status');
  }

  /**
   * History Management
   */
  async getHistory(): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }
    
    return await this.request(`/session/${this.sessionId}/history`);
  }

  /**
   * Health Check
   */
  async healthCheck(): Promise<any> {
    return await this.request('/health');
  }
}