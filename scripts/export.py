import json
from pathlib import Path

from utils.transcript_format import format_timestamp

def save_transcript_json(job, output_path: Path):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(job.json_response, f, indent=2, ensure_ascii=False)
    print(f"📄 Export JSON : {output_path.name}")

def save_transcript_txt(job, output_path: Path, include_timestamps: bool = True):
    with open(output_path, "w", encoding="utf-8") as f:
        for utt in job.utterances:
            prefix = f"[{format_timestamp(utt.start)}] " if include_timestamps else ""
            f.write(f"{prefix}{utt.speaker} ▶ {utt.text}\n")
    print(f"📄 Export TXT : {output_path.name}")
