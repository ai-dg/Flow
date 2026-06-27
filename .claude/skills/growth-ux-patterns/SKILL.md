---
name: growth-ux-patterns
description: Growth-oriented UX patterns — onboarding aha moments, retention loops, ethical monetization, viral mechanics, and psychological design. Based on growth.design case studies (Duolingo, TikTok, Spotify, Tinder, Blinkist, etc.). Use when designing product flows, onboarding, paywalls, notifications, or engagement features.
metadata:
  origin: custom
---

# Growth UX Patterns

Psychology-backed product design patterns drawn from growth.design case studies across 47 real products.

## When to Activate

- Designing or reviewing onboarding flows
- Building retention mechanics (streaks, notifications, goals)
- Designing paywalls, upgrade flows, or trial conversions
- Creating viral or sharing features
- Auditing engagement loops or feed design
- Writing micro-copy (buttons, empty states, errors)

---

## Onboarding

### Aha Moment Design
Identify the single moment when a user first "gets" the product. Design every onboarding step to reach it as fast as possible. Remove anything that delays it.

- Map your aha moment: what action predicts long-term retention?
- Remove all steps between signup and that moment
- Example: Too Good To Go — first saved meal = aha moment

### JTBD Framework
Ask why users are here, not what they want to do. Align onboarding with their actual job-to-be-done.

```
Bad: "What features do you want to use?"
Good: "What brings you here today?" → map to motivation → personalize path
```

- Letterboxd: social film diary (JTBD = curate identity + connect with taste-alike friends)
- Headspace: stress relief (JTBD = calm right now, not "learn meditation")

### Hick's Law — Reduce Choices
Decision time increases with choice complexity. One CTA per screen. Use visual overlays to eliminate competing options.

```tsx
// Bad: 4 equal CTAs on the same screen
// Good: primary CTA + ghost secondary, everything else hidden
<Button variant="primary">Get started</Button>
<Button variant="ghost">See how it works</Button>
```

### Happy Path for New & Resurrected Users
- Simplify the first 3 sessions — build confidence before introducing complexity
- Resurrected users are **20% less likely to retain than new users** — treat them as fragile
- Skip advanced content, podcasts, complex features for this segment

### Progressive Disclosure
Don't show everything on day 1. Stage feature reveals based on engagement milestones.

| Session | Content |
|---|---|
| 1 | Core value, single aha moment |
| 2–3 | Second feature, social proof |
| 7+ | Power features, upsell |

### Onboarding Surveys
Ask 2–3 personalization questions early (Grammarly model). Users feel understood — higher activation.

- Keep to max 3 questions
- Show why you're asking: "So we can personalize your experience"
- Act on the answers immediately — show different paths

### Permission UX (Hopper Model)
Never request permissions on first launch. Request contextually, explain value before asking.

```
Step 1: User performs action that needs permission
Step 2: Explain benefit ("Get notified when prices drop")
Step 3: Show system prompt
```

### 5 Onboarding Anti-Patterns

1. **Too many choices** — cognitive overload at signup
2. **Feature dumping** — showing all features before user has any context
3. **No early win** — user never experiences success in session 1
4. **Skipping the why** — not explaining why you need information (email, permissions)
5. **Splash screen stacking** — multiple consecutive modals for resurrected/new users

---

## Retention

### Zeigarnik Effect
People remember unfinished tasks better than completed ones. Use progress bars, streak counters, and daily goal indicators.

- Progress bar at 60% is more motivating than empty or full
- "You're 3 lessons from your weekly goal" > "Keep learning"

### Streaks — Double-Edged Sword
Strong Day-7 retention driver, but losing a streak causes churn.

| Do | Don't |
|---|---|
| Offer streak freeze protection | Let users lose streaks without warning |
| Send pre-emptive "streak at risk" alert | Make freeze too expensive |
| Celebrate milestone streaks | Shame users who miss days |

### Sunk Cost / Investment Mechanics
Request commitment immediately after delivering a reward — not before.

- Timing: reward → investment ask (never investment ask → reward)
- Example: Duolingo streak bet (50 gems wagered for 7-day commitment) → **+14% Day-7 retention**
- Other investments: completing a profile, importing data, setting preferences

### Exit Points
Nudge users to stop after completing their daily goal. Users who associate your product with achievable satisfaction return more than users who associate it with endless work.

- "You hit your goal! See you tomorrow 🎯" > endless content list
- Proposed impact: +5% Day-30 retention (Duolingo internal target)

### Notification Strategy
- Auto-filter notifications when engagement drops — prevents permanent disable
- Trigger on life events, not just time intervals (travel, milestones, seasons)
- 15–30% of Duolingo users learn for travel — trigger before relevant holidays

```
Lifecycle email example:
Trigger: User selected "travel" as motivation
Event: User hasn't practiced in 7 days + international holiday in 2 weeks
Email: "Planning a trip? You're 3 lessons from basic conversations"
```

### Welcome-Back Reward
Give an immediate reward the moment a lapsed user returns — before asking anything.

- Gems, bonus streak, exclusive content, compliment on returning
- Never surface a "you missed X days" guilt message before the reward

### Offboarding Well (Typeform Model)
A positive cancellation experience increases return likelihood.

- Acknowledge the reason without arguing
- Offer a pause option before full cancel
- End with warmth: "We'll keep your data. Come back anytime."

---

## Monetization (Ethical)

### Premium Preview
Show premium features in context, locked — users see the value before hitting the paywall.

- Display with reduced opacity + lock icon, not hidden
- Let users interact partially: see the output but not export/share
- Strava model: view segment data, but leaderboard is blurred

### Ethical Paywall Design
Demonstrate value first, then ask. **Blinkist: +23% trial conversion** with this approach.

```
Wrong order: Signup → Paywall → Value
Right order: Signup → Value → Paywall
```

### Upgrade UX (Zapier's 9 Tactics)
1. Show clear tier differentiation (what each plan gets)
2. Upgrade CTA at moment of hitting a limit — not randomly
3. Let free users see what they're missing in context
4. One-click upgrade with pre-filled payment if trial ran
5. Show ROI: "Teams on Pro save X hours/week"
6. Social proof at upgrade screen: "Join 500k teams on Pro"
7. Offer annual with clear savings calculation
8. Reinforce immediately post-upgrade: "You now have access to X"
9. Follow up 7 days later: "Here's what you unlocked"

### Ethical Scarcity (Uber Eats Model)
Real deadlines only. Never fake countdowns.

```
Ethical: "Offer ends Sunday" (actually ends Sunday)
Dark pattern: Timer that resets on page reload
```

### Trial-to-Paid Timing (Tinder's 15-Minute Window)
Identify the peak engagement moment in a session and surface the upgrade offer then — not at trial expiry.

- Map session engagement curve
- Find the moment of highest perceived value
- Present upgrade at that moment, not at arbitrary time limits

---

## Viral Mechanics

### Spotify Wrapped Formula

| Principle | Implementation |
|---|---|
| Curiosity gap | Tease 1 week before reveal, don't show all data |
| Anticipation | Annual cadence = cultural event |
| Variable reward | Uncertainty about results = surprise |
| Storytelling | Narrative arc, not stats dashboard |
| Social value | Music = identity = shareable |
| Delighters | Novel animations refreshed yearly |

**Apply to any product:** reframe usage data as positive memories, not consumption stats.

### Sniper Links
In email confirmation flows, auto-detect the user's email provider and link directly to their inbox.

```
Instead of: "Check your inbox"
Do: Detect @gmail.com → show "Open Gmail" button → deep link to inbox
```

### Social Proof Triggers
Show peer behavior contextually at decision moments.

```tsx
// At signup CTA:
<p className="text-sm text-gray-500">
  1,247 people joined this week
</p>

// At feature discovery:
<Tooltip>82% of teams use this feature daily</Tooltip>
```

---

## Engagement Loops

### Immersive UI (TikTok / Full-Screen Model)
Growth.Design measured **280% engagement increase** switching from card to full-screen layout.

- Eliminate competing UI elements during core content consumption
- Edge-to-edge media
- Navigation hidden until intentional gesture

### Habit Formation (Domino Effect)
Design each micro-action to trigger the next automatically.

- Swipe → next content loads instantly (no loading state)
- Complete lesson → streak animation → "One more?" CTA
- Like → related content surfaces immediately

### Variable Rewards
Low cognitive effort + high unpredictability = habit formation.

```
Ethical variable reward: genuine content surprise (algorithm learns preferences)
Dark pattern: manufactured scarcity, fake "you won" moments
```

### Sticky Content Formula
Five characteristics of high-retention content:

1. **Simple format** — no cognitive overhead to start
2. **Unexpected twist** — curiosity gap that makes you stay
3. **Concrete relevance** — immediately applicable to user's life
4. **Emotional resonance** — surprise, delight, recognition, nostalgia
5. **Narrative arc** — beginning, middle, payoff

### Strategic Content Sequencing
Introduce complex/challenging content only after the user is engaged — not in session 1.

---

## Micro-interactions & Perceived Quality

### Labor Perception Bias
Sometimes showing the work increases perceived value, even if speed is identical.

- Progress animation during AI processing: feels more thorough
- "Analyzing your results..." > instant response for high-stakes outputs

### UI Delighters (Been App Model)
Small moments of delight accumulate into perceived quality and brand loyalty.

- Confetti on goal completion
- Satisfying animation on streak milestone
- Subtle haptic feedback on key actions
- Personality in loading states

### Micro-copy Moments
Every piece of text is a retention opportunity.

| Element | Generic | High-Retention |
|---|---|---|
| Empty state | "No items yet" | "Nothing here yet — add your first one" |
| Error message | "Something went wrong" | "We hit a snag. Try again — we saved your work." |
| CTA button | "Submit" | "Get my results" |
| Cancel confirm | "Are you sure?" | "You'll lose your 14-day streak" |
