// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateRecipeMacros(recipe, multiplier = 1) {
  if (!recipe) return { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0, rawWeight: 0, preppedWeight: 0 };

  let total = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0, rawWeight: 0, preppedWeight: 0 };

  for (const ing of recipe.ingredients) {
    const ingredient = INGREDIENTS[ing.id];
    if (!ingredient) continue;

    const rawAmount = ing.amount * multiplier;
    const ratio = rawAmount / 100;

    total.calories += ingredient.macrosPer100g.calories * ratio;
    total.protein += ingredient.macrosPer100g.protein * ratio;
    total.carbs += ingredient.macrosPer100g.carbs * ratio;
    total.fat += ingredient.macrosPer100g.fat * ratio;
    total.price += ingredient.pricePerUnit * rawAmount;

    // Raw weight is the amount before any transformation
    total.rawWeight += rawAmount;

    // Prepped weight accounts for cooking transformation (e.g., moisture loss/gain)
    // If preppedMultiplier is defined, use it; otherwise assume 1:1
    const preppedMultiplier = ingredient.preppedMultiplier ?? 1;
    total.preppedWeight += rawAmount * preppedMultiplier;
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
// PERSISTENCE
// ============================================

const STORAGE_KEY = 'bulk-meal-planner-v1';
const CUSTOM_RECIPES_KEY = 'bulk-meal-planner-recipes';

function saveToStorage() {
  const data = {
    gridState: Object.fromEntries(gridState),
    nextEntryId,
    days: document.getElementById('input-days')?.value,
    meals: document.getElementById('input-meals')?.value,
    variants: document.getElementById('input-variants')?.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// Custom recipe storage
function loadCustomRecipes() {
  try {
    const raw = localStorage.getItem(CUSTOM_RECIPES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCustomRecipes(customRecipes) {
  localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(customRecipes));
}

function getCustomRecipe(recipeId) {
  const custom = loadCustomRecipes();
  return custom[recipeId] || null;
}

function saveCustomRecipe(recipe) {
  const custom = loadCustomRecipes();
  custom[recipe.id] = recipe;
  saveCustomRecipes(custom);
}

function deleteCustomRecipe(recipeId) {
  const custom = loadCustomRecipes();
  delete custom[recipeId];
  saveCustomRecipes(custom);
}

// Get recipe merged with custom overrides
function getRecipe(recipeId) {
  const custom = getCustomRecipe(recipeId);
  const base = ALL_RECIPES.find(r => r.id === recipeId);
  return custom || base;
}

// Check if recipe has custom overrides
function isRecipeModified(recipeId) {
  return getCustomRecipe(recipeId) !== null;
}


// ============================================
// STATE
// ============================================

// gridState: Map<"variant-meal", Array<{ entryId, recipeId, multiplier }>>
// Keys are never deleted - out-of-bounds keys are ignored in calculations.
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
  saveToStorage();
}

function updateEntryMultiplier(variant, meal, entryId, multiplier) {
  const arr = gridState.get(stateKey(variant, meal));
  if (!arr) return;
  const entry = arr.find(e => e.entryId === entryId);
  if (entry) entry.multiplier = multiplier;
  saveToStorage();
}


// ============================================
// SLOT CARD RENDERING
// ============================================

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
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
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


// ============================================
// RENDER FUNCTIONS
// ============================================

function renderRecipeList() {
  const container = document.getElementById('recipe-list');
  container.innerHTML = '';

  const activeCategory = document.getElementById('recipe-category').value;
  const filtered = ALL_RECIPES.filter(r => r.category === activeCategory);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-line">No recipes in this category yet.</p>';
    return;
  }

  for (const recipe of filtered) {
    const fullRecipe = getRecipe(recipe.id);
    const isModified = isRecipeModified(recipe.id);
    const macros = calculateRecipeMacros(fullRecipe);

    const card = document.createElement('div');
    card.className = 'recipe-card' + (isModified ? ' is-modified' : '');
    card.dataset.recipeId = recipe.id;
    card.innerHTML = `
      <button class="recipe-card-edit edit-recipe-btn" title="Edit Recipe" aria-label="Edit Recipe">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/>
          <path d="M17.586 3.586a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      </button>
      <div class="recipe-card-name">${recipe.name}${isModified ? '<span class="badge-modified">Modified</span>' : ''}</div>
      <div class="recipe-card-stats">
        <span><span class="stat-num">${fmtNum(macros.calories)}</span> kcal</span>
        <span><span class="stat-num">${fmtNum(macros.protein)}g</span> prot</span>
        <span><span class="stat-num">${fmtNum(macros.carbs)}g</span> carbs</span>
        <span><span class="stat-num">${fmtNum(macros.fat)}g</span> fat</span>
      </div>
      <div class="recipe-card-price">${fmtNum(macros.price, true)} / serving</div>
    `;

    // Add edit button listener
    card.querySelector('.edit-recipe-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(recipe.id);
    });

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

        saveToStorage();
        updateSummary();
      },
    });
  });

  updateSummary();
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

  // Update summary panel
  document.getElementById('summary-calories').textContent = fmtNum(dailyAvg.calories) + ' kcal';
  document.getElementById('summary-protein').textContent = fmtNum(dailyAvg.protein) + 'g';
  document.getElementById('summary-carbs').textContent = fmtNum(dailyAvg.carbs) + 'g';
  document.getElementById('summary-fat').textContent = fmtNum(dailyAvg.fat) + 'g';
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


// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('input-days').addEventListener('input', () => { saveToStorage(); updateSummary(); });
document.getElementById('input-meals').addEventListener('input', () => {
  saveToStorage();
  renderMealGrid();
});
document.getElementById('input-variants').addEventListener('input', () => {
  saveToStorage();
  renderMealGrid();
});
document.getElementById('recipe-category').addEventListener('change', () => {
  renderRecipeList();
});

// ============================================
// PRINT VIEW
// ============================================

function generatePrintView() {
  const days = parseInt(document.getElementById('input-days').value) || 1;
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;
  const variantLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const occurrences = computeOccurrences(days, variants);

  // --- Aggregate shopping list: ingredientId -> { name, unit, totalAmount, totalCost } ---
  const shoppingMap = new Map();
  // --- Aggregate per-recipe totals: recipeId -> { totalMultiplier, portions, perPortionMultipliers[] } ---
  const recipeTotals = new Map();

  for (let v = 0; v < variants; v++) {
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const totalMultiplier = entry.multiplier * occurrences[v];

        // Accumulate recipe totals
        if (!recipeTotals.has(entry.recipeId)) {
          recipeTotals.set(entry.recipeId, { totalMultiplier: 0, portions: 0, perPortionMultipliers: [] });
        }
        const rt = recipeTotals.get(entry.recipeId);
        rt.totalMultiplier += totalMultiplier;
        rt.portions += occurrences[v];
        rt.perPortionMultipliers.push({ multiplier: entry.multiplier, count: occurrences[v] });

        // Accumulate ingredient totals
        for (const ing of recipe.ingredients) {
          const ingredient = INGREDIENTS[ing.id];
          if (!ingredient) continue;
          const totalAmount = ing.amount * totalMultiplier;
          const totalCost = ingredient.pricePerUnit * totalAmount;
          if (shoppingMap.has(ing.id)) {
            const entry = shoppingMap.get(ing.id);
            entry.totalAmount += totalAmount;
            entry.totalCost += totalCost;
          } else {
            shoppingMap.set(ing.id, {
              name: ingredient.name,
              unit: ingredient.unit,
              totalAmount,
              totalCost,
              preppedMultiplier: ingredient.preppedMultiplier,
            });
          }
        }
      }
    }
  }

  // --- Compute weekly totals for summary ---
  let weekly = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
  for (let v = 0; v < variants; v++) {
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = ALL_RECIPES.find(r => r.id === entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
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

  // --- Build HTML sections ---

  // Section 1: Summary
  const variantRows = Array.from({ length: variants }, (_, v) => {
    const vd = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        vd.calories += macros.calories;
        vd.protein += macros.protein;
        vd.carbs += macros.carbs;
        vd.fat += macros.fat;
        vd.price += macros.price;
      }
    }
    return `
      <tr>
        <td>Day ${variantLabels[v] || v + 1} <span style="color:#888">(×${occurrences[v]})</span></td>
        <td>${fmtNum(vd.calories)} kcal</td>
        <td>${fmtNum(vd.protein)}g</td>
        <td>${fmtNum(vd.carbs)}g</td>
        <td>${fmtNum(vd.fat)}g</td>
        <td>${fmtNum(vd.price, true)}</td>
      </tr>`;
  }).join('');

  const summarySection = `
    <section class="section">
      <h1>Meal Prep Plan</h1>
      <p class="meta">${days} days &nbsp;·&nbsp; ${variants} variant${variants !== 1 ? 's' : ''} &nbsp;·&nbsp; ${mealsPerDay} meal${mealsPerDay !== 1 ? 's' : ''}/day</p>

      <h2>Daily Averages</h2>
      <table>
        <tr>
          <th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Cost/day</th><th>Cost/week</th>
        </tr>
        <tr>
          <td>${fmtNum(dailyAvg.calories)} kcal</td>
          <td>${fmtNum(dailyAvg.protein)}g</td>
          <td>${fmtNum(dailyAvg.carbs)}g</td>
          <td>${fmtNum(dailyAvg.fat)}g</td>
          <td>${fmtNum(weekly.price / days, true)}</td>
          <td>${fmtNum(weekly.price, true)}</td>
        </tr>
      </table>

      <h2>Day Breakdown</h2>
      <table>
        <tr><th>Variant</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Cost</th></tr>
        ${variantRows}
      </table>
    </section>`;

  // Section 2: Shopping list
  const shoppingRows = [...shoppingMap.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map(item => {
      return `
      <tr>
        <td>${item.name}</td>
        <td>${Math.round(item.totalAmount)}${item.unit}</td>
        <td>${fmtNum(item.totalCost, true)}</td>
      </tr>`;
    }).join('');

  const shoppingSection = `
    <section class="section">
      <h2>Shopping List</h2>
      <table>
        <tr><th>Ingredient</th><th>Amount</th><th>Est. Cost</th></tr>
        ${shoppingRows || '<tr><td colspan="3">No ingredients - add meals to the plan first.</td></tr>'}
      </table>
      <p class="total">Total: ${fmtNum(weekly.price, true)}</p>
    </section>`;

  // Section 3: Daily meal schedule
  const dailyScheduleBlocks = Array.from({ length: variants }, (_, v) => {
    const mealBlocks = Array.from({ length: mealsPerDay }, (_, m) => {
      const entries = gridState.get(stateKey(v, m)) || [];
      const borderStyle = m === 0 ? '' : 'border-top:2px solid #aaa;';
      const labelRow = `<tr><td colspan="6" style="${borderStyle}padding-top:10px;padding-bottom:2px;font-weight:bold;font-size:13px;color:#888;">Meal ${m + 1}</td></tr>`;
      if (entries.length === 0) {
        return labelRow + `<tr><td colspan="6" style="color:#aaa;padding-bottom:8px;">-</td></tr>`;
      }
      const foodRows = entries.map(entry => {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) return '';
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        const totalWeight = Math.round(recipe.servingSize * entry.multiplier);
        const unit = recipe.ingredients[0]?.id ? INGREDIENTS[recipe.ingredients[0].id]?.unit || 'g' : 'g';
        let portionLabel;
        if (recipe.displayUnit === 'weight') {
          portionLabel = `<span style="color:#555">(${totalWeight}${unit})</span>`;
        } else if (entry.multiplier !== 1) {
          portionLabel = `<span style="color:#888">(${entry.multiplier.toFixed(1)}×)</span>`;
        } else {
          portionLabel = '';
        }
        return `
          <tr>
            <td style="padding-bottom:6px;">${recipe.name} ${portionLabel}</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.calories)} kcal</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.protein)}g</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.carbs)}g</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.fat)}g</td>
          </tr>`;
      }).join('');
      return labelRow + foodRows;
    }).join('');

    // Day totals
    const dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        dayTotals.calories += macros.calories;
        dayTotals.protein += macros.protein;
        dayTotals.carbs += macros.carbs;
        dayTotals.fat += macros.fat;
      }
    }

    const checkboxes = Array.from({ length: occurrences[v] }, () =>
      `<span style="display:inline-block;width:18px;height:18px;border:2px solid #aaa;border-radius:3px;margin-right:5px;vertical-align:middle;"></span>`
    ).join('');

    return `
      <div class="recipe-block">
        <h3 style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <span>Day ${variantLabels[v] || v + 1}</span>
          <span style="font-weight:normal;font-size:13px;color:#555;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">${checkboxes}</span>
        </h3>
        <table>
          <tr><th>Food</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr>
          ${mealBlocks}
          <tr style="font-weight:bold;border-top:2px solid #aaa;">
            <td>Day Total</td>
            <td>${fmtNum(dayTotals.calories)} kcal</td>
            <td>${fmtNum(dayTotals.protein)}g</td>
            <td>${fmtNum(dayTotals.carbs)}g</td>
            <td>${fmtNum(dayTotals.fat)}g</td>
          </tr>
        </table>
      </div>`;
  }).join('');

  const dailyScheduleSection = `
    <section class="section page-break-before">
      <h2>Daily Meal Schedule</h2>
      ${dailyScheduleBlocks || '<p>No meals planned yet.</p>'}
    </section>`;

  // Section 4: Recipe prep guide (only recipes WITH prep notes)
  const recipeGuideBlocks = [...recipeTotals.entries()].map(([recipeId, rt]) => {
    const recipe = getRecipe(recipeId);
    if (!recipe || !recipe.prepNotes) return '';
    const { totalMultiplier, portions, perPortionMultipliers } = rt;

    // Determine per-portion weight label: if all portions have same multiplier, show one value; otherwise show range
    const uniqueMultipliers = [...new Set(perPortionMultipliers.map(p => p.multiplier))];
    const perPortionWeightLabel = uniqueMultipliers.length === 1
      ? null  // will compute per-ingredient
      : 'varies';

    const ingRows = recipe.ingredients.map(ing => {
      const ingredient = INGREDIENTS[ing.id];
      if (!ingredient) return '';
      const rawTotal = ing.amount * totalMultiplier;
      const preppedMultiplier = ingredient.preppedMultiplier ?? 1;
      const preppedTotal = rawTotal * preppedMultiplier;

      const hasPreppedTransformation = preppedMultiplier !== 1;
      
      let perPortionCell;
      if (perPortionWeightLabel === 'varies') {
        const weights = uniqueMultipliers.map(m => {
          const rawPortion = ing.amount * m;
          const preppedPortion = rawPortion * preppedMultiplier;
          return hasPreppedTransformation
            ? `${Math.round(preppedPortion)}${ingredient.unit} cooked`
            : `${Math.round(rawPortion)}${ingredient.unit}`;
        }).join(' / ');
        perPortionCell = weights;
      } else {
        const rawPortion = ing.amount * uniqueMultipliers[0];
        const preppedPortion = rawPortion * preppedMultiplier;
        perPortionCell = hasPreppedTransformation
          ? `${Math.round(preppedPortion)}${ingredient.unit} cooked`
          : `${Math.round(rawPortion)}${ingredient.unit}`;
      }
      
      const totalAmountDisplay = hasPreppedTransformation
        ? `${Math.round(rawTotal)}${ingredient.unit} raw`
        : `${Math.round(rawTotal)}${ingredient.unit}`;
      
      return `<tr><td>${ingredient.name}</td><td>${totalAmountDisplay}</td><td style="color:#555">${perPortionCell}</td></tr>`;
    }).join('');

    const totalWeight = Math.round(recipe.servingSize * totalMultiplier);
    const weightUnit = INGREDIENTS[recipe.ingredients[0]?.id]?.unit || 'g';
    let portionInfo;
    if (recipe.displayUnit === 'weight') {
      portionInfo = `${totalWeight}${weightUnit} total &nbsp;·&nbsp; ${portions}× Portions`;
    } else {
      portionInfo = `${fmtNum(totalMultiplier, false)}× Servings &nbsp;·&nbsp; ${portions}× Portions`;
    }
    return `
      <div class="recipe-block">
        <h3>${recipe.name} <span style="font-weight:normal;color:#555">(${portionInfo})</span></h3>
        <table>
          <tr><th>Ingredient</th><th>Total Amount</th><th>Per Portion</th></tr>
          ${ingRows}
        </table>
        ${recipe.prepNotes ? `<p class="prep-notes"><strong>Prep:</strong> ${recipe.prepNotes}</p>` : ''}
      </div>`;
  }).join('');

  const recipeSection = `
    <section class="section">
      <h2>Meal Prep Guide</h2>
      ${recipeGuideBlocks || '<p>No recipes with prep notes in this plan.</p>'}
    </section>`;

  // --- Compose full document ---
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meal Prep Plan</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #111; font-size: 14px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 32px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 15px; margin-top: 20px; margin-bottom: 6px; }
    .meta { color: #555; margin-bottom: 16px; }
    .section { margin-bottom: 40px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 4px 8px; font-size: 13px; }
    td { padding: 4px 8px; border-bottom: 1px solid #ddd; }
    tr:last-child td { border-bottom: none; }
    .total { text-align: right; font-weight: bold; margin-top: 8px; }
    .recipe-block { margin-bottom: 24px; }
    .prep-notes { margin-top: 8px; color: #444; }
    @media print {
      body { margin: 20px; }
      .section { page-break-inside: avoid; }
      .recipe-block { page-break-inside: avoid; }
      .page-break-before { page-break-before: always; }
    }
  </style>
</head>
<body>
  ${summarySection}
  ${dailyScheduleSection}
  ${shoppingSection}
  ${recipeSection}
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

document.getElementById('btn-print').addEventListener('click', generatePrintView);


// ============================================
// EDIT RECIPE MODAL
// ============================================

let editingRecipeId = null;
let editingIngredients = []; // { id, amount, originalAmount }

function openEditModal(recipeId) {
  const baseRecipe = ALL_RECIPES.find(r => r.id === recipeId);
  if (!baseRecipe) return;

  const currentRecipe = getRecipe(recipeId);
  editingRecipeId = recipeId;

  // Clone ingredients, storing original amount for slider range calculation
  editingIngredients = currentRecipe.ingredients.map(ing => ({
    id: ing.id,
    amount: ing.amount,
    originalAmount: baseRecipe.ingredients.find(bi => bi.id === ing.id)?.amount || ing.amount
  }));

  const modal = document.getElementById('edit-modal');
  document.getElementById('edit-recipe-name').textContent = currentRecipe.name;
  document.getElementById('edit-recipe-desc').textContent = `Original serving size: ${currentRecipe.servingSize}g`;

  const modified = isRecipeModified(recipeId);
  document.getElementById('edit-modified-badge').classList.toggle('hidden', !modified);
  document.getElementById('edit-reset-btn').classList.toggle('hidden', !modified);

  renderEditIngredients();
  updateEditStats();
  modal.showModal();
}

function renderEditIngredients() {
  const container = document.getElementById('edit-ingredients');
  container.innerHTML = '';

  for (const ing of editingIngredients) {
    const ingredient = INGREDIENTS[ing.id];
    if (!ingredient) continue;

    const maxAmount = ing.originalAmount * 2;
    const row = document.createElement('div');
    row.className = 'edit-row';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="edit-row-name truncate">${ingredient.name}</div>
        <div class="edit-row-controls">
          <input
            type="range"
            class="bulk-slider flex-1 ingredient-slider"
            min="0"
            max="${maxAmount}"
            step="1"
            value="${ing.amount}"
            data-ingredient-id="${ing.id}"
          >
          <input
            type="number"
            class="edit-num-input ingredient-input"
            min="0"
            max="${maxAmount}"
            step="1"
            value="${Math.round(ing.amount)}"
            data-ingredient-id="${ing.id}"
          >
          <span class="edit-unit">${ingredient.unit}</span>
        </div>
      </div>
    `;

    const slider = row.querySelector('.ingredient-slider');
    const input = row.querySelector('.ingredient-input');

    // Slider -> input sync
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      input.value = Math.round(val);
      const ingData = editingIngredients.find(i => i.id === ing.id);
      if (ingData) ingData.amount = val;
      updateEditStats();
      onIngredientChange();
    });

    // Input -> slider sync
    input.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value) || 0;
      val = Math.max(0, Math.min(maxAmount, val));
      slider.value = val;
      const ingData = editingIngredients.find(i => i.id === ing.id);
      if (ingData) ingData.amount = val;
      updateEditStats();
      onIngredientChange();
    });

    container.appendChild(row);
  }
}

function updateEditStats() {
  // Build temporary recipe object for calculation
  const tempRecipe = {
    id: editingRecipeId,
    ingredients: editingIngredients.map(ing => ({ id: ing.id, amount: ing.amount })),
    servingSize: 0 // will be calculated from ingredients
  };

  // Calculate total weight from ingredients
  let totalRawWeight = 0;
  let totalPreppedWeight = 0;
  for (const ing of editingIngredients) {
    const ingredient = INGREDIENTS[ing.id];
    if (ingredient) {
      const rawAmount = ing.amount;
      const preppedMultiplier = ingredient.preppedMultiplier ?? 1;
      totalRawWeight += rawAmount;
      totalPreppedWeight += rawAmount * preppedMultiplier;
    }
  }
  tempRecipe.servingSize = totalRawWeight;

  const macros = calculateRecipeMacros(tempRecipe);

  document.getElementById('edit-cals').textContent = fmtNum(macros.calories);
  document.getElementById('edit-protein').textContent = fmtNum(macros.protein) + 'g';
  document.getElementById('edit-carbs').textContent = fmtNum(macros.carbs) + 'g';
  document.getElementById('edit-fat').textContent = fmtNum(macros.fat) + 'g';

  // Show prepped weight with raw in tooltip
  const weightDisplay = totalPreppedWeight !== totalRawWeight && totalRawWeight > 0
    ? `${Math.round(totalPreppedWeight)}g (${Math.round(totalRawWeight)}g raw)`
    : `${Math.round(totalRawWeight)}g`;
  document.getElementById('edit-weight').textContent = weightDisplay;
  document.getElementById('edit-price').textContent = fmtNum(macros.price, true);
}

function saveEditedRecipe() {
  const baseRecipe = ALL_RECIPES.find(r => r.id === editingRecipeId);
  if (!baseRecipe) return;

  // Calculate new serving size from ingredients
  let totalWeight = 0;
  for (const ing of editingIngredients) {
    totalWeight += ing.amount;
  }

  const editedRecipe = {
    ...baseRecipe,
    ingredients: editingIngredients.map(ing => ({ id: ing.id, amount: ing.amount })),
    servingSize: Math.round(totalWeight)
  };

  saveCustomRecipe(editedRecipe);

  // Refresh UI to show changes across the app
  renderRecipeList();
  renderMealGrid();
  updateSummary();
}

function resetRecipeToDefault() {
  if (!editingRecipeId) return;
  if (!confirm('Revert this recipe to its default ingredients?')) return;

  deleteCustomRecipe(editingRecipeId);

  // Refresh UI
  renderRecipeList();
  renderMealGrid();
  updateSummary();

  document.getElementById('edit-modal').close();
}

// Auto-save on ingredient change
function onIngredientChange() {
  saveEditedRecipe();
}

// Modal event listeners
document.getElementById('edit-reset-btn').addEventListener('click', resetRecipeToDefault);
document.getElementById('edit-cancel-btn').addEventListener('click', () => {
  document.getElementById('edit-modal').close();
});


// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const saved = loadFromStorage();
  if (saved) {
    if (saved.days) document.getElementById('input-days').value = saved.days;
    if (saved.meals) document.getElementById('input-meals').value = saved.meals;
    if (saved.variants) document.getElementById('input-variants').value = saved.variants;
    if (saved.nextEntryId) nextEntryId = saved.nextEntryId;
    if (saved.gridState) {
      for (const [key, entries] of Object.entries(saved.gridState)) {
        gridState.set(key, entries);
      }
    }
  }

  renderRecipeList();
  renderMealGrid();

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear all meals from the plan?')) return;
    gridState.clear();
    nextEntryId = 0;
    clearStorage();
    renderMealGrid();
  });
});
