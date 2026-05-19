/**
 * Hafaza - Main Application Controller
 * Manages screens, navigation, and user interactions
 */

const App = (() => {
  let currentScreen = 'loading';
  let currentSurah = null;
  let currentAyahScroll = null;
  let reviewQueue = [];
  let reviewIndex = 0;
  let showTranslation = true;

  /**
   * Initialize the app
   */
  async function init() {
    try {
      // Initialize database
      await HafazaDB.init();

      // Load Quran index
      await QuranData.loadIndex();

      // Initialize i18n
      await I18n.init();

      // Initialize theme
      await Theme.init();

      // Load translation preference
      const savedTranslation = await HafazaDB.getSetting('showTranslation');
      showTranslation = savedTranslation !== false;

      // Pre-load full Quran for offline use
      await QuranData.loadFull();

      // Initialize search
      await Search.init();

      // Setup all UI
      setupNavigation();
      setupSettings();
      setupVoiceScreen();
      setupSearch();

      // Show home screen
      await showHome();

      // Register service worker
      registerServiceWorker();
    } catch (error) {
      console.error('App initialization failed:', error);
      const loadingText = document.querySelector('.loading-text');
      if (loadingText) loadingText.textContent = I18n.t('error.loading') || 'Error loading...';
    }
  }

  /**
   * Register service worker for offline support
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        console.log('Service Worker registered:', reg.scope);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // New SW activated - content updated automatically via network-first
              console.log('New service worker activated - app updated');
            }
          });
        });
      }).catch((err) => {
        console.log('Service Worker registration failed:', err);
      });
    }
  }

  /**
   * Setup navigation handlers
   */
  function setupNavigation() {
    // Bottom nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        if (screen) navigateTo(screen);
      });
    });

    // Back buttons
    document.getElementById('surah-back-btn')?.addEventListener('click', () => navigateTo('home'));
    document.getElementById('review-back-btn')?.addEventListener('click', () => navigateTo('home'));
    document.getElementById('voice-back-btn')?.addEventListener('click', () => navigateTo('home'));
    document.getElementById('settings-back-btn')?.addEventListener('click', () => navigateTo('home'));

    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', () => navigateTo('settings'));

    // Review buttons
    document.getElementById('review-forgot')?.addEventListener('click', () => handleReview('forgot'));
    document.getElementById('review-hard')?.addEventListener('click', () => handleReview('hard'));
    document.getElementById('review-good')?.addEventListener('click', () => handleReview('good'));
    document.getElementById('review-easy')?.addEventListener('click', () => handleReview('easy'));

    // Start review from home
    document.getElementById('start-review-btn')?.addEventListener('click', () => navigateTo('review'));

    // Translation toggle in surah view
    document.getElementById('toggle-translation')?.addEventListener('change', (e) => {
      showTranslation = e.target.checked;
      HafazaDB.setSetting('showTranslation', showTranslation);
      if (currentSurah) showSurah(currentSurah);
    });
  }

  /**
   * Setup search
   */
  function setupSearch() {
    Search.setupUI(
      // onNavigateToSurah
      (surahNum) => {
        currentSurah = surahNum;
        navigateTo('surah');
      },
      // onNavigateToAyah
      (surahNum, ayahNum) => {
        currentSurah = surahNum;
        currentAyahScroll = ayahNum;
        navigateTo('surah');
      }
    );
  }

  /**
   * Setup settings screen
   */
  function setupSettings() {
    // Language radio buttons
    document.querySelectorAll('input[name="language"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        await I18n.setLanguage(e.target.value);
        // Re-render current screen content
        if (currentScreen === 'settings') {
          // Update settings labels
        }
      });
    });

    // Theme radio buttons
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        await Theme.setTheme(e.target.value);
      });
    });

    // Translation toggle in settings
    document.getElementById('settings-show-translation')?.addEventListener('change', (e) => {
      showTranslation = e.target.checked;
      HafazaDB.setSetting('showTranslation', showTranslation);
      // Also sync the surah view toggle
      const surahToggle = document.getElementById('toggle-translation');
      if (surahToggle) surahToggle.checked = showTranslation;
    });
  }

  /**
   * Navigate to a screen
   */
  async function navigateTo(screen) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    // Close search
    Search.close();

    switch (screen) {
      case 'home':
        await showHome();
        break;
      case 'review':
        await showReview();
        break;
      case 'voice':
        showVoice();
        break;
      case 'surah':
        await showSurah(currentSurah);
        break;
      case 'settings':
        showSettings();
        break;
    }

    currentScreen = screen;
  }

  /**
   * Show home screen with stats and surah list
   */
  async function showHome() {
    const stats = await Memorization.getStats();

    // Update stats
    document.getElementById('stat-memorized').textContent = stats.totalMemorized;
    document.getElementById('stat-progress').textContent = stats.progressPercent + '%';
    document.getElementById('stat-streak').textContent = stats.streak;

    // Update review card
    const reviewDue = document.getElementById('review-due');
    const startBtn = document.getElementById('start-review-btn');
    if (stats.dueReviews > 0) {
      reviewDue.querySelector('.review-count').textContent = I18n.t('home.reviewDue', { count: stats.dueReviews });
      startBtn.style.display = 'inline-block';
    } else {
      reviewDue.querySelector('.review-count').textContent = I18n.t('home.noReviews');
      startBtn.style.display = 'none';
    }

    // Render surah list
    await renderSurahList();

    document.getElementById('home-screen').classList.add('active');
  }

  /**
   * Render the surah list with progress
   */
  async function renderSurahList() {
    const surahs = QuranData.getAllSurahs();
    const container = document.getElementById('surah-list');

    // Get all progress for percentage calculations
    const allProgress = await HafazaDB.getAllProgress();
    const progressMap = {};
    allProgress.forEach(p => {
      if (p.status === 'memorized') {
        if (!progressMap[p.surah]) progressMap[p.surah] = 0;
        progressMap[p.surah]++;
      }
    });

    let html = '';
    surahs.forEach(surah => {
      const memorized = progressMap[surah.number] || 0;
      const percent = surah.ayahCount > 0 ? Math.round((memorized / surah.ayahCount) * 100) : 0;
      const localName = I18n.getSurahName(surah);

      html += `
        <div class="surah-item" data-surah="${surah.number}">
          <div class="surah-number">${surah.number}</div>
          <div class="surah-info-block">
            <div class="surah-name">${surah.name}</div>
            <div class="surah-name-local">${localName}</div>
          </div>
          <div class="surah-meta">
            <div class="surah-ayah-count">${surah.ayahCount} ${I18n.t('surah.ayahs')}</div>
            <div class="surah-progress">
              <div class="surah-progress-bar" style="width: ${percent}%"></div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('.surah-item').forEach(item => {
      item.addEventListener('click', () => {
        currentSurah = parseInt(item.dataset.surah);
        currentAyahScroll = null;
        navigateTo('surah');
      });
    });
  }

  /**
   * Show a surah's ayahs
   */
  async function showSurah(surahNum) {
    const surahInfo = QuranData.getSurahInfo(surahNum);
    const ayahs = await QuranData.loadSurah(surahNum);
    const progress = await HafazaDB.getSurahProgress(surahNum);

    // Build a set of memorized ayah numbers
    const memorizedSet = new Set(
      progress.filter(p => p.status === 'memorized').map(p => p.ayah)
    );

    // Update header
    document.getElementById('surah-title').textContent = surahInfo.name;
    const localName = I18n.getSurahName(surahInfo);
    document.getElementById('surah-info').textContent = `${localName} - ${surahInfo.ayahCount} ${I18n.t('surah.ayahs')}`;

    // Sync translation toggle
    const toggle = document.getElementById('toggle-translation');
    if (toggle) toggle.checked = showTranslation;

    // Render ayahs
    const container = document.getElementById('ayah-list');
    let html = '';

    ayahs.forEach(ayah => {
      const isMemorized = memorizedSet.has(ayah.number);
      html += `
        <div class="ayah-item ${isMemorized ? 'memorized' : ''}" data-ayah="${ayah.number}" id="ayah-${ayah.number}">
          <p class="ayah-text arabic-text">${ayah.text} <span class="ayah-end-mark">﴿${ayah.number}﴾</span></p>
          ${showTranslation ? `<p class="ayah-translation">${ayah.textPlain}</p>` : ''}
          <div class="ayah-meta">
            <span class="ayah-number-badge">${I18n.t('surah.ayah')} ${ayah.number}</span>
            <div class="ayah-actions">
              <button class="ayah-btn ${isMemorized ? 'memorized-btn' : ''}" data-action="memorize" data-surah="${surahNum}" data-ayah="${ayah.number}">
                ${isMemorized ? '&#10003; ' + I18n.t('surah.memorized') : I18n.t('surah.memorize')}
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach memorize button handlers
    container.querySelectorAll('[data-action="memorize"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const surah = parseInt(btn.dataset.surah);
        const ayah = parseInt(btn.dataset.ayah);
        const isCurrentlyMemorized = btn.classList.contains('memorized-btn');

        if (isCurrentlyMemorized) {
          await Memorization.unmarkMemorized(surah, ayah);
          btn.classList.remove('memorized-btn');
          btn.innerHTML = I18n.t('surah.memorize');
          btn.closest('.ayah-item').classList.remove('memorized');
        } else {
          await Memorization.markMemorized(surah, ayah);
          btn.classList.add('memorized-btn');
          btn.innerHTML = '&#10003; ' + I18n.t('surah.memorized');
          btn.closest('.ayah-item').classList.add('memorized');
        }
      });
    });

    document.getElementById('surah-screen').classList.add('active');

    // Scroll to specific ayah if set
    if (currentAyahScroll) {
      setTimeout(() => {
        const ayahEl = document.getElementById(`ayah-${currentAyahScroll}`);
        if (ayahEl) {
          ayahEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          ayahEl.classList.add('highlighted');
          setTimeout(() => ayahEl.classList.remove('highlighted'), 2000);
        }
        currentAyahScroll = null;
      }, 100);
    }
  }

  /**
   * Show review screen
   */
  async function showReview() {
    const stats = await Memorization.getStats();
    reviewQueue = stats.dueItems;
    reviewIndex = 0;

    if (reviewQueue.length === 0) {
      document.getElementById('review-ayah-card').style.display = 'none';
      document.querySelector('.review-actions').style.display = 'none';
      document.getElementById('review-empty').style.display = 'block';
    } else {
      document.getElementById('review-ayah-card').style.display = 'flex';
      document.querySelector('.review-actions').style.display = 'flex';
      document.getElementById('review-empty').style.display = 'none';
      showReviewCard();
    }

    document.getElementById('review-screen').classList.add('active');
  }

  /**
   * Show current review card
   */
  async function showReviewCard() {
    if (reviewIndex >= reviewQueue.length) {
      document.getElementById('review-ayah-card').style.display = 'none';
      document.querySelector('.review-actions').style.display = 'none';
      document.getElementById('review-empty').style.display = 'block';
      return;
    }

    const item = reviewQueue[reviewIndex];
    const ayah = await QuranData.getAyah(item.surah, item.ayah);
    const surahInfo = QuranData.getSurahInfo(item.surah);

    document.getElementById('review-surah-name').textContent = surahInfo ? `${surahInfo.name} - ${I18n.getSurahName(surahInfo)}` : '';
    document.getElementById('review-ayah-text').textContent = ayah?.text || '';
    document.getElementById('review-ayah-number').textContent = `${I18n.t('surah.ayah')} ${item.ayah}`;
  }

  /**
   * Handle review response
   */
  async function handleReview(response) {
    if (reviewIndex >= reviewQueue.length) return;

    const item = reviewQueue[reviewIndex];
    await Memorization.processReview(item.id, response);
    reviewIndex++;
    showReviewCard();
  }

  /**
   * Show settings screen
   */
  function showSettings() {
    // Set current language radio
    const currentLang = I18n.getLang();
    const langRadio = document.querySelector(`input[name="language"][value="${currentLang}"]`);
    if (langRadio) langRadio.checked = true;

    // Set current theme radio
    const currentTheme = Theme.getTheme();
    const themeRadio = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
    if (themeRadio) themeRadio.checked = true;

    // Set translation toggle
    const transToggle = document.getElementById('settings-show-translation');
    if (transToggle) transToggle.checked = showTranslation;

    document.getElementById('settings-screen').classList.add('active');
  }

  /**
   * Setup voice verification screen
   */
  function setupVoiceScreen() {
    const surahSelect = document.getElementById('voice-surah-select');
    const surahs = QuranData.getAllSurahs();

    // Populate surah selector
    surahs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.number;
      opt.textContent = `${s.number}. ${s.name} - ${I18n.getSurahName(s)}`;
      surahSelect.appendChild(opt);
    });

    // Surah selection change
    surahSelect.addEventListener('change', onVoiceSurahChange);

    // Record button
    const recordBtn = document.getElementById('voice-record-btn');
    recordBtn.addEventListener('click', onRecordToggle);

    // Load model button
    document.getElementById('load-model-btn')?.addEventListener('click', onLoadModel);

    // Check browser support
    const support = VoiceVerifier.checkSupport();
    if (!support.all) {
      document.getElementById('voice-status-text').textContent = I18n.t('voice.browserNotSupported') || 'Browser does not support voice recording';
    }
  }

  /**
   * Handle surah selection in voice screen
   */
  async function onVoiceSurahChange() {
    const surahNum = parseInt(document.getElementById('voice-surah-select').value);
    if (!surahNum) return;

    const surahInfo = QuranData.getSurahInfo(surahNum);
    document.getElementById('voice-ayah-from').max = surahInfo.ayahCount;
    document.getElementById('voice-ayah-to').max = surahInfo.ayahCount;
    document.getElementById('voice-ayah-from').value = 1;
    document.getElementById('voice-ayah-to').value = 1;

    await showVoiceAyah(surahNum, 1);

    if (VoiceVerifier.getState().modelLoaded) {
      document.getElementById('voice-record-btn').disabled = false;
    }

    document.getElementById('voice-status-text').textContent = I18n.t('voice.ready');
  }

  /**
   * Show current ayah in voice screen
   */
  async function showVoiceAyah(surahNum, ayahNum) {
    const ayah = await QuranData.getAyah(surahNum, ayahNum);
    const surahInfo = QuranData.getSurahInfo(surahNum);

    if (ayah) {
      document.getElementById('voice-current-ayah').textContent = ayah.text;
      document.getElementById('voice-ayah-ref').textContent = `${surahInfo.name} - ${I18n.t('surah.ayah')} ${ayahNum}`;
    }
  }

  /**
   * Toggle recording
   */
  async function onRecordToggle() {
    const btn = document.getElementById('voice-record-btn');
    const statusText = document.getElementById('voice-status-text');

    if (!VoiceVerifier.getState().recording) {
      const started = await VoiceVerifier.startRecording();
      if (started) {
        btn.classList.add('recording');
        statusText.textContent = I18n.t('voice.recording');
        document.getElementById('voice-result').classList.add('hidden');
      }
    } else {
      btn.classList.remove('recording');
      statusText.textContent = I18n.t('voice.processing');

      const audioBlob = await VoiceVerifier.stopRecording();
      if (audioBlob) {
        await processVoiceResult(audioBlob);
      }
    }
  }

  /**
   * Process recorded audio and show comparison
   */
  async function processVoiceResult(audioBlob) {
    const statusText = document.getElementById('voice-status-text');
    const resultDiv = document.getElementById('voice-result');
    const resultText = document.getElementById('voice-result-text');
    const comparison = document.getElementById('voice-comparison');

    try {
      const surahNum = parseInt(document.getElementById('voice-surah-select').value);
      const ayahNum = parseInt(document.getElementById('voice-ayah-from').value) || 1;
      const ayah = await QuranData.getAyah(surahNum, ayahNum);

      if (!ayah) {
        statusText.textContent = 'Verse not found';
        return;
      }

      const result = await VoiceVerifier.verifyRecitation(audioBlob, ayah.textPlain);

      resultDiv.classList.remove('hidden');
      resultText.textContent = result.transcription || '(No speech detected)';

      if (result.comparison.score >= 80) {
        comparison.className = 'voice-comparison match';
        comparison.textContent = I18n.t('voice.excellent', {
          score: result.comparison.score,
          correct: result.comparison.correctWords,
          total: result.comparison.totalWords
        });
      } else if (result.comparison.score >= 50) {
        comparison.className = 'voice-comparison mismatch';
        comparison.textContent = I18n.t('voice.tryAgain', {
          score: result.comparison.score,
          correct: result.comparison.correctWords,
          total: result.comparison.totalWords
        });
      } else {
        comparison.className = 'voice-comparison mismatch';
        comparison.textContent = I18n.t('voice.needsReview', { score: result.comparison.score });
      }

      statusText.textContent = I18n.t('voice.ready');
    } catch (error) {
      console.error('Voice processing error:', error);
      statusText.textContent = 'Error processing. Try again.';
    }
  }

  /**
   * Handle model loading
   */
  async function onLoadModel() {
    const statusText = document.getElementById('model-status-text');
    const loadBtn = document.getElementById('load-model-btn');

    loadBtn.disabled = true;
    statusText.textContent = 'Loading model...';

    const success = await VoiceVerifier.loadModel((progress) => {
      statusText.textContent = `Loading model: ${progress}%`;
    });

    if (success) {
      statusText.textContent = 'Voice model: Ready';
      loadBtn.style.display = 'none';
      document.getElementById('voice-record-btn').disabled = false;
    } else {
      statusText.textContent = 'Failed to load model';
      loadBtn.disabled = false;
      loadBtn.textContent = 'Retry';
    }
  }

  /**
   * Show voice screen
   */
  function showVoice() {
    document.getElementById('voice-screen').classList.add('active');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigateTo };
})();
