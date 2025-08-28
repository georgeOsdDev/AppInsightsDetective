/**
 * Template Panel Component for AppInsights Detective WebUI
 * Handles template management and usage
 */
class TemplatePanel {
    constructor() {
        this.templates = [];
        this.filteredTemplates = [];
        this.searchTerm = '';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.panel = document.getElementById('templates-panel');
        this.searchInput = document.getElementById('template-search');
        this.templatesGrid = document.getElementById('templates-grid');
    }

    bindEvents() {
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterTemplates();
        });
    }

    /**
     * Load and display templates
     */
    async loadTemplates() {
        try {
            const response = await window.apiClient.getTemplates();
            
            if (response.templates) {
                this.templates = response.templates;
                this.filteredTemplates = [...this.templates];
                this.renderTemplates();
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            this.showError('Failed to load templates');
        }
    }

    filterTemplates() {
        if (!this.searchTerm) {
            this.filteredTemplates = [...this.templates];
        } else {
            this.filteredTemplates = this.templates.filter(template => 
                template.name.toLowerCase().includes(this.searchTerm) ||
                template.description.toLowerCase().includes(this.searchTerm) ||
                (template.tags && template.tags.some(tag => tag.toLowerCase().includes(this.searchTerm)))
            );
        }
        
        this.renderTemplates();
    }

    renderTemplates() {
        if (!this.templatesGrid) return;

        if (this.filteredTemplates.length === 0) {
            this.templatesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <div class="empty-title">No Templates Found</div>
                    <div class="empty-description">
                        ${this.searchTerm ? 'No templates match your search criteria' : 'No templates available'}
                    </div>
                </div>
            `;
            return;
        }

        const templatesHTML = this.filteredTemplates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-header">
                    <h3 class="template-name">${template.name}</h3>
                    <div class="template-category">${template.category || 'General'}</div>
                </div>
                
                <div class="template-description">${template.description}</div>
                
                ${template.parameters && template.parameters.length > 0 ? `
                    <div class="template-parameters">
                        <div class="parameters-label">Parameters:</div>
                        <div class="parameters-list">
                            ${template.parameters.map(param => `
                                <span class="parameter-tag">${param.name}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${template.tags && template.tags.length > 0 ? `
                    <div class="template-tags">
                        ${template.tags.map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="template-actions">
                    <button class="btn-secondary use-template-btn" data-template-id="${template.id}">
                        Use Template
                    </button>
                    <button class="btn-icon view-template-btn" data-template-id="${template.id}" title="View Details">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="template-meta">
                    <span class="template-date">
                        ${window.dataFormatter.formatTimestamp(template.createdAt)}
                    </span>
                </div>
            </div>
        `).join('');

        this.templatesGrid.innerHTML = templatesHTML;
        
        // Bind template action events
        this.bindTemplateEvents();
    }

    bindTemplateEvents() {
        // Use template buttons
        document.querySelectorAll('.use-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.dataset.templateId;
                this.useTemplate(templateId);
            });
        });

        // View template buttons
        document.querySelectorAll('.view-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.dataset.templateId;
                this.viewTemplate(templateId);
            });
        });
    }

    /**
     * Use a template
     */
    async useTemplate(templateId) {
        try {
            const template = this.templates.find(t => t.id === templateId);
            if (!template) {
                throw new Error('Template not found');
            }

            let parameters = {};
            
            // If template has parameters, collect values
            if (template.parameters && template.parameters.length > 0) {
                parameters = await this.collectTemplateParameters(template);
                if (parameters === null) return; // User cancelled
            }

            // Use the template
            const response = await window.apiClient.useTemplate(templateId, parameters);
            
            if (!response.error) {
                // Switch to query panel and populate input
                window.app.switchPanel('query');
                window.queryEditor.setQueryText(response.userInput || response.query);
                
                // If it's a direct query, execute it
                if (response.query && !response.userInput) {
                    window.queryEditor.executeDirectQuery(response.query);
                }
                
                this.showSuccess(`Template "${template.name}" applied successfully`);
            } else {
                throw new Error(response.error || 'Failed to apply template');
            }
            
        } catch (error) {
            console.error('Failed to use template:', error);
            this.showError(`Failed to use template: ${error.message}`);
        }
    }

    /**
     * View template details
     */
    async viewTemplate(templateId) {
        try {
            const template = this.templates.find(t => t.id === templateId);
            if (!template) {
                const response = await window.apiClient.getTemplate(templateId);
                template = response.template;
            }

            this.showTemplateDetails(template);
            
        } catch (error) {
            console.error('Failed to get template details:', error);
            this.showError('Failed to load template details');
        }
    }

    /**
     * Collect parameter values for template
     */
    async collectTemplateParameters(template) {
        return new Promise((resolve) => {
            const modal = this.createParameterModal(template, resolve);
            document.body.appendChild(modal);
        });
    }

    createParameterModal(template, callback) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const parametersHTML = template.parameters.map(param => `
            <div class="parameter-group">
                <label for="param-${param.name}">${param.name}:</label>
                <input 
                    type="${param.type === 'number' ? 'number' : 'text'}" 
                    id="param-${param.name}"
                    placeholder="${param.description || param.defaultValue || ''}"
                    value="${param.defaultValue || ''}"
                    ${param.required ? 'required' : ''}
                >
                <div class="parameter-description">${param.description || ''}</div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Configure Template: ${template.name}</h3>
                    <button class="btn-icon modal-close">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="template-description">${template.description}</div>
                    <div class="parameters-form">
                        ${parametersHTML}
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary cancel-btn">Cancel</button>
                    <button class="btn-primary apply-btn">Apply Template</button>
                </div>
            </div>
        `;

        // Bind modal events
        const closeModal = () => {
            modal.remove();
            callback(null);
        };

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
        modal.querySelector('.apply-btn').addEventListener('click', () => {
            const parameters = {};
            template.parameters.forEach(param => {
                const input = modal.querySelector(`#param-${param.name}`);
                if (input.value) {
                    parameters[param.name] = param.type === 'number' ? Number(input.value) : input.value;
                }
            });
            
            modal.remove();
            callback(parameters);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        return modal;
    }

    /**
     * Show template details in a modal
     */
    showTemplateDetails(template) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal large-modal">
                <div class="modal-header">
                    <h3>${template.name}</h3>
                    <button class="btn-icon modal-close">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="template-details">
                        <div class="detail-section">
                            <h4>Description</h4>
                            <p>${template.description}</p>
                        </div>
                        
                        ${template.parameters && template.parameters.length > 0 ? `
                            <div class="detail-section">
                                <h4>Parameters</h4>
                                <div class="parameters-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Type</th>
                                                <th>Required</th>
                                                <th>Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${template.parameters.map(param => `
                                                <tr>
                                                    <td><code>${param.name}</code></td>
                                                    <td>${param.type || 'string'}</td>
                                                    <td>${param.required ? 'Yes' : 'No'}</td>
                                                    <td>${param.description || '-'}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${template.kqlTemplate ? `
                            <div class="detail-section">
                                <h4>KQL Template</h4>
                                <pre class="code-block">${window.dataFormatter.highlightKQL(template.kqlTemplate)}</pre>
                            </div>
                        ` : ''}
                        
                        ${template.tags && template.tags.length > 0 ? `
                            <div class="detail-section">
                                <h4>Tags</h4>
                                <div class="template-tags">
                                    ${template.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary close-btn">Close</button>
                    <button class="btn-primary use-btn" data-template-id="${template.id}">Use Template</button>
                </div>
            </div>
        `;

        // Bind events
        const closeModal = () => modal.remove();
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.close-btn').addEventListener('click', closeModal);
        modal.querySelector('.use-btn').addEventListener('click', () => {
            this.useTemplate(template.id);
            closeModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.body.appendChild(modal);
    }

    /**
     * Show panel and load templates if needed
     */
    async show() {
        if (this.templates.length === 0) {
            await this.loadTemplates();
        }
        this.panel.classList.add('active');
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
     * Refresh templates
     */
    async refresh() {
        this.templates = [];
        await this.loadTemplates();
    }

    showError(message) {
        this.templatesGrid.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <div class="error-title">Error</div>
                <div class="error-description">${message}</div>
                <button class="btn-secondary" onclick="window.templatePanel.refresh()">Try Again</button>
            </div>
        `;
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

// Global template panel instance
window.templatePanel = new TemplatePanel();