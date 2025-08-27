# Query Showcase - Real-World Examples and Use Cases

This showcase demonstrates practical AppInsights Detective usage through real-world scenarios, common query patterns, and best practices. Learn by example and adapt these patterns to your specific needs.

## Application Performance Monitoring

### Identifying Performance Bottlenecks

**Scenario**: Your application feels slow and users are complaining about response times.

```bash
# Start with a performance overview
aidx "show me slowest requests from last 24 hours"

# Drill down into specific endpoints
aidx "requests slower than 5 seconds grouped by endpoint"

# Analyze trends over time
aidx "average response time by hour for the last week"

# Export data for deeper analysis
aidx "performance data with percentiles" --format csv --output performance-analysis.csv
```

**Generated KQL Examples**:
```kql
-- Slowest requests identification
requests
| where timestamp > ago(24h)
| where duration > 2000
| project timestamp, name, duration, url, resultCode
| order by duration desc
| take 20

-- Performance trends over time  
requests
| where timestamp > ago(7d)
| summarize 
    avg_duration = avg(duration),
    p95_duration = percentile(duration, 95),
    request_count = count()
    by bin(timestamp, 1h)
| render timechart
```

### Server Response Time Analysis

**Scenario**: Monitoring server-side performance across different services.

```bash
# Overall server performance  
aidx "server response times by operation name"

# Dependency performance impact
aidx "how do external dependencies affect response time?"

# Regional performance comparison  
aidx "response times by geographic location"
```

**KQL Pattern**:
```kql
-- Server response analysis with dependencies
requests
| where timestamp > ago(24h)
| join kind=leftouter (
    dependencies
    | where timestamp > ago(24h)
    | summarize dep_duration = avg(duration) by operation_Id
) on operation_Id
| summarize 
    server_avg = avg(duration),
    dependency_avg = avg(dep_duration),
    total_requests = count()
    by name
| extend efficiency = server_avg / (server_avg + dependency_avg) * 100
| order by server_avg desc
```

### Capacity Planning

**Scenario**: Understanding traffic patterns for capacity planning.

```bash
# Traffic patterns and peaks
aidx "request volume by hour over the last month"

# Resource utilization correlation
aidx "requests vs server metrics correlation" 

# Growth trend analysis
aidx "weekly request growth rate over 3 months"
```

## Error Investigation and Debugging

### Comprehensive Error Analysis

**Scenario**: Production errors spiked overnight and you need to investigate.

```bash
# Error overview and trends
aidx "show me all errors from last 12 hours"

# Error categorization
aidx "group errors by type and severity"

# Error timeline analysis  
aidx "when did errors start increasing?"

# Detailed error investigation
aidx --interactive  # Use interactive mode for deep dive
```

**Interactive Session Example**:
```
> show me errors from last 12 hours

[Results show error spike at 2 AM]

> what types of errors increased at 2 AM?

[Analysis shows database timeout errors]

> show me the specific error messages for database timeouts

[Detailed error messages and stack traces]

> which users were affected by these errors?

[User impact analysis]

> create a template for this error investigation pattern
```

### Exception Root Cause Analysis

**Scenario**: Tracking down the root cause of application exceptions.

```bash
# Exception patterns
aidx "most common exceptions in the last week"

# Stack trace analysis
aidx "show me stack traces for null reference exceptions"

# Correlation with deployments
aidx "exceptions before and after recent deployment"
```

**KQL Pattern**:
```kql
-- Exception analysis with context
exceptions
| where timestamp > ago(7d)
| where type contains "NullReference"
| summarize 
    count = count(),
    unique_operations = dcount(operation_Name),
    sample_message = any(message),
    sample_stack = any(details[0].parsedStack)
    by problemId
| order by count desc
| take 10
```

### Failed Request Investigation

**Scenario**: HTTP 5xx errors are affecting user experience.

```bash
# Failed request overview
aidx "show me failed requests with 5xx status codes"

# Failure patterns by endpoint  
aidx "which API endpoints have the highest failure rate?"

# User session impact
aidx "how many user sessions were affected by failed requests?"
```

## User Behavior Analytics

### User Engagement Metrics

**Scenario**: Understanding how users interact with your application.

```bash
# User activity overview
aidx "user engagement metrics for the last 30 days"

# Popular features analysis
aidx "most used features based on page views"

# User journey mapping
aidx "common user paths through the application"

# Session analysis
aidx "average session duration and page views per session"
```

**KQL Pattern**:
```kql
-- User engagement comprehensive analysis
let timeRange = 30d;
let users = pageViews
| where timestamp > ago(timeRange)
| summarize 
    sessions = dcount(session_Id),
    page_views = count(),
    unique_pages = dcount(name),
    first_visit = min(timestamp),
    last_visit = max(timestamp)
    by user_Id;
pageViews
| where timestamp > ago(timeRange)
| summarize 
    total_users = dcount(user_Id),
    total_sessions = dcount(session_Id),
    total_page_views = count(),
    avg_session_duration = avg(session_Id) // Simplified
| extend engagement_ratio = total_page_views * 1.0 / total_sessions
```

### Feature Usage Analysis

**Scenario**: Product team needs to understand which features are most valuable.

```bash
# Feature popularity ranking
aidx "rank features by usage frequency"

# Feature adoption over time
aidx "new feature adoption rate since launch"

# User segment analysis
aidx "feature usage differences between user segments"
```

### Conversion Funnel Analysis

**Scenario**: Analyzing user conversion through critical business flows.

```bash
# Registration funnel analysis
aidx "user conversion rate through signup process"

# Purchase funnel tracking  
aidx "shopping cart to purchase conversion rate"

# Drop-off point identification
aidx "where do users typically abandon the checkout process?"
```

**KQL Pattern**:
```kql
-- Conversion funnel analysis
let funnel_steps = pageViews
| where timestamp > ago(7d)
| where name in ("landing", "signup", "profile", "purchase")
| summarize users = dcount(user_Id) by name;
let landing_users = toscalar(funnel_steps | where name == "landing" | project users);
funnel_steps
| extend conversion_rate = users * 100.0 / landing_users
| order by case(
    name == "landing", 1,
    name == "signup", 2, 
    name == "profile", 3,
    name == "purchase", 4, 5)
```

## System Monitoring and Operations

### Dependency Health Monitoring

**Scenario**: Your application relies on multiple external services that need monitoring.

```bash
# External dependency overview
aidx "health status of all external dependencies"

# Dependency failure patterns
aidx "which dependencies have the highest failure rate?"

# Performance impact analysis
aidx "how do slow dependencies affect overall performance?"

# SLA compliance checking
aidx "dependency response times vs SLA thresholds"
```

**KQL Pattern**:
```kql
-- Comprehensive dependency health analysis
dependencies
| where timestamp > ago(24h)
| summarize 
    total_calls = count(),
    failed_calls = countif(success == false),
    avg_duration = avg(duration),
    max_duration = max(duration),
    p95_duration = percentile(duration, 95)
    by target, type
| extend 
    failure_rate = failed_calls * 100.0 / total_calls,
    sla_compliance = case(
        p95_duration <= 1000, "✅ Good",
        p95_duration <= 5000, "⚠️ Warning", 
        "❌ Poor")
| order by failure_rate desc
```

### Infrastructure Performance Correlation

**Scenario**: Correlating application performance with infrastructure metrics.

```bash
# Server metrics correlation
aidx "requests vs CPU utilization correlation"

# Memory impact analysis  
aidx "how does memory usage affect response times?"

# Network dependency analysis
aidx "network latency impact on user experience"
```

### Alert and Incident Correlation

**Scenario**: Understanding the relationship between alerts and actual user impact.

```bash
# Alert effectiveness analysis
aidx "correlation between alerts and actual user-reported issues"

# Incident timeline reconstruction
aidx "reconstruct timeline for incident on January 15th"

# Alert tuning recommendations  
aidx "false positive rate analysis for performance alerts"
```

## Business Intelligence and Reporting

### Daily Operations Report

**Scenario**: Daily standup report combining technical and business metrics.

```bash
# Create a comprehensive daily report template
aidx template create

# Daily report execution
aidx template use daily-operations-report --param date=today

# Export for stakeholder distribution
aidx template use daily-operations-report --format json --output daily-report.json
```

**Template Example**:
```json
{
  "id": "daily-operations-report",
  "name": "Daily Operations Report",
  "description": "Comprehensive daily metrics for operations team",
  "parameters": [
    {
      "name": "date",
      "type": "string", 
      "default": "today",
      "description": "Report date (today, yesterday, YYYY-MM-DD)"
    }
  ],
  "query": "let reportDate = iff('{{date}}' == 'today', now(), iff('{{date}}' == 'yesterday', ago(1d), todatetime('{{date}}'))); let dayStart = startofday(reportDate); let dayEnd = endofday(reportDate); union (requests | where timestamp between (dayStart .. dayEnd) | summarize metric='Total Requests', value=count()), (requests | where timestamp between (dayStart .. dayEnd) | where success == false | summarize metric='Failed Requests', value=count()), (exceptions | where timestamp between (dayStart .. dayEnd) | summarize metric='Exceptions', value=count()), (requests | where timestamp between (dayStart .. dayEnd) | summarize metric='Avg Response Time', value=avg(duration)) | project Metric=metric, Value=value"
}
```

### Performance SLA Reporting

**Scenario**: Weekly SLA compliance reporting for business stakeholders.

```bash
# SLA compliance overview
aidx "weekly SLA compliance report for all services"

# SLA breach analysis  
aidx "identify SLA violations and their business impact"

# Trend analysis for SLA metrics
aidx "SLA compliance trends over the last 3 months"
```

### Customer Experience Metrics

**Scenario**: Understanding customer experience through telemetry data.

```bash
# Customer satisfaction correlation
aidx "performance metrics vs customer satisfaction scores"

# Geographic experience comparison
aidx "user experience quality by region"

# Device and platform analysis
aidx "performance differences across devices and browsers"
```

**KQL Pattern**:
```kql
-- Customer experience quality analysis
let performance_scores = requests
| where timestamp > ago(7d)
| where name !contains "health"  // Exclude health checks
| summarize 
    avg_response = avg(duration),
    success_rate = countif(success == true) * 100.0 / count(),
    total_requests = count()
    by client_CountryOrRegion, client_Browser, client_OS;
performance_scores
| extend experience_score = case(
    avg_response <= 1000 and success_rate >= 99, "Excellent",
    avg_response <= 3000 and success_rate >= 95, "Good", 
    avg_response <= 5000 and success_rate >= 90, "Fair",
    "Poor")
| summarize 
    users_excellent = countif(experience_score == "Excellent"),
    users_good = countif(experience_score == "Good"),
    users_fair = countif(experience_score == "Fair"),
    users_poor = countif(experience_score == "Poor"),
    total_segments = count()
| extend overall_satisfaction = (users_excellent + users_good) * 100.0 / total_segments
```

## Advanced Analysis Patterns

### A/B Testing Analysis

**Scenario**: Analyzing the impact of feature flags and A/B tests.

```bash
# A/B test performance comparison
aidx "compare performance between feature flag variants"

# Statistical significance testing
aidx "A/B test results with statistical confidence"

# User behavior differences
aidx "user engagement differences between test groups"
```

**Interactive Analysis Example**:
```
> show me performance for users with feature flag enabled vs disabled

[Results showing performance comparison]

> is this difference statistically significant?

[AI analysis with confidence intervals and p-values]

> show me user engagement metrics for both groups

[Detailed engagement comparison]

> create a template for A/B test analysis

[Template creation for reusable A/B testing analysis]
```

### Cohort Analysis

**Scenario**: Understanding user retention and behavior changes over time.

```bash
# User retention cohort analysis
aidx "monthly user retention cohorts for the last year"

# Feature adoption by user cohorts
aidx "new feature adoption rates by user registration cohorts"

# Performance experience evolution
aidx "how user experience quality has changed for different user cohorts"
```

### Predictive Analytics

**Scenario**: Using historical data to predict future trends.

```bash
# Growth trend projection
aidx "project user growth based on historical trends"

# Capacity planning predictions  
aidx "predict infrastructure needs based on usage growth"

# Seasonal pattern analysis
aidx "identify seasonal usage patterns for capacity planning"
```

## KQL Learning Examples

### Bridging Natural Language to KQL

Learn KQL by seeing how natural language questions translate to queries:

#### Time-based Queries
```bash
# Natural language
aidx "show me data from last hour"
# Generates: | where timestamp > ago(1h)

aidx "group by 15-minute intervals"  
# Generates: | summarize ... by bin(timestamp, 15m)

aidx "compare this week with last week"
# Generates: Complex union with timeshift operations
```

#### Aggregation Patterns
```bash
# Natural language  
aidx "average response time by endpoint"
# Generates: | summarize avg(duration) by name

aidx "count unique users per day"
# Generates: | summarize dcount(user_Id) by bin(timestamp, 1d)

aidx "95th percentile response times"
# Generates: | summarize percentile(duration, 95)
```

#### Filtering and Conditions
```bash
# Natural language
aidx "only show errors"
# Generates: | where success == false

aidx "requests slower than 5 seconds"  
# Generates: | where duration > 5000

aidx "mobile users only"
# Generates: | where client_Type == "PC" or client_Browser contains "Mobile"
```

### KQL Best Practices Through Examples

#### Efficient Query Patterns

**Good**: Specific time ranges and early filtering
```kql
requests
| where timestamp > ago(1h)  // Early time filter
| where name contains "api"   // Early data filter
| summarize avg(duration) by name
| order by avg_duration desc
```

**Better**: Using let statements for readability
```kql
let timeRange = 1h;
let slowThreshold = 2000;
requests
| where timestamp > ago(timeRange)
| where duration > slowThreshold
| summarize 
    slow_requests = count(),
    avg_duration = avg(duration),
    max_duration = max(duration)
    by name
| order by slow_requests desc
```

#### Complex Analysis Patterns

**Join Operations**:
```bash
aidx "correlate requests with their exceptions"
# Shows how to join requests and exceptions tables

aidx "user sessions with their page views"  
# Demonstrates sessionId-based joins
```

**Window Functions**:
```bash
aidx "compare each hour's performance with previous hour"
# Generates queries using prev() and other window functions

aidx "rolling average response times"
# Shows moving average calculations
```

## Visualization Examples

### Chart Generation Use Cases

AppInsights Detective can generate ASCII charts for various data types:

```bash
# Time-series visualization
aidx "hourly request counts as a chart"

# Distribution visualization  
aidx "response time distribution"

# Ranking visualization
aidx "top 10 endpoints by request volume"
```

**Chart Output Examples**:

```
📊 Request Volume Over Time
████████████████████████████████████████████████ 1,234 (10:00)
████████████████████████████████████████████     1,156 (11:00)  
███████████████████████████████████████████████  1,289 (12:00)
███████████████████████████                        867 (13:00)
████████████████████████████████████████████████ 1,245 (14:00)

📊 Response Time Distribution  
 0-500ms   ████████████████████████████████████████ 75%
500-1000ms ████████████                              20%
1000-2000ms ██                                        3%
   >2000ms  █                                        2%
```

### Azure Portal Integration

Scenarios where Azure Portal integration provides additional value:

```bash
# Complex time-series analysis
aidx "performance trends over 30 days"
# → Better visualized in Azure Portal with interactive charts

# Geographic data analysis
aidx "user distribution by country"  
# → Portal provides map visualizations

# Complex correlation analysis
aidx "requests vs dependencies performance correlation"
# → Portal offers scatter plots and correlation charts
```

## Best Practices and Patterns

### Query Optimization Strategies

1. **Start with Time Bounds**: Always include time ranges
2. **Filter Early**: Apply filters before aggregations
3. **Limit Results**: Use `take` or `limit` for large datasets
4. **Use Templates**: Create reusable patterns for common analysis

### Effective Investigation Workflows

#### Performance Investigation
```bash
1. aidx "performance overview last 24h"        # Establish baseline
2. aidx "identify performance anomalies"       # Find issues
3. aidx "drill down into specific slow endpoints" # Deep dive
4. aidx "correlate with infrastructure metrics" # Root cause
5. aidx template create                        # Save pattern
```

#### Error Investigation
```bash
1. aidx "error rate trends over time"          # Understand scope
2. aidx "categorize errors by type"            # Classify issues  
3. aidx "identify error patterns and triggers" # Find causes
4. aidx "assess user impact of errors"         # Business impact
5. Create incident response template
```

### Team Collaboration Patterns

#### Standardized Reporting
```bash
# Create team-wide templates
aidx template create daily-ops-report
aidx template create weekly-performance-review  
aidx template create incident-investigation

# Share templates across team
cp ~/.aidx/templates/user/team-*.json /shared/team-templates/
```

#### Knowledge Sharing
```bash
# Document successful query patterns
aidx "complex analysis query" --format json --output analysis-pattern.json

# Create example-based documentation
aidx template show performance-analysis > team-wiki/performance-queries.md
```

## Integration Examples

### CI/CD Pipeline Integration

```bash
#!/bin/bash
# Performance regression detection in CI/CD

echo "Checking performance regression..."

# Compare current deployment performance with baseline
aidx "compare current hour performance with yesterday same hour" \
     --format json --output perf-comparison.json --direct

# Check if regression threshold exceeded
if [ performance_regression > 20% ]; then
    echo "Performance regression detected - failing build"
    exit 1
fi

echo "Performance check passed"
```

### Monitoring and Alerting

```bash
#!/bin/bash  
# Health check script for monitoring systems

# Check error rate
error_rate=$(aidx "current error rate percentage" --format raw --direct | grep -o '[0-9.]*%')

if [ "${error_rate%.*}" -gt 5 ]; then
    echo "CRITICAL: Error rate ${error_rate} exceeds threshold"
    exit 2
fi

echo "OK: Error rate ${error_rate} within normal range"
exit 0
```

### Business Intelligence Integration

```bash
# Daily BI data export
aidx template use business-metrics-daily \
    --param date=today \
    --format csv \
    --output /data/exports/daily-metrics-$(date +%Y-%m-%d).csv

# Weekly executive summary
aidx template use executive-summary \
    --param week=current \
    --format json \
    --output /reports/weekly-executive-$(date +%Y-W%W).json
```

## Next Steps and Advanced Usage

### Progressive Learning Path

1. **Beginner**: Start with simple natural language queries
2. **Intermediate**: Learn to use templates and interactive mode
3. **Advanced**: Create custom templates and integrate with workflows
4. **Expert**: Build team processes and automation around AppInsights Detective

### Extending Capabilities

- **Custom Templates**: Create organization-specific query libraries
- **Integration Scripts**: Automate data export and analysis workflows  
- **Dashboard Creation**: Generate queries optimized for Azure Portal dashboards
- **Alert Correlation**: Build processes connecting alerts to investigative queries

### Community and Sharing


## Azure Data Explorer (ADX) Analysis

### Getting Started with Microsoft Help Cluster

**Scenario**: Learning KQL and exploring sample datasets using Microsoft's public help cluster.

```bash
# Configure for help cluster (no authentication needed)
aidx setup
# Select: Azure Data Explorer -> Public cluster -> help.kusto.windows.net

# Explore weather data
aidx "show me the top 10 states by number of storm events"

# Analyze storm patterns
aidx "what are the most common types of weather events"

# Look at seasonal trends
aidx "show storm events by month for Texas"

# Population analysis
aidx "which states have the highest population growth"
```

**Generated KQL Examples**:
```kql
-- Top states by storm events
StormEvents
| summarize EventCount = count() by State
| order by EventCount desc
| take 10

-- Weather event types analysis
StormEvents
| summarize EventCount = count() by EventType
| order by EventCount desc

-- Seasonal patterns for Texas
StormEvents
| where State == "TEXAS"
| extend Month = format_datetime(StartTime, "yyyy-MM")
| summarize EventCount = count() by Month, EventType
| render columnchart

-- Population trends
PopulationData
| where Year >= 2000 and Year <= 2020
| summarize TotalPopulation = sum(Population) by State
| order by TotalPopulation desc
| take 15
```

### Custom ADX Cluster Analysis

**Scenario**: Analyzing your own business data in Azure Data Explorer.

```bash
# Configure your cluster
aidx setup
# Select: Azure Data Explorer -> Private cluster -> your-cluster.region.kusto.windows.net

# Business metrics analysis
aidx "show me daily revenue trends for the last month"

# User behavior analysis  
aidx "what are the most popular features used by our customers"

# Performance monitoring
aidx "show me error rates by service over time"

# Export for reporting
aidx "monthly summary report" --format json --output monthly-report.json
```

**Benefits of ADX with AppInsights Detective**:
- **Large Dataset Analysis**: Handle massive amounts of data efficiently
- **Real-time Analytics**: Query streaming data with low latency
- **Cost-Effective**: Pay only for compute used during queries
- **Schema Flexibility**: Work with diverse data structures
- **Advanced Analytics**: Leverage Kusto's powerful analytical functions

## Best Practices & Tips

### General Guidelines

- **Template Libraries**: Share successful patterns with the community
- **Query Collections**: Contribute domain-specific query examples
- **Best Practices**: Document effective investigation methodologies
- **Integration Patterns**: Share successful CI/CD and monitoring integrations

---

*This showcase provides practical examples for real-world AppInsights Detective usage. Adapt these patterns to your specific environment and requirements.*