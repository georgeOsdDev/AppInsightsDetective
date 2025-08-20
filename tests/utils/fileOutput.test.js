"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const fileOutput_1 = require("../../src/utils/fileOutput");
// Mock fs module
jest.mock('fs');
const mockFs = fs;
describe('FileOutputManager', () => {
    const mockFormattedOutput = {
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
            mockFs.writeFileSync.mockImplementation(() => { });
            await fileOutput_1.FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json');
            expect(mockFs.writeFileSync).toHaveBeenCalledWith('/test/output.json', 'test content', { encoding: 'utf8' });
        });
        it('should create directory if it does not exist', async () => {
            mockFs.existsSync.mockReturnValue(false);
            mockFs.mkdirSync.mockImplementation(() => '');
            mockFs.writeFileSync.mockImplementation(() => { });
            await fileOutput_1.FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json');
            expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test', { recursive: true });
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });
        it('should use custom encoding', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.writeFileSync.mockImplementation(() => { });
            await fileOutput_1.FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json', 'utf16le');
            expect(mockFs.writeFileSync).toHaveBeenCalledWith('/test/output.json', 'test content', { encoding: 'utf16le' });
        });
        it('should throw error if write fails', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });
            await expect(fileOutput_1.FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json'))
                .rejects.toThrow('Failed to write file: Error: Write failed');
        });
        it('should throw error if directory creation fails', async () => {
            mockFs.existsSync.mockReturnValue(false);
            mockFs.mkdirSync.mockImplementation(() => {
                throw new Error('mkdir failed');
            });
            await expect(fileOutput_1.FileOutputManager.writeToFile(mockFormattedOutput, '/test/output.json'))
                .rejects.toThrow('Failed to write file: Error: mkdir failed');
        });
    });
    describe('generateFileName', () => {
        it('should generate filename with correct extension', () => {
            const options = {
                format: 'json',
                destination: 'file'
            };
            const fileName = fileOutput_1.FileOutputManager.generateFileName(options, './output');
            expect(fileName).toMatch(/query-result-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
            expect(fileName).toContain('output');
            expect(fileName.endsWith('.json')).toBe(true);
        });
        it('should generate filename for different formats', () => {
            const csvOptions = { format: 'csv', destination: 'file' };
            const tsvOptions = { format: 'tsv', destination: 'file' };
            const rawOptions = { format: 'raw', destination: 'file' };
            expect(fileOutput_1.FileOutputManager.generateFileName(csvOptions)).toContain('.csv');
            expect(fileOutput_1.FileOutputManager.generateFileName(tsvOptions)).toContain('.tsv');
            expect(fileOutput_1.FileOutputManager.generateFileName(rawOptions)).toContain('.txt');
        });
        it('should use custom base directory', () => {
            const options = {
                format: 'json',
                destination: 'file'
            };
            const fileName = fileOutput_1.FileOutputManager.generateFileName(options, './custom');
            expect(fileName).toMatch(/query-result-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
            expect(fileName).toContain('custom');
            expect(fileName.endsWith('.json')).toBe(true);
        });
    });
    describe('resolveOutputPath', () => {
        it('should add extension if missing', () => {
            const result = fileOutput_1.FileOutputManager.resolveOutputPath('/path/file', 'json');
            expect(result).toBe('/path/file.json');
        });
        it('should keep existing correct extension', () => {
            const result = fileOutput_1.FileOutputManager.resolveOutputPath('/path/file.json', 'json');
            expect(result).toBe('/path/file.json');
        });
        it('should warn about mismatched extension but keep it', () => {
            const result = fileOutput_1.FileOutputManager.resolveOutputPath('/path/file.txt', 'json');
            expect(result).toBe('/path/file.txt');
        });
        it('should handle different formats', () => {
            expect(fileOutput_1.FileOutputManager.resolveOutputPath('/path/file', 'csv')).toBe('/path/file.csv');
            expect(fileOutput_1.FileOutputManager.resolveOutputPath('/path/file', 'tsv')).toBe('/path/file.tsv');
            expect(fileOutput_1.FileOutputManager.resolveOutputPath('/path/file', 'raw')).toBe('/path/file.txt');
        });
    });
    describe('checkWritePermission', () => {
        it('should return true for writable path', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.accessSync.mockImplementation(() => { });
            const result = fileOutput_1.FileOutputManager.checkWritePermission('/writable/path.json');
            expect(result).toBe(true);
        });
        it('should return true if directory can be created', () => {
            mockFs.existsSync.mockImplementation((pathArg) => {
                const pathStr = pathArg.toString();
                return pathStr === '/test' || pathStr.endsWith('path.json'); // directory exists but file doesn't
            });
            mockFs.accessSync.mockImplementation(() => { });
            const result = fileOutput_1.FileOutputManager.checkWritePermission('/test/path.json');
            expect(result).toBe(true);
        });
        it('should return false if directory cannot be created', () => {
            mockFs.existsSync.mockReturnValue(false);
            mockFs.mkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });
            const result = fileOutput_1.FileOutputManager.checkWritePermission('/readonly/path.json');
            expect(result).toBe(false);
        });
        it('should return false if file is not writable', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.accessSync.mockImplementation(() => {
                throw new Error('Access denied');
            });
            const result = fileOutput_1.FileOutputManager.checkWritePermission('/readonly/path.json');
            expect(result).toBe(false);
        });
    });
    describe('getFileStats', () => {
        it('should return file stats if file exists', () => {
            const mockStats = { size: 1024, isFile: () => true };
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue(mockStats);
            const result = fileOutput_1.FileOutputManager.getFileStats('/test/file.json');
            expect(result).toBe(mockStats);
        });
        it('should return null if file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = fileOutput_1.FileOutputManager.getFileStats('/test/missing.json');
            expect(result).toBeNull();
        });
        it('should return null if stat fails', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockImplementation(() => {
                throw new Error('Stat failed');
            });
            const result = fileOutput_1.FileOutputManager.getFileStats('/test/file.json');
            expect(result).toBeNull();
        });
    });
    describe('createBackup', () => {
        it('should create backup if file exists', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.copyFileSync.mockImplementation(() => { });
            const result = fileOutput_1.FileOutputManager.createBackup('/test/file.json');
            expect(mockFs.copyFileSync).toHaveBeenCalled();
            expect(result).toMatch(/\/test\/file\.json\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
        });
        it('should return null if file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = fileOutput_1.FileOutputManager.createBackup('/test/missing.json');
            expect(result).toBeNull();
            expect(mockFs.copyFileSync).not.toHaveBeenCalled();
        });
        it('should return null if backup creation fails', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.copyFileSync.mockImplementation(() => {
                throw new Error('Copy failed');
            });
            const result = fileOutput_1.FileOutputManager.createBackup('/test/file.json');
            expect(result).toBeNull();
        });
    });
    describe('encoding validation', () => {
        it('should validate correct encodings', () => {
            expect(fileOutput_1.FileOutputManager.isValidEncoding('utf8')).toBe(true);
            expect(fileOutput_1.FileOutputManager.isValidEncoding('utf16le')).toBe(true);
            expect(fileOutput_1.FileOutputManager.isValidEncoding('ascii')).toBe(true);
            expect(fileOutput_1.FileOutputManager.isValidEncoding('latin1')).toBe(true);
            expect(fileOutput_1.FileOutputManager.isValidEncoding('base64')).toBe(true);
        });
        it('should reject invalid encodings', () => {
            expect(fileOutput_1.FileOutputManager.isValidEncoding('invalid')).toBe(false);
            expect(fileOutput_1.FileOutputManager.isValidEncoding('utf32')).toBe(false);
        });
        it('should return supported encodings list', () => {
            const supportedEncodings = fileOutput_1.FileOutputManager.getSupportedEncodings();
            expect(supportedEncodings).toContain('utf8');
            expect(supportedEncodings).toContain('utf16le');
            expect(supportedEncodings).toContain('ascii');
            expect(supportedEncodings).toContain('latin1');
            expect(supportedEncodings).toContain('base64');
        });
    });
});
//# sourceMappingURL=fileOutput.test.js.map