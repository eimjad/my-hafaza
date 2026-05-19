/**
 * Hafaza - Main Application Controller
 * Manages screens, navigation, and user interactions
 */

const App = (() => {
  let currentScreen = 'loading';
  let currentSurah = null;
  let reviewQueue = [];
  let reviewIndex = 0;

  /**
   * Initialize the app
   */
  async function init() {
    try {
      // Initialize database
      await HafazaDB.init();

      // Load Quran index
      await QuranData.loadIndex();

      // Pre-load full Quran for offline use
      await QuranData.loadFull();

      // Setup navigation
      setupNavigation();

      // Setup voice screen
      setupVoiceScreen();

      // Show home screen
      await showHome();

      // Register service worker
      registerServiceWorker();
    } catch (error) {
      console.error('App initialization failed:', error);
      document.querySelector('.loading-text').textContent = 'خطأ في التحميل';
    }
  }

  /**
   * Register service worker for offline support
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        console.log('Service Worker registered:', reg.scope);
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

    // Review buttons
    document.getElementById('review-forgot')?.addEventListener('click', () => handleReview('forgot'));
    document.getElementById('review-hard')?.addEventListener('click', () => handleReview('hard'));
    document.getElementById('review-good')?.addEventListener('click', () => handleReview('good'));
    document.getElementById('review-easy')?.addEventListener('click', () => handleReview('easy'));

    // Start review from home
    document.getElementById('start-review-btn')?.addEventListener('click', () => navigateTo('review'));
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

    switch (screen) {
      case 'home':
        await showHome();
        break;
      case 'memorize':
        await showHome(); // Show surah list
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
      reviewDue.querySelector('.review-count').textContent = `${stats.dueReviews} آيات تحتاج مراجعة`;
      startBtn.style.display = 'inline-block';
    } else {
      reviewDue.querySelector('.review-count').textContent = 'لا توجد مراجعات مطلوبة';
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

      html += `
        <div class="surah-item" data-surah="${surah.number}">
          <div class="surah-number">${surah.number}</div>
          <div class="surah-name">${surah.name}</div>
          <div class="surah-progress">
            <div class="surah-progress-bar" style="width: ${percent}%"></div>
          </div>
          <div class="surah-ayah-count">${surah.ayahCount} آية</div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('.surah-item').forEach(item => {
      item.addEventListener('click', () => {
        currentSurah = parseInt(item.dataset.surah);
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
    document.getElementById('surah-info').textContent = `${surahInfo.ayahCount} آية`;

    // Render ayahs
    const container = document.getElementById('ayah-list');
    let html = '';

    ayahs.forEach(ayah => {
      const isMemorized = memorizedSet.has(ayah.number);
      html += `
        <div class="ayah-item ${isMemorized ? 'memorized' : ''}" data-ayah="${ayah.number}">
          <p class="ayah-text">${ayah.text} ﴿${ayah.number}﴾</p>
          <div class="ayah-meta">
            <span class="ayah-number-badge">آية ${ayah.number}</span>
            <div class="ayah-actions">
              <button class="ayah-btn ${isMemorized ? 'memorized-btn' : ''}" data-action="memorize" data-surah="${surahNum}" data-ayah="${ayah.number}">
                ${isMemorized ? '✓ محفوظة' : '☐ حفظ'}
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
          btn.textContent = '☐ حفظ';
          btn.closest('.ayah-item').classList.remove('memorized');
        } else {
          await Memorization.markMemorized(surah, ayah);
          btn.classList.add('memorized-btn');
          btn.textContent = '✓ محفوظة';
          btn.closest('.ayah-item').classList.add('memorized');
        }
      });
    });

    document.getElementById('surah-screen').classList.add('active');
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
      // All done
      document.getElementById('review-ayah-card').style.display = 'none';
      document.querySelector('.review-actions').style.display = 'none';
      document.getElementById('review-empty').style.display = 'block';
      return;
    }

    const item = reviewQueue[reviewIndex];
    const ayah = await QuranData.getAyah(item.surah, item.ayah);
    const surahInfo = QuranData.getSurahInfo(item.surah);

    document.getElementById('review-surah-name').textContent = surahInfo?.name || '';
    document.getElementById('review-ayah-text').textContent = ayah?.text || '';
    document.getElementById('review-ayah-number').textContent = `آية ${item.ayah}`;
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
   * Setup voice verification screen
   */
  function setupVoiceScreen() {
    const surahSelect = document.getElementById('voice-surah-select');
    const surahs = QuranData.getAllSurahs();

    // Populate surah selector
    surahs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.number;
      opt.textContent = `${s.number}. ${s.name}`;
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
      document.getElementById('voice-status-text').textContent =
        'المتصفح لا يدعم التسجيل الصوتي';
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

    // Enable record button if model is loaded
    if (VoiceVerifier.getState().modelLoaded) {
      document.getElementById('voice-record-btn').disabled = false;
    }

    document.getElementById('voice-status-text').textContent = 'جاهز للتسجيل';
  }

  /**
   * Show current ayah in voice screen
   */
  async function showVoiceAyah(surahNum, ayahNum) {
    const ayah = await QuranData.getAyah(surahNum, ayahNum);
    const surahInfo = QuranData.getSurahInfo(surahNum);

    if (ayah) {
      document.getElementById('voice-current-ayah').textContent = ayah.text;
      document.getElementById('voice-ayah-ref').textContent = `${surahInfo.name} - آية ${ayahNum}`;
    }
  }

  /**
   * Toggle recording
   */
  async function onRecordToggle() {
    const btn = document.getElementById('voice-record-btn');
    const statusText = document.getElementById('voice-status-text');

    if (!VoiceVerifier.getState().recording) {
      // Start recording
      const started = await VoiceVerifier.startRecording();
      if (started) {
        btn.classList.add('recording');
        btn.querySelector('.record-icon').textContent = '⏹';
        statusText.textContent = 'جاري التسجيل... اضغط للإيقاف';
        document.getElementById('voice-result').classList.add('hidden');
      }
    } else {
      // Stop recording and process
      btn.classList.remove('recording');
      btn.querySelector('.record-icon').textContent = '🎤';
      statusText.textContent = 'جاري المعالجة...';

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
        statusText.textContent = 'لم يتم العثور على الآية';
        return;
      }

      // Transcribe and compare
      const result = await VoiceVerifier.verifyRecitation(audioBlob, ayah.textPlain);

      // Show result
      resultDiv.classList.remove('hidden');
      resultText.textContent = result.transcription || '(لم يتم التعرف على الكلام)';

      if (result.comparison.score >= 80) {
        comparison.className = 'voice-comparison match';
        comparison.textContent = `✓ ممتاز! التطابق: ${result.comparison.score}% (${result.comparison.correctWords}/${result.comparison.totalWords} كلمات)`;
      } else if (result.comparison.score >= 50) {
        comparison.className = 'voice-comparison mismatch';
        comparison.textContent = `⚠ حاول مرة أخرى. التطابق: ${result.comparison.score}% (${result.comparison.correctWords}/${result.comparison.totalWords} كلمات)`;
      } else {
        comparison.className = 'voice-comparison mismatch';
        comparison.textContent = `✗ يحتاج مراجعة. التطابق: ${result.comparison.score}%`;
      }

      statusText.textContent = 'اضغط للتسجيل مرة أخرى';
    } catch (error) {
      console.error('Voice processing error:', error);
      statusText.textContent = 'خطأ في المعالجة. حاول مرة أخرى.';
    }
  }

  /**
   * Handle model loading
   */
  async function onLoadModel() {
    const statusText = document.getElementById('model-status-text');
    const loadBtn = document.getElementById('load-model-btn');

    loadBtn.disabled = true;
    statusText.textContent = 'جاري تحميل النموذج...';

    const success = await VoiceVerifier.loadModel((progress) => {
      statusText.textContent = `تحميل النموذج: ${progress}%`;
    });

    if (success) {
      statusText.textContent = 'نموذج الصوت: جاهز ✓';
      loadBtn.style.display = 'none';
      document.getElementById('voice-record-btn').disabled = false;
    } else {
      statusText.textContent = 'فشل تحميل النموذج';
      loadBtn.disabled = false;
      loadBtn.textContent = 'إعادة المحاولة';
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
