# Build Plan — School Demo Implementation

Read this before writing any code. This is the implementation order for the JARVIS school demo.
Build in this sequence — each phase leaves the demo in a runnable state.

> **Stack note (read first).** React 18 + Vite + TS, **Zustand** stores (`canvasStore`,
> `treeStore`, `projectStore`, new `demoStore`), **Tailwind v4** + **Framer Motion** for UI,
> **Vercel AI SDK `streamText`** with the single-JSON `{ speech, canvas }` contract (NOT tool
> calling — there is **no** `tools.ts`). Voice = ElevenLabs TTS + Whisper/WebSpeech STT. Import
> with the `@/` alias. Scripted steps drive `useCanvasStore.getState().spawn(...)` directly via
> `demoStore`; only live free-form turns go through `converse()`. Store methods: `spawn`,
> `despawn`, `clear`, `zoomCamera` (there is no `clearAll` — it's `clear`).

---

## Phase 0 — Data Foundation
*Build first. Everything else depends on this.*

**Files to create/modify:**
1. `src/projects/schoolData.ts` — create from scratch using SCHOOL_DATA.md and PROJECTS.md spec
   - `Teacher`, `Homework`, `QCMData`, `LessonData`, `EssayData`, `SchoolProject` interfaces
   - `createDefaultSchoolData()` — returns the 3 pre-seeded projects (history/maths/english)
   - `computeProgress(homework)` — computes 0–100 based on homework type
   - Export everything

2. `src/store/demoStore.ts` — create Zustand store: a **feature registry + Tracker-owned progress**
   (order-independent — NOT a linear `currentStep` machine). The store owns the canvas-spawning side
   (features); the two agents live in `src/ai/` (see Phase 3/5).
   ```ts
   interface FeatureDef {                       // a capability the Router can activate
     id: string                  // 'todo-overview' | 'qcm' | 'lesson' | 'mail-compose' | 'project-switch'
     onActivate: (params?: Record<string, unknown>) => void   // spawn this feature's widgets
   }
   interface GuidedStep {                       // canonical order for the Simulate-Voice fallback
     stepId: string              // 'overview' | 'history-qcm' | 'send-homework' | 'maths-lesson'
     label: string               // 🎤 phrase shown on the button
     feature: string; params?: Record<string, unknown>        // what the button activates
   }
   interface DemoStore {
     features: Record<string, FeatureDef>           // registry, keyed by feature id
     guided: GuidedStep[]                           // canonical fallback order
     completed: Set<string>                         // demo-step IDs — written ONLY by the Tracker
     guidedLabel: string | null                     // next uncompleted step's label
     isComplete: boolean                            // all demo steps done
     progress: () => number                         // completed / total
     activateFeature: (feature: string, params?: Record<string, unknown>) => void  // Router + button
     advanceGuided: () => void                      // Simulate-Voice → activateFeature(next uncompleted)
     markCompleted: (stepIds: string[]) => void     // Tracker calls this
     reset: () => void                              // clear completion set + canvas + data
     onQCMComplete: (answers: Record<number, number>) => void   // emits { qcm, submitted } to Tracker
     onMailSent: () => void                                      // emits { mail-compose, sent }
     handleDialogAction: (action: string) => void               // lesson start/skip (widget-internal)
   }
   ```

3. `src/projects/projectStore.ts` — update (or create if not yet built):
   - Replace generic email/code/hackathon projects with `createDefaultSchoolData()`
   - Add `updateHomeworkData(projectId, homeworkId, patch)` method
   - Add `reset()` that calls `createDefaultSchoolData()` and clears history/canvas/tree

**Verify:** `computeProgress` returns 60 for history QCM (3/7 answered), 0 for maths lesson, 100 for english essay.

---

## Phase 1 — Demo Controls
*The Reset Demo button and voice simulation button. Must work before any content.*

**Files to create/modify:**
1. `src/components/DemoControls.tsx` — new component, renders two elements:

   **Reset Demo button** (top-right of canvas):
   ```tsx
   <button
     className="reset-demo-btn"
     onClick={() => demoStore.reset()}   {/* reset() clears the completion set + canvas + data */}
   >
     ↺ Reset Demo
   </button>
   ```
   Style: `position: absolute; top: 16px; right: 16px; z-index: 200`
   On click: flash canvas border (see ANIMATIONS.md → Reset Demo Flash), then call both stores' reset.
   Keyboard: `Cmd+Shift+R` / `Ctrl+Shift+R`

   **Simulate-Voice button** (bottom-center, above tree strip) — the scripted fallback:
   ```tsx
   <button
     className="voice-sim-btn"
     onClick={() => demoStore.advanceGuided()}
   >
     {demoStore.guidedLabel}
   </button>
   ```
   Style: `position: absolute; bottom: 96px; left: 50%; transform: translateX(-50%); z-index: 200`
   Hidden 1s after load (fade in) and once `isComplete` (all intents done).

   **Progress counter** (bottom-right) — completed / total, not a position:
   ```tsx
   <span className="step-counter">{completedCount} / {totalIntents}</span>
   ```

2. Wire `DemoControls` into `Canvas.tsx` or `App.tsx` at root level.

**Verify:** Clicking Reset restores black canvas. Simulate-Voice button shows `🎤 "What do I need to do today?"`. Progress counter shows `0 / 4`.

---

## Phase 2 — Widget Types (new)
*Build all 5 new widget types as standalone components. Test each in isolation.*

### 2a — `TaskList.tsx`
Build from WIDGETS.md → `task-list` spec.
- Progress bar fills from 0 on spawn (use a `useEffect` with a 50ms delay to trigger CSS transition)
- Urgent due label in amber `#f59e0b`
- 100% task: green progress bar `#34d399`, checkmark suffix on due label

### 2b — `QCMWidget.tsx`
Build from WIDGETS.md → `qcm` spec.
- Internal state: `currentIndex`, `selectedAnswer`, `confirmedAnswers` (seeded from `preAnswered`)
- Start at `startAtQuestion` on mount
- Feedback: correct = green border/bg, wrong = red + also show correct in green
- Navigation: Prev/Next, Next → Submit on last question
- On Submit: call `demoStore.onQCMComplete(confirmedAnswers)`
- Progress bar in header updates as student answers

### 2c — `LessonWidget.tsx`
Build from WIDGETS.md → `lesson` spec. This is the most complex component.

Split into sub-components:
- `LessonSVGCanvas.tsx` — SVG drawing area, takes current beat and renders accordingly
- `LessonNarration.tsx` — right panel, shows instruction text + OK prompt

SVG drawing:
- Maintain a list of "drawn elements" in component state
- Each beat adds to this list — shapes accumulate, they don't replace each other
- Use `stroke-dashoffset` animation via CSS transitions (set `strokeDasharray` + `strokeDashoffset` then transition to 0)
- For highlights: keep a `highlightedSegment` state, render duplicate path with glow filter

Beat advancement:
- Beats are widget-internal: they advance only when the OK button is clicked (or `→`), independent
  of the intent router
- After OK: save new `currentBeat` to `projectStore.updateHomeworkData()`
- On final beat (equation): no OK — show "Lesson complete" badge, call nothing

### 2d — `MailCompose.tsx`
Build from WIDGETS.md → `mail-compose` spec.
- Body is a `<textarea>` — editable for realism
- Attachment pills are display-only
- On Send: play sent animation (see ANIMATIONS.md), then call `demoStore.onMailSent()`
- Gmail MCP call is best-effort (see AI_CONTRACT.md)

### 2e — `Dialog.tsx`
Simple. Build from WIDGETS.md → `dialog` spec.
- On action click: call `demoStore.handleDialogAction(action)`, then self-despawn

### Register all new types:
In `src/widgets/types.ts`, add to `WidgetType` union.
In `src/widgets/registry.tsx`, add cases for each new type.

**Verify:** Render each widget in isolation with mock data. Check animations fire.

---

## Phase 3 — Feature Registry + the Two Agents
*Wire the feature registry, the Router (Agent 1), and the Tracker (Agent 2). NOT a linear sequence.*
See AI_CONTRACT.md → *Two-Agent Architecture* for the full spec.

**3a. Feature registry** (`src/store/demoStore.ts`) — each `onActivate` spawns pre-authored widgets:

```ts
const FEATURES: Record<string, FeatureDef> = {
  'todo-overview': { id: 'todo-overview', onActivate: () => {
      ticker.say("Good morning, Alex. Here's where you're at today.")
      // Spawn 3 task-list widgets, 80ms stagger — see DEMO_SCRIPT.md
  }},
  'qcm': { id: 'qcm', onActivate: (p) => {
      projectStore.setActiveProject(p.subject)   // clears canvas + scan-line wipe
      // Spawn qcm widget for p.homeworkId — see DEMO_SCRIPT.md
  }},
  // ... 'lesson', 'mail-compose', 'project-switch'
}

// Canonical order for the Simulate-Voice fallback button only:
const GUIDED: GuidedStep[] = [
  { stepId: 'overview',      label: '🎤 "What do I need to do today?"',        feature: 'todo-overview' },
  { stepId: 'history-qcm',   label: '🎤 "Let\'s start the History homework"',   feature: 'qcm',  params: { subject: 'history', homeworkId: 'hw-ww2-qcm' } },
  // ... send-homework, maths-lesson
]
```

`activateFeature(feature, params)`: looks up `FEATURES[feature]`, runs `onActivate(params)`, then
**emits an `ActivationEvent` to the Tracker** (Agent 2) — it does NOT set completion itself.
`advanceGuided()`: next uncompleted `GUIDED` step → `activateFeature(step.feature, step.params)`
(bypasses the Router). `markCompleted(stepIds)`: union into `completed`, recompute `guidedLabel` +
`isComplete`. `reset()`: empty `completed`, `projectStore.reset()`, `guidedLabel` = first step.

**3b. Agent 1 — Intent Router** (`src/ai/intentRouter.ts`, also see Phase 5). `routeIntent(text,
ctx)` → `RoutingDecision`. Wired in `App.tsx → handleUtterance`:
1. `const decision = await routeIntent(text, { activeProjectId, homeworks })`
2. `decision.feature !== 'free-form'` → `demoStore.activateFeature(decision.feature, decision.params)`
3. else → `converse()` (live Claude). On timeout/error the safe default is `free-form`.

**3c. Agent 2 — Demo Progress Tracker** (`src/ai/progressTracker.ts`). `trackActivation(event,
completed)` runs **async, not awaited**, after every activation (both Router path and the scripted
button). It applies the activation→step rule table and calls `demoStore.markCompleted(...)`:
- `todo-overview` opened → `overview`
- `qcm` + `subject: history` + `submitted` → `history-qcm`  *(emitted by `onQCMComplete`)*
- `mail-compose` + `sent` → `send-homework`  *(emitted by `onMailSent`)*
- `lesson` + `final-beat` (or dialog `skipped`) → `maths-lesson`

**Verify:** Saying the phrases **out of order** (maths-lesson before history-qcm) activates the
right feature each time; the counter rises to `4 / 4` regardless of order. A free-form question
("who won WW2?") routes to live Claude and the Tracker leaves `completed` untouched. The scripted
button advances correctly even with the Router disabled (no API key).

---

## Phase 4 — Scan-line Wipe & Project Switch
*Wire the transition used in Steps 2 and 4.*

In `src/components/` (or `src/canvas/`), implement `ScanLine.tsx`:
- Animated `<div>` that sweeps top to bottom when triggered
- Controlled by a `scanlineActive` boolean in canvas store or local state
- After scan completes: callback fires to load new project's content

In `projectStore.setActiveProject(id)`:
1. Save current project state
2. Trigger scan-line animation
3. After 400ms: update `activeProjectId`, update system prompt context
4. After 450ms: spawn new project's `canvasState` widgets with stagger
5. After 500ms: update project label

**Verify:** Pressing `Cmd+1`/`Cmd+2`/`Cmd+3` triggers clean scan-line wipe.

---

## Phase 5 — System Prompt & Contract Integration
*Wire schoolData into the AI layer. There is NO `tools.ts` — Claude drives the canvas through the
`{ speech, canvas }` JSON contract (see AI_CONTRACT.md).*

In `src/projects/projectStore.ts`:
- `getActiveContext()` returns the active class + teacher (name/email) + homework with
  `computeProgress()` — this is what `converse.ts` passes to `buildSystemPrompt(...)`.
- Also expose the active project id + the available homeworks (`id`, `subject`, `type`, `title`) to
  **Agent 1 (the Router)** so it can route to a *specific* homework, not just a type.

In `src/ai/systemPrompt.ts`:
- Confirm `buildSystemPrompt(projectContext?)` appends the project context.
- Add catalog entries (friendly type name, `data` schema, size guide, example) for any new widget
  Claude is allowed to spawn live (`task-list`, `qcm`, `mail-compose`, …). Demo-only widgets that
  are spawned solely by `demoStore` don't strictly need a catalog entry.

In `src/ai/converse.ts` / `src/ai/orchestrate.ts`:
- Ensure the friendly→internal type maps (`SYNC_TYPE_MAP` / `TYPE_MAP`) include the new widget
  type names so `{ speech, canvas }` spawns resolve correctly.

In `src/ai/intentRouter.ts` (**Agent 1** — see AI_CONTRACT.md):
- `routeIntent(utterance, ctx)` returns a structured `RoutingDecision` (`{ feature, params }` or
  `{ feature: 'free-form' }`) from one fast Haiku call. Hard timeout + safe `free-form` default so a
  slow/failed call never blocks routing — it just falls through to live Claude.

In `src/ai/progressTracker.ts` (**Agent 2** — see AI_CONTRACT.md):
- `trackActivation(event, completed)` maps an activation event to demo-step IDs (deterministic rule
  table) and calls `demoStore.markCompleted(...)`. Runs async, never awaited by the UI.

Project switching is now a Router **feature** (`project-switch`), activated via
`projectStore.setActiveProject(id)` (Phase 4) — not a separate AI tool.

**Verify:** Ask Claude "what do I have to do today?" in live mode → it returns a `{ speech, canvas }`
response that spawns `task-list` widgets.

---

## Phase 6 — Polish Pass
*Make the demo feel alive.*

Checklist:
- [ ] All ticker text streams at 25ms/char (not instant)
- [ ] Task card progress bars animate in on spawn (not instant fill)
- [ ] QCM question transitions slide (not cut)
- [ ] Lesson SVG draws smoothly — no jump from 0 to full stroke
- [ ] Mail sent animation plays before widget disappears
- [ ] Reset Demo returns to a pixel-perfect step 0 with zero artifacts
- [ ] Project label fades in correctly on switch (600ms)
- [ ] Step counter always accurate
- [ ] Voice button always visible above tree strip
- [ ] Particle bg runs without performance issues (`document.hidden` guard)

---

## File Creation Summary

New files to create (in addition to updating existing ones):
```
src/projects/schoolData.ts         ← Phase 0
src/store/demoStore.ts             ← Phase 0 (feature registry + Tracker-owned progress)
src/ai/intentRouter.ts             ← Phase 3/5 (Agent 1 — structured routing decision)
src/ai/progressTracker.ts          ← Phase 3/5 (Agent 2 — async step-completion tracker)
src/components/DemoControls.tsx    ← Phase 1
src/widgets/TaskList.tsx           ← Phase 2a
src/widgets/QCMWidget.tsx          ← Phase 2b
src/widgets/LessonWidget.tsx       ← Phase 2c
src/widgets/LessonSVGCanvas.tsx    ← Phase 2c (sub-component)
src/widgets/LessonNarration.tsx    ← Phase 2c (sub-component)
src/widgets/MailCompose.tsx        ← Phase 2d
src/widgets/Dialog.tsx             ← Phase 2e
```

Existing files to update:
```
src/widgets/types.ts               ← add 5 new WidgetType values
src/widgets/registry.tsx           ← add 5 new renderers to the WIDGETS map
src/projects/projectStore.ts       ← project data + reset() + getActiveContext() + homeworks for Router
src/ai/systemPrompt.ts             ← add new widget catalog entries (live-spawnable ones)
src/ai/converse.ts / orchestrate.ts ← add new friendly→internal type-map entries
src/store/demoStore.ts             ← new (Phase 0) — feature registry; activateFeature() spawns + emits event
src/App.tsx                        ← mount DemoControls; wire Agent 1 (routeIntent) → activateFeature → Agent 2 (trackActivation, async)
src/widgets/{QCMWidget,MailCompose,LessonWidget,Dialog}.tsx ← lifecycle callbacks emit activation events to the Tracker (not direct completion)
```
(There is no `src/ai/tools.ts` — the app uses the `{ speech, canvas }` JSON contract, not AI-SDK
tool calling.)

---

## Definition of Done

The demo is complete when:
1. `Reset Demo` from any state returns to a perfect clean slate (empty completion set) with no artifacts
2. All 4 intents can be triggered **in any order** by voice/text, AND in canonical order via the
   Simulate-Voice button; the progress counter reaches `4 / 4` regardless of order
3. A free-form question unrelated to any intent routes to live Claude without affecting demo progress
4. QCM widget can be answered (Q4–Q7) and submitted
4. Mail compose widget appears with correct teacher data and plays sent animation
5. Maths dialog appears and "Yes, show me" triggers the lesson
6. Lesson widget draws the triangle, highlights all 3 sides, reveals the equation
7. Each lesson beat requires an OK confirm before proceeding
8. The entire demo runs in under 4 minutes from step 0 to final equation
