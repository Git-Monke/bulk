// ============================================
// RECIPE UI
// ============================================
//
// Recipe sidebar list and edit modal.
// Note: This module depends on grid-ui.js functions but those are
// called from main.js to avoid circular imports.

import {
  ALL_RECIPES,
  INGREDIENTS,
  isCustomIngredient,
  addCustomIngredientToIngredients,
  removeCustomIngredientFromIngredients,
  removeRecipeFromList
} from './data.js';
import {
  getRecipe,
  isRecipeModified,
  saveCustomRecipe,
  deleteCustomRecipe,
  saveCustomIngredient,
  deleteCustomIngredient,
  calculateRecipeMacros,
  calculateIngredientServing,
  findRecipesUsingIngredient,
  fmtNum
} from './calculations.js';

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

}

// ============================================
// CATEGORY DROPDOWNS
// ============================================

const DEFAULT_RECIPE_CATEGORIES = ['meal', 'drink', 'snack'];
const DEFAULT_INGREDIENT_CATEGORIES = ['protein', 'carb', 'vegetable', 'fat', 'sauce', 'extra', 'drink', 'snack'];

function getRecipeCategoryUnion() {
  const set = new Set(DEFAULT_RECIPE_CATEGORIES);
  for (const r of ALL_RECIPES) if (r.category) set.add(r.category);
  return Array.from(set);
}

function getIngredientCategoryUnion() {
  const set = new Set(DEFAULT_INGREDIENT_CATEGORIES);
  for (const ing of Object.values(INGREDIENTS)) if (ing.category) set.add(ing.category);
  return Array.from(set);
}

function getAllCategoryUnion() {
  const set = new Set([...DEFAULT_RECIPE_CATEGORIES, ...DEFAULT_INGREDIENT_CATEGORIES]);
  for (const r of ALL_RECIPES) if (r.category) set.add(r.category);
  for (const ing of Object.values(INGREDIENTS)) if (ing.category) set.add(ing.category);
  return Array.from(set);
}

function fillCategorySelect(select, cats) {
  const previous = select.value;
  select.innerHTML = '';
  for (const cat of cats) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1) + 's';
    select.appendChild(opt);
  }
  select.value = cats.includes(previous) ? previous : cats[0];
}

// Refresh both category selects. Preserves each current selection if it
// still exists; otherwise falls back to the first option.
export function populateCategoryDropdowns() {
  const recipeSelect = document.getElementById('recipe-category');
  if (recipeSelect) fillCategorySelect(recipeSelect, getRecipeCategoryUnion());

  const ingSelect = document.getElementById('ingredient-category');
  if (ingSelect) fillCategorySelect(ingSelect, getIngredientCategoryUnion());
}

// ============================================
// INGREDIENT LIST RENDERING
// ============================================

export function renderIngredientList() {
  const container = document.getElementById('ingredient-list');
  if (!container) return;
  container.innerHTML = '';

  const activeCategory = document.getElementById('ingredient-category')?.value;
  const entries = Object.entries(INGREDIENTS)
    .filter(([, ing]) => ing.category === activeCategory);

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-line">No ingredients in this category yet.</p>';
    return;
  }

  // Custom first, then base. Within each group, alphabetical by name.
  entries.sort(([, a], [, b]) => {
    const aCustom = !!a.custom, bCustom = !!b.custom;
    if (aCustom !== bCustom) return aCustom ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const [id, ing] of entries) {
    const stats = calculateIngredientServing(ing);
    const editable = isCustomIngredient(id);

    const card = document.createElement('div');
    card.className = 'ingredient-card' + (editable ? ' is-custom' : '');
    card.dataset.ingredientId = id;
    card.innerHTML = `
      ${editable ? `
        <button class="recipe-card-edit edit-ingredient-btn" title="Edit Ingredient" aria-label="Edit Ingredient">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/>
            <path d="M17.586 3.586a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      ` : ''}
      <div class="recipe-card-name">${ing.name}</div>
      <div class="recipe-card-stats">
        <span><span class="stat-num">${fmtNum(stats.calories)}</span> kcal</span>
        <span><span class="stat-num">${fmtNum(stats.protein)}g</span> prot</span>
        <span><span class="stat-num">${fmtNum(stats.carbs)}g</span> carbs</span>
        <span><span class="stat-num">${fmtNum(stats.fat)}g</span> fat</span>
      </div>
      <div class="ingredient-card-meta">
        <span>per <span class="stat-num">${fmtNum(stats.serving)}</span> ${ing.unit}</span>
        <span class="recipe-card-price">${fmtNum(stats.price, true)}</span>
      </div>
    `;

    if (editable) {
      card.querySelector('.edit-ingredient-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openIngredientModal(id);
      });
    }

    container.appendChild(card);
  }
}

// ============================================
// INGREDIENT MODAL
// ============================================

let editingIngredientId = null;
let isNewIngredient = false;

function generateIngredientId(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ingredient';
  const suffix = Date.now().toString(36);
  return `${slug}-${suffix}`;
}

function getIngMacroMode() {
  const radios = document.getElementsByName('ing-macro-mode');
  for (const r of radios) if (r.checked) return r.value;
  return 'per100g';
}

function getIngPriceMode() {
  const radios = document.getElementsByName('ing-price-mode');
  for (const r of radios) if (r.checked) return r.value;
  return 'perUnit';
}

function setIngMacroMode(mode) {
  for (const r of document.getElementsByName('ing-macro-mode')) {
    r.checked = (r.value === mode);
  }
}

function setIngPriceMode(mode) {
  for (const r of document.getElementsByName('ing-price-mode')) {
    r.checked = (r.value === mode);
  }
}

function syncIngUnitLabels() {
  const unit = document.getElementById('ing-unit').value.trim() || 'g';
  const priceMode = getIngPriceMode();
  document.getElementById('ing-mode-unit-100').textContent = unit;
  document.getElementById('ing-serving-unit').textContent = unit;
  document.getElementById('ing-package-unit').textContent = unit;
  document.getElementById('ing-price-mode-label').textContent =
    priceMode === 'perUnit' ? `per ${unit}`
    : priceMode === 'perServing' ? 'per serving'
    : 'per package';
  document.getElementById('ing-package-wrap').classList.toggle('hidden', priceMode !== 'perPackage');
}

function showIngError(msg) {
  const el = document.getElementById('ing-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearIngError() {
  const el = document.getElementById('ing-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function renderIngCategorySuggestions(query) {
  const list = document.getElementById('ing-category-suggestions');
  list.innerHTML = '';
  const q = query.toLowerCase().trim();
  const matches = getAllCategoryUnion()
    .filter(c => !q || c.toLowerCase().includes(q))
    .slice(0, 8);
  if (matches.length === 0) {
    list.classList.add('hidden');
    return;
  }
  for (const cat of matches) {
    const li = document.createElement('li');
    li.className = 'ing-suggest-item';
    li.textContent = cat;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.getElementById('ing-category').value = cat;
      list.classList.add('hidden');
    });
    list.appendChild(li);
  }
  list.classList.remove('hidden');
}

export function openIngredientModal(ingredientId) {
  const modal = document.getElementById('ingredient-modal');
  clearIngError();

  const nameInput = document.getElementById('ing-name');
  const categoryInput = document.getElementById('ing-category');
  const calsInput = document.getElementById('ing-calories');
  const protInput = document.getElementById('ing-protein');
  const carbsInput = document.getElementById('ing-carbs');
  const fatInput = document.getElementById('ing-fat');
  const unitInput = document.getElementById('ing-unit');
  const servingInput = document.getElementById('ing-serving');
  const priceInput = document.getElementById('ing-price');
  const isRecipeInput = document.getElementById('ing-is-recipe');
  const deleteBtn = document.getElementById('ing-delete-btn');

  setIngMacroMode('per100g');
  setIngPriceMode('perUnit');

  if (ingredientId === null) {
    isNewIngredient = true;
    editingIngredientId = null;
    nameInput.value = '';
    categoryInput.value = '';
    calsInput.value = '';
    protInput.value = '';
    carbsInput.value = '';
    fatInput.value = '';
    unitInput.value = 'g';
    servingInput.value = 100;
    priceInput.value = '';
    document.getElementById('ing-package-size').value = '';
    isRecipeInput.checked = false;
    deleteBtn.classList.add('hidden');
  } else {
    const ing = INGREDIENTS[ingredientId];
    if (!ing || !isCustomIngredient(ingredientId)) return;
    isNewIngredient = false;
    editingIngredientId = ingredientId;

    // Restore the raw user input verbatim. Fall back to the derived per-100g
    // values for any pre-macroEntry saves still in localStorage.
    const me = ing.macroEntry || { mode: 'per100g', ...ing.macrosPer100g };
    const pe = ing.priceEntry || { mode: 'perUnit', price: ing.pricePerUnit };

    nameInput.value = ing.name;
    categoryInput.value = ing.category || '';
    calsInput.value = me.calories;
    protInput.value = me.protein;
    carbsInput.value = me.carbs;
    fatInput.value = me.fat;
    unitInput.value = ing.unit;
    servingInput.value = ing.servingSize;
    priceInput.value = pe.price;
    document.getElementById('ing-package-size').value = pe.packageSize ?? '';
    setIngMacroMode(me.mode);
    setIngPriceMode(pe.mode);
    isRecipeInput.checked = !!ing.isRecipe;
    deleteBtn.classList.remove('hidden');
  }

  syncIngUnitLabels();
  document.getElementById('ing-category-suggestions').classList.add('hidden');
  modal.showModal();
}

// Build an ingredient object from modal fields. Returns { ingredient } or
// { error } for caller to display. Stores the raw user input verbatim
// (mode + numbers); per-100g/per-unit values are derived later by
// `addCustomIngredientToIngredients`.
function readIngredientForm() {
  const name = document.getElementById('ing-name').value.trim();
  const category = document.getElementById('ing-category').value.trim();
  const cals = parseFloat(document.getElementById('ing-calories').value) || 0;
  const protein = parseFloat(document.getElementById('ing-protein').value) || 0;
  const carbs = parseFloat(document.getElementById('ing-carbs').value) || 0;
  const fat = parseFloat(document.getElementById('ing-fat').value) || 0;
  const unit = document.getElementById('ing-unit').value.trim();
  const serving = parseFloat(document.getElementById('ing-serving').value) || 0;
  const price = parseFloat(document.getElementById('ing-price').value) || 0;
  const packageSize = parseFloat(document.getElementById('ing-package-size').value) || 0;
  const isRecipe = document.getElementById('ing-is-recipe').checked;
  const macroMode = getIngMacroMode();
  const priceMode = getIngPriceMode();

  if (!name) return { error: 'Name is required.' };
  if (!unit) return { error: 'Unit is required.' };
  if (!(serving > 0)) return { error: 'Serving size must be greater than 0.' };
  if (cals + protein + carbs + fat <= 0) return { error: 'At least one macro must be greater than 0.' };
  if (!(price > 0)) return { error: 'Price must be greater than 0.' };
  if (priceMode === 'perPackage' && !(packageSize > 0)) return { error: 'Package size must be greater than 0.' };
  if (isRecipe && !category) return { error: '"Also a recipe" requires a category.' };

  const macroEntry = { mode: macroMode, calories: cals, protein, carbs, fat };
  const priceEntry = priceMode === 'perPackage'
    ? { mode: 'perPackage', price, packageSize }
    : { mode: priceMode, price };

  return {
    ingredient: {
      name,
      category: category || undefined,
      macroEntry,
      priceEntry,
      unit,
      servingSize: serving,
      isRecipe
    }
  };
}

let onIngredientChangedCallback = null;
export function setOnIngredientChangedCallback(cb) {
  onIngredientChangedCallback = cb;
}

function saveIngredient() {
  clearIngError();
  const result = readIngredientForm();
  if (result.error) {
    showIngError(result.error);
    return false;
  }

  const id = isNewIngredient
    ? generateIngredientId(result.ingredient.name)
    : editingIngredientId;

  const full = { id, ...result.ingredient };
  saveCustomIngredient(full);
  addCustomIngredientToIngredients(full);

  if (onIngredientChangedCallback) onIngredientChangedCallback();
  return true;
}

function deleteIngredient() {
  if (!editingIngredientId) return;
  const used = findRecipesUsingIngredient(editingIngredientId);
  // The auto-generated single-ingredient recipe doesn't count as "in use".
  const blocking = used.filter(r => r.id !== editingIngredientId);
  if (blocking.length > 0) {
    const names = blocking.map(r => r.name).join(', ');
    showIngError(`Cannot delete: used in ${blocking.length} recipe(s): ${names}`);
    return;
  }
  if (!confirm(`Delete "${INGREDIENTS[editingIngredientId].name}"? This cannot be undone.`)) return;

  deleteCustomIngredient(editingIngredientId);
  removeCustomIngredientFromIngredients(editingIngredientId);

  if (onIngredientChangedCallback) onIngredientChangedCallback();
  document.getElementById('ingredient-modal').close();
}

export function initIngredientModalListeners() {
  document.getElementById('ing-cancel-btn').addEventListener('click', () => {
    document.getElementById('ingredient-modal').close();
  });
  document.getElementById('ing-save-btn').addEventListener('click', () => {
    if (saveIngredient()) document.getElementById('ingredient-modal').close();
  });
  document.getElementById('ing-delete-btn').addEventListener('click', deleteIngredient);

  document.getElementById('ing-unit').addEventListener('input', syncIngUnitLabels);
  for (const r of document.getElementsByName('ing-price-mode')) {
    r.addEventListener('change', syncIngUnitLabels);
  }

  const catInput = document.getElementById('ing-category');
  catInput.addEventListener('focus', () => renderIngCategorySuggestions(catInput.value));
  catInput.addEventListener('input', () => renderIngCategorySuggestions(catInput.value));
  catInput.addEventListener('blur', () => {
    // Delay so suggestion mousedown can fire first.
    setTimeout(() => document.getElementById('ing-category-suggestions').classList.add('hidden'), 100);
  });
}
