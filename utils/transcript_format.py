"""
Helpers to render transcripts with timestamps.

AssemblyAI returns utterance boundaries in milliseconds. Everything that
displays or exports a transcript goes through these helpers so the timestamp
format stays identical across the API, the TXT export and the frontend.
"""
from typing import Any, Dict, Iterable, List, Optional


def format_timestamp(milliseconds: Optional[float], force_hours: bool = False) -> str:
    """Format a millisecond offset as MM:SS (or H:MM:SS past one hour)."""
    if milliseconds is None:
        return ""

    try:
        total_seconds = int(max(0, float(milliseconds)) // 1000)
    except (TypeError, ValueError):
        return ""

    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours or force_hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def format_range(start: Optional[float], end: Optional[float]) -> str:
    """Format an utterance span as "MM:SS - MM:SS" (or just the start)."""
    start_label = format_timestamp(start)
    end_label = format_timestamp(end)

    if start_label and end_label:
        return f"{start_label} - {end_label}"
    return start_label or end_label


def enrich_utterances(
    utterances: Optional[Iterable[Dict[str, Any]]],
    speaker_mappings: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """Add display-ready speaker names and timestamps to raw utterances.

    The original keys (speaker, text, start, end, words, ...) are preserved so
    existing consumers keep working.
    """
    speaker_mappings = speaker_mappings or {}
    enriched = []

    for utterance in utterances or []:
        if not isinstance(utterance, dict):
            continue

        start = utterance.get("start")
        end = utterance.get("end")
        speaker = utterance.get("speaker")

        enriched.append({
            **utterance,
            "speaker_name": speaker_mappings.get(speaker, speaker),
            "start_formatted": format_timestamp(start),
            "end_formatted": format_timestamp(end),
            "timestamp": format_range(start, end),
        })

    return enriched


def render_transcript_text(
    utterances: Optional[Iterable[Dict[str, Any]]],
    speaker_mappings: Optional[Dict[str, str]] = None,
    include_timestamps: bool = True,
) -> str:
    """Render utterances as plain text, optionally prefixed with timestamps.

    Produces lines like "[00:12] Speaker A: Bonjour" so the export matches what
    the viewer shows on screen.
    """
    speaker_mappings = speaker_mappings or {}
    lines = []

    for utterance in utterances or []:
        if not isinstance(utterance, dict):
            continue

        text = (utterance.get("text") or "").strip()
        speaker = utterance.get("speaker")
        display_name = speaker_mappings.get(speaker, speaker)

        prefix = f"{display_name}: " if display_name else ""
        if include_timestamps:
            stamp = format_timestamp(utterance.get("start"))
            if stamp:
                prefix = f"[{stamp}] {prefix}"

        lines.append(f"{prefix}{text}")

    return "\n".join(lines)
