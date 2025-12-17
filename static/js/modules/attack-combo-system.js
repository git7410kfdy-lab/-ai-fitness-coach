/**
 * Attack Combo System Module
 * 處理攻擊音效、文字特效和combo計數系統
 * 注意：這個combo系統與現有的技能combo系統是分開的
 */

class AttackComboSystem {
    constructor() {
        this.attackComboCount = 0; // 攻擊combo計數（與技能combo分開）
        this.lastAttackTime = 0;
        this.comboResetTimeout = 3000; // 3秒沒有攻擊就重置combo
        this.comboResetTimer = null;
        
        // 音效文件路徑配置（按讚美程度遞增）
        this.comboSounds = [
            '/static/Game_Audio/很好.mp3',
            '/static/Game_Audio/不錯.mp3', 
            '/static/Game_Audio/太棒了.mp3',
            '/static/Game_Audio/太厲害了.mp3',
            '/static/Game_Audio/十分完美.mp3',
            '/static/Game_Audio/做得太漂亮了.mp3',
            '/static/Game_Audio/真是個天才.mp3'
        ];
        
        // 對應的文字特效
        this.comboTexts = [
            '很好！',
            '不錯！',
            '太棒了！',
            '太厲害了！',
            '十分完美！',
            '做得太漂亮了！',
            '真是個天才！'
        ];
        
        // 音效對象緩存
        this.audioCache = new Map();
        
        // 初始化
        this.init();
    }
    
    init() {
        console.log('[AttackComboSystem] 初始化攻擊音效combo系統');
        this.preloadAudio();
        this.createComboDisplay();
    }
    
    // 預加載音效文件
    preloadAudio() {
        console.log('[AttackComboSystem] 開始預加載音效文件');
        
        this.comboSounds.forEach((soundPath, index) => {
            const audio = new Audio(soundPath);
            audio.preload = 'auto';
            audio.volume = 0.7; // 設置音量
            
            // 處理加載成功
            audio.addEventListener('canplaythrough', () => {
                // 音效加載成功
            });
            
            // 處理加載錯誤
            audio.addEventListener('error', (e) => {
                console.error(`[AttackComboSystem] 音效 ${index + 1} 加載失敗: ${soundPath}`, e);
            });
            
            this.audioCache.set(index, audio);
        });
    }
    
    // 創建combo顯示元素
    createComboDisplay() {
        // 檢查是否已存在
        if (document.getElementById('attack-combo-display')) {
            return;
        }
        
        const comboDisplay = document.createElement('div');
        comboDisplay.id = 'attack-combo-display';
        comboDisplay.className = 'attack-combo-display';
        comboDisplay.innerHTML = `
            <div class="attack-combo-count">攻擊連擊: <span id="attack-combo-number">0</span></div>
        `;
        
        // 添加到怪物區域
        const monsterArea = document.querySelector('.monster-area');
        if (monsterArea) {
            monsterArea.appendChild(comboDisplay);
            console.log('[AttackComboSystem] Combo顯示元素已創建');
        } else {
            console.error('[AttackComboSystem] 找不到怪物區域，無法添加combo顯示');
        }
        
        // 添加CSS樣式
        this.addComboStyles();
    }
    
    // 添加CSS樣式
    addComboStyles() {
        if (document.getElementById('attack-combo-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'attack-combo-styles';
        style.textContent = `
            .attack-combo-display {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                z-index: 1000;
                border: 2px solid #4CAF50;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
            }
            
            .attack-combo-display.combo-active {
                transform: scale(1.1);
                border-color: #FF5722;
                box-shadow: 0 4px 20px rgba(255, 87, 34, 0.5);
            }
            
            .attack-combo-count {
                margin: 0;
            }
            
            #attack-combo-number {
                color: #4CAF50;
                font-size: 16px;
            }
            
            .attack-combo-display.combo-active #attack-combo-number {
                color: #FF5722;
            }
            
            .attack-text-effect {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
                font-weight: bold;
                color: #FF5722;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
                z-index: 2000;
                pointer-events: none;
                animation: attackTextEffect 2s ease-out forwards;
            }
            
            @keyframes attackTextEffect {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(0.5);
                }
                20% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.2);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -80px) scale(1);
                }
            }
            
            .attack-text-effect.combo-high {
                color: #FFD700;
                font-size: 28px;
                text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.9);
            }
            
            .attack-text-effect.combo-max {
                color: #FF1744;
                font-size: 32px;
                text-shadow: 2px 2px 8px rgba(0, 0, 0, 1);
                animation: attackTextEffectMax 2.5s ease-out forwards;
            }
            
            @keyframes attackTextEffectMax {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(0.3) rotate(-10deg);
                }
                15% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.5) rotate(5deg);
                }
                30% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.2) rotate(-2deg);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -100px) scale(1) rotate(0deg);
                }
            }
        `;
        
        document.head.appendChild(style);
        console.log('[AttackComboSystem] CSS樣式已添加');
    }
    
    // 觸發攻擊（主要入口函數）
    triggerAttack() {
        const currentTime = Date.now();
        
        // 檢查是否在combo時間窗口內
        if (currentTime - this.lastAttackTime <= this.comboResetTimeout) {
            this.attackComboCount++;
        } else {
            // 重置combo
            this.attackComboCount = 1;
        }
        
        this.lastAttackTime = currentTime;
        
        // 更新顯示
        this.updateComboDisplay();
        
        // 播放音效
        this.playComboSound();
        
        // 顯示文字特效
        this.showTextEffect();
        
        // 重置combo計時器
        this.resetComboTimer();
    }
    
    // 更新combo顯示
    updateComboDisplay() {
        const comboNumber = document.getElementById('attack-combo-number');
        const comboDisplay = document.getElementById('attack-combo-display');
        
        if (comboNumber) {
            comboNumber.textContent = this.attackComboCount;
        }
        
        if (comboDisplay) {
            // 添加動畫效果
            comboDisplay.classList.add('combo-active');
            setTimeout(() => {
                comboDisplay.classList.remove('combo-active');
            }, 500);
        }
    }
    
    // 播放combo音效
    playComboSound() {
        // 根據combo數選擇音效（最高到第7級）
        const soundIndex = Math.min(this.attackComboCount - 1, this.comboSounds.length - 1);
        const audio = this.audioCache.get(soundIndex);
        
        if (audio) {
            // 重置音效到開始位置
            audio.currentTime = 0;
            
            // 播放音效
            audio.play().catch(error => {
                console.error(`[AttackComboSystem] 播放音效失敗 (combo ${this.attackComboCount}):`, error);
            });
        } else {
            console.error(`[AttackComboSystem] 找不到音效文件 (combo ${this.attackComboCount})`);
        }
    }
    
    // 顯示文字特效
    showTextEffect() {
        const textIndex = Math.min(this.attackComboCount - 1, this.comboTexts.length - 1);
        const text = this.comboTexts[textIndex];
        
        // 創建文字特效元素
        const textEffect = document.createElement('div');
        textEffect.className = 'attack-text-effect';
        textEffect.textContent = text;
        
        // 根據combo數添加不同的樣式
        if (this.attackComboCount >= 6) {
            textEffect.classList.add('combo-max');
        } else if (this.attackComboCount >= 4) {
            textEffect.classList.add('combo-high');
        }
        
        // 添加到怪物容器
        const monsterContainer = document.getElementById('monster-container');
        if (monsterContainer) {
            monsterContainer.appendChild(textEffect);
            
            // 2.5秒後移除元素
            setTimeout(() => {
                if (textEffect.parentNode) {
                    textEffect.parentNode.removeChild(textEffect);
                }
            }, 2500);
            
        } else {
            console.error('[AttackComboSystem] 找不到怪物容器，無法顯示文字特效');
        }
    }
    
    // 重置combo計時器
    resetComboTimer() {
        // 清除現有計時器
        if (this.comboResetTimer) {
            clearTimeout(this.comboResetTimer);
        }
        
        // 設置新的計時器
        this.comboResetTimer = setTimeout(() => {
            this.resetCombo();
        }, this.comboResetTimeout);
    }
    
    // 重置combo
    resetCombo() {
        if (this.attackComboCount > 0) {
            console.log(`[AttackComboSystem] Combo重置，之前的combo數: ${this.attackComboCount}`);
            this.attackComboCount = 0;
            this.updateComboDisplay();
        }
        
        if (this.comboResetTimer) {
            clearTimeout(this.comboResetTimer);
            this.comboResetTimer = null;
        }
    }
    
    // 手動重置combo（用於遊戲重置等情況）
    manualReset() {
        this.resetCombo();
        this.lastAttackTime = 0;
        console.log('[AttackComboSystem] 手動重置combo系統');
    }
    
    // 獲取當前combo數
    getCurrentCombo() {
        return this.attackComboCount;
    }
    
    // 銷毀系統
    destroy() {
        // 清除計時器
        if (this.comboResetTimer) {
            clearTimeout(this.comboResetTimer);
        }
        
        // 停止所有音效
        this.audioCache.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // 清除緩存
        this.audioCache.clear();
        
        // 移除DOM元素
        const comboDisplay = document.getElementById('attack-combo-display');
        if (comboDisplay) {
            comboDisplay.remove();
        }
        
        const styles = document.getElementById('attack-combo-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('[AttackComboSystem] 攻擊音效combo系統已銷毀');
    }
}

// 導出模塊
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttackComboSystem;
}

// 設置為全局變量
window.AttackComboSystem = AttackComboSystem;

console.log('[AttackComboSystem] 模塊已加載');