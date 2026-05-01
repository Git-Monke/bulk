// ============================================
// INGREDIENTS DATABASE
// ============================================
//
// Every ingredient has a `servingSize` (the amount, in `unit`, that the
// ingredient card displays macros for). Base ingredients default to 100
// (matching the per-100g macros). Custom ingredients carry `custom: true`
// so we can distinguish editable user data from read-only base data.
const INGREDIENTS = {
  // Proteins
  "chicken-breast": {
    name: "Chicken breast",
    macrosPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    pricePerUnit: 0.012,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.75,
    category: "protein"
  },
  "ground-beef-90": {
    name: "Ground beef (90% lean)",
    macrosPer100g: { calories: 176, protein: 20, carbs: 0, fat: 10 },
    pricePerUnit: 0.011,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.85,
    category: "protein"
  },
  "salmon-fillet": {
    name: "Salmon fillet",
    macrosPer100g: { calories: 208, protein: 20, carbs: 0, fat: 13 },
    pricePerUnit: 0.022,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.85,
    category: "protein"
  },
  "eggs": {
    name: "Eggs",
    macrosPer100g: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
    pricePerUnit: 0.003,
    unit: "g",
    servingSize: 100,
    category: "protein"
  },
  "tofu-firm": {
    name: "Tofu (firm)",
    macrosPer100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
    pricePerUnit: 0.006,
    unit: "g",
    servingSize: 100,
    category: "protein"
  },
  "shrimp": {
    name: "Shrimp",
    macrosPer100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
    pricePerUnit: 0.018,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.9,
    category: "protein"
  },


  // Carbs
  "white-rice-dry": {
    name: "White rice (dry)",
    macrosPer100g: { calories: 365, protein: 7, carbs: 80, fat: 0.6 },
    pricePerUnit: 0.003,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 3.0,
    category: "carb"
  },
  "brown-rice-dry": {
    name: "Brown rice (dry)",
    macrosPer100g: { calories: 362, protein: 7.5, carbs: 76, fat: 2.7 },
    pricePerUnit: 0.004,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 2.5,
    category: "carb"
  },
  "pasta-dry": {
    name: "Pasta (dry)",
    macrosPer100g: { calories: 371, protein: 13, carbs: 75, fat: 1.5 },
    pricePerUnit: 0.002,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 2.0,
    category: "carb"
  },
  "sweet-potato": {
    name: "Sweet potato",
    macrosPer100g: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
    pricePerUnit: 0.002,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.9,
    category: "carb"
  },
  "quinoa-dry": {
    name: "Quinoa (dry)",
    macrosPer100g: { calories: 368, protein: 14, carbs: 64, fat: 6 },
    pricePerUnit: 0.007,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 2.7,
    category: "carb"
  },
  "bread-whole-wheat": {
    name: "Whole wheat bread",
    macrosPer100g: { calories: 247, protein: 13, carbs: 41, fat: 3.4 },
    pricePerUnit: 0.10,
    unit: "slice",
    servingSize: 100,
    category: "carb"
  },

  // Vegetables
  "broccoli": {
    name: "Broccoli",
    macrosPer100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    pricePerUnit: 0.004,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.95,
    category: "vegetable"
  },
  "spinach": {
    name: "Spinach",
    macrosPer100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
    pricePerUnit: 0.005,
    unit: "g",
    servingSize: 100,
    category: "vegetable"
  },
  "bell-pepper": {
    name: "Bell pepper",
    macrosPer100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
    pricePerUnit: 0.005,
    unit: "g",
    servingSize: 100,
    category: "vegetable"
  },
  "onion": {
    name: "Onion",
    macrosPer100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
    pricePerUnit: 0.001,
    unit: "g",
    servingSize: 100,
    category: "vegetable"
  },
  "zucchini": {
    name: "Zucchini",
    macrosPer100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
    pricePerUnit: 0.003,
    unit: "g",
    servingSize: 100,
    category: "vegetable"
  },
  "mixed-veggies": {
    name: "Mixed vegetables",
    macrosPer100g: { calories: 48, protein: 2.5, carbs: 8, fat: 0.5 },
    pricePerUnit: 0.003,
    unit: "g",
    servingSize: 100,
    preppedMultiplier: 0.95,
    category: "vegetable"
  },

  // Fats & Sauces
  "olive-oil": {
    name: "Olive oil",
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    pricePerUnit: 0.008,
    unit: "ml",
    servingSize: 100,
    category: "fat"
  },
  "butter": {
    name: "Butter",
    macrosPer100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
    pricePerUnit: 0.009,
    unit: "g",
    servingSize: 100,
    category: "fat"
  },
  "soy-sauce": {
    name: "Soy sauce",
    macrosPer100g: { calories: 53, protein: 8, carbs: 5, fat: 0 },
    pricePerUnit: 0.002,
    unit: "ml",
    servingSize: 100,
    category: "sauce"
  },
  "teriyaki-sauce": {
    name: "Teriyaki sauce",
    macrosPer100g: { calories: 89, protein: 5, carbs: 16, fat: 0 },
    pricePerUnit: 0.004,
    unit: "ml",
    servingSize: 100,
    category: "sauce"
  },

  // Extras
  "greek-yogurt": {
    name: "Greek yogurt",
    macrosPer100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.7 },
    pricePerUnit: 0.005,
    unit: "g",
    servingSize: 100,
    category: "extra"
  },
  "oats": {
    name: "Oats",
    macrosPer100g: { calories: 389, protein: 17, carbs: 66, fat: 7 },
    pricePerUnit: 0.002,
    unit: "g",
    servingSize: 100,
    category: "extra"
  },
  "peanut-butter": {
    name: "Peanut butter",
    macrosPer100g: { calories: 588, protein: 25, carbs: 20, fat: 50 },
    pricePerUnit: 0.008,
    unit: "g",
    servingSize: 100,
    category: "extra"
  },
  "banana": {
    name: "Banana",
    macrosPer100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    pricePerUnit: 0.002,
    unit: "g",
    servingSize: 100,
    category: "extra"
  },
  "garlic": {
    name: "Garlic",
    macrosPer100g: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5 },
    pricePerUnit: 0.015,
    unit: "g",
    servingSize: 100,
    category: "extra"
  },

  // Drinks
  "whole-milk": {
    name: "Whole milk",
    macrosPer100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
    pricePerUnit: 0.001,
    unit: "ml",
    isRecipe: true,
    servingSize: 300,
    category: "drink"
  },
  "orange-juice": {
    name: "Orange juice",
    macrosPer100g: { calories: 45, protein: 0.7, carbs: 10, fat: 0.2 },
    pricePerUnit: 0.002,
    unit: "ml",
    isRecipe: true,
    servingSize: 250,
    category: "drink"
  },
  "whey-protein-powder": {
    name: "Whey protein powder",
    macrosPer100g: { calories: 380, protein: 80, carbs: 7, fat: 4 },
    pricePerUnit: 0.04,
    unit: "g",
    servingSize: 30,
    category: "drink"
  },
  // Snacks
  "chewy-granola-bar": {
    name: "Kirkland Granola Bar",
    macrosPer100g: { calories: 417, protein: 4.2, carbs: 75, fat: 12.5 },
    pricePerUnit: 0.00625,
    unit: "g",
    isRecipe: true,
    servingSize: 24,
    category: "snack"
  }
};


// ============================================
// RECIPES DATABASE
// ============================================
const RECIPES = [
  {
    id: "chicken-rice",
    category: "meal",
    name: "Chicken & Rice",
    servingSize: 450,
    ingredients: [
      { id: "chicken-breast", amount: 200 },
      { id: "white-rice-dry", amount: 100 },
      { id: "olive-oil", amount: 10 },
      { id: "broccoli", amount: 80 },
      { id: "soy-sauce", amount: 15 }
    ],
    prepNotes: "Season chicken, bake at 375°F for 25 min. Cook rice. Steam broccoli. Divide into containers."
  },
  {
    id: "beef-bowl",
    category: "meal",
    name: "Beef Rice Bowl",
    servingSize: 420,
    ingredients: [
      { id: "ground-beef-90", amount: 180 },
      { id: "brown-rice-dry", amount: 80 },
      { id: "bell-pepper", amount: 100 },
      { id: "onion", amount: 50 },
      { id: "teriyaki-sauce", amount: 30 }
    ],
    prepNotes: "Brown beef with onions and peppers. Cook rice. Mix with teriyaki sauce. Portion into containers."
  },
  {
    id: "salmon-potato",
    category: "meal",
    name: "Salmon & Sweet Potato",
    servingSize: 380,
    ingredients: [
      { id: "salmon-fillet", amount: 170 },
      { id: "sweet-potato", amount: 200 },
      { id: "spinach", amount: 60 },
      { id: "olive-oil", amount: 8 },
      { id: "butter", amount: 5 }
    ],
    prepNotes: "Bake salmon at 400°F for 15 min. Roast cubed sweet potato. Wilt spinach in pan. Assemble and portion."
  },
  {
    id: "shrimp-pasta",
    category: "meal",
    name: "Garlic Shrimp Pasta",
    servingSize: 400,
    ingredients: [
      { id: "shrimp", amount: 200 },
      { id: "pasta-dry", amount: 90 },
      { id: "bell-pepper", amount: 80 },
      { id: "onion", amount: 40 },
      { id: "olive-oil", amount: 12 },
      { id: "garlic", amount: 10 }
    ],
    prepNotes: "Cook pasta. Sauté shrimp with garlic, peppers, onions. Toss together. Cool and portion."
  },
  {
    id: "tofu-stirfry",
    category: "meal",
    name: "Tofu Stir Fry",
    servingSize: 350,
    ingredients: [
      { id: "tofu-firm", amount: 200 },
      { id: "mixed-veggies", amount: 150 },
      { id: "soy-sauce", amount: 25 },
      { id: "olive-oil", amount: 10 },
      { id: "white-rice-dry", amount: 60 }
    ],
    prepNotes: "Press and cube tofu. Cook rice. Stir fry veggies, add tofu and soy sauce. Combine and portion."
  },
  {
    id: "egg-rice",
    category: "meal",
    name: "Egg & Rice",
    servingSize: 320,
    ingredients: [
      { id: "eggs", amount: 150 },
      { id: "white-rice-dry", amount: 100 },
      { id: "mixed-veggies", amount: 80 },
      { id: "soy-sauce", amount: 10 }
    ],
    prepNotes: "Cook rice. Scramble eggs. Stir fry veggies, add rice and eggs. Season with soy sauce and portion."
  },
  {
    id: "breakfast-bowl",
    category: "meal",
    name: "Breakfast Bowl",
    servingSize: 280,
    ingredients: [
      { id: "eggs", amount: 120 },
      { id: "oats", amount: 60 },
      { id: "banana", amount: 100 },
      { id: "peanut-butter", amount: 20 },
      { id: "greek-yogurt", amount: 60 }
    ],
    prepNotes: "Cook oats. Scramble eggs. Slice banana. Layer in container: oats, yogurt, eggs, banana, peanut butter."
  },

  // Drinks (multi-ingredient recipes only)
  {
    id: "protein-shake",
    category: "drink",
    name: "Protein Shake",
    servingSize: 270,
    displayUnit: "weight",
    ingredients: [
      { id: "whey-protein-powder", amount: 30 },
      { id: "whole-milk", amount: 240 }
    ],
    prepNotes: "Add 1 scoop (30g) whey protein to 240ml whole milk. Shake or blend until smooth."
  }
];

// Build a recipe object from an ingredient flagged with isRecipe: true.
function buildAutoRecipe(ingId, ingredient) {
  return {
    id: ingId,
    category: ingredient.category || "meal",
    name: ingredient.name,
    servingSize: ingredient.servingSize,
    ingredients: [{ id: ingId, amount: ingredient.servingSize }]
  };
}

// Generate recipes from ingredients marked with isRecipe: true
function generateRecipesFromIngredients() {
  const generatedRecipes = [];

  for (const [ingId, ingredient] of Object.entries(INGREDIENTS)) {
    if (ingredient.isRecipe) {
      generatedRecipes.push(buildAutoRecipe(ingId, ingredient));
    }
  }

  return generatedRecipes;
}

// Merge generated recipes with base recipes
let ALL_RECIPES = [...RECIPES, ...generateRecipesFromIngredients()];

// Getter for ALL_RECIPES so it can be imported directly
export function getAllRecipes() {
  return ALL_RECIPES;
}

// Direct reference to ALL_RECIPES for synchronous access
export { ALL_RECIPES };

export function addCustomRecipeToList(recipe) {
  // Check if recipe already exists, if so update it
  const existingIndex = ALL_RECIPES.findIndex(r => r.id === recipe.id);
  if (existingIndex >= 0) {
    ALL_RECIPES[existingIndex] = recipe;
  } else {
    ALL_RECIPES.push(recipe);
  }
}

export function removeRecipeFromList(recipeId) {
  const index = ALL_RECIPES.findIndex(r => r.id === recipeId);
  if (index >= 0) {
    ALL_RECIPES.splice(index, 1);
  }
}

export function loadCustomRecipesIntoAll() {
  // This must be called after calculations.js is loaded since it depends on loadCustomRecipes
  const custom = loadCustomRecipesFromStorage();
  for (const recipe of Object.values(custom)) {
    addCustomRecipeToList(recipe);
  }
}

// Lazy load to avoid circular import - calculations.js will define this
let loadCustomRecipesFromStorage = () => ({});
export function setLoadCustomRecipesFn(fn) {
  loadCustomRecipesFromStorage = fn;
}

const CUSTOM_RECIPES_KEY = 'bulk-meal-planner-recipes';
const CUSTOM_INGREDIENTS_KEY = 'bulk-meal-planner-ingredients';

// ============================================
// CUSTOM INGREDIENTS
// ============================================

// Lazy load to avoid circular import - calculations.js will define this
let loadCustomIngredientsFromStorage = () => ({});
export function setLoadCustomIngredientsFn(fn) {
  loadCustomIngredientsFromStorage = fn;
}

export function isCustomIngredient(ingredientId) {
  const ing = INGREDIENTS[ingredientId];
  return !!(ing && ing.custom);
}

// Derive the math-facing fields (`macrosPer100g`, `pricePerUnit`) from the
// raw user input stored on a custom ingredient. Storage holds whatever the
// user typed; this projects it onto the schema the rest of the app uses.
function deriveDerivedFields(ing) {
  // Legacy shape (older saves predating macroEntry/priceEntry): pass through.
  if (!ing.macroEntry || !ing.priceEntry) {
    return {
      macrosPer100g: ing.macrosPer100g,
      pricePerUnit: ing.pricePerUnit
    };
  }
  const me = ing.macroEntry;
  const macroFactor = me.mode === 'per100g' ? 1 : 100 / ing.servingSize;
  const macrosPer100g = {
    calories: me.calories * macroFactor,
    protein: me.protein * macroFactor,
    carbs: me.carbs * macroFactor,
    fat: me.fat * macroFactor
  };
  const pe = ing.priceEntry;
  const pricePerUnit =
    pe.mode === 'perUnit' ? pe.price
    : pe.mode === 'perServing' ? pe.price / ing.servingSize
    : pe.price / pe.packageSize;
  return { macrosPer100g, pricePerUnit };
}

// Add (or replace) a custom ingredient in the live INGREDIENTS map and
// keep its auto-generated recipe in sync with the isRecipe flag.
export function addCustomIngredientToIngredients(ingredient) {
  INGREDIENTS[ingredient.id] = {
    ...ingredient,
    ...deriveDerivedFields(ingredient),
    custom: true
  };
  if (ingredient.isRecipe) {
    addCustomRecipeToList(buildAutoRecipe(ingredient.id, INGREDIENTS[ingredient.id]));
  } else {
    removeRecipeFromList(ingredient.id);
  }
}

// Remove a custom ingredient and its auto-generated recipe (if any).
export function removeCustomIngredientFromIngredients(ingredientId) {
  if (!isCustomIngredient(ingredientId)) return;
  delete INGREDIENTS[ingredientId];
  removeRecipeFromList(ingredientId);
}

export function mergeCustomIngredientsIntoIngredients() {
  const custom = loadCustomIngredientsFromStorage();
  for (const ing of Object.values(custom)) {
    addCustomIngredientToIngredients(ing);
  }
}

export { INGREDIENTS, RECIPES, CUSTOM_RECIPES_KEY, CUSTOM_INGREDIENTS_KEY };
