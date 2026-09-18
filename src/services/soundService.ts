/**
 * Sound Service for ANA CHIANG MAI Admin
 * Provides an attention-grabbing, harmonious Thai café brass chime sequence (lasting >= 8 seconds: ~9.2s),
 * dual Web Audio API synthesis + HTML5 Audio fallback, aggressive browser autoplay unlocking on any user gesture,
 * deduplication per event with expiration, and stop/mute control.
 */

type PlayStateListener = (isPlaying: boolean) => void;

class SoundService {
  private isAudioEnabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private recentPlayedMap: Map<string, number> = new Map();
  private audioTag: HTMLAudioElement | null = null;
  private activeTimeouts: number[] = [];
  private activeOscillators: OscillatorNode[] = [];
  private currentPlayingState: boolean = false;
  private playStateListeners: Set<PlayStateListener> = new Set();
  private stopTimer: number | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem('ana_admin_sound_enabled');
      this.isAudioEnabled = saved !== null ? saved === 'true' : true;
    } catch {
      this.isAudioEnabled = true;
    }

    if (typeof window !== 'undefined') {
      // Preload audio tag with the 9.2s chime file
      try {
        this.audioTag = new Audio('/sounds/new-order.wav');
        this.audioTag.preload = 'auto';
        this.audioTag.volume = 1.0;
      } catch {
        // ignore
      }

      // Aggressively listen to any user gesture on window/document to unlock audio immediately
      const unlockEvents = ['click', 'touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown', 'focus'];
      const onUserGesture = () => {
        this.unlockAudio();
      };

      unlockEvents.forEach((evt) => {
        window.addEventListener(evt, onUserGesture, { capture: true, passive: true });
        document.addEventListener(evt, onUserGesture, { capture: true, passive: true });
      });
    }
  }

  /**
   * Unlock AudioContext and Audio elements on user interaction
   */
  public unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
      }

      if (this.audioTag) {
        // Prime audio tag
        this.audioTag.load();
      }
    } catch {
      // ignore
    }
  };

  /**
   * Check if sound is enabled
   */
  public isEnabled(): boolean {
    return this.isAudioEnabled;
  }

  /**
   * Set sound preference
   */
  public setEnabled(enabled: boolean) {
    this.isAudioEnabled = enabled;
    try {
      localStorage.setItem('ana_admin_sound_enabled', enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
    if (!enabled) {
      this.stopSound();
    }
  }

  /**
   * Check if sound is currently actively playing
   */
  public isPlaying(): boolean {
    return this.currentPlayingState;
  }

  /**
   * Subscribe to sound playing state changes (useful for animated UI indicators)
   */
  public onPlayStateChange(listener: PlayStateListener): () => void {
    this.playStateListeners.add(listener);
    return () => {
      this.playStateListeners.delete(listener);
    };
  }

  private setPlaying(playing: boolean) {
    if (this.currentPlayingState !== playing) {
      this.currentPlayingState = playing;
      this.playStateListeners.forEach((fn) => {
        try {
          fn(playing);
        } catch {
          // ignore
        }
      });
    }
  }

  /**
   * Stop any ongoing notification sound immediately (e.g. user clicked "Xem đơn" or mute)
   */
  public stopSound = () => {
    // Stop HTML5 audio tag
    if (this.audioTag) {
      try {
        this.audioTag.pause();
        this.audioTag.currentTime = 0;
      } catch {
        // ignore
      }
    }

    // Clear all scheduled burst timeouts
    this.activeTimeouts.forEach((t) => clearTimeout(t));
    this.activeTimeouts = [];

    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    // Stop and disconnect any currently vibrating oscillators
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeOscillators = [];

    this.setPlaying(false);
  };

  /**
   * Synthesize a single melodious bell note with acoustic harmonics and exponential decay
   */
  private createBellNote(frequency: number, startTime: number, duration: number, volume: number = 0.35) {
    if (!this.audioContext) return;

    try {
      const osc = this.audioContext.createOscillator();
      const overtoneOsc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      // Fundamental tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);

      // Shimmer overtone (2nd harmonic)
      overtoneOsc.type = 'sine';
      overtoneOsc.frequency.setValueAtTime(frequency * 2, startTime);

      // Volume envelope: instant sharp attack (12ms), smooth acoustic decay
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      overtoneOsc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(startTime);
      overtoneOsc.start(startTime);

      osc.stop(startTime + duration);
      overtoneOsc.stop(startTime + duration);

      this.activeOscillators.push(osc);
      this.activeOscillators.push(overtoneOsc);

      // Clean up references after note finishes
      setTimeout(() => {
        this.activeOscillators = this.activeOscillators.filter((o) => o !== osc && o !== overtoneOsc);
      }, duration * 1000 + 100);
    } catch {
      // ignore
    }
  }

  /**
   * Play a full multi-burst Thai café brass chime lasting at least 8 seconds (~9.2s).
   * Repeats 5 rhythmic chime waves: at 0.0s, 1.8s, 3.6s, 5.4s, and 7.2s.
   */
  private playSynthesizedChimeSequence() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const now = this.audioContext.currentTime;
      const bursts = [0.0, 1.8, 3.6, 5.4, 7.2]; // 5 waves spanning across 9.2 seconds

      bursts.forEach((burstOffset) => {
        const t = now + burstOffset;
        // Note 1: A5 (880 Hz) - Ding
        this.createBellNote(880, t + 0.00, 0.55, 0.32);
        // Note 2: D6 (1174.66 Hz) - Dong
        this.createBellNote(1174.66, t + 0.18, 0.65, 0.35);
        // Note 3: A6 (1760 Hz) - Ting (vibrant brass resonance)
        this.createBellNote(1760.0, t + 0.40, 1.10, 0.40);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Play the notification chime for an order or event.
   * Guarantees sound lasts at least 8 seconds (~9.2s).
   * Employs dual-engine (HTML5 Audio file + Web Audio synthesis) so it ALWAYS rings reliably.
   * Uses a 3.5s deduplication window per unique eventId so repeated actions (items added,
   * proof submitted, order updated) ALWAYS ring without being permanently silenced.
   *
   * @param eventId Unique notification or order identifier
   */
  public playNewOrderSound(eventId?: string) {
    if (!this.isAudioEnabled) return;

    // Deduplication check: only skip if the exact same event was played in the last 3.5s
    if (eventId) {
      const lastPlayedTime = this.recentPlayedMap.get(eventId);
      if (lastPlayedTime && Date.now() - lastPlayedTime < 3500) {
        return; // debounce exact same duplicate event
      }
      this.recentPlayedMap.set(eventId, Date.now());

      // Prune old deduplication keys
      if (this.recentPlayedMap.size > 150) {
        const cutoff = Date.now() - 60000;
        for (const [key, time] of this.recentPlayedMap.entries()) {
          if (time < cutoff) {
            this.recentPlayedMap.delete(key);
          }
        }
      }
    }

    // Stop any previous chime to avoid overlapping noise chaos, then start fresh 9.2s chime
    this.stopSound();
    this.setPlaying(true);

    // Auto stop indicator after 9.3s
    this.stopTimer = window.setTimeout(() => {
      this.setPlaying(false);
    }, 9300);

    // Always attempt AudioContext resume
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    // Engine 1: HTML5 Audio file playback (9.2s WAV / MP3)
    if (this.audioTag) {
      try {
        this.audioTag.currentTime = 0;
        const playPromise = this.audioTag.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Browser blocked HTML5 audio, Web Audio synthesis will cover it
            this.playSynthesizedChimeSequence();
          });
        }
      } catch {
        // Fallback to synthesis
        this.playSynthesizedChimeSequence();
      }
    }

    // Engine 2: Web Audio API synthesis (always runs if audioTag didn't play or as reinforcement)
    // To ensure maximum reliability across desktop/mobile browsers:
    this.playSynthesizedChimeSequence();
  }

  /**
   * Play an energetic, melodic café announcement chime sequence when an order is READY (Sẵn sàng phục vụ).
   * Spans across 15 seconds with rich harmonized café counter brass bell waves and audio playback.
   */
  public playReadySound(eventId?: string) {
    if (!this.isAudioEnabled) return;

    if (eventId) {
      const key = `ready-${eventId}`;
      const lastPlayedTime = this.recentPlayedMap.get(key);
      if (lastPlayedTime && Date.now() - lastPlayedTime < 3000) {
        return;
      }
      this.recentPlayedMap.set(key, Date.now());
    }

    this.stopSound();
    this.setPlaying(true);

    this.stopTimer = window.setTimeout(() => {
      this.stopSound();
    }, 15200);

    this.unlockAudio();

    // Engine 1: HTML5 Audio file playback (repeat chime across 15s)
    if (this.audioTag) {
      try {
        this.audioTag.currentTime = 0;
        this.audioTag.play().catch(() => {});
        const repeat1 = window.setTimeout(() => {
          if (this.currentPlayingState && this.audioTag) {
            try {
              this.audioTag.currentTime = 0;
              this.audioTag.play().catch(() => {});
            } catch {}
          }
        }, 7500);
        this.activeTimeouts.push(repeat1);
      } catch {
        // ignore
      }
    }

    // Engine 2: Web Audio API synthesis (6 melodic bell waves across 15 seconds)
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }

        const now = this.audioContext.currentTime;

        // Wave 1 (0.0s): Bright rising announcement fanfare (C6 -> E6 -> G6 -> C7)
        this.createBellNote(1046.50, now + 0.00, 0.55, 0.65); // C6
        this.createBellNote(1318.51, now + 0.16, 0.55, 0.70); // E6
        this.createBellNote(1567.98, now + 0.34, 0.65, 0.75); // G6
        this.createBellNote(2093.00, now + 0.56, 1.45, 0.90); // C7 (crystal counter bell)

        // Wave 2 (2.5s): Resonant café service bell chime
        this.createBellNote(1318.51, now + 2.50, 0.45, 0.60);
        this.createBellNote(1567.98, now + 2.68, 0.55, 0.65);
        this.createBellNote(2093.00, now + 2.88, 1.30, 0.80);

        // Wave 3 (5.0s): Double ding alert call
        this.createBellNote(1567.98, now + 5.00, 0.45, 0.60);
        this.createBellNote(2093.00, now + 5.20, 1.35, 0.80);

        // Wave 4 (7.5s): Harmonious counter bell chime wave
        this.createBellNote(1046.50, now + 7.50, 0.50, 0.60);
        this.createBellNote(1318.51, now + 7.68, 0.50, 0.65);
        this.createBellNote(1567.98, now + 7.88, 0.60, 0.70);
        this.createBellNote(2093.00, now + 8.10, 1.40, 0.85);

        // Wave 5 (10.2s): Resonant reminder chime
        this.createBellNote(1318.51, now + 10.20, 0.45, 0.60);
        this.createBellNote(1567.98, now + 10.38, 0.55, 0.65);
        this.createBellNote(2093.00, now + 10.58, 1.30, 0.80);

        // Wave 6 (12.8s - 15.0s): Final double ding & lingering brass decay
        this.createBellNote(1567.98, now + 12.80, 0.50, 0.60);
        this.createBellNote(2093.00, now + 13.00, 2.00, 0.85);
      }
    } catch {
      // ignore
    }
  }
}

export const soundService = new SoundService();
