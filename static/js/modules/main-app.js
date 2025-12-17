/**
 * Main Application Module
 * 負責整合所有模組並提供統一的應用程式入口點
 */

class MainApp {
    constructor() {
        // 模組實例
        this.socketManager = null;
        this.gameManager = null;
        this.uiManager = null;
        this.exerciseManager = null;
        this.mapManager = null;
        this.threeManager = null;
        this.workoutManager = null;
        
        // 應用程式狀態
        this.isInitialized = false;
        this.isConnected = false;
        this.currentUser = null;
        
        // 配置
        this.config = {
            socketUrl: window.location.protocol + '//' + window.location.host,
            autoConnect: true,
            enableThreeJs: true,
            enableWorkoutPlan: true,
            debugMode: false
        };
        
        // 事件系統
        this.eventListeners = {};
    }

    /**
     * 初始化應用程式
     */
    async init(config = {}) {
        console.log('初始化主應用程式');
        
        // 合併配置
        this.config = { ...this.config, ...config };
        
        try {
            // 初始化各個模組
            await this.initModules();
            
            // 設置模組間的通信
            this.setupModuleCommunication();
            
            // 綁定事件監聽器
            this.bindEventListeners();
            
            // 初始化 UI
            this.initializeUI();
            
            // 自動連接（如果啟用）
            if (this.config.autoConnect) {
                await this.connect();
            }
            
            this.isInitialized = true;
            console.log('主應用程式初始化完成');
            
            // 觸發初始化完成事件
            this.emit('app:initialized');
            
        } catch (error) {
            console.error('應用程式初始化失敗:', error);
            this.emit('app:error', error);
            throw error;
        }
    }

    /**
     * 初始化各個模組
     */
    async initModules() {
        console.log('開始初始化模組...');
        
        // 初始化攻擊特效管理器（在realtime.js環境中只需要這個）
        if (typeof AttackEffectsManager !== 'undefined') {
            this.attackEffectsManager = new AttackEffectsManager();
            this.attackEffectsManager.init();
            // 將攻擊特效管理器設為全局變量，供realtime.js使用
            window.attackEffectsManager = this.attackEffectsManager;
            console.log('AttackEffectsManager 初始化完成並設為全局變量');
        } else {
            console.warn('AttackEffectsManager 類未找到');
        }
        
        // 其他管理器的初始化（僅在相應類存在時）
        try {
            if (typeof UIManager !== 'undefined') {
                this.uiManager = new UIManager();
                this.uiManager.init();
            }
            
            if (typeof ExerciseManager !== 'undefined') {
                this.exerciseManager = new ExerciseManager();
                this.exerciseManager.init();
            }
            
            if (typeof GameManager !== 'undefined') {
                this.gameManager = new GameManager();
                this.gameManager.init();
            }
            
            if (typeof MapManager !== 'undefined') {
                this.mapManager = new MapManager();
                this.mapManager.init();
            }
            
            if (this.config.enableWorkoutPlan && typeof WorkoutManager !== 'undefined') {
                this.workoutManager = new WorkoutManager();
                this.workoutManager.init();
            }
            
            if (this.config.enableThreeJs && typeof ThreeManager !== 'undefined') {
                this.threeManager = new ThreeManager();
                this.threeManager.init().catch(error => {
                    console.warn('Three.js 初始化失敗，但不影響主要功能:', error);
                });
            }
            
            if (typeof SocketManager !== 'undefined') {
                this.socketManager = new SocketManager();
                this.socketManager.init(this.config.socketUrl);
            }
        } catch (error) {
            console.warn('部分模組初始化失敗，但不影響核心功能:', error);
        }
        
        console.log('模組初始化完成');
    }

    /**
     * 設置模組間的通信
     */
    setupModuleCommunication() {
        console.log('設置模組間通信...');
        
        // Socket 管理器事件（僅在存在時設置）
        if (this.socketManager) {
            this.socketManager.setCallback('onConnected', () => {
                this.isConnected = true;
                this.emit('app:connected');
                if (this.uiManager) {
                    this.uiManager.updateConnectionStatus(true);
                }
            });
            
            this.socketManager.setCallback('onDisconnected', () => {
                this.isConnected = false;
                this.emit('app:disconnected');
                if (this.uiManager) {
                    this.uiManager.updateConnectionStatus(false);
                }
            });
            
            this.socketManager.setCallback('onVideoFrame', (frameData) => {
                if (this.uiManager) {
                    this.uiManager.updateVideoFrame(frameData);
                }
            });
            
            this.socketManager.setCallback('onExerciseCount', (data) => {
                if (this.gameManager) {
                    this.gameManager.updateExerciseCount(data.count);
                }
                if (this.uiManager) {
                    this.uiManager.updateExerciseCount(data.count);
                }
                
                if (this.workoutManager && this.workoutManager.isTraining()) {
                    this.workoutManager.recordExercise(
                        this.exerciseManager.getCurrentExerciseType(),
                        data.count,
                        data.quality || 0
                    );
                }
            });
        
            if (this.socketManager) {
                this.socketManager.setCallback('onPoseQuality', (data) => {
                    if (this.uiManager) {
                        this.uiManager.updateQualityScore(data.score, data.tip);
                    }
                    
                    // 傳遞姿勢品質數據給怪物攻擊系統
                    if (window.monsterAttackSystem) {
                        const currentExerciseType = this.exerciseManager ? this.exerciseManager.getCurrentExerciseType() : null;
                        window.monsterAttackSystem.handlePostureQuality({ 
                            score: data.score, 
                            exerciseType: currentExerciseType 
                        });
                    }
                    
                    // 觸發自定義事件供其他模組使用
                    const postureQualityEvent = new CustomEvent('postureQuality', {
                        detail: { score: data.score, tip: data.tip }
                    });
                    document.dispatchEvent(postureQualityEvent);
                });
                
                this.socketManager.setCallback('onAngleData', (data) => {
                    if (this.uiManager) {
                        this.uiManager.updateAngleDisplay(data);
                    }
                });
                
                this.socketManager.setCallback('onDetectionResult', (data) => {
                    this.handleDetectionResult(data);
                });
            }
        } else {
            console.log('SocketManager 不存在，跳過 Socket 事件設置');
        }
        
        // 運動管理器事件（僅在存在時設置）
        if (this.exerciseManager) {
            this.exerciseManager.setCallback('onExerciseChanged', (exerciseType) => {
                if (this.uiManager) {
                    this.uiManager.updateCurrentExercise(exerciseType);
                }
                if (this.gameManager) {
                    this.gameManager.setCurrentExercise(exerciseType);
                }
            });
            
            this.exerciseManager.setCallback('onDetectionStarted', (data) => {
                if (this.uiManager) {
                    this.uiManager.updateDetectionStatus(true);
                }
                if (this.gameManager) {
                    this.gameManager.startDetection();
                }
                
                if (this.workoutManager && !this.workoutManager.isTraining()) {
                    this.workoutManager.startSession();
                }
                
                // 觸發檢測開始事件
                const detectionStartedEvent = new CustomEvent('detectionStarted', {
                    detail: { exerciseType: data }
                });
                document.dispatchEvent(detectionStartedEvent);
            });
            
            this.exerciseManager.setCallback('onDetectionStopped', () => {
                if (this.uiManager) {
                    this.uiManager.updateDetectionStatus(false);
                }
                if (this.gameManager) {
                    this.gameManager.stopDetection();
                }
                
                // 觸發檢測停止事件
                const detectionStoppedEvent = new CustomEvent('detectionStopped');
                document.dispatchEvent(detectionStoppedEvent);
            });
        } else {
            console.log('ExerciseManager 不存在，跳過運動管理器事件設置');
        }
        
        // 遊戲管理器事件（僅在存在時設置）
        if (this.gameManager) {
            this.gameManager.setCallback('onMonsterDefeated', (monsterData) => {
                if (this.uiManager) {
                    this.uiManager.showNotification(`擊敗了 ${monsterData.name}！`, 'success');
                }
                
                if (this.threeManager && this.threeManager.isModelReady()) {
                    this.threeManager.playAnimation('defeat', false);
                }
            });
            
            this.gameManager.setCallback('onLevelCompleted', (levelData) => {
                if (this.uiManager) {
                    this.uiManager.showNotification(`完成關卡 ${levelData.id}！`, 'success');
                }
                if (this.mapManager) {
                    this.mapManager.completeLevel(levelData.id);
                }
                
                if (this.workoutManager && this.workoutManager.isTraining()) {
                    this.workoutManager.endSession();
                }
            });
            
            this.gameManager.setCallback('onComboChanged', (comboData) => {
                if (this.uiManager) {
                    this.uiManager.updateComboDisplay(comboData.count, comboData.multiplier);
                }
            });
            
            this.gameManager.setCallback('onHealthChanged', (healthData) => {
                if (this.uiManager) {
                    this.uiManager.updateMonsterHealth(healthData.current, healthData.max);
                }
            });
        } else {
            console.log('GameManager 不存在，跳過遊戲管理器事件設置');
        }
        
        // 地圖管理器事件（僅在存在時設置）
        if (this.mapManager) {
            this.mapManager.setCallback('onLevelSelected', (levelId) => {
                if (this.gameManager) {
                    this.gameManager.initLevel(levelId);
                }
                if (this.uiManager) {
                    this.uiManager.updateLevelDisplay(levelId);
                }
            });
        } else {
            console.log('MapManager 不存在，跳過地圖管理器事件設置');
        }
        
        // Three.js 管理器事件（如果啟用）
        if (this.threeManager) {
            this.threeManager.setCallback('onModelLoaded', () => {
                this.uiManager.showToast('怪物模型載入完成');
            });
            
            this.threeManager.setCallback('onModelError', (error) => {
                console.warn('怪物模型載入失敗:', error);
            });
        }
        
        // 訓練管理器事件（如果啟用）
        if (this.workoutManager) {
            this.workoutManager.setCallback('onPlanCompleted', (plan) => {
                this.uiManager.showNotification(`完成訓練計劃：${plan.name}！`, 'success');
            });
            
            this.workoutManager.setCallback('onExerciseCompleted', (exercise) => {
                this.uiManager.showNotification(`完成運動：${exercise.name}！`, 'info');
            });
        }
        
        console.log('模組間通信設置完成');
    }

    /**
     * 綁定事件監聽器
     */
    bindEventListeners() {
        // 開始按鈕
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startDetection();
            });
        }
        
        // 停止按鈕
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopDetection();
            });
        }
        
        // 重置按鈕
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetGame();
            });
        }
        
        // 運動類型選擇
        const exerciseSelect = document.getElementById('exercise-type');
        if (exerciseSelect) {
            exerciseSelect.addEventListener('change', (e) => {
                this.changeExercise(e.target.value);
            });
        }
        
        // 切換動作按鈕
        const switchBtn = document.getElementById('switch-exercise-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.switchExercise();
            });
        }
        
        // 窗口大小變化
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // 頁面卸載
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * 初始化 UI
     */
    initializeUI() {
        // 設置初始狀態
        if (this.uiManager) {
            this.uiManager.updateConnectionStatus(false);
            this.uiManager.updateDetectionStatus(false);
        }
        
        // 載入用戶設置
        this.loadUserSettings();
        
        // 更新運動選項
        this.updateExerciseOptions();
    }

    /**
     * 連接到服務器
     */
    async connect() {
        if (!this.socketManager) {
            throw new Error('Socket 管理器未初始化');
        }
        
        try {
            await this.socketManager.connect();
            console.log('連接到服務器成功');
        } catch (error) {
            console.error('連接到服務器失敗:', error);
            throw error;
        }
    }

    /**
     * 斷開連接
     */
    disconnect() {
        if (this.socketManager) {
            this.socketManager.disconnect();
        }
    }

    /**
     * 開始偵測
     */
    async startDetection() {
        if (!this.isConnected) {
            this.uiManager.showNotification('請先連接到服務器', 'error');
            return false;
        }
        
        try {
            const success = await this.exerciseManager.startDetection();
            if (success) {
                this.emit('detection:started');
            }
            return success;
        } catch (error) {
            console.error('開始偵測失敗:', error);
            this.uiManager.showNotification('開始偵測失敗', 'error');
            return false;
        }
    }

    /**
     * 停止偵測
     */
    async stopDetection() {
        try {
            const success = await this.exerciseManager.stopDetection();
            if (success) {
                this.emit('detection:stopped');
            }
            return success;
        } catch (error) {
            console.error('停止偵測失敗:', error);
            this.uiManager.showNotification('停止偵測失敗', 'error');
            return false;
        }
    }

    /**
     * 重置遊戲
     */
    resetGame() {
        this.gameManager.resetLevel();
        this.exerciseManager.resetTrainingProgress();
        this.uiManager.showNotification('遊戲已重置', 'info');
        this.emit('game:reset');
    }

    /**
     * 切換運動類型
     */
    changeExercise(exerciseType) {
        if (this.exerciseManager && typeof this.exerciseManager.handleExerciseChange === 'function') {
            this.exerciseManager.handleExerciseChange(exerciseType);
        } else {
            console.warn('ExerciseManager 未初始化或 handleExerciseChange 方法不存在');
        }
        this.emit('exercise:changed', exerciseType);
    }

    /**
     * 切換動作
     */
    switchExercise() {
        if (this.exerciseManager && typeof this.exerciseManager.handleSwitchExercise === 'function') {
            this.exerciseManager.handleSwitchExercise();
        } else {
            console.warn('ExerciseManager 未初始化或 handleSwitchExercise 方法不存在');
        }
        this.emit('exercise:switched');
    }

    /**
     * 處理偵測結果
     */
    handleDetectionResult(data) {
        // 更新 UI
        if (data.count !== undefined) {
            this.uiManager.updateExerciseCount(data.count);
        }
        
        if (data.quality !== undefined) {
            this.uiManager.updateQualityScore(data.quality);
        }
        
        if (data.tip) {
            this.uiManager.updateCoachTip(data.tip);
        }
        
        if (data.angles) {
            this.uiManager.updateAngleDisplay(data.angles);
        }
        
        // 更新遊戲狀態
        if (data.count !== undefined) {
            this.gameManager.updateExerciseCount(data.count);
        }
        
        // 記錄訓練數據
        if (this.workoutManager && this.workoutManager.isTraining() && data.count !== undefined) {
            this.workoutManager.recordExercise(
                this.exerciseManager.getCurrentExerciseType(),
                data.count,
                data.quality || 0
            );
        }
        
        this.emit('detection:result', data);
    }

    /**
     * 處理窗口大小變化
     */
    handleResize() {
        if (this.threeManager && this.threeManager.isReady()) {
            const container = document.querySelector('#monster-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                this.threeManager.resize(rect.width, rect.height);
            }
        }
    }

    /**
     * 載入用戶設置
     */
    loadUserSettings() {
        try {
            const settings = localStorage.getItem('userSettings');
            if (settings) {
                const parsedSettings = JSON.parse(settings);
                this.applyUserSettings(parsedSettings);
            }
        } catch (error) {
            console.error('載入用戶設置失敗:', error);
        }
    }

    /**
     * 應用用戶設置
     */
    applyUserSettings(settings) {
        if (settings.exerciseType) {
            this.exerciseManager.setCurrentExerciseType(settings.exerciseType);
        }
        
        if (settings.detectionLine) {
            this.exerciseManager.updateDetectionLine(settings.detectionLine);
        }
        
        if (settings.workoutPlan && this.workoutManager) {
            this.workoutManager.setPlan(settings.workoutPlan);
        }
    }

    /**
     * 保存用戶設置
     */
    saveUserSettings() {
        const settings = {
            exerciseType: this.exerciseManager.getCurrentExerciseType(),
            detectionLine: this.exerciseManager.getDetectionLine(),
            workoutPlan: this.workoutManager ? this.workoutManager.getCurrentPlan()?.id : null
        };
        
        try {
            localStorage.setItem('userSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('保存用戶設置失敗:', error);
        }
    }

    /**
     * 更新運動選項
     */
    updateExerciseOptions() {
        const exerciseSelect = document.getElementById('exercise-type');
        if (exerciseSelect && this.exerciseManager && typeof this.exerciseManager.getExerciseTypes === 'function') {
            const exercises = this.exerciseManager.getExerciseTypes();
            exerciseSelect.innerHTML = '';
            
            Object.entries(exercises).forEach(([key, exercise]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = exercise.name;
                exerciseSelect.appendChild(option);
            });
        }
    }

    /**
     * 獲取應用程式狀態
     */
    getAppState() {
        return {
            isInitialized: this.isInitialized,
            isConnected: this.isConnected,
            currentUser: this.currentUser,
            config: this.config,
            modules: {
                socket: this.socketManager ? this.socketManager.getConnectionState() : null,
                game: this.gameManager ? this.gameManager.getGameState() : null,
                exercise: this.exerciseManager ? this.exerciseManager.getExerciseState() : null,
                map: this.mapManager ? this.mapManager.getMapState() : null,
                three: this.threeManager ? this.threeManager.getSceneState() : null,
                workout: this.workoutManager ? this.workoutManager.getTrainingStats() : null
            }
        };
    }

    /**
     * 事件系統 - 添加監聽器
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 事件系統 - 移除監聽器
     */
    off(event, callback) {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }

    /**
     * 事件系統 - 觸發事件
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件回調執行失敗 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 清理資源
     */
    cleanup() {
        console.log('清理應用程式資源...');
        
        // 保存用戶設置
        this.saveUserSettings();
        
        // 停止偵測
        if (this.exerciseManager && this.exerciseManager.isDetecting()) {
            this.exerciseManager.stopDetection();
        }
        
        // 結束訓練會話
        if (this.workoutManager && this.workoutManager.isTraining()) {
            this.workoutManager.endSession();
        }
        
        // 斷開連接
        this.disconnect();
        
        // 清理 Three.js 資源
        if (this.threeManager) {
            this.threeManager.dispose();
        }
        
        // 清理攻擊特效系統
        if (window.attackEffectsManager) {
            window.attackEffectsManager.destroy();
        }
        
        // 清理事件監聽器
        this.eventListeners = {};
        
        console.log('應用程式資源清理完成');
    }
}

// 導出 MainApp 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MainApp;
} else {
    window.MainApp = MainApp;
}