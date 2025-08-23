import { TemplateService } from '../../src/services/TemplateService';
import { QueryTemplate, TemplateParameters } from '../../src/core/interfaces/ITemplateRepository';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with basic templates', async () => {
      const templates = await templateService.getTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0].id).toBe('requests-overview');
    });

    it('should only initialize once', async () => {
      // Call twice to ensure initialization only happens once
      await templateService.getTemplates();
      const templates = await templateService.getTemplates();
      expect(templates.length).toBe(2); // Should have 2 basic templates
    });
  });

  describe('Template CRUD operations', () => {
    const testTemplate: QueryTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      category: 'Testing',
      kqlTemplate: 'requests | where timestamp > ago({{timespan}}) | take {{limit}}',
      parameters: [
        {
          name: 'timespan',
          type: 'timespan',
          description: 'Time period',
          required: true,
          defaultValue: '1h'
        },
        {
          name: 'limit',
          type: 'number', 
          description: 'Row limit',
          required: false,
          defaultValue: 100
        }
      ],
      metadata: {
        author: 'Test Author',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test', 'example']
      }
    };

    it('should save a template', async () => {
      await templateService.saveTemplate(testTemplate);
      const savedTemplate = await templateService.getTemplate(testTemplate.id);
      expect(savedTemplate).toEqual(testTemplate);
    });

    it('should get all templates', async () => {
      await templateService.saveTemplate(testTemplate);
      const templates = await templateService.getTemplates();
      expect(templates.length).toBeGreaterThan(2);
      expect(templates.some(t => t.id === testTemplate.id)).toBe(true);
    });

    it('should filter templates by category', async () => {
      await templateService.saveTemplate(testTemplate);
      const templates = await templateService.getTemplates({ category: 'Testing' });
      expect(templates.length).toBe(1);
      expect(templates[0].id).toBe(testTemplate.id);
    });

    it('should filter templates by tags', async () => {
      await templateService.saveTemplate(testTemplate);
      const templates = await templateService.getTemplates({ tags: ['test'] });
      expect(templates.length).toBe(1);
      expect(templates[0].id).toBe(testTemplate.id);
    });

    it('should search templates by name and description', async () => {
      await templateService.saveTemplate(testTemplate);
      const templates = await templateService.searchTemplates('Test Template');
      expect(templates.length).toBe(1);
      expect(templates[0].id).toBe(testTemplate.id);
    });

    it('should delete a template', async () => {
      await templateService.saveTemplate(testTemplate);
      const deleted = await templateService.deleteTemplate(testTemplate.id);
      expect(deleted).toBe(true);
      
      const template = await templateService.getTemplate(testTemplate.id);
      expect(template).toBeNull();
    });

    it('should return false when deleting non-existent template', async () => {
      const deleted = await templateService.deleteTemplate('non-existent');
      expect(deleted).toBe(false);
    });

    it('should get template categories', async () => {
      await templateService.saveTemplate(testTemplate);
      const categories = await templateService.getCategories();
      expect(categories).toContain('Testing');
      expect(categories).toContain('Performance');
      expect(categories).toContain('Troubleshooting');
    });
  });

  describe('Template application', () => {
    const testTemplate: QueryTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      category: 'Testing',
      kqlTemplate: 'requests | where timestamp > ago({{timespan}}) | take {{limit}} | where name contains "{{name}}"',
      parameters: [
        {
          name: 'timespan',
          type: 'timespan',
          description: 'Time period',
          required: true,
          defaultValue: '1h'
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Row limit', 
          required: false,
          defaultValue: 100
        },
        {
          name: 'name',
          type: 'string',
          description: 'Request name filter',
          required: true,
          defaultValue: undefined
        }
      ],
      metadata: {
        author: 'Test Author',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['test']
      }
    };

    beforeEach(async () => {
      await templateService.saveTemplate(testTemplate);
    });

    it('should apply template with all parameters', async () => {
      const parameters: TemplateParameters = {
        timespan: '2h',
        limit: 50,
        name: 'api-call'
      };

      const query = await templateService.applyTemplate(testTemplate, parameters);
      expect(query).toBe('requests | where timestamp > ago(2h) | take 50 | where name contains "api-call"');
    });

    it('should apply template with default values', async () => {
      const parameters: TemplateParameters = {
        name: 'api-call'
      };

      const query = await templateService.applyTemplate(testTemplate, parameters);
      expect(query).toBe('requests | where timestamp > ago(1h) | take 100 | where name contains "api-call"');
    });

    it('should throw error for missing required parameter', async () => {
      const parameters: TemplateParameters = {
        timespan: '2h',
        limit: 50
        // Missing required 'name' parameter
      };

      await expect(templateService.applyTemplate(testTemplate, parameters))
        .rejects.toThrow("Required parameter 'name' is missing");
    });

    it('should validate parameter values', async () => {
      const templateWithValidValues = {
        ...testTemplate,
        parameters: [
          {
            name: 'level',
            type: 'string' as const,
            description: 'Log level',
            required: true,
            validValues: ['error', 'warning', 'info']
          }
        ],
        kqlTemplate: 'traces | where severityLevel == "{{level}}"'
      };

      await templateService.saveTemplate(templateWithValidValues);

      const validParameters = { level: 'error' };
      const query = await templateService.applyTemplate(templateWithValidValues, validParameters);
      expect(query).toBe('traces | where severityLevel == "error"');

      const invalidParameters = { level: 'debug' };
      await expect(templateService.applyTemplate(templateWithValidValues, invalidParameters))
        .rejects.toThrow("Invalid value 'debug' for parameter 'level'");
    });
  });

  describe('Template validation', () => {
    it('should validate template structure', () => {
      const validTemplate: QueryTemplate = {
        id: 'valid',
        name: 'Valid Template',
        description: 'A valid template',
        category: 'Test',
        kqlTemplate: 'requests | where timestamp > ago({{timespan}})',
        parameters: [{
          name: 'timespan',
          type: 'timespan',
          description: 'Time period',
          required: true
        }],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: []
        }
      };

      expect(() => templateService.validateTemplate(validTemplate)).not.toThrow();
    });

    it('should reject template without required fields', () => {
      const invalidTemplate = {
        id: '',
        name: 'Invalid',
        description: 'Missing id',
        category: 'Test',
        kqlTemplate: 'requests | count',
        parameters: [],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: []
        }
      } as QueryTemplate;

      expect(() => templateService.validateTemplate(invalidTemplate))
        .toThrow('Template must have id, name, and kqlTemplate');
    });

    it('should validate parameter placeholders match parameters', () => {
      const invalidTemplate: QueryTemplate = {
        id: 'invalid-params',
        name: 'Invalid Parameters',
        description: 'Parameters dont match placeholders',
        category: 'Test',
        kqlTemplate: 'requests | where timestamp > ago({{timespan}}) | take {{limit}}',
        parameters: [{
          name: 'timespan',
          type: 'timespan',
          description: 'Time period',
          required: true
        }],
        // Missing 'limit' parameter definition
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: []
        }
      };

      expect(() => templateService.validateTemplate(invalidTemplate))
        .toThrow("Template parameter 'limit' not defined in parameters list");
    });
  });
});