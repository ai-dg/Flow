# JARVIS — AI-Native OS Interface

**Anthropic × Y Combinator Hackathon · 42AI · 24h build**

> One full-screen black canvas. You speak. The AI assembles the UI around you in real time — no windows, no apps, no switching. Think JARVIS from Iron Man.

---

## What This Is

A proof-of-concept for an AI-native OS interface, built as a **demo, not a product** — every decision optimises for judge impact in a 5-minute presentation.

**The scenario:** Alex Dupont, 16, starts their school day. JARVIS already knows their classes, their homework progress, and their teachers. The demo proves the product is real by doing three things a normal OS cannot:

1. **It knows your context** — pre-seeded school data drives the whole session.
2. **It renders adaptive UI** — a different widget for every task type (quiz, lesson, email, overview).
3. **It executes on your behalf** — sends a real email via the Gmail MCP.

You speak; Claude answers two ways at once:

- **Speech** — streamed sentence-by-sentence to an ephemeral ticker and spoken aloud (ElevenLabs), then erased.
- **Canvas** — widgets spawn, despawn, zoom, and highlight on the black canvas, painted in lock-step with the voice.

---

## Quick Start

```bash
npm install

# Local demo only — keys ship to the browser:
printf 'VITE_ANTHROPIC_API_KEY=sk-ant-...\nVITE_ELEVENLABS_API_KEY=...\n' > .env.local

npm run dev   # → http://localhost:5173
```

Use **Chrome or Edge** — the demo relies on Web Audio and (optionally) the Web Speech API.

### Commands

```bash
npm run dev          # Vite dev server on localhost:5173
npm run build        # tsc -b && vite build → dist/
npm run preview      # Preview the production build locally
npm run typecheck    # tsc -b --noEmit
```

### Controls

| Input | Action |
|---|---|
| `Space` (hold) | Push to talk |
| Type in the bottom bar | Text fallback when voice isn't available |
| `Esc` | Clear the canvas |
| `Ctrl`/`Cmd`+`C` | Cancel the AI mid-answer |
| `Alt`+`1` / `2` / `3` | Switch project (History · Maths · English) |
| **Reset Demo** button | Wipe progress and reload fresh demo data |
| **Simulate Voice** button | Advance the demo without speaking (guided fallback) |

---

## Architecture — the single JSON contract

The app is driven by **one streamed JSON object** between Claude and the canvas — **not** AI-SDK tool calling.

`converse.ts` calls `streamText(...)`, pulls the `speech` field out live for the ticker, then `JSON.parse`s the full buffer and mutates the canvas store directly:

```json
{
  "speech": "Loading your view.|Here is the first item.|And the second.",
  "canvas": [
    { "action": "despawn", "id": "*" },
    { "action": "spawn", "type": "text-block", "id": "ctx", "x": 10, "y": 20, "w": 40, "h": 30, "data": { "title": "…", "body": "…" } },
    { "action": "zoom",  "targetId": "ctx", "scale": 1.4 }
  ]
}
```

- `speech` comes **first** and uses `|` to mark segment boundaries. **One segment per canvas action**, played in lock-step: segment *i* is spoken (paced to its ElevenLabs clip duration) while `canvas[i]` paints — voice and UI stay in sync with no gaps.
- `x, y, w, h` are **percentages** of the canvas (plain numbers, no `%`). Reserved zone: `y + h ≤ 74` — the bottom 26% is system UI (tree, controls, orb).
- If Claude ever returns malformed JSON, `converse.ts` falls back to a plain `text-block` widget with the raw text — never a blank screen.

Two secondary formats are also auto-detected: a legacy declarative `widgets` array and a Zod-validated dict-based **dynamic** format.

### The two-agent demo loop

The scripted school demo is **intent-driven, not linear**. Every utterance runs through two independent agents:

- **Agent 1 — Intent Router** (`ai/intentRouter.ts`, fast Haiku) classifies the utterance to a *feature* (`todo-overview`, `qcm`, `lesson`, `mail-compose`, `project-switch`, or `free-form`). A feature spawns pre-authored widgets directly via `demoStore.activateFeature(...)` in **any order**; `free-form` falls through to live Claude.
- **Agent 2 — Progress Tracker** (`ai/progressTracker.ts`, async, never awaited) observes each activation event and marks demo-step IDs complete.

A third agent, the **Lesson Tutor** (`ai/lessonTutor.ts`), owns every in-lesson turn — deepen, reframe, advance, or clarify — and tracks the student's comprehension rather than a fixed beat sequence.

---

## Widgets

Renderers live in `src/widgets/registry.tsx` (all wrapped in `wrapWithAutoSize(...)` for auto-height). Claude emits friendly type names that map to internal `WidgetType` values.

- **Primitives:** `text`, `heading`, `bullets`, `stat`, `card`, `arrow`, `image`, `code`, `math-block`, `email`
- **Rich:** `key-value-card`, `timeline`, `callout`, `comparison-card`
- **School demo:** `TaskList` (homework overview), `QCMWidget` (quiz), `LessonWidget` (interactive lesson + SVG), `MailCompose` (compose + attach + send), `Dialog` (yes/no prompt)

Add one the existing way: extend the `WidgetType` union in `widgets/types.ts`, add a `wrapWithAutoSize(...)` renderer to `registry.tsx`, and add a catalog entry to `ai/systemPrompt.ts` if Claude should be able to spawn it.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 · Vite 7 · TypeScript (strict), `@/` → `src/` |
| Styling | Tailwind CSS v4 — `font-mono`, zinc palette, solid dark fills, 1px borders |
| Animation | Framer Motion v11 |
| AI | Vercel AI SDK v5 (`ai` + `@ai-sdk/anthropic`), browser-side provider — model **`claude-sonnet-4-6`** |
| MCP | Gmail via raw Anthropic Messages API (`mcp_servers`); mock inbox when no key/OAuth |
| TTS | ElevenLabs (`eleven_flash_v2_5`, voice "George") + native `speechSynthesis` fallback |
| STT | Push-to-talk — Whisper (`whisper-tiny.en`, transformers.js in a worker) or Web Speech API |
| State | Zustand — `canvasStore`, `treeStore`, `projectStore`, `demoStore` |
| Persistence | localStorage, key prefix `jarvis_project_` |

---

## Project Structure

```
src/
  App.tsx                  Orchestrator: voice → AI → canvas → tree
  canvas/Canvas.tsx        Full-screen black canvas, camera/zoom, arrow overlay
  widgets/                 types.ts + registry.tsx + every widget component
  ai/
    client.ts              Browser-side Anthropic provider + MODEL
    converse.ts            streamText loop, JSON parse, speech↔canvas sync
    orchestrate.ts         Dispatch for legacy + dynamic dict formats
    systemPrompt.ts        JARVIS persona + widget catalog + project context
    gmailMCP.ts            Gmail MCP server config (+ mock inbox)
    intentRouter.ts        Agent 1 — utterance → feature
    progressTracker.ts     Agent 2 — activation events → demo progress
    lessonTutor.ts         Lesson Tutor — in-lesson comprehension loop
  voice/                   AudioSynthesisService (ElevenLabs) + Whisper/Web Speech STT
  components/              Ticker, ResponseBox, ChatBox, JarvisOrb, DemoControls, …
  projects/                projectStore.ts + schoolData.ts (Alex's seeded day)
  store/                   canvasStore.ts, treeStore.ts, demoStore.ts
.claude/docs/              Deep-dive specs (AI contract, widgets, demo script, …)
CLAUDE.md                  ← Claude Code reads this first.
```

---

## Environment Variables

```
VITE_ANTHROPIC_API_KEY=    # Required — Anthropic API key (client-side, local demo only)
VITE_ELEVENLABS_API_KEY=   # Optional — high-quality TTS; falls back to native speech if absent
```

Both keys ship to the client. This is acceptable **for a local demo only** — never deploy this build publicly with real keys.

---

## See Also

Deep-dive specs live in `.claude/docs/` — `AI_CONTRACT.md`, `WIDGETS.md`, `PROJECTS.md`, `DEMO_SCRIPT.md`, `ANIMATIONS.md`, `SCHOOL_DATA.md`, `BUILD_PLAN.md`.
