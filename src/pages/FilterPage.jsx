import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { filterMedia } from '../data/mockData';
import { parseExifFromImageFile } from '../lib/exifParser';
import { formatYmd, formatHm, formatSeconds } from '../lib/dateUtils';
import './FilterPage.css';

const FilterPage = () => {
  const navigate = useNavigate();
  const { importedMedia, setImportedMedia, commitFilter } = useProject();

  const [selectionMode, setSelectionMode] = useState('manual');
  const [enableTime, setEnableTime] = useState(true);
  const [timeRange, setTimeRange] = useState('month');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [enableFormat, setEnableFormat] = useState(true);
  const [formatOptions, setFormatOptions] = useState({
    includePhotos: true, includeVideos: true, includeLivePhoto: true, includeScreenshots: false
  });
  const [manualImportKey, setManualImportKey] = useState(0);
  const [manualSelectedIds, setManualSelectedIds] = useState([]);
  const [manualDate, setManualDate] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const [rescuedIds, setRescuedIds] = useState(new Set());

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
    const newIds = mapped.map(m => m.id);
    setImportedMedia(prev => [...prev, ...mapped]);
    if (selectionMode === 'manual') {
      setManualSelectedIds(prev => [...prev, ...newIds]);
    }
    setManualDate('');
  };

  const handleClearImported = () => {
    importedMedia.forEach(m => { if (typeof m.url === 'string' && m.url.startsWith('blob:')) URL.revokeObjectURL(m.url); });
    setImportedMedia([]);
    setManualImportKey(prev => prev + 1);
    setManualSelectedIds([]);
  };

  const normalizedTime = useMemo(() => {
    if (timeRange !== 'custom') return { start: null, end: null, notice: '', noticeType: '' };
    const s = customDate.start ? new Date(customDate.start) : null;
    const e = customDate.end ? new Date(customDate.end) : null;
    if (s && e && e < s) return { start: e, end: s, notice: '已自动交换开始与结束日期', noticeType: 'info' };
    return { start: s, end: e, notice: '', noticeType: '' };
  }, [timeRange, customDate]);

  const allMedia = useMemo(() => [...importedMedia], [importedMedia]);

  const manualVisibleMedia = useMemo(() => {
    if (!manualDate) return allMedia;
    return allMedia.filter(m => m.date === manualDate);
  }, [allMedia, manualDate]);

  const filterResult = useMemo(() => {
    if (selectionMode === 'manual') {
      const selected = allMedia.filter(m => manualSelectedIds.includes(m.id));
      const removed = allMedia.filter(m => !manualSelectedIds.includes(m.id) && manualVisibleMedia.includes(m));
      return { selectedMedia: selected, removedMedia: removed, removedByDedup: 0 };
    }
    const passed = filterMedia(allMedia, {
      timeRange: enableTime ? timeRange : null, customDate: enableTime ? customDate : null,
      people: [], enableFormat, formatOptions
    });
    const filterRejected = allMedia.filter(m => !passed.includes(m));
    return { selectedMedia: passed, removedMedia: filterRejected, removedByDedup: 0 };
  }, [selectionMode, allMedia, manualSelectedIds, manualVisibleMedia, enableTime, timeRange, customDate, enableFormat, formatOptions]);

  const rescuedMediaInFilter = useMemo(() =>
    selectionMode === 'filter' ? allMedia.filter(m => rescuedIds.has(m.id)) : [],
  [allMedia, rescuedIds, selectionMode]);
  const selectedMedia = useMemo(() => {
    const base = filterResult.selectedMedia;
    if (selectionMode === 'filter' && rescuedMediaInFilter.length > 0) {
      return [...rescuedMediaInFilter.filter(m => !base.some(b => b.id === m.id)), ...base];
    }
    return base;
  }, [filterResult.selectedMedia, rescuedMediaInFilter, selectionMode]);
  const removedMedia = filterResult.removedMedia;

  const manualVisibleMediaSorted = useMemo(() => [...manualVisibleMedia].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [manualVisibleMedia]);

  const manualEstimatedSeconds = useMemo(() => manualSelectedIds.length * 2, [manualSelectedIds]);

  const handleSwitchMode = (mode) => {
    setSelectionMode(mode);
    if (mode === 'manual') {
      setManualSelectedIds(allMedia.map(m => m.id));
    }
  };

  const handleToggleManualMedia = (mediaId) => setManualSelectedIds(prev => prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]);
  const handleSelectAllManual = () => { const ids = manualVisibleMediaSorted.map(m => m.id); setManualSelectedIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return Array.from(s); }); };
  const handleClearManual = () => setManualSelectedIds([]);
  const handleRescue = (mediaId) => {
    setRescuedIds(prev => new Set([...prev, mediaId]));
    if (selectionMode === 'manual') {
      setManualSelectedIds(prev => prev.includes(mediaId) ? prev : [...prev, mediaId]);
    }
  };
  const visibleRemovedMedia = useMemo(() =>
    removedMedia.filter(m => !rescuedIds.has(m.id)),
  [removedMedia, rescuedIds]);
  const handleNext = () => { commitFilter(selectedMedia); navigate('/review'); };
  const handleBack = () => navigate('/home');

  return (
    <div className="filter-container">
      <header className="filter-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1>素材导入</h1>
      </header>
      <main className="filter-main">
        <section className="filter-section">
          <h2>选择方式</h2>
          <div className="mode-cards">
            <button type="button" className={`mode-card ${selectionMode === 'filter' ? 'active' : ''}`} onClick={() => handleSwitchMode('filter')}>
              <div className="mode-card-icon">🔍</div><div className="mode-card-title">智能导入</div><div className="mode-card-desc">按时间、格式等维度自动导入</div>
            </button>
            <button type="button" className={`mode-card ${selectionMode === 'manual' ? 'active' : ''}`} onClick={() => handleSwitchMode('manual')}>
              <div className="mode-card-icon">🖼️</div><div className="mode-card-title">手动导入</div><div className="mode-card-desc">浏览所有照片，手动勾选想要的</div>
            </button>
          </div>
        </section>

        <section className="filter-section">
          <h2>导入素材</h2>
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
            <div className="manual-filters">
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
                    <img src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="素材预览" />
                    <span className="manual-type">{media.type === 'photo' ? '📷' : '🎬'}</span>
                    <span className="manual-check">{selected ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
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

            <section className="filter-section disabled-section">
              <div className="section-title-row">
                <h2>人物维度</h2>
                <span className="coming-soon-badge">功能开发中</span>
              </div>
              <p className="disabled-hint">人脸识别筛选功能预计后续版本上线</p>
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

          </>
        )}

        <section className="filter-section">
          <h2>最终素材</h2>
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

        {visibleRemovedMedia.length > 0 && (
          <section className="filter-section removed-section">
            <button type="button" className="removed-toggle" onClick={() => setShowRemoved(!showRemoved)}>
              <h2>未选中的素材 ({visibleRemovedMedia.length} 张)</h2>
              <span className={`toggle-arrow ${showRemoved ? 'open' : ''}`}>▾</span>
            </button>
            {showRemoved && (
              <div className="removed-grid">
                {visibleRemovedMedia.slice(0, 30).map(media => (
                  <div key={media.id} className="removed-item">
                    <img src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="被过滤素材" />
                    <div className="removed-meta">
                      <span>{media.date || ''}</span>
                      <span>{media.location || ''}</span>
                    </div>
                    <button type="button" className="rescue-button" onClick={() => handleRescue(media.id)}>捞回</button>
                  </div>
                ))}
                {visibleRemovedMedia.length > 30 && <p className="removed-more">...还有 {visibleRemovedMedia.length - 30} 张</p>}
              </div>
            )}
          </section>
        )}

        <button className={`next-button ${selectedMedia.length === 0 ? 'disabled' : ''}`} onClick={handleNext} disabled={selectedMedia.length === 0}>下一步</button>
      </main>
    </div>
  );
};

export default FilterPage;
