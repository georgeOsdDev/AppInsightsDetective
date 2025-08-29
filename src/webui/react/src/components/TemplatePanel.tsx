import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
}

export const TemplatePanel: React.FC = () => {
  const { apiClient } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [apiClient]);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, searchTerm]);

  const loadTemplates = async () => {
    if (!apiClient) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.getTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredTemplates(filtered);
  };

  const getCategories = () => {
    const categories = Array.from(new Set(templates.map(t => t.category)));
    return ['all', ...categories];
  };

  const handleUseTemplate = async (template: Template) => {
    // For now, just copy the template name to the query panel
    // In a full implementation, this would open a parameter dialog
    console.log('Using template:', template.name);
  };

  if (isLoading && templates.length === 0) {
    return (
      <div className="panel template-panel">
        <div className="loading-state">
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel template-panel">
      <div className="template-header">
        <h2>Query Templates</h2>
        <div className="template-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {getCategories().map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="templates-grid">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="template-card">
            <div className="template-card-header">
              <h4>{template.name}</h4>
              <span className="template-category">{template.category}</span>
            </div>
            <p className="template-description">{template.description}</p>
            <div className="template-meta">
              <span className="template-params">
                {template.parameters.length} parameters
              </span>
              <button
                className="btn-primary"
                onClick={() => handleUseTemplate(template)}
              >
                Use Template
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && !isLoading && (
        <div className="no-templates">
          <p>No templates found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};