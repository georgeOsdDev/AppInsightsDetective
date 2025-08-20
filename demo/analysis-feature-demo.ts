#!/usr/bin/env ts-node
/**
 * Analysis Feature Demo - AppInsights Detective
 * 
 * This demo showcases the Interactive Query Result Analysis feature
 * with realistic Application Insights data examples.
 */

import { AnalysisService } from '../src/services/analysisService';
import { AIService } from '../src/services/aiService';
import { AuthService } from '../src/services/authService';
import { ConfigManager } from '../src/utils/config';
import { Visualizer } from '../src/utils/visualizer';
import { QueryResult, AnalysisType } from '../src/types';

/**
 * Mock query results with realistic Application Insights data
 */
const mockQueryResults = {
  errorAnalysis: {
    tables: [
      {
        name: 'exceptions',
        columns: [
          { name: 'timestamp', type: 'datetime' },
          { name: 'operation_Name', type: 'string' },
          { name: 'severityLevel', type: 'int' },
          { name: 'outerMessage', type: 'string' },
          { name: 'count', type: 'long' }
        ],
        rows: [
          ['2024-01-15T14:23:45.123Z', 'GET /api/users', 3, 'Database timeout', 15],
          ['2024-01-15T14:25:12.456Z', 'POST /api/orders', 4, 'Payment service unavailable', 8],
          ['2024-01-15T14:27:33.789Z', 'GET /api/products', 2, 'Cache miss', 42],
          ['2024-01-15T15:15:00.000Z', 'GET /api/users', 3, 'Database timeout', 25],
          ['2024-01-15T15:45:21.111Z', 'POST /api/orders', 4, 'Payment service unavailable', 12]
        ]
      }
    ]
  },

  performanceAnalysis: {
    tables: [
      {
        name: 'requests',
        columns: [
          { name: 'timestamp', type: 'datetime' },
          { name: 'name', type: 'string' },
          { name: 'duration', type: 'real' },
          { name: 'responseCode', type: 'int' },
          { name: 'success', type: 'bool' }
        ],
        rows: [
          ['2024-01-15T14:00:00.000Z', 'GET /api/products', 245.5, 200, true],
          ['2024-01-15T14:01:00.000Z', 'GET /api/users', 156.2, 200, true],
          ['2024-01-15T14:02:00.000Z', 'POST /api/orders', 1250.8, 200, true],
          ['2024-01-15T14:03:00.000Z', 'GET /api/products', 189.3, 200, true],
          ['2024-01-15T14:04:00.000Z', 'GET /api/users', 2150.4, 500, false],
          ['2024-01-15T14:05:00.000Z', 'POST /api/orders', 892.1, 200, true],
          ['2024-01-15T14:06:00.000Z', 'GET /api/products', 167.9, 200, true],
          ['2024-01-15T14:07:00.000Z', 'GET /api/users', 3456.2, 500, false]
        ]
      }
    ]
  },

  trafficAnalysis: {
    tables: [
      {
        name: 'pageViews',
        columns: [
          { name: 'timestamp', type: 'datetime' },
          { name: 'name', type: 'string' },
          { name: 'url', type: 'string' },
          { name: 'duration', type: 'real' },
          { name: 'itemCount', type: 'long' }
        ],
        rows: [
          ['2024-01-15T13:00:00.000Z', 'Home Page', '/home', 2.1, 1250],
          ['2024-01-15T13:15:00.000Z', 'Product Page', '/products', 3.2, 890],
          ['2024-01-15T13:30:00.000Z', 'User Profile', '/profile', 1.8, 456],
          ['2024-01-15T13:45:00.000Z', 'Home Page', '/home', 2.3, 1456],
          ['2024-01-15T14:00:00.000Z', 'Product Page', '/products', 4.1, 1123],
          ['2024-01-15T14:15:00.000Z', 'Home Page', '/home', 2.0, 6789],
          ['2024-01-15T14:30:00.000Z', 'User Profile', '/profile', 1.9, 234]
        ]
      }
    ]
  }
};

/**
 * Demo scenarios with their corresponding queries and expected insights
 */
const demoScenarios = [
  {
    title: '🚨 Error Analysis Demo',
    description: 'Analyzing application errors and exceptions',
    originalQuery: 'exceptions | where timestamp > ago(1h) | summarize count() by operation_Name, severityLevel',
    data: mockQueryResults.errorAnalysis,
    analysisTypes: ['statistical', 'patterns', 'anomalies', 'insights', 'full'] as AnalysisType[]
  },
  {
    title: '⚡ Performance Analysis Demo', 
    description: 'Analyzing request performance and response times',
    originalQuery: 'requests | where timestamp > ago(1h) | project timestamp, name, duration, responseCode, success',
    data: mockQueryResults.performanceAnalysis,
    analysisTypes: ['statistical', 'anomalies', 'insights'] as AnalysisType[]
  },
  {
    title: '📈 Traffic Analysis Demo',
    description: 'Analyzing page views and user traffic patterns',
    originalQuery: 'pageViews | where timestamp > ago(4h) | summarize count = sum(itemCount) by name, bin(timestamp, 15m)',
    data: mockQueryResults.trafficAnalysis,
    analysisTypes: ['statistical', 'patterns', 'full'] as AnalysisType[]
  }
];

/**
 * Run the analysis feature demo
 */
async function runAnalysisDemo() {
  console.log('🎬 AppInsights Detective - Analysis Feature Demo\n');
  console.log('This demo showcases the Interactive Query Result Analysis feature');
  console.log('with realistic Application Insights data.\n');

  // Initialize services (using mock implementations for demo)
  const configManager = new ConfigManager();
  const authService = new AuthService();
  const aiService = new AIService(authService, configManager);
  const analysisService = new AnalysisService(aiService, configManager);

  for (const scenario of demoScenarios) {
    console.log('='.repeat(60));
    console.log(scenario.title);
    console.log(scenario.description);
    console.log('='.repeat(60));
    console.log(`\n📋 Query: ${scenario.originalQuery}\n`);

    // Display sample data
    Visualizer.displayResult(scenario.data);

    console.log('\n🧠 Analysis Results:\n');

    // Run each analysis type for this scenario
    for (const analysisType of scenario.analysisTypes) {
      try {
        console.log(`\n🔍 Running ${analysisType.toUpperCase()} Analysis...`);
        console.log('-'.repeat(40));

        // Note: In a real demo, this would call the actual analysis service
        // For this demo, we'll show the structure and expected output
        console.log(`This would perform ${analysisType} analysis on the data:`);
        
        switch (analysisType) {
          case 'statistical':
            console.log('📊 Statistical Summary:');
            console.log('   • Total Rows: ' + scenario.data.tables[0].rows.length);
            console.log('   • Columns Analyzed: ' + scenario.data.tables[0].columns.length);
            console.log('   • Data Quality Score: 95%');
            break;

          case 'patterns':
            console.log('🔍 Pattern Detection:');
            console.log('   • Temporal trends identified');
            console.log('   • Correlation analysis completed');
            console.log('   • Seasonal patterns detected');
            break;

          case 'anomalies':
            console.log('🚨 Anomaly Detection:');
            console.log('   • 2 outliers detected (HIGH severity)');
            console.log('   • Performance spikes identified');
            console.log('   • Unusual error patterns found');
            break;

          case 'insights':
            console.log('💡 Smart Insights:');
            console.log('   • Key performance bottlenecks identified');
            console.log('   • Actionable recommendations generated');
            console.log('   • Business impact assessment provided');
            break;

          case 'full':
            console.log('📋 Full Analysis Report:');
            console.log('   • Complete statistical analysis');
            console.log('   • Pattern and anomaly detection');
            console.log('   • Business insights and recommendations');
            console.log('   • Suggested follow-up queries');
            break;
        }

        // Simulate follow-up queries
        if (analysisType !== 'statistical') {
          console.log('\n🔄 Suggested Follow-up Queries:');
          console.log('   1. 🔴 Investigate slow requests (HIGH priority)');
          console.log('      Query: requests | where duration > 1000');
          console.log('   2. 🟡 Analyze error patterns (MEDIUM priority)');
          console.log('      Query: exceptions | summarize count() by bin(timestamp, 1h)');
        }

      } catch (error) {
        console.log(`❌ Analysis failed: ${error}`);
      }

      console.log(''); // Add spacing
    }

    console.log('\n✅ Scenario analysis completed!\n');
  }

  console.log('🎉 Demo completed successfully!');
  console.log('\nThis demonstration shows how the Interactive Query Result Analysis');
  console.log('feature provides intelligent insights on Application Insights data.');
  console.log('\nTo use this feature in the real application:');
  console.log('1. Run a query in interactive mode');
  console.log('2. Choose "Yes" when prompted for analysis');
  console.log('3. Select your preferred analysis type');
  console.log('4. Review the insights and follow-up queries');
  console.log('5. Execute suggested queries directly from the interface');
}

/**
 * Entry point - check if running directly
 */
if (require.main === module) {
  runAnalysisDemo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

export { runAnalysisDemo, demoScenarios, mockQueryResults };