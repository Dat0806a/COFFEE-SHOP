import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ONBOARDING_ONCE,
  MIN_TRANSITION_MS,
  MEDIA_TIMEOUT_MS,
  VIDEO_SOURCES,
  hasCompletedOnboarding,
  markOnboardingCompleted
} from '../../config/bootConfig';
import './BootSequence.css';

export type BootState = 'loading' | 'intro' | 'transition' | 'onboarding' | 'app';

interface BootSequenceProps {
  children: React.ReactNode;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ children }) => {
  const [bootState, setBootState] = useState<BootState>('loading');
  const [isOverlayMounted, setIsOverlayMounted] = useState<boolean>(true);

  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const onboardingVideoRef = useRef<HTMLVideoElement | null>(null);

  // Safely play HTML5 video without freezing: tries sound first, falls back to smooth video if browser blocks audio autoplay
  const safePlay = useCallback(async (video: HTMLVideoElement | null, label: string) => {
    if (!video) return;
    try {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1.0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log(`▶ [BootSequence] Playing ${label} with audio`);
      }
    } catch (err) {
      console.warn(`[BootSequence] Autoplay with sound restricted for ${label}, falling back to smooth video:`, err);
      try {
        video.muted = true;
        video.defaultMuted = true;
        const fallbackPromise = video.play();
        if (fallbackPromise !== undefined) {
          await fallbackPromise;
        }
        console.log(`▶ [BootSequence] Playing ${label} (smooth playback)`);
      } catch (fallbackErr) {
        console.warn(`[BootSequence] Play failed for ${label}:`, fallbackErr);
      }
    }
  }, []);

  // Unmute currently active video on legitimate user gestures only (click/touch/key)
  const unmuteActiveVideo = useCallback(() => {
    const activeVideo = bootState === 'intro' ? introVideoRef.current : (bootState === 'onboarding' ? onboardingVideoRef.current : null);
    if (activeVideo) {
      activeVideo.muted = false;
      activeVideo.defaultMuted = false;
      activeVideo.volume = 1.0;
      if (activeVideo.paused) {
        activeVideo.play().catch(() => {
          activeVideo.muted = true;
          activeVideo.play().catch(() => {});
        });
      }
    }
  }, [bootState]);

  // Window-level interaction listeners to immediately unmute video on legitimate user interaction
  useEffect(() => {
    const handleInteraction = () => {
      unmuteActiveVideo();
    };

    const events = ['click', 'pointerdown', 'mousedown', 'touchstart', 'keydown'];
    events.forEach(evt => window.addEventListener(evt, handleInteraction, { capture: true, passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleInteraction, { capture: true } as unknown as boolean));
    };
  }, [unmuteActiveVideo]);

  // Ensure audio is automatically enabled and unmuted with volume 1.0 on initial app launch
  useEffect(() => {
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
          onClick={unmuteActiveVideo}
          onPointerDown={unmuteActiveVideo}
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

          {/* Minimalist Loading Screen for 'loading' state while buffering video resources */}
          {bootState === 'loading' && (
            <div className="boot-loader-container">
              <div className="boot-loader-spinner" />
              <div className="boot-loader-text">Đang tải...</div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
