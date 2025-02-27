import { COLORS, extractKeywordsFromDiff, extractKeywordsUsingLLM } from "../utils.ts";

// Define issue interface for consistent typing
interface Issue {
    number: number;
    title: string;
    state?: string;
    url?: string;
    body?: string;
    labels?: Array<{name: string}>;
}

// Add score property to issues for ranking
interface ScoredIssue extends Issue {
    score: number;
}

export async function getRepoInfo(): Promise<string | null> {
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

export async function isGitHubRepo(): Promise<boolean> {
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

export async function searchAndSelectIssue(diff: string, apiKey?: string, provider?: any): Promise<Issue | null> {
    // Check if this is a GitHub repo
    const isGitHub = await isGitHubRepo();
    if (!isGitHub) {
        console.log(COLORS.dim("Not a GitHub repository. Issue selection is only available for GitHub repositories."));
        return null;
    }

    const repo = await getRepoInfo();
    if (!repo) {
        console.error("Could not determine the repository information.");
        return null;
    }

    // First, automatically find related issues from the diff
    console.log(COLORS.bold("\nSearching for related issues..."));
    const relatedIssues = await getRelatedIssues(diff, apiKey, provider);
    
    // Initialize issues array to track all available issues
    let allIssues: Issue[] = [...relatedIssues];
    let selectedIssue: Issue | null = null;
    
    // If no direct references found, try keyword search automatically
    if (relatedIssues.length === 0) {
        console.log(COLORS.dim("No direct issue references found. Searching using keywords..."));
        const keywords = extractKeywordsFromDiff(diff);
        
        if (keywords.length > 0) {
            try {
                // Create a broader search query with fewer keywords to cast a wider net
                const searchQuery = keywords.slice(0, 3).join(" ");
                console.log(COLORS.dim(`Searching for issues...`));
                
                const searchCommand = new Deno.Command("gh", {
                    args: ["issue", "list", 
                          "--json", "number,title,state,url,body,labels",
                          "--limit", "15", // Increased limit to capture more potential matches
                          "-R", repo,
                          "--search", searchQuery],
                    stdout: "piped",
                    stderr: "piped",
                });

                const searchOutput = await searchCommand.output();
                if (searchOutput.success) {
                    const fetchedIssues = JSON.parse(new TextDecoder().decode(searchOutput.stdout)) as Issue[];
                    if (fetchedIssues.length > 0) {
                        // Apply fuzzy matching with the diff content
                        const scoredIssues = fuzzyMatchIssues(fetchedIssues, diff, keywords);
                        if (scoredIssues.length > 0) {
                            console.log(`\n${COLORS.header("Found issues matching your changes (ranked by relevance):")}`);
                            displayIssuesTable(scoredIssues);
                            allIssues = [...allIssues, ...scoredIssues];
                        } else {
                            console.log(COLORS.dim("No issues found matching your changes."));
                        }
                    } else {
                        console.log(COLORS.dim("No issues found matching your changes."));
                    }
                }
            } catch (error) {
                console.log(COLORS.dim(`Automatic keyword search failed: ${error.message}`));
            }
        }
    } else {
        // Display related issues if found
        console.log(`\n${COLORS.header("Found related issues:")}`);
        displayIssuesTable(relatedIssues);
    }
    
    // Prompt for user selection with enhanced options
    if (allIssues.length > 0) {
        const choice = prompt("Select an issue by number, enter issue ID (#123), or press Enter to skip: ");
        
        if (choice) {
            // Check if the input is a number selecting from the displayed list
            const selectedIndex = parseInt(choice, 10) - 1;
            if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < allIssues.length) {
                selectedIssue = allIssues[selectedIndex];
            } 
            // Check if input is a direct issue ID reference
            else if (choice.startsWith('#')) {
                const issueNumber = parseInt(choice.substring(1), 10);
                if (!isNaN(issueNumber) && issueNumber > 0) {
                    try {
                        const issueCommand = new Deno.Command("gh", {
                            args: ["issue", "view", 
                                  `${issueNumber}`,
                                  "--json", "number,title,state,url",
                                  "-R", repo],
                            stdout: "piped",
                            stderr: "piped",
                        });
                        
                        const issueOutput = await issueCommand.output();
                        if (issueOutput.success) {
                            selectedIssue = JSON.parse(new TextDecoder().decode(issueOutput.stdout)) as Issue;
                        } else {
                            console.log(COLORS.error(`Issue #${issueNumber} not found`));
                        }
                    } catch (error) {
                        console.log(COLORS.error(`Error fetching issue #${issueNumber}: ${error.message}`));
                    }
                } else {
                    console.log(COLORS.error(`Invalid issue number: ${choice}`));
                }
            }
            // Check if input is just a number (without # prefix)
            else if (/^\d+$/.test(choice)) {
                const issueNumber = parseInt(choice, 10);
                try {
                    const issueCommand = new Deno.Command("gh", {
                        args: ["issue", "view", 
                              `${issueNumber}`,
                              "--json", "number,title,state,url",
                              "-R", repo],
                        stdout: "piped",
                        stderr: "piped",
                    });
                    
                    const issueOutput = await issueCommand.output();
                    if (issueOutput.success) {
                        selectedIssue = JSON.parse(new TextDecoder().decode(issueOutput.stdout)) as Issue;
                    } else {
                        console.log(COLORS.error(`Issue #${issueNumber} not found`));
                    }
                } catch (error) {
                    console.log(COLORS.error(`Error fetching issue #${issueNumber}: ${error.message}`));
                }
            }
        }
    } else {
        // If no issues found, allow direct issue ID entry
        const manualIssue = prompt("No issues found. Enter issue ID (#123) or press Enter to skip: ");
        if (manualIssue && (manualIssue.startsWith('#') || /^\d+$/.test(manualIssue))) {
            const issueNumber = manualIssue.startsWith('#') ? 
                parseInt(manualIssue.substring(1), 10) : 
                parseInt(manualIssue, 10);
                
            if (!isNaN(issueNumber) && issueNumber > 0) {
                try {
                    const issueCommand = new Deno.Command("gh", {
                        args: ["issue", "view", 
                              `${issueNumber}`,
                              "--json", "number,title,state,url",
                              "-R", repo],
                        stdout: "piped",
                        stderr: "piped",
                    });
                    
                    const issueOutput = await issueCommand.output();
                    if (issueOutput.success) {
                        selectedIssue = JSON.parse(new TextDecoder().decode(issueOutput.stdout)) as Issue;
                    } else {
                        console.log(COLORS.error(`Issue #${issueNumber} not found`));
                    }
                } catch (error) {
                    console.log(COLORS.error(`Error fetching issue #${issueNumber}: ${error.message}`));
                }
            }
        }
    }
    
    // If an issue was selected, confirm and return
    if (selectedIssue) {
        console.log(`\n${COLORS.success("Selected issue:")} #${selectedIssue.number} - ${selectedIssue.title}`);
        return selectedIssue;
    }
    
    return null;
}

/**
 * Fuzzy matches issues with the diff content and keywords
 * Scores and ranks issues by relevance
 */
function fuzzyMatchIssues(issues: Issue[], diff: string, keywords: string[]): Issue[] {
    const diffWords = diff.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
        
    const importantTerms = extractImportantTerms(diff);
    
    const scoredIssues: ScoredIssue[] = issues.map(issue => {
        let score = 0;
        const issueTitle = issue.title.toLowerCase();
        const issueBody = issue.body?.toLowerCase() || '';
        const labelNames = issue.labels?.map(l => l.name.toLowerCase()) || [];
        
        // Score issue title matches (highest weight)
        for (const term of importantTerms) {
            if (issueTitle.includes(term)) {
                // Higher score for terms in title
                score += 10;
            }
        }
        
        // Score label matches (high weight)
        for (const label of labelNames) {
            for (const term of importantTerms) {
                if (label.includes(term)) {
                    score += 8;
                }
            }
        }
        
        // Score body matches (medium weight)
        for (const term of importantTerms) {
            if (issueBody.includes(term)) {
                score += 5;
            }
        }
        
        // Additional scoring for broader context
        // Check for technical terms like "api", "provider", "model", etc.
        const technicalTerms = ["api", "provider", "model", "llm", "language model", 
                              "anthropic", "openai", "ollama", "claude", "gpt", 
                              "config", "integration", "token", "completion"];
                              
        for (const term of technicalTerms) {
            if (issueTitle.includes(term) && diffWords.includes(term)) {
                score += 3;
            }
            if (issueBody.includes(term) && diffWords.includes(term)) {
                score += 1;
            }
        }
        
        return { ...issue, score };
    });
    
    // Sort by score descending
    const result = scoredIssues
        .filter(issue => issue.score > 0)  // Only include issues with some relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);  // Show top 5 results
        
    // Convert back to regular issues
    return result;
}

/**
 * Extracts important technical terms from the diff
 */
function extractImportantTerms(diff: string): string[] {
    // Extract code-specific terminology that might relate to issues
    const extractedTerms = new Set<string>();
    
    // Look for specific technical patterns in the diff
    const codePatterns = [
        // Function and class names
        /\b(class|function|const|let|var)\s+([A-Za-z0-9_]+)/g,
        // Library imports and requires
        /\b(import|require)\s+.*?['"]([^'"]+)['"]/g,
        // API and integration related terms
        /\b(api|provider|model|llm|anthropic|openai|ollama|claude|gpt)\b/gi,
        // Configuration related
        /\b(config|configuration|setting|parameter|option)\b/gi,
        // Common programming concepts
        /\b(interface|type|enum|client|service|util|helper)\b/gi
    ];
    
    for (const pattern of codePatterns) {
        const matches = Array.from(diff.matchAll(pattern));
        for (const match of matches) {
            if (match[2] && match[2].length > 3) { // Capture group with the actual name
                extractedTerms.add(match[2].toLowerCase());
            } else if (match[0] && match[0].length > 3) { // Whole match as fallback
                extractedTerms.add(match[0].toLowerCase());
            }
        }
    }
    
    // Add specific keywords related to LLM functionality from the diff
    const llmKeywords = [
        "llm", "provider", "model", "api", "key", "token", "anthropic", 
        "claude", "openai", "gpt", "ollama", "langchain", "completion",
        "tokens", "language", "prompt", "chat", "message", "response",
        "commit", "format", "style", "generate", "semantic", "multiple"
    ];
    
    // Check if these keywords appear in the diff
    for (const keyword of llmKeywords) {
        if (diff.toLowerCase().includes(keyword)) {
            extractedTerms.add(keyword);
        }
    }
    
    // Split multi-word terms to increase match chance
    const diffLower = diff.toLowerCase();
    const compositeTerms = [
        "language model", "api key", "commit message", "commit format",
        "model selection", "token limit", "chat model", "base url",
        "system prompt", "default model", "multiple providers"
    ];
    
    for (const term of compositeTerms) {
        if (diffLower.includes(term)) {
            extractedTerms.add(term);
            // Also add the individual words
            term.split(" ").forEach(word => {
                if (word.length > 3) {
                    extractedTerms.add(word);
                }
            });
        }
    }
    
    return Array.from(extractedTerms);
}

/**
 * Displays issues in a formatted table
 */
function displayIssuesTable(issues: Issue[]): void {
    try {
        // Helper function to get visible length of string (excluding ANSI color codes)
        function stripAnsiCodes(str: string): string {
            return str.replace(/\x1B\[\d+m/g, '');
        }

        // Helper function for proper padding with ANSI colors
        function padWithColors(str: string, width: number): string {
            const visibleLength = stripAnsiCodes(str).length;
            const paddingNeeded = Math.max(0, width - visibleLength);
            return str + ' '.repeat(paddingNeeded);
        }

        // Helper function to center text in a given width
        function centerText(text: string, width: number): string {
            const visibleLength = stripAnsiCodes(text).length;
            const totalPadding = width - visibleLength;
            const leftPadding = Math.floor(totalPadding / 2);
            const rightPadding = totalPadding - leftPadding;
            return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
        }

        // Check if issues have scores (from fuzzy matching)
        const hasScores = issues.some((issue) => "score" in issue);
        
        // Define fixed column widths for predictable layout
        const selWidth = 6;      // Width for selection number column
        const idWidth = 6;       // Width for issue ID column
        const stateWidth = 8;    // Width for issue state column
        const scoreWidth = 8;    // Width for score column (if present)
        const labelWidth = 10;   // Width for labels column
        
        // Calculate total width needed for fixed columns
        const fixedWidth = hasScores
            ? selWidth + idWidth + stateWidth + scoreWidth + labelWidth + 6 // +6 for borders
            : selWidth + idWidth + stateWidth + labelWidth + 5; // +5 for borders
            
        // Determine terminal width and title width
        const terminalWidth = 90; // Use a safe fixed width that works well in most terminals
        const titleWidth = terminalWidth - fixedWidth;
        
        // Create table components with consistent colors
        const titlePadding = '─'.repeat(titleWidth);
        
        // Apply consistent color to all table borders
        const tableColor = COLORS.info;
        
        // Create table header - align carefully
        const headerLine = tableColor(hasScores
            ? `┌${`─`.repeat(selWidth)}┬${`─`.repeat(idWidth)}┬${`─`.repeat(stateWidth)}┬${`─`.repeat(scoreWidth)}┬${titlePadding}┬${`─`.repeat(labelWidth)}┐`
            : `┌${`─`.repeat(selWidth)}┬${`─`.repeat(idWidth)}┬${`─`.repeat(stateWidth)}┬${titlePadding}┬${`─`.repeat(labelWidth)}┐`);
            
        // Column headers with proper padding and centering
        const selHeader = COLORS.bold("Sel");
        const idHeader = COLORS.bold("ID"); 
        const stateHeader = COLORS.bold("State");
        const scoreHeader = hasScores ? COLORS.bold("Score") : '';
        const titleHeader = COLORS.bold("Title");
        const labelHeader = COLORS.bold("Labels");

        // Center each header text within its column width
        const centeredSelHeader = centerText(selHeader, selWidth);
        const centeredIdHeader = centerText(idHeader, idWidth);
        const centeredStateHeader = centerText(stateHeader, stateWidth);
        const centeredScoreHeader = hasScores ? centerText(scoreHeader, scoreWidth) : '';
        const centeredTitleHeader = centerText(titleHeader, titleWidth);
        const centeredLabelHeader = centerText(labelHeader, labelWidth);

        const columnsLine = tableColor(`│`) + 
            centeredSelHeader + tableColor(`│`) + 
            centeredIdHeader + tableColor(`│`) + 
            centeredStateHeader + tableColor(`│`) + 
            (hasScores ? centeredScoreHeader + tableColor(`│`) : '') + 
            centeredTitleHeader + tableColor(`│`) + 
            centeredLabelHeader + tableColor(`│`);
            
        // Separator line
        const separatorLine = tableColor(hasScores
            ? `├${`─`.repeat(selWidth)}┼${`─`.repeat(idWidth)}┼${`─`.repeat(stateWidth)}┼${`─`.repeat(scoreWidth)}┼${titlePadding}┼${`─`.repeat(labelWidth)}┤`
            : `├${`─`.repeat(selWidth)}┼${`─`.repeat(idWidth)}┼${`─`.repeat(stateWidth)}┼${titlePadding}┼${`─`.repeat(labelWidth)}┤`);
            
        console.log(headerLine);
        console.log(columnsLine);
        console.log(separatorLine);

        issues.forEach((issue, index) => {
            // Selection number with proper padding
            const selNum = COLORS.bold(`  ${index + 1}  `);
            
            // Issue ID with proper padding
            const idText = COLORS.info(`  #${issue.number}  `);
            
            // State text with proper padding
            const stateStr = issue.state
                ? (issue.state.toUpperCase() === 'OPEN' ? 'open' : 
                   issue.state.toUpperCase() === 'CLOSED' ? 'closed' : 
                   issue.state.toLowerCase())
                : '';
                
            // Determine color for state
            const stateColor = issue.state?.toUpperCase() === 'OPEN' 
                ? COLORS.success 
                : issue.state?.toUpperCase() === 'CLOSED' 
                ? COLORS.error 
                : (s: string) => s;
            
            const stateText = stateColor(`  ${stateStr}  `);
            
            // Score handling with proper padding
            let scoreVal = 0;
            if (hasScores && "score" in issue) {
                scoreVal = Math.round(Number(issue.score));
            }
            
            // Score color based on value
            const scoreColor = scoreVal >= 70 
                ? COLORS.success 
                : scoreVal >= 40 
                ? COLORS.warning 
                : COLORS.dim;
            
            const scoreText = hasScores ? scoreColor(`  ${String(scoreVal)}  `) : '';
            
            // Label formatting with proper padding
            const labelText = `  ${getFormattedLabels(issue.labels || [])}  `;
            
            // Truncate title if needed
            const titleText = `  ${truncateWithEllipsis(issue.title, titleWidth - 4)}  `;
            
            // Format row with consistent colors and spacing
            if (hasScores) {
                console.log(
                    tableColor(`│`) + 
                    padWithColors(selNum, selWidth) + tableColor(`│`) + 
                    padWithColors(idText, idWidth) + tableColor(`│`) + 
                    padWithColors(stateText, stateWidth) + tableColor(`│`) + 
                    padWithColors(scoreText, scoreWidth) + tableColor(`│`) + 
                    padWithColors(titleText, titleWidth) + tableColor(`│`) + 
                    padWithColors(labelText, labelWidth) + tableColor(`│`)
                );
            } else {
                console.log(
                    tableColor(`│`) + 
                    padWithColors(selNum, selWidth) + tableColor(`│`) + 
                    padWithColors(idText, idWidth) + tableColor(`│`) + 
                    padWithColors(stateText, stateWidth) + tableColor(`│`) + 
                    padWithColors(titleText, titleWidth) + tableColor(`│`) + 
                    padWithColors(labelText, labelWidth) + tableColor(`│`)
                );
            }
        });
        
        // Footer line with consistent color
        const footerLine = tableColor(hasScores
            ? `└${`─`.repeat(selWidth)}┴${`─`.repeat(idWidth)}┴${`─`.repeat(stateWidth)}┴${`─`.repeat(scoreWidth)}┴${titlePadding}┴${`─`.repeat(labelWidth)}┘`
            : `└${`─`.repeat(selWidth)}┴${`─`.repeat(idWidth)}┴${`─`.repeat(stateWidth)}┴${titlePadding}┴${`─`.repeat(labelWidth)}┘`);
            
        console.log(footerLine);
        
        // Score legend for scored issues
        if (hasScores) {
            console.log(COLORS.dim("Score indicates relevance to current changes: ") + 
                COLORS.success("70+") + COLORS.dim(" (high), ") + 
                COLORS.warning("40-69") + COLORS.dim(" (medium), ") + 
                COLORS.dim("< 40 (low)"));
        }
        
        console.log("");
    } catch (error) {
        // Fallback to simple display if there's an error with formatting
        console.log("\nAvailable issues:");
        issues.forEach((issue, index) => {
            const scoreStr = "score" in issue ? ` (relevance: ${Math.round(Number(issue.score))})` : '';
            console.log(`  ${index + 1}. #${issue.number} - ${issue.title}${scoreStr}`);
        });
        console.log("");
    }
}

/**
 * Formats issue labels for display
 */
function getFormattedLabels(labels: Array<{name: string}>): string {
    if (!labels || labels.length === 0) {
        return '';
    }
    
    // Format first two labels only (to save space)
    const maxLabels = 2;
    const visibleLabels = labels.slice(0, maxLabels);
    
    const formatted = visibleLabels.map(label => {
        // Format the label name - truncate if needed
        const shortName = label.name.length > 6 ? label.name.substring(0, 6) : label.name;
        
        // Apply different colors based on common label names
        if (label.name.toLowerCase().includes('bug')) {
            return COLORS.error(shortName);
        } else if (label.name.toLowerCase().includes('feature')) {
            return COLORS.success(shortName);
        } else if (label.name.toLowerCase().includes('enhancement')) {
            return COLORS.info(shortName);
        } else if (label.name.toLowerCase().includes('documentation')) {
            return COLORS.warning(shortName);
        } else {
            return COLORS.dim(shortName);
        }
    });
    
    // Add +X more if there are additional labels
    if (labels.length > maxLabels) {
        return formatted.join(' ') + COLORS.dim(`+${labels.length - maxLabels}`);
    }
    
    return formatted.join(' ');
}

/**
 * Truncates text with ellipsis if needed
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    
    // Show beginning and end of title for context
    const ellipsis = COLORS.dim('…');
    const frontChars = Math.floor(maxLength * 0.6);
    const endChars = maxLength - frontChars - 1;
    
    return text.substring(0, frontChars) + ellipsis + text.substring(text.length - endChars);
}

export async function getRelatedIssues(diff: string, apiKey?: string, provider?: any): Promise<Issue[]> {
    try {
        // Check if this is a GitHub repo and if GitHub CLI is available
        try {
            const testCommand = new Deno.Command("gh", {
                args: ["--version"],
                stdout: "piped",
                stderr: "piped",
            });
            const testResult = await testCommand.output();
            if (!testResult.success) {
                throw new Error("GitHub CLI not available");
            }

            const isGitHub = await isGitHubRepo();
            if (!isGitHub) {
                throw new Error("Not a GitHub repository");
            }
        } catch (e) {
            // If GitHub CLI is not available or not a GitHub repo, just return empty
            console.log(COLORS.dim(`Note: ${e.message}. Issue search is only available for GitHub repositories.`));
            return [];
        }

        // Extract potential issue numbers from diff
        const issueRefs = diff.match(/#\d+/g) || [];
        const uniqueIssues = [...new Set(issueRefs.map(ref => ref.slice(1)))];
        
        // Get repo info
        const repo = await getRepoInfo();
        if (!repo) {
            console.log(COLORS.dim("Could not determine the repository information."));
            return [];
        }

        let issues: Issue[] = [];

        if (uniqueIssues.length > 0) {
            // Verify existence of issues using GitHub CLI with proper search syntax
            // Use the search flag with proper formatting instead of passing issue numbers as separate arguments
            try {
                const searchQuery = uniqueIssues.map(issue => `#${issue}`).join(" ");
                const command = new Deno.Command("gh", {
                    args: ["issue", "list", 
                          "--json", "number,title,state,url,body,labels",
                          "--limit", "100",
                          "-R", repo, // Use the actual repo owner/name
                          "--search", searchQuery],
                    stdout: "piped",
                    stderr: "piped",
                });

                const output = await command.output();
                if (!output.success) {
                    throw new Error(`Failed to fetch issues: ${new TextDecoder().decode(output.stderr)}`);
                }

                issues = JSON.parse(new TextDecoder().decode(output.stdout));
            } catch (error) {
                console.log(COLORS.dim(`Issue number search failed: ${error.message}`));
                // Continue to keyword search
            }
        }

        // If no direct issue references, get all issues for fuzzy matching
        if (issues.length === 0) {
            try {
                // Get all open issues first for initial fuzzy matching
                const listCommand = new Deno.Command("gh", {
                    args: ["issue", "list", 
                          "--json", "number,title,state,url,body,labels",
                          "--limit", "30", // Get a reasonable number of issues
                          "-R", repo,
                          "--state", "open"], // Start with open issues
                    stdout: "piped",
                    stderr: "piped",
                });

                const listOutput = await listCommand.output();
                if (!listOutput.success) {
                    throw new Error(`Failed to fetch issues: ${new TextDecoder().decode(listOutput.stderr)}`);
                }

                const openIssues = JSON.parse(new TextDecoder().decode(listOutput.stdout)) as Issue[];
                
                // Use LLM-powered keyword extraction if API key is provided
                let keywords: string[] = [];
                if (apiKey && provider) {
                    console.log(COLORS.dim("Extracting semantically relevant keywords..."));
                    keywords = await extractKeywordsUsingLLM(diff, apiKey, provider);
                } else {
                    // Fallback to basic keyword extraction
                    keywords = extractKeywordsFromDiff(diff);
                }
                
                // Perform fuzzy matching against the issues
                if (openIssues.length > 0) {
                    const importantTerms = extractImportantTerms(diff);
                    const scoredIssues = fuzzyMatchIssues(openIssues, diff, keywords);
                    issues = scoredIssues;
                    
                    // If still no matches, try a keyword search as a fallback
                    if (issues.length === 0 && keywords.length > 0) {
                        const searchQuery = keywords.slice(0, 3).join(" ");
                        const searchCommand = new Deno.Command("gh", {
                            args: ["issue", "list", 
                                "--json", "number,title,state,url,body,labels",
                                "--limit", "5",
                                "-R", repo,
                                "--search", searchQuery],
                            stdout: "piped",
                            stderr: "piped",
                        });

                        const searchOutput = await searchCommand.output();
                        if (searchOutput.success) {
                            issues = JSON.parse(new TextDecoder().decode(searchOutput.stdout)) as Issue[];
                        }
                    }
                }
            } catch (error) {
                console.log(COLORS.dim(`Issue retrieval failed: ${error.message}`));
            }
        }

        return issues;
    } catch (error) {
        console.log(COLORS.dim(`Error finding related issues: ${error.message}`));
        return [];
    }
}