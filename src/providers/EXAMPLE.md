# Example Usage

This directory contains examples of how the Jac Definition Provider works.

## Example Project Structure

```
example-project/
├── main.py          # Python file with Jac imports
├── app.jac          # Main Jac module
├── utils.jac        # Utility Jac module
└── modules/
    ├── auth.jac     # Authentication module
    └── db.jac       # Database module
```

## main.py
```python
# These imports will all work with Go to Definition
import app           # -> Goes to app.jac
import utils         # -> Goes to utils.jac
import modules.auth  # -> Goes to modules/auth.jac
import modules.db    # -> Goes to modules/db.jac

from app import something     # -> Goes to app.jac
from modules.auth import User # -> Goes to modules/auth.jac

# Multiple imports
import app, utils, modules.auth  # Each can be clicked individually

# Import with alias
import app as application  # Clicking 'app' goes to app.jac
```

## app.jac
```jac
"""Main application module."""

with entry {
    print("Hello from Jac!");
}
```

## modules/auth.jac
```jac
"""Authentication module."""

class User {
    has name: str;
    has email: str;
}
```

## How to Test

1. Create the project structure above
2. Open `main.py` in VS Code
3. Ctrl+Click (or Cmd+Click) on any import module name
4. VS Code should navigate to the corresponding `.jac` file
5. Enable developer mode in settings to see debug messages