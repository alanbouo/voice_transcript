import os, sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from utils.convert import convert_to_mp3
from scripts.transcribe import transcribe_audio
from scripts.export import save_transcript_json, save_transcript_txt

load_dotenv()

INPUT_DIR = Path("inputs")
OUTPUT_DIR = Path("outputs")

QUALITY_PRESETS = {
    "high": "128k",
    "medium": "96k",
    "low": "64k"
}

def main(m4a_file: str, quality: str = "high"):
    api_key = os.getenv("AAI_API_KEY")
    if not api_key:
        raise EnvironmentError("AAI_API_KEY manquant dans le fichier .env")

    bitrate = QUALITY_PRESETS.get(quality, "128k")

    input_path = INPUT_DIR / m4a_file
    if not input_path.exists():
        sys.exit(f"❌ Fichier introuvable : {input_path}")

    base_name = input_path.stem
    mp3_path = OUTPUT_DIR / f"{base_name}.mp3"
    json_path = OUTPUT_DIR / f"{base_name}.json"
    txt_path = OUTPUT_DIR / f"{base_name}.txt"

    convert_to_mp3(input_path, mp3_path, bitrate=bitrate)
    job = transcribe_audio(str(mp3_path), api_key)
    save_transcript_json(job, json_path)
    save_transcript_txt(job, txt_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python scripts/main.py <nom_fichier.m4a> [quality: high|medium|low]")

    file_arg = sys.argv[1]
    quality_arg = sys.argv[2] if len(sys.argv) >= 3 else "high"
    main(file_arg, quality_arg)