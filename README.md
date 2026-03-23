<div align="center">

# 💸 MoneyPrinter V2

**Automate online income streams with AI — YouTube Shorts, Twitter bots, affiliate marketing, and cold outreach.**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/flask-web_UI-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Ollama](https://img.shields.io/badge/ollama-local_LLM-white?style=for-the-badge&logo=ollama&logoColor=black)](https://ollama.com)
[![Selenium](https://img.shields.io/badge/selenium-automation-43B02A?style=for-the-badge&logo=selenium&logoColor=white)](https://selenium.dev)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL_v3-blue?style=for-the-badge)](LICENSE)

[Features](#-features) · [Quick Start](#-quick-start) · [Web UI](#-web-ui) · [Architecture](#-architecture) · [Configuration](#%EF%B8%8F-configuration) · [Contributing](#-contributing)

</div>

---

## 📋 Overview

MoneyPrinter V2 (MPV2) is a Python automation toolkit that uses **local AI models** (via [Ollama](https://ollama.com)) and **browser automation** (via Selenium) to automate four online money-making workflows — all from a single CLI or a modern **web dashboard**.

Everything runs locally. Your LLM runs on your machine. Your browser sessions stay private. No cloud APIs are required except for optional image generation (Gemini) and speech-to-text (AssemblyAI).

> **Note:** This project is a fork of [FujiwaraChoki/MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) with a **full web frontend**, improved architecture, and additional features.

---

## ✨ Features

### 🎬 YouTube Shorts Automation
Fully automated short-form video creation and upload pipeline:
- **AI Script Generation** — Ollama generates a spoken script for any niche
- **AI Image Generation** — Gemini (Nano Banana 2) creates visuals from the script
- **Text-to-Speech** — KittenTTS converts the script to natural-sounding audio
- **Subtitle Generation** — Local Whisper or AssemblyAI produces timed SRT subtitles
- **Video Assembly** — MoviePy composites images, audio, subtitles, and background music into a 9:16 Short
- **Auto Upload** — Selenium uploads the finished video to YouTube Studio
- **Scheduling** — Built-in CRON jobs for 1x, 2x, or 3x daily uploads

### 🐦 Twitter/X Bot
Automated tweet generation and posting:
- **AI Tweet Generation** — Ollama writes on-topic tweets in any language
- **Auto Posting** — Selenium posts to X.com using your authenticated Firefox profile
- **Scheduling** — CRON jobs for recurring automated posting
- **Post History** — Full cache of all generated and posted tweets

### 🛒 Affiliate Marketing
Amazon product promotion on autopilot:
- **Product Scraping** — Selenium extracts product titles and features from Amazon
- **AI Pitch Generation** — Ollama writes a compelling promotional pitch
- **Auto Sharing** — Posts the pitch with your affiliate link to Twitter

### 📧 Cold Outreach
Local business discovery and email campaigns:
- **Google Maps Scraping** — Go-based scraper finds businesses by niche and location
- **Email Extraction** — Crawls business websites to find contact emails
- **Automated Emailing** — Sends templated cold-outreach emails via SMTP (Gmail)

### 🖥️ Web Dashboard (New)
Modern dark-themed web UI built with Flask:
- **Dashboard** — Overview of all accounts, products, and model status
- **Account Management** — Create, view, and delete YouTube/Twitter accounts
- **One-Click Actions** — Generate videos, post tweets, run outreach from the browser
- **Background Tasks** — Long-running operations with real-time progress polling
- **Settings Editor** — Edit all configuration values from the UI (sensitive keys are masked)
- **Ollama Model Picker** — Select from available local models without restarting

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Purpose | Required |
|---|---|---|
| [Python 3.12+](https://python.org) | Runtime | Yes |
| [Ollama](https://ollama.com) | Local LLM for text generation | Yes |
| [Firefox](https://firefox.com) | Browser automation (Selenium) | Yes |
| [ImageMagick](https://imagemagick.org) | Subtitle rendering in videos | For YouTube |
| [Go](https://golang.org) | Google Maps scraper compilation | For Outreach only |

### Installation

```bash
# Clone the repository
git clone https://github.com/dylanpersonguy/MoneyPrinterV2.git
cd MoneyPrinterV2

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# .\venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure settings
cp config.example.json config.json
# Edit config.json with your API keys and paths
```

### macOS Quick Setup (Optional)

```bash
bash scripts/setup_local.sh     # Auto-configures Ollama, ImageMagick, Firefox profile
python3 scripts/preflight_local.py  # Validates everything is ready
```

### Pull an Ollama Model

```bash
ollama pull llama3.2:3b         # Or any model you prefer
```

---

## 🖥️ Web UI

The web dashboard provides a full graphical interface to all features:

```bash
source venv/bin/activate
python src/app.py
# Open http://localhost:5000
```

| Page | Description |
|---|---|
| **Dashboard** | Overview cards, model picker, account counts |
| **YouTube Shorts** | Manage accounts, generate videos, upload, view history |
| **Twitter Bot** | Manage accounts, post tweets, view post history |
| **Affiliate Marketing** | Enter Amazon links, select Twitter accounts, auto-pitch |
| **Outreach** | One-click Google Maps scraping + cold email campaign |
| **Settings** | Edit all `config.json` values live (secrets are masked) |

### CLI Mode

The original CLI is still fully functional:

```bash
python src/main.py
```

---

## 🏗️ Architecture

```
MoneyPrinterV2/
├── src/
│   ├── app.py              # Flask web server + REST API (18 endpoints)
│   ├── main.py             # CLI entry point (interactive menu)
│   ├── cron.py             # Headless runner for scheduled jobs
│   ├── llm_provider.py     # Ollama SDK wrapper (generate_text)
│   ├── config.py           # Configuration reader (reads config.json)
│   ├── cache.py            # JSON persistence in .mp/ directory
│   ├── utils.py            # Helpers: temp files, songs, Selenium cleanup
│   ├── constants.py        # Menu labels, Selenium selectors
│   ├── status.py           # Colored terminal output (info, error, success)
│   ├── art.py              # ASCII banner
│   ├── templates/          # Jinja2 HTML templates (web UI)
│   ├── static/             # CSS + JS assets (web UI)
│   └── classes/
│       ├── YouTube.py      # Full YT Shorts pipeline: script → video → upload
│       ├── Twitter.py      # Tweet generation + Selenium posting
│       ├── AFM.py          # Amazon scraping + AI pitch + Twitter share
│       ├── Tts.py          # KittenTTS wrapper
│       └── Outreach.py     # Google Maps scraper + cold email
├── scripts/                # Setup, preflight, upload helpers
├── docs/                   # Feature documentation
├── fonts/                  # Subtitle fonts
├── assets/                 # ASCII banner
├── config.example.json     # Configuration template
└── requirements.txt        # Python dependencies
```

### Data Flow

```
config.json ──→ Settings for all modules
Ollama (local) ──→ Scripts, titles, tweets, pitches, image prompts
Gemini API ──→ AI-generated images (Nano Banana 2)
KittenTTS (local) ──→ Text-to-speech audio (WAV)
Whisper (local) / AssemblyAI ──→ Subtitles (SRT)
MoviePy + ImageMagick ──→ Final video (MP4)
Selenium + Firefox ──→ Upload to YouTube / Post to Twitter
Go scraper + yagmail ──→ Business discovery + cold emails
.mp/ directory ──→ JSON cache (accounts, videos, posts)
```

---

## ⚙️ Configuration

All settings live in `config.json`. Copy from `config.example.json` and fill in your values:

| Key | Description | Default |
|---|---|---|
| `ollama_model` | Ollama model name (e.g. `llama3.2:3b`) | `""` (pick at startup) |
| `ollama_base_url` | Ollama server URL | `http://127.0.0.1:11434` |
| `nanobanana2_api_key` | Gemini API key for image generation | `""` |
| `nanobanana2_model` | Gemini model for images | `gemini-3.1-flash-image-preview` |
| `firefox_profile` | Path to pre-authenticated Firefox profile | `""` |
| `headless` | Run browser in headless mode | `false` |
| `tts_voice` | KittenTTS voice name | `Jasper` |
| `stt_provider` | Subtitle engine: `local_whisper` or `third_party_assemblyai` | `local_whisper` |
| `imagemagick_path` | Path to ImageMagick binary | `/usr/bin/convert` |
| `script_sentence_length` | Number of sentences in generated scripts | `4` |
| `threads` | MoviePy render threads | `2` |
| `email` | SMTP credentials for outreach emails | `{}` |
| `google_maps_scraper_niche` | Business niche for outreach scraping | `""` |

> **Security:** Never commit `config.json` with real API keys. Use environment variables where supported (e.g. `GEMINI_API_KEY`).

See [docs/Configuration.md](docs/Configuration.md) for the full reference.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Language** | Python 3.12 |
| **Web Framework** | Flask |
| **LLM** | Ollama (local, any model) |
| **Image Generation** | Gemini API (Nano Banana 2) |
| **Text-to-Speech** | KittenTTS |
| **Speech-to-Text** | faster-whisper (local) / AssemblyAI |
| **Video Editing** | MoviePy + ImageMagick |
| **Browser Automation** | Selenium + Firefox (GeckoDriver) |
| **Email** | yagmail (SMTP) |
| **Scraping** | google-maps-scraper (Go) |
| **Scheduling** | Python `schedule` library |

---

## 📂 API Endpoints

The web UI communicates through a REST API. All endpoints are available when running `python src/app.py`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/models` | List available Ollama models |
| `POST` | `/api/models/select` | Set active model |
| `GET` | `/api/accounts/<platform>` | List accounts (youtube/twitter) |
| `POST` | `/api/accounts/<platform>` | Create account |
| `DELETE` | `/api/accounts/<platform>/<id>` | Delete account |
| `POST` | `/api/youtube/generate` | Generate a YouTube Short (async) |
| `POST` | `/api/youtube/upload` | Upload video to YouTube (async) |
| `GET` | `/api/youtube/<id>/videos` | List videos for account |
| `POST` | `/api/twitter/post` | Post a tweet (async) |
| `GET` | `/api/twitter/<id>/posts` | List posts for account |
| `POST` | `/api/afm/run` | Run affiliate pitch + share (async) |
| `GET` | `/api/afm/products` | List saved products |
| `POST` | `/api/outreach/start` | Start outreach pipeline (async) |
| `GET` | `/api/tasks/<id>` | Poll background task status |
| `GET` | `/api/config` | Read configuration (masked secrets) |
| `POST` | `/api/config` | Update configuration |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit with [Conventional Commits](https://conventionalcommits.org) (`git commit -m 'feat: add amazing feature'`)
4. Push to your branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request against `main`

See [docs/Roadmap.md](docs/Roadmap.md) for planned features.

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [FujiwaraChoki/MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) — Original project
- [Ollama](https://ollama.com) — Local LLM runtime
- [KittenTTS](https://github.com/KittenML/KittenTTS) — Text-to-speech engine
- [MoviePy](https://zulko.github.io/moviepy/) — Video editing
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — Local speech-to-text

---

## ⚠️ Disclaimer

This project is for **educational purposes only**. The author is not responsible for any misuse of the information or tools provided. All automation should comply with the terms of service of the respective platforms (YouTube, X/Twitter, Amazon, Google Maps). Use responsibly and at your own risk.
