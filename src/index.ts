import path from "node:path";
import fs from "node:fs";
import { defineConfig, loadConfigFromFile, mergeConfig, type Alias, type UserConfig, type UserConfigExport } from "vite";

export interface ViteWorkspacePackage {
  dedupe?: string[];
  entries: Record<string, string>;
  name: string;
  root: string;
}

export interface ViteWorkspaceConfigOptions {
  overrides?: UserConfig;
  packages: ViteWorkspacePackage[];
  projectRoot?: string;
}

export interface TypeScriptWorkspaceConfigOptions {
  configFile?: string;
  outFile?: string;
  projectRoot?: string;
  tsconfig?: string;
}

export interface TypeScriptWorkspaceConfig {
  compilerOptions: {
    paths: Record<string, string[]>;
  };
  extends: string;
}

const WORKSPACE_OPTIONS_KEY = "__lwmacctViteWorkspace";
const DEFAULT_LOCAL_TSCONFIG = "node_modules/.tmp/tsconfig.local.json";

export function defineViteWorkspaceConfig(options: ViteWorkspaceConfigOptions): UserConfigExport {
  const workspaceConfig = createViteWorkspaceConfig(options);
  const config = mergeConfig(workspaceConfig, options.overrides ?? {}) as UserConfig & {
    [WORKSPACE_OPTIONS_KEY]?: ViteWorkspaceConfigOptions;
  };
  config[WORKSPACE_OPTIONS_KEY] = options;
  return defineConfig(config);
}

export function createViteWorkspaceConfig(options: ViteWorkspaceConfigOptions): UserConfig {
  const alias: Alias[] = [];
  const allow = new Set<string>();
  const dedupe = new Set<string>();
  const exclude = new Set<string>();

  if (options.projectRoot) {
    allow.add(options.projectRoot);
  }

  for (const pkg of options.packages) {
    allow.add(pkg.root);
    exclude.add(pkg.name);

    for (const dep of pkg.dedupe ?? []) {
      dedupe.add(dep);
    }

    for (const [subpath, target] of Object.entries(pkg.entries)) {
      const specifier = subpath === "." ? pkg.name : `${pkg.name}/${subpath}`;

      alias.push({
        find: new RegExp(`^${escapeRegExp(specifier)}$`),
        replacement: path.resolve(pkg.root, target),
      });
    }
  }

  return {
    resolve: {
      alias,
      dedupe: [...dedupe],
    },
    server: {
      fs: {
        allow: [...allow],
      },
    },
    optimizeDeps: {
      exclude: [...exclude],
    },
  };
}

export async function loadViteWorkspaceOptions(
  configFile: string,
): Promise<ViteWorkspaceConfigOptions> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "development" },
    configFile,
  );
  const config = loaded?.config as
    | (UserConfig & { [WORKSPACE_OPTIONS_KEY]?: ViteWorkspaceConfigOptions })
    | undefined;
  const options = config?.[WORKSPACE_OPTIONS_KEY] as
    | ViteWorkspaceConfigOptions
    | undefined;

  if (!options) {
    throw new Error(
      `未在 ${configFile} 中找到 defineViteWorkspaceConfig(...) 配置`,
    );
  }

  return options;
}

export async function createTypeScriptWorkspaceConfig(
  options: TypeScriptWorkspaceConfigOptions = {},
): Promise<TypeScriptWorkspaceConfig> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const configFile = path.resolve(projectRoot, options.configFile ?? "vite.local.ts");
  const tsconfig = path.resolve(projectRoot, options.tsconfig ?? "tsconfig.app.json");
  const outFile = path.resolve(
    projectRoot,
    options.outFile ?? DEFAULT_LOCAL_TSCONFIG,
  );
  const workspaceOptions = await loadViteWorkspaceOptions(configFile);
  const basePaths = readTypeScriptPaths(tsconfig);

  return {
    extends: toConfigPath(path.relative(path.dirname(outFile), tsconfig)),
    compilerOptions: {
      paths: {
        ...basePaths,
        ...createTypeScriptPaths(workspaceOptions),
      },
    },
  };
}

export async function writeTypeScriptWorkspaceConfig(
  options: TypeScriptWorkspaceConfigOptions = {},
): Promise<string> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const outFile = path.resolve(
    projectRoot,
    options.outFile ?? DEFAULT_LOCAL_TSCONFIG,
  );
  const config = await createTypeScriptWorkspaceConfig({
    ...options,
    outFile,
    projectRoot,
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tempFile = `${outFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(config, null, 2)}\n`);
  fs.renameSync(tempFile, outFile);
  return outFile;
}

export function createTypeScriptPaths(
  options: ViteWorkspaceConfigOptions,
): Record<string, string[]> {
  const paths: Record<string, string[]> = {};

  for (const pkg of options.packages) {
    for (const [subpath, target] of Object.entries(pkg.entries)) {
      const specifier = subpath === "." ? pkg.name : `${pkg.name}/${subpath}`;
      paths[specifier] = [toConfigPath(path.resolve(pkg.root, target))];
    }
  }

  return paths;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTypeScriptPaths(tsconfig: string): Record<string, string[]> {
  const payload = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  const paths = payload.compilerOptions?.paths ?? {};
  const baseUrl = path.resolve(
    path.dirname(tsconfig),
    payload.compilerOptions?.baseUrl ?? ".",
  );
  const nextPaths: Record<string, string[]> = {};

  for (const [specifier, targets] of Object.entries(paths)) {
    nextPaths[specifier] = targets.map((target) =>
      path.isAbsolute(target) ? toConfigPath(target) : toConfigPath(path.resolve(baseUrl, target)),
    );
  }

  return nextPaths;
}

function toConfigPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}
