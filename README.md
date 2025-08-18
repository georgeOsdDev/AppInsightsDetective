# 🔍 AppInsights Detective 🕵

[![CI](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml/badge.svg)](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Query Azure Application Insights with natural language using AI**

AppInsights Detective is an intelligent CLI tool that allows you to query your Azure Application Insights data using natural language. It leverages Azure OpenAI to convert your questions into KQL (Kusto Query Language) queries and presents the results in a user-friendly format.

![example](image.png)

## ✨ Features

- 🗣️ **Natural Language Queries**: Ask questions in plain English/Japanese
- 🤖 **AI-Powered KQL Generation**: Automatic conversion to KQL using Azure OpenAI
- 📊 **Rich Visualization**: Console-based charts and formatted tables
- 🔐 **Secure Authentication**: Uses Azure Managed Identity
- ⚡ **Interactive Mode**: Step-by-step query building and validation
- 📈 **Query Validation**: Ensures safe and valid KQL execution
- 🎯 **Smart Schema Integration**: Leverages your Application Insights schema
- 🧪 **Comprehensive Testing**: Full test coverage with automated CI/CD
- 🚀 **Production Ready**: Built with TypeScript, proper error handling

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
```

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

## ⚙️ Configuration

### Option 1: Interactive Setup

```bash
aidx setup
```

### Option 2: Environment Variables

```bash
export AZURE_APPLICATION_INSIGHTS_ID="your-app-insights-id"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4"
```

### Option 3: Configuration File

Create `~/.aidx/config.json`:

```json
{
  "appInsights": {
    "applicationId": "your-application-insights-id",
    "tenantId": "your-azure-tenant-id"
  },
  "openAI": {
    "endpoint": "https://your-openai.openai.azure.com/",
    "deploymentName": "gpt-4"
  },
  "logLevel": "info"
}
```

## 🔐 Authentication

AppInsights Detective uses Azure Managed Identity for secure authentication. Ensure you have the following permissions:

- **Application Insights**: Reader role
- **OpenAI**: Cognitive Services OpenAI User role

## 💡 Example Queries

```bash
# Performance Analysis
aidx "What are the slowest API endpoints?"
aidx "Show me response times over the last hour"

# Error Investigation
aidx "List all exceptions from today"
aidx "Which pages have the most errors?"

# User Analytics
aidx "How many unique users today?"
aidx "What browsers are users using?"

# Custom Metrics
aidx "Show me custom events by type"
aidx "What's the trend for failed logins?"

# Interactive Mode Examples
aidx -i  # Start interactive session with guided queries
aidx --interactive  # Full interactive mode with step-by-step assistance
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

### Project Structure

```
AppInsightsDetective/
├── src/
│   ├── cli/                # CLI command definitions
│   │   ├── commands/       # Individual commands (setup, query, status)
│   │   └── index.ts        # CLI entry point
│   ├── services/           # Business logic
│   │   ├── authService.ts          # Azure authentication
│   │   ├── appInsightsService.ts   # Application Insights API
│   │   ├── aiService.ts            # OpenAI integration
│   │   ├── stepExecutionService.ts # Interactive query execution
│   │   └── interactiveService.ts   # Interactive CLI service
│   ├── utils/              # Utilities
│   │   ├── config.ts       # Configuration management
│   │   ├── logger.ts       # Logging
│   │   └── visualizer.ts   # Console visualization
│   └── types/              # TypeScript definitions
├── tests/                  # Unit and integration tests
│   ├── services/           # Service tests
│   ├── utils/              # Utility tests
│   └── integration/        # Integration tests
├── .github/workflows/      # GitHub Actions CI/CD
├── config/                 # Configuration files
└── templates/              # Query templates
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

**Authentication Failed**
- Ensure you're logged into Azure CLI: `az login`
- Check your Azure permissions
- Verify Managed Identity configuration

**OpenAI Connection Failed**
- Confirm your OpenAI endpoint URL
- Check deployment name matches your Azure OpenAI resource
- Verify network connectivity

**Application Insights Access Denied**
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
- Check the [troubleshooting guide](#troubleshooting)
- Review [Azure documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- Create an issue in this repository

---

**Built with ❤️ for Azure developers**
