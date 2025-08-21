# Application Insights Detective Configuration

Copy this file to `~/.aidx/config.json` and update with your values:

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
