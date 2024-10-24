# auto-commit

Automatically generate git commit messages using Claude 3 Haiku. Analyzes your staged changes and creates clear commit messages. Uses the conventional commit format by default, but you can also train it to use a repo or author-specific style.

## Features

- Generates clear, concise commit messages from staged changes
- Supports multiple commit formats:
  - Conventional Commits (default)
  - Angular
  - Semantic Git Commits (with emojis)
  - Linux Kernel style
  - Repository or author-specific commit styles
- Simple CLI interface

## Installation

### Option 1: Quick Install (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/sidedwards/auto-commit/main/scripts/install.sh | bash
```

This will:
- Download the appropriate binary for your system
- Add it to your PATH
- Make it executable

### Option 2: Manual Installation

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

### Option 3: Install from Source

````bash
# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# Clone and install
git clone https://github.com/sidedwards/auto-commit.git
cd auto-commit
deno task install
````

### Updating

```bash
# If installed with quick install or manual binary
curl -fsSL https://raw.githubusercontent.com/sidedwards/auto-commit/main/scripts/install.sh | bash

# If installed from source
cd auto-commit
deno task update
```

## Usage

```bash
# Optional: Set up git alias
git config --global alias.ac '!auto-commit'

# Use the tool with default commit style (conventional)
git add <files>
auto-commit  # or 'git ac' if alias configured

# Use a specific commit format
auto-commit --format=conventional  # default
auto-commit --format=angular      # Angular style
auto-commit --format=semantic     # with emojis
auto-commit --format=kernel       # Linux kernel style

# View repository authors
auto-commit --list-authors

# Learn commit style from repository history
auto-commit --learn

# Learn commit style from specific author
auto-commit --learn --author="user@example.com"
```

Example output:
```
Proposed commit:
┌────────────────────────────────────────────────────────────────────────┐
│ docs(README): update installation instructions                         │
│                                                                        │
│ - Add instructions for installing pre-built binary                     │
│   * Separate steps for macOS (M1/M2 and Intel), Linux, and Windows     │
│   * Move binary to PATH and make executable                            │
│ - Add instructions for installing from source                          │
│   * Install Deno                                                       │
│   * Clone repo and install with Deno task                              │
│ - Remove outdated development instructions                             │
└────────────────────────────────────────────────────────────────────────┘

(a)ccept, (e)dit, (r)eject, (n)ew message?
```

## Configuration

On first run, you'll be prompted to enter your [Anthropic API key](https://console.anthropic.com/account/keys).

### Commit Formats

The tool supports several commit message formats:

1. **Conventional** (default): `type(scope): description`
   ```
   feat(auth): add OAuth2 authentication
   ```

2. **Angular**: Similar to conventional but with stricter rules
   ```
   feat(auth): implement OAuth2 authentication

   * Add login endpoints
   * Set up token management

   BREAKING CHANGE: Remove basic auth support
   ```

3. **Semantic** (with emojis): `emoji description`
   ```
   ✨ Add new user authentication system

   - Implement OAuth2 flow
   - Add session management

   Closes #123
   ```

4. **Linux Kernel**: `subsystem: change summary`
   ```
   auth: implement secure token rotation

   Previous implementation had security flaws.
   This patch adds automatic rotation with
   proper invalidation of old tokens.

   Signed-off-by: John Doe <john@example.com>
   ```

5. **Repository-Specific** (`--learn`): Learn and use the commit style from your repository's history
   ```
   # Learn and use repository-wide commit style
   auto-commit --learn
   ```

6. **Author-Specific** (`--learn --author`): Learn and use a specific author's commit style
   ```
   # Learn and use commit style from specific author
   auto-commit --learn --author="user@example.com"
   ```

The learned styles (both repository and author-specific) are saved and will be used for future commits unless overridden with the `--format` flag.

## Requirements

- Git
- Vim (for editing commit messages)
- Anthropic API key

## License

MIT
