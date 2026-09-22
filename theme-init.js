// Runs synchronously in <head> (before first paint) so the saved theme is
// applied without a flash. Kept as an external same-origin file so the CSP
// script-src does not need 'unsafe-inline'.
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    // Global safe error listener to prevent uncaught third-party script crashes
    window.addEventListener('error', function (e) {
      if (e.message && (e.message.includes('Script error') || e.message.includes('ResizeObserver'))) {
        console.warn('Caught non-fatal script warning:', e);
        return true;
      }
    });
    window.addEventListener('unhandledrejection', function (e) {
      console.warn('Caught unhandled promise warning:', e.reason);
    });
