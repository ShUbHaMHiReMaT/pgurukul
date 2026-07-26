/* ================================================================
   PGURUKUL — Tasks JavaScript
   Create, update status, task detail modal
   ================================================================ */

'use strict';

async function createTask() {
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const priority = document.getElementById('task-priority').value;
  const due = document.getElementById('task-due').value;

  if (!title) return showToast('Task title is required', 'error');

  const assignee_ids = Array.from(
    document.querySelectorAll('#assignee-list input:checked')
  ).map(el => el.value);

  const r = await apiFetch(`/tasks/${DEPT_ID}/create`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      priority,
      due_date: due || null,
      assignee_ids,
    }),
  });

  if (r.task) {
    showToast('Task created!', 'success');
    closeModal('modal-create-task');
    setTimeout(() => location.reload(), 600);
  } else {
    showToast(r.error || 'Failed to create task', 'error');
  }
}

async function updateTaskStatus(taskId, status) {
  const r = await apiFetch(`/tasks/${DEPT_ID}/${taskId}/update`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  if (r.task) {
    showToast('Status updated!', 'success');
    setTimeout(() => location.reload(), 500);
  } else {
    showToast(r.error || 'Update failed', 'error');
  }
}

async function openTaskDetail(taskId) {
  if (!IS_LEAD) return;  // Only leads see full detail modal
  openModal('modal-task-detail');

  const body = document.getElementById('detail-task-body');
  const title = document.getElementById('detail-task-title');
  body.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto;"></div></div>';

  const data = await apiFetch(`/tasks/${DEPT_ID}/${taskId}`);
  if (!data.task) {
    body.innerHTML = '<p style="color:var(--color-text-3);">Could not load task</p>';
    return;
  }

  const t = data.task;
  title.textContent = t.title;

  const priorityColors = {urgent:'var(--color-danger)',high:'var(--color-warning)',medium:'var(--color-primary)',low:'var(--color-success)'};
  const pColor = priorityColors[t.priority] || 'var(--color-text-3)';

  body.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <span style="font-size:0.8rem;font-weight:700;color:${pColor};">${t.priority?.toUpperCase()}</span>
      <span class="badge badge-neutral">${(t.status || '').replace('_',' ')}</span>
      ${t.is_overdue ? '<span class="badge badge-danger">OVERDUE</span>' : ''}
    </div>

    ${t.description ? `<p style="color:var(--color-text-2);line-height:1.6;white-space:pre-wrap;">${escHtml(t.description)}</p>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
      <div>
        <div style="font-size:0.75rem;color:var(--color-text-3);margin-bottom:4px;">Status</div>
        <select class="form-control" style="font-size:0.875rem;" onchange="updateTaskStatus('${t.id}', this.value)">
          <option value="not_started" ${t.status==='not_started'?'selected':''}>Not Started</option>
          <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
          <option value="review" ${t.status==='review'?'selected':''}>Review</option>
          <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
        </select>
      </div>
      <div>
        <div style="font-size:0.75rem;color:var(--color-text-3);margin-bottom:4px;">Due Date</div>
        <div style="font-size:0.875rem;font-weight:600;">${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</div>
      </div>
    </div>

    ${t.assignees && t.assignees.length ? `
    <div style="margin-top:16px;">
      <div style="font-size:0.75rem;color:var(--color-text-3);margin-bottom:8px;">Assigned To</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${t.assignees.map(a => `
          <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--color-sidebar-item-hover);border-radius:var(--radius-pill);font-size:0.8125rem;">
            <div class="avatar avatar-sm">${(a.display_name || a.username)[0].toUpperCase()}</div>
            ${escHtml(a.display_name || a.username)}
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Comments -->
    <div style="margin-top:20px;border-top:1px solid var(--color-border);padding-top:16px;">
      <div style="font-size:0.875rem;font-weight:700;margin-bottom:12px;">💬 Comments (${t.comment_count || 0})</div>
      <div id="task-comments-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">
        ${(t.comments || []).map(c => `
          <div style="display:flex;gap:10px;">
            <div class="avatar avatar-sm">${(c.author_name || '?')[0].toUpperCase()}</div>
            <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:8px 12px;flex:1;">
              <div style="font-size:0.75rem;font-weight:700;color:var(--color-text);">${escHtml(c.author_name || 'Unknown')}</div>
              <div style="font-size:0.875rem;color:var(--color-text-2);margin-top:2px;">${escHtml(c.content)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="task-comment-input" class="form-control" placeholder="Add a comment…" style="flex:1;"/>
        <button class="btn btn-primary btn-sm" onclick="addComment('${t.id}')">Send</button>
      </div>
    </div>

    ${IS_LEAD ? `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border);display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">🗑 Delete Task</button>
    </div>` : ''}
  `;
}

async function addComment(taskId) {
  const input = document.getElementById('task-comment-input');
  const content = input.value.trim();
  if (!content) return;

  const r = await apiFetch(`/tasks/${DEPT_ID}/${taskId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  if (r.comment) {
    const list = document.getElementById('task-comments-list');
    if (list) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;gap:10px;';
      el.innerHTML = `
        <div class="avatar avatar-sm">${(r.comment.author_name || '?')[0].toUpperCase()}</div>
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:8px 12px;flex:1;">
          <div style="font-size:0.75rem;font-weight:700;">${escHtml(r.comment.author_name || 'You')}</div>
          <div style="font-size:0.875rem;color:var(--color-text-2);margin-top:2px;">${escHtml(r.comment.content)}</div>
        </div>
      `;
      list.appendChild(el);
    }
    input.value = '';
    showToast('Comment added', 'success');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  const r = await apiFetch(`/tasks/${DEPT_ID}/${taskId}/delete`, { method: 'POST' });
  if (r.ok) {
    showToast('Task deleted', 'success');
    closeModal('modal-task-detail');
    setTimeout(() => location.reload(), 500);
  } else {
    showToast(r.error || 'Delete failed', 'error');
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
