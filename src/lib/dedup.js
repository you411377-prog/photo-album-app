/**
 * Image fingerprinting and deduplication utilities.
 */

const loadImageFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
};

const getImageBitmapFromFile = async (file) => {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImageFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Compute a perceptual hash (8x8 average-based) from an image File.
 * Returns an integer fingerprint.
 */
export const computeFingerprint = async (file) => {
  const bitmap = await getImageBitmapFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const size = 8;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(bitmap, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const grays = [];
  let sum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grays.push(gray);
    sum += gray;
  }

  const avg = sum / grays.length;
  let acc = 0;
  for (let i = 0; i < grays.length; i += 1) {
    acc = (acc * 2 + (grays[i] >= avg ? 1 : 0)) % 2147483647;
  }
  return acc;
};

/**
 * Build a dedup grouping key from media metadata.
 * Strength controls grouping granularity:
 *   81-100: date + location + people (most aggressive)
 *   41-80:  date only
 *   1-40:   year-month only
 *   0:      no dedup (empty key for each item = all unique)
 */
export const buildDedupKey = (media, strength = 80) => {
  if (!strength) return `${media.id}`;
  const date = media.date ?? '';
  const location = media.location ?? '';
  const peopleKey = Array.isArray(media.personIds)
    ? media.personIds.join('-')
    : (Array.isArray(media.people) ? media.people.join('-') : '');

  if (strength > 80) return `${date}|${location}|${peopleKey}`;
  if (strength > 40) return date;
  // strength 1-40: group by year-month only
  const ym = typeof date === 'string' && date.length >= 7 ? date.slice(0, 7) : date;
  return ym;
};

/**
 * Compute a quality score for a media item.
 * Currently uses a deterministic hash — to be replaced with real blur/exposure detection.
 */
export const computeQualityScore = (media) => {
  const base = ((media.id * 2654435761) >>> 0) % 1000;
  const v = 0.2 + (base / 1000) * 0.8;
  return Number(v.toFixed(2));
};

/**
 * Group media items by dedup key and apply quality scoring.
 * Returns array of { key, items[] } where items are sorted by quality descending.
 */
export const groupByDuplicate = (mediaList, strength = 80) => {
  const map = new Map();
  mediaList.forEach(m => {
    const key = buildDedupKey(m, strength);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  });
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    items: items
      .map(it => ({ ...it, qualityScore: computeQualityScore(it) }))
      .sort((a, b) => b.qualityScore - a.qualityScore)
  }));
};

/**
 * Apply dedup + quality filtering to produce final media list.
 * dedupKeep: { [groupKey]: Set<id> } — each group can keep multiple items.
 */
export const applyDedupAndQuality = (
  grouped,
  { enableDedup = true, enableQuality = true, qualityThreshold = 0.4, dedupKeep = {} }
) => {
  let removedByDedup = 0;
  const dedupRemovedItems = [];

  const flattened = grouped.flatMap(g => {
    if (!enableDedup) return g.items;
    if (g.items.length <= 1) return g.items;

    const keepSet = dedupKeep[g.key];
    const keepIds = keepSet instanceof Set ? keepSet
      : Array.isArray(keepSet) ? new Set(keepSet)
      : new Set([keepSet ?? g.items[0].id]);

    const kept = [];
    g.items.forEach(it => {
      if (keepIds.has(it.id)) {
        kept.push(it);
      } else {
        removedByDedup += 1;
        dedupRemovedItems.push(it);
      }
    });
    return kept;
  });

  const qualityFiltered = enableQuality
    ? flattened.filter(m => m.qualityScore >= qualityThreshold)
    : flattened;

  const qualityRemovedItems = enableQuality
    ? flattened.filter(m => m.qualityScore < qualityThreshold)
    : [];

  const removedByQuality = qualityRemovedItems.length;

  const finalMedia = qualityFiltered.map(m => {
    const { qualityScore: _qs, ...rest } = m;
    return rest;
  });

  return {
    finalMedia,
    removedByDedupCount: enableDedup ? removedByDedup : 0,
    removedByQualityCount: removedByQuality,
    dedupRemovedItems,
    qualityRemovedItems,
  };
};
