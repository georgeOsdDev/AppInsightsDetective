/**
 * Investigate command - AI-driven intelligent investigation system
 */
import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { Visualizer } from '../../utils/visualizer';
import { Bootstrap } from '../../infrastructure/Bootstrap';
import { IIntelligentInvestigationService } from '../../core/interfaces';
import { InvestigationProblem, InvestigationType } from '../../types/investigation';
import chalk from 'chalk';
import inquirer from 'inquirer';

export function createInvestigateCommand(): Command {
  const command = new Command('investigate');
  
  command
    .description('🧠 AI-driven intelligent investigation of Application Insights problems')
    .argument('[problem]', 'Problem description in natural language')
    .option('-i, --interactive', 'Run in interactive guided mode', false)
    .option('-t, --type <type>', 'Investigation type (performance|availability|data-quality|dependencies)')
    .option('--continue <id>', 'Continue an existing investigation')
    .option('--resume <id>', 'Resume a paused investigation')
    .option('--cancel <id>', 'Cancel an ongoing investigation')
    .option('--status <id>', 'Check status of an investigation')
    .option('--history', 'Show investigation history')
    .option('--export <id>', 'Export investigation results')
    .option('--format <format>', 'Export format (json|markdown|html)', 'markdown')
    .option('--max-time <minutes>', 'Maximum investigation time in minutes', '5')
    .action(async (problem, options) => {
      try {
        await handleInvestigateCommand(problem, options);
      } catch (error) {
        logger.error('Investigation command failed:', error);
        console.error(chalk.red.bold('❌ Investigation failed:'));
        console.error(chalk.red(String(error)));
        process.exit(1);
      }
    });

  return command;
}

async function handleInvestigateCommand(problem: string | undefined, options: any): Promise<void> {
  // Initialize the bootstrap container
  const bootstrap = new Bootstrap();
  await bootstrap.initialize();
  const container = bootstrap.getContainer();

  // Get the investigation service from the container
  const investigationService = container.resolve<IIntelligentInvestigationService>('intelligentInvestigationService');

  // Handle different command modes
  if (options.history) {
    await showInvestigationHistory(investigationService);
    return;
  }

  if (options.status) {
    await showInvestigationStatus(investigationService, options.status);
    return;
  }

  if (options.continue) {
    await continueInvestigation(investigationService, options.continue);
    return;
  }

  if (options.resume) {
    await resumeInvestigation(investigationService, options.resume);
    return;
  }

  if (options.cancel) {
    await cancelInvestigation(investigationService, options.cancel);
    return;
  }

  if (options.export) {
    await exportInvestigation(investigationService, options.export, options.format);
    return;
  }

  // Start new investigation
  if (!problem && !options.interactive) {
    console.log(chalk.yellow('Please provide a problem description or use --interactive mode'));
    showInvestigateHelp();
    return;
  }

  await startNewInvestigation(investigationService, problem, options);
}

async function startNewInvestigation(
  service: IIntelligentInvestigationService, 
  problem: string | undefined, 
  options: any
): Promise<void> {
  let investigationProblem: InvestigationProblem;

  if (options.interactive) {
    investigationProblem = await gatherProblemDetailsInteractively();
  } else {
    investigationProblem = {
      description: problem!,
      type: options.type as InvestigationType,
      severity: 'medium'
    };
  }

  console.log(chalk.blue.bold('\n🔍 Starting AI-Driven Investigation'));
  console.log(chalk.dim('='.repeat(50)));
  console.log(chalk.cyan.bold('Problem:'), chalk.white(investigationProblem.description));
  if (investigationProblem.type) {
    console.log(chalk.cyan.bold('Type:'), chalk.white(investigationProblem.type));
  }
  console.log('');

  Visualizer.displayInfo('Initializing AI investigation services...');

  try {
    // Start the investigation
    const response = await service.startInvestigation({
      problem: investigationProblem,
      options: {
        interactive: options.interactive,
        maxExecutionTime: parseInt(options.maxTime),
        language: 'en'
      }
    });

    console.log(chalk.green('✅ Investigation started successfully!'));
    console.log(chalk.dim(`Investigation ID: ${response.investigationId}`));
    
    if (response.plan) {
      displayInvestigationPlan(response.plan);
    }

    // Handle interactive confirmation
    if (response.nextAction?.type === 'confirm' && options.interactive) {
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to proceed with this investigation plan?',
          default: true
        }
      ]);

      if (!proceed) {
        console.log(chalk.yellow('Investigation cancelled by user.'));
        await service.cancelInvestigation(response.investigationId);
        return;
      }
    }

    // Continue with automatic execution or interactive mode
    await executeInvestigation(service, response.investigationId, options.interactive);

  } catch (error) {
    logger.error('Failed to start investigation:', error);
    throw error;
  }
}

async function executeInvestigation(
  service: IIntelligentInvestigationService,
  investigationId: string,
  interactive: boolean
): Promise<void> {
  console.log(chalk.blue('\n🔄 Executing Investigation...'));
  
  let completed = false;
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loops

  while (!completed && attempts < maxAttempts) {
    attempts++;
    
    try {
      const response = await service.continueInvestigation(investigationId);
      
      // Display progress
      if (response.progress) {
        displayProgress(response.progress);
      }

      if (response.status === 'completed' && response.result) {
        completed = true;
        displayInvestigationResults(response.result);
        
        // Offer to export results
        if (interactive) {
          const { wantExport } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'wantExport',
              message: 'Would you like to export the investigation results?',
              default: false
            }
          ]);

          if (wantExport) {
            const { format } = await inquirer.prompt([
              {
                type: 'list',
                name: 'format',
                message: 'Select export format:',
                choices: [
                  { name: '📝 Markdown - Human-readable report', value: 'markdown' },
                  { name: '📊 HTML - Web-viewable report', value: 'html' },
                  { name: '💾 JSON - Raw data format', value: 'json' }
                ]
              }
            ]);

            await exportInvestigation(service, investigationId, format);
          }
        }
        
      } else if (response.nextAction?.message) {
        console.log(chalk.cyan(`📋 ${response.nextAction.message}`));
        
        if (interactive && response.nextAction.type === 'input') {
          // Handle interactive input if needed
          // This is a placeholder for future interactive features
        }
      }

      // Small delay to avoid overwhelming the system
      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      logger.error('Investigation execution error:', error);
      console.error(chalk.red(`❌ Investigation error: ${error}`));
      break;
    }
  }

  if (attempts >= maxAttempts) {
    console.log(chalk.yellow('⚠️ Investigation stopped - maximum attempts reached'));
  }
}

function displayInvestigationPlan(plan: any): void {
  console.log(chalk.blue.bold('\n📋 Investigation Plan'));
  console.log(chalk.dim('='.repeat(30)));
  console.log(chalk.cyan.bold('Type:'), chalk.white(plan.detectedType));
  console.log(chalk.cyan.bold('Confidence:'), chalk.white(`${(plan.confidence * 100).toFixed(1)}%`));
  console.log(chalk.cyan.bold('Estimated Time:'), chalk.white(`${Math.ceil(plan.estimatedTotalTime / 60)} minutes`));
  console.log(chalk.cyan.bold('Phases:'), chalk.white(plan.phases.length));
  
  if (plan.reasoning) {
    console.log(chalk.cyan.bold('Reasoning:'), chalk.dim(plan.reasoning));
  }

  // Display phases
  console.log(chalk.blue.bold('\n🔍 Investigation Phases:'));
  plan.phases.forEach((phase: any, index: number) => {
    console.log(chalk.white(`  ${index + 1}. ${phase.name}`));
    console.log(chalk.dim(`     ${phase.description}`));
    console.log(chalk.gray(`     Queries: ${phase.queries?.length || 0}`));
  });
  console.log('');
}

function displayProgress(progress: any): void {
  const percentage = progress.completionPercentage.toFixed(1);
  const progressBar = createProgressBar(progress.completionPercentage);
  
  console.log(chalk.blue(`📊 Progress: ${progressBar} ${percentage}%`));
  console.log(chalk.gray(`   Phases: ${progress.completedPhases}/${progress.totalPhases} | ` +
                        `Queries: ${progress.completedQueries}/${progress.totalQueries}`));
  
  if (progress.failedQueries > 0) {
    console.log(chalk.yellow(`   ⚠️ Failed queries: ${progress.failedQueries}`));
  }
}

function createProgressBar(percentage: number): string {
  const total = 20;
  const completed = Math.floor((percentage / 100) * total);
  const remaining = total - completed;
  
  return chalk.green('█'.repeat(completed)) + chalk.gray('░'.repeat(remaining));
}

function displayInvestigationResults(result: any): void {
  console.log(chalk.green.bold('\n✅ Investigation Completed!'));
  console.log(chalk.dim('='.repeat(40)));
  
  console.log(chalk.cyan.bold('Summary:'));
  console.log(chalk.white(`  ${result.summary}`));
  
  console.log(chalk.cyan.bold('\nRoot Cause Analysis:'));
  console.log(chalk.white(`  ${result.rootCauseAnalysis.primaryCause.description}`));
  console.log(chalk.gray(`  Confidence: ${(result.rootCauseAnalysis.primaryCause.confidence * 100).toFixed(1)}%`));
  
  console.log(chalk.cyan.bold('\nExecution Details:'));
  console.log(chalk.white(`  Duration: ${result.totalExecutionTime} seconds`));
  console.log(chalk.white(`  Evidence collected: ${result.evidence.length} items`));
  console.log(chalk.white(`  Queries executed: ${result.context.progress.completedQueries}`));
  
  if (result.evidence.length > 0) {
    console.log(chalk.cyan.bold('\nKey Evidence:'));
    result.evidence
      .filter((e: any) => e.significance === 'critical' || e.significance === 'important')
      .slice(0, 3)
      .forEach((evidence: any) => {
        console.log(chalk.white(`  • ${evidence.summary}`));
      });
  }
}

async function gatherProblemDetailsInteractively(): Promise<InvestigationProblem> {
  console.log(chalk.blue.bold('\n🤖 Interactive Investigation Setup'));
  console.log(chalk.dim('Let\'s gather details about the problem you\'re experiencing.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Describe the problem you\'re experiencing:',
      validate: (input) => input.trim().length > 0 || 'Please provide a problem description'
    },
    {
      type: 'list',
      name: 'type',
      message: 'What type of issue is this?',
      choices: [
        { name: '🐌 Performance - Slow response times, high latency', value: 'performance' },
        { name: '🚫 Availability - Service outages, 500 errors', value: 'availability' },
        { name: '📊 Data Quality - Missing data, inconsistencies', value: 'data-quality' },
        { name: '🔗 Dependencies - External service failures', value: 'dependencies' },
        { name: '🤔 Not sure - Let AI classify the problem', value: undefined }
      ]
    },
    {
      type: 'list',
      name: 'severity',
      message: 'How severe is this issue?',
      choices: [
        { name: '🔴 Critical - System down, major impact', value: 'critical' },
        { name: '🟡 High - Significant user impact', value: 'high' },
        { name: '🟢 Medium - Noticeable but manageable', value: 'medium' },
        { name: '🔵 Low - Minor issue or investigation', value: 'low' }
      ],
      default: 'medium'
    },
    {
      type: 'input',
      name: 'services',
      message: 'Which services are affected? (comma-separated, or leave empty):',
      filter: (input) => input ? input.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    }
  ]);

  return {
    description: answers.description,
    type: answers.type as InvestigationType,
    severity: answers.severity,
    affectedServices: answers.services.length > 0 ? answers.services : undefined
  };
}

async function showInvestigationHistory(service: IIntelligentInvestigationService): Promise<void> {
  console.log(chalk.blue.bold('📚 Investigation History'));
  console.log(chalk.dim('='.repeat(30)));
  
  try {
    const history = await service.getInvestigationHistory();
    
    if (history.length === 0) {
      console.log(chalk.gray('No previous investigations found.'));
      return;
    }

    history.forEach((result) => {
      console.log(chalk.white(`ID: ${result.id.slice(0, 8)}...`));
      console.log(chalk.gray(`   Problem: ${result.plan.problem.description.slice(0, 60)}...`));
      console.log(chalk.gray(`   Type: ${result.plan.detectedType} | Completed: ${result.completedAt.toLocaleDateString()}`));
      console.log(chalk.gray(`   Duration: ${result.totalExecutionTime}s | Evidence: ${result.evidence.length} items`));
      console.log('');
    });
  } catch (error) {
    console.error(chalk.red(`Failed to retrieve history: ${error}`));
  }
}

async function showInvestigationStatus(service: IIntelligentInvestigationService, id: string): Promise<void> {
  try {
    const response = await service.getInvestigationStatus(id);
    
    console.log(chalk.blue.bold(`📊 Investigation Status: ${id.slice(0, 8)}...`));
    console.log(chalk.dim('='.repeat(40)));
    console.log(chalk.cyan.bold('Status:'), chalk.white(response.status));
    
    if (response.progress) {
      displayProgress(response.progress);
    }
    
    if (response.result) {
      console.log(chalk.cyan.bold('\nCompleted at:'), chalk.white(response.result.completedAt));
      console.log(chalk.cyan.bold('Summary:'), chalk.white(response.result.summary));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to get investigation status: ${error}`));
  }
}

async function continueInvestigation(service: IIntelligentInvestigationService, id: string): Promise<void> {
  try {
    console.log(chalk.blue(`🔄 Continuing investigation: ${id.slice(0, 8)}...`));
    await executeInvestigation(service, id, false);
  } catch (error) {
    console.error(chalk.red(`Failed to continue investigation: ${error}`));
  }
}

async function resumeInvestigation(service: IIntelligentInvestigationService, id: string): Promise<void> {
  try {
    console.log(chalk.blue(`▶️ Resuming investigation: ${id.slice(0, 8)}...`));
    const response = await service.resumeInvestigation(id);
    await executeInvestigation(service, id, false);
  } catch (error) {
    console.error(chalk.red(`Failed to resume investigation: ${error}`));
  }
}

async function cancelInvestigation(service: IIntelligentInvestigationService, id: string): Promise<void> {
  try {
    await service.cancelInvestigation(id);
    console.log(chalk.yellow(`❌ Investigation cancelled: ${id.slice(0, 8)}...`));
  } catch (error) {
    console.error(chalk.red(`Failed to cancel investigation: ${error}`));
  }
}

async function exportInvestigation(service: IIntelligentInvestigationService, id: string, format: string): Promise<void> {
  try {
    const exported = await service.exportInvestigation(id, format as 'json' | 'markdown' | 'html');
    
    // Write to file
    const fs = await import('fs');
    fs.writeFileSync(exported.filename, exported.content);
    
    console.log(chalk.green(`✅ Investigation exported to: ${exported.filename}`));
  } catch (error) {
    console.error(chalk.red(`Failed to export investigation: ${error}`));
  }
}

function showInvestigateHelp(): void {
  console.log(chalk.blue.bold('\n🧠 AI-Driven Investigation Help'));
  console.log(chalk.dim('='.repeat(40)));
  console.log('');
  
  console.log('Start a new investigation:');
  console.log(chalk.cyan('  aidx investigate "Application is responding slowly"'));
  console.log(chalk.cyan('  aidx investigate --interactive'));
  console.log('');
  
  console.log('Investigation management:');
  console.log(chalk.cyan('  aidx investigate --continue <id>     # Continue investigation'));
  console.log(chalk.cyan('  aidx investigate --status <id>      # Check status'));
  console.log(chalk.cyan('  aidx investigate --history          # View past investigations'));
  console.log('');
  
  console.log('Export results:');
  console.log(chalk.cyan('  aidx investigate --export <id> --format markdown'));
  console.log(chalk.cyan('  aidx investigate --export <id> --format html'));
  console.log('');
  
  console.log('Investigation types:');
  console.log(chalk.dim('  🐌 performance   - Slow response times, high latency'));
  console.log(chalk.dim('  🚫 availability  - Service outages, 500 errors'));
  console.log(chalk.dim('  📊 data-quality  - Missing data, inconsistencies'));
  console.log(chalk.dim('  🔗 dependencies  - External service failures'));
}