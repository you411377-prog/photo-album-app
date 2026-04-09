import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildShareUrl,
  createShareId,
  isSupabaseConfigured,
  saveMemoirProject,
  supabaseConfigMessage
} from '../lib/supabase';
import { getRenderApiUrl } from '../lib/renderApi';
import './GeneratePage.css';

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = src;
  });
};

const chooseRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  const supported = candidates.find(t => MediaRecorder.isTypeSupported?.(t));
  return supported || '';
};

const sleepFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

const seeded01 = (seed) => {
  let x = (seed >>> 0) + 0x6d2b79f5;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

const drawImageCover = (ctx, w, h, img, scale, shiftX, shiftY, opacity, slideX) => {
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

const formatDateTimeLine = (media) => {
  const date = media?.date || '';
  const time = media?.time || '';
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  return '';
};

const inferLocationLine = (media) => {
  if (media?.location) return media.location;
  if (media?.gps && typeof media.gps.lat === 'number' && typeof media.gps.lon === 'number') {
    return `${media.gps.lat.toFixed(4)}, ${media.gps.lon.toFixed(4)}`;
  }
  return '';
};

const buildNarrationLine = ({ tone, styleId, media, index, total }) => {
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

const createBgm = ({ audioCtx, destination, durationSec, volume, preset }) => {
  const gain = audioCtx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  gain.connect(destination);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = preset === 'travel' ? 1800 : 1200;
  filter.Q.value = 0.7;
  filter.connect(gain);

  const osc1 = audioCtx.createOscillator();
  osc1.type = preset === 'vintage' ? 'triangle' : 'sine';
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';

  const mix = audioCtx.createGain();
  mix.gain.value = 0.55;
  osc1.connect(mix);
  osc2.connect(mix);
  mix.connect(filter);

  const startAt = audioCtx.currentTime + 0.05;
  const endAt = startAt + Math.max(0.2, durationSec);

  const roots = preset === 'travel'
    ? [196.0, 220.0, 246.94, 261.63]
    : preset === 'couple'
      ? [220.0, 246.94, 261.63, 293.66]
      : preset === 'vintage'
        ? [174.61, 196.0, 220.0, 246.94]
        : [220.0, 196.0, 246.94, 220.0];

  const step = 2.0;
  for (let i = 0; i < Math.ceil(durationSec / step) + 1; i += 1) {
    const t = startAt + i * step;
    const root = roots[i % roots.length];
    osc1.frequency.setValueAtTime(root, t);
    osc2.frequency.setValueAtTime(root * 2, t);
  }

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), startAt + 0.4);
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), Math.max(startAt + 0.4, endAt - 0.6));
  gain.gain.linearRampToValueAtTime(0, endAt);

  osc1.start(startAt);
  osc2.start(startAt);
  osc1.stop(endAt);
  osc2.stop(endAt);

  return () => {
    try {
      osc1.stop();
      osc2.stop();
    } catch {
      void 0;
    }
    try {
      mix.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      void 0;
    }
  };
};

const exportBlobAsFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const copyTextToClipboard = async (text) => {
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

const fetchWithTimeout = async (input, init = {}, timeoutMs = 60000) => {
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
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    img.src = url;
  });
};

const compressImageBlob = async (blob, maxEdge = 1600, quality = 0.82) => {
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

const getUploadFileName = (index) => `img_${String(index).padStart(4, '0')}.jpg`;

const GeneratePage = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [filteredMedia] = useState(() => {
    const mediaData = localStorage.getItem('filteredMedia');
    if (!mediaData) return [];
    try {
      const parsed = JSON.parse(mediaData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedStyle] = useState(() => {
    const styleData = localStorage.getItem('selectedStyle');
    if (!styleData) return null;
    try {
      return JSON.parse(styleData);
    } catch {
      return null;
    }
  });
  const [textTone] = useState(() => localStorage.getItem('textTone') || '温情');
  const [resolution, setResolution] = useState('720p');
  const [orderedMedia, setOrderedMedia] = useState(() => filteredMedia);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoMime, setVideoMime] = useState('');
  const [generationError, setGenerationError] = useState('');
  const videoUrlRef = useRef('');
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmPreset, setBgmPreset] = useState(() => {
    const id = selectedStyle?.id;
    if (id === 'travel') return 'travel';
    if (id === 'couple') return 'couple';
    if (id === 'vintage') return 'vintage';
    return 'warm';
  });
  const [bgmVolume, setBgmVolume] = useState(0.35);
  const [bgmHint, setBgmHint] = useState('');
  const [serverGenerating, setServerGenerating] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverReachable, setServerReachable] = useState(false);
  const [serverStatusText, setServerStatusText] = useState('');
  const autoServerTriedRef = useRef(false);
  const serverConfirmRef = useRef(false);
  const [savingMemoir, setSavingMemoir] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [savedMemoir, setSavedMemoir] = useState(null);
  const [savedSignature, setSavedSignature] = useState('');

  const derived = useMemo(() => {
    const dates = filteredMedia.map(m => m.date).filter(Boolean).sort();
    const start = dates[0] ?? '';
    const end = dates[dates.length - 1] ?? '';
    const locations = filteredMedia.map(m => m.location).filter(Boolean);
    const location = locations[0] ?? '';
    return { start, end, location };
  }, [filteredMedia]);

  const generateTextBundle = (tone) => {
    const title = derived.start && derived.end ? `${derived.start} - ${derived.end} 的回忆` : '我的回忆录';
    const place = derived.location ? `在${derived.location}，` : '';
    const count = `${filteredMedia.length} 个片段`;

    if (tone === '文艺') {
      return {
        title,
        intro: `${place}时间把日常织成了风景，${count}，都是我想珍藏的瞬间。`,
        ending: '愿这些温柔的片段，成为未来某天的光。'
      };
    }
    if (tone === '幽默') {
      return {
        title,
        intro: `${place}一不小心就攒了${count}，这不是相册，这是时光的“连续剧”。`,
        ending: '下一集：继续努力制造快乐素材。'
      };
    }
    if (tone === '简约') {
      return {
        title,
        intro: `${place}${count}，按时间顺序整理完成。`,
        ending: '回忆已保存。'
      };
    }
    return {
      title,
      intro: `${place}把散落的日子收拢成一段故事，${count}，都是我们的闪光时刻。`,
      ending: '愿每一次回看，都能再次感受到当时的心动与温暖。'
    };
  };

  const [textBundle, setTextBundle] = useState(() => generateTextBundle(textTone));

  const currentMemoirSignature = useMemo(() => JSON.stringify({
    videoSize: videoBlob?.size || 0,
    videoType: videoMime,
    title: textBundle.title,
    intro: textBundle.intro,
    ending: textBundle.ending,
    resolution,
    mediaCount: filteredMedia.length,
    styleId: selectedStyle?.id || '',
    tone: textTone
  }), [filteredMedia.length, resolution, selectedStyle?.id, textBundle.ending, textBundle.intro, textBundle.title, textTone, videoBlob?.size, videoMime]);

  const sharedMemoirUrl = useMemo(() => {
    const shareId = savedMemoir?.share_id || savedMemoir?.shareId || '';
    return buildShareUrl(shareId);
  }, [savedMemoir]);

  useEffect(() => {
    setOrderedMedia(filteredMedia);
  }, [filteredMedia]);

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  const handleDownload = async () => {
    if (!videoBlob) return;
    const ext = videoMime.includes('mp4') ? 'mp4' : 'webm';
    exportBlobAsFile(videoBlob, `memoir.${ext}`);
  };

  const persistMemoir = useCallback(async () => {
    if (!videoBlob) {
      throw new Error('请先生成视频后再保存作品。');
    }

    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigMessage);
    }

    if (savedMemoir && savedSignature === currentMemoirSignature) {
      return savedMemoir;
    }

    setSavingMemoir(true);
    setSaveError('');
    setShareNotice('');

    try {
      const shareId = createShareId();
      const videoExt = videoMime.includes('webm') ? 'webm' : 'mp4';
      const record = await saveMemoirProject({
        shareId,
        videoBlob,
        videoExt,
        metadata: {
          title: textBundle.title || '我的回忆录',
          intro: textBundle.intro || '',
          ending: textBundle.ending || '',
          style_id: selectedStyle?.id || '',
          style_name: selectedStyle?.name || '',
          tone: textTone,
          resolution,
          media_count: filteredMedia.length
        }
      });

      setSavedMemoir(record);
      setSavedSignature(currentMemoirSignature);
      setShareNotice('作品已保存到云端。');
      return record;
    } catch (err) {
      const message = err.message || '保存作品失败，请稍后重试。';
      setSaveError(message);
      throw err;
    } finally {
      setSavingMemoir(false);
    }
  }, [currentMemoirSignature, filteredMedia.length, resolution, savedMemoir, savedSignature, selectedStyle?.id, selectedStyle?.name, textBundle.ending, textBundle.intro, textBundle.title, textTone, videoBlob, videoMime]);

  const handleSaveToCloud = async () => {
    try {
      const record = await persistMemoir();
      const shareUrl = buildShareUrl(record.share_id || record.shareId);
      setShareNotice(shareUrl ? '作品已保存，可直接复制分享链接。' : '作品已保存到云端。');
    } catch {
      void 0;
    }
  };

  const handleShare = async () => {
    try {
      const record = await persistMemoir();
      const shareUrl = buildShareUrl(record.share_id || record.shareId);

      if (!shareUrl) {
        throw new Error('未能生成分享链接，请检查 VITE_PUBLIC_APP_URL 配置。');
      }

      const title = textBundle.title || '我的回忆录';
      const text = `${filteredMedia.length} 个片段 · ${selectedStyle?.name ?? '回忆录作品'}`;

      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setShareNotice('分享面板已打开。');
        return;
      }

      await copyTextToClipboard(shareUrl);
      setShareNotice('分享链接已复制到剪贴板。');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const message = err.message || '生成分享链接失败，请稍后重试。';
      setSaveError(message);
    }
  };

  const checkServerHealth = useCallback(async () => {
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
  }, []);

  const serverRender = useCallback(async () => {
    setServerError('');
    setServerStatusText('');
    setServerGenerating(true);
    setGenerationError('');
    setSaveError('');
    setShareNotice('');
    setSavedMemoir(null);
    setSavedSignature('');
    setProgress(0);
    setIsGenerating(true);

    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = '';
    setVideoUrl('');
    setVideoBlob(null);
    setVideoMime('');

    try {
      if (!serverConfirmRef.current) {
        const ok = window.confirm('将把你选择的素材上传到同一 Wi‑Fi 的电脑进行合成，仅用于本次生成。是否继续？');
        if (!ok) {
          setIsGenerating(false);
          setServerGenerating(false);
          return;
        }
        serverConfirmRef.current = true;
      }

      const photos = orderedMedia.filter(m => m.type === 'photo' && typeof m.url === 'string');
      if (photos.length === 0) {
        setServerError('没有可用于生成的视频图片素材');
        setIsGenerating(false);
        setServerGenerating(false);
        return;
      }

      const form = new FormData();
      for (let i = 0; i < photos.length; i += 1) {
        setServerStatusText(`正在准备第 ${i + 1}/${photos.length} 张图片`);
        const resp = await fetchWithTimeout(photos[i].url, {}, 15000);
        const blob = await resp.blob();
        const compressed = await compressImageBlob(blob, resolution === '1080p' ? 1920 : 1600, 0.82);
        const file = new File([compressed], getUploadFileName(i), { type: 'image/jpeg' });
        form.append('files', file);
        setProgress(Math.round(((i + 1) / photos.length) * 25));
      }
      form.append('resolution', resolution);
      form.append('perImageSec', '2');
      form.append('audioVolume', String(bgmEnabled ? Math.max(0.02, bgmVolume * 0.4) : 0));

      let r = null;
      let lastText = '';
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        setServerStatusText(attempt === 1 ? '正在上传并合成视频…' : '网络波动，正在重试上传…');
        try {
          r = await fetchWithTimeout(getRenderApiUrl('/api/render'), { method: 'POST', body: form }, 120000);
          if (r.ok) break;
          lastText = await r.text();
        } catch {
          lastText = 'request timeout';
        }
      }

      if (!r || !r.ok) {
        setServerError(`服务端生成失败：${String(lastText).slice(0, 400) || '网络连接超时'}`);
        setIsGenerating(false);
        setServerGenerating(false);
        setServerStatusText('');
        return;
      }
      const outBlob = await r.blob();
      if (!outBlob || outBlob.size === 0) {
        setServerError('服务端生成失败：输出为空');
        setIsGenerating(false);
        setServerGenerating(false);
        setServerStatusText('');
        return;
      }

      const outUrl = URL.createObjectURL(outBlob);
      videoUrlRef.current = outUrl;
      setVideoBlob(outBlob);
      setVideoUrl(outUrl);
      setVideoMime(outBlob.type || 'video/mp4');
      setProgress(100);
      setIsGenerating(false);
      setServerGenerating(false);
      setServerStatusText('');
    } catch {
      setServerError('服务端生成失败：无法连接到本机服务。请确认电脑端已启动 server，并与手机同一 Wi‑Fi。');
      setIsGenerating(false);
      setServerGenerating(false);
      setServerStatusText('');
    }
  }, [orderedMedia, resolution, bgmEnabled, bgmVolume]);

  const handleMove = (index, dir) => {
    setOrderedMedia(prev => {
      const next = [...prev];
      const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[to];
      next[to] = tmp;
      return next;
    });
  };

  const generateVideo = useCallback(async () => {
    setGenerationError('');
    setBgmHint('');
    setSaveError('');
    setShareNotice('');
    setSavedMemoir(null);
    setSavedSignature('');
    setProgress(0);
    setIsGenerating(true);
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = '';
    setVideoUrl('');
    setVideoBlob(null);
    setVideoMime('');

    const mimeType = chooseRecorderMimeType();
    if (!mimeType) {
      setGenerationError('当前浏览器不支持视频生成（MediaRecorder 不可用）。可先使用“导入素材 + 生成流程”体验，或用 Android Chrome / 桌面 Chrome 试试。');
      setIsGenerating(false);
      return;
    }

    const size = resolution === '1080p' ? { w: 1920, h: 1080 } : { w: 1280, h: 720 };
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setGenerationError('无法初始化渲染画布。');
      setIsGenerating(false);
      return;
    }

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

      if (bgmEnabled) {
          const Ctx = window.AudioContext || window['webkitAudioContext'];
        if (Ctx) {
          audioCtx = new Ctx();
          try {
            await audioCtx.resume();
          } catch {
            void 0;
          }
          if (audioCtx.state !== 'running') {
            setBgmHint('如没有声音，请点击“重新生成”后再播放（部分浏览器需要用户交互启用音频）');
          }
          const destination = audioCtx.createMediaStreamDestination();
          stopBgm = createBgm({
            audioCtx,
            destination,
            durationSec: durationSec + 0.6,
            volume: bgmVolume,
            preset: bgmPreset
          });
          destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        } else {
          setBgmHint('当前浏览器不支持音频合成，可能会无声音轨。');
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise(resolve => {
        recorder.onstop = () => resolve();
      });

      recorder.start(250);
      started = true;

      const photos = orderedMedia.filter(m => m.type === 'photo' && typeof m.url === 'string');
      const imageMap = new Map();
      for (let i = 0; i < photos.length; i += 1) {
        try {
          imageMap.set(photos[i].id, await loadImage(photos[i].url));
        } catch {
          imageMap.set(photos[i].id, null);
        }
        setProgress(Math.round(((i + 1) / Math.max(photos.length, 1)) * 30));
        await sleepFrame();
      }

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
        const line3 = buildNarrationLine({
          tone: textTone,
          styleId: selectedStyle?.id,
          media,
          index: i,
          total: orderedMedia.length
        });

        for (let f = 0; f < perFrames; f += 1) {
          const t = f / Math.max(1, perFrames - 1);
          const scale = 1.06 + 0.06 * t;
          drawImageCover(ctx, size.w, size.h, img, scale, sx, sy, 1, 0);

          if (nextMedia && f >= perFrames - transFrames) {
            const p = (f - (perFrames - transFrames)) / transFrames;
            const nScale = 1.06;
            const slide = (1 - p) * size.w * 0.08;
            drawImageCover(ctx, size.w, size.h, nextImg, nScale, nsx, nsy, Math.min(1, Math.max(0, p)), slide);
          }

          const alpha = 0.95;
          ctx.save();
          ctx.globalAlpha = alpha;
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
          setProgress(Math.min(99, pct));
          await sleepFrame();
        }
      }

      recorder.stop();
      await stopped;
      if (stopBgm) stopBgm();
      if (audioCtx) {
        try {
          await audioCtx.close();
        } catch {
          void 0;
        }
      }

      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        setGenerationError('视频生成失败：录制输出为空。建议换用 Android Chrome / 桌面 Chrome，或稍后使用 App 版能力。');
        setIsGenerating(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      videoUrlRef.current = url;
      setVideoBlob(blob);
      setVideoUrl(url);
      setVideoMime(mimeType);
      setProgress(100);
      setIsGenerating(false);
    } catch {
      if (started) {
        try {
          recorder.stop();
        } catch {
          void 0;
        }
      }
      if (stopBgm) stopBgm();
      if (audioCtx) {
        try {
          await audioCtx.close();
        } catch {
          void 0;
        }
      }
      setGenerationError('视频生成中断：当前浏览器可能不支持该编码/录制方式。建议换用 Android Chrome 或桌面 Chrome。');
      setIsGenerating(false);
    }
  }, [orderedMedia, resolution, textBundle, bgmEnabled, bgmVolume, bgmPreset, selectedStyle?.id, textTone]);

  const isWeChat = useMemo(() => /MicroMessenger/i.test(navigator.userAgent), []);

  useEffect(() => {
    if (!isWeChat) return;
    checkServerHealth()
      .then(ok => setServerReachable(ok))
      .catch(() => setServerReachable(false));
  }, [isWeChat, checkServerHealth]);

  useEffect(() => {
    if (isWeChat) {
      setGenerationError('微信内置浏览器通常无法稳定本地生成视频。推荐使用“服务端生成”。');
      setIsGenerating(false);
      if (serverReachable && !autoServerTriedRef.current) {
        autoServerTriedRef.current = true;
        serverRender();
      }
      return;
    }
    generateVideo();
  }, [isWeChat, serverReachable, serverRender, generateVideo]);

  const handleBack = () => {
    navigate('/style');
  };

  return (
    <div className="generate-container">
      <header className="generate-header">
        <button className="back-button" onClick={handleBack}>
          ←
        </button>
        <h1>生成视频</h1>
      </header>

      <main className="generate-main">
        {isGenerating ? (
          <div className="generating-section">
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="progress-text">生成中... {progress}%</p>
            </div>
            <div className="generating-tips">
              <p>正在智能分析照片...</p>
              <p>正在应用{selectedStyle?.name}风格效果...</p>
              <p>正在合成视频...</p>
              {serverStatusText && <p>{serverStatusText}</p>}
            </div>
            <div className="generating-media">
              <h3>正在处理的媒体</h3>
              <div className="media-preview-grid">
                {filteredMedia.slice(0, 6).map(media => (
                  <div key={media.id} className="media-preview-item">
                    <img 
                      src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} 
                      alt="媒体预览"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="preview-section">
            <div className="video-preview">
              {videoUrl ? (
                <video className="video-player" src={videoUrl} controls playsInline />
              ) : (
                <div className="preview-placeholder">
                  <p>无法生成视频</p>
                  <p className="preview-info">{generationError || '微信内置浏览器可能不支持本地录制。可尝试“服务端生成”。'}</p>
                  {isWeChat && !serverReachable && (
                    <div className="server-error">
                      未检测到电脑端生成服务。请在电脑执行 npm run server，然后确保手机和电脑同一 Wi‑Fi，再回到此页重试。
                    </div>
                  )}
                  <button className="server-generate" onClick={serverRender} disabled={serverGenerating}>
                    {serverGenerating ? '服务端生成中…' : '服务端生成（微信推荐）'}
                  </button>
                  {serverError && <div className="server-error">{serverError}</div>}
                </div>
              )}
            </div>
            
            <div className="edit-section">
              <h3>视频编辑</h3>
              <div className="edit-options">
                <button className="edit-button" onClick={generateVideo}>
                  <span className="edit-icon">▶</span>
                  重新生成
                </button>
              </div>
            </div>

            <div className="order-section">
              <div className="order-header">
                <h3>素材顺序</h3>
                <div className="order-controls">
                  <select className="resolution-select" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                    <option value="720p">720P</option>
                    <option value="1080p">1080P</option>
                  </select>
                </div>
              </div>
              <div className="order-list">
                {orderedMedia.map((m, idx) => (
                  <div key={m.id} className="order-item">
                    <img
                      className="order-thumb"
                      src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'}
                      alt="素材"
                    />
                    <div className="order-meta">
                      <div className="order-title">{m.type === 'photo' ? '照片' : '视频'} {idx + 1}</div>
                      <div className="order-sub">{m.date || m.importedAt || ''}</div>
                    </div>
                    <div className="order-buttons">
                      <button className="order-btn" onClick={() => handleMove(idx, -1)} disabled={idx === 0}>
                        ↑
                      </button>
                      <button className="order-btn" onClick={() => handleMove(idx, 1)} disabled={idx === orderedMedia.length - 1}>
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="music-section">
              <div className="music-header">
                <h3>音乐</h3>
              </div>
              <div className="music-controls">
                <label className="music-toggle">
                  <input type="checkbox" checked={bgmEnabled} onChange={(e) => setBgmEnabled(e.target.checked)} />
                  启用背景音乐
                </label>
                <select className="music-select" value={bgmPreset} onChange={(e) => setBgmPreset(e.target.value)} disabled={!bgmEnabled}>
                  <option value="warm">温情</option>
                  <option value="couple">甜蜜</option>
                  <option value="travel">旅行</option>
                  <option value="vintage">怀旧</option>
                </select>
                <div className="music-volume">
                  <input
                    className="music-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(Number(e.target.value))}
                    disabled={!bgmEnabled}
                  />
                  <div className="music-volume-value">{Math.round(bgmVolume * 100)}%</div>
                </div>
              </div>
              {bgmHint && <div className="music-hint">{bgmHint}</div>}
            </div>

            <div className="text-section">
              <div className="text-header">
                <h3>AI 文字</h3>
                <button className="text-regenerate" onClick={() => setTextBundle(generateTextBundle(textTone))}>
                  重新生成
                </button>
              </div>
              <div className="text-field">
                <div className="text-label">开场标题</div>
                <input
                  className="text-input"
                  value={textBundle.title}
                  onChange={(e) => setTextBundle(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="text-field">
                <div className="text-label">旁白</div>
                <textarea
                  className="text-textarea"
                  value={textBundle.intro}
                  onChange={(e) => setTextBundle(prev => ({ ...prev, intro: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="text-field">
                <div className="text-label">结尾寄语</div>
                <textarea
                  className="text-textarea"
                  value={textBundle.ending}
                  onChange={(e) => setTextBundle(prev => ({ ...prev, ending: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="action-buttons">
              <button className={`action-button save-button ${!videoBlob ? 'disabled' : ''}`} onClick={handleDownload} disabled={!videoBlob}>
                下载视频
              </button>
              <button className={`action-button cloud-button ${!videoBlob || savingMemoir ? 'disabled' : ''}`} onClick={handleSaveToCloud} disabled={!videoBlob || savingMemoir}>
                {savingMemoir ? '保存中...' : '保存作品'}
              </button>
              <button className={`action-button share-button ${(!videoBlob && !savedMemoir) || savingMemoir ? 'disabled' : ''}`} onClick={handleShare} disabled={(!videoBlob && !savedMemoir) || savingMemoir}>
                复制分享链接
              </button>
            </div>

            <div className="share-status-panel">
              {!isSupabaseConfigured && (
                <div className="share-status-item warn">
                  云端保存未启用：{supabaseConfigMessage}
                </div>
              )}
              {saveError && (
                <div className="share-status-item error">{saveError}</div>
              )}
              {shareNotice && (
                <div className="share-status-item success">{shareNotice}</div>
              )}
              {sharedMemoirUrl && (
                <div className="share-link-box">
                  <div className="share-link-label">公开作品链接</div>
                  <a href={sharedMemoirUrl} target="_blank" rel="noreferrer">
                    {sharedMemoirUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GeneratePage;
