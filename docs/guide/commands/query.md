# Query Command

The `query` command is the primary interface for executing queries against Azure Application Insights using natural language or raw KQL.

## Purpose

The query command transforms natural language questions into KQL (Kusto Query Language) queries and executes them against your Application Insights data. It supports multiple execution modes, output formats, and advanced features for data analysis.

## Basic Usage

### Natural Language Queries

```bash
# Ask questions in natural language
aidx "show me errors from the last hour"
aidx "what are the slowest requests today?"
aidx "how many users visited my app yesterday?"

# The AI will generate appropriate KQL and execute it
```

### Raw KQL Queries

```bash
# Execute raw KQL directly
aidx --raw "requests | take 10"
aidx --raw "exceptions | where timestamp > ago(1h) | count"

# Useful when you know exactly what KQL you want to run
```

### Direct Execution

```bash
# Skip confidence checking and execute immediately
aidx --direct "show me performance data"
aidx --direct "errors in the last 24 hours"

# Best for queries you're confident about
```

## Command Syntax

```bash
aidx [global-options] [question]
aidx [global-options] query [query-options] [question]
```

## Query Options

### Execution Options

| Option | Short | Description | Default | Example |
|--------|-------|-------------|---------|---------|
| `--raw` | `-r` | Execute as raw KQL query | `false` | `aidx --raw "requests \| take 5"` |
| `--direct` | - | Execute without confidence confirmation | `false` | `aidx --direct "show errors"` |
| `--interactive` | `-i` | Start interactive session | `false` | `aidx -i` |

### Output Format Options

| Option | Short | Description | Default | Values |
|--------|-------|-------------|---------|--------|
| `--format` | `-f` | Output format | `table` | `table`, `json`, `csv`, `tsv`, `raw` |
| `--output` | `-o` | Save results to file | - | Any file path |
| `--pretty` | - | Pretty-print JSON output | `false` | `true`, `false` |
| `--no-headers` | - | Exclude headers in CSV/TSV | `false` | - |
| `--encoding` | - | File encoding | `utf8` | `utf8`, `utf16le`, `ascii`, etc. |
| `--show-empty-columns` | - | Show all columns including empty | `false` | - |

### Language Options

| Option | Short | Description | Default | Example |
|--------|-------|-------------|---------|---------|
| `--language` | `-l` | Language for explanations | `en` | `aidx --language ja "errors"` |

## Execution Modes

### 1. Smart Mode (Default)

Analyzes query confidence and automatically chooses the best execution approach:

```bash
aidx "show me recent errors"
```

**How it works:**
- AI generates KQL with confidence score
- High confidence (≥0.7): Executes automatically  
- Low confidence (<0.7): Enters step-by-step review mode
- Shows generated query before execution for transparency

### 2. Direct Mode

Bypasses confidence checking and executes immediately:

```bash
aidx --direct "show me request counts"
```

**Best for:**
- Simple, well-understood queries
- Repeated queries you've verified before
- Automated scripts where interaction isn't desired

### 3. Raw KQL Mode

Executes KQL directly without AI generation:

```bash
aidx --raw "requests | summarize count() by bin(timestamp, 1h)"
```

**Best for:**
- Precise KQL control
- Complex queries that are hard to express in natural language
- Learning and experimentation with KQL

### 4. Interactive Mode

Provides comprehensive guided experience:

```bash
aidx --interactive
```

**Features:**
- Step-by-step query building
- Query review and editing
- Result analysis and insights
- Template usage and creation

## Output Formats

### Table Format (Default)

Console-friendly display with automatic formatting and optional charts:

```bash
aidx "top 10 requests by count"
```

**Features:**
- Colored output for better readability
- Automatic column sizing
- ASCII charts for numeric data (experimental)
- Smart column hiding (empty columns hidden by default)
- Summary statistics

**Example Output:**
```
╭─────────────────────────────────────────────────────────╮
│                    Query Results                        │
╰─────────────────────────────────────────────────────────╯

┌─────────────────────────────┬──────────┬──────────────┐
│            name             │  count   │ avg_duration │
├─────────────────────────────┼──────────┼──────────────┤
│ GET /api/users              │    1,234 │        125ms │
│ POST /api/login             │      856 │        89ms  │
│ GET /api/products           │      642 │        156ms │
└─────────────────────────────┴──────────┴──────────────┘

📊 Chart: count
████████████████████████████████████████████████ 1,234
█████████████████████████████████                  856
█████████████████████████████                      642

3 rows displayed, 1 empty column hidden
Query executed in 234ms
```

### JSON Format

Structured data format for programmatic use:

```bash
# Compact JSON
aidx "errors" --format json

# Pretty-printed JSON
aidx "errors" --format json --pretty --output errors.json
```

**Example Output:**
```json
{
  "columns": [
    {"name": "timestamp", "type": "datetime"},
    {"name": "message", "type": "string"},
    {"name": "type", "type": "string"}
  ],
  "rows": [
    ["2024-01-15T10:30:00Z", "Null reference exception", "System.NullReferenceException"],
    ["2024-01-15T10:25:00Z", "Connection timeout", "System.TimeoutException"]
  ],
  "statistics": {
    "rowCount": 2,
    "executionTime": "234ms"
  }
}
```

### CSV Format

Comma-separated values for spreadsheet import:

```bash
# With headers (default)
aidx "request data" --format csv --output requests.csv

# Without headers
aidx "request data" --format csv --no-headers --output data.csv
```

**Example Output:**
```csv
timestamp,name,duration,responseCode
2024-01-15T10:30:00Z,GET /api/users,125,200
2024-01-15T10:29:45Z,POST /api/login,89,200
2024-01-15T10:29:30Z,GET /api/products,156,200
```

### TSV Format

Tab-separated values for data analysis tools:

```bash
aidx "performance data" --format tsv --output data.tsv
```

### Raw Format

Debug format showing data structure:

```bash
aidx "data" --format raw
```

**Example Output:**
```
=== Query Results ===
Columns: 3
Rows: 2
Execution Time: 234ms

Column Definitions:
- timestamp (datetime)
- message (string) 
- type (string)

Raw Data:
Row 1: [2024-01-15T10:30:00Z, "Null reference exception", "System.NullReferenceException"]
Row 2: [2024-01-15T10:25:00Z, "Connection timeout", "System.TimeoutException"]
```

## File Output Options

### Basic File Output

```bash
# Auto-detect format from extension
aidx "data" --output results.json    # JSON format
aidx "data" --output results.csv     # CSV format
aidx "data" --output results.tsv     # TSV format

# Explicit format specification
aidx "data" --format json --output data.txt
```

### Encoding Options

```bash
# UTF-8 (default)
aidx "data" --output file.csv

# UTF-16 Little Endian (for Excel compatibility)
aidx "data" --output file.csv --encoding utf16le

# Other encodings
aidx "data" --output file.txt --encoding ascii
```

### Advanced File Options

```bash
# Pretty-printed JSON with UTF-16 encoding
aidx "data" --format json --pretty --output data.json --encoding utf16le

# CSV without headers for data processing
aidx "metrics" --format csv --no-headers --output raw-data.csv

# Show all columns including empty ones
aidx "data" --show-empty-columns --output complete-data.csv
```

## Usage Examples

### Performance Monitoring

```bash
# Find slow requests
aidx "requests with response time over 5 seconds"
aidx "slowest requests from last 24 hours" --format json --output slow-requests.json

# Monitor performance trends
aidx "average response time by hour today"
aidx --raw "requests | summarize avg(duration) by bin(timestamp, 1h)" --format csv
```

### Error Investigation

```bash
# Recent errors
aidx "exceptions from last hour"
aidx "errors grouped by type" --format table

# Detailed error analysis
aidx --interactive   # Use interactive mode for complex investigation

# Export error details
aidx "all errors from today" --format json --pretty --output errors.json
```

### User Behavior Analysis

```bash
# Popular pages
aidx "most visited pages by page views"
aidx "user sessions by browser type" --format csv --output user-stats.csv

# Geographic analysis
aidx "requests by country" --show-empty-columns
```

### Custom KQL Queries

```bash
# Time-based analysis
aidx --raw "requests | summarize count() by bin(timestamp, 1d) | render timechart"

# Complex aggregations
aidx --raw "pageViews | join (requests) on operation_Id | summarize uniqueUsers=dcount(user_Id) by name"

# Performance percentiles
aidx --raw "requests | summarize percentiles(duration, 50, 90, 95, 99) by name"
```

## Best Practices

### Query Formulation

**Good natural language queries:**
- Be specific about time ranges: "errors from last hour" vs "errors"
- Use clear metrics: "slowest requests" vs "bad performance"
- Specify grouping: "errors by type" vs "show errors"

**Examples:**
```bash
# Good: Specific and clear
aidx "top 10 slowest requests from last 24 hours"
aidx "exception count grouped by type from last week"

# Less optimal: Vague
aidx "show me problems"
aidx "performance data"
```

### Mode Selection

- **Smart mode**: Default choice for most queries
- **Direct mode**: When you're confident about the query intent
- **Raw KQL**: For precise control or complex analysis
- **Interactive mode**: For exploratory analysis and learning

### Output Format Selection

| Use Case | Recommended Format | Example |
|----------|-------------------|---------|
| Quick console review | `table` | `aidx "errors" --format table` |
| API integration | `json` | `aidx "data" --format json` |
| Spreadsheet analysis | `csv` | `aidx "metrics" --format csv` |
| Data processing | `tsv` | `aidx "raw data" --format tsv` |
| Debugging | `raw` | `aidx "data" --format raw` |

### Performance Considerations

- Use specific time ranges to limit data volume
- Export large datasets to files rather than displaying in console
- Use direct mode for frequently repeated queries
- Consider using templates for complex recurring queries

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Query failed: Invalid KQL` | Generated KQL is invalid | Try rephrasing the question or use raw mode |
| `No results returned` | Query matches no data | Check time range and criteria |
| `Timeout error` | Query takes too long | Use more specific filters or smaller time range |
| `Permission denied` | Insufficient access | Check Application Insights permissions |

### Debugging Failed Queries

```bash
# Enable debug logging
export AIDX_LOG_LEVEL=debug
aidx "your problematic query"

# Try raw KQL for precise control
aidx --raw "simplified version of the query"

# Use interactive mode for guided troubleshooting
aidx --interactive
```

### Query Confidence Issues

When AI confidence is low (<0.7), the system enters step-by-step mode:

1. **Review the generated query** for accuracy
2. **Choose an action**:
   - Execute if the query looks correct
   - Regenerate for a different approach
   - Edit manually for fine-tuning
   - Explain to understand what the query does

## Integration with Other Features

### Templates

```bash
# Create template from successful query
aidx template create   # Interactive template creation

# Use existing templates
aidx template use performance-overview --param hours=24
```

### Interactive Mode

```bash
# Start interactive session for complex analysis
aidx --interactive

# Within interactive mode, you have access to:
# - Query regeneration
# - Result analysis
# - Template creation
# - Azure Portal integration
```

### Providers

```bash
# Check which providers are being used
aidx status --verbose

# Switch AI providers for different query styles
aidx providers set-default ai openai
```

## Advanced Usage

### Scripting and Automation

```bash
#!/bin/bash
# Daily performance report script

echo "Generating daily performance report..."

# Get slow requests
aidx "slowest requests from last 24 hours" --format csv --output slow-requests.csv --direct

# Get error summary  
aidx "exception count by type from last 24 hours" --format json --output errors.json --direct

# Generate usage statistics
aidx "request count by hour from last 24 hours" --format tsv --output usage-stats.tsv --direct

echo "Report generated: slow-requests.csv, errors.json, usage-stats.tsv"
```

### Data Pipeline Integration

```bash
# Export data for further analysis
aidx "request telemetry from last hour" --format json --output telemetry.json --direct

# Process with jq
cat telemetry.json | jq '.rows[] | select(.[3] > 1000)' > slow-requests.json

# Import into other tools
aidx "metrics data" --format csv --output metrics.csv --direct
python analyze_metrics.py metrics.csv
```

## Next Steps

- **New to querying**: Start with simple natural language questions
- **KQL experience**: Try `--raw` mode with your existing queries  
- **Complex analysis**: Explore [Interactive Mode](interactive.md)
- **Repeated queries**: Learn about [Templates](template.md)
- **Real-world examples**: Check the [Query Showcase](../showcase.md)