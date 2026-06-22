# Hermes Agent plugin

This plugin forwards Hermes Agent lifecycle and tool-call hooks to the local Clawd Companion event server.

## Install

Copy this directory into your active Hermes profile's plugin directory:

```bash
mkdir -p ~/.hermes/plugins/clawd-companion
cp plugins/hermes-agent/plugin.yaml ~/.hermes/plugins/clawd-companion/plugin.yaml
cp plugins/hermes-agent/__init__.py ~/.hermes/plugins/clawd-companion/__init__.py
```

Then enable or reload plugins from Hermes:

```bash
hermes plugins list
```

Start Clawd Companion before running Hermes. By default the plugin posts to:

```text
http://127.0.0.1:47634/events
```

## Configuration

Optional environment variables:

- `CLAWD_COMPANION_HERMES_URL`: override the event endpoint.
- `CLAWD_COMPANION_TOKEN`: bearer token when Clawd Companion is configured to require one.

The plugin ignores connection failures so Hermes keeps working when the desktop app is closed.

## Forwarded Hooks

- `pre_tool_call`
- `post_tool_call`
- `on_session_start`
- `on_session_end`
- `pre_approval_request`
- `post_approval_response`