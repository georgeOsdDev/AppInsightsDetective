import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getServiceContainer, getConfigManager } from '../../../lib/serviceContainer';
import { QueryService } from '../../../../../services/QueryService';
import { IAIProvider, IDataSourceProvider } from '../../../../../core/interfaces';
import { DataSourceType } from '../../../../../core/types/ProviderTypes';
import { logger } from '../../../../../utils/logger';

/**
 * Request interface for generate query endpoint
 */
interface GenerateQueryRequest {
  userInput: string;
  mode?: 'smart' | 'review' | 'raw';
  dataSourceType?: DataSourceType;
  extraContext?: string;
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
    const { userInput, mode = 'smart', dataSourceType, extraContext }: GenerateQueryRequest = req.body;

    if (!userInput) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'userInput is required',
        code: 'MISSING_USER_INPUT'
      });
    }

    logger.info(`WebUI: Generating query for input: "${userInput}"`);

    // Get services
    const container = await getServiceContainer();
    const aiProvider = container.resolve<IAIProvider>('aiProvider');
    const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
    const configManager = getConfigManager();

    // Ensure AI provider is initialized
    await aiProvider.initialize();

    // Get schema if available
    let schema;
    try {
      const schemaResult = await dataSourceProvider.getSchema();
      schema = schemaResult.schema;
    } catch (error) {
      logger.warn('Could not retrieve schema for query generation:', error);
    }

    // Get data source type from config or request
    const config = configManager.getConfig();
    const finalDataSourceType = dataSourceType || config.providers.dataSources.default as DataSourceType;

    // Generate the query
    const nlQuery = await aiProvider.generateQuery({
      userInput,
      schema,
      dataSourceType: finalDataSourceType,
      extraContext
    });

    res.json({
      query: nlQuery.generatedKQL,
      confidence: nlQuery.confidence,
      reasoning: nlQuery.reasoning,
      mode: nlQuery.confidence >= 0.7 ? 'execute' : 'review',
      originalInput: userInput,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query generation failed:', error);
    res.status(500).json({
      error: 'Query generation failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'GENERATION_FAILED'
    });
  }
}

export default withAuth(handler);