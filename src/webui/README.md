# AppInsights Detective WebUI

This directory contains the Next.js-based web user interface for AppInsights Detective.

## Features

### Next.js with React Implementation
- **Next.js Full-Stack Framework**: Modern React with server-side capabilities
- **TypeScript**: Full type safety across frontend and backend
- **API Routes**: Next.js API routes replacing Express endpoints
- **Server-Side Rendering**: Built-in SSR/SSG for better performance
- **Modern React Patterns**: Hooks, Context API, and component-based architecture
- **Hot Reloading**: Fast development experience with automatic rebuilds

### Core Functionality
- **Query Interface**: Support for Smart, Review, and Raw KQL modes
- **Results Display**: Professional table view with data formatting and export capabilities
- **Template Management**: Enhanced template discovery and usage interface
- **Query History**: Improved history with search, filter, and management features
- **Azure Authentication**: Integration with Azure Managed Identity
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Theme Support**: Light/dark theme with system preference detection

### Architecture

#### Next.js Application (`src/webui/nextjs/`)
- **API Routes** (`pages/api/`): Server-side API endpoints replacing Express routes
- **React Components** (`components/`): Modern React components with TypeScript
- **Service Integration** (`lib/`): Service container adapter for Next.js compatibility
- **Pages** (`pages/`): Application pages with automatic routing

## Usage

```bash
# Start Next.js WebUI (default)
aidx webui

# Start on specific port
aidx webui --port 8080

# Start without auto-opening browser
aidx webui --no-open

# Start with specific host binding
aidx webui --host 0.0.0.0 --port 3000

# Development with hot reloading
npm run dev:nextjs
```

## Development

### Building the Next.js Application

```bash
# Build Next.js application
npm run build:nextjs

# Build entire project (includes Next.js)
npm run build

# Development server with hot reloading
npm run dev:nextjs

# Production server
npm run start:nextjs
```

### Next.js Structure

```
src/webui/nextjs/
├── pages/
│   ├── api/                 # API routes (replaces Express routes)
│   │   ├── query/          # Query operations
│   │   ├── session/        # Session management  
│   │   ├── templates/      # Template management
│   │   └── health.ts       # Health check
│   ├── _app.tsx            # App wrapper with providers
│   └── index.tsx           # Main application page
├── components/             # React components
│   ├── Header.tsx          # App header with theme toggle
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── QueryPanel.tsx      # Query editor and execution
│   ├── TemplatePanel.tsx   # Template management
│   ├── HistoryPanel.tsx    # Query history
│   └── SettingsModal.tsx   # Configuration management
├── lib/                    # Service utilities
│   ├── serviceContainer.ts # Service container adapter
│   └── auth.ts            # Authentication utilities
└── styles/                # CSS styling
```

## API Endpoints

### Query Operations
- `POST /api/query/generate` - Generate KQL from natural language
- `POST /api/query/execute` - Execute query
- `POST /api/query/explain` - Get query explanation  
- `POST /api/query/regenerate` - Regenerate query with feedback

### Session Management
- `POST /api/session/start` - Start new session
- `GET /api/session/history` - Get session history

### Templates
- `GET /api/templates` - List available templates

### Health Check
- `GET /api/health` - API health status

## Security

- **Authentication**: Azure Managed Identity integration
- **Built-in Security**: Next.js security best practices
- **Input Validation**: All user inputs are validated and sanitized
- **TypeScript**: Type safety prevents common security issues

## Modern Benefits

- **Performance**: Built-in optimizations, code splitting, image optimization
- **Developer Experience**: Hot reloading, TypeScript integration, modern tooling
- **Deployment**: Simplified build and deployment process
- **Maintenance**: Single framework reduces complexity