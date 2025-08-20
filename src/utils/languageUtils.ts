import { SupportedLanguage } from '../types';

/**
 * Get language-specific instructions for AI prompts
 */
export function getLanguageInstructions(language: SupportedLanguage): string {
  switch (language) {
    case 'ja':
      return 'Respond in Japanese (日本語). Use technical terms in Japanese where appropriate, but include English terms in parentheses for clarity.';
    case 'ko':
      return 'Respond in Korean (한국어). Use technical terms in Korean where appropriate, but include English terms in parentheses for clarity.';
    case 'zh':
      return 'Respond in Simplified Chinese (简体中文). Use technical terms in Chinese where appropriate, but include English terms in parentheses for clarity.';
    case 'zh-TW':
      return 'Respond in Traditional Chinese (繁體中文). Use technical terms in Chinese where appropriate, but include English terms in parentheses for clarity.';
    case 'es':
      return 'Respond in Spanish (Español). Use technical terms in Spanish where appropriate, but include English terms in parentheses for clarity.';
    case 'fr':
      return 'Respond in French (Français). Use technical terms in French where appropriate, but include English terms in parentheses for clarity.';
    case 'de':
      return 'Respond in German (Deutsch). Use technical terms in German where appropriate, but include English terms in parentheses for clarity.';
    case 'it':
      return 'Respond in Italian (Italiano). Use technical terms in Italian where appropriate, but include English terms in parentheses for clarity.';
    case 'pt':
      return 'Respond in Portuguese (Português). Use technical terms in Portuguese where appropriate, but include English terms in parentheses for clarity.';
    case 'ru':
      return 'Respond in Russian (Русский). Use technical terms in Russian where appropriate, but include English terms in parentheses for clarity.';
    case 'ar':
      return 'Respond in Arabic (العربية). Use technical terms in Arabic where appropriate, but include English terms in parentheses for clarity.';
    case 'en':
      return 'Respond in English. Use clear and precise technical terminology.';
    case 'auto':
    default:
      return 'Respond in the most appropriate language based on the context. If unclear, use English as the default language.';
  }
}

/**
 * Resolve effective language with fallback logic
 */
export function resolveEffectiveLanguage(
  language: SupportedLanguage | undefined,
  configLanguage: string | undefined
): SupportedLanguage {
  return language || (configLanguage as SupportedLanguage) || 'auto';
}