import { AIService } from './aiService';
import { ConfigManager } from '../utils/config';
import { 
  QueryResult, 
  QueryColumn,
  AnalysisType, 
  AnalysisResult, 
  StatisticalAnalysis, 
  PatternAnalysis, 
  ContextualInsights 
} from '../types';
import { logger } from '../utils/logger';

export class AnalysisService {
  constructor(
    private aiService: AIService,
    private configManager: ConfigManager
  ) {}

  /**
   * Analyze query result with specified analysis type
   */
  async analyzeQueryResult(
    result: QueryResult, 
    originalQuery: string,
    analysisType: AnalysisType
  ): Promise<AnalysisResult> {
    try {
      logger.info(`Starting ${analysisType} analysis of query result`);
      
      const analysis: AnalysisResult = {};

      switch (analysisType) {
        case 'statistical':
          analysis.statistical = this.performStatisticalAnalysis(result);
          break;
          
        case 'patterns':
          analysis.patterns = await this.performPatternAnalysis(result, originalQuery);
          break;
          
        case 'anomalies':
          analysis.patterns = await this.performPatternAnalysis(result, originalQuery);
          // Filter to focus on anomalies
          if (analysis.patterns) {
            analysis.patterns.trends = [];
            analysis.patterns.correlations = [];
          }
          break;
          
        case 'insights':
          analysis.insights = await this.generateContextualInsights(result, originalQuery);
          analysis.aiInsights = await this.generateAIInsights(result, originalQuery);
          break;
          
        case 'full':
          analysis.statistical = this.performStatisticalAnalysis(result);
          analysis.patterns = await this.performPatternAnalysis(result, originalQuery);
          analysis.insights = await this.generateContextualInsights(result, originalQuery);
          analysis.aiInsights = await this.generateAIInsights(result, originalQuery);
          break;
      }

      // Always generate recommendations and follow-up queries for non-statistical analysis
      if (analysisType !== 'statistical') {
        analysis.recommendations = await this.generateRecommendations(result, originalQuery);
        analysis.followUpQueries = await this.generateFollowUpQueries(result, originalQuery);
      }

      logger.info(`${analysisType} analysis completed successfully`);
      return analysis;
      
    } catch (error) {
      logger.error('Analysis failed:', error);
      throw new Error(`Analysis failed: ${error}`);
    }
  }

  /**
   * Perform statistical analysis on the query result
   */
  private performStatisticalAnalysis(result: QueryResult): StatisticalAnalysis {
    if (!result.tables.length) {
      return {
        summary: { totalRows: 0, uniqueValues: {}, nullPercentage: {} },
        numerical: null,
        temporal: null
      };
    }

    const firstTable = result.tables[0];
    const totalRows = firstTable.rows.length;
    
    // Calculate unique values and null percentages
    const uniqueValues: Record<string, number> = {};
    const nullPercentage: Record<string, number> = {};
    
    firstTable.columns.forEach((col, index) => {
      const values = firstTable.rows.map(row => row[index]);
      const nonNullValues = values.filter(v => v !== null && v !== undefined);
      const unique = new Set(nonNullValues);
      
      uniqueValues[col.name] = unique.size;
      nullPercentage[col.name] = ((totalRows - nonNullValues.length) / totalRows) * 100;
    });

    // Numerical analysis for numeric columns
    let numerical: StatisticalAnalysis['numerical'] = null;
    const numericColumn = this.findNumericColumn(firstTable.columns, firstTable.rows);
    
    if (numericColumn) {
      const values = firstTable.rows
        .map(row => row[numericColumn.index])
        .filter(v => typeof v === 'number' && !isNaN(v)) as number[];
        
      if (values.length > 0) {
        const sorted = values.slice().sort((a, b) => a - b);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        // Simple outlier detection (values beyond 2 standard deviations)
        const outliers = values.filter(v => Math.abs(v - mean) > 2 * stdDev);
        
        // Simple distribution classification
        const skewness = this.calculateSkewness(values, mean, stdDev);
        let distribution: 'normal' | 'skewed' | 'uniform' | 'unknown' = 'unknown';
        
        if (Math.abs(skewness) < 0.5) {
          distribution = 'normal';
        } else if (Math.abs(skewness) < 1) {
          distribution = 'skewed';
        } else {
          const range = Math.max(...values) - Math.min(...values);
          if (stdDev / range < 0.3) {
            distribution = 'uniform';
          } else {
            distribution = 'skewed';
          }
        }
        
        numerical = {
          mean: Number(mean.toFixed(2)),
          median: Number(median.toFixed(2)),
          stdDev: Number(stdDev.toFixed(2)),
          outliers: outliers.slice(0, 10), // Limit to 10 outliers
          distribution
        };
      }
    }

    // Temporal analysis for datetime columns
    let temporal: StatisticalAnalysis['temporal'] = null;
    const dateColumn = this.findDateTimeColumn(firstTable.columns, firstTable.rows);
    
    if (dateColumn) {
      const dates = firstTable.rows
        .map(row => this.parseDate(row[dateColumn.index]))
        .filter(d => d !== null) as Date[];
        
      if (dates.length > 0) {
        dates.sort((a, b) => a.getTime() - b.getTime());
        const timeRange = { start: dates[0], end: dates[dates.length - 1] };
        
        // Simple trend analysis
        let trends: 'increasing' | 'decreasing' | 'stable' | 'seasonal' | 'unknown' = 'unknown';
        if (dates.length >= 3) {
          const firstThird = dates.slice(0, Math.floor(dates.length / 3));
          const lastThird = dates.slice(-Math.floor(dates.length / 3));
          
          const firstAvg = firstThird.reduce((sum, d) => sum + d.getTime(), 0) / firstThird.length;
          const lastAvg = lastThird.reduce((sum, d) => sum + d.getTime(), 0) / lastThird.length;
          
          if (lastAvg > firstAvg) trends = 'increasing';
          else if (lastAvg < firstAvg) trends = 'decreasing';
          else trends = 'stable';
        }
        
        temporal = {
          timeRange,
          trends,
          gaps: [] // Could implement gap detection if needed
        };
      }
    }

    return {
      summary: { totalRows, uniqueValues, nullPercentage },
      numerical,
      temporal
    };
  }

  /**
   * Perform pattern analysis using AI
   */
  private async performPatternAnalysis(result: QueryResult, originalQuery: string): Promise<PatternAnalysis> {
    try {
      const prompt = this.buildPatternAnalysisPrompt(result, originalQuery);
      const response = await this.aiService.generateResponse(prompt);
      
      // Parse AI response into structured format
      return this.parsePatternAnalysisResponse(response);
    } catch (error) {
      logger.warn('Pattern analysis failed, returning basic analysis:', error);
      return {
        trends: [],
        anomalies: [],
        correlations: []
      };
    }
  }

  /**
   * Generate contextual insights
   */
  private async generateContextualInsights(result: QueryResult, originalQuery: string): Promise<ContextualInsights> {
    const statistical = this.performStatisticalAnalysis(result);
    
    // Data quality assessment
    const totalColumns = result.tables[0]?.columns.length || 0;
    const nullColumns = Object.values(statistical.summary.nullPercentage).filter(p => p > 50).length;
    const completeness = totalColumns > 0 ? ((totalColumns - nullColumns) / totalColumns) * 100 : 0;
    
    const consistency: string[] = [];
    const recommendations: string[] = [];
    
    // Basic consistency checks
    if (completeness < 80) {
      consistency.push('High percentage of null values detected');
      recommendations.push('Consider filtering out incomplete records');
    }
    
    if (statistical.numerical?.outliers.length && statistical.numerical.outliers.length > 0) {
      consistency.push('Outliers detected in numerical data');
      recommendations.push('Investigate outlier values for data quality issues');
    }

    return {
      dataQuality: {
        completeness: Number(completeness.toFixed(1)),
        consistency,
        recommendations
      },
      businessInsights: {
        keyFindings: [],
        potentialIssues: [],
        opportunities: []
      },
      followUpQueries: []
    };
  }

  /**
   * Generate AI-powered insights
   */
  private async generateAIInsights(result: QueryResult, originalQuery: string): Promise<string> {
    try {
      const prompt = this.buildInsightsPrompt(result, originalQuery);
      return await this.aiService.generateResponse(prompt);
    } catch (error) {
      logger.warn('AI insights generation failed:', error);
      return 'AI insights temporarily unavailable. Please try again later.';
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(result: QueryResult, originalQuery: string): Promise<string[]> {
    const recommendations: string[] = [];
    const statistical = this.performStatisticalAnalysis(result);
    
    if (statistical.summary.totalRows === 0) {
      recommendations.push('No data returned - consider adjusting your query criteria');
    } else if (statistical.summary.totalRows > 10000) {
      recommendations.push('Large dataset returned - consider adding filters to improve performance');
    }
    
    if (statistical.numerical?.outliers.length && statistical.numerical.outliers.length > statistical.summary.totalRows * 0.1) {
      recommendations.push('High number of outliers detected - investigate data quality');
    }
    
    return recommendations;
  }

  /**
   * Generate follow-up queries
   */
  private async generateFollowUpQueries(result: QueryResult, originalQuery: string): Promise<{
    query: string;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
  }[]> {
    const queries = [];
    const statistical = this.performStatisticalAnalysis(result);
    
    if (statistical.numerical?.outliers.length && statistical.numerical.outliers.length > 0) {
      queries.push({
        query: `${originalQuery} | where column_name > ${statistical.numerical.mean + 2 * statistical.numerical.stdDev}`,
        purpose: 'Investigate outlier values',
        priority: 'medium' as const
      });
    }
    
    if (statistical.temporal) {
      queries.push({
        query: `${originalQuery} | summarize count() by bin(timestamp, 1h)`,
        purpose: 'Analyze temporal distribution',
        priority: 'low' as const
      });
    }
    
    return queries;
  }

  // Helper methods
  private findNumericColumn(columns: QueryColumn[], rows: any[][]): { index: number; name: string } | null {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].type.includes('int') || columns[i].type.includes('real') || columns[i].type.includes('decimal')) {
        return { index: i, name: columns[i].name };
      }
      
      // Check if values are actually numeric
      const sample = rows.slice(0, 10).map(row => row[i]);
      if (sample.every(val => typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== ''))) {
        return { index: i, name: columns[i].name };
      }
    }
    return null;
  }

  private findDateTimeColumn(columns: QueryColumn[], rows: any[][]): { index: number; name: string } | null {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].type.includes('datetime') || columns[i].name.toLowerCase().includes('time') || columns[i].name.toLowerCase().includes('date')) {
        return { index: i, name: columns[i].name };
      }
    }
    return null;
  }

  private parseDate(value: any): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0);
    return sum / values.length;
  }

  private buildPatternAnalysisPrompt(result: QueryResult, originalQuery: string): string {
    const dataSummary = this.prepareDataSummary(result);
    return `
Analyze this Application Insights query result for patterns and anomalies:

Query: "${originalQuery}"
Data Summary: ${JSON.stringify(dataSummary, null, 2)}

Please identify:
1. Notable patterns or trends in the data
2. Any anomalies or outliers (be specific about values/rows)
3. Correlations between columns if applicable

Respond in JSON format:
{
  "trends": [{"description": "trend description", "confidence": 0.8, "visualization": "trend visualization"}],
  "anomalies": [{"type": "spike", "description": "anomaly description", "severity": "medium", "affectedRows": [1,2,3]}],
  "correlations": [{"columns": ["col1", "col2"], "coefficient": 0.7, "significance": "moderate"}]
}`;
  }

  private buildInsightsPrompt(result: QueryResult, originalQuery: string): string {
    const dataSummary = this.prepareDataSummary(result);
    return `
Analyze this Application Insights query result and provide business insights:

Query: "${originalQuery}"
Data Summary: ${JSON.stringify(dataSummary, null, 2)}

Please provide:
1. Key patterns and trends in the data
2. Business insights relevant to Application Insights monitoring
3. Potential issues or opportunities
4. Specific actions or recommendations

Focus on practical, actionable insights for application monitoring and performance analysis.
Respond in clear, business-friendly language.`;
  }

  private prepareDataSummary(result: QueryResult) {
    if (!result.tables.length) return { tables: 0, rows: 0 };
    
    const firstTable = result.tables[0];
    const sampleSize = Math.min(5, firstTable.rows.length);
    
    return {
      tableCount: result.tables.length,
      columns: firstTable.columns.map(col => ({ name: col.name, type: col.type })),
      totalRows: firstTable.rows.length,
      sampleRows: firstTable.rows.slice(0, sampleSize)
    };
  }

  private parsePatternAnalysisResponse(response: string): PatternAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        trends: parsed.trends || [],
        anomalies: parsed.anomalies || [],
        correlations: parsed.correlations || []
      };
    } catch (error) {
      logger.warn('Failed to parse pattern analysis response:', error);
      return {
        trends: [],
        anomalies: [],
        correlations: []
      };
    }
  }
}