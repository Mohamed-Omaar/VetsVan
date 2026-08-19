/* Robust navigation fix for the dynamically-created Website Customization page. */
(function () {
  function bind() {
    if (!document.getElementById('vetsvan-page-visibility-fix')) {
      const style = document.createElement('style');
      style.id = 'vetsvan-page-visibility-fix';
      style.textContent = '.page:not(.active){display:none !important;} .page.active{display:block !important;}';
      document.head.appendChild(style);
    }

    /* app.js originally cached the .page NodeList before creating
       #page-customization. Always query the DOM live instead. */
    window.showPage = function (name) {
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.toggle('active', p.id === 'page-' + name);
      });
      document.querySelectorAll('.nav-item').forEach(function (item) {
        item.classList.toggle('active', item.dataset.page === name);
      });
      const meta = {
        dashboard: ['OVERVIEW', 'Dashboard'],
        bookings: ['MANAGEMENT', 'Bookings'],
        services: ['MANAGEMENT', 'Services'],
        experts: ['MANAGEMENT', 'Experts'],
        partners: ['MANAGEMENT', 'Partnerships'],
        content: ['WEBSITE', 'Website Content'],
        media: ['WEBSITE', 'Media Library'],
        messages: ['INBOX', 'Contact Messages'],
        seo: ['SYSTEM', 'SEO & Languages'],
        settings: ['SYSTEM', 'Settings'],
        admins: ['SYSTEM', 'Admin Users'],
        customization: ['WEBSITE', 'Website Customization']
      }[name] || ['OVERVIEW', 'Dashboard'];
      const kicker = document.getElementById('pageKicker');
      const title = document.getElementById('pageTitle');
      if (kicker) kicker.textContent = meta[0];
      if (title) title.textContent = meta[1];
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (name === 'dashboard' && typeof loadDashboard === 'function') loadDashboard();
      if (name === 'bookings' && typeof loadBookings === 'function') loadBookings();
      if (name === 'services' && typeof loadServices === 'function') loadServices();
      if (name === 'messages' && typeof loadMessages === 'function') loadMessages();
    };

    /* Remove the extra WEBSITE heading inserted by the old customization code. */
    document.querySelectorAll('.nav-label').forEach(function (label) {
      if (label.textContent.trim() === 'WEBSITE' && label.nextElementSibling?.dataset?.page === 'customization') {
        label.remove();
      }
    });

    /* Rebind all sidebar/page navigation to the live showPage function. */
    document.querySelectorAll('.nav-item[data-page], [data-page]:not(.nav-item)').forEach(function (el) {
      if (el.dataset.navigationFixBound === '1') return;
      el.dataset.navigationFixBound = '1';
      el.addEventListener('click', function (event) {
        event.preventDefault();
        const name = el.dataset.page;
        if (name) window.showPage(name);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
