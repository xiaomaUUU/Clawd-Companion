# Clawd Companion

一个 Claude Code 桌宠第一版原型：透明桌宠窗口、美观配置面板、本地事件服务和 Claude Code hooks 转发器。

## 运行

```bash
npm install
npm run dev:electron
```

## 构建

```bash
npm run build
npm run start
```

## Claude Code hooks

先构建 hook 转发器：

```bash
npm run build:forwarder
```

然后参考 `claude-code-hooks.example.json`，把里面的 `hooks` 合并进你的 Claude Code `settings.json`。

默认本地事件入口：

- HTTP: `POST http://127.0.0.1:47634/events`
- Token: `clawd-local`

可用环境变量：

- `CLAWD_COMPANION_PORT`
- `CLAWD_COMPANION_TOKEN`
- `CLAWD_PRIVACY_MODE=safe|standard|detailed`

默认安全模式不会转发完整 prompt、命令输出或文件内容。
