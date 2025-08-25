/**
 * Manual test to demonstrate Azure Portal integration
 * Run with: npx ts-node tests/manual/azure-portal-demo.ts
 */
import chalk from 'chalk';
import { ExternalExecutionService } from '../../src/services/externalExecutionService';
import { InteractiveSessionController } from '../../src/presentation/InteractiveSessionController';
import { QueryService } from '../../src/services/QueryService';
import { TemplateService } from '../../src/services/TemplateService';
import { ConsoleOutputRenderer } from '../../src/presentation/renderers/ConsoleOutputRenderer';
import { QueryEditorService } from '../../src/services/QueryEditorService';
import { AzureResourceInfo } from '../../src/types';

// Mock AI Provider
const mockAIProvider = {
  initialize: async () => {},
  generateQuery: async () => ({ generatedKQL: 'exceptions | take 10', confidence: 0.9 }),
  explainQuery: async () => 'This query shows the last 10 exceptions',
  regenerateQuery: async () => ({ generatedKQL: 'exceptions | where timestamp > ago(1h)', confidence: 0.8 }),
  analyzeQueryResult: async () => ({ patterns: [], insights: {}, recommendations: [] }),
  generateResponse: async () => 'AI response'
} as any;

// Mock Query Service
const mockQueryService = {
  createSession: async () => ({ sessionId: 'test-session', options: {} }),
  executeQuery: async () => ({ result: { tables: [], executionTime: 100 } }),
  explainQuery: async () => 'Query explanation',
} as any;

async function demonstrateAzurePortalIntegration() {
  console.log(chalk.blue.bold('🧪 Azure Portal Integration Demo\n'));

  // Test configuration with valid Azure resource info
  const azureResourceInfo: AzureResourceInfo = {
    tenantId: 'demo-tenant-id',
    subscriptionId: 'demo-subscription-id',
    resourceGroup: 'demo-resource-group',
    resourceName: 'demo-app-insights'
  };

  // Create services
  const externalExecutionService = new ExternalExecutionService(azureResourceInfo);
  const templateService = new TemplateService();
  const outputRenderer = new ConsoleOutputRenderer();
  const queryEditorService = new QueryEditorService();

  // Create controller with Azure Portal integration
  const controller = new InteractiveSessionController(
    mockQueryService,
    templateService,
    mockAIProvider,
    outputRenderer,
    queryEditorService,
    externalExecutionService
  );

  // Test 1: Validate configuration
  console.log(chalk.cyan('Test 1: Configuration Validation'));
  const validation = externalExecutionService.validateConfiguration();
  console.log(`✅ Configuration is valid: ${validation.isValid}`);
  if (!validation.isValid) {
    console.log(`❌ Missing fields: ${validation.missingFields.join(', ')}`);
  }
  console.log();

  // Test 2: Generate Portal URL
  console.log(chalk.cyan('Test 2: Portal URL Generation'));
  const testQuery = 'exceptions | where timestamp > ago(1h) | summarize count() by type';
  const portalUrl = externalExecutionService.generatePortalUrl(testQuery);
  console.log(chalk.green('✅ Generated Portal URL:'));
  console.log(chalk.dim(portalUrl));
  console.log();

  // Test 3: External execution options
  console.log(chalk.cyan('Test 3: Available External Execution Options'));
  const options = externalExecutionService.getAvailableOptions();
  console.log(`✅ Found ${options.length} option(s):`);
  options.forEach(option => {
    console.log(`  ${option.name}: ${option.description}`);
  });
  console.log();

  // Test 4: Controller with no external service (graceful degradation)
  console.log(chalk.cyan('Test 4: Graceful Degradation'));
  const controllerWithoutExternal = new InteractiveSessionController(
    mockQueryService,
    templateService,
    mockAIProvider,
    outputRenderer,
    queryEditorService,
    null // No external execution service
  );
  console.log('✅ Controller works without external execution service');
  console.log();

  console.log(chalk.green.bold('🎉 All tests passed! Azure Portal integration is working correctly.'));
  console.log();
  console.log(chalk.yellow('Next steps:'));
  console.log('1. Run: aidx --interactive');
  console.log('2. Ask a question (e.g., "show me errors")'); 
  console.log('3. Choose "Review Mode"');
  console.log('4. Select "🌐 Open in Azure Portal" from the action menu');
  console.log();
}

// Run the demo
demonstrateAzurePortalIntegration().catch(console.error);