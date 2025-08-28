import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

interface HistoryItem {
  id: number;
  query: string;
  generatedQuery?: string;
  mode: string;
  timestamp: string;
  duration?: number;
  recordCount?: number;
  success: boolean;
  source: 'local' | 'server';
}

export const HistoryPanel: React.FC = () => {
  const { apiClient } = useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [apiClient]);

  useEffect(() => {
    filterHistory();
  }, [history, searchTerm, filterMode]);

  const loadHistory = () => {
    // Load from localStorage first
    try {
      const localHistory = JSON.parse(localStorage.getItem('aidx-history') || '[]');
      setHistory(localHistory);
      setFilteredHistory(localHistory);
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
    }

    // Then load from API if available
    loadHistoryFromAPI();
  };

  const loadHistoryFromAPI = async () => {
    if (!apiClient) return;

    try {
      const response = await apiClient.getHistory();
      if (response.history) {
        // Merge server history with local history
        const serverHistory = response.history.map((item: any) => ({
          ...item,
          source: 'server'
        }));
        
        const mergedHistory = [...history];
        serverHistory.forEach((serverItem: HistoryItem) => {
          const exists = mergedHistory.some(localItem => 
            localItem.query === serverItem.query && 
            localItem.timestamp === serverItem.timestamp
          );
          if (!exists) {
            mergedHistory.unshift(serverItem);
          }
        });
        
        const sortedHistory = mergedHistory
          .slice(0, 100) // Keep only recent 100 items
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
        setHistory(sortedHistory);
        saveToLocalStorage(sortedHistory);
      }
    } catch (error) {
      console.error('Failed to load history from API:', error);
    }
  };

  const filterHistory = () => {
    let filtered = history;
    
    if (filterMode !== 'all') {
      filtered = filtered.filter(item => item.mode === filterMode);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.generatedQuery && item.generatedQuery.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredHistory(filtered);
  };

  const saveToLocalStorage = (historyItems: HistoryItem[]) => {
    try {
      localStorage.setItem('aidx-history', JSON.stringify(historyItems));
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  };

  const handleRerun = (item: HistoryItem) => {
    // TODO: Implement rerun functionality - switch to query panel and populate query
    console.log('Rerunning query:', item.query);
  };

  const handleCopy = (item: HistoryItem) => {
    const textToCopy = item.generatedQuery || item.query;
    navigator.clipboard.writeText(textToCopy).then(() => {
      // TODO: Show success notification
      console.log('Query copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy query:', err);
    });
  };

  const handleDelete = (itemId: number) => {
    const updatedHistory = history.filter(item => item.id !== itemId);
    setHistory(updatedHistory);
    saveToLocalStorage(updatedHistory);
  };

  const clearHistory = () => {
    setHistory([]);
    setFilteredHistory([]);
    saveToLocalStorage([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    return `${duration}ms`;
  };

  return (
    <div className="panel history-panel">
      <div className="history-header">
        <h2>Query History</h2>
        <div className="history-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
          >
            <option value="all">All Modes</option>
            <option value="smart">Smart Mode</option>
            <option value="review">Review Mode</option>
            <option value="raw">Raw KQL</option>
          </select>
          <button className="btn-secondary" onClick={clearHistory}>
            Clear History
          </button>
        </div>
      </div>

      <div className="history-list">
        {filteredHistory.map((item) => (
          <div key={item.id} className="history-entry" data-history-id={item.id}>
            <div className="history-entry-header">
              <div className="history-meta">
                <span className={`mode-badge mode-${item.mode}`}>{item.mode}</span>
                <span className="timestamp">{formatTimestamp(item.timestamp)}</span>
                <span className={`status ${item.success ? 'success' : 'error'}`}>
                  {item.success ? 'Success' : 'Failed'}
                </span>
              </div>
              <div className="history-actions">
                <button
                  className="action-btn rerun-btn"
                  onClick={() => handleRerun(item)}
                  title="Rerun query"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                  </svg>
                </button>
                <button
                  className="action-btn copy-btn"
                  onClick={() => handleCopy(item)}
                  title="Copy query"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                  </svg>
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={() => handleDelete(item.id)}
                  title="Delete from history"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="history-content">
              <div className="query-text">
                <strong>Query:</strong> {item.query}
              </div>
              {item.generatedQuery && (
                <div className="generated-query-text">
                  <strong>Generated KQL:</strong> 
                  <pre><code>{item.generatedQuery}</code></pre>
                </div>
              )}
              {item.success && (
                <div className="result-stats">
                  <span>Duration: {formatDuration(item.duration)}</span>
                  {item.recordCount !== undefined && (
                    <span>Records: {item.recordCount}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredHistory.length === 0 && !isLoading && (
        <div className="no-history">
          <p>No query history found.</p>
        </div>
      )}
    </div>
  );
};