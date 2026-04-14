# [OPEN] safari-empty-recording

## Symptom

- iPhone Safari 进入生成页后提示“视频生成失败：录制输出为空”
- 同一线上地址在桌面端可用

## Hypotheses

1. `MediaRecorder` 已成功创建，但 `ondataavailable` 在 iOS Safari 上始终没有返回非空 `Blob`
2. 选中的 `mimeType` 在 Safari 上 `isTypeSupported()` 为真，但实际录制输出为空
3. `canvas.captureStream()` 产出的 `MediaStreamTrack` 在 iOS Safari 上状态异常，导致录制没有真实视频帧
4. `requestData()` / `stop()` 的触发时机不对，Safari 还没 flush 数据就结束了录制

## Current Plan

- 启动 Debug Server
- 在 `GeneratePage.jsx` 仅添加运行时埋点，不修改业务逻辑
- 让用户在手机 Safari 上复现一次
- 对比日志后再做最小修复
