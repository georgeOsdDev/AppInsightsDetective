import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { logger } from '../../../lib/logger';

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

    // TODO: Replace with actual QueryService implementation
    // For now, return mock execution results
    const mockResults = {
      columns: [
        { name: 'timestamp', type: 'datetime' },
        { name: 'name', type: 'string' },
        { name: 'count_', type: 'long' }
      ],
      rows: [
        ['2023-12-01T10:00:00Z', 'GET /api/users', 42],
        ['2023-12-01T10:05:00Z', 'POST /api/login', 15],
        ['2023-12-01T10:10:00Z', 'GET /api/data', 28]
      ]
    };

    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: mockResults,
      executionTimeMs: executionTime,
      query,
      mode,
      sessionId,
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