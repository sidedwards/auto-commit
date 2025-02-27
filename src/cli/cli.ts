import { parse } from "std/flags/mod.ts";
import { listAuthors as gitListAuthors } from "../git/gitOps.ts";
import { COLORS } from "../utils.ts";
import { LLMProvider, COMMON_MODELS } from "../ai/langChainClient.ts";

/**
 * Parses command-line arguments and returns an object with the parsed flags.
 * 
 * @param args - The command-line arguments to parse.
 * @returns An object containing the parsed flags.
 */
export function parseFlags(args: string[]): Record<string, string | boolean> {
    const flags: Record<string, string | boolean> = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith("--")) {
            const flagName = arg.slice(2);
            if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
                flags[flagName] = args[i + 1];
                i++;
            } else {
                flags[flagName] = true;
            }
        } else if (arg.startsWith("-")) {
            const flagName = arg.slice(1);
            if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
                flags[flagName] = args[i + 1];
                i++;
            } else {
                flags[flagName] = true;
            }
        }
    }
    
    return flags;
}

/**
 * Displays the help message for the CLI tool.
 */
export function displayHelp(): void {
    console.log(`
${COLORS.bold("auto-commit")} - Generate commit messages from staged changes

${COLORS.bold("USAGE")}
    auto-commit [options]

${COLORS.bold("OPTIONS")}
    --help                    Show this help message
    --format <format>         Use a specific format:
                                - conventional (default)
                                - semantic (with emojis)
                                - angular
                                - kernel (Linux kernel style)
                                - issue (GitHub issue reference style)
    --issue                   Force issue selection flow (auto-searches for related issues)
    --learn                   Learn commit message style from repository
    --author <email>          Learn from a specific author's commits
    --reset-format            Reset to default format
    --list-authors            List all authors in repository

${COLORS.bold("LLM PROVIDER OPTIONS")}
    --provider <provider>     Select LLM provider:
                                - anthropic (default, Claude)
                                - openai (GPT models)
                                - ollama (local LLMs)
    --model <model>           Specify any valid model for the selected provider
                              (not limited to the ones listed in --list-models)
    --list-models             List commonly used models for each provider
    --base-url <url>          Set base URL for Ollama (default: http://localhost:11434)
    --set-default-provider    Set the specified provider as default without running commit
    --set-default-model       Set the specified model as default for current provider
    --show-defaults           Show current default provider and model settings

${COLORS.bold("EXAMPLES")}
    auto-commit                               # Generate conventional commit
    auto-commit --format semantic             # Generate commit with emojis
    auto-commit --format issue                # Generate commit with GitHub issue reference
    auto-commit --issue                       # Force issue selection regardless of format
    auto-commit --learn                       # Learn from repository history
    auto-commit --provider openai             # Use OpenAI instead of Claude
    auto-commit --provider openai --model gpt-4-1106-preview  # Use a specific OpenAI model
    auto-commit --provider anthropic --model claude-3-opus-20240229  # Use Claude Opus
    auto-commit --provider ollama --model mistral  # Use local Mistral model
    auto-commit --list-models                 # Show common models
    auto-commit --provider openai --set-default-provider  # Set OpenAI as default provider
    auto-commit --model gpt-4o --set-default-model  # Set GPT-4o as default for current provider
    auto-commit --show-defaults               # Show current default settings
`);
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

/**
 * Displays available models for each LLM provider.
 * 
 * @param provider - Optional specific provider to list models for
 */
export function displayAvailableModels(provider?: LLMProvider): void {
    console.log(`\n${COLORS.bold("Common LLM Models")}`);
    console.log(`${COLORS.dim("Note: You can use any valid model for each provider, not just those listed here.")}`);

    if (!provider || provider === LLMProvider.ANTHROPIC) {
        console.log(`\n${COLORS.bold("Anthropic Claude Models:")}
  ${COLORS.info("claude-3-haiku-20240307")} (default) - Fast, compact model for everyday tasks
  ${COLORS.info("claude-3-sonnet-20240229")} - Balanced performance and intelligence
  ${COLORS.info("claude-3-opus-20240229")} - Most powerful model, highest reasoning capabilities
  ${COLORS.info("claude-2.1")} - Older generation model
  ${COLORS.info("claude-instant-1.2")} - Fast, older generation model
  
  ${COLORS.dim("For a complete list of supported models, see Anthropic's documentation:")
  }
  ${COLORS.dim("https://docs.anthropic.com/claude/reference/selecting-a-model")}`);
    }

    if (!provider || provider === LLMProvider.OPENAI) {
        console.log(`\n${COLORS.bold("OpenAI Models:")}
  ${COLORS.info("gpt-3.5-turbo")} (default) - Fast, efficient for most tasks
  ${COLORS.info("gpt-4o")} - Latest model with enhanced reasoning
  ${COLORS.info("gpt-4-turbo")} - Improved reasoning capabilities
  ${COLORS.info("gpt-4")} - Strong reasoning model
  
  ${COLORS.dim("For a complete list of supported models, see OpenAI's documentation:")
  }
  ${COLORS.dim("https://platform.openai.com/docs/models")}`);
    }

    if (!provider || provider === LLMProvider.OLLAMA) {
        console.log(`\n${COLORS.bold("Ollama Models (examples):")}
  ${COLORS.info("llama3")} (default) - Meta's latest Llama model
  ${COLORS.info("mistral")} - Mistral 7B model
  ${COLORS.info("mixtral")} - Mixtral 8x7B model
  ${COLORS.info("llama2")} - Meta's Llama 2 model
  ${COLORS.info("codellama")} - Model optimized for code generation
  
  ${COLORS.dim("Note: Available models depend on what you've pulled to your Ollama instance")}
  ${COLORS.dim("Run 'ollama list' to see installed models")}
  ${COLORS.dim("Visit https://ollama.com/library for available models")}`);
    }
}
