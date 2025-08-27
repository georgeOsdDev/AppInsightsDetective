import { 
  ITemplateRepository, 
  QueryTemplate, 
  PromptTemplate,
  TemplateFilter, 
  TemplateParameters 
} from '../core/interfaces/ITemplateRepository';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Template service for managing query templates
 * Implements ITemplateRepository for Phase 4 template system
 */
export class TemplateService implements ITemplateRepository {
  private templates = new Map<string, QueryTemplate>();
  private promptTemplates = new Map<string, PromptTemplate>();
  private initialized = false;

  constructor() {
    // Will be initialized when first accessed
  }

  /**
   * Initialize repository with basic templates
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.initializeBasicTemplates();
    await this.initializeBasicPromptTemplates();
    await this.loadUserTemplates();
    this.initialized = true;
  }

  /**
   * Get templates with optional filtering
   */
  async getTemplates(filter?: TemplateFilter): Promise<QueryTemplate[]> {
    await this.initialize();
    
    logger.debug('TemplateService: Getting templates with filter:', filter);

    let templates = Array.from(this.templates.values());

    if (filter) {
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }

      if (filter.tags && filter.tags.length > 0) {
        templates = templates.filter(t => 
          filter.tags!.some(tag => t.metadata.tags.includes(tag))
        );
      }

      if (filter.searchTerm) {
        const searchTerm = filter.searchTerm.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(searchTerm) ||
          t.description.toLowerCase().includes(searchTerm) ||
          t.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }
    }

    logger.info(`TemplateService: Found ${templates.length} templates`);
    return templates;
  }

  /**
   * Save a template
   */
  async saveTemplate(template: QueryTemplate): Promise<void> {
    await this.initialize();
    
    logger.info(`TemplateService: Saving template: ${template.id}`);

    // Validate template
    this.validateTemplate(template);

    // Update timestamps
    template.metadata.updatedAt = new Date();

    // Store in memory
    this.templates.set(template.id, template);

    // Save to file (user templates only - don't overwrite built-in templates)
    if (template.metadata.author !== 'System') {
      try {
        const userTemplatesDir = await this.getUserTemplatesDirectory();
        
        // Ensure directory exists
        await fs.mkdir(userTemplatesDir, { recursive: true });
        
        const filePath = path.join(userTemplatesDir, `${template.id}.json`);
        const templateJson = JSON.stringify(template, null, 2);
        
        await fs.writeFile(filePath, templateJson, 'utf-8');
        logger.debug(`TemplateService: Template saved to file: ${filePath}`);
      } catch (error) {
        logger.warn(`TemplateService: Failed to save template to file:`, error);
        // Don't fail the operation - template is still saved in memory
      }
    }

    logger.info(`TemplateService: Template saved successfully: ${template.id}`);
  }

  /**
   * Search templates by query text
   */
  async searchTemplates(query: string): Promise<QueryTemplate[]> {
    logger.debug(`TemplateService: Searching templates for: "${query}"`);

    return this.getTemplates({
      searchTerm: query
    });
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<QueryTemplate | null> {
    await this.initialize();
    
    const template = this.templates.get(id);
    if (!template) {
      logger.warn(`TemplateService: Template not found: ${id}`);
      return null;
    }
    return template;
  }

  /**
   * Apply template parameters to generate a KQL query
   */
  async applyTemplate(template: QueryTemplate, parameters: TemplateParameters): Promise<string> {
    logger.info(`TemplateService: Applying template: ${template.id}`);

    // Validate required parameters
    this.validateParameters(template, parameters);

    // Apply parameters to template
    let query = template.kqlTemplate;

    for (const param of template.parameters) {
      const value = parameters[param.name] ?? param.defaultValue;
      
      if (value !== undefined) {
        const placeholder = `{{${param.name}}}`;
        const formattedValue = this.formatParameterValue(value, param.type);
        query = query.replace(new RegExp(placeholder, 'g'), formattedValue);
      }
    }

    logger.info('TemplateService: Template applied successfully');
    return query;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    await this.initialize();
    
    const template = this.templates.get(id);
    if (!template) {
      logger.warn(`TemplateService: Template not found for deletion: ${id}`);
      return false;
    }

    // Don't allow deleting system templates
    if (template.metadata.author === 'System') {
      logger.warn(`TemplateService: Cannot delete system template: ${id}`);
      return false;
    }

    const existed = this.templates.delete(id);
    if (existed) {
      // Also delete the file if it exists
      try {
        const userTemplatesDir = await this.getUserTemplatesDirectory();
        const filePath = path.join(userTemplatesDir, `${id}.json`);
        await fs.unlink(filePath);
        logger.debug(`TemplateService: Template file deleted: ${filePath}`);
      } catch (error) {
        // File might not exist, that's okay
        logger.debug(`TemplateService: Template file not found for deletion: ${id}.json`);
      }

      logger.info(`TemplateService: Template deleted: ${id}`);
    } else {
      logger.warn(`TemplateService: Template not found for deletion: ${id}`);
    }
    return existed;
  }

  /**
   * Get template categories
   */
  async getCategories(): Promise<string[]> {
    await this.initialize();
    
    const categories = new Set(Array.from(this.templates.values()).map(t => t.category));
    return Array.from(categories).sort();
  }

  /**
   * Initialize basic templates
   */
  private async initializeBasicTemplates(): Promise<void> {
    const basicTemplates: QueryTemplate[] = [
      {
        id: 'requests-overview',
        name: 'Requests Overview',
        description: 'Get an overview of web requests over a time period',
        category: 'Performance',
        kqlTemplate: `requests
| where timestamp > ago({{timespan}})
| summarize 
    RequestCount = count(),
    AvgDuration = avg(duration),
    SuccessRate = round(100.0 * countif(success == true) / count(), 2)
by bin(timestamp, {{binSize}})
| order by timestamp desc`,
        parameters: [
          {
            name: 'timespan',
            type: 'timespan',
            description: 'Time period to analyze',
            required: true,
            defaultValue: '1h',
            validValues: ['15m', '1h', '6h', '1d', '7d']
          },
          {
            name: 'binSize', 
            type: 'timespan',
            description: 'Aggregation bin size',
            required: true,
            defaultValue: '5m',
            validValues: ['1m', '5m', '15m', '1h']
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['requests', 'performance', 'overview']
        }
      },
      {
        id: 'errors-analysis',
        name: 'Error Analysis',
        description: 'Analyze application exceptions and failures over time',
        category: 'Troubleshooting',
        kqlTemplate: `exceptions
| where timestamp > ago({{timespan}})
| summarize 
    ErrorCount = count(),
    UniqueErrors = dcount(type)
by bin(timestamp, {{binSize}}), type
| order by timestamp desc, ErrorCount desc`,
        parameters: [
          {
            name: 'timespan',
            type: 'timespan',
            description: 'Time period to analyze',
            required: true,
            defaultValue: '1h',
            validValues: ['15m', '1h', '6h', '1d', '7d']
          },
          {
            name: 'binSize',
            type: 'timespan', 
            description: 'Aggregation bin size',
            required: true,
            defaultValue: '5m',
            validValues: ['1m', '5m', '15m', '1h']
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['exceptions', 'errors', 'troubleshooting']
        }
      },
      {
        id: 'performance-insights',
        name: 'Performance Insights',
        description: 'Analyze application performance metrics and trends',
        category: 'Performance',
        kqlTemplate: `performanceCounters
| where timestamp > ago({{timespan}})
| where categoryName == "{{category}}"
| summarize 
    AvgValue = avg(value),
    MinValue = min(value),
    MaxValue = max(value),
    Count = count()
by bin(timestamp, {{binSize}}), counterName
| order by timestamp desc, AvgValue desc`,
        parameters: [
          {
            name: 'timespan',
            type: 'timespan',
            description: 'Time period to analyze',
            required: true,
            defaultValue: '1h',
            validValues: ['15m', '1h', '6h', '1d', '7d']
          },
          {
            name: 'category',
            type: 'string',
            description: 'Performance counter category',
            required: true,
            defaultValue: 'Process',
            validValues: ['Process', 'Memory', 'Processor', 'ASP.NET Applications']
          },
          {
            name: 'binSize',
            type: 'timespan',
            description: 'Aggregation bin size',
            required: true,
            defaultValue: '5m',
            validValues: ['1m', '5m', '15m', '1h']
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['performance', 'counters', 'metrics']
        }
      },
      {
        id: 'dependency-analysis',
        name: 'Dependency Analysis', 
        description: 'Analyze external dependency calls and their performance',
        category: 'Dependencies',
        kqlTemplate: `dependencies
| where timestamp > ago({{timespan}})
| summarize 
    CallCount = count(),
    AvgDuration = avg(duration),
    SuccessRate = round(100.0 * countif(success == true) / count(), 2),
    FailureCount = countif(success == false)
by bin(timestamp, {{binSize}}), type, target
| order by timestamp desc, CallCount desc`,
        parameters: [
          {
            name: 'timespan',
            type: 'timespan',
            description: 'Time period to analyze',
            required: true,
            defaultValue: '1h',
            validValues: ['15m', '1h', '6h', '1d', '7d']
          },
          {
            name: 'binSize',
            type: 'timespan',
            description: 'Aggregation bin size',
            required: true,
            defaultValue: '5m',
            validValues: ['1m', '5m', '15m', '1h']
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['dependencies', 'external', 'performance']
        }
      }
    ];

    for (const template of basicTemplates) {
      this.templates.set(template.id, template);
    }

    logger.info(`TemplateService: Initialized with ${basicTemplates.length} basic templates`);
  }

  /**
   * Initialize basic prompt templates for providing extra context to AI
   */
  private async initializeBasicPromptTemplates(): Promise<void> {
    const basicPromptTemplates: PromptTemplate[] = [
      {
        id: 'performance-focus',
        name: 'Performance Analysis Focus',
        description: 'Focus the AI on performance-related aspects of the query',
        category: 'Performance',
        contextTemplate: `Focus your analysis on performance metrics and optimization opportunities. Pay special attention to:
- Response times and latencies (especially values above {{threshold}} ms)
- Request volumes and patterns
- Resource utilization and bottlenecks
- Performance trends over the specified time period
- Opportunities for optimization

Consider the application context: {{appContext}}`,
        parameters: [
          {
            name: 'threshold',
            type: 'number',
            description: 'Response time threshold for performance alerts (milliseconds)',
            required: false,
            defaultValue: 1000
          },
          {
            name: 'appContext',
            type: 'string',
            description: 'Context about the application being analyzed',
            required: false,
            defaultValue: 'web application'
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['performance', 'optimization', 'analysis']
        }
      },
      {
        id: 'error-investigation',
        name: 'Error Investigation Focus',
        description: 'Guide the AI to focus on error analysis and troubleshooting',
        category: 'Debugging',
        contextTemplate: `Focus on identifying and analyzing errors, exceptions, and failure patterns. Consider:
- Error rates and trends
- Common failure modes and patterns
- Root cause indicators
- Error correlation across services
- User impact assessment

Environment context: {{environment}}
Time period of interest: {{timeContext}}`,
        parameters: [
          {
            name: 'environment',
            type: 'string',
            description: 'Environment being analyzed (prod, staging, dev, etc.)',
            required: false,
            defaultValue: 'production'
          },
          {
            name: 'timeContext',
            type: 'string',
            description: 'Specific time context for the analysis',
            required: false,
            defaultValue: 'recent activity'
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['error', 'debugging', 'troubleshooting']
        }
      },
      {
        id: 'user-experience',
        name: 'User Experience Analysis',
        description: 'Focus on user experience metrics and customer impact',
        category: 'User Experience',
        contextTemplate: `Analyze the data from a user experience perspective. Focus on:
- User journey and interaction patterns
- Performance impact on user experience
- Geographic distribution of users
- Device and browser usage patterns
- Customer satisfaction indicators

Target user segment: {{userSegment}}
Business priority: {{businessPriority}}`,
        parameters: [
          {
            name: 'userSegment',
            type: 'string',
            description: 'Target user segment being analyzed',
            required: false,
            defaultValue: 'all users'
          },
          {
            name: 'businessPriority',
            type: 'string',
            description: 'Current business priority or focus area',
            required: false,
            defaultValue: 'customer satisfaction'
          }
        ],
        metadata: {
          author: 'System',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['user-experience', 'customer', 'analytics']
        }
      }
    ];

    for (const template of basicPromptTemplates) {
      this.promptTemplates.set(template.id, template);
    }

    logger.info(`TemplateService: Initialized with ${basicPromptTemplates.length} basic prompt templates`);
  }

  /**
   * Get the user templates directory, preferring ~/.aidx/templates/user with fallback to project directory
   */
   private async getUserTemplatesDirectory(): Promise<string> {
    const homeDir = os.homedir();
    const aidxTemplatesDir = path.join(homeDir, '.aidx', 'templates', 'user');
    
    try {
      // Check if we can access the home directory
      await fs.access(homeDir);
      
      // Always prefer ~/.aidx/templates/user if home directory is accessible
      // The mkdir call in save/load will create the full path as needed
      return aidxTemplatesDir;
    } catch {
      // If home directory is not accessible, fall back to project directory
      return path.join(process.cwd(), 'templates', 'user');
    }
  }

  /**
   * Load user templates from the templates/user directory
   */
  private async loadUserTemplates(): Promise<void> {
    const userTemplatesDir = await this.getUserTemplatesDirectory();
    
    try {
      // Check if user templates directory exists
      await fs.access(userTemplatesDir);
      
      const files = await fs.readdir(userTemplatesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let loadedCount = 0;
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(userTemplatesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const templateData = JSON.parse(content);
          
          // Validate and create template
          if (templateData.id && templateData.name && templateData.kqlTemplate) {
            // Ensure metadata exists
            if (!templateData.metadata) {
              templateData.metadata = {
                author: 'User',
                version: '1.0.0',
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: []
              };
            } else {
              // Ensure dates are Date objects
              if (templateData.metadata.createdAt) {
                templateData.metadata.createdAt = new Date(templateData.metadata.createdAt);
              } else {
                templateData.metadata.createdAt = new Date();
              }
              
              if (templateData.metadata.updatedAt) {
                templateData.metadata.updatedAt = new Date(templateData.metadata.updatedAt);
              } else {
                templateData.metadata.updatedAt = new Date();
              }
            }

            // Ensure parameters array exists
            if (!templateData.parameters) {
              templateData.parameters = [];
            }

            const template: QueryTemplate = templateData;
            
            // Validate template
            this.validateTemplate(template);
            
            // Store template
            this.templates.set(template.id, template);
            loadedCount++;
            
            logger.debug(`TemplateService: Loaded user template: ${template.id} from ${file}`);
          } else {
            logger.warn(`TemplateService: Invalid template structure in ${file}`);
          }
        } catch (error) {
          logger.warn(`TemplateService: Failed to load template from ${file}:`, error);
        }
      }
      
      logger.info(`TemplateService: Loaded ${loadedCount} user template(s) from ${userTemplatesDir}`);
    } catch (error) {
      // Directory doesn't exist or can't be accessed - that's okay
      logger.debug(`TemplateService: User templates directory not found or not accessible: ${userTemplatesDir}`);
    }
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: QueryTemplate): void {
    if (!template.id || !template.name || !template.kqlTemplate) {
      throw new Error('Template must have id, name, and kqlTemplate');
    }

    // Validate parameters match template placeholders
    const placeholders = (template.kqlTemplate.match(/\{\{(\w+)\}\}/g) || [])
      .map(p => p.replace(/[{}]/g, ''));
    
    const paramNames = template.parameters.map(p => p.name);
    
    for (const placeholder of placeholders) {
      if (!paramNames.includes(placeholder)) {
        throw new Error(`Template parameter '${placeholder}' not defined in parameters list`);
      }
    }
  }

  /**
   * Validate parameters for template application
   */
  private validateParameters(template: QueryTemplate, parameters: TemplateParameters): void {
    for (const param of template.parameters) {
      if (param.required && !(param.name in parameters) && !param.defaultValue) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }

      const value = parameters[param.name];
      if (value !== undefined && param.validValues && !param.validValues.includes(value)) {
        throw new Error(`Invalid value '${value}' for parameter '${param.name}'. Valid values: ${param.validValues.join(', ')}`);
      }
    }
  }

  /**
   * Format parameter value based on type
   */
  private formatParameterValue(value: any, type: string): string {
    switch (type) {
      case 'string':
        return String(value);  // Don't add quotes - let the template control quoting
      case 'datetime':
        if (value instanceof Date) {
          return `datetime(${value.toISOString()})`;
        }
        return `datetime(${value})`;
      case 'timespan':
      case 'number':
      default:
        return String(value);
    }
  }

  /**
   * Get all prompt templates
   */
  async getPromptTemplates(filter?: TemplateFilter): Promise<PromptTemplate[]> {
    await this.initialize();
    
    let templates = Array.from(this.promptTemplates.values());

    if (filter) {
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }

      if (filter.tags && filter.tags.length > 0) {
        templates = templates.filter(t => 
          filter.tags!.some(tag => t.metadata.tags.includes(tag))
        );
      }

      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term)
        );
      }
    }

    return templates;
  }

  /**
   * Get a specific prompt template by ID
   */
  async getPromptTemplate(id: string): Promise<PromptTemplate | null> {
    await this.initialize();
    return this.promptTemplates.get(id) || null;
  }

  /**
   * Save a prompt template
   */
  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    await this.initialize();
    
    this.validatePromptTemplate(template);
    this.promptTemplates.set(template.id, template);
    
    logger.info(`TemplateService: Saving prompt template: ${template.id}`);
    
    // Save to user templates directory
    const userTemplateDir = await this.getUserTemplatesDirectory();
    const promptTemplateDir = path.join(userTemplateDir, 'prompts');
    
    try {
      await fs.mkdir(promptTemplateDir, { recursive: true });
      const filePath = path.join(promptTemplateDir, `${template.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(template, null, 2));
      
      logger.info(`TemplateService: Prompt template saved successfully: ${template.id}`);
    } catch (error) {
      logger.error(`TemplateService: Failed to save prompt template ${template.id}:`, error);
      throw new Error(`Failed to save prompt template: ${error}`);
    }
  }

  /**
   * Delete a prompt template
   */
  async deletePromptTemplate(id: string): Promise<boolean> {
    await this.initialize();
    
    if (!this.promptTemplates.has(id)) {
      return false;
    }

    this.promptTemplates.delete(id);
    
    // Also delete from disk
    const userTemplateDir = await this.getUserTemplatesDirectory();
    const promptTemplateDir = path.join(userTemplateDir, 'prompts');
    const filePath = path.join(promptTemplateDir, `${id}.json`);
    
    try {
      await fs.unlink(filePath);
      logger.info(`TemplateService: Prompt template deleted: ${id}`);
    } catch (error) {
      logger.warn(`TemplateService: Could not delete prompt template file ${id}:`, error);
    }

    return true;
  }

  /**
   * Apply prompt template parameters to generate context
   */
  async applyPromptTemplate(template: PromptTemplate, parameters: TemplateParameters): Promise<string> {
    let context = template.contextTemplate;

    // Replace parameter placeholders
    for (const param of template.parameters) {
      const value = parameters[param.name];
      if (value !== undefined) {
        const formattedValue = this.formatParameterValue(value, param.type);
        // Use more specific placeholder patterns for prompts
        context = context.replace(
          new RegExp(`\\{\\{${param.name}\\}\\}`, 'g'), 
          formattedValue
        );
      } else if (param.required) {
        throw new Error(`Required parameter '${param.name}' not provided`);
      }
    }

    return context;
  }

  /**
   * Validate prompt template structure
   */
  validatePromptTemplate(template: PromptTemplate): void {
    if (!template.id || typeof template.id !== 'string') {
      throw new Error('Prompt template must have a valid ID');
    }

    if (!template.name || typeof template.name !== 'string') {
      throw new Error('Prompt template must have a valid name');
    }

    if (!template.description || typeof template.description !== 'string') {
      throw new Error('Prompt template must have a valid description');
    }

    if (!template.category || typeof template.category !== 'string') {
      throw new Error('Prompt template must have a valid category');
    }

    if (!template.contextTemplate || typeof template.contextTemplate !== 'string') {
      throw new Error('Prompt template must have a valid context template');
    }

    if (!Array.isArray(template.parameters)) {
      throw new Error('Prompt template must have a parameters array');
    }

    // Validate parameters
    for (const param of template.parameters) {
      if (!param.name || typeof param.name !== 'string') {
        throw new Error('Parameter must have a valid name');
      }

      if (!['string', 'number', 'datetime', 'timespan'].includes(param.type)) {
        throw new Error(`Parameter type must be one of: string, number, datetime, timespan`);
      }

      if (typeof param.required !== 'boolean') {
        throw new Error('Parameter required field must be boolean');
      }
    }

    if (!template.metadata || typeof template.metadata !== 'object') {
      throw new Error('Prompt template must have metadata');
    }
  }
}