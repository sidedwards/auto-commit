#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run="git,vim"

import Anthropic from "npm:@anthropic-ai/sdk";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

// Export enum first
export enum CommitFormat {
    CONVENTIONAL = 'conventional',
    SEMANTIC = 'semantic',
    ANGULAR = 'angular',
    KERNEL = 'kernel'
}

// Then define all other functions and constants
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

// Add after imports
const CONVENTIONAL_FORMAT = `1. Follow the format:

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
<type>(<scope>): <subject> (only one per commit)

- Main change description
  * Impact or detail
  * Additional context
- Secondary change
  * Impact or detail
  * Additional context

BREAKING CHANGE: <description> (if applicable)

Do not include any explanatory text, markdown formatting, or quotes around the message.`;

const SEMANTIC_FORMAT = `1. Follow the format:

    Emojis:
    - ✨ New features
    - 🐛 Bug fixes
    - 📝 Documentation
    - 💄 UI/style updates
    - ⚡️ Performance
    - 🔨 Refactoring
    - 🚀 Deployments
    
2. Rules:
    1. Start with an emoji
    2. Use present tense
    3. First line is summary
    4. Include issue references
    
RESPONSE FORMAT:
:emoji: <subject>

<description>
- Change detail 1
- Change detail 2

<issue reference (only if in diff)>`;

const ANGULAR_FORMAT = `1. Follow Angular's commit format:
    Types:
    - build: Changes to build system
    - ci: CI configuration
    - docs: Documentation
    - feat: New feature
    - fix: Bug fix
    - perf: Performance
    - refactor: Code change
    - style: Formatting
    - test: Tests
    
    Rules:
    1. Subject in imperative mood
    2. No period at end
    3. Optional body with details
    4. Breaking changes marked
    5. Only include a single <type>(<scope>): <subject> line maximum
    
RESPONSE FORMAT:
<type>(<scope>): <subject> (only one per commit)

* Change detail 1
* Change detail 2

BREAKING CHANGE: <description> (if applicable)`;

const KERNEL_FORMAT = `1. Follow Linux kernel format:
    Rules:
    1. First line must be "<subsystem>: <brief description>"
    2. Subsystem should be the main component being changed
    3. Description should be clear and concise
    4. Body explains the changes in detail
    5. Wrap all lines at 72 characters
    6. End with Signed-off-by line
    
RESPONSE FORMAT:
<subsystem>: <brief description>

<detailed explanation of what changed and why>
<continue explanation, wrapped at 72 characters>

Signed-off-by: <author> <email>

IMPORTANT: Replace all placeholders with real values from the diff.`;

// Add new function to get commit history for analysis
async function getCommitHistory(author?: string, limit = 50): Promise<string> {
    const args = ["log", `-${limit}`, "--pretty=format:%s%n%b%n---"];
    if (author) {
        args.push(`--author=${author}`);
    }
    
    const command = new Deno.Command("git", {
        args: args,
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        throw new Error(`Failed to get commit history: ${new TextDecoder().decode(output.stderr)}`);
    }

    return new TextDecoder().decode(output.stdout);
}

// Add function to analyze commit style
async function analyzeCommitStyle(commits: string, apiKey: string): Promise<string> {
    const loadingId = startLoading('Analyzing commit style...');
    
    try {
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            temperature: 0,
            messages: [
                { 
                    role: "user", 
                    content: `Extract commit message rules from these commits. Create a minimal style guide that:

1. Lists only essential rules
2. Uses simple, direct language
3. Includes 2-3 real examples from the commits
4. Omits explanations and formatting
5. Focuses on practical patterns

Format as plain text with no markdown or bullets. Number each rule.

Analyze these commits:

${commits}`
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

// Update getCommitMessage function signature to remove test client
async function getCommitMessage(
    diff: string, 
    apiKey: string,
    systemPrompt?: string,
): Promise<string> {
    const loadingId = startLoading('Generating commit message...');
            
    try {
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            temperature: 0.2,
            system: systemPrompt,
            messages: [{ 
                role: "user", 
                content: `Generate a commit message for these changes:\n\n${diff}\n\nIMPORTANT: 
1. Generate ONLY the commit message
2. Do not include any explanatory text or formatting
3. Do not repeat the header line
4. Follow this exact structure:
   - One header line
   - One blank line
   - Bullet points for changes
   - Breaking changes (if any)
5. Never include the diff or any git output`
            }],
        });

        const content = msg.content[0];
        if (!('text' in content)) {
            throw new Error('Unexpected response format from Claude');
        }

        // Post-process the message to ensure proper formatting
        const lines = content.text.split('\n').filter(line => line.trim() !== '');
        const headerLine = lines[0];
        const bodyLines = [];
        const breakingChanges = [];
        
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

        // Combine with proper spacing
        const parts = [
            headerLine,
            '',  // Blank line after header
            ...bodyLines
        ];

        // Add breaking changes with blank line before them if they exist
        if (breakingChanges.length > 0) {
            parts.push('');  // Extra blank line before breaking changes
            parts.push(...breakingChanges);
        }

        return parts.join('\n');
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
    // First get list of staged files
    const stagedFiles = await getStagedFiles();
    let fullDiff = '';

    // Get diff for each staged file
    for (const file of stagedFiles) {
        const command = new Deno.Command("git", {
            args: ["diff", "--staged", "--unified=3", "--", file],
            stdout: "piped",
            stderr: "piped",
        });

        const output = await command.output();
        
        if (!output.success) {
            const errorMessage = new TextDecoder().decode(output.stderr);
            throw new Error(`Failed to get staged changes for ${file}: ${errorMessage}`);
        }

        fullDiff += new TextDecoder().decode(output.stdout) + '\n';
    }

    if (!fullDiff) {
        throw new Error('No staged changes found');
    }

    return fullDiff;
}

// Add function to get unique authors with commit counts
async function listAuthors(): Promise<void> {
    const command = new Deno.Command("git", {
        args: [
            "shortlog",
            "-sne",  // s=summary, n=sorted by count, e=email
            "--all", // Include all branches
        ],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        throw new Error(`Failed to get authors: ${new TextDecoder().decode(output.stderr)}`);
    }

    const authors = new TextDecoder()
        .decode(output.stdout)
        .trim()
        .split("\n")
        .map(line => {
            const [count, author] = line.trim().split("\t");
            return { count: parseInt(count.trim()), author: author.trim() };
        });

    // Print formatted table with explicit column widths
    console.log("\nRepository Authors:");
    console.log('┌────────┬──────────────────────────────────────────────────────────────┐');
    console.log('│ Commits│ Author                                                       │');
    console.log('├────────┼──────────────────────────────────────────────────────────────┤');
    
    authors.forEach(({ count, author }) => {
        const countStr = count.toString().padStart(6);
        console.log(`│ ${countStr} │ ${author.padEnd(60)} │`);  // Added space after countStr
    });
    
    console.log('└────────┴──────────────────────────────────────────────────────────────┘\n');
}

// Add new functions for format management
async function storeCommitStyle(style: string, author?: string): Promise<void> {
    const configDir = await getConfigDir();
    const stylePath = author 
        ? join(configDir, `style-${author}`)
        : join(configDir, "default-style");
    await Deno.writeTextFile(stylePath, style);
}

async function getStoredCommitStyle(author?: string): Promise<string | null> {
    try {
        const configDir = await getConfigDir();
        // Try author-specific style first
        if (author) {
            try {
                const authorStylePath = join(configDir, `style-${author}`);
                return await Deno.readTextFile(authorStylePath);
            } catch {
                // Fall back to default style
            }
        }
        // Try default style
        const defaultStylePath = join(configDir, "default-style");
        return await Deno.readTextFile(defaultStylePath);
    } catch {
        return null;
    }
}

// Add new function to store default format
async function storeDefaultFormat(format: CommitFormat): Promise<void> {
    const configDir = await getConfigDir();
    const formatPath = join(configDir, "default-format");
    await Deno.writeTextFile(formatPath, format);
}

// Add new function to get default format
async function getDefaultFormat(): Promise<CommitFormat | null> {
    try {
        const configDir = await getConfigDir();
        const formatPath = join(configDir, "default-format");
        const format = await Deno.readTextFile(formatPath);
        return format as CommitFormat;
    } catch {
        return null;
    }
}

// Update main function to use stored styles
async function main(): Promise<void> {
    const flags = parse(Deno.args, {
        string: ["author", "format"],
        boolean: ["help", "learn", "list-authors"],
        alias: { h: "help" },
    });

    // Handle --help flag
    if (flags.help) {
        console.log(`
auto-commit - AI-powered git commit message generator

USAGE:
    auto-commit [OPTIONS]
    git ac  # if git alias configured

OPTIONS:
    -h, --help              Show this help message
    --format=<style>        Use specific commit format:
                           - conventional (default)
                           - semantic (with emojis)
                           - angular
                           - kernel (Linux kernel style)
    --learn                 Learn commit style from repository history
    --author=<email>       Learn commit style from specific author
    --list-authors         List all authors in repository
    --reset-format         Reset to default commit format

EXAMPLES:
    # Use default format (conventional)
    git add .
    auto-commit

    # Use specific format
    auto-commit --format=semantic

    # Learn from repository
    auto-commit --learn

    # Learn from author
    auto-commit --learn --author="user@example.com"

CONFIGURATION:
    First run will prompt for Anthropic API key
    Configs stored in ~/.config/auto-commit/

For more information, visit: https://github.com/sidedwards/auto-commit
`);
        return;
    }

    // Handle --list-authors flag
    if (flags["list-authors"]) {
        await listAuthors();
        return;
    }

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

    // Allow resetting the format
    if (flags["reset-format"]) {
        const configDir = await getConfigDir();
        const formatPath = join(configDir, "default-format");
        try {
            await Deno.remove(formatPath);
            console.log("Reset commit format to default");
            return;
        } catch {
            // File doesn't exist, that's fine
        }
    }

    // Handle format selection
    if (flags.learn) {
        // Learning mode - analyze and store the style
        const commits = await getCommitHistory(flags.author);
        const styleGuide = await analyzeCommitStyle(commits, apiKey);
        
        // Store as both author-specific (if specified) and default style
        if (flags.author) {
            await storeCommitStyle(styleGuide, flags.author);
        }
        await storeCommitStyle(styleGuide); // Store as default
        
        // Remove this line - don't force Conventional format
        // await storeDefaultFormat(CommitFormat.CONVENTIONAL);
        
        console.log(`\nLearned and saved commit style${flags.author ? ` for ${flags.author}` : ''}`);
    } else if (flags.format) {
        // Explicit format specified
        const formatInput = flags.format.toLowerCase();
        let selectedFormat = CommitFormat.CONVENTIONAL;
        
        // Handle common typos and variations
        if (formatInput.includes('kern')) {
            selectedFormat = CommitFormat.KERNEL;
        } else if (formatInput.includes('sem')) {
            selectedFormat = CommitFormat.SEMANTIC;
        } else if (formatInput.includes('ang')) {
            selectedFormat = CommitFormat.ANGULAR;
        } else if (formatInput.includes('con')) {
            selectedFormat = CommitFormat.CONVENTIONAL;
        }

        const template = 
            selectedFormat === CommitFormat.KERNEL ? KERNEL_FORMAT :
            selectedFormat === CommitFormat.SEMANTIC ? SEMANTIC_FORMAT :
            selectedFormat === CommitFormat.ANGULAR ? ANGULAR_FORMAT :
            CONVENTIONAL_FORMAT;
            
        await storeCommitStyle(template);
        // Store the format as default
        await storeDefaultFormat(selectedFormat);
    }

    // Use format flag if provided
    let selectedFormat = CommitFormat.CONVENTIONAL;  // default
    if (typeof flags.format === 'string') {  // Type check the flag
        const formatInput = flags.format.toLowerCase();
        // Handle common typos and variations
        if (formatInput.includes('kern')) {
            selectedFormat = CommitFormat.KERNEL;
        } else if (formatInput.includes('sem')) {
            selectedFormat = CommitFormat.SEMANTIC;
        } else if (formatInput.includes('ang')) {
            selectedFormat = CommitFormat.ANGULAR;
        } else if (formatInput.includes('con')) {
            selectedFormat = CommitFormat.CONVENTIONAL;
        }
    } else {
        selectedFormat = await getDefaultFormat() || CommitFormat.CONVENTIONAL;
    }

    console.log(`Using commit format: ${selectedFormat}`);

    if (flags.learn) {
        try {
            const commits = await getCommitHistory(flags.author);
            const styleGuide = await analyzeCommitStyle(commits, apiKey);
            
            // Store the learned style
            await storeCommitStyle(styleGuide, flags.author);
            
            console.log("\nLearned and saved commit style from repository history.");
        } catch (error) {
            console.error("Failed to learn commit style:", error);
            console.log("Falling back to default commit style...");
        }
    } else {
        // Try to load previously learned style
        const storedStyle = await getStoredCommitStyle(flags.author);
        if (storedStyle) {
            console.log("\nUsing previously learned commit style.");
        }
    }

    if (!selectedFormat) {
        // Only show format selection on first use
        const formatChoices = {
            '1': CommitFormat.CONVENTIONAL,
            '2': CommitFormat.SEMANTIC,
            '3': CommitFormat.ANGULAR,
            '4': CommitFormat.KERNEL
        };

        console.log("\nChoose default commit format:");
        console.log("1. Conventional (recommended)");
        console.log("2. Semantic (with emojis)");
        console.log("3. Angular");
        console.log("4. Linux Kernel");

        const formatChoice = prompt("Select format (1-4): ") || "1";
        selectedFormat = formatChoices[formatChoice as keyof typeof formatChoices] || CommitFormat.CONVENTIONAL;
        
        // Store the choice
        await storeDefaultFormat(selectedFormat);
        console.log(`\nSaved ${selectedFormat} as your default commit format.`);
        console.log('You can change this later with --format flag or by deleting ~/.config/auto-commit/default-format');
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
            console.log(` ${file.padEnd(70)} │`);
        });
        console.log('└' + '─'.repeat(72) + '┘\n');

        // Confirm before proceeding
        const proceed = prompt("Generate commit message for these files? (y/n) ");
        if (proceed?.toLowerCase() !== 'y') {
            console.log("\n✗ Operation cancelled.");
            return;
        }

        // Get the diff and generate message
        try {
            const diff = await checkStagedChanges();
            // Get the appropriate format template
            const formatTemplate = selectedFormat === CommitFormat.KERNEL ? KERNEL_FORMAT :
                                    selectedFormat === CommitFormat.SEMANTIC ? SEMANTIC_FORMAT :
                                    selectedFormat === CommitFormat.ANGULAR ? ANGULAR_FORMAT :
                                    CONVENTIONAL_FORMAT;
    
            // Create the system prompt
            const systemPrompt = `You are a Git Commit Message Generator. Generate ONLY a commit message following this commit format:

${flags.learn || flags.author ? await getStoredCommitStyle(flags.author) : formatTemplate}

IMPORTANT: 
1. Base your message on ALL changes in the diff
2. Consider ALL files being modified (${stagedFiles.join(', ')})
3. Do not focus only on the first file
4. Summarize the overall changes across all files
5. Include significant changes from each modified file
6. Do not make assumptions or add fictional features
7. Never include issue numbers unless they appear in the diff
8. Do not include any format templates or placeholders
9. Never output the response format template itself
10. Only include ONE header line
11. Never duplicate any lines, especially the header
12. Sort changes by priority and logical groups
13. Never include preamble or explanation
14. Never include the diff or any git-specific output
15. Structure should be:
    - Single header line
    - Blank line
    - Body with bullet points
    - Breaking changes (if any)`;
    
            const commitMessage = await getCommitMessage(
                diff, 
                apiKey, 
                systemPrompt
            );

            console.log("\nProposed commit:\n");
            console.log('┌' + '─'.repeat(72) + '┐');
            console.log(commitMessage.split('\n').map(line => {
                // If line is longer than 70 chars, wrap it
                if (line.length > 70) {
                    const words = line.split(' ');
                    let currentLine = '';
                    const wrappedLines = [];
                    
                    words.forEach(word => {
                        if ((currentLine + ' ' + word).length <= 70) {
                            currentLine += (currentLine ? ' ' : '') + word;
                        } else {
                            wrappedLines.push(`│ ${currentLine.padEnd(70)} │`);
                            currentLine = word;
                        }
                    });
                    if (currentLine) {
                        wrappedLines.push(`│ ${currentLine.padEnd(70)} │`);
                    }
                    return wrappedLines.join('\n');
                }
                // If line is <= 70 chars, pad it as before
                return `│ ${line.padEnd(70)} │`;
            }).join('\n'));
            console.log('└' + '─'.repeat(72) + '┘\n');

            const choice = prompt("(a)ccept, (e)dit, (r)eject, (n)ew message? ");

            switch (choice?.toLowerCase()) {
                case 'a': {
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
                }
                case 'e': {
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
                }
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
            console.error("Failed to generate commit message:", error);
            return;
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

// Run main only when directly executed
if (import.meta.main) {
    main();
}
