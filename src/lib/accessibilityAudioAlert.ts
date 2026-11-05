export const ACCESSIBILITY_ALERT_STORAGE_KEY =
  'janmiter_accessibility_audio_alert_enabled';

export interface TonePulseSpec {
  frequencyHz: number;
  harmonicHz: number;
  startTimeOffsetSec: number;
  durationSec: number;
  peakGain: number;
}

export interface AccessibilityAlertPattern {
  countryName: string;
  universalNumber: string;
  pulses: TonePulseSpec[];
  spokenAnnouncement: string;
}

/**
 * Pure function that builds the high-contrast acoustic locator pattern and
 * spoken screen-reader / TTS announcement for a given country's emergency directory.
 * Uses the 880 Hz – 1320 Hz – 1760 Hz band (1–2 kHz human peak auditory sensitivity)
 * so visually impaired users can locate the active tab/device immediately.
 */
export function buildAccessibilityAlertPattern(
  countryName: string,
  universalNumber: string
): AccessibilityAlertPattern {
  const cleanCountry = (countryName || 'Selected Country').trim();
  const cleanNumber = (universalNumber || '112').trim();
  const spacedDigits = cleanNumber.split('').join(' ');

  const pulses: TonePulseSpec[] = [
    {
      frequencyHz: 880,
      harmonicHz: 1320,
      startTimeOffsetSec: 0.0,
      durationSec: 0.14,
      peakGain: 0.28,
    },
    {
      frequencyHz: 1174.66,
      harmonicHz: 1760,
      startTimeOffsetSec: 0.18,
      durationSec: 0.14,
      peakGain: 0.3,
    },
    {
      frequencyHz: 1760,
      harmonicHz: 2637.02,
      startTimeOffsetSec: 0.36,
      durationSec: 0.24,
      peakGain: 0.32,
    },
  ];

  return {
    countryName: cleanCountry,
    universalNumber: cleanNumber,
    pulses,
    spokenAnnouncement: `JANMITER Emergency Directory open for ${cleanCountry}. Universal emergency number is ${spacedDigits}.`,
  };
}

let sharedAudioCtx: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtxCtor) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtxCtor();
  }
  return sharedAudioCtx;
}

/**
 * Plays a distinct, high-contrast 3-pulse acoustic locator beacon using the Web Audio API
 * (works 100% offline) and optionally speaks a concise voice announcement of the universal number.
 */
export async function playHighContrastDirectoryAlert(
  countryName: string,
  universalNumber: string,
  options: { speakAnnouncement?: boolean } = { speakAnnouncement: true }
): Promise<boolean> {
  const pattern = buildAccessibilityAlertPattern(countryName, universalNumber);
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    return false;
  }

  if (ctx.state !== 'running') {
    return false;
  }

  const now = ctx.currentTime;

  for (const pulse of pattern.pulses) {
    const start = now + pulse.startTimeOffsetSec;
    const end = start + pulse.durationSec;

    // Primary high-contrast carrier oscillator
    const oscPrimary = ctx.createOscillator();
    oscPrimary.type = 'triangle';
    oscPrimary.frequency.setValueAtTime(pulse.frequencyHz, start);

    // Upper harmonic oscillator for distinct acoustic contrast
    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'sine';
    oscHarmonic.frequency.setValueAtTime(pulse.harmonicHz, start);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(pulse.peakGain, start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.35, start);

    oscPrimary.connect(gainNode);
    oscHarmonic.connect(harmonicGain);
    harmonicGain.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscPrimary.start(start);
    oscHarmonic.start(start);
    oscPrimary.stop(end + 0.01);
    oscHarmonic.stop(end + 0.01);
  }

  if (
    options.speakAnnouncement !== false &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(pattern.spokenAnnouncement);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          // ignore speech synthesis errors
        }
      }, 620);
    } catch {
      // ignore speech synthesis errors
    }
  }

  return true;
}
