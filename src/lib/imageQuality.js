/**
 * Real image quality assessment.
 *
 * Computes a 0-1 score combining:
 *   - Sharpness via Laplacian variance (the classic blur metric)
 *   - Exposure via mean brightness (penalizes very dark / very bright)
 *
 * Designed to run in the browser on a small downsampled bitmap (64x64),
 * so the whole batch finishes in tens of milliseconds for typical inputs.
 */

const SAMPLE_EDGE = 64;

const loadFromUrl = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image load failed'));
  img.src = url;
});

const getBitmap = async (source) => {
  if (source instanceof Blob || source instanceof File) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(source); } catch { /* fallthrough */ }
    }
    const url = URL.createObjectURL(source);
    try { return await loadFromUrl(url); } finally { URL.revokeObjectURL(url); }
  }
  if (typeof source === 'string') {
    return await loadFromUrl(source);
  }
  throw new Error('unsupported source');
};

const drawToGrayBuffer = (bitmap) => {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_EDGE;
  canvas.height = SAMPLE_EDGE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
  const gray = new Float32Array(SAMPLE_EDGE * SAMPLE_EDGE);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
};

/**
 * Laplacian (3x3, [0,1,0; 1,-4,1; 0,1,0]) variance — higher = sharper.
 */
const laplacianVariance = (gray) => {
  const w = SAMPLE_EDGE;
  const lap = new Float32Array(w * w);
  let sum = 0;
  let count = 0;
  for (let y = 1; y < w - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = y * w + x;
      const v = -4 * gray[idx]
        + gray[idx - 1] + gray[idx + 1]
        + gray[idx - w] + gray[idx + w];
      lap[idx] = v;
      sum += v;
      count += 1;
    }
  }
  const mean = sum / count;
  let varSum = 0;
  for (let y = 1; y < w - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = y * w + x;
      const d = lap[idx] - mean;
      varSum += d * d;
    }
  }
  return varSum / count;
};

const meanBrightness = (gray) => {
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) sum += gray[i];
  return sum / gray.length; // 0-255
};

/**
 * Map raw metrics to a 0-1 score.
 *   - sharpness: variance is unbounded; soft-cap at ~600 for "very sharp"
 *   - exposure: peak score at brightness ~128, falls off toward 0/255
 */
const combineScore = (variance, brightness) => {
  const sharpness = Math.min(1, variance / 600);

  // Exposure penalty: tent function centered at 128, full credit in [60, 200]
  let exposure;
  if (brightness < 60) exposure = Math.max(0, brightness / 60);
  else if (brightness > 200) exposure = Math.max(0, (255 - brightness) / 55);
  else exposure = 1;

  // Weighted blend; sharpness dominates
  const raw = 0.75 * sharpness + 0.25 * exposure;
  return Number(Math.min(1, Math.max(0, raw)).toFixed(2));
};

/**
 * Compute a real quality score for a single image source (Blob/File/URL).
 * Returns a number in [0, 1]. Falls back to 0.6 on any failure so the item
 * is not unfairly punished when assessment cannot run (e.g. CORS-tainted).
 */
export const assessImageQuality = async (source) => {
  try {
    const bitmap = await getBitmap(source);
    const gray = drawToGrayBuffer(bitmap);
    if (!gray) return 0.6;
    const variance = laplacianVariance(gray);
    const brightness = meanBrightness(gray);
    return combineScore(variance, brightness);
  } catch {
    return 0.6;
  }
};

/**
 * Compute quality scores for many media items in parallel-with-concurrency.
 * Mutates each item with `qualityScore` and returns the same array.
 *
 * Items without a usable url (e.g. videos) get a neutral 0.6.
 */
export const assessMediaBatch = async (mediaList, { concurrency = 4, onProgress } = {}) => {
  const total = mediaList.length;
  let done = 0;
  const queue = mediaList.slice();
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      if (item.type !== 'photo' || typeof item.url !== 'string') {
        item.qualityScore = 0.6;
      } else {
        item.qualityScore = await assessImageQuality(item.url);
      }
      done += 1;
      onProgress?.(done, total);
    }
  });
  await Promise.all(workers);
  return mediaList;
};
