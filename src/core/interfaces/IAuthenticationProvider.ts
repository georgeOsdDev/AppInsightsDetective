/**
 * Core interface for authentication providers
 */
export interface IAuthenticationProvider {
  /**
   * Get access token for specified scopes
   */
  getAccessToken(scopes: string[]): Promise<string>;

  /**
   * Validate current credentials
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Get token specifically for OpenAI/AI services
   */
  getOpenAIToken(): Promise<string>;
}
