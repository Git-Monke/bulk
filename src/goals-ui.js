// ============================================
// GOALS SETTINGS UI
// ============================================

import { loadGoals, saveGoals } from './calculations.js';
import { updateSummary } from './grid-ui.js';

let goalsModal = null;
let goalsInitialized = false;

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