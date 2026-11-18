let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtor();
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.08,
  slideToFreq?: number,
  delaySec = 0
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideToFreq) {
    osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + durationSec);
  }

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export const soundFx = {
  jump(enabled: boolean) {
    if (!enabled) return;
    playTone(320, 0.13, 'triangle', 0.09, 620);
  },
  coin(enabled: boolean) {
    if (!enabled) return;
    playTone(740, 0.08, 'sine', 0.07, 980);
    playTone(980, 0.1, 'sine', 0.06, 1240, 0.06);
  },
  hit(enabled: boolean) {
    if (!enabled) return;
    playTone(190, 0.22, 'sawtooth', 0.07, 75);
  },
  flip(enabled: boolean) {
    if (!enabled) return;
    playTone(480, 0.06, 'triangle', 0.05, 560);
  },
  match(enabled: boolean) {
    if (!enabled) return;
    playTone(523.25, 0.09, 'sine', 0.08);
    playTone(659.25, 0.09, 'sine', 0.08, undefined, 0.08);
    playTone(783.99, 0.14, 'sine', 0.08, undefined, 0.16);
  },
  victory(enabled: boolean) {
    if (!enabled) return;
    playTone(523.25, 0.1, 'triangle', 0.09);
    playTone(659.25, 0.1, 'triangle', 0.09, undefined, 0.1);
    playTone(783.99, 0.1, 'triangle', 0.09, undefined, 0.2);
    playTone(1046.5, 0.26, 'triangle', 0.1, undefined, 0.3);
  },
  click(enabled: boolean) {
    if (!enabled) return;
    playTone(620, 0.04, 'sine', 0.04);
  },
};
