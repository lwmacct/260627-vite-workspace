import path from "node:path";
import type { Alias, UserConfig } from "vite";

export interface LocalWorkspacePackage {
  dedupe?: string[];
  exports: Record<string, string>;
  name: string;
  root: string;
}

export interface LocalWorkspaceConfigOptions {
  packages: LocalWorkspacePackage[];
  root?: string;
}

export function createLocalWorkspaceConfig(options: LocalWorkspaceConfigOptions): UserConfig {
  const alias: Alias[] = [];
  const allow = new Set<string>();
  const dedupe = new Set<string>();
  const exclude = new Set<string>();

  if (options.root) {
    allow.add(options.root);
  }

  for (const pkg of options.packages) {
    allow.add(pkg.root);
    exclude.add(pkg.name);

    for (const dep of pkg.dedupe ?? []) {
      dedupe.add(dep);
    }

    for (const [subpath, target] of Object.entries(pkg.exports)) {
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
