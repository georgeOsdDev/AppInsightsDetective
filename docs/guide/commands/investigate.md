# AI-Driven Intelligent Investigation System

The Intelligent Investigation System is a powerful AI-driven feature that automatically analyzes Application Insights problems, generates dynamic investigation plans, and provides root cause analysis with actionable recommendations.

## Features

- 🗣️ **Natural Language Input**: Describe problems in plain English
- 🧠 **AI Analysis**: Automatic problem classification and investigation planning  
- 🔍 **Dynamic Investigation**: Multi-phase adaptive query execution
- 🎯 **Root Cause Analysis**: Evidence-based cause identification with confidence scores
- 💡 **Actionable Recommendations**: Specific solutions and prevention strategies

## Quick Start

### Basic Investigation
```bash
# Describe the problem naturally
aidx investigate "Application is responding slowly"

# Specify the investigation type
aidx investigate "Users are getting 500 errors" --type availability

# Set maximum investigation time
aidx investigate "Missing telemetry data" --max-time 10
```

### Interactive Mode
```bash
# Launch interactive guided investigation
aidx investigate --interactive

# This will prompt you for:
# - Problem description
# - Issue type (if unsure, AI will classify)
# - Severity level
# - Affected services
```

### Investigation Management
```bash
# Check status of an ongoing investigation
aidx investigate --status <investigation-id>

# Continue a specific investigation
aidx investigate --continue <investigation-id>

# Pause an investigation
aidx investigate --pause <investigation-id>

# Resume a paused investigation
aidx investigate --resume <investigation-id>

# Cancel an investigation
aidx investigate --cancel <investigation-id>

# View investigation history
aidx investigate --history
```

### Export Results
```bash
# Export as markdown report (default)
aidx investigate --export <investigation-id>

# Export as HTML report
aidx investigate --export <investigation-id> --format html

# Export as JSON data
aidx investigate --export <investigation-id> --format json
```

## Investigation Types

The system supports four main investigation types, each with specialized analysis approaches:

### 🐌 Performance Issues
**Examples**: Slow response times, high latency, throughput problems
**Analysis Focus**:
- Response time trends and baselines
- Dependency performance analysis
- Resource utilization patterns
- Query performance bottlenecks

```bash
aidx investigate "API response times are 5x slower than normal"
```

### 🚫 Availability Issues  
**Examples**: Service outages, 500 errors, downtime events
**Analysis Focus**:
- Error rate analysis and trends
- Success rate monitoring
- Service health checks
- Downtime timeline reconstruction

```bash
aidx investigate "Users getting 500 errors since 2 PM"
```

### 📊 Data Quality Issues
**Examples**: Missing telemetry, data inconsistencies, incomplete logs
**Analysis Focus**:
- Data completeness analysis
- Missing telemetry detection
- Data consistency validation
- Sampling rate verification

```bash
aidx investigate "Request telemetry missing for mobile app"
```

### 🔗 Dependency Issues
**Examples**: External service failures, third-party problems, connection issues
**Analysis Focus**:
- Dependency call analysis
- External service health monitoring
- Connection failure patterns
- Timeout and retry behavior

```bash
aidx investigate "Payment service integration failing intermittently"
```

## How It Works

### 1. Problem Classification
When you describe a problem, the AI analyzes the description to:
- Classify the problem type (performance, availability, data-quality, dependencies)
- Assess confidence level of classification
- Generate reasoning for the classification

### 2. Investigation Planning
Based on the problem type, the system:
- Creates a multi-phase investigation plan
- Generates specific KQL queries for each phase
- Estimates execution time and sets priorities
- Defines dependencies between phases

### 3. Automated Execution
The system executes the investigation by:
- Running queries systematically across phases
- Collecting and analyzing results using AI
- Building evidence trail with significance scoring
- Adapting plan based on intermediate findings

### 4. Root Cause Analysis
At completion, the system provides:
- Primary cause identification with confidence scores
- Contributing factors analysis
- Timeline of events
- Business impact assessment

### 5. Actionable Recommendations
The final report includes:
- **Immediate actions**: Urgent steps to resolve the issue
- **Short-term fixes**: Quick improvements to implement
- **Long-term solutions**: Architectural or process improvements
- **Prevention strategies**: How to avoid similar issues

## Example Investigation Flow

```bash
$ aidx investigate "Application response times are very slow" --interactive

🔍 Starting AI-Driven Investigation
==================================================
Problem: Application response times are very slow
Type: performance (auto-classified, confidence: 92%)

📋 Investigation Plan
============================
Type: performance
Confidence: 85.0%
Estimated Time: 4 minutes
Phases: 3

🔍 Investigation Phases:
  1. Baseline Performance Analysis
     Establish normal performance patterns
     Queries: 2

  2. Performance Degradation Detection  
     Identify when slowdown started
     Queries: 3

  3. Root Cause Investigation
     Analyze dependencies and bottlenecks
     Queries: 4

Would you like to proceed with this investigation plan? (Y/n) y

🔄 Executing Investigation...
📊 Progress: ████████████████████ 100.0%
   Phases: 3/3 | Queries: 9/9

✅ Investigation Completed!
========================================
Summary: Performance degradation identified starting at 14:23 UTC. Root cause traced to database connection pool exhaustion affecting 23% of requests.

Root Cause Analysis:
  Database connection pool reached maximum capacity (95% utilization)
  Confidence: 87.5%

Execution Details:
  Duration: 187 seconds
  Evidence collected: 12 items
  Queries executed: 9

Key Evidence:
  • Database connection pool utilization peaked at 98%
  • Response time P95 increased from 245ms to 1.2s
  • Connection timeouts increased 450% during incident window

Would you like to export the investigation results? (y/N) y
✅ Investigation exported to: investigation-a1b2c3d4.md
```

## Advanced Features

### Resume Investigations
If an investigation is interrupted, you can resume it later:

```bash
# List recent investigations to find the ID
aidx investigate --history

# Resume the investigation
aidx investigate --resume inv_abc123
```

### Custom Time Limits
Control investigation duration:

```bash
# Quick 3-minute investigation
aidx investigate "high error rates" --max-time 3

# Deep analysis with 15-minute limit
aidx investigate "complex performance issue" --max-time 15
```

### Investigation History
Track and review past investigations:

```bash
$ aidx investigate --history

📚 Investigation History
==============================
ID: a1b2c3d4...
   Problem: Application response times are very slow...
   Type: performance | Completed: 12/15/2024
   Duration: 187s | Evidence: 12 items

ID: e5f6g7h8...
   Problem: Users getting 500 errors...  
   Type: availability | Completed: 12/14/2024
   Duration: 94s | Evidence: 8 items
```

## Integration with Existing Features

The investigation system integrates seamlessly with existing AppInsights Detective features:

- **AI Providers**: Uses your configured AI provider (Azure OpenAI, OpenAI, etc.)
- **Data Sources**: Works with Application Insights, Log Analytics, and Azure Data Explorer
- **Templates**: Generated queries can be saved as templates
- **Interactive Mode**: Combines with existing interactive session capabilities
- **Output Formats**: Supports all standard output formats and file exports

## Configuration

The investigation system uses your existing AppInsights Detective configuration. Ensure you have:

1. **AI Provider configured**: Required for problem classification and plan generation
2. **Data Source configured**: Required for query execution
3. **Authentication setup**: Required for accessing Application Insights data

```bash
# Check your configuration
aidx status

# Setup if needed
aidx setup
```

## Best Practices

### When to Use Investigations

**✅ Good Use Cases**:
- Complex multi-system issues requiring systematic analysis
- Incidents requiring rapid root cause identification
- Performance problems with unknown causes
- Issues requiring comprehensive evidence collection

**❓ Consider Alternatives**:
- Simple, well-understood queries → Use `aidx "query description"`
- Exploratory analysis → Use `aidx --interactive`
- Known issues with established queries → Use templates

### Problem Descriptions

Write clear, specific problem descriptions:

**✅ Good Examples**:
- "API response times increased from 200ms to 2s since 3 PM"
- "Users in Europe getting 500 errors when uploading files"
- "Missing request telemetry for mobile app version 2.1.3"

**❌ Vague Examples**:
- "Something is wrong"
- "App is broken"
- "Performance issues"

### Investigation Management

- Monitor long-running investigations with `--status`
- Use `--max-time` to prevent investigations from running too long
- Export important investigation results for documentation
- Review `--history` to learn from past investigations

## Troubleshooting

### Common Issues

**Investigation won't start**:
- Check AI provider configuration: `aidx status`
- Verify data source connectivity
- Ensure problem description is specific enough

**Investigation stuck/slow**:
- Check investigation status: `aidx investigate --status <id>`
- Consider canceling and restarting with shorter time limit
- Verify Application Insights data availability

**Poor classification accuracy**:
- Provide more specific problem descriptions
- Manually specify investigation type with `--type`
- Review and adjust investigation plan in interactive mode

**Missing evidence**:
- Ensure sufficient data exists in the time range
- Check Application Insights data retention settings
- Verify permissions for data access

### Getting Help

```bash
# Show investigation help
aidx investigate --help

# Check overall system status
aidx status

# Get general help
aidx --help
```

For additional support, refer to the main AppInsights Detective documentation or file issues on the project repository.