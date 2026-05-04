import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildShareUrl, fetchMemoirProjects, isSupabaseConfigured } from '../lib/supabase';
import './HomePage.css';

const formatCreatedAt = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date);
};

const HomePage = () => {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleStart = () => navigate('/filter');

  // Quick-start: click a template card to jump to filter with that style pre-hinted
  const handleTemplateClick = (styleId) => {
    // Store a hint for later use; FilterPage will pick it up if needed
    try { localStorage.setItem('templateHint', styleId); } catch { /* noop */ }
    navigate('/filter');
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return; // silently skip — no error shown
    let active = true;
    setHistoryLoading(true);
    fetchMemoirProjects({ limit: 6 })
      .then(items => { if (active) setHistoryItems(items); })
      .catch(() => {})
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>智能相册回忆录</h1>
        <p>导入照片，一键生成专属回忆视频</p>
      </header>

      <main className="home-main">
        {/* How it works */}
        <section className="home-steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon">📸</div>
            <h3>导入照片</h3>
            <p>从手机或电脑选择照片导入</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon">✨</div>
            <h3>智能筛选</h3>
            <p>按时间 / 人物筛选，自动去重</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon">🎬</div>
            <h3>生成视频</h3>
            <p>选择风格，生成配乐回忆视频</p>
          </div>
        </section>

        <button className="start-button" onClick={handleStart}>
          开始制作
        </button>

        {/* Feature highlights */}
        <section className="home-features">
          <div className="feature-card">
            <div className="feature-icon">🎵</div>
            <h3>背景音乐</h3>
            <p>多种风格 BGM 自动适配</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>AI 配文</h3>
            <p>自动生成开场旁白与结尾寄语</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <h3>转场效果</h3>
            <p>照片间平滑过渡动画</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💾</div>
            <h3>下载导出</h3>
            <p>生成 MP4 一键保存到本地</p>
          </div>
        </section>

        {/* Templates */}
        <section className="home-templates">
          <h2>选择模板快速开始</h2>
          <div className="template-grid">
            <div className="template-card" onClick={() => handleTemplateClick('parent-child')}>
              <div className="template-icon">👨‍👩‍👧‍👦</div>
              <h3>亲子治愈风</h3>
              <p>温馨家庭回忆</p>
            </div>
            <div className="template-card" onClick={() => handleTemplateClick('couple')}>
              <div className="template-icon">💑</div>
              <h3>情侣甜蜜风</h3>
              <p>浪漫爱情回忆</p>
            </div>
            <div className="template-card" onClick={() => handleTemplateClick('travel')}>
              <div className="template-icon">✈️</div>
              <h3>旅行记录风</h3>
              <p>精彩旅行回忆</p>
            </div>
            <div className="template-card" onClick={() => handleTemplateClick('vintage')}>
              <div className="template-icon">📷</div>
              <h3>岁月经典风</h3>
              <p>怀旧成长回顾</p>
            </div>
          </div>
        </section>

        {/* History — only shown when Supabase is configured and has items */}
        {isSupabaseConfigured && (historyLoading || historyItems.length > 0) && (
          <section className="home-history">
            <h2>历史作品</h2>
            <div className="history-list">
              {historyLoading && <div className="history-empty">正在加载...</div>}
              {!historyLoading && historyItems.map((item) => {
                const shareUrl = buildShareUrl(item.share_id);
                return (
                  <div key={item.id || item.share_id} className="history-item">
                    <div className="history-thumbnail"><span>📹</span></div>
                    <div className="history-info">
                      <h4>{item.title || '未命名回忆录'}</h4>
                      <p>{`${formatCreatedAt(item.created_at) || ''} · ${item.style_name || ''}`}</p>
                      {shareUrl && <a className="history-link" href={shareUrl} target="_blank" rel="noreferrer">查看链接</a>}
                    </div>
                    <button className="history-play" onClick={() => navigate(`/share/${item.share_id}`)}>▶</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="home-note">
          <p>所有照片仅在你的浏览器本地处理，不会上传到任何服务器。</p>
        </section>
      </main>

      <footer className="home-footer">
        <p>© 2026 智能相册回忆录 · 纯前端运行，无需注册</p>
      </footer>
    </div>
  );
};

export default HomePage;
