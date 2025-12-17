// 檢測和品質評分管理模組

let exerciseSocket = null;

function initializeExerciseDetection() {
    console.log('初始化運動檢測...');
    
    // 獲取UI元素引用
    videoFeed = document.getElementById('video-feed');
    startButton = document.getElementById('start-button');
    stopButton = document.getElementById('stop-button');
    resetButton = document.getElementById('reset-button');
    exerciseCount = document.getElementById('exercise-count');
    exerciseCountStats = document.getElementById('exercise-count-stats');
    qualityScore = document.getElementById('quality-score');
    remainingSetsDisplay = document.getElementById('remaining-sets');
    coachTipText = document.getElementById('coach-tip-text');
    qualityDisplay = document.querySelector('.quality-display');
    qualityTitle = document.querySelector('.quality-title');
    exerciseSelect = document.getElementById('exercise-select');
    
    // 初始化 Socket.IO 連接
    if (!socket) {
        console.log('初始化 Socket.IO 連接...');
        socket = io();
        
        socket.on('connect', function() {
            console.log('Socket.IO 連接成功，ID:', socket.id);
        });
        
        socket.on('connect_error', function(error) {
            console.error('Socket.IO 連接錯誤:', error);
        });
        
        socket.on('pose_quality', function(data) {
            console.log('收到姿勢質量評分:', data);
            if (data && data.score !== undefined) {
                updateQualityScore(data.score);
            }
        });
        
        socket.on('shoulder_press_score', function(data) {
            console.log('收到肩推分數:', data);
            if (data && data.score !== undefined) {
                updateQualityScore(data.score);
            }
        });
    }

    // 初始化 /exercise 命名空間連接
    if (!exerciseSocket) {
        console.log('初始化 /exercise 命名空間連接...');
        exerciseSocket = io('/exercise');
        
        exerciseSocket.on('connect', function() {
            console.log('/exercise 命名空間連接成功，ID:', exerciseSocket.id);
        });
        
        exerciseSocket.on('pose_quality', function(data) {
            console.log('收到姿勢質量評分 (/exercise 命名空間):', data);
            if (data && data.score !== undefined) {
                updateQualityScore(data.score);
                if (data.feedback) {
                    updateCoachTip(data.feedback);
                }
            }
        });
        
        exerciseSocket.on('shoulder_press_score', function(data) {
            console.log('收到肩推分數 (/exercise 命名空間):', data);
            if (data && data.score !== undefined) {
                updateQualityScore(data.score);
                if (data.feedback) {
                    updateCoachTip(data.feedback);
                }
            }
        });
    }
}

function updateQualityScore(quality) {
    if (quality === undefined || quality === null || isNaN(quality)) {
        console.warn('收到非數字品質分數:', quality);
        quality = 0;
    }
    
    quality = parseInt(quality);
    lastQuality = quality;
    
    if (!qualityScore) {
        qualityScore = document.getElementById('quality-score');
    }
    
    if (!qualityDisplay) {
        qualityDisplay = document.querySelector('.quality-display');
    }
    
    if (!qualityTitle) {
        qualityTitle = document.querySelector('.quality-title');
    }
    
    if (qualityScore) {
        qualityScore.textContent = quality;
    }
    
    // 根據品質分數更新顏色和文字
    if (qualityDisplay && qualityTitle) {
        if (quality >= 4) {
            qualityTitle.textContent = '優秀';
            qualityDisplay.style.backgroundColor = 'rgba(46, 204, 113, 0.8)';
        } else if (quality >= 3) {
            qualityTitle.textContent = '良好';
            qualityDisplay.style.backgroundColor = 'rgba(241, 196, 15, 0.8)';
        } else if (quality >= 2) {
            qualityTitle.textContent = '一般';
            qualityDisplay.style.backgroundColor = 'rgba(230, 126, 34, 0.8)';
        } else if (quality >= 1) {
            qualityTitle.textContent = '需改進';
            qualityDisplay.style.backgroundColor = 'rgba(231, 76, 60, 0.8)';
        } else {
            qualityTitle.textContent = '未評分';
            qualityDisplay.style.backgroundColor = 'rgba(149, 165, 166, 0.8)';
        }
    }
}

function updateExerciseCount() {
    // 更新運動計數 UI
    
    if (!exerciseCount) {
        exerciseCount = document.getElementById('exercise-count');
    }
    
    if (!exerciseCountStats) {
        exerciseCountStats = document.getElementById('exercise-count-stats');
    }
    
    if (exerciseCount) {
        exerciseCount.textContent = exerciseCounter;
    }
    
    if (exerciseCountStats) {
        exerciseCountStats.textContent = exerciseCounter;
    }
    
    // 檢查訓練計劃中的運動完成情況
    if (workoutPlan.length > 0) {
        checkExerciseCompletion(exerciseCounter);
    } else {
        // 舊邏輯：更新剩餘組數
        if (exerciseCounter > 0 && exerciseCounter % 10 === 0) {
            remainingSets = Math.max(0, remainingSets - 1);
            
            if (!remainingSetsDisplay) {
                remainingSetsDisplay = document.getElementById('remaining-sets');
            }
            
            if (remainingSetsDisplay) {
                remainingSetsDisplay.textContent = remainingSets;
            }
        }
        
        if (remainingSets === 0) {
            if (currentLevel === null) {
                showCompletionMessage();
                recordExerciseCompletion();
            }
        }
    }
}

function checkSocketConnection() {
    if (!socket) {
        initSocket();
    }
    
    console.log('Socket狀態:', {
        connected: socket.connected,
        id: socket.id
    });
    
    if (!socket.connected) {
        console.warn('Socket.IO 未連接，嘗試重新連接...');
        socket.connect();
    }
    
    return socket && socket.connected;
}

// 導出函數
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeExerciseDetection,
        updateQualityScore,
        updateExerciseCount,
        checkSocketConnection
    };
}