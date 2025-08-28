import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfigStatus {
  appInsights: {
    configured: boolean;
    workspaceId?: string;
    endpoint?: string;
  };
  openAI: {
    configured: boolean;
    endpoint?: string;
    model?: string;
  };
  authentication: {
    method: string;
    status: 'connected' | 'disconnected' | 'error';
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, apiClient } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'general' | 'configuration' | 'advanced'>('general');
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Local state for form fields
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      loadConfigStatus();
    }
  }, [isOpen, settings]);

  const loadConfigStatus = async () => {
    if (!apiClient) return;
    
    setIsLoading(true);
    try {
      const status = await apiClient.getConfigStatus();
      setConfigStatus(status);
    } catch (error) {
      console.error('Failed to load config status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const handleLocalSettingChange = (key: keyof typeof localSettings, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab-btn ${activeTab === 'configuration' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuration')}
          >
            Configuration
          </button>
          <button
            className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        <div className="settings-content">
          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <h3>General Settings</h3>
              
              <div className="setting-group">
                <label htmlFor="theme-setting">Theme</label>
                <div className="setting-control">
                  <button
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => theme !== 'light' && toggleTheme()}
                  >
                    Light
                  </button>
                  <button
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => theme !== 'dark' && toggleTheme()}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <label htmlFor="default-mode">Default Query Mode</label>
                <select
                  id="default-mode"
                  value={localSettings.defaultMode}
                  onChange={(e) => handleLocalSettingChange('defaultMode', e.target.value as any)}
                >
                  <option value="smart">Smart Mode</option>
                  <option value="review">Review Mode</option>
                  <option value="raw">Raw KQL</option>
                </select>
              </div>

              <div className="setting-group">
                <label htmlFor="default-time-range">Default Time Range</label>
                <select
                  id="default-time-range"
                  value={localSettings.defaultTimeRange}
                  onChange={(e) => handleLocalSettingChange('defaultTimeRange', e.target.value)}
                >
                  <option value="1h">Last Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localSettings.showEmptyColumns}
                    onChange={(e) => handleLocalSettingChange('showEmptyColumns', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Show Empty Columns in Results
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localSettings.autoSave}
                    onChange={(e) => handleLocalSettingChange('autoSave', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Auto-save Queries to History
                </label>
              </div>
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === 'configuration' && (
            <div className="settings-section">
              <h3>Configuration Status</h3>
              
              {isLoading ? (
                <div className="loading-state">
                  <p>Loading configuration status...</p>
                </div>
              ) : configStatus ? (
                <div className="config-status-grid">
                  <div className="config-item">
                    <div className="config-header">
                      <h4>Application Insights</h4>
                      <span className={`status-badge ${configStatus.appInsights.configured ? 'success' : 'error'}`}>
                        {configStatus.appInsights.configured ? 'Connected' : 'Not Configured'}
                      </span>
                    </div>
                    {configStatus.appInsights.workspaceId && (
                      <div className="config-details">
                        <p><strong>Workspace ID:</strong> {configStatus.appInsights.workspaceId}</p>
                        <p><strong>Endpoint:</strong> {configStatus.appInsights.endpoint}</p>
                      </div>
                    )}
                  </div>

                  <div className="config-item">
                    <div className="config-header">
                      <h4>OpenAI Integration</h4>
                      <span className={`status-badge ${configStatus.openAI.configured ? 'success' : 'error'}`}>
                        {configStatus.openAI.configured ? 'Connected' : 'Not Configured'}
                      </span>
                    </div>
                    {configStatus.openAI.endpoint && (
                      <div className="config-details">
                        <p><strong>Endpoint:</strong> {configStatus.openAI.endpoint}</p>
                        <p><strong>Model:</strong> {configStatus.openAI.model}</p>
                      </div>
                    )}
                  </div>

                  <div className="config-item">
                    <div className="config-header">
                      <h4>Authentication</h4>
                      <span className={`status-badge ${configStatus.authentication.status === 'connected' ? 'success' : 'error'}`}>
                        {configStatus.authentication.status}
                      </span>
                    </div>
                    <div className="config-details">
                      <p><strong>Method:</strong> {configStatus.authentication.method}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="error-state">
                  <p>Failed to load configuration status.</p>
                  <button className="btn-secondary" onClick={loadConfigStatus}>
                    Retry
                  </button>
                </div>
              )}

              <div className="config-actions">
                <button className="btn-secondary" onClick={loadConfigStatus}>
                  Refresh Status
                </button>
                <button className="btn-primary" disabled>
                  Update Configuration
                </button>
              </div>
            </div>
          )}

          {/* Advanced Settings Tab */}
          {activeTab === 'advanced' && (
            <div className="settings-section">
              <h3>Advanced Settings</h3>
              
              <div className="setting-group">
                <label>Query Timeout</label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  defaultValue="120"
                  placeholder="Seconds"
                />
                <small>Maximum time to wait for query execution (30-300 seconds)</small>
              </div>

              <div className="setting-group">
                <label>Max Results per Page</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  defaultValue="100"
                />
                <small>Maximum number of results to display per page</small>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span className="checkmark"></span>
                  Enable WebSocket real-time updates
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  Enable debug logging
                </label>
              </div>

              <div className="setting-group">
                <label>Export to localStorage</label>
                <div className="export-actions">
                  <button className="btn-secondary">Export Settings</button>
                  <button className="btn-secondary">Import Settings</button>
                </div>
                <small>Backup and restore your settings and query history</small>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};