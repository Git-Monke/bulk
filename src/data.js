// ============================================
// INGREDIENTS DATABASE
// ============================================
const INGREDIENTS = {
  // Proteins
  "chicken-breast": {
    name: "Chicken breast",
    macrosPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    pricePerUnit: 0.012,
    unit: "g"
  },
  "ground-beef-90": {
    name: "Ground beef (90% lean)",
    macrosPer100g: { calories: 176, protein: 20, carbs: 0, fat: 10 },
    pricePerUnit: 0.011,
    unit: "g"
  },
  "salmon-fillet": {
    name: "Salmon fillet",
    macrosPer100g: { calories: 208, protein: 20, carbs: 0, fat: 13 },
    pricePerUnit: 0.022,
    unit: "g"
  },
  "eggs": {
    name: "Eggs",
    macrosPer100g: { calories: 155, protein: 13, carbs: 1.1, fat: 11 },
    pricePerUnit: 0.003,
    unit: "g"
  },
  "tofu-firm": {
    name: "Tofu (firm)",
    macrosPer100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
    pricePerUnit: 0.006,
    unit: "g"
  },
  "shrimp": {
    name: "Shrimp",
    macrosPer100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
    pricePerUnit: 0.018,
    unit: "g"
  },

  // Carbs
  "white-rice-dry": {
    name: "White rice (dry)",
    macrosPer100g: { calories: 365, protein: 7, carbs: 80, fat: 0.6 },
    pricePerUnit: 0.003,
    unit: "g"
  },
  "brown-rice-dry": {
    name: "Brown rice (dry)",
    macrosPer100g: { calories: 362, protein: 7.5, carbs: 76, fat: 2.7 },
    pricePerUnit: 0.004,
    unit: "g"
  },
  "pasta-dry": {
    name: "Pasta (dry)",
    macrosPer100g: { calories: 371, protein: 13, carbs: 75, fat: 1.5 },
    pricePerUnit: 0.002,
    unit: "g"
  },
  "sweet-potato": {
    name: "Sweet potato",
    macrosPer100g: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
    pricePerUnit: 0.002,
    unit: "g"
  },
  "quinoa-dry": {
    name: "Quinoa (dry)",
    macrosPer100g: { calories: 368, protein: 14, carbs: 64, fat: 6 },
    pricePerUnit: 0.007,
    unit: "g"
  },
  "bread-whole-wheat": {
    name: "Whole wheat bread",
    macrosPer100g: { calories: 247, protein: 13, carbs: 41, fat: 3.4 },
    pricePerUnit: 0.005,
    unit: "g"
  },

  // Vegetables
  "broccoli": {
    name: "Broccoli",
    macrosPer100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    pricePerUnit: 0.004,
    unit: "g"
  },
  "spinach": {
    name: "Spinach",
    macrosPer100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
    pricePerUnit: 0.005,
    unit: "g"
  },
  "bell-pepper": {
    name: "Bell pepper",
    macrosPer100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
    pricePerUnit: 0.005,
    unit: "g"
  },
  "onion": {
    name: "Onion",
    macrosPer100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
    pricePerUnit: 0.001,
    unit: "g"
  },
  "zucchini": {
    name: "Zucchini",
    macrosPer100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
    pricePerUnit: 0.003,
    unit: "g"
  },
  "mixed-veggies": {
    name: "Mixed vegetables",
    macrosPer100g: { calories: 48, protein: 2.5, carbs: 8, fat: 0.5 },
    pricePerUnit: 0.003,
    unit: "g"
  },

  // Fats & Sauces
  "olive-oil": {
    name: "Olive oil",
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    pricePerUnit: 0.008,
    unit: "ml"
  },
  "butter": {
    name: "Butter",
    macrosPer100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
    pricePerUnit: 0.009,
    unit: "g"
  },
  "soy-sauce": {
    name: "Soy sauce",
    macrosPer100g: { calories: 53, protein: 8, carbs: 5, fat: 0 },
    pricePerUnit: 0.002,
    unit: "ml"
  },
  "teriyaki-sauce": {
    name: "Teriyaki sauce",
    macrosPer100g: { calories: 89, protein: 5, carbs: 16, fat: 0 },
    pricePerUnit: 0.004,
    unit: "ml"
  },

  // Extras
  "greek-yogurt": {
    name: "Greek yogurt",
    macrosPer100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.7 },
    pricePerUnit: 0.005,
    unit: "g"
  },
  "oats": {
    name: "Oats",
    macrosPer100g: { calories: 389, protein: 17, carbs: 66, fat: 7 },
    pricePerUnit: 0.002,
    unit: "g"
  },
  "peanut-butter": {
    name: "Peanut butter",
    macrosPer100g: { calories: 588, protein: 25, carbs: 20, fat: 50 },
    pricePerUnit: 0.008,
    unit: "g"
  },
  "banana": {
    name: "Banana",
    macrosPer100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    pricePerUnit: 0.002,
    unit: "g"
  },
  "garlic": {
    name: "Garlic",
    macrosPer100g: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5 },
    pricePerUnit: 0.015,
    unit: "g"
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
    unit: "g"
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

// Generate recipes from ingredients marked with isRecipe: true
function generateRecipesFromIngredients() {
  const generatedRecipes = [];
  
  for (const [ingId, ingredient] of Object.entries(INGREDIENTS)) {
    if (ingredient.isRecipe) {
      generatedRecipes.push({
        id: ingId,
        category: ingredient.category || "meal",
        name: ingredient.name,
        servingSize: ingredient.servingSize,
        ingredients: [{ id: ingId, amount: ingredient.servingSize }]
        // prepNotes omitted for single-ingredient recipes
      });
    }
  }
  
  return generatedRecipes;
}

// Merge generated recipes with base recipes
const ALL_RECIPES = [...RECIPES, ...generateRecipesFromIngredients()];
