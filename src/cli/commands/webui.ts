import { Command } from 'commander';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { logger } from '../../utils/logger';
import { Bootstrap } from '../../infrastructure/Bootstrap';
import { WebUIService } from '../../webui/services/WebUIService';
import chalk from 'chalk';
import open from 'open';

export interface WebUIOptions {
  port: number;
  host: string;
  open: boolean;
  react: boolean;
}

export function createWebUICommand(): Command {
  return new Command('webui')
    .description('Start web-based user interface')
    .option('-p, --port <port>', 'Port to run the web server on', '3000')
    .option('-h, --host <host>', 'Host to bind the web server to', 'localhost')
    .option('--no-open', 'Do not automatically open browser')
    .option('--react', 'Use the React-based UI (default: auto-detect)')
    .action(async (options) => {
      try {
        const webUIOptions: WebUIOptions = {
          port: parseInt(options.port, 10),
          host: options.host,
          open: options.open !== false,
          react: options.react === true
        };

        await startWebUI(webUIOptions);
      } catch (error) {
        logger.error('WebUI startup failed:', error);
        Visualizer.displayError(`WebUI startup failed: ${error}`);
        process.exit(1);
      }
    });
}

async function startWebUI(options: WebUIOptions): Promise<void> {
  console.log(chalk.cyan.bold('\n🌐 Starting AppInsights Detective WebUI'));
  console.log(chalk.green('🆕 Now with React support for improved UI and configuration management!'));
  console.log(chalk.dim('='.repeat(70)));

  // Validate configuration
  const configManager = new ConfigManager();
  if (!configManager.validateConfig()) {
    Visualizer.displayError('Configuration is invalid. Please run "aidx setup" first.');
    process.exit(1);
  }

  // Initialize Bootstrap and get container
  console.log(chalk.blue('🤖 Initializing services...'));
  const bootstrap = new Bootstrap();
  await bootstrap.initialize();
  const container = bootstrap.getContainer();

  // Create and start WebUI service
  const webUIService = new WebUIService(container, configManager, options);
  
  console.log(chalk.blue(`🚀 Starting web server on ${options.host}:${options.port}...`));
  
  try {
    await webUIService.start();
    
    const url = `http://${options.host}:${options.port}`;
    console.log(chalk.green.bold(`\n✅ WebUI started successfully!`));
    console.log(chalk.white(`🌐 URL: ${url}`));
    console.log(chalk.dim('Press Ctrl+C to stop the server\n'));

    // Open browser if requested
    if (options.open) {
      console.log(chalk.blue('🌐 Opening browser...'));
      try {
        await open(url);
      } catch (error) {
        logger.warn('Failed to open browser automatically:', error);
        console.log(chalk.yellow('⚠️  Could not open browser automatically'));
        console.log(chalk.white(`Please open ${url} manually`));
      }
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down WebUI server...'));
      await webUIService.stop();
      console.log(chalk.green('✅ WebUI server stopped'));
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down WebUI server...'));
      await webUIService.stop();
      console.log(chalk.green('✅ WebUI server stopped'));
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start WebUI server:', error);
    throw new Error(`Failed to start WebUI server: ${error}`);
  }
}