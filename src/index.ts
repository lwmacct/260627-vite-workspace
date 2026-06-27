import path from "node:path";
import { defineConfig, mergeConfig, type Alias, type UserConfig, type UserConfigExport } from "vite";

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

export function defineViteWorkspaceConfig(options: ViteWorkspaceConfigOptions): UserConfigExport {
  const workspaceConfig = createWorkspaceConfig(options);
  return defineConfig(mergeConfig(workspaceConfig, options.overrides ?? {}) as UserConfig);
}

function createWorkspaceConfig(options: ViteWorkspaceConfigOptions): UserConfig {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
