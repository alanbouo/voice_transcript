# 🔔 Webhooks

MemoMind can POST a JSON event to a URL of your choice whenever a transcription
is requested or a new user signs up. This is the integration point for n8n,
Make, Zapier, a Slack relay, a CRM, or any endpoint you control.

Delivery runs in a background thread: a slow or unreachable receiver never
delays the user's request, and a webhook failure never fails a transcription.

---

## 1. Configuration

Add to your `.env` (or to the environment variables of your Coolify / Docker
deployment):

```bash
# Master switch (default: true)
WEBHOOKS_ENABLED=true

# Destination used when no per-event URL is set
WEBHOOK_URL=https://n8n.example.com/webhook/memomind

# Per-event destinations (optional, take priority over WEBHOOK_URL)
WEBHOOK_TRANSCRIPTION_URL=https://n8n.example.com/webhook/transcriptions
WEBHOOK_SIGNUP_URL=https://n8n.example.com/webhook/signups

# Signing secret - strongly recommended (see "Verifying the signature")
WEBHOOK_SECRET=a_long_random_string

# Delivery tuning
WEBHOOK_TIMEOUT=5        # seconds per attempt
WEBHOOK_MAX_RETRIES=3    # total attempts (1s, 2s backoff between them)
```

If no URL is configured for an event, nothing is sent — the feature is simply
inactive. Only `http://` and `https://` URLs are accepted.

Restart the API after changing these variables.

---

## 2. Events

| Event | Fired when | Destination |
|---|---|---|
| `user.registered` | A new account is created via `POST /register` | `WEBHOOK_SIGNUP_URL` |
| `transcription.requested` | A file is uploaded to `/transcribe` or `/transcribe/guest`, **before** processing starts | `WEBHOOK_TRANSCRIPTION_URL` |
| `transcription.completed` | The transcript is ready and saved | `WEBHOOK_TRANSCRIPTION_URL` |
| `transcription.failed` | Conversion or transcription raised an error | `WEBHOOK_TRANSCRIPTION_URL` |

`transcription.requested` is the event asked for; `completed` and `failed` are
sent to the same URL so an automation can react to the *result*, not only to the
intent. Filter on the `event` field (or on the `X-MemoMind-Event` header) if you
only care about one of them.

---

## 3. Payloads

Every delivery shares the same envelope:

```json
{
  "id": "evt_9f2c8b1e4d7a4f0b8c3e5a6d7f8b9c0d",
  "event": "transcription.requested",
  "created_at": "2026-08-30T14:22:31.482913Z",
  "data": { }
}
```

### `user.registered`

```json
{
  "data": {
    "user": {
      "id": 42,
      "email": "someone@example.com",
      "created_at": "2026-08-30T14:22:31.482913"
    },
    "source": "web"
  }
}
```

No password or password hash is ever included.

### `transcription.requested`

```json
{
  "data": {
    "request_id": "a1b2c3d4_meeting.m4a",
    "filename": "meeting.m4a",
    "quality": "high",
    "size_bytes": 8412736,
    "is_guest": false,
    "requested_at": "2026-08-30T14:22:31.482913",
    "user": { "id": 42, "email": "someone@example.com" }
  }
}
```

For guest transcriptions `is_guest` is `true` and `user` is `null`.

### `transcription.completed`

Same fields as `transcription.requested`, plus:

```json
{
  "database_id": 137,
  "duration_seconds": 42.87,
  "word_count": 1834,
  "utterance_count": 96
}
```

`database_id` is absent for guest transcriptions (nothing is stored).

### `transcription.failed`

Same fields as `transcription.requested`, plus `"error": "<message>"`.

---

## 4. Headers

| Header | Description |
|---|---|
| `X-MemoMind-Event` | Event name, e.g. `user.registered` |
| `X-MemoMind-Delivery` | Unique delivery id (same as `id` in the body) — use it to deduplicate retries |
| `X-MemoMind-Timestamp` | Unix seconds, part of the signed content |
| `X-MemoMind-Signature` | `sha256=<hex>` HMAC, only when `WEBHOOK_SECRET` is set |

---

## 5. Verifying the signature

The signature is an HMAC-SHA256 of `"<timestamp>.<raw body>"`, so a captured
payload cannot be replayed later with a fresh timestamp.

```python
import hashlib, hmac, time

def verify(raw_body: bytes, timestamp: str, signature: str, secret: str) -> bool:
    # Reject anything older than 5 minutes
    if abs(time.time() - int(timestamp)) > 300:
        return False
    expected = hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

Node.js equivalent:

```js
const crypto = require('crypto')

function verify(rawBody, timestamp, signature, secret) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

Verify against the **raw** request body, before any JSON parsing or
re-serialization.

---

## 6. Retries & idempotency

A delivery is retried when the receiver is unreachable, times out, or answers
`408`, `425`, `429`, `500`, `502`, `503` or `504`. Attempts are spaced by 1s then
2s (`WEBHOOK_MAX_RETRIES=3` by default). Any other 4xx is treated as a permanent
rejection and is not retried.

Because retries exist, your receiver must be idempotent: deduplicate on
`X-MemoMind-Delivery`.

Deliveries are best-effort and are not persisted — if the API restarts mid-retry,
that event is lost. If you need guaranteed delivery, have your receiver
acknowledge fast (queue and process asynchronously).

---

## 7. Testing locally

Point the webhook at a request-bin style endpoint (`webhook.site`,
`https://n8n.local/webhook-test/...`) or run a throwaway receiver:

```bash
python3 -m http.server 9000   # any endpoint that answers 200 works
```

```bash
WEBHOOK_URL=http://127.0.0.1:9000/hook WEBHOOK_SECRET=test \
  python3 -c "from api import webhooks; webhooks.deliver('user.registered', {'user': {'email': 'test@example.com'}})"
```

The automated tests cover envelope construction, signing, URL resolution and a
real end-to-end delivery:

```bash
python3 scripts/test_timestamps_webhooks.py
```
