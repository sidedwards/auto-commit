import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { CommitFormat } from "../formats/commitFormat.ts";

export async function getConfigDir(): Promise<string> {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
    const configDir = join(homeDir, ".config", "auto-commit");
    await ensureDir(configDir);
    return configDir;
}

export async function getStoredApiKey(): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        const keyPath = join(configDir, "anthropic-key");
        const apiKey = await Deno.readTextFile(keyPath);
        return apiKey.trim();
    } catch {
        return null;
    }
}

export async function storeApiKey(apiKey: string): Promise<void> {
    const configDir = await getConfigDir();
    const keyPath = join(configDir, "anthropic-key");
    await Deno.writeTextFile(keyPath, apiKey);
}

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
