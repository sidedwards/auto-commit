import Anthropic from "npm:@anthropic-ai/sdk";

export class AnthropicClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async createMessage(content: string, model: string = "claude-3-haiku-20240307"): Promise<string> {
        const anthropic = new Anthropic({ apiKey: this.apiKey });

        const msg = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            temperature: 0,
            messages: [{ role: "user", content }],
        });

        const contentResponse = msg.content[0];
        if ('text' in contentResponse) {
            return contentResponse.text.trim();
        }
        throw new Error('Unexpected response format from Claude');
    }
}
