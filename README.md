# 🎙️ VOICE_TRANSCRIPT

Automatic voice memo transcription pipeline with speaker diarization, audio conversion, and structured export to `.txt` and `.json` formats.

Powered by AssemblyAI’s transcription API, run via command line.

---

## 🚀 Features

- 🔄 Converts `.m4a` audio files to `.mp3` mono 16 kHz with adjustable compression
- ☁️ Uploads audio to AssemblyAI and transcribes in French with speaker labeling
- 📝 Exports results as:
  - `outputs/xxx.json` (structured transcript with timestamps)
  - `outputs/xxx.txt` (readable speaker-separated transcript)
- 📊 Progress bar during transcription

---

## 🧰 Requirements

- Python ≥ 3.9
- An [AssemblyAI account](https://www.assemblyai.com/) with an API key
- `ffmpeg` installed (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux)

---

## 📦 Installation

1. Clone the repo or download the project folder:

```bash
cd VOICE_TRANSCRIPT
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Add your API key in a `.env` file:

```dotenv
AAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxx
```

---

## ▶️ Usage

Drop a voice memo in `inputs/`, e.g. `inputs/my_memo.m4a`, then run:

```bash
python scripts/main.py my_memo.m4a
```

### Optional: Control audio quality

You can specify a compression level with a second argument:

```bash
python scripts/main.py my_memo.m4a low
```

| Quality   | Bitrate used |
|-----------|---------------|
| `high`    | 128k (default) |
| `medium`  | 96k            |
| `low`     | 64k            |

---

## 📂 Project Structure

```
VOICE_TRANSCRIPT/
├── inputs/                # original audio files (.m4a)
├── outputs/               # generated files (.json, .txt, .mp3)
├── scripts/               # main logic
│   ├── main.py            # entry point
│   ├── convert.py         # audio conversion
│   ├── transcribe.py      # transcription + speaker diarization
│   └── export.py          # export JSON + TXT
├── utils/                 # utility functions (optional)
├── .env                   # API key config
├── .gitignore             # Git exclusions
├── requirements.txt       # dependencies
└── README.md              # this file
```

---

## 🧪 Sample `.txt` Output

```
Speaker A ▶ Hello, I’m calling about the maintenance contract.
Speaker B ▶ Sure, could you give me your case number?
```

---

## 📌 Coming Soon

- [ ] Full-text search across transcripts
- [ ] Lightweight GUI (Streamlit / Tauri)

---

## 🙌 Credits

This project uses:
- [`assemblyai`](https://pypi.org/project/assemblyai/)
- [`tqdm`](https://github.com/tqdm/tqdm)
- `ffmpeg` for audio processing
