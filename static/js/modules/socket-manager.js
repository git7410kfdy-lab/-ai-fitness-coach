/**
 * Socket Manager Module
 * 負責管理 Socket.IO 連接和事件處理
 */

class SocketManager {
    constructor() {
        this.socket = null;
        this.exerciseSocket = null;
        this.isConnected = false;
        this.hasReceivedResponse = false;
        this.videoFrameReceived = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // 事件回調函數
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onVideoFrame: null,
            onExerciseCount: null,
            onPoseQuality: null,
            onQualityScore: null,
            onAngleData: null,
            onDetectionResult: null,
            onCoachTip: null,
            onError: null,
            onStartDetectionResponse: null,
            onStopDetectionResponse: null,
            onModelStatus: null,
            onDebug: null,
            onDribbleMode: null
        };
    }

    /**
     * 初始化 Socket 連接
     */
    init() {
        console.log('初始化Socket連接');
        
        // 檢查是否已存在Socket連接
        if (this.socket && this.socket.connected) {
            console.log('Socket已連接，跳過初始化');
            return this.socket;
        }
        
        // 如果socket存在但未連接，嘗試重新連接
        if (this.socket) {
            console.log('Socket存在但未連接，嘗試重新連接');
            this.socket.connect();
            return this.socket;
        }

        try {
            console.log('建立新的Socket連接');
            
            // 嘗試使用命名空間連接
            try {
                this.socket = io('/exercise', {
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: this.reconnectDelay,
                    timeout: 10000
                });
                console.log('使用 /exercise 命名空間連接');
            } catch (err) {
                console.warn('使用命名空間連接失敗，嘗試預設連接:', err);
                this.socket = io({
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: this.reconnectDelay,
                    timeout: 10000
                });
                console.log('使用預設連接');
            }
            
            this.bindEvents();
            return this.socket;
        } catch (e) {
            console.error('初始化Socket時出錯:', e);
            if (this.callbacks.onError) {
                this.callbacks.onError('初始化Socket連接失敗: ' + e.message);
            }
            return null;
        }
    }

    /**
     * 綁定 Socket 事件
     */
    bindEvents() {
        if (!this.socket) return;

        // 移除所有現有事件監聽器，避免重複綁定
        this.removeAllListeners();
        
        // 連接事件
        this.socket.on('connect', () => {
            console.log('Socket.io 連接成功');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Socket.io 連接錯誤:', error);
            this.isConnected = false;
            this.reconnectAttempts++;
            
            if (this.callbacks.onError) {
                this.callbacks.onError('伺服器連接失敗，請重新整理頁面');
            }
        });
        
        // 斷開連接事件
        this.socket.on('disconnect', (reason) => {
            console.log('Socket斷開連接:', reason);
            this.isConnected = false;
            
            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect(reason);
            }
        });
        
        // 視頻幀更新事件
        this.socket.on('video_frame', (data) => {
            if (data && data.frame) {
                try {
                    if (typeof data.frame === 'string' && data.frame.length > 100) {
                        if (!this.videoFrameReceived) {
                            this.videoFrameReceived = true;
                        }
                        
                        if (this.callbacks.onVideoFrame) {
                            this.callbacks.onVideoFrame(data.frame);
                        }
                    } else {
                        console.warn('收到的 base64 數據可能無效');
                    }
                } catch (e) {
                    console.error('處理視頻幀時出錯:', e);
                }
            }
        });
        
        // 運動計數更新事件
        this.socket.on('exercise_count', (data) => {
            this.hasReceivedResponse = true;
            
            if (this.callbacks.onExerciseCount) {
                this.callbacks.onExerciseCount(data);
            }
        });
        
        // 姿勢質量評分事件
        this.socket.on('pose_quality', (data) => {
            if (this.callbacks.onPoseQuality) {
                this.callbacks.onPoseQuality(data);
            }
        });
        
        // 品質分數事件
        this.socket.on('quality_score', (data) => {
            if (this.callbacks.onQualityScore) {
                this.callbacks.onQualityScore(data);
            }
        });
        
        // 肩推分數事件
        this.socket.on('shoulder_press_score', (data) => {
            if (this.callbacks.onShoulderPressScore) {
                this.callbacks.onShoulderPressScore(data);
            } else if (this.callbacks.onPoseQuality) {
                // 如果沒有專門的肩推分數回調，使用姿勢質量回調
                this.callbacks.onPoseQuality(data);
            }
        });
        
        // 角度數據事件
        this.socket.on('angle_data', (data) => {
            if (this.callbacks.onAngleData) {
                this.callbacks.onAngleData(data);
            }
        });
        
        // 檢測結果事件
        this.socket.on('detection_result', (data) => {
            if (this.callbacks.onDetectionResult) {
                this.callbacks.onDetectionResult(data);
            }
        });
        
        // 教練提示事件
        this.socket.on('coach_tip', (data) => {
            if (this.callbacks.onCoachTip) {
                this.callbacks.onCoachTip(data);
            }
        });
        
        // 運球模式事件
        this.socket.on('dribble_mode', (data) => {
            if (this.callbacks.onDribbleMode) {
                this.callbacks.onDribbleMode(data);
            }
        });
        
        // 模型狀態事件
        this.socket.on('model_status', (data) => {
            if (this.callbacks.onModelStatus) {
                this.callbacks.onModelStatus(data);
            }
        });
        
        // 除錯事件
        this.socket.on('debug', (data) => {
            if (this.callbacks.onDebug) {
                this.callbacks.onDebug(data);
            }
        });
        
        // 錯誤事件
        this.socket.on('error', (data) => {
            if (this.callbacks.onError) {
                this.callbacks.onError(data.message || '發生錯誤，請重試');
            }
        });
        
        // 開始檢測回應事件
        this.socket.on('start_detection_response', (data) => {
            this.hasReceivedResponse = true;
            
            if (this.callbacks.onStartDetectionResponse) {
                this.callbacks.onStartDetectionResponse(data);
            }
        });
        
        // 停止檢測回應事件
        this.socket.on('stop_detection_response', (data) => {
            if (this.callbacks.onStopDetectionResponse) {
                this.callbacks.onStopDetectionResponse(data);
            }
        });
        
        console.log('Socket事件監聽器設置完成');
    }

    /**
     * 移除所有事件監聽器
     */
    removeAllListeners() {
        if (!this.socket) return;
        
        const events = [
            'connect', 'connect_error', 'disconnect', 'video_frame',
            'exercise_count', 'pose_quality', 'quality_score', 'angle_data',
            'detection_result', 'coach_tip', 'error', 'start_detection_response',
            'stop_detection_response', 'model_status', 'debug', 'dribble_mode'
        ];
        
        events.forEach(event => {
            this.socket.off(event);
        });
    }

    /**
     * 設置事件回調函數
     */
    setCallback(event, callback) {
        // 處理事件名稱映射
        const eventMap = {
            'onConnected': 'onConnect',
            'onDisconnected': 'onDisconnect',
            'onVideoFrame': 'onVideoFrame',
            'onExerciseCount': 'onExerciseCount',
            'onPoseQuality': 'onPoseQuality',
            'onAngleData': 'onAngleData',
            'onDetectionResult': 'onDetectionResult',
            'onError': 'onError'
        };
        
        const callbackName = eventMap[event] || event;
        
        if (typeof callback === 'function') {
            this.callbacks[callbackName] = callback;
            console.log(`設置回調函數: ${callbackName}`);
        } else {
            console.warn(`無效的回調函數: ${event}`);
        }
    }

    /**
     * 發送開始檢測請求
     */
    startDetection(requestData) {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket未連接，無法發送開始檢測請求');
            return false;
        }
        
        console.log('發送開始檢測請求:', requestData);
        this.socket.emit('start_detection', requestData);
        
        // 設置超時檢查
        setTimeout(() => {
            if (!this.hasReceivedResponse) {
                console.log('開始檢測請求等待響應中...');
            }
        }, 5000);
        
        return true;
    }

    /**
     * 發送停止檢測請求
     */
    stopDetection() {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket未連接，無法發送停止檢測請求');
            return false;
        }
        
        console.log('發送停止檢測請求');
        this.socket.emit('stop_detection');
        return true;
    }

    /**
     * 發送重置計數請求
     */
    resetCount() {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket未連接，無法發送重置請求');
            return false;
        }
        
        console.log('發送重置計數請求');
        this.socket.emit('reset_count');
        return true;
    }

    /**
     * 設置偵測線
     */
    setDetectionLine(line) {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket未連接，無法設置偵測線');
            return false;
        }
        
        console.log('設置偵測線:', line);
        this.socket.emit('set_detection_line', { line: line });
        return true;
    }

    /**
     * 匯出運動數據到 Excel
     */
    exportToExcel() {
        if (!this.socket || !this.socket.connected) {
            console.error('Socket未連接，無法匯出數據');
            return false;
        }
        
        console.log('請求匯出運動數據到Excel');
        this.socket.emit('export_to_excel');
        return true;
    }

    /**
     * 檢查連接狀態
     */
    checkConnection() {
        if (!this.socket) {
            console.log('Socket未初始化，嘗試重新連接');
            return this.init();
        }
        
        if (!this.socket.connected) {
            console.log('Socket未連接，嘗試重新連接');
            this.socket.connect();
        }
        
        return this.socket.connected;
    }

    /**
     * 斷開連接
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * 獲取連接狀態
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            hasSocket: !!this.socket,
            socketConnected: this.socket ? this.socket.connected : false
        };
    }
}

// 導出 SocketManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SocketManager;
} else {
    window.SocketManager = SocketManager;
}