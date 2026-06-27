---
name: ai-fluency
description: AI fluency framework — 5 core competencies for working effectively with AI tools. Applied AI use, learning agility, systems thinking, ethical AI, and human-AI collaboration. Based on TestGorilla's AI fluency assessment framework. Use when designing AI-powered products, evaluating AI integrations, or building teams that work with LLMs.
metadata:
  origin: custom
---

# AI Fluency

AI fluency is the measurable ability to orchestrate AI tools to create genuine value — knowing when AI is effective and when it isn't. Beyond "knowing how to use ChatGPT."

**AI literacy** = awareness of AI tools.
**AI fluency** = practical execution: orchestrating AI as an augmenting teammate to produce real outcomes.

Self-reported AI skills are unreliable. Fluency is demonstrated through hands-on execution, not claimed proficiency.

## When to Activate

- Designing AI-powered product features or workflows
- Evaluating whether a task is a good fit for LLM automation
- Building prompting strategies for production AI systems
- Auditing AI integrations for bias, reliability, and safety
- Structuring human-AI collaboration in a product or team

---

## The 5 Core Competencies

### 1. Applied AI Use
Knowing **when and where** AI works, and recognizing its technical limitations.

**When AI works well:**
- Pattern matching on large text corpora
- Drafting, summarizing, reformatting structured content
- Code generation with clear specs and testable outputs
- Classification tasks with labeled examples
- Brainstorming and exploration (non-deterministic output is fine)

**When AI fails or requires human oversight:**
- Tasks requiring real-time data without retrieval
- High-stakes decisions without human review loop
- Precise arithmetic or counting (hallucination risk)
- Long-horizon reasoning with many interdependent constraints
- Tasks where "confident but wrong" is worse than "uncertain"

**Practical application for builders:**
```
Before integrating LLM into a feature:
1. What is the failure mode if the model is wrong?
2. Is there a deterministic alternative that's cheaper and more reliable?
3. What's the latency/cost per call at production volume?
4. How do we detect and handle degraded outputs?
```

---

### 2. Learning & Digital Ability
Rapidly adopting new AI workflows and translating emerging tools into productivity gains.

**Key behaviors:**
- Evaluate new AI tools by running a real task in <30 minutes — not by reading docs
- Build personal "tool inventory": which model/tool for which task type
- When a workflow breaks (model update, API change), diagnose and adapt within the same session
- Distinguish between "learning the tool" and "learning the underlying concept"

**Model routing by task:**

| Task | Recommended Approach |
|---|---|
| Quick factual lookup | Small/fast model (Haiku) |
| Complex reasoning | Large model (Opus/Sonnet) |
| Code generation | Coding-optimized model |
| Document summarization | Model with long context window |
| Structured data extraction | Model + schema enforcement (JSON mode) |

---

### 3. Systems Thinking & Problem Solving
Frame ambiguous problems, decompose them into components, and reason about how AI decisions create downstream effects.

**Decomposition pattern:**
```
1. Define the boundary: what goes in, what comes out
2. Identify intermediate steps — where does AI add value vs. where is it a risk?
3. Map failure modes at each step
4. Design fallbacks: what happens when the AI step returns garbage?
```

**Downstream reasoning example:**
```
Feature: AI auto-classifies support tickets
Downstream effects:
- If classification is wrong → ticket routed to wrong team → delay
- If model drifts → classification degrades silently → SLA impact
- If latency increases → ticket queue backs up
Mitigations: confidence threshold → human fallback, monitoring, circuit breaker
```

**Prompt engineering hierarchy:**
```
1. Task        — what to do ("Classify this support ticket into one of: billing, technical, general")
2. Context     — relevant background ("You are a support triage system for a SaaS product")
3. Format      — output structure ("Return JSON: {category, confidence, reasoning}")
4. Constraints — what to avoid ("If confidence < 0.8, return category: 'escalate'")
```

---

### 4. Responsible & Ethical AI Use
Recognize bias, privacy, and governance challenges. Establish safeguards despite pressure to move fast.

**Bias detection:**
- Test outputs across demographic groups — does the model perform differently?
- Check training data assumptions: does the model reflect a particular cultural/linguistic context?
- Red-team: deliberately probe for failure cases before shipping

**Privacy:**
- Never send PII/PHI to external LLM APIs without explicit data processing agreements
- Strip or pseudonymize sensitive data before LLM processing
- Log what goes in and out — you need an audit trail

**Governance:**
- Document: which decisions does AI make autonomously? Which require human review?
- Define escalation path: when does confidence drop below threshold → human takes over?
- Review AI-generated outputs before they become training data (feedback loop contamination)

**Safeguards in code:**
```python
def ai_decision(input_data: dict) -> Decision:
    result = llm_call(input_data)

    # Always validate structure
    if not is_valid_schema(result):
        return fallback_decision(input_data)

    # Confidence gate
    if result.confidence < CONFIDENCE_THRESHOLD:
        return escalate_to_human(input_data, result)

    # Audit log
    audit_log.write(input=input_data, output=result, model=MODEL_VERSION)

    return result
```

---

### 5. Human-AI Collaboration
Communicate assumptions, prompts, and outputs clearly. Maintain transparency about trade-offs in shared workflows.

**For product designers — AI as collaborator, not black box:**
- Surface AI confidence/uncertainty in the UI — don't present all outputs with equal confidence
- Give users meaningful control over AI behavior (not just "off/on")
- Show provenance: where did this output come from?
- Design for graceful degradation: what does the UI show when AI is wrong or slow?

**For developers — collaboration interfaces:**
```tsx
// Show uncertainty
<AIOutput
  content={result.text}
  confidence={result.confidence}
  disclaimer={result.confidence < 0.8 ? "Review recommended" : undefined}
/>

// Give user control
<AISettings>
  <Toggle label="Auto-suggest" description="AI proposes, you approve" />
  <Toggle label="Auto-apply" description="AI applies changes directly" />
</AISettings>
```

**For teams — transparent AI workflows:**
- Label AI-generated artifacts clearly (drafts, suggestions, classifications)
- Define human checkpoints explicitly — not "AI handles this" but "AI drafts, PM approves"
- Track where AI outputs enter the system and what downstream decisions they affect

---

## Evaluating AI Integrations

Questions to ask before shipping any AI feature:

| Question | Why It Matters |
|---|---|
| What's the failure mode when wrong? | Determines acceptable error rate |
| How do we detect degraded performance? | Need monitoring beyond unit tests |
| Is the output deterministic enough to test? | Regression testing strategy |
| What's cost at 10x current volume? | Scalability and margin impact |
| Who is liable if the AI output causes harm? | Legal/compliance requirement |
| How do we explain this decision to a user? | Transparency and trust |

---

## Anti-Patterns

- **Over-relying on a single model** — no fallback when the model is down or degraded
- **Treating LLM outputs as ground truth** — always validate, especially for facts and numbers
- **No confidence signals** — showing all AI outputs with equal visual weight
- **Prompts as magic strings** — not version-controlled, not documented, not tested
- **Privacy leakage** — sending user data to external APIs without data agreements
- **Silent failure** — AI returns degraded output, system continues without alerting
- **Retrofitting AI** — adding AI to a feature because it's trendy, not because it solves a real problem
