import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { groupByDuplicate, applyDedupAndQuality } from '../lib/dedup';
import './ReviewPage.css';

const ReviewPage = () => {
  const navigate = useNavigate();
  const { filteredMedia, commitReview } = useProject();
  const [enableDedup, setEnableDedup] = useState(true);
  const [enableQuality, setEnableQuality] = useState(true);
  const [qualityThreshold, setQualityThreshold] = useState(0.4);

  const sourceMedia = filteredMedia;

  const grouped = useMemo(() => groupByDuplicate(sourceMedia), [sourceMedia]);

  const [dedupKeep, setDedupKeep] = useState(() => {
    const init = {};
    grouped.forEach(g => { if (g.items.length > 1) init[g.key] = g.items[0].id; });
    return init;
  });

  const { finalMedia, removedByDedupCount, removedByQualityCount } = useMemo(() =>
    applyDedupAndQuality(grouped, { enableDedup, enableQuality, qualityThreshold, dedupKeep }),
    [grouped, enableDedup, enableQuality, qualityThreshold, dedupKeep]
  );

  const duplicateGroups = useMemo(() => grouped.filter(g => g.items.length > 1), [grouped]);

  const handleBack = () => navigate('/filter');
  const handleNext = () => { commitReview(finalMedia); navigate('/style'); };

  return (
    <div className="review-container">
      <header className="review-header">
        <button className="back-button" onClick={handleBack}>←</button>
        <h1>预览素材</h1>
      </header>
      <main className="review-main">
        <section className="review-section">
          <div className="review-summary">
            <div className="summary-title">入选素材</div>
            <div className="summary-value">{finalMedia.length} / {sourceMedia.length}</div>
          </div>
          <div className="review-toggles">
            <label className="review-toggle"><input type="checkbox" checked={enableDedup} onChange={(e) => setEnableDedup(e.target.checked)} /> 智能去重</label>
            <label className="review-toggle"><input type="checkbox" checked={enableQuality} onChange={(e) => setEnableQuality(e.target.checked)} /> 过滤低质量</label>
          </div>
          <div className="review-hints">
            {enableDedup && <div>已去重 {removedByDedupCount} 张</div>}
            {enableQuality && <div>已过滤 {removedByQualityCount} 张</div>}
          </div>
          {enableQuality && (
            <div className="quality-row">
              <div className="quality-label">质量阈值</div>
              <input className="quality-range" type="range" min="0.2" max="0.9" step="0.05" value={qualityThreshold} onChange={(e) => setQualityThreshold(Number(e.target.value))} />
              <div className="quality-value">{qualityThreshold.toFixed(2)}</div>
            </div>
          )}
        </section>

        {enableDedup && duplicateGroups.length > 0 && (
          <section className="review-section">
            <h2>去重建议</h2>
            <div className="dedup-groups">
              {duplicateGroups.map(g => (
                <div key={g.key} className="dedup-group">
                  <div className="dedup-group-title">相似组（{g.items.length} 张）</div>
                  <div className="dedup-group-grid">
                    {g.items.map(it => (
                      <button key={it.id} type="button" className={`dedup-item ${dedupKeep[g.key] === it.id ? 'active' : ''}`} onClick={() => setDedupKeep(prev => ({ ...prev, [g.key]: it.id }))}>
                        <img src={it.type === 'photo' ? it.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="相似照片" />
                        <div className="dedup-badge">{dedupKeep[g.key] === it.id ? '保留' : '备选'}</div>
                        <div className="dedup-quality">质量 {it.qualityScore}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="review-section">
          <h2>素材一览</h2>
          <div className="review-grid">
            {finalMedia.map(m => (
              <div key={m.id} className="review-item">
                <img src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="素材" />
                <span className="review-type">{m.type === 'photo' ? '📷' : '🎬'}</span>
              </div>
            ))}
          </div>
        </section>

        <button className={`next-button ${finalMedia.length === 0 ? 'disabled' : ''}`} onClick={handleNext} disabled={finalMedia.length === 0}>下一步</button>
      </main>
    </div>
  );
};

export default ReviewPage;
