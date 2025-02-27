#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run="git,vim,gh" --import-map=import_map.json

import { join } from "path";
import { parseFlags, displayHelp, displayAvailableModels } from "./cli/cli.ts";
import { 
    getConfigDir, 
    getStoredApiKey, 
    storeApiKey, 
    storeDefaultFormat, 
    getDefaultFormat,
    getStoredLLMProvider,
    storeLLMProvider,
    getModelForProvider,
    storeModelForProvider,
    getProviderConfig,
    storeProviderConfig
} from "./config/config.ts";
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
import { LLMProvider } from "./ai/langChainClient.ts";

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
    
    // Handle --list-models flag
    if (flags["list-models"]) {
        // If provider is specified, only show models for that provider
        const specifiedProvider = flags.provider ? 
            flags.provider.toString().toLowerCase() as LLMProvider : 
            undefined;
            
        if (specifiedProvider && !Object.values(LLMProvider).includes(specifiedProvider)) {
            console.error(`Invalid provider: ${specifiedProvider}. Available providers: ${Object.values(LLMProvider).join(", ")}`);
            return;
        }
        
        displayAvailableModels(specifiedProvider);
        return;
    }

    // Handle --show-defaults flag
    if (flags["show-defaults"]) {
        const defaultProvider = await getStoredLLMProvider() || LLMProvider.ANTHROPIC;
        console.log(`Default provider: ${COLORS.info(defaultProvider)}`);
        
        // Show default models for each provider
        for (const provider of Object.values(LLMProvider)) {
            const defaultModel = await getModelForProvider(provider);
            if (defaultModel) {
                console.log(`Default model for ${COLORS.info(provider)}: ${COLORS.info(defaultModel)}`);
            } else {
                const fallbackModel = provider === LLMProvider.ANTHROPIC ? "claude-3-haiku-20240307" : 
                                    provider === LLMProvider.OPENAI ? "gpt-3.5-turbo" : "llama3";
                console.log(`Default model for ${COLORS.info(provider)}: ${COLORS.dim(fallbackModel)} (system default)`);
            }
        }
        
        // Show Ollama base URL if set
        const ollamaBaseUrl = await getProviderConfig(LLMProvider.OLLAMA, "baseUrl");
        if (ollamaBaseUrl) {
            console.log(`Ollama base URL: ${COLORS.info(ollamaBaseUrl)}`);
        }
        
        return;
    }

    // Handle LLM provider selection
    let provider = flags.provider ? 
        flags.provider.toString().toLowerCase() as LLMProvider : 
        await getStoredLLMProvider() || LLMProvider.ANTHROPIC;

    // Validate provider
    if (!Object.values(LLMProvider).includes(provider)) {
        console.error(`Invalid provider: ${provider}. Available providers: ${Object.values(LLMProvider).join(", ")}`);
        console.log(`Run with --list-models to see available models for each provider.`);
        return;
    }

    // Handle --set-default-provider flag
    if (flags["set-default-provider"] && flags.provider) {
        await storeLLMProvider(provider);
        console.log(`Default provider set to: ${COLORS.info(provider)}`);
        return;
    }

    // Handle --set-default-model flag (process this before API key prompts)
    if (flags["set-default-model"] && flags.model) {
        const specifiedModel = flags.model.toString();
        await storeModelForProvider(provider, specifiedModel);
        console.log(`Default model for ${COLORS.info(provider)} set to: ${COLORS.info(specifiedModel)}`);
        return;
    }

    // Get API key for the selected provider
    let apiKey = await getStoredApiKey(provider);
    
    if (!apiKey && provider !== LLMProvider.OLLAMA) {
        apiKey = prompt(`Please enter your ${provider.toUpperCase()} API key: `);
        if (!apiKey) {
            console.error("API key is required");
            return;
        }
        
        const shouldStore = prompt("Would you like to store this API key for future use? (y/n): ");
        if (shouldStore?.toLowerCase() === 'y') {
            await storeApiKey(apiKey, provider);
            console.log("API key stored successfully!");
        }
    }

    // If provider is set by flags, store it as default (unless --set-default-provider was used)
    if (flags.provider && !flags["set-default-provider"]) {
        await storeLLMProvider(provider);
    }

    // Special handling for Ollama (local LLM)
    if (provider === LLMProvider.OLLAMA) {
        // Check if base URL is set
        let baseUrl = await getProviderConfig(LLMProvider.OLLAMA, "baseUrl");
        if (!baseUrl && !flags["base-url"]) {
            baseUrl = prompt("Please enter Ollama base URL (default: http://localhost:11434): ") || "http://localhost:11434";
            await storeProviderConfig(LLMProvider.OLLAMA, "baseUrl", baseUrl);
        } else if (flags["base-url"]) {
            const specifiedBaseUrl = flags["base-url"].toString();
            await storeProviderConfig(LLMProvider.OLLAMA, "baseUrl", specifiedBaseUrl);
        }
    }

    // Handle model selection for current provider
    if (flags.model) {
        const specifiedModel = flags.model.toString();
        await storeModelForProvider(provider, specifiedModel);
        
        // Display the selected model
        console.log(`Using model: ${COLORS.info(specifiedModel)} with provider: ${COLORS.info(provider)}`);
    } else {
        // Show currently selected model
        const currentModel = await getModelForProvider(provider);
        if (currentModel) {
            console.log(`Using model: ${COLORS.info(currentModel)} with provider: ${COLORS.info(provider)}`);
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
        ? (Object.values(CommitFormat).find(f => f.startsWith(flags.format.toString().toLowerCase())) || CommitFormat.CONVENTIONAL)
        : (await getDefaultFormat() || CommitFormat.CONVENTIONAL);

    // Handle format selection
    if (flags.learn) {
        try {
            const systemPrompt = `You are an expert in git commit message styling and formatting.`;
            const commits = await getCommitHistory(flags.author ? flags.author.toString() : undefined);
            const styleGuide = await analyzeCommitStyle(systemPrompt, commits, apiKey, provider);
            
            if (flags.author) {
                await storeCommitStyle(styleGuide, flags.author.toString());
                await storeCommitStyle(styleGuide);  // Also store as default
                await storeDefaultFormat(CommitFormat.CUSTOM);
                selectedFormat = CommitFormat.CUSTOM;
            } else {
                await storeCommitStyle(styleGuide);
                await storeDefaultFormat(CommitFormat.REPO);
                selectedFormat = CommitFormat.REPO;
            }
            
            console.log("\n" + getFormatDisplayName(selectedFormat, flags.author ? flags.author.toString() : undefined));
        } catch (error) {
            console.error(COLORS.error("Error:") + " Failed to learn commit style:", error);
            console.log(COLORS.dim("Falling back to default commit style..."));
            selectedFormat = CommitFormat.CONVENTIONAL;
        }
    } else if (flags.format) {
        // Explicit format specified - store both format and its template
        const formatInput = flags.format.toString().toLowerCase();
        
        // Found a matching format, store it
        if (Object.values(CommitFormat).some(f => f.startsWith(formatInput))) {
            await storeDefaultFormat(selectedFormat);
        }
    }

    // Get the staged files
    const stagedFiles = await getStagedFiles();
    if (stagedFiles.length === 0) {
        console.error(COLORS.error("Error:") + " No staged changes found. Please stage changes before generating a commit message.");
        return;
    }

    // Show the staged files
    console.log("\n" + COLORS.bold("Staged files:"));
    console.log(createFileTree(stagedFiles));

    // Get the diff
    const diff = await getDiff();

    // Search for related issues if we need issue format or if --issue flag is used
    let selectedIssue = null;
    if (flags.issue || selectedFormat === CommitFormat.ISSUE_REFERENCE) {
        selectedIssue = await searchAndSelectIssue(diff, apiKey, provider);
        
        // If user specified --issue flag explicitly but didn't select an issue, ask if they want to continue
        if (!selectedIssue && flags.issue && selectedFormat !== CommitFormat.ISSUE_REFERENCE) {
            const continueWithoutIssue = prompt("No issue selected. Continue without issue reference? (y/n): ");
            if (continueWithoutIssue?.toLowerCase() !== 'y') {
                console.log(COLORS.dim("Commit aborted"));
                return;
            }
        }
    }

    // Get the system prompt based on the format
    let systemPrompt = `You are an expert in git commit message styling and formatting.
    
I need you to generate a clear, comprehensive commit message for my staged changes.

${getFormatTemplate(selectedFormat)}`;

    // Fetch the user-specific or repo-specific commit style if available
    const customStyle = flags.author 
        ? await getStoredCommitStyle(flags.author.toString()) 
        : await getStoredCommitStyle();
    
    if (customStyle && (selectedFormat === CommitFormat.CUSTOM || selectedFormat === CommitFormat.REPO)) {
        systemPrompt = `You are an expert in git commit message styling and formatting.
        
I need you to generate a clear, comprehensive commit message for my staged changes following this specific style guide:

${customStyle}`;
    }

    // Get the commit message
    try {
        const commitMessage = await getCommitMessage(diff, apiKey, systemPrompt, selectedIssue, selectedFormat, provider);
        
        // Display the commit message
        displayCommitMessage(commitMessage);
        
        const answer = prompt("(a)ccept, (e)dit, (r)eject, (n)ew message? ");
        
        switch (answer?.toLowerCase()) {
            case "a":
                await commitChanges(commitMessage);
                console.log(COLORS.success("Commit successful!"));
                break;
            case "e":
                const editedMessage = await editInEditor(commitMessage);
                if (editedMessage.trim() !== "") {
                    await commitChanges(editedMessage);
                    console.log(COLORS.success("Commit successful!"));
                } else {
                    console.log(COLORS.dim("Commit aborted"));
                }
                break;
            case "n":
                console.log("Generating new message...");
                main();
                break;
            default:
                console.log(COLORS.dim("Commit aborted"));
                break;
        }
    } catch (error) {
        console.error(COLORS.error("Error:") + " Failed to generate commit message:", error);
    }
}

// Run the main function
try {
    main();
} catch (error) {
    console.error(COLORS.error("Error:") + " ", error);
}
