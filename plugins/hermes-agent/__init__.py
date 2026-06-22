"""Hermes Agent plugin for forwarding events to Clawd Companion."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


DEFAULT_URL = "http://127.0.0.1:47634/events"
TIMEOUT_SECONDS = 0.8


def _json_safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(k): _json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [_json_safe(item) for item in value]
        return str(value)


def _endpoint() -> str:
    return os.getenv("CLAWD_COMPANION_HERMES_URL", DEFAULT_URL).strip() or DEFAULT_URL


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    token = os.getenv("CLAWD_COMPANION_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _forward(event: str, **payload: Any) -> None:
    body = dict(payload)
    body["event"] = event
    body.setdefault("source", "hermes")
    data = json.dumps(_json_safe(body), separators=(",", ":")).encode("utf-8")
    request = Request(_endpoint(), data=data, headers=_headers(), method="POST")
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS):
            pass
    except (OSError, URLError, TimeoutError):
        # Clawd Companion is optional. Never let desktop forwarding affect Hermes.
        return


def _pre_tool_call(**payload: Any) -> None:
    _forward("pre_tool_call", **payload)


def _post_tool_call(**payload: Any) -> None:
    _forward("post_tool_call", **payload)


def _on_session_start(**payload: Any) -> None:
    _forward("on_session_start", **payload)


def _on_session_end(**payload: Any) -> None:
    _forward("on_session_end", **payload)


def _pre_approval_request(**payload: Any) -> None:
    _forward("pre_approval_request", **payload)


def _post_approval_response(**payload: Any) -> None:
    _forward("post_approval_response", **payload)


def register(ctx) -> None:
    ctx.register_hook("pre_tool_call", _pre_tool_call)
    ctx.register_hook("post_tool_call", _post_tool_call)
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("on_session_end", _on_session_end)
    ctx.register_hook("pre_approval_request", _pre_approval_request)
    ctx.register_hook("post_approval_response", _post_approval_response)