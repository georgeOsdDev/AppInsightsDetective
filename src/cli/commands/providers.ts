import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

/**
 * Create provider management command
 */
export function createProvidersCommand(): Command {
  const providersCommand = new Command('providers')
    .description('Manage and configure providers')
    .alias('provider');

  // Set default provider command
  providersCommand
    .command('set-default <type> <providerId>')
    .description('Set the default provider for a specific type')
    .option('--no-confirm', 'Skip confirmation prompt')
    .action(async (type, providerId, options) => {
      try {
        const configManager = new ConfigManager();
        
        // Validate type
        const validTypes = ['ai', 'dataSources', 'auth'];
        if (!validTypes.includes(type)) {
          Visualizer.displayError(`Invalid provider type. Valid types: ${validTypes.join(', ')}`);
          process.exit(1);
        }

        // Check if provider exists
        const availableProviders = configManager.getAvailableProviders(type as any);
        if (!availableProviders.includes(providerId)) {
          Visualizer.displayError(`Provider '${providerId}' not found. Available providers: ${availableProviders.join(', ')}`);
          process.exit(1);
        }

        // Confirm change
        if (!options.noConfirm) {
          const currentDefault = configManager.getDefaultProvider(type as any);
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Change default ${type} provider from '${currentDefault}' to '${providerId}'?`,
              default: true,
            },
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }
        }

        // Set new default
        configManager.setDefaultProvider(type as any, providerId);
        
        Visualizer.displaySuccess(`Default ${type} provider set to '${providerId}'`);

      } catch (error) {
        logger.error('Failed to set default provider:', error);
        Visualizer.displayError(`Failed to set default provider: ${error}`);
        process.exit(1);
      }
    });

  // Configure provider command
  providersCommand
    .command('configure <type> <providerId>')
    .description('Configure a specific provider')
    .action(async (type, providerId) => {
      try {
        const configManager = new ConfigManager();
        
        // Validate type
        const validTypes = ['ai', 'dataSources', 'auth'];
        if (!validTypes.includes(type)) {
          Visualizer.displayError(`Invalid provider type. Valid types: ${validTypes.join(', ')}`);
          process.exit(1);
        }

        console.log(chalk.cyan.bold(`\n⚙️ Configuring ${type} provider: ${providerId}`));
        
        // Get current configuration
        const currentConfig = configManager.getProviderConfig(type as any, providerId) || {};
        
        // Configure based on provider type and ID
        let newConfig: any;
        
        switch (`${type}:${providerId}`) {
          case 'ai:azure-openai':
            newConfig = await configureAzureOpenAI(currentConfig);
            break;
          case 'ai:openai':
            newConfig = await configureOpenAI(currentConfig);
            break;
          case 'dataSources:application-insights':
            newConfig = await configureApplicationInsights(currentConfig);
            break;
          case 'dataSources:log-analytics':
            newConfig = await configureLogAnalytics(currentConfig);
            break;
          case 'auth:azure-managed-identity':
            newConfig = await configureAzureManagedIdentity(currentConfig);
            break;
          default:
            throw new Error(`Configuration for ${type}:${providerId} is not supported yet`);
        }

        // Update configuration
        configManager.updateProviderConfig(type as any, providerId, newConfig);
        
        Visualizer.displaySuccess(`Provider '${providerId}' configured successfully!`);

      } catch (error) {
        logger.error('Failed to configure provider:', error);
        Visualizer.displayError(`Failed to configure provider: ${error}`);
        process.exit(1);
      }
    });

  // Show current configuration
  providersCommand
    .command('show')
    .description('Show current provider configuration')
    .option('--type <type>', 'Filter by provider type (ai|dataSources|auth)')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        
        const config = configManager.getConfig();
        const providerTypes = options.type ? [options.type] : ['ai', 'dataSources', 'auth'];

        console.log(chalk.cyan.bold('\n🔧 Current Provider Configuration:'));
        console.log(chalk.dim('='.repeat(50)));

        for (const type of providerTypes) {
          const typeConfig = config.providers[type as keyof typeof config.providers];
          const defaultProvider = typeConfig.default;
          
          console.log(chalk.white.bold(`\n${getProviderTypeLabel(type)}:`));
          console.log(chalk.green(`  Default: ${defaultProvider} ✅`));
          
          const providers = Object.keys(typeConfig).filter(key => key !== 'default');
          providers.forEach(providerId => {
            const isDefault = providerId === defaultProvider;
            const status = isDefault ? chalk.green('(default)') : chalk.dim('(available)');
            const providerConfig = typeConfig[providerId];
            
            console.log(`  ${isDefault ? '✅' : '⚙️ '} ${providerId} ${status}`);
            
            // Show key configuration details
            if (providerConfig.endpoint) {
              console.log(chalk.dim(`     Endpoint: ${providerConfig.endpoint}`));
            }
            if (providerConfig.applicationId) {
              console.log(chalk.dim(`     Application ID: ${providerConfig.applicationId}`));
            }
            if (providerConfig.workspaceId) {
              console.log(chalk.dim(`     Workspace ID: ${providerConfig.workspaceId}`));
            }
            if (providerConfig.deploymentName || providerConfig.model) {
              console.log(chalk.dim(`     Model: ${providerConfig.deploymentName || providerConfig.model}`));
            }
            if (providerConfig.tenantId) {
              console.log(chalk.dim(`     Tenant ID: ${providerConfig.tenantId.substring(0, 8)}...`));
            }
          });
        }

        // Show fallback behavior
        if (config.fallbackBehavior) {
          console.log(chalk.white.bold('\n🔄 Fallback Behavior:'));
          console.log(chalk.dim(`  Provider Fallback: ${config.fallbackBehavior.enableProviderFallback ? 'Enabled' : 'Disabled'}`));
          if (config.fallbackBehavior.aiProviderOrder) {
            console.log(chalk.dim(`  AI Provider Order: ${config.fallbackBehavior.aiProviderOrder.join(' → ')}`));
          }
          if (config.fallbackBehavior.dataSourceProviderOrder) {
            console.log(chalk.dim(`  Data Source Order: ${config.fallbackBehavior.dataSourceProviderOrder.join(' → ')}`));
          }
        }

      } catch (error) {
        logger.error('Failed to show provider configuration:', error);
        Visualizer.displayError(`Failed to show configuration: ${error}`);
        process.exit(1);
      }
    });

  return providersCommand;
}

function getProviderTypeLabel(type: string): string {
  switch (type) {
    case 'ai':
      return '🤖 AI Providers';
    case 'dataSources':
      return '📊 Data Source Providers';
    case 'auth':
      return '🔐 Authentication Providers';
    default:
      return type;
  }
}

// Configuration functions (reused from setup.ts)
async function configureAzureOpenAI(currentConfig: any): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Azure OpenAI endpoint:',
      default: currentConfig.endpoint,
      validate: (input: string) => {
        if (!input.length) return 'Endpoint is required';
        if (!input.startsWith('https://')) return 'Endpoint must start with https://';
        return true;
      },
    },
    {
      type: 'input',
      name: 'deploymentName',
      message: 'Deployment name:',
      default: currentConfig.deploymentName || 'gpt-4',
    },
    {
      type: 'confirm',
      name: 'useApiKey',
      message: 'Use API key instead of managed identity?',
      default: !!currentConfig.apiKey,
    },
  ]);

  const config: any = {
    type: 'azure-openai',
    endpoint: answers.endpoint,
    deploymentName: answers.deploymentName,
  };

  if (answers.useApiKey) {
    if (currentConfig.apiKey) {
      const { updateApiKey } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'updateApiKey',
          message: 'Update existing API key?',
          default: false,
        },
      ]);
      
      if (updateApiKey) {
        const { apiKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: 'Enter new API key:',
            validate: (input: string) => input.length > 0 || 'API key is required',
          },
        ]);
        config.apiKey = apiKey;
      } else {
        config.apiKey = currentConfig.apiKey;
      }
    } else {
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter API key:',
          validate: (input: string) => input.length > 0 || 'API key is required',
        },
      ]);
      config.apiKey = apiKey;
    }
  }

  return config;
}

async function configureOpenAI(currentConfig: any): Promise<any> {
  const updateApiKey = currentConfig.apiKey ? await inquirer.prompt([
    {
      type: 'confirm',
      name: 'updateApiKey',
      message: 'Update existing API key?',
      default: false,
    },
  ]).then(r => r.updateApiKey) : true;

  const answers: any = {
    model: currentConfig.model || 'gpt-4o-mini',
  };

  if (updateApiKey) {
    const apiKeyAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'OpenAI API key:',
        validate: (input: string) => input.length > 0 || 'API key is required',
      },
    ]);
    answers.apiKey = apiKeyAnswer.apiKey;
  } else {
    answers.apiKey = currentConfig.apiKey;
  }

  const modelAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'OpenAI model:',
      choices: [
        { name: 'GPT-4o Mini (Fast & Cost-effective)', value: 'gpt-4o-mini' },
        { name: 'GPT-4o (Latest GPT-4)', value: 'gpt-4o' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      ],
      default: answers.model,
    },
  ]);

  return {
    type: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: answers.apiKey,
    model: modelAnswer.model,
  };
}

async function configureApplicationInsights(currentConfig: any): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'applicationId',
      message: 'Application Insights Application ID:',
      default: currentConfig.applicationId,
      validate: (input: string) => input.length > 0 || 'Application ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Azure Tenant ID:',
      default: currentConfig.tenantId,
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

async function configureLogAnalytics(currentConfig: any): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceId',
      message: 'Log Analytics Workspace ID:',
      default: currentConfig.workspaceId,
      validate: (input: string) => input.length > 0 || 'Workspace ID is required',
    },
    {
      type: 'input',
      name: 'tenantId',
      message: 'Azure Tenant ID:',
      default: currentConfig.tenantId,
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

async function configureAzureManagedIdentity(currentConfig: any): Promise<any> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'tenantId',
      message: 'Azure Tenant ID:',
      default: currentConfig.tenantId,
      validate: (input: string) => input.length > 0 || 'Tenant ID is required',
    },
  ]);

  return {
    type: 'azure-managed-identity',
    tenantId: answers.tenantId,
  };
}