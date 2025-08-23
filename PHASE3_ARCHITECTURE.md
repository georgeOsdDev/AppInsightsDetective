# Phase 3: Service Architecture Refactoring

This document describes the Phase 3 implementation of the strategic refactoring outlined in issue #35, focusing on service architecture separation and dependency injection.

## Overview

Phase 3 introduces a clean separation of concerns by splitting the monolithic `InteractiveService` into specialized components and implementing provider abstraction patterns. This enables future extensibility while maintaining backward compatibility.

## Architecture Changes

### New Directory Structure

```
src/
├── core/
│   ├── interfaces/           # Core service contracts
│   ├── types/               # Common type definitions
│   └── contracts/           # Service contracts
├── providers/               # Provider implementations
│   ├── ai/                  # AI provider implementations
│   │   └── AzureOpenAIProvider.ts
│   └── datasource/         # Data source providers
│       └── ApplicationInsightsProvider.ts
├── services/
│   ├── orchestration/      # Business logic orchestration
│   │   └── QueryOrchestrator.ts
│   └── [existing services]
├── presentation/           # Presentation layer
│   ├── renderers/          # Output rendering
│   │   └── ConsoleOutputRenderer.ts
│   └── interactive/        # User interaction
│       └── InteractiveSessionController.ts
├── infrastructure/         # Infrastructure concerns
│   ├── factories/          # Service factories
│   │   └── ServiceFactory.ts
│   └── config/            # Enhanced configuration
│       └── EnhancedConfigurationProvider.ts
└── migration/             # Migration utilities
    └── Phase3Migration.ts
```

### Core Interfaces

#### IAIProvider
Abstracts AI providers (Azure OpenAI, OpenAI, Claude, etc.)
```typescript
interface IAIProvider {
  generateKQLQuery(query: string, schema?: any): Promise<NLQuery | null>;
  explainKQLQuery(query: string, options?: ExplanationOptions): Promise<string>;
  regenerateKQLQuery(question: string, context: RegenerationContext): Promise<NLQuery | null>;
  // ...
}
```

#### IDataSourceProvider
Abstracts data sources (Application Insights, Log Analytics, etc.)
```typescript
interface IDataSourceProvider {
  executeQuery(query: string): Promise<QueryResult>;
  validateConnection(): Promise<{isValid: boolean; error?: string}>;
  getSchema(): Promise<any>;
  // ...
}
```

#### IQueryOrchestrator
Coordinates business logic between AI and data sources
```typescript
interface IQueryOrchestrator {
  executeNaturalLanguageQuery(request: QueryExecutionRequest): Promise<QueryExecutionResult>;
  executeRawQuery(query: string): Promise<QueryExecutionResult>;
  analyzeResults(result: QueryResult): Promise<AnalysisResult>;
}
```

#### IOutputRenderer
Handles result presentation and formatting
```typescript
interface IOutputRenderer {
  renderQueryResult(result: QueryResult, options?: RenderOptions): Promise<RenderedOutput>;
  renderAnalysisResult(analysis: AnalysisResult): Promise<RenderedOutput>;
  saveToFile(output: RenderedOutput, filePath: string): Promise<void>;
}
```

#### ISessionController
Manages user interaction and UI/UX flow
```typescript
interface ISessionController {
  startSession(): Promise<void>;
  processUserInput(input: string): Promise<void>;
  selectExecutionMode(): Promise<'direct' | 'step' | 'raw'>;
}
```

### Service Separation

#### Before (Monolithic)
```typescript
class InteractiveService {
  // Mixed responsibilities:
  // - User interaction
  // - Query orchestration  
  // - Result formatting
  // - Business logic
}
```

#### After (Phase 3)
```typescript
// UI/UX Interaction
class InteractiveSessionController implements ISessionController {
  constructor(
    private queryOrchestrator: IQueryOrchestrator,
    private outputRenderer: IOutputRenderer
  ) {}
}

// Business Logic Coordination
class QueryOrchestrator implements IQueryOrchestrator {
  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider
  ) {}
}

// Result Presentation
class ConsoleOutputRenderer implements IOutputRenderer {
  // Focused on rendering and output formatting
}
```

## Provider Implementations

### AzureOpenAIProvider
- Implements `IAIProvider` interface
- Supports both API key and Managed Identity authentication
- Handles KQL generation, explanation, and regeneration
- Includes query validation and security checks

### ApplicationInsightsProvider  
- Implements `IDataSourceProvider` interface
- Executes KQL queries against Application Insights
- Provides connection validation and schema retrieval
- Returns structured query results

## Configuration Enhancement

### Enhanced Configuration Provider
```typescript
interface EnhancedConfiguration extends Config {
  providers?: {
    ai?: Record<string, ProviderConfiguration>;
    dataSources?: Record<string, ProviderConfiguration>;
  };
}
```

Supports:
- Provider-specific configurations
- Auto-discovery of Azure resources
- Configuration validation
- Migration from legacy format

## Service Factory

The `ServiceFactory` provides dependency injection and service creation:

```typescript
// Create complete service stack
const services = await ServiceFactory.createServices();

// Create individual providers
const aiProvider = await ServiceFactory.createAIProvider('azure-openai');
const dataSource = await ServiceFactory.createDataSourceProvider('application-insights');
```

## Migration Strategy

### Backward Compatibility

The `Phase3Migration` class provides seamless migration:

```typescript
// Automatic fallback to legacy if Phase 3 fails
const service = new Phase3InteractiveService();
await service.startSession(); // Uses Phase 3 or legacy automatically
```

### Migration Path

1. **Existing code continues to work** - No immediate changes required
2. **Gradual adoption** - Services can be migrated incrementally  
3. **Feature flags** - New architecture can be enabled/disabled
4. **Validation** - Built-in checks ensure configuration compatibility

## Benefits

### Extensibility
- Easy to add new AI providers (OpenAI, Claude, etc.)
- Simple data source expansion (Log Analytics, Custom APIs)
- Pluggable output renderers (Console, Web, API)

### Testability
- Each component can be tested in isolation
- Mock implementations for unit testing
- Clear interfaces enable comprehensive testing

### Maintainability
- Single responsibility principle
- Clear separation of concerns
- Reduced coupling between components

### Future-Proofing
- Provider pattern supports new integrations
- Interface-based design enables swapping implementations
- Configuration system supports feature evolution

## Usage Examples

### Basic Usage
```typescript
import { ServiceFactory } from './infrastructure/factories/ServiceFactory';

// Create and use services
const services = await ServiceFactory.createServices();
await services.sessionController.startSession();
```

### Custom Provider Creation
```typescript
// Create specific providers
const aiProvider = await ServiceFactory.createAIProvider('azure-openai');
const customOrchestrator = ServiceFactory.createQueryOrchestrator(
  aiProvider,
  customDataSource
);
```

### Migration Usage
```typescript
import { Phase3InteractiveService } from './migration/Phase3Migration';

// Automatic migration with fallback
const service = new Phase3InteractiveService();
console.log(`Using: ${service.getArchitectureVersion()}`);
await service.startSession();
```

## Testing

### New Test Coverage
- `AzureOpenAIProvider.test.ts` - AI provider functionality
- `ServiceFactory.test.ts` - Dependency injection and service creation
- All existing tests continue to pass (238 tests total)

### Test Philosophy
- Mock all external dependencies
- Test interfaces, not implementations
- Comprehensive provider validation
- Migration path verification

## Performance Impact

- **Zero performance regression** - Same or better performance
- **Lazy loading** - Services initialize on demand
- **Efficient caching** - Singleton pattern for shared services
- **Memory optimization** - Clear object lifecycle management

## Breaking Changes

**None** - This is a non-breaking change. All existing APIs continue to work exactly as before.

## Next Steps (Future Phases)

1. **Phase 4**: Template System - Reusable query patterns
2. **Phase 5**: New Provider Support - OpenAI, Claude, Log Analytics
3. **Phase 6**: CLI Integration - Updated commands using new architecture

## Configuration Migration

Existing configurations work unchanged. Enhanced configurations support additional provider settings:

```json
{
  "appInsights": { "applicationId": "..." },
  "openAI": { "endpoint": "...", "deploymentName": "..." },
  "providers": {
    "ai": {
      "azure-openai": { "type": "azure-openai", "config": {...} }
    },
    "dataSources": {
      "application-insights": { "type": "application-insights", "config": {...} }
    }
  }
}
```

---

**Status**: ✅ **Phase 3 Complete**
- All core interfaces implemented
- Service separation complete
- Provider abstraction functional
- Backward compatibility maintained
- Tests passing (238/238)
- Zero breaking changes