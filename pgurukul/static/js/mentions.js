/* ================================================================
   PGURUKUL — @Mention Autocomplete JavaScript
   ================================================================ */

'use strict';

let _mentionStart = -1;
let _mentionQuery = '';
let _selectedIdx = 0;
let _mentionUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chat-input');
  const popup = document.getElementById('mention-popup');
  if (!input || !popup) return;

  input.addEventListener('input', handleMentionInput);
  input.addEventListener('keydown', handleMentionKeydown);
});

async function handleMentionInput(e) {
  const input = e.target;
  const val = input.value;
  const cursor = input.selectionStart;

  // Find the @ character before cursor
  const textBefore = val.slice(0, cursor);
  const mentionMatch = textBefore.match(/@([a-zA-Z0-9_.-]*)$/);

  if (!mentionMatch) {
    closeMentionPopup();
    return;
  }

  _mentionStart = textBefore.lastIndexOf('@');
  _mentionQuery = mentionMatch[1];

  if (_mentionQuery.length === 0) {
    // Show all members when @ typed
    await fetchMentionSuggestions('');
  } else {
    await fetchMentionSuggestions(_mentionQuery);
  }
}

async function fetchMentionSuggestions(query) {
  const popup = document.getElementById('mention-popup');

  try {
    const data = await apiFetch(
      `/chat/${DEPT_ID}/members/autocomplete?q=${encodeURIComponent(query)}`
    );
    _mentionUsers = data.users || [];
    _selectedIdx = 0;
    renderMentionPopup(_mentionUsers);
  } catch {
    closeMentionPopup();
  }
}

function renderMentionPopup(users) {
  const popup = document.getElementById('mention-popup');

  if (!users.length) {
    closeMentionPopup();
    return;
  }

  popup.innerHTML = users.map((u, i) => `
    <div class="mention-item ${i === _selectedIdx ? 'selected' : ''}"
         onmouseenter="_selectedIdx=${i};highlightMention()"
         onclick="selectMention(${i})">
      <div class="avatar avatar-sm">
        ${u.avatar_url
          ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
          : (u.display_name || u.username)[0].toUpperCase()
        }
      </div>
      <div>
        <div style="font-weight:600;font-size:0.8125rem;">${escHtml(u.display_name || u.username)}</div>
        <div style="font-size:0.75rem;color:var(--color-text-3);">@${escHtml(u.username)}</div>
      </div>
    </div>
  `).join('');

  popup.classList.remove('hidden');
}

function highlightMention() {
  const items = document.querySelectorAll('.mention-item');
  items.forEach((el, i) => el.classList.toggle('selected', i === _selectedIdx));
}

function handleMentionKeydown(e) {
  const popup = document.getElementById('mention-popup');
  if (popup.classList.contains('hidden')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _selectedIdx = Math.min(_selectedIdx + 1, _mentionUsers.length - 1);
    highlightMention();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _selectedIdx = Math.max(_selectedIdx - 1, 0);
    highlightMention();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (_mentionUsers.length > 0) {
      e.preventDefault();
      selectMention(_selectedIdx);
    }
  } else if (e.key === 'Escape') {
    closeMentionPopup();
  }
}

function selectMention(idx) {
  const user = _mentionUsers[idx];
  if (!user) return;

  const input = document.getElementById('chat-input');
  const val = input.value;
  const before = val.slice(0, _mentionStart);
  const after = val.slice(input.selectionStart);

  input.value = `${before}@${user.username} ${after}`;

  // Move cursor after the mention
  const newPos = before.length + user.username.length + 2;
  input.setSelectionRange(newPos, newPos);

  closeMentionPopup();
  input.focus();
}

function closeMentionPopup() {
  const popup = document.getElementById('mention-popup');
  if (popup) popup.classList.add('hidden');
  _mentionStart = -1;
  _mentionQuery = '';
  _mentionUsers = [];
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
