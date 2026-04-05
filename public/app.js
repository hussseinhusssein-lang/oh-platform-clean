window.OH = {
  async api(url, options = {}) {
    const opts = { credentials: 'include', ...options };
    const headers = new Headers(opts.headers || {});
    if (!(opts.body instanceof FormData) && !headers.has('Content-Type') && opts.method && opts.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    opts.headers = headers;
    const res = await fetch(url, opts);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : { text: await res.text() };
    if (!res.ok) throw new Error(data.error || data.message || 'حدث خطأ غير متوقع.');
    return data;
  },

  async getMe() {
    try {
      const data = await this.api('/auth/me');
      return data.user || null;
    } catch {
      return null;
    }
  },

  async ensureAuth(redirect = '/login.html') {
    const me = await this.getMe();
    if (!me) {
      window.location.href = redirect;
      return null;
    }
    return me;
  },

  bindLogout(selector = '#logoutBtn') {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try { await this.api('/auth/logout', { method: 'POST' }); } catch {}
      window.location.href = '/login.html';
    });
  },

  revealAdmin() {
    const brand = document.querySelector('.brand');
    const hidden = document.getElementById('adminReveal');
    if (!brand || !hidden) return;
    let taps = 0;
    brand.addEventListener('click', () => {
      taps += 1;
      if (taps >= 5) hidden.classList.remove('hidden');
      setTimeout(() => { taps = 0; }, 2500);
    });
  },

  async wireStartButton(selector = '#startBtn') {
    const btn = document.querySelector(selector);
    if (!btn) return;
    const user = await this.getMe();
    if (user) {
      btn.href = ['owner', 'admin', 'helper'].includes(user.role) ? '/oh-control.html' : '/dashboard.html';
      btn.textContent = 'الدخول إلى حسابي';
    } else {
      btn.href = '/login.html';
      btn.textContent = 'ابدأ الآن';
    }
  },

  paymentMethodBadge(method) {
    const m = (method || '').toLowerCase();
    if (m.includes('cliq')) return 'CliQ';
    if (m.includes('zain')) return 'ZainCash';
    if (m.includes('orange')) return 'Orange Money';
    return method || '-';
  },

  statusLabel(status) {
    const map = {
      pending: 'قيد المراجعة',
      working: 'قيد التنفيذ',
      done: 'مكتمل',
      rejected: 'مرفوض',
      approved: 'معتمد'
    };
    return map[status] || status || '-';
  },

  formatDate(value) {
    try { return new Date(value).toLocaleString('ar-JO'); }
    catch { return value || '-'; }
  },

  toast(message, type = 'ok') {
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-title">${type === 'ok' ? 'تم بنجاح' : type === 'warn' ? 'تنبيه' : 'خطأ'}</div><div class="toast-text">${message}</div>`;
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 260);
    }, 2800);
  },

  async loadNotifications(target = '#notificationsList', compact = false) {
    const box = document.querySelector(target);
    if (!box) return;
    try {
      const data = await this.api('/api/notifications/mine');
      const list = data.notifications || [];
      box.innerHTML = list.map(n => `
        <div class="item ${n.readAt ? '' : 'item-unread'}">
          <strong>${n.title}</strong>
          <div class="small">${n.message}</div>
          <div class="small muted">${OH.formatDate(n.createdAt)}</div>
        </div>`).join('') || '<div class="item">لا توجد إشعارات.</div>';
      if (!compact) await this.api('/api/notifications/mark-read', { method: 'POST' });
    } catch {
      box.innerHTML = '<div class="item">تعذر تحميل الإشعارات.</div>';
    }
  }
};
