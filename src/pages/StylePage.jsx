import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { mockStyles } from '../data/mockData';
import './StylePage.css';

const StylePage = () => {
  const navigate = useNavigate();
  const { commitStyle } = useProject();
  const [selectedStyle, setSelectedStyle] = useState(null);

  const handleNext = () => {
    if (!selectedStyle) return;
    const styleData = mockStyles.find(s => s.id === selectedStyle);
    commitStyle(styleData, '温情');
    navigate('/generate');
  };

  return (
    <div className="style-container">
      <header className="style-header">
        <button className="back-button" onClick={() => navigate('/review')}>←</button>
        <h1>选择风格</h1>
      </header>
      <main className="style-main">
        <p className="style-description">选择一种风格，我们将为您的照片生成对应的视频效果</p>
        <div className="style-categories">
          <h3>免费模板</h3>
          <div className="style-grid">
            {mockStyles.filter(s => s.category === 'free').map(style => (
              <div key={style.id} className={`style-card ${selectedStyle === style.id ? 'active' : ''}`} onClick={() => setSelectedStyle(style.id)} style={{ borderColor: selectedStyle === style.id ? style.color : 'transparent' }}>
                <div className="style-icon">{style.icon}</div><h3>{style.name}</h3><p>{style.description}</p><div className="style-music">{style.music}</div>
              </div>
            ))}
          </div>
          <h3>更多模板（开发中）</h3>
          <div className="style-grid">
            {mockStyles.filter(s => s.category === 'paid').map(style => (
              <div key={style.id} className={`style-card paid`} onClick={() => alert('此模板正在开发中，敬请期待')} style={{ borderColor: 'transparent' }}>
                <div className="style-icon">{style.icon}</div><h3>{style.name}</h3><p>{style.description}</p><div className="style-music">{style.music}</div><div className="style-tag coming-soon-tag">即将上线</div>
                <div className="paid-overlay"><span className="lock-icon">🔒</span></div>
              </div>
            ))}
          </div>
        </div>
        <button className={`next-button ${!selectedStyle ? 'disabled' : ''}`} onClick={handleNext} disabled={!selectedStyle}>生成视频</button>
      </main>
    </div>
  );
};

export default StylePage;
