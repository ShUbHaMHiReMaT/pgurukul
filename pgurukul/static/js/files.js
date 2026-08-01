/* ================================================================
   PGURUKUL — Files JavaScript
   Upload, drag & drop, version history, rename, favorites
   ================================================================ */

'use strict';

// ── Upload ────────────────────────────────────────────────────────
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const files = event.dataTransfer.files;
  if (files.length) handleFileSelect(files);
}

function handleFileSelect(files) {
  const queue = document.getElementById('upload-queue');
  Array.from(files).forEach(file => uploadFile(file, queue));
}

async function uploadFile(file, queueEl) {
  const MAX_MB = 100;
  if (file.size > MAX_MB * 1024 * 1024) {
    showToast(`${file.name} exceeds ${MAX_MB}MB limit`, 'error');
    return;
  }

  // Create row in queue
  const itemId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item = document.createElement('div');
  item.id = itemId;
  item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px;background:var(--color-surface-2);border-radius:var(--radius-md);';
  item.innerHTML = `
    <div style="font-size:1.25rem;">${getFileIcon(file.name.split('.').pop())}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:0.875rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(file.name)}</div>
      <div class="progress-bar" style="margin-top:6px;"><div class="progress-bar-fill" id="${itemId}-bar" style="width:0%;"></div></div>
    </div>
    <div id="${itemId}-status" style="font-size:0.75rem;color:var(--color-text-3);">Uploading…</div>
  `;
  queueEl.appendChild(item);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', CURRENT_FOLDER || '/');

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        const bar = document.getElementById(`${itemId}-bar`);
        if (bar) bar.style.width = pct + '%';
      }
    });

    const result = await new Promise((resolve, reject) => {
      xhr.open('POST', `/files/${DEPT_ID}/upload`);
      xhr.setRequestHeader('X-CSRFToken', getCsrf());
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid response')); }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });

    const status = document.getElementById(`${itemId}-status`);
    const bar = document.getElementById(`${itemId}-bar`);

    if (result.file) {
      if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--color-success)'; }
      if (status) { status.textContent = '✅ Done'; status.style.color = 'var(--color-success)'; }
      showToast(`${file.name} uploaded!`, 'success');
      setTimeout(() => { item.remove(); location.reload(); }, 1000);
    } else {
      if (bar) { bar.style.background = 'var(--color-danger)'; }
      if (status) { status.textContent = '❌ ' + (result.error || 'Failed'); status.style.color = 'var(--color-danger)'; }
      showToast(result.error || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast('Upload error: ' + err.message, 'error');
    item.remove();
  }
}

// ── Version History ───────────────────────────────────────────────
async function showVersions(fileId, fileName) {
  openModal('modal-versions');
  const body = document.getElementById('versions-body');
  body.innerHTML = '<div style="text-align:center;padding:40px;"><div class="animal-loader"><span>🐇</span><span>🦊</span><span>🐢</span></div></div>';

  const data = await apiFetch(`/files/${DEPT_ID}/files/${fileId}/versions`);

  if (!data.versions) {
    body.innerHTML = '<p style="color:var(--color-text-3);text-align:center;">Failed to load versions</p>';
    return;
  }

  body.innerHTML = `
    <div style="font-size:0.875rem;font-weight:700;margin-bottom:var(--space-4);">${escHtml(fileName)}</div>
    <div style="display:flex;flex-direction:column;gap:var(--space-3);">
      ${data.versions.map(v => `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);background:var(--color-surface-2);border-radius:var(--radius-md);border:1px solid var(--color-border);">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),var(--color-accent));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.875rem;flex-shrink:0;">
            v${v.version_number}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.875rem;font-weight:600;">Version ${v.version_number}</div>
            <div style="font-size:0.75rem;color:var(--color-text-3);">
              ${v.uploader_name || 'Unknown'} · ${formatBytes(v.size_bytes || 0)} · ${new Date(v.created_at).toLocaleDateString()}
            </div>
            ${v.change_note ? `<div style="font-size:0.8rem;color:var(--color-text-2);font-style:italic;margin-top:2px;">"${escHtml(v.change_note)}"</div>` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <a href="${v.storage_url || '#'}" class="btn btn-ghost btn-sm" target="_blank" title="Download v${v.version_number}">⬇</a>
            ${IS_LEAD && v.version_number < data.file.version ? `
              <button class="btn btn-ghost btn-sm" onclick="restoreVersion('${fileId}','${v.id}')" title="Restore to v${v.version_number}">↩</button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function restoreVersion(fileId, versionId) {
  if (!confirm('Restore to this version? The current version will be preserved.')) return;
  const r = await apiFetch(`/files/${DEPT_ID}/files/${fileId}/restore/${versionId}`, { method: 'POST' });
  if (r.file) {
    showToast('Version restored!', 'success');
    closeModal('modal-versions');
    setTimeout(() => location.reload(), 600);
  } else {
    showToast(r.error || 'Restore failed', 'error');
  }
}

// ── Rename ────────────────────────────────────────────────────────
function renameFile(fileId, currentName) {
  document.getElementById('rename-input').value = currentName;
  document.getElementById('rename-file-id').value = fileId;
  openModal('modal-rename');
}

async function submitRename() {
  const fileId = document.getElementById('rename-file-id').value;
  const name = document.getElementById('rename-input').value.trim();
  if (!name) return showToast('Name required', 'error');

  const r = await apiFetch(`/files/${DEPT_ID}/files/${fileId}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  if (r.ok) {
    showToast('File renamed!', 'success');
    closeModal('modal-rename');
    setTimeout(() => location.reload(), 500);
  } else {
    showToast(r.error || 'Rename failed', 'error');
  }
}

// ── Favorites ─────────────────────────────────────────────────────
async function toggleFavorite(fileId, btn) {
  const r = await apiFetch(`/files/${DEPT_ID}/files/${fileId}/favorite`, { method: 'POST' });
  if (r.is_favorite !== undefined) {
    btn.textContent = r.is_favorite ? '⭐' : '☆';
    btn.classList.toggle('active', r.is_favorite);
    showToast(r.is_favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
  }
}

// ── Delete ────────────────────────────────────────────────────────
async function deleteFile(fileId) {
  if (!confirm('Move this file to trash? It can be recovered by an admin.')) return;
  const r = await apiFetch(`/files/${DEPT_ID}/files/${fileId}/delete`, { method: 'POST' });
  if (r.ok) {
    const row = document.querySelector(`[data-file-id="${fileId}"]`);
    if (row) row.remove();
    showToast('File deleted', 'success');
  } else {
    showToast(r.error || 'Delete failed', 'error');
  }
}

// ── View toggle ───────────────────────────────────────────────────
function setView(type) {
  const container = document.getElementById('files-container');
  if (!container) return;
  const btnGrid = document.getElementById('view-grid');
  const btnList = document.getElementById('view-list');

  if (type === 'grid') {
    container.classList.remove('files-list');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill,minmax(180px,1fr))';
    container.style.gap = '12px';
    container.style.padding = '16px';
    btnGrid.style.color = 'var(--color-primary)';
    btnList.style.color = '';
  } else {
    container.classList.add('files-list');
    container.style.display = '';
    container.style.gridTemplateColumns = '';
    container.style.gap = '';
    container.style.padding = '';
    btnGrid.style.color = '';
    btnList.style.color = 'var(--color-primary)';
  }
}

// ── Utilities ─────────────────────────────────────────────────────
function getFileIcon(ext) {
  const icons = {
    pdf:'📄', doc:'📝', docx:'📝', ppt:'📊', pptx:'📊',
    xls:'📈', xlsx:'📈', csv:'📈', zip:'🗜️', png:'🖼️',
    jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️', mp4:'🎥', txt:'📃',
  };
  return icons[ext?.toLowerCase()] || '📁';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rename on Enter
document.addEventListener('DOMContentLoaded', () => {
  const ri = document.getElementById('rename-input');
  if (ri) ri.addEventListener('keydown', e => { if (e.key === 'Enter') submitRename(); });
});
