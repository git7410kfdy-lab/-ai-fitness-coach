/**
 * Workout Manager Module
 * 負責管理訓練計劃、進度追蹤和訓練數據統計
 */

class WorkoutManager {
    constructor() {
        // 訓練計劃狀態
        this.currentPlan = null;
        this.planProgress = {};
        this.isTrainingActive = false;
        
        // 訓練數據
        this.trainingData = {
            totalSessions: 0,
            totalExercises: 0,
            totalTime: 0,
            caloriesBurned: 0,
            averageQuality: 0,
            bestStreak: 0,
            currentStreak: 0
        };
        
        // 當前訓練會話
        this.currentSession = {
            startTime: null,
            endTime: null,
            exercises: [],
            totalCount: 0,
            averageQuality: 0,
            caloriesBurned: 0,
            duration: 0
        };
        
        // 訓練計劃模板
        this.planTemplates = {
            beginner: {
                id: 'beginner',
                name: '初學者計劃',
                description: '適合剛開始運動的新手',
                duration: '4週',
                difficulty: '簡單',
                exercises: [
                    {
                        type: 'squat',
                        name: '深蹲',
                        sets: 3,
                        reps: 10,
                        weight: 0,
                        restTime: 60,
                        completed: false
                    },
                    {
                        type: 'pushup',
                        name: '伏地挺身',
                        sets: 3,
                        reps: 8,
                        weight: 0,
                        restTime: 60,
                        completed: false
                    },
                    {
                        type: 'situp',
                        name: '仰臥起坐',
                        sets: 3,
                        reps: 12,
                        weight: 0,
                        restTime: 60,
                        completed: false
                    }
                ]
            },
            intermediate: {
                id: 'intermediate',
                name: '中級計劃',
                description: '適合有一定運動基礎的人',
                duration: '6週',
                difficulty: '中等',
                exercises: [
                    {
                        type: 'squat',
                        name: '深蹲',
                        sets: 4,
                        reps: 15,
                        weight: 10,
                        restTime: 90,
                        completed: false
                    },
                    {
                        type: 'pushup',
                        name: '伏地挺身',
                        sets: 4,
                        reps: 12,
                        weight: 0,
                        restTime: 90,
                        completed: false
                    },
                    {
                        type: 'situp',
                        name: '仰臥起坐',
                        sets: 4,
                        reps: 20,
                        weight: 5,
                        restTime: 90,
                        completed: false
                    },
                    {
                        type: 'basketball',
                        name: '籃球投籃',
                        sets: 3,
                        reps: 20,
                        weight: 0,
                        restTime: 120,
                        completed: false
                    }
                ]
            },
            advanced: {
                id: 'advanced',
                name: '高級計劃',
                description: '適合有豐富運動經驗的人',
                duration: '8週',
                difficulty: '困難',
                exercises: [
                    {
                        type: 'squat',
                        name: '深蹲',
                        sets: 5,
                        reps: 20,
                        weight: 20,
                        restTime: 120,
                        completed: false
                    },
                    {
                        type: 'pushup',
                        name: '伏地挺身',
                        sets: 5,
                        reps: 15,
                        weight: 0,
                        restTime: 120,
                        completed: false
                    },
                    {
                        type: 'situp',
                        name: '仰臥起坐',
                        sets: 5,
                        reps: 25,
                        weight: 10,
                        restTime: 120,
                        completed: false
                    },
                    {
                        type: 'basketball',
                        name: '籃球投籃',
                        sets: 4,
                        reps: 30,
                        weight: 0,
                        restTime: 150,
                        completed: false
                    },
                    {
                        type: 'basketball_dribble',
                        name: '籃球運球',
                        sets: 3,
                        reps: 50,
                        weight: 0,
                        restTime: 120,
                        completed: false
                    },
                    {
                        type: 'table_tennis',
                        name: '桌球',
                        sets: 3,
                        reps: 40,
                        weight: 0,
                        restTime: 120,
                        completed: false
                    }
                ]
            }
        };
        
        // 卡路里計算配置
        this.calorieConfig = {
            squat: 0.5,
            pushup: 0.4,
            situp: 0.3,
            basketball: 0.8,
            basketball_dribble: 0.6,
            table_tennis: 0.7
        };
        
        // 事件回調
        this.callbacks = {
            onPlanStarted: null,
            onPlanCompleted: null,
            onExerciseCompleted: null,
            onSessionStarted: null,
            onSessionEnded: null,
            onProgressUpdated: null
        };
    }

    /**
     * 初始化訓練管理器
     */
    init() {
        console.log('初始化訓練管理器');
        this.loadTrainingData();
        this.updateWorkoutPlanDisplay();
    }

    /**
     * 載入訓練數據
     */
    loadTrainingData() {
        try {
            const savedData = localStorage.getItem('workoutData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.trainingData = { ...this.trainingData, ...data };
            }
            
            const savedPlan = localStorage.getItem('currentWorkoutPlan');
            if (savedPlan) {
                this.currentPlan = JSON.parse(savedPlan);
            }
            
            const savedProgress = localStorage.getItem('planProgress');
            if (savedProgress) {
                this.planProgress = JSON.parse(savedProgress);
            }
            
            console.log('訓練數據載入完成');
        } catch (error) {
            console.error('載入訓練數據失敗:', error);
        }
    }

    /**
     * 保存訓練數據
     */
    saveTrainingData() {
        try {
            localStorage.setItem('workoutData', JSON.stringify(this.trainingData));
            localStorage.setItem('currentWorkoutPlan', JSON.stringify(this.currentPlan));
            localStorage.setItem('planProgress', JSON.stringify(this.planProgress));
            console.log('訓練數據已保存');
        } catch (error) {
            console.error('保存訓練數據失敗:', error);
        }
    }

    /**
     * 設置訓練計劃
     */
    setPlan(planId) {
        const template = this.planTemplates[planId];
        if (!template) {
            console.error(`找不到訓練計劃: ${planId}`);
            return false;
        }
        
        this.currentPlan = JSON.parse(JSON.stringify(template));
        this.planProgress = {
            planId: planId,
            startDate: new Date().toISOString(),
            completedExercises: [],
            totalProgress: 0,
            isCompleted: false
        };
        
        console.log(`設置訓練計劃: ${template.name}`);
        this.saveTrainingData();
        this.updateWorkoutPlanDisplay();
        
        if (this.callbacks.onPlanStarted) {
            this.callbacks.onPlanStarted(this.currentPlan);
        }
        
        return true;
    }

    /**
     * 開始訓練會話
     */
    startSession() {
        if (this.isTrainingActive) {
            console.log('訓練會話已在進行中');
            return false;
        }
        
        this.currentSession = {
            startTime: new Date(),
            endTime: null,
            exercises: [],
            totalCount: 0,
            averageQuality: 0,
            caloriesBurned: 0,
            duration: 0
        };
        
        this.isTrainingActive = true;
        console.log('開始訓練會話');
        
        if (this.callbacks.onSessionStarted) {
            this.callbacks.onSessionStarted(this.currentSession);
        }
        
        return true;
    }

    /**
     * 結束訓練會話
     */
    endSession() {
        if (!this.isTrainingActive) {
            console.log('沒有進行中的訓練會話');
            return false;
        }
        
        this.currentSession.endTime = new Date();
        this.currentSession.duration = Math.floor(
            (this.currentSession.endTime - this.currentSession.startTime) / 1000
        );
        
        // 計算平均品質
        if (this.currentSession.exercises.length > 0) {
            const totalQuality = this.currentSession.exercises.reduce(
                (sum, exercise) => sum + (exercise.averageQuality || 0), 0
            );
            this.currentSession.averageQuality = totalQuality / this.currentSession.exercises.length;
        }
        
        // 更新總體統計
        this.updateTrainingStats();
        
        this.isTrainingActive = false;
        console.log('結束訓練會話');
        
        if (this.callbacks.onSessionEnded) {
            this.callbacks.onSessionEnded(this.currentSession);
        }
        
        this.saveTrainingData();
        return true;
    }

    /**
     * 記錄運動數據
     */
    recordExercise(exerciseType, count, quality, weight = 0) {
        if (!this.isTrainingActive) {
            console.log('請先開始訓練會話');
            return false;
        }
        
        const exercise = {
            type: exerciseType,
            count: count,
            quality: quality,
            weight: weight,
            timestamp: new Date(),
            calories: this.calculateCalories(exerciseType, count, weight)
        };
        
        this.currentSession.exercises.push(exercise);
        this.currentSession.totalCount += count;
        this.currentSession.caloriesBurned += exercise.calories;
        
        console.log(`記錄運動: ${exerciseType}, 次數: ${count}, 品質: ${quality}`);
        
        // 檢查是否完成計劃中的運動
        this.checkExerciseCompletion(exerciseType, count);
        
        return true;
    }

    /**
     * 計算卡路里消耗
     */
    calculateCalories(exerciseType, count, weight = 0) {
        const baseCalorie = this.calorieConfig[exerciseType] || 0.5;
        const weightMultiplier = weight > 0 ? 1 + (weight * 0.1) : 1;
        return Math.round(count * baseCalorie * weightMultiplier);
    }

    /**
     * 檢查運動完成情況
     */
    checkExerciseCompletion(exerciseType, count) {
        if (!this.currentPlan) return;
        
        const exercise = this.currentPlan.exercises.find(ex => ex.type === exerciseType);
        if (!exercise || exercise.completed) return;
        
        // 檢查是否達到目標次數
        const totalCount = this.currentSession.exercises
            .filter(ex => ex.type === exerciseType)
            .reduce((sum, ex) => sum + ex.count, 0);
        
        const targetCount = exercise.sets * exercise.reps;
        
        if (totalCount >= targetCount) {
            exercise.completed = true;
            this.planProgress.completedExercises.push(exerciseType);
            
            console.log(`完成運動: ${exercise.name}`);
            
            if (this.callbacks.onExerciseCompleted) {
                this.callbacks.onExerciseCompleted(exercise);
            }
            
            // 檢查是否完成整個計劃
            this.checkPlanCompletion();
            
            // 更新進度顯示
            this.updateWorkoutPlanProgress();
        }
    }

    /**
     * 檢查計劃完成情況
     */
    checkPlanCompletion() {
        if (!this.currentPlan) return false;
        
        const allCompleted = this.currentPlan.exercises.every(exercise => exercise.completed);
        
        if (allCompleted && !this.planProgress.isCompleted) {
            this.planProgress.isCompleted = true;
            this.planProgress.completedDate = new Date().toISOString();
            
            // 更新連勝記錄
            this.trainingData.currentStreak++;
            if (this.trainingData.currentStreak > this.trainingData.bestStreak) {
                this.trainingData.bestStreak = this.trainingData.currentStreak;
            }
            
            console.log(`完成訓練計劃: ${this.currentPlan.name}`);
            
            if (this.callbacks.onPlanCompleted) {
                this.callbacks.onPlanCompleted(this.currentPlan);
            }
            
            this.saveTrainingData();
            return true;
        }
        
        return false;
    }

    /**
     * 更新訓練統計
     */
    updateTrainingStats() {
        this.trainingData.totalSessions++;
        this.trainingData.totalExercises += this.currentSession.exercises.length;
        this.trainingData.totalTime += this.currentSession.duration;
        this.trainingData.caloriesBurned += this.currentSession.caloriesBurned;
        
        // 更新平均品質
        const totalQuality = this.trainingData.averageQuality * (this.trainingData.totalSessions - 1) + 
                           this.currentSession.averageQuality;
        this.trainingData.averageQuality = totalQuality / this.trainingData.totalSessions;
    }

    /**
     * 重置當前計劃
     */
    resetCurrentPlan() {
        if (!this.currentPlan) return false;
        
        // 重置所有運動的完成狀態
        this.currentPlan.exercises.forEach(exercise => {
            exercise.completed = false;
        });
        
        // 重置進度
        this.planProgress = {
            planId: this.planProgress.planId,
            startDate: new Date().toISOString(),
            completedExercises: [],
            totalProgress: 0,
            isCompleted: false
        };
        
        console.log('重置當前訓練計劃');
        this.saveTrainingData();
        this.updateWorkoutPlanDisplay();
        
        return true;
    }

    /**
     * 更新訓練計劃顯示
     */
    updateWorkoutPlanDisplay() {
        const planContainer = document.getElementById('workout-plan');
        if (!planContainer) return;
        
        if (!this.currentPlan) {
            planContainer.innerHTML = '<p>請選擇一個訓練計劃</p>';
            return;
        }
        
        let html = `
            <div class="plan-header">
                <h3>${this.currentPlan.name}</h3>
                <p>${this.currentPlan.description}</p>
                <div class="plan-info">
                    <span>難度: ${this.currentPlan.difficulty}</span>
                    <span>持續時間: ${this.currentPlan.duration}</span>
                </div>
            </div>
            <div class="exercise-list">
        `;
        
        this.currentPlan.exercises.forEach((exercise, index) => {
            const isCompleted = exercise.completed;
            const statusClass = isCompleted ? 'completed' : 'pending';
            const statusText = isCompleted ? '已完成' : '待完成';
            
            html += `
                <div class="exercise-item ${statusClass}">
                    <div class="exercise-info">
                        <h4>${exercise.name}</h4>
                        <p>${exercise.sets} 組 × ${exercise.reps} 次</p>
                        ${exercise.weight > 0 ? `<p>重量: ${exercise.weight}kg</p>` : ''}
                        <p>休息時間: ${exercise.restTime}秒</p>
                    </div>
                    <div class="exercise-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        planContainer.innerHTML = html;
    }

    /**
     * 更新訓練計劃進度
     */
    updateWorkoutPlanProgress() {
        if (!this.currentPlan) return;
        
        const completedCount = this.currentPlan.exercises.filter(ex => ex.completed).length;
        const totalCount = this.currentPlan.exercises.length;
        const progressPercentage = Math.round((completedCount / totalCount) * 100);
        
        this.planProgress.totalProgress = progressPercentage;
        
        // 更新進度條
        const progressBar = document.querySelector('.plan-progress-bar');
        const progressText = document.querySelector('.plan-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${completedCount}/${totalCount} (${progressPercentage}%)`;
        }
        
        if (this.callbacks.onProgressUpdated) {
            this.callbacks.onProgressUpdated(this.planProgress);
        }
    }

    /**
     * 獲取訓練統計
     */
    getTrainingStats() {
        return {
            ...this.trainingData,
            currentPlan: this.currentPlan,
            planProgress: this.planProgress,
            isTrainingActive: this.isTrainingActive,
            currentSession: this.isTrainingActive ? this.currentSession : null
        };
    }

    /**
     * 獲取可用的訓練計劃
     */
    getAvailablePlans() {
        return Object.values(this.planTemplates);
    }

    /**
     * 獲取當前計劃
     */
    getCurrentPlan() {
        return this.currentPlan;
    }

    /**
     * 獲取計劃進度
     */
    getPlanProgress() {
        return this.planProgress;
    }

    /**
     * 檢查是否有進行中的訓練
     */
    isTraining() {
        return this.isTrainingActive;
    }

    /**
     * 檢查所有運動是否完成
     */
    checkAllExercisesCompleted() {
        if (!this.currentPlan) return false;
        return this.currentPlan.exercises.every(exercise => exercise.completed);
    }

    /**
     * 獲取運動建議
     */
    getExerciseRecommendation() {
        if (!this.currentPlan) return null;
        
        const incompleteExercises = this.currentPlan.exercises.filter(ex => !ex.completed);
        if (incompleteExercises.length === 0) return null;
        
        return incompleteExercises[0]; // 返回第一個未完成的運動
    }

    /**
     * 格式化時間
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 導出訓練數據
     */
    exportTrainingData() {
        const data = {
            trainingData: this.trainingData,
            currentPlan: this.currentPlan,
            planProgress: this.planProgress,
            exportDate: new Date().toISOString()
        };
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * 導入訓練數據
     */
    importTrainingData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.trainingData) {
                this.trainingData = { ...this.trainingData, ...data.trainingData };
            }
            
            if (data.currentPlan) {
                this.currentPlan = data.currentPlan;
            }
            
            if (data.planProgress) {
                this.planProgress = data.planProgress;
            }
            
            this.saveTrainingData();
            this.updateWorkoutPlanDisplay();
            
            console.log('訓練數據導入成功');
            return true;
        } catch (error) {
            console.error('導入訓練數據失敗:', error);
            return false;
        }
    }

    /**
     * 設置事件回調
     */
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
}

// 導出 WorkoutManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkoutManager;
} else {
    window.WorkoutManager = WorkoutManager;
}