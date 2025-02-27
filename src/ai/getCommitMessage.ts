import { AnthropicClient } from "./anthropicClient.ts";
import { LangChainClient, LLMProvider } from "./langChainClient.ts";
import { startLoading, stopLoading } from "../utils.ts";
import { CommitFormat } from "../formats/commitFormat.ts";
import { getGitAuthor } from "../git/gitOps.ts";
import { getModelForProvider, getProviderConfig } from "../config/config.ts";
// import { getRelatedIssues } from "../gh/ghOps.ts";

export async function getCommitMessage(
    diff: string, 
    apiKey: string,
    systemPrompt?: string,
    selectedIssue?: { number: number, title: string } | null,
    selectedFormat?: CommitFormat,
    provider: LLMProvider = LLMProvider.ANTHROPIC
): Promise<string> {
    if (selectedFormat === CommitFormat.KERNEL) {
        const author = await getGitAuthor();
        systemPrompt = `${systemPrompt}\n\nGit Author: ${author.name} <${author.email}>`;
    }
    const loadingId = startLoading('Generating commit message...');
    
    try {
        // Add issue context to system prompt if available
        if (selectedIssue) {
            systemPrompt += `\n\nReferenced issue: #${selectedIssue.number}: ${selectedIssue.title}
Include the issue ID as a reference according to the commit message format.`;
        } else {
            systemPrompt += `\n\nNo issue referenced`;
        }
        
        // Get provider-specific model and configuration
        const model = await getModelForProvider(provider) || getDefaultModelForProvider(provider);
        const options: Record<string, any> = { model };
        
        // Add provider-specific options
        if (provider === LLMProvider.OLLAMA) {
            const baseUrl = await getProviderConfig(provider, "baseUrl");
            if (baseUrl) {
                options.baseUrl = baseUrl;
            }
        }
        
        // Set appropriate token limits for different providers
        if (provider === LLMProvider.OPENAI) {
            // Use maxCompletionTokens for OpenAI
            options.maxCompletionTokens = 1024;
            
            // For very large diffs with OpenAI, use a more efficient prompt
            if (diff.length > 10000) {
                diff = truncateLongDiff(diff, 10000);
            }
        } else {
            // For Anthropic and Ollama, use maxTokens
            options.maxTokens = 1024;
            
            // For very large diffs, truncate to avoid token limits
            if (diff.length > 15000) {
                diff = truncateLongDiff(diff, 15000);
            }
        }
        
        // Create the appropriate client based on provider
        try {
            const client = new LangChainClient(provider, apiKey, options);

            const content = await client.createMessage(
                systemPrompt || `You are an expert in git commit message styling and formatting.`,
                `Generate a commit message summarizing ALL key changes from the ENTIRE diff:\n\n${diff}\n\nIMPORTANT: 
1. Do not include any explanatory text or formatting
2. Do not repeat the header line
3. IMPORTANT: NEVER include the diff in the response
4. Do not include "diff --git" or any git output
5. Follow this exact structure:
   - One header line
   - One blank line
   - Bullet points for actual changes
   - Breaking changes (if any)
6. Do not make up features, changes, or issue numbers not present in the diff`);

            // Post-process the message to ensure proper formatting
            const lines = content.split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) {
                throw new Error("Received empty response from LLM");
            }
            
            const headerLine = lines[0];
            const bodyLines: string[] = [];
            const breakingChanges: string[] = [];
            
            // Separate body and breaking changes
            let isBreakingChange = false;
            for (const line of lines.slice(1)) {
                if (line.startsWith('BREAKING CHANGE:')) {
                    isBreakingChange = true;
                    breakingChanges.push(line);
                } else if (isBreakingChange) {
                    breakingChanges.push(line);
                } else {
                    bodyLines.push(line);
                }
            }
            
            // Return the formatted commit message
            let message = headerLine;
            if (bodyLines.length > 0) {
                message += `\n\n${bodyLines.join('\n')}`;
            }
            if (breakingChanges.length > 0) {
                message += `\n\n${breakingChanges.join('\n')}`;
            }
            
            return message.trim();
        } catch (error) {
            if (error.message.includes("401") || error.message.includes("Unauthorized")) {
                throw new Error(`API key for ${provider} is invalid or has expired. Please provide a valid API key.`);
            } else if (error.message.includes("cannot connect") || error.message.includes("ECONNREFUSED")) {
                if (provider === LLMProvider.OLLAMA) {
                    throw new Error("Cannot connect to Ollama server. Make sure Ollama is running and the base URL is correct.");
                } else {
                    throw new Error(`Cannot connect to ${provider} API. Please check your internet connection.`);
                }
            } else if (error.message.includes("model") && error.message.includes("not found")) {
                throw new Error(`Model '${model}' not found for ${provider}. You can specify any valid ${provider} model with --model=MODEL_NAME. Run 'auto-commit --list-models --provider=${provider}' to see common models.`);
            } else {
                throw error;
            }
        }
    } finally {
        stopLoading(loadingId);
    }
}

// Get default model for each provider
function getDefaultModelForProvider(provider: LLMProvider): string {
    switch (provider) {
        case LLMProvider.ANTHROPIC:
            return "claude-3-5-haiku-20241022";
        case LLMProvider.OPENAI:
            return "gpt-4o-mini";
        case LLMProvider.OLLAMA:
            return "llama3";
        default:
            return "claude-3-haiku-20240307";
    }
}

// Helper function to truncate long diffs while preserving context
function truncateLongDiff(diff: string, maxLength: number): string {
    if (diff.length <= maxLength) return diff;
    
    // Keep the beginning of the diff (for file names and context)
    const beginningLength = Math.floor(maxLength * 0.3);
    const beginning = diff.substring(0, beginningLength);
    
    // Keep the end of the diff (often contains the most recent changes)
    const endLength = Math.floor(maxLength * 0.4);
    const end = diff.substring(diff.length - endLength);
    
    // Keep some middle context, with markers showing truncation
    const middleLength = maxLength - beginningLength - endLength - 60;
    const middleStart = Math.floor(diff.length / 2 - middleLength / 2);
    const middle = diff.substring(middleStart, middleStart + middleLength);
    
    return `${beginning}\n\n[... DIFF TRUNCATED: ${Math.round((diff.length - maxLength) / 1024)} KB removed to fit token limits ...]\n\n${middle}\n\n[... DIFF TRUNCATED: ${Math.round((diff.length - maxLength) / 1024)} KB removed to fit token limits ...]\n\n${end}`;
}