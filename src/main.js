// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate macros and price for a recipe at a given multiplier
 */
function calculateRecipeMacros(recipe, multiplier = 1) {
  let total = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
  
  for (const ing of recipe.ingredients) {
    const ingredient = INGREDIENTS[ing.id];
    if (!ingredient) continue;
    
    const multiplierRatio = (ing.amount * multiplier) / 100;
    total.calories += ingredient.macrosPer100g.calories * multiplierRatio;
    total.protein += ingredient.macrosPer100g.protein * multiplierRatio;
    total.carbs += ingredient.macrosPer100g.carbs * multiplierRatio;
    total.fat += ingredient.macrosPer100g.fat * multiplierRatio;
    total.price += ingredient.pricePerUnit * ing.amount * multiplier;
  }
  
  return total;
}

/**
 * Format a number to 2 significant figures, or 2 decimal places for prices
 */
function fmtNum(num, isPrice = false) {
  if (isPrice) {
    return '$' + num.toFixed(2);
  }
  if (num >= 100) {
    return Math.round(num).toString();
  }
  return num.toPrecision(2);
}


// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render recipe cards in the left sidebar
 */
function renderRecipeList() {
  const container = document.getElementById('recipe-list');
  container.innerHTML = '';
  
  for (const recipe of RECIPES) {
    const macros = calculateRecipeMacros(recipe);
    const price = fmtNum(macros.price, true);
    
    const card = document.createElement('div');
    card.className = 'card bg-base-200 cursor-grab hover:bg-base-300 transition-colors';
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
          <div class="text-right text-primary font-semibold">${price}/serving</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
  
  // Make recipe cards draggable
  new Sortable(container, {
    group: 'recipes',
    sort: false,
    ghostClass: 'opacity-50'
  });
}

/**
 * Render the meal grid based on variants × meals inputs
 */
function renderMealGrid() {
  const container = document.getElementById('meal-grid');
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;
  
  // Set grid template
  container.style.gridTemplateColumns = `repeat(${variants}, minmax(200px, 1fr))`;
  container.style.gridTemplateRows = `repeat(${mealsPerDay}, minmax(180px, auto))`;
  container.innerHTML = '';
  
  for (let meal = 0; meal < mealsPerDay; meal++) {
    for (let variant = 0; variant < variants; variant++) {
      const slot = document.createElement('div');
      slot.className = 'card bg-base-100 border-2 border-dashed border-base-300 hover:border-primary/50 transition-colors';
      slot.dataset.variant = variant;
      slot.dataset.meal = meal;
      slot.innerHTML = `
        <div class="card-body p-3">
          <div class="text-xs text-base-content/40 uppercase tracking-wide mb-2">
            Day ${variant + 1} · Meal ${meal + 1}
          </div>
          <div class="flex items-center justify-center h-24 text-base-content/30 text-sm">
            Drop a meal here
          </div>
        </div>
      `;
      container.appendChild(slot);
    }
  }
  
  // Make slots droppable
  new Sortable(container, {
    group: 'recipes',
    animation: 150,
    ghostClass: 'opacity-50'
  });
}

/**
 * Update the summary panel with totals
 */
function updateSummary() {
  // TODO: Calculate actual totals from filled slots
  // For now just update based on recipe calculations
  document.getElementById('summary-calories').textContent = '0 kcal';
  document.getElementById('summary-protein').textContent = '0g';
  document.getElementById('summary-carbs').textContent = '0g';
  document.getElementById('summary-fat').textContent = '0g';
  document.getElementById('cost-per-day').textContent = '$0.00';
  document.getElementById('cost-per-week').textContent = '$0.00';
}


// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('input-days').addEventListener('change', renderMealGrid);
document.getElementById('input-meals').addEventListener('change', renderMealGrid);
document.getElementById('input-variants').addEventListener('change', renderMealGrid);


// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  renderRecipeList();
  renderMealGrid();
  updateSummary();
});
