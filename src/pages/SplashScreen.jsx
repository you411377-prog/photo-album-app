import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/permission');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-container">
      <div className="splash-logo">
        <h1>相册整理</h1>
        <p>珍贵回忆，智能整理</p>
      </div>
      <div className="splash-loading">
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
};

export default SplashScreen;