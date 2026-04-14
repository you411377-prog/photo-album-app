# 智能相册回忆录

## 项目概述

一个 Web 端智能相册回忆录生成器。用户导入照片 → 筛选 → 选风格 → 生成带旁白文字叠加和背景音乐的视频 → 下载/分享。核心视频生成使用 FFmpeg.wasm 在浏览器端完成，无需服务端。

## 技术栈

- **前端**: React 19 + React Router 7 + Vite 8
- **视频生成**: FFmpeg.wasm 0.12.x（浏览器端合成 MP4，单线程，不需要 SharedArrayBuffer/COOP/COEP）
- **音频**: OfflineAudioContext 离线渲染 BGM → WAV → FFmpeg 编码为 AAC
- **图片代理**: Vite 自定义插件 `/img-proxy/`（解决外部图片 CORS 限制，避免 canvas 跨域污染）
- **后端辅助渲染**: Express 5 + ffmpeg-static（局域网 Node 服务，可选，当前生成的视频无旁白无 BGM）
- **云端存储**: Supabase（Storage + Table）

## 用户流程

```
SplashScreen → PermissionPage → HomePage → FilterPage → ReviewPage → StylePage → GeneratePage → SharePage
```

页面间通过 `localStorage` 传递数据（`filteredMedia`、`selectedStyle`、`textTone`）。

## 核心文件结构

```
photo-album-app/
  src/
    App.jsx                    — 路由定义（8 个页面）
    main.jsx                   — 入口
    data/mockData.js           — 模拟数据（照片 URL 来自 copilot-cn.bytedance.net，不支持 CORS）
    lib/
      supabase.js              — Supabase 客户端、上传视频、保存/查询记录
      renderApi.js             — 辅助渲染 API 地址配置（VITE_RENDER_API_BASE_URL）
    pages/
      GeneratePage.jsx         — ★ 核心页面：视频生成（~950 行）
      其他 7 个页面             — UI 交互，无复杂逻辑
  vite.config.js               — Vite 配置 + 图片代理插件（imageProxyPlugin）
  server.js                    — Node.js 辅助渲染服务（Express + ffmpeg-static）
  package.json                 — 依赖管理
```

## GeneratePage.jsx 视频生成流程

1. **渲染 BGM**: 用 `OfflineAudioContext` 离线渲染合成器音乐（正弦波 + 三角波 + 低通滤波 + 淡入淡出）→ 转为 WAV Blob
2. **加载图片**: 对外部 URL 通过 `/img-proxy/` 代理下载为 blob URL，避免 canvas 跨域污染（`SecurityError`）
3. **加载 FFmpeg.wasm**: 从 unpkg CDN 加载 `@ffmpeg/core@0.12.6`（~30MB wasm），用 `toBlobURL` 转为 blob URL
4. **逐帧渲染**: Canvas 逐帧绘制（Ken Burns 缩放 + 交叉淡入淡出 + 文字叠加），每帧 `toBlob()` 导出 JPEG
5. **写入帧**: 用 `ffmpeg.writeFile()` 将每帧写入虚拟文件系统，文件名 `f00000.jpg` ~ `f00119.jpg`
6. **合成视频**: `ffmpeg.exec()` 执行 FFmpeg 命令（注意参数顺序：所有 `-i` 必须在编码参数之前）：
   ```
   -framerate 30 -i f%05d.jpg -i bgm.wav -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest output.mp4
   ```
7. **读取输出**: `ffmpeg.readFile('output.mp4')` → 类型判断（Uint8Array 或 string）→ 创建 Blob → 设置 video src

## 已解决的全部问题

| # | 问题 | 原因 | 解决方案 |
|---|------|------|----------|
| 1 | Safari MediaRecorder 空 Blob | Safari 对 `canvas.captureStream()` + `MediaRecorder` 支持不稳定 | 改用 FFmpeg.wasm |
| 2 | FFmpeg.wasm API 版本不匹配 | 安装了 0.12.x 但代码用了 0.11.x API（`createFFmpeg`/`fetchFile`/`FS`/`run`） | 改为 0.12.x API（`new FFmpeg()`/`load`/`writeFile`/`exec`/`readFile`） |
| 3 | npm install 装错目录 | 在父目录执行了 npm install | 在 photo-album-app/ 目录下重新安装 |
| 4 | COEP 头阻止跨域资源 | `Cross-Origin-Embedder-Policy: credentialless` 阻止外部图片加载 | 移除 COOP/COEP 头（单线程 FFmpeg 不需要 SharedArrayBuffer） |
| 5 | Canvas 跨域污染 SecurityError | 外部图片不支持 CORS，直接加载会污染 canvas，`toBlob()` 抛出 SecurityError | 添加 Vite 图片代理插件 `/img-proxy/` |
| 6 | FFmpeg 命令行参数顺序错误 | `-i bgm.wav` 放在 `-c:v libx264` 之后，FFmpeg 把 libx264 当成音频解码器，报 `Unknown decoder 'libx264'` | 修正为所有 `-i` 在编码参数之前 |
| 7 | useEffect 重复触发 | `generateVideo` 引用变化导致 useEffect 反复触发，终止正在运行的 FFmpeg 实例 | 添加 `mountedRef` + `generatingRef` 守卫 |
| 8 | readFile 返回值类型 | `ffmpeg.readFile()` 可能返回 string 或 Uint8Array | 添加类型判断 |

## 辅助渲染（server.js）

- Express 服务，接收图片文件 + 参数，用 ffmpeg-static 合成视频
- 仅局域网可用，无法线上部署（需要大量计算资源和临时存储）
- **当前问题**: 生成的视频无旁白文字、无 BGM，只是图片顺序拼接

## 环境变量

```
VITE_SUPABASE_URL=          — Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=     — Supabase 匿名密钥
VITE_SUPABASE_BUCKET=       — 存储桶名（默认 memoirs）
VITE_SUPABASE_TABLE=        — 数据表名（默认 memoir_projects）
VITE_PUBLIC_APP_URL=        — 公开访问 URL（用于生成分享链接）
VITE_RENDER_API_BASE_URL=   — 辅助渲染服务地址（可选）
```

## 当前已验证的运行状态

- ✅ 桌面 Safari: 视频生成成功（120 帧，928KB MP4，含 BGM）
- ⏳ 手机 iOS Safari: 待验证（FFmpeg.wasm 性能和稳定性）
- ⏳ 微信 WebView: 预期不可用（MediaRecorder 不可用，FFmpeg.wasm 也可能受限）
- ⏳ 辅助渲染 server.js: 缺少旁白和 BGM

## 已知待改进项

1. 手机端 FFmpeg.wasm 性能（~30MB wasm 加载 + 编码速度）
2. 辅助渲染 server.js 缺少旁白文字叠加和 BGM
3. 视频帧渲染全部在内存中（大量帧 Blob），照片多时可能内存不足
4. mockData.js 中的图片 URL 不支持 CORS，必须通过代理加载
5. FilterPage.jsx 有 HTML 嵌套错误（button 不能嵌套 button）

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

开发服务器启动后：
- 本机访问: `http://localhost:5173/`
- 局域网访问: `http://<你的电脑IP>:5173/`
