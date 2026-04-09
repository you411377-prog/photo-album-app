import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockStyles } from '../data/mockData';
import './StylePage.css';

const StylePage = () => {
  const navigate = useNavigate();
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [tone, setTone] = useState('温情');

  const handleStyleSelect = (styleId) => {
    setSelectedStyle(styleId);
  };

  const handleNext = () => {
    if (selectedStyle) {
      // 保存选择的风格到localStorage
      const selectedStyleData = mockStyles.find(style => style.id === selectedStyle);
      localStorage.setItem('selectedStyle', JSON.stringify(selectedStyleData));
      localStorage.setItem('textTone', tone);
      navigate('/generate');
    }
  };

  const handleBack = () => {
    navigate('/review');
  };

  return (
    <div className="style-container">
      <header className="style-header">
        <button className="back-button" onClick={handleBack}>
          ←
        </button>
        <h1>选择风格</h1>
      </header>

      <main className="style-main">
        <p className="style-description">
          选择一种风格，我们将为您的照片生成对应的视频效果
        </p>

        <div className="tone-row">
          <div className="tone-label">AI 文字风格</div>
          <select className="tone-select" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="温情">温情</option>
            <option value="文艺">文艺</option>
            <option value="幽默">幽默</option>
            <option value="简约">简约</option>
          </select>
        </div>

        <div className="style-categories">
          <h3>免费模板</h3>
          <div className="style-grid">
            {mockStyles.filter(style => style.category === 'free').map(style => (
              <div 
                key={style.id}
                className={`style-card ${selectedStyle === style.id ? 'active' : ''}`}
                onClick={() => handleStyleSelect(style.id)}
                style={{ borderColor: selectedStyle === style.id ? style.color : 'transparent' }}
              >
                <div className="style-icon">{style.icon}</div>
                <h3>{style.name}</h3>
                <p>{style.description}</p>
                <div className="style-music">{style.music}</div>
                <div className="style-tag free">免费</div>
              </div>
            ))}
          </div>
          
          <h3>付费模板</h3>
          <div className="style-grid">
            {mockStyles.filter(style => style.category === 'paid').map(style => (
              <div 
                key={style.id}
                className={`style-card ${selectedStyle === style.id ? 'active' : ''} paid`}
                onClick={() => {
                  alert('此模板需要购买');
                }}
                style={{ borderColor: selectedStyle === style.id ? style.color : 'transparent' }}
              >
                <div className="style-icon">{style.icon}</div>
                <h3>{style.name}</h3>
                <p>{style.description}</p>
                <div className="style-music">{style.music}</div>
                <div className="style-tag paid-tag">付费</div>
                <div className="paid-overlay">
                  <span className="lock-icon">🔒</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          className={`next-button ${!selectedStyle ? 'disabled' : ''}`}
          onClick={handleNext}
          disabled={!selectedStyle}
        >
          生成视频
        </button>
      </main>
    </div>
  );
};

export default StylePage;
