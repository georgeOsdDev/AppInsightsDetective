import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Bootstrap } from '../../infrastructure/Bootstrap';
import { ITemplateRepository, QueryTemplate, TemplateParameters } from '../../core/interfaces/ITemplateRepository';
import { IQueryOrchestrator } from '../../core/interfaces/IQueryOrchestrator';
import { logger } from '../../utils/logger';

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
        const bootstrap = new Bootstrap();
        const container = await bootstrap.initialize();
        const templateRepository = container.resolve<ITemplateRepository>('templateRepository');

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
        const bootstrap = new Bootstrap();
        const container = await bootstrap.initialize();
        const templateRepository = container.resolve<ITemplateRepository>('templateRepository');

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

  // Use/execute template
  templateCommand
    .command('use <templateId>')
    .description('Execute a template with parameters')
    .option('-p, --params <params>', 'Parameters in JSON format (e.g., \'{"timespan":"2h","limit":100}\')')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (table, json, csv, tsv)', 'table')
    .action(async (templateId, options) => {
      try {
        const bootstrap = new Bootstrap();
        const container = await bootstrap.initialize();
        const templateRepository = container.resolve<ITemplateRepository>('templateRepository');
        const queryOrchestrator = container.resolve<IQueryOrchestrator>('queryOrchestrator');

        // Get template
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
                if (param.validValues && param.validValues.length > 0 && !param.validValues.includes(input)) {
                  return `Invalid value. Valid options: ${param.validValues.join(', ')}`;
                }
                return true;
              }
            };

            if (param.validValues && param.validValues.length > 0) {
              promptConfig.type = 'list';
              promptConfig.choices = param.validValues;
            } else {
              promptConfig.type = 'input';
            }

            const { [param.name]: value } = await inquirer.prompt([promptConfig]);
            parameters[param.name] = value;
          }
        }

        // Execute template
        console.log(chalk.green.bold('\n🚀 Executing template...'));
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
        const bootstrap = new Bootstrap();
        const container = await bootstrap.initialize();
        const templateRepository = container.resolve<ITemplateRepository>('templateRepository');

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

  return templateCommand;
}