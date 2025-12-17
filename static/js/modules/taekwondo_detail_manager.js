/**
 * 跆拳道詳細姿態偵測管理模組
 * 負責處理跆拳道詳細分析頁面的前端邏輯
 */

class TaekwondoDetailManager {
    constructor() {
        this.socket = null;
        this.isDetectionActive = false;
        this.angleChart = null;
        this.velocityChart = null;
        this.chartData = {
            angles: {
                labels: [],
                datasets: {
                    leftElbow: [],
                    rightElbow: [],
                    leftKnee: [],
                    rightKnee: []
                }
            },
            velocities: {
                labels: [],
                datasets: {
                    leftElbow: [],
                    rightElbow: [],
                    leftKnee: [],
                    rightKnee: []
                }
            }
        };
        this.maxDataPoints = -1; // -1 表示不限制數據點數量，顯示全部偵測長度
        this.selectedCameraIndex = 0; // 預設攝像頭索引
        this.availableCameras = []; // 可用攝像頭列表
        
        // 錄製相關
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.lastRecordingData = null;
        
        // 檢測時間追蹤
        this.detectionStartTime = null;
        this.currentDetectionTime = 0;
        this.cameraReady = false;
        this.waitingForCamera = false;
        
        this.init();
    }
    
    /**
     * 初始化管理器
     */
    init() {
        console.log('初始化跆拳道詳細姿態偵測管理器...');
        
        // 初始化 Socket 連接
        this.initSocket();
        
        // 綁定 UI 事件
        this.bindUIEvents();
        
        // 初始化圖表
        this.initCharts();
        
        // 初始化 UI 狀態
        this.initUIState();
        
        console.log('跆拳道詳細姿態偵測管理器初始化完成');
    }
    
    /**
     * 初始化 Socket.IO 連接
     */
    initSocket() {
        try {
            this.socket = io('/exercise', {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000
            });
            
            this.bindSocketEvents();
            console.log('Socket 連接已初始化');
        } catch (error) {
            console.error('初始化 Socket 連接失敗:', error);
            this.showError('無法連接到服務器，請刷新頁面重試');
        }
    }
    
    /**
     * 綁定 Socket 事件
     */
    bindSocketEvents() {
        // 連接事件
        this.socket.on('connect', () => {
            console.log('Socket 已連接，ID:', this.socket.id);
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket 已斷開連接');
            this.updateConnectionStatus(false);
        });
        
        // 影像幀事件
        this.socket.on('video_frame', (data) => {
            this.updateVideoFrame(data.frame);
            
            // 檢查是否正在等待攝像頭就緒
            if (this.waitingForCamera && !this.cameraReady) {
                this.handleCameraReady();
            }
        });
        
        // 角度數據事件
        this.socket.on('taekwondo_angles', (data) => {
            this.updateAngles(data);
        });
        
        // 角速度數據事件
        this.socket.on('taekwondo_velocities', (data) => {
            this.updateVelocities(data);
        });
        
        // 角加速度數據事件
        this.socket.on('taekwondo_accelerations', (data) => {
            this.updateAccelerations(data);
        });
        
        // 動作識別事件
        this.socket.on('taekwondo_action', (data) => {
            this.updateActionRecognition(data);
        });
        
        // 檢測回應事件
        this.socket.on('start_detection_response', (data) => {
            this.handleStartDetectionResponse(data);
        });
        
        this.socket.on('stop_detection_response', (data) => {
            this.handleStopDetectionResponse(data);
        });
        
        this.socket.on('reset_response', (data) => {
            this.handleResetResponse(data);
        });
        
        // 攝像頭檢測回應事件
        this.socket.on('camera_detection_response', (data) => {
            this.handleCameraDetectionResponse(data);
        });
        
        // 錄製相關事件
        this.socket.on('recording_started', (data) => {
            this.handleRecordingStarted(data);
        });
        
        this.socket.on('recording_stopped', (data) => {
            this.handleRecordingStopped(data);
        });
        
        this.socket.on('recording_deleted', (data) => {
            this.handleRecordingDeleted(data);
        });
        
        this.socket.on('recording_status', (data) => {
            this.updateRecordingStatus(data);
        });
        
        // 錯誤事件
        this.socket.on('error', (data) => {
            console.error('Socket 錯誤:', data);
            this.showError(data.message || '發生未知錯誤');
        });
    }
    
    /**
     * 綁定 UI 事件
     */
    bindUIEvents() {
        // 開始檢測按鈕
        const startBtn = document.getElementById('start-detection-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startDetection());
        }
        
        // 停止檢測按鈕
        const stopBtn = document.getElementById('stop-detection-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopDetection());
        }
        
        // 重置按鈕
        const resetBtn = document.getElementById('reset-detection-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetDetection());
        }
        
        // 檢測攝像頭按鈕
        const detectCamerasBtn = document.getElementById('detect-cameras-btn');
        if (detectCamerasBtn) {
            detectCamerasBtn.addEventListener('click', () => this.detectAvailableCameras());
        }
        
        // 攝像頭選擇下拉選單
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => this.onCameraSelectionChange(e.target.value));
        }
        
        // 注意：錄製控制已整合到檢測控制中，不需要獨立的錄製按鈕
        
        // 下載按鈕
        const downloadOriginalBtn = document.getElementById('download-original-btn');
        if (downloadOriginalBtn) {
            downloadOriginalBtn.addEventListener('click', () => this.downloadOriginalVideo());
        }
        
        const downloadAnalysisBtn = document.getElementById('download-analysis-btn');
        if (downloadAnalysisBtn) {
            downloadAnalysisBtn.addEventListener('click', () => this.downloadAnalysisVideo());
        }
    }
    
    /**
     * 初始化圖表
     */
    initCharts() {
        // 初始化角度變化趨勢圖表
        const angleCanvas = document.getElementById('angle-chart');
        if (angleCanvas) {
            this.angleChart = new Chart(angleCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: '左手肘',
                            data: [],
                            borderColor: 'rgb(255, 99, 132)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右手肘',
                            data: [],
                            borderColor: 'rgb(54, 162, 235)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左膝蓋',
                            data: [],
                            borderColor: 'rgb(255, 205, 86)',
                            backgroundColor: 'rgba(255, 205, 86, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右膝蓋',
                            data: [],
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左肩膀',
                            data: [],
                            borderColor: 'rgb(153, 102, 255)',
                            backgroundColor: 'rgba(153, 102, 255, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右肩膀',
                            data: [],
                            borderColor: 'rgb(255, 159, 64)',
                            backgroundColor: 'rgba(255, 159, 64, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左髖部',
                            data: [],
                            borderColor: 'rgb(199, 199, 199)',
                            backgroundColor: 'rgba(199, 199, 199, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右髖部',
                            data: [],
                            borderColor: 'rgb(83, 102, 255)',
                            backgroundColor: 'rgba(83, 102, 255, 0.1)',
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 180,
                            title: {
                                display: true,
                                text: '角度 (度)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '檢測時間 (秒)'
                            },
                            ticks: {
                                maxTicksLimit: 15,
                                callback: function(value, index, values) {
                                    const label = this.getLabelForValue(value);
                                    return label;
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: '關節角度變化趨勢'
                        }
                    }
                }
            });
        }
        
        // 初始化角速度變化圖表
        const velocityCanvas = document.getElementById('velocity-chart');
        if (velocityCanvas) {
            this.velocityChart = new Chart(velocityCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: '左手肘角速度',
                            data: [],
                            borderColor: 'rgb(255, 99, 132)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右手肘角速度',
                            data: [],
                            borderColor: 'rgb(54, 162, 235)',
                            backgroundColor: 'rgba(54, 162, 235, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左膝蓋角速度',
                            data: [],
                            borderColor: 'rgb(255, 205, 86)',
                            backgroundColor: 'rgba(255, 205, 86, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右膝蓋角速度',
                            data: [],
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左肩膀角速度',
                            data: [],
                            borderColor: 'rgb(153, 102, 255)',
                            backgroundColor: 'rgba(153, 102, 255, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右肩膀角速度',
                            data: [],
                            borderColor: 'rgb(255, 159, 64)',
                            backgroundColor: 'rgba(255, 159, 64, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '左髖部角速度',
                            data: [],
                            borderColor: 'rgb(199, 199, 199)',
                            backgroundColor: 'rgba(199, 199, 199, 0.1)',
                            tension: 0.1
                        },
                        {
                            label: '右髖部角速度',
                            data: [],
                            borderColor: 'rgb(83, 102, 255)',
                            backgroundColor: 'rgba(83, 102, 255, 0.1)',
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: '角速度 (度/秒)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '檢測時間 (秒)'
                            },
                            ticks: {
                                maxTicksLimit: 15,
                                callback: function(value, index, values) {
                                    const label = this.getLabelForValue(value);
                                    return label;
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: '關節角速度變化'
                        }
                    }
                }
            });
        }
    }
    
    /**
     * 初始化 UI 狀態
     */
    initUIState() {
        // 設置初始按鈕狀態
        this.updateButtonStates(false);
        
        // 設置初始錄製指示器狀態
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        
        // 隱藏下載區域
        const downloadSection = document.getElementById('download-section');
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
    }
    
    /**
     * 開始檢測（等待攝像頭就緒後同時開始錄製）
     */
    startDetection() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接，請刷新頁面重試');
            return;
        }
        
        console.log('開始跆拳道詳細檢測，等待攝像頭就緒...');
        
        // 重置狀態
        this.cameraReady = false;
        this.waitingForCamera = true;
        this.detectionStartTime = null;  // 等攝像頭就緒後再設置
        this.currentDetectionTime = 0;
        
        // 更新狀態顯示
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = '等待攝像頭啟動...';
        }
        
        const requestData = {
            exercise_type: 'taekwondo-detail',
            camera_index: this.selectedCameraIndex,
            auto_start_recording: false  // 先不開始錄製，等攝像頭就緒
        };
        
        this.socket.emit('start_detection', requestData);
        this.updateButtonStates(true);
        this.showRecordingIndicator(true);
    }
    
    /**
     * 停止檢測（同時停止錄製並詢問是否保留影片）
     */
    stopDetection() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接');
            return;
        }
        
        console.log('停止跆拳道詳細檢測和錄製...');
        
        // 顯示確認對話框
        const keepVideo = confirm('檢測已完成！\n\n是否要保留錄製的影片？\n\n點擊「確定」保留影片並顯示下載選項\n點擊「取消」刪除影片');
        
        const requestData = {
            keep_video: keepVideo
        };
        
        this.socket.emit('stop_detection', requestData);
        this.updateButtonStates(false);
        this.showRecordingIndicator(false);
        
        // 如果用戶選擇不保留影片，隱藏下載區域
        if (!keepVideo) {
            const downloadSection = document.getElementById('download-section');
            if (downloadSection) {
                downloadSection.style.display = 'none';
            }
        }
    }
    
    /**
     * 重置檢測
     */
    resetDetection() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接');
            return;
        }
        
        console.log('重置跆拳道詳細檢測...');
        this.socket.emit('reset_taekwondo_detail');
        
        // 重置檢測時間和攝像頭狀態
        this.detectionStartTime = null;
        this.currentDetectionTime = 0;
        this.cameraReady = false;
        this.waitingForCamera = false;
        
        // 重置狀態顯示
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = '未開始';
        }
        
        // 重置圖表數據
        this.resetChartData();
        
        // 重置 UI 顯示
        this.resetUIDisplay();
    }
    
    /**
     * 更新影像幀
     */
    updateVideoFrame(frameData) {
        const canvas = document.getElementById('video-canvas');
        if (canvas && frameData) {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = 'data:image/jpeg;base64,' + frameData;
        }
    }
    
    /**
     * 更新角度顯示
     */
    updateAngles(angles) {
        // 更新角度數值顯示
        this.updateAngleElement('left-elbow-angle', angles.left_elbow);
        this.updateAngleElement('right-elbow-angle', angles.right_elbow);
        this.updateAngleElement('left-knee-angle', angles.left_knee);
        this.updateAngleElement('right-knee-angle', angles.right_knee);
        this.updateAngleElement('left-shoulder-angle', angles.left_shoulder);
        this.updateAngleElement('right-shoulder-angle', angles.right_shoulder);
        this.updateAngleElement('left-hip-angle', angles.left_hip);
        this.updateAngleElement('right-hip-angle', angles.right_hip);
        
        // 更新圖表數據
        this.updateAngleChart(angles);
    }
    
    /**
     * 更新角速度顯示
     */
    updateVelocities(velocities) {
        this.updatePhysicsElement('left-elbow-velocity', velocities.left_elbow, '°/s');
        this.updatePhysicsElement('right-elbow-velocity', velocities.right_elbow, '°/s');
        this.updatePhysicsElement('left-knee-velocity', velocities.left_knee, '°/s');
        this.updatePhysicsElement('right-knee-velocity', velocities.right_knee, '°/s');
        
        // 更新圖表數據
        this.updateVelocityChart(velocities);
    }
    
    /**
     * 更新角加速度顯示
     */
    updateAccelerations(accelerations) {
        this.updatePhysicsElement('left-elbow-acceleration', accelerations.left_elbow, '°/s²');
        this.updatePhysicsElement('right-elbow-acceleration', accelerations.right_elbow, '°/s²');
        this.updatePhysicsElement('left-knee-acceleration', accelerations.left_knee, '°/s²');
        this.updatePhysicsElement('right-knee-acceleration', accelerations.right_knee, '°/s²');
    }
    
    /**
     * 更新動作識別顯示
     */
    updateActionRecognition(data) {
        const actionElement = document.getElementById('current-action');
        const confidenceElement = document.getElementById('action-confidence');
        const countElement = document.getElementById('action-count');
        
        if (actionElement) {
            actionElement.textContent = data.action || '待檢測';
        }
        
        if (confidenceElement) {
            confidenceElement.textContent = `${data.confidence || 0}%`;
        }
        
        if (countElement) {
            countElement.textContent = data.count || 0;
        }
    }
    
    /**
     * 更新角度元素
     */
    updateAngleElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.textContent = `${Math.round(value)}°`;
        }
    }
    
    /**
     * 更新物理數據元素
     */
    updatePhysicsElement(elementId, value, unit) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.textContent = `${Math.round(value)} ${unit}`;
        }
    }
    
    /**
     * 更新角度圖表
     */
    updateAngleChart(angles) {
        if (!this.angleChart) return;
        
        // 只有在攝像頭就緒後才記錄數據
        if (!this.cameraReady) return;
        
        // 計算相對檢測時間
        if (this.detectionStartTime) {
            this.currentDetectionTime = (Date.now() - this.detectionStartTime) / 1000;
        }
        const timeLabel = `${this.currentDetectionTime.toFixed(1)}s`;
        
        // 添加新數據點
        this.angleChart.data.labels.push(timeLabel);
        this.angleChart.data.datasets[0].data.push(angles.left_elbow || 0);
        this.angleChart.data.datasets[1].data.push(angles.right_elbow || 0);
        this.angleChart.data.datasets[2].data.push(angles.left_knee || 0);
        this.angleChart.data.datasets[3].data.push(angles.right_knee || 0);
        this.angleChart.data.datasets[4].data.push(angles.left_shoulder || 0);
        this.angleChart.data.datasets[5].data.push(angles.right_shoulder || 0);
        this.angleChart.data.datasets[6].data.push(angles.left_hip || 0);
        this.angleChart.data.datasets[7].data.push(angles.right_hip || 0);
        
        // 只有在設置了限制時才限制數據點數量
        if (this.maxDataPoints > 0 && this.angleChart.data.labels.length > this.maxDataPoints) {
            this.angleChart.data.labels.shift();
            this.angleChart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.angleChart.update('none');
    }
    
    /**
     * 更新角速度圖表
     */
    updateVelocityChart(velocities) {
        if (!this.velocityChart) return;
        
        // 只有在攝像頭就緒後才記錄數據
        if (!this.cameraReady) return;
        
        // 計算相對檢測時間
        if (this.detectionStartTime) {
            this.currentDetectionTime = (Date.now() - this.detectionStartTime) / 1000;
        }
        const timeLabel = `${this.currentDetectionTime.toFixed(1)}s`;
        
        // 添加新數據點
        this.velocityChart.data.labels.push(timeLabel);
        this.velocityChart.data.datasets[0].data.push(velocities.left_elbow || 0);
        this.velocityChart.data.datasets[1].data.push(velocities.right_elbow || 0);
        this.velocityChart.data.datasets[2].data.push(velocities.left_knee || 0);
        this.velocityChart.data.datasets[3].data.push(velocities.right_knee || 0);
        this.velocityChart.data.datasets[4].data.push(velocities.left_shoulder || 0);
        this.velocityChart.data.datasets[5].data.push(velocities.right_shoulder || 0);
        this.velocityChart.data.datasets[6].data.push(velocities.left_hip || 0);
        this.velocityChart.data.datasets[7].data.push(velocities.right_hip || 0);
        
        // 只有在設置了限制時才限制數據點數量
        if (this.maxDataPoints > 0 && this.velocityChart.data.labels.length > this.maxDataPoints) {
            this.velocityChart.data.labels.shift();
            this.velocityChart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.velocityChart.update('none');
    }
    
    /**
     * 重置圖表數據
     */
    resetChartData() {
        if (this.angleChart) {
            this.angleChart.data.labels = [];
            this.angleChart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.angleChart.update();
        }
        
        if (this.velocityChart) {
            this.velocityChart.data.labels = [];
            this.velocityChart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            this.velocityChart.update();
        }
    }
    
    /**
     * 重置 UI 顯示
     */
    resetUIDisplay() {
        // 重置角度顯示
        const angleElements = [
            'left-elbow-angle', 'right-elbow-angle', 'left-knee-angle', 'right-knee-angle',
            'left-shoulder-angle', 'right-shoulder-angle', 'left-hip-angle', 'right-hip-angle'
        ];
        angleElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '0°';
        });
        
        // 重置物理數據顯示
        const physicsElements = [
            'left-elbow-velocity', 'right-elbow-velocity', 'left-knee-velocity', 'right-knee-velocity',
            'left-elbow-acceleration', 'right-elbow-acceleration', 'left-knee-acceleration', 'right-knee-acceleration'
        ];
        physicsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id.includes('velocity')) {
                    element.textContent = '0 °/s';
                } else {
                    element.textContent = '0 °/s²';
                }
            }
        });
        
        // 重置動作識別顯示
        const actionElement = document.getElementById('current-action');
        const confidenceElement = document.getElementById('action-confidence');
        const countElement = document.getElementById('action-count');
        
        if (actionElement) actionElement.textContent = '待檢測';
        if (confidenceElement) confidenceElement.textContent = '0%';
        if (countElement) countElement.textContent = '0';
    }
    
    /**
     * 更新按鈕狀態
     */
    updateButtonStates(isDetecting) {
        const startBtn = document.getElementById('start-detection-btn');
        const stopBtn = document.getElementById('stop-detection-btn');
        const resetBtn = document.getElementById('reset-detection-btn');
        
        if (startBtn) {
            startBtn.disabled = isDetecting;
        }
        
        if (stopBtn) {
            stopBtn.disabled = !isDetecting;
        }
        
        if (resetBtn) {
            resetBtn.disabled = isDetecting;
        }
        
        this.isDetectionActive = isDetecting;
        
        // 同時更新錄製按鈕狀態
        this.updateRecordingButtonStates(isDetecting, this.isRecording);
    }
    
    /**
     * 顯示/隱藏錄製指示器
     */
    showRecordingIndicator(show) {
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * 更新連接狀態
     */
    updateConnectionStatus(connected) {
        // 可以在這裡添加連接狀態指示器的邏輯
        console.log('連接狀態:', connected ? '已連接' : '已斷開');
    }
    
    /**
     * 處理開始檢測回應
     */
    handleStartDetectionResponse(data) {
        if (data.status === 'success') {
            console.log('檢測已成功啟動');
        } else {
            console.error('啟動檢測失敗:', data.message);
            this.showError(data.message || '啟動檢測失敗');
            this.updateButtonStates(false);
            this.showRecordingIndicator(false);
        }
    }
    
    /**
     * 處理停止檢測回應
     */
    handleStopDetectionResponse(data) {
        if (data.status === 'success') {
            console.log('檢測已成功停止');
        } else {
            console.error('停止檢測失敗:', data.message);
            this.showError(data.message || '停止檢測失敗');
        }
    }
    
    /**
     * 處理重置回應
     */
    handleResetResponse(data) {
        if (data.status === 'success') {
            console.log('檢測已成功重置');
        } else {
            console.error('重置檢測失敗:', data.message);
            this.showError(data.message || '重置檢測失敗');
        }
    }
    
    /**
     * 檢測可用攝像頭
     */
    detectAvailableCameras() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接，請刷新頁面重試');
            return;
        }
        
        console.log('檢測可用攝像頭...');
        
        // 禁用檢測按鈕，顯示載入狀態
        const detectBtn = document.getElementById('detect-cameras-btn');
        if (detectBtn) {
            detectBtn.disabled = true;
            detectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 檢測中...';
        }
        
        // 發送檢測攝像頭請求
        this.socket.emit('detect_cameras');
    }
    
    /**
     * 處理攝像頭檢測回應
     */
    handleCameraDetectionResponse(data) {
        const detectBtn = document.getElementById('detect-cameras-btn');
        
        // 恢復按鈕狀態
        if (detectBtn) {
            detectBtn.disabled = false;
            detectBtn.innerHTML = '<i class="fas fa-search"></i> 檢測攝像頭';
        }
        
        if (data.status === 'success') {
            this.availableCameras = data.cameras || [];
            this.updateCameraOptions();
            console.log('檢測到攝像頭:', this.availableCameras);
            
            if (this.availableCameras.length === 0) {
                this.showError('未檢測到可用的攝像頭');
            } else {
                this.showSuccess(`檢測到 ${this.availableCameras.length} 個攝像頭`);
            }
        } else {
            console.error('攝像頭檢測失敗:', data.message);
            this.showError(data.message || '攝像頭檢測失敗');
        }
    }
    
    /**
     * 更新攝像頭選項
     */
    updateCameraOptions() {
        const cameraSelect = document.getElementById('camera-select');
        if (!cameraSelect) return;
        
        // 清空現有選項
        cameraSelect.innerHTML = '';
        
        if (this.availableCameras.length === 0) {
            // 如果沒有檢測到攝像頭，顯示預設選項
            for (let i = 0; i < 4; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `攝像頭 ${i}${i === 0 ? ' (預設)' : ''}`;
                cameraSelect.appendChild(option);
            }
        } else {
            // 根據檢測結果添加選項
            this.availableCameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.index;
                option.textContent = `攝像頭 ${camera.index} - ${camera.name || '未知設備'}`;
                cameraSelect.appendChild(option);
            });
        }
        
        // 設置當前選中的攝像頭
        cameraSelect.value = this.selectedCameraIndex;
    }
    
    /**
     * 處理攝像頭就緒
     */
    handleCameraReady() {
        if (this.cameraReady) return;
        
        this.cameraReady = true;
        this.waitingForCamera = false;
        
        console.log('攝像頭已就緒，開始同步錄製和數據記錄...');
        
        // 現在設置檢測開始時間
        this.detectionStartTime = Date.now();
        this.currentDetectionTime = 0;
        
        // 更新狀態顯示
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = '檢測和錄製中';
        }
        
        // 開始錄製
        this.socket.emit('start_recording');
        
        // 重置圖表數據（清除攝像頭啟動期間的數據）
        this.resetChartData();
        
        console.log('同步開始：攝像頭畫面 + 影片錄製 + 圖表記錄');
    }
    
    /**
     * 攝像頭選擇變更事件
     */
    onCameraSelectionChange(cameraIndex) {
        const newIndex = parseInt(cameraIndex);
        if (newIndex !== this.selectedCameraIndex) {
            this.selectedCameraIndex = newIndex;
            console.log('攝像頭索引已變更為:', this.selectedCameraIndex);
            
            // 如果正在檢測中，提示用戶重新啟動檢測
            if (this.isDetectionActive) {
                this.showInfo('攝像頭已變更，請停止並重新開始檢測以使用新的攝像頭');
            }
        }
    }
    
    /**
     * 開始錄製
     */
    startRecording() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接，請刷新頁面重試');
            return;
        }
        
        if (!this.isDetectionActive) {
            this.showError('請先開始檢測再進行錄製');
            return;
        }
        
        console.log('開始錄製影片...');
        this.socket.emit('start_recording');
    }
    
    /**
     * 停止錄製
     */
    stopRecording() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Socket 未連接');
            return;
        }
        
        console.log('停止錄製影片...');
        this.socket.emit('stop_recording');
    }
    
    /**
     * 處理錄製開始回應
     */
    handleRecordingStarted(data) {
        if (data.status === 'success') {
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.updateRecordingButtonStates(true, true);
            this.startRecordingTimer();
            console.log('錄製已開始');
        } else {
            console.error('開始錄製失敗:', data.message);
            this.showError(data.message || '開始錄製失敗');
        }
    }
    
    /**
     * 處理錄製停止回應
     */
    handleRecordingStopped(data) {
        if (data.status === 'success') {
            this.isRecording = false;
            this.stopRecordingTimer();
            this.lastRecordingData = data;
            this.showDownloadSection(data);
            console.log('錄製已停止，影片已保留');
        } else {
            console.error('停止錄製失敗:', data.message);
            this.showError(data.message || '停止錄製失敗');
        }
    }
    
    /**
     * 處理錄製刪除回應
     */
    handleRecordingDeleted(data) {
        if (data.status === 'success') {
            this.isRecording = false;
            this.stopRecordingTimer();
            this.lastRecordingData = null;
            console.log('錄製已停止，影片已刪除');
            this.showInfo('影片已刪除');
        } else {
            console.error('刪除錄製失敗:', data.message);
            this.showError(data.message || '刪除錄製失敗');
        }
    }
    
    /**
     * 更新錄製狀態
     */
    updateRecordingStatus(data) {
        if (data.is_recording) {
            const duration = Math.floor(data.duration);
            this.updateRecordingTime(duration);
        }
    }
    
    /**
     * 開始錄製計時器
     */
    startRecordingTimer() {
        const statusText = document.querySelector('.status-text');
        const recordingTime = document.getElementById('recording-time');
        
        if (statusText) {
            statusText.textContent = '檢測和錄製中';
        }
        
        if (recordingTime) {
            recordingTime.classList.add('active');
        }
        
        this.recordingTimer = setInterval(() => {
            if (this.recordingStartTime) {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                this.updateRecordingTime(elapsed);
            }
        }, 1000);
    }
    
    /**
     * 停止錄製計時器
     */
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        const statusText = document.querySelector('.status-text');
        const recordingTime = document.getElementById('recording-time');
        
        if (statusText) {
            statusText.textContent = '檢測完成';
        }
        
        if (recordingTime) {
            recordingTime.classList.remove('active');
        }
    }
    
    /**
     * 更新錄製時間顯示
     */
    updateRecordingTime(seconds) {
        const recordingTime = document.getElementById('recording-time');
        if (recordingTime) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            recordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    /**
     * 更新錄製狀態顯示（不再需要按鈕狀態管理）
     */
    updateRecordingButtonStates(isDetecting, isRecording) {
        // 錄製控制已整合到檢測控制中，這個方法保留以避免錯誤
        // 實際的狀態更新通過 updateRecordingStatus 處理
    }
    
    /**
     * 顯示下載區域
     */
    showDownloadSection(recordingData) {
        const downloadSection = document.getElementById('download-section');
        const durationElement = document.getElementById('recording-duration');
        
        if (downloadSection) {
            downloadSection.style.display = 'block';
            downloadSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        if (durationElement && recordingData.duration) {
            durationElement.textContent = `${recordingData.duration.toFixed(1)}秒`;
        }
    }
    
    /**
     * 下載原始影片
     */
    downloadOriginalVideo() {
        if (!this.lastRecordingData || !this.lastRecordingData.original_video) {
            this.showError('沒有可下載的原始影片');
            return;
        }
        
        this.downloadFile(this.lastRecordingData.original_video, '原始影片');
    }
    
    /**
     * 下載分析影片
     */
    downloadAnalysisVideo() {
        if (!this.lastRecordingData || !this.lastRecordingData.skeleton_video) {
            this.showError('沒有可下載的分析影片');
            return;
        }
        
        this.downloadFile(this.lastRecordingData.skeleton_video, '分析影片');
    }
    
    /**
     * 下載文件
     */
    downloadFile(filename, description) {
        try {
            // 創建下載連結
            const link = document.createElement('a');
            link.href = `/download_recording/${filename}`;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`開始下載${description}: ${filename}`);
        } catch (error) {
            console.error(`下載${description}失敗:`, error);
            this.showError(`下載${description}失敗`);
        }
    }
    
    /**
     * 顯示錯誤信息
     */
    showError(message) {
        console.error('錯誤:', message);
        // 可以在這裡添加錯誤提示 UI
        alert('錯誤: ' + message);
    }
    
    /**
     * 顯示成功信息
     */
    showSuccess(message) {
        console.log('成功:', message);
        // 可以在這裡添加成功提示 UI
        alert('成功: ' + message);
    }
    
    /**
     * 顯示信息提示
     */
    showInfo(message) {
        console.info('信息:', message);
        // 可以在這裡添加信息提示 UI
        alert('提示: ' + message);
    }
    
    /**
     * 銷毀管理器
     */
    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.angleChart) {
            this.angleChart.destroy();
        }
        
        if (this.velocityChart) {
            this.velocityChart.destroy();
        }
        
        console.log('跆拳道詳細姿態偵測管理器已銷毀');
    }
}

// 全局實例
let taekwondoDetailManager = null;

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('頁面載入完成，初始化跆拳道詳細姿態偵測管理器...');
    taekwondoDetailManager = new TaekwondoDetailManager();
});

// 頁面卸載時清理資源
window.addEventListener('beforeunload', function() {
    if (taekwondoDetailManager) {
        taekwondoDetailManager.destroy();
    }
});

// 導出給其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaekwondoDetailManager;
}