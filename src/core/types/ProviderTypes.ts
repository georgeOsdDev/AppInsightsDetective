// Provider type enums
export type AIProviderType = 'azure-openai' | 'openai' | 'anthropic';
export type DataSourceType = 'application-insights' | 'log-analytics' | 'azure-metrics' | 'azure-data-explorer';
export type AuthType = 'azure-managed-identity' | 'service-principal';
export type ExternalExecutionProviderType = 'application-insights' | 'log-analytics';

// Configuration interfaces for providers
export interface AIProviderConfig {
  type: AIProviderType;
  endpoint?: string;
  apiKey?: string;
  deploymentName?: string;
  model?: string;
}

export interface DataSourceConfig {
  type: DataSourceType;
  applicationId?: string;
  tenantId?: string;
  endpoint?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  resourceName?: string;
  // Azure Data Explorer specific fields
  clusterUri?: string;
  database?: string;
  requiresAuthentication?: boolean;
}

export interface AuthConfig {
  type: AuthType;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ExternalExecutionProviderConfig {
  type: ExternalExecutionProviderType;
  tenantId?: string;
  subscriptionId?: string;
  resourceGroup?: string;
  resourceName?: string;
  applicationId?: string;
  workspaceId?: string;
}