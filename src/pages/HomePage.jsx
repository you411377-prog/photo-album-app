import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildShareUrl,
  fetchMemoirProjects,
  isSupabaseConfigured,
  supabaseConfigMessage
} from '../lib/supabase';
import './HomePage.css';

const formatCreatedAt = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const HomePage = () => {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const handleStart = () => {
    navigate('/filter');
  };

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!isSupabaseConfigured) {
        setHistoryError(supabaseConfigMessage);
        return;
      }

      setHistoryLoading(true);
      setHistoryError('');

      try {
        const items = await fetchMemoirProjects({ limit: 6 });
        if (!active) return;
        setHistoryItems(items);
      } catch (err) {
        if (!active) return;
        setHistoryError(err.message || '历史作品加载失败。');
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const handleOpenHistory = (shareId) => {
    if (!shareId) return;
    navigate(`/share/${shareId}`);
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>智能相册回忆录</h1>
        <p>一键生成你的专属回忆视频</p>
      </header>
      
      <main className="home-main">
        <section className="home-features">
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h3>时间维度</h3>
            <p>筛选特定时间段的照片</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>人物维度</h3>
            <p>选择特定人物的照片</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎬</div>
            <h3>格式维度</h3>
            <p>包含照片和视频</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>多种风格</h3>
            <p>选择适合的视频风格</p>
          </div>
        </section>

        <button className="start-button" onClick={handleStart}>
          开始整理
        </button>

        <section className="home-templates">
          <h2>推荐模板</h2>
          <div className="template-grid">
            <div className="template-card">
              <div className="template-icon">👨‍👩‍👧‍👦</div>
              <h3>亲子治愈风</h3>
              <p>温馨家庭回忆</p>
            </div>
            <div className="template-card">
              <div className="template-icon">💑</div>
              <h3>情侣甜蜜风</h3>
              <p>浪漫爱情回忆</p>
            </div>
            <div className="template-card">
              <div className="template-icon">✈️</div>
              <h3>旅行记录风</h3>
              <p>精彩旅行回忆</p>
            </div>
          </div>
        </section>

        <section className="home-history">
          <h2>历史记录</h2>
          <div className="history-list">
            {historyLoading && (
              <div className="history-empty">正在加载云端作品...</div>
            )}

            {!historyLoading && historyError && (
              <div className="history-empty history-warn">{historyError}</div>
            )}

            {!historyLoading && !historyError && historyItems.length === 0 && (
              <div className="history-empty">还没有保存过作品，生成后会出现在这里。</div>
            )}

            {!historyLoading && !historyError && historyItems.map((item) => {
              const shareUrl = buildShareUrl(item.share_id);
              return (
                <div key={item.id || item.share_id} className="history-item">
                  <div className="history-thumbnail">
                    <span>📹</span>
                  </div>
                  <div className="history-info">
                    <h4>{item.title || '未命名回忆录'}</h4>
                    <p>{`${formatCreatedAt(item.created_at) || '未记录时间'} • ${item.style_name || '未记录风格'}`}</p>
                    {shareUrl && (
                      <a
                        className="history-link"
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看公开链接
                      </a>
                    )}
                  </div>
                  <button className="history-play" onClick={() => handleOpenHistory(item.share_id)}>
                    ▶
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <p>© 2026 智能相册回忆录</p>
      </footer>
    </div>
  );
};

export default HomePage;
