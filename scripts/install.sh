#!/usr/bin/env bash
set -e

main() {
    # Check for curl
    if ! command -v curl &> /dev/null; then
        echo "curl is required but not found."
        exit 1
    fi

    # Check for required dependencies
    if ! command -v gh &> /dev/null; then
        echo "GitHub CLI (gh) is required but not found."
        echo "Install instructions: https://cli.github.com/manual/installation"
        exit 1
    fi

    # Check if gh is authenticated
    if ! gh auth status &> /dev/null; then
        echo "GitHub CLI is not authenticated. Please run:"
        echo "  gh auth login"
        exit 1
    fi

    BIN_DIR=${BIN_DIR-"$HOME/.bin"}
    mkdir -p "$BIN_DIR"

    case "$SHELL" in
        */zsh)
            PROFILE="$HOME/.zshrc"
            PREF_SHELL="zsh"
            ;;
        */bash)
            PROFILE="$HOME/.bashrc"
            PREF_SHELL="bash"
            ;;
        */fish)
            PROFILE="$HOME/.config/fish/config.fish"
            PREF_SHELL="fish"
            ;;
        */ash)
            PROFILE="$HOME/.profile"
            PREF_SHELL="ash"
            ;;
        *)
            echo "could not detect shell, manually add ${BIN_DIR} to your PATH."
            exit 1
            ;;
    esac

    if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
        echo >> "$PROFILE" && echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$PROFILE"
    fi

    PLATFORM="$(uname -s)"
    case "$PLATFORM" in
        Linux)
            SUFFIX="linux-x64"
            ;;
        Darwin)
            ARCH="$(uname -m)"
            if [ "${ARCH}" = "arm64" ]; then
                SUFFIX="darwin-arm64"
            else
                SUFFIX="darwin-x64"
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            BINARY_URL="https://github.com/sidedwards/auto-commit/releases/latest/download/auto-commit-windows-x64.exe"
            ;;
        *)
            err "unsupported platform: $PLATFORM"
            ;;
    esac

    if [ -z "$BINARY_URL" ]; then
        BINARY_URL="https://github.com/sidedwards/auto-commit/releases/latest/download/auto-commit-${SUFFIX}"
    fi

    echo "Downloading latest auto-commit binary..."
    ensure curl -fsSL "$BINARY_URL" -o "$BIN_DIR/auto-commit"
    ensure chmod +x "$BIN_DIR/auto-commit"

    echo "auto-commit installed successfully!"
    echo "Run 'auto-commit --help' to get started"
}

# Run a command that should never fail. If the command fails execution
# will immediately terminate with an error showing the failing
# command.
ensure() {
    if ! "$@"; then
        err "command failed: $*"
    fi
}

err() {
    echo "$*" >&2
    exit 1
}

main "$@" || exit 1
