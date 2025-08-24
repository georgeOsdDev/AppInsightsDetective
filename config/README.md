# Application Insights Detective Configuration

Copy this file to `~/.aidx/config.json` and update with your values.

## New Provider-Based Configuration (v1.0.0+)

The configuration now supports multiple providers with a provider-based architecture:

```json
{
  "providers": {
    "ai": {
      "default": "azure-openai",
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://your-openai-resource.openai.azure.com/",
        "deploymentName": "gpt-4"
      },
      "openai": {
        "type": "openai",
        "apiKey": "your-openai-api-key"
      }
    },
    "dataSources": {
      "default": "application-insights",
      "application-insights": {
        "type": "application-insights",
        "applicationId": "your-application-insights-id",
        "tenantId": "your-azure-tenant-id"
      },
      "log-analytics": {
        "type": "log-analytics",
        "workspaceId": "your-log-analytics-workspace-id",
        "tenantId": "your-azure-tenant-id"
      }
    },
    "auth": {
      "default": "azure-managed-identity",
      "azure-managed-identity": {
        "type": "azure-managed-identity",
        "tenantId": "your-azure-tenant-id"
      }
    }
  },
  "logLevel": "info",
  "language": "auto"
}
```

## Legacy Configuration (Pre-v1.0.0)

For backward compatibility, the old configuration format is still supported:

```json
{
  "appInsights": {
    "applicationId": "your-application-insights-id",
    "tenantId": "your-azure-tenant-id",
    "endpoint": "https://api.applicationinsights.io/v1/apps"
  },
  "openAI": {
    "endpoint": "https://your-openai-resource.openai.azure.com/",
    "deploymentName": "gpt-4"
  },
  "logLevel": "info"
}
```

## Environment Variables

Alternatively, you can use environment variables:

- `AZURE_APPLICATION_INSIGHTS_ID`
- `AZURE_TENANT_ID`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `LOG_LEVEL`
