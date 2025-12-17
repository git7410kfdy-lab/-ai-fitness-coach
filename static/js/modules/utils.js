// 工具函數模塊
// 從 realtime.js 提取的通用工具函數

// 顯示提示訊息
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// 顯示通知
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    showToast(message, type);
}

// 顯示錯誤訊息
function showErrorMessage(message, duration = 5000) {
    console.error(message);
    
    let errorMessage = document.querySelector('.error-message');
    
    if (!errorMessage) {
        errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        document.body.appendChild(errorMessage);
    }
    
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.style.animation = 'fadeIn 0.5s ease-in-out';
    
    setTimeout(function() {
        errorMessage.style.animation = 'fadeOut 0.5s ease-in-out';
        setTimeout(function() {
            errorMessage.style.display = 'none';
        }, 500);
    }, duration);
}

// 獲取運動中文名稱
function getExerciseName(exerciseType) {
    return EXERCISE_NAMES[exerciseType] || exerciseType;
}

// 調整影片顯示
function adjustVideoDisplay() {
    if (videoFeed) {
        const videoContainer = videoFeed.closest('.video-container') || videoFeed.parentElement;
        
        videoFeed.removeAttribute('style');
        videoFeed.style.display = 'block';
        videoFeed.style.position = 'absolute';
        videoFeed.style.top = '0';
        videoFeed.style.left = '0';
        videoFeed.style.width = '100%';
        videoFeed.style.height = '100%';
        videoFeed.style.objectFit = 'contain';
        
        if (videoContainer) {
            videoContainer.style.position = 'relative';
            videoContainer.style.overflow = 'hidden';
            videoContainer.style.aspectRatio = '4/3';
            videoContainer.style.maxHeight = '75vh';
            videoContainer.style.backgroundColor = '#000';
        }
    }
}

// 檢查是否完成所有訓練計劃
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
        showToast,
        showNotification,
        showErrorMessage,
        getExerciseName,
        adjustVideoDisplay,
        checkAllExercisesCompleted
    };
}