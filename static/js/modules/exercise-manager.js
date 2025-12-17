/**
 * Exercise Manager Module
 * 負責管理運動類型、偵測控制和運動參數設置
 */

class ExerciseManager {
    constructor() {
        // 運動狀態
        this.currentExerciseType = 'squat';
        this.isDetecting = false;
        this.detectionLine = 400;
        this.dribbleMode = false;
        
        // 運動參數
        this.exerciseParams = {
            weight: 0,
            reps: 10,
            sets: 3,
            completedSets: 0
        };
        
        // 運動類型配置
        this.exerciseTypes = {
            'squat': {
                name: '深蹲',
                description: '下蹲時大腿與地面平行，起立時完全伸直',
                tips: ['保持背部挺直', '膝蓋不要超過腳尖', '下蹲時吸氣，起立時呼氣'],
                controls: []
            },
            'pushup': {
                name: '伏地挺身',
                description: '身體保持一直線，手臂完全伸直和彎曲',
                tips: ['保持身體一直線', '手臂與肩膀同寬', '下降時吸氣，推起時呼氣'],
                controls: []
            },
            'situp': {
                name: '仰臥起坐',
                description: '上身完全起立，然後緩慢放下',
                tips: ['雙手抱頭但不用力', '起身時呼氣，放下時吸氣', '動作要緩慢控制'],
                controls: []
            },
            'basketball': {
                name: '籃球投籃',
                description: '標準投籃姿勢，球從手中投出',
                tips: ['保持投籃姿勢標準', '跟隨球的軌跡', '注意手腕的彈動'],
                controls: ['basketball-controls']
            },
            'basketball_dribble': {
                name: '籃球運球',
                description: '持續運球動作，保持球的控制',
                tips: ['保持運球節奏', '手指控制球', '眼睛看前方'],
                controls: ['basketball-dribble-controls']
            },
            'tabletennis': {
                name: '桌球',
                description: '標準桌球揮拍動作',
                tips: ['保持正確握拍', '注意揮拍軌跡', '身體重心轉移'],
                controls: ['tabletennis-controls']
            },
            'volleyball-overhand': {
                name: '排球高手攻擊',
                description: '標準高手攻擊動作，手腕高於頭部',
                tips: ['保持手腕高於頭部', '注意攻擊軌跡', '身體協調發力'],
                controls: ['volleyball-overhand-controls']
            },
            'volleyball-lowhand': {
                name: '排球低手接球',
                description: '標準低手接球姿勢，雙手在腰部以下',
                tips: ['保持雙手在腰部以下', '身體重心穩定', '準備接球姿勢'],
                controls: ['volleyball-lowhand-controls']
            },
            'arm-swing-warmup': {
                name: '坐姿手臂擺動暖身',
                description: '坐姿雙手左右打開上下擺動，擺動幅度越大品質分數越高',
                tips: ['保持坐姿穩定', '雙手左右打開', '上下擺動幅度要大', '保持動作對稱'],
                controls: []
            },
            'alternating-arm-swing': {
                name: '雙手輪流擺動熱身',
                description: '坐姿雙手向前伸直左右手輪流上下擺動，持續做對的運動會計時',
                tips: ['保持坐姿穩定', '雙手向前伸直', '左右手輪流上下擺動', '保持手臂伸直'],
                controls: ['alternating-arm-swing-controls'],
                mode: 'timer' // 計時模式
            },
            'plank': {
                name: '平板支撐',
                description: '保持平板支撐姿勢，維持正確姿勢會累積時間',
                tips: ['保持身體一直線', '核心肌群用力', '不要塌腰或拱背', '保持自然呼吸'],
                controls: ['plank-controls'],
                mode: 'timer' // 計時模式
            }
        };
        
        // 偵測線配置
        this.detectionLines = {
            'squat': 400,
            'pushup': 300,
            'situp': 350,
            'basketball': 200,
            'basketball_dribble': 250,
            'tabletennis': 300,
            'volleyball-overhand': 200,
            'volleyball-lowhand': 350,
            'arm-swing-warmup': 300,
            'alternating-arm-swing': 300,
            'plank': 300
        };
        
        // 事件回調
        this.callbacks = {
            onExerciseTypeChanged: null,
            onDetectionStarted: null,
            onDetectionStopped: null,
            onParametersChanged: null,
            onDribbleModeChanged: null
        };
    }

    /**
     * 初始化運動管理器
     */
    init() {
        console.log('初始化運動管理器');
        this.setupExerciseControls();
        this.updateDetectionLine();
    }

    /**
     * 設置運動控制元素
     */
    setupExerciseControls() {
        const exerciseSelect = document.getElementById('exercise-type');
        if (exerciseSelect) {
            exerciseSelect.addEventListener('change', (e) => {
                this.handleExerciseChange(e.target.value);
            });
        }
        
        // 設置參數輸入監聽
        const weightInput = document.getElementById('weight');
        const repsInput = document.getElementById('reps');
        const setsInput = document.getElementById('sets');
        
        if (weightInput) {
            weightInput.addEventListener('change', () => this.updateParameters());
        }
        if (repsInput) {
            repsInput.addEventListener('change', () => this.updateParameters());
        }
        if (setsInput) {
            setsInput.addEventListener('change', () => this.updateParameters());
        }
        
        // 設置運球模式切換
        const dribbleModeToggle = document.getElementById('dribble-mode-toggle');
        if (dribbleModeToggle) {
            dribbleModeToggle.addEventListener('change', (e) => {
                this.setDribbleMode(e.target.checked);
            });
        }
    }

    /**
     * 處理運動類型變更
     */
    handleExerciseChange(exerciseType) {
        console.log(`運動類型變更為: ${exerciseType}`);
        
        const oldType = this.currentExerciseType;
        this.currentExerciseType = exerciseType;
        
        // 更新偵測線
        this.updateDetectionLine();
        
        // 更新控制元素顯示
        this.toggleExerciseControls();
        
        // 更新教練提示
        this.updateCoachTip();
        
        // 如果正在偵測，需要停止並重新開始
        if (this.isDetecting) {
            console.log('偵測進行中，停止當前偵測');
            this.stopDetection();
        }
        
        // 觸發回調
        if (this.callbacks.onExerciseTypeChanged) {
            this.callbacks.onExerciseTypeChanged(exerciseType, oldType);
        }
    }

    /**
     * 切換運動（不停止偵測）
     */
    switchExercise(exerciseType) {
        console.log(`切換運動到: ${exerciseType}`);
        
        const oldType = this.currentExerciseType;
        this.currentExerciseType = exerciseType;
        
        // 更新 UI 選擇器
        const exerciseSelect = document.getElementById('exercise-type');
        if (exerciseSelect) {
            exerciseSelect.value = exerciseType;
        }
        
        // 更新偵測線
        this.updateDetectionLine();
        
        // 更新控制元素顯示
        this.toggleExerciseControls();
        
        // 更新教練提示
        this.updateCoachTip();
        
        // 如果正在偵測，重新開始偵測
        if (this.isDetecting) {
            console.log('重新開始偵測');
            this.restartDetection();
        }
        
        // 觸發回調
        if (this.callbacks.onExerciseTypeChanged) {
            this.callbacks.onExerciseTypeChanged(exerciseType, oldType);
        }
    }

    /**
     * 開始偵測
     */
    startDetection() {
        if (this.isDetecting) {
            console.log('偵測已在進行中');
            return false;
        }
        
        console.log(`開始 ${this.getExerciseName()} 偵測`);
        this.isDetecting = true;
        
        // 觸發回調
        if (this.callbacks.onDetectionStarted) {
            this.callbacks.onDetectionStarted(this.currentExerciseType);
        }
        
        return true;
    }

    /**
     * 停止偵測
     */
    stopDetection() {
        if (!this.isDetecting) {
            console.log('偵測未在進行中');
            return false;
        }
        
        console.log('停止偵測');
        this.isDetecting = false;
        
        // 觸發回調
        if (this.callbacks.onDetectionStopped) {
            this.callbacks.onDetectionStopped(this.currentExerciseType);
        }
        
        return true;
    }

    /**
     * 重新開始偵測
     */
    restartDetection() {
        this.stopDetection();
        setTimeout(() => {
            this.startDetection();
        }, 100);
    }

    /**
     * 更新偵測線
     */
    updateDetectionLine() {
        const newLine = this.detectionLines[this.currentExerciseType] || 400;
        if (newLine !== this.detectionLine) {
            this.detectionLine = newLine;
            console.log(`更新偵測線為: ${this.detectionLine}`);
        }
    }

    /**
     * 切換運動控制元素顯示
     */
    toggleExerciseControls() {
        const exerciseConfig = this.exerciseTypes[this.currentExerciseType];
        if (!exerciseConfig) return;
        
        // 隱藏所有控制元素
        const allControls = [
            'basketball-controls', 
            'basketball-dribble-controls', 
            'tabletennis-controls', 
            'volleyball-overhand-controls', 
            'volleyball-lowhand-controls',
            'alternating-arm-swing-controls',
            'plank-controls',
            'continuous-defense-panel'
        ];
        allControls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // 顯示當前運動的控制元素
        exerciseConfig.controls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.style.display = 'block';
            }
        });
        
        // 特殊處理籃球投籃
        if (this.currentExerciseType === 'basketball') {
            this.showBasketballPrompt();
        }
        
        // 特殊處理雙手輪流擺動熱身 - 初始化統一面板
        if (this.currentExerciseType === 'alternating-arm-swing') {
            this.initializeUnifiedPanel();
        }
        
        // 特殊處理平板支撐 - 初始化平板支撐面板
        if (this.currentExerciseType === 'plank') {
            this.initializePlankPanel();
        }
    }

    /**
     * 顯示籃球投籃提示
     */
    showBasketballPrompt() {
        const prompt = document.getElementById('basketball-prompt');
        if (prompt) {
            prompt.style.display = 'block';
        }
    }

    /**
     * 初始化動態表單內容
     */
    initializeUnifiedPanel() {
        // 初始化為普通訓練模式
        this.loadNormalTrainingContent();
        
        // 添加模式切換按鈕
        this.addModeToggleButton();
        
        console.log('動態表單內容初始化完成');
    }
    
    /**
     * 初始化平板支撐面板
     */
    initializePlankPanel() {
        // 載入平板支撐訓練內容
        this.loadPlankContent();
        
        console.log('平板支撐面板初始化完成');
    }
    
    /**
     * 載入普通訓練模式內容
     */
    loadNormalTrainingContent() {
        const dynamicContent = document.getElementById('arm-swing-dynamic-content');
        if (!dynamicContent) return;
        
        dynamicContent.innerHTML = `
            <button type="button" id="reset-alternating-arm-swing" class="btn btn-warning">重置檢測</button>
            <p class="exercise-description">請坐姿保持穩定，雙手向前伸直，左右手輪流上下擺動。持續做對的運動會累積時間。</p>
            
            <div class="alternating-arm-swing-info">
                <div class="timer-display">
                    <div class="timer-row">
                        <span class="timer-label">目標時間:</span>
                        <div class="timer-input-group">
                            <input type="number" id="target-time-input" min="10" max="300" value="30" step="5">
                            <span class="timer-unit">秒</span>
                        </div>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">累積時間:</span>
                        <span id="accumulated-time" class="timer-value">0.0</span>
                        <span class="timer-unit">秒</span>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">完成進度:</span>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="timer-progress-fill"></div>
                            </div>
                            <span id="timer-progress-text" class="progress-text">0%</span>
                        </div>
                    </div>
                </div>
                <div class="motion-status">
                    <div class="status-row">
                        <span class="status-label">動作狀態:</span>
                        <span id="motion-status" class="status-value">等待檢測</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">左手狀態:</span>
                        <span id="left-arm-status" class="status-value">-</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">右手狀態:</span>
                        <span id="right-arm-status" class="status-value">-</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">輪流擺動:</span>
                        <span id="alternating-status" class="status-value">-</span>
                    </div>
                </div>
            </div>
        `;
        
        // 更新標題
        const headerText = document.getElementById('arm-swing-header-text');
        if (headerText) {
            headerText.textContent = '雙手輪流擺動熱身控制';
        }
    }
    
    /**
     * 載入平板支撐訓練內容
     */
    loadPlankContent() {
        const dynamicContent = document.getElementById('plank-dynamic-content');
        if (!dynamicContent) return;
        
        dynamicContent.innerHTML = `
            <button type="button" id="reset-plank" class="btn btn-warning">重置檢測</button>
            <p class="exercise-description">請保持平板支撐姿勢，身體保持一直線。維持正確姿勢會累積時間。</p>
            
            <div class="plank-info">
                <div class="timer-display">
                    <div class="timer-row">
                        <span class="timer-label">目標描述:</span>
                        <div class="timer-input-group">
                            <input type="text" id="plank-target-description" placeholder="輸入您的目標描述" value="保持平板支撐30秒，提升核心肌群力量">
                        </div>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">目標時間:</span>
                        <div class="timer-input-group">
                            <input type="number" id="plank-target-time-input" min="10" max="300" value="30" step="5">
                            <span class="timer-unit">秒</span>
                        </div>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">累積時間:</span>
                        <span id="plank-accumulated-time" class="timer-value">0.0</span>
                        <span class="timer-unit">秒</span>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">完成進度:</span>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="plank-timer-progress-fill"></div>
                            </div>
                            <span id="plank-timer-progress-text" class="progress-text">0%</span>
                        </div>
                    </div>
                </div>
                <div class="motion-status">
                    <div class="status-row">
                        <span class="status-label">姿勢狀態:</span>
                        <span id="plank-pose-status" class="status-value">等待檢測</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">姿勢品質:</span>
                        <span id="plank-pose-quality" class="status-value">-</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">身體角度:</span>
                        <span id="plank-body-angle" class="status-value">-</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">穩定性:</span>
                        <span id="plank-stability" class="status-value">-</span>
                    </div>
                </div>
            </div>
        `;
        
        // 更新標題
        const headerText = document.getElementById('plank-header-text');
        if (headerText) {
            headerText.textContent = '平板支撐控制';
        }
    }
    
    /**
     * 添加模式切換按鈕
     */
    addModeToggleButton() {
        const dynamicContent = document.getElementById('arm-swing-dynamic-content');
        if (!dynamicContent) return;
        
        // 在內容前添加切換按鈕
        const toggleButton = document.createElement('div');
        toggleButton.className = 'mode-toggle-container';
        toggleButton.innerHTML = `
            <button type="button" id="toggle-defense-mode" class="btn btn-info mode-toggle-btn">
                <i class="fas fa-shield-alt"></i> 切換到持續抵擋模式
            </button>
        `;
        
        dynamicContent.insertBefore(toggleButton, dynamicContent.firstChild);
        
        // 綁定切換事件
        const toggleBtn = document.getElementById('toggle-defense-mode');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleToDefenseMode();
            });
        }
    }
    
    /**
     * 切換到持續抵擋模式
     */
    toggleToDefenseMode() {
        // 停止當前檢測（如果正在進行）
        if (this.isDetecting) {
            this.stopDetection();
        }
        
        // 載入持續抵擋模式內容
        if (window.continuousDefenseMode) {
            window.continuousDefenseMode.loadDefenseContent();
        }
        
        console.log('切換到持續抵擋模式');
    }
    
    /**
     * 切換回普通訓練模式
     */
    toggleToNormalMode() {
        // 停止持續抵擋模式（如果正在運行）
        if (window.continuousDefenseMode && window.continuousDefenseMode.isActive) {
            window.continuousDefenseMode.stopMode();
        }
        
        // 重新載入普通訓練內容
        this.loadNormalTrainingContent();
        this.addModeToggleButton();
        
        console.log('切換回普通訓練模式');
    }

    /**
     * 更新教練提示
     */
    updateCoachTip() {
        const exerciseConfig = this.exerciseTypes[this.currentExerciseType];
        if (!exerciseConfig) return;
        
        const coachTipElement = document.getElementById('coach-tip');
        if (coachTipElement && exerciseConfig.tips.length > 0) {
            const randomTip = exerciseConfig.tips[Math.floor(Math.random() * exerciseConfig.tips.length)];
            coachTipElement.textContent = randomTip;
        }
    }

    /**
     * 更新運動參數
     */
    updateParameters() {
        const weightInput = document.getElementById('weight');
        const repsInput = document.getElementById('reps');
        const setsInput = document.getElementById('sets');
        
        const newParams = {
            weight: weightInput ? parseFloat(weightInput.value) || 0 : 0,
            reps: repsInput ? parseInt(repsInput.value) || 10 : 10,
            sets: setsInput ? parseInt(setsInput.value) || 3 : 3,
            completedSets: this.exerciseParams.completedSets
        };
        
        // 檢查是否有變更
        const hasChanged = JSON.stringify(this.exerciseParams) !== JSON.stringify(newParams);
        
        if (hasChanged) {
            this.exerciseParams = newParams;
            console.log('運動參數更新:', this.exerciseParams);
            
            // 觸發回調
            if (this.callbacks.onParametersChanged) {
                this.callbacks.onParametersChanged(this.exerciseParams);
            }
        }
    }

    /**
     * 設置運球模式
     */
    setDribbleMode(enabled) {
        if (this.dribbleMode !== enabled) {
            this.dribbleMode = enabled;
            console.log(`運球模式: ${enabled ? '開啟' : '關閉'}`);
            
            // 更新 UI
            this.updateDribbleModeDisplay();
            
            // 觸發回調
            if (this.callbacks.onDribbleModeChanged) {
                this.callbacks.onDribbleModeChanged(enabled);
            }
        }
    }

    /**
     * 更新運球模式顯示
     */
    updateDribbleModeDisplay() {
        const dribbleModeElement = document.getElementById('dribble-mode-status');
        if (dribbleModeElement) {
            dribbleModeElement.textContent = this.dribbleMode ? '運球模式：開啟' : '運球模式：關閉';
            dribbleModeElement.className = this.dribbleMode ? 'dribble-mode-on' : 'dribble-mode-off';
        }
        
        const toggleElement = document.getElementById('dribble-mode-toggle');
        if (toggleElement) {
            toggleElement.checked = this.dribbleMode;
        }
    }

    /**
     * 完成一組訓練
     */
    completeSet() {
        if (this.exerciseParams.completedSets < this.exerciseParams.sets) {
            this.exerciseParams.completedSets++;
            console.log(`完成第 ${this.exerciseParams.completedSets} 組訓練`);
            
            // 觸發回調
            if (this.callbacks.onParametersChanged) {
                this.callbacks.onParametersChanged(this.exerciseParams);
            }
            
            return this.exerciseParams.completedSets >= this.exerciseParams.sets;
        }
        return false;
    }

    /**
     * 重置訓練進度
     */
    resetProgress() {
        this.exerciseParams.completedSets = 0;
        console.log('重置訓練進度');
        
        // 觸發回調
        if (this.callbacks.onParametersChanged) {
            this.callbacks.onParametersChanged(this.exerciseParams);
        }
    }

    /**
     * 獲取運動名稱
     */
    getExerciseName(exerciseType = null) {
        const type = exerciseType || this.currentExerciseType;
        const config = this.exerciseTypes[type];
        return config ? config.name : '未知運動';
    }

    /**
     * 獲取運動描述
     */
    getExerciseDescription(exerciseType = null) {
        const type = exerciseType || this.currentExerciseType;
        const config = this.exerciseTypes[type];
        return config ? config.description : '';
    }

    /**
     * 獲取運動提示
     */
    getExerciseTips(exerciseType = null) {
        const type = exerciseType || this.currentExerciseType;
        const config = this.exerciseTypes[type];
        return config ? config.tips : [];
    }

    /**
     * 獲取當前運動狀態
     */
    getExerciseState() {
        return {
            currentExerciseType: this.currentExerciseType,
            isDetecting: this.isDetecting,
            detectionLine: this.detectionLine,
            dribbleMode: this.dribbleMode,
            exerciseParams: { ...this.exerciseParams },
            exerciseName: this.getExerciseName(),
            exerciseDescription: this.getExerciseDescription(),
            exerciseTips: this.getExerciseTips()
        };
    }

    /**
     * 設置事件回調
     */
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
    
    /**
     * 獲取當前雙手輪流擺動模式
     */
    getCurrentArmSwingMode() {
        const modeSelect = document.getElementById('arm-swing-mode-select');
        return modeSelect ? modeSelect.value : 'normal';
    }
    
    /**
     * 設置雙手輪流擺動模式
     */
    setArmSwingMode(mode) {
        const modeSelect = document.getElementById('arm-swing-mode-select');
        if (modeSelect && (mode === 'normal' || mode === 'defense')) {
            modeSelect.value = mode;
            this.switchArmSwingMode(mode);
        }
    }

    /**
     * 獲取偵測請求數據
     */
    getDetectionRequestData(studentId = null) {
        let description = this.getExerciseDescription(); // 預設運動描述
        let targetTime = null;
        
        // 如果是平板支撐，嘗試獲取用戶自定義的目標描述和目標時間
        if (this.currentExerciseType === 'plank') {
            const targetDescriptionInput = document.getElementById('plank-target-description');
            if (targetDescriptionInput && targetDescriptionInput.value.trim()) {
                description = targetDescriptionInput.value.trim();
            }
            
            // 獲取目標時間
            const targetTimeInput = document.getElementById('plank-target-time-input');
            if (targetTimeInput && targetTimeInput.value) {
                targetTime = parseInt(targetTimeInput.value) || 30;
            }
        }
        
        const requestData = {
            exercise_type: this.currentExerciseType,
            detection_line: this.detectionLine,
            student_id: studentId,
            weight: this.exerciseParams.weight,
            reps: this.exerciseParams.reps,
            sets: this.exerciseParams.sets,
            dribble_mode: this.dribbleMode,
            description: description // 使用目標描述或運動描述
        };
        
        // 如果是平板支撐且有目標時間，添加到請求數據中
        if (this.currentExerciseType === 'plank' && targetTime !== null) {
            requestData.target_time = targetTime;
        }
        
        return requestData;
    }

    /**
     * 檢查是否為籃球相關運動
     */
    isBasketballExercise(exerciseType = null) {
        const type = exerciseType || this.currentExerciseType;
        return type === 'basketball' || type === 'basketball_dribble';
    }

    /**
     * 檢查是否為桌球運動
     */
    isTableTennisExercise(exerciseType = null) {
        const type = exerciseType || this.currentExerciseType;
        return type === 'tabletennis';
    }

    /**
     * 獲取所有可用的運動類型
     */
    getAllExerciseTypes() {
        return Object.keys(this.exerciseTypes).map(key => ({
            value: key,
            name: this.exerciseTypes[key].name,
            description: this.exerciseTypes[key].description
        }));
    }
}

// 導出 ExerciseManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseManager;
} else {
    window.ExerciseManager = ExerciseManager;
}