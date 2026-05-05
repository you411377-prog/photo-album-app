/**
 * Background music module.
 * Tries to load a real mp3 from /bgm/ first; falls back to Web Audio synth only on failure.
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
  gain.gain.value = 0; // Start silent, fade in after source is ready
  gain.connect(destination);

  const startAt = audioCtx.currentTime + 0.05;
  const endAt = startAt + Math.max(0.2, durationSec);

  let stopped = false;
  let sourceNode = null;
  let synthNodes = null;

  const applyFadeEnvelope = () => {
    gain.gain.cancelScheduledValues(audioCtx.currentTime);
    const now = audioCtx.currentTime;
    const fadeStart = Math.max(now, startAt);
    gain.gain.setValueAtTime(0, fadeStart);
    gain.gain.linearRampToValueAtTime(volume, fadeStart + 0.6);
    gain.gain.setValueAtTime(volume, Math.max(fadeStart + 0.6, endAt - 0.8));
    gain.gain.linearRampToValueAtTime(0, endAt);
  };

  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    try { sourceNode?.stop(); } catch { /* noop */ }
    try { synthNodes?.stop(); } catch { /* noop */ }
    try { gain.disconnect(); } catch { /* noop */ }
  };

  const files = BGM_FILES[preset] || BGM_FILES.warm;
  const url = pickRandom(files);

  // Try loading mp3 with 2-second timeout — only start synth on failure
  const loadTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));

  Promise.race([
    fetch(url).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); }),
    loadTimeout
  ])
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(audioBuffer => {
      if (stopped) return;
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.loop = true;
      sourceNode.connect(gain);
      sourceNode.start(Math.max(audioCtx.currentTime, startAt));
      sourceNode.stop(endAt);
      applyFadeEnvelope();
    })
    .catch(() => {
      if (stopped) return;
      // mp3 failed — start synth fallback
      synthNodes = startSynthFallback(audioCtx, gain, Math.max(audioCtx.currentTime, startAt), endAt, preset);
      applyFadeEnvelope();
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

  const dur = endAt - startAt;
  const step = 2.0;
  for (let i = 0; i < Math.ceil(dur / step) + 1; i += 1) {
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
