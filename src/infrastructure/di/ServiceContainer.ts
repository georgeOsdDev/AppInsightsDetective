import { IServiceContainer } from '../../core/interfaces/IServiceContainer';
import { logger } from '../../utils/logger';

/**
 * Simple dependency injection container implementation
 */
export class ServiceContainer implements IServiceContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  /**
   * Register a service instance
   */
  register<T>(key: string, instance: T): void {
    logger.debug(`Registering service: ${key}`);
    this.services.set(key, instance);
  }

  /**
   * Register a factory function for lazy initialization
   */
  registerFactory<T>(key: string, factory: () => T): void {
    logger.debug(`Registering factory for service: ${key}`);
    this.factories.set(key, factory);
  }

  /**
   * Resolve a service instance
   */
  resolve<T>(key: string): T {
    // First check if we have a direct instance
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // Then check if we have a factory
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory();
      // Cache the instance for future use
      this.services.set(key, instance);
      return instance as T;
    }

    throw new Error(`Service not registered: ${key}`);
  }

  /**
   * Check if a service is registered
   */
  isRegistered(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}