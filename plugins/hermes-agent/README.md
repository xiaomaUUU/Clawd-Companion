# Hermes Agent plugin

This plugin forwards Hermes Agent lifecycle and tool-call hooks to the local Clawd Companion event server.

## Install

Copy this directory into your active Hermes profile's plugin directory:

```bash
mkdir -p ~/.hermes/plugins/clawd-companion
cp plugins/hermes-agent/plugin.yaml ~/.hermes/plugins/clawd-companion/plugin.yaml
cp plugins/hermes-agent/__init__.py ~/.hermes/plugins/clawd-companion/__init__.py
```

Clawd Companion writes the current local port and token to `~/.clawd-companion/connection.json`, and the plugin reads that file automatically. In the common case you do not need to set any extra environment variables.

Then restart Hermes or start a fresh Hermes session so the plugin loads.

## Configuration

By default the plugin reads:

- endpoint + port from `~/.clawd-companion/connection.json`
- bearer token from `~/.clawd-companion/connection.json`

Optional environment variables override that auto-detection:

- `CLAWD_COMPANION_HERMES_URL`: override the event endpoint.
- `CLAWD_COMPANION_TOKEN`: override the bearer token when needed.

The plugin ignores connection failures so Hermes keeps working when the desktop app is closed.

## Forwarded Hooks

- `pre_tool_call`
- `post_tool_call`
- `on_session_start`
- `on_session_end`
- `pre_approval_request`
- `post_approval_response`
