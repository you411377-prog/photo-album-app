/**
 * Canvas-based video rendering engine.
 * Draws photo slideshows with transitions, text overlays, and records to video blob.
 */

// --- Utility helpers ---

export const seeded01 = (seed) => {
  let x = (seed >>> 0) + 0x6d2b79f5;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = src;
  });
};

export const sleepFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

export const chooseRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find(t => MediaRecorder.isTypeSupported?.(t)) || '';
};

export const isLikelySafariFamily = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isOtherBrowserShell = /CriOS|Chrome|Chromium|EdgiOS|Edg|Firefox|FxiOS|OPiOS/i.test(ua);
  return isAppleDevice && isWebKit && !isOtherBrowserShell;
};

// --- Drawing helpers ---

export const drawRoundedRect = (ctx, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

export const drawImageCover = (ctx, w, h, img, scale, shiftX, shiftY, opacity, slideX) => {
  ctx.save();
  ctx.globalAlpha = opacity;
  if (!img) {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  const iw = img.width;
  const ih = img.height;
  const ir = iw / ih;
  const tr = w / h;
  let dw = w;
  let dh = h;
  if (ir > tr) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }

  dw *= scale;
  dh *= scale;
  const dx = (w - dw) / 2 + shiftX * w * 0.12 + (slideX || 0);
  const dy = (h - dh) / 2 + shiftY * h * 0.12;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
};

// --- Text / narration generation ---

export const formatDateTimeLine = (media) => {
  const date = media?.date || '';
  const time = media?.time || '';
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  return '';
};

export const inferLocationLine = (media) => {
  if (media?.location) return media.location;
  if (media?.gps && typeof media.gps.lat === 'number' && typeof media.gps.lon === 'number') {
    return `${media.gps.lat.toFixed(4)}, ${media.gps.lon.toFixed(4)}`;
  }
  return '';
};

export const buildNarrationLine = ({ tone, styleId, media, index, total }) => {
  const when = formatDateTimeLine(media);
  const where = inferLocationLine(media);
  const seed = (media?.id ?? 0) + index * 97 + total * 131;
  const r = seeded01(seed);
  const pick = (arr) => arr[Math.floor(r * arr.length) % arr.length];

  const base = {
    warm: ['轻轻翻开这一页', '把日子收进心里', '这一刻刚刚好', '像风一样掠过，却很难忘'],
    travel: ['路上的风景不止在远方', '脚步到过的地方都会发光', '把远行变成一段故事', '地图之外，还有心动'],
    couple: ['甜蜜在细节里发芽', '心动从来不是偶然', '把爱写进日常', '相视一笑就是答案'],
    vintage: ['岁月把我们雕刻得更温柔', '旧时光也会发亮', '把回忆酿成一杯酒', '慢慢走，慢慢爱']
  };

  const styleKey = styleId === 'travel' ? 'travel' : styleId === 'couple' ? 'couple' : styleId === 'vintage' ? 'vintage' : 'warm';
  const phrase = pick(base[styleKey]);
  const prefix = where ? `在${where}，` : '';
  const timePrefix = when ? `${when}，` : '';

  if (tone === '简约') return `${timePrefix}${prefix}${phrase}`.replace(/，$/, '');
  if (tone === '幽默') return `${timePrefix}${prefix}${pick(['这一帧很有味道', '此处值得二刷', '生活的彩蛋出现了', '这张图自带BGM'])}：${phrase}`;
  if (tone === '文艺') return `${timePrefix}${prefix}${pick(['光落在镜头里', '风把情绪吹开', '时间轻声说话', '心事藏进画面'])}，${phrase}。`;
  return `${timePrefix}${prefix}${phrase}。`;
};

export const generateTextBundle = (tone, { start, end, location, mediaCount }) => {
  const title = start && end ? `${start} - ${end} 的回忆` : '我的回忆录';
  const place = location ? `在${location}，` : '';
  const count = `${mediaCount} 个片段`;

  if (tone === '文艺') {
    return { title, intro: `${place}时间把日常织成了风景，${count}，都是我想珍藏的瞬间。`, ending: '愿这些温柔的片段，成为未来某天的光。' };
  }
  if (tone === '幽默') {
    return { title, intro: `${place}一不小心就攒了${count}，这不是相册，这是时光的"连续剧"。`, ending: '下一集：继续努力制造快乐素材。' };
  }
  if (tone === '简约') {
    return { title, intro: `${place}${count}，按时间顺序整理完成。`, ending: '回忆已保存。' };
  }
  return { title, intro: `${place}把散落的日子收拢成一段故事，${count}，都是我们的闪光时刻。`, ending: '愿每一次回看，都能再次感受到当时的心动与温暖。' };
};

// --- Main render function ---

/**
 * Render a slideshow video from ordered media using Canvas + MediaRecorder.
 *
 * @param {Object} opts
 * @param {Array}  opts.orderedMedia - media items in display order
 * @param {string} opts.resolution - '720p' | '1080p'
 * @param {Object} opts.textBundle - { title, intro, ending }
 * @param {string} opts.textTone
 * @param {string} opts.styleId
 * @param {boolean} opts.bgmEnabled
 * @param {number} opts.bgmVolume
 * @param {string} opts.bgmPreset
 * @param {Function} opts.onProgress - called with (percent: number)
 * @param {Object}   opts.bgmModule - { createBgm } — lazy-loaded BGM module
 * @returns {Promise<{ blob: Blob, mimeType: string } | null>}
 */
export const renderVideo = async ({
  orderedMedia,
  resolution = '720p',
  textBundle,
  textTone = '温情',
  styleId = '',
  bgmEnabled = true,
  bgmVolume = 0.35,
  bgmPreset = 'warm',
  onProgress = () => {},
  bgmModule = null
}) => {
  const mimeType = chooseRecorderMimeType();
  if (!mimeType) return null;

  const isSafari = isLikelySafariFamily();
  const size = resolution === '1080p' ? { w: 1920, h: 1080 } : { w: 1280, h: 720 };
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  let started = false;
  let audioCtx = null;
  let stopBgm = null;

  try {
    const fps = 30;
    const perSec = 2.0;
    const transitionSec = 0.5;
    const perFrames = Math.max(1, Math.round(perSec * fps));
    const transFrames = Math.max(1, Math.round(transitionSec * fps));
    const durationSec = (orderedMedia.length * perFrames) / fps;

    // --- BGM setup ---
    if (bgmEnabled && bgmModule?.createBgm) {
      const Ctx = window.AudioContext || window['webkitAudioContext'];
      if (Ctx) {
        audioCtx = new Ctx();
        try { await audioCtx.resume(); } catch { /* noop */ }
        const destination = audioCtx.createMediaStreamDestination();
        stopBgm = bgmModule.createBgm({
          audioCtx, destination,
          durationSec: durationSec + 0.6,
          volume: bgmVolume,
          preset: bgmPreset
        });
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
    }

    // --- Start recorder ---
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise(resolve => { recorder.onstop = () => resolve(); });

    if (isSafari) {
      recorder.start();
    } else {
      recorder.start(250);
    }
    started = true;

    // --- Load images ---
    const photos = orderedMedia.filter(m => m.type === 'photo' && typeof m.url === 'string');
    const imageMap = new Map();
    for (let i = 0; i < photos.length; i += 1) {
      try {
        imageMap.set(photos[i].id, await loadImage(photos[i].url));
      } catch {
        imageMap.set(photos[i].id, null);
      }
      onProgress(Math.round(((i + 1) / Math.max(photos.length, 1)) * 30));
      await sleepFrame();
    }

    // --- Render frames ---
    for (let i = 0; i < orderedMedia.length; i += 1) {
      const media = orderedMedia[i];
      const nextMedia = orderedMedia[i + 1];
      const img = media.type === 'photo' ? (imageMap.get(media.id) ?? null) : null;
      const nextImg = nextMedia && nextMedia.type === 'photo' ? (imageMap.get(nextMedia.id) ?? null) : null;

      const seed = (media?.id ?? 0) + i * 131;
      const sx = seeded01(seed) - 0.5;
      const sy = seeded01(seed + 1) - 0.5;
      const nsx = nextMedia ? seeded01((nextMedia.id ?? 0) + (i + 1) * 131) - 0.5 : 0;
      const nsy = nextMedia ? seeded01((nextMedia.id ?? 0) + (i + 1) * 131 + 1) - 0.5 : 0;

      const line1 = formatDateTimeLine(media);
      const line2 = inferLocationLine(media);
      const line3 = buildNarrationLine({ tone: textTone, styleId, media, index: i, total: orderedMedia.length });

      for (let f = 0; f < perFrames; f += 1) {
        const t = f / Math.max(1, perFrames - 1);
        const scale = 1.06 + 0.06 * t;
        drawImageCover(ctx, size.w, size.h, img, scale, sx, sy, 1, 0);

        // Transition crossfade
        if (nextMedia && f >= perFrames - transFrames) {
          const p = (f - (perFrames - transFrames)) / transFrames;
          const nScale = 1.06;
          const slide = (1 - p) * size.w * 0.08;
          drawImageCover(ctx, size.w, size.h, nextImg, nScale, nsx, nsy, Math.min(1, Math.max(0, p)), slide);
        }

        // Text overlay
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        drawRoundedRect(ctx, 36, size.h - 230, size.w - 72, 176, 18);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText((textBundle.title || '我的回忆录').slice(0, 22), 64, size.h - 172);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        const meta = [line1, line2].filter(Boolean).join(' · ');
        if (meta) ctx.fillText(meta.slice(0, 42), 64, size.h - 132);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText(line3.slice(0, 42), 64, size.h - 92);
        ctx.restore();

        const pct = 30 + Math.round(((i + f / perFrames) / Math.max(orderedMedia.length, 1)) * 70);
        onProgress(Math.min(99, pct));
        await sleepFrame();
      }
    }

    // --- Finalize ---
    if (isSafari && recorder.state !== 'inactive') {
      await new Promise(resolve => setTimeout(resolve, 180));
      try { recorder.requestData(); } catch { /* noop */ }
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    recorder.stop();
    await stopped;
    if (stopBgm) stopBgm();
    if (audioCtx) { try { await audioCtx.close(); } catch { /* noop */ } }

    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) return null;

    return { blob, mimeType };
  } catch {
    if (started) { try { recorder.stop(); } catch { /* noop */ } }
    if (stopBgm) stopBgm();
    if (audioCtx) { try { await audioCtx.close(); } catch { /* noop */ } }
    return null;
  }
};
