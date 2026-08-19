/* VETS VAN Admin Dashboard UI fix: keep dynamic pages in the same navigation lifecycle. */
(function () {
  function cleanupDuplicateWebsiteLabels() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    const labels = Array.from(nav.querySelectorAll('.nav-label'));
    const websiteLabels = labels.filter(el => el.textContent.trim().toUpperCase() === 'WEBSITE');
    // The customization module can add a label even when the static sidebar already has one.
    // Keep the first label and remove only adjacent/duplicate Website labels.
    websiteLabels.slice(1).forEach(el => {
      const prev = el.previousElementSibling;
      if (prev && (prev.classList.contains('nav-label') || prev.dataset.page === 'customization')) el.remove();
    });
  }

  function showOnlyPage(name) {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === `page-${name}`);
    });
    document.querySelectorAll('.nav-item').forEach(item => {
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
  }

  function bind() {
    if (!document.getElementById('vetsvan-page-visibility-fix')) {
      const style = document.createElement('style');
      style.id = 'vetsvan-page-visibility-fix';
      style.textContent = '.page:not(.active){display:none !important}.page.active{display:block !important}';
      document.head.appendChild(style);
    }

    cleanupDuplicateWebsiteLabels();

    // Event delegation means pages added later (Customization) behave exactly like static pages.
    const nav = document.querySelector('.sidebar nav');
    if (nav && nav.dataset.dynamicNavigationBound !== '1') {
      nav.dataset.dynamicNavigationBound = '1';
      nav.addEventListener('click', function (event) {
        const item = event.target.closest('.nav-item[data-page]');
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        showOnlyPage(item.dataset.page);
      }, true);
    }

    // Also handle internal buttons/links with data-page without allowing an old page snapshot
    // to leave dynamically-created pages visible.
    document.addEventListener('click', function (event) {
      const item = event.target.closest('[data-page]');
      if (!item || item.classList.contains('nav-item')) return;
      showOnlyPage(item.dataset.page);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
