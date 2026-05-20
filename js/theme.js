/**
 * Hafaza - Theme Module
 * Supports: auto (device default), dark, light, emerald, brown-gold
 */

const Theme = (() => {
  let currentTheme = 'auto';
  let mediaQuery = null;

  const themes = {
    dark: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-card': '#0f3460',
      '--text-primary': '#eaeaea',
      '--text-secondary': '#a8a8b3',
      '--accent': '#e94560',
      '--accent-light': '#ff6b6b',
      '--success': '#2ed573',
      '--warning': '#ffa502',
      '--danger': '#ff4757',
      '--gold': '#d4af37',
      '--border-subtle': 'rgba(255,255,255,0.05)',
      '--card-border': 'rgba(212, 175, 55, 0.2)',
      '--hover-bg': 'rgba(255,255,255,0.1)',
      '--scrollbar-thumb': 'rgba(255,255,255,0.2)'
    },
    light: {
      '--bg-primary': '#f5f5f7',
      '--bg-secondary': '#ffffff',
      '--bg-card': '#ffffff',
      '--text-primary': '#1a1a2e',
      '--text-secondary': '#6b7280',
      '--accent': '#e94560',
      '--accent-light': '#ff6b6b',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--danger': '#ef4444',
      '--gold': '#b8860b',
      '--border-subtle': 'rgba(0,0,0,0.08)',
      '--card-border': 'rgba(0,0,0,0.1)',
      '--hover-bg': 'rgba(0,0,0,0.05)',
      '--scrollbar-thumb': 'rgba(0,0,0,0.2)'
    },
    emerald: {
      '--bg-primary': '#0d1f17',
      '--bg-secondary': '#132e1f',
      '--bg-card': '#1a4028',
      '--text-primary': '#e8f5e9',
      '--text-secondary': '#a5d6a7',
      '--accent': '#00e676',
      '--accent-light': '#69f0ae',
      '--success': '#00e676',
      '--warning': '#ffab40',
      '--danger': '#ff5252',
      '--gold': '#00e676',
      '--border-subtle': 'rgba(0,230,118,0.1)',
      '--card-border': 'rgba(0,230,118,0.2)',
      '--hover-bg': 'rgba(0,230,118,0.1)',
      '--scrollbar-thumb': 'rgba(0,230,118,0.3)'
    },
    'brown-gold': {
      '--bg-primary': '#1c1410',
      '--bg-secondary': '#2a1f17',
      '--bg-card': '#3d2e22',
      '--text-primary': '#f5e6d3',
      '--text-secondary': '#c4a882',
      '--accent': '#d4a337',
      '--accent-light': '#f0c654',
      '--success': '#7cb342',
      '--warning': '#ffb300',
      '--danger': '#e64a19',
      '--gold': '#d4a337',
      '--border-subtle': 'rgba(212,163,55,0.1)',
      '--card-border': 'rgba(212,163,55,0.25)',
      '--hover-bg': 'rgba(212,163,55,0.1)',
      '--scrollbar-thumb': 'rgba(212,163,55,0.3)'
    }
  };

  /**
   * Initialize theme from saved setting or auto-detect
   */
  async function init() {
    const saved = await HafazaDB.getSetting('theme');
    currentTheme = saved || 'auto';

    // Setup media query listener for auto theme
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentTheme === 'auto') applyTheme();
    });

    applyTheme();
  }

  /**
   * Set theme and persist
   */
  async function setTheme(theme) {
    if (theme !== 'auto' && !themes[theme]) return;
    currentTheme = theme;
    await HafazaDB.setSetting('theme', theme);
    applyTheme();
  }

  /**
   * Get current theme name
   */
  function getTheme() {
    return currentTheme;
  }

  /**
   * Get the resolved theme (what's actually applied)
   */
  function getResolvedTheme() {
    if (currentTheme === 'auto') {
      return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
    }
    return currentTheme;
  }

  /**
   * Apply the current theme to CSS variables
   */
  function applyTheme() {
    const resolved = getResolvedTheme();
    const vars = themes[resolved];

    if (!vars) return;

    const root = document.documentElement;
    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value);
    }

    // Set data attribute for additional CSS targeting
    document.body.setAttribute('data-theme', resolved);

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = vars['--bg-secondary'];
    }
  }

  return {
    init,
    setTheme,
    getTheme,
    getResolvedTheme,
    applyTheme
  };
})();
