/**
 * UI Manager Module
 * 負責管理所有 UI 相關功能，包括顯示更新、通知、模態視窗等
 */

class UIManager {
    constructor() {
        // UI 元素引用
        this.elements = {
            // 視頻相關
            videoElement: null,
            canvasElement: null,
            
            // 控制按鈕
            startBtn: null,
            stopBtn: null,
            resetBtn: null,
            switchExerciseBtn: null,
            
            // 顯示元素
            detectionStatus: null,
            currentExerciseName: null,
            exerciseCount: null,
            qualityScore: null,
            coachTip: null,
            angleDisplay: null,
            
            // 遊戲 UI
            currentLevel: null,
            monsterCount: null,
            monsterName: null,
            monsterHPBar: null,
            monsterHPText: null,
            monsterShieldBar: null,
            monsterShieldText: null,
            remainingSets: null,
            comboCount: null,
            comboMultiplier: null,
            
            // 地圖相關
            miniMap: null,
            fullMap: null,
            mapModal: null,
            
            // 運動選擇
            exerciseTypeSelect: null,
            
            // 參數輸入
            weightInput: null,
            repsInput: null,
            setsInput: null
        };
        
        // 通知系統
        this.notifications = [];
        this.maxNotifications = 5;
        
        // 模態視窗狀態
        this.modals = {
            mapModal: false,
            basketballPrompt: false
        };
        
        // 動畫狀態
        this.animations = {
            hpBarAnimation: null,
            shieldBarAnimation: null
        };
    }

    /**
     * 初始化 UI 管理器
     */
    init() {
        console.log('初始化 UI 管理器');
        this.cacheElements();
        this.setupEventListeners();
        this.initializeStyles();
    }

    /**
     * 緩存 DOM 元素
     */
    cacheElements() {
        // 視頻相關
        this.elements.videoElement = document.getElementById('video');
        this.elements.canvasElement = document.getElementById('canvas');
        
        // 控制按鈕
        this.elements.startBtn = document.getElementById('start-btn');
        this.elements.stopBtn = document.getElementById('stop-btn');
        this.elements.resetBtn = document.getElementById('reset-btn');
        this.elements.switchExerciseBtn = document.getElementById('switch-exercise-btn');
        
        // 顯示元素
        this.elements.detectionStatus = document.getElementById('detection-status');
        this.elements.currentExerciseName = document.getElementById('current-exercise-name');
        this.elements.exerciseCount = document.getElementById('exercise-count');
        this.elements.qualityScore = document.getElementById('quality-score');
        this.elements.coachTip = document.getElementById('coach-tip');
        this.elements.angleDisplay = document.getElementById('angle-display');
        
        // 遊戲 UI
        this.elements.currentLevel = document.getElementById('current-level');
        this.elements.monsterCount = document.getElementById('monster-count');
        this.elements.monsterName = document.getElementById('monster-name');
        this.elements.monsterHPBar = document.getElementById('monster-hp-bar');
        this.elements.monsterHPText = document.getElementById('monster-hp-text');
        this.elements.monsterShieldBar = document.getElementById('monster-shield-bar');
        this.elements.monsterShieldText = document.getElementById('monster-shield-text');
        this.elements.remainingSets = document.getElementById('remaining-sets');
        this.elements.comboCount = document.getElementById('combo-count');
        this.elements.comboMultiplier = document.getElementById('combo-multiplier');
        
        // 地圖相關
        this.elements.miniMap = document.getElementById('mini-map');
        this.elements.fullMap = document.getElementById('full-map');
        this.elements.mapModal = document.getElementById('map-modal');
        
        // 運動選擇
        this.elements.exerciseTypeSelect = document.getElementById('exercise-type');
        
        // 參數輸入
        this.elements.weightInput = document.getElementById('weight');
        this.elements.repsInput = document.getElementById('reps');
        this.elements.setsInput = document.getElementById('sets');
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 地圖模態視窗
        const openMapBtn = document.getElementById('open-map-btn');
        const closeMapBtn = document.getElementById('close-map-btn');
        const startChallengeBtn = document.getElementById('start-challenge-btn');
        
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => this.showMapModal());
        }
        
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => this.hideMapModal());
        }
        
        if (startChallengeBtn) {
            startChallengeBtn.addEventListener('click', () => this.handleStartChallenge());
        }
        
        // 籃球提示視窗
        const closeBasketballPromptBtn = document.getElementById('close-basketball-prompt');
        if (closeBasketballPromptBtn) {
            closeBasketballPromptBtn.addEventListener('click', () => this.closeBasketballPrompt());
        }
    }

    /**
     * 初始化樣式
     */
    initializeStyles() {
        // 確保必要的樣式已加載
        this.addCustomStyles();
    }

    /**
     * 更新視頻幀
     */
    updateVideoFrame(base64Frame) {
        if (this.elements.videoElement) {
            this.elements.videoElement.src = 'data:image/jpeg;base64,' + base64Frame;
        }
    }

    /**
     * 更新偵測狀態
     */
    updateDetectionStatus(status, exerciseName = '') {
        if (this.elements.detectionStatus) {
            this.elements.detectionStatus.textContent = status;
            this.elements.detectionStatus.className = status === '偵測中...' ? 'status-active' : 'status-inactive';
        }
        
        if (this.elements.currentExerciseName && exerciseName) {
            this.elements.currentExerciseName.textContent = exerciseName;
        }
    }

    /**
     * 更新運動計數
     */
    updateExerciseCount(count) {
        if (this.elements.exerciseCount) {
            this.elements.exerciseCount.textContent = count;
            
            // 添加動畫效果
            this.elements.exerciseCount.classList.add('count-update');
            setTimeout(() => {
                this.elements.exerciseCount.classList.remove('count-update');
            }, 300);
        }
    }

    /**
     * 更新品質分數
     */
    updateQualityScore(score, title = '', isHolding = false) {
        if (this.elements.qualityScore) {
            // 顯示分數和holding狀態
            let displayText = score;
            if (isHolding && score >= 3) {
                displayText += ' 🛡️'; // 添加盾牌圖標表示holding狀態
            }
            this.elements.qualityScore.textContent = displayText;
            
            // 根據分數設置顏色
            this.elements.qualityScore.className = this.getQualityScoreClass(score);
            
            // 如果是holding狀態，添加特殊樣式
            if (isHolding && score >= 3) {
                this.elements.qualityScore.classList.add('holding-state');
            } else {
                this.elements.qualityScore.classList.remove('holding-state');
            }
        }
        
        // 更新頁面標題
        if (title) {
            document.title = title;
        }
    }

    /**
     * 獲取品質分數樣式類
     */
    getQualityScoreClass(score) {
        const numScore = parseFloat(score);
        if (numScore >= 80) return 'quality-excellent';
        if (numScore >= 60) return 'quality-good';
        if (numScore >= 40) return 'quality-fair';
        return 'quality-poor';
    }

    /**
     * 更新教練提示
     */
    updateCoachTip(tip) {
        if (this.elements.coachTip) {
            this.elements.coachTip.textContent = tip;
            
            // 添加閃爍效果
            this.elements.coachTip.classList.add('tip-update');
            setTimeout(() => {
                this.elements.coachTip.classList.remove('tip-update');
            }, 1000);
        }
    }

    /**
     * 更新角度顯示
     */
    updateAngleDisplay(angles) {
        if (this.elements.angleDisplay && angles) {
            let angleText = '';
            for (const [joint, angle] of Object.entries(angles)) {
                angleText += `${joint}: ${angle}° `;
            }
            this.elements.angleDisplay.textContent = angleText;
        }
    }

    /**
     * 更新怪物血量
     */
    updateMonsterHP(currentHP, maxHP, animated = true) {
        if (this.elements.monsterHPBar && this.elements.monsterHPText) {
            const percentage = (currentHP / maxHP) * 100;
            
            if (animated) {
                // 清除之前的動畫
                if (this.animations.hpBarAnimation) {
                    clearTimeout(this.animations.hpBarAnimation);
                }
                
                // 添加動畫效果
                this.elements.monsterHPBar.style.transition = 'width 0.5s ease-out';
                this.animations.hpBarAnimation = setTimeout(() => {
                    this.elements.monsterHPBar.style.transition = '';
                }, 500);
            }
            
            this.elements.monsterHPBar.style.width = `${percentage}%`;
            this.elements.monsterHPText.textContent = `${currentHP}/${maxHP}`;
            
            // 根據血量設置顏色
            if (percentage > 60) {
                this.elements.monsterHPBar.style.backgroundColor = '#4CAF50';
            } else if (percentage > 30) {
                this.elements.monsterHPBar.style.backgroundColor = '#FF9800';
            } else {
                this.elements.monsterHPBar.style.backgroundColor = '#F44336';
            }
        }
    }

    /**
     * 更新怪物護盾
     */
    updateMonsterShield(currentShield, maxShield, animated = true) {
        if (this.elements.monsterShieldBar && this.elements.monsterShieldText) {
            const percentage = maxShield > 0 ? (currentShield / maxShield) * 100 : 0;
            
            if (animated) {
                // 清除之前的動畫
                if (this.animations.shieldBarAnimation) {
                    clearTimeout(this.animations.shieldBarAnimation);
                }
                
                // 添加動畫效果
                this.elements.monsterShieldBar.style.transition = 'width 0.3s ease-out';
                this.animations.shieldBarAnimation = setTimeout(() => {
                    this.elements.monsterShieldBar.style.transition = '';
                }, 300);
            }
            
            this.elements.monsterShieldBar.style.width = `${percentage}%`;
            this.elements.monsterShieldText.textContent = `${currentShield}/${maxShield}`;
        }
    }

    /**
     * 更新關卡顯示
     */
    updateLevelDisplay(level, monsterIndex, totalMonsters, monsterName) {
        if (this.elements.currentLevel) {
            this.elements.currentLevel.textContent = `關卡 ${level}`;
        }
        
        if (this.elements.monsterCount) {
            this.elements.monsterCount.textContent = `${monsterIndex + 1}/${totalMonsters}`;
        }
        
        if (this.elements.monsterName) {
            this.elements.monsterName.textContent = monsterName;
        }
    }

    /**
     * 更新剩餘組數
     */
    updateRemainingSets(remaining) {
        if (this.elements.remainingSets) {
            this.elements.remainingSets.textContent = remaining;
        }
    }

    /**
     * 更新 Combo 顯示
     */
    updateCombo(count, multiplier) {
        if (this.elements.comboCount) {
            this.elements.comboCount.textContent = count;
        }
        
        if (this.elements.comboMultiplier) {
            this.elements.comboMultiplier.textContent = `${multiplier.toFixed(1)}x`;
            
            // 根據倍數設置顏色
            if (multiplier > 1.5) {
                this.elements.comboMultiplier.style.color = '#FF5722';
            } else if (multiplier > 1.2) {
                this.elements.comboMultiplier.style.color = '#FF9800';
            } else {
                this.elements.comboMultiplier.style.color = '#4CAF50';
            }
        }
    }

    /**
     * 顯示通知
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加到通知容器
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        this.notifications.push(notification);
        
        // 限制通知數量
        if (this.notifications.length > this.maxNotifications) {
            const oldNotification = this.notifications.shift();
            if (oldNotification.parentNode) {
                oldNotification.parentNode.removeChild(oldNotification);
            }
        }
        
        // 顯示動畫
        setTimeout(() => {
            notification.classList.add('notification-show');
        }, 10);
        
        // 自動隱藏
        setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
    }

    /**
     * 隱藏通知
     */
    hideNotification(notification) {
        if (notification && notification.parentNode) {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                const index = this.notifications.indexOf(notification);
                if (index > -1) {
                    this.notifications.splice(index, 1);
                }
            }, 300);
        }
    }

    /**
     * 顯示 Toast 訊息
     */
    showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 顯示動畫
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);
        
        // 自動隱藏
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    /**
     * 顯示地圖模態視窗
     */
    showMapModal() {
        if (this.elements.mapModal) {
            this.elements.mapModal.style.display = 'block';
            this.modals.mapModal = true;
            
            // 添加顯示動畫
            setTimeout(() => {
                this.elements.mapModal.classList.add('modal-show');
            }, 10);
        }
    }

    /**
     * 隱藏地圖模態視窗
     */
    hideMapModal() {
        if (this.elements.mapModal) {
            this.elements.mapModal.classList.remove('modal-show');
            
            setTimeout(() => {
                this.elements.mapModal.style.display = 'none';
                this.modals.mapModal = false;
            }, 300);
        }
    }

    /**
     * 處理開始挑戰
     */
    handleStartChallenge() {
        // 獲取選中的關卡
        const selectedLevel = document.querySelector('.level-item.selected');
        if (selectedLevel) {
            const levelId = parseInt(selectedLevel.dataset.levelId);
            
            // 觸發自定義事件
            const event = new CustomEvent('startChallenge', {
                detail: { levelId: levelId }
            });
            document.dispatchEvent(event);
            
            this.hideMapModal();
        }
    }

    /**
     * 顯示籃球提示視窗
     */
    showBasketballPrompt() {
        const prompt = document.getElementById('basketball-prompt');
        if (prompt) {
            prompt.style.display = 'block';
            this.modals.basketballPrompt = true;
        }
    }

    /**
     * 關閉籃球提示視窗
     */
    closeBasketballPrompt() {
        const prompt = document.getElementById('basketball-prompt');
        if (prompt) {
            prompt.style.display = 'none';
            this.modals.basketballPrompt = false;
        }
    }

    /**
     * 高亮顯示當前關卡
     */
    highlightCurrentLevel(levelId) {
        // 小地圖高亮
        const miniMapLevels = document.querySelectorAll('.mini-map .level-dot');
        miniMapLevels.forEach(dot => {
            dot.classList.remove('current');
            if (parseInt(dot.dataset.levelId) === levelId) {
                dot.classList.add('current');
            }
        });
        
        // 詳細地圖高亮
        const fullMapLevels = document.querySelectorAll('.full-map .level-item');
        fullMapLevels.forEach(item => {
            item.classList.remove('current');
            if (parseInt(item.dataset.levelId) === levelId) {
                item.classList.add('current');
            }
        });
    }

    /**
     * 添加自定義樣式
     */
    addCustomStyles() {
        if (document.getElementById('ui-manager-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'ui-manager-styles';
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 300px;
            }
            
            .notification {
                background: #333;
                color: white;
                padding: 12px 16px;
                margin-bottom: 10px;
                border-radius: 4px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }
            
            .notification-show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .notification-hide {
                opacity: 0;
                transform: translateX(100%);
            }
            
            .notification-success {
                background: #4CAF50;
            }
            
            .notification-error {
                background: #F44336;
            }
            
            .notification-warning {
                background: #FF9800;
            }
            
            .toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 24px;
                border-radius: 20px;
                z-index: 10000;
                transition: all 0.3s ease;
                opacity: 0;
            }
            
            .toast-show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .toast-hide {
                opacity: 0;
                transform: translateX(-50%) translateY(100%);
            }
            
            .count-update {
                animation: countPulse 0.3s ease;
            }
            
            @keyframes countPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            
            .tip-update {
                animation: tipBlink 1s ease;
            }
            
            @keyframes tipBlink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .quality-excellent { color: #4CAF50; }
            .quality-good { color: #8BC34A; }
            .quality-fair { color: #FF9800; }
            .quality-poor { color: #F44336; }
            
            .status-active {
                color: #4CAF50;
                font-weight: bold;
            }
            
            .status-inactive {
                color: #666;
            }
            
            .modal-show {
                animation: modalFadeIn 0.3s ease;
            }
            
            @keyframes modalFadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 獲取訓練參數
     */
    getTrainingParams() {
        return {
            weight: this.elements.weightInput ? parseFloat(this.elements.weightInput.value) || 0 : 0,
            reps: this.elements.repsInput ? parseInt(this.elements.repsInput.value) || 10 : 10,
            sets: this.elements.setsInput ? parseInt(this.elements.setsInput.value) || 3 : 3
        };
    }

    /**
     * 獲取當前運動類型
     */
    getCurrentExerciseType() {
        return this.elements.exerciseTypeSelect ? this.elements.exerciseTypeSelect.value : 'squat';
    }

    /**
     * 設置運動類型
     */
    setExerciseType(exerciseType) {
        if (this.elements.exerciseTypeSelect) {
            this.elements.exerciseTypeSelect.value = exerciseType;
        }
    }
}

// 導出 UIManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else {
    window.UIManager = UIManager;
}