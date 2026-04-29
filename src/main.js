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

  // Make recipe cards draggable (source only, not sortable within sidebar)
  new Sortable(container, {
    group: { name: 'recipes', pull: 'clone', put: false },
    sort: false,
    animation: 150,
    ghostClass: 'opacity-50',
    // Clone items when dragging from sidebar (so original stays)
    clone: function(original) {
      const clone = original.cloneNode(true);
      clone.classList.add('bg-base-100');
      clone.classList.remove('bg-base-200', 'hover:bg-base-300');
      return clone;
    },
    onEnd: function(evt) {
      // Remove item if dropped outside a valid recipe-stack
      if (!evt.to.classList.contains('recipe-stack') && !evt.to.classList.contains('recipe-list')) {
        evt.item.remove();
      }
    }
  });
}

/**
 * Render the meal grid based on variants × meals inputs
 */
function renderMealGrid() {
  const container = document.getElementById('meal-grid');
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;

  // Flex layout: columns = variants, each stretched to fill available space
  container.className = 'flex gap-4 p-1 h-full';
  container.innerHTML = '';

  for (let variant = 0; variant < variants; variant++) {
    // Create a variant column that stretches
    const dayColumn = document.createElement('div');
    dayColumn.className = 'flex flex-col gap-4 flex-1 min-w-[200px]';
    dayColumn.dataset.day = variant;

    // Meal slots for this day (each slot also stretches)
    for (let meal = 0; meal < mealsPerDay; meal++) {
      const slot = document.createElement('div');
      slot.className = 'card bg-base-100 border-2 border-dashed border-base-300 hover:border-primary/50 transition-colors flex flex-col flex-1';
      slot.dataset.variant = variant;
      slot.dataset.meal = meal;

      // Header with meal label
      const header = document.createElement('div');
      header.className = 'text-xs text-base-content/40 uppercase tracking-wide p-2 border-b border-base-200 shrink-0';
      header.textContent = `Meal ${meal + 1}`;
      slot.appendChild(header);

      // Inner container for stacking recipes (stretches to fill remaining space)
      const recipeStack = document.createElement('div');
      recipeStack.className = 'recipe-stack flex-1 p-2 space-y-2 overflow-y-auto';
      recipeStack.dataset.variant = variant;
      recipeStack.dataset.meal = meal;

      slot.appendChild(recipeStack);
      dayColumn.appendChild(slot);
    }

    container.appendChild(dayColumn);
  }

  // Make recipe stacks sortable (not the slots themselves)
  document.querySelectorAll('.recipe-stack').forEach(stack => {
    new Sortable(stack, {
      group: { name: 'recipes', pull: true, put: true },
      animation: 150,
      ghostClass: 'opacity-50',
      sort: true,
      removeOnSpill: true,
      // Remove empty state when items are added
      onAdd: function(evt) {
        const emptyState = evt.target.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
      }
    });
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
