// Combo 技能系統模塊
// 從 realtime.js 中提取的 Combo 相關功能

// 顯示技能動畫
function showSkillAnimation(animationType) {
    const skillResult = document.getElementById('combo-skill-result');
    
    // 添加動畫類
    skillResult.classList.add('combo-skill-active');
    
    // 根據不同技能類型顯示不同動畫效果
    switch(animationType) {
        case 'muscle-burst':
            skillResult.style.backgroundColor = 'rgba(231, 76, 60, 0.3)';
            break;
        case 'shield-break':
            skillResult.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
            break;
        case 'power-up':
            skillResult.style.backgroundColor = 'rgba(241, 196, 15, 0.3)';
            break;
        case 'triple-power':
            skillResult.style.backgroundColor = 'rgba(155, 89, 182, 0.3)';
            break;
        default:
            skillResult.style.backgroundColor = 'rgba(46, 204, 113, 0.3)';
    }
    
    // 3秒後移除動畫效果
    setTimeout(() => {
        skillResult.classList.remove('combo-skill-active');
        skillResult.style.backgroundColor = '';
    }, 3000);
}

// 更新Combo顯示
function updateComboDisplay() {
    // 更新連擊計數
    comboCount.textContent = exerciseComboHistory.length;
    
    // 清空所有插槽
    clearComboSlots();
    
    // 填充已有的動作
    for (let i = 0; i < exerciseComboHistory.length; i++) {
        const exercise = exerciseComboHistory[i];
        const slot = document.getElementById(`combo-slot-${i+1}`);
        
        if (slot) {
            // 移除空插槽樣式
            slot.innerHTML = '';
            slot.classList.add('filled');
            
            // 根據運動類型添加圖標
            let icon = '';
            let exerciseName = '';
            
            switch(exercise) {
                case 'squat':
                    icon = '<i class="fas fa-chevron-down"></i>';
                    exerciseName = '深蹲';
                    break;
                case 'bicep-curl':
                    icon = '<i class="fas fa-dumbbell"></i>';
                    exerciseName = '二頭彎舉';
                    break;
                case 'shoulder-press':
                    icon = '<i class="fas fa-arrow-up"></i>';
                    exerciseName = '肩推';
                    break;
                case 'push-up':
                    icon = '<i class="fas fa-arrow-down"></i>';
                    exerciseName = '伏地挺身';
                    break;
                case 'pull-up':
                    icon = '<i class="fas fa-arrow-up"></i>';
                    exerciseName = '引體向上';
                    break;
                case 'dumbbell-row':
                    icon = '<i class="fas fa-dumbbell"></i>';
                    exerciseName = '啞鈴划船';
                    break;
                case 'table-tennis':
                    icon = '<i class="fas fa-table-tennis"></i>';
                    exerciseName = '桌球揮拍';
                    break;
                case 'basketball':
                    icon = '<i class="fas fa-basketball-ball"></i>';
                    exerciseName = '籃球投籃';
                    break;
                case 'basketball-dribble':
                    icon = '<i class="fas fa-basketball-ball"></i>';
                    exerciseName = '籃球運球';
                    break;
                default:
                    icon = '<i class="fas fa-running"></i>';
                    exerciseName = '未知運動';
            }
            
            slot.innerHTML = `
                <div class="combo-slot-icon">${icon}</div>
                <div class="combo-slot-exercise">${exerciseName}</div>
            `;
        }
    }
    
    // 檢查是否觸發技能
    checkComboSkill();
}

// 清空Combo插槽
function clearComboSlots() {
    for (let i = 1; i <= MAX_COMBO_HISTORY; i++) {
        const slot = document.getElementById(`combo-slot-${i}`);
        if (slot) {
            slot.innerHTML = '<div class="combo-slot-placeholder">空</div>';
            slot.classList.remove('filled');
        }
    }
}

// 初始化Combo系統
function initComboSystem() {
    console.log('初始化Combo技能系統');
    
    // 重置Combo狀態
    resetCombo();
    
    // 添加Combo樣式
    addComboStyles();
}

// 重置Combo
function resetCombo() {
    exerciseComboHistory = [];
    comboMultiplier = 1.0;
    lastExerciseType = null;
    updateComboDisplay();
}

// 添加運動到Combo
function addExerciseToCombo(exerciseType) {
    // 添加到歷史記錄
    exerciseComboHistory.push(exerciseType);
    
    // 限制歷史記錄長度
    if (exerciseComboHistory.length > MAX_COMBO_HISTORY) {
        exerciseComboHistory.shift();
    }
    
    // 更新顯示
    updateComboDisplay();
    
    // 更新上次運動類型
    lastExerciseType = exerciseType;
}


// 檢查Combo技能
function checkComboSkill() {
    for (const skill of Object.values(COMBO_SKILLS)) {
        if (arraysEqual(exerciseComboHistory.slice(-skill.sequence.length), skill.sequence)) {
            triggerComboSkill(skill);
            return;
        }
    }
}

// 觸發Combo技能
function triggerComboSkill(skill) {
    console.log(`觸發技能: ${skill.name}`);
    
    // 顯示技能效果
    showSkillAnimation(skill.name.toLowerCase().replace(' ', '-'));
    
    // 播放技能音效
    playSkillSound(skill.name);
    
    // 造成額外傷害
    updateMonsterHP(-skill.damage);
    
    // 顯示技能描述
    if (comboDescription) {
        comboDescription.textContent = `${skill.name}: ${skill.description}`;
        comboDescription.style.color = skill.color;
    }
    
    // 重置Combo
    setTimeout(() => {
        resetCombo();
    }, 2000);
}

// 播放技能音效
function playSkillSound(skillName) {
    // 這裡可以添加音效播放邏輯
    console.log(`播放技能音效: ${skillName}`);
}

// 數組比較函數
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

// 添加Combo樣式
function addComboStyles() {
    // 這裡可以添加動態樣式
    console.log('添加Combo樣式');
}

// 導出函數
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showSkillAnimation,
        updateComboDisplay,
        clearComboSlots,
        initComboSystem,
        resetCombo,
        addExerciseToCombo,
        checkComboSkill,
        triggerComboSkill,
        playSkillSound,
        arraysEqual,
        addComboStyles
    };
}