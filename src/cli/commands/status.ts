import { Command } from 'commander';
import { ConfigManager } from '../../utils/config';
import { AuthService } from '../../services/authService';
import { AppInsightsService } from '../../services/appInsightsService';
import { ExternalExecutionService } from '../../services/externalExecutionService';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import { AzureResourceInfo } from '../../types';

export function createStatusCommand(): Command {
  const statusCommand = new Command('status');

  statusCommand
    .description('Check the status of AppInsights Detective configuration and connections')
    .action(async () => {
      try {
        Visualizer.displayInfo('Checking AppInsights Detective status...');

        // Check configuration
        const configManager = new ConfigManager();
        const config = configManager.getConfig();

        console.log('\n📋 Configuration Status:');
        console.log(`  Application Insights ID: ${config.appInsights.applicationId ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Tenant ID: ${config.appInsights.tenantId ? '✅ Set' : '❌ Not set'}`);
        console.log(`  OpenAI Endpoint: ${config.openAI.endpoint ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Deployment Name: ${config.openAI.deploymentName || 'gpt-4'}`);
        console.log(`  Log Level: ${config.logLevel}`);
        
        // External execution configuration status
        console.log('\n🌐 External Execution Configuration:');
        console.log(`  Subscription ID: ${config.appInsights.subscriptionId ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Resource Group: ${config.appInsights.resourceGroup ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Resource Name: ${config.appInsights.resourceName ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Data Explorer Cluster ID: ${config.appInsights.clusterId ? '✅ Set' : '❌ Not set'}`);
        console.log(`  Data Explorer Database: ${config.appInsights.databaseName || 'ApplicationInsights'}`);

        const isConfigValid = configManager.validateConfig();
        console.log(`\n  Overall Basic Config: ${isConfigValid ? '✅ Valid' : '❌ Invalid'}`);
        
        // Check external execution availability
        if (config.appInsights.tenantId && config.appInsights.subscriptionId && 
            config.appInsights.resourceGroup && config.appInsights.resourceName) {
          
          const azureResourceInfo: AzureResourceInfo = {
            tenantId: config.appInsights.tenantId,
            subscriptionId: config.appInsights.subscriptionId,
            resourceGroup: config.appInsights.resourceGroup,
            resourceName: config.appInsights.resourceName,
            clusterId: config.appInsights.clusterId,
            databaseName: config.appInsights.databaseName
          };

          const externalExecutionService = new ExternalExecutionService(azureResourceInfo);
          const validation = externalExecutionService.validateConfiguration();
          
          console.log(`  Azure Portal Integration: ${validation.isValid ? '✅ Available' : '❌ Not available'}`);
          console.log(`  Data Explorer Integration: ${externalExecutionService.isDataExplorerAvailable() ? '✅ Available' : '❌ Not available'}`);
          
          if (validation.isValid) {
            const availableOptions = externalExecutionService.getAvailableOptions();
            console.log(`  External Execution Options: ${availableOptions.length} available`);
          }
        } else {
          console.log(`  External Execution: ❌ Not configured (run "aidx setup" to configure)`);
        }
        console.log(`  Overall: ${isConfigValid ? '✅ Valid' : '❌ Invalid'}`);

        if (!isConfigValid) {
          Visualizer.displayWarning('Configuration is invalid. Run "aidx setup" to configure.');
          return;
        }

        // Check authentication
        console.log('\n🔐 Authentication Status:');
        try {
          const authService = new AuthService();
          await authService.getAccessToken();
          console.log('  Azure Authentication: ✅ Success');
        } catch (error) {
          console.log('  Azure Authentication: ❌ Failed');
          logger.debug('Auth error:', error);
        }

        // Check connectivity to Application Insights
        console.log('\n📊 Application Insights Status:');
        try {
          const authService = new AuthService();
          const appInsightsService = new AppInsightsService(authService, configManager);
          const isConnected = await appInsightsService.validateConnection();
          console.log(`  Connection: ${isConnected ? '✅ Connected' : '❌ Failed'}`);

          if (isConnected) {
            const schema = await appInsightsService.getSchema();
            const tableCount = schema?.tables?.length || 0;
            console.log(`  Available Tables: ${tableCount}`);
          }
        } catch (error) {
          console.log('  Connection: ❌ Failed');
          logger.debug('AppInsights connection error:', error);
        }

        // Check connectivity to OpenAI
        console.log('\n🤖 OpenAI Status:');
        try {
          const authService = new AuthService();
          await authService.getOpenAIToken();
          console.log('  Authentication: ✅ Success');
        } catch (error) {
          console.log('  Authentication: ❌ Failed');
          logger.debug('OpenAI auth error:', error);
        }

        console.log('\n');
        Visualizer.displaySuccess('Status check completed.');

      } catch (error) {
        logger.error('Status check failed:', error);
        Visualizer.displayError(`Status check failed: ${error}`);
        process.exit(1);
      }
    });

  return statusCommand;
}
