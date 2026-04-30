// ============================================
// STATE MANAGEMENT
// ============================================
//
// Grid state: Map<"variant-meal", Array<{ entryId, recipeId, multiplier }>>
// Keys are never deleted - out-of-bounds keys are ignored in calculations.

// Note: saveToStorage is defined in calculations.js
import { saveToStorage } from './calculations.js';

const STORAGE_KEY = 'bulk-meal-planner-v1';

export const gridState = new Map();
export let nextEntryId = 0;

export function stateKey(variant, meal) {
  return `${variant}-${meal}`;
}

export function getSlotEntries(variant, meal) {
  const key = stateKey(variant, meal);
  if (!gridState.has(key)) gridState.set(key, []);
  return gridState.get(key);
}

export function addEntry(variant, meal, recipeId, multiplier = 1) {
  const entry = { entryId: nextEntryId++, recipeId, multiplier };
  getSlotEntries(variant, meal).push(entry);
  saveToStorage(gridState, nextEntryId);
  return entry;
}

export function removeEntry(variant, meal, entryId) {
  const key = stateKey(variant, meal);
  const arr = gridState.get(key);
  if (!arr) return;
  const idx = arr.findIndex(e => e.entryId === entryId);
  if (idx !== -1) arr.splice(idx, 1);
  saveToStorage(gridState, nextEntryId);
}

export function updateEntryMultiplier(variant, meal, entryId, multiplier) {
  const arr = gridState.get(stateKey(variant, meal));
  if (!arr) return;
  const entry = arr.find(e => e.entryId === entryId);
  if (entry) entry.multiplier = multiplier;
  saveToStorage(gridState, nextEntryId);
}

export function clearGridState() {
  gridState.clear();
  nextEntryId = 0;
}

export function initFromStorage(saved) {
  if (saved?.nextEntryId) nextEntryId = saved.nextEntryId;
  if (saved?.gridState) {
    for (const [key, entries] of Object.entries(saved.gridState)) {
      gridState.set(key, entries);
    }
  }
}
