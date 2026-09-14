import React, { createContext, useContext, useState, useEffect } from 'react';

type SoundType = 'success' | 'error' | 'alert' | 'bell' | 'buzzer';

interface SoundContextType {
  play: (type: SoundType) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  startAlarmLoop: () => void;
  stopAlarmLoop: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// A single shared AudioContext, created lazily on first use and reused for
// every beep thereafter. Browsers cap the number of concurrent AudioContexts
// (Chrome allows only a handful); the low-stock alarm alone calls play()
// every ~1.4s while it's showing, so creating a fresh one per call would
// exhaust that limit within seconds and make sounds (and eventually the
// tab) stutter.
let sharedAudioCtx: AudioContext | null = null
const getAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
      sharedAudioCtx = new Ctor()
    }
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume()
    return sharedAudioCtx
  } catch {
    return null
  }
}

// The low-stock alarm is the one sound that absolutely must be heard, so it
// doesn't rely on the Web Audio API alone — some strict in-app WebViews
// (WhatsApp's in particular) keep refusing to unlock an AudioContext even
// after a real user gesture, silently dropping every oscillator-based beep.
// A real HTML <audio> element backed by an actual file is unlocked far more
// reliably: playing (and immediately pausing) it inside a genuine gesture
// is the standard, broadly-supported trick, and looping a real file has no
// gaps the way re-triggering an oscillator on a setInterval can.
let sharedAlarmAudio: HTMLAudioElement | null = null
const getAlarmAudio = (): HTMLAudioElement | null => {
  try {
    if (!sharedAlarmAudio) {
      sharedAlarmAudio = new Audio('/alarm-buzzer.wav')
      sharedAlarmAudio.loop = true
      sharedAlarmAudio.preload = 'auto'
    }
    return sharedAlarmAudio
  } catch {
    return null
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('rice_n_rooster_sounds');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('rice_n_rooster_sounds', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  // Browsers only allow an AudioContext to start/resume in direct response to
  // a user gesture. The low-stock alarm fires automatically (right after
  // login, or on opening the Inventory tab) — by the time that effect runs,
  // any earlier click has often already fallen outside the gesture window,
  // so the very first alarm can end up silently muted. Unlocking the shared
  // context on the *first* tap/click/key anywhere in the app (e.g. typing
  // into the login form, before Dashboard even mounts) means it's already
  // running well before an automatic alarm ever tries to play.
  useEffect(() => {
    // Calling resume() alone is not always enough inside strict in-app
    // WebViews (e.g. WhatsApp's browser on iOS): the JS-level state flips to
    // 'running' but the underlying native audio session can stay closed
    // until an actual sound has been played through it. Playing one
    // silent buffer synchronously inside the gesture handler forces that
    // audio route open, so later automatic sounds (the low-stock alarm)
    // are audible even though nothing was heard on this first tap.
    // Only the very first gesture needs to do the real work — once the
    // audio route is open it stays open, so re-running the play/pause dance
    // on every subsequent tap or keystroke (e.g. while typing a password)
    // was pure risk for no benefit.
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      unlocked = true

      const ctx = getAudioContext()
      if (ctx) {
        try {
          const buffer = ctx.createBuffer(1, 1, 22050)
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.start(0)
        } catch {
          // ignore — best-effort unlock
        }
      }

      const audio = getAlarmAudio()
      if (audio) {
        // Muted, because play() is asynchronous — actual audio can start
        // rendering before the .then() callback below runs pause(), which
        // was audible as a brief stray beep on the first tap/keystroke
        // anywhere in the app (e.g. right after opening the site link, or
        // while typing login credentials).
        audio.muted = true
        const playAttempt = audio.play()
        if (playAttempt && typeof playAttempt.then === 'function') {
          playAttempt.then(() => {
            audio.pause()
            audio.currentTime = 0
            audio.muted = false
          }).catch(() => {
            // Autoplay still refused outside a gesture window — later
            // startAlarmLoop() calls will just try again directly.
            audio.muted = false
          })
        } else {
          audio.muted = false
        }
      }
    }
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'touchend', 'click']
    events.forEach(evt => document.addEventListener(evt, unlock, { passive: true }))
    return () => { events.forEach(evt => document.removeEventListener(evt, unlock)) }
  }, []);

  const play = (type: SoundType) => {
    if (!soundEnabled) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'alert') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'bell') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.setValueAtTime(0.3, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'buzzer') {
        // Urgent two-tone siren, as loud as Web Audio allows — used for the
        // persistent low-stock alarm, distinct from the short 'alert' beep.
        // A second oscillator one octave up (through its own gain, summed
        // into the same destination) makes it read as louder and more
        // piercing than a single tone at max gain would alone.
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.15);
        osc.frequency.setValueAtTime(880, now + 0.3);
        osc.frequency.setValueAtTime(660, now + 0.45);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.9, now + 0.02);
        gain.gain.setValueAtTime(0.9, now + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1760, now);
        osc2.frequency.setValueAtTime(1320, now + 0.15);
        osc2.frequency.setValueAtTime(1760, now + 0.3);
        osc2.frequency.setValueAtTime(1320, now + 0.45);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.5, now + 0.02);
        gain2.gain.setValueAtTime(0.5, now + 0.55);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc2.start(now);
        osc2.stop(now + 0.7);
      }
    } catch (e) {
      console.warn('Audio API not supported or user not interacted yet.', e);
    }
  };

  const startAlarmLoop = () => {
    if (!soundEnabled) return;
    const audio = getAlarmAudio();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // If this specific call is still refused (e.g. the very first alarm
      // fires before any gesture at all has happened yet), the oscillator
      // path below at least gives a chance of an audible fallback.
      play('buzzer');
    });
  };

  const stopAlarmLoop = () => {
    if (!sharedAlarmAudio) return;
    sharedAlarmAudio.pause();
    sharedAlarmAudio.currentTime = 0;
  };

  return (
    <SoundContext.Provider value={{ play, soundEnabled, setSoundEnabled, startAlarmLoop, stopAlarmLoop }}>
      {children}
    </SoundContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
