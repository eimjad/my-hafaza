/**
 * Hafaza - Memorization & Spaced Repetition Module
 * Implements SM-2 algorithm for optimal review scheduling
 */

const Memorization = (() => {
  /**
   * SM-2 Spaced Repetition Algorithm
   * Based on SuperMemo's algorithm for optimal memory retention
   *
   * @param {object} record - Current progress record
   * @param {number} quality - User rating (0-5):
   *   0 = complete blackout (forgot)
   *   3 = correct with difficulty (hard)
   *   4 = correct with hesitation (good)
   *   5 = perfect recall (easy)
   */
  function calculateNextReview(record, quality) {
    let { ease = 2.5, interval = 0, repetitions = 0 } = record;

    if (quality < 3) {
      // Failed recall - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Successful recall
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 3;
      } else {
        interval = Math.round(interval * ease);
      }
      repetitions++;
    }

    // Update ease factor
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ease = Math.max(1.3, ease); // Minimum ease of 1.3

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextReview = nextDate.toISOString().split('T')[0];

    return {
      ease: Math.round(ease * 100) / 100,
      interval,
      repetitions,
      nextReview,
      lastReview: new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Mark an ayah as memorized (starting the review cycle)
   */
  async function markMemorized(surah, ayah) {
    const id = `${surah}:${ayah}`;
    const existing = await HafazaDB.getProgress(surah, ayah);

    const record = {
      id,
      surah,
      ayah,
      status: 'memorized',
      ease: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: new Date().toISOString().split('T')[0],
      lastReview: new Date().toISOString().split('T')[0],
      dateMemorized: existing?.dateMemorized || new Date().toISOString().split('T')[0]
    };

    await HafazaDB.saveProgress(record);
    await HafazaDB.recordActivity();
    return record;
  }

  /**
   * Unmark an ayah (remove from memorized)
   */
  async function unmarkMemorized(surah, ayah) {
    const id = `${surah}:${ayah}`;
    const record = {
      id,
      surah,
      ayah,
      status: 'learning',
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: null,
      lastReview: null
    };
    await HafazaDB.saveProgress(record);
    return record;
  }

  /**
   * Process a review response
   * @param {string} id - The ayah id (surah:ayah)
   * @param {string} response - 'forgot' | 'hard' | 'good' | 'easy'
   */
  async function processReview(id, response) {
    const [surah, ayah] = id.split(':').map(Number);
    const record = await HafazaDB.getProgress(surah, ayah);
    if (!record) return null;

    const qualityMap = { forgot: 1, hard: 3, good: 4, easy: 5 };
    const quality = qualityMap[response] || 4;

    const updates = calculateNextReview(record, quality);
    const updated = { ...record, ...updates };

    await HafazaDB.saveProgress(updated);
    await HafazaDB.recordActivity();
    return updated;
  }

  /**
   * Get statistics
   */
  async function getStats() {
    const allProgress = await HafazaDB.getAllProgress();
    const memorized = allProgress.filter(p => p.status === 'memorized');
    const streak = await HafazaDB.getStreak();
    const dueReviews = await HafazaDB.getDueReviews();

    return {
      totalMemorized: memorized.length,
      totalAyahs: 6236,
      progressPercent: Math.round((memorized.length / 6236) * 100 * 10) / 10,
      streak,
      dueReviews: dueReviews.length,
      dueItems: dueReviews
    };
  }

  /**
   * Get surah-level progress (% memorized per surah)
   */
  async function getSurahStats(surahNum) {
    const progress = await HafazaDB.getSurahProgress(surahNum);
    const memorized = progress.filter(p => p.status === 'memorized');
    return {
      memorized: memorized.length,
      total: progress.length
    };
  }

  /**
   * Check if a specific ayah is memorized
   */
  async function isMemorized(surah, ayah) {
    const record = await HafazaDB.getProgress(surah, ayah);
    return record?.status === 'memorized';
  }

  return {
    markMemorized,
    unmarkMemorized,
    processReview,
    getStats,
    getSurahStats,
    isMemorized
  };
})();
