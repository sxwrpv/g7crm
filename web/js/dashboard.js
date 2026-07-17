document.getElementById('headerDate').textContent =
  new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

async function loadDashboard() {
  await Promise.all([
    loadStats(),
    loadRecentAccounts(),
    loadRecentLeads(),
    loadPipeline(),
    loadUpcomingTasks(),
  ]);
  initScrollAnimations();
}

async function loadStats() {
  try {
    const [custRes, dealRes, taskRes, leadRes] = await Promise.all([
      db.from('customers').select('id, record_type, onboarding_status', { count: 'exact' }),
      db.from('deals').select('id, value, stage, monthly_revenue'),
      db.from('tasks').select('id, due_date, status, priority').neq('status', 'done'),
      db.from('lead_submissions').select('id, submission_status, received_at', { count: 'exact' }),
    ]);

    const customers = custRes.data || [];
    const deals = dealRes.data || [];
    const tasks = taskRes.data || [];
    const leads = leadRes.data || [];

    const clients = customers.filter(c => c.record_type === 'client').length;
    const hotPipeline = deals.filter(d => !['closed-won', 'closed-lost'].includes(d.stage));
    const pipelineVal = hotPipeline.reduce((s, d) => s + parseFloat(d.value || 0), 0);
    const recurring = deals.filter(d => d.stage !== 'closed-lost').reduce((s, d) => s + parseFloat(d.monthly_revenue || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' || (t.due_date && t.due_date <= today)).length;
    const newLeads = leads.filter(l => l.submission_status === 'new').length;

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">${ICONS.users}</div>
        <div class="stat-label">Accounts</div>
        <div class="stat-value">${customers.length}</div>
        <div class="stat-sub">${clients} live clients</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">${ICONS.deals}</div>
        <div class="stat-label">Open Pipeline</div>
        <div class="stat-value">${fmtEur(pipelineVal)}</div>
        <div class="stat-sub">${hotPipeline.length} open offers</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">${ICONS.calendar}</div>
        <div class="stat-label">MRR Tracked</div>
        <div class="stat-value">${fmtEur(recurring)}</div>
        <div class="stat-sub">monthly revenue across offers</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">${ICONS.tasks}</div>
        <div class="stat-label">Lead + Task Pressure</div>
        <div class="stat-value">${newLeads + urgentTasks}</div>
        <div class="stat-sub">${newLeads} new leads · ${urgentTasks} urgent tasks</div>
      </div>
    `;
  } catch (e) {
    toast('Failed to load dashboard stats', 'error');
  }
}

async function loadRecentAccounts() {
  try {
    const { data, error } = await db
      .from('customers')
      .select('id, name, company, record_type, onboarding_status')
      .order('created_at', { ascending: false })
      .limit(5);

    const tbody = document.getElementById('recentCust');
    if (error || !data?.length) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><p>No accounts yet.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(c => `
      <tr>
        <td>
          <a class="td-link" href="profile.html?id=${c.id}">${escapeHtml(c.company || c.name)}</a>
          <div class="td-muted">${escapeHtml(c.name)}</div>
        </td>
        <td>${recordTypeBadge(c.record_type || 'lead')}</td>
        <td>${onboardingBadge(c.onboarding_status || 'not-started')}</td>
      </tr>`).join('');
  } catch (e) {
    toast('Failed to load recent accounts', 'error');
  }
}

async function loadRecentLeads() {
  try {
    const { data, error } = await db
      .from('lead_submissions')
      .select('id, business_name, lead_name, service_requested, urgency, submission_status, received_at')
      .order('received_at', { ascending: false })
      .limit(5);

    const el = document.getElementById('recentLeads');
    if (error || !data?.length) {
      el.innerHTML = `<div class="empty-state"><p>No lead submissions yet. When n8n starts writing into lead_submissions, they will appear here.</p></div>`;
      return;
    }

    el.innerHTML = data.map(lead => `
      <div class="activity-item">
        <div class="activity-dot note">${ICONS.mail}</div>
        <div class="activity-content">
          <div class="activity-subject">${escapeHtml(lead.business_name || lead.lead_name || 'Unknown lead')} ${submissionBadge(lead.submission_status)}</div>
          <div class="activity-notes">${escapeHtml(lead.service_requested || 'General enquiry')} · ${urgencyBadge(lead.urgency)}</div>
          <div class="activity-date">${fmtDateTime(lead.received_at)}</div>
        </div>
      </div>`).join('');
  } catch (e) {
    toast('Failed to load recent leads', 'error');
  }
}

async function loadPipeline() {
  try {
    const { data, error } = await db.from('deals').select('stage, value, monthly_revenue');
    const el = document.getElementById('pipelineSummary');
    if (error || !data?.length) {
      el.innerHTML = `<div class="empty-state"><p>No offers yet.</p></div>`;
      return;
    }

    const stages = ['prospect', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
    const colors = { prospect: '#8B8B94', proposal: '#5B5BD6', negotiation: '#D97B08', 'closed-won': '#2DA162', 'closed-lost': '#DC3D43' };
    const grouped = {};
    stages.forEach(s => grouped[s] = { count: 0, value: 0, monthly: 0 });

    data.forEach(d => {
      if (grouped[d.stage]) {
        grouped[d.stage].count += 1;
        grouped[d.stage].value += parseFloat(d.value || 0);
        grouped[d.stage].monthly += parseFloat(d.monthly_revenue || 0);
      }
    });

    el.innerHTML = stages.map(s => {
      const g = grouped[s];
      return `
        <div class="pipeline-row">
          <div class="pipeline-dot" style="background:${colors[s]};"></div>
          <div class="pipeline-stage">${labelize(s)}</div>
          <div class="pipeline-count">${g.count} item${g.count !== 1 ? 's' : ''}</div>
          <div class="pipeline-values">
            <div class="pipeline-value">${fmtEur(g.value)}</div>
            <div class="td-muted">MRR ${fmtEur(g.monthly)}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    toast('Failed to load pipeline summary', 'error');
  }
}

async function loadUpcomingTasks() {
  try {
    const { data, error } = await db
      .from('tasks')
      .select('id, title, due_date, status, priority, customers(name, company)')
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(6);

    const tbody = document.getElementById('upcomingTasks');
    if (error || !data?.length) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><p>No pending tasks.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(t => `
      <tr>
        <td>
          <div class="td-name">${escapeHtml(t.title)}</div>
          <div class="td-sub">${escapeHtml(t.customers?.company || t.customers?.name || '—')}</div>
        </td>
        <td>${priorityBadge(t.priority || 'medium')}</td>
        <td>${dueDateLabel(t.due_date)}</td>
      </tr>`).join('');
  } catch (e) {
    toast('Failed to load upcoming tasks', 'error');
  }
}

loadDashboard();
