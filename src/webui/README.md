# AppInsights Detective WebUI

This directory contains the web-based user interface for AppInsights Detective.

## Features

### New React-based Implementation ✨
- **React + TypeScript**: Modern component-based architecture with full type safety
- **Improved Design System**: Professional UI with light/dark theme support
- **Enhanced Configuration Management**: Comprehensive settings interface with real-time status
- **Better State Management**: React Context for global state and settings
- **Component Architecture**: Modular, maintainable components with proper separation of concerns
- **Modern Build System**: Webpack-based build with hot reloading during development

### Core Functionality
- **Express.js Server**: TypeScript-based web server with security middleware
- **REST API**: Complete API for query operations, session management, templates, and configuration
- **WebSocket Support**: Real-time updates for query generation and execution
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Azure Authentication**: Integration with existing Azure Managed Identity
- **Query Interface**: Support for Smart, Review, and Raw KQL modes
- **Results Display**: Table view with data formatting and export capabilities
- **Template Management**: Enhanced template discovery and usage interface
- **Query History**: Improved history with search, filter, and management features

### Architecture

#### Backend (`src/webui/server/`)
- **WebUIService**: Main service class managing the Express server
- **Routes**: RESTful API endpoints for all operations
- **Middleware**: Authentication and security middleware
- **WebSocket**: Real-time communication handler

#### Frontend Options
1. **React UI** (`src/webui/react/`) - **Recommended**
   - Modern React + TypeScript components
   - Enhanced styling with CSS design tokens
   - Context-based state management
   - Comprehensive configuration interface

2. **Legacy UI** (`src/webui/public/`) - **Maintained for compatibility**
   - Original vanilla HTML/CSS/JS implementation
   - Automatic fallback if React build unavailable

## Usage

```bash
# Start WebUI with default settings (React UI, localhost:3000)
aidx webui

# Start on specific port
aidx webui --port 8080

# Start without auto-opening browser
aidx webui --no-open

# Start with specific host binding
aidx webui --host 0.0.0.0 --port 3000

# Force React UI (automatically detected by default)
aidx webui --react

# Development with hot reloading (React only)
npm run dev:react
```

## Development

### Building the React UI

```bash
# Build React application
npm run build:react

# Build entire project (includes React)
npm run build

# Development server with hot reloading
npm run dev:react
```

### React Component Structure

```
src/webui/react/src/
├── components/
│   ├── Header.tsx          # App header with theme toggle
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── QueryPanel.tsx      # Query editor and execution
│   ├── TemplatePanel.tsx   # Template management
│   ├── HistoryPanel.tsx    # Query history
│   └── SettingsModal.tsx   # Configuration management
├── contexts/
│   ├── AppContext.tsx      # Global app state
│   └── ThemeContext.tsx    # Theme management
├── services/
│   └── api.ts              # API client
├── styles/
│   └── App.css             # Main stylesheet with design tokens
└── types/                  # TypeScript type definitions
```

## Configuration Management

The React UI provides an enhanced configuration interface with:

- **Real-time Status**: Live validation of Azure connections
- **Tabbed Interface**: Organized settings across General, Configuration, and Advanced tabs  
- **Theme Management**: Light/dark theme with system preference detection
- **Export/Import**: Backup and restore settings
- **Configuration Validation**: Visual status indicators for all services

## API Endpoints

### Query Operations
- `POST /api/query/generate` - Generate KQL from natural language
- `POST /api/query/execute` - Execute query
- `POST /api/query/explain` - Get query explanation
- `POST /api/query/regenerate` - Regenerate query with feedback

### Session Management
- `POST /api/session/start` - Start new session
- `GET /api/session/history` - Get session history
- `PUT /api/session/settings` - Update session settings
- `DELETE /api/session/end` - End session

### Templates
- `GET /api/templates` - List available templates
- `GET /api/templates/:id` - Get template details
- `POST /api/templates/:id/use` - Use template with parameters

### Configuration
- `GET /api/config` - Get current configuration
- `GET /api/config/status` - Get configuration status

### Portal Integration
- `POST /api/portal/open` - Generate Azure Portal links

## Security

- **Authentication**: Azure Managed Identity integration
- **CORS**: Restrictive policy (localhost only by default)
- **CSP**: Content Security Policy headers
- **Input Validation**: All user inputs are validated and sanitized

## Future Enhancements

- ~~Template management interface~~ ✅ **Completed**
- ~~Query editing with syntax highlighting~~ ⏳ **In Progress**
- ~~Enhanced chart visualizations~~ ⏳ **Planned**
- ~~Configuration management through web interface~~ ✅ **Completed**
- ~~Export functionality improvements~~ ⏳ **Planned**
- **Code Completion**: IntelliSense for KQL queries
- **Query Sharing**: Share queries via URLs
- **Dashboard Builder**: Create custom dashboards from query results
- **Advanced Visualizations**: Charts, graphs, and custom visualizations