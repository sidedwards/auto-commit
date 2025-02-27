import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { CommitFormat } from "../formats/commitFormat.ts";
import { LLMProvider } from "../ai/langChainClient.ts";

export async function getConfigDir(): Promise<string> {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
    const configDir = join(homeDir, ".config", "auto-commit");
    await ensureDir(configDir);
    return configDir;
}

// API Keys for different providers
export async function getStoredApiKey(provider: LLMProvider = LLMProvider.ANTHROPIC): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        const keyPath = join(configDir, `${provider}-key`);
        const apiKey = await Deno.readTextFile(keyPath);
        return apiKey.trim();
    } catch {
        return null;
    }
}

export async function storeApiKey(apiKey: string, provider: LLMProvider = LLMProvider.ANTHROPIC): Promise<void> {
    const configDir = await getConfigDir();
    const keyPath = join(configDir, `${provider}-key`);
    await Deno.writeTextFile(keyPath, apiKey);
}

// LLM Provider configuration
export async function getStoredLLMProvider(): Promise<LLMProvider | null> {
    try {
        const configDir = await getConfigDir();
        const providerPath = join(configDir, "llm-provider");
        const provider = await Deno.readTextFile(providerPath);
        return provider as LLMProvider;
    } catch {
        return null;
    }
}

export async function storeLLMProvider(provider: LLMProvider): Promise<void> {
    const configDir = await getConfigDir();
    const providerPath = join(configDir, "llm-provider");
    await Deno.writeTextFile(providerPath, provider);
}

// Model configuration
export async function getModelForProvider(provider: LLMProvider): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        const modelPath = join(configDir, `${provider}-model`);
        const model = await Deno.readTextFile(modelPath);
        return model.trim();
    } catch {
        return null;
    }
}

export async function storeModelForProvider(provider: LLMProvider, model: string): Promise<void> {
    const configDir = await getConfigDir();
    const modelPath = join(configDir, `${provider}-model`);
    await Deno.writeTextFile(modelPath, model);
}

// Provider-specific configuration (e.g., base URL for Ollama)
export async function getProviderConfig(provider: LLMProvider, key: string): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        const configPath = join(configDir, `${provider}-${key}`);
        const value = await Deno.readTextFile(configPath);
        return value.trim();
    } catch {
        return null;
    }
}

export async function storeProviderConfig(provider: LLMProvider, key: string, value: string): Promise<void> {
    const configDir = await getConfigDir();
    const configPath = join(configDir, `${provider}-${key}`);
    await Deno.writeTextFile(configPath, value);
}

// Commit Format settings
export async function storeDefaultFormat(format: CommitFormat): Promise<void> {
    const configDir = await getConfigDir();
    const formatPath = join(configDir, "default-format");
    await Deno.writeTextFile(formatPath, format);
}

export async function getDefaultFormat(): Promise<CommitFormat | null> {
    try {
        const configDir = await getConfigDir();
        const formatPath = join(configDir, "default-format");
        const format = await Deno.readTextFile(formatPath);
        return format as CommitFormat;
    } catch {
        return null;
    }
}
