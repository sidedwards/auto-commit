/// <reference lib="deno.ns" />

export async function getDiff(): Promise<string> {
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

export async function getCommitHistory(author?: string, limit = 50): Promise<string[]> {
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

    const history = new TextDecoder().decode(output.stdout);
    // Split the history by commit separator and filter out empty entries
    return history.split('---').filter(commit => commit.trim() !== '');
}

export async function getStagedFiles(): Promise<string[]> {
    const command = new Deno.Command("git", {
        args: ["diff", "--name-only", "--staged"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await command.output();
    if (!output.success) {
        const errorMessage = new TextDecoder().decode(output.stderr);
        throw new Error(`Failed to get staged files: ${errorMessage}`);
    }

    return new TextDecoder().decode(output.stdout).split("\n").filter(file => file.trim() !== "");
}

export async function commitChanges(message: string): Promise<void> {
    const command = new Deno.Command("git", {
        args: ["commit", "-m", message],
        stdout: "inherit",
        stderr: "inherit",
    });

    const output = await command.output();
    if (!output.success) {
        throw new Error("Failed to commit changes");
    }
}

export async function getGitAuthor(): Promise<{ name: string, email: string }> {
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

export async function listAuthors(): Promise<void> {
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

export async function checkStagedChanges(): Promise<string> {
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