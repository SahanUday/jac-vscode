# Jac Definition Provider for Python Files

This feature enables "Go to Definition" functionality for Python imports that reference Jac modules. When you have Python files importing Jac modules, you can now click on the import statement and navigate directly to the Jac file.

## Features

- **Import Resolution**: Supports various Python import styles:
  - `import app` (where `app` is a Jac module)
  - `import app.submodule`
  - `from app import something`
  - `import app as alias`
  - Multi-line imports

- **Smart File Discovery**: The provider searches for Jac files in multiple locations:
  - Relative to the current Python file
  - In the workspace root directory
  - In common source directories (`src/`, `lib/`)
  - Recursive search throughout the workspace

- **Configurable**: The feature can be enabled/disabled via VS Code settings

## Usage

1. Open a Python file that imports a Jac module
2. Ctrl+Click (or Cmd+Click on Mac) on the module name in the import statement
3. VS Code will navigate to the corresponding `.jac` file

## Configuration

The feature can be controlled through VS Code settings:

- **Enable/Disable**: `jaclang-extension.enableJacDefinitionProvider` (default: `true`)
- **Debug Mode**: Enable `jaclang-extension.developerMode` for debugging information

## Commands

- `Jac: Toggle Python->Jac Go to Definition` - Toggle the feature on/off

## File Resolution Rules

The provider uses the following resolution order:

1. **Exact file match**: `module_name.jac`
2. **Directory with index**: `module_name/index.jac` or `module_name/__init__.jac`
3. **Relative to current file**: Searches relative to the Python file's directory
4. **Workspace root**: Searches in the workspace root
5. **Source directories**: Searches in common directories like `src/`, `lib/`
6. **Recursive search**: Searches throughout the workspace for matching files

## Examples

Given the following project structure:
```
project/
├── main.py
├── app.jac
├── modules/
│   └── utils.jac
└── src/
    └── core/
        └── engine.jac
```

In `main.py`, these imports will work:
```python
import app           # -> app.jac
import modules.utils # -> modules/utils.jac
import src.core.engine # -> src/core/engine.jac
```

## Troubleshooting

- **Import not resolving**: Enable developer mode to see debug messages about file resolution
- **False positives**: The provider only activates for imports that actually correspond to Jac files
- **Performance**: Large workspaces may have slower resolution due to recursive file searching

## Technical Details

The feature is implemented as a VS Code Definition Provider that:
- Only activates for Python files
- Parses import statements to extract module names
- Searches for corresponding `.jac` files using multiple strategies
- Returns the file location for VS Code to navigate to