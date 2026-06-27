---
name: dark-patterns-ethics
description: Dark patterns catalog — game and app manipulation tactics, their psychological mechanisms, user harm, regulatory risk, and ethical design alternatives. Use when auditing UX for manipulative patterns or designing ethical alternatives.
metadata:
  origin: custom
---

# Dark Patterns & Ethics

Dark patterns are UI/UX designs that trick or manipulate users into actions they didn't intend. First catalogued by Harry Brignull (2010). Actively regulated by FTC, EU DSA, and GDPR.

## When to Activate

- Auditing a product flow for manipulative patterns before launch
- Reviewing cancellation, checkout, or notification flows
- Designing alternatives to patterns flagged by legal/compliance
- Evaluating competitor products for ethical positioning
- Advising on regulatory compliance (EU DSA, GDPR, FTC)

---

## Game-Specific Dark Patterns

### 1. Grinding / Artificial Progress Gates
Forcing repetitive low-skill actions to artificially delay rewards and extend session time.

- **User harm:** Wastes time, creates frustration, exploits sunk cost
- **Ethical alternative:** Respect player time; offer meaningful shortcuts that don't require payment to skip

### 2. Loot Boxes / Gacha
Randomized rewards purchased with real money — functionally identical to gambling.

- **Legal status:** Classified as gambling in Belgium, Netherlands; under review in UK, US
- **Ethical alternative:** Direct purchase of known items at transparent prices

### 3. Pay-to-Win
Purchasing gameplay advantages over other players.

- **User harm:** Destroys competitive balance; alienates non-paying players
- **Ethical alternative:** Cosmetic-only monetization (Fortnite model)

### 4. Fake Countdown Timers
Timers that reset on page reload or are permanently running.

- **Legal risk:** FTC has issued fines for fake urgency claims
- **Ethical alternative:** Real deadlines only — offer expires when stated

### 5. Social Pressure / Obligation Loops
"Your friend sent you a gift! Claim it before it expires." Creates FOMO and guilt as primary engagement driver.

- **Ethical alternative:** Optional, no-expiry social interactions

### 6. Energy Systems
Artificial wait timers that block play unless premium currency is spent. Monetizes the product's own scarcity.

- **User harm:** Creates artificial frustration with the product itself

### 7. Disguised Ads
Advertisements designed to look like game UI elements, rewards, or content buttons.

- **Legal risk:** FTC requires clear ad disclosure

### 8. Friend Spam
Requiring contacts access and messaging them without explicit per-contact consent.

- **Legal risk:** CAN-SPAM, GDPR consent requirements

### 9. Whale Hunting
Designing monetization specifically to extract maximum spend from a small percentage of compulsive spenders, often exploiting gambling-adjacent psychology.

- **User harm:** Disproportionately harms vulnerable users
- **Ethical alternative:** Spending caps, budget tools, transparent total-spent displays

### 10. Paywall at Emotional Peak
Presenting a purchase prompt immediately after losing a life, failing a level, or being near a win.

- **User harm:** Exploits frustration and near-miss psychology

---

## App / Web Dark Patterns

### 1. Confirmshaming
Shaming opt-out language on decline buttons.

```
Dark: "No thanks, I prefer to stay uninformed"
Ethical: "No thanks" or "Maybe later"
```

### 2. Roach Motel
Easy to enter, difficult to leave. Cancellation flow buried in settings with multiple friction steps.

- **FTC rule (US):** Cancellation must be as simple as signup ("click to cancel" rule)
- **GDPR:** Withdrawal of consent must be as easy as giving it

### 3. Misdirection
Drawing visual attention to one element to distract from another.

- Pre-checked add-on boxes in checkout
- "Accept all" button visually dominant over "Manage preferences"

### 4. Hidden Costs
Revealing shipping, taxes, or fees only at the final checkout step.

- **User harm:** Triggers cart abandonment and destroys trust on return visits

### 5. Bait and Switch
Advertising one product or price, delivering another after commitment.

### 6. Trick Questions
Double-negative checkboxes or confusing consent language.

```
Dark: "Uncheck this box if you don't want to not receive emails"
Ethical: "Send me product updates" [unchecked by default]
```

### 7. Privacy Zuckering
Deliberately confusing privacy settings so users share more than intended.

- **GDPR violation:** Consent must be informed and specific

### 8. Forced Continuity
Free trial requires credit card, charges automatically with no pre-charge reminder.

- **Ethical alternative:** Email 3 days before charge, one-click cancel in the email

### 9. Disguised Subscriptions
Framing a subscription as a one-time purchase.

```
Dark: "$9.99" in large text, "per month" in footnote
Ethical: "$9.99/month, cancel anytime" — recurring nature upfront
```

### 10. Notification Harassment
Permission requests that reappear after denial, or notifications impossible to granularly disable.

---

## Psychological Mechanisms Exploited

| Mechanism | How Dark Patterns Use It |
|---|---|
| Loss aversion | "You'll lose your progress" instead of "Save your progress" |
| Sunk cost | "You've already invested 30 days — don't lose it" at cancellation |
| Authority bias | Fake trust badges, inflated review counts |
| Social proof manipulation | Fake "X people viewing this" counters |
| Reciprocity exploitation | Unsolicited gifts that create obligation to purchase |
| Hyperbolic discounting | Overvaluing immediate reward vs. future subscription cost |
| Near-miss effect | Gacha "almost won" animations that encourage next pull |

---

## Regulatory Risk Reference

| Regulation | Scope | Key Rule | Penalty |
|---|---|---|---|
| EU Digital Services Act (DSA) | Large platforms (45M+ EU users) | Bans dark patterns in consent/cancellation | Up to 6% global revenue |
| GDPR | All EU data processors | Consent freely given, specific, informed — no pre-checked boxes | Up to 4% global revenue |
| FTC Click-to-Cancel Rule | US | Cancel must be as easy as subscribe | Per-violation fines |
| California CCPA | CA residents | Opt-out of data sale must be prominent | $2,500–$7,500/violation |
| UK CMA | UK | Ongoing dark patterns enforcement | Revenue-based fines |

---

## Ethical Alternatives Framework

For every pattern under consideration, ask:

1. **Transparency test:** Would users feel manipulated if the mechanism were fully explained?
2. **Alignment test:** Does this serve user goals, or only business goals?
3. **Transparency viability:** Would this still work if the mechanism were disclosed?
4. **Attention respect:** Does this respect the user's time and attention?

**Ethical ≠ less effective:**
- Blinkist: +23% trial conversion with ethical paywall (growth.design)
- Signal, Brave: ethical positioning as competitive differentiator
- GoDaddy: ethical checkout redesign improved conversion without dark patterns

---

## Audit Checklist

Walk every flow as a new user with no prior knowledge:

- [ ] Every pre-filled field, checkbox, and default — should they be unchecked?
- [ ] Cancellation flow — time it, count clicks. Compare to signup flow.
- [ ] Notification opt-out — can every notification type be granularly disabled?
- [ ] Countdown timers — reload the page. Do they reset?
- [ ] Micro-copy — any shame/pressure language on decline buttons?
- [ ] Trial/premium — is recurring billing disclosed before payment entry?
- [ ] Checkout — are all fees shown before the final confirmation step?
- [ ] Permissions — are they requested before any context is given?
- [ ] Social proof — are user counts/reviews verifiable or inflated?
