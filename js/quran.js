/**
 * Hafaza - Quran Data Module
 * Loads and provides access to Quran text data
 */

const QuranData = (() => {
  let surahs = null;
  let loadedSurahs = {}; // Cache loaded surah data
  let fullQuran = null;

  /**
   * Load the surah index
   */
  async function loadIndex() {
    if (surahs) return surahs;

    const response = await fetch('data/surahs.json');
    surahs = await response.json();
    return surahs;
  }

  /**
   * Load a specific surah's ayahs
   */
  async function loadSurah(surahNum) {
    if (loadedSurahs[surahNum]) return loadedSurahs[surahNum];

    const filename = `data/surah_${String(surahNum).padStart(3, '0')}.json`;
    const response = await fetch(filename);
    const ayahs = await response.json();
    loadedSurahs[surahNum] = ayahs;
    return ayahs;
  }

  /**
   * Load the full Quran data (for offline caching)
   */
  async function loadFull() {
    if (fullQuran) return fullQuran;

    const response = await fetch('data/quran-full.json');
    fullQuran = await response.json();

    // Populate loaded surahs cache
    for (const [num, ayahs] of Object.entries(fullQuran)) {
      loadedSurahs[parseInt(num)] = ayahs;
    }

    return fullQuran;
  }

  /**
   * Get a specific ayah
   */
  async function getAyah(surahNum, ayahNum) {
    const ayahs = await loadSurah(surahNum);
    return ayahs.find(a => a.number === ayahNum) || null;
  }

  /**
   * Get surah info
   */
  function getSurahInfo(surahNum) {
    if (!surahs) return null;
    return surahs.find(s => s.number === surahNum) || null;
  }

  /**
   * Get all surah info
   */
  function getAllSurahs() {
    return surahs || [];
  }

  /**
   * Normalize Arabic text for comparison
   * Removes diacritics (tashkeel) and normalizes characters
   */
  function normalizeArabic(text) {
    if (!text) return '';

    return text
      // Remove tashkeel (diacritical marks)
      .replace(/[\u064B-\u065F\u0670]/g, '')
      // Remove tatweel
      .replace(/\u0640/g, '')
      // Normalize alef variations to bare alef
      .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627')
      // Normalize teh marbuta to heh
      .replace(/\u0629/g, '\u0647')
      // Normalize alef maksura to yeh
      .replace(/\u0649/g, '\u064A')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Compare two Arabic texts and return word-by-word comparison
   * Returns { score, words[] } where each word has { text, status: 'correct'|'incorrect'|'missing' }
   */
  function compareTexts(original, recited) {
    const origWords = normalizeArabic(original).split(' ');
    const recWords = normalizeArabic(recited).split(' ');

    const results = [];
    let correct = 0;

    // Simple word-by-word comparison with tolerance
    const maxLen = Math.max(origWords.length, recWords.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < origWords.length && i < recWords.length) {
        const similarity = wordSimilarity(origWords[i], recWords[i]);
        if (similarity >= 0.7) {
          results.push({ text: origWords[i], status: 'correct' });
          correct++;
        } else {
          results.push({ text: origWords[i], status: 'incorrect', recited: recWords[i] });
        }
      } else if (i < origWords.length) {
        results.push({ text: origWords[i], status: 'missing' });
      }
    }

    const score = origWords.length > 0 ? (correct / origWords.length) * 100 : 0;

    return { score: Math.round(score), words: results, totalWords: origWords.length, correctWords: correct };
  }

  /**
   * Calculate similarity between two words (0-1)
   * Uses Levenshtein distance ratio
   */
  function wordSimilarity(word1, word2) {
    if (word1 === word2) return 1;
    if (!word1 || !word2) return 0;

    const len1 = word1.length;
    const len2 = word2.length;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = word1[i - 1] === word2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
  }

  return {
    loadIndex,
    loadSurah,
    loadFull,
    getAyah,
    getSurahInfo,
    getAllSurahs,
    normalizeArabic,
    compareTexts
  };
})();
