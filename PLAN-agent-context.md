# Plan: Agent System Prompt & Context Awareness

## Task List

- [ ] 1. Add `capturePlanSnapshot()` — build structured state object from DOM + gridState + goals
- [ ] 2. Add `snapshotChanged(current)` — deep equality compare against `lastSnapshot`
- [ ] 3. Add `maybeAppendStateUpdate()` — detect change, format + append state message
- [ ] 4. Add `formatStateMessage(snapshot)` — token-efficient human-readable text
- [ ] 5. Filter state messages out of rendering (`renderAgentMessages` / `addAgentMessage`)
- [ ] 6. Inject system prompt in `callOpenRouter()` messages array
- [ ] 7. Call `maybeAppendStateUpdate()` in `handleSendClick()` before `callOpenRouter()`
- [ ] 8. Wire future tool-loop continuations to call `maybeAppendStateUpdate()` (placeholder)

---

## 1. System Prompt

- **Role:** `system` (OpenRouter standard)
- **Storage:** not in `conversation[]` — injected at API call time only
- **Stability:** static string, never changes → cache-hit optimization
- **Content:** `"You are a meal planning assistant. You help users plan, adjust, and analyse meal plans using the Bulk Meal Planner."`
  - User will expand this later; keep it a single constant at the top of `agent-ui.js`

**In `callOpenRouter()`:**
```js
const SYSTEM_PROMPT = 'You are a meal planning assistant. ...';
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...recent.map(msg => { /* user→user, agent→assistant, state→user */ })
];
```

---

## 2. State Snapshot

### Data captured (`capturePlanSnapshot()`)

```js
{
  days: 7,
  variants: 3,
  mealsPerDay: 3,
  goals: { calories: { atLeast: 2500, atMost: 3000 }, ... },
  perVariant: [
    {
      label: "A",
      occurrences: 3,
      dailyTotals: { calories: 2000, protein: 150, carbs: 200, fat: 60, price: 8.50 },
      meals: [
        { meal: 1, entries: [{ recipeId, recipeName, multiplier, macros: {...}, servingWeight, price }] },
        ...
      ]
    },
    ...
  ],
  dailyAverage: { calories: 1900, protein: 145, carbs: 195, fat: 58 }
}
```

- Iterates `gridState` in-bounds only (`0..variants-1`, `0..mealsPerDay-1`)
- Reuses `getRecipe()`, `calculateRecipeMacros()`, `computeOccurrences()`
- Reads `input-days`, `input-variants`, `input-meals` from DOM
- Reads goals via `loadGoals()`
- `servingWeight` = `recipe.servingSize × multiplier`

### Deep equality comparison (`snapshotChanged()`)

- Compare `current` snapshot to module-level `lastSnapshot`
- Use a simple recursive deep-equal (no external deps, snapshot is small — max ~20 entries)
- Return `true` if they differ or `lastSnapshot` is `null`

---

## 3. State Update Messages

### Append rules

Call `maybeAppendStateUpdate()` before **every** API call:
1. User hits Send → `handleSendClick()` → `maybeAppendStateUpdate()` → `callOpenRouter()`
2. Agent tool loop iteration → same pattern (placeholder for future)

### Message format

```js
{
  type: 'state',   // new type, distinct from 'user' | 'agent' | 'tool_call' | 'tool_cluster'
  content: "STATE_UPDATE\n<token-optimized text>",
  timestamp: now()
}
```

Pushed to `conversation[]`, persisted via `saveConversation()`.

### State message text (`formatStateMessage()`)

Token-optimised but complete. Example:

```
STATE_UPDATE
Plan: 7 days, 3 variants, 3 meals/day

Day A (×3):
  Meal 1: Chicken & Rice 1.0× — 450 kcal | 40g P | 50g C | 10g F | 350g | $2.50
  Meal 2: Protein Shake 1.5× — 300 kcal | 50g P | 10g C | 5g F | 450ml | $1.80
  Meal 3: (empty)
  Daily: 750 kcal | 90g P | 60g C | 15g F | $4.30

Day B (×2):
  Meal 1: Beef Bowl 1.0× — 600 kcal | 45g P | 55g C | 20g F | 400g | $3.20
  Meal 2: (empty)
  Meal 3: (empty)
  Daily: 600 kcal | 45g P | 55g C | 20g F | $3.20

Day C (×2):
  (empty)

Daily Average (across 7 days): 507 kcal | 51g P | 39g C | 12g F | $2.19
Goals: Calories (2500-3000) ❌ | Protein (≥150) ❌ | Carbs (≤250) ✓ | Fat (no goal)
```

- `(empty)` for empty slots
- Per-entry line: `{name} {multiplier}× — {kcal} kcal | {protein}g P | {carbs}g C | {fat}g F | {weight}{unit} | {price}`
- Goal status: ✓ = met, ❌ = violated, `(no goal)` = not set
- Use `fmtNum()` for numbers

### Map to OpenRouter role

In `callOpenRouter()`, state messages map to `{ role: 'user', content: msg.content }`. The `STATE_UPDATE` prefix stays — it helps the model understand this is system-level context, and the token cost is negligible (~2 tokens).

---

## 4. Rendering Filter

### `renderAgentMessages()`

- Skip messages where `msg.type === 'state'`
- Alternatively: skip where `msg.content.startsWith('STATE_UPDATE')`
- Both approaches work; type check is cleaner

### `addAgentMessage()`

- Same filter — don't render state messages in the DOM

### `groupToolCalls()`

- State messages pass through as-is (they never appear in the DOM, but they might be adjacent to other messages). No special handling needed since they have their own `type`.

---

## 5. State message in `conversation[]`

- Lives alongside user/agent/tool messages in the array
- Persisted to localStorage with everything else
- On reload (if `AGENT_HISTORY_ON_RELOAD` is true): conversation restores, `lastSnapshot` is `null` → first new message will trigger a fresh state append regardless
- On reload (if `AGENT_HISTORY_ON_RELOAD` is false, current default): conversation starts empty, `lastSnapshot` is `null` → first message always includes state

This is the correct behaviour because:
- If the user reloads the page, the plan may have been persisted separately (via `bulk-meal-planner-v1`) but the agent's `lastSnapshot` doesn't survive → safe: we always send current state on first message after reload
- `lastSnapshot` is module-level, not persisted — intentionally, since it only needs to track changes within a single session

---

## 6. Wire Points in `agent-ui.js`

| Location | Change |
|----------|--------|
| Top of file | Add `SYSTEM_PROMPT` constant, `lastSnapshot` variable |
| New function | `capturePlanSnapshot()` |
| New function | `snapshotChanged(current)` |
| New function | `formatStateMessage(snapshot)` |
| New function | `maybeAppendStateUpdate()` |
| `handleSendClick()` | Call `maybeAppendStateUpdate()` before `callOpenRouter()` |
| `callOpenRouter()` | Prepend system message; add state→user role mapping |
| `renderAgentMessages()` | Skip `type === 'state'` |
| `addAgentMessage()` | Skip `type === 'state'` |
| Future tool-loop | Call `maybeAppendStateUpdate()` before each API call |

---

## Dependencies / Imports Needed

- `capturePlanSnapshot()` needs: `gridState` (from state.js), `getRecipe`, `calculateRecipeMacros`, `computeOccurrences`, `loadGoals`, `fmtNum` (from calculations.js)
- Currently `agent-ui.js` imports nothing from other modules — it will need to import from state.js and calculations.js

## Out of Scope

- Adding tools to the agent (this is groundwork for that feature)
- Modifying goals from the agent
- Modifying the plan from the agent
- Mobile optimisation