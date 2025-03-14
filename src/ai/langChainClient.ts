import { ChatAnthropic } from "npm:@langchain/anthropic";
import { ChatOpenAI } from "npm:@langchain/openai";
import { Ollama } from "npm:@langchain/ollama";
import { BaseChatModel } from "npm:@langchain/core/language_models/chat_models";

export enum LLMProvider {
  ANTHROPIC = "anthropic",
  OPENAI = "openai",
  OLLAMA = "ollama"
}

type LLMOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxCompletionTokens?: number;
  baseUrl?: string;
};

// Common models by provider (for informational purposes only)
export const COMMON_MODELS = {
  [LLMProvider.ANTHROPIC]: [
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022", 
    "claude-3-7-sonnet-20250219"
  ],
  [LLMProvider.OPENAI]: [
    "gpt-4o-mini",
    "gpt-4o",
    "o3-mini",
    "o1"
  ],
  [LLMProvider.OLLAMA]: [
    "llama3",
    "mistral",
    "mixtral",
    "codellama",
    "llama2"
  ]
};

export class LangChainClient {
  // @ts-ignore - Ignoring type compatibility issues
  private model: BaseChatModel;
  private provider: LLMProvider;
  private modelName: string;

  constructor(provider: LLMProvider, apiKey: string, options: LLMOptions = {}) {
    this.provider = provider;

    const defaultOptions = {
      temperature: 0,
      maxTokens: 1024,
    };

    const mergedOptions = { ...defaultOptions, ...options };
    this.modelName = options.model || this.getDefaultModelForProvider(provider);

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        try {
          // @ts-ignore - Ignoring type compatibility issues
          this.model = new ChatAnthropic({
            apiKey,
            modelName: this.modelName,
            temperature: mergedOptions.temperature,
            maxTokens: mergedOptions.maxTokens,
          });
        } catch (error) {
          throw new Error(`Failed to initialize Anthropic model: ${error.message}`);
        }
        break;
        
      case LLMProvider.OPENAI:
        try {
          // @ts-ignore - Ignoring type compatibility issues
          this.model = new ChatOpenAI({
            apiKey,
            modelName: this.modelName,
            temperature: mergedOptions.temperature,
            maxTokens: mergedOptions.maxTokens,
          });
        } catch (error) {
          throw new Error(`Failed to initialize OpenAI model: ${error.message}`);
        }
        break;
        
      case LLMProvider.OLLAMA:
        try {
          // @ts-ignore - Ignoring type compatibility issues
          this.model = new Ollama({
            baseUrl: options.baseUrl || "http://localhost:11434",
            model: this.modelName,
            temperature: mergedOptions.temperature,
          });
        } catch (error) {
          if (error.message.includes("ECONNREFUSED") || error.message.includes("Failed to fetch")) {
            throw new Error(`Cannot connect to Ollama at ${options.baseUrl || "http://localhost:11434"}. Make sure Ollama is running.`);
          } else {
            throw new Error(`Failed to initialize Ollama model: ${error.message}`);
          }
        }
        break;
        
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  private getDefaultModelForProvider(provider: LLMProvider): string {
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

  async createMessage(systemPrompt: string, content: string): Promise<string> {
    try {
      const response = await this.model.invoke([
        ["system", systemPrompt],
        ["human", content]
      ]);
      
      return response.content.toString().trim();
    } catch (error) {
      // Provider-specific error handling
      if (this.provider === LLMProvider.ANTHROPIC) {
        if (error.message.includes("401") || error.message.includes("invalid_api_key")) {
          throw new Error("Invalid Anthropic API key. Please check your credentials.");
        } else if (error.message.includes("model_not_found") || error.message.includes("not supported")) {
          throw new Error(`Model '${this.modelName}' not found or not supported by Anthropic. 
You can specify any valid Anthropic model with --model=MODEL_NAME. 
For a list of common models, run 'auto-commit --list-models --provider=anthropic'.`);
        }
      } else if (this.provider === LLMProvider.OPENAI) {
        if (error.message.includes("401") || error.message.includes("invalid_api_key")) {
          throw new Error("Invalid OpenAI API key. Please check your credentials.");
        } else if (error.message.includes("model_not_found") || error.message.includes("does not exist")) {
          throw new Error(`Model '${this.modelName}' not found or not supported by OpenAI.
You can specify any valid OpenAI model with --model=MODEL_NAME.
For a list of common models, run 'auto-commit --list-models --provider=openai'.`);
        }
      } else if (this.provider === LLMProvider.OLLAMA) {
        if (error.message.includes("not found") || error.message.includes("does not exist")) {
          throw new Error(`Model '${this.modelName}' not found in your Ollama installation.
Run 'ollama pull ${this.modelName}' to download it, or specify a different model with --model=MODEL_NAME.
For a list of common models, run 'auto-commit --list-models --provider=ollama'.`);
        }
      }
      
      throw new Error(`Error creating message with ${this.provider}: ${error.message}`);
    }
  }
} 