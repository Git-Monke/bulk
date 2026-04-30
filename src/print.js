// ============================================
// PRINT VIEW
// ============================================
//
// Generate and display the print-ready meal plan.

import { INGREDIENTS, ALL_RECIPES } from './data.js';
import {
  gridState,
  stateKey
} from './state.js';
import {
  getRecipe,
  calculateRecipeMacros,
  computeOccurrences,
  fmtNum
} from './calculations.js';

export function generatePrintView() {
  const days = parseInt(document.getElementById('input-days').value) || 1;
  const variants = parseInt(document.getElementById('input-variants').value) || 1;
  const mealsPerDay = parseInt(document.getElementById('input-meals').value) || 1;
  const variantLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const occurrences = computeOccurrences(days, variants);

  // --- Aggregate shopping list: ingredientId -> { name, unit, totalAmount, totalCost } ---
  const shoppingMap = new Map();
  // --- Aggregate per-recipe totals: recipeId -> { totalMultiplier, portions, perPortionMultipliers[] } ---
  const recipeTotals = new Map();

  for (let v = 0; v < variants; v++) {
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const totalMultiplier = entry.multiplier * occurrences[v];

        // Accumulate recipe totals
        if (!recipeTotals.has(entry.recipeId)) {
          recipeTotals.set(entry.recipeId, { totalMultiplier: 0, portions: 0, perPortionMultipliers: [] });
        }
        const rt = recipeTotals.get(entry.recipeId);
        rt.totalMultiplier += totalMultiplier;
        rt.portions += occurrences[v];
        rt.perPortionMultipliers.push({ multiplier: entry.multiplier, count: occurrences[v] });

        // Accumulate ingredient totals
        for (const ing of recipe.ingredients) {
          const ingredient = INGREDIENTS[ing.id];
          if (!ingredient) continue;
          const totalAmount = ing.amount * totalMultiplier;
          const totalCost = ingredient.pricePerUnit * totalAmount;
          if (shoppingMap.has(ing.id)) {
            const entry = shoppingMap.get(ing.id);
            entry.totalAmount += totalAmount;
            entry.totalCost += totalCost;
          } else {
            shoppingMap.set(ing.id, {
              name: ingredient.name,
              unit: ingredient.unit,
              totalAmount,
              totalCost,
              preppedMultiplier: ingredient.preppedMultiplier,
            });
          }
        }
      }
    }
  }

  // --- Compute weekly totals for summary ---
  let weekly = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
  for (let v = 0; v < variants; v++) {
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = ALL_RECIPES.find(r => r.id === entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        weekly.calories += macros.calories * occurrences[v];
        weekly.protein += macros.protein * occurrences[v];
        weekly.carbs += macros.carbs * occurrences[v];
        weekly.fat += macros.fat * occurrences[v];
        weekly.price += macros.price * occurrences[v];
      }
    }
  }
  const dailyAvg = {
    calories: weekly.calories / days,
    protein: weekly.protein / days,
    carbs: weekly.carbs / days,
    fat: weekly.fat / days,
  };

  // --- Build HTML sections ---

  // Section 1: Summary
  const variantRows = Array.from({ length: variants }, (_, v) => {
    const vd = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        vd.calories += macros.calories;
        vd.protein += macros.protein;
        vd.carbs += macros.carbs;
        vd.fat += macros.fat;
        vd.price += macros.price;
      }
    }
    return `
      <tr>
        <td>Day ${variantLabels[v] || v + 1} <span style="color:#888">(×${occurrences[v]})</span></td>
        <td>${fmtNum(vd.calories)} kcal</td>
        <td>${fmtNum(vd.protein)}g</td>
        <td>${fmtNum(vd.carbs)}g</td>
        <td>${fmtNum(vd.fat)}g</td>
        <td>${fmtNum(vd.price, true)}</td>
      </tr>`;
  }).join('');

  const summarySection = `
    <section class="section">
      <h1>Meal Prep Plan</h1>
      <p class="meta">${days} days &nbsp;·&nbsp; ${variants} variant${variants !== 1 ? 's' : ''} &nbsp;·&nbsp; ${mealsPerDay} meal${mealsPerDay !== 1 ? 's' : ''}/day</p>

      <h2>Daily Averages</h2>
      <table>
        <tr>
          <th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Cost/day</th><th>Cost/week</th>
        </tr>
        <tr>
          <td>${fmtNum(dailyAvg.calories)} kcal</td>
          <td>${fmtNum(dailyAvg.protein)}g</td>
          <td>${fmtNum(dailyAvg.carbs)}g</td>
          <td>${fmtNum(dailyAvg.fat)}g</td>
          <td>${fmtNum(weekly.price / days, true)}</td>
          <td>${fmtNum(weekly.price, true)}</td>
        </tr>
      </table>

      <h2>Day Breakdown</h2>
      <table>
        <tr><th>Variant</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Cost</th></tr>
        ${variantRows}
      </table>
    </section>`;

  // Section 2: Shopping list
  const shoppingRows = [...shoppingMap.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map(item => {
      return `
      <tr>
        <td>${item.name}</td>
        <td>${Math.round(item.totalAmount)}${item.unit}</td>
        <td>${fmtNum(item.totalCost, true)}</td>
      </tr>`;
    }).join('');

  const shoppingSection = `
    <section class="section">
      <h2>Shopping List</h2>
      <table>
        <tr><th>Ingredient</th><th>Amount</th><th>Est. Cost</th></tr>
        ${shoppingRows || '<tr><td colspan="3">No ingredients - add meals to the plan first.</td></tr>'}
      </table>
      <p class="total">Total: ${fmtNum(weekly.price, true)}</p>
    </section>`;

  // Section 3: Daily meal schedule
  const dailyScheduleBlocks = Array.from({ length: variants }, (_, v) => {
    const mealBlocks = Array.from({ length: mealsPerDay }, (_, m) => {
      const entries = gridState.get(stateKey(v, m)) || [];
      const borderStyle = m === 0 ? '' : 'border-top:2px solid #aaa;';
      const labelRow = `<tr><td colspan="6" style="${borderStyle}padding-top:10px;padding-bottom:2px;font-weight:bold;font-size:13px;color:#888;">Meal ${m + 1}</td></tr>`;
      if (entries.length === 0) {
        return labelRow + `<tr><td colspan="6" style="color:#aaa;padding-bottom:8px;">-</td></tr>`;
      }
      const foodRows = entries.map(entry => {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) return '';
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        const totalWeight = Math.round(recipe.servingSize * entry.multiplier);
        const unit = recipe.ingredients[0]?.id ? INGREDIENTS[recipe.ingredients[0].id]?.unit || 'g' : 'g';
        let portionLabel;
        if (recipe.displayUnit === 'weight') {
          portionLabel = `<span style="color:#555">(${totalWeight}${unit})</span>`;
        } else if (entry.multiplier !== 1) {
          portionLabel = `<span style="color:#888">(${entry.multiplier.toFixed(1)}×)</span>`;
        } else {
          portionLabel = '';
        }
        return `
          <tr>
            <td style="padding-bottom:6px;">${recipe.name} ${portionLabel}</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.calories)} kcal</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.protein)}g</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.carbs)}g</td>
            <td style="padding-bottom:6px;">${fmtNum(macros.fat)}g</td>
          </tr>`;
      }).join('');
      return labelRow + foodRows;
    }).join('');

    // Day totals
    const dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(stateKey(v, m)) || [];
      for (const entry of entries) {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) continue;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        dayTotals.calories += macros.calories;
        dayTotals.protein += macros.protein;
        dayTotals.carbs += macros.carbs;
        dayTotals.fat += macros.fat;
      }
    }

    const checkboxes = Array.from({ length: occurrences[v] }, () =>
      `<span style="display:inline-block;width:18px;height:18px;border:2px solid #aaa;border-radius:3px;margin-right:5px;vertical-align:middle;"></span>`
    ).join('');

    return `
      <div class="recipe-block">
        <h3 style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <span>Day ${variantLabels[v] || v + 1}</span>
          <span style="font-weight:normal;font-size:13px;color:#555;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">${checkboxes}</span>
        </h3>
        <table>
          <tr><th>Food</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr>
          ${mealBlocks}
          <tr style="font-weight:bold;border-top:2px solid #aaa;">
            <td>Day Total</td>
            <td>${fmtNum(dayTotals.calories)} kcal</td>
            <td>${fmtNum(dayTotals.protein)}g</td>
            <td>${fmtNum(dayTotals.carbs)}g</td>
            <td>${fmtNum(dayTotals.fat)}g</td>
          </tr>
        </table>
      </div>`;
  }).join('');

  const dailyScheduleSection = `
    <section class="section page-break-before">
      <h2>Daily Meal Schedule</h2>
      ${dailyScheduleBlocks || '<p>No meals planned yet.</p>'}
    </section>`;

  // Section 4: Recipe prep guide (only recipes WITH prep notes)
  const recipeGuideBlocks = [...recipeTotals.entries()].map(([recipeId, rt]) => {
    const recipe = getRecipe(recipeId);
    if (!recipe || !recipe.prepNotes) return '';
    const { totalMultiplier, portions, perPortionMultipliers } = rt;

    // Determine per-portion weight label: if all portions have same multiplier, show one value; otherwise show range
    const uniqueMultipliers = [...new Set(perPortionMultipliers.map(p => p.multiplier))];
    const perPortionWeightLabel = uniqueMultipliers.length === 1
      ? null  // will compute per-ingredient
      : 'varies';

    const ingRows = recipe.ingredients.map(ing => {
      const ingredient = INGREDIENTS[ing.id];
      if (!ingredient) return '';
      const rawTotal = ing.amount * totalMultiplier;
      const preppedMultiplier = ingredient.preppedMultiplier ?? 1;
      const preppedTotal = rawTotal * preppedMultiplier;

      const hasPreppedTransformation = preppedMultiplier !== 1;
      
      let perPortionCell;
      if (perPortionWeightLabel === 'varies') {
        const weights = uniqueMultipliers.map(m => {
          const rawPortion = ing.amount * m;
          const preppedPortion = rawPortion * preppedMultiplier;
          return hasPreppedTransformation
            ? `${Math.round(preppedPortion)}${ingredient.unit} cooked`
            : `${Math.round(rawPortion)}${ingredient.unit}`;
        }).join(' / ');
        perPortionCell = weights;
      } else {
        const rawPortion = ing.amount * uniqueMultipliers[0];
        const preppedPortion = rawPortion * preppedMultiplier;
        perPortionCell = hasPreppedTransformation
          ? `${Math.round(preppedPortion)}${ingredient.unit} cooked`
          : `${Math.round(rawPortion)}${ingredient.unit}`;
      }
      
      const totalAmountDisplay = hasPreppedTransformation
        ? `${Math.round(rawTotal)}${ingredient.unit} raw`
        : `${Math.round(rawTotal)}${ingredient.unit}`;
      
      return `<tr><td>${ingredient.name}</td><td>${totalAmountDisplay}</td><td style="color:#555">${perPortionCell}</td></tr>`;
    }).join('');

    const totalWeight = Math.round(recipe.servingSize * totalMultiplier);
    const weightUnit = INGREDIENTS[recipe.ingredients[0]?.id]?.unit || 'g';
    let portionInfo;
    if (recipe.displayUnit === 'weight') {
      portionInfo = `${totalWeight}${weightUnit} total &nbsp;·&nbsp; ${portions}× Portions`;
    } else {
      portionInfo = `${fmtNum(totalMultiplier, false)}× Servings &nbsp;·&nbsp; ${portions}× Portions`;
    }
    return `
      <div class="recipe-block">
        <h3>${recipe.name} <span style="font-weight:normal;color:#555">(${portionInfo})</span></h3>
        <table>
          <tr><th>Ingredient</th><th>Total Amount</th><th>Per Portion</th></tr>
          ${ingRows}
        </table>
        ${recipe.prepNotes ? `<p class="prep-notes"><strong>Prep:</strong> ${recipe.prepNotes}</p>` : ''}
      </div>`;
  }).join('');

  const recipeSection = `
    <section class="section">
      <h2>Meal Prep Guide</h2>
      ${recipeGuideBlocks || '<p>No recipes with prep notes in this plan.</p>'}
    </section>`;

  // --- Compose full document ---
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meal Prep Plan</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #111; font-size: 14px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 32px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 15px; margin-top: 20px; margin-bottom: 6px; }
    .meta { color: #555; margin-bottom: 16px; }
    .section { margin-bottom: 40px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 4px 8px; font-size: 13px; }
    td { padding: 4px 8px; border-bottom: 1px solid #ddd; }
    tr:last-child td { border-bottom: none; }
    .total { text-align: right; font-weight: bold; margin-top: 8px; }
    .recipe-block { margin-bottom: 24px; }
    .prep-notes { margin-top: 8px; color: #444; }
    @media print {
      body { margin: 20px; }
      .section { page-break-inside: avoid; }
      .recipe-block { page-break-inside: avoid; }
      .page-break-before { page-break-before: always; }
    }
  </style>
</head>
<body>
  ${summarySection}
  ${dailyScheduleSection}
  ${shoppingSection}
  ${recipeSection}
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
