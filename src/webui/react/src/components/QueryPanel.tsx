import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';

type QueryMode = 'smart' | 'review' | 'raw';

export const QueryPanel: React.FC = () => {
  const { apiClient, settings } = useApp();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<QueryMode>(settings.defaultMode);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const handleExecute = async () => {
    if (!query.trim() || !apiClient) return;

    setIsLoading(true);
    try {
      if (mode === 'raw') {
        // Direct KQL execution
        const result = await apiClient.executeQuery(query, mode);
        setResults(result);
      } else {
        // Generate KQL from natural language
        const generated = await apiClient.generateQuery(query, mode);
        setGeneratedQuery(generated.query);
        setConfidence(generated.confidence || 0);
        
        if (mode === 'smart' && generated.confidence > 80) {
          // Auto-execute high confidence queries
          const result = await apiClient.executeQuery(generated.query, mode);
          setResults(result);
        } else {
          // Show review interface
          setShowReview(true);
        }
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      // TODO: Show error notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewConfirm = async () => {
    if (!generatedQuery || !apiClient) return;
    
    setIsLoading(true);
    try {
      const result = await apiClient.executeQuery(generatedQuery, mode);
      setResults(result);
      setShowReview(false);
    } catch (error) {
      console.error('Query execution failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setGeneratedQuery('');
    setShowReview(false);
    setConfidence(0);
  };

  return (
    <div className="panel query-panel active">
      {/* Query Input Section */}
      <div className="query-input-section">
        <div className="input-header">
          <h2>Ask a Question</h2>
          <div className="mode-selector">
            {(['smart', 'review', 'raw'] as QueryMode[]).map((modeOption) => (
              <label key={modeOption} className="mode-option">
                <input
                  type="radio"
                  name="execution-mode"
                  value={modeOption}
                  checked={mode === modeOption}
                  onChange={(e) => setMode(e.target.value as QueryMode)}
                />
                <span>{modeOption.charAt(0).toUpperCase() + modeOption.slice(1)} {modeOption === 'raw' ? 'KQL' : 'Mode'}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="query-input-container">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'raw' 
              ? 'Enter your KQL query directly'
              : "Ask a question about your application in natural language, e.g., 'Show me errors from the last hour'"
            }
            rows={3}
            disabled={isLoading}
          />
          <div className="input-actions">
            <button 
              className="btn-secondary" 
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </button>
            <button 
              className="btn-primary" 
              onClick={handleExecute}
              disabled={!query.trim() || isLoading}
            >
              <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
              </svg>
              {isLoading ? 'Executing...' : 'Execute'}
            </button>
          </div>
        </div>
      </div>

      {/* Query Review Section */}
      {showReview && (
        <div className="query-review-section">
          <div className="review-header">
            <h3>Query Review</h3>
            <div className="confidence-indicator">
              <span className="confidence-label">Confidence:</span>
              <div className="confidence-bar">
                <div 
                  className="confidence-fill" 
                  style={{ width: `${confidence}%` }}
                ></div>
              </div>
              <span className="confidence-value">{confidence}%</span>
            </div>
          </div>
          
          <div className="generated-query">
            <div className="query-header">
              <h4>Generated KQL Query</h4>
            </div>
            <pre className="query-code">
              <code>{generatedQuery}</code>
            </pre>
          </div>
          
          <div className="review-actions">
            <button 
              className="btn-secondary" 
              onClick={() => setShowReview(false)}
            >
              Cancel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleReviewConfirm}
              disabled={isLoading}
            >
              Execute Query
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>Query Results</h3>
            <div className="results-controls">
              <button className="btn-secondary">Export</button>
              <button className="btn-secondary">Portal</button>
            </div>
          </div>
          
          <div className="results-content">
            {results.data && results.data.length > 0 ? (
              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      {Object.keys(results.data[0]).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.slice(0, 100).map((row: any, index: number) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, cellIndex: number) => (
                          <td key={cellIndex}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-results">
                <p>No results found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};