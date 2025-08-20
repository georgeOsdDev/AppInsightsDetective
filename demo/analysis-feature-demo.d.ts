#!/usr/bin/env ts-node
/**
 * Analysis Feature Demo - AppInsights Detective
 *
 * This demo showcases the Interactive Query Result Analysis feature
 * with realistic Application Insights data examples.
 */
import { AnalysisType } from '../src/types';
/**
 * Mock query results with realistic Application Insights data
 */
declare const mockQueryResults: {
    errorAnalysis: {
        tables: {
            name: string;
            columns: {
                name: string;
                type: string;
            }[];
            rows: (string | number)[][];
        }[];
    };
    performanceAnalysis: {
        tables: {
            name: string;
            columns: {
                name: string;
                type: string;
            }[];
            rows: (string | number | boolean)[][];
        }[];
    };
    trafficAnalysis: {
        tables: {
            name: string;
            columns: {
                name: string;
                type: string;
            }[];
            rows: (string | number)[][];
        }[];
    };
};
declare const demoScenarios: {
    title: string;
    description: string;
    originalQuery: string;
    data: {
        tables: {
            name: string;
            columns: {
                name: string;
                type: string;
            }[];
            rows: (string | number | boolean)[][];
        }[];
    };
    analysisTypes: AnalysisType[];
}[];
/**
 * Run the analysis feature demo
 */
declare function runAnalysisDemo(): Promise<void>;
export { runAnalysisDemo, demoScenarios, mockQueryResults };
//# sourceMappingURL=analysis-feature-demo.d.ts.map