// ── Theme toggle — shared across all pages ─────────────────
(function () {
  const KEY = 'acervo_theme';

  function getTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || getTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply immediately to avoid flash
  applyTheme(getTheme());

  // Wire up button after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggle);
  });
})();
