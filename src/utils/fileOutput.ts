import * as fs from 'fs';
import * as path from 'path';
import { FormattedOutput, OutputOptions, OutputFormat } from '../types';
import { logger } from './logger';
import { OutputFormatter } from './outputFormatter';

export class FileOutputManager {
  /**
   * Write formatted output to file
   */
  public static async writeToFile(
    formattedOutput: FormattedOutput, 
    outputPath: string, 
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    logger.debug(`Writing output to file: ${outputPath}`);

    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }

      // Write file
      fs.writeFileSync(outputPath, formattedOutput.content, { encoding });
      
      logger.info(`Successfully wrote output to: ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to write file ${outputPath}:`, error);
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  /**
   * Generate appropriate filename if not provided
   */
  public static generateFileName(options: OutputOptions, baseDir = './output'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const extension = OutputFormatter.getExtensionForFormat(options.format);
    return path.join(baseDir, `query-result-${timestamp}.${extension}`);
  }

  /**
   * Resolve output path and ensure proper extension
   */
  public static resolveOutputPath(filePath: string, format: OutputFormat): string {
    const expectedExtension = OutputFormatter.getExtensionForFormat(format);
    const currentExtension = path.extname(filePath).slice(1);

    // If no extension or wrong extension, append/fix it
    if (!currentExtension) {
      return `${filePath}.${expectedExtension}`;
    }

    if (currentExtension !== expectedExtension) {
      logger.warn(`File extension '${currentExtension}' doesn't match format '${format}', keeping as-is`);
    }

    return filePath;
  }

  /**
   * Check if file path is writable
   */
  public static checkWritePermission(filePath: string): boolean {
    try {
      const dir = path.dirname(filePath);
      
      // Check if directory exists or can be created
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          // Remove the test directory if it was created
          if (fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir);
          }
        } catch {
          return false;
        }
      } else {
        // Check directory write permission
        fs.accessSync(dir, fs.constants.W_OK);
      }

      // Check if file exists and is writable, or if it can be created
      if (fs.existsSync(filePath)) {
        fs.accessSync(filePath, fs.constants.W_OK);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats if exists
   */
  public static getFileStats(filePath: string): fs.Stats | null {
    try {
      if (fs.existsSync(filePath)) {
        return fs.statSync(filePath);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create backup of existing file
   */
  public static createBackup(filePath: string): string | null {
    try {
      if (fs.existsSync(filePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupPath = `${filePath}.backup-${timestamp}`;
        fs.copyFileSync(filePath, backupPath);
        logger.info(`Created backup: ${backupPath}`);
        return backupPath;
      }
      return null;
    } catch (error) {
      logger.warn(`Failed to create backup for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Validate encoding
   */
  public static isValidEncoding(encoding: string): encoding is BufferEncoding {
    const validEncodings: BufferEncoding[] = [
      'ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 
      'base64', 'latin1', 'binary', 'hex'
    ];
    return validEncodings.includes(encoding as BufferEncoding);
  }

  /**
   * Get supported encodings list
   */
  public static getSupportedEncodings(): BufferEncoding[] {
    return ['utf8', 'utf16le', 'ascii', 'latin1', 'base64'];
  }
}