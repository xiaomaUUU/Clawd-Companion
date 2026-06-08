# Clawd Companion 项目指南

## 发布流程

当用户说"提交release"或类似表述时，自动执行以下流程：

1. **版本号递增**：运行 `npm run version:patch`（或 `version:minor` / `version:major`）同步更新 `package.json` 和 `package-lock.json`
   - 如果用户主动指定了版本号（如"发布1.4.0"），可使用 `npm run version:patch -- 1.4.0` 或手动执行 `node scripts/bump-version.mjs 1.4.0`
   - 永远不要覆盖已有的 GitHub Release
2. **本地构建**（可选，CI 会自动构建）：运行 `npm run dist` 生成安装包
3. **文件重命名**：将生成的 exe 和 blockmap 文件名从空格格式改为连字符格式（如 `Clawd Companion Setup 1.3.3.exe` → `Clawd-Companion-Setup-1.3.3.exe`），以匹配 `latest.yml` 中的文件名
4. **提交推送**：git add → commit → tag → push（tag 格式 `v{版本号}`）
5. **创建 Release**：推送 tag 后，CI 工作流 `.github/workflows/release.yml` 会自动构建并发布到 GitHub Release。如需手动发布，使用 `gh release create`

## 版本号规则

- 当前版本存储在 `package.json` 的 `version` 字段
- 每次发布自动 patch 递增，除非用户明确指定
- `latest.yml` 中的文件名必须与上传到 Release 的文件名完全一致
- `scripts/bump-version.mjs` 负责同步 `package.json` 和 `package-lock.json` 两个文件的版本

## Release 文件命名规范

- **上传到 GitHub Release 的文件**必须使用连字符格式：`Clawd-Companion-Setup-{版本号}.exe`
- **electron-builder 生成的文件**使用空格格式：`Clawd Companion Setup {版本号}.exe`
- **必须在构建后重命名**：exe 和 blockmap 文件都需要从空格格式改为连字符格式
- **latest.yml** 中的文件名必须与重命名后的文件名完全一致
- CI 中的重命名步骤在 `.github/workflows/release.yml` 的 "Rename artifacts to match latest.yml" 中自动完成

## 构建命令

- `npm run build` — 编译 TypeScript + Vite 构建
- `npm run dist` — 构建 + electron-builder 打包
- `npm run dist:validate` — 校验 latest.yml 文件名一致性
- `npm run typecheck` — 仅做类型检查（不发包）
- `npm test` — 运行 hook-forwarder 单元测试（vitest）
- `npm run version:patch` / `version:minor` / `version:major` — 同步更新 package.json 和 package-lock.json 的版本号

## 持续集成 (CI/CD)

- **`.github/workflows/ci.yml`**：push / PR 触发，运行 typecheck + 测试（windows-latest）
- **`.github/workflows/release.yml`**：tag 触发（`v*.*.*`），自动构建、产物重命名、上传到 GitHub Release

## Claude Code 启动时自动启动本应用

**默认关闭**，需要用户在配置面板 → 应用行为 中开启「Claude Code 启动时自动启动本应用」开关。

开关实现细节：
1. 主程序把开关状态写入标记文件 `~/.clawd-companion/auto-start-with-cli.flag`
2. forwarder 在 `SessionStart` 时先 ping `127.0.0.1:47634/health`，如果主程序已在运行则直接复用
3. 如果主程序未运行，根据 forwarder 所在位置判断是 dev 还是 prod 布局：
   - Dev: `<project>/dist/hook-forwarder/index.js` → `npm start` in 项目根
   - Prod: `<install>/resources/hook-forwarder/index.js` → `<install>/Clawd Companion.exe`
4. 通过 `child_process.spawn` + `detached: true` + `unref()` 启动，不阻塞 forwarder 退出
5. **环境变量覆盖**（高级用户）：`CLAWD_COMPANION_AUTOSTART=1` 强制开启，`=0` 强制关闭

## 多 CLI 架构（Multi-CLI）

Clawd Companion 从 v1.6.0 起支持同时跟踪多个 AI 编程 CLI：Claude Code（默认）和 OpenAI Codex（新增）。

### Provider 抽象

所有 CLI 共用一个 `Provider` 接口，位于 `apps/desktop/src/shared/providers.ts`：

- `id` / `displayName` / `defaultClientLabel`：身份与展示名
- `format`：`"json"`（Claude Code 用 `~/.claude/settings.json`）或 `"toml"`（Codex 用 `~/.codex/config.toml`）
- `settingsPath`：配置文件绝对路径（Codex 读取 `$CODEX_HOME`）
- `requiredEvents` / `permissionEvents`：需要订阅的 hook 事件
- `normalize(payload, env)`：把 raw hook JSON 翻译成 `CompanionEvent`
- `isPermissionEvent(payload)` / `formatPermissionDecision(decision, reason)`：权限流判定与 stdout 线协议

注册表：`claudeCodeProvider` 和 `codexProvider`，通过 `getProvider(id)` 获取。

### Forwarder 二进制拆分

每个 Provider 都有自己的 forwarder 二进制：

- `apps/hook-forwarder/` → `dist/hook-forwarder/index.js`（Claude Code）
- `apps/hook-forwarder-codex/` → `dist/hook-forwarder-codex/index.js`（Codex）
- `apps/hook-forwarder-core/` 共享 stdin / 连接 / permission / wakeup 逻辑

新增 CLI 时，只需：
1. 实现 `Provider` 模块
2. 新建 `<cli>-forwarder/` shim，导入 core 强制 `provider = "<cli>"`
3. `package.json` 的 `build:forwarder` 加上新 tsconfig
4. `extraResources` 加上新的 `<cli>-forwarder/` 资源

### Hooks 安装 / TOML 序列化

`apps/desktop/src/main/hooks-manager.ts` 是 provider 感知的。`provider.format === "toml"` 时走 `toml-hooks.ts`（手写最小 TOML 解析器，保留用户不认识的段；corrupt 文件不写）。

Windows 下 Codex 同时写 `command` 与 `commandWindows`，使用单引号 TOML 字符串保留反斜杠。

### 设置与 UI

- `CompanionSettings.enabledSources: ProviderId[]`（默认 `["claude-code"]`），迁移时缺失补全、非法值过滤、按 `PROVIDER_IDS` 重排。
- 设置面板新增「数据源 (Sources)」区块（`SourcesPanel.tsx`），同时显示 Claude Code 与 OpenAI Codex 两条 hook 状态卡片，支持 install / repair / remove。
- `DoctorReport` 改为按 provider 聚合（向后兼容旧字段 `hooks` / `forwarder.expectedPath`）。

