# AppInsights Detective WebUI

This directory contains the web-based user interface for AppInsights Detective.

## Features

### Current Implementation
- **Express.js Server**: TypeScript-based web server with security middleware
- **REST API**: Complete API for query operations, session management, templates, and configuration
- **WebSocket Support**: Real-time updates for query generation and execution
- **Responsive Frontend**: Modern HTML/CSS/JS interface with multiple panels
- **Azure Authentication**: Integration with existing Azure Managed Identity
- **Query Interface**: Support for Smart, Review, and Raw KQL modes
- **Results Display**: Table view with data formatting and export capabilities

### Architecture

#### Backend (`src/webui/server/`)
- **WebUIService**: Main service class managing the Express server
- **Routes**: RESTful API endpoints for all operations
- **Middleware**: Authentication and security middleware
- **WebSocket**: Real-time communication handler

#### Frontend (`src/webui/public/`)
- **HTML**: Single-page application structure
- **CSS**: Responsive design with dark mode support
- **JavaScript**: Modern vanilla JS with API client and utilities

## Usage

```bash
# Start WebUI with default settings (localhost:3000)
aidx webui

# Start on specific port
aidx webui --port 8080

# Start without auto-opening browser
aidx webui --no-open

# Start with specific host binding
aidx webui --host 0.0.0.0 --port 3000
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

- Template management interface
- Query editing with syntax highlighting
- Enhanced chart visualizations
- Configuration management through web interface
- Export functionality improvements