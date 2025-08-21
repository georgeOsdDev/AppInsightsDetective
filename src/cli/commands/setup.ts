import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';

export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Setup AppInsights Detective configuration')
    .action(async () => {
      try {
        Visualizer.displayInfo('Setting up AppInsights Detective...');

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

        // Additional prompts for external execution setup
        console.log(chalk.blue.bold('\n🌐 External Execution Setup (Optional)'));
        console.log(chalk.dim('Configure Azure resource information to enable external execution in Azure Portal and Data Explorer:'));

        const externalAnswers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'configureExternal',
            message: 'Would you like to configure external execution options?',
            default: true,
          },
        ]);

        let subscriptionId = '';
        let resourceGroup = '';
        let resourceName = '';
        let clusterId = '';
        let databaseName = '';

        if (externalAnswers.configureExternal) {
          const resourceAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'subscriptionId',
              message: 'Enter your Azure Subscription ID:',
              validate: (input: string) => {
                if (!input.length) return 'Subscription ID is required for external execution';
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
                  return 'Please enter a valid UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
                }
                return true;
              },
            },
            {
              type: 'input',
              name: 'resourceGroup',
              message: 'Enter your Resource Group name:',
              validate: (input: string) => input.length > 0 || 'Resource Group name is required for external execution',
            },
            {
              type: 'input',
              name: 'resourceName',
              message: 'Enter your Application Insights Resource name:',
              validate: (input: string) => input.length > 0 || 'Resource name is required for external execution',
            },
            {
              type: 'confirm',
              name: 'configureDataExplorer',
              message: 'Would you like to configure Azure Data Explorer integration? (Optional)',
              default: false,
            },
          ]);

          subscriptionId = resourceAnswers.subscriptionId;
          resourceGroup = resourceAnswers.resourceGroup;
          resourceName = resourceAnswers.resourceName;

          if (resourceAnswers.configureDataExplorer) {
            const dataExplorerAnswers = await inquirer.prompt([
              {
                type: 'input',
                name: 'clusterId',
                message: 'Enter your Azure Data Explorer Cluster ID:',
                validate: (input: string) => input.length > 0 || 'Cluster ID is required for Data Explorer integration',
              },
              {
                type: 'input',
                name: 'databaseName',
                message: 'Enter your Database name:',
                default: 'ApplicationInsights',
              },
            ]);

            clusterId = dataExplorerAnswers.clusterId;
            databaseName = dataExplorerAnswers.databaseName;
          }
        }

        const configManager = new ConfigManager();
        configManager.updateConfig({
          appInsights: {
            applicationId: answers.applicationId,
            tenantId: answers.tenantId,
            subscriptionId: subscriptionId || undefined,
            resourceGroup: resourceGroup || undefined,
            resourceName: resourceName || undefined,
            clusterId: clusterId || undefined,
            databaseName: databaseName || undefined,
          },
          openAI: {
            endpoint: answers.openaiEndpoint,
            deploymentName: answers.deploymentName,
          },
          logLevel: answers.logLevel,
        });

        Visualizer.displaySuccess('Configuration saved successfully!');
        Visualizer.displayInfo('You can now use aidx to query your Application Insights data.');
        
        if (externalAnswers.configureExternal && subscriptionId && resourceGroup && resourceName) {
          console.log(chalk.green('\n✅ External execution configured successfully!'));
          console.log(chalk.dim('You can now use these commands:'));
          console.log(chalk.cyan('  aidx --external "query"') + chalk.dim('              # Interactive external tool selection'));
          console.log(chalk.cyan('  aidx --open-portal "query"') + chalk.dim('         # Open directly in Azure Portal'));
          if (clusterId && databaseName) {
            console.log(chalk.cyan('  aidx --open-dataexplorer "query"') + chalk.dim('    # Open in Azure Data Explorer'));
          }
        }

      } catch (error) {
        logger.error('Setup failed:', error);
        Visualizer.displayError(`Setup failed: ${error}`);
        process.exit(1);
      }
    });

  return setupCommand;
}
