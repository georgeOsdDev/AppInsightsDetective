# 🔍 AppInsights Detective 🕵

[![CI](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml/badge.svg)](https://github.com/georgeOsdDev/AppInsightsDetective/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Query Azure Application Insights with natural language using AI**

AppInsights Detective is an intelligent CLI tool that transforms natural language questions into KQL queries for Azure Application Insights, powered by Azure OpenAI.

![example](image.png)

## ✨ Key Features

- 🗣️ **Natural Language Queries** - Ask questions in plain English
- 🤖 **AI-Powered KQL Generation** - Advanced query generation with confidence scoring
- 🔐 **Secure Authentication** - Azure Managed Identity with multi-tenant support
- 📊 **Rich Visualization** - Console charts, tables, and multiple output formats
- 🕵️ **Interactive Mode** - Step-by-step query building with guided assistance
- 📋 **Template System** - Create and reuse query templates
- 🌐 **Azure Portal Integration** - One-click query execution in the portal

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Azure Application Insights resource
- Azure OpenAI resource
- Appropriate Azure permissions ([see setup guide](docs/guide/setup.md#prerequisites))

### Installation

```bash
# Install from npm (coming soon)
npm install -g appinsights-detective

# Or install from source
git clone https://github.com/georgeOsdDev/AppInsightsDetective.git
cd AppInsightsDetective
npm install && npm run build && npm install -g .
```

### First Query

```bash
# 1. Setup configuration
aidx setup

# 2. Ask your first question
aidx "show me errors from the last hour"

# 3. Try interactive mode
aidx --interactive
```

## 📋 Basic Commands

| Command | Description | Example |
|---------|-------------|---------|
| `aidx setup` | Configure Application Insights and OpenAI settings | `aidx setup` |
| `aidx status` | Check configuration and connection status | `aidx status --verbose` |
| `aidx "question"` | Ask a natural language question | `aidx "top 10 slowest requests"` |
| `aidx --interactive` | Start guided interactive session | `aidx -i` |
| `aidx --raw "kql"` | Execute raw KQL query | `aidx --raw "requests \| take 5"` |
| `aidx template list` | Manage query templates | `aidx template use performance-overview` |

[→ See complete command reference](docs/guide/commands/index.md)

## 🔧 Output & Export Options

```bash
# Different output formats
aidx "errors" --format json --pretty
aidx "requests" --format csv --output data.csv
aidx "performance" --format table  # default with charts

# Interactive mode for complex analysis
aidx --interactive
```

## 📚 Documentation

- **[Setup Guide](docs/guide/setup.md)** - Installation, configuration, and troubleshooting
- **[Commands Reference](docs/guide/commands/index.md)** - Complete command documentation
- **[Interactive Mode](docs/guide/commands/interactive.md)** - Guided query experience
- **[Query Examples](docs/guide/showcase.md)** - Real-world use cases and examples

## 🏗️ Development

For developers looking to contribute or extend AppInsights Detective:

- **[Architecture Overview](docs/developer/architecture.md)** - System design and patterns
- **[Provider Development](docs/developer/provider.md)** - Creating custom providers

## 📝 Project Status

**Current Version**: 1.0.0  
**Stability**: Experimental - Active development, breaking changes possible

## 🤝 Contributing

We welcome contributions! Please see our [development documentation](docs/developer/) for technical details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and documentation
5. Submit a pull request

## 📞 Support & License

- **License**: MIT
- **Issues**: [GitHub Issues](https://github.com/georgeOsdDev/AppInsightsDetective/issues)
- **Discussions**: [GitHub Discussions](https://github.com/georgeOsdDev/AppInsightsDetective/discussions)

---

*Made with ❤️ for Azure Application Insights users who want to query their data naturally.*