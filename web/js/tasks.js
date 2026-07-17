document.getElementById('plusIcon').innerHTML = ICONS.plus;
document.getElementById('searchIcon').innerHTML = ICONS.search;

let allTasks = [];
let customers = [];
let deleteTargetId = null;

async function resolveCustomerId() {
  const accountName = document.getElementById('tCustomerName').value.trim();
  if (!accountName) return null;

  const existing = customers.find(c => (c.company || c.name || '').toLowerCase() === accountName.toLowerCase());
  if (existing) return existing.id;

  const safeBase = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'account';
  const placeholderEmail = `${safeBase}.${Date.now()}@placeholder.local`;
  const payload = {
    name: accountName,
    company: accountName,
    email: placeholderEmail,
    record_type: 'lead',
    status: 'lead',
    onboarding_status: 'not-started',
    source_channel: 'manual-import'
  };

  const { data, error } = await db.from('customers').insert([payload]).select('id, name, company').single();
  if (error) throw error;
  customers.unshift(data);
  return data.id;
}

async function loadData() {
  const [taskRes, custRes] = await Promise.all([
    db.from('tasks').select('*, customers(id, name, company)').order('due_date', { ascending: true, nullsFirst: false }),
    db.from('customers').select('id, name, company').order('company'),
  ]);

  allTasks = taskRes.data || [];
  customers = custRes.data || [];

  const options = customers.map(c => `<option value="${c.id}">${escapeHtml(c.company || c.name)}</option>`).join('');
  document.getElementById('custFilter').innerHTML = '<option value="">All Accounts</option>' + options;

  renderStats();
  renderTable(allTasks);
}

function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  const pending = allTasks.filter(t => t.status === 'pending').length;
  const inProg = allTasks.filter(t => t.status === 'in-progress').length;
  const overdue = allTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
  const urgent = allTasks.filter(t => t.priority === 'urgent').length;

  document.getElementById('taskStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon yellow">${ICONS.tasks}</div>
      <div class="stat-label">Pending</div>
      <div class="stat-value">${pending}</div>
      <div class="stat-sub">not started</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue">${ICONS.tasks}</div>
      <div class="stat-label">In Progress</div>
      <div class="stat-value">${inProg}</div>
      <div class="stat-sub">currently active</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">${ICONS.calendar}</div>
      <div class="stat-label">Urgent</div>
      <div class="stat-value">${urgent}</div>
      <div class="stat-sub">needs fast action</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--red-bg);">${ICONS.calendar}</div>
      <div class="stat-label">Overdue</div>
      <div class="stat-value" style="color:var(--red);">${overdue}</div>
      <div class="stat-sub">past due date</div>
    </div>
  `;

  document.getElementById('taskSubtitle').textContent = `${allTasks.length} task${allTasks.length !== 1 ? 's' : ''} total`;
}

function filterTasks() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const custId = document.getElementById('custFilter').value;
  const type = document.getElementById('typeFilter').value;
  const due = document.getElementById('dueFilter').value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const filtered = allTasks.filter(t => {
    const haystack = [t.title, t.description, t.assigned_to, t.task_type].join(' ').toLowerCase();
    const matchQ = !q || haystack.includes(q);
    const matchS = !status || t.status === status;
    const matchC = !custId || t.customer_id === custId;
    const matchT = !type || (t.task_type || 'general') === type;
    let matchD = true;
    if (due === 'overdue') matchD = t.due_date && t.due_date < todayStr && t.status !== 'done';
    if (due === 'today') matchD = t.due_date === todayStr;
    if (due === 'week') matchD = t.due_date && t.due_date >= todayStr && new Date(t.due_date) <= weekEnd;
    return matchQ && matchS && matchC && matchT && matchD;
  });

  renderTable(filtered);
}

function renderTable(rows) {
  const tbody = document.getElementById('taskTable');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:36px;height:36px;stroke:var(--text-muted);margin-bottom:10px;">${ICONS.tasks}</svg><p>No tasks found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>
        <div class="td-name">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="td-sub">${escapeHtml(t.description)}</div>` : ''}
        ${t.assigned_to ? `<div class="td-sub">Assigned to ${escapeHtml(t.assigned_to)}</div>` : ''}
      </td>
      <td><a class="td-link" href="profile.html?id=${t.customer_id}">${escapeHtml(t.customers?.company || t.customers?.name || '—')}</a></td>
      <td>${typeBadge(t.task_type || 'general')}</td>
      <td>${priorityBadge(t.priority || 'medium')}</td>
      <td>${dueDateLabel(t.due_date)}</td>
      <td>${taskBadge(t.status)}</td>
      <td>
        <div class="td-actions">
          ${t.status !== 'done' ? `<button class="btn btn-success btn-sm" onclick="markDone('${t.id}')" title="Mark as Done">${ICONS.check} Done</button>` : ''}
          ${t.status === 'pending' ? `<button class="btn btn-secondary btn-sm" onclick="markInProgress('${t.id}')" title="Start">Start</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${t.id}')" title="Edit">${ICONS.edit}</button>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${t.id}" data-name="${escapeHtml(t.title)}" title="Delete">${ICONS.trash}</button>
        </div>
      </td>
    </tr>`).join('');
}

function openAddModal() {
  document.getElementById('taskModalTitle').textContent = 'Add Task';
  setForm({
    taskId: '', tTitle: '', tCustomerName: '', tDue: '',
    tStatus: 'pending', tType: 'sales', tPriority: 'medium',
    tAssignedTo: '', tDesc: '',
  });
  openModal('taskModal');
}

function openEditModal(id) {
  const t = allTasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  setForm({
    taskId: t.id, tTitle: t.title,
    tCustomerName: t.customers?.company || t.customers?.name,
    tDue: t.due_date, tStatus: t.status || 'pending',
    tType: t.task_type || 'general', tPriority: t.priority || 'medium',
    tAssignedTo: t.assigned_to, tDesc: t.description,
  });
  openModal('taskModal');
}

async function saveTask() {
  const id = document.getElementById('taskId').value;
  const title = document.getElementById('tTitle').value.trim();
  const due = document.getElementById('tDue').value || null;
  const status = document.getElementById('tStatus').value;
  const taskType = document.getElementById('tType').value;
  const priority = document.getElementById('tPriority').value;
  const assignedTo = document.getElementById('tAssignedTo').value.trim();
  const desc = document.getElementById('tDesc').value.trim();

  if (!title) {
    toast('Task title is required', 'error');
    return;
  }

  let customerId;
  try {
    customerId = await resolveCustomerId();
  } catch (error) {
    toast('Could not create account: ' + error.message, 'error');
    return;
  }

  if (!customerId) {
    toast('Account name is required', 'error');
    return;
  }

  const payload = {
    title,
    customer_id: customerId,
    due_date: due,
    status,
    task_type: taskType,
    priority,
    assigned_to: assignedTo || null,
    description: desc || null,
  };

  // Preserve the original completion time when re-editing an already-done task.
  const before = id ? allTasks.find(x => x.id === id) : null;
  payload.completed_at = status === 'done' ? (before?.completed_at || new Date().toISOString()) : null;

  let error;
  if (id) {
    ({ error } = await db.from('tasks').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('tasks').insert([payload]));
  }

  if (error) {
    toast('Save failed: ' + error.message, 'error');
    return;
  }
  toast(id ? 'Task updated!' : 'Task added!', 'success');
  closeModal('taskModal');
  loadData();
}

async function markDone(id) {
  const { error } = await db.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    toast('Update failed', 'error');
    return;
  }
  toast('Task marked as done!', 'success');
  loadData();
}

async function markInProgress(id) {
  const { error } = await db.from('tasks').update({ status: 'in-progress' }).eq('id', id);
  if (error) {
    toast('Update failed', 'error');
    return;
  }
  toast('Task started!', 'success');
  loadData();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  deleteTargetId = btn.dataset.id;
  document.getElementById('delTaskName').textContent = btn.dataset.name;
  openModal('delModal');
});

async function confirmDelete() {
  if (!deleteTargetId) return;
  const { error } = await db.from('tasks').delete().eq('id', deleteTargetId);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Task deleted', 'success');
  closeModal('delModal');
  deleteTargetId = null;
  loadData();
}

loadData().then(() => initScrollAnimations());
