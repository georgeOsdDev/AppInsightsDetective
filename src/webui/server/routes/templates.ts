import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { requireAuth } from '../middleware/auth';
import { TemplateService } from '../../../services/TemplateService';
import { logger } from '../../../utils/logger';

/**
 * Template-related interfaces
 */
interface UseTemplateRequest {
  parameters?: Record<string, any>;
}

/**
 * Create template-related API routes
 */
export function createTemplateRoutes(container: ServiceContainer): Router {
  const router = Router();
  
  // Apply authentication to all template routes
  router.use(requireAuth);

  const templateService = container.resolve<TemplateService>('templateService');

  /**
   * GET /api/templates - List available templates
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      logger.info('WebUI: Getting available templates');

      const templates = await templateService.getTemplates();

      const formattedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category || 'general',
        parameters: template.parameters || [],
        tags: template.metadata.tags || [],
        createdAt: template.metadata.createdAt,
        isUserTemplate: false // We don't have this info easily, default to false
      }));

      res.json({
        templates: formattedTemplates,
        count: formattedTemplates.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get templates failed:', error);
      res.status(500).json({
        error: 'Get templates failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'GET_TEMPLATES_FAILED'
      });
    }
  });

  /**
   * GET /api/templates/:id - Get template details
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const templateId = req.params.id;

      if (!templateId) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Template ID is required',
          code: 'MISSING_TEMPLATE_ID'
        });
      }

      logger.info(`WebUI: Getting template details for ${templateId}`);

      const template = await templateService.getTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          message: `Template ${templateId} not found`,
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      res.json({
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category || 'general',
          parameters: template.parameters || [],
          tags: template.metadata.tags || [],
          kqlTemplate: template.kqlTemplate,
          createdAt: template.metadata.createdAt,
          isUserTemplate: false // Default to false
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get template details failed:', error);
      res.status(500).json({
        error: 'Get template details failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'GET_TEMPLATE_FAILED'
      });
    }
  });

  /**
   * POST /api/templates/:id/use - Use template with parameters
   */
  router.post('/:id/use', async (req: Request, res: Response) => {
    try {
      const templateId = req.params.id;
      const { parameters = {} }: UseTemplateRequest = req.body;

      if (!templateId) {
        return res.status(400).json({
          error: 'Missing required parameter',
          message: 'Template ID is required',
          code: 'MISSING_TEMPLATE_ID'
        });
      }

      logger.info(`WebUI: Using template ${templateId} with parameters`);

      // Get the template
      const template = await templateService.getTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          message: `Template ${templateId} not found`,
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Use the template to generate a query
      const query = await templateService.applyTemplate(template, parameters);

      res.json({
        templateId,
        query: query,
        parameters: parameters,
        template: {
          name: template.name,
          description: template.description
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Use template failed:', error);
      res.status(500).json({
        error: 'Use template failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'USE_TEMPLATE_FAILED'
      });
    }
  });

  return router;
}