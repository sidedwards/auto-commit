# auto-commit

Automatically generate git commit messages using AI. Analyzes your staged changes and creates clear, conventional commit messages.

## Features

- Generates clear, concise commit messages from staged changes
- Interactive editing with vim
- Secure API key storage
- Simple CLI interface

## Installation

1. Download the latest release for your platform from [GitHub Releases](https://github.com/sidedwards/auto-commit/releases)
2. Move to a location in your PATH:

```bash
# macOS/Linux
sudo mv auto-commit-* /usr/local/bin/auto-commit
sudo chmod +x /usr/local/bin/auto-commit

# Windows (PowerShell as Admin)
move auto-commit-*.exe C:\Windows\System32\auto-commit.exe
```

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

## Development

```bash
# Install dependencies
git clone https://github.com/sidedwards/auto-commit.git
cd auto-commit

# Build
deno task build

# Create release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## Requirements

- Git
- Vim
- Anthropic API key

## License

MIT
