# Status Command

The `status` command checks your AppInsights Detective configuration, provider health, and connectivity status. It's essential for troubleshooting and verifying your setup.

## Purpose

The status command helps you:
- Verify configuration validity
- Check provider connection status
- Test Azure service connectivity  
- Troubleshoot authentication issues
- Monitor system health

## Basic Usage

```bash
# Basic status check
aidx status

# Detailed status with connection tests
aidx status --verbose
```

## Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--verbose` | Show detailed information and run connectivity tests | `aidx status --verbose` |

## Status Output Sections

### 1. Configuration Validation

Shows whether your configuration file is valid and properly formatted:

```
📋 Configuration:
  ✅ Configuration is valid
```

**Possible states:**
- ✅ **Configuration is valid**: All required settings present and properly formatted
- ❌ **Configuration has issues**: Missing or invalid configuration values

### 2. Provider Status

Displays the status of each configured provider:

```
🔧 Provider Status:
  🤖 AI Provider: azure-openai
    ✅ Configured
    Endpoint: https://your-openai.openai.azure.com/
    Deployment: gpt-4
    API Key: ✅ Set

  📊 Data Source: application-insights
    ✅ Configured  
    Application ID: 12345678-****-****-****-********9abc
    Tenant ID: 87654321-****-****-****-********4321

  🔐 Authentication: azure-managed-identity
    ✅ Configured
    Tenant ID: 87654321-****-****-****-********4321
```

**Provider Status Indicators:**
- ✅ **Configured**: Provider has all required settings
- ❌ **Not properly configured**: Missing required configuration values
- ⚠️ **Partially configured**: Some optional settings missing

### 3. Connection Tests (Verbose Mode)

When using `--verbose`, the command runs actual connectivity tests:

```
🌐 Connection Tests:
  🤖 Azure OpenAI:
    ✅ Connection successful
    ✅ Authentication working
    ✅ Model deployment accessible
    Response time: 234ms
    
  📊 Application Insights:
    ✅ Connection successful
    ✅ Authentication working
    ✅ Data access verified
    Response time: 156ms
    
  🔍 Resource Discovery:
    ✅ Azure Resource Graph accessible
    ✅ Application Insights resource found
    Subscription: My Production Subscription
    Resource Group: myapp-prod-rg
    Resource Name: myapp-insights
```

## Understanding Status Results

### Configuration Issues

When configuration has issues, you'll see specific error messages:

```
📋 Configuration:
  ❌ Configuration has issues
    - Missing required field: providers.ai.azure-openai.endpoint
    - Invalid format: providers.dataSources.application-insights.applicationId
    - Unknown provider type: custom-provider
```

**Common fixes:**
- Run `aidx setup` to reconfigure
- Manually edit `~/.aidx/config.json`  
- Check for typos in configuration values

### Provider Configuration Problems

```
🔧 Provider Status:
  🤖 AI Provider: azure-openai
    ❌ Not properly configured
    Missing: endpoint, deploymentName
    
  📊 Data Source: application-insights
    ⚠️ Partially configured
    Missing: tenantId (required for resource discovery)
```

**Solutions:**
- **Missing fields**: Run `aidx setup` to add missing configuration
- **Invalid values**: Check Azure Portal for correct values
- **Unknown providers**: Verify provider names match supported types

### Connection Test Failures

#### AI Provider Connection Issues

```
🌐 Connection Tests:
  🤖 Azure OpenAI:
    ❌ Connection failed: Endpoint unreachable
    ❌ Authentication failed: Invalid credentials
    ❌ Model deployment not found: "gpt-4" deployment not available
```

**Troubleshooting:**
- **Endpoint unreachable**: Check network connectivity and endpoint URL format
- **Authentication failed**: Verify API key or managed identity configuration
- **Model deployment not found**: Check deployment name in Azure OpenAI Studio

#### Data Source Connection Issues

```
📊 Application Insights:
  ❌ Connection failed: Resource not found
  ❌ Authentication failed: Insufficient permissions
  ❌ Data access denied: Reader role required
```

**Troubleshooting:**
- **Resource not found**: Verify Application ID and that resource exists
- **Authentication failed**: Check tenant ID and authentication provider setup
- **Data access denied**: Ensure "Application Insights Reader" role assigned

#### Resource Discovery Issues

```
🔍 Resource Discovery:
  ❌ Azure Resource Graph inaccessible: Reader role required
  ❌ Application Insights resource not found in tenant
  ⚠️ Multiple matching resources found
```

**Troubleshooting:**
- **Resource Graph inaccessible**: Assign "Reader" role on subscription
- **Resource not found**: Check Application ID and tenant ID
- **Multiple resources**: System will use first match (check configuration)

## Detailed Status Information

### Verbose Mode Details

The `--verbose` flag provides additional information:

```bash
aidx status --verbose
```

**Additional details include:**
- **Configuration file location**: `~/.aidx/config.json`
- **Provider settings**: Masked sensitive values (API keys shown as ✅/❌)
- **Resource discovery results**: Subscription, resource group, resource name
- **Connection response times**: Performance metrics for each service
- **Authentication method**: Active authentication mechanism
- **API versions**: Azure API versions being used

### Environment Information

Verbose mode also shows environment details:

```
🔧 Environment Information:
  Node.js Version: v18.17.0
  AppInsights Detective Version: 1.0.0
  Platform: linux x64
  Configuration Location: /home/user/.aidx/config.json
  
🔗 Azure Context:
  Current Subscription: My Production Subscription (12345678-1234-1234-1234-123456789abc)
  Default Resource Group: myapp-prod-rg
  Azure CLI Version: 2.50.0 (if available)
```

## Common Status Check Scenarios

### New Installation Verification

After running `aidx setup`:

```bash
aidx status --verbose
```

**Expected output for successful setup:**
- Configuration is valid
- All providers configured
- All connection tests pass
- Resource discovery successful

### Troubleshooting Authentication

When queries fail with permission errors:

```bash
aidx status --verbose
```

**Look for:**
- Authentication provider status
- Connection test results for auth
- Resource discovery status

### Monitoring System Health

For ongoing system monitoring:

```bash
# Basic health check (fast)
aidx status

# Detailed health check (includes connectivity tests)
aidx status --verbose
```

### Pre-deployment Validation

Before deploying to production:

```bash
# Verify all connections work
aidx status --verbose

# Test with actual query
aidx "test query to verify end-to-end functionality"
```

## Status Command Exit Codes

The status command returns different exit codes for scripting:

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| 0 | Success | Configuration valid, all tests passed |
| 1 | Configuration Error | Invalid configuration file |
| 2 | Provider Error | Provider configuration issues |
| 3 | Connection Error | Connectivity tests failed |
| 4 | Authentication Error | Authentication tests failed |

**Example usage in scripts:**
```bash
#!/bin/bash
if aidx status --verbose; then
    echo "System healthy, proceeding with queries"
    aidx "daily report query"
else
    echo "System health check failed, aborting"
    exit 1
fi
```

## Configuration File Locations

The status command checks for configuration files in these locations (in order):

1. `$AIDX_CONFIG_PATH` (if set)
2. `~/.aidx/config.json`
3. `./aidx.config.json` (current directory)

**Configuration file priority:**
```
🔧 Configuration Sources:
  Primary: /home/user/.aidx/config.json ✅ Found
  Override: $AIDX_CONFIG_PATH (not set)
  Local: ./aidx.config.json (not found)
```

## Provider Health Monitoring

### Individual Provider Status

The status command checks each provider independently:

```
🔧 Individual Provider Health:
  🤖 AI Provider (azure-openai):
    Status: ✅ Healthy
    Last Test: 2024-01-15 10:30:00
    Response Time: 234ms
    Rate Limits: OK (1000 requests/min remaining)
    
  📊 Data Source Provider (application-insights):
    Status: ✅ Healthy  
    Last Test: 2024-01-15 10:30:00
    Response Time: 156ms
    Query Quota: OK (unlimited)
    
  🔐 Auth Provider (azure-managed-identity):
    Status: ✅ Healthy
    Token Expiry: 2024-01-15 11:30:00 (59 minutes remaining)
    Permissions: Application Insights Reader ✅
```

### Provider Fallback Status

When fallback is enabled:

```
🔄 Provider Fallback Configuration:
  Fallback Enabled: ✅ Yes
  AI Provider Order: [azure-openai, openai]
  Data Source Order: [application-insights]
  
  Fallback Health:
    Primary AI (azure-openai): ✅ Available
    Fallback AI (openai): ✅ Available (not tested)
```

## Integration with Other Commands

### Status → Setup Workflow

When status shows issues:

```bash
# Check status
aidx status --verbose

# If configuration issues found:
aidx setup

# Verify fixes
aidx status --verbose
```

### Status → Query Workflow

Before running important queries:

```bash
# Health check first
aidx status

# Then run query with confidence
aidx "important business query"
```

### Status → Providers Workflow

When provider issues are found:

```bash
# Check overall status
aidx status --verbose

# Configure specific provider
aidx providers configure ai azure-openai

# Verify provider fix
aidx status --verbose
```

## Automated Monitoring

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Checking AppInsights Detective health..."
if aidx status --verbose > health.log 2>&1; then
    echo "✅ System healthy"
    exit 0
else
    echo "❌ Health check failed - see health.log"
    cat health.log
    exit 1
fi
```

### Monitoring Integration

```bash
# Nagios/monitoring system integration
check_aidx_status() {
    if aidx status >/dev/null 2>&1; then
        echo "OK - AppInsights Detective healthy"
        return 0
    else
        echo "CRITICAL - AppInsights Detective configuration issues"
        return 2
    fi
}
```

## Best Practices

### Regular Status Checks

- Run `aidx status` before important queries
- Use `aidx status --verbose` for troubleshooting
- Include status checks in deployment scripts
- Monitor provider health in production environments

### Interpreting Results

- **Green checkmarks (✅)**: All good, proceed with confidence
- **Warning symbols (⚠️)**: System functional but check recommendations
- **Red X marks (❌)**: Issues need attention before proceeding

### Performance Monitoring

- Watch connection response times in verbose output
- Monitor authentication token expiry times
- Check for rate limit warnings
- Track resource discovery performance

## Troubleshooting Guide

### When Status Shows "Configuration has issues"

1. **Check file existence**: `ls -la ~/.aidx/config.json`
2. **Validate JSON format**: `cat ~/.aidx/config.json | jq .`
3. **Run setup again**: `aidx setup`
4. **Check permissions**: `ls -la ~/.aidx/`

### When Connection Tests Fail

1. **Check network connectivity**: `curl -I https://management.azure.com/`
2. **Verify Azure credentials**: `az account show`
3. **Test service endpoints manually**:
   ```bash
   # Test Azure OpenAI
   curl -H "Authorization: Bearer $(az account get-access-token --query accessToken -o tsv)" \
        "https://your-openai.openai.azure.com/openai/deployments"
   
   # Test Application Insights
   curl -H "Authorization: Bearer $(az account get-access-token --resource https://api.applicationinsights.io/ --query accessToken -o tsv)" \
        "https://api.applicationinsights.io/v1/apps/YOUR_APP_ID/metadata"
   ```

### When Authentication Fails

1. **Check current Azure context**: `az account show`
2. **Verify role assignments**:
   ```bash
   az role assignment list --assignee $(az account show --query user.name -o tsv) --all
   ```
3. **Test managed identity** (if on Azure VM):
   ```bash
   curl -H Metadata:true "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
   ```

## Next Steps

After successful status verification:

- **Configuration Issues**: See [Setup Guide](setup.md)
- **Provider Problems**: Check [Providers Command](providers.md)  
- **Query Execution**: Try [Query Command](query.md)
- **Advanced Troubleshooting**: Review [Setup Guide troubleshooting section](../setup.md#troubleshooting-common-issues)