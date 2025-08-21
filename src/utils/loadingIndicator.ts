import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { logger } from './logger';

export class LoadingIndicator {
  private spinner: Ora | null = null;

  /**
   * Start a loading indicator with a message
   */
  start(message: string, type: 'dots' | 'line' | 'arrow3' = 'dots'): void {
    try {
      if (this.spinner && this.spinner.isSpinning) {
        this.stop();
      }

      this.spinner = ora({
        text: chalk.blue(message),
        spinner: type,
        color: 'blue'
      }).start();

      logger.debug(`Loading indicator started: ${message}`);
    } catch (error) {
      // Fallback to simple console output if ora fails
      console.log(chalk.blue(`⏳ ${message}...`));
      logger.debug(`Loading indicator fallback for: ${message}`);
    }
  }

  /**
   * Update the loading message
   */
  update(message: string): void {
    try {
      if (this.spinner && this.spinner.isSpinning) {
        this.spinner.text = chalk.blue(message);
        logger.debug(`Loading indicator updated: ${message}`);
      }
    } catch (error) {
      logger.debug(`Failed to update loading indicator: ${error}`);
    }
  }

  /**
   * Stop loading indicator with success message
   */
  succeed(message?: string): void {
    try {
      if (this.spinner && this.spinner.isSpinning) {
        if (message) {
          this.spinner.succeed(chalk.green(message));
        } else {
          this.spinner.succeed();
        }
        this.spinner = null;
        logger.debug(`Loading indicator succeeded: ${message || 'completed'}`);
      }
    } catch (error) {
      // Fallback
      if (message) {
        console.log(chalk.green(`✅ ${message}`));
      }
      this.spinner = null;
      logger.debug(`Loading indicator success fallback: ${message || 'completed'}`);
    }
  }

  /**
   * Stop loading indicator with error message
   */
  fail(message?: string): void {
    try {
      if (this.spinner && this.spinner.isSpinning) {
        if (message) {
          this.spinner.fail(chalk.red(message));
        } else {
          this.spinner.fail();
        }
        this.spinner = null;
        logger.debug(`Loading indicator failed: ${message || 'failed'}`);
      }
    } catch (error) {
      // Fallback
      if (message) {
        console.log(chalk.red(`❌ ${message}`));
      }
      this.spinner = null;
      logger.debug(`Loading indicator fail fallback: ${message || 'failed'}`);
    }
  }

  /**
   * Stop loading indicator without status
   */
  stop(): void {
    try {
      if (this.spinner && this.spinner.isSpinning) {
        this.spinner.stop();
        this.spinner = null;
        logger.debug('Loading indicator stopped');
      }
    } catch (error) {
      this.spinner = null;
      logger.debug('Loading indicator stop fallback');
    }
  }

  /**
   * Check if loading indicator is active
   */
  isSpinning(): boolean {
    return this.spinner?.isSpinning ?? false;
  }
}

/**
 * Convenience function to wrap async operations with loading indicator
 */
export async function withLoadingIndicator<T>(
  message: string,
  operation: () => Promise<T>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    spinnerType?: 'dots' | 'line' | 'arrow3';
  }
): Promise<T> {
  const indicator = new LoadingIndicator();
  
  try {
    indicator.start(message, options?.spinnerType);
    const result = await operation();
    indicator.succeed(options?.successMessage);
    return result;
  } catch (error) {
    indicator.fail(options?.errorMessage);
    throw error;
  }
}

/**
 * Global loading indicator instance for shared use
 */
export const globalLoadingIndicator = new LoadingIndicator();