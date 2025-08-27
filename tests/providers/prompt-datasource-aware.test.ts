import { buildSystemPrompt } from '../../src/providers/ai/prompts/systemPrompts';

describe('Data Source Aware Prompts', () => {
  
  describe('buildSystemPrompt', () => {
    
    it('should generate Application Insights specific prompt', () => {
      const prompt = buildSystemPrompt('application-insights');
      
      expect(prompt).toContain('Application Insights');
      expect(prompt).toContain('requests');
      expect(prompt).toContain('dependencies');
      expect(prompt).toContain('exceptions');
      expect(prompt).toContain('pageViews');
    });

    it('should generate Log Analytics specific prompt', () => {
      const prompt = buildSystemPrompt('log-analytics');
      
      expect(prompt).toContain('Log Analytics');
      expect(prompt).toContain('Heartbeat');
      expect(prompt).toContain('Perf');
      expect(prompt).toContain('search');
      expect(prompt).toContain('workspace');
    });

    it('should generate Azure Metrics specific prompt', () => {
      const prompt = buildSystemPrompt('azure-metrics');
      
      expect(prompt).toContain('Azure Monitor Metrics');
      expect(prompt).toContain('CPU');
      expect(prompt).toContain('Memory');
      expect(prompt).toContain('metric');
    });

    it('should default to Application Insights when no dataSourceType provided', () => {
      const prompt = buildSystemPrompt();
      
      expect(prompt).toContain('Application Insights');
      expect(prompt).toContain('requests');
    });

    it('should include schema when provided', () => {
      const schema = { tables: ['CustomTable'] };
      const prompt = buildSystemPrompt('application-insights', schema);
      
      expect(prompt).toContain('Available schema information');
      expect(prompt).toContain('CustomTable');
    });

    it('should include extra context when provided', () => {
      const extraContext = 'Focus on error analysis for web applications';
      const prompt = buildSystemPrompt('application-insights', undefined, extraContext);
      
      expect(prompt).toContain('Additional context');
      expect(prompt).toContain('Focus on error analysis');
    });

    it('should include both schema and extra context', () => {
      const schema = { tables: ['requests', 'exceptions'] };
      const extraContext = 'Analyze the last 24 hours';
      const prompt = buildSystemPrompt('application-insights', schema, extraContext);
      
      expect(prompt).toContain('Available schema information');
      expect(prompt).toContain('Additional context');
      expect(prompt).toContain('requests');
      expect(prompt).toContain('Analyze the last 24 hours');
    });

  });

});