/**
 * Hafaza - Deep Search Module
 * Searches across all surahs down to verse level
 * Indexes Arabic text (plain), surah names in all languages
 */

const Search = (() => {
  let searchIndex = null;
  let surahs = null;
  let debounceTimer = null;
  let isSearching = false;

  /**
   * Initialize search - load index
   */
  async function init() {
    surahs = QuranData.getAllSurahs();
  }

  /**
   * Lazy-load the search index (only when user starts searching)
   */
  async function ensureIndex() {
    if (searchIndex) return;
    try {
      const response = await fetch('data/search-index.json');
      searchIndex = await response.json();
    } catch (e) {
      console.error('Failed to load search index:', e);
      searchIndex = {};
    }
  }

  /**
   * Normalize text for searching (remove diacritics, lowercase)
   */
  function normalize(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      // Remove Arabic diacritics
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      // Normalize alef
      .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627')
      // Normalize teh marbuta
      .replace(/\u0629/g, '\u0647')
      // Normalize alef maksura
      .replace(/\u0649/g, '\u064A')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Perform search across surahs and verses
   * Returns results grouped by surah with matching verses
   */
  async function search(query) {
    if (!query || query.trim().length < 2) return [];

    await ensureIndex();

    const normalizedQuery = normalize(query);
    const results = [];
    const maxResults = 50;
    let count = 0;

    // First: Search surah names (all languages)
    for (const surah of surahs) {
      if (count >= maxResults) break;

      const nameMatch =
        normalize(surah.name).includes(normalizedQuery) ||
        normalize(surah.namePlain).includes(normalizedQuery) ||
        (surah.nameEN && surah.nameEN.toLowerCase().includes(normalizedQuery)) ||
        (surah.nameMS && surah.nameMS.toLowerCase().includes(normalizedQuery)) ||
        String(surah.number) === query.trim();

      if (nameMatch) {
        results.push({
          type: 'surah',
          surahNum: surah.number,
          surahName: surah.name,
          surahNameLocal: I18n.getSurahName(surah),
          ayahCount: surah.ayahCount
        });
        count++;
      }
    }

    // Second: Search verse content (Arabic plain text)
    if (searchIndex) {
      for (const [surahNum, ayahs] of Object.entries(searchIndex)) {
        if (count >= maxResults) break;

        const surahInfo = surahs.find(s => s.number === parseInt(surahNum));
        if (!surahInfo) continue;

        for (const ayah of ayahs) {
          if (count >= maxResults) break;

          const normalizedText = normalize(ayah.t);
          if (normalizedText.includes(normalizedQuery)) {
            results.push({
              type: 'ayah',
              surahNum: parseInt(surahNum),
              surahName: surahInfo.name,
              surahNameLocal: I18n.getSurahName(surahInfo),
              ayahNum: ayah.n,
              text: ayah.t,
              // Find highlight position
              matchStart: normalizedText.indexOf(normalizedQuery)
            });
            count++;
          }
        }
      }
    }

    return results;
  }

  /**
   * Setup search UI handlers
   */
  function setupUI(onNavigateToSurah, onNavigateToAyah) {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const resultsContainer = document.getElementById('search-results');

    if (!input) return;

    input.addEventListener('input', () => {
      const query = input.value.trim();

      clearBtn.classList.toggle('hidden', query.length === 0);

      if (debounceTimer) clearTimeout(debounceTimer);

      if (query.length < 2) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        if (isSearching) return;
        isSearching = true;

        const results = await search(query);
        renderResults(results, resultsContainer, onNavigateToSurah, onNavigateToAyah);

        isSearching = false;
      }, 300);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) {
        resultsContainer.classList.remove('hidden');
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      input.focus();
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        resultsContainer.classList.add('hidden');
      }
    });
  }

  /**
   * Render search results
   */
  function renderResults(results, container, onNavigateToSurah, onNavigateToAyah) {
    if (results.length === 0) {
      container.innerHTML = `<div class="search-empty">${I18n.t('search.noResults')}</div>`;
      container.classList.remove('hidden');
      return;
    }

    let html = `<div class="search-count">${I18n.t('search.resultsCount', { count: results.length })}</div>`;

    results.forEach(result => {
      if (result.type === 'surah') {
        html += `
          <div class="search-result-item search-result-surah" data-surah="${result.surahNum}">
            <div class="search-result-badge">${result.surahNum}</div>
            <div class="search-result-info">
              <div class="search-result-title">${result.surahName}</div>
              <div class="search-result-subtitle">${result.surahNameLocal} - ${result.ayahCount} ${I18n.t('surah.ayahs')}</div>
            </div>
          </div>
        `;
      } else {
        // Truncate text for display
        const displayText = result.text.length > 80
          ? result.text.substring(0, 80) + '...'
          : result.text;

        html += `
          <div class="search-result-item search-result-ayah" data-surah="${result.surahNum}" data-ayah="${result.ayahNum}">
            <div class="search-result-badge-small">${result.surahNum}:${result.ayahNum}</div>
            <div class="search-result-info">
              <div class="search-result-title arabic-text">${displayText}</div>
              <div class="search-result-subtitle">${result.surahNameLocal} - ${I18n.t('search.verse')} ${result.ayahNum}</div>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    container.classList.remove('hidden');

    // Attach click handlers
    container.querySelectorAll('.search-result-surah').forEach(el => {
      el.addEventListener('click', () => {
        const surahNum = parseInt(el.dataset.surah);
        container.classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').classList.add('hidden');
        onNavigateToSurah(surahNum);
      });
    });

    container.querySelectorAll('.search-result-ayah').forEach(el => {
      el.addEventListener('click', () => {
        const surahNum = parseInt(el.dataset.surah);
        const ayahNum = parseInt(el.dataset.ayah);
        container.classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').classList.add('hidden');
        onNavigateToAyah(surahNum, ayahNum);
      });
    });
  }

  /**
   * Close search results
   */
  function close() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');
  }

  return {
    init,
    search,
    setupUI,
    close
  };
})();
