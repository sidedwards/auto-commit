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

const COMMIT_PROMPT = `You are a Git Commit Message Generator that follows conventional commit standards. Generate commit messages directly without explanations or markdown formatting.

1. Follow the format: <type>(<scope>): <subject>
   
   Types:
   - feat: New features or significant changes to functionality
   - fix: Bug fixes
   - docs: Documentation changes only (.md, comments)
   - style: Code style/formatting changes
   - refactor: Code changes that neither fix bugs nor add features
   - test: Adding or modifying tests
   - chore: Maintenance tasks, dependencies, config
   
   Choose type based on the file extension and changes:
   - .ts, .js, .py etc → feat/fix/refactor for code changes
   - .md → docs for documentation
   - .css, .scss → style for styling
   - .test.ts, .spec.js → test for tests
   
   Subject: max 50 chars, imperative mood

2. Structure the message with:
   - Header: Brief summary in present tense
   - Blank line
   - Body: Bullet points explaining what/why/impact
   - Footer: Breaking changes, references

3. Use precise, actionable language:
   ✓ "Add user authentication"
   ✗ "Added some auth stuff"

4. Include only:
   • Specific changes made
   • Reasoning behind changes
   • Impact on functionality
   • Breaking changes (if any)

5. Mark breaking changes as:
   BREAKING CHANGE: <description>

RESPONSE FORMAT:
<type>(<scope>): <subject>

- Main change description
  * Impact or detail
  * Additional context
- Secondary change
  * Impact or detail
  * Additional context

BREAKING CHANGE: <description> (if applicable)

Do not include any explanatory text, markdown formatting, or quotes around the message.`;

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

// Add function to get staged file names
async function getStagedFiles(): Promise<string[]> {
    const command = new Deno.Command("git", {
        args: ["diff", "--staged", "--name-only"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        const errorMessage = new TextDecoder().decode(output.stderr);
        throw new Error(`Failed to get staged files: ${errorMessage}`);
    }

    return new TextDecoder()
        .decode(output.stdout)
        .trim()
        .split("\n")
        .filter(Boolean);
}

// Update checkStagedChanges function
async function checkStagedChanges(): Promise<string> {
    const command = new Deno.Command("git", {
        args: ["diff", "--staged", "--unified=3"],
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
async function main(): Promise<void> {
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
        // Get staged files first
        const stagedFiles = await getStagedFiles();
        
        if (stagedFiles.length === 0) {
            console.log("\n⚠ No staged changes found. Add files first with:");
            console.log("\n  git add <files>");
            console.log("\n  git add -p");
            return;
        }

        // Show files that will be committed
        console.log("\nStaged files to be committed:");
        console.log('┌' + '─'.repeat(72) + '┐');
        stagedFiles.forEach(file => {
            console.log(`│ ${file.padEnd(70)} │`);
        });
        console.log('└' + '─'.repeat(72) + '┘\n');

        // Confirm before proceeding
        const proceed = prompt("Generate commit message for these files? (y/n) ");
        if (proceed?.toLowerCase() !== 'y') {
            console.log("\n✗ Operation cancelled.");
            return;
        }

        // Get the diff and generate message
        const diff = await checkStagedChanges();
        const commitMessage = await getCommitMessage(diff, apiKey);

        console.log("\nProposed commit:\n");
        console.log('┌' + '─'.repeat(72) + '┐');
        console.log(commitMessage.split('\n').map(line => `│ ${line.padEnd(70)} │`).join('\n'));
        console.log('└' + '─'.repeat(72) + '┘\n');

        const choice = prompt("(a)ccept, (e)dit, (r)eject, (n)ew message? ");

        switch (choice?.toLowerCase()) {
            case 'a':
                // Implement actual git commit here
                const commitCommand = new Deno.Command("git", {
                    args: ["commit", "-m", commitMessage],
                    stdout: "piped",
                    stderr: "piped",
                });
                
                const commitResult = await commitCommand.output();
                if (!commitResult.success) {
                    throw new Error(`Failed to commit: ${new TextDecoder().decode(commitResult.stderr)}`);
                }
                console.log("\n✓ Changes committed!");
                break;
            case 'e':
                const editedMessage = await editInEditor(commitMessage);
                if (editedMessage !== commitMessage) {
                    console.log("\nEdited commit:\n");
                    console.log('┌' + '─'.repeat(72) + '┐');
                    console.log(editedMessage.split('\n').map(line => `│ ${line.padEnd(70)} │`).join('\n'));
                    console.log('└' + '─'.repeat(72) + '┘\n');
                    
                    // Implement git commit with edited message
                    const editedCommitCommand = new Deno.Command("git", {
                        args: ["commit", "-m", editedMessage],
                        stdout: "piped",
                        stderr: "piped",
                    });
                    
                    const editedCommitResult = await editedCommitCommand.output();
                    if (!editedCommitResult.success) {
                        throw new Error(`Failed to commit: ${new TextDecoder().decode(editedCommitResult.stderr)}`);
                    }
                    console.log("\n✓ Changes committed with edited message!");
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
