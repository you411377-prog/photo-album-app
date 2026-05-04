import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { renderVideo, generateTextBundle, isLikelySafariFamily } from '../lib/videoRenderer';
import * as bgmModule from '../lib/bgm';
import { checkServerHealth, serverRender as doServerRender, exportBlobAsFile, copyTextToClipboard } from '../lib/serverRender';
import { hasRenderApiBaseUrl } from '../lib/renderApi';
import { buildShareUrl, createShareId, isSupabaseConfigured, saveMemoirProject, supabaseConfigMessage } from '../lib/supabase';
import './GeneratePage.css';

const GeneratePage = () => {
  const navigate = useNavigate();
  const { currentMedia, selectedStyle, textTone, derived, textBundle, setTextBundle, commitVideo } = useProject();

  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [resolution, setResolution] = useState('720p');
  const [orderedMedia, setOrderedMedia] = useState(() => currentMedia);
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
  const [browserHint, setBrowserHint] = useState('');

  const hasRenderApi = hasRenderApiBaseUrl();
  const isSafari = isLikelySafariFamily();
  const isWeChat = useMemo(() => /MicroMessenger/i.test(navigator.userAgent), []);

  // Init text bundle
  useEffect(() => {
    if (!textBundle.title) setTextBundle(generateTextBundle(textTone, derived));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setOrderedMedia(currentMedia); }, [currentMedia]);

  useEffect(() => { if (isSafari && resolution !== '720p') setResolution('720p'); }, [isSafari, resolution]);

  useEffect(() => { return () => { if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current); }; }, []);

  const currentMemoirSignature = useMemo(() => JSON.stringify({
    videoSize: videoBlob?.size || 0, videoType: videoMime, title: textBundle.title,
    intro: textBundle.intro, ending: textBundle.ending, resolution,
    mediaCount: currentMedia.length, styleId: selectedStyle?.id || '', tone: textTone
  }), [currentMedia.length, resolution, selectedStyle?.id, textBundle, textTone, videoBlob?.size, videoMime]);

  const sharedMemoirUrl = useMemo(() => buildShareUrl(savedMemoir?.share_id || savedMemoir?.shareId || ''), [savedMemoir]);

  // --- Reset helpers ---
  const resetVideoState = useCallback(() => {
    setGenerationError(''); setBgmHint(''); setSaveError(''); setShareNotice('');
    setBrowserHint(''); setSavedMemoir(null); setSavedSignature('');
    setProgress(0); setIsGenerating(true);
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = ''; setVideoUrl(''); setVideoBlob(null); setVideoMime('');
  }, []);

  // --- Client-side render ---
  const generateVideo = useCallback(async () => {
    resetVideoState();
    const result = await renderVideo({
      orderedMedia, resolution, textBundle, textTone, styleId: selectedStyle?.id || '',
      bgmEnabled, bgmVolume, bgmPreset,
      onProgress: setProgress, bgmModule
    });
    if (!result) {
      setGenerationError(isSafari
        ? '视频生成失败：Safari 没有返回可用视频数据。建议先关闭低电量模式、只选少量照片重试；如果仍失败，请改用桌面端生成后在手机查看结果。'
        : '视频生成失败。建议换用系统浏览器中的 Safari / Chrome，或改用桌面端继续生成。');
      setIsGenerating(false);
      return;
    }
    const url = URL.createObjectURL(result.blob);
    videoUrlRef.current = url;
    setVideoBlob(result.blob); setVideoUrl(url); setVideoMime(result.mimeType);
    commitVideo(result.blob, result.mimeType, url);
    setProgress(100); setIsGenerating(false);
  }, [orderedMedia, resolution, textBundle, textTone, selectedStyle?.id, bgmEnabled, bgmVolume, bgmPreset, isSafari, resetVideoState, commitVideo]);

  // --- Server-side render ---
  const handleServerRender = useCallback(async () => {
    resetVideoState();
    setServerError(''); setServerStatusText(''); setServerGenerating(true);

    if (!serverConfirmRef.current) {
      const ok = window.confirm('将把你选择的素材上传到已配置的辅助渲染服务进行合成，仅用于本次生成。是否继续？');
      if (!ok) { setIsGenerating(false); setServerGenerating(false); return; }
      serverConfirmRef.current = true;
    }

    const result = await doServerRender({
      orderedMedia, resolution, bgmEnabled, bgmVolume,
      onProgress: setProgress, onStatus: setServerStatusText
    });

    if ('error' in result) {
      setServerError(result.error); setIsGenerating(false); setServerGenerating(false); setServerStatusText('');
      return;
    }

    const url = URL.createObjectURL(result.blob);
    videoUrlRef.current = url;
    setVideoBlob(result.blob); setVideoUrl(url); setVideoMime(result.mimeType);
    commitVideo(result.blob, result.mimeType, url);
    setProgress(100); setIsGenerating(false); setServerGenerating(false); setServerStatusText('');
  }, [orderedMedia, resolution, bgmEnabled, bgmVolume, resetVideoState, commitVideo]);

  // --- Cloud save ---
  const persistMemoir = useCallback(async () => {
    if (!videoBlob) throw new Error('请先生成视频后再保存作品。');
    if (!isSupabaseConfigured) throw new Error(supabaseConfigMessage);
    if (savedMemoir && savedSignature === currentMemoirSignature) return savedMemoir;

    setSavingMemoir(true); setSaveError(''); setShareNotice('');
    try {
      const shareId = createShareId();
      const videoExt = videoMime.includes('webm') ? 'webm' : 'mp4';
      const record = await saveMemoirProject({
        shareId, videoBlob, videoExt,
        metadata: {
          title: textBundle.title || '我的回忆录', intro: textBundle.intro || '', ending: textBundle.ending || '',
          style_id: selectedStyle?.id || '', style_name: selectedStyle?.name || '', tone: textTone,
          resolution, media_count: currentMedia.length
        }
      });
      setSavedMemoir(record); setSavedSignature(currentMemoirSignature);
      setShareNotice('作品已保存到云端。');
      return record;
    } catch (err) {
      setSaveError(err.message || '保存作品失败，请稍后重试。');
      throw err;
    } finally {
      setSavingMemoir(false);
    }
  }, [currentMemoirSignature, currentMedia.length, resolution, savedMemoir, savedSignature, selectedStyle, textBundle, textTone, videoBlob, videoMime]);

  const handleDownload = () => {
    if (!videoBlob) return;
    exportBlobAsFile(videoBlob, `memoir.${videoMime.includes('mp4') ? 'mp4' : 'webm'}`);
  };

  const handleSaveToCloud = async () => {
    try {
      const record = await persistMemoir();
      const url = buildShareUrl(record.share_id || record.shareId);
      setShareNotice(url ? '作品已保存，可直接复制分享链接。' : '作品已保存到云端。');
    } catch { /* noop */ }
  };

  const handleShare = async () => {
    try {
      const record = await persistMemoir();
      const shareUrl = buildShareUrl(record.share_id || record.shareId);
      if (!shareUrl) throw new Error('未能生成分享链接。');
      const title = textBundle.title || '我的回忆录';
      const text = `${currentMedia.length} 个片段 · ${selectedStyle?.name ?? '回忆录作品'}`;
      if (navigator.share) { await navigator.share({ title, text, url: shareUrl }); setShareNotice('分享面板已打开。'); return; }
      await copyTextToClipboard(shareUrl);
      setShareNotice('分享链接已复制到剪贴板。');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setSaveError(err.message || '生成分享链接失败。');
    }
  };

  const handleMove = (index, dir) => {
    setOrderedMedia(prev => {
      const next = [...prev]; const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  // --- Auto-start on mount ---
  useEffect(() => {
    if (!hasRenderApi) return;
    checkServerHealth().then(ok => setServerReachable(ok)).catch(() => setServerReachable(false));
  }, [hasRenderApi]);

  useEffect(() => {
    if (isWeChat) {
      setGenerationError('微信内置浏览器通常无法稳定本地生成视频。建议点击右上角用系统浏览器打开后再生成。');
      setBrowserHint('推荐在手机系统浏览器中打开本页。');
      setIsGenerating(false);
      if (hasRenderApi && serverReachable && !autoServerTriedRef.current) { autoServerTriedRef.current = true; handleServerRender(); }
      return;
    }
    generateVideo();
  }, [isWeChat, hasRenderApi, serverReachable, handleServerRender, generateVideo]);

  // ========= RENDER =========
  return (
    <div className="generate-container">
      <header className="generate-header">
        <button className="back-button" onClick={() => navigate('/style')}>←</button>
        <h1>生成视频</h1>
      </header>
      <main className="generate-main">
        {isGenerating ? (
          <div className="generating-section">
            <div className="progress-container">
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>
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
                {currentMedia.slice(0, 6).map(media => (
                  <div key={media.id} className="media-preview-item">
                    <img src={media.type === 'photo' ? media.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="媒体预览" />
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
                  <p className="preview-info">{generationError || '当前浏览器可能不支持本地录制。'}</p>
                  {browserHint && <div className="server-error">{browserHint}</div>}
                  {hasRenderApi && (
                    <button className="server-generate" onClick={handleServerRender} disabled={serverGenerating}>
                      {serverGenerating ? '辅助渲染中…' : '使用辅助渲染'}
                    </button>
                  )}
                  {serverError && <div className="server-error">{serverError}</div>}
                </div>
              )}
            </div>

            <div className="edit-section">
              <h3>视频编辑</h3>
              <div className="edit-options">
                <button className="edit-button" onClick={generateVideo}><span className="edit-icon">▶</span> 重新生成</button>
              </div>
            </div>

            <div className="order-section">
              <div className="order-header">
                <h3>素材顺序</h3>
                <select className="resolution-select" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  <option value="720p">720P</option><option value="1080p">1080P</option>
                </select>
              </div>
              <div className="order-list">
                {orderedMedia.map((m, idx) => (
                  <div key={m.id} className="order-item">
                    <img className="order-thumb" src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="素材" />
                    <div className="order-meta"><div className="order-title">{m.type === 'photo' ? '照片' : '视频'} {idx + 1}</div><div className="order-sub">{m.date || m.importedAt || ''}</div></div>
                    <div className="order-buttons">
                      <button className="order-btn" onClick={() => handleMove(idx, -1)} disabled={idx === 0}>↑</button>
                      <button className="order-btn" onClick={() => handleMove(idx, 1)} disabled={idx === orderedMedia.length - 1}>↓</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="music-section">
              <h3>音乐</h3>
              <div className="music-controls">
                <label className="music-toggle"><input type="checkbox" checked={bgmEnabled} onChange={(e) => setBgmEnabled(e.target.checked)} /> 启用背景音乐</label>
                <select className="music-select" value={bgmPreset} onChange={(e) => setBgmPreset(e.target.value)} disabled={!bgmEnabled}>
                  <option value="warm">温情</option><option value="couple">甜蜜</option><option value="travel">旅行</option><option value="vintage">怀旧</option>
                </select>
                <div className="music-volume">
                  <input className="music-range" type="range" min="0" max="1" step="0.05" value={bgmVolume} onChange={(e) => setBgmVolume(Number(e.target.value))} disabled={!bgmEnabled} />
                  <div className="music-volume-value">{Math.round(bgmVolume * 100)}%</div>
                </div>
              </div>
              {bgmHint && <div className="music-hint">{bgmHint}</div>}
            </div>

            <div className="text-section">
              <div className="text-header">
                <h3>AI 文字</h3>
                <button className="text-regenerate" onClick={() => setTextBundle(generateTextBundle(textTone, derived))}>重新生成</button>
              </div>
              <div className="text-field"><div className="text-label">开场标题</div><input className="text-input" value={textBundle.title} onChange={(e) => setTextBundle(prev => ({ ...prev, title: e.target.value }))} /></div>
              <div className="text-field"><div className="text-label">旁白</div><textarea className="text-textarea" value={textBundle.intro} onChange={(e) => setTextBundle(prev => ({ ...prev, intro: e.target.value }))} rows={3} /></div>
              <div className="text-field"><div className="text-label">结尾寄语</div><textarea className="text-textarea" value={textBundle.ending} onChange={(e) => setTextBundle(prev => ({ ...prev, ending: e.target.value }))} rows={2} /></div>
            </div>

            <div className="action-buttons">
              <button className={`action-button save-button ${!videoBlob ? 'disabled' : ''}`} onClick={handleDownload} disabled={!videoBlob}>下载视频</button>
              <button className={`action-button cloud-button ${!videoBlob || savingMemoir ? 'disabled' : ''}`} onClick={handleSaveToCloud} disabled={!videoBlob || savingMemoir}>{savingMemoir ? '保存中...' : '保存作品'}</button>
              <button className={`action-button share-button ${(!videoBlob && !savedMemoir) || savingMemoir ? 'disabled' : ''}`} onClick={handleShare} disabled={(!videoBlob && !savedMemoir) || savingMemoir}>复制分享链接</button>
            </div>

            <div className="share-status-panel">
              {!isSupabaseConfigured && <div className="share-status-item warn">云端保存未启用：{supabaseConfigMessage}</div>}
              {saveError && <div className="share-status-item error">{saveError}</div>}
              {shareNotice && <div className="share-status-item success">{shareNotice}</div>}
              {sharedMemoirUrl && (
                <div className="share-link-box">
                  <div className="share-link-label">公开作品链接</div>
                  <a href={sharedMemoirUrl} target="_blank" rel="noreferrer">{sharedMemoirUrl}</a>
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
