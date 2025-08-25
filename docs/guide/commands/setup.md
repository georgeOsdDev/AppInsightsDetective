# Setup Command

The `setup` command provides an interactive configuration wizard for AppInsights Detective. It guides you through configuring AI providers, data sources, authentication, and general settings.

## Purpose

The setup command creates or updates the AppInsights Detective configuration file with all necessary settings to connect to your Azure resources. It provides a user-friendly interface for configuration without requiring manual JSON editing.

## Basic Usage

```bash
# Run interactive setup wizard
aidx setup

# This will guide you through all configuration steps
```

## What Setup Configures

The setup wizard configures the following components:

1. **AI Provider** - Azure OpenAI or OpenAI for natural language processing
2. **Data Source Provider** - Application Insights or Log Analytics workspace
3. **Authentication Provider** - Azure Managed Identity or Service Principal
4. **General Settings** - Language preferences and logging configuration

## Step-by-Step Walkthrough

### Step 1: AI Provider Selection

The wizard first asks you to choose your AI provider:

```
? Select AI Provider: (Use arrow keys)
❯ Azure OpenAI (Recommended for Azure environments)
  OpenAI (Direct OpenAI API)
```

**Recommendations:**
- **Azure OpenAI**: Best for Azure-based deployments, uses Azure authentication
- **OpenAI**: For external environments or when using OpenAI directly

### Step 2: AI Provider Configuration

#### Azure OpenAI Configuration

```
? Azure OpenAI Endpoint: https://your-openai.openai.azure.com/
? Deployment Name: gpt-4
? Use Managed Identity for authentication? (Y/n): Y
? API Key (leave blank for Managed Identity): [optional]
```

**Configuration Fields:**
- **Endpoint**: Your Azure OpenAI service endpoint URL
- **Deployment Name**: The name of your deployed model (e.g., "gpt-4", "gpt-35-turbo")
- **Authentication Method**: 
  - Managed Identity (recommended): Automatic authentication using Azure identity
  - API Key: Manual key-based authentication
- **API Key**: Required only if not using Managed Identity

**Finding Your Values:**
- **Endpoint**: Azure Portal → Azure OpenAI → Keys and Endpoint
- **Deployment Name**: Azure Portal → Azure OpenAI → Model deployments

#### OpenAI Configuration

```
? OpenAI API Key: sk-...
? Model: (Use arrow keys)
❯ gpt-4
  gpt-3.5-turbo
  [other models]
? Max Tokens: 2000
? Temperature: 0.7
```

### Step 3: Data Source Provider Selection

```
? Select Data Source Provider: (Use arrow keys)
❯ Application Insights (Recommended for app telemetry)
  Log Analytics (For workspace-based queries)
```

### Step 4: Data Source Configuration

#### Application Insights Configuration

```
? Application Insights Application ID: 12345678-1234-1234-1234-123456789abc
? Azure Tenant ID: 87654321-4321-4321-4321-cba987654321
```

**Configuration Fields:**
- **Application ID**: Unique identifier for your Application Insights resource
- **Tenant ID**: Azure AD tenant ID for authentication and resource discovery

**Finding Your Values:**
- **Application ID**: Azure Portal → Application Insights → API Access → Application ID
- **Tenant ID**: Azure Portal → Azure Active Directory → Overview → Tenant ID

**Auto-Discovery Note:** The system automatically discovers additional information (subscription ID, resource group, resource name) during your first query using Azure Resource Graph API.

#### Log Analytics Configuration

```
? Log Analytics Workspace ID: 12345678-1234-1234-1234-123456789abc
? Azure Tenant ID: 87654321-4321-4321-4321-cba987654321
```

### Step 5: Authentication Provider Selection

```
? Select Authentication Provider: (Use arrow keys)
❯ Azure Managed Identity (Recommended for Azure environments)
  Azure Service Principal (For CI/CD and external environments)
```

### Step 6: Authentication Configuration

#### Azure Managed Identity

```
? Azure Tenant ID: [auto-filled from previous step]
```

**Best for:**
- Azure VMs
- Azure App Service
- Azure Container Instances
- Azure Functions
- Any Azure service with managed identity support

#### Azure Service Principal

```
? Azure Tenant ID: [auto-filled from previous step] 
? Client ID: 11111111-1111-1111-1111-111111111111
? Client Secret: [enter secret securely]
```

**Best for:**
- CI/CD pipelines
- External servers
- Local development (with service principal)
- Cross-tenant scenarios

### Step 7: General Settings

```
? Default Language for explanations: (Use arrow keys)
❯ en (English)
  ja (Japanese)
  ko (Korean)
  zh (Chinese)
  es (Spanish)
  fr (French)
  de (German)
  [other languages]

? Log Level: (Use arrow keys)
❯ info
  debug
  warn
  error
```

**Language Support:** AppInsights Detective supports multiple languages for query explanations and interactive prompts. Choose your preferred language for the best experience.

**Log Levels:**
- **debug**: Verbose logging for troubleshooting
- **info**: Standard operational messages
- **warn**: Warning messages only  
- **error**: Error messages only

## Configuration Output

After completing the setup, you'll see a success message:

```
✅ Configuration saved successfully!

🎉 Setup Complete!
You can now use aidx to query your data sources with AI assistance.

Quick start:
  aidx "show me errors from the last hour"
  aidx status
```

The configuration is saved to `~/.aidx/config.json`.

## Configuration File Structure

The setup wizard creates a configuration file like this:

```json
{
  "providers": {
    "ai": {
      "default": "azure-openai",
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://your-openai.openai.azure.com/",
        "deploymentName": "gpt-4"
      }
    },
    "dataSources": {
      "default": "application-insights",
      "application-insights": {
        "type": "application-insights",
        "applicationId": "12345678-1234-1234-1234-123456789abc",
        "tenantId": "87654321-4321-4321-4321-cba987654321"
      }
    },
    "auth": {
      "default": "azure-managed-identity",
      "azure-managed-identity": {
        "type": "azure-managed-identity",
        "tenantId": "87654321-4321-4321-4321-cba987654321"
      }
    }
  },
  "logLevel": "info",
  "language": "en",
  "fallbackBehavior": {
    "enableProviderFallback": true,
    "aiProviderOrder": ["azure-openai"],
    "dataSourceProviderOrder": ["application-insights"]
  }
}
```

## Re-running Setup

You can run setup multiple times to update your configuration:

```bash
# Update existing configuration
aidx setup
```

**What happens when re-running:**
- Existing values are shown as defaults
- You can keep existing values by pressing Enter
- Only changed values are updated
- Previous configuration is backed up

**Backup Location:** `~/.aidx/config.json.backup`

## Validation and Testing

After setup completes, verify your configuration:

```bash
# Check configuration status
aidx status

# Detailed validation with connection tests
aidx status --verbose

# Test with a simple query
aidx "show me recent requests"
```

Expected validation output:
```
🔍 AppInsights Detective Status Check
==================================================

📋 Configuration:
  ✅ Configuration is valid

🔧 Provider Status:
  🤖 AI Provider: azure-openai
    ✅ Configured
  📊 Data Source: application-insights  
    ✅ Configured
  🔐 Authentication: azure-managed-identity
    ✅ Configured

🌐 Connection Tests:
  ✅ Azure OpenAI connection successful
  ✅ Application Insights connection successful
  ✅ Authentication working
```

## Common Setup Scenarios

### Scenario 1: Azure Environment (Recommended)

**Configuration:**
- **AI Provider**: Azure OpenAI with Managed Identity
- **Data Source**: Application Insights  
- **Authentication**: Azure Managed Identity

**Best for:** Azure VMs, App Service, Container Instances

### Scenario 2: External/Development Environment

**Configuration:**
- **AI Provider**: Azure OpenAI with API Key or OpenAI
- **Data Source**: Application Insights
- **Authentication**: Azure Service Principal

**Best for:** Local development, external servers

### Scenario 3: CI/CD Pipeline

**Configuration:**
- **AI Provider**: Azure OpenAI with Service Principal
- **Data Source**: Application Insights  
- **Authentication**: Azure Service Principal

**Best for:** Automated builds, deployment scripts

### Scenario 4: Multi-tenant Setup

**Configuration:**
- **AI Provider**: Azure OpenAI
- **Data Source**: Application Insights  
- **Authentication**: Service Principal with cross-tenant permissions

**Best for:** MSP scenarios, cross-tenant access

## Troubleshooting Setup Issues

### Common Issues and Solutions

#### "Failed to validate Azure OpenAI endpoint"

**Possible causes:**
- Incorrect endpoint URL format
- Network connectivity issues
- Invalid deployment name

**Solutions:**
```bash
# Check endpoint format (should end with /)
https://your-resource.openai.azure.com/

# Verify deployment name matches Azure Portal
# Test connectivity manually
curl -H "Authorization: Bearer $(az account get-access-token --query accessToken -o tsv)" \
     "https://your-resource.openai.azure.com/openai/deployments?api-version=2023-05-15"
```

#### "Application Insights Application ID not found"

**Possible causes:**
- Incorrect Application ID format
- Insufficient permissions
- Resource in different tenant

**Solutions:**
```bash
# Verify Application ID format (GUID)
# Check permissions on Application Insights resource
az role assignment list --scope /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Insights/components/{name}

# Verify tenant ID matches resource tenant
az account show --query tenantId
```

#### "Authentication provider setup failed"

**Possible causes:**
- Missing managed identity
- Invalid service principal credentials
- Incorrect tenant ID

**Solutions:**
```bash
# For Managed Identity: Verify identity is enabled
az vm identity show --name {vm-name} --resource-group {rg}

# For Service Principal: Test authentication
az login --service-principal -u {client-id} -p {client-secret} --tenant {tenant-id}
```

### Manual Configuration Recovery

If setup fails, you can manually create the configuration:

```bash
# Create directory
mkdir -p ~/.aidx

# Create minimal configuration
cat > ~/.aidx/config.json << EOF
{
  "providers": {
    "ai": {
      "default": "azure-openai",
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://your-openai.openai.azure.com/",
        "deploymentName": "gpt-4"
      }
    },
    "dataSources": {
      "default": "application-insights",
      "application-insights": {
        "type": "application-insights",
        "applicationId": "your-app-id",
        "tenantId": "your-tenant-id"
      }
    },
    "auth": {
      "default": "azure-managed-identity",
      "azure-managed-identity": {
        "type": "azure-managed-identity",
        "tenantId": "your-tenant-id"
      }
    }
  },
  "logLevel": "info",
  "language": "en"
}
EOF

# Validate configuration
aidx status --verbose
```

## Environment Variable Override

Setup values can be overridden with environment variables:

```bash
# Override during setup
export AZURE_APPLICATION_INSIGHTS_ID="your-app-id"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"

# Run setup (will use these as defaults)
aidx setup
```

## Advanced Setup Options

### Custom Configuration Location

```bash
# Specify custom config location
export AIDX_CONFIG_PATH="/custom/path/config.json"
aidx setup
```

### Provider-Specific Configuration

The setup wizard focuses on the most common scenarios. For advanced provider configurations, you can manually edit the config file after setup or use the providers command:

```bash
# Configure specific provider after setup
aidx providers configure ai azure-openai
aidx providers configure dataSources application-insights
```

## Integration with Other Commands

### Post-Setup Workflow

```bash
# 1. Run setup
aidx setup

# 2. Verify configuration  
aidx status --verbose

# 3. Test connectivity
aidx "show me recent data"

# 4. Explore features
aidx template list
aidx --interactive
```

### Updating Configuration

```bash
# Update specific settings
aidx setup  # Will prompt for changes

# Switch providers
aidx providers set-default ai openai
aidx providers configure ai openai

# Check provider status
aidx list-providers --detailed
```

## Next Steps

After successful setup:

1. **Verify Configuration**: Run `aidx status --verbose`
2. **Test Basic Query**: Try `aidx "show me requests from last hour"`
3. **Explore Commands**: See [Commands Reference](index.md)
4. **Try Interactive Mode**: Run `aidx --interactive`
5. **Learn Query Patterns**: Check [Query Examples](../showcase.md)