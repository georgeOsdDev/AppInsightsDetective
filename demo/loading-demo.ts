#!/usr/bin/env node

// Simple demo script to demonstrate loading indicators
import { withLoadingIndicator } from '../src/utils/loadingIndicator';
import chalk from 'chalk';

async function demoLoadingIndicator() {
  console.log(chalk.blue.bold('\n🔍 AppInsights Detective - Loading Indicator Demo\n'));

  // Simulate AI query generation
  await withLoadingIndicator(
    'Generating KQL query with AI...',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return 'requests | where timestamp > ago(1h) | count';
    },
    {
      successMessage: 'KQL query generated successfully',
      errorMessage: 'Failed to generate KQL query'
    }
  );

  console.log('');

  // Simulate Application Insights query execution
  await withLoadingIndicator(
    'Executing query on Application Insights...',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { tables: [{ rows: [[42]] }] };
    },
    {
      successMessage: 'Query executed successfully',
      errorMessage: 'Failed to execute query',
      spinnerType: 'arrow3'
    }
  );

  console.log('');

  // Simulate external execution
  await withLoadingIndicator(
    'Opening query in Azure Portal...',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    },
    {
      successMessage: 'Successfully opened query in Azure Portal',
      errorMessage: 'Failed to open query in Azure Portal',
      spinnerType: 'line'
    }
  );

  console.log(chalk.green.bold('\n✅ Demo completed successfully!\n'));
}

// Run the demo
demoLoadingIndicator().catch(console.error);