/**
 * Server-side rendering client and image compression utilities.
 */

import { getRenderApiUrl, hasRenderApiBaseUrl } from './renderApi';

export const fetchWithTimeout = async (input, init = {}, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const blobToImageElement = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')); };
    img.src = url;
  });
};

export const compressImageBlob = async (blob, maxEdge = 1600, quality = 0.82) => {
  const img = await blobToImageElement(blob);
  const width = img.width;
  const height = img.height;
  const largest = Math.max(width, height);
  const scale = largest > maxEdge ? maxEdge / largest : 1;
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const out = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  return out || blob;
};

/**
 * Check if the render API server is healthy.
 */
export const checkServerHealth = async () => {
  if (!hasRenderApiBaseUrl()) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1200);
    const r = await fetch(getRenderApiUrl('/health'), { signal: controller.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return false;
    const data = await r.json().catch(() => null);
    return !!data?.ok;
  } catch {
    return false;
  }
};

/**
 * Upload photos to the server-side render API and get back a video blob.
 *
 * @param {Object} opts
 * @param {Array}  opts.orderedMedia
 * @param {string} opts.resolution
 * @param {boolean} opts.bgmEnabled
 * @param {number} opts.bgmVolume
 * @param {Function} opts.onProgress
 * @param {Function} opts.onStatus - status text callback
 * @returns {Promise<{ blob: Blob, mimeType: string } | { error: string }>}
 */
export const serverRender = async ({
  orderedMedia,
  resolution = '720p',
  bgmEnabled = true,
  bgmVolume = 0.35,
  onProgress = () => {},
  onStatus = () => {}
}) => {
  const photos = orderedMedia.filter(m => m.type === 'photo' && typeof m.url === 'string');
  if (photos.length === 0) {
    return { error: '没有可用于生成的视频图片素材' };
  }

  const form = new FormData();
  for (let i = 0; i < photos.length; i += 1) {
    onStatus(`正在准备第 ${i + 1}/${photos.length} 张图片`);
    const resp = await fetchWithTimeout(photos[i].url, {}, 15000);
    const blob = await resp.blob();
    const compressed = await compressImageBlob(blob, resolution === '1080p' ? 1920 : 1600, 0.82);
    const file = new File([compressed], `img_${String(i).padStart(4, '0')}.jpg`, { type: 'image/jpeg' });
    form.append('files', file);
    onProgress(Math.round(((i + 1) / photos.length) * 25));
  }
  form.append('resolution', resolution);
  form.append('perImageSec', '2');
  form.append('audioVolume', String(bgmEnabled ? Math.max(0.02, bgmVolume * 0.4) : 0));

  let r = null;
  let lastText = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    onStatus(attempt === 1 ? '正在上传并合成视频…' : '网络波动，正在重试上传…');
    try {
      r = await fetchWithTimeout(getRenderApiUrl('/api/render'), { method: 'POST', body: form }, 120000);
      if (r.ok) break;
      lastText = await r.text();
    } catch {
      lastText = 'request timeout';
    }
  }

  if (!r || !r.ok) {
    return { error: `服务端生成失败：${String(lastText).slice(0, 400) || '网络连接超时'}` };
  }

  const outBlob = await r.blob();
  if (!outBlob || outBlob.size === 0) {
    return { error: '服务端生成失败：输出为空' };
  }

  return { blob: outBlob, mimeType: outBlob.type || 'video/mp4' };
};

export const exportBlobAsFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
};
