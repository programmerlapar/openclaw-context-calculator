# OpenClaw Context & Auto-Compaction Calculator

**Estimate whether your OpenClaw local LLM session fits inside your LM Studio context budget and how likely auto-compaction is to recover it.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/deployed-GitHub%20Pages-22272e?logo=github)](https://firmanjs.github.io/openclaw-context-calculator/)
[![Vite](https://img.shields.io/badge/built%20with-Vite-646cff?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://reactjs.org/)

---

## 🇺🇸 What is this?

A free, offline-first web app (no network required) that helps you estimate the real usable context budget for **OpenClaw** sessions running through **LM Studio**. No data leaves your machine — everything runs in your browser.

### Who is this for?

- **Local LLM users** running OpenClaw with LM Studio, Ollama, or any OpenAI-compatible local backend
- **OpenClaw power users** who push context limits with tools, skills, memory, and multi-turn conversations
- **AI tinkerers** optimizing their openclaw.json config for stable session performance

### Key calculations

| What it calculates | Description |
|--------------------|-------------|
| Runtime context limit | min(LM Studio context, OpenClaw contextTokens) |
| Usable prompt budget | Runtime limit minus reserve and overhead |
| Current overflow | How much the prompt exceeds the budget |
| Post-compaction overflow | Whether it fits after OpenClaw safeguard compaction |
| Success rate | Estimated % confidence the session will not fail |
| Recommended settings | Ready-to-use openclaw.json JSON snippet |

---

## 🚀 Live Demo

**👉 [https://firmanjs.github.io/openclaw-context-calculator/](https://firmanjs.github.io/openclaw-context-calculator/)**

No installation, no sign-up, no data collection. Just open and use.

---

## 🧮 How the calculator works

1. **Runtime limit** = min(LM Studio context, OpenClaw contextTokens)
2. **Usable budget** = runtime limit - reserve - overhead
3. **Current overflow** = estimated prompt - usable budget
4. **Compacted size** = max(keepRecentTokens, prompt × compaction ratio)
5. **Post-compaction overflow** = compacted size - usable budget

**Success rate** ranges from 1% (likely fail) to 99% (very safe) based on headroom and overflow margins.

---

## ⚙️ Auto-Compaction in OpenClaw

OpenClaw uses **safeguard mode** (compaction.mode: safeguard). When nearing the context limit, it calls a summarizer LLM to condense old transcript, keeps keepRecentTokens intact, and reserves eserveTokens for output. This calculator approximates that with a **compaction ratio** (default 0.55). Real results depend on summarizer quality, session length, active tools, and memory.

> **Note:** OpenClaw does **not** use a "compaction ratio" field. The ratio above is a rough estimation of how much the summarizer might shrink your session. Configure your actual compaction.model under the summarizer section in openclaw.json.

---

## 🎯 Presets

| Preset | Context | Reserve | Max Tokens | Use case |
|--------|---------|---------|------------|----------|
| Local safe default | 65,536 | 4,096 | 2,048 | Safe start for 7B-8B models |
| Tight budget | 61,265 | 16,384 | 2,048 | Squeezing tokens, higher risk |
| Large context | 128,000 | 12,000 | 4,096 | Bigger models (32B+) |

---

## 🤖 Auto mode

Toggle **Auto** to auto-fill all fields from your LM Studio context length alone — a perfect starting point before manual fine-tuning.

---

## 🛠 Run locally

`ash
git clone https://github.com/firmanjs/openclaw-context-calculator.git
cd openclaw-context-calculator
npm install
npm run start
`

Open [http://localhost:5173](http://localhost:5173). The app is fully client-side with zero telemetry, no API calls, and no backend.

### Production build

`ash
npm run build
`

Output goes to dist/. Deploy to any static host.

---

## 🌐 Deploy to GitHub Pages

This project includes a **GitHub Actions workflow** that automatically builds and deploys to GitHub Pages on every push to the main branch. To enable:

1. Push this repo to GitHub (irmanjs/openclaw-context-calculator)
2. Go to **Settings > Pages** and set Source to **GitHub Actions**
3. The site will be live at https://firmanjs.github.io/openclaw-context-calculator/

No gh-pages branch needed — the workflow handles everything.

---

## 📦 Tech stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 |
| Build tool | Vite 5 |
| Icons | lucide-react |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

## 🔍 SEO keywords

OpenClaw, LM Studio, context calculator, auto-compaction, LLM, local AI, token budget, safeguard mode, OpenClaw context tokens, local LLM session, token calculator, LLM context limit, AI compaction, openclaw.json, LLM session optimization
