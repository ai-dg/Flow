# Demo Script & Mode

Loaded when working on `src/components/DemoControls.tsx`, `src/store/demoStore.ts`,
`src/ai/intentRouter.ts`, `src/ai/progressTracker.ts`, or polishing the demo.

## Overview
The demo is a **school-day scenario** for Alex Dupont, age 16. It is **intent-driven, not a
linear state machine.** Any natural input — spoken (Whisper STT) or typed — is understood and
routed to the right feature. The order no longer matters: the presenter (or a curious judge) can
ask about emails before finishing the QCM, jump straight to the Maths lesson, or ask a free-form
question that has nothing to do with the demo at all.

The demo still **tracks progress**: each scripted feature is a *demo intent*. Whenever an
utterance triggers one — in any order — that intent is marked **completed**. Progress is
`completed / total`, computed from the completion set, never from a position counter.

A **scripted fallback still exists.** The **Simulate-Voice button** at the bottom-center walks a
canonical *guided order* through the intents that aren't done yet, so a presenter can still run
the demo perfectly linearly by clicking — one click triggers the next uncompleted feature. The
button is the presenter's lifeline and must always be visible while any intent is incomplete.

Total runtime: **under 5 minutes**.

### The two ways every feature can fire
| Path | How | Goes through Router? | Order |
|---|---|---|---|
| **Voice / text** | utterance → **Agent 1 (Intent Router)** returns a feature + params → `activateFeature(...)` | **Yes** | **Any order** |
| **Simulate-Voice button** | click → `demoStore.advanceGuided()` → `activateFeature(...)` for the next uncompleted step | **No — bypasses the Router** | Canonical order |

Both paths converge on the same `demoStore.activateFeature(feature, params)` → the feature spawns
its pre-authored widgets directly via `useCanvasStore.getState().spawn(...)` (no Claude call) and
emits an **activation event**, which **Agent 2 (Progress Tracker)** observes to mark demo steps
complete. The scripted button only skips Agent 1; Agent 2 still runs exactly the same.

### Stack note — how the pseudocode below maps to the real code
The `renderWidget({...})` / `ticker.say(...)` calls below are **shorthand**, not real APIs:
- Each feature lives in `demoStore.ts`'s registry (`feature → onActivate`); `activateFeature()`
  runs it and emits an activation event for the Tracker. **Completion is set by the Tracker**, not
  by `activateFeature` — activating a feature and completing a demo step are separate concerns.
- `renderWidget({ id, type, x, y, w, h, data })` → `useCanvasStore.getState().spawn({ … })`.
  `clearCanvas()` → `useCanvasStore.getState().clear()`. Removing one → `despawn(id)`.
- `ticker.say(text)` → push text through the same TTS path as live mode (`AudioSynthesisService`,
  ElevenLabs) and the ResponseBox/Ticker components.
- Widget `type` may use friendly names (`task-list`, `qcm`, …); they resolve to internal
  `WidgetType` via the registry. Scripted demo widgets are spawned directly — not via Claude.
- **Coordinates:** the `y + h ≤ 74` rule is an *AI* constraint. Scripted full-canvas widgets (QCM,
  lesson) may extend lower, but must still clear the bottom strip holding the tree + Simulate-Voice
  button — keep `y + h ≤ 88` and never overlap those controls.

---

## Two agents — Router + Tracker

Every input is handled by **two independent agents**, both called by the main loop
(`App.tsx → handleUtterance`). They **never call each other**: the Router decides *what to do*; the
Tracker observes *what was done*.

```
utterance ─▶ Agent 1: Intent Router ─┬─ feature  ─▶ demoStore.activateFeature(feature, params) ─┐
                                      └─ free-form ─▶ converse()  (live Claude, unchanged)        │
                                                                                       activation event
                                                                                                  ▼
                                                       Agent 2: Demo Progress Tracker (async, never awaited)
                                                       observes the event → marks demo-step IDs complete
                                                       └▶ Simulate-Voice label + step counter read this state
```

**Two axes that never mix:**
- **Features** = what the Router activates: `todo-overview`, `qcm`, `lesson`, `mail-compose`,
  `project-switch`, `free-form`.
- **Demo steps** = what the Tracker completes: `overview`, `history-qcm`, `send-homework`,
  `maths-lesson` (the four below). Progress is independent of routing.

### Agent 1 — Intent Router (`src/ai/intentRouter.ts`)
Runs **first**, before the main AI response, so it must be **fast and small**: a lightweight Haiku
call (`temperature 0`, tiny output) that returns a **structured routing decision**, not prose. It
is given the **current project context + available homeworks** so it can route to a *specific*
homework, not just a type.

```ts
type RoutingDecision =
  | { feature: 'todo-overview' }
  | { feature: 'qcm';            params: { subject: string; homeworkId: string } }
  | { feature: 'lesson';         params: { subject: string; homeworkId: string } }
  | { feature: 'mail-compose';   params: { homeworkId?: string; teacher?: string } }
  | { feature: 'project-switch'; params: { projectId: 'history' | 'maths' | 'english' } }
  | { feature: 'free-form' };
```

- A feature decision → `demoStore.activateFeature(feature, params)` activates it **immediately, in
  any order** — it does **not** wait for the user to be at the "right" step.
- `free-form` (also the safe default on timeout/error/missing-key) → the existing `converse()` loop
  handles it normally. A slow/failed Router never blocks the demo.

### Agent 2 — Demo Progress Tracker (`src/ai/progressTracker.ts`)
Runs **after** every feature activation, **asynchronously** (fire-and-forget — the UI never awaits
it). It compares the activation event against the demo steps below and marks any newly satisfied
step IDs complete in `demoStore.completed`. It **observes only** — it never blocks, never re-routes,
never calls the Router. Default is a deterministic rule table (instant, reliable for the demo); the
async signature lets it become LLM-backed later with no call-site change.

```ts
interface ActivationEvent { feature: string; params?: Record<string, unknown>;
  phase?: 'opened' | 'submitted' | 'sent' | 'mastered' | 'skipped'; }
```

**Activation → step rules (the Tracker's table):**
| Activation event | Marks step complete |
|---|---|
| `todo-overview` opened | `overview` |
| `qcm` (subject history) **submitted** | `history-qcm` |
| `mail-compose` **sent** | `send-homework` |
| `lesson` **mastered** (concepts confirmed) or dialog **skipped** | `maths-lesson` |

The Simulate-Voice button label (`guidedLabel`) and the step counter read **only** this
Tracker-owned state. Re-triggering a feature is idempotent — re-opening the overview re-renders it
and never un-completes a step.

---

## Demo Controls

### Reset Demo Button
- Position: top-right corner
- Style: `rgba(255,255,255,0.08)` background, `rgba(255,255,255,0.15)` border, ~11px monospace
- Label: `↺ Reset Demo`
- Action: `demoStore.reset()` — clears all canvas widgets, **clears the completion set**, reloads
  fresh `schoolData`, clears all project history, and resets the guided cursor to the first intent.
- Visual feedback: ~200ms white edge flash on the canvas border
- Keyboard: `Cmd+Shift+R` / `Ctrl+Shift+R`

### Voice-Simulation Button (scripted fallback — bypasses the Router)
- Position: bottom-center, above the conversation tree strip
- Style: pill, `rgba(255,255,255,0.06)` background, `1px solid rgba(255,255,255,0.12)` border
- Label: the **next uncompleted demo step** in canonical order — e.g. `🎤 "What do I need to do
  today?"`. The label comes from `demoStore.guidedLabel` (Tracker-owned), **not** a fixed step
  sequence: when a step completes out of order (because the presenter spoke it), the button
  automatically skips to the next still-incomplete one.
- On click: `demoStore.advanceGuided()` — **bypasses Agent 1 (the Router)** and directly calls
  `activateFeature(...)` for that step's feature. Agent 2 (the Tracker) then runs as usual on the
  resulting activation event, exactly as it would for a spoken trigger.
- Hidden when all steps are complete (`isComplete === true`), or briefly during step-0 settle.

### Progress Counter
- Position: bottom-right (or under Reset), ~10px monospace, low-alpha
- Format: `2 / 4` — **completed intents / total**, not a position. Reads correctly no matter what
  order features fired in.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Push-to-talk (hold to speak; routed exactly like typed input) |
| `→` | Advance the guided fallback (`advanceGuided()` — same as clicking Simulate-Voice) |
| `Escape` | Clear canvas (does **not** reset progress) |
| `Cmd+Shift+R` | Reset Demo (clears completion set + canvas + data) |

> Note: there is no "previous step" — order is not linear, so back/forward stepping is replaced by
> the guided-forward button and free voice. Re-triggering any intent re-renders it.

---

## The four demo steps (and the features behind them)

Each demo **step** below is a milestone the Tracker can mark complete; each is backed by a **feature**
the Router activates. Either can fire in **any order** (voice/text via the Router) or in canonical
order (Simulate-Voice button). Sub-confirmations ("Yes, send it", "Yes, show me", "Yes, continue")
are **widget-internal interactions** — handled inside the spawned widget, not separate features — so
they stay contextual without constraining order.

| Step ID | Feature activated | Trigger phrase (button label) | Spawns | Tracker marks complete when |
|---|---|---|---|---|
| `overview` | `todo-overview` | `🎤 "What do I need to do today?"` | 3 task-list cards | feature opened |
| `history-qcm` | `qcm` | `🎤 "Let's start the History homework"` | QCM widget | `{ qcm, submitted }` event |
| `send-homework` | `mail-compose` | `🎤 "Could you send this work to my teacher?"` | mail-compose | `{ mail-compose, sent }` event |
| `maths-lesson` | `lesson` | `🎤 "Start the Maths lesson on Pythagoras"` | dialog → lesson | `{ lesson, mastered }` (or dialog "Skip") |

**Canonical guided order** (Simulate-Voice fallback): `overview → history-qcm → send-homework →
maths-lesson`. This is only the button's *suggested* order; the Router ignores it entirely.

**Soft prerequisites are not enforced.** `mail-compose` can be activated before `history-qcm` is
done — the mail is composed from the teacher data in `schoolData` regardless. Order-independence
means the Router never blocks a feature; at most it renders with its default seeded data.

> The per-step detail sections below are headed "Intent `…`" for the step ID; read "Intent" as
> "demo step." Each lists the feature it activates and the activation event that completes it.

---

### Intent `overview` — "What do I need to do today?"

**Button label:** `🎤 "What do I need to do today?"`
**Completes:** immediately on trigger.

**On trigger:**
1. Ticker streams: `"Good morning, Alex. Here's where you're at today."`
2. Three **task-list** widgets spawn with ~80ms stagger (data pulled from the project store, so
   progress is always computed — see `taskWidgetData()` in `demoStore.ts`):

```ts
renderWidget({ id: 'task-history', type: 'task-list', x: 8,  y: 18, w: 26, h: 42,
  data: { subject: 'History', icon: '📚', teacher: 'Ms. Martin',
    tasks: [{ title: 'WW2 — QCM', type: 'qcm', progress: 60, dueLabel: 'Today, 5pm', urgent: true }] } })

renderWidget({ id: 'task-maths', type: 'task-list', x: 37, y: 18, w: 26, h: 42,
  data: { subject: 'Maths', icon: '📐', teacher: 'Mr. Leconte',
    tasks: [{ title: 'Pythagoras Theorem — Lesson', type: 'lesson', progress: 0, dueLabel: 'Tomorrow', urgent: false }] } })

renderWidget({ id: 'task-english', type: 'task-list', x: 66, y: 18, w: 26, h: 42,
  data: { subject: 'English', icon: '📝', teacher: 'Ms. Thompson',
    tasks: [{ title: 'The Great Gatsby — Essay', type: 'essay', progress: 100, dueLabel: 'Submitted ✓', urgent: false }] } })
```

---

### Intent `history-qcm` — "Let's start the History homework"

**Button label:** `🎤 "Let's start the History homework we started yesterday"`
**Completes:** when the student submits → `demoStore.onQCMComplete(answers)`.

**On trigger:**
1. `setActiveProject('history')` — clears canvas, scan-line wipe (ANIMATIONS.md), label → `HISTORY`
2. Ticker streams: `"Picking up where you left off. Question 4 of 7."`
3. QCM widget spawns (questions/answers pulled from `schoolData`, so `startAtQuestion` reflects
   real saved progress):

```ts
renderWidget({
  id: 'qcm-ww2', type: 'qcm', x: 12, y: 12, w: 76, h: 76,
  data: {
    subject: 'World War 2',
    totalQuestions: 7,
    startAtQuestion: 3,                  // 0-indexed → Q4 (Q1–3 pre-answered)
    preAnswered: { 0: 1, 1: 2, 2: 0 },
    questions: [ /* … see SCHOOL_DATA.md … */ ]
  }
})
```

**Student interacts:** clicks Q4 → Q7; each answer flashes green/red. On Q7 a Submit appears.
**On Submit:** `onQCMComplete(answers)` persists answers to `schoolData` and marks `history-qcm`
complete. QCM progress = `answeredCount / totalQuestions * 100`.

---

### Intent `send-homework` — "Could you send this work to my teacher?"

**Button label:** `🎤 "Could you send this work to my teacher?"`
**Completes:** when the in-widget Send (and its confirm) fires → `demoStore.onMailSent()`.

**On trigger:**
1. Ticker streams: `"Preparing your submission for Ms. Martin. Ready to send — shall I go ahead?"`
2. mail-compose spawns, pre-filled from the active teacher data:

```ts
renderWidget({
  id: 'mail-compose', type: 'mail-compose', x: 22, y: 12, w: 56, h: 60,
  data: {
    to: { name: 'Ms. Martin', email: 's.martin@lycee-victor.fr' },
    subject: 'WW2 QCM — Alex Dupont',
    body: 'Dear Ms. Martin,\n\nPlease find attached my completed QCM on World War 2.\nAll 7 questions answered.\n\nBest regards,\nAlex',
    attachments: [{ name: 'WW2_QCM_Alex_Dupont.pdf', type: 'qcm', sourceWidgetId: 'qcm-ww2' }],
    readyToSend: true
  }
})
```

**Confirmation is widget-internal.** The "Yes, send it" beat is **not** a separate global intent —
the user confirms by pressing the widget's Send button (or saying "yes, send it" while the compose
widget is focused, handled by the widget). On Send:
1. Gmail MCP `send_email` fires best-effort (AI_CONTRACT.md). On failure, still play the sent
   animation — the visual is what matters.
2. mail-compose plays its sent animation (✓, then fade) and calls `onMailSent()`.
3. Ticker: `"Sent. Ms. Martin will receive it shortly. Your WW2 QCM has been submitted."`

---

### Intent `maths-lesson` — "Start the Maths lesson on Pythagoras"

**Button label:** `🎤 "Let's start the Maths lesson on Pythagoras"`
**Completes:** when the lesson reaches its final beat (or the dialog's "Skip" is chosen).

**On trigger:**
1. `setActiveProject('maths')` — clears canvas, scan-line wipe, label → `MATHS`
2. Ticker streams: `"Starting Pythagoras Theorem. Want a quick visual walkthrough first?"`
3. Confirmation **dialog** spawns:

```ts
renderWidget({
  id: 'maths-dialog', type: 'dialog', x: 28, y: 30, w: 44, h: 30,
  data: {
    title: 'Pythagoras Theorem', icon: '📐',
    body: 'Want a quick visual walkthrough of the theorem before we begin?',
    actions: [
      { label: 'Skip',          action: 'skip-lesson' },
      { label: 'Yes, show me',  action: 'start-lesson', primary: true }
    ]
  }
})
```

**The "Yes, show me" / "Skip" choice is widget-internal** — `Dialog` calls
`demoStore.handleDialogAction(action)`:
- `start-lesson` → despawn dialog, spawn the full-canvas **lesson** widget (centrepiece).
- `skip-lesson` → ticker `"No problem — the lesson is saved to your Maths folder."`; intent still
  marks complete (the student chose to skip).

**The lesson is a conversational tutor.** Once spawned, it delivers its ideas (triangle → name a →
name b → hypotenuse c → the relationship → equation `a² + b² = c²`) **one idea at a time**, pausing
after each for the student. While the widget is live, **every** student turn → `lessonRespond()` →
the **Lesson Tutor** (`src/ai/lessonTutor.ts`), which picks one of **four** responses:
- **deepen** — a follow-up / "more detail": go deeper on the same concept with a *different*
  representation than last time.
- **reframe** — confusion ("I don't get it"): same concept, completely different angle, acknowledging
  the confusion ("Let me try a different way."). Status → `confused`.
- **advance** — a clear "yes / I understand": brief validation, then the next idea is introduced
  (`stepLessonIdea()`). Status → `confirmed` (shown in the panel's "Understood" checklist).
- **clarify** — a vague "ok" / silence (a **weak signal**): ask one focused question before moving on.
  Affirmations are **never** auto-advanced.

It uses the **comprehension state** (`demoStore.comprehension`: per-concept status + approaches already
used + sub-questions) for cross-turn context. The state is session-only and is cleared when the Intent
Router signals a topic switch (`signalsTopicSwitch`). The OK button advances explicitly. See
AI_CONTRACT.md → Lesson Tutor.

The full idea data (with each idea's `concept`/`reframe`/`deepen`) lives in `schoolData.ts` /
WIDGETS.md → `lesson`. On the final (equation) idea: a "Lesson complete" badge animates in and
`maths-lesson` is marked complete.

**Closing line (presenter, verbal):**
> *"They grew up on TikTok. They don't know what a file is. They don't need to."*

---

## Free-form / off-script input

Because routing is intent-based, **any** utterance that doesn't map to an intent or a project
switch goes straight to live Claude via `converse()`. A judge can ask "what's the weather on D-Day?"
or "summarise the Treaty of Versailles" mid-demo and get a real `{ speech, canvas }` answer — then
return to the scripted features at will. This is the headline behaviour the new design unlocks:
**the demo is no longer a rail; it's an assistant that also happens to have a guided path.**

---

## Demo Failure Recovery

If a live-AI call errors:
1. `converse.ts` already spawns a fallback `text-block` with the raw text — canvas is never blank.
2. The scripted intents never depend on Claude — their widgets are pre-authored, so the
   Simulate-Voice button (`advanceGuided()`) always works even with no API key.
3. If the **semantic classifier** is slow/unavailable, routing silently falls back to the fast
   word-overlap path, then to live Claude — never a hang, never an error state.

**Never say "the API is down."** Scripted states are indistinguishable from live calls.

---

## Timing Guide (canonical guided run)

| Intent | Action | Duration | Cumulative |
|---|---|---|---|
| — | Black screen | 5s | 0:05 |
| `overview` | Task overview | 25s | 0:30 |
| `history-qcm` | QCM (complete Q4–Q7 + submit) | 60s | 1:30 |
| `send-homework` | Mail compose + send confirm | 30s | 2:00 |
| `maths-lesson` | Dialog + Pythagoras concept walkthrough (6 concepts) | 100s | 3:40 |
| — | Closing line | 20s | 4:00 |

**Target: under 4 minutes.** Voice-driven runs may take features out of order; the timing above is
just the canonical guided path. If running long, the QCM can be answered in 2 questions instead of 4.
</content>
