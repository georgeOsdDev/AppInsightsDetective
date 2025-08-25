# Interactive Mode

Interactive Mode provides a comprehensive, guided query experience with step-by-step assistance, real-time validation, and integrated analysis capabilities. It's the most powerful way to explore your Application Insights data.

## Purpose

Interactive Mode enables you to:
- **Build queries** with guided assistance and real-time feedback
- **Review and validate** generated queries before execution
- **Analyze results** with AI-powered insights and recommendations
- **Iterate on queries** with regeneration and editing capabilities
- **Explore data** through follow-up questions and drill-down analysis
- **Create templates** from successful query patterns
- **Integrate with Azure Portal** for advanced visualizations

## Starting Interactive Mode

```bash
# Start interactive session
aidx --interactive
aidx -i

# Start with preferred execution mode
aidx --interactive --raw  # Start in raw KQL mode
```

## Interactive Session Overview

When you start an interactive session, you'll see:

```
🔍 AppInsights Detective - Interactive Mode 🕵
Ask questions about your application in natural language
Type "help" for available commands, "exit" or "quit" to end the session

🤖 Initializing AI services...
✅ AI services ready

❓ What would you like to know about your application?
> 
```

## Core Interactive Features

### 1. Guided Query Building

**Natural Language Input**: Ask questions conversationally
```
> Show me errors from the last hour
> What are the slowest API calls today?
> How many users visited my app yesterday?
```

**Real-time Validation**: Immediate feedback on query feasibility
```
> Show me performance data from 2019
⚠️  Warning: Querying data from 2019 may return no results if your retention period is shorter
💡 Suggestion: Try "Show me performance data from the last 30 days"
```

**Context Preservation**: Session remembers previous queries and results
```
> Show me errors from last hour
[Results displayed]

> Group those by error type
[Uses context from previous query about errors]
```

### 2. Execution Mode Selection

Interactive Mode offers three execution approaches that you can switch between during the session:

#### Smart Mode (Default)
- AI analyzes query confidence automatically
- High confidence (≥0.7): Executes immediately with explanation
- Low confidence (<0.7): Enters step-by-step review mode

```
> Show me recent performance problems

🔍 Generated KQL Query Review (Confidence: 0.85)
==========================================
requests
| where timestamp > ago(1h) 
| where duration > 2000
| summarize count(), avg(duration) by name
| order by count_ desc

🚀 Execute Query - High confidence, executing automatically...
```

#### Review Mode (Step-by-step)
- Shows generated query for review before execution
- Provides multiple action options
- Best for learning and validation

```
> Analyze user sessions

🔍 Generated KQL Query Review (Confidence: 0.65)
==========================================
pageViews
| where timestamp > ago(24h)
| summarize sessions=dcount(session_Id), pageViews=count() by user_Id
| order by sessions desc

Choose your action:
🚀 Execute Query - Run this KQL query against Application Insights
📖 Explain Query - Get detailed explanation of what this query does  
🌐 Open in Azure Portal - Execute query with full visualization capabilities
🔄 Regenerate Query - Ask AI to create a different query approach
✏️ Edit Query - Manually modify the KQL query
❌ Cancel - Start over with a new question

Choice: 
```

#### Raw KQL Mode
- Direct KQL input and execution
- For users comfortable with KQL syntax
- Immediate execution without AI processing

```
> /raw
Switched to Raw KQL mode. Enter KQL queries directly.
Type "/smart" to switch back to natural language mode.

KQL> requests | where timestamp > ago(1h) | take 10
```

### 3. Smart Result Presentation

#### Automatic Format Detection
Results are displayed in the optimal format based on data type:

```
╭─────────────────────────────────────────────────────────╮
│                    Query Results                        │
│                  Execution Time: 234ms                 │
╰─────────────────────────────────────────────────────────╯

┌─────────────────────────────┬─────────┬──────────────┐
│            name             │  count  │ avg_duration │
├─────────────────────────────┼─────────┼──────────────┤
│ GET /api/users              │   1,234 │        125ms │
│ POST /api/login             │     856 │         89ms │
│ GET /api/products           │     642 │        156ms │
└─────────────────────────────┴─────────┴──────────────┘

📊 ASCII Chart: count
████████████████████████████████████████████████ 1,234
█████████████████████████████████████            856
████████████████████████████████                 642

3 rows displayed, 2 empty columns hidden
```

#### Smart Column Management
- Empty columns automatically hidden for cleaner output
- Option to show all columns when needed
- Summary statistics displayed

#### ASCII Chart Generation
- Automatic visualization for numeric data
- Time-series data → Line charts
- Categorical data → Bar charts  
- Top 10 limiting for readability

### 4. Azure Portal Integration

Seamless integration with Azure Portal for advanced visualizations:

```
Choose your action:
🌐 Open in Azure Portal - Execute query with full visualization capabilities

Opening query in Azure Portal...
🌐 Portal URL: https://portal.azure.com/#blade/Microsoft_Azure_MonitoringMetrics/...
✅ Query opened in Azure Portal

Continue in current session? (Y/n): Y
```

**Portal Integration Features:**
- One-click query execution in Azure Portal
- Full visualization capabilities (charts, graphs, maps)
- Access to advanced Azure Monitor features
- Seamless context switching between CLI and Portal

### 5. Query Explanation & Understanding

Detailed explanations help you learn KQL and understand query logic:

```
> Show me error rates by hour

[Query generated and displayed]

Choose your action:
📖 Explain Query - Get detailed explanation of what this query does

Choice: Explain Query

📖 Query Explanation
==========================================
This query analyzes error rates over time by:

1. **Data Source**: Uses 'requests' table containing HTTP request telemetry
2. **Time Filter**: Limits to last 24 hours with 'timestamp > ago(24h)'
3. **Error Classification**: Identifies errors using 'success == false'  
4. **Time Grouping**: Groups results by hour using 'bin(timestamp, 1h)'
5. **Rate Calculation**: Calculates error percentage with success rate formula
6. **Sorting**: Orders by timestamp to show chronological trend

**Key Concepts:**
- bin(): Groups timestamps into hourly buckets
- countif(): Conditional counting for error detection
- summarize: Aggregates data across time periods

**Expected Output:** Hourly error rates showing time-based trends

Would you like me to execute this query? (Y/n):
```

## Session Commands

While in interactive mode, you can use special commands:

| Command | Purpose | Example |
|---------|---------|---------|
| `help` | Show available commands and features | `> help` |
| `settings` | View and modify session settings | `> settings` |
| `history` | Show query history for this session | `> history` |
| `templates` | List and use available templates | `> templates` |
| `mode <mode>` | Switch execution modes | `> mode review` |
| `clear` | Clear screen | `> clear` |
| `exit` / `quit` | End interactive session | `> exit` |

### Session Commands Examples

#### Settings Command
```
> settings

📋 Current Session Settings
=========================
Execution Mode: smart
Language: en (English)
Default Time Range: 24h
Show Empty Columns: false
Chart Generation: enabled (experimental)

Available Settings:
- mode: smart, review, raw
- language: en, ja, ko, zh, es, fr, de
- timeRange: 1h, 6h, 24h, 7d, 30d
- showEmptyColumns: true, false
- charts: enabled, disabled

Change setting: mode=review
✅ Execution mode changed to 'review'
```

#### History Command
```
> history

📋 Query History (Current Session)
===============================
1. "show me errors from last hour" 
   - Executed: 2024-01-15 10:30:00
   - Results: 15 rows
   - Status: ✅ Success

2. "what are the slowest requests?"
   - Executed: 2024-01-15 10:32:15  
   - Results: 10 rows
   - Status: ✅ Success

3. "group those by endpoint"
   - Executed: 2024-01-15 10:33:45
   - Results: 8 rows  
   - Status: ✅ Success

Rerun query: history 2
```

#### Templates Command
```
> templates

📋 Available Templates
====================
System Templates:
- performance-overview: Application performance summary
- error-analysis: Comprehensive error investigation  
- user-behavior: User activity and engagement metrics

User Templates:
- daily-report: Daily operations summary

Use template: templates use performance-overview hours=12
```

## Advanced Interactive Features

### Result Analysis and Insights

Interactive Mode provides AI-powered analysis of query results:

```
[After query execution]

Results analyzed. Would you like AI insights? (Y/n): Y

🧠 AI Analysis Results
=====================

📊 Key Findings:
- Error rate increased 300% compared to previous hour
- Most errors (67%) are from /api/payment endpoint
- Errors correlate with deployment at 09:45 AM

🔍 Anomalies Detected:
- Unusual spike in timeout errors (15x normal rate)
- New error type appeared: "Database connection failed"

💡 Recommendations:
1. Investigate recent deployment to /api/payment
2. Check database connection pool settings
3. Consider rollback if issues persist

🔗 Suggested Follow-up Queries:
- "Show me payment API errors in detail"
- "What changed in the last deployment?"
- "Database dependency health status"

Ask follow-up question:
```

### Query Editing and Regeneration

When queries need refinement:

```
🔄 Regenerate Query - Ask AI to create a different query approach

How would you like me to adjust the query?
1. Change time range
2. Add filters or conditions  
3. Modify grouping or aggregation
4. Focus on specific data points
5. Simplify the query
6. Make it more detailed

Choice: 2

What filters would you like to add?
> Only show errors from mobile clients

🔄 Regenerating query with mobile client filter...

Updated KQL Query:
==================
requests
| where timestamp > ago(1h)
| where success == false
| where client_Type == "Mobile" or client_Browser contains "Mobile"
| summarize count() by name
| order by count_ desc
```

### Multi-Step Analysis Workflows

Interactive Mode excels at complex, multi-step investigations:

```
> Show me performance problems

[Results displayed showing slow requests]

> Which of these started recently?

[AI understands context and generates comparative query]

> Get more details on the API that got slower

[Drill-down query focusing on specific endpoint]

> Show me the error pattern for that API

[Context-aware error analysis for the same endpoint]

> Create a template for this analysis workflow

Template Creation Wizard:
=========================
Based on your query pattern, I can create a template for:
"Performance degradation analysis workflow"

Parameters detected:
- Time range for comparison
- Performance threshold  
- Specific endpoint focus

Would you like to create this template? (Y/n): Y
```

### Cross-Reference Analysis

Interactive Mode can correlate data across different telemetry types:

```
> Show me errors and their performance impact

[Query combines requests and exceptions data]

> How do these correlate with user satisfaction scores?

[Adds pageViews and custom events data]  

> Export this combined analysis

Export Options:
===============
1. JSON format for further analysis
2. CSV format for spreadsheet import
3. Create dashboard query for Azure Portal
4. Generate PowerBI compatible dataset

Choice: 3

🌐 Dashboard query generated and copied to clipboard
📋 Ready to paste into Azure Portal Dashboard
```

## Session Management

### Long-Running Sessions

Interactive sessions maintain context and can handle extended analysis:

```
🔍 Session Status
================
Duration: 45 minutes
Queries Executed: 23
Templates Created: 2
Portal Integrations: 5
Context Items: 12

Session health: ✅ Optimal
Memory usage: Normal
Connection status: ✅ Connected

Recommendations:
- Consider saving frequent query patterns as templates
- Session context will be lost when exiting
```

### Session Persistence

While sessions don't persist between runs, you can save important artifacts:

```
> save session-summary

💾 Session Summary Saved
======================
Location: ~/.aidx/sessions/2024-01-15-performance-investigation.md

Included:
- Query history with results
- Created templates  
- Key findings and insights
- Recommended follow-up actions

Load previous session artifacts: aidx template import session-templates.json
```

## Best Practices for Interactive Mode

### Query Formulation Strategy

1. **Start Broad**: Begin with general questions to understand data landscape
2. **Iterative Refinement**: Use follow-up questions to drill down
3. **Context Building**: Let the session build context through related queries
4. **Template Creation**: Save successful query patterns as templates

### Effective Session Flow

```
# Typical successful session flow:

1. Start with overview query
   > "Show me application health overview"

2. Identify areas of interest  
   > "Focus on the error patterns"

3. Drill down into specifics
   > "Show me details on the timeout errors"

4. Cross-reference with other data
   > "How do these errors affect user experience?"

5. Create actionable artifacts
   > "Create a template for this error investigation"
```

### Learning KQL Through Interactive Mode

- Use **Explain Query** feature to understand generated KQL
- Switch to **Review Mode** to see queries before execution
- Try **Raw KQL Mode** to practice direct query writing
- Compare natural language questions with generated KQL

### Performance Optimization

- Use specific time ranges to limit data volume
- Start with simple queries before adding complexity
- Use templates for frequently repeated analysis patterns
- Export large datasets rather than displaying in console

## Integration with Other Features

### Template Integration

```bash
# Interactive mode can use templates
> templates list
> templates use performance-overview hours=6

# Create templates from successful queries  
> This query worked well, create a template
```

### Status Monitoring

```bash
# Check system health during session
> status

# Test connections if issues arise
> test-connections
```

### Provider Management

```bash
# Switch providers during session
> providers switch ai openai

# Configure providers interactively
> providers configure
```

## Troubleshooting Interactive Mode

### Session Connection Issues

If you lose connectivity during a session:

```
⚠️ Connection Error: Unable to reach Application Insights
🔄 Attempting to reconnect...
❌ Reconnection failed

Options:
1. Check network connectivity
2. Verify authentication status
3. Exit and restart session
4. Switch to cached/offline mode

Choice: 
```

### Performance Issues

For slow query responses:

```
⏱️ Query taking longer than expected...

Options:
1. Continue waiting (query may be processing large dataset)
2. Cancel query and try with smaller time range  
3. Simplify query and retry
4. Check system status

Current query: [Shows running query]
Elapsed time: 45 seconds

Choice:
```

### Memory and Resource Management

```
⚠️ Session memory usage is high
💾 Current context: 150 MB
🧹 Recommendations:
- Clear query history to free memory
- Export important results before continuing
- Restart session if performance degrades

Clear query history? (y/N):
```

## Advanced Use Cases

### Data Exploration for New Applications

Interactive Mode is perfect for exploring unfamiliar Application Insights data:

```
> What data do I have available?
[Shows schema and data types]

> Show me sample data from the last day
[Displays representative data samples]

> What are the most active telemetry types?
[Analyzes data volume across different telemetry]
```

### Incident Investigation

Step-by-step incident analysis:

```
> We had an outage at 2 PM, show me what happened
> What errors occurred around that time?
> Which services were affected?
> Show me the timeline of the incident
> What was the user impact?
> Create an incident report template
```

### Performance Tuning Workflows

Systematic performance analysis:

```
> Show me performance baseline for last week
> Compare with current performance  
> Identify performance regressions
> Find root cause for slowdowns
> Generate performance improvement recommendations
```

## Next Steps

- **New Users**: Start with simple questions and explore features gradually
- **KQL Learners**: Use Explain Query and Review Mode extensively
- **Power Users**: Create templates and use cross-reference analysis
- **Teams**: Share successful query patterns and workflows
- **Integration**: Combine with Azure Portal for comprehensive analysis