import { logger } from '../utils/logger';

/**
 * Query template definition
 */
export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  kqlTemplate: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'datetime' | 'timespan';
    description: string;
    required: boolean;
    defaultValue?: any;
    validValues?: any[];
  }>;
  metadata: {
    author?: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
  };
}

/**
 * Template search criteria
 */
export interface TemplateFilter {
  category?: string;
  tags?: string[];
  searchTerm?: string;
}

/**
 * Template parameters for applying a template
 */
export interface TemplateParameters {
  [parameterName: string]: any;
}

/**
 * Template service for managing query templates
 * 
 * Note: This is a basic implementation for Phase 3. 
 * Full template system implementation is planned for Phase 4.
 */
export class TemplateService {
  private templates = new Map<string, QueryTemplate>();

  constructor() {
    // Initialize with some basic templates
    this.initializeBasicTemplates();
  }

  /**
   * Get templates with optional filtering
   */
  async getTemplates(filter?: TemplateFilter): Promise<QueryTemplate[]> {
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
    logger.info(`TemplateService: Saving template: ${template.id}`);

    // Validate template
    this.validateTemplate(template);

    // Update timestamps
    template.metadata.updatedAt = new Date();

    this.templates.set(template.id, template);
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
    const existed = this.templates.delete(id);
    if (existed) {
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
    const categories = new Set(Array.from(this.templates.values()).map(t => t.category));
    return Array.from(categories).sort();
  }

  /**
   * Initialize basic templates
   */
  private initializeBasicTemplates(): void {
    const basicTemplates: QueryTemplate[] = [
      {
        id: 'requests-overview',
        name: 'Requests Overview',
        description: 'Get an overview of requests over a time period',
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
          author: 'AppInsights Detective',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['requests', 'performance', 'overview']
        }
      }
    ];

    for (const template of basicTemplates) {
      this.templates.set(template.id, template);
    }

    logger.info(`TemplateService: Initialized with ${basicTemplates.length} basic templates`);
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: QueryTemplate): void {
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
        return `"${value}"`;
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
}