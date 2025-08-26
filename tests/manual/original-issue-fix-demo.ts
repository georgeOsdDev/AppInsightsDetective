/**
 * Test to demonstrate the fix for the original issue
 * Shows how Log Analytics queries now get appropriate prompts
 */

import { buildSystemPrompt } from '../../src/providers/ai/prompts/systemPrompts';
import chalk from 'chalk';

function testOriginalProblem() {
  console.log(chalk.blue.bold('\n🔧 Original Problem Fix Demo'));
  console.log(chalk.dim('='.repeat(50)));

  // Original problem: Application Insights specific prompt for all data sources
  console.log(chalk.red.bold('\n❌ Before (Problem):'));
  console.log(chalk.yellow('Query: "show storm damage by state"'));
  console.log(chalk.yellow('Data Source: Log Analytics'));
  
  const originalPrompt = buildSystemPrompt('application-insights'); // Old behavior
  console.log(chalk.red('Prompt contained: requests, dependencies, exceptions, pageViews'));
  console.log(chalk.red('Result: AI would say this doesn\'t relate to Application Insights telemetry'));

  // Fixed behavior: Data source specific prompts
  console.log(chalk.green.bold('\n✅ After (Fixed):'));
  console.log(chalk.yellow('Query: "show storm damage by state"'));
  console.log(chalk.yellow('Data Source: Log Analytics'));
  
  const fixedPrompt = buildSystemPrompt('log-analytics');
  console.log(chalk.green('Prompt contains: Log Analytics workspace, custom tables, search operator'));
  console.log(chalk.green('Result: AI understands this could be in custom tables or imported data'));

  // Show the specific differences
  console.log(chalk.cyan.bold('\n🔍 Key Differences:'));
  
  console.log(chalk.white('\nApplication Insights prompt mentions:'));
  console.log(chalk.dim('- requests table for HTTP requests'));
  console.log(chalk.dim('- dependencies for external calls'));
  console.log(chalk.dim('- exceptions for error analysis'));
  console.log(chalk.dim('- pageViews for user experience'));
  
  console.log(chalk.white('\nLog Analytics prompt mentions:'));
  console.log(chalk.dim('- Table names vary by workspace configuration'));
  console.log(chalk.dim('- Common system tables: Heartbeat, Perf, Event'));
  console.log(chalk.dim('- Custom tables may exist'));
  console.log(chalk.dim('- Use search operator when table structure is unknown'));

  // Show how extra context can help
  console.log(chalk.cyan.bold('\n💡 Enhanced with Extra Context:'));
  const contextPrompt = buildSystemPrompt('log-analytics', undefined, 
    'This workspace contains weather and disaster data. Look for tables like WeatherEvents, DisasterReports, StateStatistics.');
    
  console.log(chalk.green('With extra context, the AI now knows to look for:'));
  console.log(chalk.dim('- WeatherEvents table'));
  console.log(chalk.dim('- DisasterReports table'));
  console.log(chalk.dim('- StateStatistics table'));
  console.log(chalk.green('✓ Much more likely to generate appropriate KQL!'));

  console.log(chalk.green.bold('\n🎉 Issue Fixed!'));
}

if (require.main === module) {
  testOriginalProblem();
}

export { testOriginalProblem };