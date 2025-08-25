# Setup Guide

This guide walks you through installing and configuring AppInsights Detective for your Azure environment.

## Prerequisites

Before you begin, ensure you have:

### Required Azure Resources

- **Azure Application Insights** resource with data to query
- **Azure OpenAI** resource with a deployed model (GPT-4 recommended)
- **Azure Tenant ID** for authentication and resource discovery

### Required Permissions

Your user account or managed identity needs the following permissions:

- **Application Insights Reader** role on your Application Insights resource
- **Azure Resource Graph Reader** role for automatic resource discovery
- **Cognitive Services OpenAI User** role on your Azure OpenAI resource
- **Subscription Reader** role for cross-subscription resource discovery

### System Requirements

- **Node.js** 18.0.0 or higher
- **npm** (included with Node.js)
- **Internet connectivity** for Azure services

## Installation Options

### Option 1: npm Install (Recommended)

> **Note**: npm package is coming soon. For now, use the source installation method below.

```bash
npm install -g appinsights-detective
```

### Option 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/georgeOsdDev/AppInsightsDetective.git
cd AppInsightsDetective

# Install dependencies and build
npm install
npm run build

# Install globally
npm install -g .

# Verify installation
aidx --version
```

### Option 3: Container Usage

> **Note**: Container support is planned for a future release.

## Configuration Setup

AppInsights Detective offers multiple ways to configure your Azure resources. Choose the method that best fits your workflow.

### Method 1: Interactive Setup (Recommended)

Run the interactive setup wizard:

```bash
aidx setup
```

The wizard will guide you through:

1. **AI Provider Selection**: Choose between Azure OpenAI or OpenAI
2. **Azure OpenAI Configuration**:
   - API endpoint URL (e.g., `https://your-openai.openai.azure.com/`)
   - Deployment name (your GPT model deployment)
   - Authentication method (Managed Identity recommended)

3. **Data Source Configuration**:
   - Application Insights Application ID
   - Azure Tenant ID for authentication

4. **Authentication Provider**:
   - Azure Managed Identity (recommended for Azure environments)
   - Service Principal (for CI/CD scenarios)

5. **General Settings**:
   - Default language for explanations (en, ja, ko, zh, etc.)
   - Log level (info, debug, warn, error)

The system automatically discovers additional Azure resource information (subscription ID, resource group, resource name) during your first query.

### Method 2: Environment Variables

Set the following environment variables:

```bash
# Required settings
export AZURE_APPLICATION_INSIGHTS_ID="your-application-insights-app-id"
export AZURE_TENANT_ID="your-azure-tenant-id"
export AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"

# Optional settings
export AZURE_OPENAI_API_KEY="your-api-key"  # If not using Managed Identity
export AIDX_LANGUAGE="en"  # Default language
export AIDX_LOG_LEVEL="info"  # Log level
```

### Method 3: Configuration File

Create a configuration file at `~/.aidx/config.json`:

```json
{
  "providers": {
    "ai": {
      "default": "azure-openai",
      "azure-openai": {
        "type": "azure-openai",
        "endpoint": "https://your-openai.openai.azure.com/",
        "deploymentName": "gpt-4",
        "apiKey": "${AZURE_OPENAI_API_KEY}"
      }
    },
    "dataSources": {
      "default": "application-insights",
      "application-insights": {
        "type": "application-insights",
        "applicationId": "your-application-insights-app-id",
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
  "language": "en"
}
```

## Provider Configuration Details

### Azure OpenAI Setup

1. **Create Azure OpenAI Resource**:
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a new Azure OpenAI resource
   - Deploy a GPT-4 model (recommended) or GPT-3.5-turbo

2. **Get Configuration Values**:
   - **Endpoint**: Found in "Keys and Endpoint" section
   - **Deployment Name**: Name you gave your model deployment
   - **API Key**: Optional if using Managed Identity

3. **Set Permissions**:
   - Assign "Cognitive Services OpenAI User" role to your user account

### Application Insights Setup

1. **Find Application ID**:
   - Navigate to your Application Insights resource in Azure Portal
   - Go to "API Access" section
   - Copy the "Application ID"

2. **Note Tenant ID**:
   - Your Azure AD Tenant ID (found in Azure AD overview)

3. **Set Permissions**:
   - Assign "Reader" role on the Application Insights resource
   - Assign "Reader" role on the subscription (for resource discovery)

### Authentication Configuration

#### Azure Managed Identity (Recommended)

For Azure environments (VMs, App Service, Container Instances):

```json
{
  "auth": {
    "default": "azure-managed-identity",
    "azure-managed-identity": {
      "type": "azure-managed-identity",
      "tenantId": "your-azure-tenant-id"
    }
  }
}
```

#### Service Principal

For CI/CD or external environments:

```json
{
  "auth": {
    "default": "azure-service-principal",
    "azure-service-principal": {
      "type": "azure-service-principal",
      "tenantId": "your-azure-tenant-id",
      "clientId": "your-client-id",
      "clientSecret": "${AZURE_CLIENT_SECRET}"
    }
  }
}
```

## Configuration Validation

After setup, verify your configuration:

```bash
# Check configuration status
aidx status

# Detailed status with connection tests
aidx status --verbose
```

Expected output for a working configuration:
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

## Troubleshooting Common Issues

### Permission Problems

**Error**: `403 Forbidden` or `Access Denied`

**Solution**: Verify you have the required permissions:
```bash
# Check your current Azure account
az account show
az role assignment list --assignee $(az account show --query user.name -o tsv) --all
```

### Authentication Failures

**Error**: `AADSTS* authentication errors`

**Solutions**:
1. **Managed Identity**: Ensure the resource has managed identity enabled
2. **Service Principal**: Verify client ID and secret are correct
3. **Tenant ID**: Confirm you're using the correct Azure AD tenant

### Configuration Validation Errors

**Error**: `Configuration has issues`

**Solution**: Run detailed status check:
```bash
aidx status --verbose
```

Common fixes:
- **Missing Application ID**: Run `aidx setup` to configure
- **Invalid Endpoint**: Check Azure OpenAI endpoint format
- **Wrong Tenant ID**: Verify Azure AD tenant ID

### Network Connectivity Issues

**Error**: `Connection timeout` or `Network unreachable`

**Solutions**:
1. **Firewall**: Ensure outbound HTTPS (443) is allowed
2. **Proxy**: Configure proxy settings if required
3. **DNS**: Verify Azure endpoints resolve correctly

### Model Deployment Issues

**Error**: `Model not found` or `Deployment not available`

**Solutions**:
1. Verify model deployment name matches configuration
2. Check model deployment status in Azure Portal
3. Ensure model has sufficient quota allocated

## Resource Discovery Process

AppInsights Detective automatically discovers Azure resource information:

1. **Initial Configuration**: You provide Application ID and Tenant ID
2. **First Query**: System queries Azure Resource Graph API to find:
   - Subscription ID containing the Application Insights resource
   - Resource Group name
   - Full resource name and metadata
3. **Configuration Update**: Discovered information is saved for future use
4. **Azure Portal Integration**: Enables one-click query execution in Azure Portal

This process requires the "Resource Graph Reader" role on subscriptions containing your Application Insights resources.

## Next Steps

Once configured, you're ready to start querying:

1. **Test Basic Query**: `aidx "show me requests from last hour"`
2. **Try Interactive Mode**: `aidx --interactive`
3. **Explore Templates**: `aidx template list`
4. **Read Examples**: [Query Examples Guide](showcase.md)

## Advanced Configuration

For advanced scenarios, see:
- [Provider Development Guide](../developer/provider.md) - Custom providers
- [Commands Reference](commands/index.md) - All available options
- [Architecture Overview](../developer/architecture.md) - System internals