# Hafaza PWA

**Offline-first Quran Memorization PWA with Voice Verification**

A Progressive Web App that helps users memorize the Quran through spaced repetition and voice-based recitation verification — all running 100% offline on the user's device after initial install.

## Features

### Phase 1 (Complete)
- **Full Quran Text** — All 6,236 ayahs with diacritical marks (tashkeel), sourced from [mengkaji](https://github.com/eimjad/mengkaji)
- **Memorization Tracking** — Mark ayahs as memorized, track progress per surah
- **Spaced Repetition (SM-2)** — Intelligent review scheduling based on SuperMemo algorithm
- **Offline-First** — Service Worker caches entire app + data (~5MB) for offline use
- **Daily Streak** — Track consecutive days of practice
- **Arabic-First UI** — RTL interface designed for Arabic content

### Phase 2 (Architecture Ready)
- **Voice Verification** — Record recitation, transcribe via Whisper (WASM), compare with original
- **Word-by-Word Comparison** — Fuzzy matching with Levenshtein distance for Arabic text
- **Offline AI Model** — Whisper model cached in IndexedDB after first download (~42-250MB)
- **No Server Required** — All processing happens on-device

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    HAFAZA PWA                         │
├─────────────────────────────────────────────────────┤
│  index.html          — App shell (single page)       │
│  css/app.css         — UI styles (dark theme, RTL)   │
│  js/db.js            — IndexedDB persistence layer   │
│  js/quran.js         — Quran data loading + compare  │
│  js/memorization.js  — SM-2 spaced repetition       │
│  js/voice.js         — Whisper WASM integration     │
│  js/app.js           — UI controller                │
│  sw.js               — Service Worker (offline)     │
│  data/               — Quran JSON data (~2.3 MB)    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Pure HTML/CSS/JS** — Zero framework dependencies
- **IndexedDB** — Persistent local storage for progress
- **Service Worker** — Full offline capability
- **Web Audio API** — Microphone capture
- **Transformers.js** — Client-side Whisper inference (Phase 2)

## Getting Started

### Local Development
```bash
# Serve with any static server
npx serve .

# Or use Python
python3 -m http.server 8000
```

### Generate Icons
1. Open `icons/generate-icons.html` in a browser
2. Right-click the canvases and save as `icon-192.png` and `icon-512.png`

### Deployment
Deploy to any static hosting with HTTPS:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

> **Important:** For voice verification (Phase 2), the server must set these headers:
> ```
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: require-corp
> ```
> These enable SharedArrayBuffer needed for WebAssembly multi-threading.

## Data Source

Quran text data is sourced from the [mengkaji](https://github.com/eimjad/mengkaji) repository:
- Arabic text with full diacritical marks (Uthmani script)
- Plain Arabic text (for comparison/matching)
- 114 surahs, 6,236 ayahs

## Voice Verification (Phase 2 Details)

The voice verification system uses:
1. **Capture**: Web Audio API + MediaRecorder → audio blob
2. **Transcribe**: Whisper model via Transformers.js (runs in WebAssembly)
3. **Compare**: Normalized Arabic text comparison with fuzzy matching

### Model Options
| Model | Size | Accuracy | Speed |
|-------|------|----------|-------|
| whisper-tiny | ~42 MB | Good for common surahs | Fast |
| whisper-small | ~250 MB | Better Arabic accuracy | Moderate |
| whisper-small-quran (fine-tuned) | ~250 MB | Best for Quran | Moderate |

### Offline Flow
1. First launch: Downloads Whisper model from HuggingFace CDN
2. Model cached in IndexedDB
3. All subsequent usage: 100% offline

## Storage Usage

| Component | Size |
|-----------|------|
| App shell + CSS/JS | ~50 KB |
| Quran data (JSON) | ~2.3 MB |
| Whisper tiny model | ~42 MB |
| Whisper small model | ~250 MB |
| User progress data | < 1 MB |
| **Total (with tiny)** | **~45 MB** |

## License

App code: MIT
Quran text data: Public domain (Word of Allah)
