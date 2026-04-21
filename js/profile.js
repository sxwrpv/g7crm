document.getElementById('backBtn').innerHTML = `${ICONS.back} Back`;
document.getElementById('editBtn').innerHTML = `${ICONS.edit} Edit`;
document.getElementById('intPlusIcon').innerHTML = ICONS.plus;
document.getElementById('dealPlusIcon').innerHTML = ICONS.plus;
document.getElementById('taskPlusIcon').innerHTML = ICONS.plus;

const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
document.getElementById('iDate').value = nowLocal;

const params = new URLSearchParams(window.location.search);
const CUST_ID = params.get('id');
if (!CUST_ID) window.location.href = 'customers.html';

let customer = null;

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

async function loadProfile() {
  await loadCustomer();
  await Promise.all([loadInteractions(), loadDeals(), loadTasks(), loadLeads()]);
}

async function loadCustomer() {
  const { data, error } = await db.from('customers').select('*').eq('id', CUST_ID).single();
  if (error || !data) {
    toast('Account not found', 'error');
    return;
  }

  customer = data;
  document.getElementById('pageTitle').textContent = data.company || data.name;
  document.getElementById('pageSub').textContent = `${data.name} · ${data.niche || 'No niche set'}`;

  document.getElementById('profileHeader').innerHTML = `
    <div class="profile-avatar">${initials(data.company || data.name)}</div>
    <div class="profile-info">
      <h2>${escapeHtml(data.company || data.name)} ${recordTypeBadge(data.record_type || 'lead')} ${statusBadge(data.account_stage || 'new')}</h2>
      <div class="co">${escapeHtml(data.name)} · ${statusBadge(data.status || 'lead')} · ${onboardingBadge(data.onboarding_status || 'not-started')}</div>
      <div class="profile-meta">
        <div class="profile-meta-item">${ICONS.mail} ${escapeHtml(data.email)}</div>
        ${data.phone ? `<div class="profile-meta-item">${ICONS.phone} ${escapeHtml(data.phone)}</div>` : ''}
        ${data.website_url ? `<div class="profile-meta-item">${ICONS.building} ${escapeHtml(data.website_url)}</div>` : ''}
        ${data.alert_destination ? `<div class="profile-meta-item">${ICONS.calendar} Alerts → ${escapeHtml(data.alert_destination)}</div>` : ''}
        <div class="profile-meta-item">${ICONS.calendar} Added ${fmtDate(data.created_at)}</div>
      </div>
      ${data.next_action ? `<div class="inline-note">Next action: ${escapeHtml(data.next_action)}</div>` : ''}
      ${data.notes ? `<div class="inline-note">${nl2br(data.notes)}</div>` : ''}
    </div>`;

  document.getElementById('summaryCards').innerHTML = `
    <div class="mini-card">
      <div class="mini-label">Niche</div>
      <div class="mini-value">${escapeHtml(data.niche || '—')}</div>
      <div class="mini-sub">Source ${escapeHtml(sourceLabel(data.source_channel))}</div>
    </div>
    <div class="mini-card">
      <div class="mini-label">Delivery</div>
      <div class="mini-value">${escapeHtml(labelize(data.delivery_status || 'not-started'))}</div>
      <div class="mini-sub">${channelBadge(data.preferred_alert_channel || 'telegram')}</div>
    </div>
    <div class="mini-card">
      <div class="mini-label">Service Area</div>
      <div class="mini-value">${escapeHtml(data.service_area || '—')}</div>
      <div class="mini-sub">WhatsApp ${escapeHtml(data.whatsapp || '—')}</div>
    </div>
    <div class="mini-card">
      <div class="mini-label">Readiness</div>
      <div class="mini-value">${escapeHtml(labelize(data.onboarding_status || 'not-started'))}</div>
      <div class="mini-sub">${escapeHtml(data.record_type || 'lead')} record</div>
    </div>`;
}

function openEditModal() {
  if (!customer) return;
  setForm({
    eName: customer.name, eEmail: customer.email, ePhone: customer.phone,
    eCompany: customer.company, eAddress: customer.address,
    eStatus: customer.status || 'lead', eWebsite: customer.website_url,
    eNiche: customer.niche, eRecordType: customer.record_type || 'lead', eAccountStage: customer.account_stage || 'new',
    eOnboardingStatus: customer.onboarding_status || 'not-started',
    eDeliveryStatus: customer.delivery_status || 'not-started',
    ePreferredAlertChannel: customer.preferred_alert_channel || 'telegram',
    eAlertDestination: customer.alert_destination,
    eNextAction: customer.next_action, eNotes: customer.notes,
  });
  openModal('editModal');
}

async function saveEdit() {
  const payload = {
    name: document.getElementById('eName').value.trim(),
    email: document.getElementById('eEmail').value.trim(),
    phone: document.getElementById('ePhone').value.trim() || null,
    company: document.getElementById('eCompany').value.trim() || null,
    address: document.getElementById('eAddress').value.trim() || null,
    status: document.getElementById('eStatus').value,
    website_url: document.getElementById('eWebsite').value.trim() || null,
    niche: document.getElementById('eNiche').value.trim() || null,
    record_type: document.getElementById('eRecordType').value,
    account_stage: document.getElementById('eAccountStage').value,
    onboarding_status: document.getElementById('eOnboardingStatus').value,
    delivery_status: document.getElementById('eDeliveryStatus').value,
    preferred_alert_channel: document.getElementById('ePreferredAlertChannel').value,
    alert_destination: document.getElementById('eAlertDestination').value.trim() || null,
    next_action: document.getElementById('eNextAction').value.trim() || null,
    notes: document.getElementById('eNotes').value.trim() || null,
  };

  if (!payload.name || !payload.email || !payload.company) {
    toast('Contact name, email, and business name are required', 'error');
    return;
  }

  const { error } = await db.from('customers').update(payload).eq('id', CUST_ID);
  if (error) {
    toast('Update failed: ' + error.message, 'error');
    return;
  }
  toast('Account updated!', 'success');
  closeModal('editModal');
  loadCustomer();
}

async function loadInteractions() {
  const { data, error } = await db.from('interactions').select('*').eq('customer_id', CUST_ID).order('date', { ascending: false });
  document.getElementById('intCount').textContent = `${(data || []).length} interaction${(data || []).length !== 1 ? 's' : ''}`;
  const el = document.getElementById('intList');
  if (error || !data?.length) {
    el.innerHTML = `<div class="empty-state">${ICONS.mail}<p>No interactions logged yet.</p></div>`;
    return;
  }
  const typeIcons = { call: ICONS.phone, email: ICONS.mail, meeting: ICONS.users, note: ICONS.edit };
  el.innerHTML = `<div class="activity-list">${data.map(i => `
    <div class="activity-item">
      <div class="activity-dot ${i.type}">${typeIcons[i.type] || ''}</div>
      <div class="activity-content">
        <div class="activity-subject">${escapeHtml(i.subject)} ${typeBadge(i.type)} ${channelBadge(i.direction || 'outbound')}</div>
        ${i.outcome ? `<div class="activity-notes">Outcome: ${escapeHtml(i.outcome)}</div>` : ''}
        ${i.notes ? `<div class="activity-notes">${escapeHtml(i.notes)}</div>` : ''}
        ${i.next_step ? `<div class="activity-notes">Next step: ${escapeHtml(i.next_step)}</div>` : ''}
        <div class="activity-date">${fmtDateTime(i.date)}</div>
      </div>
      <div class="activity-del"><button class="btn btn-danger btn-sm" onclick="deleteInteraction('${i.id}')" title="Delete">${ICONS.trash}</button></div>
    </div>`).join('')}</div>`;
}

function openIntModal() {
  setForm({
    iSubject: '', iNotes: '', iType: 'call', iDirection: 'outbound',
    iOutcome: '', iNextStep: '',
    iDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  });
  openModal('intModal');
}

async function saveInteraction() {
  const payload = {
    customer_id: CUST_ID,
    type: document.getElementById('iType').value,
    direction: document.getElementById('iDirection').value,
    subject: document.getElementById('iSubject').value.trim(),
    notes: document.getElementById('iNotes').value.trim() || null,
    outcome: document.getElementById('iOutcome').value.trim() || null,
    next_step: document.getElementById('iNextStep').value.trim() || null,
    date: document.getElementById('iDate').value || new Date().toISOString(),
  };
  if (!payload.subject) {
    toast('Subject is required', 'error');
    return;
  }
  const { error } = await db.from('interactions').insert([payload]);
  if (error) {
    toast('Failed to log interaction', 'error');
    return;
  }
  toast('Interaction logged!', 'success');
  closeModal('intModal');
  loadInteractions();
}

async function deleteInteraction(id) {
  const { error } = await db.from('interactions').delete().eq('id', id);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Interaction removed', 'success');
  loadInteractions();
}

async function loadDeals() {
  const { data, error } = await db.from('deals').select('*').eq('customer_id', CUST_ID).order('created_at', { ascending: false });
  const deals = data || [];
  document.getElementById('dealCount').textContent = `${deals.length} offer${deals.length !== 1 ? 's' : ''}`;
  const el = document.getElementById('dealList');
  if (error || !deals.length) {
    el.innerHTML = `<div class="empty-state">${ICONS.deals}<p>No offers yet.</p></div>`;
    return;
  }
  el.innerHTML = `
    <div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>Title</th><th>Stage</th><th>Value</th><th>MRR</th><th>Actions</th></tr></thead>
      <tbody>${deals.map(d => `
        <tr>
          <td><div class="td-name">${escapeHtml(d.title)}</div><div class="td-muted">${escapeHtml(d.offer_type || 'General service')}</div></td>
          <td>${stageBadge(d.stage)}</td>
          <td>${fmtEur(d.value)}</td>
          <td>${fmtEur(d.monthly_revenue)}</td>
          <td><div class="td-actions"><button class="btn btn-secondary btn-sm" onclick="openEditDealModal('${d.id}')">${ICONS.edit}</button><button class="btn btn-danger btn-sm" onclick="deleteDeal('${d.id}')">${ICONS.trash}</button></div></td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;
}

function openDealModal() {
  document.getElementById('dealModalTitle').textContent = 'Add Offer';
  setForm({
    dealEditId: '', dTitle: '', dOfferType: '', dValue: '',
    dStage: 'prospect', dSetupFee: '', dMonthlyRevenue: '',
    dExpectedCloseDate: '', dCloseReason: '', dScope: '', dDesc: '',
  });
  openModal('dealModal');
}

function openEditDealModal(id) {
  db.from('deals').select('*').eq('id', id).single().then(({ data }) => {
    if (!data) return;
    document.getElementById('dealModalTitle').textContent = 'Edit Offer';
    document.getElementById('dealEditId').value = data.id;
    document.getElementById('dTitle').value = data.title || '';
    document.getElementById('dOfferType').value = data.offer_type || '';
    document.getElementById('dValue').value = data.value || '';
    document.getElementById('dStage').value = data.stage || 'prospect';
    document.getElementById('dSetupFee').value = data.setup_fee || '';
    document.getElementById('dMonthlyRevenue').value = data.monthly_revenue || '';
    document.getElementById('dExpectedCloseDate').value = data.expected_close_date || '';
    document.getElementById('dCloseReason').value = data.close_reason || '';
    document.getElementById('dScope').value = data.service_scope || '';
    document.getElementById('dDesc').value = data.description || '';
    openModal('dealModal');
  });
}

async function saveDeal() {
  const editId = document.getElementById('dealEditId').value;
  const payload = {
    title: document.getElementById('dTitle').value.trim(),
    offer_type: document.getElementById('dOfferType').value.trim() || null,
    value: parseFloat(document.getElementById('dValue').value) || 0,
    stage: document.getElementById('dStage').value,
    setup_fee: parseFloat(document.getElementById('dSetupFee').value) || 0,
    monthly_revenue: parseFloat(document.getElementById('dMonthlyRevenue').value) || 0,
    expected_close_date: document.getElementById('dExpectedCloseDate').value || null,
    close_reason: document.getElementById('dCloseReason').value.trim() || null,
    service_scope: document.getElementById('dScope').value.trim() || null,
    description: document.getElementById('dDesc').value.trim() || null,
  };
  if (!payload.title) {
    toast('Offer title is required', 'error');
    return;
  }
  let error;
  if (editId) {
    ({ error } = await db.from('deals').update(payload).eq('id', editId));
  } else {
    ({ error } = await db.from('deals').insert([{ customer_id: CUST_ID, ...payload }]));
  }
  if (error) {
    toast('Save failed', 'error');
    return;
  }
  toast(editId ? 'Offer updated!' : 'Offer added!', 'success');
  closeModal('dealModal');
  loadDeals();
}

async function deleteDeal(id) {
  const { error } = await db.from('deals').delete().eq('id', id);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Offer removed', 'success');
  loadDeals();
}

async function loadTasks() {
  const { data, error } = await db.from('tasks').select('*').eq('customer_id', CUST_ID).order('due_date', { ascending: true, nullsFirst: false });
  const tasks = data || [];
  document.getElementById('taskCount').textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
  const el = document.getElementById('taskList');
  if (error || !tasks.length) {
    el.innerHTML = `<div class="empty-state">${ICONS.tasks}<p>No tasks yet.</p></div>`;
    return;
  }
  el.innerHTML = `
    <div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>Title</th><th>Type</th><th>Priority</th><th>Due</th><th>Actions</th></tr></thead>
      <tbody>${tasks.map(t => `
        <tr>
          <td><div class="td-name">${escapeHtml(t.title)}</div>${t.description ? `<div class="td-sub">${escapeHtml(t.description)}</div>` : ''}</td>
          <td>${typeBadge(t.task_type || 'general')}</td>
          <td>${priorityBadge(t.priority || 'medium')}</td>
          <td>${dueDateLabel(t.due_date)}</td>
          <td><div class="td-actions">${t.status !== 'done' ? `<button class="btn btn-success btn-sm" onclick="markDone('${t.id}')" title="Mark Done">${ICONS.check}</button>` : ''}<button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')" title="Delete">${ICONS.trash}</button></div></td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;
}

function openTaskModal() {
  setForm({
    tTitle: '', tDue: '', tStatus: 'pending', tType: 'sales',
    tPriority: 'medium', tAssignedTo: '', tDesc: '',
  });
  openModal('taskModal');
}

async function saveTask() {
  const payload = {
    customer_id: CUST_ID,
    title: document.getElementById('tTitle').value.trim(),
    due_date: document.getElementById('tDue').value || null,
    status: document.getElementById('tStatus').value,
    task_type: document.getElementById('tType').value,
    priority: document.getElementById('tPriority').value,
    assigned_to: document.getElementById('tAssignedTo').value.trim() || null,
    description: document.getElementById('tDesc').value.trim() || null,
  };
  if (!payload.title) {
    toast('Task title is required', 'error');
    return;
  }
  const { error } = await db.from('tasks').insert([payload]);
  if (error) {
    toast('Save failed', 'error');
    return;
  }
  toast('Task added!', 'success');
  closeModal('taskModal');
  loadTasks();
}

async function markDone(id) {
  const { error } = await db.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    toast('Update failed', 'error');
    return;
  }
  toast('Task marked as done!', 'success');
  loadTasks();
}

async function deleteTask(id) {
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Task removed', 'success');
  loadTasks();
}

async function loadLeads() {
  const { data, error } = await db.from('lead_submissions').select('*').eq('customer_id', CUST_ID).order('received_at', { ascending: false });
  const leads = data || [];
  document.getElementById('leadCount').textContent = `${leads.length} lead submission${leads.length !== 1 ? 's' : ''}`;
  const el = document.getElementById('leadList');
  if (error || !leads.length) {
    el.innerHTML = `<div class="empty-state">${ICONS.mail}<p>No linked lead submissions yet.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="activity-list">${leads.map(l => `
    <div class="activity-item">
      <div class="activity-dot email">${ICONS.mail}</div>
      <div class="activity-content">
        <div class="activity-subject">${escapeHtml(l.lead_name || l.business_name || 'Lead')} ${submissionBadge(l.submission_status || 'new')}</div>
        <div class="activity-notes">${escapeHtml(l.service_requested || 'General enquiry')} · ${urgencyBadge(l.urgency || 'normal')}</div>
        ${l.message ? `<div class="activity-notes">${escapeHtml(l.message)}</div>` : ''}
        <div class="activity-date">${fmtDateTime(l.received_at)}</div>
      </div>
    </div>`).join('')}</div>`;
}

loadProfile().then(() => initScrollAnimations());
