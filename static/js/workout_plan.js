// 訓練計劃管理模塊

// 全局變量
let workoutPlan = []; // 存儲訓練計劃的數組
let currentExerciseIndex = 0; // 當前執行的運動索引
let restTimerInterval = null; // 休息計時器間隔
let restTimeRemaining = 30; // 休息時間（秒）

// 初始化訓練計劃模塊
function initWorkoutPlanModule() {
    console.log('初始化訓練計劃模塊...');
    
    // 獲取DOM元素
    const openPlanModalBtn = document.getElementById('open-workout-plan-btn');
    const workoutPlanModal = document.getElementById('workout-plan-modal');
    const closePlanModalBtn = document.getElementById('close-workout-plan-modal');
    const addExerciseBtn = document.getElementById('add-exercise-btn');
    const savePlanBtn = document.getElementById('save-plan-btn');
    const cancelPlanBtn = document.getElementById('cancel-plan-btn');
    const workoutPlanList = document.getElementById('workout-plan-list');
    const restModal = document.getElementById('rest-modal');
    const skipRestBtn = document.getElementById('skip-rest-btn');
    
    // 檢查元素是否存在
    if (!openPlanModalBtn || !workoutPlanModal || !closePlanModalBtn || !addExerciseBtn || 
        !savePlanBtn || !cancelPlanBtn || !workoutPlanList) {
        console.error('無法找到訓練計劃相關DOM元素');
        return;
    }
    
    // 綁定事件
    openPlanModalBtn.addEventListener('click', openWorkoutPlanModal);
    closePlanModalBtn.addEventListener('click', closeWorkoutPlanModal);
    addExerciseBtn.addEventListener('click', addExerciseToForm);
    savePlanBtn.addEventListener('click', function(event) {
        event.preventDefault();
        // 調用 realtime.js 中的 saveWorkoutPlan 函數
        if (typeof window.saveWorkoutPlan === 'function') {
            window.saveWorkoutPlan();
        } else {
            console.error('找不到 saveWorkoutPlan 函數');
        }
        closeWorkoutPlanModal();
    });
    cancelPlanBtn.addEventListener('click', closeWorkoutPlanModal);
    
    // 為跳過休息按鈕添加事件監聽器
    if (skipRestBtn) {
        skipRestBtn.addEventListener('click', skipRest);
    }
    
    // 初始化訓練計劃列表
    initWorkoutPlanList();
    
    console.log('訓練計劃模塊初始化完成');
}

// 初始化訓練計劃列表
function initWorkoutPlanList() {
    const workoutPlanList = document.getElementById('workout-plan-list');
    if (!workoutPlanList) return;
    
    // 清空列表
    workoutPlanList.innerHTML = '';
    
    // 添加第一個運動項目
    addExerciseToForm();
}

// 打開訓練計劃模態窗口
function openWorkoutPlanModal() {
    const modal = document.getElementById('workout-plan-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

// 關閉訓練計劃模態窗口
function closeWorkoutPlanModal() {
    const modal = document.getElementById('workout-plan-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 添加運動到表單
function addExerciseToForm() {
    const workoutPlanList = document.getElementById('workout-plan-list');
    if (!workoutPlanList) return;
    
    const index = workoutPlanList.children.length;
    
    // 創建新的運動項目
    const exerciseItem = document.createElement('div');
    exerciseItem.className = 'workout-plan-item';
    exerciseItem.dataset.index = index;
    
    exerciseItem.innerHTML = `
        <div class="plan-item-header">
            <span class="plan-item-number">${index + 1}</span>
            <button class="remove-exercise-btn" title="移除此運動"><i class="fas fa-times"></i></button>
        </div>
        <div class="plan-item-body">
            <div class="input-group">
                <label>運動類型</label>
                <select class="exercise-type-select">
                    <!-- 運動選項將由 exercise-options.js 動態填充 -->
                </select>
            </div>
            <div class="input-group">
                <label>重量 (kg)</label>
                <input type="number" class="weight-input" min="0" max="200" value="0">
            </div>
            <div class="input-group">
                <label>次數/組</label>
                <input type="number" class="reps-input" min="1" max="100" value="10">
            </div>
            <div class="input-group">
                <label>組數</label>
                <input type="number" class="sets-input" min="1" max="10" value="3">
            </div>
        </div>
    `;
    
    // 添加到列表
    workoutPlanList.appendChild(exerciseItem);
    
    // 初始化新添加項目的運動選項
    if (typeof exerciseOptions !== 'undefined') {
        const select = exerciseItem.querySelector('.exercise-type-select');
        if (select) {
            // 使用新的方法為這個特定的選擇框填充選項
            exerciseOptions.initializeSpecificSelect(select);
            console.log('新運動項目的選項已初始化');
        }
    } else {
        console.warn('exerciseOptions 模組未載入，無法初始化運動選項');
    }
    
    // 為移除按鈕添加事件
    const removeBtn = exerciseItem.querySelector('.remove-exercise-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            removeExerciseFromForm(exerciseItem);
        });
    }
}

// 從表單中移除運動
function removeExerciseFromForm(exerciseItem) {
    const workoutPlanList = document.getElementById('workout-plan-list');
    if (!workoutPlanList || workoutPlanList.children.length <= 1) return; // 至少保留一個運動
    
    workoutPlanList.removeChild(exerciseItem);
    
    // 更新序號
    const items = workoutPlanList.querySelectorAll('.workout-plan-item');
    items.forEach((item, index) => {
        item.dataset.index = index;
        item.querySelector('.plan-item-number').textContent = index + 1;
    });
}

// 保存訓練計劃
function saveWorkoutPlan() {
    const workoutPlanList = document.getElementById('workout-plan-list');
    if (!workoutPlanList) return;
    
    // 清空當前計劃
    workoutPlan = [];
    
    // 獲取所有運動項目
    const items = workoutPlanList.querySelectorAll('.workout-plan-item');
    items.forEach(item => {
        const exerciseType = item.querySelector('.exercise-type-select').value;
        const weight = parseInt(item.querySelector('.weight-input').value) || 0;
        const reps = parseInt(item.querySelector('.reps-input').value) || 10;
        const sets = parseInt(item.querySelector('.sets-input').value) || 3;
        
        // 添加到計劃中
        workoutPlan.push({
            type: exerciseType,
            weight: weight,
            reps: reps,
            sets: sets,
            completedSets: 0 // 初始已完成組數為0
        });
    });
    
    console.log('訓練計劃已保存:', workoutPlan);
    
    // 關閉模態窗口
    closeWorkoutPlanModal();
    
    // 更新UI顯示當前計劃
    updateWorkoutPlanDisplay();
    
    // 重置當前運動索引
    currentExerciseIndex = 0;
    
    // 初始化第一個運動
    initCurrentExercise();
    
    // 顯示提示
    showToast('訓練計劃已保存，準備開始訓練！');
    
    // 更新怪物護盾
    updateMonsterShieldForWorkoutPlan();
}

// 更新怪物護盾以反映訓練計劃
function updateMonsterShieldForWorkoutPlan() {
    if (!workoutPlan || workoutPlan.length === 0) return;
    
    // 計算總護盾值 - 基於所有運動的總次數
    let totalShield = 0;
    workoutPlan.forEach(exercise => {
        totalShield += exercise.reps * exercise.sets;
    });
    
    // 更新怪物護盾
    initialMonsterShield = totalShield;
    monsterShield = totalShield;
    
    // 更新護盾顯示
    updateMonsterShield(monsterShield);
    
    console.log(`已更新怪物護盾為 ${totalShield}，基於訓練計劃的總運動次數`);
}

// 更新訓練計劃顯示
function updateWorkoutPlanDisplay() {
    const planSummary = document.getElementById('workout-plan-summary');
    if (!planSummary) return;
    
    if (!workoutPlan || workoutPlan.length === 0) {
        planSummary.innerHTML = '<div class="no-plan">尚未設定訓練計劃</div>';
        return;
    }
    
    // 創建計劃摘要
    let summaryHTML = '<div class="plan-summary-title">當前訓練計劃</div><div class="plan-exercises">';
    
    workoutPlan.forEach((exercise, index) => {
        const isActive = index === currentExerciseIndex;
        const isCompleted = exercise.completedSets >= exercise.sets;
        
        let statusClass = '';
        if (isActive) statusClass = 'active';
        else if (isCompleted) statusClass = 'completed';
        
        // 獲取運動名稱
        const exerciseName = getExerciseName(exercise.type);
        
        summaryHTML += `
            <div class="plan-exercise-item ${statusClass}">
                <div class="exercise-icon">
                    ${getExerciseIcon(exercise.type)}
                </div>
                <div class="exercise-details">
                    <div class="exercise-name">${exerciseName}</div>
                    <div class="exercise-target">${exercise.reps}次 x ${exercise.sets}組 (${exercise.weight}kg)</div>
                </div>
                <div class="exercise-progress">
                    <span class="completed-sets">${exercise.completedSets}</span>/${exercise.sets}
                </div>
            </div>
        `;
    });
    
    summaryHTML += '</div>';
    planSummary.innerHTML = summaryHTML;
}

// 獲取運動名稱
function getExerciseName(exerciseType) {
    const exerciseNames = {
        'squat': '深蹲',
        'bicep-curl': '二頭彎舉',
        'shoulder-press': '肩推',
        'push-up': '伏地挺身',
        'pull-up': '引體向上',
        'dumbbell-row': '啞鈴划船',
        'table-tennis': '桌球揮拍',
        'basketball': '籃球投籃',
        'basketball-dribble': '籃球運球',
        'volleyball-overhand': '排球高手托球',
        'volleyball-lowhand': '排球低手接球'
    };
    
    return exerciseNames[exerciseType] || exerciseType;
}

// 獲取運動圖標
function getExerciseIcon(exerciseType) {
    const exerciseIcons = {
        'squat': '<i class="fas fa-chevron-down"></i>',
        'bicep-curl': '<i class="fas fa-dumbbell"></i>',
        'shoulder-press': '<i class="fas fa-arrow-up"></i>',
        'push-up': '<i class="fas fa-arrow-down"></i>',
        'pull-up': '<i class="fas fa-arrow-up"></i>',
        'dumbbell-row': '<i class="fas fa-dumbbell"></i>',
        'table-tennis': '<i class="fas fa-table-tennis"></i>',
        'basketball': '<i class="fas fa-basketball-ball"></i>',
        'basketball-dribble': '<i class="fas fa-basketball-ball"></i>'
    };
    
    return exerciseIcons[exerciseType] || '<i class="fas fa-running"></i>';
}

// 初始化當前運動
function initCurrentExercise() {
    if (!workoutPlan || workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) {
        console.log('沒有可用的訓練計劃或已完成所有運動');
        return;
    }
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    console.log(`初始化當前運動: ${getExerciseName(currentExercise.type)}`);
    
    // 更新UI顯示
    updateExerciseDisplay(currentExercise);
    
    // 更新全局變量
    currentExerciseType = currentExercise.type;
    
    // 更新訓練計劃顯示
    updateWorkoutPlanDisplay();
}

// 更新運動顯示
function updateExerciseDisplay(exercise) {
    // 更新運動選擇器
    const exerciseSelect = document.getElementById('exercise-select');
    if (exerciseSelect) {
        exerciseSelect.value = exercise.type;
    }
    
    // 更新重量輸入
    const weightInput = document.getElementById('weight');
    if (weightInput) {
        weightInput.value = exercise.weight;
    }
    
    // 更新次數輸入
    const repsInput = document.getElementById('reps');
    if (repsInput) {
        repsInput.value = exercise.reps;
    }
    
    // 更新組數輸入
    const setsInput = document.getElementById('sets');
    if (setsInput) {
        setsInput.value = exercise.sets;
    }
    
    // 更新剩餘組數顯示
    const remainingSetsDisplay = document.getElementById('remaining-sets');
    if (remainingSetsDisplay) {
        remainingSetsDisplay.textContent = exercise.sets - exercise.completedSets;
    }
    
    // 更新當前運動名稱顯示
    const currentExerciseName = document.getElementById('current-exercise-name');
    if (currentExerciseName) {
        currentExerciseName.textContent = getExerciseName(exercise.type);
    }
    
    // 更新當前重量顯示
    const currentWeight = document.getElementById('current-weight');
    if (currentWeight) {
        currentWeight.textContent = exercise.weight;
    }
    
    // 更新目標次數顯示
    const targetReps = document.getElementById('target-reps');
    if (targetReps) {
        targetReps.textContent = exercise.reps;
    }
    
    // 更新目標組數顯示
    const targetSets = document.getElementById('target-sets');
    if (targetSets) {
        targetSets.textContent = exercise.sets;
    }
    
    // 根據運動類型顯示/隱藏特定控件
    toggleExerciseSpecificControls(exercise.type);
}

// 處理運動完成一組
function handleExerciseSetCompleted() {
    if (!workoutPlan || workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) {
        return;
    }
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    currentExercise.completedSets++;
    
    console.log(`${getExerciseName(currentExercise.type)} 完成一組，已完成 ${currentExercise.completedSets}/${currentExercise.sets} 組`);
    
    // 更新剩餘組數顯示
    const remainingSetsDisplay = document.getElementById('remaining-sets');
    if (remainingSetsDisplay) {
        remainingSetsDisplay.textContent = currentExercise.sets - currentExercise.completedSets;
    }
    
    // 更新訓練計劃顯示
    updateWorkoutPlanDisplay();
    
    // 檢查是否完成當前運動的所有組數
    if (currentExercise.completedSets >= currentExercise.sets) {
        console.log(`${getExerciseName(currentExercise.type)} 所有組數已完成`);
        
        // 檢查是否還有下一個運動
        if (currentExerciseIndex < workoutPlan.length - 1) {
            // 顯示休息提示
            showRestPrompt();
        } else {
            // 所有運動都完成了
            console.log('所有訓練計劃運動已完成！');
            showToast('恭喜！您已完成所有訓練計劃運動！');
        }
    }
}

// 顯示休息提示
function showRestPrompt() {
    // 停止當前偵測
    if (typeof stopDetection === 'function') {
        stopDetection();
    }
    
    // 獲取下一個運動
    const nextExerciseIndex = currentExerciseIndex + 1;
    if (nextExerciseIndex >= workoutPlan.length) return;
    
    const nextExercise = workoutPlan[nextExerciseIndex];
    const nextExerciseName = getExerciseName(nextExercise.type);
    
    // 更新休息模態窗口內容
    const nextExerciseNameElement = document.getElementById('next-exercise-name');
    if (nextExerciseNameElement) {
        nextExerciseNameElement.textContent = nextExerciseName;
    }
    
    const nextExerciseTargetElement = document.getElementById('next-exercise-target');
    if (nextExerciseTargetElement) {
        nextExerciseTargetElement.textContent = `${nextExercise.reps}次 x ${nextExercise.sets}組`;
    }
    
    const nextExerciseIconElement = document.getElementById('next-exercise-icon');
    if (nextExerciseIconElement) {
        nextExerciseIconElement.innerHTML = getExerciseIcon(nextExercise.type);
    }
    
    // 顯示休息模態窗口
    const restModal = document.getElementById('rest-modal');
    if (restModal) {
        restModal.classList.add('active');
    }
    
    // 重置休息時間
    restTimeRemaining = 30;
    updateRestTimer();
    
    // 開始休息計時器
    if (restTimerInterval) {
        clearInterval(restTimerInterval);
    }
    
    restTimerInterval = setInterval(() => {
        restTimeRemaining--;
        updateRestTimer();
        
        if (restTimeRemaining <= 0) {
            clearInterval(restTimerInterval);
            restTimerInterval = null;
            finishRest();
        }
    }, 1000);
}

// 更新休息計時器顯示
function updateRestTimer() {
    const restTimerElement = document.getElementById('rest-timer');
    if (restTimerElement) {
        restTimerElement.textContent = restTimeRemaining;
    }
}

// 跳過休息
function skipRest() {
    if (restTimerInterval) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
    }
    
    finishRest();
}

// 完成休息
function finishRest() {
    // 隱藏休息模態窗口
    const restModal = document.getElementById('rest-modal');
    if (restModal) {
        restModal.classList.remove('active');
    }
    
    // 切換到下一個運動
    moveToNextExercise();
}

// 切換到下一個運動
function moveToNextExercise() {
    currentExerciseIndex++;
    
    if (currentExerciseIndex >= workoutPlan.length) {
        console.log('已完成所有運動');
        currentExerciseIndex = workoutPlan.length - 1; // 保持在最後一個運動
        return;
    }
    
    // 初始化新的當前運動
    initCurrentExercise();
    
    // 重新開始偵測
    if (typeof startDetection === 'function') {
        startDetection();
    }
}

// 檢查是否需要切換到下一個運動
function checkExerciseProgress(count) {
    if (!workoutPlan || workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) {
        return false;
    }
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    const repsPerSet = currentExercise.reps;
    
    // 檢查是否完成一組
    if (count > 0 && count % repsPerSet === 0) {
        // 計算當前應該完成的組數
        const shouldCompleteSet = Math.floor(count / repsPerSet);
        
        // 如果應該完成的組數大於已記錄的完成組數，則更新完成組數
        if (shouldCompleteSet > currentExercise.completedSets) {
            currentExercise.completedSets = shouldCompleteSet;
            
            // 更新UI
            const remainingSetsDisplay = document.getElementById('remaining-sets');
            if (remainingSetsDisplay) {
                remainingSetsDisplay.textContent = currentExercise.sets - currentExercise.completedSets;
            }
            
            // 更新訓練計劃顯示
            updateWorkoutPlanDisplay();
            
            // 檢查是否完成所有組數
            if (currentExercise.completedSets >= currentExercise.sets) {
                console.log(`${getExerciseName(currentExercise.type)} 所有組數已完成`);
                
                // 檢查是否還有下一個運動
                if (currentExerciseIndex < workoutPlan.length - 1) {
                    // 顯示休息提示
                    showRestPrompt();
                    return true; // 表示已切換運動
                } else {
                    // 所有運動都完成了
                    console.log('所有訓練計劃運動已完成！');
                    showToast('恭喜！您已完成所有訓練計劃運動！');
                }
            }
        }
    }
    
    return false; // 表示未切換運動
}

// 導出函數
window.initWorkoutPlanModule = initWorkoutPlanModule;
window.checkExerciseProgress = checkExerciseProgress;
window.handleExerciseSetCompleted = handleExerciseSetCompleted;