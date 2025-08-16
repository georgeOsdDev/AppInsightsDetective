<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AppInsights Detective - Copilot Instructions

This is a TypeScript Node.js CLI application for querying Azure Application Insights using natural language.

## Project Guidelines

### Architecture
- **CLI Interface**: Commander.js for command structure
- **Authentication**: Azure Managed Identity (DefaultAzureCredential)
- **AI Integration**: Azure OpenAI for natural language to KQL conversion
- **Data Access**: Application Insights REST API
- **Visualization**: Console-based charts and tables using chalk

### Key Technologies
- TypeScript for type safety
- Azure SDK (@azure/identity, @azure/openai)
- Commander.js for CLI framework
- Inquirer.js for interactive prompts
- Chalk for colored console output
- Winston for logging

### Code Standards
- Use TypeScript strict mode
- Implement proper error handling with try/catch
- Log important events using Winston logger
- Use Azure best practices (Managed Identity, secure secrets)
- Follow separation of concerns (services, utilities, CLI commands)

### Security Practices
- Never hardcode credentials
- Use Azure Managed Identity for authentication
- Validate all user inputs
- Sanitize KQL queries to prevent injection

### File Structure
- `/src/cli/` - CLI command definitions
- `/src/services/` - Business logic and Azure integrations
- `/src/utils/` - Helper utilities (config, logging, visualization)
- `/src/types/` - TypeScript type definitions
- `/config/` - Configuration files and examples

### Testing
- Write unit tests for services
- Mock Azure SDK calls in tests
- Test CLI commands with sample inputs

When generating code:
1. Follow existing patterns in the codebase
2. Use proper TypeScript types
3. Include error handling
4. Add logging for debugging
5. Follow Azure SDK best practices
