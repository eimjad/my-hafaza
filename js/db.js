/**
 * Hafaza - IndexedDB Storage Layer
 * Handles all persistent data: memorization progress, settings, review schedule
 */

const HafazaDB = (() => {
  const DB_NAME = 'hafaza';
  const DB_VERSION = 1;
  let db = null;

  /**
   * Initialize the database
   */
  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Store for memorized ayahs with review scheduling
        if (!database.objectStoreNames.contains('progress')) {
          const progressStore = database.createObjectStore('progress', { keyPath: 'id' });
          progressStore.createIndex('surah', 'surah', { unique: false });
          progressStore.createIndex('nextReview', 'nextReview', { unique: false });
          progressStore.createIndex('status', 'status', { unique: false });
        }

        // Store for app settings
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }

        // Store for daily activity (streak tracking)
        if (!database.objectStoreNames.contains('activity')) {
          const activityStore = database.createObjectStore('activity', { keyPath: 'date' });
          activityStore.createIndex('date', 'date', { unique: true });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };
    });
  }

  /**
   * Get a single progress record by surah:ayah id
   */
  function getProgress(surah, ayah) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const request = store.get(`${surah}:${ayah}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all progress records for a surah
   */
  function getSurahProgress(surahNum) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const index = store.index('surah');
      const request = index.getAll(surahNum);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all memorized ayahs
   */
  function getAllProgress() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save or update a progress record
   * @param {object} record - { id, surah, ayah, status, ease, interval, nextReview, repetitions, lastReview }
   */
  function saveProgress(record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readwrite');
      const store = tx.objectStore('progress');
      const request = store.put(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get ayahs due for review (nextReview <= today)
   */
  function getDueReviews() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const today = new Date().toISOString().split('T')[0];
      const results = [];

      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const record = cursor.value;
          if (record.status === 'memorized' && record.nextReview <= today) {
            results.push(record);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get/set a setting
   */
  function getSetting(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  function setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Record daily activity (for streak)
   */
  function recordActivity() {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const tx = db.transaction('activity', 'readwrite');
      const store = tx.objectStore('activity');
      const request = store.put({ date: today, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Calculate current streak
   */
  function getStreak() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('activity', 'readonly');
      const store = tx.objectStore('activity');
      const request = store.getAll();
      request.onsuccess = () => {
        const activities = request.result || [];
        if (activities.length === 0) { resolve(0); return; }

        const dates = activities.map(a => a.date).sort().reverse();
        const today = new Date().toISOString().split('T')[0];

        // Check if today or yesterday has activity
        if (dates[0] !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          if (dates[0] !== yesterday) { resolve(0); return; }
        }

        let streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          const diff = (prev - curr) / 86400000;
          if (diff === 1) {
            streak++;
          } else {
            break;
          }
        }
        resolve(streak);
      };
      request.onerror = () => reject(request.error);
    });
  }

  return {
    init,
    getProgress,
    getSurahProgress,
    getAllProgress,
    saveProgress,
    getDueReviews,
    getSetting,
    setSetting,
    recordActivity,
    getStreak
  };
})();
