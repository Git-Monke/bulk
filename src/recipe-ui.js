// ============================================
// RECIPE UI
// ============================================
//
// Recipe sidebar list and edit modal.
// Note: This module depends on grid-ui.js functions but those are
// called from main.js to avoid circular imports.

import { ALL_RECIPES, INGREDIENTS } from './data.js';
import {
  getRecipe,
  isRecipeModified,
  saveCustomRecipe,
  deleteCustomRecipe,
  calculateRecipeMacros,
  fmtNum
} from './calculations.js';

let editingRecipeId = null;
let editingIngredients = [];

// Callbacks that will be set by main.js
let onRecipeModifiedCallback = null;

export function setOnRecipeModifiedCallback(callback) {
  onRecipeModifiedCallback = callback;
}

// -------------------------------------------
// RECIPE LIST RENDERING
// -------------------------------------------

export function renderRecipeList() {
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

// -------------------------------------------
// EDIT RECIPE MODAL
// -------------------------------------------

export function openEditModal(recipeId) {
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
  if (onRecipeModifiedCallback) onRecipeModifiedCallback();
}

function resetRecipeToDefault() {
  if (!editingRecipeId) return;
  if (!confirm('Revert this recipe to its default ingredients?')) return;

  deleteCustomRecipe(editingRecipeId);

  // Refresh UI
  if (onRecipeModifiedCallback) onRecipeModifiedCallback();

  document.getElementById('edit-modal').close();
}

// Auto-save on ingredient change
function onIngredientChange() {
  saveEditedRecipe();
}

// Modal event listeners
export function initEditModalListeners() {
  document.getElementById('edit-reset-btn').addEventListener('click', resetRecipeToDefault);
  document.getElementById('edit-cancel-btn').addEventListener('click', () => {
    document.getElementById('edit-modal').close();
  });
}
