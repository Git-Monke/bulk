# Bulk — Meal Prep Planner: Project Spec

## Overview

A single-page web app for planning bulk meal prep. The user configures a weekly meal plan by dragging recipes into slots, then exports a grocery list and meal prep guide formatted for printing. No backend, no build step — one HTML file hosted on GitHub Pages.

---

## Stack

- **HTML** — single `index.html`, no framework
- **DaisyUI v4** — component styling via CDN
- **Tailwind CSS** — utility classes via CDN
- **SortableJS** — drag and drop via CDN

```html
<link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1/Sortable.min.js"></script>
```

All state lives in JavaScript variables. No localStorage, no backend.

---

## User Controls

Three inputs at the top of the page:

| Control | Default | Description |
|---|---|---|
| Days | 7 | How many days to plan for |
| Meals per day | 3 | How many meal slots per day pattern |
| Variants | 3 | How many unique day patterns (e.g. 3 = day A, B, C repeating) |

The variant grid repeats across the number of days. For example: 7 days with 3 variants = the pattern A→B→C→A→B→C→A.

---

## Layout

### Sidebar (left)
- Flat list of all available recipes
- Each recipe card shows: name, macros summary, price per serving
- Cards are draggable into meal slots

### Main Grid (center)
- Grid dimensions: **variants (columns) × meals per day (rows)**
- Each cell is a droppable slot that can hold **multiple stacked recipe cards**
- Empty slots show a placeholder (e.g. "Drop a meal here")
- Filled slots show one meal card per dropped recipe, stacked vertically

### Totals Panel (right or bottom)
- Aggregated daily macros across all variant slots
- Total estimated cost per day and per week

---

## Meal Slot Card

When a recipe is dropped into a slot, a card is added to that slot's stack showing:

- Recipe name
- Serving size slider: **0.1x to 4x** (default 1x), step 0.1
- All values recalculate live as the slider moves:
  - Calories
  - Protein (g)
  - Carbs (g)
  - Fat (g)
  - Total weight (g)
  - Price for this serving
- A remove button to remove this card from the stack

Multiple recipes can be stacked in a single slot. Each has its own independent slider.

**Number formatting:** all values displayed to 2 significant figures.
- 321.432 kcal → 320 kcal
- 1.534g → 1.5g
- $1.876 → $1.9

---

## Recipe Data Schema

Ingredients Table

A flat lookup of all ingredients. Each ingredient defines its own macros per 100g and its price per unit:

```js
const INGREDIENTS = {
  "chicken-breast": {
    name: "Chicken breast",
    macrosPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    pricePerUnit: 0.012,  // price per gram
    unit: "g"
  },
  "white-rice-dry": {
    name: "White rice (dry)",
    macrosPer100g: { calories: 365, protein: 7, carbs: 80, fat: 0.6 },
    pricePerUnit: 0.003,
    unit: "g"
  },
  "olive-oil": {
    name: "Olive oil",
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    pricePerUnit: 0.008,
    unit: "ml"
  }
}
```

Recipes

Recipes reference ingredients by key with an amount for a 1x serving. Macros and price per serving are fully derived — never hardcoded on the recipe:

```js
const RECIPES = [
  {
    id: "chicken-rice",
    name: "Chicken & Rice",
    servingSize: 450,   // grams total per 1x serving
    ingredients: [
      { id: "chicken-breast", amount: 200 },
      { id: "white-rice-dry", amount: 100 },
      { id: "olive-oil", amount: 10 }
    ]
    // macros and pricePerServing derived at runtime from INGREDIENTS
  }
]
```

All ingredient amounts and derived macros scale linearly with the serving multiplier, which goes from 0.1 to 4.

All numbers are rounded to 2 significant digits except for cost which is rounded to the nearest cent.

---

## Meal Prep Logic

The variant grid repeats across the number of days. The app calculates how many times each variant slot appears in the full week:

```
occurrences[variantIndex] = Math.ceil(days / variants)
// with adjustment for the last variant if days % variants !== 0
```

When the grid is reconfigured (days/variants/meals changed), existing slot data is **always preserved** — slots outside the current grid bounds are kept in memory but excluded from calculations. This prevents accidental data loss.

For each unique recipe used anywhere in the grid, the app aggregates:
- Total servings needed (sum of slot multipliers × occurrences)
- Total ingredient quantities
- Total cost

This produces one unified cook for each recipe for the whole week.

---

## Export (Print View)

A **Print** button triggers `window.print()`.

Print CSS hides the app UI entirely and renders only:

### Section 1: Grocery List
All ingredients across all recipes, aggregated into a single list:
- Ingredient name
- Total quantity needed (with unit)
- Estimated total cost

### Section 2: Meal Prep Guide
One entry per unique recipe used in the plan:
- Recipe name
- Total quantity to cook (scaled ingredients)
- Brief prep notes (hardcoded per recipe, e.g. "Cook rice, season chicken, divide into containers")

---

## Visual Design

- **Theme:** airy, light, clean — DaisyUI `light` or `emerald` theme
- **Layout:** generous whitespace, not dense
- **Typography:** DaisyUI defaults are fine
- **Responsive:** desktop-first, mobile not a priority for v1

---

## Out of Scope (v1)

- User-defined recipes
- Saving/loading plans
- Mobile optimization
- Multiple export formats (PDF, markdown)
- Recipe search or filtering
- Authentication or accounts
