# 局域网视频共享 | LAN Camera Sharing

> 局域网摄像头共享大厅：你的摄像头画面经 WebSocket 帧中继分发给所有访客，还带"按住说话"语音消息。仅供可信局域网使用。
> A camera-sharing hall for your LAN: your camera feed is relayed frame-by-frame over WebSocket to every visitor, with push-to-talk voice messages. For trusted LANs only.

## 功能特性 | Features

- **实时画面广播**：getUserMedia 采集音视频，前端定时截帧转 JPEG 经 `/ws` 广播；可设设备名、帧率档位 20/30/60 FPS、麦克风/摄像头开关。
  **Live broadcast**: frames are captured from getUserMedia, converted to JPEG and broadcast over `/ws`; configurable device name, 20/30/60 FPS and mic/camera toggles.
- **语音消息**：按住说话最长 30 秒，松开发送，全员广播，服务端内存暂存 10 分钟。
  **Voice messages**: hold to record up to 30 seconds, broadcast to everyone, kept in server memory for 10 minutes.
- **首次运行开箱即用**：启动时发现证书缺失会**自动生成**自签证书，无需手动步骤。
  **Works out of the box**: the server **auto-generates** a self-signed certificate on first launch when none exists.

## 快速开始 | Quick Start

```bash
pip install -r requirements.txt
python server.py
```

浏览器访问 `https://<服务器IP>:8000`（默认端口 8000），首次访问需信任自签证书。
Open `https://<server-IP>:8000` (default port 8000) and trust the self-signed certificate on first visit.

## 配置 | Configuration

| 项 | Item | 说明 | Notes |
|---|---|---|---|
| 端口 | Port | 硬编码 `8000`（`server.py`） | Hard-coded `8000` in `server.py` |
| 设备名/FPS | Device name / FPS | 页面内设置，存于浏览器本地 | Set in the page, stored in localStorage |
| 证书 | Certificate | 启动时自动生成（也可手动跑 `cert_generator.py`） | Auto-generated at startup (or run `cert_generator.py` manually) |

## 说明 | Notes

- 帧中继方案对服务器带宽要求较高，适合几台设备的小范围共享。
  Frame relaying is bandwidth-hungry on the server; it suits a handful of devices.
- 自动生成证书的 SAN 只含 `localhost`/`127.0.0.1`，用局域网 IP 访问时浏览器警告更明显，手动信任即可。
  The auto-generated certificate's SAN only covers `localhost`/`127.0.0.1`, so the browser warning is louder when visiting via LAN IP — just trust it manually.
- 画面与语音均不落盘（语音消息仅内存暂存 10 分钟）；仅供可信局域网使用。
  Neither video nor audio is written to disk (voice messages live in memory for 10 minutes). Trusted LANs only.
