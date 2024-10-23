# auto-commit

Automatically generate git commit messages using AI. Analyzes your staged changes and creates clear, conventional commit messages.

## Features

- Generates clear, concise commit messages from staged changes
- Interactive editing with vim
- Secure API key storage
- Simple CLI interface

## Installation

### Option 1: Pre-built Binary

1. Download the latest release for your platform from [GitHub Releases](https://github.com/sidedwards/auto-commit/releases)
2. Move to a location in your PATH:

```bash
# macOS (M1/M2)
sudo mv auto-commit-darwin-arm64 /usr/local/bin/auto-commit

# macOS (Intel)
sudo mv auto-commit-darwin-x64 /usr/local/bin/auto-commit

# Linux
sudo mv auto-commit-linux-x64 /usr/local/bin/auto-commit

# Make executable (macOS/Linux)
sudo chmod +x /usr/local/bin/auto-commit

# Windows (PowerShell as Admin)
move auto-commit-windows-x64.exe C:\Windows\System32\auto-commit.exe
```

### Option 2: Install from Source

````bash
# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# Clone and install
git clone https://github.com/sidedwards/auto-commit.git
cd auto-commit
deno task install
````

## Usage

```bash
# Optional: Set up git alias
git config --global alias.ac '!auto-commit'

# Use the tool
git add <files>
auto-commit  # or 'git ac' if alias configured
```

Example output:
```
Proposed commit:
┌────────────────────────────────────────────────────────────────────────┐
│ Add user authentication to API endpoints                               │
│                                                                        │
│ - Implement JWT token validation                                       │
│ - Add rate limiting middleware                                         │
└────────────────────────────────────────────────────────────────────────┘

(a)ccept, (e)dit, (r)eject, (n)ew message?
```

## Configuration

On first run, you'll be prompted to enter your [Anthropic API key](https://console.anthropic.com/account/keys).

## Requirements

- Git
- Vim
- Anthropic API key

## License

MIT
