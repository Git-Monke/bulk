// ============================================
// AGENT API & CONTROLS
// ============================================
//
// OpenRouter streaming fetch, send/cancel button controls, and settings modal wiring.

import { initIcons } from './lucide-init.js';
import {
  conversation,
  pushMessage,
  loadAgentSettings,
  saveAgentSettings,
  maybeAppendStateUpdate
} from './agent-state.js';

// -------------------------------------------
// SETTINGS MODAL
// -------------------------------------------

/** @type {boolean} */
let _settingsInitialized = false;

/**
 * Wire up the agent settings button and modal.
 */
export function initAgentSettings() {
  if (_settingsInitialized) return;
  _settingsInitialized = true;

  const settingsBtn = document.getElementById('agent-settings-btn');
  const modal = document.getElementById('agent-settings-modal');
  const apiKeyInput = document.getElementById('agent-api-key');
  const modelSelect = document.getElementById('agent-model-select');
  const cancelBtn = document.getElementById('agent-settings-cancel-btn');
  const saveBtn = document.getElementById('agent-settings-save-btn');

  if (!modal || !settingsBtn) return;

  settingsBtn.addEventListener('click', () => {
    const settings = loadAgentSettings();
    apiKeyInput.value = settings.apiKey;
    modelSelect.value = settings.model;
    syncModelSelect(settings.apiKey);
    modal.showModal();
  });

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

  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', () => {
    const settings = loadAgentSettings();
    settings.apiKey = apiKeyInput.value.trim();
    settings.model = modelSelect.value;
    saveAgentSettings(settings);
    modal.close();
  });
}

function syncModelSelect(apiKey) {
  const select = document.getElementById('agent-model-select');
  const hint = document.getElementById('agent-model-hint');
  if (!select || !hint) return;
  const hasKey = apiKey.trim().length > 0;
  select.disabled = !hasKey;
  hint.textContent = hasKey ? '' : 'Enter an API key above to enable model selection.';
}

// -------------------------------------------
// SEND BUTTON CONTROLS
// -------------------------------------------

/** @type {boolean} */
let _sendInitialized = false;

export function updateSendButton(running) {
  const btn = document.getElementById('agent-send');
  if (!btn) return;

  if (running) {
    btn.classList.add('agent-stop-btn');
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

/** Returns true when the container scroll position is within `tolerance` pixels of the bottom. */
export function isAtBottom(container, tolerance = 80) {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= tolerance;
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
    // Don't save — we remove the thinking entry so it doesn't persist
  }
}

function now() {
  return new Date().toISOString();
}

// -------------------------------------------
// OPENROUTER INTEGRATION
// -------------------------------------------

const SYSTEM_PROMPT = 'You are a meal planning assistant. You help users plan, adjust, and analyse meal plans using the Bulk Meal Planner. Keep your responses brief unless the user asks for details.';

/** How many past messages (user + agent) to send as conversation context. */
const AGENT_CONTEXT_WINDOW = 20;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Strip non-ASCII characters from a string (e.g. em-dashes from fancy-paste). */
export function toAscii(str) {
  return str.replace(/[^\x20-\x7E]/g, '');
}

/** @type {object | null} */
let currentTask = null; // { cancelled: boolean, abortController: AbortController }

/**
 * Cancel the currently running agent task, if any.
 */
export function cancelAgentTask() {
  if (!currentTask) return;
  currentTask.cancelled = true;
  if (currentTask.abortController) currentTask.abortController.abort();
  currentTask = null;
  clearThinkingMessage();
  updateSendButton(false);
}

/** @type {function} */
let _addAgentMessage = () => { };

/**
 * Called by agent-ui to inject the DOM-side addAgentMessage function.
 * agent-api uses this internally to inject streaming responses into the DOM.
 */
export function setAddAgentMessageFn(fn) {
  _addAgentMessage = fn;
}

/**
 * Call the OpenRouter API and stream the response into the conversation.
 */
export function callOpenRouter(userMessage) {
  const settings = loadAgentSettings();
  const apiKey = toAscii(settings.apiKey);

  if (!apiKey) {
    clearThinkingMessage();
    const errMsg = {
      type: 'agent',
      content: 'No API key configured. Click the ⚙ button to enter your OpenRouter API key.',
      timestamp: now()
    };
    pushMessage(errMsg);
    _addAgentMessage(errMsg);
    updateSendButton(false);
    return { cancelled: false, abortController: null };
  }

  const abortController = new AbortController();
  currentTask = { cancelled: false, abortController };

  // Build the messages array from the last AGENT_CONTEXT_WINDOW exchanges
  const recent = conversation.slice(-AGENT_CONTEXT_WINDOW);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recent.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
  ];

  // Show thinking state after a brief delay
  const thinkTimeout = setTimeout(() => {
    if (currentTask?.cancelled) return;
    const thinkingMsg = {
      type: 'agent',
      content: 'Thinking...',
      timestamp: now(),
      thinking: true
    };
    pushMessage(thinkingMsg);
    _addAgentMessage(thinkingMsg);
  }, 400);

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

      const container = document.getElementById('agent-messages');
      const thinkingEl = container?.querySelector('.agent-msg.thinking');

      while (!done) {
        if (currentTask?.cancelled) {
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
      if (currentTask?.cancelled) return;
      currentTask = null;

      clearThinkingMessage();
      const responseMsg = {
        type: 'agent',
        content: content || '(No response from model.)',
        timestamp: now()
      };
      pushMessage(responseMsg);
      _addAgentMessage(responseMsg);
      updateSendButton(false);
    })
    .catch(err => {
      if (err.name === 'AbortError') return;
      clearTimeout(thinkTimeout);
      if (currentTask?.cancelled) return;
      currentTask = null;
      clearThinkingMessage();
      const errMsg = {
        type: 'agent',
        content: `Error calling OpenRouter: ${err.message}`,
        timestamp: now()
      };
      pushMessage(errMsg);
      _addAgentMessage(errMsg);
      updateSendButton(false);
    });

  return currentTask;
}

// -------------------------------------------
// SEND HANDLER
// -------------------------------------------

export function handleSendClick() {
  if (currentTask) {
    cancelAgentTask();
    return;
  }

  const input = document.getElementById('agent-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  const userMsg = { type: 'user', content, timestamp: now() };
  pushMessage(userMsg);
  _addAgentMessage(userMsg);

  maybeAppendStateUpdate();

  updateSendButton(true);
  callOpenRouter(content);
}
