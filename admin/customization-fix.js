/* Fix: Website Customization is injected dynamically by app.js.
   This replaces the page switcher so dynamically-added pages are included. */
(function () {
  function install() {
    if (typeof window.showPage !== 'function') return;
    window.showPage = function (name) {
      const pages = [...document.querySelectorAll('.page')];
      const navItems = [...document.querySelectorAll('.nav-item')];
      pages.forEach(p => p.classList.toggle('active', p.id === `page-${name}`));
      navItems.forEach(n => n.classList.toggle('active', n.dataset.page === name));
      const meta = (window.pageNames && window.pageNames[name]) ||
        ({ customization: ['WEBSITE', 'Website Customization'] }[name] || ['OVERVIEW', 'Dashboard']);
      const kicker = document.getElementById('pageKicker');
      const title = document.getElementById('pageTitle');
      if (kicker) kicker.textContent = meta[0];
      if (title) title.textContent = meta[1];
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
      if (name === 'dashboard' && typeof window.loadDashboard === 'function') window.loadDashboard();
      if (name === 'bookings' && typeof window.loadBookings === 'function') window.loadBookings();
      if (name === 'services' && typeof window.loadServices === 'function') window.loadServices();
      if (name === 'messages' && typeof window.loadMessages === 'function') window.loadMessages();
    };

    const customization = document.querySelector('[data-page="customization"]');
    if (customization && !customization.dataset.fixBound) {
      customization.dataset.fixBound = '1';
      customization.addEventListener('click', function (event) {
        event.preventDefault();
        window.showPage('customization');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
