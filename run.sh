#!/bin/bash

deno run --allow-net --allow-read --allow-write --allow-env --allow-run=git,vim,gh src/main.ts "$@" 