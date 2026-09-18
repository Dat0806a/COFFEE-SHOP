import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ONBOARDING_ONCE,
  MIN_TRANSITION_MS,
  MEDIA_TIMEOUT_MS,
  VIDEO_SOURCES,
  hasCompletedOnboarding,
  markOnboardingCompleted
} from '../../config/bootConfig';
import { soundService } from '../../services/soundService';
import './BootSequence.css';

export type BootState = 'loading' | 'intro' | 'transition' | 'onboarding' | 'app';

interface BootSequenceProps {
  children: React.ReactNode;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ children }) => {
  const [bootState, setBootState] = useState<BootState>('loading');
  const [isOverlayMounted, setIsOverlayMounted] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState<boolean>(false);

  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const onboardingVideoRef = useRef<HTMLVideoElement | null>(null);
  
  const bootStateRef = useRef<BootState>(bootState);
  bootStateRef.current = bootState;

  // Persistent user preference flag
  const userUnlockedAudioRef = useRef<boolean>(true); // Default to desiring full audio
  const userExplicitlyMutedRef = useRef<boolean>(false);

  // Helper to get currently active video element
  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    if (bootState === 'intro') return introVideoRef.current;
    if (bootState === 'onboarding') return onboardingVideoRef.current;
    return null;
  }, [bootState]);

  // Synchronously prime and unlock audio pipeline on BOTH video elements
  const primeBothVideosAudio = useCallback(() => {
    userUnlockedAudioRef.current = true;
    userExplicitlyMutedRef.current = false;
    soundService.unlockAudio();

    // Set MediaSession for background audio permission on mobile
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'ANA CHIANG MAI',
          artist: 'ANA Chiang Mai Thai Drink & Dessert',
          album: 'Chiang Mai Experience'
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // ignore
      }
    }

    // 1. Prime Intro Video
    if (introVideoRef.current) {
      introVideoRef.current.muted = false;
      introVideoRef.current.defaultMuted = false;
      introVideoRef.current.volume = 1.0;
      introVideoRef.current.removeAttribute('muted');
    }

    // 2. Prime Onboarding Video within SAME event loop
    if (onboardingVideoRef.current) {
      onboardingVideoRef.current.muted = false;
      onboardingVideoRef.current.defaultMuted = false;
      onboardingVideoRef.current.volume = 1.0;
      onboardingVideoRef.current.removeAttribute('muted');

      if (bootStateRef.current !== 'onboarding' && onboardingVideoRef.current.paused) {
        try {
          const primePromise = onboardingVideoRef.current.play();
          if (primePromise !== undefined) {
            primePromise.then(() => {
              if (onboardingVideoRef.current && bootStateRef.current !== 'onboarding') {
                onboardingVideoRef.current.pause();
                onboardingVideoRef.current.currentTime = 0;
              }
            }).catch(() => {});
          }
        } catch {}
      }
    }

    setIsMuted(false);
    setShowUnmuteHint(false);
  }, []);

  // Aggressive unlock & unmute: activates audio on BOTH videos immediately
  const triggerUnmute = useCallback((rewindIfEarly: boolean = true) => {
    primeBothVideosAudio();

    const activeVideo = getActiveVideo();
    if (activeVideo) {
      activeVideo.muted = false;
      activeVideo.defaultMuted = false;
      activeVideo.volume = 1.0;
      activeVideo.removeAttribute('muted');

      if (rewindIfEarly && bootState === 'intro' && activeVideo.currentTime < 3.0) {
        try {
          activeVideo.currentTime = 0;
        } catch {}
      }

      const p = activeVideo.play();
      if (p !== undefined) {
        p.then(() => {
          setIsMuted(false);
          setShowUnmuteHint(false);
        }).catch(() => {});
      }
    }
  }, [primeBothVideosAudio, getActiveVideo, bootState]);

  // Safely play HTML5 video: ALWAYS attempts unmuted playback with sound first
  const safePlay = useCallback(async (video: HTMLVideoElement | null, label: string) => {
    if (!video) return;

    // 1. Attempt unmuted audio by default (unless user pressed mute button)
    if (!userExplicitlyMutedRef.current) {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1.0;
      video.removeAttribute('muted');
    } else {
      video.muted = true;
      video.defaultMuted = true;
    }

    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log(`▶ [BootSequence] Playing ${label} with sound (muted: ${video.muted})`);
        if (!video.muted) {
          setIsMuted(false);
          setShowUnmuteHint(false);
          userUnlockedAudioRef.current = true;
        }
      }
    } catch (err) {
      console.warn(`[BootSequence] Cold autoplay unmuted restricted by browser for ${label}:`, err);
      // Browser blocked unmuted sound on cold load -> play muted smoothly, while keeping continuous auto-unmute ready
      try {
        video.muted = true;
        video.defaultMuted = true;
        const fallbackPromise = video.play();
        if (fallbackPromise !== undefined) {
          await fallbackPromise;
        }
        console.log(`▶ [BootSequence] Playing ${label} (muted fallback, waiting for auto-unmute)`);
        if (!userExplicitlyMutedRef.current) {
          setIsMuted(true);
          setShowUnmuteHint(true);
        }
      } catch (fallbackErr) {
        console.warn(`[BootSequence] Fallback play failed for ${label}:`, fallbackErr);
      }
    }
  }, []);

  // Multi-Vector Continuous Auto-Unmute Engine:
  // Catches touch, movement, scroll, orientation, visibility change, and tries to turn on sound seamlessly
  useEffect(() => {
    const handleGlobalInteraction = () => {
      if (!userExplicitlyMutedRef.current) {
        triggerUnmute(false);
      }
    };

    const events = [
      'click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup',
      'touchstart', 'touchend', 'touchmove', 'scroll', 'keydown',
      'pageshow', 'focus', 'visibilitychange', 'deviceorientation', 'devicemotion'
    ];

    events.forEach(evt => window.addEventListener(evt, handleGlobalInteraction, { capture: true, passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleGlobalInteraction, { capture: true } as unknown as boolean));
    };
  }, [triggerUnmute]);

  // Initial early audio unmuting on mount
  useEffect(() => {
    soundService.unlockAudio();
    if (introVideoRef.current) {
      introVideoRef.current.muted = false;
      introVideoRef.current.defaultMuted = false;
      introVideoRef.current.volume = 1.0;
    }
    if (onboardingVideoRef.current) {
      onboardingVideoRef.current.muted = false;
      onboardingVideoRef.current.defaultMuted = false;
      onboardingVideoRef.current.volume = 1.0;
    }
  }, []);

  // Toggle Sound manually via button
  const handleToggleSound = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const activeVideo = getActiveVideo();
    if (!activeVideo) return;

    if (activeVideo.muted || isMuted) {
      triggerUnmute(false);
    } else {
      userExplicitlyMutedRef.current = true;
      if (introVideoRef.current) introVideoRef.current.muted = true;
      if (onboardingVideoRef.current) onboardingVideoRef.current.muted = true;
      setIsMuted(true);
      setShowUnmuteHint(false);
    }
  };

  // Skip straight to app
  const handleSkip = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    console.log('⏩ [BootSequence] User clicked skip, entering app directly');
    markOnboardingCompleted();
    if (introVideoRef.current) introVideoRef.current.pause();
    if (onboardingVideoRef.current) onboardingVideoRef.current.pause();
    setBootState('app');
  };

  // State Machine Driver: executes side-effects whenever bootState changes
  useEffect(() => {
    console.log(`🔄 [BootSequence] State changed to: ${bootState}`);

    if (bootState === 'intro') {
      if (introVideoRef.current) {
        introVideoRef.current.currentTime = 0;
        safePlay(introVideoRef.current, 'intro.mp4');
      }
    } else if (bootState === 'transition') {
      if (introVideoRef.current) {
        introVideoRef.current.pause();
      }

      const shouldSkip = ONBOARDING_ONCE && hasCompletedOnboarding();
      
      const timer = setTimeout(() => {
        if (shouldSkip) {
          console.log('⏩ [BootSequence] User has already completed onboarding, entering app');
          setBootState('app');
        } else {
          console.log('🎬 [BootSequence] Transition ended, starting onboarding (bg.mp4)');
          if (onboardingVideoRef.current && !userExplicitlyMutedRef.current) {
            onboardingVideoRef.current.muted = false;
            onboardingVideoRef.current.defaultMuted = false;
            onboardingVideoRef.current.volume = 1.0;
            onboardingVideoRef.current.removeAttribute('muted');
          }
          setBootState('onboarding');
        }
      }, MIN_TRANSITION_MS);

      return () => clearTimeout(timer);
    } else if (bootState === 'onboarding') {
      if (onboardingVideoRef.current) {
        onboardingVideoRef.current.currentTime = 0;
        safePlay(onboardingVideoRef.current, 'onboarding.mp4');
      }
    } else if (bootState === 'app') {
      if (introVideoRef.current) introVideoRef.current.pause();
      if (onboardingVideoRef.current) onboardingVideoRef.current.pause();

      const timer = setTimeout(() => {
        setIsOverlayMounted(false);
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [bootState, safePlay]);

  // Handle Intro Events
  const handleIntroCanPlay = () => {
    if (bootState === 'loading') {
      setBootState('intro');
    }
  };

  const handleIntroEnded = () => {
    console.log('🏁 [BootSequence] Intro video ended');
    setBootState('transition');
  };

  // Handle Onboarding Events
  const handleOnboardingEnded = () => {
    console.log('🏁 [BootSequence] Onboarding video ended');
    markOnboardingCompleted();
    setBootState('app');
  };

  // Safety Timeout Fallback: ensure app never freezes indefinitely
  useEffect(() => {
    if (bootState === 'loading') {
      const timer = setTimeout(() => {
        console.warn('[BootSequence] Loading timeout reached. Attempting to start intro or app...');
        if (introVideoRef.current && introVideoRef.current.readyState >= 1) {
          setBootState('intro');
        } else {
          setBootState('app');
        }
      }, MEDIA_TIMEOUT_MS);
      return () => clearTimeout(timer);
    } else if (bootState === 'onboarding') {
      const timer = setTimeout(() => {
        if (bootState === 'onboarding') {
          console.warn('[BootSequence] Onboarding max timeout reached. Proceeding to app...');
          setBootState('app');
        }
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [bootState]);

  // Initial check on mount in case intro is already cached/ready
  useEffect(() => {
    if (introVideoRef.current && introVideoRef.current.readyState >= 3 && bootState === 'loading') {
      setBootState('intro');
    }
  }, [bootState]);

  return (
    <>
      {/* Main App Content: always mounted to preserve state/providers */}
      <div
        className="app-main-view"
        style={{
          visibility: bootState === 'app' ? 'visible' : 'hidden',
          opacity: bootState === 'app' ? 1 : 0,
          transition: 'opacity 0.4s ease-in'
        }}
        aria-hidden={bootState !== 'app'}
      >
        {children}
      </div>

      {/* High-Performance Fullscreen Boot Overlay */}
      {isOverlayMounted && (
        <div
          className={`boot-overlay-root ${bootState === 'app' ? 'boot-fade-out' : ''}`}
          id="ana-boot-sequence"
          onClick={() => triggerUnmute(true)}
          onTouchStart={() => triggerUnmute(true)}
          onPointerDown={() => triggerUnmute(true)}
        >
          {/* Stable Video Container */}
          <div className="boot-video-container">
            {/* Intro Video Element */}
            <video
              ref={introVideoRef}
              className={`boot-video-element ${bootState === 'intro' ? 'boot-video-visible' : ''}`}
              src={VIDEO_SOURCES.intro}
              autoPlay
              playsInline
              webkit-playsinline="true"
              x5-video-player-type="h5"
              x5-video-player-fullscreen="true"
              x5-playsinline="true"
              x-webkit-airplay="allow"
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              onCanPlay={handleIntroCanPlay}
              onCanPlayThrough={handleIntroCanPlay}
              onEnded={handleIntroEnded}
              onPause={() => {
                if (bootState === 'intro' && introVideoRef.current && introVideoRef.current.paused && introVideoRef.current.currentTime < (introVideoRef.current.duration || 1)) {
                  introVideoRef.current.play().catch(() => {});
                }
              }}
              onError={(e) => {
                console.warn('[BootSequence] Intro video error:', e);
                setBootState('transition');
              }}
            />

            {/* Onboarding Video Element (bg.mp4) */}
            <video
              ref={onboardingVideoRef}
              className={`boot-video-element ${bootState === 'onboarding' ? 'boot-video-visible' : ''}`}
              src={VIDEO_SOURCES.onboarding}
              autoPlay
              playsInline
              webkit-playsinline="true"
              x5-video-player-type="h5"
              x5-video-player-fullscreen="true"
              x5-playsinline="true"
              x-webkit-airplay="allow"
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              onEnded={handleOnboardingEnded}
              onPause={() => {
                if (bootState === 'onboarding' && onboardingVideoRef.current && onboardingVideoRef.current.paused && onboardingVideoRef.current.currentTime < (onboardingVideoRef.current.duration || 1)) {
                  onboardingVideoRef.current.play().catch(() => {});
                }
              }}
              onError={(e) => {
                console.warn('[BootSequence] Onboarding video error:', e);
                setBootState('app');
              }}
            />
          </div>

          {/* Top Quick Action Bar: Sound Toggle & Skip Button */}
          {(bootState === 'intro' || bootState === 'onboarding') && (
            <div className="boot-top-controls">
              <button
                type="button"
                className={`boot-control-btn boot-sound-btn ${isMuted ? 'boot-btn-muted-pulse' : ''}`}
                onClick={handleToggleSound}
                aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? '🔇' : '🔊'}
                <span className="boot-btn-label">{isMuted ? 'Bật tiếng' : 'Âm thanh'}</span>
              </button>

              <button
                type="button"
                className="boot-control-btn boot-skip-btn"
                onClick={handleSkip}
                aria-label="Bỏ qua video"
              >
                <span>Bỏ qua</span>
                <span className="boot-skip-arrow">›</span>
              </button>
            </div>
          )}

          {/* High-Visibility Golden Pulsing Unmute Pill when browser restricts cold autoplay sound */}
          {showUnmuteHint && isMuted && (bootState === 'intro' || bootState === 'onboarding') && (
            <div
              className="boot-unmute-prompt-container"
              onClick={(e) => {
                e.stopPropagation();
                triggerUnmute(true);
              }}
            >
              <div className="boot-unmute-pill">
                <span className="boot-unmute-pulse-ring"></span>
                <span className="boot-unmute-icon">🔊</span>
                <div className="boot-unmute-text-group">
                  <span className="boot-unmute-title">Chạm để bật âm thanh</span>
                  <span className="boot-unmute-sub">Mở âm thanh trọn vẹn cho cả 2 video</span>
                </div>
              </div>
            </div>
          )}

          {/* Minimalist Loading Screen for 'loading' state while buffering video resources */}
          {bootState === 'loading' && (
            <div className="boot-loader-container">
              <div className="boot-loader-spinner" />
              <div className="boot-loader-text">Đang tải trải nghiệm...</div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
