// ============================================
// MAIN APPLICATION ENTRY
// ============================================

// Import CSS (Tailwind + DaisyUI processed via PostCSS, then custom CSS)
import './styles.css';
import '../css/tokens.css';
import '../css/base.css';
import '../css/layout.css';
import '../css/components-buttons-agent.css';
import '../css/components-cards.css';
import '../css/components-slots.css';
import '../css/components-panels.css';
import '../css/utilities.css';

// Import modules that provide globals (lucide, sortable)
import { createIcons, icons } from 'lucide';
import Sortable from 'sortablejs';

// Make available globally for modules that use them
window.icons = icons;
window.createIcons = createIcons;
window.Sortable = Sortable;

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
import { initAgentView } from './agent-ui.js';
import { initGoalsSettings } from './goals-ui.js';

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
// TOP-LEVEL TABS (Manual <-> Agent)
// ============================================

let currentTab = 'manual';

function applyTab(tab) {
  currentTab = tab;
  const tabManual = document.getElementById('tab-manual');
  const tabAgent = document.getElementById('tab-agent');
  const manualView = document.getElementById('manual-view');
  const agentView = document.getElementById('agent-view');

  if (tab === 'manual') {
    tabManual.classList.add('active');
    tabAgent.classList.remove('active');
    manualView.classList.remove('hidden');
    agentView.classList.add('hidden');
  } else {
    tabManual.classList.remove('active');
    tabAgent.classList.add('active');
    manualView.classList.add('hidden');
    agentView.classList.remove('hidden');
  }
}

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
  // Initialize Lucide icons
  createIcons({ icons });

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

  // Goals settings modal.
  initGoalsSettings();

  // Top-level tabs (Manual / Agent).
  document.getElementById('tab-manual').addEventListener('click', () => {
    applyTab('manual');
  });
  document.getElementById('tab-agent').addEventListener('click', () => {
    applyTab('agent');
    initAgentView();
  });

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
