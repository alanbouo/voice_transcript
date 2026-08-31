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


# A single-speaker recording comes back from AssemblyAI as ONE utterance
# covering the whole file, because utterances group consecutive words by
# speaker. Segmenting turns that into regular timestamps.
DEFAULT_TARGET_SEGMENT_MS = 30_000
DEFAULT_MAX_SEGMENT_MS = 60_000

# Trailing punctuation that marks a sentence boundary (French quotes included)
_SENTENCE_ENDINGS = ('.', '!', '?', '…', '"', '»', ')')


def _word_bound(word: Dict[str, Any], key: str) -> Optional[float]:
    try:
        return float(word.get(key))
    except (AttributeError, TypeError, ValueError):
        return None


def _ends_sentence(word: Dict[str, Any]) -> bool:
    text = str(word.get("text") or "").rstrip()
    return text.endswith(_SENTENCE_ENDINGS)


def _segment_one(
    utterance: Dict[str, Any],
    target_segment_ms: int,
    max_segment_ms: int,
) -> List[Dict[str, Any]]:
    """Split a single long utterance on sentence boundaries, using its words."""
    words = [w for w in (utterance.get("words") or []) if isinstance(w, dict)]

    start = _word_bound(utterance, "start")
    end = _word_bound(utterance, "end")
    duration = (end - start) if (start is not None and end is not None) else 0

    # Short enough, or no word-level timings to split on: leave it alone
    if duration <= max_segment_ms or len(words) < 2:
        return [utterance]

    chunks: List[List[Dict[str, Any]]] = []
    current: List[Dict[str, Any]] = []

    for word in words:
        current.append(word)

        chunk_start = _word_bound(current[0], "start")
        word_end = _word_bound(word, "end")
        if chunk_start is None or word_end is None:
            continue

        elapsed = word_end - chunk_start
        if (elapsed >= target_segment_ms and _ends_sentence(word)) or elapsed >= max_segment_ms:
            chunks.append(current)
            current = []

    if current:
        # Don't leave a dangling scrap of a few words on its own
        if chunks and len(current) < 3:
            chunks[-1].extend(current)
        else:
            chunks.append(current)

    if len(chunks) < 2:
        return [utterance]

    segments = []
    for chunk in chunks:
        segments.append({
            **utterance,
            "text": " ".join(str(w.get("text") or "") for w in chunk).strip(),
            "start": _word_bound(chunk[0], "start"),
            "end": _word_bound(chunk[-1], "end"),
            "words": chunk,
        })

    return segments


def segment_utterances(
    utterances: Optional[Iterable[Dict[str, Any]]],
    target_segment_ms: int = DEFAULT_TARGET_SEGMENT_MS,
    max_segment_ms: int = DEFAULT_MAX_SEGMENT_MS,
) -> List[Dict[str, Any]]:
    """Break overly long utterances into regularly timestamped segments.

    A conversation between several speakers already produces short utterances
    and passes through untouched; a monologue - which AssemblyAI returns as one
    utterance spanning the entire recording - is split roughly every
    ``target_segment_ms``, always at a sentence boundary when one is in reach.
    """
    segments: List[Dict[str, Any]] = []

    for utterance in utterances or []:
        if not isinstance(utterance, dict):
            continue
        segments.extend(_segment_one(utterance, target_segment_ms, max_segment_ms))

    return segments


def enrich_utterances(
    utterances: Optional[Iterable[Dict[str, Any]]],
    speaker_mappings: Optional[Dict[str, str]] = None,
    include_words: bool = False,
) -> List[Dict[str, Any]]:
    """Add display-ready speaker names and timestamps to raw utterances.

    The original keys (speaker, text, start, end, ...) are preserved so existing
    consumers keep working. Per-word timings are dropped unless ``include_words``
    is set - nothing in the UI reads them and they dominate the payload size.
    """
    speaker_mappings = speaker_mappings or {}
    enriched = []

    for utterance in utterances or []:
        if not isinstance(utterance, dict):
            continue

        start = utterance.get("start")
        end = utterance.get("end")
        speaker = utterance.get("speaker")

        item = {
            **utterance,
            "speaker_name": speaker_mappings.get(speaker, speaker),
            "start_formatted": format_timestamp(start),
            "end_formatted": format_timestamp(end),
            "timestamp": format_range(start, end),
        }
        if not include_words:
            item.pop("words", None)

        enriched.append(item)

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
