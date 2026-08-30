"""
Outgoing webhooks.

Events are POSTed as JSON to an operator-configured URL (n8n, Make, Zapier, a
custom endpoint...). Delivery happens in a background thread so a slow or dead
receiver never delays - or fails - the user's request.

Configuration (environment variables):
    WEBHOOKS_ENABLED           "false" to disable every dispatch (default: true)
    WEBHOOK_URL                fallback URL used when no per-event URL is set
    WEBHOOK_TRANSCRIPTION_URL  receives transcription.* events
    WEBHOOK_SIGNUP_URL         receives user.registered
    WEBHOOK_SECRET             HMAC-SHA256 signing secret (strongly recommended)
    WEBHOOK_TIMEOUT            per-attempt timeout in seconds (default: 5)
    WEBHOOK_MAX_RETRIES        total attempts per delivery (default: 3)
"""
import hashlib
import hmac
import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse

# Event names
EVENT_TRANSCRIPTION_REQUESTED = "transcription.requested"
EVENT_TRANSCRIPTION_COMPLETED = "transcription.completed"
EVENT_TRANSCRIPTION_FAILED = "transcription.failed"
EVENT_USER_REGISTERED = "user.registered"

# Which environment variable holds the destination for each event
_EVENT_URL_VARS = {
    EVENT_TRANSCRIPTION_REQUESTED: "WEBHOOK_TRANSCRIPTION_URL",
    EVENT_TRANSCRIPTION_COMPLETED: "WEBHOOK_TRANSCRIPTION_URL",
    EVENT_TRANSCRIPTION_FAILED: "WEBHOOK_TRANSCRIPTION_URL",
    EVENT_USER_REGISTERED: "WEBHOOK_SIGNUP_URL",
}

SIGNATURE_HEADER = "X-MemoMind-Signature"
TIMESTAMP_HEADER = "X-MemoMind-Timestamp"
EVENT_HEADER = "X-MemoMind-Event"
DELIVERY_HEADER = "X-MemoMind-Delivery"

_RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


def _truthy(value: Optional[str], default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() not in ("0", "false", "no", "off", "")


def webhooks_enabled() -> bool:
    """Master switch, useful to silence webhooks in staging or tests."""
    return _truthy(os.getenv("WEBHOOKS_ENABLED"), default=True)


def get_webhook_url(event: str) -> Optional[str]:
    """Resolve the destination URL for an event, falling back to WEBHOOK_URL."""
    url = os.getenv(_EVENT_URL_VARS.get(event, ""), "") or os.getenv("WEBHOOK_URL", "")
    url = url.strip()
    if not url:
        return None

    if urlparse(url).scheme not in ("http", "https"):
        print(f"⚠️ Webhook URL for '{event}' ignored: only http(s) is supported")
        return None

    return url


def build_payload(event: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Wrap event data in the delivery envelope."""
    return {
        "id": f"evt_{uuid.uuid4().hex}",
        "event": event,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "data": data,
    }


def sign_payload(body: bytes, timestamp: str, secret: str) -> str:
    """Sign "<timestamp>.<body>" so a captured payload cannot be replayed."""
    signed_content = timestamp.encode("utf-8") + b"." + body
    digest = hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def deliver(event: str, data: Dict[str, Any]) -> bool:
    """Send one webhook synchronously, retrying transient failures.

    Returns True when the receiver answered with a 2xx status.
    """
    if not webhooks_enabled():
        return False

    url = get_webhook_url(event)
    if not url:
        return False

    payload = build_payload(event, data)
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    timestamp = str(int(time.time()))

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MemoMind-Webhook/1.0",
        EVENT_HEADER: event,
        DELIVERY_HEADER: payload["id"],
        TIMESTAMP_HEADER: timestamp,
    }

    secret = os.getenv("WEBHOOK_SECRET", "").strip()
    if secret:
        headers[SIGNATURE_HEADER] = sign_payload(body, timestamp, secret)

    try:
        timeout = float(os.getenv("WEBHOOK_TIMEOUT", "5"))
    except ValueError:
        timeout = 5.0

    try:
        max_attempts = max(1, int(os.getenv("WEBHOOK_MAX_RETRIES", "3")))
    except ValueError:
        max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                print(f"✅ Webhook '{event}' delivered ({response.status}) [{payload['id']}]")
                return True
        except urllib.error.HTTPError as e:
            retryable = e.code in _RETRYABLE_STATUS
            print(f"⚠️ Webhook '{event}' failed with HTTP {e.code} (attempt {attempt}/{max_attempts})")
            if not retryable:
                return False
        except Exception as e:  # timeouts, DNS, TLS, connection resets...
            print(f"⚠️ Webhook '{event}' error: {e} (attempt {attempt}/{max_attempts})")

        if attempt < max_attempts:
            time.sleep(2 ** (attempt - 1))

    print(f"❌ Webhook '{event}' gave up after {max_attempts} attempts [{payload['id']}]")
    return False


def dispatch(event: str, data: Dict[str, Any]) -> None:
    """Fire a webhook in the background. Never raises, never blocks."""
    try:
        if not webhooks_enabled() or not get_webhook_url(event):
            return

        thread = threading.Thread(
            target=deliver,
            args=(event, data),
            name=f"webhook-{event}",
            daemon=True,
        )
        thread.start()
    except Exception as e:
        # A webhook must never break the request that triggered it.
        print(f"⚠️ Could not dispatch webhook '{event}': {e}")
