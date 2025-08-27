/**
 * Template repository interface for managing query templates
 */

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
 * Prompt template definition for providing extra context to AI
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  contextTemplate: string;
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
 * Template repository interface for managing query templates
 */
export interface ITemplateRepository {
  /**
   * Get templates with optional filtering
   */
  getTemplates(filter?: TemplateFilter): Promise<QueryTemplate[]>;

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): Promise<QueryTemplate | null>;

  /**
   * Save a template
   */
  saveTemplate(template: QueryTemplate): Promise<void>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string): Promise<boolean>;

  /**
   * Search templates by query text
   */
  searchTemplates(query: string): Promise<QueryTemplate[]>;

  /**
   * Apply template parameters to generate a KQL query
   */
  applyTemplate(template: QueryTemplate, parameters: TemplateParameters): Promise<string>;

  /**
   * Get template categories
   */
  getCategories(): Promise<string[]>;

  /**
   * Initialize repository with basic templates
   */
  initialize(): Promise<void>;

  /**
   * Validate template structure
   */
  validateTemplate(template: QueryTemplate): void;

  /**
   * Get all prompt templates
   */
  getPromptTemplates(filter?: TemplateFilter): Promise<PromptTemplate[]>;

  /**
   * Get a specific prompt template by ID
   */
  getPromptTemplate(id: string): Promise<PromptTemplate | null>;

  /**
   * Save a prompt template
   */
  savePromptTemplate(template: PromptTemplate): Promise<void>;

  /**
   * Delete a prompt template
   */
  deletePromptTemplate(id: string): Promise<boolean>;

  /**
   * Apply prompt template parameters to generate context
   */
  applyPromptTemplate(template: PromptTemplate, parameters: TemplateParameters): Promise<string>;

  /**
   * Validate prompt template structure
   */
  validatePromptTemplate(template: PromptTemplate): void;
}