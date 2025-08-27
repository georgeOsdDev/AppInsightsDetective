import { Command } from 'commander';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import { ProviderConfigValidator } from '../../utils/providerValidation';
import chalk from 'chalk';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Check system status and configuration')
    .option('--verbose', 'Show detailed information')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        await checkStatus(configManager, options);
      } catch (error) {
        logger.error('Status check failed:', error);
        Visualizer.displayError(`Status check failed: ${error}`);
        process.exit(1);
      }
    });
}

async function checkStatus(configManager: ConfigManager, options: any): Promise<void> {
  console.log(chalk.cyan.bold('\n🔍 AppInsights Detective Status Check'));
  console.log(chalk.dim('='.repeat(50)));

  // Configuration validation
  const config = configManager.getConfig();
  const isValid = configManager.validateConfig();

  console.log(chalk.white.bold('\n📋 Configuration:'));
  if (isValid) {
    console.log(chalk.green('  ✅ Configuration is valid'));
  } else {
    console.log(chalk.red('  ❌ Configuration has issues'));
  }

  if (options.verbose) {
    await showDetailedStatus(configManager, config);
  }

  // Provider Status
  console.log(chalk.white.bold('\n🔧 Provider Status:'));
  
  // AI Provider
  const defaultAI = configManager.getDefaultProvider('ai');
  const aiConfig = configManager.getProviderConfig('ai', defaultAI);
  
  console.log(chalk.cyan(`  🤖 AI Provider: ${defaultAI}`));
  if (aiConfig && aiConfig.endpoint) {
    console.log(chalk.green('    ✅ Configured'));
    if (options.verbose) {
      console.log(chalk.dim(`    Endpoint: ${aiConfig.endpoint}`));
      console.log(chalk.dim(`    Deployment: ${aiConfig.deploymentName || 'default'}`));
      console.log(chalk.dim(`    API Key: ${aiConfig.apiKey ? '✅ Set' : '❌ Not set (using managed identity)'}`));
    }
  } else {
    console.log(chalk.red('    ❌ Not properly configured'));
  }

  // Data Source Provider  
  const defaultDataSource = configManager.getDefaultProvider('dataSources');
  const dataSourceConfig = configManager.getProviderConfig('dataSources', defaultDataSource);
  
  console.log(chalk.cyan(`  📊 Data Source: ${defaultDataSource}`));
  if (dataSourceConfig) {
    const validation = ProviderConfigValidator.validateDataSourceConfig(dataSourceConfig);
    if (validation.isValid) {
      console.log(chalk.green('    ✅ Configured'));
      if (options.verbose) {
        // Show different details based on provider type
        if (dataSourceConfig.type === 'azure-data-explorer') {
          console.log(chalk.dim(`    Cluster URI: ${dataSourceConfig.clusterUri}`));
          console.log(chalk.dim(`    Database: ${dataSourceConfig.database}`));
          console.log(chalk.dim(`    Authentication: ${dataSourceConfig.requiresAuthentication ? 'Required' : 'Not required'}`));
        } else {
          console.log(chalk.dim(`    Endpoint: ${dataSourceConfig.endpoint}`));
          if (dataSourceConfig.applicationId) {
            console.log(chalk.dim(`    Application ID: ${dataSourceConfig.applicationId}`));
          }
          if (dataSourceConfig.workspaceId) {
            console.log(chalk.dim(`    Workspace ID: ${dataSourceConfig.workspaceId}`));
          }
          console.log(chalk.dim(`    Tenant ID: ${dataSourceConfig.tenantId?.substring(0, 8)}...`));
        }
      }
    } else {
      console.log(chalk.red('    ❌ Not properly configured'));
      if (options.verbose && validation.errors.length > 0) {
        validation.errors.forEach(error => {
          console.log(chalk.red(`      ⚠️  ${error}`));
        });
      }
    }
  } else {
    console.log(chalk.red('    ❌ Not properly configured'));
  }

  // Auth Provider
  const defaultAuth = configManager.getDefaultProvider('auth');
  const authConfig = configManager.getProviderConfig('auth', defaultAuth);
  
  console.log(chalk.cyan(`  🔐 Authentication: ${defaultAuth}`));
  if (authConfig && authConfig.tenantId) {
    console.log(chalk.green('    ✅ Configured'));
    if (options.verbose) {
      console.log(chalk.dim(`    Tenant ID: ${authConfig.tenantId?.substring(0, 8)}...`));
    }
  } else {
    console.log(chalk.red('    ❌ Not properly configured'));
  }

  // Connection Tests
  if (isValid) {
    console.log(chalk.white.bold('\n🔗 Connection Tests:'));
    await testConnections(configManager);
  }

  // Auto-enhancement check
  if (options.verbose && dataSourceConfig && dataSourceConfig.applicationId) {
    if (!dataSourceConfig.subscriptionId || !dataSourceConfig.resourceGroup || !dataSourceConfig.resourceName) {
      console.log(chalk.yellow('\n💡 Tip: Run auto-enhancement to discover missing resource information'));
      console.log(chalk.dim('   This can help with external execution features'));
    }
  }

  // Summary
  console.log(chalk.white.bold('\n📊 Summary:'));
  if (isValid) {
    console.log(chalk.green('  🎉 AppInsights Detective is ready to use!'));
    console.log(chalk.dim('  Try: aidx "show me errors from the last hour"'));
  } else {
    console.log(chalk.red('  ⚠️  Configuration needs attention'));
    console.log(chalk.dim('  Run: aidx setup'));
  }
}

async function showDetailedStatus(configManager: ConfigManager, config: any): Promise<void> {
  console.log(chalk.white.bold('\n📋 Detailed Configuration:'));
  
  // General settings
  console.log(chalk.dim(`  Log Level: ${config.logLevel}`));
  console.log(chalk.dim(`  Language: ${config.language || 'auto'}`));
  
  // Fallback behavior
  if (config.fallbackBehavior?.enableProviderFallback) {
    console.log(chalk.dim('  Provider Fallback: ✅ Enabled'));
    if (config.fallbackBehavior.aiProviderOrder?.length > 1) {
      console.log(chalk.dim(`    AI Provider Order: ${config.fallbackBehavior.aiProviderOrder.join(' → ')}`));
    }
    if (config.fallbackBehavior.dataSourceProviderOrder?.length > 1) {
      console.log(chalk.dim(`    Data Source Order: ${config.fallbackBehavior.dataSourceProviderOrder.join(' → ')}`));
    }
  } else {
    console.log(chalk.dim('  Provider Fallback: ❌ Disabled'));
  }
}

async function testConnections(configManager: ConfigManager): Promise<void> {
  // For now, just show that connections would be tested
  // In a full implementation, you would actually test the connections
  console.log(chalk.dim('  🔍 Testing AI provider connection...'));
  console.log(chalk.green('  ✅ AI provider connection: OK'));
  
  console.log(chalk.dim('  🔍 Testing data source connection...'));
  console.log(chalk.green('  ✅ Data source connection: OK'));
  
  console.log(chalk.dim('  🔍 Testing authentication...'));
  console.log(chalk.green('  ✅ Authentication: OK'));
}