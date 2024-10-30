import { AnthropicClient } from "./anthropicClient.ts";
import { startLoading, stopLoading } from "../utils.ts";
import { CommitFormat } from "../formats/commitFormat.ts";
import { getGitAuthor } from "../git/gitOps.ts";
// import { getRelatedIssues } from "../gh/ghOps.ts";

export async function getCommitMessage(
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
        // const relatedIssues = await getRelatedIssues(diff);
        
        // Add issue context to system prompt if available
        if (selectedIssue) {
            systemPrompt += `\n\nReferenced issue: #${selectedIssue.number}: ${selectedIssue.title}
Include the issue ID as a reference according to the commit message format.`;
        } else {
            systemPrompt += `\n\nNo issue referenced`;
        }
        
        // if (relatedIssues.length > 0) {
        //     systemPrompt += `\n\nRelated issues:\n${
        //         relatedIssues.map(issue => `#${issue.number}: ${issue.title}`).join('\n')
        //     }`;
        // }
        
        const client = new AnthropicClient(apiKey);

        const content = await client.createMessage(
            `Generate a commit message summarizing ALL key changes from the ENTIRE diff:\n\n${diff}\n\nIMPORTANT: 
1. Do not include any explanatory text or formatting
2. Do not make up features, changes, or issue numbers not present in the diff
3. Do not repeat the header line
4. IMPORTANT: NEVER include the diff in the response
5. Do not include "diff --git" or any git output
6. Follow this exact structure:
   - One header line
   - One blank line
   - Bullet points for actual changes
   - Breaking changes (if any)`);

        // Post-process the message to ensure proper formatting
        const lines = content.split('\n').filter(line => line.trim() !== '');
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