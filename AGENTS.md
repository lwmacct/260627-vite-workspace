# Agent 规则

## 发版

- 修改本共享库后，先运行 `npm run typecheck` 和 `npm run build`。
- 验证通过后，使用 `task git:tag:next` 创建并推送新版本标签。

## 设计边界

- `defineViteWorkspaceConfig` 负责 Vite 本地源码联调配置。
- CLI 的 `typecheck` / `tsconfig` 命令负责显式的本地 workspace TypeScript 检查。
- 不要让业务项目的正式 `build` 隐式依赖本机 workspace；正式构建应继续检查已发布依赖契约。
