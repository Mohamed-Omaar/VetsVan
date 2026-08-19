(() => {
  const demo = new URLSearchParams(location.search).get('demo') === '1' || localStorage.getItem('vetsvan_demo') === '1';
  if (demo) return;
  const token = localStorage.getItem('vetsvan_token');
  if (!token) return;

  const pagePermissions = {
    dashboard: 'dashboard:read', bookings: 'bookings:read', services: 'services:read',
    experts: 'experts:read', partners: 'partnerships:read', content: 'content:read',
    media: 'media:read', messages: 'messages:read', seo: 'seo:read', settings: 'settings:read',
    admins: '__super_admin__', customization: 'customization:read'
  };

  const can = (permissions, required) => permissions.includes('*') || permissions.includes(required);
  const apply = (user, permissions) => {
    localStorage.setItem('vetsvan_user', JSON.stringify(user));
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const required = pagePermissions[item.dataset.page];
      if (required && !can(permissions, required)) {
        item.hidden = true;
        item.setAttribute('aria-hidden', 'true');
      }
    });
    document.querySelectorAll('.nav-label').forEach(label => {
      const next = label.nextElementSibling;
      if (next && next.hidden) {
        let el = next; let any = false;
        while (el && el.classList && !el.classList.contains('nav-label')) {
          if (el.classList.contains('nav-item') && !el.hidden) any = true;
          el = el.nextElementSibling;
        }
        if (!any) label.hidden = true;
      }
    });
    const profile = document.querySelector('.profile');
    if (profile) {
      const strong = profile.querySelector('strong');
      const small = profile.querySelector('small');
      if (strong) strong.textContent = user.name || 'Admin';
      if (small) small.textContent = user.role || 'Viewer';
    }
  };

  fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(async r => {
      if (r.status === 401) { localStorage.removeItem('vetsvan_token'); location.replace('/admin/login'); return null; }
      if (!r.ok) throw new Error('Unable to load permissions');
      return r.json();
    })
    .then(data => { if (data) apply(data.user, data.permissions || []); })
    .catch(err => console.error('RBAC:', err));
})();
