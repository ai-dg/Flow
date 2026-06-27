# JARVIS — AI-Native OS Interface
**Anthropic × Y Combinator Hackathon | 42AI | 24h**

> One black screen. You speak. The AI assembles the UI around you in real time.

---

## Quick Start

```bash
npm install
# Add your Anthropic API key (local demo only — key ships to the browser):
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
# → http://localhost:5173
```

Use **Chrome or Edge** — the demo relies on the Web Speech API.

**Controls:**
- `Space` (hold) — push to talk
- `Esc` — clear the canvas
- Click a node on the left rail — time-travel to a previous canvas state

---

## What This Is

A proof-of-concept for an AI-native OS interface. The user speaks; Claude responds two ways at once:
1. **Speech** — streamed sentence-by-sentence to an ephemeral ticker and spoken aloud, then erased.
2. **Canvas actions** — tool calls that spawn / remove / zoom / highlight widgets on a black canvas.

No static UI. No windows. No apps. The interface is assembled in real time by the AI.

---

## How the AI drives the UI

Instead of a JSON contract, Claude uses **tool calling** (Vercel AI SDK). The tools run
client-side and mutate the canvas store directly, so widgets appear live while the AI keeps talking:

| Tool | Effect |
|---|---|
| `renderWidget` | spawn/update a widget (`type`, `x/y/w/h` %, `data`) |
| `removeWidget` | remove a widget by id |
| `zoomWidget` | scale a widget for emphasis |
| `setOpacity` | fade a widget in/out |
| `highlightWidget` | spotlight one widget, dim the rest |
| `clearCanvas` | reset the canvas on topic change |

The widget databank lives in `src/widgets/registry.tsx`: `heading`, `text`, `bullets`,
`stat`, `card`, `arrow`, `image`, `code`, `email`.

---

## Project Structure

```
src/
  App.tsx              Orchestrator: voice ↔ AI ↔ canvas ↔ tree
  canvas/Canvas.tsx    Full-screen black canvas, camera zoom, widget layout
  widgets/             types.ts + registry.tsx (the widget databank)
  ai/
    client.ts          Browser-side Anthropic provider
    tools.ts           UI tools (client-side execute → canvas store)
    systemPrompt.ts    JARVIS persona + widget catalog
    converse.ts        streamText loop, sentence detection
  voice/useSpeech.ts   Web Speech API: recognition + synthesis
  components/Ticker.tsx Ephemeral spoken-sentence display
  tree/                ConversationTree.tsx — git-like snapshot rail
  store/               canvasStore.ts, treeStore.ts (Zustand)
.claude/
  vision.md, scope.md  Project intent and boundaries
CLAUDE.md              ← Claude Code reads this first.
```

---

## Gmail action (demo)

When you ask about email, Claude renders `email` widgets with realistic **mocked** data.
Real Gmail MCP / OAuth wiring is intentionally out of scope for the 24h prototype — see `.claude/scope.md`.

---

## Environment Variables

```
VITE_ANTHROPIC_API_KEY=   # Required — Anthropic API key (client-side, local demo only)
```

---

## Stack

Vite · React 18 · TypeScript · Tailwind v4 · Vercel AI SDK (`@ai-sdk/anthropic`) · Zustand · Framer Motion
