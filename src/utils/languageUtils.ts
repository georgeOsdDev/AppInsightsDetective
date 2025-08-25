import { SupportedLanguage } from '../types';

/**
 * Get language options for prompts
 */
export function getLanguageOptions() {
  return [
    { name: '🌐 Auto - Detect best language', value: 'auto' },
    { name: '🇺🇸 English', value: 'en' },
    { name: '🇯🇵 Japanese (日本語)', value: 'ja' },
    { name: '🇰🇷 Korean (한국어)', value: 'ko' },
    { name: '🇨🇳 Chinese Simplified (简体中文)', value: 'zh' },
    { name: '🇹🇼 Chinese Traditional (繁體中文)', value: 'zh-TW' },
    { name: '🇪🇸 Spanish (Español)', value: 'es' },
    { name: '🇫🇷 French (Français)', value: 'fr' },
    { name: '🇩🇪 German (Deutsch)', value: 'de' },
    { name: '🇮🇹 Italian (Italiano)', value: 'it' },
    { name: '🇵🇹 Portuguese (Português)', value: 'pt' },
    { name: '🇷🇺 Russian (Русский)', value: 'ru' },
    { name: '🇸🇦 Arabic (العربية)', value: 'ar' }
  ];
}

/**
 * Get language name from code
 */
export function getLanguageName(languageCode: SupportedLanguage): string {
  const languageMap: Record<SupportedLanguage, string> = {
    'auto': 'Auto-detect',
    'en': 'English',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
  };
  return languageMap[languageCode] || 'Unknown';
}

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