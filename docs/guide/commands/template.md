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

# List only system templates
aidx template list --type system

# List only user templates  
aidx template list --type user
```

**Example output:**
```
📋 Available Query Templates

System Templates:
┌─────────────────────────┬──────────────────────────────────────┬────────────┐
│         ID              │              Description             │ Parameters │
├─────────────────────────┼──────────────────────────────────────┼────────────┤
│ performance-overview    │ Application performance summary      │ hours      │
│ error-analysis         │ Comprehensive error investigation     │ hours, type│
│ user-behavior          │ User activity and engagement metrics │ days       │
│ dependency-health      │ External dependency monitoring       │ hours      │
└─────────────────────────┴──────────────────────────────────────┴────────────┘

User Templates:
┌─────────────────────────┬──────────────────────────────────────┬────────────┐
│         ID              │              Description             │ Parameters │
├─────────────────────────┼──────────────────────────────────────┼────────────┤
│ daily-report           │ Daily operations summary              │ date       │
│ slow-queries-custom    │ Custom slow query analysis           │ threshold  │
└─────────────────────────┴──────────────────────────────────────┴────────────┘

Total: 4 system templates, 2 user templates
```

### Show Template Details

Displays comprehensive template information:

```bash
aidx template show performance-overview
```

**Example output:**
```
📋 Template: performance-overview

Description: Application performance summary with key metrics
Category: Performance Monitoring
Type: System Template
Created: Built-in
Last Modified: N/A

Parameters:
┌───────────┬──────────┬─────────┬─────────────────────────────────────┐
│    Name   │   Type   │ Default │              Description            │
├───────────┼──────────┼─────────┼─────────────────────────────────────┤
│ hours     │ integer  │ 24      │ Time range in hours (1-168)        │
│ threshold │ integer  │ 1000    │ Response time threshold in ms       │
└───────────┴──────────┴─────────┴─────────────────────────────────────┘

Usage Examples:
  aidx template use performance-overview
  aidx template use performance-overview --param hours=12
  aidx template use performance-overview --param hours=48 --param threshold=500

Generated KQL Preview:
requests
| where timestamp > ago({{hours}}h)
| summarize 
    TotalRequests = count(),
    AvgDuration = avg(duration),
    SlowRequests = countif(duration > {{threshold}})
    by bin(timestamp, 1h)
| order by timestamp desc
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
aidx template use performance-overview

# Use template with custom parameters
aidx template use performance-overview --param hours=12 --param threshold=500

# Use template with multiple parameters
aidx template use error-analysis --param hours=6 --param type=exception
```

**Parameter specification:**
```bash
# Single parameter
--param name=value

# Multiple parameters  
--param param1=value1 --param param2=value2

# Boolean parameters
--param includeTests=true
--param excludeInternal=false
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

#### Performance Monitoring Templates

**performance-overview**
- **Purpose**: Complete application performance summary
- **Parameters**: hours (default: 24), threshold (default: 1000ms)
- **Use case**: Daily performance reviews, trend analysis

**slow-requests**
- **Purpose**: Identify slowest requests by endpoint
- **Parameters**: hours (default: 24), limit (default: 20)
- **Use case**: Performance bottleneck identification

**response-time-trends** 
- **Purpose**: Response time trends over time periods
- **Parameters**: hours (default: 24), interval (default: 1h)
- **Use case**: Performance trend analysis, capacity planning

#### Error Investigation Templates

**error-analysis**
- **Purpose**: Comprehensive error analysis with grouping
- **Parameters**: hours (default: 24), errorType (optional)
- **Use case**: Error investigation, incident response

**exception-details**
- **Purpose**: Detailed exception information with stack traces
- **Parameters**: hours (default: 6), exceptionType (optional)
- **Use case**: Debugging, root cause analysis

**failed-requests**
- **Purpose**: Failed requests analysis by status code
- **Parameters**: hours (default: 24), statusCode (optional)
- **Use case**: HTTP error investigation

#### User Behavior Templates

**user-behavior**
- **Purpose**: User activity patterns and engagement
- **Parameters**: days (default: 7)
- **Use case**: User analytics, engagement analysis

**popular-pages**
- **Purpose**: Most visited pages and user flows
- **Parameters**: days (default: 7), limit (default: 20)
- **Use case**: Content optimization, user journey analysis

**session-analysis**
- **Purpose**: User session duration and patterns
- **Parameters**: days (default: 7)
- **Use case**: User engagement, session quality analysis

#### Infrastructure Templates

**dependency-health**
- **Purpose**: External dependency performance and failures
- **Parameters**: hours (default: 24)
- **Use case**: Dependency monitoring, integration health

**server-metrics**
- **Purpose**: Server-side performance metrics
- **Parameters**: hours (default: 24)
- **Use case**: Infrastructure monitoring

### User Templates

Custom templates created by users and stored in `templates/user/` directory:

**Location**: `~/.aidx/templates/user/`
**Format**: JSON files with template definitions
**Persistence**: Automatically saved and loaded
**Scope**: Available only to the user who created them

## Template Storage and Management

### Template Directory Structure

```
~/.aidx/
├── config.json
└── templates/
    └── user/
        ├── daily-report.json
        ├── slow-api-calls.json
        └── custom-analysis.json
```

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
aidx template use performance-overview --param hours=24

# Compare with previous day
aidx template use performance-overview --param hours=48

# Focus on slow requests
aidx template use slow-requests --param hours=12 --param limit=10

# Export for reporting
aidx template use performance-overview --param hours=24 --format csv --output daily-perf.csv
```

### Error Investigation Workflow

```bash
# Start with error overview
aidx template use error-analysis --param hours=6

# Focus on specific error type
aidx template use error-analysis --param hours=6 --param errorType=exception

# Get detailed exception information
aidx template use exception-details --param hours=6 --param exceptionType=NullReference

# Analyze failed requests
aidx template use failed-requests --param hours=6 --param statusCode=500
```

### User Behavior Analysis Workflow

```bash
# Weekly user behavior summary
aidx template use user-behavior --param days=7

# Popular content analysis
aidx template use popular-pages --param days=30 --param limit=50

# Session quality analysis
aidx template use session-analysis --param days=14
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