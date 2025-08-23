import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import chalk from 'chalk';
import { MultiProviderConfig } from '../../types';

export function createSetupCommand(): Command {
  const setupCommand = new Command('setup')
    .description('Setup AppInsights Detective configuration')
    .option('--legacy', 'Use legacy single-provider configuration format')
    .option('--migrate', 'Migrate existing legacy configuration to multi-provider format')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        
        if (options.migrate) {
          await migrateConfiguration(configManager);
        } else if (options.legacy) {
          await setupLegacyConfiguration(configManager);
        } else {
          await setupMultiProviderConfiguration(configManager);
        }
        
      } catch (error) {
        logger.error('Setup failed:', error);
        Visualizer.displayError(`Setup failed: ${error}`);
        process.exit(1);
      }
    });

  return setupCommand;
}

/**
 * Setup new multi-provider configuration
 */
async function setupMultiProviderConfiguration(configManager: ConfigManager): Promise<void> {
  Visualizer.displayInfo('Setting up AppInsights Detective with multi-provider support...');
  console.log(chalk.dim('This will create a new configuration supporting multiple AI and data source providers.\n'));

  // Step 1: Choose AI Provider
  const aiProvider = await chooseAIProvider();
  const aiConfig = await configureAIProvider(aiProvider);

  // Step 2: Choose Data Source Provider  
  const dataSourceProvider = await chooseDataSourceProvider();
  const dataSourceConfig = await configureDataSourceProvider(dataSourceProvider);

  // Step 3: Auth Provider (automatically chosen based on data source)
  const authProvider = getRecommendedAuthProvider(dataSourceProvider);
  const authConfig = await configureAuthProvider(authProvider, dataSourceConfig);

  // Step 4: General Settings
  const generalSettings = await configureGeneralSettings();

  // Create multi-provider configuration
  const multiProviderConfig: MultiProviderConfig = {
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
  configManager.updateMultiProviderConfig(multiProviderConfig);

  Visualizer.displaySuccess('Multi-provider configuration saved successfully!');
  console.log(chalk.green('\n🎉 Setup Complete!'));
  console.log(chalk.dim('You can now use aidx to query your data sources with AI assistance.'));
  console.log();
  console.log(chalk.cyan('Quick start:'));
  console.log(chalk.white('  aidx status') + chalk.dim('                   # Check configuration'));
  console.log(chalk.white('  aidx list-providers') + chalk.dim('          # View available providers'));
  console.log(chalk.white('  aidx "show me errors"') + chalk.dim('        # Ask a natural language question'));
  console.log(chalk.white('  aidx --interactive') + chalk.dim('           # Interactive mode with guided assistance'));
}

/**
 * Setup legacy single-provider configuration
 */
async function setupLegacyConfiguration(configManager: ConfigManager): Promise<void> {
  Visualizer.displayInfo('Setting up AppInsights Detective (legacy mode)...');
  console.log(chalk.yellow('Note: Using legacy configuration format. Consider using multi-provider setup for more flexibility.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'applicationId',
      message: 'Enter your Application Insights Application ID:',
      validate: (input: string) => input.length > 0 || 'Application ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input: string) => input.length > 0 || 'Tenant ID is required',
    },
    {
      type: 'input',
      name: 'openaiEndpoint',
      message: 'Enter your Azure OpenAI endpoint:',
      validate: (input: string) => {
        if (!input.length) return 'OpenAI endpoint is required';
        if (!input.startsWith('https://')) return 'Endpoint must start with https://';
        return true;
      },
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Enter your OpenAI deployment name (default: gpt-4):',
      default: 'gpt-4',
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Select log level:',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    },
  ]);

  configManager.updateConfig({
    appInsights: {
      applicationId: answers.applicationId,
      tenantId: answers.tenantId,
    },
    openAI: {
      endpoint: answers.openaiEndpoint,
      deploymentName: answers.deploymentName,
    },
    logLevel: answers.logLevel,
  });

  Visualizer.displaySuccess('Legacy configuration saved successfully!');
  console.log(chalk.dim('Consider running "aidx setup --migrate" to upgrade to multi-provider format.'));
}

/**
 * Migrate existing configuration to multi-provider format
 */
async function migrateConfiguration(configManager: ConfigManager): Promise<void> {
  if (configManager.hasMultiProviderConfig()) {
    Visualizer.displayInfo('Configuration is already in multi-provider format.');
    return;
  }

  Visualizer.displayInfo('Migrating configuration to multi-provider format...');
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'This will convert your configuration to the new multi-provider format. Continue?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('Migration cancelled.'));
    return;
  }

  // The migration happens automatically when loading legacy config
  // Just trigger a save in the new format
  const multiConfig = configManager.getMultiProviderConfig();
  configManager.updateMultiProviderConfig(multiConfig);

  Visualizer.displaySuccess('Configuration migrated successfully!');
  console.log(chalk.green('✅ Your configuration has been upgraded to multi-provider format.'));
  console.log(chalk.dim('A backup of your original configuration has been saved as config.legacy.json'));
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
        {
          name: '🔷 Azure OpenAI - Recommended for enterprise with managed identity support',
          value: 'azure-openai',
          short: 'Azure OpenAI',
        },
        {
          name: '🤖 OpenAI - Direct API access to OpenAI services',
          value: 'openai',
          short: 'OpenAI',
        },
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

async function configureAzureOpenAI(): Promise<any> {
  console.log(chalk.cyan.bold('\n🔷 Azure OpenAI Configuration'));
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter your Azure OpenAI endpoint:',
      validate: (input: string) => {
        if (!input.length) return 'Endpoint is required';
        if (!input.startsWith('https://')) return 'Endpoint must start with https://';
        return true;
      },
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Enter your deployment name:',
      default: 'gpt-4',
    },
    {
      type: 'confirm',
      name: 'useApiKey',
      message: 'Do you want to use an API key instead of managed identity?',
      default: false,
    },
  ]);

  const config: any = {
    type: 'azure-openai',
    endpoint: answers.endpoint,
    deploymentName: answers.deploymentName,
  };

  if (answers.useApiKey) {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Azure OpenAI API key:',
        validate: (input: string) => input.length > 0 || 'API key is required',
      },
    ]);
    config.apiKey = apiKey;
  }

  return config;
}

async function configureOpenAI(): Promise<any> {
  console.log(chalk.cyan.bold('\n🤖 OpenAI Configuration'));
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your OpenAI API key:',
      validate: (input: string) => input.length > 0 || 'API key is required',
    },
    {
      type: 'list',
      name: 'model',
      message: 'Select OpenAI model:',
      choices: [
        { name: 'GPT-4 (Recommended)', value: 'gpt-4' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ],
      default: 'gpt-4',
    },
  ]);

  return {
    type: 'openai',
    endpoint: 'https://api.openai.com/v1',
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
      message: 'Choose your data source provider:',
      choices: [
        {
          name: '📊 Application Insights - Application telemetry and performance data',
          value: 'application-insights',
          short: 'Application Insights',
        },
        {
          name: '📋 Log Analytics - Comprehensive log analysis and monitoring',
          value: 'log-analytics',
          short: 'Log Analytics',
        },
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
    default:
      throw new Error(`Unsupported data source provider: ${provider}`);
  }
}

async function configureApplicationInsights(): Promise<any> {
  console.log(chalk.cyan.bold('\n📊 Application Insights Configuration'));
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'applicationId',
      message: 'Enter your Application Insights Application ID:',
      validate: (input: string) => input.length > 0 || 'Application ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input: string) => input.length > 0 || 'Tenant ID is required',
    },
  ]);

  return {
    type: 'application-insights',
    applicationId: answers.applicationId,
    tenantId: answers.tenantId,
    endpoint: 'https://api.applicationinsights.io/v1/apps',
  };
}

async function configureLogAnalytics(): Promise<any> {
  console.log(chalk.cyan.bold('\n📋 Log Analytics Configuration'));
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceId',
      message: 'Enter your Log Analytics Workspace ID:',
      validate: (input: string) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Enter your Azure Tenant ID:',
      validate: (input: string) => input.length > 0 || 'Tenant ID is required',
    },
  ]);

  return {
    type: 'log-analytics',
    workspaceId: answers.workspaceId,
    tenantId: answers.tenantId,
    endpoint: 'https://api.loganalytics.io/v1/workspaces',
  };
}

/**
 * Get recommended auth provider based on data source
 */
function getRecommendedAuthProvider(dataSourceProvider: string): string {
  // For Azure services, always recommend managed identity
  if (dataSourceProvider.includes('azure') || 
      dataSourceProvider === 'application-insights' || 
      dataSourceProvider === 'log-analytics') {
    return 'azure-managed-identity';
  }
  
  return 'azure-managed-identity'; // Default for now
}

/**
 * Configure Auth Provider
 */
async function configureAuthProvider(provider: string, dataSourceConfig: any): Promise<any> {
  switch (provider) {
    case 'azure-managed-identity':
      return await configureAzureManagedIdentity(dataSourceConfig);
    default:
      throw new Error(`Unsupported auth provider: ${provider}`);
  }
}

async function configureAzureManagedIdentity(dataSourceConfig: any): Promise<any> {
  console.log(chalk.cyan.bold('\n🔐 Azure Managed Identity Configuration'));
  console.log(chalk.dim('Using Azure Managed Identity for secure, passwordless authentication.'));
  
  return {
    type: 'azure-managed-identity',
    tenantId: dataSourceConfig.tenantId,
  };
}

/**
 * Configure general settings
 */
async function configureGeneralSettings(): Promise<any> {
  console.log(chalk.cyan.bold('\n⚙️ General Settings'));
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'logLevel',
      message: 'Select log level:',
      choices: [
        { name: 'Debug - Detailed logging for troubleshooting', value: 'debug' },
        { name: 'Info - General information (Recommended)', value: 'info' },
        { name: 'Warn - Only warnings and errors', value: 'warn' },
        { name: 'Error - Only errors', value: 'error' },
      ],
      default: 'info',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Default language for explanations:',
      choices: [
        { name: 'Auto-detect', value: 'auto' },
        { name: 'English', value: 'en' },
        { name: 'Japanese (日本語)', value: 'ja' },
        { name: 'Korean (한국어)', value: 'ko' },
        { name: 'Chinese (中文)', value: 'zh' },
      ],
      default: 'auto',
    },
  ]);

  return answers;
}
