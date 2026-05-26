(async function gateDashboard() {
  const { data: { session } } = await db.auth.getSession();

  db.auth.onAuthStateChange(async (event, newSession) => {
    if (event === 'SIGNED_IN' && newSession) {
      if (!isAllowed(newSession.user?.email)) {
        await db.auth.signOut();
        showOverlay('Email not authorised. Ask the admin to add it to allowedOperators.');
        return;
      }
      removeOverlay();
      mountSignOutPill(newSession.user.email);
    }
    if (event === 'SIGNED_OUT') {
      showOverlay();
    }
  });

  if (!session) {
    showOverlay();
    return;
  }

  if (!isAllowed(session.user?.email)) {
    await db.auth.signOut();
    showOverlay('Email not authorised. Ask the admin to add it to allowedOperators.');
    return;
  }

  mountSignOutPill(session.user.email);
})();

function isAllowed(email) {
  if (!email) return false;
  const list = (APP_CONFIG?.allowedOperators || []).map(e => e.toLowerCase());
  return list.length === 0 || list.includes(email.toLowerCase());
}

function showOverlay(errorMsg = '') {
  if (document.getElementById('g7-auth-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'g7-auth-overlay';
  overlay.innerHTML = `
    <style>
      #g7-auth-overlay {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        background: #fafafa; font-family: system-ui, -apple-system, sans-serif;
      }
      #g7-auth-overlay .card {
        max-width: 380px; width: 92%; padding: 32px;
        background: #fff; border: 1px solid #eee; border-radius: 14px;
        box-shadow: 0 12px 40px rgba(0,0,0,.06);
      }
      #g7-auth-overlay h2 { margin: 0 0 4px 0; font-size: 22px; }
      #g7-auth-overlay p  { margin: 0 0 20px 0; color: #666; font-size: 14px; }
      #g7-auth-overlay input {
        width: 100%; box-sizing: border-box; padding: 12px 14px;
        border: 1px solid #ddd; border-radius: 8px; font-size: 15px;
        margin-bottom: 10px;
      }
      #g7-auth-overlay button {
        width: 100%; padding: 12px; border: 0; border-radius: 8px;
        background: #111; color: #fff; font-size: 15px; cursor: pointer;
        margin-bottom: 8px;
      }
      #g7-auth-overlay button.secondary {
        background: #fff; color: #555; border: 1px solid #ddd;
      }
      #g7-auth-overlay button:disabled { opacity: .6; cursor: progress; }
      #g7-auth-overlay .msg { margin-top: 6px; color: #666; font-size: 13px; min-height: 18px; }
      #g7-auth-overlay .err { color: #c0392b; }
      #g7-auth-overlay .hint { font-size: 12px; color: #888; margin-top: 14px; text-align: center; }
    </style>
    <div class="card">
      <h2>G7CRM</h2>
      <p>Operator sign-in.</p>
      <input id="g7-auth-email" type="email" placeholder="you@g7systems.xyz" autocomplete="email" />
      <input id="g7-auth-password" type="password" placeholder="Password" autocomplete="current-password" />
      <button id="g7-auth-btn-password" type="button">Sign in</button>
      <button id="g7-auth-btn-magic" type="button" class="secondary">Send magic link instead</button>
      <div class="msg ${errorMsg ? 'err' : ''}" id="g7-auth-msg">${errorMsg || ''}</div>
      <div class="hint">Add a user in Supabase &rarr; Authentication &rarr; Users.</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const emailEl    = document.getElementById('g7-auth-email');
  const passEl     = document.getElementById('g7-auth-password');
  const msg        = document.getElementById('g7-auth-msg');
  const btnPass    = document.getElementById('g7-auth-btn-password');
  const btnMagic   = document.getElementById('g7-auth-btn-magic');

  function setMsg(text, isErr = false) {
    msg.classList.toggle('err', isErr);
    msg.textContent = text;
  }

  // Password submits on Enter from either field
  [emailEl, passEl].forEach(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnPass.click();
  }));

  btnPass.onclick = async () => {
    const email = emailEl.value.trim();
    const password = passEl.value;
    if (!email || !password) { setMsg('Enter email and password.', true); return; }
    btnPass.disabled = true; btnMagic.disabled = true;
    setMsg('Signing in…');
    const { error } = await db.auth.signInWithPassword({ email, password });
    btnPass.disabled = false; btnMagic.disabled = false;
    if (error) setMsg(error.message, true);
    // success path handled by onAuthStateChange above
  };

  btnMagic.onclick = async () => {
    const email = emailEl.value.trim();
    if (!email) { setMsg('Enter your email.', true); return; }
    btnPass.disabled = true; btnMagic.disabled = true;
    setMsg('Sending magic link…');
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    btnPass.disabled = false; btnMagic.disabled = false;
    if (error) setMsg(error.message, true);
    else setMsg('Check your inbox. Click the link to sign in.');
  };
}

function removeOverlay() {
  const el = document.getElementById('g7-auth-overlay');
  if (el) el.remove();
}

function mountSignOutPill(email) {
  if (document.getElementById('g7-signout-pill')) return;
  const pill = document.createElement('button');
  pill.id = 'g7-signout-pill';
  pill.type = 'button';
  pill.textContent = `Sign out · ${email}`;
  pill.style.cssText = `
    position: fixed; right: 16px; bottom: 16px; z-index: 9999;
    padding: 8px 14px; border-radius: 999px; border: 1px solid #ddd;
    background: #fff; color: #333; font-size: 12px; cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.06);
  `;
  pill.onclick = async () => { await db.auth.signOut(); };
  document.body.appendChild(pill);
}
