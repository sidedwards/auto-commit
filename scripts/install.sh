#!/usr/bin/env bash
set -e

main() {
    BIN_DIR=${BIN_DIR-"$HOME/.bin"}
    mkdir -p $BIN_DIR

    case $SHELL in
    */zsh)
        PROFILE=$HOME/.zshrc
        PREF_SHELL=zsh
        ;;
    */bash)
        PROFILE=$HOME/.bashrc
        PREF_SHELL=bash
        ;;
    */fish)
        PROFILE=$HOME/.config/fish/config.fish
        PREF_SHELL=fish
        ;;
    */ash)
        PROFILE=$HOME/.profile
        PREF_SHELL=ash
        ;;
    *)
        echo "could not detect shell, manually add ${BIN_DIR} to your PATH."
        exit 1
    esac

    if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
        echo >> $PROFILE && echo "export PATH=\"\$PATH:$BIN_DIR\"" >> $PROFILE
    fi

    PLATFORM="$(uname -s)"
    case $PLATFORM in
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
    *)
        err "unsupported platform: $PLATFORM"
        ;;
    esac

    BINARY_URL="https://github.com/sidedwards/auto-commit/releases/latest/download/auto-commit-${SUFFIX}"
    if [ "$PLATFORM" = "MINGW"* ] || [ "$PLATFORM" = "MSYS"* ] || [ "$PLATFORM" = "CYGWIN"* ]; then
        BINARY_URL="https://github.com/sidedwards/auto-commit/releases/latest/download/auto-commit-windows-x64.exe"
    fi

    echo "Downloading latest auto-commit binary..."
    ensure curl -L "$BINARY_URL" -o "$BIN_DIR/auto-commit"
    chmod +x "$BIN_DIR/auto-commit"

    echo "auto-commit installed successfully!"
    echo "Run 'auto-commit --help' to get started"
}

# Run a command that should never fail. If the command fails execution
# will immediately terminate with an error showing the failing
# command.
ensure() {
    if ! "$@"; then err "command failed: $*"; fi
}

err() {
    echo "$*" >&2
    exit 1
}

main "$@" || exit 1
