// ============================================
// AGENT UI
// ============================================
//
// DOM rendering for the agent chat panel: message list, tool clusters,
// placeholder, and initialization wiring. Depends on agent-state and agent-api.

import { initIcons } from './lucide-init.js';
import {
  loadConversation,
  clearAgentConversation
} from './agent-state.js';
import { setAddAgentMessageFn, initAgentSettings, handleSendClick, isAtBottom } from './agent-api.js';

// -------------------------------------------
// FEATURE FLAGS
// -------------------------------------------

/**
 * Controls whether conversation history is restored from localStorage
 * when the agent view is initialized (i.e. on page reload).
 */
const AGENT_HISTORY_ON_RELOAD = false;

// -------------------------------------------
// SCROLL HELPERS
// -------------------------------------------

/** Returns true when the container scroll position is within `tolerance` pixels of the bottom. */
export { isAtBottom };

// -------------------------------------------
// MESSAGE GROUPING
// -------------------------------------------

/**
 * Group consecutive tool_call messages into a single tool_cluster.
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

  if (toolCluster.length > 0) {
    grouped.push({
      type: 'tool_cluster',
      tools: [...toolCluster],
      timestamp: toolCluster[0].timestamp
    });
  }

  return grouped;
}

// -------------------------------------------
// MESSAGE RENDERING
// -------------------------------------------

/**
 * Format timestamp to a short time string (HH:MM, 24-hour).
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
 * Render tool details HTML for a cluster.
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
 * Render a single message node.
 */
function renderMessage(msg) {
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

  // Basic markdown: bold, inline code, newlines
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
 * State-type messages are excluded from the DOM (they are injected for model context only).
 */
export function renderAgentMessages(messages) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

  // Filter out state update messages — they carry structured plan context, not dialogue
  const visible = messages.filter(m => !m.content?.startsWith('<state_update>'));
  const grouped = groupToolCalls(visible);
  container.innerHTML = grouped.map(renderMessage).join('');

  initIcons();

  container.querySelectorAll('.agent-msg.tool-cluster').forEach(cluster => {
    cluster.addEventListener('click', () => cluster.classList.toggle('expanded'));
  });

  if (isAtBottom(container)) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Add a single message to the DOM (appended to the bottom of the container).
 * Scrolls only if the user was already at the bottom.
 * State-type messages are silently skipped.
 */
export function addAgentMessage(msg) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

  // Skip state update messages — they are injected for model context, not display
  if (msg.content?.startsWith('<state_update>')) return;

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

    if (m.type === 'tool_cluster') {
      node.addEventListener('click', () => node.classList.toggle('expanded'));
    }
  });

  if (atBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

// Share addAgentMessage with agent-api so it can inject streaming responses
setAddAgentMessageFn(addAgentMessage);

// -------------------------------------------
// INITIALIZATION
// -------------------------------------------

/**
 * Initialize the agent view: wire up send button, keyboard handler,
 * and load/render conversation history.
 */
export function initAgentView() {
  initAgentSettings();

  const history = AGENT_HISTORY_ON_RELOAD ? loadConversation() : [];

  const container = document.getElementById('agent-messages');
  if (!container) return;

  if (history.length === 0) {
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
    renderAgentMessages(history);
  }

  const btn = document.getElementById('agent-send');
  if (btn) btn.addEventListener('click', handleSendClick);

  const input = document.getElementById('agent-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendClick();
      }
    });
  }
}