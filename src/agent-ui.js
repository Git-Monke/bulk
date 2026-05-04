// Sample conversation data with consecutive tool calls
const SAMPLE_MESSAGES = [
  {
    type: 'user',
    content: 'Help me build a simple counter component with HTML, CSS, and JavaScript.',
    timestamp: '2026-05-04T10:30:00'
  },
  {
    type: 'agent',
    content: "I'll build a clean counter component for you. Let me start by creating the HTML structure, then add the styling and interactivity.",
    timestamp: '2026-05-04T10:30:02'
  },
  {
    type: 'tool_call',
    toolName: 'write',
    params: {
      path: 'counter.html',
      content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Counter</title>\n  <link rel="stylesheet" href="counter.css">\n</head>\n<body>\n  <div class="counter">\n    <button id="decrement">−</button>\n    <span id="count">0</span>\n    <button id="increment">+</button>\n  </div>\n  <script src="counter.js"><\/script>\n</body>\n</html>'
    },
    result: 'File written successfully (247 bytes)',
    timestamp: '2026-05-04T10:30:03'
  },
  {
    type: 'tool_call',
    toolName: 'write',
    params: {
      path: 'counter.css',
      content: '.counter {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  font-family: system-ui;\n}\n\nbutton {\n  width: 40px;\n  height: 40px;\n  border: none;\n  border-radius: 8px;\n  background: #6366f1;\n  color: white;\n  font-size: 24px;\n  cursor: pointer;\n}\n\n#count {\n  font-size: 32px;\n  font-weight: bold;\n  min-width: 60px;\n  text-align: center;\n}'
    },
    result: 'File written successfully (312 bytes)',
    timestamp: '2026-05-04T10:30:04'
  },
  {
    type: 'tool_call',
    toolName: 'write',
    params: {
      path: 'counter.js',
      content: "const countEl = document.getElementById('count');\nconst incBtn = document.getElementById('increment');\nconst decBtn = document.getElementById('decrement');\n\nlet count = 0;\n\nincBtn.addEventListener('click', () => {\n  count++;\n  countEl.textContent = count;\n});\n\ndecBtn.addEventListener('click', () => {\n  count--;\n  countEl.textContent = count;\n});"
    },
    result: 'File written successfully (289 bytes)',
    timestamp: '2026-05-04T10:30:05'
  },
  {
    type: 'agent',
    content: "I've created three files for your counter component:\n\n- **counter.html** — the markup with a decrement button, display, and increment button\n- **counter.css** — styles for the flexbox layout and button appearance\n- **counter.js** — the event listeners that update the count\n\nThe component uses a simple increment/decrement pattern with clean visuals. Open `counter.html` in your browser to try it out!",
    timestamp: '2026-05-04T10:30:06'
  },
  {
    type: 'user',
    content: 'Can you add a reset button that sets the count back to 0?',
    timestamp: '2026-05-04T10:31:00'
  },
  {
    type: 'agent',
    content: "Sure, I'll add a reset button to the component.",
    timestamp: '2026-05-04T10:31:01'
  },
  {
    type: 'tool_call',
    toolName: 'read',
    params: {
      path: 'counter.html'
    },
    result: 'File content retrieved (247 bytes)',
    timestamp: '2026-05-04T10:31:02'
  },
  {
    type: 'tool_call',
    toolName: 'edit',
    params: {
      path: 'counter.html',
      oldText: '  <div class="counter">\n    <button id="decrement">−</button>\n    <span id="count">0</span>\n    <button id="increment">+</button>\n  </div>',
      newText: '  <div class="counter">\n    <button id="decrement">−</button>\n    <span id="count">0</span>\n    <button id="increment">+</button>\n    <button id="reset">Reset</button>\n  </div>'
    },
    result: 'File edited successfully',
    timestamp: '2026-05-04T10:31:03'
  },
  {
    type: 'tool_call',
    toolName: 'edit',
    params: {
      path: 'counter.js',
      oldText: 'decBtn.addEventListener(\'click\', () => {\n  count--;\n  countEl.textContent = count;\n});',
      newText: 'decBtn.addEventListener(\'click\', () => {\n  count--;\n  countEl.textContent = count;\n});\n\ndocument.getElementById(\'reset\').addEventListener(\'click\', () => {\n  count = 0;\n  countEl.textContent = count;\n});'
    },
    result: 'File edited successfully',
    timestamp: '2026-05-04T10:31:04'
  },
  {
    type: 'agent',
    content: "Done! I've added a Reset button to the HTML and wired it up in the JavaScript. Refresh your browser to see it in action.",
    timestamp: '2026-05-04T10:31:05'
  }
];

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
 * Render a single message
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

  return `
    <div class="agent-msg ${msg.type}">
      <div class="agent-msg-bubble">
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
 * Initialize agent view with sample data
 */
export function initAgentView() {
  renderAgentMessages(SAMPLE_MESSAGES);
}
