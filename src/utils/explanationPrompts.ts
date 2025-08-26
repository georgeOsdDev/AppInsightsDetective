import inquirer from 'inquirer';
import { SupportedLanguage, ExplanationOptions } from '../types';
import { getLanguageOptions } from './languageUtils';

/**
 * Prompt user for explanation options (language, technical level, include examples)
 */
export async function promptForExplanationOptions(): Promise<ExplanationOptions> {
  const languageOptions = getLanguageOptions();
  
  const { selectedLanguage, technicalLevel, includeExamples } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedLanguage',
      message: 'Select explanation language:',
      choices: languageOptions,
      default: 'auto'
    },
    {
      type: 'list',
      name: 'technicalLevel',
      message: 'Select technical level:',
      choices: [
        { name: '🟢 Beginner - Simple explanations with basic concepts', value: 'beginner' },
        { name: '🟡 Intermediate - Balanced technical explanations', value: 'intermediate' },
        { name: '🔴 Advanced - Detailed technical insights', value: 'advanced' }
      ],
      default: 'intermediate'
    },
    {
      type: 'confirm',
      name: 'includeExamples',
      message: 'Include practical examples?',
      default: true
    }
  ]);

  return {
    language: selectedLanguage,
    technicalLevel,
    includeExamples
  };
}