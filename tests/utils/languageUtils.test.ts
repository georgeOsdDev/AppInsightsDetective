import { getLanguageOptions, getLanguageName } from '../../src/utils/languageUtils';
import { promptForExplanationOptions } from '../../src/utils/explanationPrompts';
import { SupportedLanguage } from '../../src/types';

describe('Language Utils', () => {
  describe('getLanguageOptions', () => {
    it('should return an array of language options', () => {
      const options = getLanguageOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
      
      // Check structure
      options.forEach(option => {
        expect(option).toHaveProperty('name');
        expect(option).toHaveProperty('value');
        expect(typeof option.name).toBe('string');
        expect(typeof option.value).toBe('string');
      });
    });

    it('should include auto option as default', () => {
      const options = getLanguageOptions();
      const autoOption = options.find(opt => opt.value === 'auto');
      expect(autoOption).toBeDefined();
      expect(autoOption!.name).toContain('Auto');
    });

    it('should include common languages', () => {
      const options = getLanguageOptions();
      const values = options.map(opt => opt.value);
      
      expect(values).toContain('en');
      expect(values).toContain('ja');
      expect(values).toContain('ko');
      expect(values).toContain('zh');
    });
  });

  describe('getLanguageName', () => {
    it('should return correct language names', () => {
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('ja')).toBe('Japanese');
      expect(getLanguageName('auto')).toBe('Auto-detect');
    });

    it('should return Unknown for unsupported language codes', () => {
      expect(getLanguageName('xyz' as SupportedLanguage)).toBe('Unknown');
    });
  });
});

describe('Explanation Prompts', () => {
  describe('promptForExplanationOptions', () => {
    // Since this involves inquirer prompts, we'll skip actual testing in automated tests
    // but verify the function exists and is exported correctly
    it('should be defined and callable', () => {
      expect(typeof promptForExplanationOptions).toBe('function');
      expect(promptForExplanationOptions).toBeDefined();
    });
  });
});