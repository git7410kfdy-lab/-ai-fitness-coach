// 訓練計劃處理模塊

// 全局變量 - 使用window對象來避免重複聲明
// 確保不與workout_plan.js中的變量衝突
window.workoutHandler = window.workoutHandler || {};
window.workoutHandler.plan = window.workoutHandler.plan || []; // 存儲訓練計劃的數組
window.workoutHandler.currentIndex = window.workoutHandler.currentIndex || 0; // 當前執行的運動索引

// 確保在頁面加載完成後執行
document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化訓練計劃處理模塊...');
    
    // 檢查是否已由workout_plan.js處理
    if (typeof initWorkoutPlanModule === 'function') {
        console.log('檢測到workout_plan.js已加載，跳過重複綁定');
        return;
    }
    
    // 綁定添加運動按鈕事件（僅在workout_plan.js未加載時執行）
    const addExerciseBtn = document.getElementById('add-exercise-btn');
    if (addExerciseBtn) {
        console.log('找到添加運動按鈕，綁定點擊事件');
        addExerciseBtn.addEventListener('click', function(event) {
            event.preventDefault();
            addExerciseToWorkout();
        });
    } else {
        console.error('找不到添加運動按鈕 (add-exercise-btn)');
    }
    
    // 綁定保存計劃按鈕事件
    const saveWorkoutPlanBtn = document.getElementById('save-workout-plan');
    if (saveWorkoutPlanBtn) {
        console.log('找到保存計劃按鈕，綁定提交事件');
        saveWorkoutPlanBtn.addEventListener('click', function(event) {
            event.preventDefault();
            saveWorkoutPlan();
        });
    }
    
    // 初始化移除按鈕事件
    initRemoveButtons();
    
    console.log('訓練計劃處理模塊初始化完成');
});

// 添加運動到訓練計劃
function addExerciseToWorkout() {
    console.log('添加新運動到訓練計劃');
    
    // 獲取訓練計劃容器
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) {
        console.error('找不到訓練計劃容器 (workout-exercises)');
        return;
    }
    
    // 計算新運動的索引
    const exerciseItems = workoutExercises.querySelectorAll('.workout-exercise-item');
    const newIndex = exerciseItems.length;
    
    // 創建新的運動項目元素
    const newExerciseItem = document.createElement('div');
    newExerciseItem.className = 'workout-exercise-item';
    newExerciseItem.dataset.index = newIndex;
    
    // 設置運動項目的HTML內容
    newExerciseItem.innerHTML = `
        <div class="exercise-item-header">
            <span class="exercise-number">${newIndex + 1}</span>
            <button type="button" class="remove-exercise-btn" title="移除此運動"><i class="fas fa-times"></i></button>
        </div>
        <div class="exercise-item-body">
            <div class="input-group">
                <label for="exercise-type-${newIndex}">運動類型</label>
                <select id="exercise-type-${newIndex}" name="exercise-type[]" class="exercise-selector" required>
                    <option value="squat">深蹲</option>
                    <option value="bicep-curl">二頭彎舉</option>
                    <option value="shoulder-press">肩推</option>
                    <option value="push-up">伏地挺身</option>
                    <option value="pull-up">引體向上</option>
                    <option value="dumbbell-row">啞鈴划船</option>
                    <option value="table-tennis">桌球揮拍</option>
                    <option value="basketball">籃球投籃</option>
                    <option value="basketball-dribble">籃球運球</option>
                    <option value="volleyball-overhand">排球高手托球</option>
                    <option value="volleyball-lowhand">排球低手接球</option>
                </select>
            </div>
            <div class="exercise-params">
                <div class="input-group">
                    <label for="weight-${newIndex}">重量 (kg)</label>
                    <input type="number" id="weight-${newIndex}" name="weight[]" placeholder="0" min="0" max="200" value="0">
                </div>
                <div class="input-group">
                    <label for="reps-${newIndex}">次數/組</label>
                    <input type="number" id="reps-${newIndex}" name="reps[]" placeholder="10" min="1" max="100" value="10" required>
                </div>
                <div class="input-group">
                    <label for="sets-${newIndex}">組數</label>
                    <input type="number" id="sets-${newIndex}" name="sets[]" placeholder="3" min="1" max="10" value="3" required>
                </div>
            </div>
        </div>
    `;
    
    // 添加到訓練計劃容器
    workoutExercises.appendChild(newExerciseItem);
    
    // 為新添加的運動項目綁定移除按鈕事件
    const removeBtn = newExerciseItem.querySelector('.remove-exercise-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            removeExerciseFromWorkout(newExerciseItem);
        });
    }
    
    console.log(`已添加新運動項目，索引: ${newIndex}`);
}

// 從訓練計劃中移除運動
function removeExerciseFromWorkout(exerciseItem) {
    console.log('移除運動項目');
    
    // 獲取訓練計劃容器
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) {
        console.error('找不到訓練計劃容器 (workout-exercises)');
        return;
    }
    
    // 確保至少保留一個運動項目
    const exerciseItems = workoutExercises.querySelectorAll('.workout-exercise-item');
    if (exerciseItems.length <= 1) {
        console.log('至少需要保留一個運動項目');
        return;
    }
    
    // 移除運動項目
    workoutExercises.removeChild(exerciseItem);
    
    // 更新剩餘運動項目的索引和編號
    updateExerciseIndices();
    
    console.log('運動項目已移除，並更新了索引');
}

// 更新運動項目的索引和編號
function updateExerciseIndices() {
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) return;
    
    const exerciseItems = workoutExercises.querySelectorAll('.workout-exercise-item');
    
    exerciseItems.forEach((item, index) => {
        // 更新data-index屬性
        item.dataset.index = index;
        
        // 更新編號顯示
        const numberElement = item.querySelector('.exercise-number');
        if (numberElement) {
            numberElement.textContent = index + 1;
        }
        
        // 更新輸入元素的ID和label的for屬性
        const typeSelect = item.querySelector('select[id^="exercise-type-"]');
        const weightInput = item.querySelector('input[id^="weight-"]');
        const repsInput = item.querySelector('input[id^="reps-"]');
        const setsInput = item.querySelector('input[id^="sets-"]');
        
        if (typeSelect) {
            typeSelect.id = `exercise-type-${index}`;
            const label = item.querySelector(`label[for^="exercise-type-"]`);
            if (label) label.setAttribute('for', `exercise-type-${index}`);
        }
        
        if (weightInput) {
            weightInput.id = `weight-${index}`;
            const label = item.querySelector(`label[for^="weight-"]`);
            if (label) label.setAttribute('for', `weight-${index}`);
        }
        
        if (repsInput) {
            repsInput.id = `reps-${index}`;
            const label = item.querySelector(`label[for^="reps-"]`);
            if (label) label.setAttribute('for', `reps-${index}`);
        }
        
        if (setsInput) {
            setsInput.id = `sets-${index}`;
            const label = item.querySelector(`label[for^="sets-"]`);
            if (label) label.setAttribute('for', `sets-${index}`);
        }
    });
}

// 初始化所有移除按鈕的事件
function initRemoveButtons() {
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) return;
    
    const removeButtons = workoutExercises.querySelectorAll('.remove-exercise-btn');
    
    removeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const exerciseItem = this.closest('.workout-exercise-item');
            if (exerciseItem) {
                removeExerciseFromWorkout(exerciseItem);
            }
        });
    });
    
    console.log(`已初始化 ${removeButtons.length} 個移除按鈕`);
}

// 保存訓練計劃
function saveWorkoutPlan() {
    console.log('保存訓練計劃');
    
    // 檢查是否由workout_plan.js處理
    if (typeof initWorkoutPlanModule === 'function') {
        console.log('檢測到workout_plan.js已加載，使用其保存功能');
        return;
    }
    
    // 獲取訓練計劃容器
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) {
        console.error('找不到訓練計劃容器 (workout-exercises)');
        return;
    }
    
    // 獲取所有運動項目
    const exerciseItems = workoutExercises.querySelectorAll('.workout-exercise-item');
    
    // 創建訓練計劃數據
    const workoutPlanData = [];
    
    exerciseItems.forEach((item, index) => {
        const typeSelect = item.querySelector(`select[id^="exercise-type-"]`);
        const weightInput = item.querySelector(`input[id^="weight-"]`);
        const repsInput = item.querySelector(`input[id^="reps-"]`);
        const setsInput = item.querySelector(`input[id^="sets-"]`);
        
        if (typeSelect && weightInput && repsInput && setsInput) {
            workoutPlanData.push({
                type: typeSelect.value,
                weight: parseInt(weightInput.value) || 0,
                reps: parseInt(repsInput.value) || 10,
                sets: parseInt(setsInput.value) || 3,
                completedReps: 0,
                completedSets: 0
            });
        }
    });
    
    // 更新全局訓練計劃變量，使用workoutHandler命名空間
    window.workoutHandler.plan = workoutPlanData;
    // 為了兼容性，也設置window.workoutPlan
    window.workoutPlan = workoutPlanData;
    window.currentExerciseIndex = 0;
    
    // 更新訓練計劃摘要顯示
    updateWorkoutPlanSummary(workoutPlanData);
    
    console.log('訓練計劃已保存:', workoutPlanData);
    
    // 顯示成功提示
    showToast('訓練計劃已保存', 'success');
    
    // 初始化當前運動
    initCurrentExercise();
}

// 更新訓練計劃摘要顯示
function updateWorkoutPlanSummary(planData) {
    const summaryContainer = document.getElementById('current-plan-display');
    if (!summaryContainer) return;
    
    // 清空摘要容器
    summaryContainer.innerHTML = '';
    
    // 如果沒有計劃數據，顯示默認信息
    if (!planData || planData.length === 0) {
        summaryContainer.innerHTML = '<div class="no-plan">尚未設定訓練計劃</div>';
        return;
    }
    
    // 創建計劃摘要列表
    const planList = document.createElement('div');
    planList.className = 'plan-exercise-list';
    
    // 添加每個運動項目
    planData.forEach((exercise, index) => {
        const exerciseItem = document.createElement('div');
        exerciseItem.className = 'plan-exercise-item';
        if (index === 0) exerciseItem.classList.add('active');
        
        // 獲取運動類型的顯示名稱
        const exerciseName = getExerciseDisplayName(exercise.type);
        
        exerciseItem.innerHTML = `
            <div class="plan-exercise-name">${exerciseName}</div>
            <div class="plan-exercise-params">
                ${exercise.weight > 0 ? exercise.weight + 'kg · ' : ''}
                ${exercise.reps}次 x ${exercise.sets}組
            </div>
        `;
        
        planList.appendChild(exerciseItem);
    });
    
    // 添加到摘要容器
    summaryContainer.appendChild(planList);
    
    // 更新當前運動信息
    updateCurrentExerciseInfo(planData[0]);
}

// 獲取運動類型的顯示名稱
function getExerciseDisplayName(type) {
    const exerciseNames = {
        'squat': '深蹲',
        'bicep-curl': '二頭彎舉',
        'shoulder-press': '肩推',
        'push-up': '伏地挺身',
        'pull-up': '引體向上',
        'dumbbell-row': '啞鈴划船',
        'table-tennis': '桌球揮拍',
        'basketball': '籃球投籃',
        'basketball-dribble': '籃球運球'
    };
    
    return exerciseNames[type] || type;
}

// 更新當前運動信息
function updateCurrentExerciseInfo(exercise) {
    if (!exercise) return;
    
    const currentExerciseElement = document.getElementById('current-plan-exercise');
    const progressElement = document.getElementById('current-exercise-progress');
    const setsElement = document.getElementById('current-exercise-sets');
    
    if (currentExerciseElement) {
        currentExerciseElement.textContent = getExerciseDisplayName(exercise.type);
    }
    
    if (progressElement) {
        progressElement.textContent = `${exercise.completedReps || 0}/${exercise.reps}`;
    }
    
    if (setsElement) {
        setsElement.textContent = `${exercise.completedSets || 0}/${exercise.sets}`;
    }
}

// 初始化當前運動
function initCurrentExercise() {
    if (!window.workoutPlan || window.workoutPlan.length === 0) return;
    
    const currentExercise = window.workoutPlan[window.currentExerciseIndex];
    if (!currentExercise) return;
    
    // 更新UI顯示當前運動信息
    const exerciseNameElement = document.getElementById('current-exercise-name');
    const weightElement = document.getElementById('current-weight');
    const targetRepsElement = document.getElementById('target-reps');
    const targetSetsElement = document.getElementById('target-sets');
    const remainingSetsElement = document.getElementById('remaining-sets');
    
    if (exerciseNameElement) {
        exerciseNameElement.textContent = getExerciseDisplayName(currentExercise.type);
    }
    
    if (weightElement) {
        weightElement.textContent = currentExercise.weight;
    }
    
    if (targetRepsElement) {
        targetRepsElement.textContent = currentExercise.reps;
    }
    
    if (targetSetsElement) {
        targetSetsElement.textContent = currentExercise.sets;
    }
    
    if (remainingSetsElement) {
        const remainingSets = currentExercise.sets - (currentExercise.completedSets || 0);
        remainingSetsElement.textContent = remainingSets;
    }
    
    // 更新運動計數器
    updateExerciseCounter(0);
    
    // 更新教練提示
    updateCoachTip(currentExercise.type);
    
    console.log(`已初始化當前運動: ${getExerciseDisplayName(currentExercise.type)}`);
}

// 更新運動計數器
function updateExerciseCounter(count) {
    const counterElement = document.getElementById('exercise-count');
    if (counterElement) {
        counterElement.textContent = count;
    }
}

// 更新教練提示
function updateCoachTip(exerciseType) {
    const tipElement = document.getElementById('coach-tip-text');
    if (!tipElement) return;
    
    // 根據運動類型設置提示
    const tips = {
        'squat': '保持背部挺直，膝蓋不要超過腳尖，下蹲時大腿與地面平行。',
        'bicep-curl': '保持上臂靠近身體，只移動前臂，控制重量不要晃動。',
        'shoulder-press': '保持核心收緊，推起時手臂完全伸直，放下時控制速度。',
        'push-up': '保持身體成一直線，肘部靠近身體，下降時胸部接近地面。',
        'pull-up': '握距適中，下降時手臂完全伸展，上拉時下巴超過橫桿。',
        'dumbbell-row': '保持背部平直，肘部向後拉，收緊背部肌肉。',
        'table-tennis': '保持手腕靈活，揮拍時身體重心跟隨移動。',
        'basketball': '投籃時保持手肘在籃球下方，手腕跟隨動作自然彎曲。',
        'basketball-dribble': '保持頭部抬起，用指尖而非手掌控制球，身體放鬆。'
    };
    
    tipElement.textContent = tips[exerciseType] || '請選擇運動類型並開始偵測以獲得即時建議。';
}

// 顯示提示消息
function showToast(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    
    // 檢查是否已有toast元素
    let toastContainer = document.querySelector('.toast-container');
    
    // 如果沒有，創建一個
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // 創建新的toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 顯示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 設置自動消失
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}