# Vercel 部署说明

## 当前结论

- 这个项目的前端可以部署到 Vercel。
- `React Router` 的分享页路径 `/share/:shareId` 已通过 `vercel.json` 做了 SPA rewrite。
- 浏览器端生成视频、Supabase 保存作品、Supabase 分享页都可以跟着前端一起上线。
- 本地 `Express + ffmpeg` 的 `/api/render` 服务不会自动随当前配置部署到 Vercel。

## 上线前要准备

- 在 Vercel 项目中配置这些环境变量：

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_BUCKET=memoirs
VITE_SUPABASE_TABLE=memoir_projects
VITE_PUBLIC_APP_URL=https://你的-vercel-域名.vercel.app
```

## 推荐部署方式

### 方式 1：Vercel CLI

```bash
npx vercel login
npx vercel
npx vercel --prod
```

### 方式 2：GitHub 连接 Vercel

- 把项目推到 GitHub
- 在 Vercel 导入仓库
- Framework Preset 选择 `Vite`
- Build Command 使用 `npm run build`
- Output Directory 使用 `dist`
- 填好环境变量后点击 Deploy

## 当前限制

- 微信环境下依赖的“服务端生成”仍然是本地 `server.js`
- 如果你想把 `/api/render` 也变成线上能力，建议后续单独部署到 `Railway`、`Render` 或其他 Node 服务平台
- 然后把前端里的服务端生成地址改成线上 API 域名
