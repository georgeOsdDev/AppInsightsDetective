/**
 * Query editor service interface
 */
export interface IQueryEditorService {
  /**
   * Edit a query using file-based editor
   */
  editQueryInFile(currentQuery: string): Promise<string | null>;
  
  /**
   * Edit a query using inline editor
   */
  editQueryInline(currentQuery: string): Promise<string | null>;
  
  /**
   * Edit a query with method selection
   */
  editQuery(currentQuery: string): Promise<string | null>;
}