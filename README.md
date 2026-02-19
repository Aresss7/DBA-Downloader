# DBA Downloader

A premium desktop video downloader built with Electron, React, and yt-dlp.

## ✨ Features

- 🎬 **Video & Audio** — Download in MP4 or extract audio as MP3
- 📐 **Quality Selection** — Choose from 1080p FHD down to 144p
- ✂️ **Clip Segments** — Trim videos by specifying start and end time
- ❌ **Cancel Downloads** — Stop any download mid-progress
- 📂 **Smart Storage** — Remembers your chosen download folder
- 🔄 **Engine Sync** — One-click yt-dlp update

## 📦 Installation

Download the latest `.exe` from [Releases](../../releases), run the installer, and you're ready to go.

> ⚠️ Windows SmartScreen may show a warning since the app isn't code-signed.  
> Click **"More info"** → **"Run anyway"** — this is safe.

## 🔧 Troubleshooting

If downloads don't start or fail, click the **SYNC** button in the bottom-left corner to update the download engine.

## 🛠 Build from Source

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build .exe installer
npm run build
```

The installer will appear in `release/1.0.0/`.

## ⚙️ Tech Stack

- **Electron** — Desktop framework
- **React + TypeScript** — UI
- **Vite** — Build tool
- **yt-dlp** — Download engine

## 📄 License

MIT
