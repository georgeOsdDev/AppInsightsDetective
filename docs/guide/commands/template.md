# Template Command

The `template` command manages reusable query templates that help standardize common analysis patterns, share queries across teams, and execute parameterized queries efficiently.

## Purpose

Query templates enable you to:
- **Standardize** common queries across your team
- **Parameterize** queries for different time ranges, applications, or criteria
- **Share** proven query patterns with others
- **Execute** complex queries with simple commands
- **Create** reusable analysis workflows

## Basic Usage

```bash
# List all available templates
aidx template list
aidx tpl list  # Short alias

# Show detailed template information
aidx template show performance-overview

# Create a new template interactively
aidx template create

# Execute a template with parameters
aidx template use performance-overview --param hours=24

# Delete a user-created template
aidx template delete my-custom-template
```

## Template Command Structure

```bash
aidx template <subcommand> [options] [arguments]
aidx tpl <subcommand> [options] [arguments]  # Short alias
```

## Subcommands

### List Templates

Shows all available templates with basic information:

```bash
# List all templates
aidx template list

# Filter by category
aidx template list --category Performance

# Filter by tags
aidx template list --tags "monitoring,performance"

# Search by name or description
aidx template list --search "error"

# Combine filters
aidx template list --category Performance --tags monitoring
```

**Example output:**
```
📋 Available Templates:
==================================================
1. Requests Overview
   ID: requests-overview
   Category: Performance
   Description: Get an overview of web requests over a time period
   Tags: requests, performance, overview
   Parameters: 2

2. Error Analysis
   ID: errors-analysis
   Category: Troubleshooting
   Description: Analyze application exceptions and failures over time
   Tags: exceptions, errors, troubleshooting
   Parameters: 2

3. Performance Insights
   ID: performance-insights
   Category: Performance
   Description: Analyze application performance metrics and trends
   Tags: performance, counters, metrics
   Parameters: 3

4. Dependency Analysis
   ID: dependency-analysis
   Category: Dependencies
   Description: Analyze external dependency calls and their performance
   Tags: dependencies, external, performance
   Parameters: 2

Total: 4 template(s)
```

### Show Template Details

Displays comprehensive template information:

```bash
aidx template show requests-overview
```

**Example output:**
```
📋 Template: Requests Overview
==================================================
ID: requests-overview
Category: Performance
Description: Get an overview of web requests over a time period
Author: System
Version: 1.0.0
Created: 2025-08-25
Tags: requests, performance, overview

🔍 KQL Template:
------------------------------
requests
| where timestamp > ago({{timespan}})
| summarize 
    RequestCount = count(),
    AvgDuration = avg(duration),
    SuccessRate = round(100.0 * countif(success == true) / count(), 2)
by bin(timestamp, {{binSize}})
| order by timestamp desc
------------------------------

⚙️ Parameters:
1. timespan (timespan)
   Description: Time period to analyze
   Required: Yes
   Default: 1h
   Valid values: 15m, 1h, 6h, 1d, 7d

2. binSize (timespan)
   Description: Aggregation bin size
   Required: Yes
   Default: 5m
   Valid values: 1m, 5m, 15m, 1h
```

### Create New Template

Creates a new user template interactively:

```bash
aidx template create
```

**Interactive creation process:**

```
📝 Creating New Query Template

? Template ID (lowercase, hyphens allowed): slow-api-calls
? Template Name: Slow API Call Analysis
? Description: Analyze API calls slower than threshold
? Category: Performance

📋 Template Parameters
Add parameters for your template (type 'done' when finished)

? Parameter name: hours
? Parameter type: (Use arrow keys)
❯ integer
  string
  boolean
  float
? Default value: 24
? Description: Time range in hours

? Parameter name: endpoint
? Parameter type: string  
? Default value: (leave blank for no default)
? Description: Specific API endpoint to analyze (optional)

? Parameter name: done

📝 Query Definition
? Enter your KQL query (use {{parameter}} for substitution):
requests
| where timestamp > ago({{hours}}h)
{{#if endpoint}}
| where name contains "{{endpoint}}"
{{/if}}
| where duration > 2000
| summarize 
    count(), 
    avg(duration), 
    max(duration) 
    by name
| order by avg_duration desc
| take 10

? Preview and confirm template creation? (Y/n): Y

✅ Template 'slow-api-calls' created successfully!
   Saved to: ~/.aidx/templates/user/slow-api-calls.json

Quick test:
  aidx template use slow-api-calls --param hours=12
```

### Use Template

Executes a template with specified parameters:

```bash
# Use template with default parameters
aidx template use requests-overview

# Use template with custom parameters  
aidx template use requests-overview --params '{"timespan":"2h","binSize":"10m"}'

# Use template with JSON parameters
aidx template use performance-insights --params '{"timespan":"6h","category":"Memory"}'

# Use template with output options
aidx template use errors-analysis --params '{"timespan":"1d"}' --format json --output errors.json

# Execute directly without interactive confirmation
aidx template use dependency-analysis --params '{"timespan":"4h"}' --auto-execute
```

**Parameter specification:**
```bash
# JSON format for multiple parameters
--params '{"param1":"value1","param2":"value2"}'

# Output options
--format table|json|csv|tsv    # Output format (default: table)
--output filename              # Save results to file

# Execution options  
--auto-execute                 # Skip interactive confirmation
```

### Template Categories

Lists all available template categories:

```bash
aidx template categories
```

**Example output:**
```
📂 Template Categories:
1. Dependencies
2. Performance
3. Troubleshooting
```

Use categories to filter templates:
```bash
# List templates in Performance category
aidx template list --category Performance

# List templates in Troubleshooting category  
aidx template list --category Troubleshooting
```

### Delete Template

Removes user-created templates:

```bash
# Delete with confirmation
aidx template delete slow-api-calls

# Force deletion without confirmation
aidx template delete slow-api-calls --force
```

**Example deletion:**
```
? Are you sure you want to delete template 'slow-api-calls'? (y/N): y
✅ Template 'slow-api-calls' deleted successfully

Note: System templates cannot be deleted
```

## Template Types

### System Templates

Built-in templates provided with AppInsights Detective:

**requests-overview**
- **Purpose**: Get an overview of web requests over a time period
- **Parameters**: timespan (default: 1h), binSize (default: 5m)
- **Category**: Performance
- **Use case**: Request performance analysis, monitoring web request trends

**errors-analysis**
- **Purpose**: Analyze application exceptions and failures over time
- **Parameters**: timespan (default: 1h), binSize (default: 5m)
- **Category**: Troubleshooting
- **Use case**: Error investigation, exception analysis

**performance-insights**
- **Purpose**: Analyze application performance metrics and trends
- **Parameters**: timespan (default: 1h), category (default: Process), binSize (default: 5m)
- **Category**: Performance
- **Use case**: Performance counter monitoring, system metrics analysis

**dependency-analysis**
- **Purpose**: Analyze external dependency calls and their performance
- **Parameters**: timespan (default: 1h), binSize (default: 5m)
- **Category**: Dependencies
- **Use case**: External dependency monitoring, integration performance analysis

### User Templates

Custom templates created by users and stored in `templates/user/` directory:

**Location**: `~/.aidx/templates/user/`
**Format**: JSON files with template definitions
**Persistence**: Automatically saved and loaded
**Scope**: Available only to the user who created them

## Template Storage and Management

### Template Directory Structure

User templates are stored in the following directory structure:

**Primary location** (preferred):
```
~/.aidx/
├── config.json
└── templates/
    └── user/
        ├── daily-report.json
        ├── slow-api-calls.json
        └── custom-analysis.json
```

**Fallback location** (for development):
```
<project-directory>/
└── templates/
    └── user/
        ├── daily-report.json
        └── custom-analysis.json
```

**Behavior:**
- AppInsights Detective automatically creates the `~/.aidx/templates/user/` directory when saving templates
- If the home directory is not accessible, it falls back to the project directory
- Templates are loaded from whichever directory is available
- All template operations (create, save, delete) use the same directory consistently

### Template File Format

User templates are stored as JSON files:

```json
{
  "id": "slow-api-calls",
  "name": "Slow API Call Analysis", 
  "description": "Analyze API calls slower than threshold",
  "category": "Performance",
  "type": "user",
  "parameters": [
    {
      "name": "hours",
      "type": "integer",
      "default": 24,
      "description": "Time range in hours",
      "validation": {
        "min": 1,
        "max": 168
      }
    },
    {
      "name": "endpoint",
      "type": "string", 
      "description": "Specific API endpoint to analyze (optional)",
      "optional": true
    }
  ],
  "query": "requests\n| where timestamp > ago({{hours}}h)\n{{#if endpoint}}\n| where name contains \"{{endpoint}}\"\n{{/if}}\n| where duration > 2000\n| summarize count(), avg(duration), max(duration) by name\n| order by avg_duration desc\n| take 10",
  "created": "2024-01-15T10:30:00Z",
  "modified": "2024-01-15T10:30:00Z"
}
```

## Parameter System

### Parameter Types

| Type | Description | Example | Validation |
|------|-------------|---------|------------|
| `integer` | Whole numbers | `24`, `100` | Range validation |
| `string` | Text values | `"endpoint"`, `"error"` | Length validation |  
| `boolean` | True/false values | `true`, `false` | Boolean validation |
| `float` | Decimal numbers | `1.5`, `99.9` | Range validation |

### Parameter Substitution

Templates use Handlebars-style syntax for parameter substitution:

```kql
-- Simple parameter substitution
requests | where timestamp > ago({{hours}}h)

-- Conditional blocks  
{{#if endpoint}}
| where name contains "{{endpoint}}"
{{/if}}

-- Default values in template
| where duration > {{threshold|1000}}
```

### Parameter Validation

Parameters are validated before template execution:

```bash
# This will fail validation
aidx template use performance-overview --param hours=200
# Error: Parameter 'hours' value 200 exceeds maximum of 168

# This will succeed
aidx template use performance-overview --param hours=48
```

## Template Usage Examples

### Performance Analysis Workflow

```bash
# Daily performance review
aidx template use requests-overview --params '{"timespan":"1d","binSize":"1h"}'

# Analyze performance metrics
aidx template use performance-insights --params '{"timespan":"6h","category":"Process","binSize":"15m"}'

# Check dependency performance
aidx template use dependency-analysis --params '{"timespan":"2h","binSize":"5m"}'

# Export for reporting
aidx template use requests-overview --params '{"timespan":"1d","binSize":"1h"}' --format csv --output daily-perf.csv
```

### Error Investigation Workflow

```bash
# Start with error analysis
aidx template use errors-analysis --params '{"timespan":"6h","binSize":"10m"}'

# Detailed error investigation
aidx template use errors-analysis --params '{"timespan":"1h","binSize":"1m"}'

# Compare with requests to see correlation
aidx template use requests-overview --params '{"timespan":"6h","binSize":"10m"}'
```

### Dependency Analysis Workflow

```bash
# Check dependency health
aidx template use dependency-analysis --params '{"timespan":"2h","binSize":"5m"}'

# Long-term dependency trends
aidx template use dependency-analysis --params '{"timespan":"1d","binSize":"1h"}'

# Focus on recent dependency issues
aidx template use dependency-analysis --params '{"timespan":"30m","binSize":"1m"}'
```

## Template Creation Best Practices

### Query Design

- **Use clear parameter names**: `hours` instead of `h`, `threshold` instead of `t`
- **Provide sensible defaults**: Most common use case values
- **Add parameter validation**: Min/max ranges, required vs optional
- **Include helpful descriptions**: Explain parameter purpose and valid ranges

### Template Organization

- **Use descriptive IDs**: `slow-api-analysis` not `template1`
- **Group by category**: Performance, Errors, Users, Infrastructure
- **Document use cases**: When and why to use this template
- **Provide usage examples**: Common parameter combinations

### Query Performance

- **Optimize for common cases**: Default parameters should run efficiently
- **Use appropriate time ranges**: Don't default to overly broad ranges
- **Include result limiting**: Use `take` or `limit` to prevent excessive output
- **Consider indexing**: Structure queries to use indexed columns effectively

## Advanced Template Features

### Conditional Logic

Templates support conditional blocks:

```kql
requests
| where timestamp > ago({{hours}}h)
{{#if environment}}
| where customDimensions.environment == "{{environment}}"
{{/if}}
{{#if includeSuccessful}}
| where success == true
{{else}}
| where success == false
{{/if}}
| summarize count() by name
```

### Multiple Parameter Formats

```bash
# Environment-specific analysis
aidx template use app-analysis --param hours=24 --param environment=production

# Include/exclude certain data
aidx template use user-analysis --param includeTests=false --param days=7

# Threshold-based filtering
aidx template use performance-analysis --param threshold=500.5 --param hours=12
```

### Template Chaining

Use template outputs as input for other analysis:

```bash
# Export slow requests for further analysis
aidx template use slow-requests --param hours=24 --format json --output slow.json

# Create custom template that analyzes the slow request patterns
aidx template create  # Create follow-up analysis template
```

## Team Collaboration

### Sharing Templates

Templates can be shared across teams:

```bash
# Export template for sharing
cp ~/.aidx/templates/user/my-template.json /shared/templates/

# Import shared template
cp /shared/templates/team-template.json ~/.aidx/templates/user/
```

### Template Standardization

Teams can standardize on common templates:

1. **Create** standard templates for common scenarios
2. **Document** parameter conventions and usage patterns  
3. **Share** template files across team members
4. **Maintain** template library in version control

### Template Versioning

For important templates:

```bash
# Create versioned copies
cp performance-analysis.json performance-analysis-v2.json

# Document changes in description
{
  "description": "Performance analysis v2 - Added dependency metrics",
  ...
}
```

## Integration with Other Features

### Interactive Mode

Templates work within interactive sessions:

```bash
# Start interactive session
aidx --interactive

# Within interactive mode:
> template list
> template use performance-overview hours=12
> # Results displayed with full interactive features
```

### Output Formatting

Templates support all output formats:

```bash
# Console display
aidx template use error-analysis

# Export formats
aidx template use performance-overview --format json --output perf.json
aidx template use user-behavior --format csv --output users.csv
```

### Command Chaining

```bash
# Check template status
aidx template show performance-overview

# Use template if available
aidx template use performance-overview --param hours=12

# Check execution status
aidx status
```

## Troubleshooting Templates

### Template Not Found

```bash
# Error: Template 'my-template' not found
aidx template use my-template

# Solution: Check available templates
aidx template list

# Check specific template location
ls ~/.aidx/templates/user/my-template.json
```

### Parameter Validation Errors

```bash
# Error: Parameter 'hours' must be between 1 and 168
aidx template use performance-overview --param hours=200

# Solution: Use valid parameter ranges
aidx template show performance-overview  # Check parameter requirements
aidx template use performance-overview --param hours=48
```

### Query Execution Failures

```bash
# If template query fails
aidx template use my-template --param hours=24

# Debug: Show generated query
aidx template show my-template

# Test with simpler parameters
aidx template use my-template --param hours=1
```

## Next Steps

- **New Users**: Start by exploring system templates with `aidx template list`
- **Power Users**: Create custom templates for recurring analysis patterns
- **Team Leaders**: Standardize team queries using shared templates
- **Developers**: Review [Query Examples](../showcase.md) for template inspiration