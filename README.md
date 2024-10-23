# auto-commit

AI-powered git commit message generator using Claude 3.

## Features

- Generates clear, concise commit messages based on your staged changes
- Follows git commit message best practices
- Edit messages in vim
- Stores your API key securely
- Simple CLI interface

## Installation

### Option 1: Download Pre-built Executable

1. Download the latest release for your platform from [GitHub Releases](https://github.com/yourusername/auto-commit/releases)
2. Extract and move to a location in your PATH:

macOS:
```bash
# For M1/M2 Macs
sudo mv auto-commit-darwin-arm64 /usr/local/bin/auto-commit

# For Intel Macs
sudo mv auto-commit-darwin-x64 /usr/local/bin/auto-commit

# Make executable
sudo chmod +x /usr/local/bin/auto-commit
```

Linux:
```bash
# Move to a location in your PATH
sudo mv auto-commit-linux-x64 /usr/local/bin/auto-commit

# Make executable
sudo chmod +x /usr/local/bin/auto-commit
```

Windows:
```powershell
# Move to a directory in your PATH
move auto-commit-windows-x64.exe C:\Windows\System32\auto-commit.exe
```

### Option 2: Install from Source

1. Install [Deno](https://deno.land/#installation)
2. Clone this repository
3. Run the installer:
    ```sh
    deno task install
    ```

## Set up Git Alias (Optional)

```bash
git config --global alias.ac '!auto-commit'
```

## Usage

You can use auto-commit in two ways:

1. As a standalone command:
    ```sh
    git add <files>
    auto-commit
    ```

2. As a git alias (if configured):
    ```sh
    git add <files>
    git ac
    ```

Example output:
```
Proposed commit:
┌────────────────────────────────────────────────────────────────────────┐
│ Add user authentication to API endpoints                               │
│                                                                        │
│ - Implement JWT token validation                                       │
│ - Add rate limiting middleware                                         │
│ - Create user session management                                       │
│                                                                        │
│ BREAKING: All routes now require Authorization header                  │
└────────────────────────────────────────────────────────────────────────┘

(a)ccept, (e)dit, (r)eject, (n)ew message?
```

Choose an option:
- (a)ccept: Use the generated message and commit changes
- (e)dit: Open in vim to edit before committing
- (r)eject: Cancel the commit
- (n)ew: Generate a new message

## Configuration

On first run, you'll be prompted to enter your Anthropic API key. This will be stored securely in `~/.config/auto-commit/`.

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/auto-commit.git
cd auto-commit

# Build executables
deno task build

# The executables will be in the dist/ directory:
dist/
  auto-commit-darwin-arm64     # M1/M2 Mac
  auto-commit-darwin-x64       # Intel Mac
  auto-commit-windows-x64.exe  # Windows
  auto-commit-linux-x64        # Linux
```

### Creating a Release

1. Tag the release:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

2. GitHub Actions will automatically:
   - Build executables for all platforms
   - Create a GitHub release
   - Upload the executables

## Requirements

- Deno 1.x or higher (for development)
- Git
- Vim
- [Anthropic API key](https://console.anthropic.com/account/keys)

## License

MIT
