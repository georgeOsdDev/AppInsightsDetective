# Providers Command

The `providers` command manages the configuration of different provider types (AI, data sources, and authentication) in AppInsights Detective, allowing you to switch between different services and configure provider-specific settings.

## Purpose

The providers command enables you to:
- **View** current provider configurations and settings
- **Switch** between different provider types (Azure OpenAI vs OpenAI, etc.)
- **Configure** provider-specific settings without full reconfiguration
- **Manage** multiple provider configurations for different environments
- **Troubleshoot** provider-specific connection and configuration issues

## Basic Usage

```bash
# Show current provider configuration
aidx providers show
aidx provider show  # Short alias

# Set default AI provider
aidx providers set-default ai azure-openai

# Configure specific provider settings
aidx providers configure ai azure-openai

# List available provider types
aidx list-providers
```

## Command Structure

```bash
aidx providers <subcommand> [options] [arguments]
aidx provider <subcommand> [options] [arguments]  # Short alias
```

## Subcommands

### Show Provider Configuration

Displays current provider setup and configuration details:

```bash
# Show all provider configurations
aidx providers show

# Show specific provider type
aidx providers show ai
aidx providers show dataSources
aidx providers show auth
```

**Example output:**
```
🔧 Provider Configuration

AI Providers:
  Default: azure-openai
  ┌──────────────┬─────────────┬──────────────────────────────────────────┐
  │   Provider   │   Status    │                 Configuration             │
  ├──────────────┼─────────────┼──────────────────────────────────────────┤
  │ azure-openai │ ✅ Active   │ Endpoint: https://my-openai.openai.az..  │
  │              │             │ Deployment: gpt-4                       │
  │              │             │ Auth: Managed Identity                   │
  │──────────────┼─────────────┼──────────────────────────────────────────┤
  │ openai       │ ⚪ Available│ Model: gpt-4                            │
  │              │             │ Auth: API Key (not configured)          │
  └──────────────┴─────────────┴──────────────────────────────────────────┘

Data Source Providers:
  Default: application-insights
  ┌─────────────────────┬─────────────┬─────────────────────────────────────┐
  │      Provider       │   Status    │             Configuration           │
  ├─────────────────────┼─────────────┼─────────────────────────────────────┤
  │ application-insights│ ✅ Active   │ App ID: 1234****-****-****-****9abc │
  │                     │             │ Tenant: 8765****-****-****-****4321│
  │─────────────────────┼─────────────┼─────────────────────────────────────┤
  │ log-analytics       │ ⚪ Available│ Not configured                      │
  └─────────────────────┴─────────────┴─────────────────────────────────────┘

Authentication Providers:
  Default: azure-managed-identity
  ┌────────────────────────┬─────────────┬──────────────────────────────────┐
  │        Provider        │   Status    │           Configuration          │
  ├────────────────────────┼─────────────┼──────────────────────────────────┤
  │ azure-managed-identity │ ✅ Active   │ Tenant: 8765****-****-****-4321 │
  │────────────────────────┼─────────────┼──────────────────────────────────┤
  │ azure-service-principal│ ⚪ Available│ Not configured                   │
  └────────────────────────┴─────────────┴──────────────────────────────────┘
```

**Status Indicators:**
- ✅ **Active**: Currently configured and being used as default
- ⚪ **Available**: Provider type available but not configured
- ❌ **Error**: Provider configured but has configuration issues
- ⚠️ **Warning**: Provider configured but with non-critical issues

### Set Default Provider

Changes the default provider for a specific provider type:

```bash
# Set default AI provider
aidx providers set-default ai azure-openai
aidx providers set-default ai openai

# Set default data source provider
aidx providers set-default dataSources application-insights
aidx providers set-default dataSources log-analytics

# Set default authentication provider  
aidx providers set-default auth azure-managed-identity
aidx providers set-default auth azure-service-principal
```

**Example:**
```bash
aidx providers set-default ai openai

✅ Default AI provider changed from 'azure-openai' to 'openai'
⚠️  Provider 'openai' is not fully configured
💡 Run 'aidx providers configure ai openai' to configure settings
```

### Configure Provider

Interactive configuration of specific provider settings:

```bash
# Configure AI providers
aidx providers configure ai azure-openai
aidx providers configure ai openai

# Configure data source providers
aidx providers configure dataSources application-insights
aidx providers configure dataSources log-analytics

# Configure authentication providers
aidx providers configure auth azure-managed-identity
aidx providers configure auth azure-service-principal
```

**Example configuration session:**
```bash
aidx providers configure ai azure-openai

🔧 Configuring AI Provider: azure-openai

Current Configuration:
  Endpoint: https://old-openai.openai.azure.com/
  Deployment: gpt-35-turbo
  Auth Method: Managed Identity

? Update Azure OpenAI Endpoint: https://new-openai.openai.azure.com/
? Update Deployment Name: gpt-4
? Change Authentication Method? (y/N): N

✅ Azure OpenAI provider configuration updated
🔄 Testing connection... ✅ Connection successful

Configuration saved to ~/.aidx/config.json
```

## Provider Types and Options

### AI Providers

#### Azure OpenAI Provider

**Purpose**: Use Azure OpenAI Service for natural language to KQL conversion

**Configuration Options:**
- **Endpoint**: Azure OpenAI service endpoint URL
- **Deployment Name**: Name of deployed model (gpt-4, gpt-35-turbo, etc.)
- **API Key**: Optional if using Managed Identity
- **API Version**: Azure OpenAI API version (defaults to latest)
- **Temperature**: Model creativity setting (0.0-1.0)
- **Max Tokens**: Maximum response length

**Usage:**
```bash
# Configure Azure OpenAI
aidx providers configure ai azure-openai
```

**Configuration Example:**
```json
{
  "providers": {
    "ai": {
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://my-openai.openai.azure.com/",
        "deploymentName": "gpt-4",
        "apiVersion": "2023-12-01-preview",
        "temperature": 0.7,
        "maxTokens": 2000
      }
    }
  }
}
```

#### OpenAI Provider

**Purpose**: Use OpenAI API directly for natural language processing

**Configuration Options:**
- **API Key**: OpenAI API key
- **Model**: OpenAI model name (gpt-4, gpt-3.5-turbo, etc.)
- **Organization**: OpenAI organization ID (optional)
- **Temperature**: Model creativity setting (0.0-1.0)
- **Max Tokens**: Maximum response length

**Usage:**
```bash
# Configure OpenAI
aidx providers configure ai openai
```

### Data Source Providers

#### Application Insights Provider

**Purpose**: Query Azure Application Insights telemetry data

**Configuration Options:**
- **Application ID**: Application Insights Application ID
- **Tenant ID**: Azure AD Tenant ID
- **Subscription ID**: Auto-discovered during first query
- **Resource Group**: Auto-discovered during first query  
- **Resource Name**: Auto-discovered during first query

**Usage:**
```bash
# Configure Application Insights
aidx providers configure dataSources application-insights
```

#### Log Analytics Provider

**Purpose**: Query Azure Log Analytics workspace data

**Configuration Options:**
- **Workspace ID**: Log Analytics workspace ID
- **Tenant ID**: Azure AD Tenant ID
- **Subscription ID**: Azure subscription containing workspace
- **Resource Group**: Resource group containing workspace
- **Workspace Name**: Log Analytics workspace name

**Usage:**
```bash
# Configure Log Analytics
aidx providers configure dataSources log-analytics
```

### Authentication Providers

#### Azure Managed Identity Provider

**Purpose**: Use Azure Managed Identity for authentication

**Configuration Options:**
- **Tenant ID**: Azure AD Tenant ID
- **Client ID**: User-assigned managed identity client ID (optional)

**Best for:**
- Azure Virtual Machines
- Azure App Service
- Azure Container Instances
- Azure Functions
- Any Azure service supporting managed identity

**Usage:**
```bash
# Configure Managed Identity
aidx providers configure auth azure-managed-identity
```

#### Azure Service Principal Provider

**Purpose**: Use Service Principal credentials for authentication

**Configuration Options:**
- **Tenant ID**: Azure AD Tenant ID
- **Client ID**: Service Principal Application ID
- **Client Secret**: Service Principal secret
- **Certificate**: Certificate-based authentication (alternative to secret)

**Best for:**
- CI/CD pipelines
- External servers
- Local development
- Cross-tenant scenarios

**Usage:**
```bash
# Configure Service Principal
aidx providers configure auth azure-service-principal
```

## Provider Management Workflows

### Switching AI Providers

```bash
# Check current AI provider
aidx providers show ai

# Switch to OpenAI
aidx providers set-default ai openai

# Configure OpenAI settings
aidx providers configure ai openai

# Test the change
aidx "test query"

# Switch back if needed
aidx providers set-default ai azure-openai
```

### Multi-Environment Setup

```bash
# Production environment (Azure OpenAI + Managed Identity)
aidx providers set-default ai azure-openai
aidx providers set-default auth azure-managed-identity

# Development environment (OpenAI + Service Principal) 
aidx providers set-default ai openai
aidx providers set-default auth azure-service-principal
```

### Provider Health Check

```bash
# Check all provider status
aidx providers show

# Test connections
aidx status --verbose

# Configure problematic providers
aidx providers configure ai azure-openai
```

## Advanced Provider Configuration

### Environment-Specific Providers

Different configurations for different environments:

```bash
# Set up production providers
export ENVIRONMENT=production
aidx providers set-default ai azure-openai-prod
aidx providers configure ai azure-openai-prod

# Set up development providers  
export ENVIRONMENT=development
aidx providers set-default ai azure-openai-dev
```

### Provider Fallback Configuration

Configure fallback providers for high availability:

```json
{
  "fallbackBehavior": {
    "enableProviderFallback": true,
    "aiProviderOrder": ["azure-openai", "openai"],
    "dataSourceProviderOrder": ["application-insights"],
    "authProviderOrder": ["azure-managed-identity", "azure-service-principal"]
  }
}
```

### Custom Provider Settings

Advanced provider-specific settings:

```json
{
  "providers": {
    "ai": {
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://my-openai.openai.azure.com/",
        "deploymentName": "gpt-4",
        "temperature": 0.3,
        "maxTokens": 1500,
        "timeout": 30000,
        "retryCount": 3,
        "customHeaders": {
          "Custom-Header": "value"
        }
      }
    }
  }
}
```

## List Providers Command

The `list-providers` command shows all available provider types:

```bash
# List all provider types
aidx list-providers

# Show detailed provider information
aidx list-providers --detailed
```

**Example output:**
```
📋 Available Provider Types

AI Providers:
┌──────────────┬─────────────┬──────────────────────────────────────────────┐
│   Provider   │   Status    │                 Description                  │
├──────────────┼─────────────┼──────────────────────────────────────────────┤
│ azure-openai │ ✅ Registered│ Azure OpenAI Service integration           │
│ openai       │ ✅ Registered│ OpenAI API direct integration              │
│ anthropic    │ ⚪ Available │ Anthropic Claude integration (coming soon)  │
└──────────────┴─────────────┴──────────────────────────────────────────────┘

Data Source Providers:
┌─────────────────────┬─────────────┬─────────────────────────────────────────┐
│      Provider       │   Status    │               Description               │
├─────────────────────┼─────────────┼─────────────────────────────────────────┤
│ application-insights│ ✅ Registered│ Azure Application Insights telemetry   │
│ log-analytics       │ ✅ Registered│ Azure Log Analytics workspace data     │
│ azure-monitor       │ ⚪ Available │ Azure Monitor metrics (coming soon)    │
└─────────────────────┴─────────────┴─────────────────────────────────────────┘

Authentication Providers:
┌────────────────────────┬─────────────┬───────────────────────────────────────┐
│        Provider        │   Status    │              Description              │
├────────────────────────┼─────────────┼───────────────────────────────────────┤
│ azure-managed-identity │ ✅ Registered│ Azure Managed Identity authentication │
│ azure-service-principal│ ✅ Registered│ Azure Service Principal authentication│
│ azure-cli              │ ⚪ Available │ Azure CLI token authentication       │
└────────────────────────┴─────────────┴───────────────────────────────────────┘

Total: 6 registered providers, 3 available providers
```

## Troubleshooting Providers

### Provider Configuration Issues

```bash
# Check provider status
aidx providers show

# Look for error indicators (❌) and configure
aidx providers configure ai azure-openai
```

### Provider Connection Problems

```bash
# Test provider connections
aidx status --verbose

# Check specific provider logs
export AIDX_LOG_LEVEL=debug
aidx status --verbose
```

### Provider Not Available

```bash
# Check if provider is registered
aidx list-providers

# If provider shows as "Available" but not "Registered":
# Provider may need additional setup or is not yet implemented
```

### Multiple Provider Conflicts

```bash
# Check for conflicting configurations
aidx providers show

# Clear problematic provider
aidx providers configure ai azure-openai  # Reconfigure

# Or reset to defaults
aidx setup  # Full reconfiguration
```

## Best Practices

### Provider Selection

- **Azure Environments**: Use Azure OpenAI + Managed Identity
- **Development**: Use OpenAI + Service Principal for simplicity  
- **CI/CD**: Use Service Principal authentication
- **Multi-tenant**: Use Service Principal with appropriate permissions

### Configuration Management

- **Document** your provider choices and rationale
- **Test** provider changes with simple queries first
- **Backup** configuration before making changes
- **Use environment variables** for sensitive settings in CI/CD

### Security Considerations

- **Prefer Managed Identity** over API keys when possible
- **Rotate Service Principal secrets** regularly
- **Use least-privilege permissions** for authentication
- **Store secrets securely** (Azure Key Vault, environment variables)

## Integration with Other Commands

### Setup Integration

```bash
# Initial setup configures default providers
aidx setup

# Later modify specific providers
aidx providers set-default ai openai
aidx providers configure ai openai
```

### Status Integration

```bash
# Check provider health
aidx status --verbose

# Fix provider issues
aidx providers configure ai azure-openai
```

### Query Integration

```bash
# Queries use currently configured providers
aidx "show me errors"

# Switch providers and re-run
aidx providers set-default ai openai
aidx "show me errors"  # Now uses OpenAI instead of Azure OpenAI
```

## Next Steps

- **New Users**: Start with `aidx setup` for guided provider configuration
- **Environment Changes**: Use `aidx providers set-default` to switch between setups
- **Troubleshooting**: Check `aidx status --verbose` for provider-specific issues
- **Advanced Configuration**: Manually edit `~/.aidx/config.json` for custom settings