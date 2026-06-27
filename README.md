# @lwmacct/260627-vite-workspace

用于 Vite 项目的本地多包联调配置工具。

这个包解决的问题是：业务项目正式依赖可以继续使用 npm 包或 GitHub release tarball，但本地开发时可以通过被 `.gitignore` 忽略的 `vite.local.ts` 把某些包临时指向源码目录，效果类似前端版 `go.work`。

## 安装

```bash
npm install --save-dev --save-exact https://github.com/lwmacct/260627-vite-workspace/releases/download/v0.2.260627/package.tar.gz
```

## 配置 .gitignore

业务项目里忽略本地配置文件：

```gitignore
vite.local.ts
```

## 配置 vite.config.ts

正式 `vite.config.ts` 保持可提交、可用于 CI。它只负责在本地文件存在时可选加载 `vite.local.ts`。

```ts
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, mergeConfig, type UserConfig } from "vite";

const rootDir = import.meta.dirname;

async function loadLocalConfig(): Promise<UserConfig> {
  const localConfigPath = path.resolve(rootDir, "vite.local.ts");

  if (!fs.existsSync(localConfigPath)) {
    return {};
  }

  const mod = await import(/* @vite-ignore */ pathToFileURL(localConfigPath).href);
  return mod.default ?? {};
}

export default defineConfig(async () =>
  mergeConfig(
    {
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(rootDir, "src"),
        },
      },
      build: {
        chunkSizeWarningLimit: 5120,
      },
    },
    await loadLocalConfig(),
  ),
);
```

## 配置 vite.local.ts

`vite.local.ts` 不提交到仓库，只保留在本机。这里配置需要本地源码联调的包。

```ts
import { defineViteWorkspaceConfig } from "@lwmacct/260627-vite-workspace";

export default defineViteWorkspaceConfig({
  projectRoot: import.meta.dirname,
  packages: [
    {
      name: "@lwmacct/260627-antd-workbench",
      root: "/data/project/260627-antd-workbench/workspace",
      entries: {
        ".": "src/index.ts",
        "styles.css": "src/styles.css",
      },
      dedupe: ["@ant-design/icons", "antd", "react", "react-dom"],
    },
  ],
});
```

## 覆盖 Vite 配置

`vite.local.ts` 也可以覆盖正式 `vite.config.ts` 里的任意 Vite 配置。例如本地调大 chunk 警告阈值：

```ts
import { defineViteWorkspaceConfig } from "@lwmacct/260627-vite-workspace";

export default defineViteWorkspaceConfig({
  projectRoot: import.meta.dirname,
  packages: [
    {
      name: "@lwmacct/260627-antd-workbench",
      root: "/data/project/260627-antd-workbench/workspace",
      entries: {
        ".": "src/index.ts",
        "styles.css": "src/styles.css",
      },
      dedupe: ["@ant-design/icons", "antd", "react", "react-dom"],
    },
  ],
  overrides: {
    build: {
      chunkSizeWarningLimit: 10000,
    },
  },
});
```

`overrides` 会通过 Vite 官方 `mergeConfig` 合并到 workspace 配置中。业务项目的正式 `vite.config.ts` 再把整个本地配置作为覆盖项合并进基础配置，所以本地配置优先级更高。

## 生成的配置

`defineViteWorkspaceConfig` 会根据 `packages` 自动生成：

- `resolve.alias`：把包名精确映射到源码入口。
- `resolve.dedupe`：避免 React、AntD 等 peer dependency 出现多实例。
- `server.fs.allow`：允许 Vite dev server 访问项目外的本地包源码目录。
- `optimizeDeps.exclude`：避免本地源码包被当作普通依赖预构建。

## 多包联调

新增本地包时，只需要在 `packages` 中追加一项：

```ts
{
  name: "@lwmacct/some-package",
  root: "/data/project/some-package/workspace",
  entries: {
    ".": "src/index.ts",
    "styles.css": "src/styles.css",
  },
  dedupe: ["react", "react-dom"],
}
```

如果某个包没有样式入口，可以不配置 `styles.css`。
