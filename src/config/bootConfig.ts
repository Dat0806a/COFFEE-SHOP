/**
 * ANA CHIANG MAI - Video Boot Sequence Configuration
 */

// Toggle whether onboarding video should run only once or every time the app opens
// Set to `true` for production if you want onboarding to play only on the first visit
// Set to `false` so both Intro and Onboarding (bg.mp4) play on every app open
export const ONBOARDING_ONCE = false;

// Key used in localStorage to track onboarding completion status
export const ONBOARDING_STORAGE_KEY = 'ana_onboarding_completed';

// Minimum black screen duration (in milliseconds) between intro and onboarding
export const MIN_TRANSITION_MS = 2000;

// Maximum safety timeout (in milliseconds) for video buffering before failing gracefully to the next step / app
export const MEDIA_TIMEOUT_MS = 8000;

// Video paths relative to web root
export const VIDEO_SOURCES = {
  intro: '/videos/intro.mp4',
  onboarding: '/videos/onboarding.mp4'
} as const;

/**
 * Check if the user has already completed onboarding
 */
export const hasCompletedOnboarding = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark onboarding as completed in localStorage
 */
export const markOnboardingCompleted = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } catch (err) {
    console.warn('[BootSequence] Failed to write localStorage:', err);
  }
};

/**
 * Reset onboarding state for testing purposes
 * Run `window.resetOnboarding()` in browser DevTools Console
 */
export const resetOnboardingState = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    console.log('✨ [BootSequence] Onboarding status has been reset. Refresh the page to test again.');
  } catch (err) {
    console.warn('[BootSequence] Failed to remove localStorage:', err);
  }
};

// Expose reset helper to window in browser for dev testing
if (typeof window !== 'undefined') {
  (window as unknown as { resetOnboarding: () => void }).resetOnboarding = resetOnboardingState;
}
