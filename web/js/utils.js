function toast(msg, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelize(value) {
  return String(value ?? '').replace(/-/g, ' ');
}

function badge(value, label = null) {
  const safe = String(value || 'unknown').replace(/\s+/g, '-').toLowerCase();
  return `<span class="badge badge-${safe}">${escapeHtml(label || labelize(value || 'unknown'))}</span>`;
}

function statusBadge(v)      { return badge(v); }
function stageBadge(v)       { return badge(v); }
function typeBadge(v)        { return badge(v); }
function taskBadge(v)        { return badge(v); }
function recordTypeBadge(v)  { return badge(v); }
function onboardingBadge(v)  { return badge(v); }
function deliveryBadge(v)    { return badge(v); }
function priorityBadge(v)    { return badge(v); }
function urgencyBadge(v)     { return badge(v); }
function submissionBadge(v)  { return badge(v); }
function channelBadge(v)     { return badge(v); }

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function fmtEur(v) {
  return '€' + Number(v || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function dueDateLabel(d) {
  if (!d) return '<span class="td-muted">No date</span>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  const diff = Math.round((due - today) / 86400000);
  const label = fmtDate(d);
  if (diff < 0) return `<span class="overdue">${label} (overdue)</span>`;
  if (diff === 0) return `<span class="due-today">${label} (today)</span>`;
  return label;
}

function nl2br(value) {
  return escapeHtml(value || '').replace(/\n/g, '<br>');
}

function textOrDash(value) {
  return value ? escapeHtml(value) : '—';
}

function sourceLabel(value) {
  return labelize(value || 'manual');
}

const NAV_ITEMS = [
  { id: 'nav-dash',  icon: 'dashboard', label: 'Overview' },
  { id: 'nav-cust',  icon: 'users',     label: 'Accounts' },
  { id: 'nav-deals', icon: 'deals',     label: 'Pipeline' },
  { id: 'nav-tasks', icon: 'tasks',     label: 'Delivery Ops' },
];

function buildNav() {
  NAV_ITEMS.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.innerHTML = `${ICONS[item.icon]} <span>${item.label}</span>`;
    }
  });
}

function initScrollAnimations() {
  const targets = document.querySelectorAll('.stat-card, .card, .profile-header, .kanban-col, .kanban-total-bar, .mini-card');
  const fresh = [...targets].filter(el => !el.classList.contains('fade-in'));
  fresh.forEach(el => el.classList.add('fade-in'));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    fresh.forEach(el => observer.observe(el));
  } else {
    fresh.forEach(el => el.classList.add('visible'));
  }
}

const PAGE_META = {
  'index':     { nav: 'nav-dash',  footer: 'Operator mode · CA2 webux upgraded for agency ops' },
  'customers': { nav: 'nav-cust',  footer: 'Accounts = prospects + clients + delivery readiness' },
  'deals':     { nav: 'nav-deals', footer: 'Pipeline = offers, setup fees, MRR, and close timing' },
  'tasks':     { nav: 'nav-tasks', footer: 'Execution = sales follow-up, onboarding, delivery, support' },
  'profile':   { nav: 'nav-cust',  footer: 'Account detail = communication + offers + tasks + lead intake' },
};

function detectCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('profile'))   return 'profile';
  if (path.includes('customers')) return 'customers';
  if (path.includes('deals'))     return 'deals';
  if (path.includes('tasks'))     return 'tasks';
  return 'index';
}

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentPage = detectCurrentPage();
  const meta = PAGE_META[currentPage] || PAGE_META['index'];
  const navLinks = [
    { key: 'index',     file: 'index.html',     id: 'nav-dash' },
    { key: 'customers', file: 'customers.html',  id: 'nav-cust' },
    { key: 'deals',     file: 'deals.html',      id: 'nav-deals' },
    { key: 'tasks',     file: 'tasks.html',      id: 'nav-tasks' },
  ];

  sidebar.innerHTML = `
    <div class="sidebar-logo"><h1>G7 Systems</h1><span>G7CRM</span></div>
    <nav class="sidebar-nav">
      <div class="nav-section">Main</div>
      ${navLinks.map(l => `<a href="${l.file}" class="nav-link${l.id === meta.nav ? ' active' : ''}" id="${l.id}"></a>`).join('\n      ')}
    </nav>
    <div class="sidebar-footer">${meta.footer}</div>`;

  buildNav();
}

function setForm(fields) {
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  setTimeout(initScrollAnimations, 100);
});

const ICONS = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`,
  deals: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>`,
  tasks: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/></svg>`,
  back: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>`,
  eye: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>`,
  building: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`,
};
