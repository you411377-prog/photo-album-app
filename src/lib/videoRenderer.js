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

const getSeason = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return '春';
  if (m >= 6 && m <= 8) return '夏';
  if (m >= 9 && m <= 11) return '秋';
  return '冬';
};

const SEASON_NAME = { 春: '春天', 夏: '夏天', 秋: '秋天', 冬: '冬天' };

// Phrase pools keyed by style, each with location-aware and standalone phrases
const PHRASES = {
  warm: {
    withPlace: [
      s => `${s.where}的${s.seasonName}，风里都是温柔`,
      s => `在${s.where}的那几天，日子过得很慢很慢`,
      s => `${s.where}的阳光下，一切都刚刚好`,
      s => `记得${s.where}那天，天空特别蓝`,
      s => `${s.where}的街道，走着走着就笑了`,
      s => `${s.where}的黄昏，美得像一场梦`,
      s => `那时候在${s.where}，连空气都是甜的`,
      s => `${s.where}的清晨，鸟叫声叫醒了整个城市`,
    ],
    standalone: [
      s => `那天下午的阳光，从窗帘缝里钻进来`,
      s => `说不清为什么，就是很喜欢这一刻`,
      s => `时间过得真快，还好有照片替我们记住`,
      s => `有些瞬间，看一眼就能回到当时`,
      s => `镜头定格的，就是生活最好的样子`,
      s => `不是每一天都精彩，但每一天都值得`,
      s => `这张照片里，藏着好多没说出口的话`,
      s => `日子普普通通，回忆却闪闪发光`,
      s => `${s.seasonName}的风，把记忆吹得很远`,
      s => `那个${s.seasonName}，发生了好多故事`,
      s => `${s.monthName}的光线，柔和得刚刚好`,
      s => `累了的时候，就翻翻这些老照片`,
      s => `生活最好的滤镜，就是时间`,
      s => `幸福藏在这些不起眼的角落里`,
    ],
  },
  travel: {
    withPlace: [
      s => `${s.where}，比想象中还要美`,
      s => `站在${s.where}的那一刻，觉得一切都值了`,
      s => `${s.where}的风景，相机拍不出十分之一`,
      s => `走了很远的路，才到了${s.where}`,
      s => `${s.where}的风，吹走了所有疲惫`,
      s => `在${s.where}，找到了久违的自由`,
      s => `${s.where}的日落，见过就不会忘`,
      s => `地图上的${s.where}，终于变成了脚下的路`,
    ],
    standalone: [
      s => `路上的风景，永远不止在远方`,
      s => `脚步到过的地方，都会发光`,
      s => `世界那么大，还好没有停下`,
      s => `出发的那一刻，故事就已经开始了`,
      s => `有些路，一个人走也很精彩`,
      s => `车窗外的风景，一张都不想错过`,
      s => `旅行的意义，就是遇见不一样的自己`,
      s => `下一站会是哪里？已经开始期待了`,
      s => `${s.seasonName}的旅途，每一帧都是明信片`,
      s => `背包很重，但心里很轻`,
      s => `陌生的城市，熟悉的感动`,
      s => `那些走过的路，都变成了故事`,
      s => `最好的风景，永远在路上`,
      s => `这一次，终于把远方变成了日常`,
    ],
  },
  couple: {
    withPlace: [
      s => `在${s.where}，和你一起看了最美的日落`,
      s => `${s.where}的那条街，我们来回走了好多遍`,
      s => `还记得${s.where}吗？那天你笑得很开心`,
      s => `${s.where}的风里，有我们两个人的秘密`,
      s => `在${s.where}，时间过得特别快`,
      s => `${s.where}的夜晚，星星都格外亮`,
      s => `和你在${s.where}，做什么都觉得有趣`,
      s => `${s.where}的咖啡馆，我们聊了一整个下午`,
    ],
    standalone: [
      s => `你笑起来的样子，比${s.seasonName}的花还好看`,
      s => `心动从来不是偶然，是每件小事加起来`,
      s => `爱情藏在这些琐碎的日常里`,
      s => `相视一笑的瞬间，就是最好的答案`,
      s => `甜蜜在细节里悄悄发芽`,
      s => `有你在身边，平凡的日子也会发光`,
      s => `两个人在一起，连发呆都是幸福的`,
      s => `这一年，我们一起走过了好多地方`,
      s => `喜欢一个人，就是想把每一天都分享给她`,
      s => `吵架也好，和好也好，都是我们的故事`,
      s => `${s.seasonName}的约会，每次都舍不得结束`,
      s => `你说过的话，我都好好收在心里`,
      s => `一起变老，听起来是最浪漫的事`,
      s => `谢谢你，出现在我的镜头里`,
    ],
  },
  vintage: {
    withPlace: [
      s => `${s.where}，还是记忆里的样子吗`,
      s => `那些年在${s.where}，留下了太多故事`,
      s => `${s.where}的老街，藏着回不去的时光`,
      s => `又想起${s.where}，那时候的我们真年轻`,
      s => `${s.where}的照片泛了黄，但回忆还是鲜活的`,
      s => `好久没回${s.where}了，有点想念`,
      s => `${s.where}的每个角落，都有一段往事`,
      s => `那时候的${s.where}，还不是现在的模样`,
    ],
    standalone: [
      s => `旧时光也会发亮，像老电影里的画面`,
      s => `岁月把我们雕刻得更温柔了`,
      s => `把回忆酿成一杯酒，越久越醇`,
      s => `慢慢走，慢慢爱，慢慢变老`,
      s => `那时候没有滤镜，但笑容是真实的`,
      s => `老照片有一种魔力，看一眼就穿越回去`,
      s => `有些东西变了，有些永远不会变`,
      s => `年轻的时候，总觉得日子还很长`,
      s => `泛黄的照片里，藏着最鲜活的青春`,
      s => `这些回忆啊，是时间偷不走的宝贝`,
      s => `回头看，那些苦的甜的，都变成了故事`,
      s => `${s.seasonName}又来了，和那一年一样`,
      s => `想念那个没有智能手机的年代`,
      s => `时间走得真快，还好我们走得不算太远`,
    ],
  },
};

const getPositionType = (index, total) => {
  if (index === 0) return 'open';
  if (index === total - 1) return 'close';
  if (index <= Math.floor(total * 0.3)) return 'early';
  if (index >= Math.ceil(total * 0.7)) return 'late';
  return 'mid';
};

const OPEN_PHRASES = [
  s => `故事，从${s.seasonName || '这一天'}开始`,
  s => `${s.seasonName || '时光'}的第一页，轻轻翻开`,
  s => `一切，都要从这里说起`,
  s => `最好的${s.seasonName || '日子'}，在这一刻启程`,
  s => `回忆的第一帧，总是最珍贵的`,
];

const CLOSE_PHRASES = [
  s => `故事到这里，但回忆还在继续`,
  s => `谢谢${s.seasonName || '时光'}，给了我们这么多好故事`,
  s => `这一页翻过去了，但记忆不会`,
  s => `最好的时光，永远是"那些年"`,
  s => `合上相册，感动还留在心里`,
  s => `这些片段，拼成了最好的${s.seasonName || '时光'}`,
];

export const buildNarrationLine = ({ tone, styleId, media, index, total }) => {
  const where = inferLocationLine(media);
  const date = media?.date || '';
  const season = getSeason(date);
  const seasonName = SEASON_NAME[season] || '';
  const monthName = date ? `${new Date(date).getMonth() + 1}月` : '';
  const pos = getPositionType(index, total);

  const seed = (media?.id ?? 0) + index * 97 + total * 131;
  const r = seeded01(seed);
  const pick = (arr) => arr[Math.floor(r * arr.length) % arr.length];

  const styleKey = styleId === 'travel' ? 'travel' : styleId === 'couple' ? 'couple' : styleId === 'vintage' ? 'vintage' : 'warm';
  const pool = PHRASES[styleKey] || PHRASES.warm;
  const ctx = { where, season, seasonName, monthName };

  let phrase;
  if (pos === 'open') {
    phrase = pick(OPEN_PHRASES)(ctx);
  } else if (pos === 'close') {
    phrase = pick(CLOSE_PHRASES)(ctx);
  } else if (where && seeded01(seed + 3) > 0.35) {
    phrase = pick(pool.withPlace)(ctx);
  } else {
    phrase = pick(pool.standalone)(ctx);
  }

  if (tone === '简约') return phrase.replace(/，/g, ' ');
  if (tone === '幽默') {
    const jokes = ['这一幕值得反复播放', '这帧自带BGM', '此处应该有弹幕', '名场面打卡', '生活的小彩蛋出现了', '这谁拍得这么好？哦是我', '截图当壁纸了'];
    return pick(jokes) + '——' + phrase;
  }
  if (tone === '文艺') {
    const prefixes = ['光落在回忆里，', '风把记忆吹开，', '时间轻声说，', '心事藏进画面，', '镜头记得，', '光影交错间，'];
    return pick(prefixes) + phrase;
  }
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

    const perSec = transitionParams[0]?.perSec ?? 2.0;
    const perFrames = Math.max(1, Math.round(perSec * fps));
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
        drawRoundedRect(ctx, 36, size.h - 30 - boxH, size.w - 72, boxH, 18);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        // Line 1: time
        ctx.font = 'bold 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText(timeText.slice(0, 22), 64, size.h - boxH + 28);
        // Line 2: location
        if (hasPlace) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.fillText(placeText.slice(0, 42), 64, size.h - boxH + 68);
        }
        // Line 3: narration
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText(line3.slice(0, 42), 64, size.h - boxH + (hasPlace ? 106 : 68));
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
