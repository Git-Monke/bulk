// ============================================
// GOALS SETTINGS UI
// ============================================

import { loadGoals, saveGoals } from './calculations.js';
import { updateSummary } from './grid-ui.js';

let goalsModal = null;
let goalsInitialized = false;
let calcModal = null;
let calcInitialized = false;
let _pendingCalcGoals = null;

/**
 * Initialize the goals settings button and modal.
 * Called once from main.js on DOMContentLoaded.
 */
export function initGoalsSettings() {
  if (goalsInitialized) return;
  goalsInitialized = true;

  const settingsBtn = document.getElementById('goals-settings-btn');
  goalsModal = document.getElementById('goals-modal');

  if (!goalsModal || !settingsBtn) return;

  // Open modal: load current goals into the form
  settingsBtn.addEventListener('click', () => {
    const goals = loadGoals();
    renderGoalsForm(goals);
    goalsModal.showModal();
  });

  // Wire up real-time inputs for each macro
  const macros = ['calories', 'protein', 'carbs', 'fat'];
  
  macros.forEach(macro => {
    const atLeastInput = document.getElementById(`goal-${macro}-atleast`);
    const atMostInput = document.getElementById(`goal-${macro}-atmost`);
    const clearBtn = document.getElementById(`goal-${macro}-clear`);

    // "At least" input: save on change
    atLeastInput?.addEventListener('input', () => {
      const goals = loadGoals();
      const val = atLeastInput.value.trim();
      goals[macro].atLeast = val === '' ? null : parseFloat(val);
      saveGoals(goals);
      updateSummary();
    });

    // "At most" input: save on change
    atMostInput?.addEventListener('input', () => {
      const goals = loadGoals();
      const val = atMostInput.value.trim();
      goals[macro].atMost = val === '' ? null : parseFloat(val);
      saveGoals(goals);
      updateSummary();
    });

    // Clear button for this macro
    clearBtn?.addEventListener('click', () => {
      const goals = loadGoals();
      goals[macro].atLeast = null;
      goals[macro].atMost = null;
      saveGoals(goals);
      renderGoalsForm(goals);
      updateSummary();
    });
  });

  // Global "Clear all" button
  const clearAllBtn = document.getElementById('goals-clear-all');
  clearAllBtn?.addEventListener('click', () => {
    const macros = ['calories', 'protein', 'carbs', 'fat'];
    const goals = loadGoals();
    macros.forEach(macro => {
      goals[macro].atLeast = null;
      goals[macro].atMost = null;
    });
    saveGoals(goals);
    renderGoalsForm(goals);
    updateSummary();
  });

  // Close button (X) - just closes, no action needed
  const closeBtn = document.getElementById('goals-modal-close');
  closeBtn?.addEventListener('click', () => {
    goalsModal.close();
  });

  // Click outside to close
  goalsModal.addEventListener('click', (e) => {
    if (e.target === goalsModal) {
      goalsModal.close();
    }
  });
}

/**
 * Populate the goals form fields from a goals object.
 * @param {object} goals - { calories: { atLeast, atMost }, ... }
 */
function renderGoalsForm(goals) {
  const macros = ['calories', 'protein', 'carbs', 'fat'];
  
  macros.forEach(macro => {
    const atLeastInput = document.getElementById(`goal-${macro}-atleast`);
    const atMostInput = document.getElementById(`goal-${macro}-atmost`);
    
    if (atLeastInput) {
      atLeastInput.value = goals[macro].atLeast ?? '';
    }
    if (atMostInput) {
      atMostInput.value = goals[macro].atMost ?? '';
    }
  });
}

// -------------------------------------------
// TDEE / MACRO CALCULATOR
// -------------------------------------------

function lbsToKg(lbs) {
  return lbs * 0.453592;
}

function ftInToCm(ft, inches) {
  return (ft * 12 + inches) * 2.54;
}

/**
 * Calculate TDEE-based macro targets.
 * Returns an object matching the goals schema.
 *
 * @param {object} params
 * @param {number} params.age
 * @param {'male'|'female'} params.gender
 * @param {number} params.heightCm
 * @param {number} params.weightKg
 * @param {number} params.activityMultiplier  1.2–1.9
 * @param {number} params.goalLbsPerWeek  positive = gain, negative = lose
 */
function calculateMacroTargets({ age, gender, heightCm, weightKg, activityMultiplier, goalLbsPerWeek }) {
  // Mifflin-St Jeor BMR
  const bmr = gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * activityMultiplier;
  const calorieDelta = goalLbsPerWeek * 500;
  const targetCalories = Math.round(tdee + calorieDelta);

  // Protein: 2.2 g/kg regardless of direction
  const proteinG = Math.round(weightKg * 2.2);
  const proteinCal = proteinG * 4;

  // Fat: 35% of target calories
  const fatCal = targetCalories * 0.35;
  const fatG = Math.round(fatCal / 9);

  // Carbs: whatever is left
  const remainingCal = Math.max(0, targetCalories - proteinCal - fatCal);
  const carbsG = Math.round(remainingCal / 4);

  if (goalLbsPerWeek < 0) {
    // Losing weight — upper-bound calorie safety net
    return {
      calories:  { atLeast: Math.max(0, targetCalories - 100), atMost: targetCalories },
      protein:   { atLeast: proteinG,                           atMost: null },
      carbs:     { atLeast: carbsG,                             atMost: null },
      fat:       { atLeast: null,                               atMost: fatG },
    };
  } else {
    // Gaining weight (or maintaining) — lower-bound calorie safety net
    return {
      calories:  { atLeast: targetCalories, atMost: targetCalories + 100 },
      protein:   { atLeast: proteinG,       atMost: null },
      carbs:     { atLeast: carbsG,                           atMost: null },
      fat:       { atLeast: fatG,           atMost: null },
    };
  }
}

function showCalcResults(goals) {
  const resultsDiv = document.getElementById('calc-results');
  if (!resultsDiv) return;

  function setMacroResult(id, atLeast, atMost) {
    const el = document.getElementById(id);
    if (!el) return;
    if (atLeast !== null && atMost !== null) {
      el.textContent = `${atLeast} – ${atMost}`;
    } else if (atLeast !== null) {
      el.textContent = String(atLeast);
    } else if (atMost !== null) {
      el.textContent = String(atMost);
    } else {
      el.textContent = '—';
    }
  }

  setMacroResult('calc-result-cal',     goals.calories.atLeast, goals.calories.atMost);
  setMacroResult('calc-result-protein', goals.protein.atLeast,  goals.protein.atMost);
  setMacroResult('calc-result-carbs',   goals.carbs.atLeast,    goals.carbs.atMost);
  setMacroResult('calc-result-fat',     goals.fat.atLeast,      goals.fat.atMost);

  const note = document.getElementById('calc-results-note');
  if (note) {
    const cal = goals.calories;
    note.textContent = Object.is(cal.atLeast, cal.atMost) && cal.atLeast !== null
      ? `Target is ${cal.atLeast} kcal/day. Stay within range.`
      : `Range is ${cal.atLeast}–${cal.atMost} kcal/day. Stay within range.`;
  }

  resultsDiv.classList.remove('hidden');
}

function wireCalculatorButton() {
  const calcBtn = document.getElementById('calc-calculate-btn');
  calcBtn?.addEventListener('click', () => {
    const useImperial = document.getElementById('calc-units-toggle')?.checked;

    const age = parseInt(document.getElementById('calc-age')?.value, 10) || 0;
    const gender = document.getElementById('calc-gender')?.value || 'male';
    const activity = parseFloat(document.getElementById('calc-activity')?.value) || 1.55;
    const goalLbs = parseFloat(document.getElementById('calc-goal-lbs')?.value) || 0;

    let heightCm, weightKg;
    if (useImperial) {
      const ft = parseFloat(document.getElementById('calc-height-ft')?.value) || 0;
      const inches = parseFloat(document.getElementById('calc-height-in')?.value) || 0;
      const lbs = parseFloat(document.getElementById('calc-weight-lbs')?.value) || 0;
      heightCm = ftInToCm(ft, inches);
      weightKg = lbsToKg(lbs);
    } else {
      heightCm = parseFloat(document.getElementById('calc-height-cm')?.value) || 0;
      weightKg = parseFloat(document.getElementById('calc-weight-kg')?.value) || 0;
    }

    if (!age || !heightCm || !weightKg) {
      alert('Please fill in age, height, and weight.');
      return;
    }

    _pendingCalcGoals = calculateMacroTargets({ age, gender, heightCm, weightKg, activityMultiplier: activity, goalLbsPerWeek: goalLbs });
    showCalcResults(_pendingCalcGoals);
  });

  const applyBtn = document.getElementById('calc-apply-btn');
  applyBtn?.addEventListener('click', () => {
    if (!_pendingCalcGoals) return;
    saveGoals(_pendingCalcGoals);
    // If goals modal is open, sync its form fields
    renderGoalsForm(_pendingCalcGoals);
    // Refresh summary
    updateSummary();
    // Close calc modal
    calcModal?.close();
    _pendingCalcGoals = null;
  });
}

/**
 * Initialize the TDEE calculator modal.
 * Sets up unit toggle, calculate button, and apply button.
 */
export function initGoalsCalculator() {
  if (calcInitialized) return;
  calcInitialized = true;

  const calcBtn = document.getElementById('goals-calculator-btn');
  calcModal = document.getElementById('goals-calc-modal');

  if (!calcModal || !calcBtn) return;

  // Open modal — reset results each time
  calcBtn.addEventListener('click', () => {
    document.getElementById('calc-results')?.classList.add('hidden');
    _pendingCalcGoals = null;
    calcModal.showModal();
  });

  // Close button
  const closeBtn = document.getElementById('goals-calc-modal-close');
  closeBtn?.addEventListener('click', () => calcModal.close());

  // Click outside to close
  calcModal.addEventListener('click', (e) => {
    if (e.target === calcModal) calcModal.close();
  });

  // Unit toggle: switch between metric and imperial
  const metricFields = document.getElementById('calc-metric-fields');
  const imperialFields = document.getElementById('calc-imperial-fields');
  const unitToggle = document.getElementById('calc-units-toggle');

  unitToggle?.addEventListener('change', () => {
    const isImperial = unitToggle.checked;
    localStorage.setItem('bulk-meal-planner-calc-units', isImperial ? 'imperial' : 'metric');
    if (isImperial) {
      metricFields?.classList.add('hidden');
      imperialFields?.classList.remove('hidden');
    } else {
      metricFields?.classList.remove('hidden');
      imperialFields?.classList.add('hidden');
    }
  });

  // Restore saved unit preference
  const savedUnits = localStorage.getItem('bulk-meal-planner-calc-units');
  if (savedUnits === 'imperial') {
    unitToggle.checked = true;
    metricFields?.classList.add('hidden');
    imperialFields?.classList.remove('hidden');
  } else {
    unitToggle.checked = false;
    metricFields?.classList.remove('hidden');
    imperialFields?.classList.add('hidden');
  }

  wireCalculatorButton();
}