#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run="git,vim,gh,deno"

import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { join } from "https://deno.land/std/path/mod.ts";

interface Target {
    platform: string;
    target: string;
    extension: string;
}

const targets: Target[] = [
    { 
        platform: "darwin-arm64", 
        target: "aarch64-apple-darwin",
        extension: "" 
    },
    { 
        platform: "darwin-x64", 
        target: "x86_64-apple-darwin",
        extension: "" 
    },
    { 
        platform: "windows-x64", 
        target: "x86_64-pc-windows-msvc",
        extension: ".exe" 
    },
    { 
        platform: "linux-x64", 
        target: "x86_64-unknown-linux-gnu",
        extension: "" 
    },
];

async function build() {
    await ensureDir("dist");
    
    for (const target of targets) {
        const filename = `auto-commit-${target.platform}${target.extension}`;
        console.log(`\nBuilding ${filename}...`);
        
        const command = new Deno.Command("deno", {
            args: [
                "compile",
                "--allow-net",
                "--allow-read",
                "--allow-write",
                "--allow-env",
                "--allow-run=git,vim,gh", // Added gh for GitHub CLI
                "--target",
                target.target,
                "--output",
                `dist/${filename}`,
                "main.ts"
            ],
            stdout: "inherit",
            stderr: "inherit",
        });

        const result = await command.output();
        if (!result.success) {
            console.error(`Failed to build for ${target.platform}`);
            Deno.exit(1); // Exit with error if any build fails
        }
    }

    console.log("\n✓ Build complete!");
}

await build();
