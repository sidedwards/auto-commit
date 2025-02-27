import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { Ollama } from "@langchain/ollama";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

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
    "claude-3-haiku-20240307",
    "claude-3-sonnet-20240229", 
    "claude-3-opus-20240229",
    "claude-2.1",
    "claude-2.0",
    "claude-instant-1.2"
  ],
  [LLMProvider.OPENAI]: [
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k", 
    "gpt-4",
    "gpt-4-32k", 
    "gpt-4-turbo",
    "gpt-4o"
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
          this.model = new ChatOpenAI({
            apiKey,
            modelName: this.modelName,
            temperature: mergedOptions.temperature,
            maxCompletionTokens: mergedOptions.maxTokens,
          });
        } catch (error) {
          throw new Error(`Failed to initialize OpenAI model: ${error.message}`);
        }
        break;
        
      case LLMProvider.OLLAMA:
        try {
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