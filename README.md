# 智能相册回忆录

## 项目概述

一个 Web 端智能相册回忆录生成器。用户导入照片 → 筛选 → 选风格 → 生成带文字叠加和背景音乐的视频 → 下载/分享。视频在浏览器端用 **Canvas + MediaRecorder** 直接合成，不依赖 wasm，纯前端可运行。

可选能力：
- 服务端辅助渲染（Express + ffmpeg-static）
- Supabase 云端分享（Storage + Postgres）

> 当前生效的产品基线见 `docs/prd/current.md`。本 README 描述的是 Web 端代码实现。

## 技术栈

- **前端**: React 19 + React Router 7 + Vite 8
- **视频生成（主路径）**: Canvas 逐帧绘制 + `canvas.captureStream(30)` + `MediaRecorder`
  - 输出 mime 优先级：`video/mp4 (avc1+aac)` → `video/mp4` → `video/webm (vp9/vp8)` → `video/webm`
  - 实际产物格式因浏览器而异（桌面 Safari/Chrome 通常出 mp4，部分 Chrome 出 webm）
- **背景音乐**: 优先加载 `/bgm/{warm,couple,vintage}_1.mp3`，2 秒超时后回退 Web Audio 振荡器合成
- **图片代理**: Vite 自定义中间件 `/img-proxy/<encodedURL>`，规避 canvas 跨域污染（`SecurityError`）
- **图片质量评估**: Laplacian variance（清晰度）+ 平均亮度（曝光），结果用于去重组排序与质量过滤
- **EXIF 解析**: 手写解析 JPEG 前 256KB（DateTimeOriginal + GPS），无第三方依赖
- **服务端辅助渲染（可选）**: Express 5 + multer + ffmpeg-static，concat slideshow → libx264/aac → MP4
- **云端存储（可选）**: Supabase（Storage + Postgres + RLS）

`@supabase/supabase-js` / `express` / `ffmpeg-static` / `multer` 都放在 `optionalDependencies`，并在代码中用 `try { await import(...) }` 兜底——不装也能跑前端主流程。

## 用户流程

```
HomePage → FilterPage → ReviewPage → StylePage → GeneratePage
                                                  └→ /share/:shareId（可选公开作品页）
```

页面间通过 `ProjectContext`（React Context）传递数据；同时向 `localStorage` 写一份做向后兼容（迁移过渡期）。

## 核心目录结构

```
photo-album-app/
  src/
    main.jsx                       入口
    App.jsx                        路由（6 条）
    context/
      ProjectContext.jsx           全局状态（filteredMedia / selectedStyle / textBundle / videoBlob …）
    data/
      mockData.js                  模拟照片/人物/风格 + filterMedia()
    lib/
      videoRenderer.js             ★ 核心：Canvas 渲染 + 转场 + 旁白 + MediaRecorder 录制
      bgm.js                       BGM 加载 + 振荡器兜底
      dedup.js                     pHash 风格分组去重 + 读取 qualityScore
      imageQuality.js              真实质量评估（Laplacian variance + 曝光）
      exifParser.js                JPEG EXIF 解析
      supabase.js                  云端上传/列表/详情
      serverRender.js              辅助渲染客户端（含图片压缩）
      renderApi.js                 辅助渲染 API URL
      dateUtils.js
    pages/
      HomePage.jsx                 入口 + 模板 + 历史作品
      FilterPage.jsx               导入素材 + 智能/手动筛选 + EXIF + 异步质量评估
      ReviewPage.jsx               去重 + 质量过滤
      StylePage.jsx                风格选择
      GeneratePage.jsx             ★ 视频生成 + 编辑 + 下载/分享
      SharePage.jsx                公开分享页
      SplashScreen.jsx / PermissionPage.jsx  历史页面，当前未挂路由
  public/
    bgm/{warm,couple,vintage}_1.mp3
  vite.config.js                   Vite 配置 + 图片代理插件
  server.js                        辅助渲染 Express 服务
  supabase/setup.sql               一键建表 + RLS 策略
  docs/                            PRD + 部署文档
```

## GeneratePage 视频生成流程

1. **预计算转场参数**：每对相邻照片根据风格 / 语气 / 日期间隔挑选 `crossfade / slideVertical / zoomBlend / fadeToBlack` 之一
2. **创建 Canvas + 录制流**：720p / 1080p Canvas，`canvas.captureStream(30)` + `new MediaRecorder(stream, { mimeType, videoBitsPerSecond })`
3. **BGM 注入**：`createMediaStreamDestination()` → `stream.addTrack(audioTrack)`，BGM 音轨进录像流
4. **加载图片**：先把每张照片 `new Image() + URL → load`，跨域图片走 `/img-proxy/`
5. **录制阶段**：
   - 片头 3 秒：黑底 + 标题 + 开场旁白淡入
   - 主体：每张照片 Ken Burns 缩放 + 转场 + 底部"日期 / 地点 / AI 旁白"覆盖层
   - 片尾 3 秒：结尾寄语淡入淡出
   - 每帧 `await requestAnimationFrame`
6. **结束**：`recorder.stop()` → `Blob(chunks, { type: mimeType })` → `URL.createObjectURL` → `<video src>`
7. **导出**：本地下载 / Web Share API 分享 / 上传 Supabase 生成公开链接

## 已知问题与待改进

| # | 项 | 说明 |
|---|---|---|
| 1 | 移动端兼容 | 微信内置 WebView 无法稳定使用 MediaRecorder；当前仅做 UA 提示，未自动降级到辅助渲染（已记入待办） |
| 2 | 辅助渲染功能不全 | `server.js` 当前生成的视频没有旁白文字叠加和真实 BGM，只是图片顺序拼接 + 正弦波背景 |
| 3 | 内存占用 | 大量图片 + 高码率录制时 `chunks` 一直累积，未来可考虑增量写 IndexedDB / OPFS |
| 4 | mockData 的图片 URL | 使用了字节内部 IDE 接口，外网不一定可达，且不支持 CORS（必须经 `/img-proxy/`） |

## 环境变量

```
VITE_SUPABASE_URL=          Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=     Supabase 匿名密钥
VITE_SUPABASE_BUCKET=       存储桶名（默认 memoirs）
VITE_SUPABASE_TABLE=        数据表名（默认 memoir_projects）
VITE_PUBLIC_APP_URL=        公开访问 URL（用于生成分享链接）
VITE_RENDER_API_BASE_URL=   辅助渲染服务地址（可选）
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（局域网可访问）
npm run dev

# 构建生产版本
npm run build

# 启动辅助渲染服务（可选）
npm run server
```

开发服务器：
- 本机访问: `http://localhost:5173/`
- 局域网访问: `http://<你的 IP>:5173/`
- 辅助渲染服务: `http://localhost:8787/`（Vite 已配置 `/api`、`/health` 反向代理到 8787）
