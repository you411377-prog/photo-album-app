import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PermissionPage.css';

const PermissionPage = () => {
  const navigate = useNavigate();

  const handleGrantPermission = () => {
    // 模拟授权成功
    navigate('/home');
  };

  const handleDenyPermission = () => {
    // 模拟拒绝授权
    alert('需要相册权限才能使用本应用');
  };

  return (
    <div className="permission-container">
      <div className="permission-content">
        <div className="permission-icon">📷</div>
        <h1>需要相册权限</h1>
        <p>为了整理和生成您的照片视频，我们需要访问您的相册</p>
        <div className="permission-buttons">
          <button className="deny-button" onClick={handleDenyPermission}>
            拒绝
          </button>
          <button className="grant-button" onClick={handleGrantPermission}>
            授权
          </button>
        </div>
        <p className="permission-note">
          我们会严格保护您的隐私，不会上传或分享您的照片
        </p>
      </div>
    </div>
  );
};

export default PermissionPage;