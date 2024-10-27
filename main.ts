#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run="git,vim"

import Anthropic from "npm:@anthropic-ai/sdk";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";
import chalk from "npm:chalk@5";

// Export enum first
export enum CommitFormat {
    CONVENTIONAL = 'conventional',
    SEMANTIC = 'semantic',
    ANGULAR = 'angular',
    KERNEL = 'kernel',
    REPO = 'repo',
    CUSTOM = 'custom',
    ISSUE_REFERENCE = 'issue',  // Add new format
}

// Then define all other functions and constants
const COLORS = {
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    dim: chalk.dim,
    bold: chalk.bold,
    header: chalk.cyan.bold,
    action: chalk.yellow.bold, // Add this for action keys
};

// Update startLoading with chalk
function startLoading(message: string): number {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    Deno.stdout.writeSync(new TextEncoder().encode('\x1B[?25l')); // Hide cursor
    
    return setInterval(() => {
        const spinner = COLORS.info(frames[i]);
        const msg = COLORS.dim(message);
        Deno.stdout.writeSync(new TextEncoder().encode(`\r${spinner} ${msg}`));
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

6. If a referenced issue ID is available, replace <scope> with <ISSUE_ID> and include it as:
    <type>(#<ISSUE_ID>): <subject>
7. If no referenced issue ID is available add a scope based on the changes and format like:
    <type>(<scope>): <subject>

RESPONSE FORMAT:
<type>(<scope> or #<ISSUE_ID>): <subject> (only include once per commit)

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
    4. If a referenced issue ID is available, add a new line at the end:
        Reference: #<ISSUE_ID>
    5. If no issue ID is available, do not include the Reference line
    
RESPONSE FORMAT:
:emoji: <subject>

<short description>
- Change detail 1
- Change detail 2
- ...

Reference: #<ISSUE_ID> (if available)`;

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
    5. If a referenced issue ID is available, replace <scope> with <ISSUE_ID> and include it as:
        <type>(#<ISSUE_ID>): <subject>
    6. If no referenced issue ID is available add a scope based on the changes and format like:
        <type>(<scope>): <subject>
    
RESPONSE FORMAT:
<type>(<scope> or #<ISSUE_ID>): <subject> (only one per commit)

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
    6. End with Signed-off-by line using git author info
    7. Never include the diff or any git output
    8. If a referenced issue ID is available, add a new line above the Signed-off-by line for Reference with the issue ID like:
        Reference: #<ISSUE_ID>
    
RESPONSE FORMAT:
<subsystem>: <brief description>

<detailed explanation of what changed and why>
<continue explanation, wrapped at 72 characters>

Signed-off-by: {{GIT_AUTHOR}}

Reference: #<ISSUE_ID> (if available)`;

const ISSUE_FORMAT = `1. Follow the issue reference format:
    Rules:
    1. First line must be "[#ISSUE_ID_IF_ANY]: brief description"
    2. If no issue is found, just include the brief description
    3. Description should be clear and concise
    4. Use present tense, imperative mood
    5. Reference only issues mentioned in the diff
    6. DO NOT make up an issue ID
    
RESPONSE FORMAT:
[#ISSUE_ID_IF_ANY]: brief description

- Main implementation details
- Additional changes
- Impact or considerations
`;

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

// Add function to get related issues
async function getRelatedIssues(diff: string): Promise<Array<{number: number, title: string}>> {
    try {
        // Extract potential issue numbers from diff
        const issueRefs = diff.match(/#\d+/g) || [];
        const uniqueIssues = [...new Set(issueRefs.map(ref => ref.slice(1)))];

        let issues = [];

        if (uniqueIssues.length > 0) {
            // Verify existence of issues using GitHub CLI
            const command = new Deno.Command("gh", {
                args: ["issue", "list", 
                      "--json", "number,title",
                      "--limit", "100",
                      "-R", ".", // current repo
                      ...uniqueIssues.map(issue => `#${issue}`)],
                stdout: "piped",
                stderr: "piped",
            });

            const output = await command.output();
            if (!output.success) {
                throw new Error(`Failed to fetch issues: ${new TextDecoder().decode(output.stderr)}`);
            }

            issues = JSON.parse(new TextDecoder().decode(output.stdout));
        }

        // If no direct issue references, search for issues using keywords
        if (issues.length === 0) {
            const keywords = extractKeywordsFromDiff(diff);
            if (keywords.length > 0) {
                const searchCommand = new Deno.Command("gh", {
                    args: ["issue", "search", 
                          "--json", "number,title",
                          "--limit", "5",
                          "-R", ".", // current repo
                          ...keywords],
                    stdout: "piped",
                    stderr: "piped",
                });

                const searchOutput = await searchCommand.output();
                if (!searchOutput.success) {
                    throw new Error(`Failed to fetch issues: ${new TextDecoder().decode(searchOutput.stderr)}`);
                }

                issues = JSON.parse(new TextDecoder().decode(searchOutput.stdout));
            }
        }

        return issues;
    } catch {
        return [];
    }
}

function extractKeywordsFromDiff(diff: string): string[] {
    // Define a set of common words to ignore
    const commonWords = new Set([
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were', 
        'will', 'would', 'could', 'should', 'have', 'has', 'had', 'not', 'but', 
        'or', 'if', 'then', 'else', 'when', 'while', 'do', 'does', 'did', 'done',
        'in', 'on', 'at', 'by', 'to', 'of', 'a', 'an', 'is', 'it', 'as', 'be', 
        'can', 'may', 'might', 'must', 'shall', 'which', 'who', 'whom', 'whose',
        'what', 'where', 'why', 'how', 'all', 'any', 'some', 'no', 'none', 'one',
        'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
    ]);

    // Use a regular expression to extract words and identifiers
    const words = diff.match(/\b\w+\b/g) || [];

    // Filter out common words and return unique keywords
    const keywords = words
        .filter(word => !commonWords.has(word.toLowerCase()))
        .map(word => word.toLowerCase());

    return [...new Set(keywords)];
}

// Add new function to get git author info
async function getGitAuthor(): Promise<{ name: string, email: string }> {
    const nameCmd = new Deno.Command("git", {
        args: ["config", "user.name"],
        stdout: "piped",
    });
    const emailCmd = new Deno.Command("git", {
        args: ["config", "user.email"],
        stdout: "piped",
    });

    const [nameOutput, emailOutput] = await Promise.all([
        nameCmd.output(),
        emailCmd.output(),
    ]);

    return {
        name: new TextDecoder().decode(nameOutput.stdout).trim(),
        email: new TextDecoder().decode(emailOutput.stdout).trim()
    };
}

// Update getCommitMessage to include author info for kernel format
async function getCommitMessage(
    diff: string, 
    apiKey: string,
    systemPrompt?: string,
    selectedIssue?: { number: number, title: string } | null,
    selectedFormat?: CommitFormat
): Promise<string> {
    if (selectedFormat === CommitFormat.KERNEL) {
        const author = await getGitAuthor();
        systemPrompt = `${systemPrompt}\n\nGit Author: ${author.name} <${author.email}>`;
    }
    const loadingId = startLoading('Generating commit message...');
    
    try {
        // Get related issues first
        const relatedIssues = await getRelatedIssues(diff);
        
        // Add issue context to system prompt if available
        if (selectedIssue) {
            systemPrompt += `\n\nReferenced issue: #${selectedIssue.number}: ${selectedIssue.title}
Include the issue ID as a reference according to the commit message format.`;
        } else {
            systemPrompt += `\n\nNo issue referenced`;
        }
        
        if (relatedIssues.length > 0) {
            systemPrompt += `\n\nRelated issues:\n${
                relatedIssues.map(issue => `#${issue.number}: ${issue.title}`).join('\n')
            }`;
        }
        
        const anthropic = new Anthropic({
            apiKey: apiKey,
        });

        // console.log(systemPrompt);

        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            temperature: 0.2,
            system: systemPrompt,
            messages: [{ 
                role: "user", 
                content: `Generate a commit message for ALL key changes from the diff:\n\n${diff}\n\nIMPORTANT: 
1. Do not include any explanatory text or formatting
2. Do not make up features, changes, or issue numbers not present in the diff
3. Do not repeat the header line
4. IMPORTANT: NEVER include the diff in the response
5. Do not include "diff --git" or any git output
6. Follow this exact structure:
   - One header line
   - One blank line
   - Bullet points for actual changes
   - Breaking changes (if any)`
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
        
        // Return the formatted commit message
        return `${headerLine}\n\n${bodyLines.join('\n')}\n\n${breakingChanges.join('\n')}`;
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
    console.log('├────────┼───────────────────────────────────────────────────────────────');
    
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

// Add helper function for creating file tree
function createFileTree(files: string[]): string[] {
    const tree: string[] = [];
    const sortedFiles = files.sort();
    const maxWidth = 68; // Width of box content
    
    for (const file of sortedFiles) {
        const parts = file.split('/');
        
        if (parts.length === 1) {
            const line = `${COLORS.dim('├──')} ${COLORS.info(file)}`;
            tree.push(line.padEnd(maxWidth));
        } else {
            const fileName = parts.pop()!;
            const prefix = COLORS.dim('│   ').repeat(parts.length - 1);
            const line = `${prefix}${COLORS.dim('├──')} ${COLORS.info(fileName)}`;
            tree.push(line.padEnd(maxWidth));
        }
    }
    
    // Replace last '├──' with '└──'
    if (tree.length > 0) {
        tree[tree.length - 1] = tree[tree.length - 1].replace('├──', '└──');
    }
    
    return tree;
}

// Add helper function for format display
function getFormatDisplayName(format: CommitFormat, author?: string): string {
    const formatName = format.charAt(0).toUpperCase() + format.slice(1);
    const context = author ? ` (customized for ${author})` :
                   format === CommitFormat.REPO ? " (learned from repository)" :
                   format === CommitFormat.CUSTOM ? " (custom)" :
                   " (default)";
    
    return COLORS.header("Format:") + " " + COLORS.info(formatName) + COLORS.dim(context);
}

// Add helper function for format template selection
async function getFormatTemplate(format: CommitFormat, author?: string): Promise<string> {
    // If using author-specific style, use stored style
    if (author) {
        return await getStoredCommitStyle(author) || CONVENTIONAL_FORMAT;
    }
    
    // Otherwise use the appropriate format
    switch (format) {
        case CommitFormat.KERNEL:
            return KERNEL_FORMAT;
        case CommitFormat.SEMANTIC:
            return SEMANTIC_FORMAT;
        case CommitFormat.ANGULAR:
            return ANGULAR_FORMAT;
        case CommitFormat.REPO:
        case CommitFormat.CUSTOM:
            return await getStoredCommitStyle() || CONVENTIONAL_FORMAT;
        case CommitFormat.ISSUE_REFERENCE:
            return ISSUE_FORMAT;
        default:
            return CONVENTIONAL_FORMAT;
    }
}

async function getRepoInfo(): Promise<string | null> {
    const command = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        console.error(`Failed to get remote URL: ${new TextDecoder().decode(output.stderr)}`);
        return null;
    }

    const url = new TextDecoder().decode(output.stdout).trim();
    const match = url.match(/[:/]([^/]+\/[^/.]+)(\.git)?$/);
    return match ? match[1] : null;
}

async function isGitHubRepo(): Promise<boolean> {
    const command = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
        stdout: "piped",
        stderr: "piped",
    });

    try {
        const output = await command.output();
        if (!output.success) return false;

        const url = new TextDecoder().decode(output.stdout).trim();
        return url.includes('github.com');
    } catch {
        return false;
    }
}

async function searchAndSelectIssue(): Promise<{ number: number, title: string } | null> {
    const repo = await getRepoInfo();
    if (!repo) {
        console.error("Could not determine the repository information.");
        return null;
    }

    const isGitHub = await isGitHubRepo();
    if (!isGitHub) {
        return null;
    }

    const keywords = prompt("Enter keywords to search for issues (or press Enter to skip): ");
    if (!keywords) return null;

    const searchCommand = new Deno.Command("gh", {
        args: ["issue", "list", 
              "--search", keywords,
              "--json", "number,title",
              "--limit", "5",
              "-R", repo], // Use the dynamically determined repo
        stdout: "piped",
        stderr: "piped",
    });

    const searchOutput = await searchCommand.output();
    if (!searchOutput.success) {
        console.error(`Failed to search issues: ${new TextDecoder().decode(searchOutput.stderr)}`);
        return null;
    }

    const issues = JSON.parse(new TextDecoder().decode(searchOutput.stdout));
    if (issues.length === 0) {
        console.log("No issues found.");
        return null;
    }

    console.log(`\n${COLORS.header("Found issues:")}`);
    console.log('┌──────┬────────┬───────────────────────��──────────────────────────────────┐');
    console.log('│ Sel# │ ID     │ Title                                                    │');
    console.log('├──────┼────────┼──────────────────────────────────────────────────────────┤');

    interface Issue {
        number: number;
        title: string;
    }

    issues.forEach((issue: Issue, index: number) => {
        console.log(
            `│  ${(index + 1).toString().padEnd(3)} │ ` +
            `#${issue.number.toString().padEnd(5)} │ ` +
            `${issue.title.slice(0, 50).padEnd(50)} │`
        );
    });
    console.log('└──────┴────────┴──────────────────────────────────────────────────────────┘\n');

    const choice = prompt("Select an issue by number (or press Enter to skip): ");
    const selectedIndex = parseInt(choice || "", 10) - 1;
    if (selectedIndex >= 0 && selectedIndex < issues.length) {
        return issues[selectedIndex];
    }

    return null;
}

// Add formatting helper functions
function createBox(content: string): string {
    const maxWidth = 70;
    const contentWidth = maxWidth - 2; // Account for borders
    const horizontal = '─'.repeat(maxWidth);
    
    // Helper to wrap text
    function wrapText(text: string): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= contentWidth) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);
        return lines;
    }
    
    // Process all lines and wrap them
    const wrappedLines = content.split('\n').flatMap(line => wrapText(line));
    
    let result = `┌${horizontal}┐\n`;
    wrappedLines.forEach(line => {
        result += `│${line.padEnd(maxWidth - 2)}│\n`;
    });
    result += `└${horizontal}┘`;
    
    return result;
}

async function commitChanges(message: string): Promise<void> {
    const command = new Deno.Command("git", {
        args: ["commit", "-m", message],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        throw new Error(`Failed to commit: ${new TextDecoder().decode(output.stderr)}`);
    }
    console.log("\n✓ Changes committed successfully!");
}

// Update main function to use stored styles
async function main(): Promise<void> {
    const flags = parse(Deno.args, {
        string: ["author", "format"],
        boolean: ["help", "learn", "list-authors"],
        alias: { h: "help" },
    });

    // Update format selection logic
    let selectedFormat = flags.format 
        ? (Object.values(CommitFormat).find(f => f.startsWith(flags.format?.toLowerCase() || '')) || CommitFormat.CONVENTIONAL)
        : (await getDefaultFormat() || CommitFormat.CONVENTIONAL);

    // Store the selected format
    if (flags.format) {
        await storeDefaultFormat(selectedFormat);
    }

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
        try {
            const commits = await getCommitHistory(flags.author);
            const styleGuide = await analyzeCommitStyle(commits, apiKey);
            
            if (flags.author) {
                await storeCommitStyle(styleGuide, flags.author);
                await storeCommitStyle(styleGuide);  // Also store as default
                await storeDefaultFormat(CommitFormat.CUSTOM);
                selectedFormat = CommitFormat.CUSTOM;
            } else {
                await storeCommitStyle(styleGuide);
                await storeDefaultFormat(CommitFormat.REPO);
                selectedFormat = CommitFormat.REPO;
            }
            
            console.log("\n" + getFormatDisplayName(selectedFormat, flags.author));
        } catch (error) {
            console.error(COLORS.error("Error:") + " Failed to learn commit style:", error);
            console.log(COLORS.dim("Falling back to default commit style..."));
            selectedFormat = CommitFormat.CONVENTIONAL;
        }
    } else if (flags.format) {
        // Explicit format specified - store both format and its template
        const formatInput = flags.format.toLowerCase();
        let selectedFormat = CommitFormat.CONVENTIONAL;
        
        // Handle format selection as before
        if (formatInput.includes('kern')) {
            selectedFormat = CommitFormat.KERNEL;
        } else if (formatInput.includes('sem')) {
            selectedFormat = CommitFormat.SEMANTIC;
        } else if (formatInput.includes('ang')) {
            selectedFormat = CommitFormat.ANGULAR;
        } else if (formatInput.includes('con')) {
            selectedFormat = CommitFormat.CONVENTIONAL;
        } else if (formatInput.includes('iss')) {
            selectedFormat = CommitFormat.ISSUE_REFERENCE;
        }

        const template = 
            selectedFormat === CommitFormat.KERNEL ? KERNEL_FORMAT :
            selectedFormat === CommitFormat.SEMANTIC ? SEMANTIC_FORMAT :
            selectedFormat === CommitFormat.ANGULAR ? ANGULAR_FORMAT :
            selectedFormat === CommitFormat.ISSUE_REFERENCE ? ISSUE_FORMAT :
            CONVENTIONAL_FORMAT;
            
        await storeCommitStyle(template);
        await storeDefaultFormat(selectedFormat);
    }

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
            const formatName = selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1);
            console.log("\n" + COLORS.header("Format:") + " " + COLORS.info(formatName) + 
                (flags.author ? ` (customized for ${flags.author})` : 
                 selectedFormat === CommitFormat.REPO ? " (learned from repository)" : 
                 " (default)"));
        }
    }

    if (!selectedFormat) {
        // Only show format selection on first use
        const formatChoices = {
            '1': CommitFormat.CONVENTIONAL,
            '2': CommitFormat.SEMANTIC,
            '3': CommitFormat.ANGULAR,
            '4': CommitFormat.KERNEL,
            '5': CommitFormat.ISSUE_REFERENCE
        };

        console.log("\nChoose default commit format:");
        console.log("1. Conventional (recommended)");
        console.log("2. Semantic (with emojis)");
        console.log("3. Angular");
        console.log("4. Linux Kernel");
        console.log("5. Issue Reference ([#123]: description)");

        const formatChoice = prompt("Select format (1-5): ") || "1";
        selectedFormat = formatChoices[formatChoice as keyof typeof formatChoices] || CommitFormat.CONVENTIONAL;
        
        // Store the choice
        await storeDefaultFormat(selectedFormat);
        console.log(`\nSaved ${selectedFormat} as your default commit format.`);
        console.log('You can change this later with --format flag or by deleting ~/.config/auto-commit/default-format');
    }

    try {
        // Move selectedIssue outside the try block so it persists across retries
        const selectedIssue = await searchAndSelectIssue();
        
        while (true) { // Add loop for retries
            const diff = await getDiff();
            const apiKey = await getStoredApiKey();
            const systemPrompt = await getFormatTemplate(selectedFormat);

            if (!apiKey) {
                throw new Error("API key is required");
            }
            const commitMessage = await getCommitMessage(diff, apiKey, systemPrompt, selectedIssue, selectedFormat);

            // Show staged files first with bold header
            console.log(`\n${COLORS.header("Staged files to be committed:")}`);
            const stagedFiles = await getStagedFiles();
            console.log(createBox(createFileTree(stagedFiles).join('\n')));

            const proceed = prompt("\nGenerate commit message for these files? (y/n) ");
            if (proceed?.toLowerCase() !== 'y') {
                return;
            }

            displayCommitMessage(commitMessage);

            // Format action keys in bold
            const choice = prompt(`\n${COLORS.action("(a)")}ccept, ${COLORS.action("(e)")}dit, ${COLORS.action("(r)")}eject, ${COLORS.action("(n)")}ew message? `);
            
            switch (choice?.toLowerCase()) {
                case 'a':
                    await commitChanges(commitMessage);
                    return;
                case 'e': {
                    const editedMessage = await editInEditor(commitMessage);
                    if (editedMessage) {
                        await commitChanges(editedMessage);
                    }
                    return;
                }
                case 'n':
                    continue; // Continue the loop instead of calling main() recursively
                case 'r':
                    console.log("\n✗ Commit message rejected.");
                    return;
                default:
                    console.log("\n✗ Invalid choice. Commit cancelled.");
                    return;
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
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

async function getDiff(): Promise<string> {
    const command = new Deno.Command("git", {
        args: ["diff", "--staged"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        const errorMessage = new TextDecoder().decode(output.stderr);
        throw new Error(`Failed to get diff: ${errorMessage}`);
    }

    return new TextDecoder().decode(output.stdout);
}

// Replace createBox with a simpler message display
function displayCommitMessage(message: string): void {
    console.log(COLORS.header("\nProposed commit:"));
    console.log(COLORS.dim("─".repeat(80)));
    console.log(message);
    console.log(COLORS.dim("─".repeat(80)));
}

