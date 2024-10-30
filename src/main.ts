#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run="git,vim,gh"

import { join } from "https://deno.land/std/path/mod.ts";
import { parseFlags, displayHelp } from "./cli/cli.ts";
import { getConfigDir, getStoredApiKey, storeApiKey, storeDefaultFormat, getDefaultFormat } from "./config/config.ts";
import { getDiff, getCommitHistory, getStagedFiles, commitChanges, listAuthors } from "./git/gitOps.ts";
import { COLORS, createBox, createFileTree, displayCommitMessage, editInEditor } from "./utils.ts";
import {
    CommitFormat,
    getFormatTemplate,
    getFormatDisplayName,
    KERNEL_FORMAT,
    SEMANTIC_FORMAT,
    ANGULAR_FORMAT,
    ISSUE_FORMAT,
    CONVENTIONAL_FORMAT
} from "./formats/commitFormat.ts";
import { getCommitMessage } from "./ai/getCommitMessage.ts";
import { analyzeCommitStyle } from "./ai/commitStyleAnalyzer.ts";
import { storeCommitStyle, getStoredCommitStyle } from "./formats/commitFormat.ts";
import { searchAndSelectIssue } from "./gh/ghOps.ts";

// Update main function to use stored styles
async function main(): Promise<void> {
    const flags = parseFlags(Deno.args);

    // Handle --help flag
    if (flags.help) {
        displayHelp();
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

    // Update format selection logic
    let selectedFormat = flags.format 
        ? (Object.values(CommitFormat).find(f => f.startsWith(flags.format?.toLowerCase() || '')) || CommitFormat.CONVENTIONAL)
        : (await getDefaultFormat() || CommitFormat.CONVENTIONAL);

    // Handle format selection
    if (flags.learn) {
        try {
            const systemPrompt = `You are an expert in git commit message styling and formatting.`;
            const commits = await getCommitHistory(flags.author);
            const styleGuide = await analyzeCommitStyle(systemPrompt, commits, apiKey);
            
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
            const systemPrompt = getFormatTemplate(selectedFormat);

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

// Run main only when directly executed
if (import.meta.main) {
    main();
}
