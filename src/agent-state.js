// ============================================
// AGENT STATE
// ============================================
//
// Conversation history, plan snapshot capture/formatting, and settings storage.
// No DOM or API calls — pure state and formatting logic.

import { initIcons } from './lucide-init.js';
import { gridState } from './state.js';
import {
  getRecipe,
  calculateRecipeMacros,
  computeOccurrences,
  loadGoals,
  fmtNum,
  checkGoal
} from './calculations.js';

// -------------------------------------------
// CONVERSATION STATE
// -------------------------------------------

export const CONV_STORAGE_KEY = 'bulk-meal-planner-conversation';

/** @type {Array<object>} */
export let conversation = [];

function now() {
  return new Date().toISOString();
}

export function loadConversation() {
  try {
    const raw = localStorage.getItem(CONV_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveConversation() {
  try {
    localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversation));
  } catch {
    // Silently ignore storage errors (e.g., quota exceeded)
  }
}

export function pushMessage(msg) {
  conversation.push(msg);
  saveConversation();
}

export function clearAgentConversation() {
  conversation = [];
  try {
    localStorage.removeItem(CONV_STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Alias for clearAgentConversation for backward-compatibility. */
export const resetConversation = clearAgentConversation;

// -------------------------------------------
// PLAN STATE SNAPSHOT
// -------------------------------------------

/** @type {object | null} */
let lastSnapshot = null;

/**
 * Capture a structured snapshot of the current plan state.
 * Reads from DOM inputs, gridState, and goals.
 *
 * @returns {object} snapshot with days, variants, mealsPerDay, goals,
 *   perVariant array, and dailyAverage totals.
 */
export function capturePlanSnapshot() {
  const days = parseInt(document.getElementById('input-days')?.value || '7', 10);
  const variants = parseInt(document.getElementById('input-variants')?.value || '3', 10);
  const mealsPerDay = parseInt(document.getElementById('input-meals')?.value || '3', 10);
  const goals = loadGoals();
  const occurrences = computeOccurrences(days, variants);

  const variantLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const perVariant = [];
  const grandTotal = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };

  for (let v = 0; v < variants; v++) {
    const occ = occurrences[v];
    const dailyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };
    const meals = [];

    for (let m = 0; m < mealsPerDay; m++) {
      const entries = gridState.get(`${v}-${m}`) || [];

      const mealEntries = entries.map(entry => {
        const recipe = getRecipe(entry.recipeId);
        if (!recipe) return null;
        const macros = calculateRecipeMacros(recipe, entry.multiplier);
        return {
          recipeId: recipe.id,
          recipeName: recipe.name,
          multiplier: entry.multiplier,
          macros: {
            calories: macros.calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat
          },
          servingWeight: recipe.servingSize * entry.multiplier,
          price: macros.price
        };
      }).filter(Boolean);

      for (const entry of mealEntries) {
        dailyTotals.calories += entry.macros.calories;
        dailyTotals.protein += entry.macros.protein;
        dailyTotals.carbs += entry.macros.carbs;
        dailyTotals.fat += entry.macros.fat;
        dailyTotals.price += entry.price;
      }

      meals.push({ meal: m + 1, entries: mealEntries });
    }

    grandTotal.calories += dailyTotals.calories * occ;
    grandTotal.protein += dailyTotals.protein * occ;
    grandTotal.carbs += dailyTotals.carbs * occ;
    grandTotal.fat += dailyTotals.fat * occ;
    grandTotal.price += dailyTotals.price * occ;

    perVariant.push({
      label: variantLabels[v] || `${v + 1}`,
      occurrences: occ,
      dailyTotals,
      meals
    });
  }

  const dailyAverage = days > 0
    ? {
        calories: grandTotal.calories / days,
        protein: grandTotal.protein / days,
        carbs: grandTotal.carbs / days,
        fat: grandTotal.fat / days,
        price: grandTotal.price / days
      }
    : { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 };

  return { days, variants, mealsPerDay, goals, perVariant, dailyAverage };
}

/**
 * Deep equality check for two primitive or plain-object values.
 * Does not handle Date, Map, Set, or circular references.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return a === b;
}

function snapshotChanged(current) {
  return lastSnapshot === null || !deepEqual(current, lastSnapshot);
}

// -------------------------------------------
// STATE MESSAGE FORMATTING
// -------------------------------------------

/**
 * Goal label display helper.
 * Returns a human-readable string like "Calories (2500-3000)", "Protein (≥150)", "Fat (no goal)".
 */
export function goalLabel(name, goal) {
  if (goal.atLeast === null && goal.atMost === null) return `${name} (no goal)`;
  const parts = [];
  if (goal.atLeast !== null) parts.push(`≥${goal.atLeast}`);
  if (goal.atMost !== null) parts.push(`≤${goal.atMost}`);
  return `${name} (${parts.join(' ')})`;
}

/** Goal status icon. */
export function goalIcon(actual, goal) {
  const status = checkGoal(actual, goal);
  if (status === 'ok') return '✓';
  if (status === 'violated') return '❌';
  return '(no goal)';
}

/**
 * Format a plan snapshot into a token-efficient human-readable text block.
 * The caller wraps the result in an XML <state_update> block.
 */
export function formatStateMessage(snapshot) {
  const { days, perVariant, dailyAverage } = snapshot;
  const goals = snapshot.goals;
  const lines = [];

  lines.push(`Plan: ${snapshot.days} days, ${snapshot.variants} variants, ${snapshot.mealsPerDay} meals/day`);
  lines.push('');

  for (const variant of perVariant) {
    lines.push(`Day ${variant.label} (×${variant.occurrences}):`);

    for (const meal of variant.meals) {
      if (meal.entries.length === 0) {
        lines.push(`  Meal ${meal.meal}: (empty)`);
      } else {
        for (const entry of meal.entries) {
          lines.push(
            `  Meal ${meal.meal}: ${entry.recipeName} ${entry.multiplier.toFixed(1)}× — ` +
            `${fmtNum(entry.macros.calories)} kcal | ${fmtNum(entry.macros.protein)}g P | ` +
            `${fmtNum(entry.macros.carbs)}g C | ${fmtNum(entry.macros.fat)}g F | ` +
            `${fmtNum(entry.servingWeight)}g | ${fmtNum(entry.price, true)}`
          );
        }
      }
    }

    lines.push(
      `  Daily: ${fmtNum(variant.dailyTotals.calories)} kcal | ` +
      `${fmtNum(variant.dailyTotals.protein)}g P | ` +
      `${fmtNum(variant.dailyTotals.carbs)}g C | ` +
      `${fmtNum(variant.dailyTotals.fat)}g F | ` +
      `${fmtNum(variant.dailyTotals.price, true)}`
    );
    lines.push('');
  }

  lines.push(
    `Daily Average (across ${days} days): ` +
    `${fmtNum(dailyAverage.calories)} kcal | ${fmtNum(dailyAverage.protein)}g P | ` +
    `${fmtNum(dailyAverage.carbs)}g C | ${fmtNum(dailyAverage.fat)}g F | ` +
    `${fmtNum(dailyAverage.price, true)}`
  );

  const goalParts = [];
  for (const [name, goalInfo] of Object.entries(goals)) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const actual = dailyAverage[name];
    goalParts.push(`${goalLabel(label, goalInfo)} ${goalIcon(actual, goalInfo)}`);
  }
  lines.push(`Goals: ${goalParts.join(' | ')}`);

  return lines.join('\n');
}

/**
 * Detect if the plan state has changed. If so, capture a fresh snapshot,
 * format it, and append it to the conversation as a hidden state update.
 * Always updates `lastSnapshot` so subsequent calls don't duplicate.
 */
export function maybeAppendStateUpdate() {
  const snapshot = capturePlanSnapshot();
  const changed = snapshotChanged(snapshot);
  lastSnapshot = snapshot;

  if (!changed) return;

  const content = formatStateMessage(snapshot);
  pushMessage({
    type: 'user',
    content: `<state_update>This is an automated state update the user cannot see: \n${content}\n</state_update>`,
    timestamp: now()
  });
}

// -------------------------------------------
// AGENT SETTINGS STATE
// -------------------------------------------

export const AGENT_SETTINGS_KEY = 'bulk-meal-planner-agent-settings';

/** @type {{ apiKey: string, model: string }} */
export let agentSettings = { apiKey: '', model: '' };

export function loadAgentSettings() {
  try {
    const raw = localStorage.getItem(AGENT_SETTINGS_KEY);
    if (!raw) return { apiKey: '', model: '' };
    return JSON.parse(raw);
  } catch {
    return { apiKey: '', model: '' };
  }
}

export function saveAgentSettings(settings) {
  if (settings) {
    agentSettings = settings;
  }
  try {
    localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(agentSettings));
  } catch { /* ignore */ }
}