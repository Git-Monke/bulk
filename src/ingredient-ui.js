// Ingredient sidebar list, ingredient modal, and category dropdowns.
import { ALL_RECIPES, INGREDIENTS, isCustomIngredient, addCustomIngredientToIngredients, removeCustomIngredientFromIngredients } from './data.js';
import { saveCustomIngredient, deleteCustomIngredient, calculateIngredientServing, findRecipesUsingIngredient, fmtNum } from './calculations.js';

let onIngredientChangedCallback = null;
export function setOnIngredientChangedCallback(cb) { onIngredientChangedCallback = cb; }

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

// -------------------------------------------
// INGREDIENT LIST RENDERING
// -------------------------------------------

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

// -------------------------------------------
// INGREDIENT MODAL
// -------------------------------------------

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
