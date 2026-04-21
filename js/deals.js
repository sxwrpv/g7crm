document.getElementById('plusIcon').innerHTML = ICONS.plus;

const STAGES = [
  { key: 'prospect', label: 'Prospect' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'closed-won', label: 'Closed Won' },
  { key: 'closed-lost', label: 'Closed Lost' },
];

let allDeals = [];
let customers = [];
let deleteTargetId = null;

function toggleCustomerInput() {
  const sel = document.getElementById('dCustomer');
  const input = document.getElementById('dCustomerName');
  if (sel.value === '__new__') {
    input.style.display = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

async function resolveCustomerId() {
  const sel = document.getElementById('dCustomer');
  if (sel.value && sel.value !== '__new__') return sel.value;

  const accountName = document.getElementById('dCustomerName').value.trim();
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
    source_channel: 'manual-import',
  };

  const { data, error } = await db.from('customers').insert([payload]).select('id, name, company').single();
  if (error) throw error;
  customers.unshift(data);
  return data.id;
}

async function loadData() {
  const [dealRes, custRes] = await Promise.all([
    db.from('deals').select('*, customers(id, name, company)').order('created_at', { ascending: false }),
    db.from('customers').select('id, name, company').order('company'),
  ]);

  allDeals = dealRes.data || [];
  customers = custRes.data || [];

  const sel = document.getElementById('dCustomer');
  sel.innerHTML = '<option value="">— Select an account —</option>' +
    '<option value="__new__">— Enter account name —</option>' +
    customers.map(c => `<option value="${c.id}">${escapeHtml(c.company || c.name)}</option>`).join('');

  renderBoard();
}

function renderBoard() {
  const stageFilter = document.getElementById('stageFilter').value;
  const filtered = stageFilter ? allDeals.filter(d => d.stage === stageFilter) : allDeals;

  const openDeals = allDeals.filter(d => !['closed-won', 'closed-lost'].includes(d.stage));
  const total = openDeals.reduce((s, d) => s + parseFloat(d.value || 0), 0);
  const mrr = openDeals.reduce((s, d) => s + parseFloat(d.monthly_revenue || 0), 0);

  document.getElementById('dealsSubtitle').textContent = `${allDeals.length} offer${allDeals.length !== 1 ? 's' : ''} · ${openDeals.length} open`;
  document.getElementById('pipelineTotal').textContent = fmtEur(total);
  document.getElementById('pipelineMrr').textContent = fmtEur(mrr);

  const board = document.getElementById('kanbanBoard');
  if (stageFilter) {
    const stageName = STAGES.find(s => s.key === stageFilter)?.label || stageFilter;
    board.innerHTML = renderColumn(stageFilter, stageName, filtered);
    return;
  }

  board.innerHTML = STAGES.map(s => renderColumn(s.key, s.label, allDeals.filter(d => d.stage === s.key))).join('');
}

function renderColumn(stageKey, stageLabel, deals) {
  return `
  <div class="kanban-col" data-stage="${stageKey}">
    <div class="kanban-col-head">
      <span class="kanban-col-title">${stageLabel}</span>
      <span class="kanban-col-count">${deals.length}</span>
    </div>
    <div class="kanban-cards">
      ${deals.length === 0 ? `<div style="text-align:center;padding:20px 8px;font-size:12px;color:var(--text-muted);">No offers here</div>` : deals.map(renderCard).join('')}
    </div>
  </div>`;
}

function renderCard(d) {
  const accountName = escapeHtml(d.customers?.company || d.customers?.name || '—');
  const prevStage = getPrevStage(d.stage);
  const nextStage = getNextStage(d.stage);
  return `
  <div class="kanban-card">
    <div class="kanban-card-title">${escapeHtml(d.title)}</div>
    <div class="kanban-card-customer">${ICONS.users} ${accountName}</div>
    <div class="kanban-card-detail">${escapeHtml(d.offer_type || 'General service offer')}</div>
    <div class="kanban-card-value">${fmtEur(d.value)}</div>
    <div class="kanban-card-detail">Setup ${fmtEur(d.setup_fee)} · MRR ${fmtEur(d.monthly_revenue)}</div>
    ${d.expected_close_date ? `<div class="kanban-card-detail">Expected close ${fmtDate(d.expected_close_date)}</div>` : ''}
    <div class="kanban-card-actions">
      ${prevStage ? `<button class="btn btn-secondary btn-sm" onclick="moveStage('${d.id}','${prevStage}')">← Back</button>` : ''}
      ${nextStage ? `<button class="btn btn-primary btn-sm" onclick="moveStage('${d.id}','${nextStage}')">Next →</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="openEditDeal('${d.id}')">${ICONS.edit}</button>
      <button class="btn btn-danger btn-sm btn-delete" data-id="${d.id}" data-name="${escapeHtml(d.title)}">${ICONS.trash}</button>
    </div>
  </div>`;
}

function getPrevStage(stage) {
  const i = STAGES.findIndex(x => x.key === stage);
  return i > 0 ? STAGES[i - 1].key : null;
}

function getNextStage(stage) {
  const i = STAGES.findIndex(x => x.key === stage);
  return i < STAGES.length - 1 ? STAGES[i + 1].key : null;
}

async function moveStage(id, newStage) {
  const updates = { stage: newStage };
  if (newStage === 'closed-won') updates.won_at = new Date().toISOString();
  if (newStage === 'closed-lost') updates.lost_at = new Date().toISOString();

  const { error } = await db.from('deals').update(updates).eq('id', id);
  if (error) {
    toast('Failed to move offer', 'error');
    return;
  }
  const deal = allDeals.find(d => d.id === id);
  if (deal) deal.stage = newStage;
  toast(`Moved to ${labelize(newStage)}`, 'success');
  loadData();
}

function openAddDeal() {
  document.getElementById('dealModalTitle').textContent = 'Add Offer';
  setForm({
    dealId: '', dCustomer: '', dCustomerName: '', dTitle: '', dOfferType: '', dValue: '',
    dStage: 'prospect', dSetupFee: '', dMonthlyRevenue: '',
    dExpectedCloseDate: '', dCloseReason: '', dScope: '', dDesc: '',
  });
  document.getElementById('dCustomerName').style.display = 'none';
  openModal('dealModal');
}

function openEditDeal(id) {
  const d = allDeals.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dealModalTitle').textContent = 'Edit Offer';
  setForm({
    dealId: d.id, dCustomer: d.customer_id, dCustomerName: '', dTitle: d.title,
    dOfferType: d.offer_type, dValue: d.value, dStage: d.stage || 'prospect',
    dSetupFee: d.setup_fee, dMonthlyRevenue: d.monthly_revenue,
    dExpectedCloseDate: d.expected_close_date, dCloseReason: d.close_reason,
    dScope: d.service_scope, dDesc: d.description,
  });
  document.getElementById('dCustomerName').style.display = 'none';
  openModal('dealModal');
}

async function saveDeal() {
  const id = document.getElementById('dealId').value;
  const title = document.getElementById('dTitle').value.trim();
  const offerType = document.getElementById('dOfferType').value.trim();
  const value = parseFloat(document.getElementById('dValue').value) || 0;
  const stage = document.getElementById('dStage').value;
  const setupFee = parseFloat(document.getElementById('dSetupFee').value) || 0;
  const monthlyRevenue = parseFloat(document.getElementById('dMonthlyRevenue').value) || 0;
  const expectedCloseDate = document.getElementById('dExpectedCloseDate').value || null;
  const closeReason = document.getElementById('dCloseReason').value.trim();
  const scope = document.getElementById('dScope').value.trim();
  const desc = document.getElementById('dDesc').value.trim();

  let customerId;
  try {
    customerId = await resolveCustomerId();
  } catch (err) {
    toast('Could not create account: ' + err.message, 'error');
    return;
  }

  if (!customerId) {
    toast('Please select or enter an account', 'error');
    return;
  }
  if (!title) {
    toast('Offer title is required', 'error');
    return;
  }

  const payload = {
    customer_id: customerId,
    title,
    offer_type: offerType || null,
    value,
    stage,
    setup_fee: setupFee,
    monthly_revenue: monthlyRevenue,
    expected_close_date: expectedCloseDate,
    close_reason: closeReason || null,
    service_scope: scope || null,
    description: desc || null,
  };

  let error;
  if (id) {
    ({ error } = await db.from('deals').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('deals').insert([payload]));
  }

  if (error) {
    toast('Save failed: ' + error.message, 'error');
    return;
  }

  toast(id ? 'Offer updated!' : 'Offer added!', 'success');
  closeModal('dealModal');
  loadData();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  deleteTargetId = btn.dataset.id;
  document.getElementById('delDealName').textContent = btn.dataset.name;
  openModal('delModal');
});

async function confirmDelete() {
  if (!deleteTargetId) return;
  const { error } = await db.from('deals').delete().eq('id', deleteTargetId);
  if (error) {
    toast('Delete failed', 'error');
    return;
  }
  toast('Offer deleted', 'success');
  closeModal('delModal');
  deleteTargetId = null;
  loadData();
}

loadData().then(() => initScrollAnimations());
