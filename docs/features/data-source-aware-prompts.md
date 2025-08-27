# Data-Source-Aware Prompts

This document describes the enhanced prompt system that provides data-source-specific prompts for improved KQL generation across different Azure data sources.

## Problem Solved

Previously, the system used hardcoded Application Insights-specific prompts regardless of the actual data source being queried. This caused issues when using other data sources like Log Analytics, where queries would fail because the AI was expecting Application Insights table names (requests, dependencies, etc.) instead of Log Analytics tables (Heartbeat, Perf, etc.).

## Solution Overview

The system now:
1. **Automatically detects** the configured data source type from the configuration
2. **Generates appropriate prompts** for each data source type
3. **Supports extra context** to provide additional guidance to the AI
4. **Includes prompt templates** for common analysis scenarios

## Data Source Types

### Application Insights (`application-insights`)
- **Tables**: requests, dependencies, exceptions, pageViews, traces, customEvents
- **Focus**: Web application telemetry and performance monitoring
- **Use Cases**: HTTP request analysis, dependency tracking, error analysis

### Log Analytics (`log-analytics`) 
- **Tables**: Heartbeat, Perf, Event, Syslog, SecurityEvent, plus custom tables
- **Focus**: Flexible workspace-based logging with various data sources
- **Use Cases**: System monitoring, security analysis, custom data analysis

### Azure Metrics (`azure-metrics`)
- **Focus**: Metric-based queries with time-series data
- **Use Cases**: Resource utilization, performance metrics, capacity planning

## Usage

### Automatic Data Source Detection

The system automatically uses the appropriate prompt based on your configuration:

```bash
# Your data source is automatically detected from config
aidx "show me high CPU usage" 
# Uses Log Analytics prompt if configured for Log Analytics
# Uses Application Insights prompt if configured for Application Insights
```

### Extra Context

You can provide additional context to guide the AI:

```bash
# Context will be included in the prompt to help AI generate better queries
aidx "find errors in checkout" --context "Focus on the payment processing service during peak hours"
```

### Prompt Templates

Use predefined prompt templates for common analysis scenarios:

```bash
# List available prompt templates
aidx template prompt list

# Use a performance analysis template
aidx template prompt apply performance-focus --threshold 2000 --appContext "e-commerce site"
```

## Available Prompt Templates

### Performance Analysis Focus
- **ID**: `performance-focus`
- **Purpose**: Guide AI to focus on performance metrics and optimization
- **Parameters**:
  - `threshold`: Response time threshold in ms (default: 1000)
  - `appContext`: Application context description (default: "web application")

### Error Investigation Focus
- **ID**: `error-investigation`
- **Purpose**: Focus on error analysis and troubleshooting
- **Parameters**:
  - `environment`: Environment being analyzed (default: "production")
  - `timeContext`: Time context for analysis (default: "recent activity")

### User Experience Analysis
- **ID**: `user-experience`
- **Purpose**: Focus on user experience metrics and customer impact
- **Parameters**:
  - `userSegment`: Target user segment (default: "all users")
  - `businessPriority`: Business priority focus (default: "customer satisfaction")

## Creating Custom Prompt Templates

You can create custom prompt templates to capture domain-specific analysis approaches:

```bash
aidx template prompt create
```

Example prompt template:

```json
{
  "id": "security-audit",
  "name": "Security Audit Focus",
  "description": "Guide AI to focus on security-related analysis",
  "category": "Security",
  "contextTemplate": "Analyze the data for security implications. Focus on:\n- Suspicious access patterns\n- Failed authentication attempts\n- Privilege escalation indicators\n- Data access anomalies\n\nSecurity context: {{securityLevel}}\nCompliance requirements: {{compliance}}",
  "parameters": [
    {
      "name": "securityLevel",
      "type": "string",
      "description": "Security classification level",
      "required": false,
      "defaultValue": "standard"
    },
    {
      "name": "compliance",
      "type": "string", 
      "description": "Relevant compliance frameworks",
      "required": false,
      "defaultValue": "general"
    }
  ]
}
```

## API Usage

For developers integrating with the system:

```typescript
import { buildSystemPrompt } from './prompts/systemPrompts';

// Generate data source specific prompt
const prompt = buildSystemPrompt('log-analytics', schema, extraContext);

// Use in AI provider
const result = await aiProvider.generateQuery({
  userInput: "show errors",
  dataSourceType: 'log-analytics',
  schema: schema,
  extraContext: "Focus on web server errors"
});
```

## Configuration

The system automatically uses the data source type from your configuration:

```json
{
  "providers": {
    "dataSources": {
      "default": "log-analytics",
      "log-analytics": {
        "type": "log-analytics",
        "subscriptionId": "...",
        "resourceGroup": "...",
        "workspaceName": "..."
      }
    }
  }
}
```

## Benefits

1. **Better Query Generation**: AI receives appropriate context for each data source
2. **Reduced Errors**: No more "doesn't relate to Application Insights" responses for Log Analytics queries
3. **Flexible Context**: Extra context helps AI understand specific use cases
4. **Reusable Templates**: Common analysis patterns can be captured and reused
5. **Extensible**: Easy to add new data source types and prompt templates

## Migration

Existing queries will automatically benefit from the enhanced prompts without any configuration changes. The system maintains backward compatibility while providing improved functionality.