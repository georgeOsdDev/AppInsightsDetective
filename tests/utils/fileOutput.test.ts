import * as fs from 'fs';
import * as path from 'path';
import { FileOutputManager } from '../../src/utils/fileOutput';
import { FormattedOutput, OutputOptions } from '../../src/types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileOutputManager', () => {
  const mockFormattedOutput: FormattedOutput = {
    content: 'test content',
    extension: 'json',
    mimeType: 'application/json'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('writeToFile', () => {
    it('should write content to file successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      await FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/output.json',
        'test content',
        { encoding: 'utf8' }
      );
    });

    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockFs.writeFileSync.mockImplementation(() => {});

      await FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should use custom encoding', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      await FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json', 'utf16le');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/output.json',
        'test content',
        { encoding: 'utf16le' }
      );
    });

    it('should throw error if write fails', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json'))
        .rejects.toThrow('Failed to write file: Error: Write failed');
    });

    it('should throw error if directory creation fails', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('mkdir failed');
      });

      await expect(FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json'))
        .rejects.toThrow('Failed to write file: Error: mkdir failed');
    });
  });

  describe('generateFileName', () => {
    it('should generate filename with correct extension', () => {
      const options: OutputOptions = {
        format: 'json',
        destination: 'file'
      };

      const fileName = FileOutputManager.generateFileName(options, './output');
      
      expect(fileName).toMatch(/query-result-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      expect(fileName).toContain('output');
      expect(fileName.endsWith('.json')).toBe(true);
    });

    it('should generate filename for different formats', () => {
      const csvOptions: OutputOptions = { format: 'csv', destination: 'file' };
      const tsvOptions: OutputOptions = { format: 'tsv', destination: 'file' };
      const rawOptions: OutputOptions = { format: 'raw', destination: 'file' };

      expect(FileOutputManager.generateFileName(csvOptions)).toContain('.csv');
      expect(FileOutputManager.generateFileName(tsvOptions)).toContain('.tsv');
      expect(FileOutputManager.generateFileName(rawOptions)).toContain('.txt');
    });

    it('should use custom base directory', () => {
      const options: OutputOptions = {
        format: 'json',
        destination: 'file'
      };

      const fileName = FileOutputManager.generateFileName(options, './custom');
      
      expect(fileName).toMatch(/query-result-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
      expect(fileName).toContain('custom');
      expect(fileName.endsWith('.json')).toBe(true);
    });
  });

  describe('resolveOutputPath', () => {
    it('should add extension if missing', () => {
      const result = FileOutputManager.resolveOutputPath('/path/file', 'json');
      expect(result).toBe('/path/file.json');
    });

    it('should keep existing correct extension', () => {
      const result = FileOutputManager.resolveOutputPath('/path/file.json', 'json');
      expect(result).toBe('/path/file.json');
    });

    it('should warn about mismatched extension but keep it', () => {
      const result = FileOutputManager.resolveOutputPath('/path/file.txt', 'json');
      expect(result).toBe('/path/file.txt');
    });

    it('should handle different formats', () => {
      expect(FileOutputManager.resolveOutputPath('/path/file', 'csv')).toBe('/path/file.csv');
      expect(FileOutputManager.resolveOutputPath('/path/file', 'tsv')).toBe('/path/file.tsv');
      expect(FileOutputManager.resolveOutputPath('/path/file', 'raw')).toBe('/path/file.txt');
    });
  });

  describe('checkWritePermission', () => {
    it('should return true for writable path', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {});

      const result = FileOutputManager.checkWritePermission('/writable/path.json');
      expect(result).toBe(true);
    });

    it('should return true if directory can be created', () => {
      mockFs.existsSync.mockImplementation((pathArg) => {
        const pathStr = pathArg.toString();
        return pathStr === '/test' || pathStr.endsWith('path.json'); // directory exists but file doesn't
      });
      mockFs.accessSync.mockImplementation(() => {});

      const result = FileOutputManager.checkWritePermission('/test/path.json');
      expect(result).toBe(true);
    });

    it('should return false if directory cannot be created', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = FileOutputManager.checkWritePermission('/readonly/path.json');
      expect(result).toBe(false);
    });

    it('should return false if file is not writable', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = FileOutputManager.checkWritePermission('/readonly/path.json');
      expect(result).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return file stats if file exists', () => {
      const mockStats = { size: 1024, isFile: () => true } as fs.Stats;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats);

      const result = FileOutputManager.getFileStats('/test/file.json');
      expect(result).toBe(mockStats);
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = FileOutputManager.getFileStats('/test/missing.json');
      expect(result).toBeNull();
    });

    it('should return null if stat fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Stat failed');
      });

      const result = FileOutputManager.getFileStats('/test/file.json');
      expect(result).toBeNull();
    });
  });

  describe('createBackup', () => {
    it('should create backup if file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.copyFileSync.mockImplementation(() => {});

      const result = FileOutputManager.createBackup('/test/file.json');
      
      expect(mockFs.copyFileSync).toHaveBeenCalled();
      expect(result).toMatch(/\/test\/file\.json\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = FileOutputManager.createBackup('/test/missing.json');
      expect(result).toBeNull();
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should return null if backup creation fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.copyFileSync.mockImplementation(() => {
        throw new Error('Copy failed');
      });

      const result = FileOutputManager.createBackup('/test/file.json');
      expect(result).toBeNull();
    });
  });

  describe('encoding validation', () => {
    it('should validate correct encodings', () => {
      expect(FileOutputManager.isValidEncoding('utf8')).toBe(true);
      expect(FileOutputManager.isValidEncoding('utf16le')).toBe(true);
      expect(FileOutputManager.isValidEncoding('ascii')).toBe(true);
      expect(FileOutputManager.isValidEncoding('latin1')).toBe(true);
      expect(FileOutputManager.isValidEncoding('base64')).toBe(true);
    });

    it('should reject invalid encodings', () => {
      expect(FileOutputManager.isValidEncoding('invalid')).toBe(false);
      expect(FileOutputManager.isValidEncoding('utf32')).toBe(false);
    });

    it('should return supported encodings list', () => {
      const supportedEncodings = FileOutputManager.getSupportedEncodings();
      expect(supportedEncodings).toContain('utf8');
      expect(supportedEncodings).toContain('utf16le');
      expect(supportedEncodings).toContain('ascii');
      expect(supportedEncodings).toContain('latin1');
      expect(supportedEncodings).toContain('base64');
    });
  });
});