import { initIcons } from './lucide-init.js';
import { gridState } from './state.js';
import { getRecipe, calculateRecipeMacros, computeOccurrences, loadGoals, fmtNum, checkGoal } from './calculations.js';

// ============================================================
// Feature flags
// ============================================================

/**
 * Controls whether conversation history is restored from localStorage
 * when the agent view is initialized (i.e. on page reload).
 * Set to true to re-enable history persistence on reload.
 */
const AGENT_HISTORY_ON_RELOAD = false;

// ============================================================
// State snapshot
// ============================================================

/** @type {object | null} */
let lastSnapshot = null;

/**
 * Capture a structured snapshot of the current plan state.
 * Reads from DOM inputs, gridState, and goals.
 *
 * @returns {object} snapshot with days, variants, mealsPerDay, goals,
 *   perVariant array, and dailyAverage totals.
 */
function capturePlanSnapshot() {
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

      meals.push({
        meal: m + 1,
        entries: mealEntries
      });
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

  return {
    days,
    variants,
    mealsPerDay,
    goals,
    perVariant,
    dailyAverage
  };
}

/**
 * Deep equality check for two primitive or plain-object values.
 * Handles numbers, strings, booleans, null, undefined, plain objects, and arrays.
 * Does not handle Date, Map, Set, or circular references — snapshot data
 * is small (max ~20 entries) and uses only plain objects/arrays/primitives.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean} true if deeply equal
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

/**
 * Compare a fresh snapshot to the module-level `lastSnapshot`.
 * Returns true when the plan state has changed (or no prior snapshot exists).
 *
 * @param {object} current - snapshot returned by capturePlanSnapshot()
 * @returns {boolean} true if the state has changed
 */
function snapshotChanged(current) {
  return lastSnapshot === null || !deepEqual(current, lastSnapshot);
}

// ============================================================
// State message formatting
// ============================================================

/**
 * Goal label display helper.
 * Returns a human-readable string like "Calories (2500-3000)", "Protein (≥150)", "Fat (no goal)".
 */
function goalLabel(name, goal) {
  if (goal.atLeast === null && goal.atMost === null) return `${name} (no goal)`;
  const parts = [];
  if (goal.atLeast !== null) parts.push(`≥${goal.atLeast}`);
  if (goal.atMost !== null) parts.push(`≤${goal.atMost}`);
  return `${name} (${parts.join(' ')})`;
}

/**
 * Goal status icon.
 */
function goalIcon(actual, goal) {
  const status = checkGoal(actual, goal);
  if (status === 'ok') return '✓';
  if (status === 'violated') return '❌';
  return '(no goal)';
}

/**
 * Format a plan snapshot into a token-efficient human-readable text block.
 * The output starts with "STATE_UPDATE\n" — the caller prepends the prefix.
 *
 * @param {object} snapshot - returned by capturePlanSnapshot()
 * @returns {string} formatted state text (without STATE_UPDATE prefix)
 */
function formatStateMessage(snapshot) {
  const { days, variants, mealsPerDay, goals, perVariant, dailyAverage } = snapshot;
  const lines = [];

  lines.push(`Plan: ${days} days, ${variants} variants, ${mealsPerDay} meals/day`);
  lines.push('');

  for (const variant of perVariant) {
    const occLabel = `Day ${variant.label} (×${variant.occurrences})`;
    lines.push(`${occLabel}:`);

    for (const meal of variant.meals) {
      if (meal.entries.length === 0) {
        lines.push(`  Meal ${meal.meal}: (empty)`);
      } else {
        for (const entry of meal.entries) {
          const weightUnit = 'g';
          const price = fmtNum(entry.price, true);
          const kcal = fmtNum(entry.macros.calories);
          const protein = fmtNum(entry.macros.protein);
          const carbs = fmtNum(entry.macros.carbs);
          const fat = fmtNum(entry.macros.fat);
          const weight = fmtNum(entry.servingWeight);
          const mult = entry.multiplier.toFixed(1);
          lines.push(`  Meal ${meal.meal}: ${entry.recipeName} ${mult}× — ${kcal} kcal | ${protein}g P | ${carbs}g C | ${fat}g F | ${weight}${weightUnit} | ${price}`);
        }
      }
    }

    const dCal = fmtNum(variant.dailyTotals.calories);
    const dPro = fmtNum(variant.dailyTotals.protein);
    const dCarb = fmtNum(variant.dailyTotals.carbs);
    const dFat = fmtNum(variant.dailyTotals.fat);
    const dPrice = fmtNum(variant.dailyTotals.price, true);
    lines.push(`  Daily: ${dCal} kcal | ${dPro}g P | ${dCarb}g C | ${dFat}g F | ${dPrice}`);
    lines.push('');
  }

  // Daily average
  const aCal = fmtNum(dailyAverage.calories);
  const aPro = fmtNum(dailyAverage.protein);
  const aCarb = fmtNum(dailyAverage.carbs);
  const aFat = fmtNum(dailyAverage.fat);
  const aPrice = fmtNum(dailyAverage.price, true);
  lines.push(`Daily Average (across ${days} days): ${aCal} kcal | ${aPro}g P | ${aCarb}g C | ${aFat}g F | ${aPrice}`);

  // Goals
  const goalParts = [];
  for (const [name, goalInfo] of Object.entries(goals)) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const actual = dailyAverage[name];
    const icon = goalIcon(actual, goalInfo);
    const goalDesc = goalLabel(label, goalInfo);
    goalParts.push(`${goalDesc} ${icon}`);
  }
  lines.push(`Goals: ${goalParts.join(' | ')}`);

  return lines.join('\n');
}

/**
 * Detect if the plan state has changed since the last state update message.
 * If it has, capture a fresh snapshot, format a state update message,
 * and append it to the conversation (both in-memory and localStorage).
 *
 * Always updates `lastSnapshot` so subsequent calls don't duplicate.
 */
function maybeAppendStateUpdate() {
  const snapshot = capturePlanSnapshot();
  const changed = snapshotChanged(snapshot);
  // Update lastSnapshot regardless — always track most recent state
  lastSnapshot = snapshot;

  if (!changed) return;

  const content = formatStateMessage(snapshot);
  const stateMsg = {
    type: 'state',
    content: `STATE_UPDATE\n${content}`,
    timestamp: now()
  };
  pushMessage(stateMsg);
}

// ============================================================
// Agent settings state
// ============================================================

const AGENT_SETTINGS_KEY = 'bulk-meal-planner-agent-settings';

/** @type {{ apiKey: string, model: string }} */
let agentSettings = { apiKey: '', model: '' };

function loadAgentSettings() {
  try {
    const raw = localStorage.getItem(AGENT_SETTINGS_KEY);
    if (!raw) return { apiKey: '', model: '' };
    return JSON.parse(raw);
  } catch {
    return { apiKey: '', model: '' };
  }
}

function saveAgentSettings() {
  try {
    localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(agentSettings));
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Populate the model select based on current API key state.
 */
function syncModelSelect() {
  const select = document.getElementById('agent-model-select');
  const hint = document.getElementById('agent-model-hint');
  if (!select || !hint) return;

  const hasKey = agentSettings.apiKey.trim().length > 0;
  select.disabled = !hasKey;
  hint.textContent = hasKey
    ? ''
    : 'Enter an API key above to enable model selection.';
}

/** @type {boolean} */
let _settingsInitialized = false;

/**
 * Wire up the agent settings button and modal.
 */
function initAgentSettings() {
  if (_settingsInitialized) return;
  _settingsInitialized = true;

  const settingsBtn = document.getElementById('agent-settings-btn');
  const modal = document.getElementById('agent-settings-modal');
  const apiKeyInput = document.getElementById('agent-api-key');
  const modelSelect = document.getElementById('agent-model-select');
  const cancelBtn = document.getElementById('agent-settings-cancel-btn');
  const saveBtn = document.getElementById('agent-settings-save-btn');

  if (!modal || !settingsBtn) return;

  // Open modal: restore current settings into the form
  settingsBtn.addEventListener('click', () => {
    agentSettings = loadAgentSettings();
    apiKeyInput.value = agentSettings.apiKey;
    modelSelect.value = agentSettings.model;
    syncModelSelect();
    modal.showModal();
  });

  // Enable/disable model select as user types the API key
  apiKeyInput.addEventListener('input', () => {
    const hasKey = apiKeyInput.value.trim().length > 0;
    modelSelect.disabled = !hasKey;
    const hint = document.getElementById('agent-model-hint');
    if (hint) {
      hint.textContent = hasKey
        ? ''
        : 'Enter an API key above to enable model selection.';
    }
  });

  // Cancel: close without saving
  cancelBtn.addEventListener('click', () => {
    modal.close();
  });

  // Save: persist apiKey and model
  saveBtn.addEventListener('click', () => {
    agentSettings.apiKey = apiKeyInput.value.trim();
    agentSettings.model = modelSelect.value;
    saveAgentSettings();
    modal.close();
  });
}

// ============================================================
// Conversation state
// ============================================================

const CONV_STORAGE_KEY = 'bulk-meal-planner-conversation';

/** @type {Array<object>} */
let conversation = [];

/** @type {object | null} */
let currentTask = null; // { cancelled: boolean, timeoutId: number }

function now() {
  return new Date().toISOString();
}

function loadConversation() {
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

function saveConversation() {
  try {
    localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversation));
  } catch {
    // Silently ignore storage errors (e.g., quota exceeded)
  }
}

function pushMessage(msg) {
  conversation.push(msg);
  saveConversation();
}

// ============================================================
// OpenRouter integration
// ============================================================

/** How many past messages (user + agent) to send as conversation context. */
const AGENT_CONTEXT_WINDOW = 20;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Strip non-ASCII characters from a string (e.g. em-dashes copied from fancy-paste). */
function toAscii(str) {
  return str.replace(/[^\x20-\x7E]/g, '');
}

/**
 * Remove the "thinking" message element and its state entry.
 */
function clearThinkingMessage() {
  const container = document.getElementById('agent-messages');
  const thinkingEl = container?.querySelector('.agent-msg.thinking');
  if (thinkingEl) thinkingEl.remove();
  const last = conversation[conversation.length - 1];
  if (last && last.thinking) {
    conversation.pop();
    saveConversation();
  }
}

/**
 * Call the OpenRouter API and stream the response into the conversation.
 * Falls back to a no-key error if agentSettings.apiKey is empty.
 *
 * @param {string} userMessage - The current user message (already in conversation[]).
 * @returns {object} cancellation handle { cancelled, abortController }
 */
function callOpenRouter(userMessage) {
  const settings = loadAgentSettings();
  const apiKey = toAscii(settings.apiKey);

  if (!apiKey) {
    // No API key configured — show error immediately and bail out
    clearThinkingMessage();
    const errMsg = {
      type: 'agent',
      content: 'No API key configured. Click the ⚙ button to enter your OpenRouter API key.',
      timestamp: now()
    };
    pushMessage(errMsg);
    addAgentMessage(errMsg);
    updateSendButton(false);
    return { cancelled: false, abortController: null };
  }

  const abortController = new AbortController();
  const task = { cancelled: false, abortController };
  currentTask = task;

  // Build the messages array from the last AGENT_CONTEXT_WINDOW exchanges
  const recent = conversation.slice(-AGENT_CONTEXT_WINDOW);
  const messages = recent.map(msg => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  // Show thinking state after a brief delay
  const thinkTimeout = setTimeout(() => {
    if (task.cancelled) return;
    const thinkingMsg = {
      type: 'agent',
      content: 'Thinking...',
      timestamp: now(),
      thinking: true
    };
    pushMessage(thinkingMsg);
    addAgentMessage(thinkingMsg);
  }, 400);

  // Kick off the fetch
  const model = toAscii(settings.model) || 'anthropic/claude-3-haiku';

  fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': toAscii(document.title)
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: abortController.signal
  })
    .then(async response => {
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenRouter error ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      let content = '';

      // The thinking element is already in the DOM; we will update its textContent
      const container = document.getElementById('agent-messages');
      const thinkingEl = container?.querySelector('.agent-msg.thinking');

      while (!done) {
        if (task.cancelled) {
          reader.cancel();
          return;
        }
        const { value, done: d } = await reader.read();
        done = d;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              content += delta;
              // Update the thinking bubble in place for live streaming feel
              if (thinkingEl) {
                const bubble = thinkingEl.querySelector('.agent-msg-bubble');
                if (bubble) bubble.textContent = content || 'Thinking...';
                if (isAtBottom(container)) {
                  container.scrollTop = container.scrollHeight;
                }
              }
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      clearTimeout(thinkTimeout);

      if (task.cancelled) return;
      currentTask = null;

      // Replace thinking with final response
      clearThinkingMessage();
      const responseMsg = {
        type: 'agent',
        content: content || '(No response from model.)',
        timestamp: now()
      };
      pushMessage(responseMsg);
      addAgentMessage(responseMsg);
      updateSendButton(false);
    })
    .catch(err => {
      if (err.name === 'AbortError') return; // cancelled — already cleaned up
      clearTimeout(thinkTimeout);
      if (task.cancelled) return;
      currentTask = null;
      clearThinkingMessage();
      const errMsg = {
        type: 'agent',
        content: `Error calling OpenRouter: ${err.message}`,
        timestamp: now()
      };
      pushMessage(errMsg);
      addAgentMessage(errMsg);
      updateSendButton(false);
    });

  return task;
}

/** Cancel the currently running agent task, if any. */
function cancelAgentTask() {
  if (!currentTask) return;
  currentTask.cancelled = true;
  // Cancel either a pending setTimeout (filler) or an in-flight fetch
  if (currentTask.timeoutId) clearTimeout(currentTask.timeoutId);
  if (currentTask.abortController) currentTask.abortController.abort();
  currentTask = null;

  clearThinkingMessage();
  updateSendButton(false);
}

// ============================================================
// Send button
// ============================================================

function updateSendButton(running) {
  const btn = document.getElementById('agent-send');
  if (!btn) return;

  if (running) {
    btn.classList.add('agent-send-btn', 'agent-stop-btn');
    btn.innerHTML = `<i data-lucide="square"></i>`;
    initIcons();
    btn.setAttribute('aria-label', 'Stop');
  } else {
    btn.classList.remove('agent-stop-btn');
    btn.innerHTML = `<i data-lucide="send"></i>`;
    initIcons();
    btn.setAttribute('aria-label', 'Send');
  }
}

function handleSendClick() {
  if (currentTask) {
    // Currently running — cancel
    cancelAgentTask();
    return;
  }

  const input = document.getElementById('agent-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  // Add user message
  const userMsg = { type: 'user', content, timestamp: now() };
  pushMessage(userMsg);
  addAgentMessage(userMsg);

  // Start the OpenRouter agent loop
  updateSendButton(true);
  callOpenRouter(content);
}

// ============================================================
// Message rendering
// ============================================================

/**
 * Group consecutive tool calls into a single cluster
 */
function groupToolCalls(messages) {
  const grouped = [];
  let toolCluster = [];

  for (const msg of messages) {
    if (msg.type === 'tool_call') {
      toolCluster.push(msg);
    } else {
      if (toolCluster.length > 0) {
        grouped.push({
          type: 'tool_cluster',
          tools: [...toolCluster],
          timestamp: toolCluster[0].timestamp
        });
        toolCluster = [];
      }
      grouped.push(msg);
    }
  }

  // Handle trailing tool calls
  if (toolCluster.length > 0) {
    grouped.push({
      type: 'tool_cluster',
      tools: [...toolCluster],
      timestamp: toolCluster[0].timestamp
    });
  }

  return grouped;
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Get avatar symbol for message type
 */
function getAvatar(type) {
  switch (type) {
    case 'user': return 'U';
    case 'agent': return 'A';
    case 'tool_cluster': return '⚙';
  }
}

/**
 * Get label for message type
 */
function getLabel(type) {
  switch (type) {
    case 'user': return 'You';
    case 'agent': return 'Agent';
    case 'tool_cluster': return 'Tools';
  }
}

/**
 * Render tool details HTML
 */
function renderToolDetails(tools) {
  return tools.map(tool => `
    <div class="agent-tool-entry">
      <div class="agent-tool-name">${tool.toolName}</div>
      <div class="agent-tool-params">${JSON.stringify(tool.params, null, 2)}</div>
      ${tool.result ? `<div class="agent-tool-result">→ ${tool.result}</div>` : ''}
    </div>
  `).join('');
}

/**
 * Render a single message.
 * A `thinking` flag renders the message with a pulsing animation.
 */
function renderMessage(msg) {
  const time = formatTime(msg.timestamp);

  if (msg.type === 'tool_cluster') {
    const count = msg.tools.length;
    return `
      <div class="agent-msg tool-cluster" data-tools="${count}">
        <div class="agent-msg-header">
          <span class="agent-tool-count">${count} tool${count > 1 ? 's' : ''}</span>
          <i data-lucide="chevron-down" class="agent-tool-expand w-4 h-4"></i>
        </div>
        <div class="agent-msg-bubble">
          <div class="agent-tool-header">
            <i data-lucide="wrench" class="agent-tool-icon w-4 h-4"></i>
            <span class="agent-tool-label">Agent ran ${count} tool${count > 1 ? 's' : ''}</span>
          </div>
          <div class="agent-tool-details">
            ${renderToolDetails(msg.tools)}
          </div>
        </div>
      </div>
    `;
  }

  // Format content with basic markdown
  const content = msg.content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  const bubbleClass = msg.thinking ? 'agent-msg-bubble agent-thinking' : 'agent-msg-bubble';
  return `
    <div class="agent-msg ${msg.type}${msg.thinking ? ' thinking' : ''}">
      <div class="${bubbleClass}">
        <div class="agent-msg-content">${content}</div>
      </div>
    </div>
  `;
}

/**
 * Render all messages in the agent view.
 * Scrolls to bottom only if already at the bottom.
 */
export function renderAgentMessages(messages) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

  const grouped = groupToolCalls(messages);
  container.innerHTML = grouped.map(renderMessage).join('');

  // Initialize Lucide icons for newly rendered content
  initIcons();

  // Add click handlers for tool clusters
  container.querySelectorAll('.agent-msg.tool-cluster').forEach(cluster => {
    cluster.addEventListener('click', () => {
      cluster.classList.toggle('expanded');
    });
  });

  // Scroll to bottom only if already there
  if (isAtBottom(container)) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Clear all conversation history from memory and localStorage.
 * Call this if you add a "clear chat" feature.
 */
export function clearAgentConversation() {
  cancelAgentTask();
  conversation = [];
  try {
    localStorage.removeItem(CONV_STORAGE_KEY);
  } catch {}
}

/**
 * Returns true when the container scroll position is within
 * `tolerance` pixels of the bottom edge.
 */
function isAtBottom(container, tolerance = 80) {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= tolerance;
}

/**
 * Add a single message and scroll (only if already at bottom).
 */
export function addAgentMessage(msg) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

  // Remove the "Start a conversation" placeholder on the first real message
  const placeholder = container.querySelector('.agent-placeholder');
  if (placeholder) placeholder.remove();

  const atBottom = isAtBottom(container);

  const grouped = groupToolCalls([msg]);
  grouped.forEach(m => {
    const div = document.createElement('div');
    div.innerHTML = renderMessage(m);
    const node = div.firstElementChild;
    container.appendChild(node);

    // Add click handler for tool clusters
    if (m.type === 'tool_cluster') {
      node.addEventListener('click', () => {
        node.classList.toggle('expanded');
      });
    }
  });

  // Only auto-scroll if the user was already at the bottom
  if (atBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Initialize agent view: load from localStorage and render.
 * Shows an empty placeholder if there is no conversation history.
 */
export function initAgentView() {
  // Wire up the settings button and modal (idempotent — safe to call multiple times)
  initAgentSettings();

  // Optionally restore conversation history from localStorage on page load.
  // The persistence layer is always active (saves on every new message),
  // but here we choose whether to rehydrate the in-memory array on init.
  if (AGENT_HISTORY_ON_RELOAD) {
    conversation = loadConversation();
  } else {
    conversation = [];
  }

  const container = document.getElementById('agent-messages');
  if (!container) return;

  if (conversation.length === 0) {
    container.innerHTML = `
      <div class="agent-placeholder">
        <div class="agent-placeholder-icon">
          <i data-lucide="bot" class="w-12 h-12"></i>
        </div>
        <div class="agent-placeholder-title">Start a conversation</div>
        <div class="agent-placeholder-sub">Configure your OpenRouter API key in ⚙ settings, then send a message to begin.</div>
      </div>
    `;
    initIcons();
  } else {
    renderAgentMessages(conversation);
  }

  // Wire up send button
  const btn = document.getElementById('agent-send');
  if (btn) {
    btn.addEventListener('click', handleSendClick);
  }

  // Enter key also sends
  const input = document.getElementById('agent-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendClick();
      }
    });
  }
}
