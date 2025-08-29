import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { TemplateService } from '../../../../../services/TemplateService';
import { logger } from '../../../lib/logger';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only GET method is allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    logger.info('WebUI: Getting available templates');

    // Get services
    const container = await getServiceContainer();
    const templateService = container.resolve<TemplateService>('templateService');

    const templates = await templateService.getTemplates();

    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category || 'general',
      parameters: template.parameters || [],
      tags: template.metadata.tags || [],
      createdAt: template.metadata.createdAt,
      isUserTemplate: false // Default to false for now
    }));

    res.json({
      templates: formattedTemplates,
      count: formattedTemplates.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get templates:', error);
    res.status(500).json({
      error: 'Template retrieval failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'TEMPLATE_RETRIEVAL_FAILED'
    });
  }
}

export default withAuth(handler);