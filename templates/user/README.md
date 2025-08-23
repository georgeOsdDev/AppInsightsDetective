# User Templates Directory

This directory is for user-created custom templates. Place your template JSON files here and they will be automatically loaded by AppInsights Detective.

## Template File Format

Templates should be saved as JSON files with the `.json` extension. Each file should contain a single template object:

```json
{
  "id": "my-custom-template",
  "name": "My Custom Template",
  "description": "Description of what this template does",
  "category": "Custom",
  "kqlTemplate": "your KQL query with {{parameter}} placeholders",
  "parameters": [
    {
      "name": "parameter",
      "type": "string",
      "description": "Parameter description",
      "required": true,
      "defaultValue": "default_value",
      "validValues": ["option1", "option2"]
    }
  ],
  "metadata": {
    "author": "Your Name",
    "version": "1.0.0",
    "tags": ["tag1", "tag2"]
  }
}
```

## Parameter Types

- `string`: Text values
- `number`: Numeric values
- `datetime`: Date/time values
- `timespan`: Time duration values (e.g., "1h", "30m")

## Creating Templates

You can create templates in several ways:

1. **Interactive creation**: Use `aidx template create` for guided template creation
2. **From file**: Use `aidx template create --file template.json` to load from a file
3. **Manual**: Create JSON files directly in this directory

## Example

See `custom-trace-analysis.json.example` for a complete example template. Copy it to `custom-trace-analysis.json` to use it.

## Managing Templates

- **List**: `aidx template list` - View all available templates
- **Show**: `aidx template show <id>` - View template details
- **Use**: `aidx template use <id>` - Execute a template interactively
- **Delete**: `aidx template delete <id>` - Remove a user-created template

## Built-in Templates

The system includes several built-in templates:
- **requests-overview**: Web request performance analysis
- **errors-analysis**: Application exception analysis  
- **performance-insights**: Performance counter metrics
- **dependency-analysis**: External dependency call analysis

Use `aidx template categories` to see all template categories.