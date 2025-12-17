// 遊戲邏輯模塊 - 處理怪物血量、護盾、對話等遊戲核心功能

// ==================== 怪物血量系統 ====================

// 初始化關卡函數
function initLevel(levelId) {
    console.log(`初始化第 ${levelId} 關`);
    
    // 設置當前關卡
    currentLevel = levelId;
    
    // 根據關卡設置怪物血量和護盾
    const levelConfig = {
        1: { hp: 70, shield: 50 },
        2: { hp: 100, shield: 75 },
        3: { hp: 140, shield: 100 }
    };
    
    const config = levelConfig[levelId] || levelConfig[1];
    
    // 重置怪物狀態
    monsterHP = config.hp;
    maxMonsterHP = config.hp;
    initialMonsterHP = config.hp;  // 添加這行來正確設置初始血量
    monsterShield = config.shield;
    maxMonsterShield = config.shield;
    initialMonsterShield = config.shield;
    
    // 更新顯示
    updateMonsterHP(monsterHP);
    updateMonsterShield(monsterShield);
    
    console.log(`第 ${levelId} 關初始化完成 - HP: ${monsterHP}, Shield: ${monsterShield}`);
}


// 更新怪物血量顯示
function updateMonsterHP(hp) {
    console.log(`更新怪物血量: ${hp}/${initialMonsterHP}`);
    
    const hpBarFill = document.getElementById('monster-hp-bar');
    const hpValue = document.getElementById('monster-hp');
    const maxHpValue = document.getElementById('monster-max-hp');
    
    if (!hpBarFill || !hpValue) {
        console.error('找不到怪物血量顯示元素，嘗試創建');
        createMonsterHPBar();
        return updateMonsterHP(hp);
    }
    
    const percentage = (hp / initialMonsterHP) * 100;
    hpBarFill.style.width = `${percentage}%`;
    hpValue.textContent = Math.max(0, Math.floor(hp));
    if (maxHpValue) maxHpValue.textContent = initialMonsterHP;
    
    // 根據血量百分比改變顏色
    if (percentage < 20) {
        hpBarFill.style.backgroundColor = '#e74c3c';
    } else if (percentage < 50) {
        hpBarFill.style.backgroundColor = '#f39c12';
    } else {
        hpBarFill.style.backgroundColor = '#2ecc71';
    }
    
    monsterHP = hp;
}

// 創建怪物血量條
function createMonsterHPBar() {
    console.log('創建怪物血量條');
    
    // 獲取怪物區域容器
    const monsterArea = document.querySelector('.monster-area');
    if (!monsterArea) {
        console.error('找不到怪物區域容器');
        return;
    }
    
    // 檢查是否已存在血量條
    if (document.getElementById('monster-hp-bar')) {
        console.log('血量條已存在，跳過創建');
        return;
    }
    
    // 創建血量條容器
    const hpContainer = document.createElement('div');
    hpContainer.className = 'hp-container';
    hpContainer.style.marginBottom = '10px';
    hpContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    hpContainer.style.borderRadius = '5px';
    hpContainer.style.padding = '8px';
    
    // 創建血量標籤
    const hpLabel = document.createElement('div');
    hpLabel.className = 'hp-label';
    hpLabel.textContent = '怪物血量:';
    hpLabel.style.fontSize = '14px';
    hpLabel.style.marginBottom = '5px';
    hpLabel.style.fontWeight = '600';
    
    // 創建血量條
    const hpBar = document.createElement('div');
    hpBar.className = 'hp-bar';
    hpBar.style.height = '20px';
    hpBar.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    hpBar.style.borderRadius = '10px';
    hpBar.style.overflow = 'hidden';
    hpBar.style.margin = '5px 0';
    hpBar.style.position = 'relative';
    
    // 創建血量條填充
    const hpBarFill = document.createElement('div');
    hpBarFill.className = 'hp-bar-fill';
    hpBarFill.id = 'monster-hp-bar';
    hpBarFill.style.height = '100%';
    hpBarFill.style.backgroundColor = '#2ecc71';
    hpBarFill.style.width = '100%';
    hpBarFill.style.transition = 'width 0.3s ease';
    
    // 創建血量值顯示
    const hpValue = document.createElement('div');
    hpValue.className = 'hp-value';
    hpValue.style.fontSize = '14px';
    hpValue.style.textAlign = 'right';
    hpValue.style.color = '#ecf0f1';
    hpValue.innerHTML = '<span id="monster-hp">100</span>/<span id="monster-max-hp">100</span>';
    
    // 組裝血量條
    hpBar.appendChild(hpBarFill);
    hpContainer.appendChild(hpLabel);
    hpContainer.appendChild(hpBar);
    hpContainer.appendChild(hpValue);
    
    // 將血量條添加到怪物區域的最前面
    if (monsterArea.firstChild) {
        monsterArea.insertBefore(hpContainer, monsterArea.firstChild);
    } else {
        monsterArea.appendChild(hpContainer);
    }
    
    console.log('怪物血量條創建完成');
}

// ==================== 怪物護盾系統 ====================

// 創建怪物護盾條
function createMonsterShieldBar() {
    console.log('創建怪物護盾條');
    
    // 獲取怪物區域容器
    const monsterArea = document.querySelector('.monster-area');
    if (!monsterArea) {
        console.error('找不到怪物區域容器');
        return;
    }
    
    // 檢查是否已存在護盾條
    if (document.getElementById('monster-shield-bar')) {
        console.log('護盾條已存在，跳過創建');
        return;
    }
    
    // 創建護盾條容器
    const shieldContainer = document.createElement('div');
    shieldContainer.className = 'hp-container shield-container';
    shieldContainer.style.marginBottom = '10px';
    shieldContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    shieldContainer.style.borderRadius = '5px';
    shieldContainer.style.padding = '8px';
    
    // 創建護盾標籤
    const shieldLabel = document.createElement('div');
    shieldLabel.className = 'hp-label';
    shieldLabel.textContent = '怪物護盾:';
    shieldLabel.style.fontSize = '14px';
    shieldLabel.style.marginBottom = '5px';
    shieldLabel.style.fontWeight = '600';
    
    // 創建護盾條
    const shieldBar = document.createElement('div');
    shieldBar.className = 'hp-bar';
    shieldBar.style.height = '20px';
    shieldBar.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    shieldBar.style.borderRadius = '10px';
    shieldBar.style.overflow = 'hidden';
    shieldBar.style.margin = '5px 0';
    shieldBar.style.position = 'relative';
    
    // 創建護盾條填充
    const shieldBarFill = document.createElement('div');
    shieldBarFill.className = 'hp-bar-fill shield-bar-fill';
    shieldBarFill.id = 'monster-shield-bar';
    shieldBarFill.style.height = '100%';
    shieldBarFill.style.backgroundColor = '#3498db';
    shieldBarFill.style.width = '100%';
    shieldBarFill.style.transition = 'width 0.3s ease';
    
    // 創建護盾值顯示
    const shieldValue = document.createElement('div');
    shieldValue.className = 'hp-value';
    shieldValue.style.fontSize = '14px';
    shieldValue.style.textAlign = 'right';
    shieldValue.style.color = '#ecf0f1';
    shieldValue.innerHTML = '<span id="monster-shield">0</span>/<span id="monster-max-shield">0</span>';
    
    // 組裝護盾條
    shieldBar.appendChild(shieldBarFill);
    shieldContainer.appendChild(shieldLabel);
    shieldContainer.appendChild(shieldBar);
    shieldContainer.appendChild(shieldValue);
    
    // 獲取血量條容器
    const hpContainer = document.querySelector('.monster-area .hp-container');
    
    // 將護盾條添加到血量條之後
    if (hpContainer) {
        hpContainer.parentNode.insertBefore(shieldContainer, hpContainer.nextSibling);
    } else {
        // 如果找不到血量條，則添加到怪物區域的最前面
        if (monsterArea.firstChild) {
            monsterArea.insertBefore(shieldContainer, monsterArea.firstChild);
        } else {
            monsterArea.appendChild(shieldContainer);
        }
    }
    
    // 如果沒有護盾，則隱藏護盾條
    if (initialMonsterShield <= 0) {
        shieldContainer.style.display = 'none';
    }
    
    console.log('怪物護盾條創建完成');
}

// 更新怪物護盾顯示
function updateMonsterShield(shield) {
    // 更新怪物護盾
    
    const shieldBarFill = document.getElementById('monster-shield-bar');
    const shieldValue = document.getElementById('monster-shield');
    const maxShieldValue = document.getElementById('monster-max-shield');
    
    if (!shieldBarFill || !shieldValue) {
        console.error('找不到護盾顯示元素，嘗試創建');
        createMonsterShieldBar();
        return updateMonsterShield(shield);
    }
    
    // 避免除以零錯誤
    const percentage = initialMonsterShield > 0 ? (shield / initialMonsterShield) * 100 : 0;
    shieldBarFill.style.width = `${percentage}%`;
    shieldValue.textContent = shield;
    if (maxShieldValue) maxShieldValue.textContent = initialMonsterShield;
    
    // 根據是否有護盾顯示或隱藏護盾條
    const shieldContainer = shieldBarFill.closest('.hp-container');
    if (shieldContainer) {
        if (initialMonsterShield > 0) {
            shieldContainer.style.display = 'block';
        } else {
            shieldContainer.style.display = 'none';
        }
    }
    
    // 更新全局變量
    monsterShield = shield;
}

// ==================== 怪物傷害系統 ====================

// 減少怪物血量的核心邏輯
function decreaseMonsterHP(count) {
    // 靜態變量，記錄上次的計數
    if (decreaseMonsterHP.lastCount === undefined) {
        decreaseMonsterHP.lastCount = 0;
    }
    
    // 計算新增的計數
    const increment = count - decreaseMonsterHP.lastCount;
    decreaseMonsterHP.lastCount = count;
    
    // 如果計數減少，直接返回（可能是重置了計數器）
    if (increment < 0) return;
    
    // 如果沒有新的運動次數增加，也不造成傷害
    if (increment === 0) return;

    // 獲取用戶設定的每組次數
    const repsPerSet = document.getElementById('reps') ? 
                      parseInt(document.getElementById('reps').value) || 10 : 10;
    
    // 只有當完成一組運動時（計數達到每組次數的倍數）才記錄到Combo系統
    if (count % repsPerSet === 0) {
        console.log(`完成一組運動，添加到Combo系統: ${currentExerciseType}`);
        addExerciseToCombo(currentExerciseType);
    }

    // 減少怪物血量

    // 計算基礎傷害
    let damage = increment;
    // 應用連擊倍率
    let finalDamage = Math.round(damage * comboMultiplier);

    // 播放怪物受擊動畫
    playMonsterHitAnimation();

    // 顯示傷害彈出效果
    showDamagePopup(finalDamage, comboMultiplier);
    
    // 如果觸發了combo技能，顯示額外提示
    if (comboMultiplier > 1.0) {
        console.log(`觸發連擊！傷害倍率: ${comboMultiplier}x`);
        showMonsterDialogue(`連擊！${comboMultiplier}倍傷害！`);
    }

    // 先處理護盾
    if (monsterShield > 0) {
        const shieldDecrease = Math.min(monsterShield, finalDamage);
        monsterShield -= shieldDecrease;
        updateMonsterShield(monsterShield);

        if (monsterShield === 0) {
            showMonsterDialogue('我的護盾被擊破了！不要你不要過來啊!!');
        }

        const remainingDamage = finalDamage - shieldDecrease;
        if (remainingDamage <= 0) return; // 護盾吸收所有傷害

        monsterHP = Math.max(0, monsterHP - remainingDamage);
    } else {
        // 沒有護盾，直接減少血量
        monsterHP = Math.max(0, monsterHP - finalDamage);
    }

    // 更新血量顯示
    updateMonsterHP(monsterHP);
    
    // 檢查怪物是否被擊敗
    if (monsterHP <= 0) {
        // 怪物被擊敗
        console.log('怪物被擊敗！');
        
        // 調用怪物被擊敗函數
        monsterDefeated();
    } else if (monsterHP < initialMonsterHP * 0.3) {
        // 血量低於30%，顯示快要被擊敗的對話
        const lowHpDialogues = [
            '我要走了...天冷了要記得穿暖些，沒有我了別著涼',
            '我已經快不行了...你贏了...',
            '我的生命只剩下一點點了，你真的很強...',
            '我感覺到生命的流逝，這就是命運嗎？',
            '我不想死啊！我還有老婆孩子要養！',
            '我的力量正在消失...這就是結束了嗎？',
            '我還沒看到庫拉皮卡下船啊...',
            '我的遺言是...記得幫我餵貓...他叫小強',
            '這是我最後的波紋阿!!!!JOJO!!!!!!!!!!!',
            '對不起沒有讓你盡興的發揮全力'
        ];
        showMonsterDialogue(lowHpDialogues[Math.floor(Math.random() * lowHpDialogues.length)]);
    } else if (monsterHP < initialMonsterHP * 0.5) {
        // 血量低於50%，顯示受傷的對話
        const mediumHpDialogues = [
            '本使同根生，相煎何太急，我們都是一家人的...',
            '你的力量比我想像的還要強大！',
            '我開始感到疼痛了...你真的很厲害',
            '我們不能和平共處嗎？何必一定要打打殺殺？',
            '我只是一個打工的啊，老闆叫我來的！',
            '我們可以談談嗎？我請你吃飯！',
            '我感覺我的力量正在減弱...',
            '你這樣對待我，我的朋友們不會放過你的！'
        ];
        showMonsterDialogue(mediumHpDialogues[Math.floor(Math.random() * mediumHpDialogues.length)]);
    } else if (monsterHP < initialMonsterHP * 0.8) {
        // 血量低於80%，顯示輕傷的對話
        const highHpDialogues = [
            '嘿！那有點疼！',
            '你的攻擊開始讓我感到不舒服了',
            '這只是皮外傷，不算什麼！',
            '你以為這樣就能打敗我嗎？',
            '我還有很多力量！',
            '這點傷不算什麼，我可是見過大風大浪的！',
            '你的攻擊像蚊子叮一樣，癢癢的',
            '我承認你有點實力，但還不夠！',
            '我不是針對你，而是在做的各位都是拉基!',
            '要先認清一件事，你才是挑戰者!'
        ];
        showMonsterDialogue(highHpDialogues[Math.floor(Math.random() * highHpDialogues.length)]);
    }
    
    // 如果不是由combo技能觸發的，重置combo倍率
    if (!comboTriggered) {
        comboMultiplier = 1.0;
    }
}

// ==================== 怪物動畫系統 ====================

// 播放怪物受擊動畫
function playMonsterHitAnimation() {
    // 播放怪物受擊動畫
    
    // 嘗試使用 ThreeManager 的動畫系統
    if (typeof window.threeManager !== 'undefined' && window.threeManager && window.threeManager.isModelLoaded()) {
        console.log('使用 ThreeManager 播放受擊動畫');
        
        // 檢查是否有受擊動畫
        const availableAnimations = window.threeManager.getAnimationList();
        console.log('可用動畫:', availableAnimations);
        
        // 嘗試播放受擊相關的動畫
        const hitAnimations = ['hit', 'hurt', 'damage', 'pain', 'attacked'];
        let hitAnimationFound = false;
        
        for (const hitAnim of hitAnimations) {
            if (availableAnimations.includes(hitAnim)) {
                console.log(`播放受擊動畫: ${hitAnim}`);
                window.threeManager.playAnimation(hitAnim, {
                    loop: false,
                    fadeTime: 0.2,
                    onComplete: () => {
                        console.log('受擊動畫播放完成，返回 idle 動畫');
                        // 動畫完成後返回 idle 動畫
                        if (availableAnimations.includes('idle')) {
                            window.threeManager.playAnimation('idle', { loop: true });
                        }
                    }
                });
                hitAnimationFound = true;
                break;
            }
        }
        
        // 如果沒有找到受擊動畫，使用 CSS 動畫作為備用
        if (!hitAnimationFound) {
            console.log('未找到受擊動畫，使用 CSS 動畫');
            playMonsterHitCSSAnimation();
        }
    } else if (typeof window.mainApp !== 'undefined' && window.mainApp && window.mainApp.threeManager && window.mainApp.threeManager.isModelLoaded()) {
        console.log('使用 MainApp 的 ThreeManager 播放受擊動畫');
        
        // 檢查是否有受擊動畫
        const availableAnimations = window.mainApp.threeManager.getAnimationList();
        console.log('可用動畫:', availableAnimations);
        
        // 嘗試播放受擊相關的動畫
        const hitAnimations = ['hit', 'hurt', 'damage', 'pain', 'attacked'];
        let hitAnimationFound = false;
        
        for (const hitAnim of hitAnimations) {
            if (availableAnimations.includes(hitAnim)) {
                console.log(`播放受擊動畫: ${hitAnim}`);
                window.mainApp.threeManager.playAnimation(hitAnim, {
                    loop: false,
                    fadeTime: 0.2,
                    onComplete: () => {
                        console.log('受擊動畫播放完成，返回 idle 動畫');
                        // 動畫完成後返回 idle 動畫
                        if (availableAnimations.includes('idle')) {
                            window.mainApp.threeManager.playAnimation('idle', { loop: true });
                        }
                    }
                });
                hitAnimationFound = true;
                break;
            }
        }
        
        // 如果沒有找到受擊動畫，使用 CSS 動畫作為備用
        if (!hitAnimationFound) {
            console.log('未找到受擊動畫，使用 CSS 動畫');
            playMonsterHitCSSAnimation();
        }
    } else {
        console.log('ThreeManager 未載入或模型未載入，使用 CSS 動畫');
        playMonsterHitCSSAnimation();
    }
}

// CSS 受擊動畫（備用方案）
function playMonsterHitCSSAnimation() {
    console.log('播放 CSS 受擊動畫');
    
    const monsterScene = document.getElementById('monster-scene');
    if (!monsterScene) {
        console.error('找不到怪物場景容器');
        return;
    }
    
    // 添加受擊動畫類
    monsterScene.classList.add('monster-hit');
    
    // 0.5秒後移除動畫類
    setTimeout(() => {
        monsterScene.classList.remove('monster-hit');
    }, 500);
}

// 顯示傷害彈出效果
function showDamagePopup(damage, multiplier = 1.0) {
    // 顯示傷害彈出
    
    const monsterContainer = document.querySelector('.monster-container') || document.getElementById('monster-scene');
    if (!monsterContainer) {
        console.error('找不到怪物容器');
        return;
    }
    
    // 創建傷害文字元素
    const damageText = document.createElement('div');
    
    // 根據是否為連擊設置不同樣式
    if (multiplier > 1.0) {
        damageText.className = 'damage-popup combo';
        damageText.textContent = `${damage.toFixed(1)} (x${multiplier})`;
    } else {
        damageText.className = 'damage-popup';
        damageText.textContent = `${damage.toFixed(1)}`;
    }
    
    // 設置位置（相對於怪物容器）
    damageText.style.position = 'absolute';
    damageText.style.top = '50%';
    damageText.style.left = '50%';
    damageText.style.transform = 'translate(-50%, -50%)';
    damageText.style.zIndex = '200';
    damageText.style.pointerEvents = 'none';
    
    // 添加到容器
    monsterContainer.appendChild(damageText);
    
    // 1秒後移除元素
    setTimeout(() => {
        if (damageText.parentNode) {
            damageText.parentNode.removeChild(damageText);
        }
    }, 1000);
}

// ==================== 怪物對話系統 ====================

// 顯示怪物對話
function showMonsterDialogue(text) {
    console.log('顯示怪物對話:', text);
    
    // 确保样式已添加
    addMonsterDialogueStyle();
    
    // 获取怪物区域
    const monsterArea = document.querySelector('.monster-area');
    if (!monsterArea) {
        console.error('找不到怪物區域');
        return;
    }
    
    // 獲取怪物容器（3D 場景容器）
    const monsterContainer = document.getElementById('monster-scene');
    if (!monsterContainer) {
        console.error('找不到怪物場景容器');
        return;
    }
    
    // 检查是否已存在对话框
    let dialogue = monsterArea.querySelector('.monster-dialogue');
    
    // 如果不存在或者有问题，创建新的对话框
    if (!dialogue || dialogue.style.top === '-60px') {
        // 如果存在旧的对话框，先移除
        if (dialogue) {
            monsterArea.removeChild(dialogue);
        }
        
        dialogue = document.createElement('div');
        dialogue.className = 'monster-dialogue';
        
        // 设置明确的样式，避免被其他CSS覆盖
        dialogue.style.position = 'absolute';
        dialogue.style.top = '10%'; // 調整為相對於怪物容器頂部的位置
        dialogue.style.left = '50%';
        dialogue.style.transform = 'translateX(-50%)';
        dialogue.style.backgroundColor = '#fff';
        dialogue.style.borderRadius = '10px';
        dialogue.style.padding = '10px 15px';
        dialogue.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
        dialogue.style.maxWidth = '80%'; // 調整最大寬度為容器的80%
        dialogue.style.textAlign = 'center';
        dialogue.style.fontSize = '14px';
        dialogue.style.color = '#333';
        dialogue.style.zIndex = '100';
        dialogue.style.opacity = '0';
        dialogue.style.transition = 'opacity 0.3s, transform 0.3s';
        dialogue.style.pointerEvents = 'none';
        
        // 添加伪元素的替代方案
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.bottom = '-10px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderWidth = '10px 10px 0';
        arrow.style.borderStyle = 'solid';
        arrow.style.borderColor = '#fff transparent transparent';
        
        dialogue.appendChild(arrow);
        
        // 將對話框添加到怪物容器中，而不是怪物區域
        monsterContainer.appendChild(dialogue);
    }
    
    // 设置对话内容
    dialogue.textContent = text;
    
    // 显示对话框
    setTimeout(() => {
        dialogue.style.opacity = '1';
        dialogue.style.transform = 'translateX(-50%) translateY(-5px)';
    }, 10);
    
    // 5秒后隐藏对话框
    setTimeout(() => {
        dialogue.style.opacity = '0';
        dialogue.style.transform = 'translateX(-50%) translateY(0)';
    }, 5000);
}

// 添加怪物對話框樣式
function addMonsterDialogueStyle() {
    console.log('添加怪物對話框樣式');
    
    // 檢查是否已存在樣式
    if (document.getElementById('monster-dialogue-style')) {
        console.log('怪物對話框樣式已存在，移除舊樣式');
        const oldStyle = document.getElementById('monster-dialogue-style');
        oldStyle.parentNode.removeChild(oldStyle);
    }
    
    // 創建樣式元素
    const style = document.createElement('style');
    style.id = 'monster-dialogue-style';
    style.textContent = `
        .monster-dialogue {
            position: absolute;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #fff;
            border-radius: 10px;
            padding: 10px 15px;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
            max-width: 200px;
            text-align: center;
            font-size: 14px;
            color: #333;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
        }
        
        .monster-dialogue:after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 10px 10px 0;
            border-style: solid;
            border-color: #fff transparent transparent;
        }
        
        .monster-dialogue.show {
            opacity: 1;
            transform: translateX(-50%) translateY(-5px);
        }
        
        .damage-popup {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #e74c3c;
            font-size: 24px;
            font-weight: bold;
            z-index: 200;
            pointer-events: none;
            transition: opacity 0.5s, transform 0.5s;
        }
    `;
    
    // 添加到页面
    document.head.appendChild(style);
    console.log('怪物對話框樣式已添加');
}

// ==================== 遊戲狀態管理 ====================

// 怪物被擊敗時的處理函數
function monsterDefeated() {
    console.log('怪物被擊敗！');
    
    // 更新怪物索引
    currentMonsterIndex++;
    console.log(`當前怪物索引: ${currentMonsterIndex}/${totalMonsters}`);
    
    // 停止偵測
    if (typeof stopDetection === 'function') {
        stopDetection();
    }
    
    // 計算經驗值獎勵 (基於護盾值和重量係數)
    let expReward = 50; // 基礎經驗值
    
    if (initialMonsterShield > 0) {
        // 如果怪物有護盾，增加經驗值獎勵
        expReward += Math.round(initialMonsterShield * shieldWeightFactor);
        console.log(`基於護盾計算的額外經驗值: ${Math.round(initialMonsterShield * shieldWeightFactor)}`);
    }
    
    console.log(`總經驗值獎勵: ${expReward}`);
    
    // 顯示通關消息
    if (typeof showNotification === 'function') {
        showNotification(`恭喜！你擊敗了怪物，獲得 ${expReward} 經驗值！`, 'success');
    }
    
    // 顯示怪物對話
    showMonsterDialogue('好討厭的感覺阿~~~~~~');
    
    // 重置Combo系統
    if (typeof resetCombo === 'function') {
        resetCombo();
    }
    
    // 顯示關卡完成訊息 (包含下一關選項)
    showLevelCompleteMessage();
}

// 顯示關卡完成訊息
function showLevelCompleteMessage() {
    console.log('顯示關卡完成訊息');
    
    // 計算經驗值獎勵 (基於護盾值和重量係數)
    let expReward = 50; // 基礎經驗值
    let shieldBonus = 0;
    
    if (initialMonsterShield > 0) {
        // 如果怪物有護盾，增加經驗值獎勵
        shieldBonus = Math.round(initialMonsterShield * shieldWeightFactor);
        console.log(`護盾經驗值加成: ${shieldBonus} (初始護盾: ${initialMonsterShield}, 重量係數: ${shieldWeightFactor})`);
        expReward += shieldBonus;
    }
    
    console.log(`關卡 ${currentLevel} 完成，獲得經驗值: ${expReward} (基礎: 50, 護盾加成: ${shieldBonus})`);
    
    // 創建通關通知元素
    const notification = document.createElement('div');
    notification.className = 'level-complete-notification';
    notification.innerHTML = `
        <div class="level-complete-content">
            <h2>關卡完成！</h2>
            <p>恭喜你擊敗了怪物！</p>
            <p>獲得經驗值: ${expReward}</p>
            <div class="level-complete-buttons">
                <button id="next-level-btn">下一關</button>
                <button id="continue-btn">返回</button>
            </div>
        </div>
    `;
    
    // 設置樣式
    notification.style.position = 'fixed';
    notification.style.top = '0';
    notification.style.left = '0';
    notification.style.width = '100%';
    notification.style.height = '100%';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.display = 'flex';
    notification.style.justifyContent = 'center';
    notification.style.alignItems = 'center';
    notification.style.zIndex = '1000';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 顯示動畫
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // 綁定按鈕事件
    const nextLevelBtn = notification.querySelector('#next-level-btn');
    const continueBtn = notification.querySelector('#continue-btn');
    
    if (nextLevelBtn) {
        nextLevelBtn.addEventListener('click', () => {
            // 進入下一關
            currentLevel++;
            notification.remove();
            if (typeof initLevel === 'function') {
                initLevel(currentLevel);
            }
            // 重新開始偵測
            if (typeof startDetection === 'function') {
                startDetection();
            }
        });
    }
    
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            // 返回遊戲地圖或主選單
            notification.remove();
            // 可以跳轉到遊戲地圖頁面
            window.location.href = '/game/map';
        });
    }
    
    // 5秒後自動隱藏（可選）
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 10000); // 10秒後自動隱藏
}


