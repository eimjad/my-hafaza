/**
 * Hafaza - Internationalization Module
 * Supports: ms (Bahasa Melayu - default), en (English)
 * Arabic is always shown for Quranic verses (base layer)
 */

const I18n = (() => {
  let currentLang = 'ms';

  const translations = {
    ms: {
      'nav.home': 'Utama',
      'nav.review': 'Ulangkaji',
      'nav.voice': 'Tasmi\'',
      'stats.memorized': 'Ayat Dihafal',
      'stats.progress': 'Kemajuan',
      'stats.streak': 'Hari Berturut',
      'home.reviewToday': 'Ulangkaji Hari Ini',
      'home.noReviews': 'Tiada ulangkaji diperlukan',
      'home.startReview': 'Mula Ulangkaji',
      'home.surahs': 'Surah-surah',
      'home.reviewDue': '{count} ayat perlu diulangkaji',
      'surah.showTranslation': 'Tunjuk Terjemahan',
      'surah.ayah': 'Ayat',
      'surah.ayahs': 'ayat',
      'surah.memorized': 'Dihafal',
      'surah.memorize': 'Hafal',
      'review.title': 'Ulangkaji',
      'review.forgot': 'Lupa',
      'review.hard': 'Sukar',
      'review.good': 'Baik',
      'review.easy': 'Mudah',
      'review.noReviews': 'Tiada ulangkaji diperlukan hari ini',
      'voice.title': 'Tasmi\'',
      'voice.selectSurah': 'Pilih Surah',
      'voice.selectToStart': 'Pilih surah dan ayat untuk mula',
      'voice.modelNotLoaded': 'Model suara: Belum dimuat',
      'voice.loadModel': 'Muat Model',
      'voice.recording': 'Sedang merakam... Tekan untuk berhenti',
      'voice.processing': 'Sedang memproses...',
      'voice.ready': 'Sedia untuk merakam',
      'voice.excellent': 'Cemerlang! Padanan: {score}% ({correct}/{total} perkataan)',
      'voice.tryAgain': 'Cuba lagi. Padanan: {score}% ({correct}/{total} perkataan)',
      'voice.needsReview': 'Perlu ulangkaji. Padanan: {score}%',
      'settings.title': 'Tetapan',
      'settings.language': 'Bahasa',
      'settings.languageDesc': 'Pilih bahasa antara muka',
      'settings.theme': 'Tema',
      'settings.themeDesc': 'Pilih tema paparan',
      'settings.themeAuto': 'Automatik (Ikut Peranti)',
      'settings.themeDark': 'Gelap',
      'settings.themeLight': 'Cerah',
      'settings.themeEmerald': 'Zamrud Hijau',
      'settings.themeBrownGold': 'Coklat Emas',
      'settings.translation': 'Terjemahan',
      'settings.translationDesc': 'Tunjuk terjemahan semasa melihat ayat',
      'settings.showTranslation': 'Tunjuk terjemahan',
      'settings.about': 'Mengenai',
      'search.placeholder': 'Cari surah atau ayat...',
      'search.noResults': 'Tiada keputusan ditemui',
      'search.resultsCount': '{count} keputusan ditemui',
      'search.surah': 'Surah',
      'search.verse': 'Ayat'
    },
    en: {
      'nav.home': 'Home',
      'nav.review': 'Review',
      'nav.voice': 'Recite',
      'stats.memorized': 'Memorized',
      'stats.progress': 'Progress',
      'stats.streak': 'Day Streak',
      'home.reviewToday': 'Today\'s Review',
      'home.noReviews': 'No reviews required',
      'home.startReview': 'Start Review',
      'home.surahs': 'Surahs',
      'home.reviewDue': '{count} verses need review',
      'surah.showTranslation': 'Show Translation',
      'surah.ayah': 'Verse',
      'surah.ayahs': 'verses',
      'surah.memorized': 'Memorized',
      'surah.memorize': 'Memorize',
      'review.title': 'Review',
      'review.forgot': 'Forgot',
      'review.hard': 'Hard',
      'review.good': 'Good',
      'review.easy': 'Easy',
      'review.noReviews': 'No reviews needed today',
      'voice.title': 'Recite',
      'voice.selectSurah': 'Select Surah',
      'voice.selectToStart': 'Select surah and verses to begin',
      'voice.modelNotLoaded': 'Voice model: Not loaded',
      'voice.loadModel': 'Load Model',
      'voice.recording': 'Recording... Press to stop',
      'voice.processing': 'Processing...',
      'voice.ready': 'Ready to record',
      'voice.excellent': 'Excellent! Match: {score}% ({correct}/{total} words)',
      'voice.tryAgain': 'Try again. Match: {score}% ({correct}/{total} words)',
      'voice.needsReview': 'Needs review. Match: {score}%',
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.languageDesc': 'Select interface language',
      'settings.theme': 'Theme',
      'settings.themeDesc': 'Choose display theme',
      'settings.themeAuto': 'Automatic (Follow Device)',
      'settings.themeDark': 'Dark',
      'settings.themeLight': 'Light',
      'settings.themeEmerald': 'Emerald Green',
      'settings.themeBrownGold': 'Brown Gold',
      'settings.translation': 'Translation',
      'settings.translationDesc': 'Show translation when viewing verses',
      'settings.showTranslation': 'Show translation',
      'settings.about': 'About',
      'search.placeholder': 'Search surah or verse...',
      'search.noResults': 'No results found',
      'search.resultsCount': '{count} results found',
      'search.surah': 'Surah',
      'search.verse': 'Verse'
    }
  };

  /**
   * Initialize language from saved settings or default
   */
  async function init() {
    const saved = await HafazaDB.getSetting('language');
    currentLang = saved || 'ms';
    applyTranslations();
    updateSearchPlaceholder();
  }

  /**
   * Set language and persist
   */
  async function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    await HafazaDB.setSetting('language', lang);
    applyTranslations();
    updateSearchPlaceholder();
    // Update HTML lang attribute
    document.documentElement.lang = lang;
  }

  /**
   * Get current language
   */
  function getLang() {
    return currentLang;
  }

  /**
   * Get a translation string
   */
  function t(key, params = {}) {
    let str = translations[currentLang]?.[key] || translations['ms'][key] || key;
    // Replace placeholders like {count}, {score}
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
    return str;
  }

  /**
   * Apply translations to all elements with data-i18n attribute
   */
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (el.tagName === 'INPUT') {
        el.placeholder = text;
      } else if (el.tagName === 'OPTION') {
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });
  }

  /**
   * Update search placeholder specifically
   */
  function updateSearchPlaceholder() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.placeholder = t('search.placeholder');
    }
  }

  /**
   * Get surah name in current language
   */
  function getSurahName(surah) {
    if (currentLang === 'en') return surah.nameEN || surah.name;
    if (currentLang === 'ms') return surah.nameMS || surah.name;
    return surah.name;
  }

  return {
    init,
    setLanguage,
    getLang,
    t,
    getSurahName,
    applyTranslations
  };
})();
