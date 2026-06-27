# @lwmacct/260627-vite-workspace

Vite helpers for local multi-package workspace development.

## Usage

```ts
import { createLocalWorkspaceConfig } from "@lwmacct/260627-vite-workspace";
import { defineConfig } from "vite";

export default defineConfig(
  createLocalWorkspaceConfig({
    root: import.meta.dirname,
    packages: [
      {
        name: "@lwmacct/260627-antd-workbench",
        root: "/data/project/260627-antd-workbench/workspace",
        exports: {
          ".": "src/index.ts",
          "styles.css": "src/styles.css",
        },
        dedupe: ["@ant-design/icons", "antd", "react", "react-dom"],
      },
    ],
  }),
);
```
