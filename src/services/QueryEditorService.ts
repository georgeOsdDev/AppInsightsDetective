import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { IQueryEditorService } from '../core/interfaces/IQueryEditorService';
import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';

/**
 * Query editor service for file-based query editing
 */
export class QueryEditorService implements IQueryEditorService {
  /**
   * Edit a query with method selection
   */
  async editQuery(currentQuery: string): Promise<string | null> {
    try {
      console.log(chalk.yellow.bold('\n✏️  Manual Query Editor'));
      console.log(chalk.dim('The query will be editable in your chosen method.'));

      // Select edit method
      const { editMethod } = await inquirer.prompt([
        {
          type: 'list',
          name: 'editMethod',
          message: 'How would you like to edit the query?',
          choices: [
            { name: 'Open in default editor (nano/vim)', value: 'editor' },
            { name: 'Edit inline in terminal', value: 'inline' },
            { name: 'Cancel editing', value: 'cancel' }
          ]
        }
      ]);

      if (editMethod === 'cancel') {
        return null;
      }

      if (editMethod === 'editor') {
        return await this.editQueryInFile(currentQuery);
      } else {
        return await this.editQueryInline(currentQuery);
      }

    } catch (error) {
      logger.error('Failed to edit query:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    }
  }

  /**
   * Edit a query using file-based editor
   */
  async editQueryInFile(currentQuery: string): Promise<string | null> {
    let tempFile: string | null = null;
    try {
      // Create temporary file
      tempFile = join(tmpdir(), `aidx-query-${Date.now()}.kql`);
      writeFileSync(tempFile, currentQuery, 'utf8');

      console.log(chalk.dim(`Temporary file: ${tempFile}`));
      console.log(chalk.dim('The query will open in your default editor. Save and close to continue.'));

      // Open default editor
      const editor = process.env.EDITOR || 'nano';
      try {
        execSync(`${editor} "${tempFile}"`, { stdio: 'inherit' });
        const editedQuery = readFileSync(tempFile, 'utf8').trim();

        if (editedQuery === currentQuery) {
          Visualizer.displayInfo('No changes made to the query.');
          return null;
        }

        if (!editedQuery) {
          Visualizer.displayError('Empty query is not allowed.');
          return null;
        }

        Visualizer.displaySuccess('Query edited successfully!');
        return editedQuery;

      } catch (error) {
        Visualizer.displayError(`Editor failed: ${error}`);
        return null;
      }
    } catch (error) {
      logger.error('Failed to edit query in file:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    } finally {
      // Clean up temporary file
      if (tempFile) {
        try {
          unlinkSync(tempFile);
        } catch (error) {
          logger.warn(`Failed to delete temporary file: ${tempFile}`, error);
        }
      }
    }
  }

  /**
   * Edit a query using inline editor
   */
  async editQueryInline(currentQuery: string): Promise<string | null> {
    try {
      const { query } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'query',
          message: 'Edit the KQL query:',
          default: currentQuery
        }
      ]);

      const editedQuery = query.trim();

      if (editedQuery === currentQuery) {
        Visualizer.displayInfo('No changes made to the query.');
        return null;
      }

      if (!editedQuery) {
        Visualizer.displayError('Empty query is not allowed.');
        return null;
      }

      Visualizer.displaySuccess('Query edited successfully!');
      return editedQuery;

    } catch (error) {
      logger.error('Failed to edit query inline:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    }
  }
}