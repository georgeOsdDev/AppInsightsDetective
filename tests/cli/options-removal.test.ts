import { program } from '../../src/cli/index';

describe('CLI Options Removal', () => {
  let originalArgv: string[];

  beforeEach(() => {
    // Store original process.argv
    originalArgv = process.argv;
  });

  afterEach(() => {
    // Restore original process.argv
    process.argv = originalArgv;
  });

  it('should not have --direct option available', () => {
    // Check if the program has the direct option
    const options = program.options;
    const hasDirectOption = options.some(option => 
      option.long === '--direct' || option.flags.includes('--direct')
    );
    
    expect(hasDirectOption).toBe(false);
  });

  it('should not have --language option available', () => {
    // Check if the program has the language option
    const options = program.options;
    const hasLanguageOption = options.some(option => 
      option.long === '--language' || option.short === '-l' || option.flags.includes('--language')
    );
    
    expect(hasLanguageOption).toBe(false);
  });

  it('should still have other essential options available', () => {
    const options = program.options;
    
    // Check that other essential options are still present
    const hasInteractiveOption = options.some(option => 
      option.long === '--interactive' || option.short === '-i'
    );
    const hasRawOption = options.some(option => 
      option.long === '--raw' || option.short === '-r'
    );
    const hasFormatOption = options.some(option => 
      option.long === '--format' || option.short === '-f'
    );
    
    expect(hasInteractiveOption).toBe(true);
    expect(hasRawOption).toBe(true);
    expect(hasFormatOption).toBe(true);
  });
});