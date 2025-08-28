# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-28

### Added
- 🎉 **Initial release of AppInsights Detective**
- 🗣️ **Natural language to KQL query conversion** using Azure OpenAI
- 🕵️ **Interactive query mode** with step-by-step guidance and review
- 📊 **Multiple data source support**:
  - Azure Application Insights
  - Azure Log Analytics workspace
  - Azure Data Explorer (ADX) clusters
- 📋 **Template system** for common queries and patterns
- 🌐 **Azure Portal integration** - one-click query execution in portal
- 🎨 **Rich visualization** with console charts and tables
- 📁 **Multiple output formats** (JSON, CSV, Table with charts)
- 🔐 **Secure authentication** with Azure Managed Identity support
- 🌐 **Web UI interface** (experimental) for visual query building
- 📝 **Query history and session management**
- ⚙️ **Comprehensive configuration system** with environment variable support

### Features
- **AI-powered query generation** with confidence scoring and validation
- **Multi-tenant Azure authentication** with automatic credential discovery  
- **Provider architecture** supporting multiple AI and data source providers
- **CLI interface** with Commander.js framework
- **Interactive prompts** using Inquirer.js
- **Colored console output** and progress indicators
- **Template creation and sharing** system
- **Query editing and refinement** capabilities
- **External execution** in Azure Portal with URL generation
- **Resource discovery** using Azure Resource Graph
- **Comprehensive logging** with Winston logger
- **Error handling and validation** throughout the application

### Supported Providers
- **AI Providers**: Azure OpenAI, OpenAI, Ollama
- **Data Sources**: Application Insights, Log Analytics, Azure Data Explorer
- **Authentication**: Azure Managed Identity, Azure CLI credentials

### CLI Commands
- `aidx setup` - Interactive configuration setup
- `aidx status` - Check configuration and connectivity
- `aidx "natural language query"` - Execute queries
- `aidx --interactive` - Interactive mode with guidance
- `aidx template` - Template management commands
- `aidx providers` - Provider configuration commands
- `aidx webui` - Launch web interface (experimental)

### Technical Stack
- **Language**: TypeScript with strict mode
- **Runtime**: Node.js 18.0.0+
- **Dependencies**: Azure SDK, Commander.js, Inquirer.js, Winston, Chalk
- **Build System**: TypeScript compiler with source maps
- **Testing**: Jest with comprehensive test coverage
- **Linting**: ESLint with TypeScript support

[1.0.0]: https://github.com/georgeOsdDev/AppInsightsDetective/releases/tag/v1.0.0