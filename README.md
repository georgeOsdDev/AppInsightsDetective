# 🔍 AppInsights Detective 🕵

[![CI](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml/badge.svg)](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Query Azure Application Insights with natural language using AI**

AppInsights Detective is an intelligent CLI tool that allows you to query your Azure Application Insights data using natural language. It leverages Azure OpenAI to convert your questions into KQL (Kusto Query Language) queries and presents the results in a user-friendly format.

![example](image.png)

## ✨ Features

- 🗣️ **Natural Language Queries**: Ask questions in plain natural language
- 🤖 **AI-Powered KQL Generation**: Advanced conversion to KQL using Azure OpenAI with confidence scoring
- 🔐 **Secure Authentication**: Uses Azure Managed Identity with multi-tenant support
- 📈 **Rich Visualization**: Console-based charts and formatted tables with smart column management
- 📁 **Multiple Output Formats**: JSON, CSV, TSV, Raw, and Table formats with customizable encoding
- 💾 **Smart File Export**: Save results with automatic format detection and encoding options
- 🕵 **Interactive Mode**: Comprehensive step-by-step query experience with guided assistance
  - 📖 **Query Analysis & Validation**: AI-powered query explanation, regeneration, and confidence assessment
  - 🔄 **Query History & Management**: Track, edit, and regenerate queries with confidence-based recommendations
  - 🧠 **Advanced Result Analysis**: AI-powered pattern detection, anomaly identification, and insights
  - 🌐 **Azure Portal Integration**: One-click query execution in Azure Portal with full visualization capabilities

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Azure Application Insights resource
- Azure OpenAI resource
- Appropriate Azure permissions

### Installation

> **Note**: This package is currently in development. For now, please install from source.

```bash
# Install from npm (coming soon)
npm install -g appinsights-detective
```

**Install from source:**

```bash
git clone https://github.com/georgeOsdDev/AppInsightsDetective.git
cd AppInsightsDetective
npm install
npm run build
npm install -g .
# aidx will be available
```

## 🔐 Authentication & Permissions

AppInsights Detective uses Azure Managed Identity for secure authentication. Ensure you have the following permissions:

### Required Permissions
- **Application Insights**: Reader role on your Application Insights resource
- **Azure Resource Graph**: Reader role for resource discovery across subscriptions
- **OpenAI**: Cognitive Services OpenAI User role on your Azure OpenAI resource
- **Subscription**: Reader role for cross-subscription resource discovery


## ⚙️ Configuration

AppInsights Detective features **intelligent auto-discovery** - provide just your Application Insights Application ID, and the system automatically discovers all other Azure resource information using Azure Resource Graph API.

### Option 1: Interactive Setup (Recommended)

```bash
aidx setup
```

The setup wizard will guide you through:
- **Azure Application Insights Application ID** (required)
- **Azure Tenant ID** (required for resource discovery)
- **Azure OpenAI endpoint** and deployment name
- **Language preferences** for explanations

All other Azure resource details (subscription, resource group, resource name) are automatically discovered during first query execution.

### Option 2: Environment Variables

```bash
export AZURE_APPLICATION_INSIGHTS_ID="your-app-insights-application-id"
export AZURE_TENANT_ID="your-azure-tenant-id"
export AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"
```

**Auto-Discovery**: Subscription ID, Resource Group, and Resource Name are automatically discovered from the Application ID.

### Option 3: Configuration File

Create `~/.aidx/config.json`:

```json
{
  "appInsights": {
    "applicationId": "your-application-insights-application-id",
    "tenantId": "your-azure-tenant-id"
  },
  "openAI": {
    "endpoint": "https://your-openai.openai.azure.com/",
    "deploymentName": "gpt-4"
  },
  "logLevel": "info",
  "language": "en"
}
```

**Auto-Enhancement**: The system automatically enriches this configuration with discovered Azure resource information (subscriptionId, resourceGroup, resourceName) when you first run a query.

### Resource Discovery Process

1. **Initial Configuration**: Provide Application ID and Tenant ID
2. **Automatic Discovery**: System queries Azure Resource Graph to find:
   - Subscription ID where the Application Insights resource exists
   - Resource Group containing the resource
   - Full resource name and metadata
3. **External Integration**: Discovered information enables Azure Portal integration
4. **Configuration Update**: System automatically saves discovered information for future use


### Setup

1. Configure your Azure resources:

```bash
aidx setup
```

2. Check your configuration:

```bash
aidx status
```

### Usage

**Ask questions naturally:**

```bash
aidx "Show me errors from the last 24 hours"
aidx "What are the slowest requests today?"
aidx "How many users visited my app this week?"
```

**Interactive mode:**

```bash
aidx -i
# or
aidx --interactive
```

**Raw KQL queries:**

```bash
aidx query --raw "requests | take 10"
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `aidx setup` | Configure Application Insights and OpenAI settings |
| `aidx status` | Check configuration and connection status |
| `aidx query [question]` | Query with natural language |
| `aidx -i` or `aidx --interactive` | Interactive query mode |
| `aidx query --raw [kql]` | Execute raw KQL query |

### Query Command Options

The `aidx query` command supports various options for customizing output and behavior:

| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format: table, json, csv, tsv, raw | table |
| `--output <file>` | Save results to file | - |
| `--pretty` | Pretty print JSON output | false |
| `--no-headers` | Exclude headers in CSV/TSV output | false |
| `--encoding <encoding>` | File encoding (utf8, utf16le, etc.) | utf8 |
| `--show-empty-columns` | Show all columns including empty ones | false |
| `--raw` | Execute raw KQL query instead of natural language | false |
| `--direct` | Execute query directly without confirmation | false |
| `--language <lang>` | Language for explanations (en, ja, ko, etc.) | en |

## 📁 Output Formats & Display Options

AppInsights Detective supports multiple output formats for both console display and file export:

### Output Formats
- **table** (default) - Colored console display with ASCII charts for numeric data ⚠️ **(Chart visualization is experimental)**
- **json** - Structured JSON format with optional pretty printing
- **csv** - Comma-separated values for spreadsheet import
- **tsv** - Tab-separated values for data processing tools
- **raw** - Human-readable debug format showing table structure

### Smart Column Management
By default, AppInsights Detective automatically hides empty columns in table output to improve readability:
- **Empty columns** (containing only null, undefined, empty strings, or whitespace) are hidden
- **Column summary** shows how many columns were hidden: `"3 columns displayed, 2 empty columns hidden"`
- Use `--show-empty-columns` flag to display all columns including empty ones

### Usage Patterns
- **Console only**: Use `--format` to display results in the specified format to console
- **File output**: Use `--output` with optional `--format` to save results to file
- **Both**: When `--output` and `--format table` are used, results display to console AND save to file

### File Export Options
- **--output** - Save results to file (auto-detects format from extension)
- **--format** - Specify output format (works with or without file output)
- **--pretty** - Enable pretty-printed JSON output
- **--no-headers** - Exclude column headers in CSV/TSV output
- **--encoding** - File encoding (utf8, utf16le, ascii, latin1, base64)
- **--show-empty-columns** - Show all columns including empty ones

## 📄 Output Format Examples

### Console Output
```bash
# Table format with smart column hiding (default)
aidx "Show me top 10 requests"  # Automatically hides empty columns

# Table format showing all columns including empty ones
aidx "Show me top 10 requests" --show-empty-columns

# JSON format to console
aidx "Show me errors" --format json

# CSV format to console
aidx "Show request counts" --format csv

# Pretty-printed JSON to console
aidx "Show me errors" --format json --pretty
```

### Smart Column Hiding Examples
```bash
# Default behavior - cleaner output with empty columns hidden
aidx "Show request performance data"
# Output example:
# request_name       | count | avg_duration
# -----------------------------------------
# GET /api/health    | 1250  | 45.2
# POST /api/login    | 890   | 156.8
#
# Displayed 2 of 3 rows (3 columns displayed, 2 empty columns hidden)

# Show all columns including empty ones
aidx "Show request performance data" --show-empty-columns
# Output example:
# request_name       | count | empty_field | unused_col | avg_duration
# --------------------------------------------------------------------
# GET /api/health    | 1250  | null        | (empty)    | 45.2
# POST /api/login    | 890   | null        | (empty)    | 156.8
```

### JSON Export
```bash
# Pretty-printed JSON
aidx "Show me errors" --output errors.json --format json --pretty

# Compact JSON
aidx "Show me errors" --output errors.json --format json
```

### CSV Export
```bash
# With headers (default)
aidx "Show request counts" --output requests.csv --format csv

# Without headers for data processing
aidx "Show request counts" --output requests.csv --format csv --no-headers
```

### TSV Export
```bash
# Tab-separated values
aidx "Performance data" --output perf.tsv --format tsv

# Custom encoding for international data
aidx "User data" --output users.tsv --format tsv --encoding utf16le
```

## ⚠️ Experimental Features

### Chart Visualization
The ASCII chart visualization feature is currently **experimental** and automatically detects the best chart type for your data:
- **Time Series Detection**: Automatically identifies time-based data and displays line charts
- **Categorical Data**: Shows bar charts for categorical data with numeric values
- **Data Limits**: Charts are limited to top 10 data points for readability
- **Fallback**: Falls back to table-only display for complex or non-chartable data

While these charts provide quick visual insights, consider using Azure Portal integration for detailed analysis and advanced visualizations.


## 🕵 Interactive Mode - Advanced Query Experience

AppInsights Detective's Interactive Mode provides a **comprehensive, step-by-step query experience** with guided assistance, real-time validation, and integrated analysis capabilities.

### Starting Interactive Mode

```bash
# Start interactive session
aidx -i
# or
aidx --interactive
```

### Interactive Mode Features

#### **1. Guided Query Building** 🛠️
- **Natural Language Input**: Type questions in conversational language
- **Real-time Validation**: Immediate feedback on query feasibility
- **Context Preservation**: Session remembers previous queries and results

#### **2. Execution Mode Selection** ⚡
Interactive Mode offers three execution approaches:

- **🚀 Smart Mode**: AI generates and executes KQL automatically
- **👁️ Review Mode**: Step-by-step query review and execution
- **⚡ Raw KQL**: Execute as raw KQL query (for experts)

#### **3. Smart Result Presentation** 📊
- **Auto-format Detection**: Optimal display format based on data type
- **Smart Column Management**: Automatic hiding of empty columns for cleaner output
- **ASCII Chart Generation**: Automatic visualization for numeric data
  - Time-series data → Line charts
  - Categorical data → Bar charts
  - Top 10 limiting for readability

#### **4. Azure Portal Integration** 🌐
- **One-click Portal Launch**: Open queries directly in Azure Portal
- **Pre-populated Queries**: Queries automatically loaded in Portal interface
- **Full Visualization**: Access to Portal's advanced charting and dashboards

#### **5. Query Explanation & Understanding** 📖
- **Intelligent Query Analysis**: AI-powered explanation of generated KQL queries
- **Step-by-step Breakdown**: Detailed explanation of each query component
- **Learning Support**: Educational insights to help understand KQL patterns
- **Best Practice Insights**: Recommendations for query optimization and improvements

### Interactive Session Flow

```
🔍 AppInsights Detective - Interactive Mode 🕵
Ask questions about your application in natural language
Type "exit" or "quit" to end the session

🤖 Initializing AI services...
✅ AI services ready

❓ What would you like to know about your application?
> Show me errors from the last hour

🔍 Generated KQL Query Review
==========================================
exceptions
| where timestamp > ago(1h)
| project timestamp, message, type, outerMessage
| order by timestamp desc

🚀 Execute Query - Run this KQL query against Application Insights
📖 Explain Query - Get detailed explanation of what this query does
🌐 Open in Azure Portal - Execute query with full visualization capabilities
🔄 Regenerate Query - Ask AI to create a different query approach
✏️ Edit Query - Manually modify the KQL query

Choice: Execute Query

✅ Query executed successfully (234ms)
📊 Found 23 exceptions in the last hour

[Results displayed with smart formatting]

🧠 Would you like to analyze these results for patterns and insights? (y/N)
```

### Explain Query Feature

The **Explain Query** feature provides AI-powered explanations of generated KQL queries to help users understand and learn from the queries.

#### Example: Query Explanation Session

```
❓ What would you like to know about your application?
> Show me errors from the last hour

🔍 Generated KQL Query Review
==========================================
exceptions
| where timestamp > ago(1h)
| project timestamp, message, type, outerMessage
| order by timestamp desc

🚀 Execute Query - Run this KQL query against Application Insights
📖 Explain Query - Get detailed explanation of what this query does
🌐 Open in Azure Portal - Execute query with full visualization capabilities
🔄 Regenerate Query - Ask AI to create a different query approach
✏️ Edit Query - Manually modify the KQL query

Choice: Explain Query

📖 Query Explanation
==========================================
This KQL query analyzes exception data from your Application Insights:

🔍 Query Breakdown:
1. **exceptions** - Starts with the exceptions table containing error events
2. **where timestamp > ago(1h)** - Filters to only show exceptions from the last 1 hour
3. **project timestamp, message, type, outerMessage** - Selects specific columns:
   • timestamp: When the exception occurred
   • message: The exception message
   • type: The type/class of the exception
   • outerMessage: Additional context about the exception
4. **order by timestamp desc** - Sorts results by time, newest first

💡 Query Insights:
• This query is optimized for recent error investigation
• Time filtering (ago(1h)) improves performance by limiting data scan
• Selected columns provide essential debugging information
• Descending order helps identify the most recent issues first

🎯 Use Cases:
• Real-time error monitoring and alerting
• Quick troubleshooting of recent application issues
• Identifying patterns in recent exception occurrences

⚡ Performance Notes:
• Estimated execution time: < 1 second for typical workloads
• Data volume: Processes exceptions from last hour only
• Resource usage: Minimal - well-optimized time filter

🔄 Possible Improvements:
• Add "| take 50" to limit results for large datasets
• Include "severityLevel" for error prioritization
• Add "operation_Name" to see which operations caused errors

❓ Would you like to:
  🚀 Execute this query now
  🔄 Generate a different query approach
  ✏️ Edit the query manually
  🌐 Open in Azure Portal
```

#### Multi-Language Query Explanations

Query explanations are available in multiple languages with culturally appropriate technical terminology:

```bash
✔ What would you like to do with this query? Explain
? Select explanation language:
❯ 🌐 Auto - Detect best language
  🇺🇸 English
  🇯🇵 Japanese (日本語)
  🇰🇷 Korean (한국어)
  🇨🇳 Chinese Simplified (简体中文)
  🇹🇼 Chinese Traditional (繁體中文)
  🇪🇸 Spanish (Español)
  ..and more
```

#### Learning-Focused Features

- **KQL Pattern Recognition**: Identifies common KQL patterns and explains their purpose
- **Best Practice Highlighting**: Points out query optimization techniques
- **Performance Insights**: Explains why certain query structures are efficient
- **Educational Context**: Provides learning opportunities for KQL skill development


## 🧠 Advanced Result Analysis

After executing queries, AppInsights Detective offers **AI-powered analysis capabilities** to extract deeper insights from your data.

### Analysis Types

#### **📈 Statistical Summary**
- **Basic Statistics**: Count, average, median, min/max values
- **Data Distribution**: Percentiles and quartile analysis
- **Column Profiling**: Data types and null value analysis
- **Trend Indicators**: Growth rates and change patterns

#### **🔍 Pattern Detection**
- **Temporal Patterns**: Time-based trends and seasonality
- **Correlation Analysis**: Relationships between different metrics
- **Frequency Analysis**: Most common values and patterns
- **Threshold Detection**: Automatic identification of normal vs. abnormal ranges

#### **🚨 Anomaly Detection**
- **Outlier Identification**: Statistical outliers in numeric data
- **Unusual Patterns**: Deviations from normal behavior
- **Spike Detection**: Sudden increases or decreases
- **Missing Data Patterns**: Gaps and data quality issues

#### **💡 Smart Insights**
- **Business Impact Analysis**: What the data means for your application
- **Root Cause Suggestions**: Potential causes for observed patterns
- **Actionable Recommendations**: Specific steps to address issues
- **Follow-up Queries**: Suggested next questions to explore

#### **📋 Full Analysis Report**
- **Comprehensive Review**: All analysis types combined
- **Executive Summary**: High-level findings and recommendations
- **Detailed Findings**: In-depth analysis with supporting data
- **Visualization Suggestions**: Recommended charts and dashboards

### Multi-Language Analysis Language Support

Analysis results are available in **12+ languages** with culturally appropriate explanations as same as Query explanations:

### Analysis Output Example

```
🧠 Analysis Results - Pattern Detection
========================================

📊 Key Findings:
• Exception rate increased 340% compared to previous hour
• Top error type: "NullReferenceException" (61% of total)
• Peak error time: 14:23 UTC (12 exceptions in 1 minute)
• Affected endpoints: /api/users (73%), /api/orders (27%)

🔍 Detected Patterns:
• Strong correlation between user authentication and exceptions
• Error clustering suggests systematic issue, not random failures
• Weekend error pattern differs significantly from weekday baseline

💡 Recommendations:
1. Investigate null handling in user authentication flow
2. Review recent deployments around 14:20 UTC
3. Implement additional error monitoring on /api/users endpoint
4. Consider adding circuit breaker patterns for resilience

🔄 Suggested Follow-up Queries:
• "Show me user authentication errors in the last 2 hours"
• "Compare error rates between this week and last week"
• "What users were affected by these exceptions?"
```

### Interactive Analysis Session

```bash
❓ What would you like to know about your application?
> Show me slow requests from today

✅ Query executed successfully
📊 Found 156 slow requests (>2s duration) today

🧠 Would you like to analyze these results for patterns and insights? (y/N) y

📋 What type of analysis would you like to perform?
  📈 Statistical Summary - Basic statistics and data distributions
  🔍 Pattern Detection - Identify trends and correlations
  🚨 Anomaly Detection - Find outliers and unusual data points
  💡 Smart Insights - AI-powered recommendations and insights
▶ 📋 Full Analysis Report - Comprehensive analysis of all aspects

🌐 Select analysis language:
▶ 🌐 Auto - Detect best language
  🇺🇸 English
  🇯🇵 Japanese (日本語)

🤖 Analyzing query results... This may take a moment.

[Detailed analysis output displayed]

❓ What would you like to explore next?
```

This comprehensive Interactive Mode and Analysis system provides both novice and expert users with powerful tools for exploring Application Insights data, understanding patterns, and making data-driven decisions about application performance and reliability.

## 💡 Example Queries

```bash
# Performance Analysis with Portal Integration
aidx "What are the slowest API endpoints?"
aidx "Show me response times over the last hour"
aidx "Which requests have the highest duration today?"

# Error Investigation and Analysis
aidx "List all exceptions from today"
aidx "Which pages have the most errors?"
aidx "Show me 4xx and 5xx errors from the last 24 hours"

# User Analytics and Behavior
aidx "How many unique users today?"
aidx "What browsers are users using?"
aidx "Show me user sessions by geographic location"

# Custom Metrics and Events
aidx "Show me custom events by type"
aidx "What's the trend for failed logins?"
aidx "Display custom metrics over time"

# Interactive Mode Examples with Analysis
aidx -i  # Start interactive session with guided query building
aidx --interactive  # Full interactive mode with step-by-step assistance and Portal integration

# Query Learning Examples (with Explain Query feature)
aidx -i  # Choose "Explain Query" option to understand generated KQL
# Perfect for learning KQL patterns and best practices
# Available in 12+ languages for educational context

# Raw KQL with Full Integration
aidx --raw "requests | where resultCode >= 400"           # Raw KQL with Portal integration available

# Analysis-focused Examples
aidx "Show me slow requests from today"    # Query + Analysis prompt available
aidx "Exception patterns last 24 hours"    # Ideal for pattern detection analysis
aidx "User activity by region"             # Great for statistical summary
aidx "API performance trends"              # Perfect for anomaly detection

# Output Format Examples
aidx "Show me request data" --output results.json --format json --pretty
aidx "Show request counts by operation" --output requests.csv --format csv
aidx "Performance metrics" --output metrics.tsv --format tsv --no-headers
aidx "User data" --output users.csv --format csv --encoding utf16le

# Smart Column Management Examples
aidx "Show me request data"                               # Default: hides empty columns
aidx "Show me request data" --show-empty-columns         # Shows all columns including empty ones

# Console Visualization Examples
aidx "Show top 10 requests"                              # Auto-detects time series, displays chart
aidx "Request counts by hour"                            # Displays bar chart for categorical data
```

## 🏗️ Development

### Setup Development Environment

```bash
git clone https://github.com/georgeOsdDev/AppInsightsDetective.git
cd AppInsightsDetective
npm install
npm run dev
```

### Available Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Run in development mode
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run clean        # Clean build directory
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests: `npm test`
6. Run linting: `npm run lint`
7. Submit a pull request

All contributions must pass the CI checks including tests and linting.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

#### Authentication Failed

- Ensure you're logged into Azure CLI: `az login`
- Check your Azure permissions
- Verify Managed Identity configuration

#### OpenAI Connection Failed

- Confirm your OpenAI endpoint URL
- Check deployment name matches your Azure OpenAI resource
- Verify network connectivity

#### Application Insights Access Denied

- Ensure correct Application Insights ID
- Check Reader permissions on the resource
- Verify tenant ID is correct

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=debug
aidx status
```

## 📞 Support

For issues and questions:

- Check the troubleshooting guide above
- Review [Azure documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- Create an issue in this repository

---

### Built with ❤️ for Azure developers
