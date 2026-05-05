/**
 * Background music module.
 * Tries to load a real mp3 from /bgm/ first; falls back to Web Audio synth.
 */

const BGM_FILES = {
  warm: ['/bgm/warm_1.mp3'],
  couple: ['/bgm/couple_1.mp3'],
  travel: ['/bgm/warm_1.mp3'],
  vintage: ['/bgm/vintage_1.mp3'],
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Create BGM that plays into a MediaStreamDestination (for recording).
 * Returns a stop() function.
 */
export const createBgm = ({ audioCtx, destination, durationSec, volume, preset }) => {
  const gain = audioCtx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  gain.connect(destination);

  const startAt = audioCtx.currentTime + 0.05;
  const endAt = startAt + Math.max(0.2, durationSec);

  // Fade envelope
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), startAt + 0.4);
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), Math.max(startAt + 0.4, endAt - 0.8));
  gain.gain.linearRampToValueAtTime(0, endAt);

  let stopped = false;
  let sourceNode = null;

  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    try { sourceNode?.stop(); } catch { /* noop */ }
    try { gain.disconnect(); } catch { /* noop */ }
  };

  // Try loading real mp3 — async, but start synth fallback immediately
  const files = BGM_FILES[preset] || BGM_FILES.warm;
  const url = pickRandom(files);

  // Start synth fallback right away (will be replaced if mp3 loads fast enough)
  const synthNodes = startSynthFallback(audioCtx, gain, startAt, endAt, preset);

  fetch(url)
    .then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(audioBuffer => {
      if (stopped) return;
      // Align switch timing to avoid pop on late mp3 load
      const switchAt = Math.max(startAt, audioCtx.currentTime + 0.03);
      // Fade synth out before stopping
      try { synthNodes.mix?.gain.linearRampToValueAtTime(0, switchAt); } catch { /* noop */ }
      synthNodes.stop(switchAt);
      // Play real audio aligned with synth stop
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.loop = true;
      sourceNode.connect(gain);
      sourceNode.start(switchAt, (switchAt - startAt) % audioBuffer.duration);
      sourceNode.stop(endAt);
    })
    .catch(() => {
      // Synth fallback is already playing — do nothing
    });

  return stopAll;
};

/**
 * Simple synth fallback (sine waves) — used when mp3 can't be loaded.
 */
function startSynthFallback(audioCtx, destinationGain, startAt, endAt, preset) {
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = preset === 'travel' ? 1800 : 1200;
  filter.Q.value = 0.7;
  filter.connect(destinationGain);

  const osc1 = audioCtx.createOscillator();
  osc1.type = preset === 'vintage' ? 'triangle' : 'sine';
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';

  const mix = audioCtx.createGain();
  mix.gain.value = 0.55;
  osc1.connect(mix);
  osc2.connect(mix);
  mix.connect(filter);

  const roots = preset === 'travel'
    ? [196.0, 220.0, 246.94, 261.63]
    : preset === 'couple'
      ? [220.0, 246.94, 261.63, 293.66]
      : preset === 'vintage'
        ? [174.61, 196.0, 220.0, 246.94]
        : [220.0, 196.0, 246.94, 220.0];

  const durationSec = endAt - startAt;
  const step = 2.0;
  for (let i = 0; i < Math.ceil(durationSec / step) + 1; i += 1) {
    const t = startAt + i * step;
    const root = roots[i % roots.length];
    osc1.frequency.setValueAtTime(root, t);
    osc2.frequency.setValueAtTime(root * 2, t);
  }

  osc1.start(startAt);
  osc2.start(startAt);
  osc1.stop(endAt);
  osc2.stop(endAt);

  return {
    mix,
    stop: (at) => {
      try { osc1.stop(at || 0); osc2.stop(at || 0); } catch { /* noop */ }
      try { mix.disconnect(); filter.disconnect(); } catch { /* noop */ }
    }
  };
}
