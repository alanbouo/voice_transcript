import subprocess
from pathlib import Path

def convert_to_mp3(input_path: Path, output_path: Path, bitrate: str = "128k"):
    """
    Convertit un fichier audio en MP3 mono 16kHz compressé.

    Args:
        input_path: Chemin du fichier source (.m4a, .wav, etc.)
        output_path: Chemin du fichier de sortie .mp3
        bitrate: Bitrate cible (ex: '64k', '96k', '128k')
    """
    print(f"🔄 Conversion : {input_path.name} → {output_path.name} (bitrate={bitrate})")
    result = subprocess.run([
        "ffmpeg", "-y", "-i", str(input_path),
        "-ac", "1", "-ar", "16000", "-b:a", bitrate,
        str(output_path)
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode())
