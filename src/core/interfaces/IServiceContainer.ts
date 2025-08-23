/**
 * Simple dependency injection container interface
 */
export interface IServiceContainer {
  /**
   * Register a service instance
   */
  register<T>(key: string, instance: T): void;

  /**
   * Register a factory function for lazy initialization
   */
  registerFactory<T>(key: string, factory: () => T): void;

  /**
   * Resolve a service instance
   */
  resolve<T>(key: string): T;

  /**
   * Check if a service is registered
   */
  isRegistered(key: string): boolean;
}