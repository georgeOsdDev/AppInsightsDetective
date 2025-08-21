# Application Insights Detective Configuration

Copy this file to `~/.aidx/config.json` and update with your values:

```json
{
  "appInsights": {
    "applicationId": "your-application-insights-id",
    "tenantId": "your-azure-tenant-id",
    "endpoint": "https://api.applicationinsights.io/v1/apps",
    "subscriptionId": "your-azure-subscription-id",
    "resourceGroup": "your-resource-group-name", 
    "resourceName": "your-app-insights-resource-name",
    "clusterId": "your-data-explorer-cluster-id",
    "databaseName": "ApplicationInsights"
  },
  "openAI": {
    "endpoint": "https://your-openai-resource.openai.azure.com/",
    "deploymentName": "gpt-4"
  },
  "logLevel": "info"
}
```

## Required Configuration

### Basic Query Execution
- `applicationId`: Your Application Insights Application ID
- `tenantId`: Your Azure Tenant ID
- `openAI.endpoint`: Your Azure OpenAI endpoint
- `openAI.deploymentName`: Your OpenAI deployment name (default: gpt-4)

### External Execution (Optional)
For external query execution in Azure Portal and Data Explorer:
- `subscriptionId`: Your Azure Subscription ID
- `resourceGroup`: Your Resource Group name containing the Application Insights resource
- `resourceName`: Your Application Insights resource name

### Data Explorer Integration (Optional) 
For Azure Data Explorer external execution:
- `clusterId`: Your Azure Data Explorer cluster identifier
- `databaseName`: Database name (default: ApplicationInsights)

## Environment Variables

Alternatively, you can use environment variables:

### Basic Configuration
- `AZURE_APPLICATION_INSIGHTS_ID`
- `AZURE_TENANT_ID`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `LOG_LEVEL`

### External Execution Configuration
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_RESOURCE_NAME`
- `AZURE_DATA_EXPLORER_CLUSTER_ID`
- `AZURE_DATA_EXPLORER_DATABASE_NAME`

## Setup Command

Run `aidx setup` for an interactive configuration wizard that will collect all required information and optionally configure external execution.

## Configuration Validation

Use `aidx status` to validate your configuration and check which features are available based on your current settings.
