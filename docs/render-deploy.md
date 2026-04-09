# Render 部署说明

## 目标

- 把本地 `server.js` 部署成一个公网可访问的 Node 服务
- 让前端生成视频时不再依赖你本地电脑的 `8787` 端口
- 让线上前端直接调用 `Render` 上的 `/api/render` 和 `/health`

## 当前已完成

- 项目根目录已新增 [render.yaml](file:///Users/bytedance/Documents/trae_projects/photo-album-app/render.yaml)
- 前端已支持通过 `VITE_RENDER_API_BASE_URL` 指向独立 API 服务
- 本地默认值仍然是 `http://localhost:8787`

## 先决条件

- 需要一个 `Render` 账号
- 推荐把当前项目推到 `GitHub`
- Render 通过 GitHub 仓库创建 Web Service

## Render 后台怎么配

### 1. 登录 Render

- 打开 [Render](https://render.com/)
- 使用 GitHub 账号登录最方便

### 2. 导入仓库

- 先把本地项目推到 GitHub
- Render 后台点击 `New +`
- 选择 `Blueprint` 或 `Web Service`
- 选中你的 GitHub 仓库 `photo-album-app`

### 3. 如果使用 Blueprint

- Render 会自动识别 [render.yaml](file:///Users/bytedance/Documents/trae_projects/photo-album-app/render.yaml)
- 服务名默认是 `photo-album-render-api`

### 4. 必填环境变量

- `CORS_ORIGIN`
  - 生产环境填你的前端域名
  - 当前应填：

```bash
https://photo-album-app-blond.vercel.app
```

- `PORT`
  - 不用手填，Render 会自动提供

## 部署成功后要做什么

- 记下你的 Render 服务域名，例如：

```bash
https://photo-album-render-api.onrender.com
```

- 然后把前端里的 `VITE_RENDER_API_BASE_URL` 改成这个地址

## 前端要同步的线上环境变量

- 在 Vercel 项目里新增或更新：

```bash
VITE_RENDER_API_BASE_URL=https://你的-render-服务域名.onrender.com
```

- 更新后重新执行一次前端生产部署

## 完成后的效果

- 前端线上地址：负责页面、作品列表、分享页
- Render 线上地址：负责视频生成接口
- 面试官打开网页后，可以真正在线触发视频生成
