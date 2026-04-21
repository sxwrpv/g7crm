document.getElementById('plusIcon').innerHTML = ICONS.plus;
document.getElementById('searchIcon').innerHTML = ICONS.search;

let allCustomers = [];
let deleteTargetId = null;

async function loadCustomers() {
  const { data, error } = await db
    .from('customers')
    .select(`
      id, name, email, phone, company, address, status, notes, created_at,
      record_type, account_stage, niche, website_url, service_area, whatsapp, source_channel,
      onboarding_status, preferred_alert_channel, alert_destination, next_action
    `)
    .order('created_at', { ascending: false });

  if (error) {
    toast('Failed to load accounts', 'error');
    return;
  }

  allCustomers = data || [];
  populateRecordTypeFilter();
  document.getElementById('custCount').textContent = `${allCustomers.length} account${allCustomers.length !== 1 ? 's' : ''} total`;
  renderTable(allCustomers);
}

function populateRecordTypeFilter() {
  const select = document.getElementById('recordTypeFilter');
  const types = [...new Set(allCustomers.map(c => c.record_type || 'lead'))].sort();
  select.innerHTML = '<option value="">All Record Types</option>' +
    types.map(type => `<option value="${type}">${labelize(type)}</option>`).join('');
}

function renderTable(rows) {
  const tbody = document.getElementById('custTable');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${ICONS.users}</svg><p>No accounts found. Add your first one.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => `
    <tr>
      <td>
        <a class="td-link" href="profile.html?id=${c.id}">${escapeHtml(c.company || c.name)}</a>
        <div class="td-muted">${escapeHtml(c.website_url || c.email)}</div>
      </td>
      <td>
        <div class="td-name">${escapeHtml(c.name)}</div>
        <div class="td-muted">${escapeHtml(c.phone || c.whatsapp || '—')}</div>
      </td>
      <td>${recordTypeBadge(c.record_type || 'lead')}</td>
      <td>${statusBadge(c.account_stage || 'new')}</td>
      <td>${c.niche ? escapeHtml(c.niche) : '<span class="td-muted">—</span>'}</td>
      <td>${onboardingBadge(c.onboarding_status || 'not-started')}</td>
      <td class="td-muted">${escapeHtml(c.next_action || '—')}</td>
      <td>
        <div class="td-actions">
          <a href="profile.html?id=${c.id}" class="btn btn-secondary btn-sm" title="View Profile">${ICONS.eye}</a>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${c.id}')" title="Edit">${ICONS.edit}</button>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${c.id}" data-name="${escapeHtml(c.company || c.name)}" title="Delete">${ICONS.trash}</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const recordType = document.getElementById('recordTypeFilter').value;
  const accountStage = document.getElementById('accountStageFilter').value;
  const onboarding = document.getElementById('onboardingFilter').value;

  const filtered = allCustomers.filter(c => {
    const haystack = [c.name, c.company, c.email, c.phone, c.niche, c.next_action].join(' ').toLowerCase();
    const matchQ = !q || haystack.includes(q);
    const matchStatus = !status || c.status === status;
    const matchType = !recordType || (c.record_type || 'lead') === recordType;
    const matchStage = !accountStage || (c.account_stage || 'new') === accountStage;
    const matchOnboarding = !onboarding || (c.onboarding_status || 'not-started') === onboarding;
    return matchQ && matchStatus && matchType && matchStage && matchOnboarding;
  });

  renderTable(filtered);
}

function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Account';
  setForm({
    custId: '', fName: '', fEmail: '', fPhone: '', fCompany: '', fAddress: '',
    fStatus: 'lead', fRecordType: 'lead', fAccountStage: 'new', fNiche: APP_CONFIG.defaultNiche,
    fWebsite: '', fServiceArea: '', fWhatsapp: '', fSourceChannel: 'manual-import',
    fOnboardingStatus: 'not-started', fPreferredAlertChannel: 'telegram',
    fAlertDestination: '', fNextAction: '', fNotes: '',
  });
  openModal('custModal');
}

function openEditModal(id) {
  const c = allCustomers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modalTitle').textContent = 'Edit Account';
  setForm({
    custId: c.id, fName: c.name, fEmail: c.email, fPhone: c.phone,
    fCompany: c.company, fAddress: c.address, fStatus: c.status || 'lead',
    fRecordType: c.record_type || 'lead', fAccountStage: c.account_stage || 'new', fNiche: c.niche,
    fWebsite: c.website_url, fServiceArea: c.service_area, fWhatsapp: c.whatsapp,
    fSourceChannel: c.source_channel || 'manual-import',
    fOnboardingStatus: c.onboarding_status || 'not-started',
    fPreferredAlertChannel: c.preferred_alert_channel || 'telegram',
    fAlertDestination: c.alert_destination, fNextAction: c.next_action, fNotes: c.notes,
  });
  openModal('custModal');
}

async function saveCustomer() {
  const id = document.getElementById('custId').value;
  const name = document.getElementById('fName').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const company = document.getElementById('fCompany').value.trim();
  const address = document.getElementById('fAddress').value.trim();
  const status = document.getElementById('fStatus').value;
  const notes = document.getElementById('fNotes').value.trim();
  const recordType = document.getElementById('fRecordType').value;
  const accountStage = document.getElementById('fAccountStage').value;
  const niche = document.getElementById('fNiche').value.trim();
  const websiteUrl = document.getElementById('fWebsite').value.trim();
  const serviceArea = document.getElementById('fServiceArea').value.trim();
  const whatsapp = document.getElementById('fWhatsapp').value.trim();
  const sourceChannel = document.getElementById('fSourceChannel').value;
  const onboardingStatus = document.getElementById('fOnboardingStatus').value;
  const preferredAlertChannel = document.getElementById('fPreferredAlertChannel').value;
  const alertDestination = document.getElementById('fAlertDestination').value.trim();
  const nextAction = document.getElementById('fNextAction').value.trim();

  if (!name || !email || !company) {
    toast('Contact name, business name, and email are required', 'error');
    return;
  }

  const payload = {
    name,
    email,
    phone: phone || null,
    company,
    address: address || null,
    status,
    notes: notes || null,
    record_type: recordType,
    account_stage: accountStage,
    niche: niche || null,
    website_url: websiteUrl || null,
    service_area: serviceArea || null,
    whatsapp: whatsapp || null,
    source_channel: sourceChannel || null,
    onboarding_status: onboardingStatus,
    preferred_alert_channel: preferredAlertChannel,
    alert_destination: alertDestination || null,
    next_action: nextAction || null,
    client_since: recordType === 'client' ? new Date().toISOString() : null,
  };

  let error;
  if (id) {
    ({ error } = await db.from('customers').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('customers').insert([payload]));
  }

  if (error) {
    toast(error.message.includes('unique') ? 'That email is already in use' : 'Save failed: ' + error.message, 'error');
    return;
  }

  toast(id ? 'Account updated!' : 'Account added!', 'success');
  closeModal('custModal');
  loadCustomers();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  deleteTargetId = btn.dataset.id;
  document.getElementById('delName').textContent = btn.dataset.name;
  openModal('delModal');
});

async function confirmDelete() {
  if (!deleteTargetId) return;
  const { error } = await db.from('customers').delete().eq('id', deleteTargetId);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Account deleted', 'success');
  closeModal('delModal');
  deleteTargetId = null;
  loadCustomers();
}

loadCustomers().then(() => initScrollAnimations());
