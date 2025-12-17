
function setupSocketListeners() {
    if (!socket) {
        console.warn('Socket未初始化，跳過事件監聽設置');
        return;
    }
    
    // 監聽訓練計劃保存結果
    socket.on('workout_plan_saved', function(data) {
        console.log('[workout_plan_saved] 收到訓練計劃保存結果:', data);
        
        if (data.status === 'success') {
            showNotification('訓練計劃已成功保存到資料庫', 'success');
            console.log(`[workout_plan_saved] 記錄ID: ${data.record_id}`);
        } else {
            showNotification(`保存失敗: ${data.message}`, 'error');
            console.error('[workout_plan_saved] 保存失敗:', data.message);
        }
    });
    
    // 監聽運動完成事件
    socket.on('exercise_completed', function(data) {
        console.log('[exercise_completed] 收到運動完成事件:', data);
        
        // 觸發慶祝互動效果
        triggerCelebration(data);
        
        // 顯示完成通知
        showNotification('恭喜！已完成運動目標！', 'success');
        
        // 檢查是否為雙手輪流擺動熱身運動完成
        if (data && data.exercise_type === 'Alternating Arm Swing Warmup') {
            console.log('雙手輪流擺動熱身運動完成，對怪物造成致命傷害');
            
            // 對怪物造成大量傷害以擊敗它
            const massiveDamage = 9999; // 足夠擊敗任何怪物的傷害值
            
            // 使用 game.js 中的 decreaseMonsterHP 函數
            if (typeof decreaseMonsterHP === 'function') {
                // 暫時設置一個很高的計數來觸發大量傷害
                const currentCount = typeof exerciseCounter !== 'undefined' ? exerciseCounter : 0;
                const targetCount = currentCount + massiveDamage;
                decreaseMonsterHP(targetCount);
                console.log(`對怪物造成 ${massiveDamage} 點傷害`);
            } else if (typeof window.gameManager !== 'undefined' && window.gameManager && typeof window.gameManager.decreaseMonsterHP === 'function') {
                // 使用 GameManager 的方法
                window.gameManager.decreaseMonsterHP(massiveDamage);
                console.log(`通過 GameManager 對怪物造成 ${massiveDamage} 點傷害`);
            } else {
                // 直接調用怪物被擊敗函數
                console.log('直接調用怪物被擊敗函數');
                if (typeof monsterDefeated === 'function') {
                    monsterDefeated();
                } else if (typeof window.gameManager !== 'undefined' && window.gameManager && typeof window.gameManager.monsterDefeated === 'function') {
                    window.gameManager.monsterDefeated();
                }
            }
        }
    });
    
    // 設置快速切換監聽器
    setupFastSwitchListener();
}


function resetExerciseCounters() {
    currentExerciseReps = 0;
    exerciseCounter = 0;
    document.getElementById('exercise-count').textContent = 0;
    lastQuality = 0;
    updateQualityDisplay();
    
    // 重置雙手輪流擺動熱身運動相關顯示
    const accumulatedTime = document.getElementById('accumulated-time');
    if (accumulatedTime) {
        accumulatedTime.textContent = '0.0';
    }
    
    const motionStatus = document.getElementById('motion-status');
    if (motionStatus) {
        motionStatus.textContent = '等待開始';
    }
    
    const leftArmStatus = document.getElementById('left-arm-status');
    if (leftArmStatus) {
        leftArmStatus.textContent = '待機';
    }
    
    const rightArmStatus = document.getElementById('right-arm-status');
    if (rightArmStatus) {
        rightArmStatus.textContent = '待機';
    }
    
    const alternatingStatus = document.getElementById('alternating-status');
    if (alternatingStatus) {
        alternatingStatus.textContent = '未開始';
    }
    
    const progressFill = document.getElementById('timer-progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    
    const progressText = document.getElementById('timer-progress-text');
    if (progressText) {
        progressText.textContent = '0%';
    }
}



function generateCoachTips(angles, exerciseType) {
    if (!angles || Object.keys(angles).length === 0) {
        return "等待接收角度數據...";
    }
    
    let tips = [];
    
    // 根據運動類型分析角度並生成建議
    switch (exerciseType) {
        case 'squat': // 深蹲
            // 膝蓋角度 (通常應該在最低點時約為90度)
            if (angles.knee !== undefined) {
                if (angles.knee < 70) {
                    tips.push(`膝蓋彎曲過度 (${angles.knee.toFixed(1)}°)，可能會增加膝蓋壓力。嘗試不要蹲得太低。`);
                } else if (angles.knee > 100) {
                    tips.push(`深蹲深度不足 (${angles.knee.toFixed(1)}°)，嘗試蹲得更低，膝蓋彎曲至約90度。`);
                } else {
                    tips.push(`膝蓋角度良好 (${angles.knee.toFixed(1)}°)。`);
                }
            }
            
            // 髖部角度
            if (angles.hip !== undefined) {
                if (angles.hip < 45) {
                    tips.push(`髖部彎曲不足 (${angles.hip.toFixed(1)}°)，記得向後推臀部，保持背部挺直。`);
                } else {
                    tips.push(`髖部角度良好 (${angles.hip.toFixed(1)}°)。`);
                }
            }
            
            // 背部角度 (應該保持挺直)
            if (angles.back !== undefined) {
                if (angles.back < 45) {
                    tips.push(`背部過度前傾 (${angles.back.toFixed(1)}°)，保持胸部挺起，背部挺直。`);
                } else {
                    tips.push(`背部角度良好 (${angles.back.toFixed(1)}°)。`);
                }
            }
            break;
            
        case 'pushup':
        case 'push-up': // 伏地挺身
            // 肘部角度 (最低點應約為90度)
            if (angles.elbow !== undefined) {
                if (angles.elbow < 70) {
                    tips.push(`肘部彎曲過度 (${angles.elbow.toFixed(1)}°)，可能會增加肩部壓力。`);
                } else if (angles.elbow > 110) {
                    tips.push(`下降深度不足 (${angles.elbow.toFixed(1)}°)，嘗試降低身體直到肘部約為90度。`);
                } else {
                    tips.push(`(${angles.elbow.toFixed(1)}°)。`);
                }
            }
            
            // 身體角度 (應保持直線)
            if (angles.body !== undefined) {
                if (angles.body < 160) {
                    tips.push(`身體未保持直線 (${angles.body.toFixed(1)}°)，腹部下沉。收緊核心肌群，保持身體成一直線。`);
                } else {
                    tips.push(`身體姿勢良好 (${angles.body.toFixed(1)}°)，保持良好的平板支撐。`);
                }
            }
            break;
            
        case 'situp': // 仰臥起坐
            // 上身與地面的角度 (應達到45度以上)
            if (angles.body !== undefined) {
                if (angles.body < 30) {
                    tips.push(`上身抬起不足 (${angles.body.toFixed(1)}°)，嘗試抬高上身至少45度。`);
                } else {
                    tips.push(`上身抬起角度良好 (${angles.body.toFixed(1)}°)。`);
                }
            }
            break;
            
        case 'bicep-curl': // 二頭彎舉
            // 肘部角度
            if (angles.elbow !== undefined) {
                if (angles.elbow > 160) {
                    tips.push(`手臂伸展過直 (${angles.elbow.toFixed(1)}°)，保持輕微彎曲以維持肌肉張力。`);
                } else if (angles.elbow < 30) {
                    tips.push(`手臂彎曲過度 (${angles.elbow.toFixed(1)}°)，可能會增加肘部壓力。`);
                } else {
                    tips.push(`肘部角度良好 (${angles.elbow.toFixed(1)}°)。`);
                }
            }
            
            // 上臂與身體的角度 (應保持固定)
            if (angles.shoulder !== undefined) {
                if (angles.shoulder > 30) {
                    tips.push(`上臂未固定 (${angles.shoulder.toFixed(1)}°)，保持上臂貼近身體。`);
                } else {
                    tips.push(`上臂位置良好 (${angles.shoulder.toFixed(1)}°)。`);
                }
            }
            break;
            
        case 'table-tennis': // 桌球揮拍
            // 肘部角度
            if (angles.elbow !== undefined) {
                if (angles.elbow < 60) {
                    tips.push(`手臂彎曲過度 (${angles.elbow.toFixed(1)}°)，嘗試保持手臂更加伸展。`);
                } else if (angles.elbow > 170) {
                    tips.push(`手臂過於伸直 (${angles.elbow.toFixed(1)}°)，保持適當彎曲以增加揮拍靈活性。`);
                } else {
                    tips.push(`肘部角度良好 (${angles.elbow.toFixed(1)}°)。`);
                }
            }
            
            // 肩部角度
            if (angles.shoulder !== undefined) {
                if (angles.shoulder < 30) {
                    tips.push(`揮拍幅度不足 (${angles.shoulder.toFixed(1)}°)，增加揮拍幅度以產生更多力量。`);
                } else if (angles.shoulder > 120) {
                    tips.push(`揮拍幅度過大 (${angles.shoulder.toFixed(1)}°)，可能影響控制精度。`);
                } else {
                    tips.push(`揮拍幅度良好 (${angles.shoulder.toFixed(1)}°)。`);
                }
            }
            break;
            
        case 'basketball': // 籃球投籃
            // 肘部角度
            if (angles.elbow !== undefined) {
                if (angles.elbow < 70) {
                    tips.push(`手臂彎曲過度 (${angles.elbow.toFixed(1)}°)，影響投籃力量。`);
                } else if (angles.elbow > 170) {
                    tips.push(`手臂過於伸直 (${angles.elbow.toFixed(1)}°)，缺乏投籃弧度。`);
                } else {
                    tips.push(`肘部角度良好 (${angles.elbow.toFixed(1)}°)。`);
                }
            }
            
            // 肩部角度
            if (angles.shoulder !== undefined) {
                if (angles.shoulder < 80) {
                    tips.push(`手臂抬起不足 (${angles.shoulder.toFixed(1)}°)，嘗試將手臂抬高至少90度。`);
                } else {
                    tips.push(`手臂高度良好 (${angles.shoulder.toFixed(1)}°)。`);
                }
            }
            break;
            
        case 'basketball-dribble': // 籃球運球
            // 膝蓋角度
            if (angles.knee !== undefined) {
                if (angles.knee > 150) {
                    tips.push(`膝蓋彎曲不足 (${angles.knee.toFixed(1)}°)，降低重心以增加控球穩定性。`);
                } else if (angles.knee < 90) {
                    tips.push(`膝蓋彎曲過度 (${angles.knee.toFixed(1)}°)，可能影響移動靈活性。`);
                } else {
                    tips.push(`膝蓋彎曲良好 (${angles.knee.toFixed(1)}°)，保持良好的運球姿勢。`);
                }
            }
            
            // 手腕高度（相對於膝蓋）
            if (currentDribbleMode === 'high') {
                tips.push(`當前為高位運球模式，保持手腕在膝蓋以上位置運球。`);
            } else {
                tips.push(`當前為低位運球模式，保持手腕在膝蓋以下位置運球。`);
            }
            break;
            
        default:
            tips.push(`請選擇運動類型開始訓練。`);
    }
    
    // 如果沒有生成任何提示，返回默認提示
    if (tips.length === 0) {
        return `保持良好姿勢，繼續運動！`;
    }
    
    return tips.join('');
} 


// 更新教練提示函數
function updateCoachTip(tip, angles) {
    if (!coachTipText) return;
    
    // 如果提供了明確的提示，則直接使用
    if (tip && tip.trim() !== '') {
        // 檢查提示是否已包含HTML標籤
        if (tip.includes('<div') || tip.includes('<i')) {
            coachTipText.innerHTML = tip; // 已經是HTML格式
        } else {
            // 將純文本轉換為簡單的HTML格式
            coachTipText.innerHTML = `<div class="tip-item info"><i class="fas fa-info-circle"></i> ${tip}</div>`;
        }
        return;
    }
    
    // 否則，根據角度數據生成提示
    if (angles && Object.keys(angles).length > 0) {
        const exerciseType = currentExerciseType || 'squat';
        coachTipText.innerHTML = generateCoachTips(angles, exerciseType);
    }
}

// 暴露為全域函數
window.saveWorkoutPlan = function saveWorkoutPlan() {
    console.log('[saveWorkoutPlan] 開始保存訓練計劃');
    
    // 獲取學號
    const studentId = getCurrentStudentId();
    if (!studentId) {
        showNotification('請先輸入學號', 'error');
        return;
    }
    
    // 驗證學號
    if (!validateStudentId()) {
        showNotification('請輸入有效的學號', 'error');
        return;
    }

    // 獲取訓練計劃容器
    const workoutExercises = document.getElementById('workout-exercises');
    if (!workoutExercises) {
        console.error('找不到訓練計劃容器 (workout-exercises)');
        showNotification('訓練計劃表單欄位缺失，請檢查頁面元素！', 'error');
        return;
    }
    
    // 獲取所有運動項目
    const exerciseItems = workoutExercises.querySelectorAll('.workout-exercise-item');
    
    if (exerciseItems.length === 0) {
        showNotification('請至少添加一個運動項目', 'error');
        return;
    }
    
    // 清空現有的訓練計劃
    workoutPlan = [];
    
    // 處理每個運動項目
    exerciseItems.forEach((item, itemIndex) => {
        const typeSelect = item.querySelector('select[name="exercise-type[]"]') || 
                          item.querySelector(`#exercise-type-${itemIndex}`) ||
                          item.querySelector('#exercise-type');
        const weightInput = item.querySelector('input[name="weight[]"]') || 
                           item.querySelector(`#weight-${itemIndex}`) ||
                           item.querySelector('#weight');
        const repsInput = item.querySelector('input[name="reps[]"]') || 
                         item.querySelector(`#reps-${itemIndex}`) ||
                         item.querySelector('#reps');
        const setsInput = item.querySelector('input[name="sets[]"]') || 
                         item.querySelector(`#sets-${itemIndex}`) ||
                         item.querySelector('#sets');
        
        if (!typeSelect || !weightInput || !repsInput || !setsInput) {
            console.error(`運動項目 ${itemIndex + 1} 的表單欄位缺失`);
            return;
        }
        
        const exerciseType = typeSelect.value;
        const weight = parseInt(weightInput.value) || 0;
        const reps = parseInt(repsInput.value) || 10;
        const sets = parseInt(setsInput.value) || 1;
        
        console.log(`[saveWorkoutPlan] 處理運動項目 ${itemIndex + 1} - 運動: ${exerciseType}, 重量: ${weight}, 次數: ${reps}, 組數: ${sets}`);
        
        // 驗證數據
        if (!exerciseType) {
            showNotification(`運動項目 ${itemIndex + 1} 請選擇運動類型`, 'error');
            return;
        }
        
        if (reps <= 0 || sets <= 0) {
            showNotification(`運動項目 ${itemIndex + 1} 次數和組數必須大於0`, 'error');
            return;
        }
        
        // 將多組運動分解為多個單組運動
        for (let setIndex = 0; setIndex < sets; setIndex++) {
            workoutPlan.push({
                type: exerciseType,
                weight: weight,
                reps: reps,
                sets: 1, // 每個項目都是1組
                originalSets: sets, // 記錄原始組數
                setNumber: setIndex + 1, // 記錄是第幾組
                originalSetNumber: setIndex + 1, // 添加originalSetNumber屬性
                totalOriginalSets: sets, // 添加totalOriginalSets屬性
                exerciseIndex: itemIndex, // 記錄是第幾個運動項目
                studentId: studentId // 添加學號
            });
        }
    });
    
    if (workoutPlan.length === 0) {
        showNotification('訓練計劃為空，請檢查輸入', 'error');
        return;
    }
    
    console.log('[saveWorkoutPlan] 分解後的訓練計劃:', workoutPlan);
    
    // 重置當前運動索引
    currentExerciseIndex = 0;
    
    // 初始化第一個運動
    if (workoutPlan.length > 0) {
        initCurrentExercise();
    }
    
    // 更新訓練計劃摘要
    updateWorkoutPlanSummary();
    
    // 更新訓練計劃顯示
    updateWorkoutPlanDisplay();
    
    // 顯示成功通知
    const totalExercises = exerciseItems.length;
    const totalSets = workoutPlan.length;
    showNotification(`訓練計劃已保存：共 ${totalExercises} 種運動，總計 ${totalSets} 組`, 'success');
    
    console.log('[saveWorkoutPlan] 訓練計劃保存完成');
}; // 結束 window.saveWorkoutPlan 函數

// 更新訓練計劃顯示
function updateWorkoutPlanDisplay() {
    const planDisplay = document.getElementById('current-plan-display');
    if (!planDisplay) return;
    
    if (workoutPlan.length === 0) {
        planDisplay.innerHTML = '<div class="no-plan">尚未設定訓練計劃</div>';
        return;
    }
    
    let html = '';
    workoutPlan.forEach((exercise, index) => {
        const isActive = index === currentExerciseIndex;
        const isCompleted = exercise.completedSets >= exercise.sets;
        
        let statusClass = '';
        if (isActive) statusClass = 'active';
        if (isCompleted) statusClass = 'completed';
        
        let exerciseName = '';
        switch(exercise.type) {
            case 'squat': exerciseName = '深蹲'; break;
            case 'bicep-curl': exerciseName = '二頭彎舉'; break;
            case 'shoulder-press': exerciseName = '肩推'; break;
            case 'push-up': exerciseName = '伏地挺身'; break;
            case 'pull-up': exerciseName = '引體向上'; break;
            case 'dumbbell-row': exerciseName = '啞鈴划船'; break;
            case 'table-tennis': exerciseName = '桌球揮拍'; break;
            case 'basketball': exerciseName = '籃球投籃'; break;
            case 'basketball-dribble': exerciseName = '籃球運球'; break;
            case 'volleyball-overhand': exerciseName = '排球高手攻擊'; break;
            case 'volleyball-lowhand': exerciseName = '排球低手接球'; break;
            default: exerciseName = '未知運動';
        }
        
        html += `
            <div class="plan-exercise-item ${statusClass}" data-index="${index}">
                <div class="plan-exercise-name">${index + 1}. ${exerciseName}</div>
                <div class="plan-exercise-details">
                    ${exercise.weight > 0 ? exercise.weight + 'kg, ' : ''}
                    ${exercise.reps}次 x ${exercise.sets}組
                    ${isCompleted ? '<span class="completed-tag">已完成</span>' : ''}
                </div>
            </div>
        `;
    });
    
    planDisplay.innerHTML = html;
    
    // 更新當前運動信息
    updateCurrentExerciseInfo();
}

// 更新當前運動信息顯示
function updateCurrentExerciseInfo() {
    if (workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) {
        return;
    }
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    
    // 更新運動名稱
    const exerciseNameElement = document.getElementById('current-exercise-name');
    if (exerciseNameElement) {
        const exerciseName = getExerciseName(currentExercise.type);
        exerciseNameElement.textContent = `${exerciseName} (第${currentExercise.originalSetNumber}/${currentExercise.totalOriginalSets}組)`;
    }
    
    // 更新目標次數
    const targetRepsElement = document.getElementById('target-reps');
    if (targetRepsElement) targetRepsElement.textContent = currentExercise.reps;
    
    // 更新重量
    const weightElement = document.getElementById('current-weight');
    if (weightElement) weightElement.textContent = currentExercise.weight;
    
    // 更新剩餘組數（現在總是顯示1組）
    remainingSets = 1;
    updateRemainingSetsDisplay();
}

// 初始化當前運動
function initCurrentExercise() {
    if (workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) {
        console.log('沒有可用的運動計劃或已完成所有運動');
        return;
    }
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    
    // 設置當前運動類型
    currentExerciseType = currentExercise.type;
    
    // 重置計數器
    exerciseCounter = 0;
    currentExerciseReps = 0; // 新增重置
    currentExerciseSets = 0; // 新增重置
    if (exerciseCount) exerciseCount.textContent = '0';
    
    // 更新UI
    updateCurrentExerciseInfo();
    
    console.log(`初始化運動: ${currentExerciseType}, 目標: ${currentExercise.reps}次 x ${currentExercise.sets}組, 重置計數器`);
    
    // 如果正在偵測，則停止 (啟動將由 switchToNextExercise 處理)
    // if (isDetecting) {
    //     stopDetection();
    //     // setTimeout(() => {
    //     //     startDetection();
    //     // }, 500);
    // }
}



// 顯示籃球投籃姿勢檢視視窗
function showBasketballPromptModal() {
    const modal = document.getElementById('basketball-prompt-modal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('顯示籃球投籃姿勢檢視視窗');
    } else {
        console.error('找不到籃球投籃姿勢檢視視窗元素');
    }
}

// 檢查運動完成情況
function checkExerciseCompletion(count) {
    if (!isDetecting) {
        console.log('檢測已停止，忽略完成檢查');
        return;
    }

    // 檢查是否有可用的運動計劃或已完成所有運動
    if (workoutPlan.length === 0 || currentExerciseIndex >= workoutPlan.length) return;
    
    const currentExercise = workoutPlan[currentExerciseIndex];
    
    // 更新已完成的次數
    currentExercise.completedReps = count;
    
    // 檢查是否完成一組（現在每個項目都只有1組）
    if (count >= currentExercise.reps) {
        // 完成當前運動項目
        currentExercise.completedSets = 1;
        
        // 重置運動計數器
        exerciseCounter = 0;
        if (exerciseCount) exerciseCount.textContent = '0';
        
        console.log(`完成運動項目: ${getExerciseName(currentExercise.type)} 第${currentExercise.originalSetNumber}組/${currentExercise.totalOriginalSets}組`);
        
        // 顯示提示
        showNotification(`完成第${currentExercise.originalSetNumber}組 ${getExerciseName(currentExercise.type)}！`, 'success');
        
        // 檢查是否為籃球投籃訓練
        const isBasketballExercise = currentExercise.type === 'basketball';
        
        // 停止偵測
        try {
            if (isDetecting) {
                stopDetection();
            }
        } catch (error) {
            console.error('停止偵測時發生錯誤:', error);
        }
        
        // 如果是籃球投籃訓練，顯示提示視窗
        if (isBasketballExercise) {
            console.log('籃球投籃訓練完成，顯示提示視窗');
            setTimeout(() => {
                try {
                    showBasketballPostureCheckPopup();
                } catch (error) {
                    console.error('顯示籃球投籃檢視提示視窗時發生錯誤:', error);
                    if (confirm('您已完成籃球投籃訓練！是否要查看投籃姿勢分析？')) {
                        window.location.href = '/exercise/picture';
                    }
                }
            }, 500);
        }
        
        // 檢查是否正在切換中，防止重複觸發
        if (!isSwitchingExercise) {
            isSwitchingExercise = true;
            // 如果啟用自動切換，則顯示休息提示並準備切換到下一個運動
            if (autoSwitchExercise) {
                showRestModal();
            } else {
                setTimeout(() => { isSwitchingExercise = false; }, 500);
            }
        }
    }
    
    // 更新UI
    updateCurrentExerciseInfo();
}

// 切換到下一個運動
function switchToNextExercise() {
    // 檢查是否還有下一個運動
    if (currentExerciseIndex < workoutPlan.length - 1) {
        // 切換到下一個運動
        currentExerciseIndex++;
        
        // 獲取新的運動信息
        const nextExercise = workoutPlan[currentExerciseIndex];
        
        // 初始化新的運動
        initCurrentExercise();
        
        // 確保originalSetNumber存在，如果不存在則使用setNumber
        const setNumber = nextExercise.originalSetNumber || nextExercise.setNumber || 1;
        
        console.log(`切換到下一個運動: ${currentExerciseType} 第${setNumber}組`);
        
        // 顯示提示
        showNotification(`切換到: ${getExerciseName(currentExerciseType)} 第${setNumber}組`, 'info');
        
    } else {
        // 已完成所有運動
        console.log('運動完成！');
        showNotification('恭喜完成訓練！你已經完成了所有設定的組數', 'success');
        if (isDetecting) {
            stopDetection();
        }

    
        // 重置狀態
        currentExerciseIndex = 0;
        workoutPlan = [];
        updateCurrentExerciseInfo();
    }
}


function sendWorkoutPlanToBackend(plan) {
    const studentId = getCurrentStudentId();
    console.log('[sendWorkoutPlanToBackend] studentId:', studentId); // 新增日誌
    console.log('[sendWorkoutPlanToBackend] plan:', JSON.stringify(plan)); // 新增日誌，使用 JSON.stringify 查看完整內容
    if (!studentId) {
        console.error('[sendWorkoutPlanToBackend] Error: studentId is null or empty.'); // 新增錯誤日誌
        showNotification('錯誤：未獲取到學生ID，無法儲存訓練紀錄', 'error');
        return;
    }

    if (!plan || plan.length === 0) {
        console.error('[sendWorkoutPlanToBackend] Error: plan is null or empty.'); // 新增錯誤日誌
        showNotification('錯誤：訓練計劃為空，無法儲存', 'error');
        return;
    }

    console.log('送出資料:', { student_id: studentId, plan });

    if (!studentId) return;
    console.log('送出資料:', { student_id: studentId, plan });
    fetch('/api/exercise/record_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, plan: plan })
    })
    .then(res => res.json())
    .then(data => {
        showNotification('訓練紀錄已成功儲存', 'success');
        console.log('後端回應:', data);
    })
    .catch(err => {
        showNotification('儲存訓練紀錄失敗', 'error');
        console.error('送出訓練計劃失敗:', err);
    });
}

// 獲取運動名稱
function getExerciseName(exerciseType) {
    switch(exerciseType) {
        case 'squat': return '深蹲';
        case 'bicep-curl': return '二頭彎舉';
        case 'shoulder-press': return '肩推';
        case 'push-up': return '伏地挺身';
        case 'pull-up': return '引體向上';
        case 'dumbbell-row': return '啞鈴划船';
        case 'table-tennis': return '桌球揮拍';
        case 'basketball': return '籃球投籃';
        case 'basketball-dribble': return '籃球運球';
        case 'volleyball-overhand': return '排球高手托球';
        case 'volleyball-lowhand': return '排球低手接球';
        default: return '未知運動';
    }
}

// 顯示休息模態視窗
function showRestModal() {
    // 獲取下一個運動
    const nextExerciseIndex = currentExerciseIndex + 1;
    if (nextExerciseIndex >= workoutPlan.length) {
        // 已經是最後一個運動，顯示完成訊息
        showCompletionMessage();
        return;
    }
    
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
    
    // 顯示休息模態窗口
    const restModal = document.getElementById('rest-modal');
    if (restModal) {
        restModal.classList.add('active');
    }
    
    // 設置休息時間
    let restTimeRemaining = 30;
    const restTimerElement = document.getElementById('rest-timer');
    if (restTimerElement) {
        restTimerElement.textContent = restTimeRemaining;
    }
    
    // 開始休息計時器
    let restTimerInterval = setInterval(() => {
        restTimeRemaining--;
        
        if (restTimerElement) {
            restTimerElement.textContent = restTimeRemaining;
        }
        
        if (restTimeRemaining <= 0) {
            clearInterval(restTimerInterval);
            restTimerInterval = null;
            finishRest();
        }
    }, 1000);
    
    // 為跳過休息按鈕添加事件
    const skipRestBtn = document.getElementById('skip-rest-btn');
    if (skipRestBtn) {
        // 移除舊的事件監聽器
        const newSkipBtn = skipRestBtn.cloneNode(true);
        skipRestBtn.parentNode.replaceChild(newSkipBtn, skipRestBtn);
        
        // 添加新的事件監聽器
        newSkipBtn.addEventListener('click', () => {
            if (restTimerInterval) {
                clearInterval(restTimerInterval);
                restTimerInterval = null;
            }
            finishRest();
        });
    }
}

// 完成休息
function finishRest() {
    // 隱藏休息模態窗口
    const restModal = document.getElementById('rest-modal');
    if (restModal) {
        restModal.classList.remove('active');
    }
    
    // 切換到下一個運動
    switchToNextExercise();

    // 在休息結束後開始偵測下一個運動
    setTimeout(() => {
        // 確保切換標記已重置
        isSwitchingExercise = false; 
        startDetection();
    }, 500); // 短暫延遲以確保UI更新完成
}

function loadMonsterModel() {
    // 獲取怪物容器
    const monsterScene = document.getElementById('monster-scene');
    if (!monsterScene) {
        console.error('找不到怪物場景容器元素');
        return;
    }
    
    try {
        console.log('開始初始化怪物模型場景');
        
        // 創建 Three.js 場景
        const scene = new THREE.Scene();
        scene.background = null; // 確保背景透明
        
        // 設置相機 - 調整相機參數以顯示全身模型
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
        camera.position.set(0, 0, 100); // 增加相機距離
        camera.lookAt(0, -5, 0); // 調整視角更向下
        
        // 設置渲染器
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        
        // 調整渲染大小 - 使用固定尺寸
        const size = Math.min(300, monsterScene.clientWidth);
        renderer.setSize(size, size);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // 透明背景
        
        // 清空容器並添加渲染器
        monsterScene.innerHTML = '';
        monsterScene.appendChild(renderer.domElement);
        
        // 確保容器有適當的樣式 - 添加置中樣式
        monsterScene.style.width = `${size}px`;
        monsterScene.style.height = `${size}px`;
        monsterScene.style.position = 'relative';
        monsterScene.style.overflow = 'hidden';
        monsterScene.style.margin = '0 auto'; // 水平置中
        
        // 確保外層容器也有置中樣式
        if (monsterScene.parentElement) {
            monsterScene.parentElement.style.display = 'flex';
            monsterScene.parentElement.style.justifyContent = 'center';
            monsterScene.parentElement.style.alignItems = 'center';
            monsterScene.parentElement.style.width = '100%';
        }
        
        // 環境光 - 提高亮度
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        
        // 主光源 - 從前上方照射
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(0, 5, 10);
        scene.add(directionalLight);
        
        // 補充光源 - 從左側照射
        const leftLight = new THREE.DirectionalLight(0xffffff, 0.8);
        leftLight.position.set(-5, 0, 5);
        scene.add(leftLight);
        
        // 補充光源 - 從右側照射
        const rightLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rightLight.position.set(5, 0, 5);
        scene.add(rightLight);
        
        // 底部填充光 - 避免底部過暗
        const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
        bottomLight.position.set(0, -5, 5);
        scene.add(bottomLight);
        
        // 添加調試信息
        console.log('THREE.js 版本:', THREE.REVISION);
        console.log('場景初始化完成，準備載入模型');
        
        // 檢查 GLTFLoader 是否可用
        let loader;
        if (typeof THREE.GLTFLoader !== 'undefined') {
            console.log('使用 THREE.GLTFLoader');
            loader = new THREE.GLTFLoader();
        } else if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') {
            console.log('使用 THREE.GLTFLoader (第二種檢查方式)');
            loader = new THREE.GLTFLoader();
        } else if (typeof window.GLTFLoader !== 'undefined') {
            console.log('使用 window.GLTFLoader');
            loader = new window.GLTFLoader();
        } else {
            console.error('GLTFLoader 未定義，請確保已載入 GLTFLoader 腳本');
            
            // 顯示錯誤信息
            monsterScene.innerHTML = '<div style="color: red; padding: 20px;">無法載入怪物模型：GLTFLoader 未定義</div>';
            
            // 使用基本幾何體作為替代
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
            
            function animate() {
                requestAnimationFrame(animate);
                cube.rotation.x += 0.01;
                cube.rotation.y += 0.01;
                renderer.render(scene, camera);
            }
            
            animate();
            return;
        }
        
        // 確保 loader 已定義
        if (!loader) {
            console.error('無法創建 GLTFLoader 實例');
            monsterScene.innerHTML = '<div style="color: red; padding: 20px;">無法載入怪物模型：無法創建 GLTFLoader</div>';
            return;
        }
        
        // 添加載入進度顯示
        monsterScene.innerHTML = '<div style="color: white; padding: 20px;">正在載入怪物模型...</div>';
        
        // 嘗試載入模型 - 使用 idle.glb 作為默認模型
        console.log('開始載入模型: /static/models/idle.glb');
        loader.load(
            '/static/models/idle.glb',
            function(gltf) {
                console.log('模型載入成功:', gltf);
                
                // 清除載入提示
                monsterScene.innerHTML = '';
                monsterScene.appendChild(renderer.domElement);
                
                // 成功載入
                const model = gltf.scene;
                scene.add(model);
                
                // 調整模型大小和位置 - 縮小模型並降低位置以適應全身顯示
                model.scale.set(0.4, 0.4, 0.4);
                model.position.set(0, -5, 0);
                model.rotation.y = 0; // 確保模型正面朝向
                
                // 遍歷模型的所有部分，確保材質正確
                model.traverse((child) => {
                    if (child.isMesh) {
                        // 確保材質正確渲染
                        child.material.side = THREE.DoubleSide; // 雙面渲染
                        child.material.transparent = true; // 支持透明
                        child.material.needsUpdate = true; // 更新材質
                        
                        // 提高材質亮度
                        if (child.material.color) {
                            // 提高顏色亮度，但不要過白
                            const color = child.material.color;
                            color.r = Math.min(1, color.r * 1.2);
                            color.g = Math.min(1, color.g * 1.2);
                            color.b = Math.min(1, color.b * 1.2);
                        }
                    }
                });
                
                // 設置動畫
                if (gltf.animations && gltf.animations.length > 0) {
                    console.log('模型包含動畫:', gltf.animations.length);
                    const mixer = new THREE.AnimationMixer(model);
                    const action = mixer.clipAction(gltf.animations[0]);
                    action.play();
                    
                    // 動畫循環
                    const clock = new THREE.Clock();
                    
                    function animate() {
                        requestAnimationFrame(animate);
                        
                        // 更新動畫
                        const delta = clock.getDelta();
                        mixer.update(delta);
                        
                        // 添加簡單的浮動動畫 - 調整浮動位置
                        model.position.y = -5 + Math.sin(Date.now() * 0.001) * 0.1;
                        
                        renderer.render(scene, camera);
                    }
                    
                    animate();
                    
                    // 將模型和混合器暴露給全局，以便後續更新
                    window.monsterModel = model;
                    window.monsterMixer = mixer;
                    window.monsterScene = scene;
                    window.monsterCamera = camera;
                    window.monsterRenderer = renderer;
                    window.monsterClock = clock;
                    
                } else {
                    console.log('模型不包含動畫，使用基本旋轉');
                    // 基本動畫循環
                    function animate() {
                        requestAnimationFrame(animate);
                        
                        // 添加簡單的浮動動畫 - 調整浮動位置
                        model.position.y = -5 + Math.sin(Date.now() * 0.001) * 0.1;
                        
                        renderer.render(scene, camera);
                    }
                    
                    animate();
                    
                    // 將模型暴露給全局，以便後續更新
                    window.monsterModel = model;
                    window.monsterScene = scene;
                    window.monsterCamera = camera;
                    window.monsterRenderer = renderer;
                }
                
                console.log('怪物模型渲染完成');
                
                // 初始化怪物血量顯示
                updateMonsterHP(monsterHP);
            },
            // 進度回調
            function(xhr) {
                if (xhr.lengthComputable) {
                    const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                    console.log(`模型載入進度: ${percent}%`);
                    monsterScene.innerHTML = `<div style="color: white; padding: 20px;">載入中: ${percent}%</div>`;
                }
            },
            // 錯誤回調
            function(error) {
                console.error('載入怪物模型時出錯:', error);
                monsterScene.innerHTML = `<div style="color: red; padding: 20px;">無法載入怪物模型：${error.message}</div>`;
                
                // 載入失敗時顯示替代內容
                const geometry = new THREE.BoxGeometry(2, 2, 2);
                const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                const cube = new THREE.Mesh(geometry, material);
                scene.add(cube);
                
                function animate() {
                    requestAnimationFrame(animate);
                    cube.rotation.x += 0.01;
                    cube.rotation.y += 0.01;
                    renderer.render(scene, camera);
                }
                
                animate();
            }
        );
    } catch (e) {
        console.error('初始化 3D 場景時出錯:', e);
        const monsterScene = document.getElementById('monster-scene');
        if (monsterScene) {
            monsterScene.innerHTML = `<div style="color: red; padding: 20px;">無法初始化 3D 場景：${e.message}</div>`;
        }
    }
}


// 初始化護盾控件
function initShieldControls() {
    console.log('初始化护盾控制');
    

    
    // 更新护盾显示
    updateShieldDisplay();
}

// 更新护盾显示
function updateShieldDisplay() {
    console.log('更新護盾顯示');
    
    // 更新护盾值显示
    const shieldValueElement = document.getElementById('shield-value');
    if (shieldValueElement) {
        shieldValueElement.textContent = initialMonsterShield;
    } else {
        console.error('找不到護盾值顯示元素');
    }
    
    // 更新护盾权重显示
    const shieldWeightElement = document.getElementById('shield-weight');
    if (shieldWeightElement) {
        shieldWeightElement.textContent = shieldWeightFactor.toFixed(1);
    } else {
        console.error('找不到護盾權重顯示元素');
    }
}


// 新增函數：根據運動參數更新護盾值
function updateShieldFromExerciseParams() {
    // 获取用户输入的运动参数
    const weightInput = document.getElementById('weight');
    const repsInput = document.getElementById('reps');
    const setsInput = document.getElementById('sets');
    
    if (!weightInput || !repsInput || !setsInput) {
        console.error('無法取得運動參數控件');
        return;
    }
    
    // 获取输入值
    const weight = parseFloat(weightInput.value) || 0;
    const reps = parseInt(repsInput.value) || 0;
    const sets = parseInt(setsInput.value) || 0;
    
    console.log(`運動參數: 重量=${weight}kg, 次數=${reps}, 組數=${sets}`);
    
    // 计算护盾值 - 使用次数乘以组数作为护盾值
    const newShieldValue = reps * sets;
    
    // 使用重量作为护盾重量系数 (限制在合理范围内)
    // 如果重量为0，则使用1作为默认值
    const newWeightFactor = weight > 0 ? Math.min(5, Math.max(0.1, weight / 20)) : 1;
    
    console.log(`根據運動參數計算: 护盾值=${newShieldValue}, 重量系数=${newWeightFactor.toFixed(2)}`);
    
    // 更新护盾值和重量系数
    initialMonsterShield = newShieldValue;
    monsterShield = newShieldValue;
    shieldWeightFactor = newWeightFactor;
    
    // 更新护盾显示
    updateMonsterShield(monsterShield);
    updateShieldDisplay(); // 确保更新UI显示
    
    // 显示确认消息
    if (newShieldValue > 0) {
        showMonsterDialogue(`我獲得了 ${monsterShield} 點護盾！重量係數為 ${shieldWeightFactor.toFixed(1)}`);
    } else {
        showMonsterDialogue('我沒有護盾，直接攻擊我吧！');
    }
}


// 修改 showErrorMessage 函數，確保它能正確顯示
function showErrorMessage(message, duration = 5000) {
    console.error(message);
    
    // 檢查是否已存在錯誤訊息元素
    let errorMessage = document.querySelector('.error-message');
    
    // 如果不存在，則創建一個
    if (!errorMessage) {
        errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        document.body.appendChild(errorMessage);
    }
    
    // 設置訊息內容
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // 添加動畫效果
    errorMessage.style.animation = 'fadeIn 0.5s ease-in-out';
    
    // 設置自動消失
    setTimeout(function() {
        errorMessage.style.animation = 'fadeOut 0.5s ease-in-out';
        setTimeout(function() {
            errorMessage.style.display = 'none';
        }, 500);
    }, duration);
}



function sendExerciseData(exerciseType, weight, reps, sets) {
    const studentData = StudentManager.prepareStudentData();
    
    return fetch('/api/exercise/record', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...studentData,
            exercise_type: exerciseType || 'squat',
            weight: weight,
            reps: reps,
            sets: sets,
            total_count: exerciseCounter || 0
        })
    })
    .then(response => {
        console.log(`API響應狀態: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態: ${response.status}`);
        }
        return response.json();
    })
    .catch(error => {
        console.error('發送運動數據失敗:', error);
        throw error;
    });
}

function startDetection() {
    if (isDetecting) {
        console.log('[startDetection] 偵測已在進行中，忽略重複請求');
        return;
    }
    console.log('[startDetection] 開始啟動偵測');
    const studentId = getCurrentStudentId();
    if (!studentId) {
        showNotification('請先輸入學號', 'error');
        return;
    }
    if (!validateStudentId()) {
        showNotification('請輸入有效的學號', 'error');
        return;
    }

    
    // 獲取當前運動信息
    let exerciseType = currentExerciseType;
    let weight = 0;
    let reps = 10;
    let sets = 1;
    
    // 如果有訓練計劃，使用計劃中的數據
    if (workoutPlan.length > 0 && currentExerciseIndex < workoutPlan.length) {
        const currentExercise = workoutPlan[currentExerciseIndex];
        exerciseType = currentExercise.type;
        weight = parseInt(currentExercise.weight) || 0;
        reps = parseInt(currentExercise.reps) || 10;
        sets = parseInt(currentExercise.sets) || 1;
        
        // 如果是分解後的單組運動，使用原始組數信息
        if (currentExercise.originalSets) {
            sets = parseInt(currentExercise.originalSets);
        }
    }
    
    console.log(`[startDetection] 確認運動類型為: ${exerciseType}`);
    console.log(`[startDetection] 運動參數 - 重量: ${weight}, 次數: ${reps}, 組數: ${sets}`);
    
    // 設置偵測狀態
    isDetecting = true;
    
    // 獲取攝像頭索引
    const cameraIndexElement = document.getElementById('camera-index-input');
    const cameraIndex = cameraIndexElement ? parseInt(cameraIndexElement.value) : 0;
    
    // 準備發送的數據
    const requestData = {
        exercise_type: exerciseType,
        detection_line: 0.5,
        student_id: studentId,
        weight: weight,
        reps: reps,
        sets: sets,
        level: currentLevel,
        save_to_db: true,
        camera_index: cameraIndex,
        workout_plan_index: currentExerciseIndex
    };
    
    console.log('發送到後端的請求數據:', requestData);
    
    // 發送開始檢測請求到後端
    socket.emit('start_detection', requestData);
    console.log(`已發送開始檢測請求，運動類型: ${exerciseType} 關卡: ${currentLevel}`);
    
    // 更新UI狀態
    updateUIForDetectionStart();
}

// 停止偵測
function stopDetection() {
    console.log('[stopDetection] Function called. Current isDetecting state:', isDetecting);
    console.log('[stopDetection] Socket status:', socket ? 'exists' : 'null', socket && socket.connected ? 'connected' : 'not connected');
    
    if (!isDetecting) {
        console.log("[stopDetection] Detection is already stopped. No action taken.");
        // 確保UI處於正確的停止狀態
        updateUIForDetectionStop();
        return;
    }

    isDetecting = false;
    console.log('[stopDetection] isDetecting set to false.');

    // 確保socket連接存在且正常
    if (!socket) {
        console.error('[stopDetection] Socket is null, attempting to reinitialize');
        socket = initSocketConnection();
        if (!socket) {
            console.error('[stopDetection] Failed to reinitialize socket');
            showErrorMessage('無法連接到伺服器，請重新整理頁面');
            updateUIForDetectionStop(); // 即使socket失敗也要更新UI
            return;
        }
    }

    // 先更新UI狀態，不依賴於socket響應
    updateUIForDetectionStop();

    if (socket && socket.connected) {
        console.log('[stopDetection] Emitting stop_detection to server with namespace /exercise');
        try {
            socket.emit('stop_detection');
            console.log('[stopDetection] stop_detection event emitted successfully');
        } catch (error) {
            console.error('[stopDetection] Error emitting stop_detection:', error);
            showErrorMessage('停止檢測時發生錯誤: ' + error.message);
        }
    } else {
        console.warn('[stopDetection] Socket not connected, attempting to connect first');
        if (socket) {
            try {
                socket.connect();
                // 等待連接後再發送
                setTimeout(() => {
                    if (socket && socket.connected) {
                        console.log('[stopDetection] Socket reconnected, emitting stop_detection');
                        socket.emit('stop_detection');
                    } else {
                        console.error('[stopDetection] Failed to reconnect socket');
                        showErrorMessage('無法連接到伺服器，但檢測已在本地停止');
                    }
                }, 1000);
            } catch (error) {
                console.error('[stopDetection] Error reconnecting socket:', error);
                showErrorMessage('重新連接失敗，但檢測已在本地停止');
            }
        }
    }

    // 重置運動狀態相關變量
    tableTennisActive = false;
    basketballActive = false;
    basketballDribbleActive = false;
    // 添加排球相關變量重置
    if (typeof volleyballOverhandActive !== 'undefined') {
        volleyballOverhandActive = false;
    }
    if (typeof volleyballLowhandActive !== 'undefined') {
        volleyballLowhandActive = false;
    }
    
    // 暫停怪物攻擊系統
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.pause === 'function') {
        window.monsterAttackSystem.pause();
        console.log('[stopDetection] Monster attack system paused.');
    } else {
        console.log('[stopDetection] Monster attack system not found or pause method unavailable.');
    }

    console.log('[stopDetection] Detection stopped successfully.');
}

// 統一的停止檢測UI更新函數
function updateUIForDetectionStop() {
    // 更新UI元素 - 移除直接操作停止按鈕，改用 StopDetectionManager
    if (startButton) {
        startButton.disabled = false;
        console.log('[updateUIForDetectionStop] Start button enabled.');
    }
    
    // 使用 StopDetectionManager 禁用停止按鈕
    if (window.stopDetectionManager) {
        window.stopDetectionManager.updateButtonState(false);
        console.log('[updateUIForDetectionStop] Stop button disabled via StopDetectionManager.');
    }
    if (exerciseSelect) {
        exerciseSelect.disabled = false;
        console.log('[updateUIForDetectionStop] Exercise select enabled.');
    }

    // 更新 detectionStatus 元素 (確保在使用前已獲取)
    if (!detectionStatus) {
        detectionStatus = document.getElementById('detection-status');
    }
    if (detectionStatus) {
        detectionStatus.textContent = '已停止';
        detectionStatus.classList.remove('active', 'detecting');
        detectionStatus.classList.add('inactive', 'stopped');
        console.log('[updateUIForDetectionStop] Detection status UI updated to 已停止.');
    } else {
        console.warn('[updateUIForDetectionStop] detection-status element not found.');
    }
}

// 重置計數
function resetCount() {
    console.log('開始重置計數...');
    
    // 首先停止偵測
    if (typeof stopDetection === 'function') {
        console.log('調用 stopDetection 停止偵測');
        stopDetection();
    } else {
        console.log('stopDetection 函數不存在，直接發送停止請求');
        if (socket) {
            socket.emit('stop_detection');
        }
    }
    
    exerciseCounter = 0;
    updateExerciseCount();
    
    // 重置怪物血量
    monsterHP = initialMonsterHP;
    updateMonsterHP(monsterHP);
    
    // 重置怪物護盾 - 恢復到初始護盾值
    monsterShield = initialMonsterShield;
    updateMonsterShield(monsterShield);
    
    // 重置 decreaseMonsterHP 的静态变量
    decreaseMonsterHP.lastCount = 0;
    
    // 重置Combo系統
    resetCombo();
    
    // 重置怪物攻擊系統
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
        window.monsterAttackSystem.reset();
        console.log('[resetCount] Monster attack system reset.');
    } else {
        console.log('[resetCount] Monster attack system not found or reset method unavailable.');
    }
    
    // 发送重置计数请求
    if (socket) {
        socket.emit('reset_count');
    }
    
    console.log(`重置完成，怪物血量: ${monsterHP}/${initialMonsterHP}, 護盾: ${monsterShield}/${initialMonsterShield}`);
}


// 顯示完成訊息
function showCompletionMessage() {
    console.log('運動完成！');
    
    // 使用現有的通知函數顯示完成訊息
    showNotification('恭喜完成訓練！你已經完成了所有設定的組數', 'success', 5000); // 顯示5秒
    
    // 停止偵測
    stopDetection();
    
    // 重置怪物攻擊系統
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
        window.monsterAttackSystem.reset();
        console.log('[showCompletionMessage] Monster attack system reset after completion.');
    } else {
        console.log('[showCompletionMessage] Monster attack system not found or reset method unavailable.');
    }
}


// 加載指定關卡
function loadLevel(levelId) {
    console.log(`加載關卡: ${levelId}`);
    
    // 首先停止當前偵測
    if (typeof stopDetection === 'function') {
        console.log('加載新關卡前停止當前偵測');
        stopDetection();
    } else {
        console.log('stopDetection 函數不存在，直接發送停止請求');
        if (socket) {
            socket.emit('stop_detection');
        }
    }
    
    // 更新當前關卡
    currentLevel = levelId;
    
    // 顯示加載中訊息
    showNotification(`正在加載關卡 ${levelId}...`, 'info');
    
    // 重置運動計數器
    exerciseCounter = 0;
    decreaseMonsterHP.lastCount = 0;
    
    // 重置怪物攻擊系統
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
        window.monsterAttackSystem.reset();
        console.log(`[loadLevel] Monster attack system reset for level ${levelId}.`);
    } else {
        console.log(`[loadLevel] Monster attack system not found or reset method unavailable for level ${levelId}.`);
    }
    
    // 更新UI顯示
    updateLevelDisplay(levelId);
    
    // 根據關卡難度設置怪物屬性
    const difficulty = Math.min(2, Math.max(0.5, 1 + (levelId - 1) * 0.1));
    console.log(`關卡 ${levelId} 難度係數: ${difficulty.toFixed(2)}`);
    
    // 設置怪物血量 (隨關卡增加)
    initialMonsterHP = Math.round(100 * difficulty);
    monsterHP = initialMonsterHP;
    
    // 獲取用戶設定的運動參數
    const weightInput = document.getElementById('weight');
    const repsInput = document.getElementById('reps');
    const setsInput = document.getElementById('sets');
    
    if (weightInput && repsInput && setsInput) {
        // 獲取輸入值
        const weight = parseFloat(weightInput.value) || 0;
        const reps = parseInt(repsInput.value) || 0;
        const sets = parseInt(setsInput.value) || 0;
        
        // 計算護盾值 - 使用次數乘以組數作為護盾值
        initialMonsterShield = reps * sets;
        
        // 使用重量作為護盾重量係數 (限制在合理範圍內)
        shieldWeightFactor = weight > 0 ? Math.min(5, Math.max(0.1, weight / 20)) : 1;
    } else {
        // 如果找不到輸入控件，使用默認值
        initialMonsterShield = 10 * levelId;
        shieldWeightFactor = 0.1 * levelId;
    }
    
    // 設置怪物護盾
    monsterShield = initialMonsterShield;
    
    // 更新怪物顯示
    updateMonsterHP(monsterHP);
    updateMonsterShield(monsterShield);
    
    // 更新護盾顯示
    updateShieldDisplay();
    
    // 重置剩餘組數
    if (setsInput) {
        remainingSets = parseInt(setsInput.value) || 3;
    } else {
        remainingSets = 3;
    }
    
    // 更新剩餘組數顯示
    updateRemainingSetsDisplay();
    
    // 顯示關卡開始訊息
    showNotification(`關卡 ${levelId} 開始！`, 'success');
    
    // 顯示怪物對話
    if (levelId === 1) {
        showMonsterDialogue('我是第一關的怪物，準備接受挑戰吧！');
    } else {
        showMonsterDialogue(`我是第 ${levelId} 關的怪物，比上一關更強！`);
    }
    
    // 開始偵測
    startDetection();
}



function updateRemainingSetsDisplay() {
    if (remainingSetsDisplay) {
        remainingSetsDisplay.textContent = remainingSets;
    } else {
        console.error('找不到剩餘組數顯示元素');
        // 嘗試重新獲取元素
        remainingSetsDisplay = document.getElementById('remaining-sets') || 
                              document.querySelector('.remaining-sets');
        if (remainingSetsDisplay) {
            remainingSetsDisplay.textContent = remainingSets;
        }
    }
}



function initMonsterSystem() {
    console.log('初始化怪物系統...');
    
    // 重置怪物索引
    currentMonsterIndex = 0;
    
    // 初始化怪物模型
    loadMonsterModel();
    
    // 初始化護盾控件
    initShieldControls();
    
    // 初始化怪物血量顯示
    updateMonsterHP(monsterHP);
    
    // 初始化怪物護盾顯示
    updateMonsterShield(monsterShield);
    
    // 初始化第一關
    initLevel(1);
    
    console.log('怪物系統初始化完成');
}


// 發送關卡完成數據到伺服器
function sendLevelCompletionToServer(levelId, expReward) {
    console.log(`發送關卡完成數據: 關卡 ${levelId}, 經驗值 ${expReward}, 初始護盾 ${initialMonsterShield}, 重量係數 ${shieldWeightFactor}`);

    // 獲取用戶ID，如果沒有則使用默認值
    const userId = document.getElementById('user-id') ? 
                  document.getElementById('user-id').value : 
                  (document.getElementById('student-id') ? 
                   document.getElementById('student-id').value : 'C111151146');
    
    console.log(`用戶ID: ${userId}`);

    // 獲取用戶設定的重量和組數
    const weight = document.getElementById('weight') ? 
                  parseInt(document.getElementById('weight').value) || 0 : 0;

    const reps = document.getElementById('reps') ? 
                parseInt(document.getElementById('reps').value) || 10 : 10;

    const sets = document.getElementById('sets') ? 
               parseInt(document.getElementById('sets').value) || 3 : 3;
    
    // 計算已完成的組數
    const completedSets = remainingSets !== undefined ? (sets - remainingSets) : 0;
    
    console.log(`運動參數: 重量=${weight}kg, 次數=${reps}, 組數=${sets}, 已完成組數=${completedSets}`);
    
    // 發送請求到後端
    fetch('/api/game/complete_level', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            level_id: levelId,
            exp_reward: expReward,
            exercise_type: currentExerciseType || 'squat',
            exercise_count: exerciseCounter || 0,
            shield_value: initialMonsterShield,
            shield_weight: shieldWeightFactor,
            weight: weight,
            reps: reps,
            sets: sets,
            completed_sets: completedSets
        })
    })
    .then(response => {
        console.log(`API響應狀態: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('關卡完成數據已保存:', data);
            
            // 顯示成功通知
            showNotification(`關卡 ${levelId} 完成！獲得 ${expReward} 經驗值`, 'success');
            
            // 顯示成就通知（如果有）
            if (data.new_achievements && data.new_achievements.length > 0) {
                data.new_achievements.forEach(achievement => {
                    showNotification(`獲得成就: ${achievement.name}`, 'achievement');
                });
            }
            
            // 更新用戶進度顯示（如果有相關元素）
            if (data.progress) {
                updateUserProgress(data.progress);
            }
        } else {
            console.error('關卡完成數據保存失敗:', data.message);
            showNotification('關卡數據保存失敗: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('發送關卡完成請求時出錯:', error);
        showNotification('網絡錯誤，無法保存關卡數據', 'error');
        
        // 嘗試重新發送
        setTimeout(() => {
            console.log('嘗試重新發送關卡完成數據...');
            retryLevelCompletion(userId, levelId, expReward);
        }, 2000);
    });
}


// 更新用戶進度顯示
function updateUserProgress(progress) {
    console.log('更新用戶進度顯示:', progress);
    
    // 更新等級顯示
    const levelDisplay = document.getElementById('user-level');
    if (levelDisplay && progress.current_level) {
        levelDisplay.textContent = progress.current_level;
    }
    
    // 更新經驗值顯示
    const expDisplay = document.getElementById('user-exp');
    if (expDisplay && progress.total_exp) {
        expDisplay.textContent = progress.total_exp;
    }
    
    // 更新進度條
    const progressBar = document.querySelector('.progress-bar-fill');
    if (progressBar && progress.total_exp) {
        // 假設每100經驗值為一個等級
        const expPercentage = (progress.total_exp % 100) / 100 * 100;
        progressBar.style.width = `${expPercentage}%`;
    }
}


//用於在用戶完成所有設定的組數時記錄到資料庫
function recordExerciseCompletion() {
    console.log('記錄運動完成數據');
    
    // 獲取用戶ID
    const userId = document.getElementById('user-id') ? 
                  document.getElementById('user-id').value : 
                  (document.getElementById('student-id') ? 
                   document.getElementById('student-id').value : 'C111151146');
    
    console.log(`用戶ID: ${userId}`);
    
    // 獲取用戶設定的重量和組數
    const weight = document.getElementById('weight') ? 
                  parseInt(document.getElementById('weight').value) || 0 : 0;
    
    const reps = document.getElementById('reps') ? 
                parseInt(document.getElementById('reps').value) || 10 : 10;
    
    const sets = document.getElementById('sets') ? 
               parseInt(document.getElementById('sets').value) || 3 : 3;
    
    console.log(`運動參數: 重量=${weight}kg, 次數=${reps}, 組數=${sets}, 總計數=${exerciseCounter}`);
    
    // 發送請求到後端
    fetch('/api/exercise/record', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            student_id: userId,
            exercise_type: currentExerciseType || 'squat',
            weight: weight,
            reps: reps,
            sets: sets,
            total_count: exerciseCounter || 0
        })
    })
    .then(response => {
        console.log(`API響應狀態: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('運動完成數據已保存:', data);
            showNotification('運動記錄已保存', 'success');
        } else {
            console.error('運動完成數據保存失敗:', data.message);
            showNotification('運動記錄保存失敗: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('發送運動完成請求時出錯:', error);
        showNotification('網絡錯誤，無法保存運動記錄', 'error');
    });
}


// 添加關卡完成樣式
function addLevelCompleteStyles() {
    // 檢查是否已存在樣式
    if (document.getElementById('level-complete-styles')) {
        return;
    }
    
    // 創建樣式元素
    const style = document.createElement('style');
    style.id = 'level-complete-styles';
    style.textContent = `
        .level-complete-message {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .level-complete-content {
            background-color: white;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            position: relative;
            z-index: 1001;
        }
        
        .level-rewards {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
        }
        
        .reward-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            min-width: 100px;
        }
        
        .reward-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #3498db;
        }
        
        .reward-label {
            font-size: 0.9rem;
            color: #7f8c8d;
            margin-top: 5px;
        }
        
        .level-complete-buttons {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
            position: relative;
            z-index: 1100;
        }
        
        .level-complete-buttons button {
            padding: 10px 20px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            position: relative;
            z-index: 1101;
        }
        
        .level-complete-buttons button.accent {
            background-color: #3498db;
            color: white;
        }
        
        .level-complete-buttons button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .level-complete-buttons button:active {
            transform: translateY(0);
        }
        
        .level-complete-buttons button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
    `;
    
    // 添加到頁面
    document.head.appendChild(style);
}


// 顯示關卡開始信息
function showLevelStartMessage(level) {
    console.log(`顯示關卡 ${level} 开始信息`);
    
    // 根据关卡显示不同的对话
    let message = '';
    switch(level) {
        case 1:
            message = '歡迎來到第一關！完成10個深蹲擊敗怪物吧！';
            break;
        case 2:
            message = '第二關！這個怪物有護盾，需要更多運動才能打敗它！';
            break;
        case 3:
            message = '第三關！怪物變得更強了，加油！';
            break;
        case 4:
            message = '第四關！挑戰自我，堅持就是勝利！';
            break;
        case 5:
            message = '第五關！最終挑戰，全力以赴吧！';
            break;
        default:
            message = `挑戰關卡 ${level}！你已經超越了大多數人，繼續前進！`;
    }
    
    // 显示怪物对话
    showMonsterDialogue(message);
    
    // 移除了创建和显示 level-info 元素的代码
}



// 初始化頁面
function initPage() {
    console.log('初始化页面');
    
    // 初始化全局变量
    currentLevel = 1;
    initialMonsterHP = 100; // 血量增加到原來的10倍
    monsterHP = initialMonsterHP;
    initialMonsterShield = 0;
    monsterShield = initialMonsterShield;
    shieldWeightFactor = 0;
    exerciseCounter = 0;
    lastQuality = 0;
    isDetecting = false;
    
    // 初始化UI元素引用
    initUIElements();
    
    // 初始化Socket连接
    socket = initSocketConnection();
    
    // 初始化停止偵測管理器
    if (window.stopDetectionManager) {
        console.log('初始化停止偵測管理器');
        window.stopDetectionManager.init(stopDetection);
        // 確保停止按鈕狀態正確
        setTimeout(() => {
            window.stopDetectionManager.updateButtonState(false);
        }, 100);
    } else {
        console.error('StopDetectionManager 未找到，請檢查模組載入');
    }
    
    // 初始化怪物血量显示
    initMonsterHPDisplay();
    
    // 添加怪物对话框样式
    addMonsterDialogueStyle();
    
    // 按钮事件已在 initUIElements 中绑定
    // rebindButtonEvents(); // 移除多余的调用
    
    console.log('页面初始化完成');
}

function debugGameState() {
    console.log('遊戲狀態:');
    console.log('- 當前關卡:', currentLevel);
    console.log('- 怪物血量:', monsterHP, '/', initialMonsterHP);
    console.log('- 怪物護盾:', monsterShield, '/', initialMonsterShield);
    console.log('- 護盾權重因子:', shieldWeightFactor);
    console.log('- 運動計數:', exerciseCounter);
    console.log('- 最後品質分數:', lastQuality);
    console.log('- 當前運動類型:', currentExerciseType);
    console.log('- 檢測狀態:', isDetecting ? '正在檢測' : '未檢測');
    
    // 檢查Socket連接狀態
    if (socket) {
        console.log('- Socket連接狀態:', socket.connected ? '已連接' : '未連接');
        console.log('- Socket ID:', socket.id);
    } else {
        console.log('- Socket未初始化');
    }
    
    // 反回狀態對象，方便在控制台查看
    return {
        currentLevel,
        monsterHP,
        initialMonsterHP,
        monsterShield,
        initialMonsterShield,
        shieldWeightFactor,
        exerciseCounter,
        lastQuality,
        currentExerciseType,
        isDetecting,
        socketConnected: socket ? socket.connected : false,
        socketId: socket ? socket.id : null
    };
}





// 設置偵測線
function setDetectionLine() {
    // 獲取當前視頻畫面中的位置
    console.log('設置偵測線');
    
    // 發送設置偵測線請求
    if (socket) {
        socket.emit('set_detection_line', {
            line_position: detectionLine
        });
    }
}

function exportToExcel() {
    console.log('匯出運動數據到Excel');
    
    // 發送匯出Excel請求
    if (socket) {
        socket.emit('export_excel', {
            exercise_type: currentExerciseType,
            count: exerciseCounter,
            quality: lastQuality
        });
    }
}



// 更新教練提示
function updateCoachTip(tip) {
    if (coachTipText) {
        if (typeof tip === 'string') {
            coachTipText.textContent = tip;
        } else {
            // 根據運動類型設置默認提示
            switch (currentExerciseType) {
                case 'squat':
                    coachTipText.textContent = '下蹲時保持背部挺直，膝蓋不要超過腳尖';
                    break;
                case 'pushup':
                case 'push-up':
                    coachTipText.textContent = '保持身體成一直線，肘部靠近身體';
                    break;
                case 'situp':
                    coachTipText.textContent = '上身抬起時保持腹部緊張，避免用力過猛';
                    break;
                case 'bicep-curl':
                    coachTipText.textContent = '保持上臂固定，只移動前臂';
                    break;
                default:
                    coachTipText.textContent = '選擇一種運動開始訓練';
            }
        }
    }
}


function updateAngles(angles) {
    // 檢查角度數據是否有效
    if (!angles) {
        console.warn('收到空的角度數據');
        // 即使角度数据为空，也尝试更新教练提示
        if (coachTipText) {
            const exerciseType = currentExerciseType || 'squat';
            const generatedTip = generateCoachTips({}, exerciseType); // 传递空对象
            coachTipText.textContent = generatedTip;
        }
        return;
    }
    
    try {
        // 將中文角度名稱映射到英文名稱，以便generateCoachTips函數能正確處理
        const mappedAngles = {
            knee: 0,
            hip: 0,
            back: 0,
            elbow: 0,
            shoulder: 0,
            body: 180
        };
        
        // 映射膝蓋角度 (取左右膝蓋的平均值)
        if ('左膝蓋' in angles && '右膝蓋' in angles) {
            mappedAngles.knee = (angles['左膝蓋'] + angles['右膝蓋']) / 2;
        } else if ('左膝蓋' in angles) {
            mappedAngles.knee = angles['左膝蓋'];
        } else if ('右膝蓋' in angles) {
            mappedAngles.knee = angles['右膝蓋'];
        } else if ('左膝盖' in angles && '右膝盖' in angles) {
            mappedAngles.knee = (angles['左膝盖'] + angles['右膝盖']) / 2;
        }
        
        // 映射髖部角度 (取左右髖部的平均值)
        if ('左髖部' in angles && '右髖部' in angles) {
            mappedAngles.hip = (angles['左髖部'] + angles['右髖部']) / 2;
        } else if ('左髖部' in angles) {
            mappedAngles.hip = angles['左髖部'];
        } else if ('右髖部' in angles) {
            mappedAngles.hip = angles['右髖部'];
        } else if ('左髋部' in angles && '右髋部' in angles) {
            mappedAngles.hip = (angles['左髋部'] + angles['右髋部']) / 2;
        }
        
        // 映射肘部角度 (取左右肘部的平均值)
        if ('左手肘' in angles && '右手肘' in angles) {
            mappedAngles.elbow = (angles['左手肘'] + angles['右手肘']) / 2;
        } else if ('左手肘' in angles) {
            mappedAngles.elbow = angles['左手肘'];
        } else if ('右手肘' in angles) {
            mappedAngles.elbow = angles['右手肘'];
        }
        
        // 映射肩部角度 (取左右肩部的平均值)
        if ('左肩膀' in angles && '右肩膀' in angles) {
            mappedAngles.shoulder = (angles['左肩膀'] + angles['右肩膀']) / 2;
        } else if ('左肩膀' in angles) {
            mappedAngles.shoulder = angles['左肩膀'];
        } else if ('右肩膀' in angles) {
            mappedAngles.shoulder = angles['右肩膀'];
        }
        
        // 更新角度顯示（如果有相應的元素）
        for (const [joint, angle] of Object.entries(angles)) {
            const angleElement = document.getElementById(`${joint}-angle`);
            if (angleElement) {
                angleElement.textContent = `${Math.round(angle)}°`;
            }
        }
        
        // 確保教練提示更新 - 使用映射後的角度數據
        if (coachTipText) {
            const exerciseType = currentExerciseType || 'squat';
            const generatedTip = generateCoachTips(mappedAngles, exerciseType);
            coachTipText.textContent = generatedTip;
        } else {
            // 如果coachTipText不存在，尝试重新获取
            coachTipText = document.getElementById('coach-tip-text');
            if (coachTipText) {
                const exerciseType = currentExerciseType || 'squat';
                const generatedTip = generateCoachTips(mappedAngles, exerciseType);
                coachTipText.textContent = generatedTip;
            }
        }
    } catch (error) {
        console.error('更新角度顯示時出錯:', error);
    }
}

// 添加請求角度數據函數
function requestAngleData() {
    if (!socket || !isDetecting) return;
    
    console.log('請求角度數據');
    socket.emit('request_angle_data');
    
    // 設置定時器，每2秒請求一次角度數據
    if (isDetecting) {
        setTimeout(requestAngleData, 2000);
    }
}



function initMonsterScene() {
    // 獲取怪物容器元素
    const monsterContainer = document.getElementById('monster-scene');
    if (!monsterContainer) return;
    
    // 清除現有內容
    while (monsterContainer.firstChild) {
        monsterContainer.removeChild(monsterContainer.firstChild);
    }
    
    // 設置場景
    scene = new THREE.Scene();
    
    // 設置相機
    camera = new THREE.PerspectiveCamera(75, monsterContainer.clientWidth / monsterContainer.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // 設置渲染器
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(monsterContainer.clientWidth, monsterContainer.clientHeight);
    renderer.setClearColor(0x000000, 0); // 透明背景
    monsterContainer.appendChild(renderer.domElement);
    
    // 添加環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // 添加定向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    // 載入怪物模型
    loadMonsterModel();
    
    // 添加窗口大小變化監聽器
    window.addEventListener('resize', onWindowResize);
}



// 窗口大小變化時調整渲染器和相機
function onWindowResize() {
    const monsterContainer = document.getElementById('monster-scene');
    if (!monsterContainer || !camera || !renderer) return;
    
    camera.aspect = monsterContainer.clientWidth / monsterContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(monsterContainer.clientWidth, monsterContainer.clientHeight);
}



function initMonsterHPDisplay() {
    console.log('初始化怪物血量和護盾顯示');
    
    // 创建血量条
    createMonsterHPBar();
    
    // 创建护盾条
    createMonsterShieldBar();
    
    // 更新血量显示
    updateMonsterHP(monsterHP);
    
    // 更新护盾显示
    updateMonsterShield(monsterShield);
    
    // 添加怪物对话框样式
    addMonsterDialogueStyle();
    
    // 初始化护盾控制
    initShieldControls();
    
    console.log('怪物血量和護盾顯示初始化完成');
}


function bindShieldUpdateEvents() {
    console.log('绑定護盾更新事件');
    
    // 获取运动参数输入元素
    const weightInput = document.getElementById('weight');
    const repsInput = document.getElementById('reps');
    const setsInput = document.getElementById('sets');
    
    // 绑定输入事件
    if (weightInput) {
        weightInput.addEventListener('change', updateShieldFromExerciseParams);
    }
    
    if (repsInput) {
        repsInput.addEventListener('change', updateShieldFromExerciseParams);
    }
    
    if (setsInput) {
        setsInput.addEventListener('change', updateShieldFromExerciseParams);
    }
    
    // 查找更新按钮并绑定事件
    const updateButton = document.querySelector('.update-shield-btn') || 
                         document.getElementById('update-shield') ||
                         document.querySelector('button[data-action="update-shield"]');
    
    if (updateButton) {
        updateButton.addEventListener('click', updateShieldFromExerciseParams);
    } else {
        // 如果没有找到更新按钮，创建一个
        const shieldControls = document.querySelector('.shield-controls');
        if (shieldControls) {
            const updateBtn = document.createElement('button');
            updateBtn.className = 'update-shield-btn';
            updateBtn.textContent = '更新護盾';
            updateBtn.style.marginTop = '10px';
            updateBtn.style.padding = '5px 10px';
            updateBtn.style.backgroundColor = '#3498db';
            updateBtn.style.color = '#fff';
            updateBtn.style.border = 'none';
            updateBtn.style.borderRadius = '5px';
            updateBtn.style.cursor = 'pointer';
            
            updateBtn.addEventListener('click', updateShieldFromExerciseParams);
            shieldControls.appendChild(updateBtn);
        }
    }
    
    console.log('護盾更新事件绑定完成');
}

// 初始化UI元素引用
function initUIElements() {
    console.log('初始化UI元素引用');
    videoFeed = document.getElementById('video-feed');
    startButton = document.getElementById('start-detection');
    stopButton = document.getElementById('stop-detection');
    resetButton = document.getElementById('reset-count');
    exerciseCount = document.getElementById('exercise-count');
    exerciseCountStats = document.getElementById('exercise-count-stats');
    qualityScore = document.getElementById('quality-score');
    remainingSetsDisplay = document.getElementById('remaining-sets');
    coachTipText = document.getElementById('coach-tip-text');
    qualityDisplay = document.querySelector('.quality-display');
    qualityTitle = qualityDisplay ? qualityDisplay.querySelector('.quality-title') : null;
    exerciseSelect = document.getElementById('exercise-select');
    switchExerciseButton = document.getElementById('switch-exercise-btn');
    
    // 初始化Combo系統UI元素
    comboCount = document.getElementById('combo-count');
    comboSlot1 = document.getElementById('combo-slot-1');
    comboSlot2 = document.getElementById('combo-slot-2');
    comboSlot3 = document.getElementById('combo-slot-3');
    comboSkillResult = document.getElementById('combo-skill-result');
    comboDescription = document.getElementById('combo-description');


    // 初始化籃球投籃檢視提示視窗元素
    basketballPromptModal = document.getElementById('basketball-prompt-modal');
    viewBasketballBtn = document.getElementById('view-basketball-btn');
    skipBasketballBtn = document.getElementById('skip-basketball-btn');
    closeBasketballPromptBtn = document.getElementById('close-basketball-prompt-modal');

    if (basketballPromptModal) {
        console.log('Basketball prompt modal element found.');
        if (viewBasketballBtn) {
            viewBasketballBtn.addEventListener('click', function() {
                console.log('View basketball analysis button clicked.');
                hideBasketballPrompt();
                window.location.href = '/exercise/picture'; // 確保跳轉到正確的分析頁面
            });
        } else {
            console.warn('View basketball button (view-basketball-btn) not found.');
        }

        if (skipBasketballBtn) {
            skipBasketballBtn.addEventListener('click', function() {
                console.log('Skip basketball analysis button clicked.');
                hideBasketballPrompt();
            });
        } else {
            console.warn('Skip basketball button (skip-basketball-btn) not found.');
        }

        if (closeBasketballPromptBtn) {
            closeBasketballPromptBtn.addEventListener('click', function() {
                console.log('Close basketball prompt button clicked.');
                hideBasketballPrompt();
            });
        } else {
            console.warn('Close basketball prompt button (close-basketball-prompt-modal) not found.');
        }
    } else {
        console.warn('Basketball prompt modal (basketball-prompt-modal) element not found. Pop-up will not function.');
    }
        
    
    
    // 初始化Combo系統
    initComboSystem();
   

    // 记录找到的按钮元素
    console.log('UI 元素初始化完成: \n' +
        `- videoFeed: ${!!videoFeed} \n` +
        `- startButton: ${!!startButton} \n` +
        `- stopButton: ${!!stopButton} \n` +
        `- resetButton: ${!!resetButton} \n` + // 添加 reset button 檢查
        `- exerciseCount: ${!!exerciseCount} \n` +
        `- exerciseCountStats: ${!!exerciseCountStats} \n` + // 添加 stats 檢查
        `- qualityScore: ${!!qualityScore} \n` +
        `- remainingSetsDisplay: ${!!remainingSetsDisplay} \n` + // 添加 remaining sets 檢查
        `- coachTipText: ${!!coachTipText} \n` + // 添加 coach tip 檢查
        `- qualityDisplay: ${!!qualityDisplay} \n` +
        `- qualityTitle: ${!!qualityTitle}` +
        `- exerciseSelect: ${!!exerciseSelect}` + // 添加 exercise select 檢查
        `- switchExerciseButton: ${!!switchExerciseButton}` // <--- 檢查新按鈕
    );
    
    // 如果有元素未找到，輸出錯誤
    if (!videoFeed || !startButton || !stopButton || !resetButton || !exerciseCount || !exerciseCountStats || !qualityScore || !remainingSetsDisplay || !coachTipText || !qualityDisplay || !qualityTitle || !exerciseSelect) {
        console.error('一個或多個必要的UI元素未找到！請檢查HTML ID。');
    }
    

    
    // 绑定按钮事件 - 使用更可靠的方式
    if (startButton) {
        console.log('綁定開始按鈕事件');
        // 移除可能存在的舊事件監聽器
        startButton.removeEventListener('click', startDetection);
        // 新增新的事件監聽器
        startButton.addEventListener('click', startDetection);
    } else {
        console.error('找不到開始按鈕元素，將建立一個虛擬按鈕');
        // 建立一個虛擬按鈕並新增到頁面
        startButton = document.createElement('button');
        startButton.id = 'virtual-start-btn';
        startButton.textContent = '開始檢測';
        startButton.className = 'button primary-button';
        startButton.style.position = 'fixed';
        startButton.style.bottom = '20px';
        startButton.style.right = '20px';
        startButton.style.zIndex = '9999';
        startButton.addEventListener('click', startDetection);
        document.body.appendChild(startButton);
        console.log('已建立虛擬開始按鈕');
    }
    
    // 使用統一的按鈕事件綁定函數
    console.log('[initUIElements] 調用rebindButtonEvents進行統一的按鈕事件綁定');
    rebindButtonEvents();

    if (!qualityScore) {
        console.warn('無法找到 quality-score 元素，嘗試使用其他選擇器');
        // 嘗試其他可能的選擇器
        qualityScore = document.querySelector('.quality-value') || 
                      document.querySelector('[id^="quality"]') ||
                      document.querySelector('[class^="quality"]');
        
        if (qualityScore) {
            console.log('使用替代選擇器找到品質分數元素');
        } else {
            console.error('無法找到品質分數元素，請檢查HTML結構');
        }
    }
    
    // 初始狀態設定
    if (stopButton) stopButton.disabled = true;
    if (startButton) startButton.disabled = false;
}



document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM fully loaded and parsed. Initializing application.');

    // 初始化主應用程式（包含攻擊特效管理器和 ThreeManager）
    if (typeof MainApp !== 'undefined') {
        try {
            window.mainApp = new MainApp();
            await window.mainApp.init({
                autoConnect: false,  // 不自動連接，避免初始化時的連接錯誤
                enableThreeJs: true,
                enableWorkoutPlan: true
            });
            
            // 將 ThreeManager 設為全域變數，供 game.js 使用
            if (window.mainApp.threeManager) {
                window.threeManager = window.mainApp.threeManager;
                console.log('ThreeManager 設為全域變數');
            }
            
            console.log('MainApp 初始化完成，包含 AttackEffectsManager 和 ThreeManager');
            
            // 手動連接 Socket
            if (window.mainApp.socketManager) {
                try {
                    await window.mainApp.connect();
                    console.log('Socket 連接成功');
                } catch (connectError) {
                    console.warn('Socket 連接失敗，但不影響其他功能:', connectError);
                }
            }
        } catch (error) {
            console.warn('MainApp 初始化失敗，嘗試直接初始化各個管理器:', error);
            
            // 如果 MainApp 初始化失敗，嘗試直接初始化各個管理器
            if (typeof AttackEffectsManager !== 'undefined') {
                try {
                    window.attackEffectsManager = new AttackEffectsManager();
                    window.attackEffectsManager.init();
                    console.log('AttackEffectsManager 直接初始化成功');
                } catch (effectError) {
                    console.error('AttackEffectsManager 直接初始化失敗:', effectError);
                }
            }
            
            if (typeof ThreeManager !== 'undefined') {
                try {
                    window.threeManager = new ThreeManager();
                    window.threeManager.init();
                    console.log('ThreeManager 直接初始化成功');
                } catch (threeError) {
                    console.error('ThreeManager 直接初始化失敗:', threeError);
                }
            }
        }
    } else {
        console.warn('MainApp not found, 嘗試直接初始化各個管理器');
        
        // 如果 MainApp 不存在，嘗試直接初始化各個管理器
        if (typeof AttackEffectsManager !== 'undefined') {
            try {
                window.attackEffectsManager = new AttackEffectsManager();
                window.attackEffectsManager.init();
                console.log('AttackEffectsManager 直接初始化成功');
            } catch (effectError) {
                console.error('AttackEffectsManager 直接初始化失敗:', effectError);
            }
        } else {
            console.error('AttackEffectsManager 類未找到');
        }
        
        if (typeof ThreeManager !== 'undefined') {
            try {
                window.threeManager = new ThreeManager();
                window.threeManager.init();
                console.log('ThreeManager 直接初始化成功');
            } catch (threeError) {
                console.error('ThreeManager 直接初始化失敗:', threeError);
            }
        } else {
            console.error('ThreeManager 類未找到');
        }
    }

    // 初始化攻擊音效combo系統
    if (typeof AttackComboSystem !== 'undefined') {
        try {
            window.attackComboSystem = new AttackComboSystem();
            window.attackComboSystem.init();
            console.log('AttackComboSystem 初始化成功');
        } catch (comboError) {
            console.error('AttackComboSystem 初始化失敗:', comboError);
        }
    } else {
        console.error('AttackComboSystem 類未找到');
    }

    // 初始化怪獸位置控制器
    if (typeof MonsterPositionController !== 'undefined') {
        try {
            window.monsterPositionController = new MonsterPositionController();
            console.log('MonsterPositionController 初始化成功');
        } catch (error) {
            console.error('MonsterPositionController 初始化失敗:', error);
        }
    } else {
        console.warn('MonsterPositionController 類未找到');
    }

    // Initialize detection status element first as it's used by other functions
    detectionStatus = document.getElementById('detection-status');
    if (!detectionStatus) {
        console.warn('Warning: detection-status element not found in the DOM.');
    }
    
    // 添加測試攻擊特效的函數
    window.testAttackEffect = function(exerciseType = 'squat') {
        console.log('=== 測試攻擊特效 ===');
        console.log('當前 AttackEffectsManager 狀態:', {
            exists: typeof AttackEffectsManager !== 'undefined',
            instance: !!window.attackEffectsManager,
            initialized: window.attackEffectsManager ? window.attackEffectsManager.isInitialized : false
        });
        
        // 檢查必要的元素是否存在
        const videoFeed = document.getElementById('video-feed');
        const monsterContainer = document.getElementById('monster-container');
        
        console.log('檢查元素存在性:', {
            videoFeed: !!videoFeed,
            monsterContainer: !!monsterContainer
        });
        
        // 如果怪物容器不存在，創建一個臨時的
        if (!monsterContainer) {
            console.log('創建臨時怪物容器');
            const tempContainer = document.createElement('div');
            tempContainer.id = 'monster-container';
            tempContainer.style.position = 'fixed';
            tempContainer.style.top = '50%';
            tempContainer.style.right = '20px';
            tempContainer.style.width = '100px';
            tempContainer.style.height = '100px';
            tempContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            tempContainer.style.border = '2px solid red';
            tempContainer.style.zIndex = '1000';
            tempContainer.textContent = '怪物';
            document.body.appendChild(tempContainer);
        }
        
        if (window.attackEffectsManager) {
            console.log('攻擊特效管理器存在，開始測試');
            try {
                window.attackEffectsManager.triggerAttack(exerciseType);
                console.log('測試攻擊特效觸發成功');
            } catch (error) {
                console.error('測試攻擊特效失敗:', error);
            }
        } else {
            console.error('攻擊特效管理器不存在');
        }
    };
    
    console.log('測試函數已添加，可以在控制台中使用 testAttackEffect() 來測試攻擊特效');

    // 初始化Socket连接
    try {
        socket = initSocketConnection();
        if (socket) {
            setupSocketListeners();
        }
    } catch (error) {
        console.error('Socket初始化失敗:', error);
    }

    // 初始化學號管理器
    if (typeof StudentManager !== 'undefined') {
        StudentManager.init();
    }

    // Initialize basketball prompt modal and its controls
    basketballPromptModal = document.getElementById('basketball-prompt-modal');
    viewBasketballBtn = document.getElementById('view-basketball-btn');
    skipBasketballBtn = document.getElementById('skip-basketball-btn');
    closeBasketballPromptBtn = document.getElementById('close-basketball-prompt-modal');

    if (basketballPromptModal) {
        console.log('Basketball prompt modal (basketball-prompt-modal) found.');
        if (viewBasketballBtn) {
            viewBasketballBtn.addEventListener('click', function() {
                console.log('View basketball analysis button clicked.');
                hideBasketballPrompt();
                window.location.href = '/exercise/picture'; // Ensure this is the correct URL
            });
        } else {
            console.warn('View basketball button (view-basketball-btn) not found.');
        }

        if (skipBasketballBtn) {
            skipBasketballBtn.addEventListener('click', function() {
                console.log('Skip basketball analysis button clicked.');
                hideBasketballPrompt();
            });
        } else {
            console.warn('Skip basketball button (skip-basketball-btn) not found.');
        }

        if (closeBasketballPromptBtn) {
            closeBasketballPromptBtn.addEventListener('click', function() {
                console.log('Close basketball prompt button (X) clicked.');
                hideBasketballPrompt();
            });
        } else {
            console.warn('Close basketball prompt button (close-basketball-prompt-modal) not found.');
        }
    } else {
        console.warn('Basketball prompt modal (basketball-prompt-modal) element not found. The basketball posture check pop-up will not function.');
        // Fallback for showBasketballPostureCheckPopup if modal is missing
        window.showBasketballPostureCheckPopup = function() {
            console.warn('Fallback showBasketballPostureCheckPopup: basketballPromptModal not found. Using confirm dialog.');
            if (confirm('您已完成籃球投籃訓練！是否要查看投籃姿勢分析？')) {
                window.location.href = '/exercise/picture'; // Ensure this is the correct URL
            }
        };
        window.hideBasketballPrompt = function() {
            console.warn('Fallback hideBasketballPrompt: basketballPromptModal not found.');
        };
    }

    // Initialize other parts of the application
    initBasicSystems(); // Includes initUIElements which should grab other buttons like start/stop
    initSocketAndEvents();
    initGameFeatures();
    initExerciseTypeControls();
    exposeGlobalFunctions();
    loadExternalResources();

    videoFeed = document.getElementById('video-feed');
    if (videoFeed) {
        adjustVideoDisplay();
        window.addEventListener('resize', adjustVideoDisplay);
        videoFeed.addEventListener('load', adjustVideoDisplay); // If it's an img/video tag that loads content
    } else {
        console.warn('video-feed element not found.');
    }

    console.log('Application initialization complete.');

    // Example: To test the modal display logic after setup (for debugging)
    // setTimeout(() => {
    //     if (planIncludesBasketball) { // Simulate condition
    //         console.log('Simulating workout completion with basketball for testing modal.');
    //         showBasketballPostureCheckPopup();
    //     }
    // }, 5000);
});

// 初始化基本UI和系統
function initBasicSystems() {
    // 初始化UI元素引用
    initUIElements();
    
    // 初始化頁面
    initPage();
    
    // 調整視頻顯示
    adjustVideoDisplay();
    
    // 添加窗口大小變化監聽器，以便在窗口大小變化時調整視頻尺寸
    window.addEventListener('resize', adjustVideoDisplay);
    
    // 添加必要的樣式
    addCustomStyles();
}

// 初始化Socket連接和事件監聽
function initSocketAndEvents() {
    // 初始化 Socket.IO 連接
    socket = initSocketConnection();
    
    if (!socket) {
        console.error('Socket初始化失敗，嘗試備用方法');
        initSocketFallback();
    }
    
    // 綁定Socket事件監聽器
    bindSocketEvents();
}

// Socket初始化備用方法
function initSocketFallback() {
    try {
        console.log('嘗試使用備用方法初始化Socket');
        socket = io('/exercise', {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });
        
        if (!socket) {
            socket = io.connect('/exercise');
        }
        
        if (!socket) {
            socket = io();
        }
        
        console.log('Socket備用初始化完成:', !!socket);
    } catch (error) {
        console.error('Socket備用初始化失敗:', error);
        showErrorMessage('無法連接到伺服器，請重新整理頁面或檢查網絡連接');
    }
}

// 綁定Socket事件監聽器
function bindSocketEvents() {
    if (!socket) return;
    
    // 移除所有現有事件監聽器，避免重複綁定
    socket.off('connect');
    socket.off('connect_error');
    socket.off('disconnect');
    socket.off('video_frame');
    socket.off('exercise_count');
    socket.off('pose_quality');
    socket.off('quality_score');
    socket.off('angle_data');
    socket.off('detection_result');
    socket.off('coach_tip');
    socket.off('error');
    socket.off('start_detection_response');
    socket.off('stop_detection_response');
    socket.off('model_status');
    socket.off('debug');
    socket.off('dribble_mode');
    
    // 連接事件
    socket.on('connect', function() {
        console.log('Socket.IO 連接成功，ID:', socket.id);
        
        // 更新連接狀態UI
        const detectionStatus = document.querySelector('.detection-status');
        if (detectionStatus) {
            detectionStatus.textContent = '已連接';
            detectionStatus.classList.remove('inactive');
            detectionStatus.classList.add('active');
        }
    });
    
    // 連接錯誤事件
    socket.on('connect_error', function(error) {
        console.error('Socket.IO 連接錯誤:', error);
        
        // 更新連接狀態UI
        const detectionStatus = document.querySelector('.detection-status');
        if (detectionStatus) {
            detectionStatus.textContent = '連接失敗';
            detectionStatus.classList.remove('active');
            detectionStatus.classList.add('inactive');
        }
    });
    
    // 斷開連接事件
    socket.on('disconnect', function(reason) {
        console.log('與伺服器斷開連接:', reason);
        
        // 更新連接狀態UI
        const detectionStatus = document.querySelector('.detection-status');
        if (detectionStatus) {
            detectionStatus.textContent = '未連接';
            detectionStatus.classList.remove('active');
            detectionStatus.classList.add('inactive');
        }
        
        // 如果正在檢測，則停止檢測
        if (isDetecting) {
            stopDetection();
            showErrorMessage('與伺服器的連接已斷開，檢測已停止');
        }
    });
    
    // 視頻幀更新事件
    socket.on('video_frame', function(data) {
        if (videoFeed) {
            if (data && data.frame) {
                // 確保 frame 是有效的 base64 字符串
                try {
                    // 檢查 base64 字符串是否有效
                    if (typeof data.frame === 'string' && data.frame.length > 100) {
                        videoFeed.src = 'data:image/jpeg;base64,' + data.frame;
                        if (!socket.videoFrameReceived) {
                            socket.videoFrameReceived = true;
                            setTimeout(adjustVideoDisplay, 100); // 延迟一点时间确保图像已加载
                        }
                    } else {
                        console.warn('收到的 base64 數據可能無效');
                    }
                } catch (e) {
                    console.error('處理視頻幀時出錯:', e);
                }
            }
        }
    });
    
    // 運動計數更新事件
    socket.on('exercise_count', function(data) {
        // 只有在檢測中才處理計數更新
        if (!isDetecting) {
            console.log('檢測已停止，忽略計數更新:', data);
            return;
        }
        
        //console.log('收到運動計數更新:', data);
        hasReceivedResponse = true;
        
        // 更新計數
        if (data.count !== undefined && data.count > exerciseCounter) {
            const previousCount = exerciseCounter;
            exerciseCounter = data.count;
            updateExerciseCount();
            
            // 觸發運動檢測事件給怪物攻擊系統
            const exerciseTypeForAttack = currentExerciseType || 'squat';
            const exerciseDetectedEvent = new CustomEvent('exerciseDetected', {
                detail: {
                    exerciseType: exerciseTypeForAttack,
                    count: exerciseCounter,
                    quality: 4 // 默認品質為4（良好）
                }
            });
            document.dispatchEvent(exerciseDetectedEvent);
            
            // 觸發攻擊特效 - 每次計數增加時觸發
            if (window.attackEffectsManager && exerciseTypeForAttack) {
                try {
                    window.attackEffectsManager.triggerAttack(exerciseTypeForAttack);
                } catch (error) {
                    console.error('攻擊特效觸發失敗:', error);
                }
            }

            // 觸發攻擊音效combo系統
            if (window.attackComboSystem) {
                try {
                    window.attackComboSystem.triggerAttack();
                } catch (comboError) {
                    console.error('攻擊音效combo觸發失敗:', comboError);
                }
            }
            
            // 更新怪物血量 - 只有在還有怪物需要擊敗時才減少血量
            if (currentMonsterIndex < totalMonsters) {
                decreaseMonsterHP(exerciseCounter);
            }
        }
    });
    
    // 姿勢質量評分事件
    socket.on('pose_quality', function(data) {
        
        
        // 檢查不同可能的屬性名稱
        let qualityScore = 0;
        if (data.score !== undefined) {
            qualityScore = parseInt(data.score);
            updateQualityScore(qualityScore);
        } else if (data.quality !== undefined) {
            qualityScore = parseInt(data.quality);
            updateQualityScore(qualityScore);
        } else if (data.quality_score !== undefined) {
            qualityScore = parseInt(data.quality_score);
            updateQualityScore(qualityScore);
        }
        

        
        // 傳遞完整的姿勢品質數據給怪物攻擊系統 - 支援所有運動類型
        if (window.monsterAttackSystem && typeof window.monsterAttackSystem.handlePostureQuality === 'function') {
            
            window.monsterAttackSystem.handlePostureQuality({
                score: qualityScore,
                exerciseType: currentExerciseType || 'squat'
            });

        } else {
            console.warn('怪物攻擊系統未初始化或方法不存在:', {
                systemExists: !!window.monsterAttackSystem,
                methodExists: window.monsterAttackSystem ? typeof window.monsterAttackSystem.handlePostureQuality : 'N/A'
            });
        }
        
        // 觸發姿勢品質事件給其他模組 - 支援所有運動類型的防護罩機制
        const postureQualityEvent = new CustomEvent('postureQuality', {
            detail: {
                exercise: currentExerciseType || 'squat',
                quality: qualityScore / 5, // 轉換為0-1範圍
                isCorrect: qualityScore >= 3,
                score: qualityScore,
                exerciseType: currentExerciseType // 明確傳遞運動類型
            }
        });
        document.dispatchEvent(postureQualityEvent);
        

        
        // 更新教練提示
        if (data.feedback && coachTipText) {
            coachTipText.innerHTML = data.feedback;
        }
    });
    
    // 品質分數事件
    socket.on('quality_score', function(data) {
       
        
        if (data.score !== undefined) {
            updateQualityScore(parseInt(data.score));
        }
    });
    
    // 肩推分數事件
    socket.on('shoulder_press_score', function(data) {
        
        
        if (data.score !== undefined) {
            updateQualityScore(parseInt(data.score));
        }
    });
    
    // 角度數據事件
    socket.on('angle_data', function(data) {
        
        
        // 檢查數據格式
        if (data) {
            // 如果data本身就是角度數據對象（不包含angles屬性）
            if (typeof data === 'object' && !data.angles && Object.keys(data).some(key => key.includes('膝') || key.includes('肘') || key.includes('肩') || key.includes('髖'))) {
                // 直接使用data作為angles
                updateCoachTip('', data);
                updateAngles(data);
            }
            // 如果data包含angles屬性
            else if (data.angles) {
                updateCoachTip('', data.angles);
                updateAngles(data.angles);
            } 
            else {
                console.warn('收到無效的角度數據格式:', data);
                // 即使没有有效的角度数据，也尝试更新教练提示
                if (coachTipText) {
                    const exerciseType = currentExerciseType || 'squat';
                    coachTipText.innerHTML = generateCoachTips({}, exerciseType);
                }
            }
        }
    });
    
    // 檢測結果事件
    socket.on('detection_result', function(data) {
        
        
        if (!isDetecting) return;
        
        // 更新計數
        if (data.count !== undefined && data.count > exerciseCounter) {
            exerciseCounter = data.count;
            updateExerciseCount();
            
            // 使用decreaseMonsterHP函數來處理怪物血量減少和擊敗邏輯
            decreaseMonsterHP(data.count);
        }
        
        // 更新質量評分
        if (data.quality !== undefined) {
            updateQualityScore(parseInt(data.quality));
        } else if (data.score !== undefined) {
            updateQualityScore(parseInt(data.score));
        } else if (data.quality_score !== undefined) {
            updateQualityScore(parseInt(data.quality_score));
        }
        
        // 更新教練提示 - 使用角度數據
        if (data.angles) {
            updateCoachTip(data.tip || '', data.angles);
        } else if (data.tip) {
            updateCoachTip(data.tip);
        }
        
        // 更新角度顯示
        if (data.angles) {
            updateAngles(data.angles);
        }
    });
    
    // 教練提示事件
    socket.on('coach_tip', function(data) {
       
        
        if (coachTipText && data.tip) {
            // 檢查提示是否已包含HTML標籤
            if (data.tip.includes('<div') || data.tip.includes('<i')) {
                coachTipText.innerHTML = data.tip; // 已經是HTML格式
            } else {
                // 將純文本轉換為簡單的HTML格式
                coachTipText.innerHTML = `<div class="tip-item info"><i class="fas fa-info-circle"></i> ${data.tip}</div>`;
            }
        }
    });
    
    // 運球模式事件
    socket.on('dribble_mode', function(data) {
        if (data.mode) {
            updateDribbleMode(data.mode);
        }
    });
    
    // 排球低手接球姿勢數據事件
    socket.on('volleyball_lowhand_data', function(data) {
        
        
        // 更新姿勢時間
        if (data.current_time !== undefined) {
            const postureTime = document.getElementById('volleyball-posture-time');
            if (postureTime) {
                postureTime.textContent = Math.floor(data.current_time);
            }
        }
        
        // 更新目標時間
        if (data.target_time !== undefined) {
            const targetTime = document.getElementById('volleyball-target-time');
            if (targetTime) {
                targetTime.textContent = data.target_time;
            }
        }
        
        // 更新姿勢狀態
        if (data.is_correct !== undefined) {
            const postureStatus = document.getElementById('volleyball-posture-status');
            if (postureStatus) {
                postureStatus.textContent = data.is_correct ? '正確姿勢' : '姿勢不正確';
                postureStatus.style.color = data.is_correct ? '#28a745' : '#dc3545';
            }
        }
    });
    
    // 排球高手攻擊數據事件
    socket.on('volleyball_overhand_data', function(data) {
        
        
        // 可以在這裡添加高手攻擊特定的數據處理邏輯
        // 例如攻擊力度、角度等
    });
    
    // 雙手輪流擺動熱身運動時間更新事件
    socket.on('alternating_arm_swing_time', function(data) {
       
        
        // 更新累積時間顯示
        if (data.time !== undefined) {
            const accumulatedTime = document.getElementById('accumulated-time');
            if (accumulatedTime) {
                accumulatedTime.textContent = data.time.toFixed(1);
            }
            
            // 更新進度條
            const targetTimeInput = document.getElementById('target-time-input');
            if (targetTimeInput) {
                const targetTime = parseFloat(targetTimeInput.value) || 30;
                const progress = Math.min((data.time / targetTime) * 100, 100);
                
                const progressFill = document.getElementById('timer-progress-fill');
                const progressText = document.getElementById('timer-progress-text');
                
                if (progressFill) {
                    progressFill.style.width = progress + '%';
                }
                if (progressText) {
                    progressText.textContent = Math.round(progress) + '%';
                }
                
                // 如果達到目標時間，顯示完成提示
                if (progress >= 100) {
                    showToast('恭喜！已完成雙手輪流擺動熱身運動目標時間！', 'success');
                }
            }
        }
    });
    
    // 雙手輪流擺動熱身運動目標時間設置事件
    socket.on('alternating_arm_swing_target', function(data) {
        
        
        if (data.target_time !== undefined) {
            const targetTimeInput = document.getElementById('target-time-input');
            if (targetTimeInput) {
                targetTimeInput.value = data.target_time;
            }
        }
    });
    
    // 雙手輪流擺動熱身運動狀態數據事件
    socket.on('alternating_arm_swing_status', function(data) {
        
        
        // 更新動作狀態
        if (data.motion_status !== undefined) {
            const motionStatus = document.getElementById('motion-status');
            if (motionStatus) {
                motionStatus.textContent = data.motion_status;
            }
        }
        
        // 更新左手狀態
        if (data.left_arm_status !== undefined) {
            const leftArmStatus = document.getElementById('left-arm-status');
            if (leftArmStatus) {
                leftArmStatus.textContent = data.left_arm_status;
            }
        }
        
        // 更新右手狀態
        if (data.right_arm_status !== undefined) {
            const rightArmStatus = document.getElementById('right-arm-status');
            if (rightArmStatus) {
                rightArmStatus.textContent = data.right_arm_status;
            }
        }
        
        // 更新輪流擺動狀態
        if (data.alternating_status !== undefined) {
            const alternatingStatus = document.getElementById('alternating-status');
            if (alternatingStatus) {
                alternatingStatus.textContent = data.alternating_status;
            }
        }
    });
    
    // 平板支撐時間更新事件
    socket.on('plank_time', function(data) {
        
        
        // 更新累積時間顯示
        if (data.time !== undefined) {
            const accumulatedTime = document.getElementById('plank-accumulated-time');
            if (accumulatedTime) {
                accumulatedTime.textContent = data.time.toFixed(1);
            }
            
            // 更新進度條
            const targetTimeInput = document.getElementById('plank-target-time-input');
            if (targetTimeInput) {
                const targetTime = parseFloat(targetTimeInput.value) || 30;
                const progress = Math.min((data.time / targetTime) * 100, 100);
                
                const progressFill = document.getElementById('plank-timer-progress-fill');
                const progressText = document.getElementById('plank-timer-progress-text');
                
                if (progressFill) {
                    progressFill.style.width = progress + '%';
                }
                if (progressText) {
                    progressText.textContent = Math.round(progress) + '%';
                }
                
                // 如果達到目標時間，顯示完成提示
                if (progress >= 100) {
                    showToast('恭喜！已完成平板支撐目標時間！', 'success');
                }
            }
        }
    });
    
    // 平板支撐目標時間設置事件
    socket.on('plank_target', function(data) {
        
        
        if (data.target_time !== undefined) {
            const targetTimeInput = document.getElementById('plank-target-time-input');
            if (targetTimeInput) {
                targetTimeInput.value = data.target_time;
            }
        }
    });
    
    // 平板支撐狀態數據事件
    socket.on('plank_status', function(data) {
        
        
        // 更新姿勢狀態
        if (data.posture_status !== undefined) {
            const postureStatus = document.getElementById('plank-posture-status');
            if (postureStatus) {
                postureStatus.textContent = data.posture_status;
            }
        }
        
        // 更新品質分數
        if (data.quality_score !== undefined) {
            const qualityScore = document.getElementById('plank-quality-score');
            if (qualityScore) {
                qualityScore.textContent = data.quality_score.toFixed(1);
            }
        }
        
        // 更新身體角度
        if (data.body_angle !== undefined) {
            const bodyAngle = document.getElementById('plank-body-angle');
            if (bodyAngle) {
                bodyAngle.textContent = data.body_angle.toFixed(1) + '°';
            }
        }
        
        // 更新穩定性
        if (data.stability !== undefined) {
            const stability = document.getElementById('plank-stability');
            if (stability) {
                stability.textContent = data.stability;
            }
        }
    });
    
    // 模型狀態事件
    socket.on('model_status', function(data) {
        
        
        if (data.loaded) {
            console.log('模型已加載');
        } else {
            console.warn('模型未加載');
            showErrorMessage('模型未加載，請稍後再試');
        }
    });
    
    // 調試事件
    socket.on('debug', function(data) {
        console.log('調試信息:', data);
    });
    
    // 錯誤事件
    socket.on('error', function(data) {
        console.error('收到錯誤消息:', data);
        showErrorMessage(data.message || '發生錯誤，請重試');
    });
    
    // 開始檢測響應事件
    socket.on('start_detection_response', function(data) {
        
        hasReceivedResponse = true;
        
        if (data.status === 'success') {
            console.log('成功開始檢測');
            showToast('成功開始檢測', 'success');
        } else {
            showErrorMessage('開始檢測失敗: ' + (data.message || '未知錯誤'));
            stopDetection();
        }
    });
    
    // 停止檢測響應事件
    socket.on('stop_detection_response', function(data) {
        console.log('收到停止檢測響應:', data);
        
        if (data.status === 'success') {
            console.log('成功停止檢測');
            showToast('已停止檢測', 'info');
        } else {
            showErrorMessage('停止檢測失敗: ' + (data.message || '未知錯誤'));
        }
    });
}

// 初始化遊戲相關功能
function initGameFeatures() {
    // 初始化怪物系統
    initMonsterSystem();
    
    // 初始化地圖滾動
    initMapScroll();
    
    // 設置地圖模態視窗事件
    setupMapModal();
    
    // 初始化第一關
    initLevel(1);
    
    // 新增怪物對話框樣式
    addMonsterDialogueStyle();
    
    // 初始化怪物血量顯示
    initMonsterHPDisplay();
    
    // 初始化Combo技能系統
    initComboSystem();
    
    // 使用延時確保DOM完全加載
    setTimeout(function() {
        // 初始化護盾系統
        initShieldControls();
        
        // 綁定護盾更新事件
        bindShieldUpdateEvents();
        
        // 嘗試顯示初始對話，測試對話框是否正常
        showMonsterDialogue('準備好開始挑戰了嗎？');
        
        // 調整視頻顯示
        adjustVideoDisplay();
        
        // 檢查並添加必要的 Font Awesome 圖標
        addFontAwesomeIfNeeded();
        
        // 添加教練提示樣式
        addCoachTipStyles();
    }, 500);
}

// 初始化特定運動類型的控制項
function initExerciseTypeControls() {
    // 獲取運動類型選擇器
    const exerciseTypeSelect = document.getElementById('exercise-type') || 
                              document.getElementById('exercise-select');
    
    if (exerciseTypeSelect) {
        exerciseTypeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            currentExerciseType = selectedValue;
            console.log('選擇的運動類型變更為:', currentExerciseType);
            
            // 根據選擇的運動類型更新教練提示
            if (coachTipText) {
                switch (selectedValue) {
                    case 'table-tennis':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 桌球揮拍模式：請站在攝像頭前，系統將偵測您的揮拍動作。首先需要確定您的慣用手，請將手放入畫面中的圓圈內。</div>';
                        break;
                    case 'basketball':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 籃球投籃模式：請站在攝像頭前，系統將偵測您的投籃動作。</div>';
                        break;
                    case 'basketball-dribble':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 籃球運球模式：請站在攝像頭前，系統將偵測您的運球動作。默認為高位運球模式。</div>';
                        break;
                    case 'volleyball-overhand':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 排球高手攻擊模式：請站在攝像頭前，保持手腕高於頭部位置進行攻擊動作。</div>';
                        break;
                    case 'volleyball-lowhand':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 排球低手接球模式：請站在攝像頭前，保持雙手在腰部以下位置準備接球。</div>';
                        break;
                    case 'alternating-arm-swing':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 雙手輪流擺動熱身模式：請坐姿保持穩定，雙手向前伸直，左右手輪流上下擺動。持續做對的運動會累積時間。</div>';
                        break;
                    case 'plank':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 平板支撐模式：保持身體成一直線，手臂伸直支撐身體，腹部收緊。持續保持正確姿勢會累積時間。</div>';
                        break;
                    case 'squat':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 深蹲模式：下蹲時保持背部挺直，膝蓋不要超過腳尖。</div>';
                        break;
                    case 'pushup':
                    case 'push-up':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 伏地挺身模式：保持身體成一直線，肘部靠近身體。</div>';
                        break;
                    case 'situp':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 仰臥起坐模式：上身抬起時保持腹部緊張，避免用力過猛。</div>';
                        break;
                    case 'bicep-curl':
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 二頭彎舉模式：保持上臂固定，只移動前臂。</div>';
                        break;
                    default:
                        coachTipText.innerHTML = '<div class="tip-item info"><i class="fas fa-info-circle"></i> 請選擇一種運動開始訓練。</div>';
                }
            }
            
            // 動態調整表單參數
            updateExerciseFormParams(selectedValue);
            
            // 顯示/隱藏特定運動的控制元素
            toggleExerciseControls(selectedValue);
        });
    }
    
    // 添加重置籃球運球事件監聽器
    const resetBasketballDribbleButton = document.getElementById('reset-basketball-dribble');
    if (resetBasketballDribbleButton) {
        resetBasketballDribbleButton.addEventListener('click', function() {
            if (isDetecting && basketballDribbleActive) {
                socket.emit('reset_basketball_dribble');
                console.log('發送重置籃球運球請求');
                showToast('已重置籃球運球計數', 'info');
            }
        });
    }
    
    // 添加重置排球高手攻擊事件監聽器
    const resetVolleyballOverhandButton = document.getElementById('reset-volleyball-overhand');
    if (resetVolleyballOverhandButton) {
        resetVolleyballOverhandButton.addEventListener('click', function() {
            if (isDetecting && (currentExerciseType === 'volleyball-overhand')) {
                socket.emit('reset_volleyball_overhand');
                console.log('發送重置排球高手攻擊請求');
                showToast('已重置排球高手攻擊計數', 'info');
            }
        });
    }
    
    // 添加重置排球低手接球事件監聽器
    const resetVolleyballLowhandButton = document.getElementById('reset-volleyball-lowhand');
    if (resetVolleyballLowhandButton) {
        resetVolleyballLowhandButton.addEventListener('click', function() {
            if (isDetecting && (currentExerciseType === 'volleyball-lowhand')) {
                socket.emit('reset_volleyball_lowhand');
                console.log('發送重置排球低手接球請求');
                // 重置顯示元素
                const postureTime = document.getElementById('volleyball-posture-time');
                const postureStatus = document.getElementById('volleyball-posture-status');
                if (postureTime) postureTime.textContent = '0';
                if (postureStatus) postureStatus.textContent = '等待檢測';
                showToast('已重置排球低手接球計數', 'info');
            }
        });
    }
    
    // 添加重置雙手輪流擺動熱身運動事件監聽器
    const resetAlternatingArmSwingButton = document.getElementById('reset-alternating-arm-swing');
    if (resetAlternatingArmSwingButton) {
        resetAlternatingArmSwingButton.addEventListener('click', function() {
            if (isDetecting && (currentExerciseType === 'alternating-arm-swing')) {
                socket.emit('reset_alternating_arm_swing');
                console.log('發送重置雙手輪流擺動熱身運動請求');
                // 重置顯示元素
                const accumulatedTime = document.getElementById('accumulated-time');
                const motionStatus = document.getElementById('motion-status');
                const leftArmStatus = document.getElementById('left-arm-status');
                const rightArmStatus = document.getElementById('right-arm-status');
                const alternatingStatus = document.getElementById('alternating-status');
                const progressFill = document.getElementById('timer-progress-fill');
                const progressText = document.getElementById('timer-progress-text');
                
                if (accumulatedTime) accumulatedTime.textContent = '0.0';
                if (motionStatus) motionStatus.textContent = '等待檢測';
                if (leftArmStatus) leftArmStatus.textContent = '-';
                if (rightArmStatus) rightArmStatus.textContent = '-';
                if (alternatingStatus) alternatingStatus.textContent = '-';
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                
                showToast('已重置雙手輪流擺動熱身運動', 'info');
            }
        });
    }
    
    // 添加重置平板支撐事件監聽器
    const resetPlankButton = document.getElementById('reset-plank');
    if (resetPlankButton) {
        resetPlankButton.addEventListener('click', function() {
            if (isDetecting && (currentExerciseType === 'plank')) {
                socket.emit('reset_plank');
                console.log('發送重置平板支撐請求');
                // 重置顯示元素
                const accumulatedTime = document.getElementById('plank-accumulated-time');
                const postureStatus = document.getElementById('plank-posture-status');
                const qualityScore = document.getElementById('plank-quality-score');
                const bodyAngle = document.getElementById('plank-body-angle');
                const stability = document.getElementById('plank-stability');
                const progressFill = document.getElementById('plank-timer-progress-fill');
                const progressText = document.getElementById('plank-timer-progress-text');
                
                if (accumulatedTime) accumulatedTime.textContent = '0.0';
                if (postureStatus) postureStatus.textContent = '等待檢測';
                if (qualityScore) qualityScore.textContent = '0.0';
                if (bodyAngle) bodyAngle.textContent = '0.0°';
                if (stability) stability.textContent = '-';
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                
                showToast('已重置平板支撐', 'info');
            }
        });
    }
    
    // 添加切換運球模式事件監聽器
    const toggleDribbleModeButton = document.getElementById('toggle-dribble-mode');
    if (toggleDribbleModeButton) {
        toggleDribbleModeButton.addEventListener('click', function() {
            if (isDetecting && basketballDribbleActive) {
                const newMode = currentDribbleMode === 'high' ? 'low' : 'high';
                socket.emit('set_dribble_mode', { mode: newMode });
                console.log('發送切換運球模式請求:', newMode);
                showToast(`已切換至${newMode === 'high' ? '高位' : '低位'}運球模式`, 'info');
                updateDribbleMode(newMode);
            }
        });
    }
}

// 動態調整表單參數
function updateExerciseFormParams(exerciseType) {
    const weightGroup = document.querySelector('.input-group:has(label[for="weight"])');
    const repsGroup = document.querySelector('.input-group:has(label[for="reps"])');
    const setsGroup = document.querySelector('.input-group:has(label[for="sets"])');
    
    // 如果找不到元素，嘗試其他方式
    const weightInput = document.getElementById('weight');
    const repsInput = document.getElementById('reps');
    const setsInput = document.getElementById('sets');
    
    if (exerciseType === 'alternating-arm-swing' || exerciseType === 'plank') {
        // 雙手輪流擺動熱身運動和平板支撐：顯示重量和時間
        if (weightInput && weightInput.parentElement) {
            const weightLabel = weightInput.parentElement.querySelector('label');
            if (weightLabel) weightLabel.textContent = '重量 (kg)';
            weightInput.style.display = 'block';
            weightInput.parentElement.style.display = 'block';
        }
        
        if (repsInput && repsInput.parentElement) {
            const repsLabel = repsInput.parentElement.querySelector('label');
            if (repsLabel) repsLabel.textContent = '目標時間 (秒)';
            repsInput.placeholder = '30';
            repsInput.value = '30';
            repsInput.min = '10';
            repsInput.max = '300';
            repsInput.step = '5';
            repsInput.style.display = 'block';
            repsInput.parentElement.style.display = 'block';
        }
        
        if (setsInput && setsInput.parentElement) {
            // 隱藏組數
            setsInput.parentElement.style.display = 'none';
        }
    } else {
        // 其他運動：恢復默認的次數和組數
        if (weightInput && weightInput.parentElement) {
            const weightLabel = weightInput.parentElement.querySelector('label');
            if (weightLabel) weightLabel.textContent = '重量 (kg)';
            weightInput.style.display = 'block';
            weightInput.parentElement.style.display = 'block';
        }
        
        if (repsInput && repsInput.parentElement) {
            const repsLabel = repsInput.parentElement.querySelector('label');
            if (repsLabel) repsLabel.textContent = '次數/組';
            repsInput.placeholder = '10';
            repsInput.value = '10';
            repsInput.min = '1';
            repsInput.max = '100';
            repsInput.step = '1';
            repsInput.style.display = 'block';
            repsInput.parentElement.style.display = 'block';
        }
        
        if (setsInput && setsInput.parentElement) {
            setsInput.parentElement.style.display = 'block';
        }
    }
    
    console.log(`表單參數已更新為運動類型: ${exerciseType}`);
}

// 暴露全局函數，以便在控制台調試
function exposeGlobalFunctions() {
    window.startDetection = startDetection;
    window.stopDetection = stopDetection;
    window.resetCount = resetCount;
    window.updateMonsterHP = updateMonsterHP;
    window.showMonsterDialogue = showMonsterDialogue;
    window.initLevel = initLevel;
    window.debugGameState = debugGameState;
    window.updateShieldFromExerciseParams = updateShieldFromExerciseParams;
    window.adjustVideoDisplay = adjustVideoDisplay;
    window.toggleExerciseControls = toggleExerciseControls;
    window.updateDribbleMode = updateDribbleMode;
}

// 動態加載必要的外部資源
function loadExternalResources() {
    // 添加 Font Awesome 圖標庫（如果尚未添加）
    addFontAwesomeIfNeeded();
    
    // 確保 THREE.js 和 GLTFLoader 已載入
    loadThreeJsIfNeeded();
}

// 添加 Font Awesome 圖標庫（如果尚未添加）
function addFontAwesomeIfNeeded() {
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);
        console.log('已添加 Font Awesome 圖標庫');
    }
}

// 添加教練提示樣式
function addCoachTipStyles() {
    if (!document.getElementById('coach-tip-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'coach-tip-styles';
        styleElement.textContent = `
            .tip-item {
                margin-bottom: 8px;
                padding: 8px;
                border-radius: 4px;
                display: flex;
                align-items: flex-start;
            }
            
            .tip-item i {
                margin-right: 8px;
                margin-top: 2px;
            }
            
            .tip-item.good {
                background-color: rgba(76, 175, 80, 0.1);
                color: #4CAF50;
            }
            
            .tip-item.warning {
                background-color: rgba(255, 152, 0, 0.1);
                color: #FF9800;
            }
            
            .tip-item.error {
                background-color: rgba(244, 67, 54, 0.1);
                color: #F44336;
            }
            
            .tip-item.info {
                background-color: rgba(33, 150, 243, 0.1);
                color: #2196F3;
            }
            
            .quality-display {
                padding: 4px 8px;
                border-radius: 4px;
                background-color: #f0f0f0;
                transition: all 0.3s ease;
            }
            
            .quality-display.excellent {
                background-color: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }
            
            .quality-display.good {
                background-color: rgba(33, 150, 243, 0.2);
                color: #2196F3;
            }
            
            .quality-display.average {
                background-color: rgba(255, 152, 0, 0.2);
                color: #FF9800;
            }
            
            .quality-display.poor {
                background-color: rgba(244, 67, 54, 0.2);
                color: #F44336;
            }
        `;
        document.head.appendChild(styleElement);
        console.log('已添加教練提示樣式');
    }
}

// 添加自定義樣式
function addCustomStyles() {
    // 添加教練提示樣式
    addCoachTipStyles();
    
    // 添加其他必要的樣式
    if (!document.getElementById('custom-realtime-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'custom-realtime-styles';
        styleElement.textContent = `
            .detection-status {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 14px;
                margin-left: 10px;
                transition: all 0.3s ease;
            }
            
            .detection-status.active {
                background-color: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }
            
            .detection-status.inactive {
                background-color: rgba(244, 67, 54, 0.2);
                color: #F44336;
            }
            
            .video-container {
                position: relative;
                width: 100%;
                max-height: 70vh;
                overflow: hidden;
                display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            #video-feed {
                width: 100%;
                height: auto;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 8px;
            }
            
            .controls-container {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            
            .primary-button {
                background-color: #4CAF50;
                color: white;
            }
            
            .primary-button:hover {
                background-color: #45a049;
            }
            
            .secondary-button {
                background-color: #f44336;
                color: white;
            }
            
            .secondary-button:hover {
                background-color: #d32f2f;
            }
            
            .info-button {
                background-color: #2196F3;
                color: white;
            }
            
            .info-button:hover {
                background-color: #0b7dda;
            }
            
            .exercise-stats {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .stat-card {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                flex: 1;
                min-width: 200px;
            }
            
            /* 訓練計劃樣式 */
            .plan-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .plan-item {
                background-color: #f5f5f5;
                border-radius: 6px;
                padding: 10px;
                border-left: 3px solid #ccc;
                transition: all 0.3s ease;
            }
            
            .plan-item.active {
                background-color: rgba(76, 175, 80, 0.1);
                border-left: 3px solid #4CAF50;
            }
            
            .plan-item-name {
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .plan-item-details {
                font-size: 0.9em;
                color: #666;
                margin-bottom: 8px;
            }
            
            .plan-item-progress {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .progress-bar {
                flex: 1;
                height: 6px;
                background-color: #e0e0e0;
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background-color: #4CAF50;
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            
            .progress-text {
                font-size: 0.85em;
                color: #666;
                min-width: 40px;
                text-align: right;
            }
            
            .no-plan {
                padding: 15px;
                text-align: center;
                color: #666;
                font-style: italic;
                background-color: #f9f9f9;
                border-radius: 6px;
            }
            
            .current-exercise-info {
                margin-top: 15px;
                padding: 12px;
                background-color: #f0f7ff;
                border-radius: 6px;
                border-left: 3px solid #2196F3;
            }
            
            .current-exercise-label {
                font-weight: bold;
                margin-bottom: 5px;
                color: #2196F3;
            }
            
            .progress-info {
                margin-top: 5px;
                font-size: 0.9em;
                color: #555;
            }
            
            .workout-plan-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }
            
            .workout-exercise-item {
                background-color: #f9f9f9;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                border: 1px solid #e0e0e0;
            }
            
            .exercise-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .exercise-number {
                font-weight: bold;
                background-color: #2196F3;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .remove-exercise-btn {
                background: none;
                border: none;
                color: #f44336;
                cursor: pointer;
                font-size: 16px;
            }
            
            .exercise-params {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }
            
            .exercise-params .input-group {
                flex: 1;
                min-width: 120px;
            }
            
            .stat-card h3 {
                margin-top: 0;
                color: #333;
                font-size: 16px;
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #2196F3;
            }
            
            .coach-tip-container {
                background-color: #f5f5f5;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            
            .coach-tip-container h3 {
                margin-top: 0;
                color: #333;
            }
            
            #coach-tip-text {
                line-height: 1.5;
            }
        `;
        document.head.appendChild(styleElement);
        console.log('已添加自定義樣式');
    }
}

// 根據運動類型顯示/隱藏特定控制元素
function toggleExerciseControls(exerciseType) {
    // 獲取各種控制元素
    const basketballControls = document.getElementById('basketball-controls');
    const basketballDribbleControls = document.getElementById('basketball-dribble-controls');
    const tableTennisControls = document.getElementById('table-tennis-controls');
    
    // 隱藏所有控制元素
    if (basketballControls) basketballControls.style.display = 'none';
    if (basketballDribbleControls) basketballDribbleControls.style.display = 'none';
    if (tableTennisControls) tableTennisControls.style.display = 'none';
    
    // 根據選擇的運動類型顯示相應的控制元素
    switch (exerciseType) {
        case 'basketball':
            if (basketballControls) basketballControls.style.display = 'block';
            break;
        case 'basketball-dribble':
            if (basketballDribbleControls) basketballDribbleControls.style.display = 'block';
            break;
        case 'table-tennis':
            if (tableTennisControls) tableTennisControls.style.display = 'block';
            break;
    }
}

// 更新運球模式顯示
function updateDribbleMode(mode) {
    currentDribbleMode = mode;
    const modeElement = document.getElementById('current-dribble-mode');
    const descriptionElement = document.getElementById('dribble-mode-description');
    
    if (modeElement && descriptionElement) {
        if (mode === 'high') {
            modeElement.textContent = '高位運球';
            descriptionElement.textContent = '高位運球模式：保持手腕在膝蓋以上位置運球';
        } else {
            modeElement.textContent = '低位運球';
            descriptionElement.textContent = '低位運球模式：保持手腕在膝蓋以下位置運球';
        }
    }
}

function loadThreeJsIfNeeded() {
    if (typeof THREE === 'undefined') {
        console.log('THREE.js 未載入，嘗試動態載入');
        
        // 動態載入 THREE.js
        const threeScript = document.createElement('script');
        threeScript.src = 'https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.min.js';
        threeScript.onload = function() {
            console.log('THREE.js 已動態載入');
            
            // 載入 GLTFLoader
            const loaderScript = document.createElement('script');
            loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/loaders/GLTFLoader.js';
            loaderScript.onload = function() {
                console.log('GLTFLoader 已動態載入');
                setTimeout(loadMonsterModel, 500);
            };
            document.head.appendChild(loaderScript);
        };
        document.head.appendChild(threeScript);
    } else if (typeof THREE.GLTFLoader === 'undefined' && typeof window.GLTFLoader === 'undefined') {
        console.log('THREE.js 已載入，但 GLTFLoader 未載入，嘗試動態載入');
        
        // 只載入 GLTFLoader
        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/loaders/GLTFLoader.js';
        loaderScript.onload = function() {
            console.log('GLTFLoader 已動態載入');
            setTimeout(loadMonsterModel, 500);
        };
        document.head.appendChild(loaderScript);
    } else {
        console.log('THREE.js 和 GLTFLoader 已載入');
        // 確保模型載入
        setTimeout(loadMonsterModel, 500);
    }
}



// 初始化Socket連接
function initSocketConnection() {
    console.log('初始化Socket連接');
    
    // 檢查是否已存在Socket連接
    if (socket && socket.connected) {
        console.log('Socket已連接，跳過初始化');
        return socket;
    }
    
    // 如果socket存在但未連接，嘗試重新連接
    if (socket) {
        console.log('Socket存在但未連接，嘗試重新連接');
        socket.connect();
        return socket;
    }
    // 建立Socket連接 - 嘗試多種連接方式
    try {
        console.log('建立新的Socket連接');
        
        // 嘗試使用命名空間連接
        try {
            socket = io('/exercise', {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000
            });
            console.log('使用 /exercise 命名空間連接');
        } catch (err) {
            console.warn('使用命名空間連接失敗，嘗試預設連接:', err);
            socket = io({
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000
            });
            console.log('使用預設連接');
        }
        
        // 移除所有現有事件監聽器，避免重複綁定
        socket.off('connect');
        socket.off('connect_error');
        socket.off('disconnect');
        socket.off('video_frame');
        socket.off('exercise_count');
        socket.off('pose_quality');
        socket.off('quality_score');
        socket.off('angle_data');
        socket.off('detection_result');
        socket.off('coach_tip');
        socket.off('error');
        socket.off('start_detection_response');
        socket.off('stop_detection_response');
        socket.off('model_status');
        socket.off('debug');
        socket.off('dribble_mode');
        
        // 添加連接事件處理
        socket.on('connect', function() {
            console.log('Socket.io 連接成功');
            showToast('伺服器連接成功', 'success');
            
            // 設置訓練計劃監聽器
            setupWorkoutPlanListener();
            
            // 更新連接狀態UI
            const detectionStatus = document.querySelector('.detection-status');
            if (detectionStatus) {
                detectionStatus.textContent = '已連接';
                detectionStatus.classList.remove('inactive');
                detectionStatus.classList.add('active');
            }
        });
        
        socket.on('connect_error', function(error) {
            console.error('Socket.io 連接錯誤:', error);
            showToast('伺服器連接失敗，請重新整理頁面', 'error');
            
            // 更新連接狀態UI
            const detectionStatus = document.querySelector('.detection-status');
            if (detectionStatus) {
                detectionStatus.textContent = '連接失敗';
                detectionStatus.classList.remove('active');
                detectionStatus.classList.add('inactive');
            }
        });
        
        // 斷開連接事件
        socket.on('disconnect', function(reason) {
            console.log('Socket斷開連接:', reason);
            
            // 更新連接狀態UI
            const detectionStatus = document.querySelector('.detection-status');
            if (detectionStatus) {
                detectionStatus.textContent = '未連接';
                detectionStatus.classList.remove('active');
                detectionStatus.classList.add('inactive');
            }
            
            if (isDetecting) {
                stopDetection();
                showErrorMessage('與伺服器的連接已斷開，檢測已停止');
            }
        });
        
        // 添加視頻幀更新事件監聽
        socket.on('video_frame', function(data) {
            if (videoFeed) {
                if (data && data.frame) {
                    // 確保 frame 是有效的 base64 字符串
                    try {
                        // 檢查 base64 字符串是否有效
                        if (typeof data.frame === 'string' && data.frame.length > 100) {
                            videoFeed.src = 'data:image/jpeg;base64,' + data.frame;
                            if (!socket.videoFrameReceived) {
                                socket.videoFrameReceived = true;
                                console.log('首次接收到視頻幀');
                                setTimeout(adjustVideoDisplay, 100); // 延迟一点时间确保图像已加载
                            }
                        } else {
                            console.warn('收到的 base64 數據可能無效');
                        }
                    } catch (e) {
                        console.error('處理視頻幀時出錯:', e);
                    }
                }
            }
        });
        
        // 添加運動計數更新事件
        socket.on('exercise_count', function(data) {
            console.log('收到運動計數更新:', data);
            hasReceivedResponse = true;
            
            // 更新计数
            exerciseCounter = data.count;
            updateExerciseCount();
            
            if (exerciseCount) {
                exerciseCount.textContent = data.count;
                exerciseCounter = data.count;
            }

            // 更新怪物血量 - 只有在还有怪物需要击败时才减少血量
            if (currentMonsterIndex < totalMonsters) {
                decreaseMonsterHP(exerciseCounter);
            }
        });
        
        // 姿勢質量評分事件已在主要監聽器中處理，此處移除重複監聽器
        
        // 添加品質分數事件監聽
        socket.on('quality_score', function(data) {
            console.log('收到品質分數:', data);
            
            // 更新品質分數顯示
            if (qualityScore) {
                qualityScore.textContent = data.score || 0;
            }
            
            // 更新品質標題
            if (qualityTitle) {
                let qualityText = '未評分';
                const score = parseInt(data.score || 0);
                
                if (score >= 4) {
                    qualityText = '優秀';
                    qualityDisplay.className = 'quality-display excellent';
                } else if (score >= 3) {
                    qualityText = '良好';
                    qualityDisplay.className = 'quality-display good';
                } else if (score >= 2) {
                    qualityText = '一般';
                    qualityDisplay.className = 'quality-display average';
                } else if (score >= 1) {
                    qualityText = '需改進';
                    qualityDisplay.className = 'quality-display poor';
                }
                
                qualityTitle.textContent = qualityText;
            }
            
            // 保存最後的品質分數
            lastQuality = parseInt(data.score || 0);
        });
        
        // 添加肩推分數事件監聽
        socket.on('shoulder_press_score', function(data) {
            console.log('收到肩推分數:', data);
            
            if (data.score !== undefined) {
                updateQualityScore(parseInt(data.score));
            }
        });
        
        // 添加角度數據事件監聽
        socket.on('angle_data', function(data) {
            console.log('收到角度數據:', data);
            
            // 檢查數據格式
            if (data) {
                // 如果data本身就是角度數據對象（不包含angles屬性）
                if (typeof data === 'object' && !data.angles && Object.keys(data).some(key => key.includes('膝') || key.includes('肘') || key.includes('肩') || key.includes('髖'))) {
                    // 直接使用data作為angles
                    updateCoachTip('', data);
                    updateAngles(data);
                }
                // 如果data包含angles屬性
                else if (data.angles) {
                    updateCoachTip('', data.angles);
                    updateAngles(data.angles);
                } 
                else {
                    console.warn('收到無效的角度數據格式:', data);
                    // 即使没有有效的角度数据，也尝试更新教练提示
                    if (coachTipText) {
                        const exerciseType = currentExerciseType || 'squat';
                        coachTipText.innerHTML = generateCoachTips({}, exerciseType);
                    }
                }
            }
        });
        
        // 添加檢測結果事件監聽
        socket.on('detection_result', function(data) {
            console.log('收到偵測結果:', data);
            
            if (!isDetecting) return;
            
            // 更新計數
            if (data.count !== undefined && data.count > exerciseCounter) {
                exerciseCounter = data.count;
                updateExerciseCount();
                
                // 使用decreaseMonsterHP函數來處理怪物血量減少和擊敗邏輯
                decreaseMonsterHP(data.count);
                
                // 檢查運動完成情況
                if (workoutPlan.length > 0) {
                    checkExerciseCompletion(exerciseCounter);
                }
            }
            
            // 更新質量評分
            if (data.quality !== undefined) {
                updateQualityScore(parseInt(data.quality));
            } else if (data.score !== undefined) {
                updateQualityScore(parseInt(data.score));
            } else if (data.quality_score !== undefined) {
                updateQualityScore(parseInt(data.quality_score));
            }
            
            // 更新教練提示 - 使用角度數據
            if (data.angles) {
                updateCoachTip(data.tip || '', data.angles);
            } else if (data.tip) {
                updateCoachTip(data.tip);
            }
            
            // 更新角度顯示
            if (data.angles) {
                updateAngles(data.angles);
            }
        });
        
        // 添加教練提示事件監聽
        socket.on('coach_tip', function(data) {
            console.log('收到教練提示:', data);
            
            if (coachTipText && data.tip) {
                // 檢查提示是否已包含HTML標籤
                if (data.tip.includes('<div') || data.tip.includes('<i')) {
                    coachTipText.innerHTML = data.tip; // 已經是HTML格式
                } else {
                    // 將純文本轉換為簡單的HTML格式
                    coachTipText.innerHTML = `<div class="tip-item info"><i class="fas fa-info-circle"></i> ${data.tip}</div>`;
                }
            }
        });

        
        // 添加運球模式事件監聽
        socket.on('dribble_mode', function(data) {
            if (data.mode) {
                updateDribbleMode(data.mode);
            }
        });
        
        // 添加模型狀態事件監聽
        socket.on('model_status', function(data) {
            console.log('收到模型狀態:', data);
            
            if (data.loaded) {
                console.log('模型已載入');
            } else {
                console.warn('模型未載入');
                showErrorMessage('模型未載入，請稍後再試');
            }
        });
        
        // 添加除錯事件監聽
        socket.on('debug', function(data) {
            console.log('除錯資訊:', data);
        });
        
        // 監聽錯誤事件
        socket.on('error', function(data) {
            console.error('收到錯誤訊息:', data);
            showErrorMessage(data.message || '發生錯誤，請重試');
        });
        
        // 添加開始檢測回應事件監聽
        socket.on('start_detection_response', function(data) {
            console.log('收到開始檢測回應:', data);
            hasReceivedResponse = true;
            
            if (data.status === 'success') {
                console.log('成功開始檢測');
                showToast('成功開始檢測', 'success');
            } else {
                showErrorMessage('開始檢測失敗: ' + (data.message || '未知錯誤'));
                stopDetection();
            }
        });
        
        // 添加停止檢測回應事件監聽
        socket.on('stop_detection_response', function(data) {
            console.log('收到停止檢測回應:', data);
            
            if (data.status === 'success') {
                console.log('成功停止檢測');
                showToast('已停止檢測', 'info');
            } else {
                showErrorMessage('停止檢測失敗: ' + (data.message || '未知錯誤'));
            }
        });
        
        console.log('Socket事件監聽器設置完成');
        return socket;
    } catch (e) {
        console.error('初始化Socket時出錯:', e);
        showErrorMessage('初始化Socket連接失敗: ' + e.message);
        return null;
    }
}

// 新增函数：重新绑定按钮事件
function rebindButtonEvents() {
    console.log('[rebindButtonEvents] 重新绑定按钮事件');
    
    // 获取按钮元素 - 使用更精确的选择器
    startButton = document.getElementById('start-detection') || 
                 document.getElementById('start-btn') || 
                 document.querySelector('.start-btn') ||
                 document.querySelector('button[data-action="start"]');
    
    stopButton = document.getElementById('stop-detection') || 
                document.getElementById('stop-btn') || 
                document.querySelector('.stop-btn') ||
                document.querySelector('button[data-action="stop"]');
    
    resetButton = document.getElementById('reset-count') || 
                 document.getElementById('reset-btn') || 
                 document.querySelector('.reset-btn');
    
    // 记录找到的按钮元素
    console.log('[rebindButtonEvents] 找到的按钮元素:', {
        startButton: startButton ? `存在 (ID: ${startButton.id})` : '不存在',
        stopButton: stopButton ? `存在 (ID: ${stopButton.id})` : '不存在',
        resetButton: resetButton ? `存在 (ID: ${resetButton.id})` : '不存在'
    });
    
    // 绑定按钮事件
    if (startButton) {
        startButton.addEventListener('click', () => {
            if (!isDetecting) {
                startDetection();
                if (window.monsterAttackSystem) {
                    window.monsterAttackSystem.resume();
                }
            }
        });
        console.log('[rebindButtonEvents] 绑定开始按钮事件');
        // 移除可能存在的旧事件监听器
        startButton.removeEventListener('click', startDetection);
        // 添加新的事件监听器
        startButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('[rebindButtonEvents] 開始按鈕被點擊');
            startDetection();
        });
    } else {
        console.error('[rebindButtonEvents] 找不到開始按鈕元素');
    }
    
    // 停止按鈕事件由 StopDetectionManager 處理
    if (stopButton) {
        console.log('[rebindButtonEvents] 停止按鈕由 StopDetectionManager 管理');
        // 確保 StopDetectionManager 重新綁定停止按鈕
        if (window.stopDetectionManager) {
            window.stopDetectionManager.rebindStopButton();
        }
    } else {
        console.error('[rebindButtonEvents] 找不到停止按鈕元素');
    }
    
    if (resetButton) {
        console.log('[rebindButtonEvents] 绑定重置按钮事件');
        // 移除可能存在的旧事件监听器
        resetButton.removeEventListener('click', resetCount);
        // 添加新的事件监听器
        resetButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('[rebindButtonEvents] 重置按鈕被點擊');
            resetCount();
        });
    } else {
        console.error('[rebindButtonEvents] 找不到重置按鈕元素');
    }
    
    // 初始状态设置
    if (stopButton) {
        stopButton.disabled = true;
        console.log('[rebindButtonEvents] 停止按鈕已禁用');
    }
    if (startButton) {
        startButton.disabled = false;
        console.log('[rebindButtonEvents] 開始按鈕已啟用');
    }
    
    // 確保運動選項正確初始化
    if (typeof window.exerciseOptions !== 'undefined' && window.exerciseOptions.initializeSelectOptions) {
        window.exerciseOptions.initializeSelectOptions();
        console.log('[rebindButtonEvents] 運動選項已重新初始化');
    } else {
        console.warn('[rebindButtonEvents] exerciseOptions 模組未加載');
    }
}

// 修改 sendStartDetectionRequest 函數
function sendStartDetectionRequest() {
    // 確保 Socket 連接已初始化
    if (!socket) {
        socket = initSocketConnection();
    }

    // 再次確認當前運動類型 - **修改點：移除從 DOM 讀取**
    // const exerciseSelectElement = document.getElementById('exercise-select');
    // currentExerciseType = exerciseSelectElement ? exerciseSelectElement.value : 'squat';
    // **確保 currentExerciseType 在調用此函數前已被正確設置**

    // 獲取其他參數
    const studentId = document.getElementById('student-id') ? document.getElementById('student-id').value : '';
    const weight = document.getElementById('weight') ? document.getElementById('weight').value : 0;
    const reps = document.getElementById('reps') ? document.getElementById('reps').value : 10;
    const sets = document.getElementById('sets') ? document.getElementById('sets').value : 3;
    
    // 獲取攝像頭索引
    const cameraIndexElement = document.getElementById('camera-index-input');
    const cameraIndex = cameraIndexElement ? parseInt(cameraIndexElement.value) : 0;
    
    // 準備請求數據
    const requestData = {
        exercise_type: currentExerciseType, // 使用全局變數
        detection_line: detectionLine,
        student_id: studentId,
        weight: weight,
        reps: reps,
        sets: sets,
        current_level: currentLevel || 1,
        monster_hp: monsterHP,
        initial_monster_hp: initialMonsterHP,
        camera_index: cameraIndex,
        client_timestamp: Date.now()
    };
    
    console.log('請求數據:', requestData);

    // 發送請求
    socket.emit('start_detection', requestData);
    console.log('已發送開始檢測請求，運動類型:', currentExerciseType, '關卡:', currentLevel || 1); // 使用全局變數
    
    // 設置超時檢查
    setTimeout(function() {
        if (!hasReceivedResponse) {
            console.log('開始檢測請求等待響應中...');
            console.log('Socket狀態:', socket);
            
        }
    }, 5000);
}


function initMapScroll() {
    const scrollContainer = document.getElementById('map-scroll-container');
    const scrollLeftBtn = document.getElementById('scroll-left-btn');
    const scrollRightBtn = document.getElementById('scroll-right-btn');
    
    if (!scrollContainer || !scrollLeftBtn || !scrollRightBtn) {
        console.error('找不到小地圖滑動元素');
        return;
    }
    
    // 設置滑動按鈕事件
    scrollLeftBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({
            left: -100,
            behavior: 'smooth'
        });
    });
    
    scrollRightBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({
            left: 100,
            behavior: 'smooth'
        });
    });
    
    // 添加觸摸滑動支持
    let startX, scrollLeft;
    let isDragging = false;
    
    scrollContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - scrollContainer.offsetLeft;
        scrollLeft = scrollContainer.scrollLeft;
    });
    
    scrollContainer.addEventListener('touchmove', (e) => {
        if (!startX) return;
        const x = e.touches[0].pageX - scrollContainer.offsetLeft;
        const walk = (x - startX) * 2; // 滑動速度
        scrollContainer.scrollLeft = scrollLeft - walk;
        
        // 如果滑動距離超過5px，標記為拖動
        if (Math.abs(scrollLeft - scrollContainer.scrollLeft) > 5) {
            isDragging = true;
        }
        
        e.preventDefault();
    });
    
    scrollContainer.addEventListener('touchend', () => {
        startX = null;
        // 300ms後重置拖動狀態，允許點擊
        setTimeout(() => {
            isDragging = false;
        }, 300);
    });
    
    // 為小地圖關卡點添加點擊事件
    const mapLevelItems = scrollContainer.querySelectorAll('.map-level-item');
    mapLevelItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            // 如果是拖動，不處理點擊
            if (isDragging) return;
            
            // 設置當前關卡並初始化
            const newLevel = index + 1;
            console.log(`小地圖點擊: 選擇關卡 ${newLevel}`);
            
            // 初始化新關卡
            initLevel(newLevel);
            
            // 阻止事件冒泡
            e.stopPropagation();
        });
    });
    
    // 初始化詳細地圖滑動功能
    initFullMapScroll();
    
    // 高亮當前關卡
    highlightCurrentLevel();
}

// 修改高亮當前關卡函數，確保正確顯示當前關卡
function highlightCurrentLevel() {
    if (currentLevel === null) {
        currentLevel = 1; // 默認設置為第1關
    }
    
    console.log(`高亮當前關卡: ${currentLevel}`);
    
    // 更新小地圖
    const mapLevelDots = document.querySelectorAll('.map-level-dot');
    
    mapLevelDots.forEach((dot, index) => {
        // 移除所有狀態
        dot.classList.remove('completed', 'active');
        
        // 設置狀態
        if (index + 1 < currentLevel) {
            dot.classList.add('completed');
        } else if (index + 1 === currentLevel) {
            dot.classList.add('active');
        }
    });
    
    // 更新詳細地圖
    const fullMapNodes = document.querySelectorAll('.level-node');
    
    fullMapNodes.forEach((node, index) => {
        // 移除所有狀態
        node.classList.remove('completed', 'active');
        
        // 設置狀態
        if (index + 1 < currentLevel) {
            node.classList.add('completed');
        } else if (index + 1 === currentLevel) {
            node.classList.add('active');
        }
    });
}

// 初始化詳細地圖滑動功能
function initFullMapScroll() {
    const fullMapContainer = document.getElementById('full-map-scroll-container');
    const fullScrollLeftBtn = document.getElementById('full-scroll-left-btn');
    const fullScrollRightBtn = document.getElementById('full-scroll-right-btn');
    
    if (!fullMapContainer || !fullScrollLeftBtn || !fullScrollRightBtn) {
        console.error('找不到詳細地圖滑動元素');
        return;
    }
    
    // 設置滑動按鈕事件
    fullScrollLeftBtn.addEventListener('click', () => {
        fullMapContainer.scrollBy({
            left: -200,
            behavior: 'smooth'
        });
    });
    
    fullScrollRightBtn.addEventListener('click', () => {
        fullMapContainer.scrollBy({
            left: 200,
            behavior: 'smooth'
        });
    });
    
    // 添加觸摸滑動支持
    let startX, scrollLeft;
    let isDragging = false;
    
    fullMapContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - fullMapContainer.offsetLeft;
        scrollLeft = fullMapContainer.scrollLeft;
    });
    
    fullMapContainer.addEventListener('touchmove', (e) => {
        if (!startX) return;
        const x = e.touches[0].pageX - fullMapContainer.offsetLeft;
        const walk = (x - startX) * 2; // 滑動速度
        fullMapContainer.scrollLeft = scrollLeft - walk;
        
        // 如果滑動距離超過5px，標記為拖動
        if (Math.abs(scrollLeft - fullMapContainer.scrollLeft) > 5) {
            isDragging = true;
        }
        
        e.preventDefault();
    });
    
    fullMapContainer.addEventListener('touchend', () => {
        startX = null;
        // 300ms後重置拖動狀態，允許點擊
        setTimeout(() => {
            isDragging = false;
        }, 300);
    });
    
    // 為詳細地圖關卡點添加點擊事件
    const fullMapLevelItems = fullMapContainer.querySelectorAll('.full-map-level-item');
    fullMapLevelItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            // 如果是拖動，不處理點擊
            if (isDragging) return;
            
            // 設置當前關卡並初始化
            const newLevel = index + 1;
            console.log(`詳細地圖點擊: 選擇關卡 ${newLevel}`);
            
            // 初始化新關卡
            initLevel(newLevel);
            
            // 關閉模態視窗
            const mapModal = document.getElementById('map-modal');
            if (mapModal) {
                mapModal.classList.remove('active');
            }
            
            // 阻止事件冒泡
            e.stopPropagation();
        });
    });
    
    // 初始滾動到當前關卡
    setTimeout(() => {
        const activeNode = fullMapContainer.querySelector('.level-node.active');
        if (activeNode) {
            const parentItem = activeNode.closest('.full-map-level-item');
            if (parentItem) {
                const scrollPosition = parentItem.offsetLeft - (fullMapContainer.clientWidth / 2) + (parentItem.clientWidth / 2);
                fullMapContainer.scrollTo({
                    left: scrollPosition,
                    behavior: 'smooth'
                });
            }
        }
    }, 300);
}



// 設置地圖模態視窗事件
function setupMapModal() {
    const mapModal = document.getElementById('map-modal');
    const showMapBtn = document.getElementById('show-map-btn');
    const closeMapBtn = document.getElementById('close-map-btn');
    const closeMapModalBtn = document.getElementById('close-map-modal');
    const startLevelBtn = document.getElementById('start-level-btn');
    
    if (!mapModal || !showMapBtn || !closeMapBtn || !closeMapModalBtn || !startLevelBtn) {
        console.error('找不到地圖模態視窗元素');
        return;
    }
    
    showMapBtn.addEventListener('click', () => {
        mapModal.classList.add('active');
        // 初始滾動到當前關卡
        const fullMapContainer = document.getElementById('full-map-scroll-container');
        if (fullMapContainer) {
            const activeNode = fullMapContainer.querySelector('.level-node.active');
            if (activeNode) {
                const parentItem = activeNode.closest('.full-map-level-item');
                if (parentItem) {
                    const scrollPosition = parentItem.offsetLeft - (fullMapContainer.clientWidth / 2) + (parentItem.clientWidth / 2);
                    fullMapContainer.scrollTo({
                        left: scrollPosition,
                        behavior: 'smooth'
                    });
                }
            }
        }
    });
    
    closeMapBtn.addEventListener('click', () => {
        mapModal.classList.remove('active');
    });
    
    closeMapModalBtn.addEventListener('click', () => {
        mapModal.classList.remove('active');
    });
    
    startLevelBtn.addEventListener('click', () => {
        // 獲取當前選中的關卡
        const activeNode = document.querySelector('.full-map-levels .level-node.active');
        if (activeNode) {
            const levelIndex = Array.from(document.querySelectorAll('.full-map-levels .level-node')).indexOf(activeNode) + 1;
            if (levelIndex > 0) {
                console.log(`開始挑戰按鈕點擊: 選擇關卡 ${levelIndex}`);
                
                // 初始化選中的關卡
                initLevel(levelIndex);
                
                // 關閉模態視窗
                mapModal.classList.remove('active');
                
                // 停止當前偵測（如果有）
                if (isDetecting) {
                    stopDetection();
                }
                
                // 延遲一段時間後自動開始偵測
                setTimeout(() => {
                    startDetection();
                }, 1000);
            }
        }
    });
}


// 顯示關卡開始提示
function showLevelStartNotification(levelIndex) {
    // 獲取關卡名稱
    const levelNames = ['森林入口', '山脈地帶', '神秘湖泊', '古老洞窟', '龍之巢穴'];
    const levelName = levelNames[levelIndex - 1] || `第 ${levelIndex} 關`;
    
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = 'level-start-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fas fa-play-circle"></i>
            </div>
            <div class="notification-text">
                <h3>開始挑戰</h3>
                <p>${levelName}</p>
            </div>
        </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 顯示動畫
    setTimeout(() => {
        notification.classList.add('show');
        
        // 3秒後移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }, 100);
}

// 更新關卡顯示
function updateLevelDisplay(level) {
    // 更新關卡標題
    const levelTitle = document.querySelector('.level-title');
    if (levelTitle) {
        levelTitle.textContent = `關卡 ${level}`;
    }
    
    // 更新怪物計數顯示
    const monsterCount = document.getElementById('monster-count');
    if (monsterCount) {
        monsterCount.textContent = `關卡 ${level} 怪物`;
    }
    
    // 更新關卡描述
    const levelDesc = document.querySelector('.level-description');
    if (levelDesc) {
        // 根據關卡設置不同的描述
        switch(level) {
            case 1:
                levelDesc.textContent = '森林入口 - 初始關卡，適合新手挑戰';
                break;
            case 2:
                levelDesc.textContent = '山脈地帶 - 中級難度，需要更多力量';
                break;
            case 3:
                levelDesc.textContent = '神秘湖泊 - 需要耐力與平衡';
                break;
            case 4:
                levelDesc.textContent = '古老洞窟 - 高難度，需要全面技能';
                break;
            case 5:
                levelDesc.textContent = '龍之巢穴 - 最終挑戰，考驗極限';
                break;
            default:
                levelDesc.textContent = `第 ${level} 關 - 挑戰更高難度`;
        }
    }
}



// 新增函數：發送關卡完成請求到伺服器
function updateLevelCompletion(levelId, expReward) {
    console.log(`發送關卡完成請求: 關卡 ${levelId}, 經驗值 ${expReward}`);
    
    // 獲取用戶ID (從頁面元素或使用默認值)
    const userId = document.getElementById('student-id') ? 
                  document.getElementById('student-id').value : 'C111151146';
    
    console.log(`用戶ID: ${userId}, 關卡ID: ${levelId}, 經驗值: ${expReward}, 運動類型: ${currentExerciseType}, 運動計數: ${exerciseCounter}`);
    
    // 發送請求到伺服器
    fetch('/api/game/complete_level', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            level_id: levelId,
            exp_reward: expReward,
            exercise_type: currentExerciseType || 'squat',
            exercise_count: exerciseCounter || 0
        })
    })
    .then(response => {
        console.log(`API響應狀態: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('關卡完成API響應數據:', data);
        if (data.success) {
            console.log('關卡完成數據已保存:', data);
            
            // 顯示成功訊息
            showNotification(`關卡 ${levelId} 完成！獲得 ${expReward} 經驗值`, 'success');
            
            // 如果有新解鎖的成就，顯示成就通知
            if (data.new_achievements && data.new_achievements.length > 0) {
                data.new_achievements.forEach(achievement => {
                    showAchievementNotification(achievement.name, achievement.description);
                });
            }
        } else {
            console.error('關卡完成數據保存失敗:', data.message);
            showNotification(`關卡數據保存失敗: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('關卡完成請求錯誤:', error);
        showNotification(`關卡完成請求錯誤: ${error.message}`, 'error');
        
        // 嘗試重新發送請求
        setTimeout(() => {
            console.log('嘗試重新發送關卡完成請求...');
            retryLevelCompletion(userId, levelId, expReward);
        }, 2000);
    });
}


// 添加重試函數
function retryLevelCompletion(userId, levelId, expReward) {
    console.log(`重試發送關卡完成數據: 用戶 ${userId}, 關卡 ${levelId}, 經驗值 ${expReward}`);
    
    // 獲取用戶設定的重量和組數
    const weight = document.getElementById('weight') ? 
                  parseInt(document.getElementById('weight').value) || 0 : 0;

    const reps = document.getElementById('reps') ? 
                parseInt(document.getElementById('reps').value) || 10 : 10;

    const sets = document.getElementById('sets') ? 
               parseInt(document.getElementById('sets').value) || 3 : 3;
    
    // 計算已完成的組數
    const completedSets = remainingSets !== undefined ? (sets - remainingSets) : 0;
    
    // 發送請求到後端
    fetch('/api/game/complete_level', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            level_id: levelId,
            exp_reward: expReward,
            exercise_type: currentExerciseType || 'squat',
            exercise_count: exerciseCounter || 0,
            shield_value: initialMonsterShield,
            shield_weight: shieldWeightFactor,
            weight: weight,
            reps: reps,
            sets: sets,
            completed_sets: completedSets
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('重試成功: 關卡完成數據已保存');
            showNotification('關卡數據已成功保存', 'success');
        } else {
            console.error('重試失敗: 關卡完成數據保存失敗');
            showNotification('關卡數據保存失敗，請稍後再試', 'error');
        }
    })
    .catch(error => {
        console.error('重試發送關卡完成請求時出錯:', error);
    });
}



// 顯示通知訊息
function showNotification(message, type = 'info') {
    console.log(`顯示通知: ${message} (類型: ${type})`);
    
    // 檢查是否已存在通知容器
    let notificationContainer = document.querySelector('.notification-container');
    
    // 如果不存在，則創建一個
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }
    
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 設置樣式
    notification.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                        type === 'error' ? '#f44336' : 
                                        type === 'warning' ? '#ff9800' : '#2196F3';
    notification.style.color = 'white';
    notification.style.padding = '15px 20px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s, transform 0.3s';
    notification.style.transform = 'translateX(50px)';
    
    // 添加到容器
    notificationContainer.appendChild(notification);
    
    // 淡入通知
    setTimeout(function() {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // 5秒後淡出通知
    setTimeout(function() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(50px)';
        
        // 移除通知
        setTimeout(function() {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}



function initGameUI() {
    console.log('初始化遊戲UI');
    
    // 獲取關卡顯示元素
    const levelDisplay = document.getElementById('current-level');
    if (levelDisplay) {
        // 如果已設置當前關卡，則顯示
        if (currentLevel) {
            levelDisplay.textContent = currentLevel;
        } else {
            // 否則設置為第一關
            currentLevel = 1;
            levelDisplay.textContent = '1';
        }
    } else {
        console.error('找不到關卡顯示元素');
    }
    
    // 創建怪物血量條
    createMonsterHPBar();
    
    // 創建怪物護盾條
    createMonsterShieldBar();
    
    // 初始化護盾控件
    initShieldControls();
    
    // 更新怪物血量和護盾顯示
    updateMonsterHP(monsterHP);
    updateMonsterShield(monsterShield);
    
    // 更新剩餘組數顯示
    updateRemainingSetsDisplay();
    
    console.log('遊戲UI初始化完成');
}


function resetMonster() {
    console.log('重置怪物');
    
    // 重置怪物血量
    monsterHP = initialMonsterHP;
    
    // 重置怪物護盾
    monsterShield = initialMonsterShield;
    
    // 更新顯示
    updateMonsterHP(monsterHP);
    updateMonsterShield(monsterShield);
    
    // 重置運動計數器
    exerciseCounter = 0;
    decreaseMonsterHP.lastCount = 0;
    
    // 更新運動計數顯示
    updateExerciseCount(0);
    
    // 重置剩餘組數
    const setsInput = document.getElementById('sets');
    if (setsInput) {
        remainingSets = parseInt(setsInput.value) || 3;
    } else {
        remainingSets = 3;
    }
    
    // 更新剩餘組數顯示
    updateRemainingSetsDisplay();
    
    // 顯示重置訊息
    showNotification('怪物已重置', 'info');
    
    // 顯示怪物對話
    showMonsterDialogue('我恢復了力量，再來挑戰吧！');
}


// 顯示提示訊息
function showToast(message, type = 'info') {
    // 檢查是否已存在 toast 元素
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        // 創建 toast 元素
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    
    // 設置 toast 類型和訊息
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    toast.style.display = 'block';
    
    // 顯示 toast 並設置自動隱藏
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}



// 添加缺失的 updateUIForDetectionStart 函数
function updateUIForDetectionStart() {
    // 更新檢測狀態顯示
    const detectionStatus = document.getElementById('detection-status');
    if (detectionStatus) {
        detectionStatus.textContent = '檢測中';
        detectionStatus.classList.add('active');
    }

    // 確保函數存在再調用
    if (typeof updateWorkoutPlanProgress === 'function') {
        updateWorkoutPlanProgress();
    } else {
        console.warn('updateWorkoutPlanProgress 函數未定義');
    }
    
    // 更新當前運動名稱顯示
    const currentExerciseName = document.getElementById('current-exercise-name');
    if (currentExerciseName) {
        let exerciseName = '深蹲';
        switch (currentExerciseType) {
            case 'squat': exerciseName = '深蹲'; break;
            case 'bicep-curl': exerciseName = '二頭彎舉'; break;
            case 'shoulder-press': exerciseName = '肩推'; break;
            case 'push-up': exerciseName = '伏地挺身'; break;
            case 'pull-up': exerciseName = '引體向上'; break;
            case 'dumbbell-row': exerciseName = '啞鈴划船'; break;
            case 'table-tennis': exerciseName = '桌球揮拍'; break;
            case 'basketball': exerciseName = '籃球投籃'; break;
            case 'basketball-dribble': exerciseName = '籃球運球'; break;
            case 'volleyball-overhand': exerciseName = '排球高手攻擊'; break;
            case 'volleyball-lowhand': exerciseName = '排球低手接球'; break;
            default: exerciseName = '深蹲';
        }
        currentExerciseName.textContent = exerciseName;
    }
    
    // 更新其他UI元素
    if (coachTipText) {
        if (currentExerciseType === 'table-tennis') {
            coachTipText.textContent = '桌球揮拍模式：請站在攝像頭前，系統將偵測您的揮拍動作。首先需要確定您的慣用手，請將手放入畫面中的圓圈內。';
        } else if (currentExerciseType === 'basketball') {
            coachTipText.textContent = '籃球投籃模式：請站在攝像頭前，系統將偵測您的投籃動作。';
        } else if (currentExerciseType === 'basketball-dribble') {
            coachTipText.textContent = '籃球運球模式：請站在攝像頭前，系統將偵測您的運球動作。系統會自動切換高位和低位運球模式，請跟隨指示進行練習。';
        } else if (currentExerciseType === 'volleyball-overhand') {
            coachTipText.textContent = '排球高手攻擊模式：請站在攝像頭前，保持手腕高於頭部位置進行攻擊動作。';
        } else if (currentExerciseType === 'volleyball-lowhand') {
            coachTipText.textContent = '排球低手接球模式：請站在攝像頭前，保持雙手在腰部以下位置準備接球。';
        } else {
            updateCoachTip('');
        }
    }
    
    // 更新訓練計劃進度顯示
    updateWorkoutPlanProgress();
    
    // 更新按鈕狀態
    if (startButton) {
        startButton.disabled = true;
        console.log('[updateUIForDetectionStart] 開始按鈕已禁用');
    }
    
    // 使用 StopDetectionManager 啟用停止按鈕
    if (window.stopDetectionManager) {
        window.stopDetectionManager.updateButtonState(true);
        console.log('[updateUIForDetectionStart] 停止按鈕已通過 StopDetectionManager 啟用');
    } else {
        console.error('[updateUIForDetectionStart] StopDetectionManager 未找到');
    }
    
    // 重置並啟動怪物攻擊系統（修復運動切換時立即攻擊的bug）
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
        try {
            window.monsterAttackSystem.reset();
            // 重置後需要恢復系統
            setTimeout(() => {
                if (window.monsterAttackSystem && typeof window.monsterAttackSystem.resume === 'function') {
                    window.monsterAttackSystem.resume();
                }
            }, 100);
            console.log('[updateUIForDetectionStart] 怪物攻擊系統已重置並啟動');
        } catch (resetError) {
            console.error('[updateUIForDetectionStart] 重置怪物攻擊系統失敗:', resetError);
        }
    }
}

// 添加對應的 updateUIForDetectionStop 函數
function updateUIForDetectionStop() {
    // 更新檢測狀態顯示
    const detectionStatus = document.getElementById('detection-status');
    if (detectionStatus) {
        detectionStatus.textContent = '未檢測';
        detectionStatus.classList.remove('active');
    }
    
    // 更新按鈕狀態
    if (startButton) {
        startButton.disabled = false;
        console.log('[updateUIForDetectionStop] 開始按鈕已啟用');
    }
    
    // 使用 StopDetectionManager 禁用停止按鈕
    if (window.stopDetectionManager) {
        window.stopDetectionManager.updateButtonState(false);
        console.log('[updateUIForDetectionStop] 停止按鈕已通過 StopDetectionManager 禁用');
    } else {
        console.error('[updateUIForDetectionStop] StopDetectionManager 未找到');
    }
}


// 調整影片顯示函數
function adjustVideoDisplay() {
    if (videoFeed) {
        // 獲取影片容器
        const videoContainer = videoFeed.closest('.video-container') || videoFeed.parentElement;
        
        // 移除任何可能的內聯樣式
        videoFeed.removeAttribute('style');
        
        // 設置基本顯示屬性
        videoFeed.style.display = 'block';
        
        // 設置影片尺寸 - 使用絕對定位填滿容器
        videoFeed.style.position = 'absolute';
        videoFeed.style.top = '0';
        videoFeed.style.left = '0';
        videoFeed.style.width = '100%';
        videoFeed.style.height = '100%';
        videoFeed.style.objectFit = 'contain'; // 使用 contain 確保完整顯示所有內容
        
        // 確保容器有適當的樣式
        if (videoContainer) {
            videoContainer.style.position = 'relative';
            videoContainer.style.overflow = 'hidden';
            videoContainer.style.aspectRatio = '4/3'; // 調整為 4:3 比例，更適合人體姿勢檢測
            videoContainer.style.maxHeight = '75vh'; // 限制最大高度
            videoContainer.style.backgroundColor = '#000'; // 設置背景色
        }
        //console.log('影片顯示已調整為完整顯示模式');
    }
}

function bindEventListeners() {
    // ... (startButton, stopButton, resetButton 的事件綁定) ...

    // 運動類型選擇事件
    if (exerciseSelect) {
        exerciseSelect.addEventListener('change', handleExerciseChange);
        console.log('綁定運動類型選擇事件');
    } else {
        console.error('找不到運動類型選擇元素，無法綁定事件');
    }

    // 綁定新的切換動作按鈕事件 <--- 新增
    if (switchExerciseButton) {
        switchExerciseButton.addEventListener('click', handleSwitchExercise);
        console.log('綁定切換動作按鈕事件');
    } else {
        console.error('找不到切換動作按鈕元素，無法綁定事件');
    }

    // ... (其他事件綁定) ...
}



// 處理運動類型變更事件 (原始下拉選單)
function handleExerciseChange() {
    const selectedExercise = exerciseSelect.value;
    console.log(`運動類型已更改為: ${selectedExercise}`);
    currentExerciseType = selectedExercise;

    // 更新UI顯示
    const exerciseNameDisplay = document.getElementById('current-exercise-name');
    if (exerciseNameDisplay) {
        const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
        exerciseNameDisplay.textContent = selectedOption ? selectedOption.text : selectedExercise;
    }

    // 更新教練提示
    updateCoachTip(`已選擇 ${exerciseNameDisplay ? exerciseNameDisplay.textContent : selectedExercise}。`, {});

    // 根據選擇的運動類型顯示/隱藏特定控件
    toggleExerciseSpecificControls(selectedExercise);

    // !! 注意：這裡可能包含或觸發重置邏輯 !!
    // ... (existing comments) ...

    // 停止當前偵測 (如果正在進行) - 下拉選單的行為保持不變，僅停止
    if (isDetecting) {
        stopDetection();
        showToast('運動類型已更改，請重新開始偵測');
    }
}




// 新增：檢查動作連擊
function checkExerciseCombo(history) {
    // 示例連擊規則 (你需要根據你的設計來定義)
    if (history.length >= 2) {
        const lastTwo = history.slice(-2);
        if (lastTwo[0] === 'squat' && lastTwo[1] === 'shoulder-press') {
            return 1.5; // 深蹲接肩推，1.5倍傷害
        }
        if (lastTwo[0] === 'bicep-curl' && lastTwo[1] === 'bicep-curl') {
             return 1.2; // 連續二頭彎舉，1.2倍傷害
        }
    }
    if (history.length >= 3) {
        const lastThree = history.slice(-3);
         if (lastThree[0] === 'push-up' && lastThree[1] === 'squat' && lastThree[2] === 'pull-up') {
             return 2.0; // 特定順序大連招，2倍傷害
         }
    }
    return 1.0; // 沒有觸發連擊
}



// 新增：觸發連擊視覺效果 (示例)
function triggerComboEffect() {
    const monsterContainer = document.getElementById('monster-container');
    if (monsterContainer) {
        monsterContainer.classList.add('combo-flash');
        setTimeout(() => {
            monsterContainer.classList.remove('combo-flash');
        }, 300); // 閃爍 300 毫秒
    }
    // 這裡還可以添加聲音效果或更複雜的 Three.js 特效
}

// 新增：處理切換動作按鈕點擊事件 (不重置狀態)
function handleSwitchExercise() {
    console.log('[handleSwitchExercise] 按鈕點擊 - 使用優化版本');
    if (!exerciseSelect) {
        console.error('[handleSwitchExercise] 找不到運動選擇器');
        return;
    }
    
    const selectedExercise = exerciseSelect.value;
    const wasDetecting = isDetecting;
    console.log(`[handleSwitchExercise] 準備切換動作到: ${selectedExercise}, 當前偵測狀態: ${wasDetecting}`);
    
    // 重置 decreaseMonsterHP.lastCount，確保切換動作後能立即造成傷害
    decreaseMonsterHP.lastCount = 0;

    // 1. 更新當前運動類型
    currentExerciseType = selectedExercise;
    console.log(`[handleSwitchExercise] 全局 currentExerciseType 已更新為: ${currentExerciseType}`);

    // 2. 更新UI顯示
    const exerciseNameDisplay = document.getElementById('current-exercise-name');
    if (exerciseNameDisplay) {
        const selectedOption = exerciseSelect.options[exerciseSelect.selectedIndex];
        exerciseNameDisplay.textContent = selectedOption ? selectedOption.text : selectedExercise;
    }

    // 3. 更新教練提示區域
    updateCoachTip(`已切換到 ${exerciseNameDisplay ? exerciseNameDisplay.textContent : selectedExercise}。`, {});

    // 4. 根據選擇的運動類型顯示/隱藏特定控件
    toggleExerciseSpecificControls(selectedExercise);
    
    // 重置Combo系統
    resetCombo();
    console.log('[handleSwitchExercise] 已重置Combo系統');
    
    // 重置攻擊音效combo系統
    if (window.attackComboSystem) {
        try {
            window.attackComboSystem.resetCombo();
            console.log('[handleSwitchExercise] 已重置攻擊音效combo系統');
        } catch (comboError) {
            console.error('[handleSwitchExercise] 重置攻擊音效combo系統失敗:', comboError);
        }
    }
    
    // 重置怪物攻擊系統
    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
        try {
            window.monsterAttackSystem.reset();
            console.log('[handleSwitchExercise] 已重置怪物攻擊系統');
        } catch (resetError) {
            console.error('[handleSwitchExercise] 重置怪物攻擊系統失敗:', resetError);
        }
    }

    // 5. 使用快速切換 API（如果正在偵測）
    if (wasDetecting) {
        console.log('[handleSwitchExercise] 偵測進行中，使用快速切換 API');
        
        if (!socket) {
            console.error('[handleSwitchExercise] Socket 未連接，回退到傳統切換方式');
            // 回退到原來的方式
            stopDetection();
            setTimeout(() => startDetection(), 100);
            return;
        }
        
        // 使用新的快速切換 API
        socket.emit('switch_exercise_fast', {
            exercise_type: selectedExercise,
            detection_line: 0.5,
            reset_detection_line: false
        });
        
        console.log('[handleSwitchExercise] 已發送快速切換請求');
        showToast(`正在快速切換到 ${exerciseNameDisplay ? exerciseNameDisplay.textContent : selectedExercise}...`);
        
    } else {
        // 如果之前未偵測，僅提示用戶
        console.log('[handleSwitchExercise] 偵測未進行，僅切換運動模式');
        showToast(`已切換到 ${exerciseNameDisplay ? exerciseNameDisplay.textContent : selectedExercise}`);
    }
    
    console.log('[handleSwitchExercise] 函數執行完畢');
}

// 添加快速切換響應監聽器
function setupFastSwitchListener() {
    if (!socket) {
        console.warn('Socket未初始化，無法設置快速切換監聽器');
        return;
    }
    
    socket.on('switch_exercise_response', function(data) {
        console.log('[switch_exercise_response] 收到快速切換響應:', data);
        
        if (data.status === 'success') {
            showToast(`已成功切換到 ${data.exercise_type}`);
            console.log(`[switch_exercise_response] 切換成功: ${data.message}`);
        } else {
            showToast(`切換失敗: ${data.message}`, 'error');
            console.error('[switch_exercise_response] 切換失敗:', data.message);
            
            // 如果快速切換失敗，回退到傳統方式
            console.log('[switch_exercise_response] 回退到傳統切換方式');
            stopDetection();
            setTimeout(() => startDetection(), 100);
        }
    });
}


// 全局變量聲明
let shieldWeightFactor = 0;
let currentDribbleMode = 'low';
let workoutPlanSent = false;

// 攻擊特效管理器將由main-app.js初始化並設為全局變量

// 監聽訓練計劃保存結果
function setupWorkoutPlanListener() {
    if (!socket) {
        console.warn('Socket未初始化，無法設置訓練計劃監聽器');
        return;
    }
    
    socket.on('workout_plan_saved', function(data) {
        console.log('[workout_plan_saved] 收到訓練計劃保存結果:', data);
        
        if (data.status === 'success') {
            showNotification('訓練計劃已成功保存到資料庫', 'success');
            console.log(`[workout_plan_saved] 記錄ID: ${data.record_id}`);
        } else {
            showNotification(`保存失敗: ${data.message}`, 'error');
            console.error('[workout_plan_saved] 保存失敗:', data.message);
        }
    });
}


function onWorkoutPlanCompleted() {
    // 檢查是否有當前任務
    if (window.questHandler && typeof window.questHandler.getCurrentQuest === 'function') {
        const currentQuest = window.questHandler.getCurrentQuest();
        if (currentQuest) {
            // 觸發任務完成事件
            const questCompletedEvent = new CustomEvent('questCompleted', {
                detail: {
                    questId: currentQuest.questId,
                    completedAt: new Date().toISOString()
                }
            });
            document.dispatchEvent(questCompletedEvent);
        }
    }
    
    // 原有的完成邏輯
    showToast('訓練計劃已完成！');
}

// 怪物攻擊系統初始化
let monsterAttackSystem = null;

// 在 DOMContentLoaded 事件中初始化怪物攻擊系統
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 動態引入怪物攻擊系統模組
        const module = await import('./modules/monster-attack-system.js');
        const MonsterAttackSystem = module.MonsterAttackSystem || module.default;
        
        // 初始化怪物攻擊系統
        monsterAttackSystem = new MonsterAttackSystem({
            // 玩家初始狀態
            playerMaxHp: 150,
            playerMaxShield: 50,
            
            // 怪物攻擊設定
            attackInterval: 15000, // 15秒攻擊一次
            attackDamage: 25,       // 每次攻擊25點傷害
            warningTime: 8000,      // 8秒警告時間
            
            // 防禦系統設定
            defenseAction: 'squat',     // 深蹲防禦
            defenseTime: 2000,          // 需要維持2秒
            shieldRecoveryRate: 10,     // 每次成功防禦恢復10點護盾
            
            // 事件回調
            onPlayerDeath: () => {
                console.log('玩家死亡，停止所有檢測');
                if (isDetecting) {
                    stopDetection();
                }
            },
            
            onDefenseSuccess: () => {
                console.log('防禦成功！');
                showToast('防禦成功！護盾已恢復', 'success');
            },
            
            onDefenseFailed: () => {
                console.log('防禦失敗！');
                showToast('防禦失敗！受到傷害', 'error');
            },
            
            onShieldActivated: () => {
                console.log('護盾激活！');
                showToast('護盾激活！', 'info');
            }
        });
        
        // 初始化系統
        monsterAttackSystem.init();
        
        // 將系統設為全局變量以便其他模組使用
        window.monsterAttackSystem = monsterAttackSystem;
        
        console.log('怪物攻擊系統初始化並啟動成功');
        
        // 立即整合運動檢測系統
        integrateWithExerciseDetection();
        
    } catch (error) {
        console.error('怪物攻擊系統初始化失敗:', error);
    }
});

// 與現有運動檢測系統整合
function integrateWithExerciseDetection() {
    if (!monsterAttackSystem) {
        console.warn('怪物攻擊系統未初始化');
        return;
    }
    
    // 監聽運動檢測事件，更新防禦狀態
    document.addEventListener('exerciseDetected', function(event) {
        const { exerciseType, quality } = event.detail;
        
        // 如果檢測到深蹲且品質良好，更新防禦進度
        if (exerciseType === 'squat' && quality >= 3) {
            monsterAttackSystem.updateDefenseProgress(true);
        } else {
            monsterAttackSystem.updateDefenseProgress(false);
        }
    });
    
    // 監聽運動開始/停止事件
    document.addEventListener('detectionStarted', function() {
        if (monsterAttackSystem) {
            monsterAttackSystem.resume();
            console.log('檢測開始，怪物攻擊系統恢復');
        }
    });
    
    document.addEventListener('detectionStopped', function() {
        if (monsterAttackSystem) {
            monsterAttackSystem.pause();
            console.log('檢測停止，怪物攻擊系統暫停');
        }
    });
}

// 整合已在怪物攻擊系統初始化時完成

// 持續抵擋模式初始化
let continuousDefenseMode = null;

// 在 DOMContentLoaded 事件中初始化持續抵擋模式
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 等待一下確保其他系統已初始化
        setTimeout(async () => {
            // 初始化持續抵擋模式
            if (typeof ContinuousDefenseMode !== 'undefined') {
                continuousDefenseMode = new ContinuousDefenseMode({
                    targetTime: 30,
                    monsterAttackInterval: 2000,
                    monsterDamage: 15,
                    shieldRepairRate: 10,
                    shieldRepairInterval: 3000,
                    maxShield: 100,
                    maxHP: 100,
                    
                    // 事件回調
                    onModeStart: () => {
                        console.log('持續抵擋模式開始');
                        showToast('持續抵擋模式開始！保持雙手輪流擺動來維持護盾！', 'info');
                        
                        // 自動切換到雙手輪流擺動運動
                        const exerciseSelect = document.getElementById('exercise-type');
                        if (exerciseSelect) {
                            exerciseSelect.value = 'alternating-arm-swing';
                            handleSwitchExercise();
                        }
                    },
                    
                    onModeEnd: () => {
                        console.log('持續抵擋模式結束');
                        showToast('持續抵擋模式結束', 'info');
                    },
                    
                    onPlayerDamaged: (damage, currentHP) => {
                        console.log(`玩家受到 ${damage} 點傷害，剩餘血量: ${currentHP}`);
                        showToast(`受到 ${damage} 點傷害！`, 'error');
                        
                        // 觸發視覺效果
                        triggerDamageEffect();
                    },
                    
                    onShieldRepaired: (repairAmount, currentShield) => {
                        console.log(`護盾修復 ${repairAmount} 點，當前護盾: ${currentShield}`);
                        showToast(`護盾修復 +${repairAmount}`, 'success');
                        
                        // 觸發修復效果
                        triggerShieldRepairEffect();
                    },
                    
                    onVictory: (stats) => {
                        console.log('持續抵擋模式勝利！', stats);
                        showToast('恭喜！你成功抵擋了怪物的攻擊！', 'success');
                        
                        // 觸發勝利效果
                        triggerVictoryEffect();
                    },
                    
                    onDefeat: (stats) => {
                        console.log('持續抵擋模式失敗', stats);
                        showToast('你被怪物擊敗了，再試一次吧！', 'error');
                        
                        // 觸發失敗效果
                        triggerDefeatEffect();
                    }
                });
                
                // 將模式設為全局變量
                window.continuousDefenseMode = continuousDefenseMode;
                
                console.log('持續抵擋模式初始化成功');
                
                // 整合運動檢測系統
                integrateContinuousDefenseWithExercise();
                
            } else {
                console.error('ContinuousDefenseMode 類別未找到');
            }
        }, 1000);
        
    } catch (error) {
        console.error('持續抵擋模式初始化失敗:', error);
    }
});

// 與運動檢測系統整合
function integrateContinuousDefenseWithExercise() {
    if (!continuousDefenseMode) {
        console.warn('持續抵擋模式未初始化');
        return;
    }
    
    // 監聽運動檢測事件
    document.addEventListener('exerciseDetected', function(event) {
        const { exerciseType, quality, isCorrect } = event.detail;
        
        // 只處理雙手輪流擺動熱身運動
        if (exerciseType === 'alternating-arm-swing') {
            continuousDefenseMode.handleExerciseDetection({
                type: exerciseType,
                quality: quality,
                isCorrect: isCorrect
            });
        }
    });
    
    // 監聽 Socket 事件以獲取運動數據
    if (socket) {
        socket.on('alternating_arm_swing_result', function(data) {
            if (continuousDefenseMode && continuousDefenseMode.gameState.isActive) {
                continuousDefenseMode.handleExerciseDetection({
                    type: 'alternating-arm-swing',
                    quality: data.quality_score || 5,
                    isCorrect: data.is_correct_motion || false
                });
            }
        });
        
        socket.on('plank_result', function(data) {
            console.log('收到平板支撐結果數據:', data);
            // 可以在這裡處理平板支撐的結果數據
            // 例如更新UI或觸發特定的遊戲邏輯
        });
    }
    
    console.log('持續抵擋模式與運動檢測系統整合完成');
}

// 視覺效果函數
function triggerDamageEffect() {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.classList.add('damage-flash');
        setTimeout(() => {
            videoContainer.classList.remove('damage-flash');
        }, 500);
    }
}

function triggerShieldRepairEffect() {
    // 創建護盾修復粒子效果
    const effect = document.createElement('div');
    effect.className = 'shield-repair-particles';
    effect.innerHTML = '✨';
    effect.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2em;
        color: #4ecdc4;
        z-index: 9999;
        pointer-events: none;
        animation: repairParticles 1.5s ease-out forwards;
    `;
    
    document.body.appendChild(effect);
    
    setTimeout(() => {
        if (effect.parentNode) {
            effect.parentNode.removeChild(effect);
        }
    }, 1500);
}

function triggerVictoryEffect() {
    // 創建勝利煙花效果
    const colors = ['#4ecdc4', '#44a08d', '#96ceb4', '#feca57'];
    
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.innerHTML = '🎉';
            firework.style.cssText = `
                position: fixed;
                top: ${Math.random() * 50 + 20}%;
                left: ${Math.random() * 80 + 10}%;
                font-size: ${Math.random() * 2 + 1}em;
                z-index: 9999;
                pointer-events: none;
                animation: victoryFirework 2s ease-out forwards;
            `;
            
            document.body.appendChild(firework);
            
            setTimeout(() => {
                if (firework.parentNode) {
                    firework.parentNode.removeChild(firework);
                }
            }, 2000);
        }, i * 200);
    }
}

function triggerDefeatEffect() {
    // 創建失敗效果
    const effect = document.createElement('div');
    effect.innerHTML = '💀';
    effect.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 4em;
        z-index: 9999;
        pointer-events: none;
        animation: defeatEffect 2s ease-out forwards;
    `;
    
    document.body.appendChild(effect);
    
    setTimeout(() => {
        if (effect.parentNode) {
            effect.parentNode.removeChild(effect);
        }
    }, 2000);
}

// 添加 CSS 動畫樣式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes repairParticles {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }
        50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8) translateY(-50px);
        }
    }
    
    @keyframes victoryFirework {
        0% {
            opacity: 1;
            transform: scale(0.5);
        }
        50% {
            transform: scale(1.2);
        }
        100% {
            opacity: 0;
            transform: scale(0.8) translateY(-100px);
        }
    }
    
    @keyframes defeatEffect {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
        }
        50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8) rotate(360deg);
        }
    }
`;
document.head.appendChild(styleSheet);

// 慶祝互動函數
function triggerCelebration(data) {
    console.log('觸發慶祝互動效果:', data);
    
    // 創建慶祝容器
    const celebrationContainer = document.createElement('div');
    celebrationContainer.id = 'celebration-container';
    celebrationContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
        overflow: hidden;
    `;
    document.body.appendChild(celebrationContainer);
    
    // 創建恭喜文字
    const congratsText = document.createElement('div');
    congratsText.innerHTML = '🎉 恭喜完成運動目標！ 🎉';
    congratsText.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 3em;
        font-weight: bold;
        color: #ff6b6b;
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        animation: celebrationText 3s ease-out forwards;
        white-space: nowrap;
    `;
    celebrationContainer.appendChild(congratsText);
    
    // 創建粒子效果
    createCelebrationParticles(celebrationContainer);
    
    // 播放成功音效
    playCelebrationSound();
    
    // 創建閃光效果
    createFlashEffect();
    
    // 3秒後移除慶祝效果
    setTimeout(() => {
        if (celebrationContainer.parentNode) {
            celebrationContainer.parentNode.removeChild(celebrationContainer);
        }
    }, 3000);
}

// 創建粒子效果
function createCelebrationParticles(container) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    const particles = ['🎉', '🎊', '✨', '🌟', '💫', '🎈'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.innerHTML = particles[Math.floor(Math.random() * particles.length)];
            particle.style.cssText = `
                position: absolute;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                font-size: ${Math.random() * 2 + 1}em;
                color: ${colors[Math.floor(Math.random() * colors.length)]};
                animation: celebrationParticle ${Math.random() * 2 + 2}s ease-out forwards;
                transform-origin: center;
            `;
            container.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 3000);
        }, i * 50);
    }
}

// 播放成功音效
function playCelebrationSound() {
    try {
        // 嘗試播放現有的成功音效
        const audio = new Audio('/static/Game_Audio/太厲害了!你成功了!.mp3');
        audio.volume = 0.5;
        audio.play().catch(error => {
            console.log('無法播放音效:', error);
        });
    } catch (error) {
        console.log('音效播放失敗:', error);
    }
}

// 創建閃光效果
function createFlashEffect() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
        z-index: 9999;
        pointer-events: none;
        animation: celebrationFlash 1s ease-out forwards;
    `;
    document.body.appendChild(flash);
    
    setTimeout(() => {
        if (flash.parentNode) {
            flash.parentNode.removeChild(flash);
        }
    }, 1000);
}

// 添加慶祝動畫樣式
const celebrationStyles = document.createElement('style');
celebrationStyles.textContent = `
    @keyframes celebrationText {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        80% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
    }
    
    @keyframes celebrationParticle {
        0% {
            opacity: 1;
            transform: scale(0) rotate(0deg);
        }
        50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
        }
        100% {
            opacity: 0;
            transform: scale(0.5) rotate(360deg) translateY(-100px);
        }
    }
    
    @keyframes celebrationFlash {
        0% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }
`;
document.head.appendChild(celebrationStyles);




