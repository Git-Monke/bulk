# Changelog

## [Unreleased] — 2026-04-29

### Added
- **localStorage persistence** — the meal grid, multipliers, and input values (days, meals/day, variants) are automatically saved to `localStorage` and restored on page reload. No data is lost between browser restarts.
- **Clear button** — a "Clear" button in the navbar removes all meals from the grid and wipes persisted data after a confirmation prompt.


### Added
- **Print view (`generatePrintView`)** — the Print button now opens a clean, human-readable document in a new tab instead of printing the raw app UI. The document contains three sections:
  1. **Summary** — plan config, daily average macros, cost per day/week, and a per-variant breakdown table.
  2. **Shopping list** — all ingredients aggregated across the full plan (total quantity + estimated cost per ingredient, alphabetically sorted, with grand total).
  3. **Meal prep guide** — one block per unique recipe with total scaled ingredient amounts to cook for the whole week plus the recipe’s prep notes.

### Added
- **gridState model** — persistent in-memory state (`Map`) tracking all dropped recipes across every slot, keyed by `"variant-meal"`. State is never cleared on grid resize; out-of-bounds slots are excluded from calculations only.
- **Slot card rendering** — dropped recipes now render as proper cards with recipe name, scaled macros (calories, protein, carbs, fat, total weight, price), a serving size slider (0.1×–4×, step 0.1), and a remove button.
- **Live recalculation** — slider adjustments instantly update the card's macro display and the summary panel.
- **`updateSummary()` implementation** — daily average macros and cost, weekly total cost, and per-variant breakdown are now fully calculated from gridState. Uses correct occurrences weighting (`days % variants` logic).
- **Variant breakdown panel** — right sidebar now shows per-day-variant macro and cost totals with occurrence counts.
- **Grid hydration on rebuild** — changing meals/variants re-renders the grid while restoring all existing cards from gridState.
- **Day variant labels** — grid columns now labeled "Day A", "Day B", etc.
- `input-days` now live-updates summary without rebuilding the grid.

### Changed
- SPEC updated: slots support multiple stacked recipes (not one per slot), slider range is 0.1–4×, grid resize preserves all data.
