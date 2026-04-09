import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMemoirProject, isSupabaseConfigured, supabaseConfigMessage } from '../lib/supabase';
import './SharePage.css';

const formatCreatedAt = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const SharePage = () => {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [memoir, setMemoir] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!shareId) {
        setError('分享链接缺少作品标识。');
        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured) {
        setError(supabaseConfigMessage);
        setLoading(false);
        return;
      }

      try {
        const data = await fetchMemoirProject(shareId);
        if (!active) return;
        setMemoir(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || '作品加载失败。');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [shareId]);

  return (
    <div className="share-page">
      <div className="share-shell">
        <header className="share-header">
          <div>
            <div className="share-eyebrow">智能相册回忆录</div>
            <h1>{memoir?.title || '回忆录分享'}</h1>
            <p>一个可公开访问的作品页，适合挂到个人主页或发给面试官体验。</p>
          </div>
          <Link to="/home" className="share-home-link">
            返回应用
          </Link>
        </header>

        <main className="share-content">
          {loading && <div className="share-card share-status">正在加载作品...</div>}

          {!loading && error && (
            <div className="share-card share-status error">
              <div className="share-status-title">作品暂时无法打开</div>
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && memoir && (
            <>
              <section className="share-card share-player-card">
                <video className="share-video" src={memoir.video_url} controls playsInline />
              </section>

              <section className="share-grid">
                <article className="share-card">
                  <h2>作品信息</h2>
                  <div className="share-meta-list">
                    <div><span>风格</span><strong>{memoir.style_name || '未记录'}</strong></div>
                    <div><span>文字语气</span><strong>{memoir.tone || '未记录'}</strong></div>
                    <div><span>分辨率</span><strong>{memoir.resolution || '未记录'}</strong></div>
                    <div><span>素材数量</span><strong>{memoir.media_count || 0} 个</strong></div>
                    <div><span>创建时间</span><strong>{formatCreatedAt(memoir.created_at) || '未记录'}</strong></div>
                  </div>
                </article>

                <article className="share-card">
                  <h2>回忆文字</h2>
                  <div className="share-copy-block">
                    <h3>开场旁白</h3>
                    <p>{memoir.intro || '暂无旁白内容。'}</p>
                  </div>
                  <div className="share-copy-block">
                    <h3>结尾寄语</h3>
                    <p>{memoir.ending || '暂无结尾寄语。'}</p>
                  </div>
                </article>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SharePage;
