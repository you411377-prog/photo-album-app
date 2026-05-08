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

// --- Transition effects ---

const getDayGap = (a, b) => {
  if (!a?.date || !b?.date) return 0;
  const da = new Date(a.date); if (isNaN(da)) return 0;
  const db = new Date(b.date); if (isNaN(db)) return 0;
  return Math.abs((db - da) / 86400000);
};

const drawCrossfade = (ctx, w, h, img, nextImg, p, { sx, sy, nsx, nsy, t }) => {
  const scale = 1.06 + 0.06 * t;
  drawImageCover(ctx, w, h, img, scale, sx, sy, 1, 0);
  const nScale = 1.06;
  const slide = (1 - p) * w * 0.08;
  drawImageCover(ctx, w, h, nextImg, nScale, nsx, nsy, p, slide);
};

const drawSlideVertical = (ctx, w, h, img, nextImg, p, { sx, sy, nsx, nsy, t }) => {
  const scale = 1.06 + 0.06 * t;
  const curSlideY = -p * h * 0.3;
  drawImageCover(ctx, w, h, img, scale, sx, sy + curSlideY / (h * 0.12 || 1), 1 - p * 0.4, 0);
  const nScale = 1.06;
  const nextSlideY = (1 - p) * h * 0.3;
  drawImageCover(ctx, w, h, nextImg, nScale, nsx, nsy + nextSlideY / (h * 0.12 || 1), p, 0);
};

const drawZoomBlend = (ctx, w, h, img, nextImg, p, { sx, sy, nsx, nsy, t }) => {
  const curScale = 1.06 + 0.06 * t + p * 0.18;
  drawImageCover(ctx, w, h, img, curScale, sx, sy, 1 - p, 0);
  const nScale = 0.88 + p * 0.18;
  drawImageCover(ctx, w, h, nextImg, nScale, nsx, nsy, p, 0);
};

const drawFadeToBlack = (ctx, w, h, img, nextImg, p, { sx, sy, nsx, nsy, t }) => {
  const mid = 0.5;
  if (p < mid) {
    const q = p / mid;
    const scale = 1.06 + 0.02 * t - q * 0.04;
    drawImageCover(ctx, w, h, img, scale, sx, sy, 1 - q, 0);
    ctx.save(); ctx.globalAlpha = q * 0.85; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore();
  } else {
    ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore();
    const q = (p - mid) / mid;
    const scale = 1.12 - q * 0.06;
    drawImageCover(ctx, w, h, nextImg, scale, nsx, nsy, q, 0);
    ctx.save(); ctx.globalAlpha = (1 - q) * 0.85; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.restore();
  }
};

const TRANSITION_DRAW = {
  crossfade: drawCrossfade,
  slideVertical: drawSlideVertical,
  zoomBlend: drawZoomBlend,
  fadeToBlack: drawFadeToBlack,
};

const computeTransitionParams = ({ media, nextMedia, styleId, index, total, textTone, prevType }) => {
  let basePerSec;
  switch (styleId) {
    case 'travel': basePerSec = 1.8; break;
    case 'vintage': basePerSec = 2.4; break;
    case 'couple': basePerSec = 2.2; break;
    default: basePerSec = 2.0;
  }
  if (total > 20) basePerSec = Math.max(1.5, basePerSec - 0.5);
  else if (total < 8) basePerSec = Math.min(2.8, basePerSec + 0.4);
  if (textTone === '文艺') basePerSec += 0.2;
  else if (textTone === '幽默') basePerSec = Math.max(1.4, basePerSec - 0.2);
  const perSec = Math.round(basePerSec * 10) / 10;

  let minDur, maxDur;
  switch (styleId) {
    case 'vintage': minDur = 0.6; maxDur = 0.85; break;
    case 'travel': minDur = 0.3; maxDur = 0.5; break;
    case 'warm': minDur = 0.4; maxDur = 0.65; break;
    case 'couple': minDur = 0.45; maxDur = 0.7; break;
    default: minDur = 0.4; maxDur = 0.6;
  }
  const dateGap = getDayGap(media, nextMedia);
  if (dateGap > 30) { minDur = 0.3; maxDur = 0.45; }
  else if (dateGap > 7) { maxDur = Math.min(maxDur, 0.55); }

  const seed = (media?.id ?? 0) + index * 173;
  const r = seeded01(seed);
  const durationSec = Math.round((minDur + r * (maxDur - minDur)) * 100) / 100;

  let pool;
  if (dateGap > 30) {
    pool = ['fadeToBlack', 'crossfade', 'slideVertical'];
  } else if (styleId === 'travel') {
    pool = ['slideVertical', 'crossfade', 'crossfade', 'zoomBlend'];
  } else if (styleId === 'vintage') {
    pool = ['fadeToBlack', 'crossfade', 'crossfade', 'zoomBlend'];
  } else if (styleId === 'couple') {
    pool = ['zoomBlend', 'zoomBlend', 'crossfade', 'slideVertical'];
  } else {
    pool = ['crossfade', 'crossfade', 'slideVertical', 'zoomBlend', 'fadeToBlack'];
  }
  const filtered = pool.filter(t => t !== prevType);
  const candidates = filtered.length > 0 ? filtered : pool;
  const typeIdx = Math.floor(seeded01(seed + 1) * candidates.length);
  const type = candidates[typeIdx];

  return { type, durationSec, perSec };
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

const getSeason = (d) => { if (!d) return ''; const m = new Date(d).getMonth() + 1; if (isNaN(m)) return ''; return m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬'; };
const SN = { 春: '春天', 夏: '夏天', 秋: '秋天', 冬: '冬天' };

const P = {
  warm: ['{w}的{s}，风里都是温柔', '在{w}的那几天，日子过得很慢', '那天下午阳光从窗帘缝里钻进来', '有些瞬间看一眼就能回到当时', '日子普普通通回忆却闪闪发光', '{s}的风把记忆吹得很远', '时间过得真快还好有照片替我们记住', '镜头定格的就是生活最好的样子'],
  travel: ['{w}，比想象中还要美', '站在{w}的那一刻觉得一切都值了', '路上的风景永远不止在远方', '出发的那一刻故事就已经开始了', '旅行的意义就是遇见不一样的自己', '{s}的旅途每一帧都是明信片', '那些走过的路都变成了故事', '最好的风景永远在路上'],
  couple: ['在{w}和你一起看了最美的日落', '{w}的那条街我们来回走了好多遍', '你笑起来的样子比{s}的花还好看', '心动从来不是偶然是每件小事加起来', '有你在身边平凡的日子也会发光', '{s}的约会每次都舍不得结束', '谢谢你出现在我的镜头里', '两个人在一起连发呆都是幸福的'],
  vintage: ['{w}还是记忆里的样子吗', '那些年在{w}留下了太多故事', '旧时光也会发亮像老电影里的画面', '岁月把我们雕刻得更温柔了', '把回忆酿成一杯酒越久越醇', '泛黄的照片里藏着最鲜活的青春', '这些回忆啊是时间偷不走的宝贝', '回头看那些苦的甜的变成了故事'],
};
const PO = ['故事从{sn}开始', '{sn}的第一页轻轻翻开', '一切都要从这里说起'];
const PC = ['故事到这里但回忆还在继续', '谢谢{sn}给了我们这么多好故事', '这些片段拼成了最好的{sn}'];

export const buildNarrationLine = ({ tone, styleId, media, index, total }) => {
  const where = inferLocationLine(media) || '';
  const sn = SN[getSeason(media?.date || '')] || '时光';
  const seed = (media?.id ?? 0) + index * 97 + total * 131;
  const r = seeded01(seed);
  const pick = (arr) => arr[Math.floor(r * arr.length) % arr.length];
  const key = styleId === 'travel' ? 'travel' : styleId === 'couple' ? 'couple' : styleId === 'vintage' ? 'vintage' : 'warm';
  const pool = P[key] || P.warm;

  let phrase;
  if (index === 0) phrase = pick(PO);
  else if (index === total - 1) phrase = pick(PC);
  else phrase = pick(pool);

  phrase = phrase.replace(/{w}/g, where || '这里').replace(/{s}/g, sn).replace(/{sn}/g, sn);

  if (tone === '简约') return phrase;
  if (tone === '幽默') return pick(['这一幕值得反复播放', '这帧自带BGM', '此处应该有弹幕', '名场面打卡', '生活的小彩蛋出现了']) + '——' + phrase;
  if (tone === '文艺') return pick(['光落在回忆里', '风把记忆吹开', '时间轻声说', '心事藏进画面', '镜头记得', '光影交错间']) + '，' + phrase;
  return phrase;
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
  photoSpeed = 'medium',
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
  const bps = resolution === '1080p' ? 8_000_000 : 4_000_000;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bps });
  const chunks = [];
  let started = false;
  let audioCtx = null;
  let stopBgm = null;

  try {
    const fps = 30;

    // Pre-compute transition params for all slide pairs
    const transitionParams = [];
    for (let i = 0; i < orderedMedia.length; i += 1) {
      const prevType = i > 0 ? transitionParams[i - 1].type : '';
      transitionParams.push(computeTransitionParams({
        media: orderedMedia[i],
        nextMedia: orderedMedia[i + 1] || null,
        styleId, index: i, total: orderedMedia.length, textTone, prevType
      }));
    }

    const perSec = photoSpeed === 'fast' ? 1.5 : photoSpeed === 'slow' ? 5.0 : 3.0;
    const perFrames = Math.max(1, Math.round(perSec * fps));
    const openingDurSec = 3;
    const endingDurSec = 3;
    const durationSec = openingDurSec + (orderedMedia.length * perFrames) / fps + endingDurSec;

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
      onProgress(5 + Math.round(((i + 1) / Math.max(photos.length, 1)) * 25));
      await sleepFrame();
    }

    // --- Opening title screen (3 seconds) ---
    const openingFrames = fps * openingDurSec;
    for (let f = 0; f < openingFrames; f += 1) {
      const t = f / openingFrames;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, size.w, size.h);

      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 3);

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(size.w * 0.04)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText((textBundle?.title || '我的回忆录').slice(0, 30), size.w / 2, size.h * 0.4);

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `${Math.round(size.w * 0.022)}px system-ui, -apple-system, sans-serif`;
      const introText = (textBundle?.intro || '').slice(0, 60);
      ctx.fillText(introText, size.w / 2, size.h * 0.52);

      ctx.textAlign = 'left';
      ctx.restore();

      onProgress(Math.round((f / openingFrames) * 5));
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

      const tParams = transitionParams[i];
      const transFrames = nextMedia ? Math.max(1, Math.round(tParams.durationSec * fps)) : 0;
      const drawTransition = TRANSITION_DRAW[tParams.type] || drawCrossfade;

      for (let f = 0; f < perFrames; f += 1) {
        const t = f / Math.max(1, perFrames - 1);

        if (!nextMedia || f < perFrames - transFrames) {
          // Main display: Ken Burns with style-adjusted zoom range
          const zoomRange = styleId === 'vintage' ? 0.04 : styleId === 'travel' ? 0.08 : 0.06;
          const scale = 1.04 + zoomRange * t;
          drawImageCover(ctx, size.w, size.h, img, scale, sx, sy, 1, 0);
        } else {
          // Transition
          const p = (f - (perFrames - transFrames)) / transFrames;
          drawTransition(ctx, size.w, size.h, img, nextImg, Math.min(1, p), { sx, sy, nsx, nsy, t });
        }

        // Text overlay: time / location / narration
        const timeText = line1 || '';
        const placeText = line2 || '';
        ctx.save();
        ctx.globalAlpha = 0.95;
        const hasPlace = !!placeText;
        const boxH = hasPlace ? 176 : 140;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        const safeL = 80;
        const safeR = 80;
        const safeB = 60;
        const boxW = size.w - safeL - safeR;
        drawRoundedRect(ctx, safeL, size.h - safeB - boxH, boxW, boxH, 18);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        // Line 1: time
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
        ctx.fillText(timeText.slice(0, 22), safeL + 28, size.h - safeB - boxH + 40);
        // Line 2: location
        if (hasPlace) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '28px system-ui, -apple-system, sans-serif';
          ctx.fillText(placeText.slice(0, 42), safeL + 28, size.h - safeB - boxH + 80);
        }
        // Line 3: narration
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '28px system-ui, -apple-system, sans-serif';
        ctx.fillText(line3.slice(0, 42), safeL + 28, size.h - safeB - boxH + (hasPlace ? 118 : 80));
        ctx.restore();

        const pct = 30 + Math.round(((i + f / perFrames) / Math.max(orderedMedia.length, 1)) * 65);
        onProgress(Math.min(99, pct));
        await sleepFrame();
      }
    }

    // --- Ending screen (3 seconds) ---
    const endingFrames = fps * endingDurSec;
    for (let f = 0; f < endingFrames; f += 1) {
      const t = f / endingFrames;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, size.w, size.h);

      ctx.save();
      const fadeOut = f > endingFrames * 0.7 ? 1 - (f - endingFrames * 0.7) / (endingFrames * 0.3) : 1;
      ctx.globalAlpha = Math.min(1, t * 3) * fadeOut;

      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(size.w * 0.026)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText((textBundle?.ending || '').slice(0, 50), size.w / 2, size.h * 0.48);

      ctx.textAlign = 'left';
      ctx.restore();

      onProgress(Math.min(99, 95 + Math.round((f / endingFrames) * 4)));
      await sleepFrame();
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
