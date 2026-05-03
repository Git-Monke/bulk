// ============================================
// MAIN APPLICATION ENTRY
// ============================================

// Import modules
import {
  renderRecipeList,
  openEditModal,
  initEditModalListeners,
  setOnRecipeModifiedCallback
} from './recipe-ui.js';
import {
  renderIngredientList,
  openIngredientModal,
  initIngredientModalListeners,
  setOnIngredientChangedCallback,
  populateCategoryDropdowns
} from './ingredient-ui.js';
import { renderMealGrid, updateSummary, initGridFromStorage } from './grid-ui.js';
import { generatePrintView } from './print.js';
import { clearGridState } from './state.js';
import { clearStorage } from './calculations.js';
import { loadCustomRecipesIntoAll, mergeCustomIngredientsIntoIngredients } from './data.js';

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('input-days').addEventListener('input', () => {
  renderMealGrid();
  updateSummary();
});
document.getElementById('input-meals').addEventListener('input', () => {
  renderMealGrid();
});
document.getElementById('input-variants').addEventListener('input', () => {
  renderMealGrid();
});
document.getElementById('recipe-category').addEventListener('change', () => {
  renderRecipeList();
});
document.getElementById('ingredient-category').addEventListener('change', () => {
  renderIngredientList();
});

// Print button
document.getElementById('btn-print').addEventListener('click', generatePrintView);

// Clear button
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('Clear all meals from the plan?')) return;
  clearGridState();
  clearStorage();
  renderMealGrid();
});

// ============================================
// VIEW TOGGLE (Recipes <-> Ingredients)
// ============================================

let currentView = 'recipes';

function applyView(view) {
  currentView = view;
  const recipesList = document.getElementById('recipe-list');
  const ingredientsList = document.getElementById('ingredient-list');
  const recipesSubheader = document.getElementById('recipes-subheader');
  const ingredientsSubheader = document.getElementById('ingredients-subheader');
  const newItemLabel = document.getElementById('btn-new-item-label');

  if (view === 'recipes') {
    recipesList.classList.remove('hidden');
    ingredientsList.classList.add('hidden');
    recipesSubheader.classList.remove('hidden');
    ingredientsSubheader.classList.add('hidden');
    newItemLabel.textContent = 'New Recipe';
    renderRecipeList();
  } else {
    recipesList.classList.add('hidden');
    ingredientsList.classList.remove('hidden');
    recipesSubheader.classList.add('hidden');
    ingredientsSubheader.classList.remove('hidden');
    newItemLabel.textContent = 'New Ingredient';
    renderIngredientList();
  }
}

function rerenderActiveSidebar() {
  if (currentView === 'recipes') renderRecipeList();
  else renderIngredientList();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Merge persisted custom data into the in-memory stores.
  loadCustomRecipesIntoAll();
  mergeCustomIngredientsIntoIngredients();

  // Build the recipe-category dropdown from the live data union.
  populateCategoryDropdowns();

  // Restore plan state.
  initGridFromStorage();

  // Initial render.
  applyView('recipes');
  renderMealGrid();

  // Modal listeners.
  initEditModalListeners();
  initIngredientModalListeners();

  // Sidebar view toggle.
  document.getElementById('view-toggle').addEventListener('change', (e) => {
    applyView(e.target.value);
  });

  // "New" button — behavior swaps with the active view.
  document.getElementById('btn-new-item').addEventListener('click', () => {
    if (currentView === 'recipes') openEditModal(null);
    else openIngredientModal(null);
  });

  // Refresh sidebar + grid + summary whenever recipes change.
  setOnRecipeModifiedCallback(() => {
    populateCategoryDropdowns();
    rerenderActiveSidebar();
    renderMealGrid();
    updateSummary();
  });

  // Refresh sidebar + grid + summary whenever ingredients change.
  // Ingredient edits can affect macros for any recipe that references them,
  // so the grid and summary must re-render too.
  setOnIngredientChangedCallback(() => {
    populateCategoryDropdowns();
    rerenderActiveSidebar();
    renderMealGrid();
    updateSummary();
  });
});
