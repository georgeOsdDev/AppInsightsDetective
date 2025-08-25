import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Bootstrap } from '../../infrastructure/Bootstrap';
import { ITemplateRepository, QueryTemplate, TemplateParameters } from '../../core/interfaces/ITemplateRepository';
import { IQueryOrchestrator } from '../../core/interfaces/IQueryOrchestrator';
import { IAIProvider, IDataSourceProvider } from '../../core/interfaces';
import { logger } from '../../utils/logger';
import { NLQuery, QueryResult, SupportedLanguage, ExplanationOptions } from '../../types';
import { Visualizer } from '../../utils/visualizer';
import { promptForExplanationOptions } from '../../utils/explanationPrompts';
import { getLanguageName } from '../../utils/languageUtils';

/**
 * Template execution service for interactive flow
 */
class TemplateExecutionService {
  private queryHistory: string[] = [];
  private currentAttempt: number = 0;

  constructor(
    private template: QueryTemplate,
    private originalQuery: string
  ) {}

  /**
   * Start interactive template execution flow
   */
  async executeInteractively(nlQuery: NLQuery): Promise<{ result: QueryResult; executionTime: number } | null> {
    this.queryHistory = [nlQuery.generatedKQL];
    this.currentAttempt = 1;

    console.log(chalk.blue.bold('\n🔍 Generated KQL Query'));

    while (true) {
      // Display query summary
      this.displayQuerySummary(nlQuery);

      // Get user action
      const action = await this.getUserAction();

      switch (action.action) {
        case 'execute':
          return await this.executeQuery(nlQuery.generatedKQL);

        case 'explain':
          await this.explainQuery(nlQuery);
          continue;

        case 'portal':
          await this.handlePortalExecution(nlQuery);
          continue;

        case 'regenerate':
          const newQuery = await this.regenerateQuery(nlQuery);
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
              confidence: 0.5, // Edited queries have moderate confidence
              reasoning: 'Manually edited template query'
            };
            this.queryHistory.push(editedQuery);
            continue;
          } else {
            continue;
          }

        case 'cancel':
          Visualizer.displayInfo('Template execution cancelled.');
          return null;
      }
    }
  }

  /**
   * Display query summary
   */
  private displayQuerySummary(nlQuery: NLQuery): void {
    console.log(chalk.cyan.bold('\n📝 Template Query:'));
    console.log(chalk.white(`  "${this.template.description}"`));

    Visualizer.displayKQLQuery(nlQuery.generatedKQL, nlQuery.confidence);

    if (nlQuery.reasoning) {
      console.log(chalk.cyan.bold('\n💭 AI Reasoning:'));
      console.log(chalk.dim(`  ${nlQuery.reasoning}`));
    }

    // Template information
    console.log(chalk.cyan.bold('\n📋 Template Information:'));
    console.log(chalk.dim(`  Template: ${this.template.name}`));
    console.log(chalk.dim(`  Category: ${this.template.category}`));
    console.log(chalk.dim(`  Confidence: ${Math.round(nlQuery.confidence * 100)}%`));

    // Query history
    if (this.queryHistory.length > 1) {
      console.log(chalk.cyan.bold(`\n📜 Query History (${this.queryHistory.length} versions):`));
      console.log(chalk.dim('  Multiple versions available.'));
    }
  }

  /**
   * Get user action
   */
  private async getUserAction(): Promise<{action: string}> {
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
      },
      {
        name: '🌐 Open in Azure Portal - Execute query in Azure Portal with full visualization capabilities',
        value: 'portal',
        short: 'Portal'
      },
      {
        name: '🔄 Regenerate Query - Ask AI to create a different query approach',
        value: 'regenerate',
        short: 'Regenerate'
      },
      {
        name: '✏️  Edit Query - Manually modify the KQL query',
        value: 'edit',
        short: 'Edit'
      },
      {
        name: '❌ Cancel - Stop query execution',
        value: 'cancel',
        short: 'Cancel'
      }
    ];

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
   * Explain query
   */
  private async explainQuery(nlQuery: NLQuery): Promise<void> {
    try {
      // Initialize providers for explanation
      const bootstrap = new Bootstrap();
      const container = await bootstrap.initialize();
      const aiProvider = container.resolve<IAIProvider>('aiProvider');

      // Get explanation options using shared prompting
      const explanationOptions = await promptForExplanationOptions();

      Visualizer.displayInfo(`Generating detailed query explanation in ${getLanguageName(explanationOptions.language || 'en')}...`);

      const explanation = await aiProvider.explainQuery({
        query: nlQuery.generatedKQL,
        options: explanationOptions
      });

      console.log(chalk.green.bold('\n📚 Query Explanation:'));
      console.log(chalk.dim('='.repeat(50)));
      console.log(chalk.white(explanation));
      console.log(chalk.dim('='.repeat(50)));

      // Continuation confirmation
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
   * Regenerate query using template description
   */
  private async regenerateQuery(previousQuery: NLQuery): Promise<NLQuery | null> {
    try {
      this.currentAttempt++;
      Visualizer.displayInfo(`Regenerating query (attempt ${this.currentAttempt})...`);

      // Initialize providers for regeneration
      const bootstrap = new Bootstrap();
      const container = await bootstrap.initialize();
      const aiProvider = container.resolve<IAIProvider>('aiProvider');
      const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');

      // Use template description as the "original question" for regeneration
      const originalQuestion = this.template.description;

      // Context for analyzing previous query issues
      const regenerationContext = {
        previousQuery: previousQuery.generatedKQL,
        previousReasoning: previousQuery.reasoning,
        attemptNumber: this.currentAttempt
      };

      const schema = await dataSourceProvider.getSchema();
      const newQuery = await aiProvider.regenerateQuery({
        userInput: originalQuestion,
        context: regenerationContext,
        schema
      });

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
   * Edit query manually
   */
  private async editQuery(currentQuery: string): Promise<string | null> {
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
      logger.error('Failed to edit query:', error);
      Visualizer.displayError(`Failed to edit query: ${error}`);
      return null;
    }
  }

  /**
   * Handle portal execution
   */
  private async handlePortalExecution(_nlQuery: NLQuery): Promise<void> {
    Visualizer.displayInfo('Azure Portal execution is not implemented yet for template queries.');
    
    // Continuation confirmation
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...',
      }
    ]);
  }

  /**
   * Execute query
   */
  private async executeQuery(query: string): Promise<{ result: QueryResult; executionTime: number }> {
    try {
      Visualizer.displayInfo('Executing query...');
      
      // Initialize providers for execution
      const bootstrap = new Bootstrap();
      const container = await bootstrap.initialize();
      const dataSourceProvider = container.resolve<IDataSourceProvider>('dataSourceProvider');
      
      const startTime = Date.now();
      const result = await dataSourceProvider.executeQuery({ query });
      const executionTime = Date.now() - startTime;
      
      Visualizer.displaySuccess('Query executed successfully!');
      return { result, executionTime };
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }
}

/**
 * Create template management command
 */
export function createTemplateCommand(): Command {
  const templateCommand = new Command('template')
    .description('Manage query templates')
    .alias('tpl');

  // List templates
  templateCommand
    .command('list')
    .alias('ls')
    .description('List available templates')
    .option('-c, --category <category>', 'Filter by category')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-s, --search <term>', 'Search templates by name or description')
    .action(async (options) => {
      try {
        // Create TemplateService directly - no need for OpenAI initialization
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        const filter: any = {};
        if (options.category) filter.category = options.category;
        if (options.tags) filter.tags = options.tags.split(',').map((t: string) => t.trim());
        if (options.search) filter.searchTerm = options.search;

        const templates = await templateRepository.getTemplates(filter);

        if (templates.length === 0) {
          console.log(chalk.yellow('No templates found matching the criteria.'));
          return;
        }

        console.log(chalk.cyan.bold('\n📋 Available Templates:'));
        console.log(chalk.dim('='.repeat(50)));

        templates.forEach((template, index) => {
          console.log(chalk.white(`${index + 1}. ${template.name}`));
          console.log(chalk.dim(`   ID: ${template.id}`));
          console.log(chalk.dim(`   Category: ${template.category}`));
          console.log(chalk.dim(`   Description: ${template.description}`));
          console.log(chalk.dim(`   Tags: ${template.metadata.tags.join(', ')}`));
          console.log(chalk.dim(`   Parameters: ${template.parameters.length}`));
          console.log('');
        });

        console.log(chalk.dim(`Total: ${templates.length} template(s)`));

      } catch (error) {
        logger.error('Failed to list templates:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // Show template details
  templateCommand
    .command('show <templateId>')
    .description('Show detailed information about a specific template')
    .action(async (templateId) => {
      try {
        // Create TemplateService directly - no need for OpenAI initialization
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        const template = await templateRepository.getTemplate(templateId);
        if (!template) {
          console.log(chalk.red(`Template not found: ${templateId}`));
          process.exit(1);
        }

        console.log(chalk.cyan.bold(`\n📋 Template: ${template.name}`));
        console.log(chalk.dim('='.repeat(50)));
        console.log(chalk.white(`ID: ${template.id}`));
        console.log(chalk.white(`Category: ${template.category}`));
        console.log(chalk.white(`Description: ${template.description}`));
        console.log(chalk.white(`Author: ${template.metadata.author || 'Unknown'}`));
        console.log(chalk.white(`Version: ${template.metadata.version}`));
        console.log(chalk.white(`Created: ${template.metadata.createdAt.toISOString().split('T')[0]}`));
        console.log(chalk.white(`Tags: ${template.metadata.tags.join(', ')}`));

        console.log(chalk.cyan.bold('\n🔍 KQL Template:'));
        console.log(chalk.dim('-'.repeat(30)));
        console.log(chalk.green(template.kqlTemplate));
        console.log(chalk.dim('-'.repeat(30)));

        if (template.parameters.length > 0) {
          console.log(chalk.cyan.bold('\n⚙️ Parameters:'));
          template.parameters.forEach((param, index) => {
            console.log(chalk.white(`${index + 1}. ${param.name} (${param.type})`));
            console.log(chalk.dim(`   Description: ${param.description}`));
            console.log(chalk.dim(`   Required: ${param.required ? 'Yes' : 'No'}`));
            if (param.defaultValue !== undefined) {
              console.log(chalk.dim(`   Default: ${param.defaultValue}`));
            }
            if (param.validValues && param.validValues.length > 0) {
              console.log(chalk.dim(`   Valid values: ${param.validValues.join(', ')}`));
            }
            console.log('');
          });
        }

      } catch (error) {
        logger.error('Failed to show template:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // Create template
  templateCommand
    .command('create')
    .description('Create a new template')
    .option('-n, --name <name>', 'Template name')
    .option('-d, --description <description>', 'Template description')
    .option('-c, --category <category>', 'Template category')
    .option('-f, --file <file>', 'Load template from file')
    .action(async (options) => {
      try {
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        let templateData: Partial<QueryTemplate>;

        if (options.file) {
          // Load from file
          const fs = await import('fs/promises');
          const path = await import('path');
          
          try {
            const filePath = path.resolve(options.file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            templateData = JSON.parse(fileContent);
            
            console.log(chalk.green(`✅ Loaded template from ${filePath}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to load template from file: ${error}`));
            process.exit(1);
          }
        } else {
          // Interactive creation
          console.log(chalk.cyan.bold('\n📝 Create New Template'));
          console.log(chalk.dim('='.repeat(50)));

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Template name:',
              default: options.name,
              validate: (input) => input.trim() ? true : 'Template name is required'
            },
            {
              type: 'input',
              name: 'description',
              message: 'Template description:',
              default: options.description,
              validate: (input) => input.trim() ? true : 'Description is required'
            },
            {
              type: 'input',
              name: 'category',
              message: 'Template category:',
              default: options.category || 'Custom',
              validate: (input) => input.trim() ? true : 'Category is required'
            },
            {
              type: 'editor',
              name: 'kqlTemplate',
              message: 'KQL template (use {{paramName}} for parameters):'
            },
            {
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated):',
              filter: (input) => input.split(',').map((t: string) => t.trim()).filter((t: string) => t)
            }
          ]);

          // Collect parameters
          const parameters = [];
          console.log(chalk.yellow('\n⚙️ Define template parameters (press Enter with empty name to finish):'));
          
          while (true) {
            const paramAnswers = await inquirer.prompt([
              {
                type: 'input',
                name: 'name',
                message: 'Parameter name:'
              }
            ]);

            if (!paramAnswers.name.trim()) break;

            const paramDetails = await inquirer.prompt([
              {
                type: 'list',
                name: 'type',
                message: 'Parameter type:',
                choices: ['string', 'number', 'datetime', 'timespan'],
                default: 'string'
              },
              {
                type: 'input',
                name: 'description',
                message: 'Parameter description:',
                validate: (input) => input.trim() ? true : 'Description is required'
              },
              {
                type: 'confirm',
                name: 'required',
                message: 'Is this parameter required?',
                default: true
              },
              {
                type: 'input',
                name: 'defaultValue',
                message: 'Default value (optional):',
                when: (answers) => !answers.required
              },
              {
                type: 'input',
                name: 'validValues',
                message: 'Valid values (comma-separated, optional):',
                filter: (input) => input ? input.split(',').map((v: string) => v.trim()).filter((v: string) => v) : []
              }
            ]);

            parameters.push({
              name: paramAnswers.name.trim(),
              type: paramDetails.type,
              description: paramDetails.description,
              required: paramDetails.required,
              defaultValue: paramDetails.defaultValue || undefined,
              validValues: paramDetails.validValues.length > 0 ? paramDetails.validValues : undefined
            });

            console.log(chalk.green(`✅ Added parameter: ${paramAnswers.name}`));
          }

          templateData = {
            name: answers.name,
            description: answers.description,
            category: answers.category,
            kqlTemplate: answers.kqlTemplate,
            parameters,
            metadata: {
              tags: answers.tags,
              version: '1.0.0',
              author: 'User',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          };
        }

        // Generate unique ID
        const templateId = templateData.name?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `template-${Date.now()}`;

        const template: QueryTemplate = {
          id: templateId,
          name: templateData.name!,
          description: templateData.description!,
          category: templateData.category!,
          kqlTemplate: templateData.kqlTemplate!,
          parameters: templateData.parameters || [],
          metadata: {
            author: templateData.metadata?.author || 'User',
            version: templateData.metadata?.version || '1.0.0',
            createdAt: templateData.metadata?.createdAt || new Date(),
            updatedAt: new Date(),
            tags: templateData.metadata?.tags || []
          }
        };

        // Validate and save template
        templateRepository.validateTemplate(template);
        await templateRepository.saveTemplate(template);

        console.log(chalk.green.bold(`\n🎉 Template created successfully!`));
        console.log(chalk.white(`ID: ${template.id}`));
        console.log(chalk.white(`Name: ${template.name}`));
        console.log(chalk.dim(`Use 'aidx template show ${template.id}' to view details`));

      } catch (error) {
        logger.error('Failed to create template:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // Use/execute template
  templateCommand
    .command('use <templateId>')
    .description('Execute a template with parameters')
    .option('-p, --params <params>', 'Parameters in JSON format (e.g., \'{"timespan":"2h","limit":100}\')')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (table, json, csv, tsv)', 'table')
    .option('--auto-execute', 'Execute query directly without confirmation')
    .action(async (templateId, options) => {
      try {
        // Get template first (without initializing OpenAI)
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        const template = await templateRepository.getTemplate(templateId);
        if (!template) {
          console.log(chalk.red(`Template not found: ${templateId}`));
          process.exit(1);
        }

        console.log(chalk.cyan.bold(`\n📋 Using Template: ${template.name}`));
        console.log(chalk.dim(`Description: ${template.description}`));

        // Collect parameters
        let parameters: TemplateParameters = {};
        
        if (options.params) {
          // Parse JSON parameters
          try {
            parameters = JSON.parse(options.params);
          } catch (error) {
            console.log(chalk.red('Invalid JSON format for parameters'));
            process.exit(1);
          }
        } else if (template.parameters.length > 0) {
          // Interactive parameter collection
          console.log(chalk.yellow('\n⚙️ Please provide template parameters:'));
          
          for (const param of template.parameters) {
            let message = `${param.description}`;
            if (param.defaultValue !== undefined) {
              message += ` (default: ${param.defaultValue})`;
            }

            const promptConfig: any = {
              name: param.name,
              message,
              default: param.defaultValue,
              validate: (input: any) => {
                if (param.required && (!input || input.toString().trim() === '')) {
                  return `${param.name} is required`;
                }
                if (param.validValues && param.validValues.length > 0 && input && !param.validValues.includes(input)) {
                  return `Invalid value. Valid options: ${param.validValues.join(', ')}`;
                }
                return true;
              }
            };

            if (param.validValues && param.validValues.length > 0) {
              // Show list of valid values, but allow custom input
              const choices = [...param.validValues, { name: 'Custom value (type your own)', value: '__custom__' }];
              
              const { [param.name]: selectedValue } = await inquirer.prompt([{
                ...promptConfig,
                type: 'list',
                choices
              }]);
              
              if (selectedValue === '__custom__') {
                // Allow free input
                const { [param.name]: customValue } = await inquirer.prompt([{
                  type: 'input',
                  name: param.name,
                  message: `Enter custom value for ${param.name}:`,
                  default: param.defaultValue,
                  validate: (input: any) => {
                    if (param.required && (!input || input.toString().trim() === '')) {
                      return `${param.name} is required`;
                    }
                    return true;
                  }
                }]);
                parameters[param.name] = customValue;
              } else {
                parameters[param.name] = selectedValue;
              }
            } else {
              // Free text input
              promptConfig.type = 'input';
              const { [param.name]: value } = await inquirer.prompt([promptConfig]);
              parameters[param.name] = value;
            }
          }
        }

        // Generate the final KQL query with parameters applied
        const finalKqlQuery = await templateRepository.applyTemplate(template, parameters);

        // Create NLQuery object for interactive flow
        const nlQuery: NLQuery = {
          generatedKQL: finalKqlQuery,
          confidence: 0.9, // Template queries have high confidence
          reasoning: `Generated from template "${template.name}" with user-provided parameters`
        };

        // Interactive confirmation (unless --auto-execute is used)
        if (!options.autoExecute) {
          // Use interactive template execution flow
          const templateExecutionService = new TemplateExecutionService(template, finalKqlQuery);
          const executionResult = await templateExecutionService.executeInteractively(nlQuery);
          
          if (executionResult) {
            // Handle output similar to the main query command
            const { handleOutput } = await import('../index');
            await handleOutput(executionResult.result, options, executionResult.executionTime);
          }
          return;
        }

        // Auto-execute mode: bypass interactive flow
        console.log(chalk.green.bold('\n🚀 Executing template...'));
        const bootstrap = new Bootstrap();
        const container = await bootstrap.initialize();
        const queryOrchestrator = container.resolve<IQueryOrchestrator>('queryOrchestrator');

        const result = await queryOrchestrator.executeTemplateQuery({
          templateId: template.id,
          parameters: parameters
        });

        // Handle output similar to the main query command
        const { handleOutput } = await import('../index');
        await handleOutput(result.result, options, result.executionTime);

      } catch (error) {
        logger.error('Failed to execute template:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // List categories
  templateCommand
    .command('categories')
    .description('List template categories')
    .action(async () => {
      try {
        // Create TemplateService directly - no need for OpenAI initialization
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        const categories = await templateRepository.getCategories();
        
        if (categories.length === 0) {
          console.log(chalk.yellow('No template categories found.'));
          return;
        }

        console.log(chalk.cyan.bold('\n📂 Template Categories:'));
        categories.forEach((category, index) => {
          console.log(chalk.white(`${index + 1}. ${category}`));
        });

      } catch (error) {
        logger.error('Failed to list categories:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  // Delete template
  templateCommand
    .command('delete <templateId>')
    .alias('rm')
    .description('Delete a user-created template')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (templateId, options) => {
      try {
        const { TemplateService } = await import('../../services/TemplateService');
        const templateRepository = new TemplateService();

        // Get template to check if it exists and if it's deletable
        const template = await templateRepository.getTemplate(templateId);
        if (!template) {
          console.log(chalk.red(`Template not found: ${templateId}`));
          process.exit(1);
        }

        // Don't allow deleting system templates
        if (template.metadata.author === 'System') {
          console.log(chalk.red(`Cannot delete system template: ${templateId}`));
          process.exit(1);
        }

        // Confirm deletion unless forced
        if (!options.force) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow(`Are you sure you want to delete template "${template.name}"?`),
            default: false
          }]);

          if (!confirm) {
            console.log(chalk.gray('Template deletion cancelled.'));
            return;
          }
        }

        // Delete template
        const deleted = await templateRepository.deleteTemplate(templateId);
        
        if (deleted) {
          // Also delete the file if it exists
          try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const filePath = path.join(process.cwd(), 'templates', 'user', `${templateId}.json`);
            await fs.unlink(filePath);
            logger.debug(`Template file deleted: ${filePath}`);
          } catch (error) {
            // File might not exist, that's okay
            logger.debug(`Template file not found for deletion: ${templateId}.json`);
          }

          console.log(chalk.green(`✅ Template deleted: ${template.name}`));
        } else {
          console.log(chalk.red(`Failed to delete template: ${templateId}`));
          process.exit(1);
        }

      } catch (error) {
        logger.error('Failed to delete template:', error);
        console.log(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    });

  return templateCommand;
}