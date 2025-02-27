import { AnthropicClient } from "./anthropicClient.ts";
import { LangChainClient, LLMProvider } from "./langChainClient.ts";
import { getModelForProvider, getProviderConfig } from "../config/config.ts";

export async function analyzeCommitStyle(
    systemPrompt: string, 
    commits: string[] | string, 
    apiKey: string,
    provider: LLMProvider = LLMProvider.ANTHROPIC
): Promise<string> {
    // Get provider-specific model and configuration
    const model = await getModelForProvider(provider) || getDefaultModelForProvider(provider);
    const options: any = { model };
    
    // Add provider-specific options
    if (provider === LLMProvider.OLLAMA) {
        const baseUrl = await getProviderConfig(provider, "baseUrl");
        if (baseUrl) {
            options.baseUrl = baseUrl;
        }
    }
    
    // Create the appropriate client based on provider
    const client = new LangChainClient(provider, apiKey, options);
    
    // Ensure commits is an array before joining
    const commitsArray = Array.isArray(commits) ? commits : [commits].filter(Boolean);
    
    const content = `Analyze these recent commit messages and create a style guide to match their format:

${commitsArray.join('\n\n')}

Generate a precise style guide that captures the format, structure, and conventions used. Include specific rules about:
1. Capitalization
2. Tense (past/present/imperative)
3. Header format and limits
4. Use of bullet points, asterisks, or other list styles
5. How breaking changes are marked
6. Line wrapping
7. Use of emojis or other special notation

Return ONLY the style guide, formatted as rules to follow.`;

    const styleGuide = await client.createMessage(systemPrompt, content);
    return styleGuide;
}

// Get default model for each provider
function getDefaultModelForProvider(provider: LLMProvider): string {
    switch (provider) {
        case LLMProvider.ANTHROPIC:
            return "claude-3-haiku-20240307";
        case LLMProvider.OPENAI:
            return "gpt-3.5-turbo";
        case LLMProvider.OLLAMA:
            return "llama3";
        default:
            return "claude-3-haiku-20240307";
    }
}
