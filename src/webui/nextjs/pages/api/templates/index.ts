import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
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

    // TODO: Replace with actual TemplateService implementation
    // For now, return mock templates
    const mockTemplates = [
      {
        id: 'requests-overview',
        name: 'Requests Overview',
        description: 'Get an overview of HTTP requests in the last hour',
        category: 'monitoring',
        parameters: [],
        tags: ['http', 'requests', 'overview'],
        createdAt: new Date().toISOString(),
        isUserTemplate: false,
        query: 'requests | where timestamp >= ago(1h) | summarize count() by bin(timestamp, 5m) | render timechart'
      },
      {
        id: 'error-analysis',
        name: 'Error Analysis',
        description: 'Analyze error patterns and trends',
        category: 'troubleshooting',
        parameters: [],
        tags: ['errors', 'troubleshooting', 'analysis'],
        createdAt: new Date().toISOString(),
        isUserTemplate: false,
        query: 'requests | where timestamp >= ago(1h) | where success == false | summarize count() by resultCode | render barchart'
      },
      {
        id: 'performance-metrics',
        name: 'Performance Metrics',
        description: 'Monitor application performance metrics',
        category: 'performance',
        parameters: [],
        tags: ['performance', 'metrics', 'monitoring'],
        createdAt: new Date().toISOString(),
        isUserTemplate: false,
        query: 'requests | where timestamp >= ago(1h) | summarize avg(duration) by bin(timestamp, 5m) | render timechart'
      }
    ];

    res.json({
      templates: mockTemplates,
      count: mockTemplates.length,
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