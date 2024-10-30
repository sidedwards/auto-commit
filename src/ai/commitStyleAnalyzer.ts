import { AnthropicClient } from "./anthropicClient.ts";

export async function analyzeCommitStyle(systemPrompt: string = `You are an expert in git commit message styling and formatting.`, commits: string, apiKey: string): Promise<string> {
    const client = new AnthropicClient(apiKey);
    const content = `Extract commit message rules from these commits. Create a minimal style guide that:

1. Lists only essential rules
2. Uses simple, direct language
3. Includes 2-3 real examples from the commits
4. Omits explanations and formatting
5. Focuses on practical patterns

Format as plain text with no markdown or bullets. Number each rule.

Analyze these commits:

${commits}`;

    return await client.createMessage(systemPrompt, content);
}
