import { COLORS, extractKeywordsFromDiff } from "../utils.ts";

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

export async function searchAndSelectIssue(): Promise<{ number: number, title: string } | null> {
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
    console.log('┌──────┬────��───┬──────────────────────────────────────────────────────────┐');
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

export async function getRelatedIssues(diff: string): Promise<Array<{number: number, title: string}>> {
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