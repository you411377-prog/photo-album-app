import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { groupByDuplicate, applyDedupAndQuality } from '../lib/dedup';
import './ReviewPage.css';

const ReviewPage = () => {
  const navigate = useNavigate();
  const { filteredMedia, commitReview } = useProject();
  const [enableDedup, setEnableDedup] = useState(true);
  const [enableQuality, setEnableQuality] = useState(true);
  const [dedupStrength, setDedupStrength] = useState(80);
  const [qualityThreshold, setQualityThreshold] = useState(0.4);
  const [rescuedIds, setRescuedIds] = useState(new Set());
  const [dedupExpanded, setDedupExpanded] = useState(false);
  const [qualityExpanded, setQualityExpanded] = useState(false);

  const sourceMedia = filteredMedia;

  const grouped = useMemo(() => groupByDuplicate(sourceMedia, dedupStrength), [sourceMedia, dedupStrength]);

  const dedupKeep = useMemo(() => {
    const init = {};
    grouped.forEach(g => {
      if (g.items.length > 1) init[g.key] = new Set([g.items[0].id]);
    });
    return init;
  }, [grouped]);

  const { finalMedia: rawFinalMedia, removedByDedupCount, removedByQualityCount, qualityRemovedItems } = useMemo(() =>
    applyDedupAndQuality(grouped, { enableDedup, enableQuality, qualityThreshold, dedupKeep }),
    [grouped, enableDedup, enableQuality, qualityThreshold, dedupKeep]
  );

  const finalMedia = useMemo(() => {
    if (rescuedIds.size === 0) return rawFinalMedia;
    const rescued = qualityRemovedItems.filter(m => rescuedIds.has(m.id));
    return [...rawFinalMedia, ...rescued];
  }, [rawFinalMedia, qualityRemovedItems, rescuedIds]);

  const visibleQualityRemoved = useMemo(() =>
    qualityRemovedItems.filter(m => !rescuedIds.has(m.id)),
    [qualityRemovedItems, rescuedIds]
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
            <label className="review-toggle">
              <input type="checkbox" checked={enableDedup} onChange={(e) => setEnableDedup(e.target.checked)} /> 智能去重
            </label>
            <label className="review-toggle">
              <input type="checkbox" checked={enableQuality} onChange={(e) => setEnableQuality(e.target.checked)} /> 过滤低质量
            </label>
          </div>
          <div className="review-hints">
            {enableDedup && <div>已去重 {removedByDedupCount} 张</div>}
            {enableQuality && <div>已过滤 {removedByQualityCount - rescuedIds.size} 张</div>}
          </div>

          {enableDedup && (
            <div className="quality-row">
              <div className="quality-label">去重力度</div>
              <input className="quality-range" type="range" min="0" max="100" step="5"
                value={dedupStrength}
                onChange={(e) => setDedupStrength(Number(e.target.value))} />
              <div className="quality-value">{dedupStrength}%</div>
            </div>
          )}

          {enableQuality && (
            <div className="quality-row">
              <div className="quality-label">质量阈值</div>
              <input className="quality-range" type="range" min="0.2" max="0.9" step="0.05"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(Number(e.target.value))} />
              <div className="quality-value">{qualityThreshold.toFixed(2)}</div>
            </div>
          )}
        </section>

        {enableDedup && duplicateGroups.length > 0 && (
          <section className="review-section">
            <div className="collapse-header" onClick={() => setDedupExpanded(!dedupExpanded)}>
              <h2>去重建议（{removedByDedupCount} 张备选）{dedupExpanded ? ' ▾' : ' ▸'}</h2>
              <span className="collapse-hint">点击照片切换保留/备选</span>
            </div>
            {dedupExpanded && (
            <div className="dedup-groups">
              {duplicateGroups.map(g => {
                const keepSet = dedupKeep[g.key] instanceof Set ? dedupKeep[g.key] : new Set([dedupKeep[g.key]]);
                return (
                  <div key={g.key} className="dedup-group">
                    <div className="dedup-group-title">
                      相似组（{g.items.length} 张 · 保留 {keepSet.size} 张）
                    </div>
                    <div className="dedup-group-grid">
                      {g.items.map(it => {
                        const isKept = keepSet.has(it.id);
                        return (
                          <div key={it.id} className={`dedup-item ${isKept ? 'active' : 'dimmed'}`}>
                            <img src={it.type === 'photo' ? it.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="照片" />
                            <div className={`dedup-badge ${isKept ? 'keep' : 'skip'}`}>
                              {isKept ? '保留' : '备选'}
                            </div>
                            <div className="dedup-quality">质量 {it.qualityScore}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </section>
        )}

        {enableQuality && visibleQualityRemoved.length > 0 && (
          <section className="review-section removed-section">
            <div className="collapse-header" onClick={() => setQualityExpanded(!qualityExpanded)}>
              <h2>被过滤的照片（{visibleQualityRemoved.length} 张）{qualityExpanded ? ' ▾' : ' ▸'}</h2>
              <span className="collapse-hint">点击照片可回捞</span>
            </div>
            {qualityExpanded && (
            <div className="removed-grid">
              {visibleQualityRemoved.map(m => (
                <button key={m.id} type="button" className="removed-item" onClick={() => setRescuedIds(prev => new Set([...prev, m.id]))}>
                  <img src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="被过滤" />
                  <div className="removed-badge">已过滤</div>
                  <div className="dedup-quality">质量 {m.qualityScore}</div>
                </button>
              ))}
            </div>
            )}
          </section>
        )}

        <section className="review-section">
          <h2>素材一览（{finalMedia.length} 张）</h2>
          <div className="review-grid">
            {finalMedia.map(m => (
              <div key={m.id} className="review-item">
                <img src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'} alt="素材" />
                <span className="review-type">{m.type === 'photo' ? '📷' : '🎬'}</span>
              </div>
            ))}
          </div>
        </section>

        <button className={`next-button ${finalMedia.length === 0 ? 'disabled' : ''}`}
          onClick={handleNext} disabled={finalMedia.length === 0}>
          下一步
        </button>
      </main>
    </div>
  );
};

export default ReviewPage;
