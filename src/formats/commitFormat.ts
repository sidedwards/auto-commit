import { getConfigDir } from "../config/config.ts";
import { join } from "https://deno.land/std/path/mod.ts";

export enum CommitFormat {
    CONVENTIONAL = 'conventional',
    SEMANTIC = 'semantic',
    ANGULAR = 'angular',
    KERNEL = 'kernel',
    REPO = 'repo',
    CUSTOM = 'custom',
    ISSUE_REFERENCE = 'issue',
}

export const CONVENTIONAL_FORMAT = `1. Follow the format:

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

export const SEMANTIC_FORMAT = `1. Follow the format:

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

export const ANGULAR_FORMAT = `1. Follow Angular's commit format:
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

export const KERNEL_FORMAT = `1. Follow Linux kernel format:
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

export const ISSUE_FORMAT = `1. Follow the issue reference format:
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

// Function to get the template for a given commit format
export function getFormatTemplate(format: CommitFormat): string {
    switch (format) {
        case CommitFormat.KERNEL:
            return KERNEL_FORMAT;
        case CommitFormat.SEMANTIC:
            return SEMANTIC_FORMAT;
        case CommitFormat.ANGULAR:
            return ANGULAR_FORMAT;
        case CommitFormat.ISSUE_REFERENCE:
            return ISSUE_FORMAT;
        default:
            return CONVENTIONAL_FORMAT;
    }
}

// Function to display the format name
export function getFormatDisplayName(format: CommitFormat, author?: string): string {
    const formatName = format.charAt(0).toUpperCase() + format.slice(1);
    return `Format: ${formatName}` + (author ? ` (customized for ${author})` : "");
}


export async function storeCommitStyle(style: string, author?: string): Promise<void> {
    const configDir = await getConfigDir();
    const stylePath = author 
        ? join(configDir, `style-${author}`)
        : join(configDir, "default-style");
    await Deno.writeTextFile(stylePath, style);
}

export async function getStoredCommitStyle(author?: string): Promise<string | null> {
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