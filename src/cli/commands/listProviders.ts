import { Command } from 'commander';
import { Visualizer } from '../../utils/visualizer';

/**
 * CLI command to list available providers
 */
export function createListProvidersCommand(): Command {
  const command = new Command('list-providers')
    .description('List all available providers and their registration status')
    .option('--type <type>', 'Filter by provider type (ai|datasource|auth)', 'all')
    .action(async (options) => {
      try {
        console.log('🔍 Discovering available providers...\n');

        // Create a minimal provider factory for discovery without full configuration
        const { ProviderFactory } = await import('../../infrastructure/di/ProviderFactory');
        const { AzureOpenAIProvider } = await import('../../providers/ai/AzureOpenAIProvider');
        const { OpenAIProvider } = await import('../../providers/ai/OpenAIProvider');
        const { OllamaProvider } = await import('../../providers/ai/OllamaProvider');
        const { ApplicationInsightsProvider } = await import('../../providers/datasource/ApplicationInsightsProvider');
        const { LogAnalyticsProvider } = await import('../../providers/datasource/LogAnalyticsProvider');
        const { AzureDataExplorerProvider } = await import('../../providers/datasource/AzureDataExplorerProvider');
        const { AzureManagedIdentityProvider } = await import('../../providers/auth/AzureManagedIdentityProvider');

        const providerFactory = new ProviderFactory();
        
        // Register all Phase 5 providers
        providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
        providerFactory.registerAIProvider('openai', OpenAIProvider);
        providerFactory.registerAIProvider('ollama', OllamaProvider);
        providerFactory.registerDataSourceProvider('application-insights', ApplicationInsightsProvider);
        providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
        providerFactory.registerDataSourceProvider('azure-data-explorer', AzureDataExplorerProvider);
        providerFactory.registerAuthProvider('azure-managed-identity', AzureManagedIdentityProvider);

        // Get available providers
        const aiProviders = providerFactory.getAvailableAIProviders();
        const dataSourceProviders = providerFactory.getAvailableDataSourceProviders();
        const authProviders = providerFactory.getAvailableAuthProviders();

        if (options.type === 'all' || options.type === 'ai') {
          Visualizer.displayInfo('🤖 AI Providers:');
          if (aiProviders.length === 0) {
            console.log('  No AI providers registered');
          } else {
            aiProviders.forEach(provider => {
              const status = providerFactory.isAIProviderRegistered(provider) ? '✅' : '❌';
              console.log(`  ${status} ${provider}`);
              
              // Add description for each provider
              switch (provider) {
                case 'azure-openai':
                  console.log('      Azure OpenAI Service with managed identity support');
                  break;
                case 'openai':
                  console.log('      OpenAI API with direct API key authentication');
                  break;
                case 'ollama':
                  console.log('      Local LLM using Ollama for offline AI capabilities');
                  break;
                case 'anthropic':
                  console.log('      Anthropic Claude API (not yet implemented)');
                  break;
              }
            });
          }
          console.log();
        }

        if (options.type === 'all' || options.type === 'datasource') {
          Visualizer.displayInfo('📊 Data Source Providers:');
          if (dataSourceProviders.length === 0) {
            console.log('  No data source providers registered');
          } else {
            dataSourceProviders.forEach(provider => {
              const status = providerFactory.isDataSourceProviderRegistered(provider) ? '✅' : '❌';
              console.log(`  ${status} ${provider}`);
              
              // Add description for each provider
              switch (provider) {
                case 'application-insights':
                  console.log('      Azure Application Insights for application telemetry');
                  break;
                case 'log-analytics':
                  console.log('      Azure Monitor Log Analytics for comprehensive log querying');
                  break;
                case 'azure-metrics':
                  console.log('      Azure Monitor Metrics (not yet implemented)');
                  break;
              }
            });
          }
          console.log();
        }

        if (options.type === 'all' || options.type === 'auth') {
          Visualizer.displayInfo('🔐 Authentication Providers:');
          if (authProviders.length === 0) {
            console.log('  No auth providers registered');
          } else {
            authProviders.forEach(provider => {
              const status = providerFactory.isAuthProviderRegistered(provider) ? '✅' : '❌';
              console.log(`  ${status} ${provider}`);
              
              // Add description for each provider
              switch (provider) {
                case 'azure-managed-identity':
                  console.log('      Azure Managed Identity for passwordless authentication');
                  break;
                case 'service-principal':
                  console.log('      Azure Service Principal (not yet implemented)');
                  break;
              }
            });
          }
          console.log();
        }

        // Summary
        const totalProviders = aiProviders.length + dataSourceProviders.length + authProviders.length;
        const registeredProviders = [
          ...aiProviders.filter(p => providerFactory.isAIProviderRegistered(p)),
          ...dataSourceProviders.filter(p => providerFactory.isDataSourceProviderRegistered(p)),
          ...authProviders.filter(p => providerFactory.isAuthProviderRegistered(p))
        ].length;

        Visualizer.displaySuccess(`Total providers: ${totalProviders} | Registered: ${registeredProviders} | Available: ${registeredProviders}`);

        if (registeredProviders < totalProviders) {
          console.log();
          Visualizer.displayWarning('Some providers are defined but not yet implemented. See descriptions above.');
        }

      } catch (error) {
        Visualizer.displayError(`Failed to list providers: ${error}`);
        process.exit(1);
      }
    });

  return command;
}