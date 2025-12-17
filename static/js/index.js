
let currentUser = null;
let caloriesChart = null;
let muscleGrowthChart = null;

import('./modules/quest-board.js').then(() => {
    console.log('任務板模組載入完成');
    // 載入進度並渲染任務板
    if (window.questBoard) {
        window.questBoard.loadProgress();
        window.questBoard.renderQuestBoard();
    }
}).catch(error => {
    console.error('載入任務板模組失敗:', error);
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('頁面加載完成，初始化健身報告功能');
    
    // 獲取當前登入用戶名
    const userProfileElement = document.querySelector('.user-profile');
    if (userProfileElement) {
        currentUser = userProfileElement.getAttribute('data-user-id');
        console.log('當前用戶名:', currentUser);
    }
    
    setupManualInput();
    setupBodyStatsInput();
    initPromoCarousel(); // 初始化宣傳輪播
    
    // 如果有用戶ID，載入該用戶的數據；否則使用默認ID
    const userIdToLoad = currentUser || 'C111151146';
    loadComprehensiveAnalytics(userIdToLoad);
    
    // 載入用戶體態數據
    if (currentUser) {
        loadBodyStatsFromServer();
    }
});

// 英雄區塊輪播功能
function initPromoCarousel() {
    const slides = document.querySelectorAll('.hero-slide');
    const indicators = document.querySelectorAll('.indicator');
    let currentSlide = 0;
    let slideInterval;
    
    if (slides.length === 0) return; // 如果沒有幻燈片則退出
    
    // 切換到指定幻燈片
    function goToSlide(index) {
        // 移除所有活動狀態
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // 設置新的活動狀態
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
        
        currentSlide = index;
    }
    
    // 下一張幻燈片
    function nextSlide() {
        const next = (currentSlide + 1) % slides.length;
        goToSlide(next);
    }
    
    // 開始自動播放
    function startAutoPlay() {
        stopAutoPlay(); // 確保清除先前的計時器
        slideInterval = setInterval(nextSlide, 8000); // 每8秒切換
    }
    
    // 停止自動播放
    function stopAutoPlay() {
        clearInterval(slideInterval);
    }
    
    // 指示器點擊事件
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            stopAutoPlay();
            goToSlide(index);
            startAutoPlay(); // 重新開始自動播放
        });
    });
    
    // 滑鼠懸停時暫停自動播放
    const carousel = document.querySelector('.hero-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);
    }
    
    // 開始自動播放
    startAutoPlay();
    
    console.log('英雄區塊輪播初始化完成');
}

// 體態輸入功能設置
function setupBodyStatsInput() {
    console.log('設置體態輸入功能');
    
    const heightSlider = document.getElementById('height-slider');
    const weightSlider = document.getElementById('weight-slider');
    const ageSlider = document.getElementById('age-slider');
    const saveBtn = document.getElementById('save-body-stats');
    
    if (!heightSlider || !weightSlider || !ageSlider) {
        console.error('找不到體態輸入元素');
        return;
    }
    
    // 初始化滑塊和視覺效果
    updateSliderVisuals('height', heightSlider.value);
    updateSliderVisuals('weight', weightSlider.value);
    updateSliderVisuals('age', ageSlider.value);
    updateBMI();
    
    // 身高滑塊事件
    heightSlider.addEventListener('input', function() {
        updateSliderVisuals('height', this.value);
        updateBMI();
    });
    
    // 體重滑塊事件
    weightSlider.addEventListener('input', function() {
        updateSliderVisuals('weight', this.value);
        updateBMI();
    });
    
    // 年齡滑塊事件
    ageSlider.addEventListener('input', function() {
        updateSliderVisuals('age', this.value);
    });
    
    // 注意：保存按鈕事件已在 initBodyStatsSection 中綁定，避免重複綁定
}

// 更新滑塊視覺效果
function updateSliderVisuals(type, value) {
    const valueElement = document.getElementById(`${type}-value`);
    const fillElement = document.getElementById(`${type}-fill`);
    const indicatorElement = document.getElementById(`${type}-indicator`);
    const slider = document.getElementById(`${type}-slider`);
    
    if (!valueElement || !fillElement || !indicatorElement || !slider) {
        return;
    }
    
    // 更新數值顯示
    valueElement.textContent = value;
    
    // 計算填充百分比
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const percentage = ((value - min) / (max - min)) * 100;
    
    // 更新滑塊填充
    fillElement.style.width = percentage + '%';
    
    // 更新視覺指示器
    switch(type) {
        case 'height':
            // 身高指示器：高度變化
            const heightPercentage = ((value - 140) / (220 - 140)) * 100;
            indicatorElement.style.height = Math.max(20, heightPercentage) + '%';
            break;
            
        case 'weight':
            // 體重指示器：大小變化
            const weightScale = 0.7 + ((value - 40) / (150 - 40)) * 0.6;
            indicatorElement.style.transform = `scale(${weightScale})`;
            indicatorElement.textContent = value;
            break;
            
        case 'age':
            // 年齡指示器：位置變化
            const agePercentage = ((value - 16) / (80 - 16)) * 100;
            indicatorElement.style.setProperty('--age-position', agePercentage + '%');
            if (indicatorElement.style.setProperty) {
                indicatorElement.querySelector('::after') || 
                (indicatorElement.style.setProperty('--after-left', agePercentage + '%'));
            }
            // 使用 CSS 自定義屬性來控制 ::after 偽元素位置
            document.documentElement.style.setProperty('--age-position', agePercentage + '%');
            break;
    }
}

// 更新BMI計算和顯示
function updateBMI() {
    const height = parseFloat(document.getElementById('height-slider').value);
    const weight = parseFloat(document.getElementById('weight-slider').value);
    
    if (!height || !weight) return;
    
    // 計算BMI
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    
    // 更新BMI數值
    const bmiValueElement = document.getElementById('bmi-value');
    const bmiStatusElement = document.getElementById('bmi-status');
    const bmiPointerElement = document.getElementById('bmi-pointer');
    
    if (bmiValueElement) {
        bmiValueElement.textContent = bmi.toFixed(1);
    }
    
    // 判斷BMI狀態和顏色
    let status, color, pointerPosition;
    
    if (bmi < 18.5) {
        status = '體重過輕';
        color = '#74b9ff';
        pointerPosition = (bmi / 18.5) * 25; // 0-25%
    } else if (bmi < 24) {
        status = '正常範圍';
        color = '#00b894';
        pointerPosition = 25 + ((bmi - 18.5) / (24 - 18.5)) * 25; // 25-50%
    } else if (bmi < 27) {
        status = '體重過重';
        color = '#fdcb6e';
        pointerPosition = 50 + ((bmi - 24) / (27 - 24)) * 25; // 50-75%
    } else {
        status = '肥胖';
        color = '#fd79a8';
        pointerPosition = 75 + Math.min(((bmi - 27) / (35 - 27)) * 25, 25); // 75-100%
    }
    
    // 更新狀態顯示
    if (bmiStatusElement) {
        bmiStatusElement.textContent = status;
        bmiStatusElement.style.backgroundColor = color + '20'; // 添加透明度
        bmiStatusElement.style.color = '#2c3e50'; // 使用深色文字
        bmiStatusElement.style.border = `2px solid ${color}`; // 添加邊框以增強視覺效果
    }
    
    // 更新BMI指針位置
    if (bmiPointerElement) {
        bmiPointerElement.style.left = Math.min(Math.max(pointerPosition, 0), 100) + '%';
    }
}

// 保存體態數據到後端
async function saveBodyStats() {
    const height = parseFloat(document.getElementById('height-slider').value);
    const weight = parseFloat(document.getElementById('weight-slider').value);
    const age = parseInt(document.getElementById('age-slider').value);
    
    // 體態數據對象（不需要傳送用戶ID，後端會自動使用當前登入用戶的ID）
    const bodyStats = {
        height: height,
        weight: weight,
        age: age
    };
    
    try {
        const response = await fetch('/user/api/body-stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyStats)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 同時保存到 localStorage 作為備份
            const localData = {
                ...bodyStats,
                bmi: result.data.bmi,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('userBodyStats', JSON.stringify(localData));
            showNotification('體態數據已保存到伺服器！', 'success');
        } else {
            showNotification(`保存失敗: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('保存體態數據時發生錯誤:', error);
        // 如果伺服器請求失敗，仍然保存到 localStorage
        const bmi = parseFloat(document.getElementById('bmi-value').textContent);
        const localData = {
            ...bodyStats,
            bmi: bmi,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('userBodyStats', JSON.stringify(localData));
        showNotification('網路錯誤，數據已保存到本地', 'warning');
    }
}

// 顯示通知
function showNotification(message, type = 'info') {
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // 添加通知樣式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 動畫顯示
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自動隱藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 載入已保存的體態數據
function loadSavedBodyStats() {
    try {
        const savedStats = localStorage.getItem('userBodyStats');
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            
            // 更新滑塊值
            document.getElementById('height-slider').value = stats.height;
            document.getElementById('weight-slider').value = stats.weight;
            document.getElementById('age-slider').value = stats.age;
            
            // 更新視覺效果
            updateSliderVisuals('height', stats.height);
            updateSliderVisuals('weight', stats.weight);
            updateSliderVisuals('age', stats.age);
            updateBMI();
            
            console.log('已載入保存的體態數據:', stats);
        }
    } catch (error) {
        console.error('載入體態數據失敗:', error);
    }
}

// 從後端載入體態數據
async function loadBodyStatsFromServer() {
    try {
        const response = await fetch('/user/api/body-stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            
            // 更新當前用戶信息
            if (data.user_name) {
                currentUser = data.user_name;
                console.log('從伺服器更新用戶名:', currentUser);
            }
            
            // 更新滑塊值
            const heightSlider = document.getElementById('height-slider');
            const weightSlider = document.getElementById('weight-slider');
            const ageSlider = document.getElementById('age-slider');
            
            if (heightSlider) heightSlider.value = data.height;
            if (weightSlider) weightSlider.value = data.weight;
            if (ageSlider) ageSlider.value = data.age;
            
            // 更新顯示
            updateSliderVisuals('height', data.height);
            updateSliderVisuals('weight', data.weight);
            updateSliderVisuals('age', data.age);
            updateBMI();
            
            console.log('從伺服器載入體態數據:', data);
            return true;
        } else {
            console.log('伺服器無體態數據，使用預設值');
            return false;
        }
    } catch (error) {
        console.error('載入體態數據時發生錯誤:', error);
        // 嘗試從 localStorage 載入
        return loadBodyStatsFromLocal();
    }
}

// 從本地載入體態數據
function loadBodyStatsFromLocal() {
    try {
        const savedData = localStorage.getItem('userBodyStats');
        if (savedData) {
            const data = JSON.parse(savedData);
            
            const heightSlider = document.getElementById('height-slider');
            const weightSlider = document.getElementById('weight-slider');
            const ageSlider = document.getElementById('age-slider');
            
            if (heightSlider && data.height) heightSlider.value = data.height;
            if (weightSlider && data.weight) weightSlider.value = data.weight;
            if (ageSlider && data.age) ageSlider.value = data.age;
            
            // 更新顯示
            updateSliderVisuals('height', data.height);
            updateSliderVisuals('weight', data.weight);
            updateSliderVisuals('age', data.age);
            updateBMI();
            
            console.log('從本地載入體態數據:', data);
            return true;
        }
    } catch (error) {
        console.error('載入本地體態數據失敗:', error);
    }
    return false;
}

// 初始化體態設定區塊
async function initBodyStatsSection() {
    const heightSlider = document.getElementById('height-slider');
    const weightSlider = document.getElementById('weight-slider');
    const ageSlider = document.getElementById('age-slider');
    const saveBtn = document.getElementById('save-body-stats');
    
    if (!heightSlider || !weightSlider || !ageSlider || !saveBtn) {
        console.log('體態設定元素未找到，跳過初始化');
        return;
    }
    
    // 設置滑塊事件監聽器
    heightSlider.addEventListener('input', function() {
        updateSliderVisuals('height', this.value);
        updateBMI();
    });
    weightSlider.addEventListener('input', function() {
        updateSliderVisuals('weight', this.value);
        updateBMI();
    });
    ageSlider.addEventListener('input', function() {
        updateSliderVisuals('age', this.value);
    });
    
    // 保存按鈕事件
    saveBtn.addEventListener('click', saveBodyStats);
    
    // 載入已保存的數據
    const loaded = await loadBodyStatsFromServer();
    
    if (!loaded) {
        // 如果沒有載入到數據，使用預設值
        updateSliderVisuals('height', heightSlider.value);
        updateSliderVisuals('weight', weightSlider.value);
        updateSliderVisuals('age', ageSlider.value);
        updateBMI();
     }
    
    console.log('體態設定區塊初始化完成');
}

// 頁面載入時嘗試載入已保存的數據
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initBodyStatsSection, 500); // 延遲載入確保元素已渲染
});

// 初始化手動查詢功能
function initManualQuery() {
    const queryButton = document.getElementById('queryButton');
    const userIdInput = document.getElementById('userIdInput');
    
    if (queryButton && userIdInput) {
        queryButton.addEventListener('click', () => {
            const userId = userIdInput.value.trim();
            if (userId) {
                loadComprehensiveAnalytics(userId);
            } else {
                alert('請輸入用戶ID');
            }
        });
        
        // 支持回車鍵觸發查詢
        userIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                queryButton.click();
            }
        });
    }
}

// 載入綜合健身分析
async function loadComprehensiveAnalytics(userId) {
    try {
        // 同時載入綜合分析數據和健身報告數據
        const [analyticsResponse, fitnessResponse] = await Promise.all([
            fetch(`/api/comprehensive-analytics?user_id=${userId}`),
            fetch(`/api/fitness/dashboard?user_id=${userId}`)
        ]);
        
        const analyticsData = await analyticsResponse.json();
        console.log('完整的綜合分析API響應數據:', analyticsData);
        
        if (analyticsData.success) {
            console.log('body_stats數據:', analyticsData.data.body_stats);
            console.log('current數據:', analyticsData.data.body_stats.current);
            console.log('trends數據:', analyticsData.data.body_stats.trends);
            
            updateAnalyticsOverview(analyticsData.data.basic_stats);
            updateBodyAnalysis(analyticsData.data.body_stats.trends, analyticsData.data.body_stats.current);
            updateExerciseAnalysis(analyticsData.data.exercise_analysis.trends, analyticsData.data.exercise_analysis.muscle_development);
            updateExerciseStats(analyticsData.data.exercise_analysis.exercise_stats, analyticsData.data.exercise_analysis.recent_exercises);
            updateInsights(analyticsData.data.insights);
        } else {
            console.error('載入綜合分析失敗:', analyticsData.message);
        }
        
        // 處理健身報告數據（用於兼容舊系統和訓練記錄分析）
        if (fitnessResponse.ok) {
            const fitnessData = await fitnessResponse.json();
            console.log('健身報告API響應數據:', fitnessData);
            
            if (fitnessData.success) {
                // 更新健身報告相關的數據和圖表
                updateFitnessReportData(fitnessData);
            }
        }
        
        // 如果兩個API都失敗，顯示無數據訊息
        if (!analyticsData.success && (!fitnessResponse.ok || !(await fitnessResponse.json()).success)) {
            showNoDataMessage();
        }
        
    } catch (error) {
        console.error('載入綜合分析時發生錯誤:', error);
        showNoDataMessage();
    }
}

// 更新分析總覽
function updateAnalyticsOverview(basicStats) {
    console.log('更新分析總覽數據:', basicStats);
    
    const elements = {
        totalWeight: document.getElementById('total-weight'),
        totalCalories: document.getElementById('total-calories'),
        totalTime: document.getElementById('total-training-time'),
        trainingFreq: document.getElementById('training-frequency'),
        totalExercises: document.getElementById('total-exercises')
    };
    
    if (elements.totalWeight) {
        elements.totalWeight.textContent = `${Math.round(basicStats.total_weight || 0)} kg`;
    }
    if (elements.totalCalories) {
        elements.totalCalories.textContent = `${Math.round(basicStats.total_calories || 0)} 卡路里`;
    }
    if (elements.totalTime) {
        const totalMinutes = basicStats.total_training_time || 0;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        elements.totalTime.textContent = `${hours} 小時 ${minutes} 分鐘`;
    }
    if (elements.trainingFreq) {
        elements.trainingFreq.textContent = `${basicStats.training_frequency || 0} 次/周`;
    }
    if (elements.totalExercises) {
        elements.totalExercises.textContent = `${basicStats.total_exercises || 0} 次`;
    }
}

// 更新體態分析
function updateBodyAnalysis(bodyTrends, currentStats) {
    console.log('更新體態分析數據:', { bodyTrends, currentStats });
    
    // 更新當前體態數據
    const currentStatsContainer = document.getElementById('current-body-display');
    if (currentStatsContainer) {
        if (currentStats) {
            currentStatsContainer.innerHTML = `
                <div class="body-stat-item">
                    <span class="body-stat-label">身高</span>
                    <span class="body-stat-value">${currentStats.height || 'N/A'} cm</span>
                </div>
                <div class="body-stat-item">
                    <span class="body-stat-label">體重</span>
                    <span class="body-stat-value">${currentStats.weight || 'N/A'} kg</span>
                </div>
                <div class="body-stat-item">
                    <span class="body-stat-label">年齡</span>
                    <span class="body-stat-value">${currentStats.age || 'N/A'} 歲</span>
                </div>
                <div class="body-stat-item">
                    <span class="body-stat-label">BMI</span>
                    <span class="body-stat-value">${currentStats.bmi ? parseFloat(currentStats.bmi).toFixed(1) : 'N/A'}</span>
                </div>
            `;
        } else {
            currentStatsContainer.innerHTML = `
                <div class="no-data-message">
                    <i class="fas fa-info-circle"></i>
                    <p>暫無體態數據</p>
                </div>
            `;
        }
    }
    
    // 渲染體重趨勢圖
    if (bodyTrends && bodyTrends.length > 0) {
        renderBodyTrendsChart(bodyTrends);
    } else {
        // 如果沒有趨勢數據，顯示提示信息
        const chartCanvas = document.getElementById('bmi-trend-chart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暫無體態變化數據', chartCanvas.width / 2, chartCanvas.height / 2);
        }
    }
}

// 更新運動表現分析
function updateExerciseAnalysis(exerciseTrends, muscleDevelopment) {
    console.log('更新運動表現分析數據:', { exerciseTrends, muscleDevelopment });
    
    if (exerciseTrends && exerciseTrends.length > 0) {
        renderExerciseTrendsChart(exerciseTrends);
    } else {
        // 如果沒有運動趨勢數據，顯示提示信息
        const chartCanvas = document.getElementById('daily-calories-chart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暫無運動趨勢數據', chartCanvas.width / 2, chartCanvas.height / 2);
        }
    }
    
    if (muscleDevelopment && Object.keys(muscleDevelopment).length > 0) {
        renderMuscleChart(muscleDevelopment);
    } else {
        // 如果沒有肌肉發展數據，顯示提示信息
        const chartCanvas = document.getElementById('muscle-radar-chart');
        if (chartCanvas) {
            const ctx = chartCanvas.getContext('2d');
            ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暫無肌肉發展數據', chartCanvas.width / 2, chartCanvas.height / 2);
        }
    }
}

// 更新運動統計
function updateExerciseStats(exerciseTypes, recentExercises) {
    console.log('更新運動統計數據:', { exerciseTypes, recentExercises });
    
    // 更新運動類型統計
    const exerciseTypesContainer = document.getElementById('exercise-types-container');
    if (exerciseTypesContainer) {
        if (exerciseTypes && Array.isArray(exerciseTypes) && exerciseTypes.length > 0) {
            exerciseTypesContainer.innerHTML = exerciseTypes
                .map(item => `
                    <div class="exercise-type-item">
                        <span class="exercise-name">${formatExerciseName(item.name)}</span>
                        <span class="exercise-count">${item.count} 次</span>
                    </div>
                `).join('');
        } else {
            exerciseTypesContainer.innerHTML = `
                <div class="no-data-message">
                    <i class="fas fa-info-circle"></i>
                    <p>暫無運動類型數據</p>
                </div>
            `;
        }
    }
    
    // 更新最近活動
    const recentActivitiesContainer = document.getElementById('recent-activities-container');
    if (recentActivitiesContainer) {
        if (recentExercises && Array.isArray(recentExercises) && recentExercises.length > 0) {
            recentActivitiesContainer.innerHTML = recentExercises
                .slice(0, 10)
                .map(exercise => `
                    <div class="activity-item">
                        <span class="activity-date">${exercise.date}</span>
                        <span class="activity-exercise">${formatExerciseName(exercise.exercise)}</span>
                        <span class="activity-reps">${exercise.reps} 次</span>
                        <span class="activity-weight">${exercise.weight}kg</span>
                    </div>
                `).join('');
        } else {
            recentActivitiesContainer.innerHTML = `
                <div class="no-data-message">
                    <i class="fas fa-info-circle"></i>
                    <p>暫無最近訓練記錄</p>
                </div>
            `;
        }
    }
}

// 更新健身建議
function updateInsights(insights) {
    const insightsContainer = document.getElementById('insights-container');
    if (insightsContainer && insights && insights.length > 0) {
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <div class="insight-icon">
                    <i class="fas ${getInsightIcon(insight.type)}"></i>
                </div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                </div>
            </div>
        `).join('');
    }
}

// 獲取洞察圖標
function getInsightIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle',
        'tip': 'fa-lightbulb'
    };
    return icons[type] || 'fa-info-circle';
}

// 渲染體重趨勢圖
function renderBodyTrendsChart(bodyTrends) {
    const ctx = document.getElementById('bmi-trend-chart');
    if (!ctx) return;
    
    // 銷毀現有圖表
    if (window.bodyTrendsChartInstance) {
        window.bodyTrendsChartInstance.destroy();
    }
    
    const dates = bodyTrends.map(item => new Date(item.date).toLocaleDateString('zh-TW'));
    const weights = bodyTrends.map(item => item.weight);
    const bmis = bodyTrends.map(item => item.bmi);
    
    window.bodyTrendsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: '體重 (kg)',
                data: weights,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'BMI',
                data: bmis,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '體重 (kg)',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: false,
                    min: 15,
                    max: 35,
                    title: {
                        display: true,
                        text: 'BMI',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white',
                        stepSize: 2
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// 渲染運動趨勢圖
function renderExerciseTrendsChart(exerciseTrends) {
    console.log('渲染運動趨勢圖數據:', exerciseTrends);
    const ctx = document.getElementById('daily-calories-chart');
    if (!ctx) {
        console.error('找不到 daily-calories-chart 元素');
        return;
    }
    
    // 確保canvas有正確的尺寸
    const container = ctx.parentElement;
    console.log('圖表容器尺寸:', container.offsetWidth, container.offsetHeight);
    console.log('Canvas元素:', ctx, 'Canvas尺寸:', ctx.width, ctx.height);
    
    // 銷毀現有圖表
    if (window.exerciseTrendsChartInstance) {
        window.exerciseTrendsChartInstance.destroy();
    }
    
    if (!exerciseTrends || !Array.isArray(exerciseTrends) || exerciseTrends.length === 0) {
        // 如果沒有數據，顯示提示信息
        const canvas = ctx;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.font = '16px Arial';
        context.textAlign = 'center';
        context.fillText('暫無卡路里消耗數據', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const dates = exerciseTrends.map(item => {
        const date = new Date(item.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    const calories = exerciseTrends.map(item => parseFloat(item.total_calories) || 0);
    const exerciseCounts = exerciseTrends.map(item => parseInt(item.exercise_count) || 0);
    
    console.log('圖表數據:', { dates, calories, exerciseCounts });
    
    window.exerciseTrendsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: '卡路里消耗',
                data: calories,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: '運動次數',
                data: exerciseCounts,
                type: 'line',
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.4,
                yAxisID: 'y1',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const index = context[0].dataIndex;
                            const data = exerciseTrends[index];
                            return [
                                `總重量: ${data.total_weight || 0} kg`,
                                `總次數: ${data.total_reps || 0} 次`,
                                `平均效率: ${data.avg_calories_per_exercise || 0} 卡/次`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '卡路里',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '運動次數',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white',
                        stepSize: 1
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
    

}

// 渲染肌肉群發展圖
function renderMuscleChart(muscleDevelopment) {
    const ctx = document.getElementById('muscle-radar-chart');
    if (!ctx) return;
    
    // 銷毀現有圖表
    if (window.muscleChartInstance) {
        window.muscleChartInstance.destroy();
    }
    
    const muscles = Object.keys(muscleDevelopment);
    const rawCounts = Object.values(muscleDevelopment);
    
    // 將原始數據轉換為百分比
    // 假設每個肌肉群的最大發展指數為1000
    const maxMuscleIndex = 1000;
    const percentageData = rawCounts.map(value => {
        const numValue = Number(value) || 0;
        return Math.min(100, Math.round((numValue / maxMuscleIndex) * 100));
    });
    
    console.log('肌肉發展原始數據:', rawCounts);
    console.log('肌肉發展百分比數據:', percentageData);
    
    window.muscleChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: muscles.map(muscle => translateMuscleGroup(muscle)),
            datasets: [{
                label: '發展程度 (%)',
                data: percentageData,
                borderColor: '#9C27B0',
                backgroundColor: 'rgba(156, 39, 176, 0.3)',
                pointBackgroundColor: '#9C27B0',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#9C27B0',
                pointRadius: 6,
                pointHoverRadius: 8,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: 'white',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const muscleIndex = muscles.indexOf(Object.keys(muscleDevelopment)[context.dataIndex]);
                            const rawValue = rawCounts[muscleIndex];
                            return `發展程度: ${context.parsed.r}% (原始值: ${rawValue})`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    pointLabels: {
                        color: 'white',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: 'white',
                        backdropColor: 'transparent',
                        stepSize: 20,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// 翻譯肌肉群名稱
function translateMuscleGroup(muscle) {
    const translations = {
        'chest': '胸部',
        'back': '背部',
        'shoulders': '肩膀',
        'arms': '手臂',
        'legs': '腿部',
        'core': '核心',
        'cardio': '有氧'
    };
    return translations[muscle] || muscle;
}

// 顯示無數據訊息
function showNoDataMessage() {
    const analyticsContainer = document.querySelector('.comprehensive-analytics');
    if (analyticsContainer) {
        analyticsContainer.innerHTML = `
            <div class="no-data">
                <i class="fas fa-chart-line"></i>
                <p>暫無數據或載入失敗，請檢查用戶ID是否正確</p>
            </div>
        `;
    }
}

// 新增手動查詢功能 - 更新為綜合分析
function setupManualInput() {
    const manualInputBtn = document.getElementById('manual-load-btn');
    const manualUserIdInput = document.getElementById('manual-user-id');
    const errorDisplay = document.getElementById('manual-input-error');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (!manualInputBtn || !manualUserIdInput) {
        console.error('找不到手動輸入元素');
        return;
    }
    
    console.log('設置手動輸入功能');
    
    manualInputBtn.addEventListener('click', async () => {
        const userId = manualUserIdInput.value.trim();
        
        if (!userId) {
            errorDisplay.textContent = '請輸入用戶ID';
            errorDisplay.style.display = 'block';
            return;
        }
        
        errorDisplay.style.display = 'none';
        loadingIndicator.style.display = 'block';
        
        try {
            await loadComprehensiveAnalytics(userId);
            console.log(`成功加載用戶 ${userId} 的綜合分析`);
        } catch (error) {
            console.error('加載綜合分析失敗:', error);
            errorDisplay.textContent = `查詢失敗: ${error.message}`;
            errorDisplay.style.display = 'block';
        } finally {
            loadingIndicator.style.display = 'none';
        }
    });
    
    // 回車鍵觸發查詢
    manualUserIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manualInputBtn.click();
        }
    });
}


// 取得健身報告數據
async function loadFitnessReport(userId) {
    if (!userId) {
        throw new Error('未提供用戶ID');
    }
    
    console.log(`正在加載用戶 ${userId} 的健身報告`);
    currentUser = userId;
    
    try {
        // 明確指定完整URL，避免相對路徑問題
        const url = `/api/fitness/dashboard?user_id=${encodeURIComponent(userId)}`;
        console.log(`請求URL: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        console.log('API響應狀態:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態碼: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API響應數據:', data);
        
        if (!data.success) {
            throw new Error(data.message || '獲取數據失敗');
        }
        
        // 確保數據格式正確
        const processedData = {
            ...data,
            calories_trend: Array.isArray(data.calories_trend) ? data.calories_trend : [],
            muscle_growth: data.muscle_growth || { arms: 0, chest: 0, core: 0, legs: 0, shoulders: 0 },
            exercise_stats: Array.isArray(data.exercise_stats) ? data.exercise_stats : [],
            recent_exercises: Array.isArray(data.recent_exercises) ? data.recent_exercises : []
        };
        
        console.log('處理後的數據:', processedData);
        
        // 處理數據並更新UI
        updateDashboardUI(processedData);
        renderCharts(processedData);
        renderExerciseStats(processedData.exercise_stats);
        renderRecentExercises(processedData.recent_exercises);
        
        return processedData;
    } catch (error) {
        console.error('加載健身報告失敗:', error);
        throw error;
    }
}


// 渲染圖表
function renderCharts(data) {
    console.log('渲染圖表，數據:', data);
    
    try {
        // 檢查 calories_trend 是否存在
        if (!data.calories_trend) {
            console.warn('數據中缺少 calories_trend 屬性');
        } else {
            console.log('calories_trend 數據:', data.calories_trend);
        }
        
        renderCaloriesChart(data.calories_trend);
        renderMuscleGrowthChart(data.muscle_growth);
    } catch (error) {
        console.error('渲染圖表時出錯:', error);
    }
}



function processAndDisplayData(data) {
    // 強制轉換數據類型
    const processedData = {
        ...data,
        total_weight: parseFloat(data.total_weight) || 0,
        total_calories: parseFloat(data.total_calories) || 0,
        total_training_time: parseInt(data.total_training_time) || 0,
        training_frequency: parseInt(data.training_frequency) || 0,
        calories_trend: data.calories_trend?.map(Number) || Array(7).fill(0),
        muscle_growth: {
            arms: parseInt(data.muscle_growth?.arms) || 0,
            chest: parseInt(data.muscle_growth?.chest) || 0,
            core: parseInt(data.muscle_growth?.core) || 0,
            legs: parseInt(data.muscle_growth?.legs) || 0,
            shoulders: parseInt(data.muscle_growth?.shoulders) || 0
        }
    };
    
    // 更新UI
    updateDashboardUI(processedData);
    
    // 渲染圖表
    renderCaloriesChart(processedData.calories_trend);
    renderMuscleGrowthChart(processedData.muscle_growth);
}


// 顯示錯誤訊息
function showErrorMessage(message) {
    console.error(message);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const reportContainer = document.getElementById('fitness-report');
    if (reportContainer) {
        reportContainer.prepend(errorDiv);
    } else {
        document.body.appendChild(errorDiv);
    }
}

// 更新健身報告數據（用於兼容舊系統和訓練記錄分析）
function updateFitnessReportData(fitnessData) {
    console.log('更新健身報告數據:', fitnessData);
    
    if (fitnessData.success) {
        // 更新儀表板UI（如果存在相關元素）
        if (typeof updateDashboardUI === 'function') {
            updateDashboardUI(fitnessData);
        }
        
        // 注意：運動趨勢圖表由 updateExerciseAnalysis 函數處理，這裡不再重複渲染
        // 避免與正確的後端數據衝突
        
        // 渲染肌肉群發展圖表（修正字段名稱）
        if (typeof renderMuscleChart === 'function' && fitnessData.muscle_growth) {
            renderMuscleChart(fitnessData.muscle_growth);
        }
        
        // 更新進度圖表（如果存在progressChart）
        if (typeof progressChart !== 'undefined' && progressChart && fitnessData.progress_data) {
            const progressData = fitnessData.progress_data;
            progressChart.data.labels = progressData.labels || [];
            progressChart.data.datasets[0].data = progressData.reps || [];
            progressChart.data.datasets[1].data = progressData.calories || [];
            progressChart.update();
        }
        
        // 更新活動圖表（如果存在activityChart）
        if (typeof activityChart !== 'undefined' && activityChart && fitnessData.activity_data) {
            const activityData = fitnessData.activity_data;
            activityChart.data.labels = activityData.labels || [];
            activityChart.data.datasets[0].data = activityData.sets || [];
            activityChart.data.datasets[1].data = activityData.reps || [];
            activityChart.update();
        }
        
        console.log('健身報告數據更新完成');
    } else {
        console.warn('健身報告數據無效或為空');
    }
}

function updateDashboardUI(data) {
    console.log('更新儀表板UI');
    
    // 更新總重量
    const totalWeightElement = document.getElementById('total-weight');
    if (totalWeightElement) {
        totalWeightElement.textContent = `${data.total_weight.toFixed(1)} kg`;
    }
    
    // 更新總卡路里
    const totalCaloriesElement = document.getElementById('total-calories');
    if (totalCaloriesElement) {
        totalCaloriesElement.textContent = `${data.total_calories.toFixed(0)} 卡路里`;
        
        // 添加熱量百分比顯示
        // 假設每日目標熱量消耗為300卡路里
        const dailyCalorieGoal = 300;
        const caloriePercentage = Math.min(100, Math.round((data.total_calories / dailyCalorieGoal) * 100));
        
        // 創建或更新百分比顯示元素
        let caloriePercentElement = document.getElementById('calorie-percent');
        if (!caloriePercentElement) {
            caloriePercentElement = document.createElement('div');
            caloriePercentElement.id = 'calorie-percent';
            caloriePercentElement.className = 'stat-percentage';
            totalCaloriesElement.parentNode.appendChild(caloriePercentElement);
        }
        
        caloriePercentElement.textContent = `${caloriePercentage}% 目標`;
        caloriePercentElement.style.color = caloriePercentage >= 80 ? '#2ecc71' : 
                                           (caloriePercentage >= 50 ? '#f39c12' : '#e74c3c');
    }
    
    // 更新總訓練時間
    const totalTrainingTimeElement = document.getElementById('total-training-time');
    if (totalTrainingTimeElement) {
        const hours = Math.floor(data.total_training_time / 60);
        const minutes = data.total_training_time % 60;
        totalTrainingTimeElement.textContent = `${hours} 小時 ${minutes} 分鐘`;
    }
    
    // 更新訓練頻率
    const trainingFrequencyElement = document.getElementById('training-frequency');
    if (trainingFrequencyElement) {
        trainingFrequencyElement.textContent = `${data.training_frequency} 次/周`;
    }
}


// 渲染卡路里消耗趨勢圖
function renderCaloriesChart(caloriesTrend) {
    const ctx = document.getElementById('calories-chart');
    if (!ctx) {
        console.error('找不到卡路里圖表元素');
        return;
    }
    
    console.log('渲染卡路里消耗趨勢圖，原始數據:', caloriesTrend);
    
    // 如果已有圖表，先銷毀
    if (caloriesChart) {
        caloriesChart.destroy();
    }
    
    // 確保數據是數字類型
    let values = [];
    if (Array.isArray(caloriesTrend)) {
        values = caloriesTrend.map(val => Number(val) || 0);
        console.log('轉換後的數值數組:', values);
    } else {
        console.warn('卡路里趨勢數據不是數組:', caloriesTrend);
    }
    
    // 創建標籤（最近7天）
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('zh-TW', {month: 'short', day: 'numeric'}));
    }
    
    // 如果數據少於7天，補充為7天
    // 確保數據數組長度為7天，缺失的數據用0填充
    const paddedValues = Array(7).fill(0);
    
    // 將實際數據放在數組的末尾（最近的日期）
    for (let i = 0; i < Math.min(values.length, 7); i++) {
        paddedValues[7 - values.length + i] = values[i];
    }
    
    console.log('填充後的數據陣列:', paddedValues);
    console.log('對應的日期標籤:', labels);
    
    // 創建圖表
    try {
        caloriesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '卡路里消耗',
                    data: paddedValues,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(0)} 卡路里`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '卡路里',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    }
                }
            }
        });
        console.log('卡路里圖表創建成功');
    } catch (error) {
        console.error('創建卡路里圖表時出錯:', error);
    }
}



// 當前用戶變數已在頂部定義




// 每種運動的卡路里消耗
const CALORIES_PER_REP = {
'squat': 0.5,
'bicep-curl': 0.3,
'shoulder-press': 0.4,
'push-up': 0.3,
'pull-up': 0.5,
'dumbbell-row': 0.4
};


// 全局變量
let progressChart = null;
let activityChart = null;
let currentPeriod = 'week'; // 默認顯示一週的數據


// 初始化圖表
function initCharts() {
// 如果图表已存在，先销毁它们
if (progressChart) {
    progressChart.destroy();
}
if (activityChart) {
    activityChart.destroy();
}

const progressCtx = document.getElementById('progress-chart').getContext('2d');
const activityCtx = document.getElementById('activity-chart').getContext('2d');

progressChart = new Chart(progressCtx, {
    type: 'line',
    data: {
        labels: ['載入中...'],
        datasets: [
            {
                label: '運動次數',
                data: [0],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.3,
                fill: true
            },
            {
                label: '消耗熱量',
                data: [0],
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                tension: 0.3,
                fill: true
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: 'white'
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: 'white'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.2)'
                }
            },
            x: {
                ticks: {
                    color: 'white'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.2)'
                }
            }
        }
    }
});

activityChart = new Chart(activityCtx, {
    type: 'bar',
    data: {
        labels: ['載入中...'],
        datasets: [
            {
                label: '組數',
                data: [0],
                backgroundColor: 'rgba(52, 152, 219, 0.7)'
            },
            {
                label: '次數',
                data: [0],
                backgroundColor: 'rgba(46, 204, 113, 0.7)'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: 'white'
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: 'white'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.2)'
                }
            },
            x: {
                ticks: {
                    color: 'white'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.2)'
                }
            }
        }
    }
});
}


// 渲染肌肉群發展圖
function renderMuscleGrowthChart(muscleData) {
    const ctx = document.getElementById('muscle-growth-chart');
    if (!ctx) {
        console.error('找不到肌肉發展圖表元素');
        return;
    }
    
    console.log('渲染肌肉群發展圖:', muscleData);
    
    // 如果已有圖表，先銷毀
    if (muscleGrowthChart) {
        muscleGrowthChart.destroy();
    }
    
    // 確保數據是數字類型
    const rawData = [
        Number(muscleData.arms) || 0,
        Number(muscleData.chest) || 0,
        Number(muscleData.core) || 0,
        Number(muscleData.legs) || 0,
        Number(muscleData.shoulders) || 0
    ];
    
    // 計算肌肉發展百分比
    // 假設每個肌肉群的最大發展指數為1000
    const maxMuscleIndex = 1000;
    const percentageData = rawData.map(value => Math.min(100, Math.round((value / maxMuscleIndex) * 100)));
    
    // 創建肌肉發展百分比顯示
    createMusclePercentageDisplay(percentageData);
    
    muscleGrowthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['手臂', '胸部', '核心', '腿部', '肩膀'],
            datasets: [{
                label: '肌肉群發展',
                data: percentageData, // 使用百分比數據
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `發展程度: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100, // 設置最大值為100%
                    title: {
                        display: true,
                        text: '發展百分比 (%)',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            }
        }
    });
}



// 創建肌肉發展百分比顯示
function createMusclePercentageDisplay(percentageData) {
    // 獲取圖表容器
    const chartContainer = document.querySelector('.chart-container:nth-child(2)');
    if (!chartContainer) return;
    
    // 檢查是否已存在百分比顯示容器
    let percentContainer = document.getElementById('muscle-percentage-container');
    if (!percentContainer) {
        percentContainer = document.createElement('div');
        percentContainer.id = 'muscle-percentage-container';
        percentContainer.className = 'muscle-percentage-container';
        chartContainer.appendChild(percentContainer);
    } else {
        // 清空現有內容
        percentContainer.innerHTML = '';
    }
    
    // 肌肉群名稱
    const muscleNames = ['手臂', '胸部', '核心', '腿部', '肩膀'];
    
    // 創建每個肌肉群的百分比顯示
    muscleNames.forEach((name, index) => {
        const percentage = percentageData[index];
        
        const muscleItem = document.createElement('div');
        muscleItem.className = 'muscle-percentage-item';
        
        const muscleName = document.createElement('span');
        muscleName.className = 'muscle-name';
        muscleName.textContent = name;
        
        const musclePercentage = document.createElement('span');
        musclePercentage.className = 'muscle-percentage';
        musclePercentage.textContent = `${percentage}%`;
        
        // 根據百分比設置顏色
        if (percentage >= 70) {
            musclePercentage.style.color = '#2ecc71'; // 綠色
        } else if (percentage >= 40) {
            musclePercentage.style.color = '#f39c12'; // 橙色
        } else {
            musclePercentage.style.color = '#e74c3c'; // 紅色
        }
        
        muscleItem.appendChild(muscleName);
        muscleItem.appendChild(musclePercentage);
        percentContainer.appendChild(muscleItem);
    });
}


// 更新統計數據
function updateStats(data) {
// 防止數據為空
if (!data || data.length === 0) {
    console.warn("沒有可用的運動數據");
    document.getElementById('total-calories').textContent = "0";
    document.getElementById('total-sets').textContent = "0";
    document.getElementById('active-days').textContent = "0";
    
    // 清空图表数据
    progressChart.data.labels = ['無數據'];
    progressChart.data.datasets[0].data = [0];
    progressChart.data.datasets[1].data = [0];
    progressChart.update();
    
    activityChart.data.labels = ['無數據'];
    activityChart.data.datasets[0].data = [0];
    activityChart.data.datasets[1].data = [0];
    activityChart.update();
    
    return;
}

const totalCalories = data.reduce((sum, day) => sum + (day.weight * day.reps * day.sets * 0.1), 0);
const totalSets = data.reduce((sum, day) => sum + day.totalSets, 0);
const activeDays = new Set(data.map(day => day.date)).size; // 計算不重複的日期數

document.getElementById('total-calories').textContent = Math.round(totalCalories);
document.getElementById('total-sets').textContent = totalSets;
document.getElementById('active-days').textContent = activeDays;

// 獲取唯一的日期列表並排序
const uniqueDates = [...new Set(data.map(d => d.date))].sort();

// 為每個日期準備數據
const repsByDate = {};
const caloriesByDate = {};
const setsByDate = {};

uniqueDates.forEach(date => {
    repsByDate[date] = 0;
    caloriesByDate[date] = 0;
    setsByDate[date] = 0;
});

// 累計每個日期的數據
data.forEach(item => {
    repsByDate[item.date] += item.totalReps;
    caloriesByDate[item.date] += item.calories;
    setsByDate[item.date] += item.totalSets;
});

// 更新圖表數據
progressChart.data.labels = uniqueDates;
progressChart.data.datasets[0].data = uniqueDates.map(date => repsByDate[date]);
progressChart.data.datasets[1].data = uniqueDates.map(date => caloriesByDate[date]);
progressChart.update();

activityChart.data.labels = uniqueDates;
activityChart.data.datasets[0].data = uniqueDates.map(date => setsByDate[date]);
activityChart.data.datasets[1].data = uniqueDates.map(date => repsByDate[date]);
activityChart.update();
}

// 獲取數據
async function fetchData() {
    try {
        // 添加用户ID参数
        const response = await fetch(`/api/exercise_data?user_id=${currentUser}`);
        const result = await response.json();

        if (result.success && result.data) {
            console.log("API返回數據:", result.data);
            const processedData = processData(result.data);
            updateStats(processedData);
        } else {
            console.warn("未獲取到數據", result.message || "API返回格式不正確");
            // 显示无数据状态，不再使用随机数据
            updateStats([]);
        }
    } catch (error) {
        console.error("獲取數據錯誤:", error);
        // 显示无数据状态，不再使用随机数据
        updateStats([]);
    }
}

// 生成預設數據
function generateDefaultData() {
        const today = new Date();
        const data = [];
        
        // 生成過去7天的預設數據
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            data.push({
                date: dateStr,
                totalSets: Math.floor(Math.random() * 10) + 1,
                totalReps: Math.floor(Math.random() * 50) + 10,
                calories: Math.floor(Math.random() * 200) + 50,
                exercises: ['squat', 'push-up']
            });
        }
        
    return data;
}


function renderCaloriesChart(caloriesTrend) {
    console.log('開始渲染卡路里圖表，原始數據:', caloriesTrend);
    
    const ctx = document.getElementById('calories-chart');
    if (!ctx) {
        console.error('找不到卡路里圖表元素 #calories-chart');
        return;
    }
    
    console.log('找到卡路里圖表元素:', ctx);
    
    // 檢查 caloriesTrend 是否為有效數據
    if (!caloriesTrend) {
        console.error('卡路里趨勢數據為空或未定義');
        // 創建一個空圖表，避免顯示錯誤
        if (caloriesChart) {
            caloriesChart.destroy();
        }
        
        caloriesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['一', '二', '三', '四', '五', '六', '日'],
                datasets: [{
                    label: '卡路里消耗',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(0)} 卡路里`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '卡路里',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    }
                }
            }
        });
        console.log('創建了空的卡路里圖表');
        return;
    }
    
    // 如果已有圖表，先銷毀
    if (caloriesChart) {
        console.log('銷毀舊的卡路里圖表');
        caloriesChart.destroy();
    }
    
    // 確保數據是數字類型的數組
    let values = [];
    if (Array.isArray(caloriesTrend)) {
        values = caloriesTrend.map(val => {
            const num = Number(val);
            if (isNaN(num)) {
                console.warn(`卡路里值 "${val}" 不是有效數字，將使用 0 代替`);
                return 0;
            }
            return num;
        });
        console.log('處理後的卡路里數值數組:', values);
    } else {
        console.error('卡路里趨勢數據不是數組類型:', typeof caloriesTrend);
        values = [0, 0, 0, 0, 0, 0, 0];
    }
    
    // 創建標籤（最近7天）
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('zh-TW', {month: 'short', day: 'numeric'}));
    }
    console.log('日期標籤:', labels);
    
    // 如果數據少於7天，補充為7天
    const paddedValues = Array(7).fill(0);
    
    // 將實際數據放在數組末尾，確保最近的數據顯示在圖表右側
    if (values.length <= 7) {
        for (let i = 0; i < values.length; i++) {
            paddedValues[7 - values.length + i] = values[i];
        }
    } else {
        // 如果數據超過7天，只取最近7天
        for (let i = 0; i < 7; i++) {
            paddedValues[i] = values[values.length - 7 + i];
        }
    }
    
    console.log('填充後的卡路里數據:', paddedValues);
    
    // 創建圖表
    try {
        caloriesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '卡路里消耗',
                    data: paddedValues,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(0)} 卡路里`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '卡路里'
                        }
                    }
                }
            }
        });
        console.log('成功創建卡路里圖表');
    } catch (error) {
        console.error('創建卡路里圖表時出錯:', error);
    }
}



// 處理數據
function processData(records) {
// 確保records是一個數組
if (!Array.isArray(records)) {
    console.error("API返回的數據不是數組格式");
    return [];
}

const groupedData = {}; // 用來存放每一天的數據

// 按日期分組
records.forEach(record => {
    // 確保record是一個有效的對象
    if (!record || typeof record !== 'object') {
        return;
    }
    
    // 獲取日期
    const date = record.date || '';
    if (!date) return;
    
    if (!groupedData[date]) {
        groupedData[date] = {
            date: date,
            totalSets: 0,
            totalReps: 0,
            calories: 0,
            exercises: []
        };
    }
    
    // 從數據庫獲取的值可能是字符串，需要轉換為數字
    const sets = parseInt(record.total_sets) || 0;
    const reps = parseInt(record.total_reps) || 0;
    
    groupedData[date].totalSets += sets;
    groupedData[date].totalReps += reps;
    
    if (record.exercise_type) {
        if (!groupedData[date].exercises.includes(record.exercise_type)) {
            groupedData[date].exercises.push(record.exercise_type);
        }
        
        // 計算卡路里消耗
        const caloriesPerRep = CALORIES_PER_REP[record.exercise_type] || 0.3;
        groupedData[date].calories += reps * caloriesPerRep;
    }
});

// 轉換為數組並按日期排序
const result = Object.values(groupedData);
if (result.length === 0) {
    return [];
}
return result.sort((a, b) => new Date(a.date) - new Date(b.date));
}   


// 切換週期
function switchPeriod(period) {
    currentPeriod = period;
    
    // 移除所有按鈕的active類
    document.querySelectorAll('.time-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 添加當前按鈕的active類
    document.querySelector(`.time-button[data-period="${period}"]`).classList.add('active');
    
    fetchData();
}

// 顯示遊戲通知
function showNotification(title, message) {
    const notification = document.getElementById('game-notification');
    notification.querySelector('.notification-title').textContent = title;
    notification.querySelector('.notification-message').textContent = message;
    notification.classList.add('show');
    
    // 5秒後自動關閉
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// 關閉通知
function closeNotification() {
    document.getElementById('game-notification').classList.remove('show');
}

// 淡入效果
function handleIntersection(entries, observer) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}

// 渲染運動統計
function renderExerciseStats(exerciseStats) {
    const container = document.getElementById('exercise-stats-container');
    if (!container) {
        console.error('找不到運動統計容器元素');
        return;
    }
    
    console.log('渲染運動統計:', exerciseStats);
    
    if (!exerciseStats || exerciseStats.length === 0) {
        container.innerHTML = '<p class="no-data">暫無運動統計數據</p>';
        return;
    }
    
    // 創建運動統計HTML
    let html = '<div class="stats-grid">';
    
    exerciseStats.forEach(stat => {
        html += `
            <div class="stat-item">
                <div class="stat-name">${formatExerciseName(stat.name)}</div>
                <div class="stat-count">${stat.count} 次</div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${Math.min(100, stat.count / 2)}%"></div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}


// 渲染最近訓練記錄
function renderRecentExercises(recentExercises) {
    const container = document.getElementById('recent-exercises-container');
    if (!container) {
        console.error('找不到最近訓練記錄容器元素');
        return;
    }
    
    console.log('渲染最近訓練記錄:', recentExercises);
    
    if (!recentExercises || recentExercises.length === 0) {
        container.innerHTML = '<p class="no-data">暫無訓練記錄</p>';
        return;
    }
    
    // 創建最近訓練記錄HTML
    let html = '<div class="recent-list">';
    
    recentExercises.forEach(exercise => {
        html += `
            <div class="recent-item">
                <div class="recent-date">${exercise.date}</div>
                <div class="recent-exercise">${formatExerciseName(exercise.exercise)}</div>
                <div class="recent-reps">${exercise.reps} 次</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 格式化運動名稱
function formatExerciseName(name) {
    const nameMap = {
        'squat': '深蹲',
        'push-up': '伏地挺身',
        'bicep-curl': '二頭彎舉',
        'shoulder-press': '肩推',
        'pull-up': '引體向上',
        'dumbbell-row': '啞鈴划船',
        'tricep-extension': '三頭肌伸展',
        'lunge': '弓步蹲',
        'bench-press': '臥推'
    };
    
    return nameMap[name] || name;
}




