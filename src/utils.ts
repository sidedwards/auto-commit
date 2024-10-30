import * as colors from "https://deno.land/std/fmt/colors.ts";

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
    const commonWords = new Set([
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were', 
        'will', 'would', 'could', 'should', 'have', 'has', 'had', 'not', 'but', 
        'or', 'if', 'then', 'else', 'when', 'while', 'do', 'does', 'did', 'done',
        'in', 'on', 'at', 'by', 'to', 'of', 'a', 'an', 'is', 'it', 'as', 'be', 
        'can', 'may', 'might', 'must', 'shall', 'which', 'who', 'whom', 'whose',
        'what', 'where', 'why', 'how', 'all', 'any', 'some', 'no', 'none', 'one',
        'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'
    ]);

    const words = diff.match(/\b\w+\b/g) || [];
    const keywords = words
        .filter(word => !commonWords.has(word.toLowerCase()))
        .map(word => word.toLowerCase());

    return [...new Set(keywords)];
}

/**
 * Creates a visual representation of a file tree.
 * 
 * @param files - An array of file paths.
 * @returns An array of strings representing the file tree.
 */
export function createFileTree(files: string[]): string[] {
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
    
    if (tree.length > 0) {
        tree[tree.length - 1] = tree[tree.length - 1].replace('├──', '└──');
    }
    
    return tree;
}

/**
 * Creates a box around the given content.
 * 
 * @param content - The content to be boxed.
 * @returns A string representing the boxed content.
 */
export function createBox(content: string): string {
    const maxWidth = 70;
    const contentWidth = maxWidth - 2; // Account for borders
    const horizontal = '─'.repeat(maxWidth);
    
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
    
    const wrappedLines = content.split('\n').flatMap(line => wrapText(line));
    
    let result = `┌${horizontal}┐\n`;
    wrappedLines.forEach(line => {
        result += `│${line.padEnd(maxWidth - 2)}│\n`;
    });
    result += `└${horizontal}┘`;
    
    return result;
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
    console.log(COLORS.dim("─".repeat(80)));
    console.log(message);
    console.log(COLORS.dim("─".repeat(80)));
}