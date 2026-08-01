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

// ── Page Navigation Loader ──────────────────────────────────────────
// This app does full page reloads (server-rendered, no SPA), so there's
// a gap between "user clicks a link" and "new page appears" with zero
// feedback. Flash the runners immediately on click so it doesn't feel dead.
(function initPageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    try {
      if (new URL(href, window.location.href).origin !== window.location.origin) return;
    } catch (err) { return; }
    loader.classList.add('active');
  });

  document.addEventListener('submit', (e) => {
    if (!e.defaultPrevented && e.target.tagName === 'FORM') {
      loader.classList.add('active');
    }
  });

  // Restore state cleanly when a page is served from bfcache (e.g. back button).
  window.addEventListener('pageshow', () => loader.classList.remove('active'));
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
  if (e.target.closest('.sidebar-toggle')) return; // don't fight the toggle button's own click
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

let _lastSeenNotifId = null;
let _notifAudioCtx = null;

function _playNotifSound() {
  try {
    _notifAudioCtx = _notifAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _notifAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Audio can fail silently (autoplay policy, unsupported browser) — never block notifications on it.
  }
}

async function _pollNotificationsOnce() {
  const data = await apiFetch('/api/notifications');
  const notifs = data.notifications || [];

  // Toast-popup any notification newer than the last one we saw. On the
  // very first poll after page load, just record a baseline instead of
  // replaying a toast for every already-unread notification.
  if (_lastSeenNotifId === null) {
    _lastSeenNotifId = notifs.length ? notifs[0].id : '';
  } else if (notifs.length && notifs[0].id !== _lastSeenNotifId) {
    const newOnes = [];
    for (const n of notifs) {
      if (n.id === _lastSeenNotifId) break;
      newOnes.push(n);
    }
    _lastSeenNotifId = notifs[0].id;
    _playNotifSound();
    newOnes.reverse().forEach(n => {
      showToast(n.body ? `${n.title} — ${n.body}` : n.title, 'info', 6000);
    });
  }

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
}

function startNotifPolling() {
  if (_notifPollInterval) return;
  // Only poll on authenticated pages (dashboard/admin layouts) — the
  // notif bell only exists there, so this also avoids hammering
  // /api/notifications (and the resulting 401 redirect) on the login page.
  if (!document.getElementById('notif-bell')) return;
  _pollNotificationsOnce();
  _notifPollInterval = setInterval(_pollNotificationsOnce, 8000);
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
