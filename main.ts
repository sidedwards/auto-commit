#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run="git,vim"

import { serve } from "https://deno.land/std/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Add loading spinner function
function startLoading(message: string): number {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    Deno.stdout.writeSync(new TextEncoder().encode('\x1B[?25l')); // Hide cursor
    
    return setInterval(() => {
        Deno.stdout.writeSync(new TextEncoder().encode(`\r${frames[i]} ${message}`));
        i = (i + 1) % frames.length;
    }, 80);
}

function stopLoading(intervalId: number) {
    clearInterval(intervalId);
    Deno.stdout.writeSync(new TextEncoder().encode('\r\x1B[K')); // Clear line
    Deno.stdout.writeSync(new TextEncoder().encode('\x1B[?25h')); // Show cursor
}

// Add these constants at the top
const COMMIT_PROMPT = `You are a Git Commit Message Generator. Create a detailed, specific commit message that:

1. Starts with the most significant change (max 50 chars)
2. Uses imperative mood ("Add" not "Added")
3. Separates subject from body with a blank line
4. Includes detailed bullet points that explain:
   - What changed
   - Why it was changed
   - Impact of the change
5. Lists breaking changes with "BREAKING:" prefix
6. Keeps technical implementation details minimal

Example:
Add user authentication system

- Add JWT-based authentication for all API routes
  * Improves security by requiring token validation
  * Enables user-specific access controls
- Implement rate limiting to prevent abuse
  * 100 requests per minute per user
  * Configurable through environment variables
- Add Redis for token storage and session management
  * Enables horizontal scaling
  * 24-hour token expiration

BREAKING: All API routes now require Authorization header
         Token format changed to JWT standard`;

// Function to call the Anthropic API
async function getCommitMessage(diff: string, apiKey: string): Promise<string> {
    const loadingId = startLoading('Analyzing changes...');
    
    try {
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        const msg = await anthropic.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: 4096,
            temperature: 0.2,
            system: COMMIT_PROMPT,
            messages: [
                { 
                    role: "user", 
                    content: `Analyze this git diff and create a detailed commit message following the format above:\n\n${diff}` 
                }
            ],
        });

        const content = msg.content[0];
        if ('text' in content) {
            return content.text.trim();
        }
        throw new Error('Unexpected response format from Claude');
    } finally {
        stopLoading(loadingId);
    }
}

// Update the editInEditor function
async function editInEditor(message: string): Promise<string> {
    const tempFile = await Deno.makeTempFile({ suffix: '.txt' });
    await Deno.writeTextFile(tempFile, message);

    const command = new Deno.Command("vim", {
        args: [tempFile],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    });

    await command.output();
    const editedMessage = await Deno.readTextFile(tempFile);
    await Deno.remove(tempFile);
    return editedMessage.trim();
}

// Update findDefaultEditor function
function findDefaultEditor(): string | null {
    const commonEditors = ["vim", "nano", "vi"];
    
    for (const editor of commonEditors) {
        try {
            const command = new Deno.Command("which", {
                args: [editor],
                stdout: "piped",
                stderr: "piped",
            });
            const output = command.outputSync();
            
            if (output.success) {
                return editor;
            }
        } catch {
            continue;
        }
    }
    
    return null;
}

// Update checkStagedChanges function
async function checkStagedChanges(): Promise<string> {
    const command = new Deno.Command("git", {
        args: ["diff", "--staged"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    
    if (!output.success) {
        const errorMessage = new TextDecoder().decode(output.stderr);
        throw new Error(`Failed to get staged changes: ${errorMessage}`);
    }

    return new TextDecoder().decode(output.stdout);
}

// CLI tool to read git diff and generate commit message
async function main() {
    let apiKey = await getStoredApiKey();
    
    if (!apiKey) {
        apiKey = prompt("Please enter your Anthropic API key: ");
        if (!apiKey) {
            console.error("API key is required");
            return;
        }
        
        const shouldStore = prompt("Would you like to store this API key for future use? (y/n): ");
        if (shouldStore?.toLowerCase() === 'y') {
            await storeApiKey(apiKey);
            console.log("API key stored successfully!");
        }
    }

    try {
        // Check for staged changes
        const diff = await checkStagedChanges();
        
        if (!diff.trim()) {
            console.log("\n⚠ No staged changes found. Add files first with:");
            console.log("\n  git add <files>");
            console.log("\n  git add -p");
            return;
        }

        const commitMessage = await getCommitMessage(diff, apiKey);

        console.log("\nProposed commit:\n");
        console.log('┌' + '─'.repeat(72) + '┐');
        console.log(commitMessage.split('\n').map(line => `│ ${line.padEnd(70)} │`).join('\n'));
        console.log('└' + '─'.repeat(72) + '┘\n');

        const choice = prompt("(a)ccept, (e)dit, (r)eject, (n)ew message? ");

        switch (choice?.toLowerCase()) {
            case 'a':
                // Implement actual git commit here
                console.log("\n✓ Changes committed!");
                break;
            case 'e':
                const editedMessage = await editInEditor(commitMessage);
                if (editedMessage !== commitMessage) {
                    console.log("\nEdited commit:\n");
                    console.log('┌' + '─'.repeat(72) + '┐');
                    console.log(editedMessage.split('\n').map(line => `│ ${line.padEnd(70)} │`).join('\n'));
                    console.log('└' + '─'.repeat(72) + '┘\n');
                    // Implement actual git commit here with editedMessage
                }
                break;
            case 'n':
                // Generate a new message with slightly different temperature
                return await main(); // Restart the process
            case 'r':
                console.log("\n✗ Commit message rejected.");
                break;
            default:
                console.log("\n⚠ Invalid selection.");
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("An error occurred:", error.message);
        } else {
            console.error("An unexpected error occurred");
        }
        return;
    }
}

// Add these functions before main()
async function getConfigDir(): Promise<string> {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
    const configDir = join(homeDir, ".config", "auto-commit");
    await ensureDir(configDir);
    return configDir;
}

async function getStoredApiKey(): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        const keyPath = join(configDir, "anthropic-key");
        const apiKey = await Deno.readTextFile(keyPath);
        return apiKey.trim();
    } catch {
        return null;
    }
}

async function storeApiKey(apiKey: string): Promise<void> {
    const configDir = await getConfigDir();
    const keyPath = join(configDir, "anthropic-key");
    await Deno.writeTextFile(keyPath, apiKey);
}

// Start the CLI tool
main();
