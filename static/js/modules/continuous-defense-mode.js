/**
 * Continuous Defense Mode Module
 * 持續抵擋模式 - 怪物持續攻擊，玩家需要通過雙手輪流擺動維持護盾
 */

class ContinuousDefenseMode {
    constructor(config = {}) {
        // 模式配置
        this.config = {
            targetTime: config.targetTime || 60, // 目標時間（秒）
            monsterAttackInterval: config.monsterAttackInterval || 2000, // 怪物攻擊間隔（毫秒）
            monsterDamage: config.monsterDamage || 15, // 怪物攻擊傷害
            shieldRepairRate: config.shieldRepairRate || 10, // 護盾修復速度
            shieldRepairInterval: config.shieldRepairInterval || 3000, // 護盾修復間隔（毫秒）
            maxShield: config.maxShield || 100, // 最大護盾值
            maxHP: config.maxHP || 100 // 最大血量
        };
        
        // 遊戲狀態
        this.gameState = {
            isActive: false,
            startTime: null,
            elapsedTime: 0,
            isCompleted: false,
            isGameOver: false
        };
        
        // 玩家狀態
        this.player = {
            hp: this.config.maxHP,
            shield: this.config.maxShield,
            maxHP: this.config.maxHP,
            maxShield: this.config.maxShield,
            isExercising: false,
            lastExerciseTime: 0,
            lastShieldRepairTime: 0,
            exerciseQuality: 0,
            exerciseCount: 0
        };
        
        // 怪物狀態
        this.monster = {
            isAttacking: false,
            attackTimer: null,
            position: { x: 0, y: 0 },
            targetPosition: { x: 0, y: 0 },
            isMoving: false,
            attackCount: 0
        };
        
        // UI 元素
        this.elements = {
            modePanel: null,
            timerDisplay: null,
            shieldBar: null,
            hpBar: null,
            monsterContainer: null,
            startButton: null,
            stopButton: null
        };
        
        // 事件回調
        this.callbacks = {
            onModeStart: config.onModeStart || null,
            onModeEnd: config.onModeEnd || null,
            onPlayerDamaged: config.onPlayerDamaged || null,
            onShieldRepaired: config.onShieldRepaired || null,
            onVictory: config.onVictory || null,
            onDefeat: config.onDefeat || null
        };
        
        // 動畫和效果
        this.effects = {
            monsterAttackEffect: null,
            shieldRepairEffect: null,
            damageEffect: null
        };
        
        // Socket 管理
        this.socketListenersSetup = false;
        this.socketRetryCount = 0;
        this.maxSocketRetries = 5;
        
        this.init();
    }
    
    /**
     * 初始化模式
     */
    init() {
        console.log('初始化持續抵擋模式');
        this.createUI();
        this.bindEvents();
    }
    
    /**
     * 創建UI界面
     */
    createUI() {
        // 創建模式控制面板（保留原有功能以防需要）
        // this.createModePanel();
        
        // 創建遊戲狀態顯示
        this.createGameStatusDisplay();
        
        // 獲取現有元素引用
        this.elements.monsterContainer = document.getElementById('monster-container');
    }
    
    /**
     * 載入持續抵擋模式內容到動態表單
     */
    loadDefenseContent() {
        const dynamicContent = document.getElementById('arm-swing-dynamic-content');
        if (!dynamicContent) {
            console.error('找不到動態內容容器');
            return;
        }
        
        dynamicContent.innerHTML = `
            <div class="mode-toggle-container">
                <button type="button" id="toggle-normal-mode" class="btn btn-secondary mode-toggle-btn">
                    <i class="fas fa-dumbbell"></i> 切換回普通訓練
                </button>
            </div>
            
            <div class="defense-description">
                <i class="fas fa-shield-alt"></i>
                <span>怪物會持續攻擊，通過雙手輪流擺動維持護盾！</span>
            </div>
            
            <div class="defense-settings">
                <div class="setting-group">
                    <label for="defense-target-time">目標時間（秒）:</label>
                    <input type="number" id="defense-target-time" min="30" max="300" value="30" step="10">
                </div>
                
                <div class="setting-group">
                    <label for="monster-attack-speed">怪物攻擊速度:</label>
                    <select id="monster-attack-speed">
                        <option value="3000">慢速（3秒）</option>
                        <option value="2000" selected>中速（2秒）</option>
                        <option value="1500">快速（1.5秒）</option>
                        <option value="1000">瘋狂（1秒）</option>
                    </select>
                </div>
            </div>
            
            <div class="defense-status">
                <div class="status-row">
                    <div class="status-item">
                        <span class="status-label">剩餘時間:</span>
                        <span id="defense-remaining-time" class="status-value">30</span>秒
                    </div>
                    <div class="status-item">
                        <span class="status-label">護盾值:</span>
                        <span id="defense-shield-value" class="status-value">100</span>/100
                    </div>
                </div>
                
                <div class="status-row">
                    <div class="status-item">
                        <span class="status-label">血量:</span>
                        <span id="defense-hp-value" class="status-value">100</span>/100
                    </div>
                    <div class="status-item">
                        <span class="status-label">怪物攻擊次數:</span>
                        <span id="monster-attack-count" class="status-value">0</span>
                    </div>
                </div>
            </div>
            
            <div class="defense-controls">
                <button id="start-defense-mode" class="btn btn-primary defense-btn">
                    <i class="fas fa-play"></i> 開始抵擋
                </button>
                <button id="stop-defense-mode" class="btn btn-secondary defense-btn" disabled>
                    <i class="fas fa-stop"></i> 停止模式
                </button>
            </div>
        `;
        
        // 更新標題
        const headerText = document.getElementById('arm-swing-header-text');
        if (headerText) {
            headerText.innerHTML = '<i class="fas fa-shield-alt"></i> 持續抵擋模式';
        }
        
        // 綁定切換回普通模式的事件
        const toggleBtn = document.getElementById('toggle-normal-mode');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (window.exerciseManager) {
                    window.exerciseManager.toggleToNormalMode();
                }
            });
        }
        
        // 重新綁定持續抵擋模式的事件
        this.bindDefenseEvents();
        
        // 同步設置到新的 UI 元素
        this.syncSettingsToUI();
        
        console.log('持續抵擋模式內容載入完成');
    }
    
    /**
     * 創建模式控制面板
     */
    createModePanel() {
        const existingPanel = document.getElementById('continuous-defense-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'continuous-defense-panel';
        panel.className = 'continuous-defense-panel';
        panel.innerHTML = `
            <div class="mode-panel-header">
                <h3><i class="fas fa-shield-alt"></i> 持續抵擋模式</h3>
                <div class="mode-description">怪物會持續攻擊，通過雙手輪流擺動維持護盾！</div>
            </div>
            
            <div class="mode-panel-body">
                <div class="mode-settings">
                    <div class="setting-group">
                        <label for="defense-target-time">目標時間（秒）:</label>
                        <input type="number" id="defense-target-time" min="30" max="300" value="30" step="10">
                    </div>
                    
                    <div class="setting-group">
                        <label for="monster-attack-speed">怪物攻擊速度:</label>
                        <select id="monster-attack-speed">
                            <option value="3000">慢速（3秒）</option>
                            <option value="2000" selected>中速（2秒）</option>
                            <option value="1500">快速（1.5秒）</option>
                            <option value="1000">瘋狂（1秒）</option>
                        </select>
                    </div>
                </div>
                
                <div class="mode-status">
                    <div class="status-row">
                        <div class="status-item">
                            <span class="status-label">剩餘時間:</span>
                            <span id="defense-remaining-time" class="status-value">30</span>秒
                        </div>
                        <div class="status-item">
                            <span class="status-label">護盾值:</span>
                            <span id="defense-shield-value" class="status-value">100</span>/100
                        </div>
                    </div>
                    
                    <div class="status-row">
                        <div class="status-item">
                            <span class="status-label">血量:</span>
                            <span id="defense-hp-value" class="status-value">100</span>/100
                        </div>
                        <div class="status-item">
                            <span class="status-label">怪物攻擊次數:</span>
                            <span id="monster-attack-count" class="status-value">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="mode-controls">
                    <button id="start-defense-mode" class="button primary">
                        <i class="fas fa-play"></i> 開始抵擋
                    </button>
                    <button id="stop-defense-mode" class="button secondary" disabled>
                        <i class="fas fa-stop"></i> 停止模式
                    </button>
                </div>
            </div>
        `;
        
        // 添加到雙手輪流擺動控制面板下方
        const armSwingControls = document.getElementById('alternating-arm-swing-controls');
        if (armSwingControls) {
            armSwingControls.parentNode.insertBefore(panel, armSwingControls.nextSibling);
        } else {
            // 如果找不到，添加到表單末尾
            const form = document.getElementById('workout-form');
            if (form) {
                form.appendChild(panel);
            }
        }
    }
    
    /**
     * 創建遊戲狀態顯示
     */
    createGameStatusDisplay() {
        // 在視頻覆蓋層添加模式狀態顯示
        const videoOverlay = document.querySelector('.video-overlay');
        if (videoOverlay) {
            const statusDisplay = document.createElement('div');
            statusDisplay.id = 'defense-mode-status';
            statusDisplay.className = 'defense-mode-status';
            statusDisplay.style.display = 'none';
            statusDisplay.innerHTML = `
                <div class="defense-status-header">
                    <h4><i class="fas fa-shield-alt"></i> 持續抵擋模式</h4>
                    <div class="defense-timer">
                        <span id="defense-timer-display">30</span>秒
                    </div>
                </div>
                
                <div class="defense-progress-bars">
                    <div class="defense-bar-container">
                        <div class="defense-bar-label">護盾</div>
                        <div class="defense-progress-bar">
                            <div class="defense-progress-fill shield-fill" id="defense-shield-bar"></div>
                        </div>
                        <div class="defense-bar-value">
                            <span id="defense-shield-text">100</span>/100
                        </div>
                    </div>
                    
                    <div class="defense-bar-container">
                        <div class="defense-bar-label">血量</div>
                        <div class="defense-progress-bar">
                            <div class="defense-progress-fill hp-fill" id="defense-hp-bar"></div>
                        </div>
                        <div class="defense-bar-value">
                            <span id="defense-hp-text">100</span>/100
                        </div>
                    </div>
                </div>
            `;
            
            videoOverlay.appendChild(statusDisplay);
        }
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 由於現在使用動態內容載入，事件綁定將在 loadDefenseContent 中處理
        console.log('事件綁定將在動態內容載入時處理');
        
        // 設置 socket 事件監聽器
        this.setupSocketListeners();
    }
    
    /**
     * 設置 Socket 事件監聽器
     */
    setupSocketListeners() {
        // 如果已經設置過監聽器，則不重複設置
        if (this.socketListenersSetup) {
            return;
        }
        
        // 檢查是否有 socket 連接
        if (window.socket) {
            console.log('設置持續抵擋模式的 socket 事件監聽器');
            
            // 創建 exercise namespace 的 socket 連接
            const exerciseSocket = io('/exercise');
            
            // 監聽運動完成事件（從 /exercise namespace）
            exerciseSocket.on('exercise_completed', (data) => {
                console.log('收到運動完成事件:', data);
                this.handleExerciseCompleted(data);
            });
            
            // 監聽計時器更新事件（從 /exercise namespace）
            exerciseSocket.on('timer_update', (data) => {
                console.log('收到計時器更新:', data);
                this.handleTimerUpdate(data);
            });
            
            // 保存 exercise socket 引用
            this.exerciseSocket = exerciseSocket;
            
            // 標記為已設置
            this.socketListenersSetup = true;
            this.socketRetryCount = 0;
        } else {
            this.socketRetryCount++;
            
            if (this.socketRetryCount <= this.maxSocketRetries) {
                console.warn(`Socket 未初始化，第 ${this.socketRetryCount} 次重試...`);
                // 延遲重試
                setTimeout(() => {
                    this.setupSocketListeners();
                }, 1000);
            } else {
                console.error('Socket 初始化失敗，已達到最大重試次數');
            }
        }
    }
    
    /**
     * 處理運動完成事件
     */
    handleExerciseCompleted(data) {
        if (!this.gameState.isActive) {
            console.log('遊戲未激活，忽略運動完成事件');
            return;
        }
        
        console.log('處理運動完成事件 - 玩家勝利！', data);
        
        // 標記為完成
        this.gameState.isCompleted = true;
        
        // 觸發勝利處理
        this.handleVictory();
        
        // 顯示完成訊息
        if (window.showNotification) {
            window.showNotification(data.message || '恭喜！您已完成雙手輪流擺動熱身運動！', 'success');
        }
    }
    
    /**
     * 處理計時器更新事件
     */
    handleTimerUpdate(data) {
        if (!this.gameState.isActive) return;
        
        console.log('處理計時器更新:', data);
        
        // 更新遊戲狀態中的時間
        if (data.accumulated_time !== undefined) {
            this.gameState.elapsedTime = data.accumulated_time * 1000; // 轉換為毫秒
        }
        
        // 檢查是否完成
        if (data.completed) {
            console.log('根據計時器更新檢測到完成');
            this.handleExerciseCompleted({
                message: '恭喜！您已完成目標時間的運動！',
                accumulated_time: data.accumulated_time,
                target_time: data.target_time
            });
        }
        
        // 更新 UI
        this.updateUI();
    }
    
    /**
     * 綁定持續抵擋模式事件（用於動態載入的內容）
     */
    bindDefenseEvents() {
        // 開始按鈕
        const startButton = document.getElementById('start-defense-mode');
        if (startButton && !startButton.hasAttribute('data-defense-bound')) {
            startButton.addEventListener('click', () => this.startMode());
            startButton.setAttribute('data-defense-bound', 'true');
        }
        
        // 停止按鈕
        const stopButton = document.getElementById('stop-defense-mode');
        if (stopButton && !stopButton.hasAttribute('data-defense-bound')) {
            stopButton.addEventListener('click', () => this.stopMode());
            stopButton.setAttribute('data-defense-bound', 'true');
        }
        
        // 設置變更事件
        const targetTimeInput = document.getElementById('defense-target-time');
        if (targetTimeInput && !targetTimeInput.hasAttribute('data-defense-bound')) {
            targetTimeInput.addEventListener('change', (e) => {
                this.config.targetTime = parseInt(e.target.value);
                this.updateUI();
            });
            targetTimeInput.setAttribute('data-defense-bound', 'true');
        }
        
        const attackSpeedSelect = document.getElementById('monster-attack-speed');
        if (attackSpeedSelect && !attackSpeedSelect.hasAttribute('data-defense-bound')) {
            attackSpeedSelect.addEventListener('change', (e) => {
                this.config.monsterAttackInterval = parseInt(e.target.value);
            });
            attackSpeedSelect.setAttribute('data-defense-bound', 'true');
        }
    }
    
    /**
     * 同步設置到UI元素
     */
    syncSettingsToUI() {
        // 同步目標時間
        const targetTimeInput = document.getElementById('defense-target-time');
        if (targetTimeInput) {
            targetTimeInput.value = this.config.targetTime;
        }
        
        // 同步攻擊速度
        const attackSpeedSelect = document.getElementById('monster-attack-speed');
        if (attackSpeedSelect) {
            attackSpeedSelect.value = this.config.monsterAttackInterval;
        }
        
        // 更新狀態顯示
        this.updateUI();
    }
    
    /**
     * 綁定獨立面板事件
     */
    bindStandaloneEvents() {
        // 開始按鈕
        const startButton = document.getElementById('start-defense-mode');
        if (startButton) {
            startButton.addEventListener('click', () => this.startMode());
        }
        
        // 停止按鈕
        const stopButton = document.getElementById('stop-defense-mode');
        if (stopButton) {
            stopButton.addEventListener('click', () => this.stopMode());
        }
        
        // 設置變更事件
        const targetTimeInput = document.getElementById('defense-target-time');
        if (targetTimeInput) {
            targetTimeInput.addEventListener('change', (e) => {
                this.config.targetTime = parseInt(e.target.value);
                this.updateUI();
            });
        }
        
        const attackSpeedSelect = document.getElementById('monster-attack-speed');
        if (attackSpeedSelect) {
            attackSpeedSelect.addEventListener('change', (e) => {
                this.config.monsterAttackInterval = parseInt(e.target.value);
            });
        }
    }
    
    /**
     * 綁定統一面板事件
     */
    bindIntegratedEvents() {
        // 統一面板的開始按鈕（與獨立面板共用同一個按鈕）
        const integratedStartButton = document.getElementById('start-defense-mode');
        if (integratedStartButton && !integratedStartButton.hasAttribute('data-integrated-bound')) {
            integratedStartButton.addEventListener('click', () => this.startMode());
            integratedStartButton.setAttribute('data-integrated-bound', 'true');
        }
        
        // 統一面板的停止按鈕（與獨立面板共用同一個按鈕）
        const integratedStopButton = document.getElementById('stop-defense-mode');
        if (integratedStopButton && !integratedStopButton.hasAttribute('data-integrated-bound')) {
            integratedStopButton.addEventListener('click', () => this.stopMode());
            integratedStopButton.setAttribute('data-integrated-bound', 'true');
        }
        
        // 統一面板的設置變更事件
        const integratedTargetTimeInput = document.getElementById('defense-target-time');
        if (integratedTargetTimeInput && !integratedTargetTimeInput.hasAttribute('data-integrated-bound')) {
            integratedTargetTimeInput.addEventListener('change', (e) => {
                this.config.targetTime = parseInt(e.target.value);
                this.updateUI();
            });
            integratedTargetTimeInput.setAttribute('data-integrated-bound', 'true');
        }
        
        const integratedAttackSpeedSelect = document.getElementById('monster-attack-speed');
        if (integratedAttackSpeedSelect && !integratedAttackSpeedSelect.hasAttribute('data-integrated-bound')) {
            integratedAttackSpeedSelect.addEventListener('change', (e) => {
                this.config.monsterAttackInterval = parseInt(e.target.value);
            });
            integratedAttackSpeedSelect.setAttribute('data-integrated-bound', 'true');
        }
    }
    
    /**
     * 初始化統一面板模式
     */
    initializeIntegratedMode() {
        console.log('初始化統一面板的持續抵擋模式');
        
        // 確保統一面板的事件已綁定
        this.bindIntegratedEvents();
        
        // 同步設置值到統一面板
        this.syncSettingsToIntegratedPanel();
        
        // 更新統一面板的UI
        this.updateIntegratedUI();
        
        console.log('統一面板的持續抵擋模式初始化完成');
    }
    
    /**
     * 同步設置到統一面板
     */
    syncSettingsToIntegratedPanel() {
        // 同步目標時間
        const integratedTargetTimeInput = document.getElementById('defense-target-time');
        if (integratedTargetTimeInput) {
            integratedTargetTimeInput.value = this.config.targetTime;
        }
        
        // 同步攻擊速度
        const integratedAttackSpeedSelect = document.getElementById('monster-attack-speed');
        if (integratedAttackSpeedSelect) {
            integratedAttackSpeedSelect.value = this.config.monsterAttackInterval;
        }
    }
    
    /**
     * 更新統一面板UI
     */
    updateIntegratedUI() {
        // 更新剩餘時間（統一面板與獨立面板共用相同元素）
        const integratedRemainingTime = document.getElementById('defense-remaining-time');
        if (integratedRemainingTime) {
            const remainingTime = this.gameState.isActive ? 
                Math.max(0, this.config.targetTime - Math.floor(this.gameState.elapsedTime / 1000)) : 
                this.config.targetTime;
            integratedRemainingTime.textContent = remainingTime;
        }
        
        // 更新護盾值（統一面板與獨立面板共用相同元素）
        const integratedShieldValue = document.getElementById('defense-shield-value');
        if (integratedShieldValue) {
            integratedShieldValue.textContent = Math.round(this.player.shield);
        }
        
        // 更新血量（統一面板與獨立面板共用相同元素）
        const integratedHpValue = document.getElementById('defense-hp-value');
        if (integratedHpValue) {
            integratedHpValue.textContent = Math.round(this.player.hp);
        }
        
        // 更新怪物攻擊次數（統一面板與獨立面板共用相同元素）
        const integratedAttackCount = document.getElementById('monster-attack-count');
        if (integratedAttackCount) {
            integratedAttackCount.textContent = this.monster.attackCount;
        }
        
        // 更新按鈕狀態（統一面板與獨立面板共用相同按鈕）
        const integratedStartButton = document.getElementById('start-defense-mode');
        const integratedStopButton = document.getElementById('stop-defense-mode');
        
        if (integratedStartButton && integratedStopButton) {
            integratedStartButton.disabled = this.gameState.isActive;
            integratedStopButton.disabled = !this.gameState.isActive;
        }
    }
    
    /**
     * 開始模式
     */
    async startMode() {
        console.log('開始持續抵擋模式');
        
        try {
            // 首先啟動主要的運動檢測系統
            if (window.socket && !window.isDetecting) {
                console.log('啟動運動檢測系統...');
                
                // 確保運動類型設置為雙手輪流擺動
                if (window.exerciseManager) {
                    window.exerciseManager.switchExercise('alternating-arm-swing');
                }
                
                // 啟動檢測
                window.socket.emit('start_detection', {
                    exercise_type: 'alternating-arm-swing',
                    camera_index: parseInt(document.getElementById('camera-select')?.value || '0'),
                    detection_line: 300
                });
                
                window.isDetecting = true;
            }
            
            // 創建後端會話
            const sessionResult = await this.apiCreateSession();
            if (!sessionResult.success) {
                throw new Error(sessionResult.error || '創建會話失敗');
            }
            
            this.sessionId = sessionResult.session_id;
            console.log('會話創建成功:', this.sessionId);
            
            // 啟動遊戲
            const startResult = await this.apiStartGame();
            if (!startResult.success) {
                throw new Error(startResult.error || '啟動遊戲失敗');
            }
            
            // 重置狀態
            this.resetGameState();
            
            // 設置遊戲狀態
            this.gameState.isActive = true;
            this.gameState.startTime = Date.now();
            this.lastUpdateTime = Date.now();
            
            // 重置玩家狀態
            this.player.hp = this.config.maxHP;
            this.player.shield = this.config.maxShield;
            
            // 重置怪物狀態
            this.monster.attackCount = 0;
            
            // 更新UI
            this.updateUI();
            this.showModeStatus();
            
            // 暫停原有的怪物攻擊系統
            if (window.monsterAttackSystem) {
                console.log('暫停原有怪物攻擊系統');
                window.monsterAttackSystem.pause();
            }
            
            // 開始遊戲循環
            this.startGameLoop();
            
            // 開始怪物攻擊
            this.startMonsterAttacks();
            
            // 開始怪物移動
            this.startMonsterMovement();
            
            // 更新按鈕狀態
            document.getElementById('start-defense-mode').disabled = true;
            document.getElementById('stop-defense-mode').disabled = false;
            
            // 觸發回調
            if (this.callbacks.onModeStart) {
                this.callbacks.onModeStart();
            }
            
            console.log('持續抵擋模式啟動成功');
            
        } catch (error) {
            console.error('啟動持續抵擋模式失敗:', error);
            alert('啟動失敗: ' + error.message);
            
            // 重置按鈕狀態
            document.getElementById('start-defense-mode').disabled = false;
            document.getElementById('stop-defense-mode').disabled = true;
        }
    }
    
    /**
     * 停止模式
     */
    async stopMode() {
        console.log('停止持續抵擋模式');
        
        try {
            // 停止遊戲狀態
            this.gameState.isActive = false;
            
            // 停止所有定時器
            this.stopGameLoop();
            this.stopMonsterAttacks();
            this.stopMonsterMovement();
            
            // 停止後端遊戲
            if (this.sessionId) {
                await this.apiStopGame();
            }
            
            // 停止主要的運動檢測系統
            if (window.socket && window.isDetecting) {
                console.log('停止運動檢測系統...');
                window.socket.emit('stop_detection');
                window.isDetecting = false;
            }
            
            // 恢復原有的怪物攻擊系統
            if (window.monsterAttackSystem) {
                console.log('恢復原有怪物攻擊系統');
                window.monsterAttackSystem.resume();
            }
            
            // 隱藏模式狀態
            this.hideModeStatus();
            
            // 更新按鈕狀態
            document.getElementById('start-defense-mode').disabled = false;
            document.getElementById('stop-defense-mode').disabled = true;
            
            // 觸發回調
             if (this.callbacks.onModeStop) {
                 this.callbacks.onModeStop();
             }
            
            console.log('持續抵擋模式停止成功');
            
        } catch (error) {
            console.error('停止持續抵擋模式失敗:', error);
        }
    }
    
    /**
     * 重置遊戲狀態
     */
    resetGameState() {
        this.gameState.isActive = false;
        this.gameState.startTime = null;
        this.gameState.elapsedTime = 0;
        this.gameState.isCompleted = false;
        this.gameState.isGameOver = false;
    }
    
    /**
     * 開始遊戲循環
     */
    startGameLoop() {
        this.gameLoopInterval = setInterval(() => {
            if (!this.gameState.isActive) return;
            
            this.updateGameState();
            this.updateUI();
            
            // 檢查勝利條件
            if (this.gameState.elapsedTime >= this.config.targetTime * 1000) {
                this.handleVictory();
            }
            
            // 檢查失敗條件
            if (this.player.hp <= 0) {
                this.handleDefeat();
            }
        }, 100); // 每100ms更新一次
    }
    
    /**
     * 停止遊戲循環
     */
    stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
    
    /**
     * 開始怪物攻擊
     */
    startMonsterAttacks() {
        this.monster.attackTimer = setInterval(() => {
            if (!this.gameState.isActive) return;
            
            this.executeMonsterAttack();
        }, this.config.monsterAttackInterval);
    }
    
    /**
     * 停止怪物攻擊
     */
    stopMonsterAttacks() {
        if (this.monster.attackTimer) {
            clearInterval(this.monster.attackTimer);
            this.monster.attackTimer = null;
        }
    }
    
    /**
     * 執行怪物攻擊
     */
    executeMonsterAttack() {
        console.log('怪物發動攻擊！');
        
        this.monster.attackCount++;
        
        // 顯示攻擊特效
        this.showMonsterAttackEffect();
        
        // 計算傷害
        let damage = this.config.monsterDamage;
        
        // 護盾吸收傷害
        if (this.player.shield > 0) {
            const shieldDamage = Math.min(damage, this.player.shield);
            this.player.shield -= shieldDamage;
            damage -= shieldDamage;
            
            console.log(`護盾吸收 ${shieldDamage} 點傷害，剩餘護盾: ${this.player.shield}`);
        }
        
        // 剩餘傷害作用於血量
        if (damage > 0) {
            this.player.hp = Math.max(0, this.player.hp - damage);
            console.log(`玩家受到 ${damage} 點傷害，剩餘血量: ${this.player.hp}`);
            
            // 顯示受傷效果
            this.showDamageEffect();
            
            // 觸發回調
            if (this.callbacks.onPlayerDamaged) {
                this.callbacks.onPlayerDamaged(damage, this.player.hp);
            }
        }
        
        this.updateUI();
    }
    
    /**
     * 開始怪物移動
     */
    startMonsterMovement() {
        // 設置隨機移動
        this.monsterMovementTimer = setInterval(() => {
            if (!this.gameState.isActive) return;
            
            this.moveMonsterRandomly();
        }, 3000); // 每3秒移動一次
    }
    
    /**
     * 停止怪物移動
     */
    stopMonsterMovement() {
        if (this.monsterMovementTimer) {
            clearInterval(this.monsterMovementTimer);
            this.monsterMovementTimer = null;
        }
    }
    
    /**
     * 隨機移動怪物
     */
    moveMonsterRandomly() {
        const container = this.elements.monsterContainer;
        if (!container) return;
        
        // 獲取容器尺寸
        const rect = container.getBoundingClientRect();
        const maxX = rect.width - 100; // 預留怪物寬度
        const maxY = rect.height - 100; // 預留怪物高度
        
        // 生成隨機位置
        const newX = Math.random() * maxX;
        const newY = Math.random() * maxY;
        
        // 應用移動動畫
        this.animateMonsterMovement(newX, newY);
    }
    
    /**
     * 怪物移動動畫
     */
    animateMonsterMovement(targetX, targetY) {
        const container = this.elements.monsterContainer;
        if (!container) return;
        
        // 添加移動類
        container.classList.add('monster-moving');
        
        // 計算移動方向和距離
        const currentTransform = container.style.transform || 'translate(0px, 0px)';
        const currentMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const currentX = currentMatch ? parseFloat(currentMatch[1]) : 0;
        const currentY = currentMatch ? parseFloat(currentMatch[2]) : 0;
        
        const deltaX = targetX - currentX;
        const deltaY = targetY - currentY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 根據距離調整動畫時間
        const animationTime = Math.min(Math.max(distance / 100, 0.3), 1.0) * 1000;
        
        // 應用變換
        container.style.transition = `transform ${animationTime}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        container.style.transform = `translate(${targetX}px, ${targetY}px)`;
        
        // 如果是大幅移動，添加追擊效果
        if (distance > 50) {
            container.classList.add('monster-charging');
            setTimeout(() => {
                container.classList.remove('monster-charging');
            }, animationTime);
        }
        
        // 移除移動類
        setTimeout(() => {
            container.classList.remove('monster-moving');
        }, animationTime);
        
        // 更新怪物位置
        this.monster.positionX = targetX;
        this.monster.positionY = targetY;
    }
    
    /**
     * 處理運動檢測
     */
    async handleExerciseDetection(exerciseData) {
        if (!this.gameState.isActive) return;
        
        const { type, quality, isCorrect } = exerciseData;
        
        // 只處理雙手輪流擺動
        if (type === 'alternating-arm-swing') {
            this.player.isExercising = isCorrect;
            this.player.lastExerciseTime = Date.now();
            this.player.exerciseQuality = quality || 5;
            
            // 發送運動數據到後端處理
            try {
                await this.apiProcessExercise({
                    exercise_type: type,
                    quality_score: quality,
                    is_correct: isCorrect,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('處理運動檢測失敗:', error);
            }
            
            // 如果運動正確，本地也進行護盾修復（作為即時反饋）
            if (isCorrect) {
                this.repairShield();
            }
        } else {
            this.player.isExercising = false;
        }
    }
    
    /**
     * 修復護盾（本地即時反饋）
     */
    repairShield() {
        const now = Date.now();
        
        // 檢查是否可以修復護盾（基於運動品質和時間間隔）
        if (!this.player.lastShieldRepairTime || 
            now - this.player.lastShieldRepairTime >= this.config.shieldRepairInterval) {
            
            const repairAmount = Math.floor(this.config.shieldRepairRate * (this.player.exerciseQuality / 10));
            const oldShield = this.player.shield;
            
            this.player.shield = Math.min(this.config.maxShield, this.player.shield + repairAmount);
            this.player.lastShieldRepairTime = now;
            
            if (this.player.shield > oldShield) {
                console.log(`護盾修復 ${repairAmount} 點，當前護盾: ${this.player.shield}`);
                
                // 顯示修復效果
                this.showShieldRepairEffect();
                
                // 觸發回調
                if (this.callbacks.onShieldRepaired) {
                    this.callbacks.onShieldRepaired(repairAmount, this.player.shield);
                }
                
                // 更新UI
                this.updateUI();
            }
        }
    }
    
    /**
     * 更新遊戲狀態
     */
    updateGameState() {
        if (!this.gameState.startTime) return;
        
        const now = Date.now();
        
        // 只有在正確運動時才累積時間
        if (this.player.isExercising && this.player.lastExerciseTime && 
            (now - this.player.lastExerciseTime) < 2000) { // 2秒內的運動才算有效
            
            // 計算自上次更新以來的時間差
            const timeDelta = now - (this.lastUpdateTime || this.gameState.startTime);
            
            // 累積有效運動時間
            this.gameState.elapsedTime += timeDelta;
        }
        
        // 更新最後更新時間
        this.lastUpdateTime = now;
    }
    
    /**
     * 更新UI
     */
    updateUI() {
        // 更新獨立面板UI
        this.updateStandaloneUI();
        
        // 更新統一面板UI
        this.updateIntegratedUI();
    }
    
    /**
     * 更新獨立面板UI
     */
    updateStandaloneUI() {
        // 更新剩餘時間
        const remainingTime = Math.max(0, this.config.targetTime - Math.floor(this.gameState.elapsedTime / 1000));
        const remainingTimeElement = document.getElementById('defense-remaining-time');
        if (remainingTimeElement) {
            remainingTimeElement.textContent = remainingTime;
        }
        
        const timerDisplay = document.getElementById('defense-timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = remainingTime;
        }
        
        // 更新護盾值
        const shieldValueElement = document.getElementById('defense-shield-value');
        if (shieldValueElement) {
            shieldValueElement.textContent = Math.round(this.player.shield);
        }
        
        const shieldTextElement = document.getElementById('defense-shield-text');
        if (shieldTextElement) {
            shieldTextElement.textContent = Math.round(this.player.shield);
        }
        
        // 更新護盾條
        const shieldBar = document.getElementById('defense-shield-bar');
        if (shieldBar) {
            const shieldPercentage = (this.player.shield / this.config.maxShield) * 100;
            shieldBar.style.width = `${shieldPercentage}%`;
        }
        
        // 更新血量
        const hpValueElement = document.getElementById('defense-hp-value');
        if (hpValueElement) {
            hpValueElement.textContent = Math.round(this.player.hp);
        }
        
        const hpTextElement = document.getElementById('defense-hp-text');
        if (hpTextElement) {
            hpTextElement.textContent = Math.round(this.player.hp);
        }
        
        // 更新血量條
        const hpBar = document.getElementById('defense-hp-bar');
        if (hpBar) {
            const hpPercentage = (this.player.hp / this.config.maxHP) * 100;
            hpBar.style.width = `${hpPercentage}%`;
        }
        
        // 更新攻擊次數
        const attackCountElement = document.getElementById('monster-attack-count');
        if (attackCountElement) {
            attackCountElement.textContent = this.monster.attackCount;
        }
    }
    
    /**
     * 顯示模式狀態
     */
    showModeStatus() {
        const statusDisplay = document.getElementById('defense-mode-status');
        if (statusDisplay) {
            statusDisplay.style.display = 'block';
        }
    }
    
    /**
     * 隱藏模式狀態
     */
    hideModeStatus() {
        const statusDisplay = document.getElementById('defense-mode-status');
        if (statusDisplay) {
            statusDisplay.style.display = 'none';
        }
    }
    
    /**
     * 顯示怪物攻擊特效
     */
    showMonsterAttackEffect() {
        const container = this.elements.monsterContainer;
        if (!container) return;
        
        // 根據攻擊次數決定特效強度
        const isCrazyAttack = this.monster.attackCount > 5;
        
        if (isCrazyAttack) {
            // 瘋狂攻擊模式
            container.classList.add('monster-crazy-attack');
            
            // 創建多個攻擊特效
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    this.createAttackEffect(container, true);
                }, i * 100);
            }
            
            // 移除瘋狂攻擊類
            setTimeout(() => {
                container.classList.remove('monster-crazy-attack');
            }, 1000);
        } else {
            // 普通攻擊
            this.createAttackEffect(container, false);
        }
        
        // 怪物追擊效果
        if (this.monster.attackCount > 3) {
            this.triggerMonsterCharge();
        }
    }
    
    createAttackEffect(container, isCrazy = false) {
        const effect = document.createElement('div');
        effect.className = 'monster-attack-effect';
        
        // 根據攻擊類型選擇圖標
        const icons = isCrazy ? 
            ['fas fa-fire', 'fas fa-bolt', 'fas fa-explosion', 'fas fa-skull'] :
            ['fas fa-bolt', 'fas fa-fist-raised'];
        
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        effect.innerHTML = `<i class="${randomIcon}"></i>`;
        
        // 隨機位置（稍微偏移）
        if (isCrazy) {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
            effect.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
        }
        
        container.appendChild(effect);
        
        // 動畫效果
        setTimeout(() => {
            effect.classList.add('attack-animation');
        }, 10);
        
        // 移除效果
        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, isCrazy ? 800 : 1000);
    }
    
    triggerMonsterCharge() {
        const container = this.elements.monsterContainer;
        if (!container) return;
        
        container.classList.add('monster-charging');
        
        setTimeout(() => {
            container.classList.remove('monster-charging');
        }, 800);
    }
    
    /**
     * 顯示護盾修復特效
     */
    showShieldRepairEffect() {
        // 創建修復特效
        const effect = document.createElement('div');
        effect.className = 'shield-repair-effect';
        effect.innerHTML = '<i class="fas fa-shield-alt"></i>';
        
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.appendChild(effect);
            
            // 動畫效果
            setTimeout(() => {
                effect.classList.add('repair-animation');
            }, 10);
            
            // 移除效果
            setTimeout(() => {
                if (effect.parentNode) {
                    effect.parentNode.removeChild(effect);
                }
            }, 1500);
        }
    }
    
    /**
     * 顯示受傷特效
     */
    showDamageEffect() {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.classList.add('damage-flash');
            
            setTimeout(() => {
                videoContainer.classList.remove('damage-flash');
            }, 500);
        }
    }
    
    /**
     * 處理勝利
     */
    handleVictory() {
        console.log('持續抵擋模式勝利！');
        
        this.gameState.isCompleted = true;
        this.gameState.isActive = false;
        
        // 停止所有計時器
        this.stopAllTimers();
        
        // 怪物爆炸效果
        this.triggerMonsterExplosion();
        
        // 延遲顯示勝利界面，讓爆炸動畫播放完
        setTimeout(() => {
            // 觸發勝利回調
            if (this.callbacks.onVictory) {
                this.callbacks.onVictory({
                    elapsedTime: this.gameState.elapsedTime,
                    finalHP: this.player.hp,
                    finalShield: this.player.shield,
                    exerciseCount: this.player.exerciseCount,
                    attacksSurvived: this.monster.attackCount
                });
            }
            
            // 顯示勝利界面
            this.showResultModal(true);
        }, 2000);
    }
    
    triggerMonsterExplosion() {
        const container = this.elements.monsterContainer;
        if (!container) return;
        
        // 添加爆炸類
        container.classList.add('monster-explosion');
        
        // 創建爆炸粒子
        this.createExplosionParticles(container);
        
        // 播放爆炸音效（如果有的話）
        this.playExplosionSound();
        
        // 清理爆炸效果
        setTimeout(() => {
            container.classList.remove('monster-explosion');
            // 隱藏怪物
            container.style.opacity = '0';
        }, 2000);
    }
    
    createExplosionParticles(container) {
        const particleCount = 8;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'explosion-particle';
            
            // 隨機顏色
            const colors = ['#ffeb3b', '#ff9800', '#ff5722', '#f44336', '#e91e63'];
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            
            // 隨機大小
            const size = Math.random() * 4 + 4;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            
            // 設置初始位置（怪物中心）
            particle.style.left = '50%';
            particle.style.top = '50%';
            particle.style.transform = 'translate(-50%, -50%)';
            
            container.appendChild(particle);
            
            // 移除粒子
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1500);
        }
    }
    
    playExplosionSound() {
        // 這裡可以添加音效播放邏輯
        // 例如：new Audio('/static/sounds/explosion.mp3').play();
        console.log('播放爆炸音效');
    }
    
    /**
     * 處理失敗
     */
    handleDefeat() {
        console.log('玩家失敗！');
        
        this.gameState.isGameOver = true;
        this.stopMode();
        
        // 顯示失敗界面
        this.showDefeatScreen();
        
        // 觸發回調
        if (this.callbacks.onDefeat) {
            this.callbacks.onDefeat({
                elapsedTime: this.gameState.elapsedTime,
                attacksSurvived: this.monster.attackCount
            });
        }
    }
    
    /**
     * 顯示勝利界面
     */
    showVictoryScreen() {
        const modal = this.createResultModal('victory', {
            title: '🎉 勝利！',
            message: '恭喜你成功抵擋了怪物的攻擊！',
            stats: {
                '存活時間': `${Math.floor(this.gameState.elapsedTime / 1000)}秒`,
                '剩餘血量': `${this.player.hp}/${this.config.maxHP}`,
                '剩餘護盾': `${this.player.shield}/${this.config.maxShield}`,
                '抵擋攻擊': `${this.monster.attackCount}次`
            }
        });
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    }
    
    /**
     * 顯示失敗界面
     */
    showDefeatScreen() {
        const modal = this.createResultModal('defeat', {
            title: '💀 失敗！',
            message: '你被怪物擊敗了，再試一次吧！',
            stats: {
                '存活時間': `${Math.floor(this.gameState.elapsedTime / 1000)}秒`,
                '目標時間': `${this.config.targetTime}秒`,
                '抵擋攻擊': `${this.monster.attackCount}次`
            }
        });
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    }
    
    /**
     * 創建結果模態框
     */
    createResultModal(type, data) {
        const modal = document.createElement('div');
        modal.className = `modal defense-result-modal ${type}-modal`;
        
        const statsHtml = Object.entries(data.stats)
            .map(([key, value]) => `<div class="stat-item"><span class="stat-label">${key}:</span><span class="stat-value">${value}</span></div>`)
            .join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${data.title}</h2>
                </div>
                <div class="modal-body">
                    <div class="result-message">${data.message}</div>
                    <div class="result-stats">
                        ${statsHtml}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="button secondary close-result-modal">關閉</button>
                    <button class="button primary restart-defense-mode">再試一次</button>
                </div>
            </div>
        `;
        
        // 綁定事件
        modal.querySelector('.close-result-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.restart-defense-mode').addEventListener('click', () => {
            modal.remove();
            this.startMode();
        });
        
        return modal;
    }
    
    /**
     * 停止所有計時器
     */
    stopAllTimers() {
        this.stopGameLoop();
        this.stopMonsterAttacks();
        this.stopMonsterMovement();
    }
    
    /**
     * 顯示結果模態框
     */
    showResultModal(isVictory) {
        if (isVictory) {
            this.showVictoryScreen();
        } else {
            this.showDefeatScreen();
        }
    }
    
    // API 整合方法
    async apiCreateSession(difficulty = 'normal') {
        try {
            const response = await fetch('/api/continuous-defense/create-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ difficulty })
            });
            
            const data = await response.json();
            if (data.success) {
                this.sessionId = data.data.session_id;
                
                // 更新本地配置
                const serverConfig = data.data.config;
                this.config = {
                    ...this.config,
                    targetTime: serverConfig.target_time,
                    monsterAttackInterval: serverConfig.monster_attack_interval,
                    monsterDamage: serverConfig.monster_damage,
                    shieldRepairRate: serverConfig.shield_repair_rate,
                    shieldRepairInterval: serverConfig.shield_repair_interval,
                    maxShield: serverConfig.max_shield,
                    maxHP: serverConfig.max_hp
                };
                
                // 更新玩家狀態
                this.player.maxHP = serverConfig.max_hp;
                this.player.hp = serverConfig.max_hp;
                this.player.maxShield = serverConfig.max_shield;
                this.player.shield = serverConfig.max_shield;
                
                console.log('會話創建成功:', this.sessionId, '配置:', this.config);
                return data.data;
            } else {
                throw new Error(data.error || '創建會話失敗');
            }
        } catch (error) {
            console.error('創建會話錯誤:', error);
            throw error;
        }
    }
    
    async apiProcessExercise(exerciseData) {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch('/api/continuous-defense/exercise-detection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    exercise_data: exerciseData
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // 更新本地狀態
                const serverState = data.data;
                this.syncWithServerState(serverState);
                
                // 檢查護盾修復事件
                const recentEvents = serverState.recent_events || [];
                const shieldRepairEvents = recentEvents.filter(event => 
                    event.type === 'shield_repair' && 
                    Date.now() - (event.timestamp * 1000) < 1000
                );
                
                // 顯示護盾修復特效
                if (shieldRepairEvents.length > 0) {
                    shieldRepairEvents.forEach(event => {
                        this.showShieldRepairEffect(event.data.repair_amount, event.data.combo);
                    });
                }
                
                return data.data;
            } else {
                console.error('處理運動數據失敗:', data.error);
            }
        } catch (error) {
            console.error('處理運動數據錯誤:', error);
        }
    }
    
    syncWithServerState(serverState) {
        // 同步玩家狀態
        const playerState = serverState.player_state;
        if (playerState) {
            const oldHP = this.player.hp;
            const oldShield = this.player.shield;
            
            this.player.hp = playerState.hp;
            this.player.shield = playerState.shield;
            this.player.exerciseCount = playerState.exercise_count;
            
            // 檢查是否受到傷害
            if (oldHP > this.player.hp) {
                this.showDamageEffect(oldHP - this.player.hp);
            }
            
            // 檢查護盾變化
            if (oldShield < this.player.shield) {
                // 護盾修復在 apiProcessExercise 中處理
            }
        }
        
        // 同步怪物狀態
        const monsterState = serverState.monster_state;
        if (monsterState) {
            this.monster.attackCount = monsterState.attack_count;
            this.monster.isAttacking = monsterState.is_attacking;
        }
        
        // 同步遊戲狀態
        const gameState = serverState.game_state;
        if (gameState) {
            this.gameState.elapsedTime = gameState.elapsed_time;
            this.gameState.isCompleted = gameState.is_completed;
            this.gameState.isGameOver = gameState.is_game_over;
        }
        
        // 同步統計數據
        if (serverState.statistics) {
            this.statistics = { ...this.statistics, ...serverState.statistics };
        }
        
        // 更新 UI
        this.updateUI();
        
        // 檢查遊戲結束條件
        if (gameState && gameState.is_completed && !this.gameState.isCompleted) {
            this.handleVictory();
        } else if (gameState && gameState.is_game_over && !this.gameState.isGameOver) {
            this.handleDefeat();
        }
    }
    
    /**
     * 顯示傷害效果（重載方法）
     */
    showDamageEffect(damage) {
        // 創建傷害數字
        const damageElement = document.createElement('div');
        damageElement.className = 'damage-popup';
        damageElement.textContent = `-${damage}`;
        damageElement.style.position = 'absolute';
        damageElement.style.left = '50%';
        damageElement.style.top = '30%';
        damageElement.style.transform = 'translate(-50%, -50%)';
        damageElement.style.color = '#e74c3c';
        damageElement.style.fontSize = '24px';
        damageElement.style.fontWeight = 'bold';
        damageElement.style.zIndex = '1000';
        damageElement.style.pointerEvents = 'none';
        
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.appendChild(damageElement);
            
            // 移除傷害數字
            setTimeout(() => {
                if (damageElement.parentNode) {
                    damageElement.parentNode.removeChild(damageElement);
                }
            }, 1000);
        }
        
        // 玩家受傷閃爍效果
        const playerHPBar = this.elements.playerHPBar;
        if (playerHPBar) {
            playerHPBar.style.animation = 'none';
            setTimeout(() => {
                playerHPBar.style.animation = 'damage-flash 0.5s ease-in-out';
            }, 10);
        }
    }
    
    /**
     * 顯示傷害效果
     */
    showDamageEffect() {
        const playerPanel = document.querySelector('.player-status-panel');
        if (playerPanel) {
            playerPanel.classList.add('damage-flash');
            setTimeout(() => {
                playerPanel.classList.remove('damage-flash');
            }, 500);
        }
        
        // 創建傷害彈出效果
        const damagePopup = document.createElement('div');
        damagePopup.className = 'damage-popup';
        damagePopup.innerHTML = '受傷！';
        damagePopup.style.position = 'absolute';
        damagePopup.style.left = '50%';
        damagePopup.style.top = '60%';
        damagePopup.style.transform = 'translate(-50%, -50%)';
        damagePopup.style.color = '#e74c3c';
        damagePopup.style.fontSize = '24px';
        damagePopup.style.fontWeight = 'bold';
        damagePopup.style.zIndex = '1000';
        damagePopup.style.pointerEvents = 'none';
        damagePopup.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
        
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.appendChild(damagePopup);
            
            // 移除傷害效果
            setTimeout(() => {
                if (damagePopup.parentNode) {
                    damagePopup.parentNode.removeChild(damagePopup);
                }
            }, 1000);
        }
    }
    
    /**
     * 顯示怪物攻擊效果
     */
    showMonsterAttackEffect() {
        // 創建攻擊警告效果
        const attackWarning = document.createElement('div');
        attackWarning.className = 'monster-attack-warning';
        attackWarning.innerHTML = '⚡ 怪物攻擊！';
        attackWarning.style.position = 'absolute';
        attackWarning.style.left = '50%';
        attackWarning.style.top = '20%';
        attackWarning.style.transform = 'translate(-50%, -50%)';
        attackWarning.style.color = '#e74c3c';
        attackWarning.style.fontSize = '32px';
        attackWarning.style.fontWeight = 'bold';
        attackWarning.style.zIndex = '1000';
        attackWarning.style.pointerEvents = 'none';
        attackWarning.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
        attackWarning.style.animation = 'monster-attack-flash 1s ease-in-out';
        
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.appendChild(attackWarning);
            
            // 移除警告效果
            setTimeout(() => {
                if (attackWarning.parentNode) {
                    attackWarning.parentNode.removeChild(attackWarning);
                }
            }, 1000);
        }
        
        // 螢幕震動效果
        const gameContainer = document.querySelector('.game-container') || document.body;
        gameContainer.style.animation = 'screen-shake 0.5s ease-in-out';
        
        setTimeout(() => {
            gameContainer.style.animation = '';
        }, 500);
        
        // 怪物容器攻擊動畫
        const monsterContainer = document.getElementById('monster-container');
        if (monsterContainer) {
            monsterContainer.classList.add('monster-attacking');
            setTimeout(() => {
                monsterContainer.classList.remove('monster-attacking');
            }, 800);
        }
    }
    
    /**
     * 顯示護盾修復特效（重載方法）
     */
    showShieldRepairEffect(repairAmount, combo = 0) {
        // 創建修復數字
        const repairElement = document.createElement('div');
        repairElement.className = 'shield-repair-popup';
        repairElement.textContent = `+${repairAmount}`;
        
        if (combo > 1) {
            repairElement.textContent += ` (x${combo})`;
            repairElement.classList.add('combo');
        }
        
        repairElement.style.position = 'absolute';
        repairElement.style.left = '50%';
        repairElement.style.top = '40%';
        repairElement.style.transform = 'translate(-50%, -50%)';
        repairElement.style.color = '#2ecc71';
        repairElement.style.fontSize = combo > 1 ? '28px' : '20px';
        repairElement.style.fontWeight = 'bold';
        repairElement.style.zIndex = '1000';
        repairElement.style.pointerEvents = 'none';
        repairElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
        
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.appendChild(repairElement);
            
            // 動畫效果
            setTimeout(() => {
                repairElement.style.animation = 'shield-repair-popup 1s ease-out forwards';
            }, 10);
            
            // 移除修復數字
            setTimeout(() => {
                if (repairElement.parentNode) {
                    repairElement.parentNode.removeChild(repairElement);
                }
            }, 1000);
        }
        
        // 護盾修復閃爍效果
        const shieldBar = this.elements.playerShieldBar;
        if (shieldBar) {
            shieldBar.style.animation = 'none';
            setTimeout(() => {
                shieldBar.style.animation = 'shield-repair-flash 0.5s ease-in-out';
            }, 10);
        }
    }
    
    /**
     * API: 開始遊戲
     */
    async apiStartGame() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch('/api/continuous-defense/start-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('遊戲開始成功');
                return data.data;
            } else {
                throw new Error(data.error || '開始遊戲失敗');
            }
        } catch (error) {
            console.error('開始遊戲錯誤:', error);
            throw error;
        }
    }
    
    /**
     * API: 停止遊戲
     */
    async apiStopGame() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch('/api/continuous-defense/stop-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('遊戲停止成功');
                return data.data;
            } else {
                console.error('停止遊戲失敗:', data.error);
            }
        } catch (error) {
            console.error('停止遊戲錯誤:', error);
        }
    }
    
    /**
     * API: 刪除會話
     */
    async apiDeleteSession() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch(`/api/continuous-defense/session/${this.sessionId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('會話刪除成功');
                this.sessionId = null;
                return data.data;
            } else {
                console.error('刪除會話失敗:', data.error);
            }
        } catch (error) {
            console.error('刪除會話錯誤:', error);
        }
    }
    
    /**
     * 獲取當前狀態
     */
    getStatus() {
        return {
            isActive: this.gameState.isActive,
            elapsedTime: this.gameState.elapsedTime,
            remainingTime: this.config.targetTime * 1000 - this.gameState.elapsedTime,
            playerHP: this.player.hp,
            playerShield: this.player.shield,
            monsterAttackCount: this.monster.attackCount,
            isCompleted: this.gameState.isCompleted,
            isGameOver: this.gameState.isGameOver
        };
    }
    
    /**
     * 獲取完整狀態
     */
    getState() {
        return {
            gameState: { ...this.gameState },
            player: { ...this.player },
            monster: { ...this.monster },
            config: { ...this.config },
            sessionId: this.sessionId,
            statistics: { ...this.statistics }
        };
    }
    
    /**
     * 清理資源
     */
    cleanup() {
        // 停止所有計時器
        this.stopAllTimers();
        
        // 隱藏模式界面
        this.hideModeStatus();
        
        // 刪除會話
        if (this.sessionId) {
            this.apiDeleteSession();
        }
        
        // 重置狀態
        this.resetGameState();
        
        console.log('持續抵擋模式資源清理完成');
    }
}

// 導出模塊
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinuousDefenseMode;
} else if (typeof window !== 'undefined') {
    window.ContinuousDefenseMode = ContinuousDefenseMode;
}