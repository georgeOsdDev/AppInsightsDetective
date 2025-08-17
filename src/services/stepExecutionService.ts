import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { Visualizer } from '../utils/visualizer';
import { AIService } from './aiService';
import { AppInsightsService } from './appInsightsService';
import { NLQuery, QueryResult } from '../types';

export interface StepExecutionOptions {
  showConfidenceThreshold?: number;
  allowEditing?: boolean;
  maxRegenerationAttempts?: number;
}

export interface QueryAction {
  action: 'execute' | 'explain' | 'regenerate' | 'edit' | 'cancel';
  modifiedQuery?: string;
  originalQuestion?: string;
}

export class StepExecutionService {
  private queryHistory: string[] = [];
  private currentAttempt: number = 0;

  constructor(
    private aiService: AIService,
    private appInsightsService: AppInsightsService,
    private options: StepExecutionOptions = {}
  ) {
    this.options = {
      showConfidenceThreshold: 0.7,
      allowEditing: true,
      maxRegenerationAttempts: 3,
      ...options
    };
  }

  /**
   * 生成されたKQLクエリに対してステップ実行を開始
   */
  async executeStepByStep(nlQuery: NLQuery, originalQuestion: string): Promise<QueryResult | null> {
    this.queryHistory = [nlQuery.generatedKQL];
    this.currentAttempt = 1;

    console.log(chalk.blue.bold('\n🔍 Generated KQL Query Review'));
    console.log(chalk.dim('='.repeat(50)));

    while (true) {
      // クエリを表示
      this.displayQuerySummary(nlQuery, originalQuestion);

      // ユーザーアクションを取得
      const action = await this.getUserAction(nlQuery);

      switch (action.action) {
        case 'execute':
          return await this.executeQuery(nlQuery.generatedKQL);

        case 'explain':
          await this.explainQuery(nlQuery);
          continue;

        case 'regenerate':
          const newQuery = await this.regenerateQuery(originalQuestion, nlQuery);
          if (newQuery) {
            nlQuery = newQuery;
            continue;
          } else {
            Visualizer.displayError('Failed to regenerate query. Please try a different approach.');
            continue;
          }

        case 'edit':
          const editedQuery = await this.editQuery(nlQuery.generatedKQL);
          if (editedQuery) {
            nlQuery = {
              generatedKQL: editedQuery,
              confidence: 0.5, // 編集されたクエリの信頼度は中程度
              reasoning: 'Manually edited query'
            };
            this.queryHistory.push(editedQuery);
            continue;
          } else {
            continue;
          }

        case 'cancel':
          Visualizer.displayInfo('Query execution cancelled.');
          return null;
      }
    }
  }

  /**
   * クエリの概要を表示
   */
  private displayQuerySummary(nlQuery: NLQuery, originalQuestion: string): void {
    console.log(chalk.cyan.bold('\n📝 Original Question:'));
    console.log(chalk.white(`  "${originalQuestion}"`));

    console.log(chalk.cyan.bold('\n🤖 Generated KQL Query:'));
    Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

    if (nlQuery.reasoning) {
      console.log(chalk.cyan.bold('\n💭 AI Reasoning:'));
      console.log(chalk.dim(`  ${nlQuery.reasoning}`));
    }

    // 信頼度による推奨アクション
    if (nlQuery.confidence < (this.options.showConfidenceThreshold || 0.7)) {
      console.log(chalk.yellow.bold('\n⚠️  Low Confidence Warning:'));
      console.log(chalk.yellow('  This query has low confidence. Consider reviewing or regenerating it.'));
    }

    // クエリ履歴
    if (this.queryHistory.length > 1) {
      console.log(chalk.cyan.bold(`\n📜 Query History (${this.queryHistory.length} versions):`));
      console.log(chalk.dim('  Use ↑/↓ to see previous versions if needed.'));
    }
  }

  /**
   * ユーザーアクションを取得
   */
  private async getUserAction(nlQuery: NLQuery): Promise<QueryAction> {
    const choices = [
      {
        name: '🚀 Execute Query - Run this KQL query against Application Insights',
        value: 'execute',
        short: 'Execute'
      },
      {
        name: '📖 Explain Query - Get detailed explanation of what this query does',
        value: 'explain',
        short: 'Explain'
      }
    ];

    // 再生成の上限チェック
    if (this.currentAttempt < (this.options.maxRegenerationAttempts || 3)) {
      choices.push({
        name: '🔄 Regenerate Query - Ask AI to create a different query approach',
        value: 'regenerate',
        short: 'Regenerate'
      });
    }

    // 編集オプション
    if (this.options.allowEditing) {
      choices.push({
        name: '✏️  Edit Query - Manually modify the KQL query',
        value: 'edit',
        short: 'Edit'
      });
    }

    choices.push({
      name: '❌ Cancel - Stop query execution',
      value: 'cancel',
      short: 'Cancel'
    });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do with this query?',
        choices: choices,
        pageSize: 10
      }
    ]);

    return { action };
  }

  /**
   * クエリの詳細解説を表示
   */
  private async explainQuery(nlQuery: NLQuery): Promise<void> {
    try {
      Visualizer.displayInfo('Generating detailed query explanation...');

      const explanation = await this.aiService.explainKQLQuery(nlQuery.generatedKQL);

      console.log(chalk.green.bold('\n📚 Query Explanation:'));
      console.log(chalk.dim('='.repeat(50)));
      console.log(chalk.white(explanation));
      console.log(chalk.dim('='.repeat(50)));

      // 続行確認
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...',
        }
      ]);

    } catch (error) {
      logger.error('Failed to explain query:', error);
      Visualizer.displayError(`Failed to generate explanation: ${error}`);
    }
  }

  /**
   * クエリを再生成
   */
  private async regenerateQuery(originalQuestion: string, previousQuery: NLQuery): Promise<NLQuery | null> {
    try {
      this.currentAttempt++;
      Visualizer.displayInfo(`Regenerating query (attempt ${this.currentAttempt})...`);

      // 前のクエリの問題点を分析するためのコンテキスト
      const regenerationContext = {
        previousQuery: previousQuery.generatedKQL,
        previousReasoning: previousQuery.reasoning,
        attemptNumber: this.currentAttempt
      };

      const schema = await this.appInsightsService.getSchema();
      const newQuery = await this.aiService.regenerateKQLQuery(
        originalQuestion,
        regenerationContext,
        schema
      );

      if (newQuery) {
        this.queryHistory.push(newQuery.generatedKQL);
        Visualizer.displaySuccess('New query generated successfully!');
        return newQuery;
      }

      return null;
    } catch (error) {
      logger.error('Failed to regenerate query:', error);
      Visualizer.displayError(`Failed to regenerate query: ${error}`);
      return null;
    }
  }

  /**
   * クエリをマニュアル編集
   */
  private async editQuery(currentQuery: string): Promise<string | null> {
    try {
      // 一時ファイルを作成
      const tempFile = join(tmpdir(), `aidx-query-${Date.now()}.kql`);
      writeFileSync(tempFile, currentQuery, 'utf8');

      console.log(chalk.yellow.bold('\n✏️  Manual Query Editor'));
      console.log(chalk.dim(`Temporary file: ${tempFile}`));
      console.log(chalk.dim('The query will open in your default editor. Save and close to continue.'));

      // 編集方法の選択
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
        unlinkSync(tempFile);
        return null;
      }

      let editedQuery: string;

      if (editMethod === 'editor') {
        // デフォルトエディタで開く
        const editor = process.env.EDITOR || 'nano';
        try {
          execSync(`${editor} "${tempFile}"`, { stdio: 'inherit' });
          editedQuery = readFileSync(tempFile, 'utf8').trim();
        } catch (error) {
          Visualizer.displayError(`Editor failed: ${error}`);
          unlinkSync(tempFile);
          return null;
        }
      } else {
        // インラインエディタ
        const { query } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'query',
            message: 'Edit the KQL query:',
            default: currentQuery
          }
        ]);
        editedQuery = query.trim();
      }

      // 一時ファイルを削除
      unlinkSync(tempFile);

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
      logger.error('Failed to edit query:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    }
  }

  /**
   * クエリを実行
   */
  private async executeQuery(query: string): Promise<QueryResult> {
    try {
      Visualizer.displayInfo('Executing query...');
      const result = await this.appInsightsService.executeQuery(query);
      Visualizer.displaySuccess('Query executed successfully!');
      return result;
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * クエリ履歴を取得
   */
  getQueryHistory(): string[] {
    return [...this.queryHistory];
  }

  /**
   * 現在の試行回数を取得
   */
  getCurrentAttempt(): number {
    return this.currentAttempt;
  }
}
