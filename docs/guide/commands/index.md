# Commands Reference

AppInsights Detective provides a comprehensive set of commands for querying, configuration, and template management. This reference covers all available commands, options, and usage patterns.

## Command Overview

| Command | Purpose | Quick Example |
|---------|---------|---------------|
| [query](#query-command) | Execute natural language or KQL queries | `aidx "show me errors"` |
| [setup](#setup-command) | Interactive configuration wizard | `aidx setup` |
| [status](#status-command) | Check configuration and connections | `aidx status --verbose` |
| [template](#template-command) | Manage query templates | `aidx template list` |
| [providers](#providers-command) | Manage provider configurations | `aidx providers show` |
| [list-providers](#list-providers-command) | List available provider types | `aidx list-providers` |

## Global Options

These options are available for all commands:

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-V, --version` | Display version number | - | `aidx --version` |
| `-h, --help` | Show help information | - | `aidx --help` |
| `-l, --language <lang>` | Language for explanations | `en` | `aidx --language ja` |

### Supported Languages

- `en` - English (default)
- `ja` - Japanese  
- `ko` - Korean
- `zh` - Chinese
- `es` - Spanish
- `fr` - French
- `de` - German
- And more ISO language codes

## Query Command

The primary command for executing queries against Application Insights.

### Basic Usage

```bash
# Natural language query (default)
aidx "show me errors from the last hour"
aidx "what are the slowest requests?"

# Raw KQL query
aidx --raw "requests | take 10"

# Direct execution (skip confidence checking)
aidx --direct "show me performance data"

# Interactive mode
aidx --interactive
```

### Query Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `-r, --raw` | Execute as raw KQL query | `false` | `aidx --raw "requests \| take 5"` |
| `--direct` | Execute directly without confirmation | `false` | `aidx --direct "show errors"` |
| `-i, --interactive` | Start interactive session | `false` | `aidx -i` |
| `-f, --format <format>` | Output format | `table` | `aidx "errors" --format json` |
| `-o, --output <file>` | Save to file | - | `aidx "data" --output results.csv` |
| `--pretty` | Pretty-print JSON output | `false` | `aidx "data" --format json --pretty` |
| `--no-headers` | Exclude headers in CSV/TSV | `false` | `aidx "data" --format csv --no-headers` |
| `--encoding <encoding>` | File encoding | `utf8` | `aidx "data" --output file.csv --encoding utf16le` |
| `--show-empty-columns` | Show all columns including empty | `false` | `aidx "data" --show-empty-columns` |

### Output Formats

| Format | Description | Use Case | Extension |
|--------|-------------|----------|-----------|
| `table` | Console table with charts | Interactive viewing | - |
| `json` | Structured JSON data | API integration, further processing | `.json` |
| `csv` | Comma-separated values | Spreadsheet import | `.csv` |
| `tsv` | Tab-separated values | Data analysis tools | `.tsv` |
| `raw` | Debug format showing structure | Troubleshooting | - |

### Query Examples

```bash
# Performance monitoring
aidx "show me slowest requests from last 24 hours"
aidx "requests with response time over 5 seconds"

# Error investigation  
aidx "exceptions from last hour grouped by type"
aidx "failed requests with 500 status code"

# User behavior
aidx "most popular pages by page views"
aidx "user sessions from mobile devices"

# Export data
aidx "daily request counts" --output daily-stats.csv --format csv
aidx "error details" --output errors.json --format json --pretty
```

[→ See detailed query documentation](query.md)

## Setup Command

Interactive configuration wizard for first-time setup and reconfiguration.

### Usage

```bash
# Run interactive setup
aidx setup

# Setup creates configuration at ~/.aidx/config.json
```

### Setup Process

The setup wizard guides you through:

1. **AI Provider Selection** (Azure OpenAI, OpenAI)
2. **AI Provider Configuration** (endpoint, deployment, authentication)
3. **Data Source Configuration** (Application Insights settings)
4. **Authentication Provider** (Managed Identity, Service Principal)
5. **General Settings** (language, log level)

[→ See detailed setup documentation](setup.md)

## Status Command

Check system configuration, provider status, and connectivity.

### Usage

```bash
# Basic status check
aidx status

# Detailed status with connection tests
aidx status --verbose
```

### Status Options

| Option | Description | Example |
|--------|-------------|---------|
| `--verbose` | Show detailed information and test connections | `aidx status --verbose` |

### Status Output

- **Configuration validation**
- **Provider status** (AI, Data Source, Authentication)
- **Connection tests** (when using `--verbose`)
- **Resource discovery status**
- **Permission verification**

[→ See detailed status documentation](status.md)

## Template Command

Manage reusable query templates with parameters.

### Usage

```bash
# List available templates
aidx template list
aidx tpl list  # Short alias

# Show template details
aidx template show performance-overview

# Create new template
aidx template create

# Use template with parameters
aidx template use error-analysis --param timeRange=24h

# Delete user template
aidx template delete my-custom-template
```

### Template Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `list` | List all available templates | `aidx tpl list` |
| `show <id>` | Display template details | `aidx tpl show performance-overview` |
| `create` | Create new template interactively | `aidx tpl create` |
| `use <id>` | Execute template with parameters | `aidx tpl use error-analysis` |
| `delete <id>` | Delete user-created template | `aidx tpl delete custom-template` |

### Template Types

- **System Templates**: Built-in templates (cannot be deleted)
- **User Templates**: Custom templates stored in `templates/user/`

[→ See detailed template documentation](template.md)

## Providers Command

Manage provider configurations (AI, data sources, authentication).

### Usage

```bash
# Show current provider configuration
aidx providers show
aidx provider show  # Short alias

# Set default AI provider
aidx providers set-default ai azure-openai

# Set default data source provider
aidx providers set-default dataSources application-insights

# Configure specific provider
aidx providers configure ai azure-openai
```

### Provider Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `show` | Display current provider configuration | `aidx providers show` |
| `set-default <type> <name>` | Set default provider | `aidx providers set-default ai openai` |
| `configure <type> <name>` | Configure specific provider | `aidx providers configure ai azure-openai` |

### Provider Types

- **ai**: AI providers (azure-openai, openai)
- **dataSources**: Data source providers (application-insights, log-analytics)
- **auth**: Authentication providers (azure-managed-identity, azure-service-principal)

[→ See detailed providers documentation](providers.md)

## List-Providers Command

List all available provider types and their registration status.

### Usage

```bash
# List all provider types
aidx list-providers

# Show detailed provider information  
aidx list-providers --detailed
```

### List-Providers Options

| Option | Description | Example |
|--------|-------------|---------|
| `--detailed` | Show detailed provider information | `aidx list-providers --detailed` |

## Interactive Mode

Special execution mode providing guided query experience.

### Starting Interactive Mode

```bash
# Start interactive session
aidx --interactive
aidx -i

# Start with specific language
aidx --interactive --language ja
```

### Interactive Features

- **Guided Query Building**: Step-by-step assistance
- **Execution Mode Selection**: Smart, Review, or Raw KQL modes
- **Real-time Validation**: Query confidence assessment
- **Result Analysis**: AI-powered insights and recommendations
- **Azure Portal Integration**: One-click portal query execution
- **Query History**: Track and regenerate previous queries
- **Template Integration**: Use and create templates within sessions

[→ See detailed interactive mode documentation](interactive.md)

## Command Chaining and Workflows

### Common Workflows

```bash
# Initial setup workflow
aidx setup
aidx status --verbose
aidx "test query to verify setup"

# Template workflow
aidx template list
aidx template show performance-overview  
aidx template use performance-overview --param hours=24

# Investigation workflow
aidx --interactive  # Start guided investigation
# Use interactive mode for complex analysis
```

### Output Piping

```bash
# Export query results for further processing
aidx "request data" --format json --output data.json
aidx "error summary" --format csv | grep "Error"

# Combine with other tools
aidx "performance data" --format tsv | cut -f1,3 | sort
```

## Best Practices

### Query Optimization

- Use **direct mode** (`--direct`) for high-confidence queries
- Use **interactive mode** for complex investigations
- Use **templates** for repeated analysis patterns
- Use **raw KQL** for precise control

### Output Management

- Use appropriate **output formats** for your use case
- Export large datasets to **files** rather than console display
- Use **pretty-printed JSON** for human-readable exports
- Hide empty columns with default table format for cleaner output

### Configuration Management

- Run `aidx status` periodically to verify configuration health
- Use **environment variables** for CI/CD scenarios
- Use **configuration files** for team standardization
- Re-run `aidx setup` to update configurations

## Error Handling and Troubleshooting

### Common Error Messages

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `Configuration has issues` | Invalid or missing configuration | Run `aidx setup` or `aidx status --verbose` |
| `403 Forbidden` | Insufficient permissions | Check Azure role assignments |
| `Query failed` | Invalid KQL or connection issue | Try simpler query or check connectivity |
| `Model not found` | Incorrect deployment name | Verify Azure OpenAI deployment name |

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Set log level to debug
export AIDX_LOG_LEVEL=debug
aidx "your query"

# Or modify config.json
{
  "logLevel": "debug"
}
```

## Next Steps

- **New Users**: Start with the [Setup Guide](../setup.md)
- **Query Examples**: See [Query Showcase](../showcase.md)  
- **Interactive Mode**: Learn [Interactive Mode](interactive.md)
- **Templates**: Explore [Template Management](template.md)
- **Advanced Usage**: Review individual command documentation