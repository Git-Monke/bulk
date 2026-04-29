// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateRecipeMacros(recipe, multiplier = 1) {
  let total = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };

  for (const ing of recipe.ingredients) {
    const ingredient = INGREDIENTS[ing.id];
    if (!ingredient) continue;

    const ratio = (ing.amount * multiplier) / 100;
    total.calories += ingredient.macrosPer100g.calories * ratio;
    total.protein  += ingredient.macrosPer100g.protein  * ratio;
    total.carbs    += ingredient.macrosPer100g.carbs    * ratio;
    total.fat      += ingredient.macrosPer100g.fat      * ratio;
    total.price    += ingredient.pricePerUnit * ing.amount * multiplier;
  }

  return total;
}

// 2 significant figures for macros; nearest cent for price
function fmtNum(num, isPrice = false) {
  if (isPrice) return '$' + num.toFixed(2);
  if (num === 0) return '0';
  if (num >= 100) return Math.round(num).toString();
  return parseFloat(num.toPrecision(2)).toString();
}


// ============================================
// STATE
// ============================================

// gridState: Map<"variant-meal", Array<{ entryId, recipeId, multiplier }>>
// Keys are never deleted — out-of-bounds keys are ignored in calculations.
const gridState = new Map();
let nextEntryId = 0;

function stateKey(variant, meal) {
  return `${variant}-${meal}`;
}

function getSlotEntries(variant, meal) {
  const key = stateKey(variant, meal);
  if (!gridState.has(key)) gridState.set(key, []);
  return gridState.get(key);
}

function addEntry(variant, meal, recipeId, multiplier = 1) {
  const entry = { entryId: nextEntryId++, recipeId, multiplier };
  getSlotEntries(variant, meal).push(entry);
  return entry;
}

function removeEntry(variant, meal, entryId) {
  const key = stateKey(variant, meal);
  const arr = gridState.get(key);
  if (!arr) return;
  const idx = arr.findIndex(e => e.entryId === entryId);
  if (idx !== -1) arr.splice(idx, 1);
}

function updateEntryMultiplier(variant, meal, entryId, multiplier) {
  const arr = gridState.get(stateKey(variant, meal));
  if (!arr) return;
  const entry = arr.find(e => e.entryId === entryId);
  if (entry) entry.multiplier = multiplier;
}


// ============================================
// SLOT CARD RENDERING
// ============================================

function buildSlotCard(variant, meal, entry) {
  const recipe = RECIPES.find(r => r.id === entry.recipeId);
  if (!recipe) return null;

  const card = document.createElement('div');
  card.className = 'bg-base-200 rounded-lg p-2 text-xs space-y-1.5';
  card.dataset.entryId = entry.entryId;

  function renderMacros() {
    const m = calculateRecipeMacros(recipe, entry.multiplier);
    const weight = recipe.servingSize * entry.multiplier;
    return `
      <div class="grid grid-cols-2 gap-x-2 text-base-content/70">
        <span>${fmtNum(m.calories)} kcal</span>
        <span>${fmtNum(m.protein)}g prot</span>
        <span>${fmtNum(m.carbs)}g carbs</span>
        <span>${fmtNum(m.fat)}g fat</span>
        <span>${fmtNum(weight)}g total</span>
        <span class="text-primary font-semibold">${fmtNum(m.price, true)}</span>
      </div>
    `;
  }

  function rebuild() {
    card.innerHTML = `
      <div class="flex items-start justify-between gap-1">
        <span class="font-semibold text-sm leading-tight">${recipe.name}</span>
        <button class="btn btn-ghost btn-xs text-error px-1 remove-btn" title="Remove">✕</button>
      </div>
      <div class="macros-display">${renderMacros()}</div>
      <div class="flex items-center gap-2">
        <input
          type="range"
          class="range range-xs range-primary flex-1"
          min="0.1" max="4" step="0.1"
          value="${entry.multiplier}"
        >
        <span class="multiplier-label font-mono w-8 text-right">${entry.multiplier.toFixed(1)}x</span>
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
      card.querySelector('.multiplier-label').textContent = val.toFixed(1) + 'x';
      card.querySelector('.macros-display').innerHTML = renderMacros();
      updateSummary();
    });
  }

  rebuild();
  return card;
}


// ============================================
// RENDER FUNCTIONS
// ============================================

function renderRecipeList() {
  const container = document.getElementById('recipe-list');
  container.innerHTML = '';

  for (const recipe of RECIPES) {
    const macros = calculateRecipeMacros(recipe);

    const card = document.createElement('div');
    card.className = 'card bg-base-200 cursor-grab hover:bg-base-300 transition-colors select-none';
    card.dataset.recipeId = recipe.id;
    card.innerHTML = `
      <div class="card-body p-3">
        <h3 class="card-title text-sm">${recipe.name}</h3>
        <div class="text-xs text-base-content/70 space-y-1">
          <div class="flex justify-between">
            <span>${fmtNum(macros.calories)} kcal</span>
            <span>${fmtNum(macros.protein)}g protein</span>
          </div>
          <div class="flex justify-between">
            <span>${fmtNum(macros.carbs)}g carbs</span>
            <span>${fmtNum(macros.fat)}g fat</span>
          </div>
          <div class="text-right text-primary font-semibold">${fmtNum(macros.price, true)}/serving</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  new Sortable(container, {
    group: { name: 'recipes', pull: 'clone', put: false },
    sort: false,
    animation: 150,
    ghostClass: 'opacity-50',
  });
}

function renderMealGrid() {
  const container = document.getElementById('meal-grid');
  const variants    = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value)    || 1;

  const variantLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  container.className = 'flex gap-4 p-1 h-full';
  container.innerHTML = '';

  for (let v = 0; v < variants; v++) {
    const col = document.createElement('div');
    col.className = 'flex flex-col gap-4 flex-1 min-w-[200px]';

    const colHeader = document.createElement('div');
    colHeader.className = 'text-center font-bold text-base-content/60 text-sm uppercase tracking-widest';
    colHeader.textContent = `Day ${variantLabels[v] || (v + 1)}`;
    col.appendChild(colHeader);

    for (let m = 0; m < mealsPerDay; m++) {
      const slot = document.createElement('div');
      slot.className = 'card bg-base-100 border-2 border-dashed border-base-300 hover:border-primary/50 transition-colors flex flex-col flex-1';
      slot.dataset.variant = v;
      slot.dataset.meal = m;

      const header = document.createElement('div');
      header.className = 'text-xs text-base-content/40 uppercase tracking-wide p-2 border-b border-base-200 shrink-0';
      header.textContent = `Meal ${m + 1}`;
      slot.appendChild(header);

      const stack = document.createElement('div');
      stack.className = 'recipe-stack flex-1 p-2 space-y-2 overflow-y-auto min-h-[60px]';
      stack.dataset.variant = v;
      stack.dataset.meal = m;

      // Hydrate from gridState
      const entries = getSlotEntries(v, m);
      if (entries.length === 0) {
        stack.appendChild(makePlaceholder());
      } else {
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
      onAdd(evt) {
        const rawNode = evt.item;
        const recipeId = rawNode.dataset.recipeId;

        const variant = parseInt(stack.dataset.variant);
        const meal    = parseInt(stack.dataset.meal);

        // Remove raw clone from DOM — we'll insert our own rendered card
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
}

function makePlaceholder() {
  const ph = document.createElement('div');
  ph.className = 'slot-placeholder text-center text-base-content/30 text-xs py-4';
  ph.textContent = 'Drop a meal here';
  return ph;
}


// ============================================
// SUMMARY CALCULATIONS
// ============================================

function computeOccurrences(days, variants) {
  // Each variant repeats floor(days/variants) times; the first (days % variants) get one extra
  const base = Math.floor(days / variants);
  const extra = days % variants;
  return Array.from({ length: variants }, (_, i) => base + (i < extra ? 1 : 0));
}

function updateSummary() {
  const days        = parseInt(document.getElementById('input-days').value)     || 1;
  const variants    = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value)    || 1;

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
        const recipe = RECIPES.find(r => r.id === entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);

        // Add once to per-variant (one day's worth)
        perVariant[v].calories += macros.calories;
        perVariant[v].protein  += macros.protein;
        perVariant[v].carbs    += macros.carbs;
        perVariant[v].fat      += macros.fat;
        perVariant[v].price    += macros.price;

        // Add weekly weighted by how many times this variant appears
        weekly.calories += macros.calories * occurrences[v];
        weekly.protein  += macros.protein  * occurrences[v];
        weekly.carbs    += macros.carbs    * occurrences[v];
        weekly.fat      += macros.fat      * occurrences[v];
        weekly.price    += macros.price    * occurrences[v];
      }
    }
  }

  const dailyAvg = {
    calories: weekly.calories / days,
    protein:  weekly.protein  / days,
    carbs:    weekly.carbs    / days,
    fat:      weekly.fat      / days,
  };

  // Update summary panel
  document.getElementById('summary-calories').textContent = fmtNum(dailyAvg.calories) + ' kcal';
  document.getElementById('summary-protein').textContent  = fmtNum(dailyAvg.protein)  + 'g';
  document.getElementById('summary-carbs').textContent    = fmtNum(dailyAvg.carbs)    + 'g';
  document.getElementById('summary-fat').textContent      = fmtNum(dailyAvg.fat)      + 'g';
  document.getElementById('cost-per-day').textContent     = fmtNum(weekly.price / days, true);
  document.getElementById('cost-per-week').textContent    = fmtNum(weekly.price, true);

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
    row.className = 'rounded-lg bg-base-100 p-2 text-xs space-y-1';
    row.innerHTML = `
      <div class="font-semibold">Day ${variantLabels[v] || (v + 1)} <span class="font-normal text-base-content/50">(×${occurrences[v]})</span></div>
      <div class="grid grid-cols-2 gap-x-2 text-base-content/70">
        <span>${fmtNum(vd.calories)} kcal</span>
        <span>${fmtNum(vd.protein)}g prot</span>
        <span>${fmtNum(vd.carbs)}g carbs</span>
        <span>${fmtNum(vd.fat)}g fat</span>
      </div>
      <div class="text-right text-primary font-semibold">${fmtNum(vd.price, true)}/day</div>
    `;
    breakdownEl.appendChild(row);
  }

  if (!anyData) {
    breakdownEl.innerHTML = '<p class="text-base-content/50 text-xs">No meals planned yet</p>';
  }
}


// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('input-days').addEventListener('input', updateSummary);
document.getElementById('input-meals').addEventListener('input', () => {
  renderMealGrid();
});
document.getElementById('input-variants').addEventListener('input', () => {
  renderMealGrid();
});

document.querySelector('.btn-primary').addEventListener('click', () => {
  window.print();
});


// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  renderRecipeList();
  renderMealGrid();
});
