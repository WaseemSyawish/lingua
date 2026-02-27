# 🇫🇷 Lingua — AI French Language Tutor

An AI-powered French language tutoring application built with Next.js and Claude AI. Features adaptive learning across CEFR levels A0–C2, spaced repetition, conversation practice, and comprehensive progress tracking.

## Features

- **AI Tutor "Amélie"** — Natural French conversation powered by Claude AI with real-time streaming
- **CEFR Curriculum (A0–C2)** — Complete French curriculum with 7 levels, each with vocabulary, grammar, and cultural content
- **Adaptive Learning** — Automatic level assessment and progression based on performance
- **Spaced Repetition** — SM-2 inspired review scheduling for long-term retention
- **Placement Test** — AI-powered placement assessment to determine starting level
- **Session Types** — Lessons, free conversation, and review sessions
- **Progress Tracking** — Skill breakdown, concept mastery, session history, and level timeline
- **Dark Mode** — Full dark mode support

## Tech Stack

- **Framework:** Next.js 16 (Pages Router, TypeScript)
- **AI:** Anthropic Claude API (Haiku for chat, Sonnet for analysis)
- **Database:** PostgreSQL with Prisma 7 ORM
- **Auth:** NextAuth.js v4 (credentials + Google OAuth)
- **Styling:** Tailwind CSS v4
- **Animations:** Motion (Framer Motion)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted, e.g., Railway, Neon, Supabase)
- Anthropic API key

### Setup

1. **Clone and install:**
   ```bash
   cd lingua
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database URL, NextAuth secret, and Anthropic API key.

3. **Generate Prisma client and run migrations:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── components/          # UI components
│   ├── chat/           # Chat interface (MessageBubble, ChatInput, ChatInterface)
│   ├── layout/         # Layout, Navbar, MobileNav
│   └── ui/             # Button, Card, Input, Modal, Toast, Skeleton, EmptyState
├── curriculum/          # CEFR curriculum data
│   ├── levels/         # A0–C2 level definitions
│   └── prompts/        # AI persona and level-specific prompt templates
├── hooks/              # Custom React hooks (useChat)
├── lib/                # Shared utilities (prisma, anthropic, auth, rate-limit)
├── pages/              # Next.js pages
│   ├── api/            # API routes (chat, sessions, placement, progress)
│   ├── auth/           # Sign in / Sign up
│   └── history/        # Session history
├── services/           # Business logic (prompt-builder, conversation-memory)
├── styles/             # Global CSS (Tailwind theme)
└── types/              # TypeScript type definitions
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | App URL (http://localhost:3000 for dev) |
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy — Vercel auto-detects Next.js

The `vercel.json` configures extended timeouts for AI endpoints (chat streaming: 60s, analysis: 30s).

## License

MIT
