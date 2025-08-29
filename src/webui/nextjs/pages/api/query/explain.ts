import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { IAIProvider } from '../../../../../core/interfaces';
import { logger } from '../../../../../utils/logger';

/**
 * Request interface for explain query endpoint
 */
interface ExplainQueryRequest {
  query: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only POST method is allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { query }: ExplainQueryRequest = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'query is required',
        code: 'MISSING_QUERY'
      });
    }

    logger.info('WebUI: Generating query explanation');

    // Get services
    const container = await getServiceContainer();
    const aiProvider = container.resolve<IAIProvider>('aiProvider');

    // Use AI provider to explain the query
    const explanation = await aiProvider.explainQuery({ query });

    res.json({
      explanation: explanation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query explanation failed:', error);
    res.status(500).json({
      error: 'Query explanation failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'EXPLANATION_FAILED'
    });
  }
}

export default withAuth(handler);