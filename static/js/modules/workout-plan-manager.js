// 訓練計劃管理模組 - 從 realtime.js 提取

// 訓練計劃解析和管理
function parseWorkoutPlan() {
    console.log('Parsing workout plan from form...');
    const exerciseItems = document.querySelectorAll('.workout-exercise-item');
    workoutPlan = [];
    planIncludesBasketball = false;

    exerciseItems.forEach((item, index) => {
        const typeSelect = item.querySelector(`select[name="exercise-type[]"]`);
        const weightInput = item.querySelector(`input[name="weight[]"]`);
        const repsInput = item.querySelector(`input[name="reps[]"]`);
        const setsInput = item.querySelector(`input[name="sets[]"]`);

        if (typeSelect && repsInput && setsInput) {
            const exerciseType = typeSelect.value;
            const weight = weightInput ? parseFloat(weightInput.value) || 0 : 0;
            const reps = parseInt(repsInput.value, 10);
            const sets = parseInt(setsInput.value, 10);

            if (exerciseType && !isNaN(reps) && !isNaN(sets)) {
                workoutPlan.push({ type: exerciseType, weight: weight, reps: reps, sets: sets });
                if (exerciseType === 'basketball') {
                    planIncludesBasketball = true;
                }
            } else {
                console.warn(`Skipping invalid exercise item at index ${index}`);
            }
        } else {
            console.error(`Could not find required inputs for exercise item at index ${index}`);
        }
    });

    console.log('Parsed workout plan:', workoutPlan);
    console.log('Plan includes basketball:', planIncludesBasketball);
    updateWorkoutPlanSummary();
    
    // 重置當前運動狀態
    currentExerciseIndex = 0;
    currentExerciseReps = 0;
    currentExerciseSets = 0;
    updateCurrentExerciseDisplay();
}

function handleExerciseCompletion() {
    if (isHandlingCompletion) {
        console.warn("handleExerciseCompletion re-entered while already processing, skipping.");
        return;
    }
    isHandlingCompletion = true;

    try {
        console.log(`Exercise ${workoutPlan[currentExerciseIndex].type} completed ${currentExerciseReps} reps.`);

        const damage = calculateDamage(workoutPlan[currentExerciseIndex].type, lastQuality);
        updateMonsterHP(-damage);

        if (currentExerciseReps >= workoutPlan[currentExerciseIndex].reps) {
            currentExerciseSets++;
            currentExerciseReps = 0;
            console.log(`Set ${currentExerciseSets}/${workoutPlan[currentExerciseIndex].sets} completed.`);
            updateRemainingSetsDisplay();
    
            if (currentExerciseSets >= workoutPlan[currentExerciseIndex].sets) {
                console.log(`Exercise ${workoutPlan[currentExerciseIndex].type} fully completed.`);
                currentExerciseIndex++;
                currentExerciseSets = 0;
                currentExerciseReps = 0;
                resetExerciseCounters();

                if (currentExerciseIndex >= workoutPlan.length) {
                    console.log("Workout plan completed!");
                    if (isDetecting) {
                        stopDetection();
                    }

                    // 重置怪物攻擊系統
                    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
                        window.monsterAttackSystem.reset();
                        console.log('怪物攻擊系統已重置');
                    }

                    if (planIncludesBasketball) {
                        console.log("訓練計劃完成且包含籃球投籃，準備顯示彈窗。");
                        setTimeout(() => {
                            showBasketballPostureCheckPopup();
                        }, 100);
                    }
                    
                    resetExerciseCounters();
                    showNotification("訓練計劃完成！", "恭喜你完成了所有訓練項目！");
                } else {
                    // 切換到下一個運動時重置怪物攻擊系統
                    if (window.monsterAttackSystem && typeof window.monsterAttackSystem.reset === 'function') {
                        window.monsterAttackSystem.reset();
                        console.log('切換運動，怪物攻擊系統已重置');
                    }
                    
                    if (workoutPlan[currentExerciseIndex].type === 'basketball') {
                        console.log('切換到籃球投籃，初始化計數器');
                        resetExerciseCounters();
                    }
                    updateCurrentExerciseDisplay();
                }
            }
        }
    } finally {
        isHandlingCompletion = false;
    }
}

function updateWorkoutPlanProgress() {
    console.log('更新訓練計劃進度');
    if (currentExerciseIndex < workoutPlan.length) {
        const currentExercise = workoutPlan[currentExerciseIndex];
        const progressPercentage = (currentExerciseReps / currentExercise.reps) * 100;
        
        // 更新UI顯示進度
        const progressBar = document.querySelector('.workout-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
    }
}

function checkAllExercisesCompleted() {
    if (!workoutPlan || workoutPlan.length === 0) {
        return false;
    }
    
    const lastExerciseIndex = workoutPlan.length - 1;
    const lastExercise = workoutPlan[lastExerciseIndex];
    
    return (currentExerciseIndex === lastExerciseIndex && currentExerciseSets >= lastExercise.sets);
}

// 導出函數
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseWorkoutPlan,
        handleExerciseCompletion,
        updateWorkoutPlanProgress,
        checkAllExercisesCompleted
    };
}