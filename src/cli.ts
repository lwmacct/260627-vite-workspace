#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeTypeScriptWorkspaceConfig } from "./index";

interface CliOptions {
  configFile?: string;
  outFile?: string;
  tsconfig?: string;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = parseOptions(args);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "tsconfig") {
    const outFile = await writeTypeScriptWorkspaceConfig(options);
    console.log(outFile);
    return;
  }

  if (command === "typecheck") {
    const outFile = await writeTypeScriptWorkspaceConfig(options);
    const tsc = path.resolve(process.cwd(), "node_modules/.bin/tsc");
    const result = spawnSync(tsc, ["-p", outFile], {
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  }

  throw new Error(`未知命令: ${command}`);
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--config" && next) {
      options.configFile = next;
      index += 1;
    } else if (arg === "--out" && next) {
      options.outFile = next;
      index += 1;
    } else if (arg === "--tsconfig" && next) {
      options.tsconfig = next;
      index += 1;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`vite-workspace

Usage:
  vite-workspace tsconfig [--config vite.local.ts] [--tsconfig tsconfig.app.json] [--out node_modules/.tmp/tsconfig.workspace.json]
  vite-workspace typecheck [--config vite.local.ts] [--tsconfig tsconfig.app.json] [--out node_modules/.tmp/tsconfig.workspace.json]
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
