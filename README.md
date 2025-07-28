# 🎙️ VOICE_TRANSCRIPT

Transcription automatique de mémos vocaux (format `.m4a`, `.mp3`, etc.) avec reconnaissance des locuteurs, conversion audio optimisée, et export au format `.txt` et `.json`.

Fonctionne avec l'API AssemblyAI, en ligne de commande.

---

## 🚀 Fonctionnalités

- 🔄 Conversion des fichiers `.m4a` vers `.mp3` mono 16 kHz avec compression personnalisée
- ☁️ Upload vers AssemblyAI et transcription en français avec détection des locuteurs (Speaker A, B...)
- 📝 Export du résultat en :
  - `outputs/xxx.json` (transcription structurée horodatée)
  - `outputs/xxx.txt` (transcription lisible par speaker)
- 📊 Barre de progression pour la transcription

---

## 🧰 Pré-requis

- Python ≥ 3.9
- Un compte gratuit chez [AssemblyAI](https://www.assemblyai.com/) avec une clé API
- `ffmpeg` installé (`brew install ffmpeg` sur macOS, `apt install ffmpeg` sur Linux)

---

## 📦 Installation

1. Clone du repo ou copie locale du projet :

```bash
cd VOICE_TRANSCRIPT
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Ajoute ta clé API dans un fichier `.env` :

```dotenv
AAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxx
```

---

## ▶️ Utilisation

Dépose un fichier audio dans `inputs/`, par exemple `inputs/mon_memo.m4a`, puis exécute :

```bash
python scripts/main.py mon_memo.m4a
```

### Qualité personnalisée

Tu peux spécifier une qualité audio avec un deuxième argument :

```bash
python scripts/main.py mon_memo.m4a low
```

| Qualité  | Bitrate utilisé |
|----------|------------------|
| `high`   | 128k (défaut)    |
| `medium` | 96k              |
| `low`    | 64k              |

---

## 📂 Arborescence du projet

```
VOICE_TRANSCRIPT/
├── inputs/                # fichiers source (.m4a)
├── outputs/               # fichiers générés (json, txt, mp3)
├── scripts/               # logique principale
│   ├── main.py            # point d'entrée
│   ├── convert.py         # conversion audio
│   ├── transcribe.py      # transcription + diarisation
│   └── export.py          # export JSON + TXT
├── utils/                 # fonctions utilitaires (si besoin)
├── .env                   # clé API
├── .gitignore             # exclusions Git
├── requirements.txt       # dépendances
└── README.md              # ce fichier
```

---

## 🧪 Exemple de sortie `.txt`

```
Speaker A ▶ Bonjour, je vous appelle au sujet du contrat de maintenance.
Speaker B ▶ Très bien, pouvez-vous me donner votre numéro de dossier ?
```

---

## 📌 À venir

- [ ] Recherche plein texte dans les résultats
- [ ] Interface graphique légère (Streamlit / Tauri)

---

## 🙌 Crédits

Ce projet utilise :
- [`assemblyai`](https://pypi.org/project/assemblyai/)
- [`tqdm`](https://github.com/tqdm/tqdm)
- `ffmpeg` pour la conversion audio
