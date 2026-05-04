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
// Agent loop (placeholder — no real AI yet)
// ============================================================

/**
 * Filler agent: waits 2 seconds then emits a default response.
 * Returns a cancellation handle with { cancelled, timeoutId }.
 */
function startFillerAgent(userMessage) {
  const task = { cancelled: false, timeoutId: null };
  currentTask = task;

  // Emit a "thinking" message after a short delay
  task.timeoutId = setTimeout(() => {
    if (task.cancelled) return;

    const thinkingMsg = {
      type: 'agent',
      content: 'Thinking…',
      timestamp: now(),
      thinking: true
    };
    pushMessage(thinkingMsg);
    addAgentMessage(thinkingMsg);
  }, 600);

  // Emit the actual response after 2 seconds total
  const responseTimeout = setTimeout(() => {
    if (task.cancelled) return;
    currentTask = null;

    // Remove the thinking message from DOM and state
    const container = document.getElementById('agent-messages');
    const thinkingEl = container?.querySelector('.agent-msg.thinking');
    if (thinkingEl) thinkingEl.remove();
    const last = conversation[conversation.length - 1];
    if (last && last.thinking) {
      conversation.pop();
      saveConversation();
    }

    const responseMsg = {
      type: 'agent',
      content: `I received your message: "${userMessage}". This is a placeholder response — real agent logic is not yet implemented. Type another message to continue the loop.`,
      timestamp: now()
    };
    pushMessage(responseMsg);
    addAgentMessage(responseMsg);
    updateSendButton(false);
  }, 2000);

  task.timeoutId = responseTimeout;
  return task;
}

/** Cancel the currently running agent task, if any. */
function cancelAgentTask() {
  if (!currentTask) return;
  currentTask.cancelled = true;
  clearTimeout(currentTask.timeoutId);
  currentTask = null;

  // Remove the thinking message from DOM and state
  const container = document.getElementById('agent-messages');
  const thinkingEl = container?.querySelector('.agent-msg.thinking');
  if (thinkingEl) thinkingEl.remove();
  const last = conversation[conversation.length - 1];
  if (last && last.thinking) {
    conversation.pop();
    saveConversation();
  }

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
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
    `;
    btn.setAttribute('aria-label', 'Stop');
  } else {
    btn.classList.remove('agent-stop-btn');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    `;
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

  // Start the filler agent loop
  updateSendButton(true);
  startFillerAgent(content);
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
          <svg class="agent-tool-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="agent-msg-bubble">
          <div class="agent-tool-header">
            <svg class="agent-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
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
 * Render all messages in the agent view
 */
export function renderAgentMessages(messages) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

  const grouped = groupToolCalls(messages);
  container.innerHTML = grouped.map(renderMessage).join('');

  // Add click handlers for tool clusters
  container.querySelectorAll('.agent-msg.tool-cluster').forEach(cluster => {
    cluster.addEventListener('click', () => {
      cluster.classList.toggle('expanded');
    });
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
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
 * Add a single message and scroll
 */
export function addAgentMessage(msg) {
  const container = document.getElementById('agent-messages');
  if (!container) return;

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

  container.scrollTop = container.scrollHeight;
}

/**
 * Initialize agent view: load from localStorage and render.
 * Shows an empty placeholder if there is no conversation history.
 */
export function initAgentView() {
  conversation = loadConversation();

  const container = document.getElementById('agent-messages');
  if (!container) return;

  if (conversation.length === 0) {
    container.innerHTML = `
      <div class="agent-placeholder">
        <div class="agent-placeholder-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 8V4H8"></path>
            <rect x="2" y="2" width="20" height="20" rx="5"></rect>
            <path d="M9 12a2 2 0 1 0 3.535-1.536L14 12l-1.465-1.536A2 2 0 0 0 9 12"></path>
            <path d="M15 16v2"></path>
            <path d="M15 12a2 2 0 1 0 3.535-1.536L20 12l-1.465-1.536A2 2 0 0 0 15 12"></path>
          </svg>
        </div>
        <div class="agent-placeholder-title">Start a conversation</div>
        <div class="agent-placeholder-sub">Send a message to begin. The agent will respond with a placeholder until real logic is added.</div>
      </div>
    `;
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
