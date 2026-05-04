import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { mockPeople, mockMediaData, filterMedia } from '../data/mockData';
import { parseExifFromImageFile } from '../lib/exifParser';
import { computeFingerprint } from '../lib/dedup';
import { formatYmd, formatHm, formatSeconds } from '../lib/dateUtils';
import './FilterPage.css';

const mapFingerprintToPerson = (fingerprint, people) => {
  const safeLen = Math.max(people.length, 1);
  const index = fingerprint % safeLen;
  const confidence = (0.78 + (fingerprint % 15) / 100).toFixed(2);
  return { personId: people[index]?.id ?? null, confidence };
};

const FilterPage = () => {
  const navigate = useNavigate();
  const { importedMedia, setImportedMedia, commitFilter } = useProject();

  const [selectionMode, setSelectionMode] = useState('filter');
  const [enableTime, setEnableTime] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [enableFormat, setEnableFormat] = useState(true);
  const [formatOptions, setFormatOptions] = useState({
    includePhotos: true, includeVideos: true, includeLivePhoto: true, includeScreenshots: false
  });
  const [manualImportKey, setManualImportKey] = useState(0);
  const [manualSelectedIds, setManualSelectedIds] = useState([]);
  const [manualTab, setManualTab] = useState('recent');
  const [manualAlbum, setManualAlbum] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [personUploadKey, setPersonUploadKey] = useState(0);
  const [targetPersonPhoto, setTargetPersonPhoto] = useState({ previewUrl: '', fileName: '' });
  const [personRecognition, setPersonRecognition] = useState({ status: 'idle', personId: null, confidence: null });

  useEffect(() => {
    return () => { if (targetPersonPhoto.previewUrl) URL.revokeObjectURL(targetPersonPhoto.previewUrl); };
  }, [targetPersonPhoto.previewUrl]);

  const ensurePersonSelected = (personId) => {
    if (!personId) return;
    setSelectedPeople(prev => (prev.includes(personId) ? prev : [...prev, personId]));
  };

  const handleTargetPersonPhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (targetPersonPhoto.previewUrl) URL.revokeObjectURL(targetPersonPhoto.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setTargetPersonPhoto({ previewUrl, fileName: file.name });
    setPersonRecognition({ status: 'processing', personId: null, confidence: null });
    try {
      const fingerprint = await computeFingerprint(file);
      const mapped = mapFingerprintToPerson(fingerprint, mockPeople);
      setPersonRecognition({ status: 'done', personId: mapped.personId, confidence: mapped.confidence });
      ensurePersonSelected(mapped.personId);
    } catch {
      setPersonRecognition({ status: 'error', personId: null, confidence: null });
    }
  };

  const handleClearTargetPerson = () => {
    if (targetPersonPhoto.previewUrl) URL.revokeObjectURL(targetPersonPhoto.previewUrl);
    setTargetPersonPhoto({ previewUrl: '', fileName: '' });
    setPersonRecognition({ status: 'idle', personId: null, confidence: null });
    setPersonUploadKey(prev => prev + 1);
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
          if (exif?.gps) { gps = exif.gps; location = `${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`; }
        } catch { /* noop */ }
      }
      mapped.push({
        id: now + index, type: isVideo ? 'video' : 'photo', format: isVideo ? 'video' : 'photo',
        url, importedAt, album: '导入', favorite: false, tags: [], date, time, location, gps, people: [], personIds: []
      });
    }
    setImportedMedia(prev => [...prev, ...mapped]);
    setManualTab('recent');
    setManualAlbum('');
    setManualSearch('');
    setManualDate('');
  };

  const handleClearImported = () => {
    importedMedia.forEach(m => { if (typeof m.url === 'string' && m.url.startsWith('blob:')) URL.revokeObjectURL(m.url); });
    setImportedMedia([]);
    setManualImportKey(prev => prev + 1);
    setManualSelectedIds([]);
    setManualTab('recent');
    setManualAlbum('');
  };

  const normalizedTime = useMemo(() => {
    if (timeRange !== 'custom') return { start: null, end: null, notice: '', noticeType: '' };
    const s = customDate.start ? new Date(customDate.start) : null;
    const e = customDate.end ? new Date(customDate.end) : null;
    if (s && e && e < s) return { start: e, end: s, notice: '已自动交换开始与结束日期', noticeType: 'info' };
    return { start: s, end: e, notice: '', noticeType: '' };
  }, [timeRange, customDate]);

  const allMedia = useMemo(() => [...importedMedia], [importedMedia]);

  const selectedMedia = useMemo(() => {
    if (selectionMode === 'manual') return allMedia.filter(m => manualSelectedIds.includes(m.id));
    return filterMedia(allMedia, {
      timeRange: enableTime ? timeRange : null, customDate: enableTime ? customDate : null,
      people: selectedPeople, enableFormat, formatOptions
    });
  }, [selectionMode, allMedia, manualSelectedIds, enableTime, timeRange, customDate, selectedPeople, enableFormat, formatOptions]);

  const manualVisibleMedia = useMemo(() => {
    let list = allMedia;
    if (manualTab === 'favorites') list = list.filter(m => m.favorite);
    if (manualTab === 'albums' && manualAlbum) list = list.filter(m => m.album === manualAlbum);
    if (manualSearch) { const q = manualSearch.toLowerCase(); list = list.filter(m => (m.date && m.date.includes(q)) || (m.location && m.location.toLowerCase().includes(q)) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))); }
    if (manualDate) list = list.filter(m => m.date === manualDate);
    return list;
  }, [allMedia, manualTab, manualAlbum, manualSearch, manualDate]);

  const manualVisibleMediaSorted = useMemo(() => [...manualVisibleMedia].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [manualVisibleMedia]);

  const manualAlbums = useMemo(() => {
    const map = new Map();
    allMedia.forEach(m => { const album = m.album || '未分类'; if (!map.has(album)) map.set(album, { name: album, count: 0, coverUrl: m.url || '' }); map.get(album).count += 1; });
    return Array.from(map.values());
  }, [allMedia]);

  const manualEstimatedSeconds = useMemo(() => manualSelectedIds.length * 2, [manualSelectedIds]);

  const handleToggleManualMedia = (mediaId) => setManualSelectedIds(prev => prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]);
  const handleSelectAllManual = () => { const ids = manualVisibleMediaSorted.map(m => m.id); setManualSelectedIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return Array.from(s); }); };
  const handleClearManual = () => setManualSelectedIds([]);
  const handleToggleFavorite = (mediaId) => setImportedMedia(prev => prev.map(m => (m.id === mediaId ? { ...m, favorite: !m.favorite } : m)));
  const handleNext = () => { commitFilter(selectedMedia); navigate('/review'); };
  const handleBack = () => navigate('/home');

  return (
    <div className="filter-container">
      <header className="filter-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1>筛选素材</h1>
      </header>
      <main className="filter-main">
        <section className="filter-section">
          <h2>选择方式</h2>
          <div className="mode-cards">
            <button type="button" className={`mode-card ${selectionMode === 'filter' ? 'active' : ''}`} onClick={() => setSelectionMode('filter')}>
              <div className="mode-card-icon">🔍</div><div className="mode-card-title">智能筛选</div><div className="mode-card-desc">按时间、人物等维度自动筛选</div>
            </button>
            <button type="button" className={`mode-card ${selectionMode === 'manual' ? 'active' : ''}`} onClick={() => setSelectionMode('manual')}>
              <div className="mode-card-icon">🖼️</div><div className="mode-card-title">手动选择</div><div className="mode-card-desc">直接浏览相册内容，手动勾选想要的照片</div>
            </button>
          </div>
        </section>

        <section className="filter-section">
          <h2>{selectionMode === 'filter' ? '导入素材库' : '手动选择素材'}</h2>
          <div className="manual-import">
            <label className="manual-import-button">
              {importedMedia.length === 0 ? '📸 点击导入照片 / 视频' : '继续添加照片 / 视频'}
              <input key={manualImportKey} className="manual-import-input" type="file" accept="image/*,video/*" multiple onChange={handleImportMediaChange} />
            </label>
            {importedMedia.length > 0 && <button type="button" className="manual-import-clear" onClick={handleClearImported}>清除导入</button>}
          </div>
          {importedMedia.length > 0 && (
            <div className="import-count">已导入 {importedMedia.length} 个文件</div>
          )}
          {importedMedia.length === 0 && (
            <div className="import-hint">
              <p>从手机相册或电脑文件夹选择照片，支持 JPG / PNG / HEIC 等格式</p>
              <p>所有照片仅在浏览器本地处理，不会上传到服务器</p>
            </div>
          )}
        </section>

        {selectionMode === 'manual' && (
          <section className="filter-section">
            <div className="manual-tabs">
              <button type="button" className={`manual-tab ${manualTab === 'albums' ? 'active' : ''}`} onClick={() => { setManualTab('albums'); setManualAlbum(''); }}>相册列表</button>
              <button type="button" className={`manual-tab ${manualTab === 'recent' ? 'active' : ''}`} onClick={() => { setManualTab('recent'); setManualAlbum(''); }}>最近</button>
              <button type="button" className={`manual-tab ${manualTab === 'favorites' ? 'active' : ''}`} onClick={() => { setManualTab('favorites'); setManualAlbum(''); }}>收藏</button>
            </div>
            {manualTab === 'albums' && !manualAlbum && (
              <div className="album-list">
                {manualAlbums.map(a => (
                  <button key={a.name} type="button" className="album-item" onClick={() => setManualAlbum(a.name)}>
                    <img src={a.coverUrl} alt={a.name} />
                    <div className="album-meta"><div className="album-name">{a.name}</div><div className="album-count">{a.count} 项</div></div>
                  </button>
                ))}
              </div>
            )}
            {(manualTab !== 'albums' || manualAlbum) && (
              <>
                {manualTab === 'albums' && manualAlbum && (
                  <div className="album-header"><button type="button" className="album-back" onClick={() => setManualAlbum('')}>← 相册列表</button><div className="album-title">{manualAlbum}</div></div>
                )}
                <div className="manual-filters">
                  <input className="manual-search" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} placeholder="搜索日期 / 地点 / 标签" />
                  <input className="manual-date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
                <div className="manual-actions">
                  <div className="manual-count">已选 {manualSelectedIds.length} 个 · 预计 {formatSeconds(manualEstimatedSeconds)}</div>
                  <div className="manual-buttons">
                    <button className="manual-button" onClick={handleSelectAllManual}>全选当前</button>
                    <button className="manual-button secondary" onClick={handleClearManual}>清空</button>
                  </div>
                </div>
                <div className="manual-grid">
                  {manualVisibleMediaSorted.map(media => {
                    const selected = manualSelectedIds.includes(media.id);
                    return (
                      <button key={media.id} type="button" className={`manual-item ${selected ? 'selected' : ''}`} onClick={() => handleToggleManualMedia(media.id)}>
                        <button type="button" className={`favorite-toggle ${media.favorite ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleToggleFavorite(media.id); }}>{media.favorite ? '★' : '☆'}</button>
                        <img src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="素材预览" />
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
                <label className="section-toggle"><input type="checkbox" checked={enableTime} onChange={(e) => setEnableTime(e.target.checked)} /> 启用</label>
              </div>
              <div className="time-options">
                {[['week','近一周'],['month','近一个月'],['quarter','近三个月'],['year','近一年'],['special','特殊日期'],['custom','自定义']].map(([val, label]) => (
                  <button key={val} className={`time-option ${timeRange === val ? 'active' : ''}`} onClick={() => setTimeRange(val)} disabled={!enableTime}>{label}</button>
                ))}
              </div>
              {enableTime && timeRange === 'custom' && (
                <>
                  <div className="custom-date">
                    <input type="date" value={customDate.start} onChange={(e) => setCustomDate(p => ({ ...p, start: e.target.value }))} placeholder="开始日期" />
                    <span>至</span>
                    <input type="date" value={customDate.end} onChange={(e) => setCustomDate(p => ({ ...p, end: e.target.value }))} placeholder="结束日期" />
                  </div>
                  {normalizedTime.notice && <div className={`custom-date-hint ${normalizedTime.noticeType}`}>{normalizedTime.notice}</div>}
                </>
              )}
              {enableTime && timeRange === 'special' && (
                <div className="special-dates"><button className="special-date-option">生日</button><button className="special-date-option">节假日</button><button className="special-date-option">纪念日</button></div>
              )}
            </section>

            <section className="filter-section">
              <h2>人物维度</h2>
              <div className="person-upload">
                <div className="person-upload-row">
                  <label className="person-upload-button">上传目标人物照片<input key={personUploadKey} className="person-upload-input" type="file" accept="image/*" onChange={handleTargetPersonPhotoChange} /></label>
                  {targetPersonPhoto.previewUrl && <button className="person-upload-clear" onClick={handleClearTargetPerson}>清除</button>}
                </div>
                {targetPersonPhoto.previewUrl && (
                  <div className="person-upload-preview">
                    <img src={targetPersonPhoto.previewUrl} alt="目标人物" />
                    <div className="person-upload-meta">
                      <div className="person-upload-name">{targetPersonPhoto.fileName}</div>
                      {personRecognition.status === 'processing' && <div className="person-upload-status">识别中…</div>}
                      {personRecognition.status === 'error' && <div className="person-upload-status error">识别失败，请换一张更清晰的人脸照片</div>}
                      {personRecognition.status === 'done' && personRecognition.personId && (
                        <div className="person-upload-status">识别结果：{mockPeople.find(p => p.id === personRecognition.personId)?.name}{personRecognition.confidence ? `（置信度 ${personRecognition.confidence}）` : ''}</div>
                      )}
                      <div className="person-upload-controls">
                        <select className="person-upload-select" value={personRecognition.personId ?? ''} onChange={(e) => { const pid = Number(e.target.value); if (!pid) return; setPersonRecognition(prev => ({ ...prev, status: 'done', personId: pid })); ensurePersonSelected(pid); }}>
                          <option value="">手动选择人物</option>
                          {mockPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className={`person-upload-only ${personRecognition.personId ? '' : 'disabled'}`} onClick={() => personRecognition.personId && setSelectedPeople([personRecognition.personId])} disabled={!personRecognition.personId}>仅筛选此人</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="people-options">
                {mockPeople.map(person => (
                  <button key={person.id} className={`person-option ${selectedPeople.includes(person.id) ? 'active' : ''}`}
                    onClick={() => setSelectedPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}>
                    {person.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <div className="section-title-row">
                <h2>格式维度</h2>
                <label className="section-toggle"><input type="checkbox" checked={enableFormat} onChange={(e) => setEnableFormat(e.target.checked)} /> 启用</label>
              </div>
              <div className="format-options">
                {[['includePhotos','照片（默认包含）'],['includeVideos','视频片段（默认包含）'],['includeLivePhoto','Live Photo（默认包含）'],['includeScreenshots','截图 / 屏幕录制（默认排除）']].map(([key,label]) => (
                  <div key={key} className="format-checkbox">
                    <input type="checkbox" id={`format-${key}`} checked={formatOptions[key]} onChange={(e) => setFormatOptions(p => ({ ...p, [key]: e.target.checked }))} disabled={!enableFormat} />
                    <label htmlFor={`format-${key}`}>{label}</label>
                  </div>
                ))}
              </div>
            </section>

            <section className="filter-section">
              <h2>智能去重</h2>
              <div className="deduplication-options">
                <div className="format-checkbox"><input type="checkbox" id="deduplication" defaultChecked /><label htmlFor="deduplication">自动识别相似照片</label></div>
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
                  <img src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="媒体预览" />
                  <span className="media-type">{media.type === 'photo' ? '📷' : '🎬'}</span>
                </div>
              ))}
              {selectedMedia.length > 4 && <div className="media-more">+{selectedMedia.length - 4}</div>}
            </div>
          </div>
        </section>

        <button className={`next-button ${selectedMedia.length === 0 ? 'disabled' : ''}`} onClick={handleNext} disabled={selectedMedia.length === 0}>下一步</button>
      </main>
    </div>
  );
};

export default FilterPage;
