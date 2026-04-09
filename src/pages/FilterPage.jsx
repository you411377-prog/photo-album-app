import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockPeople, mockMediaData, filterMedia } from '../data/mockData';
import './FilterPage.css';

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

const computeFingerprintFromImageFile = async (file) => {
  const bitmap = await getImageBitmapFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported');
  }

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

const mapFingerprintToPerson = (fingerprint, people) => {
  const safeLen = Math.max(people.length, 1);
  const index = fingerprint % safeLen;
  const confidence = (0.78 + (fingerprint % 15) / 100).toFixed(2);
  return {
    personId: people[index]?.id ?? null,
    confidence
  };
};

const FilterPage = () => {
  const navigate = useNavigate();
  const [selectionMode, setSelectionMode] = useState('filter');
  const [enableTime, setEnableTime] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [customDate, setCustomDate] = useState({
    start: '',
    end: ''
  });
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [enableFormat, setEnableFormat] = useState(true);
  const [formatOptions, setFormatOptions] = useState({
    includePhotos: true,
    includeVideos: true,
    includeLivePhoto: true,
    includeScreenshots: false
  });
  const [manualImportKey, setManualImportKey] = useState(0);
  const [importedMedia, setImportedMedia] = useState([]);
  const [manualSelectedIds, setManualSelectedIds] = useState([]);
  const [manualTab, setManualTab] = useState('recent');
  const [manualAlbum, setManualAlbum] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [personUploadKey, setPersonUploadKey] = useState(0);
  const [targetPersonPhoto, setTargetPersonPhoto] = useState({
    previewUrl: '',
    fileName: ''
  });
  const [personRecognition, setPersonRecognition] = useState({
    status: 'idle',
    personId: null,
    confidence: null
  });

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
  };

  const handleSelectionModeChange = (mode) => {
    setSelectionMode(mode);
  };

  const handleEnableTimeChange = (value) => {
    setEnableTime(value);
  };

  const handleCustomDateChange = (field, value) => {
    setCustomDate(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePeopleToggle = (personId) => {
    setSelectedPeople(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId);
      } else {
        return [...prev, personId];
      }
    });
  };

  useEffect(() => {
    return () => {
      if (targetPersonPhoto.previewUrl) {
        URL.revokeObjectURL(targetPersonPhoto.previewUrl);
      }
    };
  }, [targetPersonPhoto.previewUrl]);

  const ensurePersonSelected = (personId) => {
    if (!personId) return;
    setSelectedPeople(prev => (prev.includes(personId) ? prev : [...prev, personId]));
  };

  const handleTargetPersonPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (targetPersonPhoto.previewUrl) {
      URL.revokeObjectURL(targetPersonPhoto.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setTargetPersonPhoto({ previewUrl, fileName: file.name });
    setPersonRecognition({ status: 'processing', personId: null, confidence: null });

    try {
      const fingerprint = await computeFingerprintFromImageFile(file);
      const mapped = mapFingerprintToPerson(fingerprint, mockPeople);
      setPersonRecognition({ status: 'done', personId: mapped.personId, confidence: mapped.confidence });
      ensurePersonSelected(mapped.personId);
    } catch {
      setPersonRecognition({ status: 'error', personId: null, confidence: null });
    }
  };

  const handleRecognizedPersonChange = (value) => {
    const personId = Number(value);
    if (!personId) return;
    setPersonRecognition(prev => ({
      ...prev,
      status: 'done',
      personId
    }));
    ensurePersonSelected(personId);
  };

  const handleFilterOnlyRecognized = () => {
    if (!personRecognition.personId) return;
    setSelectedPeople([personRecognition.personId]);
  };

  const handleClearTargetPerson = () => {
    if (targetPersonPhoto.previewUrl) {
      URL.revokeObjectURL(targetPersonPhoto.previewUrl);
    }
    setTargetPersonPhoto({ previewUrl: '', fileName: '' });
    setPersonRecognition({ status: 'idle', personId: null, confidence: null });
    setPersonUploadKey(prev => prev + 1);
  };

  const handleEnableFormatChange = (value) => {
    setEnableFormat(value);
  };

  const handleFormatOptionChange = (key, value) => {
    setFormatOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const formatYmd = (ms) => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatHm = (ms) => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseExifFromJpegArrayBuffer = (buffer) => {
    const view = new DataView(buffer);
    if (view.byteLength < 4) return null;
    if (view.getUint16(0, false) !== 0xffd8) return null;

    let offset = 2;
    const readAscii = (pos, len) => {
      let s = '';
      for (let i = 0; i < len; i += 1) {
        const c = view.getUint8(pos + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    };

    const getUint16 = (pos, le) => view.getUint16(pos, le);
    const getUint32 = (pos, le) => view.getUint32(pos, le);

    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      const size = view.getUint16(offset, false);
      const segmentStart = offset + 2;
      if (marker === 0xe1) {
        if (segmentStart + 10 <= view.byteLength && readAscii(segmentStart, 6) === 'Exif') {
          const tiffStart = segmentStart + 6;
          const endian = readAscii(tiffStart, 2);
          const le = endian === 'II';
          const magic = getUint16(tiffStart + 2, le);
          if (magic !== 42) return null;
          const ifd0Offset = getUint32(tiffStart + 4, le);

          const readRational = (pos) => {
            const num = getUint32(pos, le);
            const den = getUint32(pos + 4, le);
            if (!den) return 0;
            return num / den;
          };

          const readIfd = (ifdOffset) => {
            const abs = tiffStart + ifdOffset;
            if (abs + 2 > view.byteLength) return { entries: [], next: 0 };
            const count = getUint16(abs, le);
            const entries = [];
            let p = abs + 2;
            for (let i = 0; i < count; i += 1) {
              if (p + 12 > view.byteLength) break;
              const tag = getUint16(p, le);
              const type = getUint16(p + 2, le);
              const num = getUint32(p + 4, le);
              const valueOffset = getUint32(p + 8, le);
              entries.push({ tag, type, num, valueOffset, entryPos: p });
              p += 12;
            }
            const next = p + 4 <= view.byteLength ? getUint32(p, le) : 0;
            return { entries, next };
          };

          const readTagValue = (entry) => {
            const { type, num, valueOffset, entryPos } = entry;
            const typeSize = type === 2 ? 1 : type === 3 ? 2 : type === 4 ? 4 : type === 5 ? 8 : 0;
            const byteCount = num * typeSize;
            const valuePos = byteCount <= 4 ? entryPos + 8 : tiffStart + valueOffset;
            if (valuePos + byteCount > view.byteLength) return null;

            if (type === 2) return readAscii(valuePos, byteCount);
            if (type === 3) return getUint16(valuePos, le);
            if (type === 4) return getUint32(valuePos, le);
            if (type === 5) {
              if (num === 1) return readRational(valuePos);
              const arr = [];
              for (let i = 0; i < num; i += 1) arr.push(readRational(valuePos + i * 8));
              return arr;
            }
            return null;
          };

          const ifd0 = readIfd(ifd0Offset);
          const exifPtr = ifd0.entries.find(e => e.tag === 0x8769);
          const gpsPtr = ifd0.entries.find(e => e.tag === 0x8825);

          let dateTime = null;
          if (exifPtr) {
            const exifIfd = readIfd(exifPtr.valueOffset);
            const dt = exifIfd.entries.find(e => e.tag === 0x9003) || exifIfd.entries.find(e => e.tag === 0x0132);
            if (dt) {
              const v = readTagValue(dt);
              if (typeof v === 'string' && v) dateTime = v;
            }
          } else {
            const dt = ifd0.entries.find(e => e.tag === 0x0132);
            if (dt) {
              const v = readTagValue(dt);
              if (typeof v === 'string' && v) dateTime = v;
            }
          }

          let gps = null;
          if (gpsPtr) {
            const gpsIfd = readIfd(gpsPtr.valueOffset);
            const latRef = gpsIfd.entries.find(e => e.tag === 0x0001);
            const lat = gpsIfd.entries.find(e => e.tag === 0x0002);
            const lonRef = gpsIfd.entries.find(e => e.tag === 0x0003);
            const lon = gpsIfd.entries.find(e => e.tag === 0x0004);

            const latRefV = latRef ? readTagValue(latRef) : '';
            const lonRefV = lonRef ? readTagValue(lonRef) : '';
            const latV = lat ? readTagValue(lat) : null;
            const lonV = lon ? readTagValue(lon) : null;

            if (Array.isArray(latV) && latV.length >= 3 && Array.isArray(lonV) && lonV.length >= 3) {
              const toDeg = (arr) => arr[0] + arr[1] / 60 + arr[2] / 3600;
              let la = toDeg(latV);
              let lo = toDeg(lonV);
              if (String(latRefV).toUpperCase() === 'S') la *= -1;
              if (String(lonRefV).toUpperCase() === 'W') lo *= -1;
              gps = { lat: la, lon: lo };
            }
          }

          return { dateTime, gps };
        }
      }
      offset += size;
    }
    return null;
  };

  const parseExifFromImageFile = async (file) => {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const parsed = parseExifFromJpegArrayBuffer(head);
    if (!parsed) return null;
    const { dateTime, gps } = parsed;
    let date = '';
    let time = '';
    if (dateTime && typeof dateTime === 'string') {
      const parts = dateTime.trim().split(' ');
      if (parts.length >= 2) {
        date = parts[0].replace(/:/g, '-');
        time = parts[1].slice(0, 5);
      }
    }
    return { date, time, gps };
  };

  const handleImportMediaChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const now = Date.now();
    const mapped = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const isVideo = file.type.startsWith('video/');
      const stamp = typeof file.lastModified === 'number' ? file.lastModified : Date.now();
      const importedAt = new Date(stamp).toISOString();
      const url = URL.createObjectURL(file);

      let date = formatYmd(stamp);
      let time = formatHm(stamp);
      let gps = null;
      let location = '';

      if (!isVideo && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
        try {
          const exif = await parseExifFromImageFile(file);
          if (exif?.date) date = exif.date;
          if (exif?.time) time = exif.time;
          if (exif?.gps) {
            gps = exif.gps;
            location = `${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`;
          }
        } catch {
          void 0;
        }
      }

      mapped.push({
        id: now + index,
        type: isVideo ? 'video' : 'photo',
        format: isVideo ? 'video' : 'photo',
        url,
        importedAt,
        album: '导入',
        favorite: false,
        tags: [],
        date,
        time,
        location,
        gps,
        people: [],
        personIds: []
      });
    }

    setImportedMedia(prev => [...prev, ...mapped]);
    setManualTab('recent');
    setManualAlbum('');
    setManualSearch('');
    setManualDate('');
  };

  const handleClearImported = () => {
    importedMedia.forEach(m => {
      if (typeof m.url === 'string' && m.url.startsWith('blob:')) {
        URL.revokeObjectURL(m.url);
      }
    });
    setImportedMedia([]);
    setManualImportKey(prev => prev + 1);
    setManualSelectedIds([]);
    setManualTab('recent');
    setManualAlbum('');
  };

  const handleToggleFavorite = (mediaId) => {
    setImportedMedia(prev => prev.map(m => (m.id === mediaId ? { ...m, favorite: !m.favorite } : m)));
  };

  const handleToggleManualMedia = (mediaId) => {
    setManualSelectedIds(prev => {
      if (prev.includes(mediaId)) return prev.filter(id => id !== mediaId);
      return [...prev, mediaId];
    });
  };

  const handleSelectAllManual = () => {
    const ids = manualVisibleMediaSorted.map(m => m.id);
    setManualSelectedIds(prev => {
      const set = new Set(prev);
      ids.forEach(id => set.add(id));
      return Array.from(set);
    });
  };

  const handleClearManual = () => {
    setManualSelectedIds([]);
  };

  const manualAlbums = useMemo(() => {
    const map = new Map();
    const library = importedMedia.length > 0 ? importedMedia : mockMediaData;
    library.forEach(m => {
      const name = m.album || '相机胶卷';
      const entry = map.get(name) ?? { name, count: 0, coverUrl: '' };
      entry.count += 1;
      if (!entry.coverUrl) {
        entry.coverUrl = m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square';
      }
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [importedMedia]);

  const manualVisibleMedia = (() => {
    const library = importedMedia.length > 0 ? importedMedia : mockMediaData;
    const q = manualSearch.trim().toLowerCase();
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - 30);

    return library.filter(m => {
      if (manualTab === 'favorites') {
        if (!m.favorite) return false;
      }

      if (manualTab === 'recent') {
        const stamp = m.importedAt || m.date;
        if (!stamp) return false;
        const d = new Date(stamp);
        if (Number.isNaN(d.getTime()) || d < recentStart) return false;
      }

      if (manualTab === 'albums') {
        if (!manualAlbum) return false;
        const name = m.album || '相机胶卷';
        if (name !== manualAlbum) return false;
      }

      if (manualDate) {
        if (!m.date || m.date !== manualDate) return false;
      }

      if (q) {
        const hay = `${m.location ?? ''} ${(m.tags ?? []).join(' ')} ${(m.people ?? []).join(' ')} ${m.date ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  })();

  const manualVisibleMediaSorted = (() => {
    const list = [...manualVisibleMedia];
    if (manualTab === 'recent') {
      list.sort((a, b) => {
        const ad = a.importedAt || `${a.date ?? ''} ${a.time ?? ''}`;
        const bd = b.importedAt || `${b.date ?? ''} ${b.time ?? ''}`;
        return String(bd).localeCompare(String(ad));
      });
    }
    return list;
  })();

  const parseDurationToSeconds = (duration) => {
    if (!duration || typeof duration !== 'string') return 0;
    const parts = duration.split(':').map(n => Number(n));
    if (parts.some(n => Number.isNaN(n))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const formatSeconds = (seconds) => {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const normalizedTime = useMemo(() => {
    if (!enableTime) {
      return {
        effectiveTimeRange: '',
        effectiveCustomDate: { start: '', end: '' },
        notice: '',
        noticeType: ''
      };
    }

    if (timeRange !== 'custom') {
      return {
        effectiveTimeRange: timeRange,
        effectiveCustomDate: customDate,
        notice: '',
        noticeType: ''
      };
    }

    const startStr = customDate?.start ?? '';
    const endStr = customDate?.end ?? '';

    if (!startStr) {
      return {
        effectiveTimeRange: 'month',
        effectiveCustomDate: customDate,
        notice: '自定义未填写开始日期，已按近一个月处理',
        noticeType: 'warn'
      };
    }

    const startDate = new Date(startStr);
    if (Number.isNaN(startDate.getTime())) {
      return {
        effectiveTimeRange: 'month',
        effectiveCustomDate: customDate,
        notice: '自定义开始日期无效，已按近一个月处理',
        noticeType: 'warn'
      };
    }

    if (!endStr) {
      return {
        effectiveTimeRange: 'custom',
        effectiveCustomDate: customDate,
        notice: '未填写结束日期，默认截止到今天',
        noticeType: 'warn'
      };
    }

    const endDate = new Date(endStr);
    if (Number.isNaN(endDate.getTime())) {
      return {
        effectiveTimeRange: 'custom',
        effectiveCustomDate: { ...customDate, end: '' },
        notice: '结束日期无效，默认截止到今天',
        noticeType: 'warn'
      };
    }

    if (endDate < startDate) {
      return {
        effectiveTimeRange: 'custom',
        effectiveCustomDate: { start: endStr, end: startStr },
        notice: '结束日期早于开始日期，已自动交换起止日期',
        noticeType: 'warn'
      };
    }

    return {
      effectiveTimeRange: 'custom',
      effectiveCustomDate: customDate,
      notice: '',
      noticeType: ''
    };
  }, [enableTime, timeRange, customDate]);

  const filteredMedia = useMemo(() => {
    const filters = {
      timeRange: normalizedTime.effectiveTimeRange,
      customDate: normalizedTime.effectiveCustomDate,
      people: selectedPeople,
      enableFormat,
      formatOptions
    };
    const library = importedMedia.length > 0 ? importedMedia : mockMediaData;
    return filterMedia(library, filters);
  }, [normalizedTime, selectedPeople, enableFormat, formatOptions, importedMedia]);

  const manualSelectedMedia = useMemo(() => {
    if (manualSelectedIds.length === 0) return [];
    const idSet = new Set(manualSelectedIds);
    const library = importedMedia.length > 0 ? importedMedia : mockMediaData;
    return library.filter(m => idSet.has(m.id));
  }, [manualSelectedIds, importedMedia]);

  const selectedMedia = selectionMode === 'manual' ? manualSelectedMedia : filteredMedia;

  const manualEstimatedSeconds = useMemo(() => {
    const photoCount = manualSelectedMedia.filter(m => m.type === 'photo').length;
    const videoSeconds = manualSelectedMedia
      .filter(m => m.type === 'video')
      .reduce((acc, m) => acc + parseDurationToSeconds(m.duration), 0);
    return photoCount * 2 + videoSeconds;
  }, [manualSelectedMedia]);

  const handleNext = () => {
    // 保存筛选结果到localStorage，以便后续页面使用
    localStorage.setItem('filteredMedia', JSON.stringify(selectedMedia));
    navigate('/review');
  };

  const handleBack = () => {
    navigate('/home');
  };

  return (
    <div className="filter-container">
      <header className="filter-header">
        <button className="back-button" onClick={handleBack}>
          ←
        </button>
        <h1>选择整理范围</h1>
      </header>

      <main className="filter-main">
        <section className="filter-section">
          <h2>选择方式</h2>
          <div className="mode-cards">
            <button
              type="button"
              className={`mode-card ${selectionMode === 'filter' ? 'active' : ''}`}
              onClick={() => handleSelectionModeChange('filter')}
            >
              <div className="mode-card-icon">🔍</div>
              <div className="mode-card-title">智能筛选</div>
              <div className="mode-card-desc">设置时间 / 人物 / 格式维度，自动从相册筛选</div>
            </button>
            <button
              type="button"
              className={`mode-card ${selectionMode === 'manual' ? 'active' : ''}`}
              onClick={() => handleSelectionModeChange('manual')}
            >
              <div className="mode-card-icon">🖼️</div>
              <div className="mode-card-title">手动选择</div>
              <div className="mode-card-desc">直接浏览相册内容，手动勾选想要的照片</div>
            </button>
          </div>
        </section>

        {selectionMode === 'filter' && (
          <section className="filter-section">
            <h2>导入素材库</h2>
            <div className="manual-import">
              <label className="manual-import-button">
                导入手机照片/视频（用于智能筛选）
                <input
                  key={manualImportKey}
                  className="manual-import-input"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleImportMediaChange}
                />
              </label>
              {importedMedia.length > 0 && (
                <button type="button" className="manual-import-clear" onClick={handleClearImported}>
                  清除导入
                </button>
              )}
            </div>
          </section>
        )}

        {selectionMode === 'manual' && (
          <section className="filter-section">
            <h2>手动选择素材</h2>
            <div className="manual-import">
              <label className="manual-import-button">
                导入手机照片/视频
                <input
                  key={manualImportKey}
                  className="manual-import-input"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleImportMediaChange}
                />
              </label>
              {importedMedia.length > 0 && (
                <button type="button" className="manual-import-clear" onClick={handleClearImported}>
                  清除导入
                </button>
              )}
            </div>
            <div className="manual-tabs">
              <button
                type="button"
                className={`manual-tab ${manualTab === 'albums' ? 'active' : ''}`}
                onClick={() => {
                  setManualTab('albums');
                  setManualAlbum('');
                }}
              >
                相册列表
              </button>
              <button
                type="button"
                className={`manual-tab ${manualTab === 'recent' ? 'active' : ''}`}
                onClick={() => {
                  setManualTab('recent');
                  setManualAlbum('');
                }}
              >
                最近
              </button>
              <button
                type="button"
                className={`manual-tab ${manualTab === 'favorites' ? 'active' : ''}`}
                onClick={() => {
                  setManualTab('favorites');
                  setManualAlbum('');
                }}
              >
                收藏
              </button>
            </div>

            {manualTab === 'albums' && !manualAlbum && (
              <div className="album-list">
                {manualAlbums.map(a => (
                  <button
                    key={a.name}
                    type="button"
                    className="album-item"
                    onClick={() => setManualAlbum(a.name)}
                  >
                    <img src={a.coverUrl} alt={a.name} />
                    <div className="album-meta">
                      <div className="album-name">{a.name}</div>
                      <div className="album-count">{a.count} 项</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(manualTab !== 'albums' || manualAlbum) && (
              <>
                {manualTab === 'albums' && manualAlbum && (
                  <div className="album-header">
                    <button type="button" className="album-back" onClick={() => setManualAlbum('')}>
                      ← 相册列表
                    </button>
                    <div className="album-title">{manualAlbum}</div>
                  </div>
                )}
                <div className="manual-filters">
                  <input
                    className="manual-search"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="搜索日期 / 地点 / 标签"
                  />
                  <input
                    className="manual-date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div className="manual-actions">
                  <div className="manual-count">
                    已选 {manualSelectedIds.length} 个 · 预计 {formatSeconds(manualEstimatedSeconds)}
                  </div>
                  <div className="manual-buttons">
                    <button className="manual-button" onClick={handleSelectAllManual}>
                      全选当前
                    </button>
                    <button className="manual-button secondary" onClick={handleClearManual}>
                      清空
                    </button>
                  </div>
                </div>
                <div className="manual-grid">
                  {manualVisibleMediaSorted.map(media => {
                    const selected = manualSelectedIds.includes(media.id);
                    const favorite = !!media.favorite;
                    return (
                      <button
                        key={media.id}
                        type="button"
                        className={`manual-item ${selected ? 'selected' : ''}`}
                        onClick={() => handleToggleManualMedia(media.id)}
                      >
                        <button
                          type="button"
                          className={`favorite-toggle ${favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(media.id);
                          }}
                        >
                          {favorite ? '★' : '☆'}
                        </button>
                        <img
                          src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'}
                          alt="素材预览"
                        />
                        <span className="manual-type">{media.type === 'photo' ? '📷' : '🎬'}</span>
                        <span className="manual-check">{selected ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}


        {selectionMode === 'filter' && (
          <>
        <section className="filter-section">
          <div className="section-title-row">
            <h2>时间维度</h2>
            <label className="section-toggle">
              <input
                type="checkbox"
                checked={enableTime}
                onChange={(e) => handleEnableTimeChange(e.target.checked)}
              />
              启用
            </label>
          </div>
          <div className="time-options">
            <button 
              className={`time-option ${timeRange === 'week' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('week')}
              disabled={!enableTime}
            >
              近一周
            </button>
            <button 
              className={`time-option ${timeRange === 'month' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('month')}
              disabled={!enableTime}
            >
              近一个月
            </button>
            <button 
              className={`time-option ${timeRange === 'quarter' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('quarter')}
              disabled={!enableTime}
            >
              近三个月
            </button>
            <button 
              className={`time-option ${timeRange === 'year' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('year')}
              disabled={!enableTime}
            >
              近一年
            </button>
            <button 
              className={`time-option ${timeRange === 'special' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('special')}
              disabled={!enableTime}
            >
              特殊日期
            </button>
            <button 
              className={`time-option ${timeRange === 'custom' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('custom')}
              disabled={!enableTime}
            >
              自定义
            </button>
          </div>
          {enableTime && timeRange === 'custom' && (
            <>
              <div className="custom-date">
                <input 
                  type="date" 
                  value={customDate.start}
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  placeholder="开始日期"
                />
                <span>至</span>
                <input 
                  type="date" 
                  value={customDate.end}
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  placeholder="结束日期"
                />
              </div>
              {normalizedTime.notice && (
                <div className={`custom-date-hint ${normalizedTime.noticeType}`}>
                  {normalizedTime.notice}
                </div>
              )}
            </>
          )}
          {enableTime && timeRange === 'special' && (
            <div className="special-dates">
              <button className="special-date-option">生日</button>
              <button className="special-date-option">节假日</button>
              <button className="special-date-option">纪念日</button>
            </div>
          )}
        </section>

        <section className="filter-section">
          <h2>人物维度</h2>
          <div className="person-upload">
            <div className="person-upload-row">
              <label className="person-upload-button">
                上传目标人物照片
                <input
                  key={personUploadKey}
                  className="person-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleTargetPersonPhotoChange}
                />
              </label>
              {targetPersonPhoto.previewUrl && (
                <button className="person-upload-clear" onClick={handleClearTargetPerson}>
                  清除
                </button>
              )}
            </div>

            {targetPersonPhoto.previewUrl && (
              <div className="person-upload-preview">
                <img src={targetPersonPhoto.previewUrl} alt="目标人物" />
                <div className="person-upload-meta">
                  <div className="person-upload-name">{targetPersonPhoto.fileName}</div>
                  {personRecognition.status === 'processing' && (
                    <div className="person-upload-status">识别中…</div>
                  )}
                  {personRecognition.status === 'error' && (
                    <div className="person-upload-status error">识别失败，请换一张更清晰的人脸照片</div>
                  )}
                  {personRecognition.status === 'done' && personRecognition.personId && (
                    <div className="person-upload-status">
                      识别结果：{mockPeople.find(p => p.id === personRecognition.personId)?.name}
                      {personRecognition.confidence ? `（置信度 ${personRecognition.confidence}）` : ''}
                    </div>
                  )}
                  <div className="person-upload-controls">
                    <select
                      className="person-upload-select"
                      value={personRecognition.personId ?? ''}
                      onChange={(e) => handleRecognizedPersonChange(e.target.value)}
                    >
                      <option value="">手动选择人物</option>
                      {mockPeople.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className={`person-upload-only ${personRecognition.personId ? '' : 'disabled'}`}
                      onClick={handleFilterOnlyRecognized}
                      disabled={!personRecognition.personId}
                    >
                      仅筛选此人
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="people-options">
            {mockPeople.map(person => (
              <button 
                key={person.id}
                className={`person-option ${selectedPeople.includes(person.id) ? 'active' : ''}`}
                onClick={() => handlePeopleToggle(person.id)}
              >
                {person.name}
              </button>
            ))}
          </div>
        </section>

        <section className="filter-section">
          <div className="section-title-row">
            <h2>格式维度</h2>
            <label className="section-toggle">
              <input
                type="checkbox"
                checked={enableFormat}
                onChange={(e) => handleEnableFormatChange(e.target.checked)}
              />
              启用
            </label>
          </div>
          <div className="format-options">
            <div className="format-checkbox">
              <input
                type="checkbox"
                id="format-photo"
                checked={formatOptions.includePhotos}
                onChange={(e) => handleFormatOptionChange('includePhotos', e.target.checked)}
                disabled={!enableFormat}
              />
              <label htmlFor="format-photo">照片（默认包含）</label>
            </div>
            <div className="format-checkbox">
              <input
                type="checkbox"
                id="format-video"
                checked={formatOptions.includeVideos}
                onChange={(e) => handleFormatOptionChange('includeVideos', e.target.checked)}
                disabled={!enableFormat}
              />
              <label htmlFor="format-video">视频片段（默认包含）</label>
            </div>
            <div className="format-checkbox">
              <input
                type="checkbox"
                id="format-live"
                checked={formatOptions.includeLivePhoto}
                onChange={(e) => handleFormatOptionChange('includeLivePhoto', e.target.checked)}
                disabled={!enableFormat}
              />
              <label htmlFor="format-live">Live Photo（默认包含）</label>
            </div>
            <div className="format-checkbox">
              <input
                type="checkbox"
                id="format-screenshot"
                checked={formatOptions.includeScreenshots}
                onChange={(e) => handleFormatOptionChange('includeScreenshots', e.target.checked)}
                disabled={!enableFormat}
              />
              <label htmlFor="format-screenshot">截图 / 屏幕录制（默认排除）</label>
            </div>
          </div>
        </section>

        <section className="filter-section">
          <h2>智能去重</h2>
          <div className="deduplication-options">
            <div className="format-checkbox">
              <input type="checkbox" id="deduplication" defaultChecked />
              <label htmlFor="deduplication">自动识别相似照片</label>
            </div>
            <p className="deduplication-hint">系统将保留最佳质量的照片</p>
          </div>
        </section>
          </>
        )}

        <section className="filter-section">
          <h2>筛选结果</h2>
          <div className="filter-result">
            <p>找到 {selectedMedia.length} 个媒体文件</p>
            <div className="media-grid">
              {selectedMedia.slice(0, 4).map(media => (
                <div key={media.id} className="media-item">
                  <img 
                    src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} 
                    alt="媒体预览"
                  />
                  <span className="media-type">{media.type === 'photo' ? '📷' : '🎬'}</span>
                </div>
              ))}
              {selectedMedia.length > 4 && (
                <div className="media-more">
                  +{selectedMedia.length - 4}
                </div>
              )}
            </div>
          </div>
        </section>

        <button
          className={`next-button ${selectedMedia.length === 0 ? 'disabled' : ''}`}
          onClick={handleNext}
          disabled={selectedMedia.length === 0}
        >
          下一步
        </button>
      </main>
    </div>
  );
};

export default FilterPage;
