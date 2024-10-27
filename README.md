# auto-commit

Automatically generate git commit messages using Claude 3 Haiku. Analyzes your staged changes and creates clear commit messages. Uses the conventional commit format by default, but you can also train it to use a repo or author-specific style.

![output](https://github.com/user-attachments/assets/be56cd5e-d605-41d2-a711-3bb43f398ac7)

## Features

- Generates clear, concise commit messages from staged changes
- Supports multiple commit formats:
  - Conventional Commits (default)
  - Angular
  - Semantic Git Commits (with emojis)
  - Linux Kernel style
  - GitHub issue-reference style ([#123]: description)
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
auto-commit --format=issue       # Issue reference style

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

The tool supports multiple commit message formats:

1. **Conventional** (default) - [specification](https://www.conventionalcommits.org/en/v1.0.0/)
   ```
   feat(auth): add OAuth2 authentication
   
   - Add login endpoints
   - Set up token management
   ```

2. **Angular** - [specification](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
   ```
   feat(auth): implement OAuth2 authentication

   * Add login endpoints
   * Set up token management

   BREAKING CHANGE: Remove basic auth support
   ```

3. **Semantic** - includes emojis for visual clarity
   ```
   ✨ Add OAuth2 authentication
   
   - Add login endpoints
   - Set up token management
   ```

4. **Linux Kernel** - [style guide](https://www.kernel.org/doc/html/latest/process/submitting-patches.html#describe-your-changes)
   ```
   auth: implement secure token rotation
   
   Previous implementation had security flaws.
   This patch adds automatic rotation.
   
   Signed-off-by: John Doe <john@example.com>
   ```

5. **Custom Styles**
   ```bash
   # Learn from repository history
   auto-commit --learn
   
   # Learn from specific author
   auto-commit --learn --author="user@example.com"
   ```
   The tool can learn and adopt commit styles from your repository's history or a specific author's commits.

Override the format using `--format`:
```bash
auto-commit --format conventional  # default
auto-commit --format angular      # Angular style
auto-commit --format semantic     # with emojis
auto-commit --format kernel       # Linux style
```

## Requirements

- Git
- GitHub CLI (gh) - for issue integration
- Vim (for editing commit messages)
- Anthropic API key

## License

MIT
