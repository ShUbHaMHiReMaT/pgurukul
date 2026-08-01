/* ================================================================
   PGURUKUL — Chat JavaScript
   Long-polling, message rendering, typing indicators, @mentions
   ================================================================ */

'use strict';

let replyToId = null;
let replyToUser = null;
let _lastMessageId = null;
let _pollInterval = null;
let _serverTime = null;
let _isPolling = false;

// ── Scroll ───────────────────────────────────────────────────────
function scrollToBottom(force = false) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const near = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
  if (force || near) {
    container.scrollTop = container.scrollHeight;
  }
}

// ── Send Message ─────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const content = input.value.trim();

  if (!content) return;

  sendBtn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  const payload = { content };
  if (replyToId) payload.parent_id = replyToId;

  const data = await apiFetch(`/chat/${DEPT_ID}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data.message) {
    appendMessage(data.message, true);
    scrollToBottom(true);
  } else {
    showToast(data.error || 'Failed to send', 'error');
    input.value = content;
  }

  cancelReply();
  sendBtn.disabled = false;
  input.focus();
}

// ── Render Message ───────────────────────────────────────────────
function appendMessage(msg, isOwn = false) {
  const container = document.getElementById('chat-messages');
  const end = document.getElementById('messages-end');

  const div = document.createElement('div');
  div.className = 'message-group';
  div.setAttribute('data-msg-id', msg.id);
  div.setAttribute('data-sender-id', msg.sender_id);

  const initials = (msg.display_name || msg.username || '?')[0].toUpperCase();
  const avatarHtml = msg.avatar_url
    ? `<img src="${msg.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
    : initials;

  const replyHtml = msg.parent_content ? `
    <div class="reply-preview" onclick="scrollToMessage('${msg.parent_id}')">
      <div class="reply-preview-sender">↩ ${escHtml(msg.parent_sender || '')}</div>
      ${escHtml(msg.parent_content.slice(0, 100))}
    </div>` : '';

  const contentHtml = msg.is_deleted
    ? '<div class="message-content" style="color:var(--color-text-3);font-style:italic;">This message was deleted</div>'
    : msg.message_type === 'image'
    ? `<img src="${msg.file_url}" class="chat-image" alt="${escHtml(msg.file_name || '')}" onclick="openLightbox(this.src)"/>`
    : msg.message_type === 'file'
    ? `<a href="${msg.file_url}" class="file-message" target="_blank"><div class="file-icon-box">📎</div><div><div class="file-msg-name">${escHtml(msg.file_name || '')}</div><div class="file-msg-size">Download</div></div></a>`
    : `<div class="message-content">${renderMentions(msg.content)}</div>`;

  const canDelete = isOwn || CURRENT_USER.is_lead;
  const actionsHtml = !msg.is_deleted ? `
    <div class="message-actions">
      <button class="msg-action-btn" onclick="replyTo('${msg.id}','${escHtml(msg.username || '')}')">↩</button>
      ${CURRENT_USER.is_lead ? `<button class="msg-action-btn" onclick="pinMessage('${msg.id}')">📌</button>` : ''}
      ${canDelete ? `<button class="msg-action-btn danger" onclick="deleteMessage('${msg.id}')">🗑</button>` : ''}
    </div>` : '';

  div.innerHTML = `
    ${replyHtml}
    <div class="message-avatar-col">
      <div class="avatar avatar-sm">${avatarHtml}</div>
    </div>
    <div class="message-body">
      <div class="message-meta">
        <span class="message-sender">${escHtml(msg.display_name || msg.username || 'Unknown')}</span>
        <span class="message-time">${formatTime(msg.created_at)}</span>
      </div>
      ${contentHtml}
    </div>
    ${actionsHtml}
  `;

  container.insertBefore(div, end);
  _lastMessageId = msg.id;
  _serverTime = msg.created_at;
}

function renderMentions(text) {
  return escHtml(text).replace(/@([a-zA-Z0-9_.\-]+)/g, '<span class="mention">@$1</span>');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scrollToMessage(id) {
  const el = document.querySelector(`[data-msg-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.background = 'rgba(194,65,12,0.10)';
    setTimeout(() => el.style.background = '', 1500);
  }
}

// ── Reply ────────────────────────────────────────────────────────
function replyTo(msgId, username) {
  replyToId = msgId;
  replyToUser = username;
  document.getElementById('reply-bar').classList.remove('hidden');
  document.getElementById('reply-username').textContent = username;
  document.getElementById('chat-input').focus();
}

function cancelReply() {
  replyToId = null;
  replyToUser = null;
  document.getElementById('reply-bar').classList.add('hidden');
}

// ── Delete ───────────────────────────────────────────────────────
async function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  const r = await apiFetch(`/chat/${DEPT_ID}/messages/${id}/delete`, { method: 'POST' });
  if (r.ok) {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (el) {
      const content = el.querySelector('.message-content');
      if (content) {
        content.style.color = 'var(--color-text-3)';
        content.style.fontStyle = 'italic';
        content.textContent = 'This message was deleted';
      }
      const actions = el.querySelector('.message-actions');
      if (actions) actions.remove();
    }
    // A deleted message can't stay pinned at the top either.
    document.querySelector(`.pinned-bar[data-pinned-id="${id}"]`)?.remove();
  }
}

// ── Pin ──────────────────────────────────────────────────────────
async function pinMessage(id) {
  const r = await apiFetch(`/chat/${DEPT_ID}/messages/${id}/pin`, { method: 'POST' });
  if (r.pinned === undefined) return;
  showToast(r.pinned ? 'Message pinned' : 'Message unpinned', 'info');
  if (!r.pinned) {
    document.querySelector(`.pinned-bar[data-pinned-id="${id}"]`)?.remove();
  }
}

async function unpinFromBar(id) {
  const r = await apiFetch(`/chat/${DEPT_ID}/messages/${id}/pin`, { method: 'POST' });
  if (r.pinned === false) {
    document.querySelector(`.pinned-bar[data-pinned-id="${id}"]`)?.remove();
    showToast('Unpinned', 'info');
  } else if (r.pinned === true) {
    // Was already unpinned by someone else and this toggled it back on — just refresh.
    location.reload();
  }
}

// ── Long-Poll ────────────────────────────────────────────────────
// Typing indicators ride along in the same response as messages — one
// request stream instead of two, which frees up budget to poll twice
// as often (1s vs 2s) at the same total request rate.
async function pollMessages() {
  if (_isPolling) return;
  _isPolling = true;

  try {
    const params = _serverTime ? `?since=${encodeURIComponent(_serverTime)}` : '';
    const data = await apiFetch(`/chat/${DEPT_ID}/poll${params}`);

    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => {
        if (msg.sender_id !== CURRENT_USER.id) {
          appendMessage(msg);
        }
      });
      scrollToBottom();
    }

    if (data.server_time) _serverTime = data.server_time;
    renderTypingIndicator(data.typing || []);
  } catch (e) {
    // Silently fail
  } finally {
    _isPolling = false;
  }
}

// ── Typing indicator ─────────────────────────────────────────────
let _typingSignalSent = false;
function sendTypingSignal() {
  // Was firing on every keystroke; now throttled to once per 2s while
  // actively typing, which is all the 4s server-side cutoff needs.
  if (_typingSignalSent) return;
  _typingSignalSent = true;
  apiFetch(`/chat/${DEPT_ID}/typing`, { method: 'POST' });
  setTimeout(() => { _typingSignalSent = false; }, 2000);
}

function renderTypingIndicator(typing) {
  const indicator = document.getElementById('typing-indicator');
  const text = document.getElementById('typing-text');
  if (!typing.length) {
    indicator.style.display = 'none';
    return;
  }
  const names = typing.map(u => u.display_name).join(', ');
  text.textContent = `${names} ${typing.length === 1 ? 'is' : 'are'} typing…`;
  indicator.style.display = 'flex';
}

// ── Online Users ─────────────────────────────────────────────────
async function pollOnline() {
  const data = await apiFetch(`/chat/${DEPT_ID}/online-users`);
  const list = document.getElementById('online-list');
  if (!list || !data.users) return;
  list.innerHTML = data.users.map(u => `
    <div class="online-member">
      <div class="avatar-wrap">
        <div class="avatar avatar-sm">${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : (u.display_name || u.username)[0].toUpperCase()}</div>
        ${u.online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div>
        <div style="font-weight:500;font-size:0.8rem;">${escHtml(u.display_name || u.username)}</div>
        <div style="font-size:0.7rem;color:${u.online ? 'var(--color-success)' : 'var(--color-text-3)'};">${u.online ? 'Online' : 'Offline'}</div>
      </div>
    </div>
  `).join('');
}

// ── File Upload via Chat ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', '/chat');
      formData.append('description', 'Shared via chat');

      showToast(`Uploading ${file.name}…`, 'info');

      const res = await fetch(`/files/${DEPT_ID}/upload`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        body: formData,
      });
      const data = await res.json();

      if (data.file) {
        // Send message with file reference
        await apiFetch(`/chat/${DEPT_ID}/send`, {
          method: 'POST',
          body: JSON.stringify({ content: `[Shared file: ${file.name}]`, file_id: data.file.id }),
        });
        showToast('File shared!', 'success');
        pollMessages();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
      fileInput.value = '';
    });
  }

  // Input events
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    chatInput.addEventListener('input', () => {
      sendTypingSignal();

      // Resize
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });
  }

  // Initial scroll
  scrollToBottom(true);

  // Poll messages (+ typing, merged) every 1s — same total request rate
  // as the old 2s-messages + 2s-typing split, but half the latency.
  _pollInterval = setInterval(pollMessages, 1000);
  // Poll online every 30s
  setInterval(pollOnline, 30000);
  pollOnline();
});
