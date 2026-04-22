# AI OKR Helper — Design Plan

> Status: Planned — not yet built. Implement after core product is stable.

---

## Vision

The AI acts like a seasoned OKR coach sitting next to you as you write. It doesn't interrupt — you invite it in. It reads what you've written, tells you what's weak and why, then offers a better version. You accept or ignore it and move on. Fast, specific, unobtrusive.

---

## Three Modes

**1. Critique** — "Here's what's wrong with this"
Tells you *why* the language is weak. Specific, not generic. Examples:
- *"'Improve performance' is an output, not an outcome. What changes for the customer when you succeed?"*
- *"No start value makes this KR unmeasurable. What's the baseline today?"*
- *"This objective has four KRs measuring the same thing. Consider collapsing two."*

**2. Rewrite** — "Here's a better version"
Proposes a rewritten title in the same domain/voice. The user accepts with one click — it replaces the field directly. Decline does nothing.

**3. Page health** — "Here's how the whole page reads"
A holistic view of the full page: coverage gaps, KRs that don't actually measure their objective, objectives that are tasks not destinations, missing values, imbalanced confidence distribution. Like a spell-check for strategy.

---

## Where It Lives in the UI

```
┌─────────────────────────────────────────────────────┐
│  OBJECTIVE                                    [✦] ← AI button (edit mode only)
│  Grow our enterprise segment                  🔵    │
└─────────────────────────────────────────────────────┘
  ↓ on click, panel slides open below:
┌─────────────────────────────────────────────────────┐
│  ⚠ Missing a measurable destination — "grow" is     │
│    directional but not a finish line.                │
│                                                      │
│  ✦ Suggested rewrite:                                │
│  "Establish enterprise as our primary growth engine" │
│                                          [Accept] [✕]│
└─────────────────────────────────────────────────────┘
```

- `✦` icon next to each Objective title in edit mode
- `✦` icon next to each KR title in edit mode
- "OKR Health" collapsible at the top of the page editor for the full-page view
- All hidden from read/presentation view — editor-only

Stubs already exist in the codebase — search for `TODO Phase 2` in:
- `src/components/okr/OKRPageEditor.tsx`
- `src/components/okr/ObjectiveCard.tsx`
- `src/components/okr/KeyResultRow.tsx`

---

## What We Send to Claude

**For a KR critique:**
```json
{
  "type": "key-result",
  "title": "Improve onboarding",
  "metric": null,
  "startValue": null,
  "targetValue": null,
  "confidence": "medium",
  "objectiveTitle": "Make new users successful faster",
  "period": "Q2 2025"
}
```

**For an objective critique:**
```json
{
  "type": "objective",
  "title": "Grow our enterprise segment",
  "keyResults": [
    { "title": "Increase ARR", "targetValue": null },
    { "title": "Close more deals" }
  ],
  "period": "Q2 2025",
  "teamName": "Sales"
}
```

**For a page health check:**
```json
{
  "type": "page",
  "teamName": "Product",
  "period": "Q2 2025",
  "companyMission": "Make work meaningful for every team",
  "objectives": []
}
```

The company mission comes from Settings so the AI can check strategic alignment, not just OKR syntax.

---

## API Design

Single streaming endpoint:

```
POST /api/ai/okr-critique
```

Response shape (streamed):
```json
{
  "issues": [
    { "severity": "error",   "message": "No measurable target — add a number" },
    { "severity": "warning", "message": "Sounds like a task, not an outcome" },
    { "severity": "tip",     "message": "Consider tying this to customer impact" }
  ],
  "suggestion": "Grow enterprise ARR from $800K to $1.4M",
  "explanation": "Anchors the objective with a specific finish line and a baseline to measure from."
}
```

Three severity levels map to colors: red error, amber warning, blue tip.

---

## The Prompt (the heart of it)

The prompt encodes real OKR expertise. Key principles:

**For objectives:**
- Qualitative and aspirational — no numbers
- Describes where you end up, not what you do
- Memorable enough to repeat without looking it up
- Achievable within the period, not a multi-year vision

**For key results:**
- Quantitative — must include or imply a number
- Outcomes, not outputs (no "launch X", "complete Y")
- Each KR independently validates the objective
- Start value should be set (reveals awareness of baseline)
- Target should be ambitious but not fantasy

**For pages:**
- 3–5 objectives is the sweet spot
- KRs shouldn't all be green by default (sandbagging)
- Coverage: does the objective set address the most important bets?
- Coherence: do the KRs actually prove the objective was achieved?

The prompt will need significant iteration — it's more important than any of the code.

---

## Implementation Phases

### Phase 1 — Foundation
- Add `ANTHROPIC_API_KEY` to `.env.local.example`
- Create `POST /api/ai/okr-critique` with streaming via the Anthropic SDK
- Write the core prompt (objective mode first, KR mode second)
- `AIFeedbackPanel` component — issues list + streamed suggestion + accept/dismiss

### Phase 2 — KR critique (highest value, clearest quality criteria)
- `✦` button in `KeyResultRow` (edit mode only)
- Panel slides open below the KR row
- Accept wires directly to `onChange({ title: suggestion })`
- Cache results by content hash so re-clicking doesn't re-call

### Phase 3 — Objective critique
- Same pattern in `ObjectiveCard`
- Prompt also evaluates whether the KRs coherently measure the objective
- Catches: "Your objective is about retention but no KR mentions churn"

### Phase 4 — Page health panel
- Collapsible section at the top of `OKRPageEditor`
- Sends the full objectives + KR tree
- Shows a summary card per objective + an overall grade
- Triggered manually ("Run OKR health check") not automatically

### Phase 5 — Suggestions (stretch)
- "Suggest objectives for this period" based on team name + mission + previous scores
- Generates 3–5 draft objectives the user can inject with one click

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Trigger | Explicit click, never automatic | Cost control + doesn't interrupt flow |
| State | Ephemeral (component state only) | Feedback isn't data — no need to persist |
| Streaming | Yes | Perceived speed matters; 3s blank wait is jarring |
| Model | Claude Sonnet for critique, Haiku for simple completions | Good reasoning-to-cost ratio |
| Caching | Hash of input content, session-scoped | Avoid duplicate calls on re-click |
| Rate limit | 20 requests/user/hour | Prevent runaway spend in early testing |
| Visibility | Edit mode only | Keeps presentation view clean |

---

## Out of Scope (for now)

- No auto-analysis on save or keystroke
- No storing AI suggestions in the database
- No scoring the AI's quality over time
- No multi-turn conversation — one-shot feedback, not a chatbot
