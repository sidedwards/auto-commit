import * as colors from "https://deno.land/std@0.220.1/fmt/colors.ts";

export const COLORS = {
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    info: colors.blue,
    dim: colors.dim,
    bold: colors.bold,
    header: (s: string) => colors.bold(colors.cyan(s)),
    action: (s: string) => colors.bold(colors.yellow(s)),
};

/**
 * Extracts keywords from a given diff, excluding common words.
 * 
 * @param diff - The diff text to extract keywords from.
 * @returns An array of unique keywords.
 */
export function extractKeywordsFromDiff(diff: string): string[] {
    try {
        // Remove git diff syntax and focus on added content
        const addedLines = diff
            .split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1).trim())
            .join(' ');
            
        // Extract meaningful words and technical terms
        const rawWords = addedLines
            .replace(/[^\w\s.-]/g, ' ') // Replace special chars with spaces
            .split(/\s+/) // Split by whitespace
            .filter(word => 
                word.length > 3 && // Filter out short words
                !/^\d+$/.test(word) && // Filter out numbers
                !word.startsWith('--') && // Filter out CLI flags
                !/^(diff|index|@@|commit|author|date|message)$/i.test(word) // Filter out git terms
            );
            
        // Extract potential technical terms based on common coding patterns
        const technicalTerms = new Set<string>();
        
        // Look for CamelCase terms
        const camelCaseTerms = rawWords.filter(word => /[a-z][A-Z]/.test(word));
        camelCaseTerms.forEach(term => technicalTerms.add(term.toLowerCase()));
        
        // Look for terms with underscores or hyphens
        const separatedTerms = rawWords.filter(word => word.includes('_') || word.includes('-'));
        separatedTerms.forEach(term => technicalTerms.add(term.toLowerCase()));
        
        // Look for potential API/programming terms
        const apiTerms = ['api', 'auth', 'token', 'config', 'provider', 'client', 'server', 
                         'model', 'data', 'service', 'handler', 'controller', 'component',
                         'interface', 'class', 'function', 'method', 'property', 'parameter'];
                         
        rawWords.forEach(word => {
            const lowerWord = word.toLowerCase();
            if (apiTerms.some(term => lowerWord.includes(term))) {
                technicalTerms.add(lowerWord);
            }
        });
        
        // Add common LLM-related terms if they're in the diff
        const llmTerms = ['llm', 'langchain', 'anthropic', 'claude', 'openai', 'gpt', 
                         'ollama', 'mistral', 'token', 'model', 'provider', 'prompt'];
                         
        const diffLower = diff.toLowerCase();
        llmTerms.forEach(term => {
            if (diffLower.includes(term)) {
                technicalTerms.add(term);
            }
        });
        
        // Convert to array, add some raw words, and limit
        const keywords = [
            ...Array.from(technicalTerms),
            ...rawWords
                .map(word => word.toLowerCase())
                .filter(word => word.length > 3)
        ];
        
        // Remove duplicates and limit to 20 keywords
        return [...new Set(keywords)].slice(0, 20);
        
    } catch (error) {
        console.error("Error extracting keywords from diff:", error);
        return [];
    }
}

/**
 * Extracts semantic keywords from a diff using an LLM.
 * This provides more contextually relevant keywords than the simple text-based approach.
 * 
 * @param diff - The diff text to analyze
 * @param apiKey - API key for the LLM provider
 * @param provider - The LLM provider to use
 * @returns A promise resolving to an array of relevant keywords
 */
export async function extractKeywordsUsingLLM(
    diff: string, 
    apiKey: string, 
    provider: any // Using 'any' to avoid circular dependencies; this would be LLMProvider
): Promise<string[]> {
    try {
        // Import dynamically to avoid circular dependencies
        const { LangChainClient } = await import("./ai/langChainClient.ts");
        
        // Truncate the diff if it's too large
        const truncatedDiff = diff.length > 15000 ? 
            diff.substring(0, 5000) + '\n\n[...truncated...]\n\n' + diff.substring(diff.length - 5000) : 
            diff;
        
        // Create a client to make the request
        const client = new LangChainClient(provider, apiKey, {
            maxTokens: 100, // Keep response short for just keywords
            temperature: 0 // Keep deterministic
        });
        
        const systemPrompt = `You are an expert at analyzing code and extracting relevant technical keywords.
Given a git diff, identify the most important technical keywords that would help match this code to relevant GitHub issues.
Focus on:
1. Technical terms (languages, frameworks, libraries)
2. Architectural concepts
3. Feature names and functionality
4. Component names
5. API or service names

ONLY return a comma-separated list of 10-15 keywords, prioritizing specificity and technical relevance.
DO NOT include explanations, bullet points, or any other formatting.`;

        const response = await client.createMessage(systemPrompt, `Extract the most relevant keywords from this diff that would help match it to GitHub issues:

${truncatedDiff}`);
        
        // Clean up response and split it into keywords
        const cleanResponse = response.replace(/^keywords:|\.$|^.*?:|\n/gi, '').trim();
        const keywords = cleanResponse
            .split(/\s*,\s*|\s*;\s*|\s*\n\s*/) // Split by comma, semicolon, or newline
            .map(kw => kw.trim().toLowerCase())
            .filter(kw => kw.length > 0);
        
        // Add some derived keywords to increase matching potential
        const derivedKeywords = [];
        for (const kw of keywords) {
            // Add plurals/singulars
            if (kw.endsWith('s') && kw.length > 4) {
                derivedKeywords.push(kw.slice(0, -1));
            } else if (!kw.endsWith('s') && kw.length > 3) {
                derivedKeywords.push(kw + 's');
            }
            
            // Split combined terms
            if (kw.includes('-')) {
                const parts = kw.split('-');
                derivedKeywords.push(...parts.filter(p => p.length > 3));
            }
            
            // Handle camelCase and PascalCase
            if (/[a-z][A-Z]/.test(kw)) {
                const splitTerms = kw.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
                derivedKeywords.push(...splitTerms.filter(p => p.length > 3));
            }
        }
        
        // Combine original and derived keywords, remove duplicates
        const allKeywords = [...new Set([...keywords, ...derivedKeywords])];
        
        // Filter out common programming terms that aren't useful for issue matching
        const commonTerms = ['function', 'class', 'method', 'variable', 'const', 'let', 'var', 
                           'string', 'number', 'boolean', 'array', 'object', 'interface', 'type',
                           'export', 'import', 'require', 'module', 'package', 'default'];
        
        return allKeywords
            .filter(kw => !commonTerms.includes(kw))
            .slice(0, 20); // Limit to top 20 keywords
            
    } catch (error) {
        console.error("Error extracting keywords with LLM:", error);
        // Fall back to basic extraction
        return extractKeywordsFromDiff(diff);
    }
}

/**
 * Creates a visual representation of a file tree.
 * 
 * @param files - An array of file paths.
 * @returns A string representing the formatted file tree.
 */
export function createFileTree(files: string[]): string {
    if (files.length === 0) {
        return "";
    }

    // Sort files for consistent presentation
    const sortedFiles = [...files].sort();
    
    // Create directory structure
    const fileTree: Record<string, any> = {};
    
    for (const filePath of sortedFiles) {
        const parts = filePath.split('/').filter(Boolean);
        let current = fileTree;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            
            if (isFile) {
                current[part] = null; // Files are leaf nodes
            } else {
                if (!current[part]) {
                    current[part] = {}; // Directories are objects
                }
                current = current[part];
            }
        }
    }
    
    // Generate tree view
    const lines: string[] = [];
    
    function buildTree(node: Record<string, any>, prefix = "", isLast = true) {
        const entries = Object.entries(node);
        
        for (let i = 0; i < entries.length; i++) {
            const [name, value] = entries[i];
            const isLastItem = i === entries.length - 1;
            
            // Choose the appropriate connector
            const connector = isLast ? '   ' : '│  ';
            const branch = isLastItem ? '└──' : '├──';
            
            // Format entry with colors
            const entryPrefix = `${prefix}${branch} `;
            const formattedEntry = value === null 
                ? COLORS.info(name)  // File
                : COLORS.bold(name); // Directory
                
            lines.push(`${entryPrefix}${formattedEntry}`);
            
            // Process subdirectories recursively
            if (value !== null) {
                buildTree(value, `${prefix}${connector}`, isLastItem);
            }
        }
    }
    
    buildTree(fileTree);
    return lines.join('\n');
}

/**
 * Creates a box around the given content with proper formatting.
 * 
 * @param content - The content to be boxed.
 * @returns A string representing the boxed content.
 */
export function createBox(content: string): string {
    // Set a fixed box width that works well in most terminals
    const maxWidth = 80;
    const horizontalLine = '─'.repeat(maxWidth - 2);
    
    // Process content into lines
    const contentLines = content.split('\n');
    const formattedLines: string[] = [];
    
    for (const line of contentLines) {
        if (line.trim() === '') {
            // Preserve empty lines
            formattedLines.push('');
            continue;
        }
        
        // Special handling for bullet points
        if (line.trimStart().startsWith('-') || line.trimStart().startsWith('*')) {
            const indentLevel = line.length - line.trimStart().length;
            const indent = ' '.repeat(indentLevel);
            const bulletChar = line.trimStart()[0];
            const bulletText = line.trimStart().substring(2).trim();
            
            // Format bullet with color
            const formattedBullet = `${indent}${COLORS.dim(bulletChar)} ${bulletText}`;
            
            // Check if we need to wrap the line
            if (formattedBullet.length <= maxWidth - 4) {
                formattedLines.push(formattedBullet);
            } else {
                // Wrap long bullet points
                const words = bulletText.split(' ');
                let currentLine = `${indent}${COLORS.dim(bulletChar)} `;
                const wrapIndent = indent + '  ';
                
                for (const word of words) {
                    if ((currentLine + word).length <= maxWidth - 4) {
                        currentLine += (currentLine === `${indent}${COLORS.dim(bulletChar)} ` ? '' : ' ') + word;
                    } else {
                        formattedLines.push(currentLine);
                        currentLine = wrapIndent + word;
                    }
                }
                
                if (currentLine !== `${indent}${COLORS.dim(bulletChar)} `) {
                    formattedLines.push(currentLine);
                }
            }
        } 
        // Special handling for commit headers (e.g., feat(scope): message)
        else if (formattedLines.length === 0 && /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-_.]+\))?(!)?:/i.test(line)) {
            const match = line.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-_.]+\))?(!)?:/i);
            if (match) {
                const type = match[1];
                const scope = match[2] || '';
                const breaking = match[3] || '';
                const message = line.substring(match[0].length).trim();
                
                // Color the commit type based on its semantic meaning
                let typeColor;
                switch (type.toLowerCase()) {
                    case 'feat': typeColor = COLORS.success; break;
                    case 'fix': typeColor = COLORS.error; break;
                    case 'docs': typeColor = COLORS.info; break;
                    default: typeColor = COLORS.dim; break;
                }
                
                const formattedHeader = `${typeColor(type)}${COLORS.dim(scope)}${breaking ? COLORS.error('!') : ''}:${message ? ' ' + message : ''}`;
                
                if (formattedHeader.length <= maxWidth - 4) {
                    formattedLines.push(formattedHeader);
                } else {
                    formattedLines.push(`${typeColor(type)}${COLORS.dim(scope)}${breaking ? COLORS.error('!') : ''}:`);
                    formattedLines.push(`  ${message}`);
                }
            } else {
                // Simple word wrapping for other lines
                wrapTextIntoLines(line, maxWidth - 4, formattedLines);
            }
        }
        // Highlighting references to issues (e.g., closes #123)
        else if (/^(closes|fixes|resolves|references|related to):/i.test(line)) {
            const parts = line.split(':');
            const prefix = parts[0] + ':';
            const rest = parts.slice(1).join(':').trim();
            
            // Highlight the reference term
            const formattedPrefix = COLORS.bold(prefix);
            
            // Highlight issue numbers
            const formattedRest = rest.replace(/#(\d+)/g, match => COLORS.info(match));
            
            formattedLines.push(`${formattedPrefix} ${formattedRest}`);
        } 
        // Special handling for BREAKING CHANGE
        else if (line.startsWith('BREAKING CHANGE:')) {
            const message = line.substring('BREAKING CHANGE:'.length).trim();
            formattedLines.push(`${COLORS.error('BREAKING CHANGE:')} ${message}`);
        } 
        // For regular lines, just do simple word wrapping
        else {
            wrapTextIntoLines(line, maxWidth - 4, formattedLines);
        }
    }
    
    // Create the box
    let result = `┌${COLORS.info(horizontalLine)}┐\n`;
    
    for (const line of formattedLines) {
        // Calculate visible length (without ANSI color codes)
        const visibleLength = line.replace(/\x1b\[\d+(;\d+)*m/g, '').length;
        const padding = ' '.repeat(Math.max(0, maxWidth - 4 - visibleLength));
        
        result += `${COLORS.info('│')} ${line}${padding} ${COLORS.info('│')}\n`;
    }
    
    result += `└${COLORS.info(horizontalLine)}┘`;
    
    return result;
}

/**
 * Helper function to wrap text into lines that fit within maxWidth
 */
function wrapTextIntoLines(text: string, maxWidth: number, lines: string[]): void {
    if (text.length <= maxWidth) {
        lines.push(text);
        return;
    }
    
    const words = text.split(' ');
    let currentLine = '';
    
    for (const word of words) {
        if ((currentLine + word).length + 1 <= maxWidth) { // +1 for the space
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
}

export function startLoading(message: string): number {
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

export function stopLoading(intervalId: number) {
    clearInterval(intervalId);
    Deno.stdout.writeSync(new TextEncoder().encode('\r\x1B[K')); // Clear line
    Deno.stdout.writeSync(new TextEncoder().encode('\x1B[?25h')); // Show cursor
}

export async function editInEditor(message: string): Promise<string> {
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

export function displayCommitMessage(message: string): void {
    console.log(COLORS.header("\nProposed commit:"));
    console.log(createBox(message));
}