/* Fix for the dynamically-created Website Customization page. */
(function () {
  function bind() {
    /* Dynamic pages need the same visibility behavior as the static pages. */
    if (!document.getElementById('vetsvan-page-visibility-fix')) {
      const style = document.createElement('style');
      style.id = 'vetsvan-page-visibility-fix';
      style.textContent = '.page:not(.active){display:none !important;} .page.active{display:block !important;}';
      document.head.appendChild(style);
    }

    const button = document.querySelector('.nav-item[data-page="customization"]');
    const page = document.getElementById('page-customization');
    if (!button || !page || button.dataset.customFixBound === '1') return;
    button.dataset.customFixBound = '1';

    button.addEventListener('click', function (event) {
      event.preventDefault();
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.toggle('active', p.id === 'page-customization');
      });
      document.querySelectorAll('.nav-item').forEach(function (item) {
        item.classList.toggle('active', item.dataset.page === 'customization');
      });
      const kicker = document.getElementById('pageKicker');
      const title = document.getElementById('pageTitle');
      if (kicker) kicker.textContent = 'WEBSITE';
      if (title) title.textContent = 'Website Customization';
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
