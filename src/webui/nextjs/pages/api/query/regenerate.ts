import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer } from '../../../lib/serviceContainer';
import { IAIProvider, IDataSourceProvider } from '../../../../../core/interfaces';
import { DataSourceType } from '../../../../../core/types/ProviderTypes';
import { logger } from '../../../lib/logger';

/**
 * Request interface for regenerate query endpoint
 */
interface RegenerateQueryRequest {
  originalQuery: string;
  userInput: string;
  feedback: string;
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
    const { originalQuery, userInput, feedback }: RegenerateQueryRequest = req.body;

    if (!originalQuery || !userInput || !feedback) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'originalQuery, userInput, and feedback are required',
        code: 'MISSING_FIELDS'
      });
    }

    logger.info('WebUI: Regenerating query with feedback');

    // Get services
    const container = await getServiceContainer();
    const aiProvider = container.resolve<IAIProvider>('aiProvider');
    const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');

    // Get schema if available
    let schema;
    try {
      const schemaResult = await dataSourceProvider.getSchema();
      schema = schemaResult.schema;
    } catch (error) {
      logger.warn('Could not retrieve schema for query regeneration:', error);
    }

    // Use default data source type
    const dataSourceType = 'application-insights' as DataSourceType;

    // Create enhanced input with feedback
    const enhancedInput = `${userInput}\n\nFeedback on previous query: ${feedback}\nPrevious query: ${originalQuery}`;

    // Generate new query
    const nlQuery = await aiProvider.generateQuery({
      userInput: enhancedInput,
      schema,
      dataSourceType
    });

    res.json({
      query: nlQuery.generatedKQL,
      confidence: nlQuery.confidence,
      reasoning: nlQuery.reasoning,
      mode: nlQuery.confidence >= 0.7 ? 'execute' : 'review',
      originalInput: userInput,
      feedback,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query regeneration failed:', error);
    res.status(500).json({
      error: 'Query regeneration failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'REGENERATION_FAILED'
    });
  }
}

export default withAuth(handler);