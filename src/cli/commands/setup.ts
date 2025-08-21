import { Command } from 'commander';
import inquirer from 'inquirer';
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

        const configManager = new ConfigManager();
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

        Visualizer.displaySuccess('Configuration saved successfully!');
        Visualizer.displayInfo('You can now use aidx to query your Application Insights data.');

      } catch (error) {
        logger.error('Setup failed:', error);
        Visualizer.displayError(`Setup failed: ${error}`);
        process.exit(1);
      }
    });

  return setupCommand;
}
