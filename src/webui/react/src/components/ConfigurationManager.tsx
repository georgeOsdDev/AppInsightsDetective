import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

interface ConfigurationManagerProps {
  isVisible: boolean;
}

interface ConfigurationItem {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'ai' | 'data-source';
  status: 'connected' | 'disconnected' | 'error' | 'warning';
  details: Record<string, any>;
  actions: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    handler: () => void;
  }>;
}

export const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({ isVisible }) => {
  const { apiClient } = useApp();
  const [configurations, setConfigurations] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (isVisible) {
      loadConfigurations();
    }
  }, [isVisible, apiClient]);

  const loadConfigurations = async () => {
    if (!apiClient) return;

    setLoading(true);
    try {
      const [configStatus, config] = await Promise.all([
        apiClient.getConfigStatus(),
        apiClient.getConfig()
      ]);

      const configItems: ConfigurationItem[] = [
        {
          id: 'app-insights',
          name: 'Application Insights',
          description: 'Azure Application Insights workspace configuration',
          category: 'data-source',
          status: configStatus.appInsights?.configured ? 'connected' : 'disconnected',
          details: {
            workspaceId: configStatus.appInsights?.workspaceId || 'Not configured',
            endpoint: configStatus.appInsights?.endpoint || 'Not configured'
          },
          actions: [
            {
              id: 'test-connection',
              label: 'Test Connection',
              type: 'primary',
              handler: () => testConnection('app-insights')
            },
            {
              id: 'reconfigure',
              label: 'Reconfigure',
              type: 'secondary',
              handler: () => reconfigure('app-insights')
            }
          ]
        },
        {
          id: 'openai',
          name: 'Azure OpenAI',
          description: 'AI service for natural language processing',
          category: 'ai',
          status: configStatus.openAI?.configured ? 'connected' : 'disconnected',
          details: {
            endpoint: configStatus.openAI?.endpoint || 'Not configured',
            model: configStatus.openAI?.model || 'Not configured'
          },
          actions: [
            {
              id: 'test-ai',
              label: 'Test AI Service',
              type: 'primary',
              handler: () => testConnection('openai')
            },
            {
              id: 'update-model',
              label: 'Update Model',
              type: 'secondary',
              handler: () => reconfigure('openai')
            }
          ]
        },
        {
          id: 'auth',
          name: 'Authentication',
          description: 'Azure authentication and permissions',
          category: 'authentication',
          status: configStatus.authentication?.status || 'disconnected',
          details: {
            method: configStatus.authentication?.method || 'Not configured',
            status: configStatus.authentication?.status || 'Unknown'
          },
          actions: [
            {
              id: 'refresh-auth',
              label: 'Refresh Credentials',
              type: 'primary',
              handler: () => refreshAuth()
            },
            {
              id: 'check-permissions',
              label: 'Check Permissions',
              type: 'secondary',
              handler: () => checkPermissions()
            }
          ]
        }
      ];

      setConfigurations(configItems);
    } catch (error) {
      console.error('Failed to load configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (configId: string) => {
    console.log(`Testing connection for ${configId}`);
    // TODO: Implement actual connection testing
  };

  const reconfigure = (configId: string) => {
    console.log(`Reconfiguring ${configId}`);
    // TODO: Open configuration dialog
  };

  const refreshAuth = () => {
    console.log('Refreshing authentication');
    // TODO: Implement auth refresh
  };

  const checkPermissions = () => {
    console.log('Checking permissions');
    // TODO: Implement permission check
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'var(--success-color)';
      case 'warning': return 'var(--warning-color)';
      case 'error': 
      case 'disconnected': return 'var(--error-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--success-color)' }}>
            <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
          </svg>
        );
      case 'warning':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--warning-color)' }}>
            <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--error-color)' }}>
            <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/>
          </svg>
        );
    }
  };

  const filteredConfigurations = selectedCategory === 'all' 
    ? configurations 
    : configurations.filter(config => config.category === selectedCategory);

  if (!isVisible) return null;

  return (
    <div className="configuration-manager">
      <div className="config-header">
        <h3>Configuration Management</h3>
        <div className="config-filters">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="data-source">Data Sources</option>
            <option value="ai">AI Services</option>
            <option value="authentication">Authentication</option>
          </select>
          <button 
            className="btn-secondary" 
            onClick={loadConfigurations}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      {loading && configurations.length === 0 ? (
        <div className="loading-state">
          <p>Loading configuration status...</p>
        </div>
      ) : (
        <div className="config-grid">
          {filteredConfigurations.map((config) => (
            <div key={config.id} className="config-card">
              <div className="config-card-header">
                <div className="config-info">
                  <div className="config-title">
                    <div className="config-icon">
                      {getStatusIcon(config.status)}
                    </div>
                    <div>
                      <h4>{config.name}</h4>
                      <p className="config-description">{config.description}</p>
                    </div>
                  </div>
                  <div 
                    className="config-status-badge"
                    style={{ color: getStatusColor(config.status) }}
                  >
                    {config.status.charAt(0).toUpperCase() + config.status.slice(1)}
                  </div>
                </div>
              </div>

              <div className="config-details">
                {Object.entries(config.details).map(([key, value]) => (
                  <div key={key} className="config-detail-item">
                    <span className="detail-key">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                    <span className="detail-value">{String(value)}</span>
                  </div>
                ))}
              </div>

              <div className="config-actions">
                {config.actions.map((action) => (
                  <button
                    key={action.id}
                    className={`btn-${action.type}`}
                    onClick={action.handler}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredConfigurations.length === 0 && !loading && (
        <div className="no-configurations">
          <p>No configurations found for the selected category.</p>
        </div>
      )}
    </div>
  );
};