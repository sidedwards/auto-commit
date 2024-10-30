import { parse } from "https://deno.land/std/flags/mod.ts";
import { listAuthors as gitListAuthors } from "../git/gitOps.ts";

/**
 * Parses command-line arguments and returns an object with the parsed flags.
 * 
 * @param args - The command-line arguments to parse.
 * @returns An object containing the parsed flags.
 */
export function parseFlags(args: string[]) {
    return parse(args, {
        string: ["author", "format"],
        boolean: ["help", "learn", "list-authors", "reset-format"],
        alias: { h: "help" },
    });
}

/**
 * Displays the help message for the CLI tool.
 */
export function displayHelp(): void {
    console.log(`
Usage: auto-commit [options]

Options:
  --help, -h          Show help message
  --author <name>     Specify the author to learn commit style from
  --format <type>     Specify the commit format (conventional, semantic, angular, kernel, issue)
  --learn             Learn commit style from the repository or specified author
  --list-authors      List authors from the commit history
  --reset-format      Reset to default commit format

Examples:
    # Use default format (conventional)
    git add .
    auto-commit

    # Use specific format
    auto-commit --format=semantic

    # Learn from repository
    auto-commit --learn

    # Learn from author
    auto-commit --learn --author="user@example.com"

Configuration:
    First run will prompt for Anthropic API key
    Configs stored in ~/.config/auto-commit/

For more information, visit: https://github.com/sidedwards/auto-commit`);
}

/**
 * Executes the CLI command based on parsed flags.
 * 
 * @param flags - The parsed command-line flags.
 */
export async function executeCommand(flags: any): Promise<void> {
    if (flags.help) {
        displayHelp();
        return;
    }

    if (flags["list-authors"]) {
        await gitListAuthors();
        return;
    }

    // Add more command handling logic here as needed
}
