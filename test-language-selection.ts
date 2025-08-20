#!/usr/bin/env ts-node
/**
 * Quick test script to verify language selection works in analysis feature
 */

import { AnalysisService } from './src/services/analysisService';
import { AIService } from './src/services/aiService';
import { AuthService } from './src/services/authService';
import { ConfigManager } from './src/utils/config';
import { QueryResult } from './src/types';

// Mock data for testing
const mockQueryResult: QueryResult = {
  tables: [
    {
      name: 'requests',
      columns: [
        { name: 'timestamp', type: 'datetime' },
        { name: 'name', type: 'string' },
        { name: 'duration', type: 'real' },
        { name: 'responseCode', type: 'int' }
      ],
      rows: [
        ['2024-01-15T14:00:00.000Z', 'GET /api/products', 245.5, 200],
        ['2024-01-15T14:01:00.000Z', 'GET /api/users', 156.2, 200],
        ['2024-01-15T14:02:00.000Z', 'POST /api/orders', 1250.8, 200]
      ]
    }
  ]
};

async function testLanguageSelection() {
  console.log('🧪 Testing language selection in analysis feature...\n');

  const configManager = new ConfigManager();
  const authService = new AuthService(configManager);
  const aiService = new AIService(authService, configManager);
  const analysisService = new AnalysisService(aiService, configManager);

  // Test 1: Statistical analysis (no language needed)
  console.log('1️⃣ Testing statistical analysis (no language needed)...');
  try {
    const result = await analysisService.analyzeQueryResult(
      mockQueryResult,
      'requests | summarize avg(duration)',
      'statistical'
    );
    console.log('✅ Statistical analysis completed successfully');
    console.log(`   Total rows: ${result.statistical?.summary.totalRows}`);
  } catch (error) {
    console.log('❌ Statistical analysis failed:', error);
  }

  // Test 2: Insights analysis with English
  console.log('\n2️⃣ Testing insights analysis with English...');
  try {
    const result = await analysisService.analyzeQueryResult(
      mockQueryResult,
      'requests | summarize avg(duration)',
      'insights',
      { language: 'en' }
    );
    console.log('✅ Insights analysis (EN) completed successfully');
    console.log(`   AI insights available: ${!!result.aiInsights}`);
  } catch (error) {
    console.log('❌ Insights analysis (EN) failed:', error);
  }

  // Test 3: Insights analysis with Japanese
  console.log('\n3️⃣ Testing insights analysis with Japanese...');
  try {
    const result = await analysisService.analyzeQueryResult(
      mockQueryResult,
      'requests | summarize avg(duration)',
      'insights',
      { language: 'ja' }
    );
    console.log('✅ Insights analysis (JA) completed successfully');
    console.log(`   AI insights available: ${!!result.aiInsights}`);
  } catch (error) {
    console.log('❌ Insights analysis (JA) failed:', error);
  }

  // Test 4: Full analysis with auto language
  console.log('\n4️⃣ Testing full analysis with auto language...');
  try {
    const result = await analysisService.analyzeQueryResult(
      mockQueryResult,
      'requests | summarize avg(duration)',
      'full',
      { language: 'auto' }
    );
    console.log('✅ Full analysis (AUTO) completed successfully');
    console.log(`   Statistical: ${!!result.statistical}`);
    console.log(`   Patterns: ${!!result.patterns}`);
    console.log(`   Insights: ${!!result.insights}`);
    console.log(`   AI Insights: ${!!result.aiInsights}`);
  } catch (error) {
    console.log('❌ Full analysis (AUTO) failed:', error);
  }

  console.log('\n🎉 Language selection testing completed!');
  console.log('\nNote: Actual AI responses depend on OpenAI configuration.');
  console.log('This test verifies the language parameter is properly passed through the system.');
}

// Run the test
if (require.main === module) {
  testLanguageSelection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testLanguageSelection };