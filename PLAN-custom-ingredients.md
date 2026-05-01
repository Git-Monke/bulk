# Plan: Custom Ingredients

## Overview

Add the ability to create, edit, and delete custom ingredients. Ingredients are displayed in a dedicated sidebar view (switchable via a dropdown). Ingredients are **not draggable** — only recipes are. Ingredients can optionally be flagged as "also a recipe", which auto-generates a single-ingredient recipe (identical to the existing `isRecipe: true` mechanic for built-in ingredients like Whole Milk).

---

## 1. Sidebar Changes

### 1.1 Dropdown replaces "Recipes" title

Replace the static `<h2>Recipes</h2>` with a `<select id="view-toggle">` with two options:

```html
<select id="view-toggle" class="select-pill">
  <option value="recipes">Recipes</option>
  <option value="ingredients">Ingredients</option>
</select>
```

This replaces the existing `#recipe-category` select (which stays inside the recipe list only). The new `#view-toggle` is always visible.

### 1.2 Category filter moves inside Recipes view

The existing `<select id="recipe-category">` (meal/drink/snack) currently lives in the sidebar header alongside "Recipes". It moves down — becomes a sub-header inside the recipe list, only shown when `view-toggle === "recipes"`.

```html
<!-- Inside sidebar, conditionally shown -->
<div id="recipes-subheader" class="hidden">
  <select id="recipe-category" class="select-pill mt-2">
    <!-- populated from ALL_RECIPES categories at runtime -->
  </select>
</div>
```

The category options are derived from `ALL_RECIPES` + custom ingredients at runtime (no hardcoded list). Any new category typed by the user is created on save and will appear in the dropdown on next load.

### 1.3 "New Recipe" / "New Ingredient" button

The sidebar header button changes based on current view:

| View | Button text | Action |
|------|-------------|--------|
| Recipes | "New Recipe" | Opens recipe edit modal (existing behavior) |
| Ingredients | "New Ingredient" | Opens ingredient edit modal |

Implemented as a single `<button id="btn-new-item">` whose label and listener swap when the view toggle changes.

### 1.4 Recipe list rendering

`renderRecipeList()` (recipe-ui.js) only runs when `view-toggle === "recipes"`. Unchanged behavior.

### 1.5 Ingredient list rendering

New function `renderIngredientList()` in recipe-ui.js:

- Filters `INGREDIENTS` (including custom merged) by the active category
- Each card shows: name, macros per 100g (or per serving if "price per serving" was used — stored normalized to per 100g), unit, category badge, edit button
- Cards have the **same visual style** as recipe cards (same dimensions, shadow, typography)
- **Not draggable** — no SortableJS initialization, no `data-recipe-id`
- Edit button opens the ingredient modal

```js
// Card structure (non-draggable)
<div class="ingredient-card" data-ingredient-id="${id}">
  <button class="edit-ingredient-btn">...</button>
  <div class="ingredient-name">${ingredient.name}</div>
  <div class="ingredient-card-stats">
    <span>${fmtNum(calories)} kcal</span>
    <span>${fmtNum(protein)}g prot</span>
    <span>${fmtNum(carbs)}g carbs</span>
    <span>${fmtNum(fat)}g fat</span>
  </div>
  <div class="ingredient-unit">per 100g • ${ingredient.unit}</div>
  <div class="ingredient-price">${fmtNum(ingredient.pricePerUnit, true)} / ${ingredient.unit}</div>
</div>
```

---

## 2. Ingredient Data Schema

Custom ingredients stored in `localStorage` under key `bulk-meal-planner-ingredients` as a flat object keyed by ingredient ID.

```js
{
  "my-ingredient-id": {
    id: "my-ingredient-id",
    name: "String",
    category: "String",           // user-typed, can be anything
    macrosPer100g: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number
    },
    pricePerUnit: Number,         // always stored per unit (g/ml/etc.)
    unit: "String",               // free text: "g", "ml", "slice", "whole", etc.
    isRecipe: Boolean,            // if true, auto-generates a single-ingredient recipe
    servingSize: Number | null   // required when isRecipe is true; null otherwise
  }
}
```

### 2.1 Per-100g vs Per-Serving Input

The modal offers two modes for entering macros/price:

| Mode | Label | User enters | Stored |
|------|-------|-------------|--------|
| Per 100g | "Macros per 100g" | calories, protein, carbs, fat per 100g | macrosPer100g (unchanged) |
| Per serving | "Macros per serving" | calories, protein, carbs, fat per serving + serving size in grams | macrosPer100g (derived: value/100*grams) |

Same logic applies to price: user enters either "price per unit" (g/ml) or "price per serving" with serving size, stored as `pricePerUnit`.

Implementation: two radio buttons "Per 100g" / "Per serving" at the top of the macros section. When "Per serving" is selected, show an additional "Serving size (g)" field. On save, derive and normalize to per-100g.

### 2.2 Serving Size

Only shown/required when "is also a recipe" checkbox is checked. Default: 100g. User can override.

### 2.3 Category

Free text input with an autocomplete dropdown. Dropdown suggestions come from:
1. All categories currently present in `ALL_RECIPES` (base + custom)
2. All categories currently present in custom ingredients storage
3. Hardcoded defaults: "meal", "drink", "snack"

The dropdown filters as the user types. If the user types a new category not in the list, it is saved as-is (no blocking). On the main page, the view toggle dropdown (Recipes / Ingredients) and the category sub-filter within Recipes are both populated from the same live union of categories.

### 2.4 PreppedMultiplier

Not exposed to users. Custom ingredients default to `preppedMultiplier: 1` (no cooking weight adjustment).

---

## 3. Storage

### 3.1 New storage key

`bulk-meal-planner-ingredients` — flat object of custom ingredients keyed by ID.

```js
// In calculations.js
const CUSTOM_INGREDIENTS_KEY = 'bulk-meal-planner-ingredients';
```

### 3.2 Load & merge

On app init, custom ingredients are loaded from storage and merged into `INGREDIENTS`:

```js
// In calculations.js (or data.js after calculations loads)
export function mergeCustomIngredientsIntoIngredients() {
  const custom = loadCustomIngredients();
  Object.assign(INGREDIENTS, custom);
}
```

Called from `main.js` init sequence after `loadCustomRecipesIntoAll()`.

### 3.3 Auto-generated recipes

When `isRecipe: true` is set on a custom ingredient, a recipe entry is added to `ALL_RECIPES`:

```js
{
  id: ingredient.id,
  category: ingredient.category,
  name: ingredient.name,
  servingSize: ingredient.servingSize,
  ingredients: [{ id: ingredient.id, amount: ingredient.servingSize }]
}
```

When `isRecipe` is toggled from `true` → `false`, the auto-generated recipe entry is removed from `ALL_RECIPES`.

---

## 4. Ingredient Modal

New `<dialog id="ingredient-modal">` in index.html, styled to match the existing recipe edit modal.

### 4.1 Fields

```
[Name] _________________________

Category  [_________________________ ▼]
          (autocomplete suggestions)

Macros entry mode:  ○ Per 100g   ● Per serving (Serving size: ___ g)

Macros per 100g:       Macros per serving:
Calories    [____]        Calories    [____]
Protein (g) [____]        Protein (g) [____]
Carbs (g)   [____]        Carbs (g)   [____]
Fat (g)     [____]        Fat (g)     [____]

Price: [____] per [____] (unit dropdown + free text fallback)

☐ Also add as a recipe
  Serving size: [____] g  (only shown when checkbox is checked)
```

### 4.2 Unit input

Dropdown with common options: g, ml, slice, whole, each, cup, tbsp, tsp, oz, lb. User can type free text to override.

### 4.3 Buttons

- **Cancel** — closes modal, no save
- **Save** — validates, normalizes to per-100g, saves to localStorage, merges into INGREDIENTS, updates ALL_RECIPES if isRecipe, re-renders ingredient list

No real-time stats update — macros are only calculated on save.

### 4.4 Validation on save

- Name required, non-empty
- At least one macro (calories, protein, carbs, or fat) must be > 0
- Price > 0
- Unit required
- If "also a recipe" is checked: servingSize > 0

### 4.5 Delete button

Shown only for custom ingredients (not base/built-in). On click:
1. Check if any recipe in `ALL_RECIPES` (including base RECIPES) has this ingredient ID in its `ingredients[]` array
2. If yes: show inline error message in the modal "Cannot delete: used in N recipe(s)" with the recipe names listed
3. If no: confirm dialog "Delete [name]?" then delete from storage, remove from INGREDIENTS, remove auto-generated recipe from ALL_RECIPES, re-render

Base ingredients (hardcoded in data.js) are **not deletable** — the delete button is hidden for them.

### 4.6 Reset button

Shown only for custom ingredients. Reverts to the saved state (re-loads from storage).

---

## 5. Ingredient Search in Recipe Modal

When editing a recipe and clicking "Add ingredient", the search typeahead in the recipe modal should now include **custom ingredients** in the results (filtered from `INGREDIENTS` as always). No code changes needed here — `INGREDIENTS` now includes custom ingredients after the merge on init.

---

## 6. Recipe Card & Ingredient Card Differences

| Feature | Recipe Card | Ingredient Card |
|---------|------------|----------------|
| Draggable | Yes (SortableJS) | No |
| Edit button | Yes (pencil icon) | Yes (pencil icon) |
| Macro display | Per serving (scaled) | Per 100g + per unit |
| Price display | Per serving | Per unit |
| Multiplier slider | Yes (0.1x–4x) | N/A |
| Remove from grid | Yes | N/A |

---

## 7. Print View — No Changes Required

- **Shopping list** already aggregates all ingredients from all recipes in the grid. Custom ingredients dropped via "also a recipe" will appear automatically. Pure ingredients (not recipes) are never in the grid so don't affect the shopping list directly.
- **Meal Prep Guide** includes recipes with `prepNotes`. Custom ingredients that are recipes (isRecipe=true) have no prepNotes by default and are excluded — same as Whole Milk today. If users want a meal prep entry, they should use the multi-ingredient recipe system.

---

## 8. View Toggle Logic (main.js)

```js
const viewToggle = document.getElementById('view-toggle');
const recipesContainer = document.getElementById('recipe-list');
const recipesSubheader = document.getElementById('recipes-subheader');
const btnNewItem = document.getElementById('btn-new-item');

viewToggle.addEventListener('change', () => {
  const view = viewToggle.value;
  recipesSubheader.classList.toggle('hidden', view !== 'recipes');

  if (view === 'recipes') {
    btnNewItem.textContent = 'New Recipe';
    btnNewItem.onclick = () => openEditModal(null);  // recipe modal
    renderRecipeList();
  } else {
    btnNewItem.textContent = 'New Ingredient';
    btnNewItem.onclick = () => openIngredientModal(null);  // ingredient modal
    renderIngredientList();
  }
});
```

---

## 9. File Changes Summary

| File | Changes |
|------|---------|
| `index.html` | Add `#view-toggle` select, add `#ingredient-modal` dialog, move `#recipe-category` inside list, rename "New Recipe" button to `#btn-new-item`, add `#recipes-subheader` wrapper |
| `src/data.js` | Add `mergeCustomIngredientsIntoIngredients()`, add `removeCustomIngredient()`, add `addCustomIngredientToIngredients()`, `removeAutoGeneratedRecipeFromAll()` |
| `src/calculations.js` | Add `CUSTOM_INGREDIENTS_KEY`, `loadCustomIngredients()`, `saveCustomIngredient()`, `deleteCustomIngredient()`, `normalizeMacrosToPer100g()` helper |
| `src/recipe-ui.js` | Add `renderIngredientList()`, `openIngredientModal()`, `saveIngredient()`, `deleteIngredient()`, `renderIngredientSearch()`, `updateIngredientCategoryDropdown()`, category autocomplete logic |
| `src/main.js` | Add view toggle listener, update init sequence to call `mergeCustomIngredientsIntoIngredients()` |

---

## 10. Dependencies & Order of Operations (init)

```
1. loadFromStorage()          → restore grid state
2. loadCustomRecipesIntoAll()  → merge custom recipes into ALL_RECIPES (existing)
3. mergeCustomIngredientsIntoIngredients()  → merge custom ingredients into INGREDIENTS (new)
4. populateCategoryDropdown()  → build category options from live data (new)
5. renderMealGrid()           → existing
6. renderRecipeList()          → existing
```

---

## Open / Unconfirmed

1. **Should "is also a recipe" ingredients show up in BOTH views?** If a custom ingredient has `isRecipe: true`, should it appear in both the Ingredients list and the Recipes list? My recommendation: **yes** — the Ingredients view shows it as an ingredient (raw data), the Recipes view shows it as a single-ingredient recipe (macros scaled, draggable). Confirm?

2. **Base ingredients editability.** Should users be able to edit base ingredients (chicken-breast, white-rice-dry, etc.) or only custom ones? My rec: **edit only, no delete** for base ingredients. Confirm?

3. **Ingredient card "price per serving" display.** If a user entered macros "per serving" but we store per-100g, should the ingredient card show the per-100g values or the per-serving values? My rec: **always show per-100g on ingredient cards** (consistent with the data model), show per-serving only in the modal during editing. Confirm?
