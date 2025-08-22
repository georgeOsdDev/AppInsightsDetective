/**
 * Shared system prompts for AI providers
 */

/**
 * Build system prompt for KQL generation
 */
export function buildSystemPrompt(schema?: any): string {
  let prompt = `You are an expert in Azure Application Insights KQL (Kusto Query Language).
Your task is to convert natural language queries into valid KQL queries for Application Insights.
Follow Azure Monitor Community best practices and proven patterns.

Key guidelines:
- Generate only valid KQL syntax
- Use proper table names (requests, dependencies, exceptions, pageViews, etc.)
- Optimize for performance (use filters early, avoid unnecessary sorting)
- Return results as JSON with this exact structure:
{
  "kql": "your query here",
  "confidence": 0.85,
  "reasoning": "explanation of approach"
}

Common patterns:
- Use 'requests' table for HTTP requests analysis
- Use 'dependencies' for external calls and database queries
- Use 'exceptions' for error analysis
- Use 'pageViews' for user experience metrics
- Use 'where timestamp > ago(...)' for time filtering
- Use 'summarize' for aggregations
- Use 'extend' to add calculated columns`;

  if (schema) {
    prompt += `\n\nAvailable schema information:\n${JSON.stringify(schema, null, 2)}`;
  }

  return prompt;
}

/**
 * Build regeneration prompt
 */
export function buildRegenerationPrompt(
  originalQuestion: string,
  previousQuery: string,
  attemptNumber: number
): string {
  return `Convert this natural language query to KQL: "${originalQuestion}"

Previous attempt (attempt ${attemptNumber}):
${previousQuery}

Please provide a DIFFERENT approach or query structure. Consider:
- Alternative table joins or relationships
- Different aggregation methods
- Alternative time ranges or filtering approaches
- Different performance optimization strategies

Ensure the new query takes a meaningfully different approach while still answering the original question.`;
}

/**
 * Build explanation system prompt for different languages and technical levels
 */
export function buildExplanationSystemPrompt(
  language: string,
  technicalLevel: 'beginner' | 'intermediate' | 'advanced',
  includeExamples: boolean
): string {
  const languageInstructions = getLanguageInstructions(language);
  const levelInstructions = getTechnicalLevelInstructions(technicalLevel);
  const exampleInstructions = includeExamples 
    ? 'Provide practical examples when helpful.' 
    : 'Focus on clear explanations without extensive examples.';

  return `You are an expert in KQL (Kusto Query Language) for Azure Application Insights.
Your task is to explain KQL queries in a clear, detailed, and educational way.

${languageInstructions}

${levelInstructions}

Explain:
1. What the query does overall
2. Each operator and function used
3. What data it retrieves
4. How the results are processed
5. Any performance considerations

${exampleInstructions}`;
}

/**
 * Get language-specific instructions
 */
function getLanguageInstructions(language: string): string {
  switch (language.toLowerCase()) {
    case 'ja':
    case 'japanese':
      return '日本語で回答してください。技術用語は英語と日本語の両方を併記してください。';
    case 'ko':
    case 'korean':
      return '한국어로 답변해 주세요. 기술 용어는 영어와 한국어를 모두 병기해 주세요.';
    case 'zh':
    case 'chinese':
      return '请用中文回答。技术术语请同时提供英文和中文。';
    case 'es':
    case 'spanish':
      return 'Responde en español. Para términos técnicos, proporciona tanto la versión en inglés como en español.';
    case 'fr':
    case 'french':
      return 'Répondez en français. Pour les termes techniques, fournissez les versions française et anglaise.';
    case 'de':
    case 'german':
      return 'Antworten Sie auf Deutsch. Geben Sie für technische Begriffe sowohl die deutsche als auch die englische Version an.';
    case 'en':
    case 'english':
    default:
      return 'Respond in English.';
  }
}

/**
 * Build pattern analysis prompt for query result analysis
 */
export function buildPatternAnalysisPrompt(result: any, originalQuery: string): string {
  const dataSummary = prepareDataSummary(result);
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

/**
 * Build insights analysis prompt for query result analysis
 */
export function buildInsightsPrompt(result: any, originalQuery: string, language?: string): string {
  const dataSummary = prepareDataSummary(result);
  const languageInstructions = language ? getLanguageInstructions(language as any) : '';
  
  return `
Analyze this Application Insights query result and provide business insights:

Query: "${originalQuery}"
Data Summary: ${JSON.stringify(dataSummary, null, 2)}

${languageInstructions}

Please provide:
1. Key patterns and trends in the data
2. Business insights relevant to Application Insights monitoring
3. Potential issues or opportunities
4. Specific actions or recommendations

Focus on practical, actionable insights for application monitoring and performance analysis.
Respond in clear, business-friendly language.`;
}

/**
 * Prepare data summary for prompt generation
 */
function prepareDataSummary(result: any) {
  if (!result?.tables?.length) return { tables: 0, rows: 0 };
  
  const firstTable = result.tables[0];
  const sampleSize = Math.min(5, firstTable.rows?.length || 0);
  
  return {
    tableCount: result.tables.length,
    columns: firstTable.columns?.map((col: any) => ({ name: col.name, type: col.type })) || [],
    totalRows: firstTable.rows?.length || 0,
    sampleRows: firstTable.rows?.slice(0, sampleSize) || []
  };
}

/**
 * Get technical level-specific instructions
 */
function getTechnicalLevelInstructions(level: 'beginner' | 'intermediate' | 'advanced'): string {
  switch (level) {
    case 'beginner':
      return `Use simple language and explain basic KQL concepts.
Focus on what the query does rather than technical implementation details.
Avoid jargon and provide context for KQL operators.`;

    case 'advanced':
      return `Provide detailed technical explanations including:
- Performance implications and optimization suggestions
- Alternative approaches and trade-offs
- Advanced KQL features and best practices
- Potential edge cases and limitations`;

    case 'intermediate':
    default:
      return `Provide balanced explanations that include:
- Clear description of what each part does
- Some technical details about how operators work
- Basic performance considerations
- Mention relevant KQL features`;
  }
}