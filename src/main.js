// ============================================
// MAIN APPLICATION ENTRY
// ============================================

// Import modules
import { renderRecipeList, initEditModalListeners, setOnRecipeModifiedCallback } from './recipe-ui.js';
import { renderMealGrid, updateSummary, initGridFromStorage } from './grid-ui.js';
import { generatePrintView } from './print.js';
import { clearGridState } from './state.js';
import { clearStorage } from './calculations.js';

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
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Load saved state from storage
  initGridFromStorage();

  // Render initial UI
  renderRecipeList();
  renderMealGrid();

  // Initialize edit modal listeners
  initEditModalListeners();

  // Set callback for when recipes are modified (to refresh grid and summary)
  setOnRecipeModifiedCallback(() => {
    renderRecipeList();
    renderMealGrid();
    updateSummary();
  });
});
