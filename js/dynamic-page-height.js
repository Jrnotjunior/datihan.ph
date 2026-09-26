(() => {
  const main = document.querySelector('main');
  if (!main) return;

  const key = `datihan-page-height:${window.location.pathname}`;
  const savedHeight = Number(sessionStorage.getItem(key));

  // Reserve the page's previous content height before global.js creates the footer.
  // This prevents the footer from visibly moving while dynamic content loads.
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    main.style.minHeight = `${savedHeight}px`;
  }

  window.addEventListener('pagehide', () => {
    sessionStorage.setItem(key, String(Math.max(main.scrollHeight, main.offsetHeight)));
  });

  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      const actualHeight = Math.max(main.scrollHeight, main.offsetHeight);
      if (actualHeight > savedHeight) {
        main.style.minHeight = `${actualHeight}px`;
      }
    });
  });
})();
