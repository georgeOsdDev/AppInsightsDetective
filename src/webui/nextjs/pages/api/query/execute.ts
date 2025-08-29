import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { QueryService, QueryServiceRequest } from '../../../../../services/QueryService';
import { logger } from '../../../../../utils/logger';

/**
 * Request interface for execute query endpoint
 */
interface ExecuteQueryRequest {
  query: string;
  mode?: 'smart' | 'review' | 'raw';
  sessionId?: string;
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
    const { query, mode = 'smart', sessionId }: ExecuteQueryRequest = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'query is required',
        code: 'MISSING_QUERY'
      });
    }

    logger.info(`WebUI: Executing query in ${mode} mode`);

    const startTime = Date.now();

    // Get services
    const container = await getServiceContainer();
    const queryService = container.resolve<QueryService>('queryService');

    // Execute using QueryService for session management
    const queryRequest: QueryServiceRequest = {
      userInput: query,
      mode: mode === 'raw' ? 'raw' : 'direct',
      sessionId
    };

    const result = await queryService.executeQuery(queryRequest);
    const executionTime = Date.now() - startTime;

    res.json({
      result: result.result,
      executionTime,
      sessionId: result.session.sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query execution failed:', error);
    res.status(500).json({
      error: 'Query execution failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'EXECUTION_FAILED'
    });
  }
}

export default withAuth(handler);