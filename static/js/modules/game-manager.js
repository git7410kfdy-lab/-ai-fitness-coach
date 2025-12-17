/**
 * Game Manager Module
 * 負責管理遊戲相關功能，包括怪物系統、關卡管理、血量護盾等
 */

class GameManager {
    constructor() {
        // 遊戲狀態
        this.currentLevel = 1;
        this.currentMonsterIndex = 0;
        this.totalMonsters = 3;
        this.exerciseCounter = 0;
        this.remainingSets = 0;
        this.completedSets = 0;
        this.targetSets = 3;
        this.targetReps = 10;
        this.currentWeight = 0;
        
        // 怪物系統
        this.monsters = [
            { name: '史萊姆', maxHP: 100, currentHP: 100, shield: 0, maxShield: 50, defeated: false },
            { name: '哥布林', maxHP: 150, currentHP: 150, shield: 0, maxShield: 75, defeated: false },
            { name: '獸人', maxHP: 200, currentHP: 200, shield: 0, maxShield: 100, defeated: false }
        ];
        
        // Combo 系統
        this.comboCount = 0;
        this.lastExerciseType = null;
        this.comboMultiplier = 1;
        this.maxCombo = 10;
        
        // 經驗值系統
        this.experienceGained = 0;
        this.baseExperience = 10;
        
        // 關卡數據
        this.levels = [
            { id: 1, name: '新手村', monsters: 3, description: '適合初學者的訓練場地' },
            { id: 2, name: '森林', monsters: 4, description: '充滿挑戰的森林訓練' },
            { id: 3, name: '山洞', monsters: 5, description: '黑暗中的力量考驗' },
            { id: 4, name: '城堡', monsters: 6, description: '最終的王者挑戰' }
        ];
        
        // 事件回調
        this.callbacks = {
            onMonsterDefeated: null,
            onLevelCompleted: null,
            onHPChanged: null,
            onShieldChanged: null,
            onComboChanged: null,
            onExperienceGained: null
        };
    }

    /**
     * 初始化遊戲系統
     */
    init() {
        console.log('初始化遊戲系統');
        this.resetLevel();
        this.updateUI();
    }

    /**
     * 重置關卡
     */
    resetLevel() {
        this.currentMonsterIndex = 0;
        this.exerciseCounter = 0;
        this.comboCount = 0;
        this.lastExerciseType = null;
        this.comboMultiplier = 1;
        
        // 重置所有怪物
        this.monsters.forEach(monster => {
            monster.currentHP = monster.maxHP;
            monster.shield = 0;
            monster.defeated = false;
        });
        
        this.updateUI();
    }

    /**
     * 初始化新關卡
     */
    initLevel(levelId) {
        console.log(`初始化關卡 ${levelId}`);
        
        const level = this.levels.find(l => l.id === levelId);
        if (!level) {
            console.error('找不到指定關卡:', levelId);
            return false;
        }
        
        this.currentLevel = levelId;
        this.totalMonsters = level.monsters;
        
        // 根據關卡調整怪物數量
        while (this.monsters.length < this.totalMonsters) {
            const baseMonster = this.monsters[this.monsters.length % 3];
            const newMonster = {
                name: baseMonster.name + ' Lv.' + (Math.floor(this.monsters.length / 3) + 1),
                maxHP: baseMonster.maxHP + (levelId - 1) * 50,
                currentHP: baseMonster.maxHP + (levelId - 1) * 50,
                shield: 0,
                maxShield: baseMonster.maxShield + (levelId - 1) * 25,
                defeated: false
            };
            this.monsters.push(newMonster);
        }
        
        this.resetLevel();
        return true;
    }

    /**
     * 減少怪物血量
     */
    decreaseMonsterHP(damage = 10) {
        if (this.currentMonsterIndex >= this.totalMonsters) {
            console.log('所有怪物已被擊敗');
            return false;
        }
        
        const monster = this.monsters[this.currentMonsterIndex];
        if (monster.defeated) {
            console.log('當前怪物已被擊敗');
            return false;
        }
        
        // 應用 Combo 倍數
        const actualDamage = Math.floor(damage * this.comboMultiplier);
        
        // 先扣除護盾
        if (monster.shield > 0) {
            const shieldDamage = Math.min(monster.shield, actualDamage);
            monster.shield -= shieldDamage;
            const remainingDamage = actualDamage - shieldDamage;
            
            if (remainingDamage > 0) {
                monster.currentHP = Math.max(0, monster.currentHP - remainingDamage);
            }
        } else {
            monster.currentHP = Math.max(0, monster.currentHP - actualDamage);
        }
        
        console.log(`怪物 ${monster.name} 受到 ${actualDamage} 點傷害，剩餘血量: ${monster.currentHP}`);
        
        // 檢查怪物是否被擊敗
        if (monster.currentHP <= 0) {
            this.defeatMonster();
        }
        
        this.updateUI();
        
        if (this.callbacks.onHPChanged) {
            this.callbacks.onHPChanged(monster, actualDamage);
        }
        
        return true;
    }

    /**
     * 擊敗怪物
     */
    defeatMonster() {
        const monster = this.monsters[this.currentMonsterIndex];
        monster.defeated = true;
        
        console.log(`擊敗了 ${monster.name}!`);
        
        // 獲得經驗值
        const exp = this.baseExperience + (this.currentLevel - 1) * 5;
        this.experienceGained += exp;
        
        if (this.callbacks.onMonsterDefeated) {
            this.callbacks.onMonsterDefeated(monster, exp);
        }
        
        // 移動到下一個怪物
        this.currentMonsterIndex++;
        
        // 檢查是否完成關卡
        if (this.currentMonsterIndex >= this.totalMonsters) {
            this.completeLevel();
        } else {
            // 重置運動計數器
            this.exerciseCounter = 0;
        }
    }

    /**
     * 完成關卡
     */
    completeLevel() {
        console.log(`完成關卡 ${this.currentLevel}!`);
        
        if (this.callbacks.onLevelCompleted) {
            this.callbacks.onLevelCompleted(this.currentLevel, this.experienceGained);
        }
    }

    /**
     * 增加怪物護盾
     */
    addMonsterShield(amount = 10) {
        if (this.currentMonsterIndex >= this.totalMonsters) {
            return false;
        }
        
        const monster = this.monsters[this.currentMonsterIndex];
        if (monster.defeated) {
            return false;
        }
        
        monster.shield = Math.min(monster.maxShield, monster.shield + amount);
        
        console.log(`怪物 ${monster.name} 獲得 ${amount} 點護盾，當前護盾: ${monster.shield}`);
        
        this.updateUI();
        
        if (this.callbacks.onShieldChanged) {
            this.callbacks.onShieldChanged(monster, amount);
        }
        
        return true;
    }

    /**
     * 檢查運動連擊
     */
    checkExerciseCombo(exerciseType) {
        if (this.lastExerciseType === exerciseType) {
            this.comboCount++;
        } else {
            this.comboCount = 1;
            this.lastExerciseType = exerciseType;
        }
        
        // 計算連擊倍數
        this.comboMultiplier = 1 + Math.min(this.comboCount - 1, this.maxCombo - 1) * 0.1;
        
        console.log(`運動連擊: ${this.comboCount}, 傷害倍數: ${this.comboMultiplier.toFixed(1)}x`);
        
        if (this.callbacks.onComboChanged) {
            this.callbacks.onComboChanged(this.comboCount, this.comboMultiplier);
        }
        
        return this.comboMultiplier;
    }

    /**
     * 重置連擊
     */
    resetCombo() {
        this.comboCount = 0;
        this.lastExerciseType = null;
        this.comboMultiplier = 1;
        
        if (this.callbacks.onComboChanged) {
            this.callbacks.onComboChanged(this.comboCount, this.comboMultiplier);
        }
    }

    /**
     * 更新運動計數
     */
    updateExerciseCount(count) {
        this.exerciseCounter = count;
        this.updateUI();
    }

    /**
     * 設置訓練參數
     */
    setTrainingParams(weight, reps, sets) {
        this.currentWeight = weight || 0;
        this.targetReps = reps || 10;
        this.targetSets = sets || 3;
        this.remainingSets = sets || 3;
        this.completedSets = 0;
    }

    /**
     * 完成一組訓練
     */
    completeSet() {
        if (this.remainingSets > 0) {
            this.remainingSets--;
            this.completedSets++;
            this.exerciseCounter = 0; // 重置計數器
            
            console.log(`完成一組訓練，剩餘組數: ${this.remainingSets}`);
            this.updateUI();
            
            return this.remainingSets === 0; // 返回是否完成所有組數
        }
        return false;
    }

    /**
     * 重置怪物
     */
    resetMonster() {
        if (this.currentMonsterIndex < this.totalMonsters) {
            const monster = this.monsters[this.currentMonsterIndex];
            monster.currentHP = monster.maxHP;
            monster.shield = 0;
            monster.defeated = false;
        }
        
        this.exerciseCounter = 0;
        this.resetCombo();
        this.updateUI();
    }

    /**
     * 更新 UI 顯示
     */
    updateUI() {
        // 更新關卡顯示
        const levelElement = document.getElementById('current-level');
        if (levelElement) {
            levelElement.textContent = `關卡 ${this.currentLevel}`;
        }
        
        // 更新怪物計數
        const monsterCountElement = document.getElementById('monster-count');
        if (monsterCountElement) {
            monsterCountElement.textContent = `${this.currentMonsterIndex + 1}/${this.totalMonsters}`;
        }
        
        // 更新當前怪物血量
        if (this.currentMonsterIndex < this.totalMonsters) {
            const monster = this.monsters[this.currentMonsterIndex];
            
            // 更新血量條
            const hpBar = document.getElementById('monster-hp-bar');
            const hpText = document.getElementById('monster-hp-text');
            if (hpBar && hpText) {
                const hpPercentage = (monster.currentHP / monster.maxHP) * 100;
                hpBar.style.width = `${hpPercentage}%`;
                hpText.textContent = `${monster.currentHP}/${monster.maxHP}`;
            }
            
            // 更新護盾條
            const shieldBar = document.getElementById('monster-shield-bar');
            const shieldText = document.getElementById('monster-shield-text');
            if (shieldBar && shieldText) {
                const shieldPercentage = monster.maxShield > 0 ? (monster.shield / monster.maxShield) * 100 : 0;
                shieldBar.style.width = `${shieldPercentage}%`;
                shieldText.textContent = `${monster.shield}/${monster.maxShield}`;
            }
            
            // 更新怪物名稱
            const monsterNameElement = document.getElementById('monster-name');
            if (monsterNameElement) {
                monsterNameElement.textContent = monster.name;
            }
        }
        
        // 更新運動計數
        const exerciseCountElement = document.getElementById('exercise-count');
        if (exerciseCountElement) {
            exerciseCountElement.textContent = this.exerciseCounter;
        }
        
        // 更新剩餘組數
        const remainingSetsElement = document.getElementById('remaining-sets');
        if (remainingSetsElement) {
            remainingSetsElement.textContent = this.remainingSets;
        }
        
        // 更新 Combo 顯示
        const comboElement = document.getElementById('combo-count');
        const comboMultiplierElement = document.getElementById('combo-multiplier');
        if (comboElement) {
            comboElement.textContent = this.comboCount;
        }
        if (comboMultiplierElement) {
            comboMultiplierElement.textContent = `${this.comboMultiplier.toFixed(1)}x`;
        }
    }

    /**
     * 獲取當前遊戲狀態
     */
    getGameState() {
        return {
            currentLevel: this.currentLevel,
            currentMonsterIndex: this.currentMonsterIndex,
            totalMonsters: this.totalMonsters,
            exerciseCounter: this.exerciseCounter,
            remainingSets: this.remainingSets,
            completedSets: this.completedSets,
            targetSets: this.targetSets,
            targetReps: this.targetReps,
            currentWeight: this.currentWeight,
            comboCount: this.comboCount,
            comboMultiplier: this.comboMultiplier,
            experienceGained: this.experienceGained,
            currentMonster: this.currentMonsterIndex < this.totalMonsters ? this.monsters[this.currentMonsterIndex] : null
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
     * 獲取關卡信息
     */
    getLevelInfo(levelId) {
        return this.levels.find(l => l.id === levelId);
    }

    /**
     * 獲取所有關卡
     */
    getAllLevels() {
        return this.levels;
    }
}

// 導出 GameManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
} else {
    window.GameManager = GameManager;
}