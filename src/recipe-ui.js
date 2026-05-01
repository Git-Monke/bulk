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
import { removeRecipeFromList } from './data.js';

let editingRecipeId = null;
let editingIngredients = [];
let isNewRecipe = false;

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
      <div class="recipe-card-name">${recipe.name}</div>
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
  const modal = document.getElementById('edit-modal');
  const nameInput = document.getElementById('edit-recipe-name');
  const prepNotesInput = document.getElementById('edit-prep-notes');
  const deleteBtn = document.getElementById('edit-delete-btn');
  const resetBtn = document.getElementById('edit-reset-btn');

  // Hide search container when opening
  document.getElementById('ingredient-search-container').classList.add('hidden');

  if (recipeId === null) {
    // New recipe mode
    isNewRecipe = true;
    editingRecipeId = null;
    nameInput.value = '';
    prepNotesInput.value = '';
    editingIngredients = [];

    // Pre-fill with first ingredient
    const firstIngId = Object.keys(INGREDIENTS)[0];
    if (firstIngId) {
      editingIngredients = [{ id: firstIngId, amount: 100 }];
    }

    deleteBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
  } else {
    // Edit existing recipe
    isNewRecipe = false;
    const baseRecipe = ALL_RECIPES.find(r => r.id === recipeId);
    if (!baseRecipe) return;

    const currentRecipe = getRecipe(recipeId);
    editingRecipeId = recipeId;
    nameInput.value = currentRecipe.name;
    prepNotesInput.value = currentRecipe.prepNotes || '';

    // Clone ingredients, storing original amount for slider range calculation
    editingIngredients = currentRecipe.ingredients.map(ing => ({
      id: ing.id,
      amount: ing.amount,
      originalAmount: baseRecipe.ingredients.find(bi => bi.id === ing.id)?.amount || ing.amount
    }));

    const modified = isRecipeModified(recipeId);
    deleteBtn.classList.toggle('hidden', !modified);
    resetBtn.classList.toggle('hidden', !modified);
  }

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

    const baseAmount = ing.originalAmount || ing.amount;
    const maxAmount = Math.max(baseAmount * 2, 1000);

    const row = document.createElement('div');
    row.className = 'edit-row';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <div class="edit-row-name truncate">${ingredient.name}</div>
          <button class="btn btn-ghost btn-xs text-error remove-ingredient-btn" data-ingredient-id="${ing.id}" title="Remove ingredient">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
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
    const removeBtn = row.querySelector('.remove-ingredient-btn');

    // Slider -> input sync
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      input.value = Math.round(val);
      const ingData = editingIngredients.find(i => i.id === ing.id);
      if (ingData) ingData.amount = val;
      updateEditStats();
    });

    // Input -> slider sync
    input.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value) || 0;
      val = Math.max(0, Math.min(maxAmount, val));
      slider.value = val;
      const ingData = editingIngredients.find(i => i.id === ing.id);
      if (ingData) ingData.amount = val;
      updateEditStats();
    });

    // Remove button
    removeBtn.addEventListener('click', () => {
      editingIngredients = editingIngredients.filter(i => i.id !== ing.id);
      renderEditIngredients();
      updateEditStats();
    });

    container.appendChild(row);
  }
}

function updateEditStats() {
  // Build temporary recipe object for calculation
  const tempRecipe = {
    id: editingRecipeId || 'temp',
    ingredients: editingIngredients.map(ing => ({ id: ing.id, amount: ing.amount })),
    servingSize: editingIngredients.reduce((sum, ing) => sum + ing.amount, 0)
  };

  const macros = calculateRecipeMacros(tempRecipe);

  document.getElementById('edit-cals').textContent = fmtNum(macros.calories);
  document.getElementById('edit-protein').textContent = fmtNum(macros.protein) + 'g';
  document.getElementById('edit-carbs').textContent = fmtNum(macros.carbs) + 'g';
  document.getElementById('edit-fat').textContent = fmtNum(macros.fat) + 'g';

  // Show prepped weight with raw in tooltip
  const rawWeight = macros.rawWeight;
  const preppedWeight = macros.preppedWeight;
  const weightDisplay = preppedWeight !== rawWeight && rawWeight > 0
    ? `${Math.round(preppedWeight)}g (${Math.round(rawWeight)}g raw)`
    : `${Math.round(rawWeight)}g`;
  document.getElementById('edit-weight').textContent = weightDisplay;
  document.getElementById('edit-price').textContent = fmtNum(macros.price, true);

  // Update read-only serving size display (always sum of ingredients)
  document.getElementById('edit-serving-value').textContent = `${Math.round(rawWeight)}g`;
}

function generateRecipeId(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'recipe';
  const suffix = Date.now().toString(36);
  return `${slug}-${suffix}`;
}

function saveEditedRecipe() {
  const nameInput = document.getElementById('edit-recipe-name');
  const prepNotesInput = document.getElementById('edit-prep-notes');
  const name = nameInput.value.trim();
  const prepNotes = prepNotesInput.value.trim();

  // Serving size is always calculated from ingredients (sum of all amounts)
  const servingSize = Math.round(editingIngredients.reduce((sum, ing) => sum + ing.amount, 0));

  if (!name) {
    alert('Please enter a recipe name.');
    return false;
  }

  if (editingIngredients.length === 0) {
    alert('Please add at least one ingredient.');
    return false;
  }

  const recipeData = {
    name,
    servingSize,
    prepNotes,
    ingredients: editingIngredients.map(ing => ({ id: ing.id, amount: ing.amount }))
  };

  if (isNewRecipe) {
    // Create new recipe
    const newId = generateRecipeId(name);
    const activeCategory = document.getElementById('recipe-category').value;

    const newRecipe = {
      id: newId,
      category: activeCategory,
      ...recipeData
    };

    // Add to ALL_RECIPES array
    ALL_RECIPES.push(newRecipe);
    saveCustomRecipe(newRecipe);

    // Switch to edit mode for this recipe
    isNewRecipe = false;
    editingRecipeId = newId;

    // Show delete button now
    document.getElementById('edit-delete-btn').classList.remove('hidden');
  } else {
    // Update existing recipe
    const baseRecipe = ALL_RECIPES.find(r => r.id === editingRecipeId);
    if (!baseRecipe) return false;

    const editedRecipe = {
      ...baseRecipe,
      ...recipeData
    };

    saveCustomRecipe(editedRecipe);
  }

  // Refresh UI
  if (onRecipeModifiedCallback) onRecipeModifiedCallback();
  return true;
}

function resetRecipeToDefault() {
  if (!editingRecipeId) return;
  if (!confirm('Revert this recipe to its default ingredients?')) return;

  deleteCustomRecipe(editingRecipeId);

  // Refresh UI
  if (onRecipeModifiedCallback) onRecipeModifiedCallback();

  document.getElementById('edit-modal').close();
}

function deleteRecipe() {
  if (!editingRecipeId) return;
  if (!confirm('Delete this custom recipe? This cannot be undone.')) return;

  deleteCustomRecipe(editingRecipeId);
  removeRecipeFromList(editingRecipeId);

  // Refresh UI
  if (onRecipeModifiedCallback) onRecipeModifiedCallback();

  document.getElementById('edit-modal').close();
}

// -------------------------------------------
// INGREDIENT SEARCH
// -------------------------------------------

function showIngredientSearch() {
  const container = document.getElementById('ingredient-search-container');
  const input = document.getElementById('ingredient-search');
  container.classList.remove('hidden');
  input.value = '';
  input.focus();
  renderSearchResults('');
}

function hideIngredientSearch() {
  document.getElementById('ingredient-search-container').classList.add('hidden');
}

function renderSearchResults(query) {
  const container = document.getElementById('ingredient-search-results');
  container.innerHTML = '';

  const normalizedQuery = query.toLowerCase().trim();
  const alreadyUsed = new Set(editingIngredients.map(i => i.id));

  const matches = Object.entries(INGREDIENTS)
    .filter(([id, ing]) => !alreadyUsed.has(id))
    .filter(([id, ing]) => ing.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 10);

  for (const [id, ing] of matches) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="ingredient-search-item" data-ingredient-id="${id}">${ing.name}</button>`;
    container.appendChild(li);
  }

  if (matches.length === 0) {
    const li = document.createElement('li');
    li.className = 'text-sm text-stone-400 px-3 py-2';
    li.textContent = normalizedQuery ? 'No ingredients found' : 'Start typing to search...';
    container.appendChild(li);
  }
}

function addIngredientFromSearch(ingredientId) {
  const ingredient = INGREDIENTS[ingredientId];
  if (!ingredient) return;

  editingIngredients.push({
    id: ingredientId,
    amount: 100
  });

  hideIngredientSearch();
  renderEditIngredients();
  updateEditStats();
}

// -------------------------------------------
// EVENT LISTENERS
// -------------------------------------------

export function initEditModalListeners() {
  // Reset button
  document.getElementById('edit-reset-btn').addEventListener('click', resetRecipeToDefault);

  // Delete button
  document.getElementById('edit-delete-btn').addEventListener('click', deleteRecipe);

  // Cancel button - just close without saving
  document.getElementById('edit-cancel-btn').addEventListener('click', () => {
    document.getElementById('edit-modal').close();
  });

  // Save button
  document.getElementById('edit-save-btn').addEventListener('click', () => {
    if (saveEditedRecipe()) {
      document.getElementById('edit-modal').close();
    }
  });

  // Add ingredient button
  document.getElementById('add-ingredient-btn').addEventListener('click', showIngredientSearch);

  // Ingredient search input
  document.getElementById('ingredient-search').addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  // Click on search results
  document.getElementById('ingredient-search-results').addEventListener('click', (e) => {
    const item = e.target.closest('.ingredient-search-item');
    if (item) {
      addIngredientFromSearch(item.dataset.ingredientId);
    }
  });

  // Close search on click outside
  document.addEventListener('click', (e) => {
    const container = document.getElementById('ingredient-search-container');
    const addBtn = document.getElementById('add-ingredient-btn');
    if (!container.classList.contains('hidden') &&
      !container.contains(e.target) &&
      !addBtn.contains(e.target)) {
      hideIngredientSearch();
    }
  });

  // New Recipe button
  document.getElementById('btn-new-recipe').addEventListener('click', () => {
    openEditModal(null);
  });
}
