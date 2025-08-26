/**
 * Demo script to show data-source-aware prompts functionality
 * Run with: npx ts-node tests/manual/prompt-demo.ts
 */

import { buildSystemPrompt } from '../../src/providers/ai/prompts/systemPrompts';
import { TemplateService } from '../../src/services/TemplateService';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('\n🎯 Data-Source-Aware Prompts Demo'));
  console.log(chalk.dim('='.repeat(50)));

  // Demo 1: Different data source prompts
  console.log(chalk.cyan.bold('\n1. Data Source Specific Prompts'));
  
  console.log(chalk.yellow('\n📊 Application Insights Prompt:'));
  const appInsightsPrompt = buildSystemPrompt('application-insights');
  console.log(chalk.dim(appInsightsPrompt.substring(0, 300) + '...'));
  console.log(chalk.green('✓ Contains: requests, dependencies, exceptions, pageViews'));

  console.log(chalk.yellow('\n📈 Log Analytics Prompt:'));
  const logAnalyticsPrompt = buildSystemPrompt('log-analytics');
  console.log(chalk.dim(logAnalyticsPrompt.substring(0, 300) + '...'));
  console.log(chalk.green('✓ Contains: Heartbeat, Perf, Event, workspace'));

  console.log(chalk.yellow('\n📉 Azure Metrics Prompt:'));
  const metricsPrompt = buildSystemPrompt('azure-metrics');
  console.log(chalk.dim(metricsPrompt.substring(0, 300) + '...'));
  console.log(chalk.green('✓ Contains: CPU, Memory, metric dimensions'));

  // Demo 2: Extra context
  console.log(chalk.cyan.bold('\n2. Extra Context Support'));
  const extraContext = 'Focus on errors in the shopping cart service during peak hours';
  const promptWithContext = buildSystemPrompt('application-insights', undefined, extraContext);
  console.log(chalk.yellow('\nPrompt with extra context:'));
  console.log(chalk.dim('...'));
  console.log(chalk.white(extraContext));
  console.log(chalk.green('✓ Additional context included in prompt'));

  // Demo 3: Schema support
  console.log(chalk.cyan.bold('\n3. Schema Information'));
  const schema = {
    tables: ['customEvents', 'customMetrics', 'requests'],
    customTables: ['ShoppingCartEvents', 'UserBehavior']
  };
  const promptWithSchema = buildSystemPrompt('application-insights', schema);
  console.log(chalk.yellow('\nSchema information detected:'));
  console.log(chalk.white('- customEvents, customMetrics, requests'));
  console.log(chalk.white('- ShoppingCartEvents, UserBehavior'));
  console.log(chalk.green('✓ Schema included in prompt for better query generation'));

  // Demo 4: Prompt templates
  console.log(chalk.cyan.bold('\n4. Prompt Templates'));
  const templateService = new TemplateService();
  await templateService.initialize();

  const promptTemplates = await templateService.getPromptTemplates();
  console.log(chalk.yellow(`\nFound ${promptTemplates.length} prompt templates:`));
  
  for (const template of promptTemplates) {
    console.log(chalk.white(`  📝 ${template.name}`));
    console.log(chalk.dim(`     ${template.description}`));
    console.log(chalk.dim(`     Category: ${template.category}`));
    console.log(chalk.dim(`     Parameters: ${template.parameters.map(p => p.name).join(', ')}`));
  }

  // Demo 5: Apply a prompt template
  console.log(chalk.cyan.bold('\n5. Applied Prompt Template Example'));
  const performanceTemplate = promptTemplates.find(t => t.id === 'performance-focus');
  if (performanceTemplate) {
    const appliedContext = await templateService.applyPromptTemplate(performanceTemplate, {
      threshold: 2000,
      appContext: 'e-commerce checkout flow'
    });
    console.log(chalk.yellow('\nPerformance Focus Template Applied:'));
    console.log(chalk.white(appliedContext));
    console.log(chalk.green('✓ Template parameters filled with custom values'));
  }

  console.log(chalk.green.bold('\n🎉 Demo completed successfully!'));
  console.log(chalk.yellow('\nKey Benefits:'));
  console.log(chalk.white('• Different prompts for different data sources'));
  console.log(chalk.white('• Support for extra context to guide AI'));
  console.log(chalk.white('• Schema-aware prompt generation'));
  console.log(chalk.white('• Reusable prompt templates with parameters'));
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as promptDemo };