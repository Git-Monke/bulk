// ============================================
// GRID UI
// ============================================
//
// Meal grid rendering, slot cards, and summary calculations.

import { initIcons } from './lucide-init.js';
import { INGREDIENTS, ALL_RECIPES } from './data.js';
import {
  gridState,
  getSlotEntries,
  stateKey,
  addEntry,
  removeEntry,
  updateEntryMultiplier,
  nextEntryId,
  initFromStorage
} from './state.js';
import {
  getRecipe,
  isRecipeModified,
  calculateRecipeMacros,
  computeOccurrences,
  fmtNum,
  loadFromStorage,
  loadGoals,
  checkGoal
} from './calculations.js';

// -------------------------------------------
// SLOT CARD RENDERING
// -------------------------------------------

function buildSlotCard(variant, meal, entry) {
  const recipe = getRecipe(entry.recipeId);
  if (!recipe) return null;

  const isModified = isRecipeModified(entry.recipeId);
  const card = document.createElement('div');
  card.className = 'slot-card num' + (isModified ? ' is-modified' : '');
  card.dataset.entryId = entry.entryId;

  function renderMacros() {
    const m = calculateRecipeMacros(recipe, entry.multiplier);
    const rawWeight = m.rawWeight;
    const preppedWeight = m.preppedWeight;
    // Show prepped weight in the UI (what you actually eat)
    const displayWeight = preppedWeight > 0 ? preppedWeight : recipe.servingSize * entry.multiplier;
    // Show tooltip with raw vs prepped if they differ significantly
    const weightLabel = preppedWeight !== rawWeight && rawWeight > 0
      ? `${fmtNum(preppedWeight)}g cooked`
      : `${fmtNum(displayWeight)}g`;
    return `
      <div class="slot-macros">
        <span><span class="stat-num">${fmtNum(m.calories)}</span> kcal</span>
        <span><span class="stat-num">${fmtNum(m.protein)}g</span> prot</span>
        <span><span class="stat-num">${fmtNum(m.carbs)}g</span> carbs</span>
        <span><span class="stat-num">${fmtNum(m.fat)}g</span> fat</span>
        <span class="weight-display"><span class="stat-num">${weightLabel}</span></span>
        <span class="price">${fmtNum(m.price, true)}</span>
      </div>
    `;
  }

  function rebuild() {
    card.innerHTML = `
      <div class="slot-card-head">
        <span class="slot-card-name">${recipe.name}</span>
        <button class="slot-card-remove remove-btn" title="Remove" aria-label="Remove">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>
      <div class="macros-display">${renderMacros()}</div>
      <div class="slider-row">
        <input
          type="range"
          class="bulk-slider"
          min="0.1" max="4" step="0.1"
          value="${entry.multiplier}"
        >
        <span class="multiplier-label">${entry.multiplier.toFixed(1)}×</span>
      </div>
    `;

    card.querySelector('.remove-btn').addEventListener('click', () => {
      removeEntry(variant, meal, entry.entryId);
      card.remove();
      updateSummary();
    });

    card.querySelector('input[type=range]').addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      entry.multiplier = val;
      updateEntryMultiplier(variant, meal, entry.entryId, val);
      card.querySelector('.multiplier-label').textContent = val.toFixed(1) + '×';
      card.querySelector('.macros-display').innerHTML = renderMacros();
      updateSummary();
    });
  }

  rebuild();
  return card;
}

// -------------------------------------------
// MEAL GRID RENDERING
// -------------------------------------------

export function renderMealGrid() {
  const container = document.getElementById('meal-grid');
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;

  const variantLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  container.className = 'flex gap-5 h-full';
  container.innerHTML = '';

  for (let v = 0; v < variants; v++) {
    const col = document.createElement('div');
    col.className = 'day-col';

    const colHeader = document.createElement('div');
    colHeader.className = 'day-header';
    colHeader.innerHTML = `
      <span class="day-header-label">Day</span>
      <span class="day-header-name">${variantLabels[v] || (v + 1)}</span>
    `;
    col.appendChild(colHeader);

    for (let m = 0; m < mealsPerDay; m++) {
      const slot = document.createElement('div');
      slot.className = 'meal-slot';
      slot.dataset.variant = v;
      slot.dataset.meal = m;

      const header = document.createElement('div');
      header.className = 'meal-slot-header';
      header.textContent = `Meal ${m + 1}`;
      slot.appendChild(header);

      const stack = document.createElement('div');
      stack.className = 'recipe-stack';
      stack.dataset.variant = v;
      stack.dataset.meal = m;

      // Hydrate from gridState
      const entries = getSlotEntries(v, m);
      if (entries.length !== 0) {
        for (const entry of entries) {
          const cardEl = buildSlotCard(v, m, entry);
          if (cardEl) stack.appendChild(cardEl);
        }
      }

      slot.appendChild(stack);
      col.appendChild(slot);
    }

    container.appendChild(col);
  }

  // Wire up Sortable for every stack
  document.querySelectorAll('.recipe-stack').forEach(stack => {
    new Sortable(stack, {
      group: { name: 'recipes', pull: true, put: true },
      animation: 150,
      ghostClass: 'opacity-50',
      sort: true,
      filter: 'input[type=range], button',
      preventOnFilter: false,
      onAdd(evt) {
        const rawNode = evt.item;
        const recipeId = rawNode.dataset.recipeId;

        const variant = parseInt(stack.dataset.variant);
        const meal = parseInt(stack.dataset.meal);

        // Remove raw clone from DOM - we'll insert our own rendered card
        rawNode.remove();

        // Remove placeholder if present
        const ph = stack.querySelector('.slot-placeholder');
        if (ph) ph.remove();

        if (!recipeId) return;

        const entry = addEntry(variant, meal, recipeId);
        const cardEl = buildSlotCard(variant, meal, entry);
        if (cardEl) stack.appendChild(cardEl);

        updateSummary();
      },
    });
  });

  updateSummary();
  initIcons();
}

// -------------------------------------------
// SUMMARY CALCULATIONS
// -------------------------------------------

export function updateSummary() {
  const days = parseInt(document.getElementById('input-days').value) || 1;
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;

  const occurrences = computeOccurrences(days, variants);

  // Weekly totals
  let weekly = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };

  // Per-variant totals (for breakdown panel)
  const perVariant = Array.from({ length: variants }, () =>
    ({ calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 })
  );

  for (let v = 0; v < variants; v++) {
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);

        // Add once to per-variant (one day's worth)
        perVariant[v].calories += macros.calories;
        perVariant[v].protein += macros.protein;
        perVariant[v].carbs += macros.carbs;
        perVariant[v].fat += macros.fat;
        perVariant[v].price += macros.price;

        // Add weekly weighted by how many times this variant appears
        weekly.calories += macros.calories * occurrences[v];
        weekly.protein += macros.protein * occurrences[v];
        weekly.carbs += macros.carbs * occurrences[v];
        weekly.fat += macros.fat * occurrences[v];
        weekly.price += macros.price * occurrences[v];
      }
    }
  }

  const dailyAvg = {
    calories: weekly.calories / days,
    protein: weekly.protein / days,
    carbs: weekly.carbs / days,
    fat: weekly.fat / days,
  };

  // Load goals
  const goals = loadGoals();

  // Helper to update a stat row with goal info
  function updateStatRow(elId, label, value, goal, unit = '') {
    const wrapper = document.getElementById(elId).closest('div');
    const dt = wrapper.querySelector('dt');
    const dd = wrapper.querySelector('dd');

    const formattedValue = fmtNum(value) + (unit ? ' ' + unit : '');
    const goalStatus = checkGoal(value, goal);
    let goalText = '';

    if (goal.atLeast !== null || goal.atMost !== null) {
      if (goal.atLeast !== null && goal.atMost !== null) {
        goalText = ` (${goal.atLeast}-${goal.atMost}${unit})`;
      } else if (goal.atLeast !== null) {
        goalText = ` (≥${goal.atLeast}${unit})`;
      } else {
        goalText = ` (≤${goal.atMost}${unit})`;
      }
    }

    dt.textContent = label + goalText;
    dd.textContent = formattedValue;

    // Color: green when met, red when violated
    dd.classList.remove('text-success', 'text-error');
    dd.style.removeProperty('color');
    if (goalStatus === 'ok' && (goal.atLeast !== null || goal.atMost !== null)) {
      dd.classList.add('text-success');
    } else if (goalStatus === 'violated') {
      dd.classList.add('text-error');
    }
  }

  // Update summary panel
  updateStatRow('summary-calories', 'Calories', dailyAvg.calories, goals.calories, 'kcal');
  updateStatRow('summary-protein', 'Protein', dailyAvg.protein, goals.protein, 'g');
  updateStatRow('summary-carbs', 'Carbs', dailyAvg.carbs, goals.carbs, 'g');
  updateStatRow('summary-fat', 'Fat', dailyAvg.fat, goals.fat, 'g');

  document.getElementById('cost-per-day').textContent = fmtNum(weekly.price / days, true);
  document.getElementById('cost-per-week').textContent = fmtNum(weekly.price, true);

  // Variant breakdown
  const variantLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const breakdownEl = document.getElementById('variant-breakdown');
  breakdownEl.innerHTML = '';

  let anyData = false;
  for (let v = 0; v < variants; v++) {
    const vd = perVariant[v];
    if (vd.calories === 0 && vd.price === 0) continue;
    anyData = true;

    const row = document.createElement('div');
    row.className = 'variant-row num';
    row.innerHTML = `
      <div class="variant-row-head">
        <span class="variant-row-name">Day ${variantLabels[v] || (v + 1)}</span>
        <span class="variant-row-occ">×${occurrences[v]}</span>
      </div>
      <div class="variant-row-stats">
        <span><span class="stat-num">${fmtNum(vd.calories)}</span> kcal</span>
        <span><span class="stat-num">${fmtNum(vd.protein)}g</span> prot</span>
        <span><span class="stat-num">${fmtNum(vd.carbs)}g</span> carbs</span>
        <span><span class="stat-num">${fmtNum(vd.fat)}g</span> fat</span>
      </div>
      <div class="variant-row-price">${fmtNum(vd.price, true)} / day</div>
    `;
    breakdownEl.appendChild(row);
  }

  if (!anyData) {
    breakdownEl.innerHTML = '<p class="empty-line">No meals planned yet</p>';
  }
}

// -------------------------------------------
// STORAGE INITIALIZATION
// -------------------------------------------

export function initGridFromStorage() {
  const saved = loadFromStorage();
  if (saved) {
    if (saved.days) document.getElementById('input-days').value = saved.days;
    if (saved.meals) document.getElementById('input-meals').value = saved.meals;
    if (saved.variants) document.getElementById('input-variants').value = saved.variants;
    initFromStorage(saved);
  }
}
