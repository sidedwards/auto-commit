# auto-commit

Automatically generate git commit messages using Claude 3 Haiku. This tool analyzes your staged changes and creates clear, concise commit messages. It uses the Conventional Commit format by default but can adapt to repository-specific or author-specific styles.

![output](https://github.com/user-attachments/assets/be56cd5e-d605-41d2-a711-3bb43f398ac7)

## Features

- Generates clear, concise commit messages from staged changes
- Supports multiple LLM providers:
  - Anthropic Claude (default)
  - OpenAI GPT models
  - Ollama (local LLMs)
- Supports various commit formats:
  - Conventional Commits (default)
  - Angular
  - Semantic Git Commits (with emojis)
  - Linux Kernel style
  - GitHub issue-reference style (e.g., `[#123]: description`)
  - Custom styles from repository or author history
- Simple CLI interface

## Quick Start

Get up and running in minutes:

1. **Install the tool**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/sidedwards/auto-commit/main/scripts/install.sh | bash
   ```

2. **Set up your API key** (if using Anthropic or OpenAI):
   - Anthropic (default): [Get your API key](https://console.anthropic.com/account/keys)
   - OpenAI: [Get your API key](https://platform.openai.com/api-keys)
   - Ollama: No API key needed (ensure Ollama is running locally).

3. **Generate a commit message**:
   ```bash
   git add <files>
   auto-commit
   ```

4. **Review and confirm**:
   - Accept, edit, reject, or regenerate the proposed commit message.

## Installation

### Quick Install (Recommended for macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/sidedwards/auto-commit/main/scripts/install.sh | bash
```

This script:
- Downloads the correct binary for your system.
- Adds it to your PATH.
- Makes it executable.

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/sidedwards/auto-commit/releases).
2. Move the binary to a PATH directory and make it executable:

   - **macOS (M1/M2)**:
     ```bash
     sudo mv auto-commit-darwin-arm64 /usr/local/bin/auto-commit
     sudo chmod +x /usr/local/bin/auto-commit
     ```
   - **macOS (Intel)**:
     ```bash
     sudo mv auto-commit-darwin-x64 /usr/local/bin/auto-commit
     sudo chmod +x /usr/local/bin/auto-commit
     ```
   - **Linux**:
     ```bash
     sudo mv auto-commit-linux-x64 /usr/local/bin/auto-commit
     sudo chmod +x /usr/local/bin/auto-commit
     ```
   - **Windows (PowerShell as Admin)**:
     ```powershell
     move auto-commit-windows-x64.exe C:\Windows\System32\auto-commit.exe
     ```

### Install from Source

1. Install [Deno](https://deno.land/):
   ```bash
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```
2. Clone and install:
   ```bash
   git clone https://github.com/sidedwards/auto-commit.git
   cd auto-commit
   deno task install
   ```

### Updating

- **Quick Install or Manual**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/sidedwards/auto-commit/main/scripts/install.sh | bash
  ```
- **From Source**:
  ```bash
  cd auto-commit
  deno task update
  ```

## Usage

### Basic Usage

1. Stage your changes:
   ```bash
   git add <files>
   ```
2. Run the tool:
   ```bash
   auto-commit
   ```
3. Review the commit message and select:
   - `(a)ccept`
   - `(e)dit`
   - `(r)eject`
   - `(n)ew message`

### Advanced Options

- **Add a Git alias**:
  ```bash
  git config --global alias.ac '!auto-commit'
  ```
  Then use: `git ac`

- **Choose a commit format**:
  ```bash
  auto-commit --format=conventional  # Default
  auto-commit --format=angular      # Angular style
  auto-commit --format=semantic     # With emojis
  auto-commit --format=kernel       # Linux Kernel style
  auto-commit --format=issue        # GitHub issue-reference
  ```

- **Learn custom styles**:
  - From repository history:
    ```bash
    auto-commit --learn
    ```
  - From a specific author:
    ```bash
    auto-commit --learn --author="user@example.com"
    ```

- **List repository authors**:
  ```bash
  auto-commit --list-authors
  ```

## LLM Provider Options

Choose the LLM provider and model that best suits your needs.

### Providers and Models

- **Anthropic Claude** (default):
  - `claude-3-5-haiku-20241022` (default): Fast and compact.
  - `claude-3-5-sonnet-20241022`: Balanced performance.
  - `claude-3-7-sonnet-20250219`: Most powerful with reasoning.

- **OpenAI**:
  - `gpt-4o-mini` (default): Fast and cost-effective.
  - `gpt-4o`: Fast, intelligent, and flexible.
  - `o3-mini`: Fast and flexible with reasoning.
  - `o1`: High intelligence with reasoning.

- **Ollama** (local LLMs):
  - Depends on your Ollama setup. Examples:
    - `llama3` (default): Meta's latest model.
    - `mistral`: Mistral 7B.
    - `mixtral`: Mixtral 8x7B.
    - `codellama`: Code-optimized.

### Commands

- **List all models**:
  ```bash
  auto-commit --list-models
  ```
- **List models for a provider**:
  ```bash
  auto-commit --list-models --provider=anthropic
  ```
- **Use a specific provider/model**:
  ```bash
  auto-commit --provider=anthropic --model=claude-3-opus-20240229
  auto-commit --provider=openai --model=gpt-4o
  auto-commit --provider=ollama --model=llama3
  ```
- **Custom Ollama URL**:
  ```bash
  auto-commit --provider=ollama --base-url=http://localhost:11434
  ```

## Configuration

- **API Keys**:
  - Required for Anthropic/OpenAI; set on first run.
  - Not needed for Ollama (just run the Ollama server locally).
  - Links: [Anthropic](https://console.anthropic.com/account/keys) | [OpenAI](https://platform.openai.com/api-keys)

- **Commit Formats**:
  - Default: Conventional Commits.
  - Change with `--format` (see Usage).

- **Custom Styles**:
  - Train with `--learn` or `--learn --author="email"`.

## Requirements

- Git
- GitHub CLI (gh) - for issue integration
- Vim - for editing commit messages
- API keys (Anthropic/OpenAI) or Ollama running locally

## License

MIT