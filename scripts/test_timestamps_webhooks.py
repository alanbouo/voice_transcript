"""
Tests for the timestamp helpers and the webhook dispatcher.

Run with: python scripts/test_timestamps_webhooks.py
No external dependencies required - the webhook receiver is a stdlib HTTP server.
"""
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from api import webhooks
from utils.transcript_format import (
    enrich_utterances,
    format_range,
    format_timestamp,
    render_transcript_text,
    segment_utterances,
)

UTTERANCES = [
    {"speaker": "A", "text": "Bonjour tout le monde.", "start": 1500, "end": 4200},
    {"speaker": "B", "text": "Salut !", "start": 4300, "end": 5100},
    {"speaker": "A", "text": "On reprend plus tard.", "start": 3_725_000, "end": 3_728_000},
]


def test_format_timestamp():
    assert format_timestamp(0) == "00:00"
    assert format_timestamp(1500) == "00:01"
    assert format_timestamp(65_000) == "01:05"
    assert format_timestamp(3_725_000) == "1:02:05", format_timestamp(3_725_000)
    assert format_timestamp(None) == ""
    assert format_timestamp("nope") == ""
    assert format_timestamp(-500) == "00:00"
    assert format_timestamp(0, force_hours=True) == "0:00:00"
    print("✅ format_timestamp")


def test_format_range():
    assert format_range(1500, 4200) == "00:01 - 00:04"
    assert format_range(1500, None) == "00:01"
    assert format_range(None, None) == ""
    print("✅ format_range")


def test_enrich_utterances():
    enriched = enrich_utterances(UTTERANCES, {"A": "Alice"})

    assert enriched[0]["speaker_name"] == "Alice"
    assert enriched[1]["speaker_name"] == "B"  # unmapped speakers keep their label
    assert enriched[0]["start_formatted"] == "00:01"
    assert enriched[0]["timestamp"] == "00:01 - 00:04"
    assert enriched[2]["start_formatted"] == "1:02:05"
    assert enriched[0]["text"] == "Bonjour tout le monde."  # original keys preserved
    assert enrich_utterances(None) == []
    print("✅ enrich_utterances")


def test_render_transcript_text():
    with_stamps = render_transcript_text(UTTERANCES, {"A": "Alice"}, include_timestamps=True)
    assert with_stamps.splitlines()[0] == "[00:01] Alice: Bonjour tout le monde."
    assert with_stamps.splitlines()[2] == "[1:02:05] Alice: On reprend plus tard."

    without = render_transcript_text(UTTERANCES, {"A": "Alice"}, include_timestamps=False)
    assert without.splitlines()[0] == "Alice: Bonjour tout le monde."
    print("✅ render_transcript_text")


def _monologue(duration_ms=900_000, word_ms=400):
    """One speaker talking for 15 minutes - what AssemblyAI returns as a single
    utterance, which is exactly the case that produced a lone 00:00 stamp."""
    words = []
    for i in range(duration_ms // word_ms):
        start = i * word_ms
        # A sentence ends every 10 words
        text = f"mot{i}." if i % 10 == 9 else f"mot{i}"
        words.append({"text": text, "start": start, "end": start + word_ms})

    return [{
        "speaker": "A",
        "text": " ".join(w["text"] for w in words),
        "start": 0,
        "end": duration_ms,
        "words": words,
    }]


def test_segment_monologue():
    segments = segment_utterances(_monologue())

    # A 15-minute block must not stay a single segment
    assert len(segments) > 10, len(segments)

    # Every segment carries its own timestamps, in order, without gaps or overlap
    assert segments[0]["start"] == 0
    previous_end = -1
    for segment in segments:
        assert segment["start"] is not None and segment["end"] is not None
        assert segment["end"] > segment["start"]
        assert segment["start"] >= previous_end
        assert segment["speaker"] == "A"
        assert segment["text"]
        previous_end = segment["end"]

    # Segments respect the ceiling and mostly land on the target
    durations = [s["end"] - s["start"] for s in segments]
    assert max(durations) <= 60_000, max(durations)

    # No text is lost or duplicated in the split
    joined = " ".join(s["text"] for s in segments)
    assert joined == _monologue()[0]["text"]

    # Splits land on sentence boundaries
    assert segments[0]["text"].endswith("."), segments[0]["text"][-30:]
    print(f"✅ segment_utterances (monologue split into {len(segments)} segments)")


def test_segment_leaves_short_utterances_alone():
    # A normal multi-speaker conversation must pass through untouched
    assert segment_utterances(UTTERANCES) == UTTERANCES

    # No word timings available (older transcripts) -> unchanged
    no_words = [{"speaker": "A", "text": "x", "start": 0, "end": 900_000}]
    assert segment_utterances(no_words) == no_words

    assert segment_utterances(None) == []
    print("✅ segment_utterances leaves short / word-less utterances alone")


def test_enrich_drops_words_by_default():
    segments = segment_utterances(_monologue())
    enriched = enrich_utterances(segments)

    assert "words" not in enriched[0]
    assert enriched[0]["timestamp"] == "00:00 - 00:32", enriched[0]["timestamp"]
    assert "words" in enrich_utterances(segments, include_words=True)[0]
    print("✅ enrich_utterances drops word timings by default")


def test_build_and_sign_payload():
    payload = webhooks.build_payload("user.registered", {"user": {"id": 1}})
    assert payload["event"] == "user.registered"
    assert payload["id"].startswith("evt_")
    assert payload["created_at"].endswith("Z")
    assert payload["data"] == {"user": {"id": 1}}

    body = json.dumps({"a": 1}).encode("utf-8")
    signature = webhooks.sign_payload(body, "1700000000", "topsecret")
    assert signature.startswith("sha256=")
    # Deterministic, and bound to both the body and the timestamp
    assert signature == webhooks.sign_payload(body, "1700000000", "topsecret")
    assert signature != webhooks.sign_payload(body, "1700000001", "topsecret")
    assert signature != webhooks.sign_payload(b'{"a": 2}', "1700000000", "topsecret")
    print("✅ build_payload / sign_payload")


def test_url_resolution():
    env_backup = dict(os.environ)
    try:
        for key in ("WEBHOOK_URL", "WEBHOOK_SIGNUP_URL", "WEBHOOK_TRANSCRIPTION_URL", "WEBHOOKS_ENABLED"):
            os.environ.pop(key, None)

        assert webhooks.get_webhook_url(webhooks.EVENT_USER_REGISTERED) is None

        os.environ["WEBHOOK_URL"] = "https://example.test/all"
        assert webhooks.get_webhook_url(webhooks.EVENT_USER_REGISTERED) == "https://example.test/all"

        os.environ["WEBHOOK_SIGNUP_URL"] = "https://example.test/signup"
        assert webhooks.get_webhook_url(webhooks.EVENT_USER_REGISTERED) == "https://example.test/signup"
        assert webhooks.get_webhook_url(webhooks.EVENT_TRANSCRIPTION_REQUESTED) == "https://example.test/all"

        # Non-http schemes are rejected
        os.environ["WEBHOOK_SIGNUP_URL"] = "file:///etc/passwd"
        assert webhooks.get_webhook_url(webhooks.EVENT_USER_REGISTERED) is None

        os.environ["WEBHOOKS_ENABLED"] = "false"
        assert webhooks.webhooks_enabled() is False
        os.environ["WEBHOOKS_ENABLED"] = "true"
        assert webhooks.webhooks_enabled() is True
    finally:
        os.environ.clear()
        os.environ.update(env_backup)
    print("✅ url resolution / enable switch")


def test_delivery_end_to_end():
    """Deliver a real HTTP request to a local receiver and inspect it."""
    received = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            received["body"] = self.rfile.read(length)
            received["headers"] = dict(self.headers)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"{}")

        def log_message(self, *args):
            pass  # keep the test output clean

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    env_backup = dict(os.environ)
    try:
        os.environ["WEBHOOKS_ENABLED"] = "true"
        os.environ["WEBHOOK_SIGNUP_URL"] = f"http://127.0.0.1:{server.server_port}/hook"
        os.environ["WEBHOOK_SECRET"] = "topsecret"

        assert webhooks.deliver(webhooks.EVENT_USER_REGISTERED, {"user": {"email": "a@b.c"}}) is True
    finally:
        os.environ.clear()
        os.environ.update(env_backup)
        server.shutdown()

    payload = json.loads(received["body"].decode("utf-8"))
    assert payload["event"] == "user.registered"
    assert payload["data"]["user"]["email"] == "a@b.c"

    headers = {k.lower(): v for k, v in received["headers"].items()}
    assert headers["x-memomind-event"] == "user.registered"
    assert headers["x-memomind-delivery"] == payload["id"]

    expected = webhooks.sign_payload(
        received["body"], headers["x-memomind-timestamp"], "topsecret"
    )
    assert headers["x-memomind-signature"] == expected
    print("✅ end-to-end delivery + signature")


def test_dispatch_is_silent_when_unconfigured():
    env_backup = dict(os.environ)
    try:
        for key in ("WEBHOOK_URL", "WEBHOOK_SIGNUP_URL", "WEBHOOK_TRANSCRIPTION_URL"):
            os.environ.pop(key, None)
        # Must not raise even with nothing configured
        webhooks.dispatch(webhooks.EVENT_USER_REGISTERED, {"user": {"id": 1}})
    finally:
        os.environ.clear()
        os.environ.update(env_backup)
    print("✅ dispatch no-op when unconfigured")


if __name__ == "__main__":
    test_format_timestamp()
    test_format_range()
    test_enrich_utterances()
    test_render_transcript_text()
    test_segment_monologue()
    test_segment_leaves_short_utterances_alone()
    test_enrich_drops_words_by_default()
    test_build_and_sign_payload()
    test_url_resolution()
    test_delivery_end_to_end()
    test_dispatch_is_silent_when_unconfigured()
    print("\n🎉 All tests passed")
