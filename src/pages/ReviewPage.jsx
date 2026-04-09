import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReviewPage.css';

const computeQualityScore = (media) => {
  const base = ((media.id * 2654435761) >>> 0) % 1000;
  const v = 0.2 + (base / 1000) * 0.8;
  return Number(v.toFixed(2));
};

const buildDedupKey = (media) => {
  const date = media.date ?? '';
  const location = media.location ?? '';
  const peopleKey = Array.isArray(media.personIds) ? media.personIds.join('-') : (Array.isArray(media.people) ? media.people.join('-') : '');
  return `${date}|${location}|${peopleKey}`;
};

const ReviewPage = () => {
  const navigate = useNavigate();
  const [enableDedup, setEnableDedup] = useState(true);
  const [enableQuality, setEnableQuality] = useState(true);
  const [qualityThreshold, setQualityThreshold] = useState(0.4);

  const sourceMedia = useMemo(() => {
    const raw = localStorage.getItem('filteredMedia');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    sourceMedia.forEach(m => {
      const key = buildDedupKey(m);
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
  }, [sourceMedia]);

  const [dedupKeep, setDedupKeep] = useState(() => {
    const init = {};
    grouped.forEach(g => {
      if (g.items.length > 1) {
        init[g.key] = g.items[0].id;
      }
    });
    return init;
  });

  const { finalMedia, removedByDedupCount, removedByQualityCount } = useMemo(() => {
    const dedupKeptIds = new Set();
    let removedByDedup = 0;

    const flattened = grouped.flatMap(g => {
      if (!enableDedup) return g.items;
      if (g.items.length <= 1) return g.items;
      const keepId = dedupKeep[g.key] ?? g.items[0].id;
      g.items.forEach(it => {
        if (it.id !== keepId) removedByDedup += 1;
      });
      return g.items.filter(it => it.id === keepId);
    });

    flattened.forEach(m => dedupKeptIds.add(m.id));

    const qualityFiltered = enableQuality
      ? flattened.filter(m => m.qualityScore >= qualityThreshold)
      : flattened;

    const removedByQuality = enableQuality ? flattened.length - qualityFiltered.length : 0;

    return {
      finalMedia: qualityFiltered.map(m => {
        const { qualityScore: _qualityScore, ...rest } = m;
        return rest;
      }),
      removedByDedupCount: enableDedup ? removedByDedup : 0,
      removedByQualityCount: removedByQuality
    };
  }, [grouped, enableDedup, enableQuality, qualityThreshold, dedupKeep]);

  const duplicateGroups = useMemo(() => grouped.filter(g => g.items.length > 1), [grouped]);

  const handleBack = () => navigate('/filter');

  const handleNext = () => {
    localStorage.setItem('filteredMedia', JSON.stringify(finalMedia));
    navigate('/style');
  };

  return (
    <div className="review-container">
      <header className="review-header">
        <button className="back-button" onClick={handleBack}>
          ←
        </button>
        <h1>预览素材</h1>
      </header>

      <main className="review-main">
        <section className="review-section">
          <div className="review-summary">
            <div className="summary-title">入选素材</div>
            <div className="summary-value">
              {finalMedia.length} / {sourceMedia.length}
            </div>
          </div>
          <div className="review-toggles">
            <label className="review-toggle">
              <input type="checkbox" checked={enableDedup} onChange={(e) => setEnableDedup(e.target.checked)} />
              智能去重
            </label>
            <label className="review-toggle">
              <input type="checkbox" checked={enableQuality} onChange={(e) => setEnableQuality(e.target.checked)} />
              过滤低质量
            </label>
          </div>
          <div className="review-hints">
            {enableDedup && <div>已去重 {removedByDedupCount} 张</div>}
            {enableQuality && <div>已过滤 {removedByQualityCount} 张</div>}
          </div>
          {enableQuality && (
            <div className="quality-row">
              <div className="quality-label">质量阈值</div>
              <input
                className="quality-range"
                type="range"
                min="0.2"
                max="0.9"
                step="0.05"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(Number(e.target.value))}
              />
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
                      <button
                        key={it.id}
                        type="button"
                        className={`dedup-item ${dedupKeep[g.key] === it.id ? 'active' : ''}`}
                        onClick={() => setDedupKeep(prev => ({ ...prev, [g.key]: it.id }))}
                      >
                        <img
                          src={it.type === 'photo' ? it.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'}
                          alt="相似照片"
                        />
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
                <img
                  src={m.type === 'photo' ? m.url : 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=video%20thumbnail&image_size=square'}
                  alt="素材"
                />
                <span className="review-type">{m.type === 'photo' ? '📷' : '🎬'}</span>
              </div>
            ))}
          </div>
        </section>

        <button className={`next-button ${finalMedia.length === 0 ? 'disabled' : ''}`} onClick={handleNext} disabled={finalMedia.length === 0}>
          下一步
        </button>
      </main>
    </div>
  );
};

export default ReviewPage;
