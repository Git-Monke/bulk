Read SPEC.md for project context.

---

## Stack

| Layer                | Tech                                  |
|----------------------|---------------------------------------|
| **Build**            | Vite 6, npm dependencies              |
| **CSS framework**    | Tailwind CSS 3 + DaisyUI 4 (PostCSS) |
| **Drag & drop**      | SortableJS (npm)                     |
| **Icons**            | Lucide (tree-shaken via npm)         |
| **Fonts**            | IBM Plex Sans / IBM Plex Mono (Google Fonts) |
| **Entry point**      | `index.html` → `src/main.js` (ES module) |

Development: `npm run dev` (Vite dev server). Build: `npm run build` (outputs to `dist/`).

| File | Purpose |
|------|---------|
| `src/data.js` | INGREDIENTS, ALL_RECIPES databases |
| `src/state.js` | gridState Map, entry management |
| `src/calculations.js` | calculateRecipeMacros, fmtNum, computeOccurrences, saveToStorage, loadGoals, checkGoal |
| `src/lucide-init.js` | Tree-shakeable Lucide icon registry (`createIcons` with iconMap) |
| `src/recipe-ui.js` | renderRecipeList, recipe edit modal, ingredient search |
| `src/ingredient-ui.js` | renderIngredientList, ingredient modal, category dropdowns |
| `src/grid-ui.js` | renderMealGrid, buildSlotCard, updateSummary |
| `src/goals-ui.js` | Goals settings modal, TDEE/macro calculator (Mifflin-St Jeor) |
| `src/print.js` | generatePrintView |
| `src/agent-state.js` | Agent conversation state, plan snapshot capture/formatting, settings storage (no DOM) |
| `src/agent-api.js` | Agent OpenRouter streaming fetch, send/cancel controls, settings modal wiring |
| `src/agent-ui.js` | Agent chat DOM rendering: message list, tool clusters, placeholder, initAgentView |
| `src/main.js` | Event wiring + initialization (thin glue) |
| `src/styles.css` | Tailwind entry point (`@tailwind base/components/utilities`) |
| `css/tokens.css` | DaisyUI theme overrides (CSS custom properties) |
| `css/base.css` | Resets, typography, scrollbars, SortableJS helpers |
| `css/layout.css` | App shell regions |
| `css/components-buttons-agent.css` | Buttons, agent placeholder, agent chat UI, select pill |
| `css/components-cards.css` | Recipe list cards, ingredient list cards |
| `css/components-slots.css` | Ingredient modal, slot cards, range slider |
| `css/components-panels.css` | Right summary cards, edit recipe modal, ingredient search typeahead |
| `css/utilities.css` | Empty-state helpers, goal status colors (`.text-error`, `.text-success`) |
| `conversation-view.html` | Standalone HTML for viewing agent conversation history from localStorage |

CSS files are loaded via `import` in `main.js` (Vite processes them through PostCSS). See `css/style.md` for guide, naming, and import order.

---

## Data Model

**INGREDIENTS** (`src/data.js`) — flat lookup object keyed by string ID:

```javascript
{
  macrosPer100g: { calories, protein, carbs, fat },
  pricePerUnit: number,
  unit: string,                    // "g", "ml", "slice", "whole"
  servingSize: number,             // defaults to 100 for base ingredients
  isRecipe?: boolean,              // auto-generates single-ingredient recipe
  category?: string,               // required when isRecipe: true
  custom?: boolean                 // only on user-created ingredients (gates edit/delete)
}
```

**ALL_RECIPES** (`src/data.js`) — merged array of base recipes + auto-generated single-ingredient recipes:

```javascript
{
  id: string,
  name: string,
  servingSize: number,             // total grams per 1x serving (weight display only)
  ingredients: [{ id, amount }],   // references INGREDIENTS keys
  prepNotes?: string               // empty string = no prep section in print
}
```

**Single-Ingredient Recipes** — `isRecipe: true` on ingredients auto-generates recipes at runtime. Recipe `id`, `name`, `servingSize`, `category` inherited from ingredient.

**Macros/price always derived at runtime** via `calculateRecipeMacros(recipe, multiplier)` — never hardcoded.

---

## State Model (`src/state.js`)

**`gridState`** — `Map<string, Array<{ entryId, recipeId, multiplier }>>`

- Key: `"variant-meal"` (e.g. `"0-2"` = variant A, meal slot 3)
- Value: array of stacked recipe entries for that slot
- **Keys never deleted** — out-of-bounds keys kept on resize, excluded from calculations
- `entryId`: unique incrementing integer for mutation/removal

**Key functions:**
- `getSlotEntries(variant, meal)` → returns or creates array
- `addEntry(variant, meal, recipeId, multiplier)` → pushes, returns entry
- `removeEntry(variant, meal, entryId)` → splices out by entryId
- `updateEntryMultiplier(variant, meal, entryId, multiplier)` → mutates in place
- `clearGridState()` — clears map and resets `nextEntryId`

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Brand (Bulk logo + title) | Days | Meals | Variants│
│                  | Clear | Print plan                        │
├──────────────┬──────────────────────────┬───────────────────┤
│  LEFT        │                          │    RIGHT          │
│  SIDEBAR     │       MAIN GRID          │   SIDEBAR         │
│  [Manual|Agt]│  (variant cols × meals)  │  (summary)        │
│  tabs        │                          │                   │
│  (288px)     │       flex-1             │    320px          │
└──────────────┴──────────────────────────┴───────────────────┘
```

### Top Header
- **Brand section** — "Bulk" logo (Archive icon) + "Meal Prep Planner" subtitle
- **Controls** — Days, Meals/day, Variants number inputs
- **Actions** — Clear button, Print plan button

### Sidebar Tabs
Top of left sidebar: `Manual` tab and `Agent` tab. Only one visible at a time.

**Manual tab:** Recipe/Ingredient view toggle, category filter, draggable recipe cards (or ingredient list), "+ New" button.

**Agent tab:** Chat interface — message list (placeholder or history), input row with settings gear, text input, send/stop button.

### Meal Grid (Manual tab only)
- Columns = `input-variants`, each `flex-1 min-w-[200px]`
- Rows = `input-meals`, each `flex-1`
- Headers: Day A/B/C…, Meal 1/2…
- Each slot has `.recipe-stack` div for dropped cards; empty shows `slot-placeholder`

### Slot Cards
Built by `buildSlotCard(variant, meal, entry)` → DOM node. Shows: recipe name, scaled macros (cal/protein/carbs/fat/weight/price), range slider (0.1–4x, step 0.1), remove button. Card holds closure over `entry`; slider `input` mutates `entry.multiplier` in gridState, refreshes macro display, calls `updateSummary()`. Remove button calls `removeEntry()`, removes DOM node, calls `updateSummary()`.

### Drag and Drop (SortableJS)
- Left sidebar: `group: { name: 'recipes', pull: 'clone', put: false }` — clones on drag
- Recipe stacks: `group: { name: 'recipes', pull: true, put: true }` — accepts drops
- `onAdd` handler on each stack: reads `recipeId` from `data-recipe-id`, removes clone, calls `addEntry()`, calls `buildSlotCard()`, calls `updateSummary()`
- Reorder within stacks is cosmetic only (DOM only, not gridState)

### Right Sidebar — Summary Panel
- **Daily average card** — Calories, Protein, Carbs, Fat. Each shows goal range (loaded via `loadGoals()`) and color-coded status (`text-success` when met, `text-error` when violated). Header has TDEE calculator button (left) and goal settings button (right).
- **Cost card** — Cost per day and per week
- **Per-day breakdown** — Variant-by-variant totals

### Summary Calculations (`updateSummary`)
- Reads `days`, `variants`, `mealsPerDay` from inputs
- Computes `occurrences[v]` per variant: `base = Math.floor(days / variants)`, first `days % variants` get `base + 1` (7 days, 3 variants → [3, 2, 2])
- Iterates in-bounds slots only (0..variants-1, 0..mealsPerDay-1)
- Accumulates per-variant daily/weekly totals (weighted by occurrences)
- Daily average = weekly totals ÷ days
- Loads goals via `loadGoals()`, displays goal ranges next to each macro label
- Values colored green (`text-success`) when goal met, red (`text-error`) when violated
- Updates: summary-calories, summary-protein, summary-carbs, summary-fat, cost-per-day, cost-per-week, variant-breakdown

### Input Wiring
- `input-days` → `renderMealGrid()` → `updateSummary()`
- `input-meals`, `input-variants` → `renderMealGrid()` (calls `updateSummary()` at end)
- Print button → `generatePrintView()`
- Clear button (`#btn-clear`) → confirms, clears `gridState`, resets `nextEntryId`, calls `clearStorage()`, re-renders
- `#view-toggle` → switches between recipes/ingredients sidebar
- `#tab-manual` / `#tab-agent` → switches between manual grid and agent chat view

Storage operations called automatically on mutations via `state.js`.

---

## Goals & TDEE Calculator (`src/goals-ui.js`)

### Goals Settings Modal (`#goals-modal`)
Set daily macro target ranges (at-least / at-most) for calories, protein, carbs, fat. Saved to localStorage via `loadGoals()`/`saveGoals()`. Real-time: every input change persists and triggers `updateSummary()` to color-code results immediately.

### TDEE Calculator Modal (`#goals-calc-modal`)
Mifflin-St Jeor based calculator accessible from the summary card gear button area. Supports metric and imperial units (toggle persisted in localStorage). Takes age, gender, height, weight, activity level, and weekly goal (lbs/week gain/lose). Calculates BMR → TDEE → macro targets:
- Protein: 2.2 g/kg bodyweight
- Fat: 35% of target calories
- Carbs: remaining calories
- Calorie delta: ±500 kcal per lb/week goal

Results shown inline with an "Apply to goals" button that persists the calculated targets to `loadGoals()`.

---

## Print View (`generatePrintView`)

Opens clean print-ready window (no chrome) with three sections:

1. **Summary** — plan config, daily average macros, cost/day and /week, per-variant breakdown table
2. **Shopping List** — all ingredients aggregated (name, total quantity+unit, estimated cost), sorted alphabetically, grand total. Quantities rounded to nearest whole number.
3. **Meal Prep Guide** — one block per unique recipe with `prepNotes`, showing total scaled ingredient amounts for the week (`multiplier × occurrences` summed across slots)

Reuses `computeOccurrences()`, `calculateRecipeMacros()`, `fmtNum()`. Iterates `gridState` with same in-bounds logic as `updateSummary()`. Calls `window.print()` after writing document.

---

## Persistence (`localStorage`)

**Plan state** — key `bulk-meal-planner-v1` on every mutation:

```json
{
  "gridState": { "0-0": [{"entryId": 0, "recipeId": "chicken-rice", "multiplier": 1}] },
  "nextEntryId": 3,
  "days": "7",
  "meals": "3",
  "variants": "3"
}
```

- `saveToStorage()` — serialises `gridState` (Map→object via `Object.fromEntries`), writes to localStorage
- `loadFromStorage()` — reads/parses, returns `null` on error
- `clearStorage()` — removes key
- `initGridFromStorage()` called on `DOMContentLoaded` before `renderMealGrid()`

**Storage key versioning** — increment suffix (`-v2`, etc.) on breaking changes to ignore old data.

**Custom recipes** — key `bulk-meal-planner-recipes`. Functions: `saveCustomRecipe()`, `getCustomRecipe()`, `deleteCustomRecipe()`, `isRecipeModified()`.

**Custom ingredients** — key `bulk-meal-planner-ingredients` (flat object keyed by id). Loaded via `mergeCustomIngredientsIntoIngredients()` in `src/data.js`.

**Goals** — key `bulk-meal-planner-goals`. Stores macro targets for daily average display:
```json
{
  "calories": { "atLeast": 2500, "atMost": 3000 },
  "protein": { "atLeast": 150, "atMost": null },
  "carbs": { "atLeast": null, "atMost": 250 },
  "fat": { "atLeast": null, "atMost": null }
}
```
- `loadGoals()` — loads from localStorage, seeds defaults on first call
- `saveGoals(goals)` — persists to localStorage
- `checkGoal(actual, goal)` — returns `'violated'`, `'ok'`, or `'no_goal'`

**TDEE calculator units** — key `bulk-meal-planner-calc-units` (`"metric"` or `"imperial"`).

**Edit modal behavior**:
- Recipes: create via `+ New Recipe` button, edit via pencil icon. Modal edits title, serving size, ingredients (search typeahead), amounts. New recipes get slugified ID + timestamp, pushed to `ALL_RECIPES`, persisted. Delete/revert only for custom/modified recipes. Changes trigger `onRecipeModifiedCallback` → refresh list, grid, summary.
- Ingredients: modal supports "Per 100g" or "Per serving" macro entry (normalizes to `macrosPer100g`), price entry normalizes to `pricePerUnit` (supports Per unit / Per serving / Per package modes). Category field has autocomplete from union of recipe+ingredient categories + defaults `meal`, `drink`, `snack`. "Also add as a recipe" toggles `isRecipe`. **Base ingredients read-only** (no `custom: true` flag). Delete blocked when referenced by non-auto-generated recipes (blocking recipes shown inline). Changes trigger `onIngredientChangedCallback` → re-render sidebar, grid, summary.

---

## Sidebar & Categories

**View toggle** (`#view-toggle`):
- `recipes` — draggable recipe cards, `#recipes-subheader` (category filter) visible
- `ingredients` — non-draggable ingredient cards, category filter hidden

`main.js` owns toggle wiring (`applyView`) and `#btn-new-item` label swap.

**Recipe categories** — dropdown populated at runtime by `populateCategoryDropdowns()` from union of all `ALL_RECIPES` `category` values + defaults (`meal`, `drink`, `snack`). `renderRecipeList()` filters by `#recipe-category`. Auto-generated recipes inherit ingredient `category`. All categories functionally identical; field is UI filter only. New categories appear automatically when created.

---

## Adding Content

### Multi-Ingredient Recipe
1. Add ingredients to `INGREDIENTS` in `src/data.js`
2. Add recipe to `RECIPES` in `src/data.js`:
   ```javascript
   {
     id: string,           // unique kebab-case
     category: string,     // "meal" | "drink" | "snack" | custom
     name: string,
     servingSize: number,
     ingredients: [{ id, amount }],
     prepNotes?: string
   }
   ```

### Single-Ingredient Recipe
Add ingredient with `isRecipe: true`, `servingSize: <number>`, optional `category`:
```javascript
{
  name: string,
  macrosPer100g: { calories, protein, carbs, fat },
  pricePerUnit: number,
  unit: string,
  isRecipe: true,
  servingSize: number,
  category?: string      // defaults to "meal"
}
```

Auto-generates recipe with same `id`/`name`/`category`, `ingredients: [{ id, amount: servingSize }]`, no `prepNotes`.

---

## File Architecture

```
src/
├── data.js
├── state.js
├── calculations.js
├── lucide-init.js
├── recipe-ui.js
├── ingredient-ui.js
├── grid-ui.js
├── goals-ui.js
├── print.js
├── agent-state.js
├── agent-api.js
├── agent-ui.js
├── main.js
└── styles.css
```

**Dependencies:**
- `main.js` imports: styles.css, tokens.css, base.css, layout.css, components-*.css, utilities.css, lucide-init, sortablejs, recipe-ui, ingredient-ui, grid-ui, print, state, calculations, data, agent-ui, goals-ui
- `grid-ui.js` imports: state, calculations, data
- `recipe-ui.js` imports: calculations, data (callback pattern, no circular)
- `ingredient-ui.js` imports: calculations, data (callback pattern)
- `goals-ui.js` imports: calculations, grid-ui
- `print.js` imports: state, calculations, data
- `agent-state.js` imports: lucide-init, state, calculations (no DOM)
- `agent-api.js` imports: lucide-init, agent-state (no DOM, fetches only)
- `agent-ui.js` imports: lucide-init, agent-state, agent-api (DOM rendering only)
- `calculations.js` imports: data

---

## Styling

`css/` split into seven layers: `tokens.css` (DaisyUI overrides / CSS custom properties), `base.css` (resets, typography, scrollbars, SortableJS helpers), `layout.css` (app shell regions), four `components-*.css` (UI elements by group), `utilities.css` (empty-state helpers). See `css/style.md` for guide, naming, import order. Add new styles by purpose; never add to `tokens.css` unless new custom properties.

CSS is imported via `main.js` (processed through Vite + PostCSS/Tailwind), not via `<link>` tags in `index.html`.

---

## Agent Chat (`src/agent-ui.js`, `src/agent-api.js`, `src/agent-state.js`)

The agent system is split into three files by concern:

### `src/agent-state.js` — Conversation & settings state (no DOM)
**Feature flag** — `AGENT_HISTORY_ON_RELOAD` in `agent-ui.js` controls localStorage history restore on load (default: `false`).

**Conversation state** — module-level `conversation` array:
```javascript
{ type: 'user' | 'agent' | 'tool_call' | 'tool_cluster', content, timestamp, thinking?, toolName?, params?, result? }
```

**Storage** — key `bulk-meal-planner-conversation`. Every `pushMessage()` triggers `saveConversation()`.

**Plan snapshot** — `capturePlanSnapshot()` reads DOM inputs + gridState + goals and returns a structured snapshot. `formatStateMessage()` formats it for the model context. On each user message, `maybeAppendStateUpdate()` checks if the plan changed since the last snapshot and, if so, injects a `<state_update>` block into the conversation (hidden from the UI, visible to the model).

**Settings** — key `bulk-meal-planner-agent-settings`. `loadAgentSettings()`/`saveAgentSettings()` for `{ apiKey, model }`.

### `src/agent-api.js` — API calls & UI controls
**OpenRouter** — `callOpenRouter(userMessage)`:
1. Reads `apiKey`, `model` from agent settings (`loadAgentSettings()`)
2. Falls back to inline error if no API key
3. Builds messages from last `AGENT_CONTEXT_WINDOW` (20) turns + system prompt, POSTs to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`. API key passed through `toAscii()` to strip non-ASCII
4. After 400ms delay shows "Thinking…" bubble, updates in-place from stream
5. On completion replaces bubble with final `content`, appends error on failure
6. `cancelAgentTask()` calls `abortController.abort()`, removes thinking node from DOM and state

**Send/Stop button** — `#agent-send` toggles: Send (paper plane) appends message → calls `callOpenRouter()`; Stop (square, amber) calls `cancelAgentTask()`. Enter key in `#agent-input` triggers send. Empty messages ignored.

**Settings button** — `#agent-settings-btn` (gear icon) opens `#agent-settings-modal` (`<dialog>`). Contains: masked `#agent-api-key` input, `#agent-model-select` dropdown (populated with static models, disabled until key typed). Save persists to `bulk-meal-planner-agent-settings`. Wired in `initAgentSettings()`.

### `src/agent-ui.js` — DOM rendering
**Rendering** — `renderAgentMessages(messages)` groups consecutive `tool_call` into `tool_cluster`, renders all. `addAgentMessage(msg)` appends single message to DOM. State update messages (starting with `<state_update>`) are filtered from display.

**Exports:**
```javascript
export function initAgentView()
export function renderAgentMessages()
export function addAgentMessage()
export function isAtBottom()
```

### Standalone conversation viewer
`conversation-view.html` — opens conversation data from `localStorage` key `bulk-meal-planner-conversation` in a clean standalone page for review/debugging.

---

## Known Gaps

- Drag reorder doesn't sync to gridState (cosmetic only)
- Mobile not optimized (desktop-first per SPEC)
- ES modules required (modern browser with Vite dev server or built output)
- Agent cannot call tools (text-only protocol)
- No "Clear chat" button (function exists, no UI trigger)

---

## Print View Behavior Notes

- **Meal Prep Guide** — only recipes with `prepNotes`. Single-ingredient recipes excluded.
- **Shopping List** — all ingredients from all recipes, including auto-generated.
- **Daily Meal Schedule** — shows all recipes used, regardless of prep notesRefactored agent chat.