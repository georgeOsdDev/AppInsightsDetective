---
name: Architecture Refactoring for Multi-Provider Support
about: Strategic refactoring plan to support Azure Monitor integration, multiple AI providers, and query templates
title: '[ARCHITECTURE] Strategic Refactoring for Extensibility and Multi-Provider Support'
labels: ['enhancement', 'architecture', 'refactoring', 'breaking-change']
assignees: []
---

## 🎯 Objective

Strategic refactoring of AppInsights Detective's architecture to support future extensibility requirements:
- **Azure Monitor Integration**: Beyond Application Insights to Log Analytics, Metrics, etc.
- **Multi-AI Provider Support**: Azure OpenAI, OpenAI, Anthropic Claude, etc.
- **Query Template System**: Reusable, shareable query patterns
- **Plugin Architecture**: Extensible service ecosystem

## 🔍 Current Architecture Issues

### 1. **Tight Coupling & Concrete Dependencies**
```typescript
// Current: Direct concrete class dependencies
class InteractiveService {
  constructor(
    private aiService: AIService,           // ❌ Coupled to specific AI implementation
    private appInsightsService: AppInsightsService, // ❌ Coupled to AppInsights only
    // ...
  ) {}
}
```

### 2. **Service Responsibility Overlap**
- `AIService`: Mixes OpenAI client management + KQL generation logic
- `InteractiveService`: UI logic + business logic + output formatting
- `StepExecutionService`: Execution + user interaction + external integration
- `ConfigManager`: Configuration + resource discovery + auto-enhancement

### 3. **Hard-coded Provider Logic**
```typescript
// AIService.ts - Hard-coded Azure OpenAI
private async initializeOpenAI(): Promise<void> {
  // Only supports Azure OpenAI
  this.openAIClient = new OpenAI({
    apiKey: config.openAI.apiKey,
    baseURL: `${config.openAI.endpoint}/openai/deployments/${config.openAI.deploymentName}`,
  });
}
```

### 4. **Monolithic Data Source Support**
- Only Application Insights supported
- No abstraction for different Azure Monitor data sources
- Schema handling tied to AppInsights format

## 🏗️ Proposed Architecture

### Phase 1: Interface Abstraction & Dependency Injection

#### **1.1 Core Service Interfaces**
```typescript
// Core service contracts
interface IAuthenticationProvider {
  getAccessToken(scopes: string[]): Promise<string>;
  validateCredentials(): Promise<boolean>;
}

interface IAIProvider {
  generateQuery(request: QueryGenerationRequest): Promise<QueryResult>;
  explainQuery(request: QueryExplanationRequest): Promise<ExplanationResult>;
  regenerateQuery(request: RegenerationRequest): Promise<QueryResult>;
}

interface IDataSourceProvider {
  executeQuery(request: QueryExecutionRequest): Promise<QueryResult>;
  validateConnection(): Promise<ValidationResult>;
  getSchema(): Promise<SchemaResult>;
  getMetadata(): Promise<MetadataResult>;
}

interface ITemplateRepository {
  getTemplates(filter?: TemplateFilter): Promise<QueryTemplate[]>;
  saveTemplate(template: QueryTemplate): Promise<void>;
  searchTemplates(query: string): Promise<QueryTemplate[]>;
}
```

#### **1.2 Provider Factory Pattern**
```typescript
interface IProviderFactory {
  createAIProvider(type: AIProviderType, config: AIProviderConfig): IAIProvider;
  createDataSourceProvider(type: DataSourceType, config: DataSourceConfig): IDataSourceProvider;
  createAuthProvider(type: AuthType, config: AuthConfig): IAuthenticationProvider;
}

class ProviderFactory implements IProviderFactory {
  // Registry-based provider creation
  private aiProviders = new Map<AIProviderType, AIProviderConstructor>();
  private dataSourceProviders = new Map<DataSourceType, DataSourceConstructor>();
}
```

#### **1.3 Dependency Injection Container**
```typescript
interface IServiceContainer {
  register<T>(key: string, instance: T): void;
  resolve<T>(key: string): T;
  registerFactory<T>(key: string, factory: () => T): void;
}

// Usage in services
class QueryOrchestrator {
  constructor(
    private aiProvider: IAIProvider,
    private dataSourceProvider: IDataSourceProvider,
    private templateRepository: ITemplateRepository
  ) {}
}
```

### Phase 2: Provider Implementation

#### **2.1 AI Provider Implementations**
```typescript
class AzureOpenAIProvider implements IAIProvider {
  // Azure-specific implementation
}

class OpenAIProvider implements IAIProvider {
  // OpenAI API implementation
}

class AnthropicClaudeProvider implements IAIProvider {
  // Anthropic Claude implementation
}
```

#### **2.2 Data Source Provider Implementations**
```typescript
class ApplicationInsightsProvider implements IDataSourceProvider {
  // Current AppInsights logic
}

class LogAnalyticsProvider implements IDataSourceProvider {
  // Azure Monitor Logs support
}

class AzureMetricsProvider implements IDataSourceProvider {
  // Azure Monitor Metrics support
}

class CustomDataExplorerProvider implements IDataSourceProvider {
  // Azure Data Explorer support
}
```

### Phase 3: Service Architecture Refactoring

#### **3.1 Orchestration Layer**
```typescript
class QueryOrchestrator {
  async executeNaturalLanguageQuery(request: NLQueryRequest): Promise<QueryResult>;
  async executeTemplateQuery(request: TemplateQueryRequest): Promise<QueryResult>;
  async explainQuery(request: QueryExplanationRequest): Promise<ExplanationResult>;
}

class SessionManager {
  async createSession(options: SessionOptions): Promise<IQuerySession>;
  async getSession(sessionId: string): Promise<IQuerySession>;
}
```

#### **3.2 Business Logic Layer**
```typescript
class QueryService {
  constructor(
    private orchestrator: QueryOrchestrator,
    private templateService: TemplateService,
    private analysisService: AnalysisService
  ) {}
}

class TemplateService {
  async createTemplate(query: string, metadata: TemplateMetadata): Promise<QueryTemplate>;
  async searchTemplates(criteria: SearchCriteria): Promise<QueryTemplate[]>;
  async applyTemplate(template: QueryTemplate, parameters: TemplateParameters): Promise<string>;
}
```

#### **3.3 Presentation Layer**
```typescript
interface IOutputRenderer {
  renderQueryResult(result: QueryResult, options: RenderOptions): Promise<RenderedOutput>;
  renderAnalysisResult(analysis: AnalysisResult, options: RenderOptions): Promise<RenderedOutput>;
}

class InteractiveSessionController {
  constructor(
    private queryService: QueryService,
    private outputRenderer: IOutputRenderer,
    private sessionManager: SessionManager
  ) {}
}
```

## 📋 Implementation Plan

### **Phase 1: Foundation (Weeks 1-2)**
- [ ] Define core interfaces and contracts
- [ ] Implement dependency injection container
- [ ] Create provider factory pattern
- [ ] **Breaking Change**: Refactor existing services to use interfaces

### **Phase 2: Provider Abstraction (Weeks 3-4)**
- [ ] Extract Azure OpenAI to `AzureOpenAIProvider`
- [ ] Extract Application Insights to `ApplicationInsightsProvider`
- [ ] Implement provider registration system
- [ ] Add configuration schema for multiple providers

### **Phase 3: Service Separation (Weeks 5-6)**
- [ ] Split `InteractiveService` responsibilities
  - `InteractiveSessionController` (UI/UX)
  - `QueryOrchestrator` (business logic)
  - `OutputRenderer` (presentation)
- [ ] Refactor `AIService` into provider + service layers
- [ ] Extract configuration management from `ConfigManager`

### **Phase 4: Template System (Weeks 7-8)**
- [ ] Design template schema and storage
- [ ] Implement `TemplateRepository` interface
- [ ] Add template CRUD operations
- [ ] Integrate template system with query generation

### **Phase 5: New Provider Support (Weeks 9-10)**
- [ ] Implement `OpenAIProvider` (non-Azure)
- [ ] Add `LogAnalyticsProvider` for Azure Monitor Logs
- [ ] Create provider discovery mechanism
- [ ] Add provider-specific configuration validation

### **Phase 6: CLI Integration (Weeks 11-12)**
- [ ] Update CLI commands to use new architecture
- [ ] Add provider selection commands
- [ ] Implement template management CLI
- [ ] Update configuration setup wizard

## 🧪 Testing Strategy

### **Unit Testing**
- Mock all interfaces for isolated testing
- Provider-specific test suites
- Configuration validation tests

### **Integration Testing**
- Multi-provider scenarios
- Template system integration
- End-to-end query flows

### **Migration Testing**
- Backwards compatibility verification
- Configuration migration scripts
- Performance regression testing

## 📁 File Structure Changes

```
src/
├── core/                          # Core interfaces and contracts
│   ├── interfaces/
│   ├── types/
│   └── contracts/
├── providers/                     # Provider implementations
│   ├── ai/                        # AI provider implementations
│   ├── datasource/               # Data source providers
│   └── auth/                     # Authentication providers
├── services/                     # Business logic services
│   ├── query/                    # Query orchestration
│   ├── template/                 # Template management
│   ├── analysis/                 # Result analysis
│   └── session/                  # Session management
├── infrastructure/               # Infrastructure concerns
│   ├── di/                       # Dependency injection
│   ├── config/                   # Configuration management
│   └── logging/                  # Logging infrastructure
├── presentation/                 # Presentation layer
│   ├── cli/                      # CLI commands
│   ├── renderers/               # Output renderers
│   └── interactive/             # Interactive session handling
└── migration/                    # Migration utilities
```

## ⚠️ Breaking Changes

### **Configuration Format Changes**
```json
{
  "providers": {
    "ai": {
      "default": "azure-openai",
      "azure-openai": { /* config */ },
      "openai": { /* config */ }
    },
    "dataSources": {
      "default": "application-insights",
      "application-insights": { /* config */ },
      "log-analytics": { /* config */ }
    }
  },
  "templates": {
    "repository": "file", // or "azure-storage", "git"
    "path": "~/.aidx/templates"
  }
}
```

### **API Changes**
- Service constructors require interfaces instead of concrete classes
- Provider-specific configuration required
- Template system integration affects query generation

## 🎯 Success Criteria

1. **Extensibility**: New AI providers can be added with <50 lines of code
2. **Separation of Concerns**: Each service has single, well-defined responsibility
3. **Testability**: 95%+ code coverage with proper mocking
4. **Performance**: No regression in query execution time
5. **Compatibility**: Smooth migration path for existing users
6. **Documentation**: Complete API documentation and migration guides

## 🔗 Related Issues

- [ ] Multi-AI Provider Support (#TBD)
- [ ] Azure Monitor Integration (#TBD)
- [ ] Query Template System (#TBD)
- [ ] Plugin Architecture (#TBD)

## 💬 Discussion Points

1. **Provider Discovery**: How should the system discover available providers?
2. **Configuration Migration**: Automatic vs manual configuration migration strategy?
3. **Backwards Compatibility**: How long to maintain old API compatibility?
4. **Template Sharing**: Should templates be shareable across teams/organizations?
5. **Performance Impact**: Acceptable overhead for provider abstraction?

---

**Priority**: High
**Complexity**: High
**Impact**: High (Breaking Changes)
**Timeline**: 12 weeks
**Resources**: 2-3 developers + architecture review
