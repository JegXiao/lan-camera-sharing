class CameraStreamApp {
    constructor() {
        this.initializeDOMElements();
        this.initializeState();
        this.bindEvents();
        this.initialize();
    }
    
    initializeDOMElements() {
        // 核心DOM元素
        this.localVideo = document.getElementById('localVideo');
        this.videoOverlay = document.getElementById('videoOverlay');
        this.videoContainer = document.getElementById('videoContainer');
        this.startBtn = document.getElementById('startCamera');
        this.stopBtn = document.getElementById('stopCamera');
        this.statusDiv = document.getElementById('status');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.cameraStatus = document.getElementById('cameraStatus');
        this.streamsContainer = document.getElementById('streamsContainer');
        this.deviceIdSpan = document.getElementById('deviceId');
        this.deviceNameInput = document.getElementById('deviceNameInput');
        this.deviceNameDisplay = document.getElementById('deviceNameDisplay');
        this.onlineCount = document.getElementById('onlineCount');
        this.currentFpsSpan = document.getElementById('currentFps');
        this.serverUrlSpan = document.getElementById('serverUrl');
        this.lobbyOnlineCount = document.getElementById('lobbyOnlineCount');
        this.lobbyStreamingCount = document.getElementById('lobbyStreamingCount');
        this.avgFps = document.getElementById('avgFps');

        // 语音消息元素
        this.recordVoiceBtn = document.getElementById('recordVoiceBtn');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.recordingTime = document.getElementById('recordingTime');
        this.recordingWaveform = document.getElementById('recordingWaveform');
        this.voiceMessagesList = document.getElementById('voiceMessagesList');
        this.clearMessagesBtn = document.getElementById('clearMessagesBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.audioIndicator = document.getElementById('audioIndicator');
        this.audioStatusOverlay = document.getElementById('audioStatusOverlay');

        // 切换开关
        this.audioToggle = document.getElementById('audioToggle');
        this.videoToggle = document.getElementById('videoToggle');
        this.audioToggleStatus = document.getElementById('audioToggleStatus');
        this.videoToggleStatus = document.getElementById('videoToggleStatus');

        // 帧率控制
        this.fpsValue = document.getElementById('fpsValue');
        this.fpsPresetBtns = document.querySelectorAll('.fps-preset-btn');

        // 按钮
        this.saveNameBtn = document.getElementById('saveNameBtn');
    }

    initializeState() {
        // 状态变量
        this.localStream = null;
        this.ws = null;
        this.isSharing = false;
        this.clientId = null;
        this.deviceName = localStorage.getItem('deviceName') || '我的设备';
        this.targetFps = 60;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.captureInterval = null;

        // 语音消息状态
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = 0;
        this.recordingTimer = null;
        this.voiceMessages = new Map();
        this.audioContext = null;
        this.analyser = null;

        // 音视频状态
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;

        // 连接状态
        this.connectedStreams = new Map();
        this.streamingDevices = new Set();
        this.deviceFps = new Map();

        // 性能统计
        this.sentFrames = 0;
        this.receivedFrames = 0;
        this.lastStatTime = Date.now();
    }

    bindEvents() {
        // 摄像头控制
        this.startBtn.addEventListener('click', () => this.startStreaming());
        this.stopBtn.addEventListener('click', () => this.stopStreaming());

        // 语音消息控制
        this.recordVoiceBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.recordVoiceBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });

        this.recordVoiceBtn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        this.recordVoiceBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        this.recordVoiceBtn.addEventListener('mouseleave', () => this.stopRecording());

        this.clearMessagesBtn.addEventListener('click', () => this.clearVoiceMessages());

        // 设备设置
        this.saveNameBtn.addEventListener('click', () => this.saveDeviceName());
        this.deviceNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveDeviceName();
        });

        // 音视频切换
        this.audioToggle.addEventListener('change', (e) => this.toggleAudio(e.target.checked));
        this.videoToggle.addEventListener('change', (e) => this.toggleVideo(e.target.checked));

        // 帧率预设按钮
        this.fpsPresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fps = parseInt(e.currentTarget.dataset.fps);
                this.setFps(fps);
            });
        });

        // 窗口事件
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('pagehide', () => this.cleanup());
    }

    initialize() {
        // 设置设备名称
        this.deviceNameInput.value = this.deviceName;
        this.deviceNameDisplay.textContent = this.deviceName;

        // 初始化UI状态
        this.audioToggle.checked = this.isAudioEnabled;
        this.videoToggle.checked = this.isVideoEnabled;
        this.updateAudioStatus(this.isAudioEnabled);
        this.updateVideoStatus(this.isVideoEnabled);

        // 设置默认帧率
        this.setFps(this.targetFps);

        // 显示服务器地址
        this.serverUrlSpan.textContent = window.location.host;

        // 连接WebSocket
        this.connectWebSocket();

        // 加载语音消息
        this.loadVoiceMessages();

        // 启动状态更新
        setInterval(() => this.updateStats(), 2000);
    }

    // WebSocket连接
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log('正在连接到:', wsUrl);
        this.updateConnectionStatus('正在连接服务器...', 'connecting');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket连接成功');
            this.updateConnectionStatus('已连接', 'connected');
        };

        this.ws.onclose = (event) => {
            console.log(`❌ WebSocket断开: ${event.code} ${event.reason}`);
            this.updateConnectionStatus('连接断开，5秒后重连...', 'disconnected');

            this.stopStreaming();
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket错误:', error);
            this.updateConnectionStatus('连接错误', 'error');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ 消息解析错误:', error);
            }
        };
    }

    handleWebSocketMessage(data) {
        switch(data.type) {
            case 'welcome':
                this.handleWelcome(data);
                break;
            case 'camera_frame':
                this.handleCameraFrame(data);
                break;
            case 'voice_message':
                this.handleVoiceMessage(data);
                break;
            case 'client_connected':
            case 'stream_started':
                this.handleClientConnected(data);
                break;
            case 'client_disconnected':
            case 'stream_stopped':
                this.handleClientDisconnected(data);
                break;
            case 'device_info':
                this.updateDeviceInfo(data);
                break;
            case 'system_stats':
                this.updateSystemStats(data);
                break;
            case 'pong':
                this.handlePong(data);
                break;
        }
    }

    handleWelcome(data) {
        this.clientId = data.client_id;
        this.deviceIdSpan.textContent = this.clientId;
        console.log(`✅ 欢迎客户端: ${this.clientId}`);
        this.updateOnlineCount(data.total_clients || 1);
    }

    handleCameraFrame(data) {
        const senderId = data.sender_id;
        const frameData = data.frame;

        if (!frameData) {
            console.error('❌ 收到空帧数据');
            return;
        }

        // 记录设备信息
        if (data.fps) {
            this.deviceFps.set(senderId, data.fps);
        }

        // 添加或更新流
        if (!this.connectedStreams.has(senderId)) {
            this.addStream(senderId, data.client_name || `设备${senderId}`, data.has_audio || false);
        }

        // 更新帧
        this.updateStreamFrame(senderId, frameData);

        // 添加到活跃设备
        this.streamingDevices.add(senderId);
    }

    handleVoiceMessage(data) {
        const messageId = data.message_id;
        const senderId = data.sender_id;
        const senderName = data.sender_name;
        const duration = data.duration;
        const timestamp = data.timestamp;
        const audioData = data.audio_data;

        // 存储消息
        this.voiceMessages.set(messageId, {
            messageId,
            senderId,
            senderName,
            duration,
            timestamp,
            audioData
        });

        // 添加到界面
        this.addVoiceMessageToUI(messageId, {
            senderName,
            duration,
            timestamp,
            audioData
        });

        // 显示通知
        if (senderId !== this.clientId) {
            this.showToast(`🎤 收到来自 ${senderName} 的语音消息`);
        }

        // 保存到本地存储
        this.saveVoiceMessages();
    }

    handleClientConnected(data) {
        const clientId = data.client_id || data.sender_id;
        const clientName = data.client_name || `设备${clientId}`;

        console.log(`🟢 客户端连接: ${clientName}`);

        // 添加到流列表
        if (data.client_id && data.client_id !== this.clientId) {
            this.addStream(data.client_id, clientName, data.has_audio || false);
        }

        this.updateOnlineCount(parseInt(this.onlineCount.textContent) + 1);
    }

    handleClientDisconnected(data) {
        const clientId = data.client_id || data.sender_id;

        console.log(`🔴 客户端断开: ${clientId}`);

        // 从流列表移除
        this.removeStream(clientId);

        this.updateOnlineCount(parseInt(this.onlineCount.textContent) - 1);
    }

    handlePong() {
        // 心跳响应
    }

    // 语音消息功能
    async startRecording() {
        if (this.isRecording) return;

        try {
            // 请求麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            this.isRecording = true;
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            // 更新UI
            this.recordVoiceBtn.classList.add('recording');
            this.recordingIndicator.style.display = 'flex';
            this.voiceStatus.textContent = '录音中...';
            this.recordVoiceBtn.innerHTML = '<i class="fas fa-stop"></i><span>松开发送</span>';

            // 创建MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            });

            // 设置音频分析器
            this.setupAudioAnalyzer(stream);

            // 处理数据可用事件
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            // 开始录音
            this.mediaRecorder.start(100); // 每100ms收集一次数据

            // 开始计时器
            this.startRecordingTimer();

            console.log('🎤 开始录音');

        } catch (error) {
            console.error('❌ 录音失败:', error);
            this.showToast('❌ 无法访问麦克风，请检查权限设置');
            this.stopRecording();
        }
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // 停止录音
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // 停止计时器
        this.stopRecordingTimer();

        // 停止音频分析
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // 更新UI
        this.recordVoiceBtn.classList.remove('recording');
        this.recordingIndicator.style.display = 'none';
        this.voiceStatus.textContent = '准备就绪';
        this.recordVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i><span>按住说话</span>';

        // 计算录音时长
        const duration = (Date.now() - this.recordingStartTime) / 1000;

        if (duration < 0.5) {
            console.log('⏱️ 录音时间太短，取消发送');
            this.showToast('录音时间太短');
            return;
        }

        if (duration > 30) {
            console.log('⏱️ 录音时间超过30秒，自动停止');
            this.showToast('录音最长30秒');
        }

        // 处理录音数据
        this.processRecording(duration);
    }

    setupAudioAnalyzer(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();

            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.3;
            source.connect(this.analyser);

            // 开始分析音频波形
            this.updateWaveform();

        } catch (error) {
            console.warn('⚠️ 音频分析器初始化失败:', error);
        }
    }

    updateWaveform() {
        if (!this.isRecording || !this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // 更新波形显示
        const bars = this.recordingWaveform.querySelectorAll('.wave-bar');
        for (let i = 0; i < bars.length; i++) {
            const value = dataArray[Math.floor(i * dataArray.length / bars.length)];
            const height = Math.max(2, (value / 255) * 30);
            bars[i].style.height = `${height}px`;
        }

        requestAnimationFrame(() => this.updateWaveform());
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.recordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // 超过30秒自动停止
            if (elapsed >= 30) {
                this.stopRecording();
            }
        }, 200);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    async processRecording(duration) {
        try {
            this.voiceStatus.textContent = '处理中...';

            // 等待所有数据收集完成
            await new Promise(resolve => {
                if (this.mediaRecorder) {
                    this.mediaRecorder.onstop = resolve;
                } else {
                    resolve();
                }
            });

            // 创建Blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

            // 检查文件大小
            if (audioBlob.size > 2 * 1024 * 1024) { // 2MB限制
                this.showToast('❌ 录音文件太大，请缩短录音时间');
                return;
            }

            // 转换为base64
            const reader = new FileReader();
            const audioData = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(audioBlob);
            });

            // 发送语音消息
            this.sendVoiceMessage(audioData, duration);

            console.log(`🎤 录音完成: ${duration.toFixed(1)}秒, ${audioBlob.size}字节`);

        } catch (error) {
            console.error('❌ 处理录音失败:', error);
            this.showToast('❌ 处理录音失败');
        } finally {
            this.voiceStatus.textContent = '准备就绪';

            // 清理流
            if (this.mediaRecorder && this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    sendVoiceMessage(audioData, duration) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast('❌ 未连接到服务器');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'voice_message',
            audio_data: audioData,
            duration: Math.round(duration * 10) / 10, // 保留一位小数
            timestamp: Date.now(),
            device_name: this.deviceName
        }));

        this.showToast('✅ 语音消息已发送');
    }

    addVoiceMessageToUI(messageId, messageData) {
        const template = document.getElementById('voiceMessageTemplate').content.cloneNode(true);
        const messageElement = template.querySelector('.voice-message-item');
        messageElement.id = `voice-msg-${messageId}`;

        // 设置消息内容
        messageElement.querySelector('.sender-name').textContent = messageData.senderName;
        messageElement.querySelector('.message-time').textContent = this.formatTime(messageData.timestamp);
        messageElement.querySelector('.duration-text').textContent = `${messageData.duration}s`;

        // 设置音频元素
        const audioElement = messageElement.querySelector('.voice-audio');
        audioElement.src = `data:audio/webm;base64,${messageData.audioData}`;

        // 播放控制
        const playBtn = messageElement.querySelector('.play-btn');
        const waveProgress = messageElement.querySelector('.wave-progress');

        playBtn.addEventListener('click', () => {
            this.toggleVoicePlayback(audioElement, playBtn, waveProgress, messageData.duration);
        });

        // 添加到列表
        const noMessages = this.voiceMessagesList.querySelector('.no-messages-placeholder');
        if (noMessages) {
            noMessages.remove();
        }

        this.voiceMessagesList.appendChild(messageElement);

        // 滚动到底部
        this.voiceMessagesList.scrollTop = this.voiceMessagesList.scrollHeight;
    }

    toggleVoicePlayback(audioElement, playBtn, waveProgress, duration) {
        if (audioElement.paused) {
            // 播放
            audioElement.play();
            playBtn.classList.add('playing');
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';

            // 更新进度
            const updateProgress = () => {
                if (!audioElement.paused) {
                    const progress = (audioElement.currentTime / duration) * 100;
                    waveProgress.style.width = `${progress}%`;
                    requestAnimationFrame(updateProgress);
                }
            };
            updateProgress();

            audioElement.onended = () => {
                playBtn.classList.remove('playing');
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                waveProgress.style.width = '0%';
                audioElement.currentTime = 0;
            };

        } else {
            // 暂停
            audioElement.pause();
            playBtn.classList.remove('playing');
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    clearVoiceMessages() {
        this.voiceMessages.clear();
        this.voiceMessagesList.innerHTML = `
            <div class="no-messages-placeholder">
                <i class="fas fa-comment-slash"></i>
                <p>暂无语音消息</p>
                <p>按住上方按钮开始录音</p>
            </div>
        `;
        localStorage.removeItem('voiceMessages');
        this.showToast('🗑️ 消息已清空');
    }

    saveVoiceMessages() {
        const messages = Array.from(this.voiceMessages.entries());
        if (messages.length > 50) { // 最多保存50条
            messages.splice(0, messages.length - 50);
        }
        localStorage.setItem('voiceMessages', JSON.stringify(messages));
    }

    loadVoiceMessages() {
        try {
            const saved = localStorage.getItem('voiceMessages');
            if (saved) {
                const messages = JSON.parse(saved);
                messages.forEach(([messageId, messageData]) => {
                    this.voiceMessages.set(messageId, messageData);
                    this.addVoiceMessageToUI(messageId, messageData);
                });
            }
        } catch (error) {
            console.error('加载语音消息失败:', error);
        }
    }

    // 摄像头流功能
    async startStreaming() {
        try {
            this.updateStatus('正在请求设备权限...', 'connecting');
            this.startBtn.disabled = true;
            this.showVideoOverlay(false);

            // 获取音视频流
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: this.targetFps, max: this.targetFps + 5 }
                },
                audio: this.isAudioEnabled
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localVideo.srcObject = this.localStream;

            // 等待视频加载
            await new Promise((resolve, reject) => {
                this.localVideo.onloadedmetadata = () => {
                    this.localVideo.play().then(resolve).catch(() => {
                        this.localVideo.muted = true;
                        this.localVideo.play().then(resolve);
                    });
                };
                this.localVideo.onerror = reject;
                setTimeout(() => reject(new Error('视频加载超时')), 5000);
            });

            this.isSharing = true;
            this.updateStatus(`正在共享 (${this.targetFps}FPS)`, 'online');
            this.stopBtn.disabled = false;
            this.cameraStatus.textContent = '在线';
            this.cameraStatus.className = 'status-online';

            // 不播放本地音频
            this.localVideo.muted = true;

            // 通知服务器开始流
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'start_stream',
                    device_name: this.deviceName,
                    fps: this.targetFps,
                    has_audio: this.isAudioEnabled
                }));
            }

            // 开始捕获帧
            this.startFrameCapture();

            console.log(`📡 开始共享: ${this.targetFps}FPS, 音频: ${this.isAudioEnabled}`);

        } catch (error) {
            console.error('❌ 设备访问失败:', error);
            this.updateStatus(`设备访问失败: ${error.message}`, 'error');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.showVideoOverlay(true);
            this.showDeviceError(error);
        }
    }

    startFrameCapture() {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
        }

        this.captureInterval = setInterval(() => {
            this.captureAndSendFrame();
        }, 1000 / this.targetFps);
    }

    captureAndSendFrame() {
        if (!this.isSharing || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            // 检查视频是否就绪
            if (!this.localVideo || this.localVideo.videoWidth === 0 || this.localVideo.videoHeight === 0) {
                return;
            }

            // 设置canvas尺寸
            this.canvas.width = this.localVideo.videoWidth;
            this.canvas.height = this.localVideo.videoHeight;

            // 绘制当前帧
            this.ctx.save();
            this.ctx.scale(-1, 1); // 镜像翻转
            this.ctx.drawImage(this.localVideo, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();

            // 根据帧率调整图片质量
            let quality = 0.4; // 默认质量
            if (this.targetFps >= 30) quality = 0.3; // 高帧率降低质量
            else if (this.targetFps <= 20) quality = 0.6; // 低帧率提高质量

            // 获取base64图片
            const imageData = this.canvas.toDataURL('image/jpeg', quality);
            const base64Data = imageData.split(',')[1];

            if (!base64Data) {
                console.error('❌ 无法获取图片数据');
                return;
            }

            // 发送到服务器
            this.ws.send(JSON.stringify({
                type: 'camera_stream',
                frame: base64Data,
                timestamp: Date.now(),
                fps: this.targetFps,
                device_name: this.deviceName,
                has_audio: this.isAudioEnabled
            }));

            this.sentFrames++;

        } catch (error) {
            console.error('❌ 捕获帧失败:', error);
        }
    }

    stopStreaming() {
        // 停止捕获
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        // 停止音视频流
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // 清理视频元素
        this.localVideo.srcObject = null;

        // 更新状态
        this.isSharing = false;
        this.updateStatus('已停止共享', 'offline');
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.cameraStatus.textContent = '离线';
        this.cameraStatus.className = 'status-offline';
        this.showVideoOverlay(true);

        // 通知服务器
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'stop_stream'
            }));
        }

        // 从活跃设备中移除自己
        this.streamingDevices.delete(this.clientId);
        this.deviceFps.delete(this.clientId);

        console.log('📡 停止共享');
    }

    // 流管理
    addStream(streamId, streamName, hasAudio) {
        // 移除空状态提示
        const placeholder = this.streamsContainer.querySelector('.no-streams-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // 创建流容器
        const streamItem = document.createElement('div');
        streamItem.className = 'stream-item fade-in';
        streamItem.id = `stream-${streamId}`;

        // 创建图片元素显示视频帧
        const img = document.createElement('img');
        img.className = 'stream-image';
        img.alt = `${streamName}的摄像头`;

        // 创建设备信息
        const deviceInfo = document.createElement('div');
        deviceInfo.className = 'stream-info';
        deviceInfo.innerHTML = `
            <div class="name">
                <i class="fas fa-user"></i>
                <span>${streamName}</span>
            </div>
            <div class="info-row">
                <span class="fps">${this.deviceFps.get(streamId) || '-'}FPS</span>
                <span class="time">${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        streamItem.appendChild(img);
        streamItem.appendChild(deviceInfo);
        this.streamsContainer.appendChild(streamItem);

        // 存储引用
        this.connectedStreams.set(streamId, {
            element: streamItem,
            img: img,
            deviceInfo: deviceInfo,
            lastUpdate: Date.now(),
            hasAudio: hasAudio
        });
    }

    updateStreamFrame(streamId, frameData) {
        const stream = this.connectedStreams.get(streamId);
        if (!stream) return;

        // 更新图片
        stream.img.src = 'data:image/jpeg;base64,' + frameData;
        stream.lastUpdate = Date.now();

        // 更新时间
        if (stream.deviceInfo) {
            const timeSpan = stream.deviceInfo.querySelector('.time');
            if (timeSpan) {
                timeSpan.textContent = new Date().toLocaleTimeString();
            }
        }
    }

    removeStream(streamId) {
        const stream = this.connectedStreams.get(streamId);
        if (stream) {
            stream.element.remove();
            this.connectedStreams.delete(streamId);
        }

        this.streamingDevices.delete(streamId);
        this.deviceFps.delete(streamId);

        // 如果没有流了，显示空状态
        if (this.connectedStreams.size === 0) {
            this.showNoStreamsMessage();
        }
    }

    showNoStreamsMessage() {
        this.streamsContainer.innerHTML = `
            <div class="no-streams-placeholder">
                <div class="placeholder-content">
                    <i class="fas fa-video-slash"></i>
                    <h3>等待共享画面...</h3>
                    <p>开启摄像头后，画面将显示在这里</p>
                    <p>其他设备的画面也会实时显示</p>
                </div>
            </div>
        `;
    }

    // 设备控制
    toggleAudio(enabled) {
        this.isAudioEnabled = enabled;
        this.audioToggle.checked = enabled;
        this.updateAudioStatus(enabled);

        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = enabled;
            });

            console.log(`🎤 麦克风 ${enabled ? '开启' : '关闭'}`);

            // 通知服务器音频状态变化
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'device_info',
                    has_audio: enabled
                }));
            }
        }
    }

    toggleVideo(enabled) {
        this.isVideoEnabled = enabled;
        this.videoToggle.checked = enabled;
        this.updateVideoStatus(enabled);

        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = enabled;
            });

            this.localVideo.srcObject = enabled ? this.localStream : null;
            this.showVideoOverlay(!enabled);
            console.log(`🎥 摄像头 ${enabled ? '开启' : '关闭'}`);
        }
    }

    setFps(fps) {
        this.targetFps = fps;
        this.fpsValue.textContent = fps;
        this.currentFpsSpan.textContent = `${fps} FPS`;

        // 更新预设按钮状态
        this.fpsPresetBtns.forEach(btn => {
            if (parseInt(btn.dataset.fps) === fps) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        console.log(`🎚️ 帧率设置为: ${fps}FPS`);

        // 如果正在共享，自动重启
        if (this.isSharing) {
            this.updateStatus(`切换帧率到 ${fps}FPS，正在重启...`, 'connecting');
            setTimeout(() => this.restartStreamingWithNewFps(), 100);
        }
    }

    async restartStreamingWithNewFps() {
        this.stopStreaming();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.startStreaming();
        this.updateStatus(`已以 ${this.targetFps}FPS 重新开始`, 'online');
    }

    saveDeviceName() {
        const name = this.deviceNameInput.value.trim();
        if (name) {
            this.deviceName = name;
            localStorage.setItem('deviceName', name);
            this.deviceNameDisplay.textContent = name;
            console.log(`📝 设备名称已设置: ${name}`);
            this.showToast('✅ 设备名称已保存');

            // 通知服务器
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'device_info',
                    device_name: name
                }));
            }
        }
    }

    // UI更新
    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;

        // 更新连接状态
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = 'connection-status';

        switch(type) {
            case 'online':
            case 'connected':
                this.connectionStatus.classList.add('status-online');
                break;
            case 'connecting':
                this.connectionStatus.classList.add('status-connecting');
                break;
            case 'offline':
            case 'error':
            case 'disconnected':
                this.connectionStatus.classList.add('status-offline');
                break;
        }
    }

    updateConnectionStatus(message, type) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = 'connection-status';

        switch(type) {
            case 'connected':
                this.connectionStatus.classList.add('status-online');
                break;
            case 'connecting':
                this.connectionStatus.classList.add('status-connecting');
                break;
            case 'disconnected':
            case 'error':
                this.connectionStatus.classList.add('status-offline');
                break;
        }
    }

    updateAudioStatus(enabled) {
        this.audioToggleStatus.textContent = enabled ? '开启' : '关闭';
        this.audioStatusOverlay.innerHTML = enabled ?
            '<i class="fas fa-microphone"></i>' :
            '<i class="fas fa-microphone-slash"></i>';
        this.audioStatusOverlay.className = 'audio-status ' + (enabled ? 'active' : 'muted');
    }

    updateVideoStatus(enabled) {
        this.videoToggleStatus.textContent = enabled ? '开启' : '关闭';
        this.showVideoOverlay(!enabled);
    }

    showVideoOverlay(show) {
        this.videoOverlay.style.display = show ? 'flex' : 'none';
    }

    updateOnlineCount(count) {
        this.onlineCount.textContent = count;
        this.lobbyOnlineCount.textContent = count;
    }

    updateSystemStats(data) {
        this.lobbyStreamingCount.textContent = data.streaming_clients || 0;
        this.avgFps.innerHTML = `<strong>${data.avg_fps || '-'} FPS</strong>`;
    }

    updateStats() {
        // 更新共享设备数
        this.lobbyStreamingCount.textContent = this.streamingDevices.size;

        // 计算平均帧率
        if (this.deviceFps.size > 0) {
            let totalFps = 0;
            this.deviceFps.forEach(fps => totalFps += fps);
            const avg = Math.round(totalFps / this.deviceFps.size);
            this.avgFps.innerHTML = `<strong>${avg} FPS</strong>`;
        } else {
            this.avgFps.innerHTML = `<strong>- FPS</strong>`;
        }

        // 清理过期流（5秒无更新）
        const now = Date.now();
        this.connectedStreams.forEach((stream, streamId) => {
            if (now - stream.lastUpdate > 5000) { // 5秒
                this.removeStream(streamId);
            }
        });
    }

    showDeviceError(error) {
        let message = '未知错误';

        if (error.name === 'NotAllowedError') {
            message = '请允许摄像头和麦克风访问权限，然后重试。';
        } else if (error.name === 'NotFoundError') {
            message = '未找到摄像头或麦克风设备。';
        } else if (error.name === 'NotReadableError') {
            message = '摄像头或麦克风被其他程序占用。';
        } else if (error.name === 'OverconstrainedError') {
            message = '设备不支持所选设置。';
        } else {
            message = `设备访问失败: ${error.message}`;
        }

        this.showToast(`❌ ${message}`, 5000);
    }

    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    cleanup() {
        this.stopRecording();
        this.stopStreaming();
        if (this.ws) this.ws.close();
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CameraStreamApp();
});