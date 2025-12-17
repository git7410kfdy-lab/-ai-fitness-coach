// 初始化訓練計劃模組
document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化訓練計劃模組...');
    
    // 檢查是否已載入workout_plan.js
    if (typeof initWorkoutPlanModule === 'function') {
        console.log('找到訓練計劃模組，開始初始化');
        initWorkoutPlanModule();
        console.log('訓練計劃模組初始化完成');
    } else {
        console.error('找不到訓練計劃模組，請確保已載入workout_plan.js');
        
        // 嘗試動態載入workout_plan.js
        const script = document.createElement('script');
        script.src = '/static/js/workout_plan.js';
        script.onload = function() {
            console.log('已動態載入workout_plan.js');
            if (typeof initWorkoutPlanModule === 'function') {
                console.log('開始初始化訓練計劃模組');
                initWorkoutPlanModule();
                console.log('訓練計劃模組初始化完成');
            } else {
                console.error('載入workout_plan.js後仍找不到初始化函數');
            }
        };
        script.onerror = function() {
            console.error('無法載入workout_plan.js');
        };
        document.head.appendChild(script);
    }
    
    // 手動綁定訓練計劃按鈕事件（備用方案）
    const openPlanModalBtn = document.getElementById('open-workout-plan-btn');
    const workoutPlanModal = document.getElementById('workout-plan-modal');
    const closePlanModalBtn = document.getElementById('close-workout-plan-modal');
    const addExerciseBtn = document.getElementById('add-exercise-btn');
    const savePlanBtn = document.getElementById('save-plan-btn');
    const cancelPlanBtn = document.getElementById('cancel-plan-btn');
    
    if (openPlanModalBtn && workoutPlanModal) {
        console.log('手動綁定訓練計劃按鈕事件');
        
        // 開啟訓練計劃模態視窗
        openPlanModalBtn.addEventListener('click', function() {
            console.log('點擊開啟訓練計劃按鈕');
            workoutPlanModal.classList.add('active');
        });
        
        // 關閉訓練計劃模態視窗
        if (closePlanModalBtn) {
            closePlanModalBtn.addEventListener('click', function() {
                console.log('點擊關閉訓練計劃按鈕');
                workoutPlanModal.classList.remove('active');
            });
        }
        
        // 取消按鈕
        if (cancelPlanBtn) {
            cancelPlanBtn.addEventListener('click', function() {
                console.log('點擊取消按鈕');
                workoutPlanModal.classList.remove('active');
            });
        }
    } else {
        console.error('找不到訓練計劃按鈕或模態視窗元素');
    }
});