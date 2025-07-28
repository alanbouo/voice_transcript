import time
import assemblyai as aai
from assemblyai import TranscriptionConfig, Transcriber
from tqdm import tqdm

def transcribe_audio(audio_path: str, api_key: str):
    aai.settings.api_key = api_key
    config = TranscriptionConfig(speaker_labels=True, language_code="fr")
    transcriber = Transcriber()

    print("⬆️ Uploading and transcribing...")
    job = transcriber.transcribe(audio_path, config=config)

    print(f"🕐 Job ID: {job.id}")
    with tqdm(desc="📡 Transcription en cours", unit="step") as pbar:
        while job.status.value not in ("completed", "error"):
            pbar.update(1)
            time.sleep(3)
            job.refresh()

    if job.status.value == "error":
        raise RuntimeError("❌ Transcription échouée.")

    print("✅ Transcription terminée")
    return job
