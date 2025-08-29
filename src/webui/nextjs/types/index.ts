export type PanelType = 'query' | 'templates' | 'history' | 'settings';

export interface QueryResult {
  data: any[];
  columns: string[];
  totalRows: number;
  executionTime: number;
}

export interface QuerySession {
  id: string;
  createdAt: string;
  query: string;
  result?: QueryResult;
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  query: string;
  parameters?: string[];
}