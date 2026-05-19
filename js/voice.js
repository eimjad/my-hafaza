/**
 * Hafaza - Voice Verification Module (Phase 2)
 * Handles microphone capture, speech-to-text via Whisper WASM,
 * and comparison with original Quran text
 *
 * Architecture:
 * 1. Capture audio from microphone (Web Audio API + MediaRecorder)
 * 2. Process audio through Whisper model (Transformers.js / whisper.cpp WASM)
 * 3. Compare transcription with original text (QuranData.compareTexts)
 * 4. Return word-by-word accuracy results
 *
 * The Whisper model runs entirely client-side after initial download.
 * Model is stored in IndexedDB for offline use.
 */

const VoiceVerifier = (() => {
  let isModelLoaded = false;
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let pipeline = null; // Transformers.js pipeline
  let audioContext = null;

  // Configuration
  const CONFIG = {
    // Whisper model to use - 'tiny' is ~42MB, 'base' is ~150MB, 'small' is ~250MB
    // For Arabic/Quran, 'small' is recommended for accuracy
    // 'tiny' works for common surahs
    modelId: 'Xenova/whisper-small',
    language: 'ar',
    task: 'transcribe',
    sampleRate: 16000 // Whisper expects 16kHz
  };

  /**
   * Check if the browser supports required APIs
   */
  function checkSupport() {
    const supported = {
      mediaDevices: !!navigator.mediaDevices?.getUserMedia,
      audioContext: !!(window.AudioContext || window.webkitAudioContext),
      webAssembly: typeof WebAssembly !== 'undefined',
      indexedDB: !!window.indexedDB
    };

    supported.all = Object.values(supported).every(v => v);
    return supported;
  }

  /**
   * Load the Whisper model
   * This downloads the model on first use and caches it in IndexedDB
   * Subsequent loads will use the cached version (offline)
   *
   * @param {function} onProgress - Progress callback (0-100)
   * @returns {Promise<boolean>} Whether loading succeeded
   */
  async function loadModel(onProgress) {
    if (isModelLoaded) return true;

    try {
      // Dynamic import of Transformers.js
      // In production, this would be bundled or loaded from CDN
      // For now, we check if it's available
      if (typeof window.transformers === 'undefined') {
        // Load Transformers.js from CDN
        await loadScript('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      }

      const { pipeline: createPipeline, env } = window.transformers || self.transformers;

      // Configure for browser environment
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      if (onProgress) onProgress(10);

      // Create the automatic-speech-recognition pipeline
      pipeline = await createPipeline(
        'automatic-speech-recognition',
        CONFIG.modelId,
        {
          progress_callback: (progress) => {
            if (onProgress && progress.progress) {
              onProgress(Math.round(10 + progress.progress * 0.9));
            }
          }
        }
      );

      isModelLoaded = true;
      if (onProgress) onProgress(100);
      return true;
    } catch (error) {
      console.error('Failed to load Whisper model:', error);
      return false;
    }
  }

  /**
   * Load an external script
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Request microphone permission
   */
  async function requestMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Start recording audio from the microphone
   */
  async function startRecording() {
    if (isRecording) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: CONFIG.sampleRate,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  function stopRecording() {
    return new Promise((resolve) => {
      if (!isRecording || !mediaRecorder) {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        isRecording = false;
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Convert audio blob to Float32Array at 16kHz (Whisper format)
   */
  async function audioToFloat32(audioBlob) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
      audioContext = new AudioCtx({ sampleRate: CONFIG.sampleRate });
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get mono channel
    const channelData = audioBuffer.getChannelData(0);

    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== CONFIG.sampleRate) {
      const ratio = audioBuffer.sampleRate / CONFIG.sampleRate;
      const newLength = Math.floor(channelData.length / ratio);
      const resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        resampled[i] = channelData[Math.floor(i * ratio)];
      }
      return resampled;
    }

    return channelData;
  }

  /**
   * Transcribe audio using the loaded Whisper model
   * @param {Blob} audioBlob - The recorded audio
   * @returns {Promise<string>} The transcribed text
   */
  async function transcribe(audioBlob) {
    if (!isModelLoaded || !pipeline) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const audioData = await audioToFloat32(audioBlob);

    const result = await pipeline(audioData, {
      language: CONFIG.language,
      task: CONFIG.task,
      chunk_length_s: 30,
      stride_length_s: 5
    });

    return result.text || '';
  }

  /**
   * Full verification flow:
   * 1. Record user's recitation
   * 2. Transcribe the audio
   * 3. Compare with original text
   *
   * @param {string} originalText - The original ayah text to compare against
   * @returns {Promise<object>} { transcription, comparison }
   */
  async function verifyRecitation(audioBlob, originalText) {
    const transcription = await transcribe(audioBlob);
    const comparison = QuranData.compareTexts(originalText, transcription);

    return {
      transcription,
      comparison
    };
  }

  /**
   * Get current state
   */
  function getState() {
    return {
      modelLoaded: isModelLoaded,
      recording: isRecording,
      supported: checkSupport()
    };
  }

  return {
    checkSupport,
    loadModel,
    requestMicPermission,
    startRecording,
    stopRecording,
    transcribe,
    verifyRecitation,
    getState
  };
})();
