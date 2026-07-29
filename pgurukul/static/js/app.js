/* ================================================================
   PGURUKUL — Core Application JavaScript
   Theme, Toast, Modal, CSRF, API helper
   ================================================================ */

'use strict';

// ── Theme ────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('pgurukul-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pgurukul-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (!sun || !moon) return;
  if (theme === 'dark') {
    sun.style.display = 'none';
    moon.style.display = 'block';
  } else {
    sun.style.display = 'block';
    moon.style.display = 'none';
  }
}

// ── Sidebar (mobile) ─────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}

// Close sidebar on overlay click (mobile)
document.addEventListener('click', (e) => {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  if (sb.classList.contains('open') && !sb.contains(e.target)) {
    sb.classList.remove('open');
  }
});

// ── CSRF Token ───────────────────────────────────────────────────
function getCsrf() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : '';
}

// ── API Fetch Helper ─────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCsrf(),
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      window.location.href = '/auth/login';
      return {};
    }
    if (res.status === 403) {
      showToast('Permission denied', 'error');
      return {};
    }
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.error('apiFetch error:', err);
    showToast('Network error. Please try again.', 'error');
    return {};
  }
}

// ── Toast System ─────────────────────────────────────────────────
const TOAST_ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <span style="flex:1;">${message}</span>
    <span onclick="this.parentElement.remove()" style="cursor:pointer;opacity:0.6;font-size:0.8rem;">✕</span>
  `;

  toast.addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => removeToast(toast), duration);
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 250);
}

// ── Modal System ─────────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Focus first input
    const input = modal.querySelector('input, textarea');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
      m.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
});

// ── Dropdown ─────────────────────────────────────────────────────
function toggleDropdown(id, event) {
  if (event) event.stopPropagation();
  const dd = document.getElementById(id);
  if (!dd) return;
  const isOpen = !dd.classList.contains('hidden');
  // Close all
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
  if (!isOpen) dd.classList.remove('hidden');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
});

// ── Notification Polling ─────────────────────────────────────────
let _notifPollInterval = null;

function startNotifPolling() {
  if (_notifPollInterval) return;
  _notifPollInterval = setInterval(async () => {
    const data = await apiFetch('/api/notifications');
    const bell = document.getElementById('notif-bell');
    if (!bell) return;

    const dot = bell.querySelector('.notif-dot');
    const sidebarBadge = document.querySelector('.sidebar-badge');

    if (data.unread_count > 0) {
      if (!dot) {
        const d = document.createElement('span');
        d.className = 'notif-dot';
        bell.appendChild(d);
      }
      if (sidebarBadge) sidebarBadge.textContent = data.unread_count;
    } else {
      if (dot) dot.remove();
      if (sidebarBadge) sidebarBadge.remove();
    }
  }, 15000); // Poll every 15s
}

// ── Format utilities ─────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(d1, d2) {
  return new Date(d1).toDateString() === new Date(d2).toDateString();
}

function sameMinute(d1Str, d2Str) {
  const a = new Date(d1Str), b = new Date(d2Str);
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate() &&
         a.getHours() === b.getHours() &&
         a.getMinutes() === b.getMinutes();
}

function getFileIcon(ext) {
  const icons = {
    pdf: '📄', doc: '📝', docx: '📝', ppt: '📊', pptx: '📊',
    xls: '📈', xlsx: '📈', csv: '📈', zip: '🗜️', png: '🖼️',
    jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', mp4: '🎥',
    mov: '🎥', txt: '📃', json: '📃',
  };
  return icons[ext?.toLowerCase()] || '📁';
}

// ── Lightbox ─────────────────────────────────────────────────────
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (lb && img) {
    img.src = src;
    lb.classList.remove('hidden');
  }
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startNotifPolling();

  // Auto-resize textareas
  document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
    });
  });
});
