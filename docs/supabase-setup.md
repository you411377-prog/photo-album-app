# Supabase 接入说明

## 1. 创建项目

- 在 Supabase 控制台创建一个新项目。
- 打开 `Project Settings -> API`，复制：
  - `Project URL`
  - `anon public key`

## 2. 初始化数据库和存储

- 打开 Supabase 的 SQL Editor。
- 执行 `supabase/setup.sql` 中的脚本。
- 脚本会创建：
  - 公开存储桶 `memoirs`
  - 作品表 `public.memoir_projects`
  - 匿名插入和公开读取策略

## 3. 配置前端环境变量

- 复制项目根目录的 `.env.example` 为 `.env.local`
- 填入真实值：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=memoirs
VITE_SUPABASE_TABLE=memoir_projects
VITE_PUBLIC_APP_URL=http://localhost:5173
```

## 4. 本地验证

```bash
npm run dev
```

- 生成视频后点击“保存作品”
- 再点击“复制分享链接”
- 打开 `/share/:shareId` 检查作品是否可访问

## 5. 上线时要改的值

- 本地开发时：`VITE_PUBLIC_APP_URL=http://localhost:5173`
- 正式上线后：改成你的线上域名，例如 `https://your-app.vercel.app`
