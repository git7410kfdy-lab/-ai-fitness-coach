/**
 * Monster Attack System Module
 * 負責管理怪物攻擊系統，包括玩家生命條、怪物攻擊、防禦機制等
 */

class MonsterAttackSystem {
    constructor(config = {}) {
        // 玩家狀態
        this.player = {
            maxHP: config.playerMaxHp || 150,
            currentHP: config.playerMaxHp || 150,
            shield: 0,
            maxShield: config.playerMaxShield || 50,
            isDefending: false,
            defenseStartTime: null,
            defenseRequiredTime: config.defenseTime || 2000, // 2秒
            lastDamageTime: 0,
            invulnerabilityTime: 1000 // 1秒無敵時間
        };
        
        // 怪物攻擊狀態
        this.monsterAttack = {
            isAttacking: false,
            attackInterval: config.attackInterval || 25000, // 25秒攻擊一次
            initialDelay: config.initialDelay || 30000, // 初始延遲30秒
            lastAttackTime: 0,
            attackDamage: config.attackDamage || 20,
            attackWarningTime: config.warningTime || 8000, // 8秒警告時間
            isWarning: false,
            warningStartTime: 0,
            gameStartTime: 0, // 遊戲開始時間
            attackTimer: null // 攻擊定時器
        };
        
        // 防禦系統
        this.defenseSystem = {
            requiredExercise: config.defenseAction || 'squat', // 需要的防禦動作
            isActive: false,
            activationProgress: 0,
            maxProgress: 100,
            progressDecayRate: 2, // 每幀減少的進度
            shieldRegenRate: config.shieldRecoveryRate || 5, // 護盾恢復速度
            scoreStartTime: null // 記錄分數開始時間
        };
        
        // UI 元素
        this.elements = {
            playerHPBar: null,
            playerHPText: null,
            playerShieldBar: null,
            playerShieldText: null,
            attackWarning: null,
            defenseProgress: null,
            defenseInstruction: null
        };
        
        // 事件回調
        this.callbacks = {
            onPlayerDamaged: config.onPlayerDamaged || null,
            onPlayerHealed: config.onPlayerHealed || null,
            onShieldActivated: config.onShieldActivated || null,
            onShieldDeactivated: config.onShieldDeactivated || null,
            onMonsterAttackWarning: config.onMonsterAttackWarning || null,
            onMonsterAttack: config.onMonsterAttack || null,
            onDefenseSuccess: config.onDefenseSuccess || null,
            onDefenseFailed: config.onDefenseFailed || null,
            onPlayerDeath: config.onPlayerDeath || null
        };
        
        // 動畫和效果
        this.animations = {
            damageFlash: false,
            healGlow: false,
            shieldGlow: false
        };
        
        // 系統狀態
        this.isInitialized = false;
        this.isPaused = false;
        this.gameStartTime = Date.now();
        
        // 音效系統
        this.audioCache = new Map();
        this.soundPaths = {
            attackWarning: '/static/Game_Audio/小心怪物要攻擊了，保持運動動作不動，來防禦攻擊.mp3',
            defenseSuccess: '/static/Game_Audio/抵擋住了 ! 太厲害了!.mp3',
            defenseFailed: '/static/Game_Audio/喔不! 受到攻擊....mp3'
        };
        
        // 預載音效
        this.preloadAudio();
    }
    
    /**
     * 初始化系統
     */
    init() {
        console.log('初始化怪物攻擊系統');
        
        this.createUI();
        this.bindEvents();
        // 不立即開始攻擊循環，等待檢測開始
        
        this.isInitialized = true;
        this.isPaused = true; // 初始狀態為暫停
        this.updateUI();
        
        console.log('怪物攻擊系統初始化完成，等待檢測開始');
    }
    
    /**
     * 創建UI元素
     */
    createUI() {
        // 檢查是否已存在玩家狀態面板，如果不存在才創建
        let playerStatusPanel = document.querySelector('.player-status-panel');
        if (!playerStatusPanel) {
            playerStatusPanel = document.createElement('div');
            playerStatusPanel.className = 'player-status-panel';
            playerStatusPanel.innerHTML = `
                <div class="player-status-header">
                    <div class="player-title">
                        <i class="fas fa-user-shield"></i>
                        <span>玩家狀態</span>
                    </div>
                </div>
                <div class="player-status-body">
                    <div class="hp-container">
                        <div class="hp-label">生命值:</div>
                        <div class="hp-bar">
                            <div class="hp-bar-fill player-hp-bar" id="player-hp-bar"></div>
                        </div>
                        <div class="hp-value">
                            <span id="player-hp-text">150/150</span>
                        </div>
                    </div>
                    
                    <div class="shield-container">
                        <div class="shield-label">護盾:</div>
                        <div class="shield-bar">
                            <div class="shield-bar-fill" id="player-shield-bar"></div>
                        </div>
                        <div class="shield-value">
                            <span id="player-shield-text">0/50</span>
                        </div>
                    </div>
                    
                    <div class="defense-container">
                        <div class="defense-label">防禦進度:</div>
                        <div class="defense-progress-bar">
                            <div class="defense-progress-fill" id="defense-progress-bar"></div>
                        </div>
                        <div class="defense-instruction" id="defense-instruction">
                            保持深蹲姿勢2秒來啟動護盾
                        </div>
                    </div>
                </div>
            `;
            
            // 將元素添加到頁面
            const rightPanel = document.querySelector('.right-side-panel');
            if (rightPanel) {
                rightPanel.insertBefore(playerStatusPanel, rightPanel.firstChild);
            }
        }
        
        // 創建攻擊警告（如果不存在）
        this.createAttackWarning();
        
        // 保存元素引用
        this.elements.playerHPBar = document.getElementById('player-hp-bar');
        this.elements.playerHPText = document.getElementById('player-hp-text') || document.getElementById('player-hp');
        this.elements.playerShieldBar = document.getElementById('player-shield-bar');
        this.elements.playerShieldText = document.getElementById('player-shield-text') || document.getElementById('player-shield');
        this.elements.attackWarning = document.getElementById('attack-warning');
        this.elements.defenseProgress = document.getElementById('defense-progress-bar') || document.getElementById('defense-progress-fill');
        this.elements.defenseInstruction = document.getElementById('defense-instruction');
        this.elements.warningTimer = document.getElementById('warning-timer');
    }
    
    /**
     * 預載音效
     */
    preloadAudio() {
        console.log('預載怪物攻擊系統音效');
        
        Object.entries(this.soundPaths).forEach(([key, soundPath]) => {
            const audio = new Audio(soundPath);
            audio.preload = 'auto';
            audio.volume = 0.8; // 設置音量
            
            // 監聽加載完成事件
            audio.addEventListener('canplaythrough', () => {
                console.log(`音效 ${key} 加載完成: ${soundPath}`);
            });
            
            // 監聽加載錯誤事件
            audio.addEventListener('error', (e) => {
                console.error(`音效 ${key} 加載失敗: ${soundPath}`, e);
            });
            
            this.audioCache.set(key, audio);
        });
    }
    
    /**
     * 播放音效
     */
    playSound(soundKey) {
        const audio = this.audioCache.get(soundKey);
        
        if (audio) {
            try {
                // 重置播放位置
                audio.currentTime = 0;
                
                // 播放音效
                audio.play().catch(error => {
                    console.error(`播放音效失敗 (${soundKey}):`, error);
                });
                
                console.log(`播放音效: ${soundKey}`);
            } catch (error) {
                console.error(`音效播放錯誤 (${soundKey}):`, error);
            }
        } else {
            console.warn(`音效不存在: ${soundKey}`);
        }
    }
    
    /**
     * 創建攻擊警告元素
     */
    createAttackWarning() {
        // 移除舊的攻擊警告（如果存在）
        const existingWarning = document.getElementById('attack-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        const attackWarning = document.createElement('div');
        attackWarning.className = 'attack-warning';
        attackWarning.id = 'attack-warning';
        attackWarning.innerHTML = `
            <div class="warning-content">
                <div class="warning-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="warning-text">
                    <div class="warning-title">怪物即將攻擊！</div>
                    <div class="warning-subtitle">快速進入防禦姿勢</div>
                </div>
                <div class="warning-timer" id="warning-timer">3</div>
            </div>
        `;
        
        // 優先添加到怪物容器，確保跟隨移動
        const monsterContainer = document.getElementById('monster-container');
        if (monsterContainer) {
            // 確保怪物容器有相對定位
            const computedStyle = getComputedStyle(monsterContainer);
            if (computedStyle.position === 'static') {
                monsterContainer.style.position = 'relative';
            }
            monsterContainer.appendChild(attackWarning);
            console.log('攻擊警告已添加到怪物容器中');
        } else {
            // 如果找不到怪物容器，則添加到怪物區域
            const monsterArea = document.querySelector('.monster-area');
            if (monsterArea) {
                if (getComputedStyle(monsterArea).position === 'static') {
                    monsterArea.style.position = 'relative';
                }
                monsterArea.appendChild(attackWarning);
                console.log('攻擊警告已添加到怪物區域中');
            } else {
                // 如果找不到怪物容器，添加到body並使用固定定位
                attackWarning.style.position = 'fixed';
                attackWarning.style.top = '50%';
                attackWarning.style.left = '50%';
                attackWarning.style.transform = 'translate(-50%, -50%)';
                attackWarning.style.zIndex = '9999';
                document.body.appendChild(attackWarning);
                console.log('攻擊警告已添加到body中（固定定位）');
            }
        }
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 監聽運動檢測事件
        document.addEventListener('exerciseDetected', (event) => {
            this.handleExerciseDetected(event.detail);
        });
        
        // 監聽姿勢品質事件
        document.addEventListener('postureQuality', (event) => {
            this.handlePostureQuality(event.detail);
        });
    }
    
    /**
     * 開始攻擊循環
     */
    startAttackCycle() {
        if (this.isPaused) return;
        
        const now = Date.now();
        
        // 檢查是否已過初始延遲時間
        const timeSinceGameStart = now - this.monsterAttack.gameStartTime;
        if (timeSinceGameStart < this.monsterAttack.initialDelay) {
            // 還在初始延遲期間，不攻擊
        } else {
            // 檢查是否該發起攻擊
            if (now - this.monsterAttack.lastAttackTime >= this.monsterAttack.attackInterval) {
                this.startAttackWarning();
            }
        }
        
        // 更新警告倒計時
        if (this.monsterAttack.isWarning) {
            this.updateAttackWarning();
        }
        
        // 更新防禦進度（內部更新，不改變防禦狀態）
        if (this.player.isDefending) {
            const elapsed = Date.now() - this.player.defenseStartTime;
            
            if (elapsed >= this.player.defenseRequiredTime && 
                this.defenseSystem.activationProgress >= this.defenseSystem.maxProgress) {
                this.activateShield();
            }
        } else {
            // 進度衰減
            this.defenseSystem.activationProgress = Math.max(
                0,
                this.defenseSystem.activationProgress - this.defenseSystem.progressDecayRate
            );
        }
        
        this.updateDefenseUI();
        
        // 更新護盾恢復
        this.updateShieldRegeneration();
        
        // 繼續循環
        requestAnimationFrame(() => this.startAttackCycle());
    }
    
    /**
     * 開始攻擊警告
     */
    startAttackWarning() {
        // 防止重複警告
        if (this.monsterAttack.isWarning || this.monsterAttack.isAttacking) {
            console.log('警告或攻擊正在進行中，忽略重複警告');
            return;
        }
        
        // 確保攻擊警告元素存在
        if (!this.elements.attackWarning) {
            console.log('攻擊警告元素不存在，重新創建');
            this.createAttackWarning();
            this.elements.attackWarning = document.getElementById('attack-warning');
            this.elements.warningTimer = document.getElementById('warning-timer');
        }
        
        if (!this.elements.attackWarning) {
            console.warn('無法創建或找到攻擊警告元素，嘗試重新創建');
            // 強制重新創建
            this.createAttackWarning();
            this.elements.attackWarning = document.getElementById('attack-warning');
            this.elements.warningTimer = document.getElementById('warning-timer');
            
            if (!this.elements.attackWarning) {
                console.error('攻擊警告元素創建失敗，跳過此次攻擊');
                return;
            }
        }
        
        console.log('怪物攻擊警告開始');
        
        this.monsterAttack.isWarning = true;
        this.monsterAttack.warningStartTime = Date.now();
        
        // 確保警告元素可見
        this.elements.attackWarning.style.display = 'block';
        this.elements.attackWarning.classList.add('show');
        
        // 播放攻擊警告音效
        this.playSound('attackWarning');
        
        // 觸發警告回調
        if (this.callbacks.onMonsterAttackWarning) {
            this.callbacks.onMonsterAttackWarning();
        }
        
        // 清除之前的定時器（如果存在）
        if (this.monsterAttack.attackTimer) {
            clearTimeout(this.monsterAttack.attackTimer);
        }
        
        // 設置攻擊定時器
        this.monsterAttack.attackTimer = setTimeout(() => {
            this.executeMonsterAttack();
        }, this.monsterAttack.attackWarningTime);
    }
    
    /**
     * 更新攻擊警告
     */
    updateAttackWarning() {
        if (!this.monsterAttack.isWarning) return;
        
        const elapsed = Date.now() - this.monsterAttack.warningStartTime;
        const remaining = Math.max(0, this.monsterAttack.attackWarningTime - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        
        if (this.elements.warningTimer) {
            this.elements.warningTimer.textContent = seconds;
        }
    }
    
    /**
     * 執行怪物攻擊
     */
    executeMonsterAttack() {
        // 防止重複攻擊
        if (this.monsterAttack.isAttacking) {
            console.log('攻擊正在進行中，忽略重複攻擊');
            return;
        }
        
        console.log('怪物發起攻擊，檢查防禦狀態:', {
            isDefending: this.player.isDefending,
            shield: this.player.shield,
            maxShield: this.player.maxShield
        });
        
        this.monsterAttack.isWarning = false;
        this.monsterAttack.isAttacking = true;
        this.monsterAttack.lastAttackTime = Date.now();
        
        // 隱藏警告UI
        if (this.elements.attackWarning) {
            this.elements.attackWarning.classList.remove('show');
        }
        
        // 檢查玩家是否在防禦且護盾已展開
        if (this.player.isDefending && this.player.shield > 0) {
            console.log('玩家成功防禦攻擊');
            this.handleSuccessfulDefense();
        } else {
            console.log('玩家未防禦，受到傷害');
            this.damagePlayer(this.monsterAttack.attackDamage);
        }
        
        // 觸發攻擊回調
        if (this.callbacks.onMonsterAttack) {
            this.callbacks.onMonsterAttack(this.player.isDefending);
        }
        
        // 設置攻擊狀態重置，確保一次攻擊只造成一次傷害
        setTimeout(() => {
            this.monsterAttack.isAttacking = false;
            console.log('攻擊狀態重置');
        }, 1000);
    }
    
    /**
     * 處理成功防禦
     */
    handleSuccessfulDefense() {
        console.log('成功防禦怪物攻擊');
        
        // 檢查當前運動類型，決定護盾消耗邏輯
        const isAlternatingArmSwing = this.currentExerciseType === 'Alternating Arm Swing Warmup';
        
        if (isAlternatingArmSwing && this.player.shield > 0) {
            // 雙手輪流擺動熱身運動：護盾會被攻擊消耗
            const shieldDamage = Math.min(this.monsterAttack.attackDamage, this.player.shield);
            this.player.shield -= shieldDamage;
            
            console.log(`雙手輪流擺動熱身 - 護盾吸收 ${shieldDamage} 點傷害，剩餘護盾: ${this.player.shield}`);
            
            // 如果護盾歸零，關閉防禦狀態
            if (this.player.shield <= 0) {
                this.player.isDefending = false;
                console.log('護盾已耗盡，防禦狀態關閉');
            }
            
            if (this.callbacks.onDefenseSuccess) {
                this.callbacks.onDefenseSuccess(shieldDamage);
            }
        } else {
            // 其他運動類型：即時防禦模式，護盾不消耗
            console.log('即時防禦模式 - 護盾不消耗');
            
            if (this.callbacks.onDefenseSuccess) {
                this.callbacks.onDefenseSuccess(0); // 傳遞0表示沒有護盾消耗
            }
        }
        
        // 播放防禦成功音效
        this.playSound('defenseSuccess');
        
        // 顯示防禦成功效果
        this.showDefenseEffect();
        
        this.updateUI();
    }
    
    /**
     * 對玩家造成傷害
     */
    damagePlayer(damage) {
        const now = Date.now();
        
        // 檢查無敵時間
        if (now - this.player.lastDamageTime < this.player.invulnerabilityTime) {
            return;
        }
        
        console.log(`玩家受到 ${damage} 點傷害`);
        
        // 播放防禦失敗音效
        this.playSound('defenseFailed');
        
        this.player.currentHP = Math.max(0, this.player.currentHP - damage);
        this.player.lastDamageTime = now;
        
        // 顯示傷害效果
        this.showDamageEffect();
        
        // 檢查玩家是否死亡
        if (this.player.currentHP <= 0) {
            this.handlePlayerDeath();
        }
        
        if (this.callbacks.onPlayerDamaged) {
            this.callbacks.onPlayerDamaged(damage, this.player.currentHP);
        }
        
        this.updateUI();
    }
    
    /**
     * 處理運動檢測
     */
    handleExerciseDetected(exerciseData) {
        const { type, count, quality } = exerciseData;
        
        // 檢查是否為防禦動作
        if (type === this.defenseSystem.requiredExercise) {
            this.updateDefenseState(true, quality);
        } else {
            this.updateDefenseState(false);
        }
    }
    
    /**
     * 處理姿勢品質 - 支援所有運動類型的防護罩機制
     */
    handlePostureQuality(qualityData) {
        const { score, exerciseType } = qualityData;
        const now = Date.now();
        
        // 記錄當前運動類型，用於防禦邏輯判斷
        this.currentExerciseType = exerciseType;
        
        console.log('怪物攻擊系統收到姿勢品質數據:', {
            score: score,
            exerciseType: exerciseType,
            currentShield: this.player.shield,
            isDefending: this.player.isDefending
        });
        
        // 檢查品質分數是否達到防禦要求（大於等於4分）- 適用於所有運動類型
        const scoreThreshold = score >= 4;
        
        // 雙手輪流擺動熱身運動的特殊處理
        if (exerciseType === 'Alternating Arm Swing Warmup') {
            if (scoreThreshold) {
                // 立即啟動護盾2秒，不需要持續時間
                this.player.isDefending = true;
                this.player.shield = this.player.maxShield;
                console.log(`雙手輪流擺動熱身運動 - 護盾立即啟動2秒`);
                
                // 設置護盾持續時間為2秒
                if (this.alternatingArmSwingShieldTimeout) {
                    clearTimeout(this.alternatingArmSwingShieldTimeout);
                }
                
                this.alternatingArmSwingShieldTimeout = setTimeout(() => {
                    this.player.isDefending = false;
                    this.player.shield = 0;
                    console.log('雙手輪流擺動熱身運動 - 護盾2秒時間結束');
                    this.updateUI();
                }, 2000);
            }
            // 對於雙手輪流擺動熱身運動，分數不達標時不做任何處理（護盾可能還在2秒持續時間內）
        } else {
            // 其他運動類型的原有邏輯
            if (scoreThreshold) {
                // 如果分數達標且還沒開始計時，開始計時
                if (!this.defenseSystem.scoreStartTime) {
                    this.defenseSystem.scoreStartTime = now;
                    console.log(`開始計時，分數達標 - 運動類型: ${exerciseType || '未知'}`);
                }
                
                // 檢查是否持續超過1秒
                const elapsed = now - this.defenseSystem.scoreStartTime;
                const isDefending = elapsed >= 1000; // 1秒
                
                console.log('防禦判斷結果:', {
                    isDefending: isDefending,
                    scoreCheck: scoreThreshold,
                    elapsed: elapsed,
                    required: 1000,
                    exerciseType: exerciseType
                });
                
                this.player.isDefending = isDefending;
                
                if (isDefending) {
                    // 如果持續超過1秒，護盾展開
                    this.player.shield = this.player.maxShield;
                    console.log(`護盾展開，持續時間達標 - 運動類型: ${exerciseType || '未知'}`);
                } else {
                    // 還沒達到1秒，護盾歸零
                    this.player.shield = 0;
                }
            } else {
                // 分數不達標，重置計時並關閉護盾
                this.defenseSystem.scoreStartTime = null;
                this.player.isDefending = false;
                this.player.shield = 0;
                console.log(`分數不達標，護盾關閉 - 運動類型: ${exerciseType || '未知'}`);
            }
        }
        
        this.updateUI();
    }
    
    /**
     * 更新防禦狀態
     */
    updateDefenseState(isDefending, quality = 0.5) {
        if (isDefending) {
            if (!this.player.isDefending) {
                this.player.isDefending = true;
                this.player.defenseStartTime = Date.now();
                console.log('開始防禦，防禦開始時間:', this.player.defenseStartTime);
            }
            
            // 增加防禦進度
            const progressIncrease = quality * 5; // 根據品質調整進度增加
            this.defenseSystem.activationProgress = Math.min(
                this.defenseSystem.maxProgress,
                this.defenseSystem.activationProgress + progressIncrease
            );
            
            // 檢查是否可以啟動護盾
            const elapsed = Date.now() - this.player.defenseStartTime;
            console.log('防禦經過時間:', elapsed, '需要時間:', this.player.defenseRequiredTime, '進度:', this.defenseSystem.activationProgress);
            
            if (elapsed >= this.player.defenseRequiredTime && 
                this.defenseSystem.activationProgress >= this.defenseSystem.maxProgress) {
                this.activateShield();
            }
        } else {
            this.player.isDefending = false;
            this.player.defenseStartTime = null;
            
            // 進度衰減
            this.defenseSystem.activationProgress = Math.max(
                0,
                this.defenseSystem.activationProgress - this.defenseSystem.progressDecayRate
            );
        }
        
        this.updateDefenseUI();
    }
    
    /**
     * 更新防禦進度（外部調用）
     */
    updateDefenseProgress(isDefending) {
        if (isDefending) {
            if (!this.player.isDefending) {
                this.player.isDefending = true;
                this.player.defenseStartTime = Date.now();
            }
            
            // 增加防禦進度
            this.defenseSystem.activationProgress = Math.min(
                this.defenseSystem.maxProgress,
                this.defenseSystem.activationProgress + 5
            );
            
            // 檢查是否可以啟動護盾
            const elapsed = Date.now() - this.player.defenseStartTime;
            if (elapsed >= this.player.defenseRequiredTime && 
                this.defenseSystem.activationProgress >= this.defenseSystem.maxProgress) {
                this.activateShield();
            }
        } else {
            this.player.isDefending = false;
            this.player.defenseStartTime = null;
            
            // 進度衰減
            this.defenseSystem.activationProgress = Math.max(
                0,
                this.defenseSystem.activationProgress - this.defenseSystem.progressDecayRate
            );
        }
        
        this.updateDefenseUI();
    }
    
    /**
     * 啟動護盾
     */
    activateShield() {
        if (this.player.shield >= this.player.maxShield) return;
        
        console.log('護盾啟動');
        
        this.player.shield = this.player.maxShield;
        this.defenseSystem.isActive = true;
        this.defenseSystem.activationProgress = 0;
        
        // 顯示護盾啟動效果
        this.showShieldActivationEffect();
        
        if (this.callbacks.onShieldActivated) {
            this.callbacks.onShieldActivated();
        }
        
        this.updateUI();
    }
    
    /**
     * 更新護盾恢復
     */
    updateShieldRegeneration() {
        if (this.defenseSystem.isActive && this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(
                this.player.maxShield,
                this.player.shield + this.defenseSystem.shieldRegenRate * 0.016 // 60fps
            );
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
    }
    
    /**
     * 顯示防禦效果
     */
    showDefenseEffect() {
        const playerPanel = document.querySelector('.player-status-panel');
        if (playerPanel) {
            playerPanel.classList.add('defense-success');
            setTimeout(() => {
                playerPanel.classList.remove('defense-success');
            }, 1000);
        }
        
        // 顯示防禦成功的視覺效果
        this.showDefenseSuccessEffect();
    }
    
    /**
     * 顯示防禦成功效果
     */
    showDefenseSuccessEffect() {
        const defenseEffect = document.createElement('div');
        defenseEffect.className = 'defense-success-overlay';
        defenseEffect.innerHTML = `
            <div class="defense-success-text">防禦成功！</div>
        `;
        
        const videoContainer = document.querySelector('.video-container') || 
                              document.querySelector('#video-container') || 
                              document.querySelector('.monster-container') || 
                              document.body;
        
        videoContainer.appendChild(defenseEffect);
        
        // 1.5秒後移除效果
        setTimeout(() => {
            if (defenseEffect && defenseEffect.parentNode) {
                defenseEffect.remove();
            }
        }, 1500);
    }
    
    /**
     * 顯示護盾啟動效果
     */
    showShieldActivationEffect() {
        const playerPanel = document.querySelector('.player-status-panel');
        if (playerPanel) {
            playerPanel.classList.add('shield-activation');
            setTimeout(() => {
                playerPanel.classList.remove('shield-activation');
            }, 2000);
        }
        
        // 創建防護罩視覺效果
        this.createShieldOverlay();
    }
    
    /**
     * 創建防護罩覆蓋層
     */
    createShieldOverlay() {
        // 移除現有的防護罩
        const existingShield = document.querySelector('.shield-overlay');
        if (existingShield) {
            existingShield.remove();
        }
        
        const shieldOverlay = document.createElement('div');
        shieldOverlay.className = 'shield-overlay';
        shieldOverlay.innerHTML = `
            <div class="shield-effect">
                <div class="shield-ring"></div>
                <div class="shield-particles"></div>
                <div class="shield-text">防護罩啟動！</div>
            </div>
        `;
        
        // 添加到視頻容器或body
        const videoContainer = document.querySelector('.video-container') || 
                              document.querySelector('#video-container') || 
                              document.querySelector('.monster-container') || 
                              document.body;
        
        videoContainer.appendChild(shieldOverlay);
        
        // 3秒後移除防護罩效果
        setTimeout(() => {
            if (shieldOverlay && shieldOverlay.parentNode) {
                shieldOverlay.remove();
            }
        }, 3000);
    }
    
    /**
     * 處理玩家死亡
     */
    handlePlayerDeath() {
        console.log('玩家死亡');
        this.isPaused = true;
        
        // 顯示死亡界面
        this.showDeathScreen();
    }
    
    /**
     * 顯示死亡界面
     */
    showDeathScreen() {
        const deathScreen = document.createElement('div');
        deathScreen.className = 'death-screen';
        deathScreen.innerHTML = `
            <div class="death-content">
                <div class="death-title">遊戲結束</div>
                <div class="death-subtitle">你被怪物擊敗了！</div>
                <div class="death-actions">
                    <button class="button primary" onclick="monsterAttackSystem.respawnPlayer()">重新開始</button>
                    <button class="button secondary" onclick="location.reload()">返回主頁</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(deathScreen);
    }
    
    /**
     * 玩家復活
     */
    respawnPlayer() {
        console.log('玩家復活，準備停止偵測並重置系統');
        
        // 確保停止偵測請求發送到後端
        if (typeof stopDetection === 'function') {
            console.log('調用 stopDetection 函數');
            stopDetection();
        } else {
            console.warn('stopDetection函數不存在，嘗試直接發送停止請求');
            // 如果 stopDetection 函數不存在，直接通過 socket 發送停止請求
            if (window.socket && window.socket.connected) {
                console.log('直接通過 socket 發送停止偵測請求');
                window.socket.emit('stop_detection');
            } else {
                console.error('Socket 不可用，無法發送停止偵測請求');
            }
        }
        
        // 等待一小段時間確保停止請求已發送
        setTimeout(() => {
            // 使用reset方法來完全重置系統
            this.reset();
            
            // 移除死亡界面
            const deathScreen = document.querySelector('.death-screen');
            if (deathScreen) {
                deathScreen.remove();
            }
            
            console.log('玩家復活完成，系統已重置');
        }, 100);
    }
    
    /**
     * 更新UI
     */
    updateUI() {
        this.updatePlayerHealthUI();
        this.updatePlayerShieldUI();
        this.updateDefenseUI();
    }
    
    /**
     * 更新玩家血量UI
     */
    updatePlayerHealthUI() {
        const hpPercentage = (this.player.currentHP / this.player.maxHP) * 100;
        const hpText = `${this.player.currentHP}/${this.player.maxHP}`;
        
        // 更新原始血量條
        if (this.elements.playerHPBar && this.elements.playerHPText) {
            this.elements.playerHPBar.style.width = `${hpPercentage}%`;
            this.elements.playerHPText.textContent = hpText;
        }
        
        // 更新視頻內血量條
        const videoHPBar = document.getElementById('video-player-hp-bar');
        const videoHP = document.getElementById('video-player-hp');
        const videoMaxHP = document.getElementById('video-player-max-hp');
        
        if (videoHPBar) {
            videoHPBar.style.width = `${hpPercentage}%`;
        }
        if (videoHP) {
            videoHP.textContent = this.player.currentHP;
        }
        if (videoMaxHP) {
            videoMaxHP.textContent = this.player.maxHP;
        }
    }
    
    /**
     * 更新玩家護盾UI
     */
    updatePlayerShieldUI() {
        const shieldPercentage = (this.player.shield / this.player.maxShield) * 100;
        const shieldText = `${Math.floor(this.player.shield)}/${this.player.maxShield}`;
        
        // 更新原始護盾條
        if (this.elements.playerShieldBar && this.elements.playerShieldText) {
            this.elements.playerShieldBar.style.width = `${shieldPercentage}%`;
            this.elements.playerShieldText.textContent = shieldText;
        }
        
        // 更新視頻內護盾條
        const videoShieldBar = document.getElementById('video-player-shield-bar');
        const videoShield = document.getElementById('video-player-shield');
        const videoMaxShield = document.getElementById('video-player-max-shield');
        
        if (videoShieldBar) {
            videoShieldBar.style.width = `${shieldPercentage}%`;
        }
        if (videoShield) {
            videoShield.textContent = Math.floor(this.player.shield);
        }
        if (videoMaxShield) {
            videoMaxShield.textContent = this.player.maxShield;
        }
    }
    
    /**
     * 更新防禦UI
     */
    updateDefenseUI() {
        if (this.elements.defenseProgress) {
            const progressPercentage = (this.defenseSystem.activationProgress / this.defenseSystem.maxProgress) * 100;
            this.elements.defenseProgress.style.width = `${progressPercentage}%`;
        }
        
        if (this.elements.defenseInstruction) {
            if (this.player.isDefending) {
                const elapsed = Date.now() - this.player.defenseStartTime;
                const remaining = Math.max(0, this.player.defenseRequiredTime - elapsed);
                const seconds = (remaining / 1000).toFixed(1);
                this.elements.defenseInstruction.textContent = `繼續保持姿勢 ${seconds}s`;
            } else {
                this.elements.defenseInstruction.textContent = '保持深蹲姿勢2秒來啟動護盾';
            }
        }
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
     * 獲取系統狀態
     */
    getSystemState() {
        return {
            player: { ...this.player },
            monsterAttack: { ...this.monsterAttack },
            defenseSystem: { ...this.defenseSystem },
            isInitialized: this.isInitialized,
            isPaused: this.isPaused
        };
    }
    
    /**
     * 暫停系統
     */
    pause() {
        this.isPaused = true;
        
        // 清理攻擊定時器
        if (this.monsterAttack.attackTimer) {
            clearTimeout(this.monsterAttack.attackTimer);
            this.monsterAttack.attackTimer = null;
        }
        
        // 隱藏攻擊警告
        if (this.elements.attackWarning) {
            this.elements.attackWarning.style.display = 'none';
            this.elements.attackWarning.classList.remove('show', 'warning-pulse');
        }
        
        // 重置攻擊狀態
        this.monsterAttack.isWarning = false;
        this.monsterAttack.isAttacking = false;
        
        console.log('怪物攻擊系統已暫停');
    }
    
    /**
     * 恢復系統
     */
    resume() {
        this.isPaused = false;
        const now = Date.now();
        
        // 如果是第一次啟動（gameStartTime為0或未設置），設置初始時間
        if (!this.monsterAttack.gameStartTime || this.monsterAttack.gameStartTime === 0) {
            this.monsterAttack.gameStartTime = now;
            this.monsterAttack.lastAttackTime = now;
            console.log(`怪物攻擊系統首次啟動，初始延遲${this.monsterAttack.initialDelay / 1000}秒，給玩家時間準備攝像頭和防禦`);
            
            // 首次啟動時，延遲開始攻擊循環，給玩家足夠時間準備
            setTimeout(() => {
                if (!this.isPaused) {
                    console.log('初始延遲結束，開始攻擊循環');
                    this.startAttackCycle();
                }
            }, 3000); // 給玩家3秒時間準備攝像頭
            
        } else {
            // 如果不是第一次啟動，檢查是否已過初始延遲期
            const timeSinceGameStart = now - this.monsterAttack.gameStartTime;
            if (timeSinceGameStart >= this.monsterAttack.initialDelay) {
                // 已過初始延遲期，檢查距離上次攻擊的時間
                const timeSinceLastAttack = now - this.monsterAttack.lastAttackTime;
                if (timeSinceLastAttack >= this.monsterAttack.attackInterval) {
                    // 如果距離上次攻擊已超過攻擊間隔，延遲開始警告
                    console.log('恢復系統時發現應該攻擊，延遲3秒開始警告');
                    setTimeout(() => {
                        if (!this.isPaused) {
                            this.startAttackWarning();
                        }
                    }, 3000); // 延遲3秒開始警告，給系統準備時間
                } else {
                    console.log(`恢復系統，距離下次攻擊還有 ${(this.monsterAttack.attackInterval - timeSinceLastAttack) / 1000} 秒`);
                }
            } else {
                console.log(`恢復系統，初始延遲還剩 ${(this.monsterAttack.initialDelay - timeSinceGameStart) / 1000} 秒`);
            }
            
            // 非首次啟動立即開始攻擊循環
            this.startAttackCycle();
        }
        
        console.log('怪物攻擊系統已恢復');
    }
    
    /**
     * 重置系統
     */
    reset() {
        console.log('重置怪物攻擊系統');
        
        // 先暫停系統以清理所有定時器
        this.pause();
        
        this.player.currentHP = this.player.maxHP;
        this.player.shield = 0;
        this.player.isDefending = false;
        this.player.defenseStartTime = null;
        
        this.monsterAttack.isAttacking = false;
        this.monsterAttack.lastAttackTime = 0;
        this.monsterAttack.isWarning = false;
        this.monsterAttack.gameStartTime = 0;
        this.monsterAttack.attackTimer = null;
        
        this.defenseSystem.isActive = false;
        this.defenseSystem.activationProgress = 0;
        this.defenseSystem.scoreStartTime = null;
        
        // 清理攻擊警告狀態
        if (this.monsterAttackState) {
            this.monsterAttackState.warningActive = false;
            this.monsterAttackState.warningTimeLeft = 0;
            if (this.monsterAttackState.warningTimer) {
                clearInterval(this.monsterAttackState.warningTimer);
                this.monsterAttackState.warningTimer = null;
            }
        }
        
        // 隱藏警告UI
        if (this.elements.attackWarning) {
            this.elements.attackWarning.style.display = 'none';
            this.elements.attackWarning.classList.remove('show', 'warning-pulse');
        }
        
        // 移除死亡界面
        const deathScreen = document.querySelector('.death-screen');
        if (deathScreen) {
            deathScreen.remove();
        }
        
        // 重置後保持暫停狀態，等待下次 resume() 調用
        this.isPaused = true;
        
        this.updateUI();
        
        console.log('怪物攻擊系統重置完成，系統處於暫停狀態');
    }
    
    /**
     * 銷毀系統
     */
    destroy() {
        console.log('銷毀怪物攻擊系統');
        
        this.isPaused = true;
        
        // 清理所有定時器
        if (this.monsterAttack.attackTimer) {
            clearTimeout(this.monsterAttack.attackTimer);
            this.monsterAttack.attackTimer = null;
        }
        
        if (this.monsterAttackState && this.monsterAttackState.warningTimer) {
            clearInterval(this.monsterAttackState.warningTimer);
            this.monsterAttackState.warningTimer = null;
        }
        
        // 重置所有狀態
        this.monsterAttack.isWarning = false;
        this.monsterAttack.isAttacking = false;
        
        // 移除UI元素
        const playerPanel = document.querySelector('.player-status-panel');
        if (playerPanel) {
            playerPanel.remove();
        }
        
        const attackWarning = document.querySelector('.attack-warning');
        if (attackWarning) {
            attackWarning.remove();
        }
        
        const deathScreen = document.querySelector('.death-screen');
        if (deathScreen) {
            deathScreen.remove();
        }
    }
}

// 導出 MonsterAttackSystem 類
export { MonsterAttackSystem };