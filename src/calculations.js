// ============================================
// CALCULATIONS & FORMATTING
// ============================================
//
// Pure utility functions for macro calculations, formatting, and data access.

import {
  INGREDIENTS,
  ALL_RECIPES,
  CUSTOM_RECIPES_KEY,
  CUSTOM_INGREDIENTS_KEY,
  setLoadCustomRecipesFn,
  setLoadCustomIngredientsFn
} from './data.js';

// Set up the callbacks so data.js can call our loaders
setLoadCustomRecipesFn(loadCustomRecipes);
setLoadCustomIngredientsFn(loadCustomIngredients);

// -------------------------------------------
// MACRO CALCULATIONS
// -------------------------------------------

export function calculateRecipeMacros(recipe, multiplier = 1) {
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
    const preppedMultiplier = ingredient.preppedMultiplier ?? 1;
    total.preppedWeight += rawAmount * preppedMultiplier;
  }

  return total;
}

// Stats for an ingredient at its display serving size: macros + price.
// `unit` is the ingredient's base unit (g/ml/etc.), and serving math is a
// flat ratio over 100 — same model as recipe ingredients.
export function calculateIngredientServing(ingredient) {
  const serving = ingredient.servingSize ?? 100;
  const ratio = serving / 100;
  return {
    serving,
    calories: ingredient.macrosPer100g.calories * ratio,
    protein: ingredient.macrosPer100g.protein * ratio,
    carbs: ingredient.macrosPer100g.carbs * ratio,
    fat: ingredient.macrosPer100g.fat * ratio,
    price: ingredient.pricePerUnit * serving
  };
}

// Find every recipe (base + custom + auto-generated) that references an
// ingredient by id. Used to block deletion of an ingredient still in use.
export function findRecipesUsingIngredient(ingredientId) {
  return ALL_RECIPES.filter(r => r.ingredients.some(i => i.id === ingredientId));
}

export function computeOccurrences(days, variants) {
  // Each variant repeats floor(days/variants) times; the first (days % variants) get one extra
  const base = Math.floor(days / variants);
  const extra = days % variants;
  return Array.from({ length: variants }, (_, i) => base + (i < extra ? 1 : 0));
}

// -------------------------------------------
// FORMATTING
// -------------------------------------------

export function fmtNum(num, isPrice = false) {
  if (isPrice) return '$' + num.toFixed(2);
  if (num === 0) return '0';
  if (num >= 100) return Math.round(num).toString();
  return parseFloat(num.toPrecision(2)).toString();
}

// -------------------------------------------
// STORAGE (Calculated data access)
// -------------------------------------------

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

export function getCustomRecipe(recipeId) {
  const custom = loadCustomRecipes();
  return custom[recipeId] || null;
}

export function saveCustomRecipe(recipe) {
  const custom = loadCustomRecipes();
  custom[recipe.id] = recipe;
  saveCustomRecipes(custom);
}

export function deleteCustomRecipe(recipeId) {
  const custom = loadCustomRecipes();
  delete custom[recipeId];
  saveCustomRecipes(custom);
}

// Get recipe merged with custom overrides
export function getRecipe(recipeId) {
  const custom = getCustomRecipe(recipeId);
  const base = ALL_RECIPES.find(r => r.id === recipeId);
  return custom || base;
}

// Check if recipe has custom overrides
export function isRecipeModified(recipeId) {
  return getCustomRecipe(recipeId) !== null;
}

// -------------------------------------------
// CUSTOM INGREDIENT STORAGE
// -------------------------------------------

function loadCustomIngredients() {
  try {
    const raw = localStorage.getItem(CUSTOM_INGREDIENTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCustomIngredients(customIngredients) {
  localStorage.setItem(CUSTOM_INGREDIENTS_KEY, JSON.stringify(customIngredients));
}

export function getCustomIngredient(ingredientId) {
  const custom = loadCustomIngredients();
  return custom[ingredientId] || null;
}

export function saveCustomIngredient(ingredient) {
  const custom = loadCustomIngredients();
  custom[ingredient.id] = ingredient;
  saveCustomIngredients(custom);
}

export function deleteCustomIngredient(ingredientId) {
  const custom = loadCustomIngredients();
  delete custom[ingredientId];
  saveCustomIngredients(custom);
}

// -------------------------------------------
// PERSISTENCE
// -------------------------------------------

export function saveToStorage(gridStateData, nextEntryId) {
  const data = {
    gridState: Object.fromEntries(gridStateData),
    nextEntryId,
    days: document.getElementById('input-days')?.value,
    meals: document.getElementById('input-meals')?.value,
    variants: document.getElementById('input-variants')?.value,
  };
  localStorage.setItem('bulk-meal-planner-v1', JSON.stringify(data));
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem('bulk-meal-planner-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearStorage() {
  localStorage.removeItem('bulk-meal-planner-v1');
}

// -------------------------------------------
// GOALS
// -------------------------------------------

const GOALS_KEY = 'bulk-meal-planner-goals';

// Default/example goals
const DEFAULT_GOALS = {
  calories: { atLeast: 2500, atMost: 3000 },
  protein: { atLeast: 150, atMost: null },
  carbs: { atLeast: null, atMost: 250 },
  fat: { atLeast: null, atMost: null }
};

export function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) {
      // First load: seed with defaults
      saveGoals(DEFAULT_GOALS);
      return DEFAULT_GOALS;
    }
    return JSON.parse(raw);
  } catch {
    // On error, seed with defaults
    saveGoals(DEFAULT_GOALS);
    return DEFAULT_GOALS;
  }
}

export function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

// Check if a value violates a goal
// Returns: 'violated' | 'ok' | 'no_goal'
export function checkGoal(actual, goal) {
  if (goal.atLeast === null && goal.atMost === null) return 'no_goal';
  if (goal.atLeast !== null && actual < goal.atLeast) return 'violated';
  if (goal.atMost !== null && actual > goal.atMost) return 'violated';
  return 'ok';
}
