#!/usr/bin/env ts-node
"use strict";
/**
 * Analysis Feature Demo - AppInsights Detective
 *
 * This demo showcases the Interactive Query Result Analysis feature
 * with realistic Application Insights data examples.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockQueryResults = exports.demoScenarios = void 0;
exports.runAnalysisDemo = runAnalysisDemo;
const analysisService_1 = require("../src/services/analysisService");
const aiService_1 = require("../src/services/aiService");
const authService_1 = require("../src/services/authService");
const config_1 = require("../src/utils/config");
const visualizer_1 = require("../src/utils/visualizer");
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
exports.mockQueryResults = mockQueryResults;
/**
 * Display analysis results in a formatted way
 */
function displayAnalysisResult(analysisType, result) {
    console.log(`🔍 ${analysisType.toUpperCase()} Analysis Results:`);
    console.log('-'.repeat(50));
    switch (analysisType) {
        case 'statistical':
            if (result.statistical) {
                console.log('📊 Statistical Summary:');
                console.log(`   • Total Rows: ${result.statistical.summary.totalRows}`);
                console.log(`   • Total Columns: ${result.statistical.summary.totalColumns}`);
                if (result.statistical.numerical) {
                    console.log(`   • Mean: ${result.statistical.numerical.mean}`);
                    console.log(`   • Median: ${result.statistical.numerical.median}`);
                    console.log(`   • Standard Deviation: ${result.statistical.numerical.stdDev}`);
                    console.log(`   • Outliers Detected: ${result.statistical.numerical.outliers.length}`);
                    if (result.statistical.numerical.outliers.length > 0) {
                        console.log(`     Outlier values: ${result.statistical.numerical.outliers.slice(0, 3).join(', ')}${result.statistical.numerical.outliers.length > 3 ? '...' : ''}`);
                    }
                    console.log(`   • Distribution: ${result.statistical.numerical.distribution}`);
                }
                if (result.statistical.temporal) {
                    console.log(`   • Time Range: ${result.statistical.temporal.timeRange.start} to ${result.statistical.temporal.timeRange.end}`);
                    console.log(`   • Data Points: ${result.statistical.temporal.dataPoints}`);
                    if (result.statistical.temporal.gaps.length > 0) {
                        console.log(`   • Data Gaps: ${result.statistical.temporal.gaps.length} detected`);
                    }
                }
            }
            break;
        case 'patterns':
            if (result.patterns) {
                console.log('🔍 Pattern Detection:');
                if (result.patterns.trends.length > 0) {
                    console.log('   📈 Trends:');
                    result.patterns.trends.forEach((trend, i) => {
                        console.log(`     ${i + 1}. ${trend.description} (confidence: ${Math.round(trend.confidence * 100)}%)`);
                    });
                }
                if (result.patterns.correlations.length > 0) {
                    console.log('   🔗 Correlations:');
                    result.patterns.correlations.forEach((corr, i) => {
                        console.log(`     ${i + 1}. ${corr.columns.join(' ↔ ')} (${corr.significance})`);
                    });
                }
                if (result.patterns.anomalies.length > 0) {
                    console.log('   🚨 Anomalies:');
                    result.patterns.anomalies.forEach((anomaly, i) => {
                        console.log(`     ${i + 1}. ${anomaly.description} (${anomaly.severity.toUpperCase()} severity)`);
                    });
                }
            }
            break;
        case 'anomalies':
            if (result.patterns?.anomalies.length) {
                console.log('🚨 Anomaly Detection:');
                result.patterns.anomalies.forEach((anomaly, i) => {
                    const severityIcon = anomaly.severity === 'high' ? '🔴' : anomaly.severity === 'medium' ? '🟡' : '🟢';
                    console.log(`   ${i + 1}. ${severityIcon} ${anomaly.description} (${anomaly.severity.toUpperCase()} severity)`);
                    if (anomaly.affectedRows?.length) {
                        console.log(`      Affected rows: ${anomaly.affectedRows.slice(0, 5).join(', ')}${anomaly.affectedRows.length > 5 ? '...' : ''}`);
                    }
                });
            }
            else {
                console.log('🚨 Anomaly Detection:');
                console.log('   ✅ No significant anomalies detected in the data');
            }
            break;
        case 'insights':
            if (result.insights) {
                console.log('💡 Smart Insights:');
                if (result.insights.dataQuality) {
                    console.log(`   📊 Data Quality Score: ${result.insights.dataQuality.completeness}%`);
                    if (result.insights.dataQuality.consistency.length > 0) {
                        console.log('   ⚠️  Consistency Issues:');
                        result.insights.dataQuality.consistency.forEach(issue => {
                            console.log(`     • ${issue}`);
                        });
                    }
                    if (result.insights.dataQuality.recommendations.length > 0) {
                        console.log('   💡 Recommendations:');
                        result.insights.dataQuality.recommendations.forEach(rec => {
                            console.log(`     • ${rec}`);
                        });
                    }
                }
                if (result.insights.aiInsights) {
                    console.log('   🤖 AI-Generated Insights:');
                    // Split AI insights into lines for better formatting
                    result.insights.aiInsights.split('\n').forEach(line => {
                        if (line.trim()) {
                            console.log(`     ${line.trim()}`);
                        }
                    });
                }
                if (result.insights.followUpQueries.length > 0) {
                    console.log('   🔄 Suggested Follow-up Queries:');
                    result.insights.followUpQueries.forEach((query, i) => {
                        console.log(`     ${i + 1}. ${query}`);
                    });
                }
            }
            break;
        case 'full':
            console.log('📋 Full Analysis Report:');
            console.log('   Comprehensive analysis combining all aspects:');
            displayAnalysisResult('statistical', result);
            console.log('');
            displayAnalysisResult('patterns', result);
            console.log('');
            displayAnalysisResult('insights', result);
            break;
    }
}
const demoScenarios = [
    {
        title: '🚨 Error Analysis Demo',
        description: 'Analyzing application errors and exceptions',
        originalQuery: 'exceptions | where timestamp > ago(1h) | summarize count() by operation_Name, severityLevel',
        data: mockQueryResults.errorAnalysis,
        analysisTypes: ['statistical', 'patterns', 'anomalies', 'insights', 'full']
    },
    {
        title: '⚡ Performance Analysis Demo',
        description: 'Analyzing request performance and response times',
        originalQuery: 'requests | where timestamp > ago(1h) | project timestamp, name, duration, responseCode, success',
        data: mockQueryResults.performanceAnalysis,
        analysisTypes: ['statistical', 'anomalies', 'insights']
    },
    {
        title: '📈 Traffic Analysis Demo',
        description: 'Analyzing page views and user traffic patterns',
        originalQuery: 'pageViews | where timestamp > ago(4h) | summarize count = sum(itemCount) by name, bin(timestamp, 15m)',
        data: mockQueryResults.trafficAnalysis,
        analysisTypes: ['statistical', 'patterns', 'full']
    }
];
exports.demoScenarios = demoScenarios;
/**
 * Run the analysis feature demo
 */
async function runAnalysisDemo() {
    console.log('🎬 AppInsights Detective - Analysis Feature Demo\n');
    console.log('This demo showcases the Interactive Query Result Analysis feature');
    console.log('with realistic Application Insights data.\n');
    // Initialize services - these will make real API calls to OpenAI
    const configManager = new config_1.ConfigManager();
    const authService = new authService_1.AuthService();
    const aiService = new aiService_1.AIService(authService, configManager);
    const analysisService = new analysisService_1.AnalysisService(aiService, configManager);
    console.log('🔧 Initializing services...');
    console.log('📝 Note: This demo will make real calls to Azure OpenAI for analysis\n');
    for (const scenario of demoScenarios) {
        console.log('='.repeat(60));
        console.log(scenario.title);
        console.log(scenario.description);
        console.log('='.repeat(60));
        console.log(`\n📋 Query: ${scenario.originalQuery}\n`);
        // Display sample data
        visualizer_1.Visualizer.displayResult(scenario.data);
        console.log('\n🧠 Analysis Results:\n');
        // Run each analysis type for this scenario
        for (const analysisType of scenario.analysisTypes) {
            try {
                console.log(`\n🔍 Running ${analysisType.toUpperCase()} Analysis...`);
                console.log('-'.repeat(50));
                // Actually call the analysis service with real AI
                const analysisResult = await analysisService.analyzeQueryResult(scenario.data, scenario.originalQuery, analysisType, { language: 'auto' } // Let AI auto-detect or use English
                );
                // Display the real analysis results
                displayAnalysisResult(analysisType, analysisResult);
            }
            catch (error) {
                console.log(`❌ Analysis failed: ${error}`);
                console.log('This might happen if Azure OpenAI is not configured or available.');
                // Show what the analysis would look like structurally
                console.log('\n📋 Expected Analysis Structure:');
                switch (analysisType) {
                    case 'statistical':
                        console.log('   📊 Statistical summary with means, medians, outliers');
                        break;
                    case 'patterns':
                        console.log('   🔍 AI-detected trends, correlations, and patterns');
                        break;
                    case 'anomalies':
                        console.log('   🚨 AI-identified anomalies with severity ratings');
                        break;
                    case 'insights':
                        console.log('   💡 Business insights and actionable recommendations');
                        break;
                    case 'full':
                        console.log('   📋 Comprehensive report combining all analysis types');
                        break;
                }
            }
            console.log(''); // Add spacing
        }
        console.log('\n✅ Scenario analysis completed!\n');
    }
    console.log('🎉 Demo completed successfully!');
    console.log('\nThis demonstration showed how the Interactive Query Result Analysis');
    console.log('feature provides intelligent insights on Application Insights data using real AI analysis.');
    console.log('\nTo use this feature in the real application:');
    console.log('1. Run a query in interactive mode');
    console.log('2. Choose "Yes" when prompted for analysis');
    console.log('3. Select your preferred analysis type and language');
    console.log('4. Review the AI-generated insights and follow-up queries');
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
//# sourceMappingURL=analysis-feature-demo.js.map