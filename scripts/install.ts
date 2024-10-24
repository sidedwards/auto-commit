#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { join } from "https://deno.land/std/path/mod.ts";

async function install() {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
        throw new Error("Could not find home directory");
    }

    // Create bin directory if it doesn't exist
    const binDir = join(homeDir, ".local", "bin");
    try {
        await Deno.mkdir(binDir, { recursive: true });
    } catch (error) {
        if (!(error instanceof Deno.errors.AlreadyExists)) {
            throw error;
        }
    }

    // Compile the script
    const scriptPath = join(binDir, "auto-commit");
    await Deno.run({
        cmd: [
            "deno",
            "compile",
            "--allow-net",
            "--allow-read",
            "--allow-write",
            "--allow-env",
            "--allow-run=git,vim",
            "--output",
            scriptPath,
            "main.ts"
        ],
        stdout: "inherit",
        stderr: "inherit",
    }).status();

    console.log(`\n✓ Installed auto-commit to ${scriptPath}`);
    console.log('\nMake sure ~/.local/bin is in your PATH. Add this to your ~/.bashrc or ~/.zshrc:');
    console.log('\nexport PATH="$HOME/.local/bin:$PATH"\n');
}

install().catch(console.error);
