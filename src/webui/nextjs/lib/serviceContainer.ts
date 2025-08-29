import { Bootstrap } from '../../../infrastructure/Bootstrap';
import { ServiceContainer } from '../../../infrastructure/di/ServiceContainer';
import { ConfigManager } from '../../../utils/config';

// Global container instance for Next.js API routes
let globalContainer: ServiceContainer | null = null;
let isInitialized = false;

/**
 * Get or initialize the service container for Next.js API routes
 */
export async function getServiceContainer(): Promise<ServiceContainer> {
  if (!isInitialized || !globalContainer) {
    const bootstrap = new Bootstrap();
    await bootstrap.initialize();
    globalContainer = bootstrap.getContainer();
    isInitialized = true;
  }
  return globalContainer;
}

/**
 * Get the configuration manager
 */
export function getConfigManager(): ConfigManager {
  return new ConfigManager();
}

/**
 * Validate that the configuration is correct
 */
export function validateConfig(): boolean {
  const configManager = getConfigManager();
  return configManager.validateConfig();
}