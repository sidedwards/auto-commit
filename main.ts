import { serve } from "https://deno.land/std/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk"; // Updated import to use npm prefix

// Function to call the Anthropic API
async function getCommitMessages(diff: string, apiKey: string): Promise<string[]> {
    const anthropic = new Anthropic({
        apiKey: apiKey, // Use the provided API key
    });

    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        temperature: 0,
        messages: [
            { role: "user", content: `Create three detailed commit message options for the following diff:\n"""${diff}"""` }
        ],
    });

    return msg; // Adjust based on the actual response structure to return an array of options
}

// CLI tool to read git diff and generate commit message
async function main() {
    const apiKey = prompt("Please enter your Anthropic API key: "); // Using native prompt
    if (!apiKey) {
        console.error("API key is required");
        return;
    }

    const process = Deno.run({
        cmd: ["git", "diff"],
        stdout: "piped",
    });

    const output = await process.output();
    const diff = new TextDecoder().decode(output);

    const commitMessages = await getCommitMessages(diff, apiKey); // Pass the API key to the function

    // Display commit message options
    console.log("Here are three commit message options:");
    commitMessages.forEach((message, index) => {
        console.log(`${index + 1}: ${message}`);
    });

    const choice = prompt("Please enter the number of the commit message you want to use (or 'r' to reject all): ");
    
    if (!choice) {
        console.log("No selection made.");
        return;
    }

    if (choice === 'r') {
        console.log("You have rejected all commit messages.");
    } else {
        const selectedIndex = parseInt(choice) - 1;
        if (selectedIndex >= 0 && selectedIndex < commitMessages.length) {
            console.log(`You selected: ${commitMessages[selectedIndex]}`);
        } else {
            console.log("Invalid selection.");
        }
    }
}

// Start the CLI tool
main();
