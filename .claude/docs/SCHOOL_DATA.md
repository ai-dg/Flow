# School Data Reference

Loaded when working in `src/projects/schoolData.ts` or seeding demo content.

This file documents all pre-authored content for the JARVIS school demo. Every piece of
copy, every QCM question, every lesson beat is defined here. `schoolData.ts` is the only
place it lives — nothing is hardcoded in components.

---

## Student

```
Name:     Alex Dupont
Age:      16
School:   Lycée Victor Hugo
```

---

## Projects (Subject Folders)

### History
```
Teacher:  Ms. Martin
Email:    s.martin@lycee-victor.fr
```

**Homework: WW2 — QCM**
- Type: `qcm`
- Due: Today, 5pm
- Initial progress: 60% (3 of 7 questions pre-answered)
- Pre-answered correctly: Q1 (index 2), Q2 (index 1), Q3 (index 2)

| Q# | Image | Question | Options | Correct |
|----|-------|----------|---------|---------|
| Q1 | — | When did the First World War end? | 1916 / 1917 / **1918** / 1919 | 1918 |
| Q2 | — | What event is considered the immediate trigger of WW2? | Assassination of Franz Ferdinand / **Invasion of Poland** / Attack on Pearl Harbor / Fall of France | Invasion of Poland |
| Q3 | — | Which alliance did Italy, Germany and Japan form? | The Allies / The Entente / **The Axis** / The Central Powers | The Axis |
| Q4 | MAP: Europe, September 1939 | Which country did Germany invade first to trigger the start of WW2? | France / **Poland** / England / Soviet Union | Poland |
| Q5 | PHOTO: Allied troops, Normandy coast | In which year did the D-Day landings take place? | 1941 / 1943 / **1944** / 1945 | 1944 |
| Q6 | PORTRAIT: British Parliament, 1940s | Who led the United Kingdom as Prime Minister during most of WW2? | Clement Attlee / **Winston Churchill** / Neville Chamberlain / Anthony Eden | Churchill |
| Q7 | PHOTO: VJ Day celebrations, 1945 | When did WW2 officially end? | 1944 / **1945** / 1946 / 1947 | 1945 |

*Q1–Q3 are pre-answered on demo load. The student sees Q4 first.*

---

### Maths
```
Teacher:  Mr. Leconte
Email:    p.leconte@lycee-victor.fr
```

**Homework: Pythagoras Theorem — Lesson** *(conversational tutor over a concept LIBRARY)*
- Type: `lesson`
- Due: Tomorrow
- Initial progress: 0% (confirmed concepts / total)
- A **concept library** of 6 concepts (NOT a beat sequence). Each concept has a `concept` key (tracked
  in the comprehension state: status + approaches used), an `introApproach`, a `visual` it lights up,
  and a set of `explanations` tagged by approach (`visual` / `analogy` / `example` / `formal`). The
  tutor *selects* which explanation to play; the intro variant ends on a check-in hook. The `order`
  below only defines what "the next concept" means on advance. See WIDGETS.md → `lesson`.

| # | Concept | Visual it owns | Intro explanation (the `introApproach` variant) |
|---|---------|----------------|--------------------------------------------------|
| 0 | right-angled triangle | `draw` — triangle A(15,80) B(80,80) C(80,15), right-angle marker at B | "Let's start simple. This is a right-angled triangle — see the little square corner? … With me so far?" |
| 1 | side a | `highlight` segment BC (purple `#6366f1`, label 'a') | "This shorter side, we'll call 'a'. Good?" |
| 2 | side b | `highlight` segment AB (purple `#6366f1`, label 'b') | "This other short side is 'b'. Still following?" |
| 3 | hypotenuse (c) | `highlight` segment AC (amber `#f59e0b`, label 'c', large) | "This long slanted side, opposite the right angle … the hypotenuse. We call it 'c'. Make sense?" |
| 4 | the relationship | `none` (narration only) | "Here's the heart of it: those two short sides and the long one are locked together … Ready for it?" |
| 5 | a² + b² = c² | `equation` — types `a² + b² = c²` character by character | "Square 'a', square 'b', add them — and you always get 'c' squared. That's Pythagoras." |

> Each concept also carries `analogy` / `example` (or `formal`) explanation variants in its
> `explanations` library — what the tutor reaches for to **reframe** (confusion) or **deepen**
> (follow-up) with a *different* representation. The live AI tutor usually generates its own wording;
> the library variants are the deterministic no-key fallback.

**SVG Coordinate System:**
- Origin: top-left of SVG canvas
- Coordinates are % of SVG dimensions (0–100 in both axes)
- Triangle vertices (% coords):
  - A = (15, 80) — bottom left
  - B = (80, 80) — bottom right ← right angle here
  - C = (80, 15) — top right
- Right-angle marker: small square drawn at B, 5×5 units

---

### English
```
Teacher:  Ms. Thompson
Email:    a.thompson@lycee-victor.fr
```

**Homework: The Great Gatsby — Essay**
- Type: `essay`
- Status: Submitted ✓
- Submitted: Yesterday, 11:42pm
- Progress: 100%

---

## Mail (Step 3)

When "send this work to my teacher" is triggered in History:

```
To:       Ms. Martin <s.martin@lycee-victor.fr>
Subject:  WW2 QCM — Alex Dupont
Body:
  Dear Ms. Martin,

  Please find attached my completed QCM on World War 2.
  All 7 questions answered.

  Best regards,
  Alex

Attachment: WW2_QCM_Alex_Dupont.pdf
```

---

## Ticker Lines (pre-authored, per step)

These are the exact strings that stream to the Ticker at each demo beat.
They are the fallback when live AI is not used.

| Step | Trigger | Ticker text |
|------|---------|-------------|
| 0 | (none) | *(silence)* |
| 1 | "What do I need to do today?" | "Good morning, Alex. Here's where you're at today." |
| 2 | "Let's start History homework" | "Picking up where you left off. Question 4 of 7." |
| 3a | "Send to teacher" | "Preparing your submission for Ms. Martin." |
| 3a | *(after compose opens)* | "Ready to send to Ms. Martin. Shall I go ahead?" |
| 3b | "Yes, send it" | "Sent. Ms. Martin will receive it shortly." |
| 4 | "Let's start Maths lesson" | "Starting Pythagoras Theorem. Want a quick visual walkthrough first?" |
| 5 Idea 0 | "Yes, show me" *(auto)* | "Let's start simple. This is a right-angled triangle — see the little square corner? That marks the right angle. With me so far?" |
| 5 Idea 1 | *(on "got it")* | "I'll give the sides names so we can talk about them. This shorter side, we'll call 'a'. Good?" |
| 5 Idea 2 | *(on "got it")* | "This other short side is 'b'. Still following?" |
| 5 Idea 3 | *(on "got it")* | "This long slanted side, opposite the right angle, has a special name — the hypotenuse. We call it 'c'. Make sense?" |
| 5 Idea 4 | *(on "got it")* | "Here's the heart of it: those two short sides and the long one are locked together in a fixed relationship. Ready for it?" |
| 5 Idea 5 | *(on "got it")* | "Square 'a', square 'b', add them together — and you always get 'c' squared. That's Pythagoras." |
| 5 *(clear yes)* | "Yes, I understand" | *(Tutor **advance**: brief validation — "Exactly, that's the key idea." — then the next idea)* |
| 5 *(vague ok)* | "ok" / silence | *(Tutor **clarify**: weak signal → "Want me to go deeper, or move on?" — does NOT advance)* |
| 5 *(confused)* | "I don't get it" | *(Tutor **reframe**: same idea, different angle — does not advance)* |
| 5 *(follow-up)* | a question | *(Tutor **deepen**: deeper on the same idea, different representation — does not advance)* |

---

## Voice Button Labels (per step)

These are the exact labels shown on the voice simulation button at each step.
They must match exactly — the presenter reads them aloud.

| Before this step | Button shows |
|---|---|
| Step 1 | `🎤 "What do I need to do today?"` |
| Step 2 | `🎤 "Let's start with the History homework we started yesterday"` |
| Step 3a | `🎤 "Could you send this work to my teacher?"` *(shown after QCM submit)* |
| Step 3b | `🎤 "Yes, send it"` |
| Step 4 | `🎤 "Let's start the new Maths lesson on Pythagoras Theorem"` |
| Step 5 | `🎤 "Yes, show me"` |
| Idea confirm | `🎤 "Yes, I understand"` *(tutor validates, then introduces the next idea)* |
| *(optional)* | `🎤 "Wait, I don't get it"` / a question / a vague "ok" *(tutor reframes / deepens / clarifies — does not advance)* |
| After final idea | *(button disappears — demo is over)* |
