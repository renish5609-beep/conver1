# Conver — AI Conversation Intelligence

AI-powered platform that analyzes how you communicate. Evaluates clarity, confidence, and persuasion, then delivers actionable feedback and improved responses to help you perform better in interviews, pitches, debates, and everyday conversations.

## Stack

- **Backend**: Node.js + Express (API proxy — keeps your key server-side)
- **Frontend**: Vanilla HTML/CSS/JS (no build step needed)
- **AI**: Claude (claude-sonnet-4-20250514) via Anthropic API

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
```

Get a key at [console.anthropic.com](https://console.anthropic.com).

### 3. Run it

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploy to Railway (recommended — free tier available)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add `ANTHROPIC_API_KEY` as an environment variable in Railway's dashboard
4. Done — Railway auto-detects Node and runs `npm start`

## Deploy to Render

1. Push to GitHub
2. New Web Service → connect repo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add `ANTHROPIC_API_KEY` environment variable

## Deploy to Fly.io

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

---

## Features

- **Practice Lab** — Submit a response draft, get scored on Clarity / Confidence / Persuasion with specific strengths, improvements, and a rewritten stronger version
- **AI Companion** — Live chat with your selected AI coach
- **Briefing** — Set session context that feeds into all AI responses
- **AI Profiles** — 6 coaches: Blaze, Echo, Sage, Nova, Rex, Luna
- **Insights** — Score trends and session breakdown
- **History** — Full session log
