import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { Config } from '../../types';

export function createSetupCommand(): Command {
  const setupCommand = new Command('setup')
    .description('Setup AppInsights Detective configuration')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        await setupConfiguration(configManager);
      } catch (error) {
        logger.error('Setup failed:', error);
        Visualizer.displayError(`Setup failed: ${error}`);
        process.exit(1);
      }
    });

  return setupCommand;
}

/**
 * Setup configuration
 */
async function setupConfiguration(configManager: ConfigManager): Promise<void> {
  Visualizer.displayInfo('Setting up AppInsights Detective...');

  // Step 1: Choose AI Provider
  const aiProvider = await chooseAIProvider();
  
  // Step 2: Configure selected AI provider
  const aiConfig = await configureAIProvider(aiProvider);
  
  // Step 3: Choose Data Source Provider
  const dataSourceProvider = await chooseDataSourceProvider();
  
  // Step 4: Configure selected data source provider
  const dataSourceConfig = await configureDataSourceProvider(dataSourceProvider);
  
  // Step 5: Choose Authentication Provider
  const authProvider = await chooseAuthProvider();
  
  // Step 6: Configure selected auth provider
  const authConfig = await configureAuthProvider(authProvider);
  
  // Step 7: General Settings
  const generalSettings = await configureGeneralSettings();

  // Create configuration
  const config: Config = {
    providers: {
      ai: {
        default: aiProvider,
        [aiProvider]: aiConfig,
      },
      dataSources: {
        default: dataSourceProvider,
        [dataSourceProvider]: dataSourceConfig,
      },
      auth: {
        default: authProvider,
        [authProvider]: authConfig,
      },
    },
    logLevel: generalSettings.logLevel,
    language: generalSettings.language,
    fallbackBehavior: {
      enableProviderFallback: true,
      aiProviderOrder: [aiProvider],
      dataSourceProviderOrder: [dataSourceProvider],
    },
  };

  // Save configuration
  configManager.updateConfig(config);

  Visualizer.displaySuccess('Configuration saved successfully!');
  console.log(chalk.green('\n🎉 Setup Complete!'));
  console.log(chalk.dim('You can now use aidx to query your data sources with AI assistance.'));
  console.log();
  console.log(chalk.cyan('Quick start:'));
  console.log(chalk.dim('  aidx "show me errors from the last hour"'));
  console.log(chalk.dim('  aidx status'));
}

/**
 * Choose AI Provider
 */
async function chooseAIProvider(): Promise<string> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose your AI provider:',
      choices: [
        { name: '🔷 Azure OpenAI (Recommended)', value: 'azure-openai' },
        { name: '🟢 OpenAI', value: 'openai' },
      ],
    },
  ]);

  return provider;
}

/**
 * Configure AI Provider
 */
async function configureAIProvider(provider: string): Promise<any> {
  switch (provider) {
    case 'azure-openai':
      return await configureAzureOpenAI();
    case 'openai':
      return await configureOpenAI();
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Configure Azure OpenAI
 */
async function configureAzureOpenAI(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter your Azure OpenAI endpoint:',
      validate: (input) => input.trim() !== '' || 'Azure OpenAI endpoint is required',
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Enter your deployment name:',
      default: 'gpt-4',
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your API key (optional for managed identity):',
    },
  ]);

  return {
    type: 'azure-openai',
    endpoint: answers.endpoint,
    deploymentName: answers.deploymentName,
    ...(answers.apiKey && { apiKey: answers.apiKey }),
  };
}

/**
 * Configure OpenAI
 */
async function configureOpenAI(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your OpenAI API key:',
      validate: (input) => input.trim() !== '' || 'OpenAI API key is required',
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter OpenAI endpoint:',
      default: 'https://api.openai.com/v1',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select OpenAI model:',
      choices: [
        { name: 'GPT-5 (Latest Model)', value: 'gpt-5' },
        { name: 'GPT-5 Mini (Fast GPT-5)', value: 'gpt-5-mini' },
        { name: 'GPT-5 Nano (Ultra Fast GPT-5)', value: 'gpt-5-nano' },
        { name: 'GPT-OSS 120B (Open Source 120B)', value: 'gpt-oss-120b' },
        { name: 'GPT-OSS 20B (Open Source 20B)', value: 'gpt-oss-20b' },
        { name: 'o1-preview (Latest Reasoning Model)', value: 'o1-preview' },
        { name: 'o1-mini (Fast Reasoning Model)', value: 'o1-mini' },
        { name: 'GPT-4o (2024-11-20) - Latest', value: 'gpt-4o-2024-11-20' },
        { name: 'GPT-4o (2024-08-06)', value: 'gpt-4o-2024-08-06' },
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini (Fast & Cost-effective)', value: 'gpt-4o-mini' },
        { name: 'GPT-4.1 (Enhanced GPT-4)', value: 'gpt-4.1' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ],
      default: 'gpt-4o-mini',
    },
  ]);

  return {
    type: 'openai',
    endpoint: answers.endpoint,
    apiKey: answers.apiKey,
    model: answers.model,
  };
}

/**
 * Choose Data Source Provider
 */
async function chooseDataSourceProvider(): Promise<string> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose your data source:',
      choices: [
        { name: '📊 Application Insights (Recommended)', value: 'application-insights' },
        { name: '📈 Log Analytics', value: 'log-analytics' },
        { name: '🔍 Azure Data Explorer', value: 'azure-data-explorer' },
      ],
    },
  ]);

  return provider;
}

/**
 * Configure Data Source Provider
 */
async function configureDataSourceProvider(provider: string): Promise<any> {
  switch (provider) {
    case 'application-insights':
      return await configureApplicationInsights();
    case 'log-analytics':
      return await configureLogAnalytics();
    case 'azure-data-explorer':
      return await configureAzureDataExplorer();
    default:
      throw new Error(`Unsupported data source provider: ${provider}`);
  }
}

/**
 * Configure Application Insights
 */
async function configureApplicationInsights(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'applicationId',
      message: 'Enter your Application Insights Application ID:',
      validate: (input) => input.trim() !== '' || 'Application ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input) => input.trim() !== '' || 'Tenant ID is required',
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter Application Insights endpoint:',
      default: 'https://api.applicationinsights.io/v1/apps',
    },
  ]);

  return {
    type: 'application-insights',
    applicationId: answers.applicationId,
    tenantId: answers.tenantId,
    endpoint: answers.endpoint,
  };
}

/**
 * Configure Log Analytics
 */
async function configureLogAnalytics(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceId',
      message: 'Enter your Log Analytics Workspace ID:',
      validate: (input) => input.trim() !== '' || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input) => input.trim() !== '' || 'Tenant ID is required',
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter Log Analytics endpoint:',
      default: 'https://api.loganalytics.io/v1/workspaces',
    },
  ]);

  const config = {
    type: 'log-analytics',
    workspaceId: answers.workspaceId,
    tenantId: answers.tenantId,
    endpoint: answers.endpoint,
  };

  // Try to auto-discover missing resource information
  try {
    Visualizer.displayInfo('Attempting to discover workspace resource information...');
    
    const { ResourceGraphService } = await import('../../services/resourceGraphService');
    const resourceGraphService = new ResourceGraphService();
    
    const resourceInfo = await resourceGraphService.getLogAnalyticsResourceInfo(answers.workspaceId);
    
    if (resourceInfo) {
      Visualizer.displaySuccess('Successfully discovered resource information!');
      return {
        ...config,
        subscriptionId: resourceInfo.subscriptionId,
        resourceGroup: resourceInfo.resourceGroup,
        resourceName: resourceInfo.resourceName,
      };
    } else {
      Visualizer.displayWarning('Could not auto-discover resource information. Please provide manually.');
    }
  } catch (error) {
    logger.debug('Auto-discovery failed:', error);
    Visualizer.displayWarning('Auto-discovery failed. Please provide resource information manually.');
  }

  // Fallback to manual input for required fields
  const resourceAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'subscriptionId',
      message: 'Enter your Azure Subscription ID:',
      validate: (input) => input.trim() !== '' || 'Subscription ID is required',
    },
    {
      type: 'input',
      name: 'resourceGroup',
      message: 'Enter your Resource Group name:',
      validate: (input) => input.trim() !== '' || 'Resource Group is required',
    },
    {
      type: 'input',
      name: 'resourceName',
      message: 'Enter your Log Analytics Workspace name:',
      validate: (input) => input.trim() !== '' || 'Workspace name is required',
    },
  ]);

  return {
    ...config,
    subscriptionId: resourceAnswers.subscriptionId,
    resourceGroup: resourceAnswers.resourceGroup,
    resourceName: resourceAnswers.resourceName,
  };
}

/**
 * Configure Azure Data Explorer
 */
async function configureAzureDataExplorer(): Promise<any> {
  const { clusterType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'clusterType',
      message: 'Choose your Azure Data Explorer cluster type:',
      choices: [
        { name: '🌐 Microsoft Help Cluster (Sample data)', value: 'help' },
        { name: '🔐 Private Enterprise Cluster', value: 'private' },
      ],
    },
  ]);

  if (clusterType === 'help') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clusterUri',
        message: 'Enter cluster URI:',
        default: 'https://help.kusto.windows.net',
        validate: (input) => input.trim() !== '' || 'Cluster URI is required',
      },
      {
        type: 'input',
        name: 'database',
        message: 'Enter database name:',
        default: 'Samples',
        validate: (input) => input.trim() !== '' || 'Database name is required',
      },
    ]);

    return {
      type: 'azure-data-explorer',
      clusterUri: answers.clusterUri,
      database: answers.database,
      requiresAuthentication: true, // All clusters require Azure AD authentication
    };
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clusterUri',
        message: 'Enter your Azure Data Explorer cluster URI:',
        validate: (input) => input.trim() !== '' || 'Cluster URI is required',
      },
      {
        type: 'input',
        name: 'database',
        message: 'Enter database name:',
        validate: (input) => input.trim() !== '' || 'Database name is required',
      },
      {
        type: 'input',
        name: 'tenantId',
        message: 'Enter your Azure Tenant ID:',
        validate: (input) => input.trim() !== '' || 'Tenant ID is required',
      },
    ]);

    return {
      type: 'azure-data-explorer',
      clusterUri: answers.clusterUri,
      database: answers.database,
      tenantId: answers.tenantId,
      requiresAuthentication: true,
    };
  }
}

/**
 * Choose Authentication Provider
 */
async function chooseAuthProvider(): Promise<string> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose your authentication method:',
      choices: [
        { name: '🔐 Azure Managed Identity (Recommended)', value: 'azure-managed-identity' },
      ],
    },
  ]);

  return provider;
}

/**
 * Configure Authentication Provider
 */
async function configureAuthProvider(provider: string): Promise<any> {
  switch (provider) {
    case 'azure-managed-identity':
      return await configureAzureManagedIdentity();
    default:
      throw new Error(`Unsupported auth provider: ${provider}`);
  }
}

/**
 * Configure Azure Managed Identity
 */
async function configureAzureManagedIdentity(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input) => input.trim() !== '' || 'Tenant ID is required',
    },
  ]);

  return {
    type: 'azure-managed-identity',
    tenantId: answers.tenantId,
  };
}

/**
 * Configure General Settings
 */
async function configureGeneralSettings(): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'logLevel',
      message: 'Select log level:',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Select your preferred language:',
      choices: [
        { name: '🌍 Auto-detect', value: 'auto' },
        { name: '🇺🇸 English', value: 'en' },
        { name: '🇯🇵 Japanese', value: 'ja' },
        { name: '🇰🇷 Korean', value: 'ko' },
        { name: '🇨🇳 Chinese', value: 'zh' },
        { name: '🇪🇸 Spanish', value: 'es' },
        { name: '🇫🇷 French', value: 'fr' },
        { name: '🇩🇪 German', value: 'de' },
      ],
      default: 'auto',
    },
  ]);

  return answers;
}