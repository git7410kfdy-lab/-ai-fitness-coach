// 任務處理模組 - 處理從首頁任務板傳來的任務數據
class QuestHandler {
    constructor() {
        this.currentQuest = null;
        // 確保DOM載入完成後再初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('QuestHandler 初始化開始');
        
        // 檢查是否有保存的任務數據
        const questData = localStorage.getItem('currentQuest');
        if (questData) {
            try {
                this.currentQuest = JSON.parse(questData);
                console.log('載入任務數據:', this.currentQuest);
                
                // 延遲執行以確保所有模組都已載入
                setTimeout(() => {
                    this.fillWorkoutForm();
                    this.displayQuestInfo();
                    // 確保在所有初始化完成後再自動保存
                    setTimeout(() => {
                        this.autoSaveWorkoutPlan();
                    }, 1000);
                }, 500);
                
                // 清除localStorage中的數據
                localStorage.removeItem('currentQuest');
            } catch (error) {
                console.error('解析任務數據失敗:', error);
                localStorage.removeItem('currentQuest');
            }
        }
    }

    // 從 localStorage 載入任務數據
    loadQuestFromStorage() {
        const questData = localStorage.getItem('currentQuest');
        if (questData) {
            try {
                this.currentQuest = JSON.parse(questData);
                console.log('載入任務數據:', this.currentQuest);
                
                // 延遲執行，確保所有DOM元素都已載入
                setTimeout(() => {
                    // 自動填充訓練計劃表單
                    this.fillWorkoutForm();
                    
                    // 顯示任務信息
                    this.displayQuestInfo();
                }, 100);
                
                // 清除 localStorage 中的任務數據（避免重複載入）
                localStorage.removeItem('currentQuest');
            } catch (error) {
                console.error('解析任務數據失敗:', error);
                localStorage.removeItem('currentQuest');
            }
        }
    }

        // 自動填充訓練計劃表單
        fillWorkoutForm() {
            if (!this.currentQuest || !this.currentQuest.workoutPlan) {
                console.log('沒有任務數據或訓練計劃');
                return;
            }

            const workoutPlan = this.currentQuest.workoutPlan;
            const exercisesContainer = document.getElementById('workout-exercises');
            
            if (!exercisesContainer) {
                console.error('找不到訓練計劃容器，等待DOM載入...');
                // 重試機制
                setTimeout(() => this.fillWorkoutForm(), 500);
                return;
            }

            console.log('開始填充訓練計劃表單:', workoutPlan);
            
            // 清空現有的訓練項目
            exercisesContainer.innerHTML = '';
            
            // 添加任務標題
            const questTitle = document.createElement('div');
            questTitle.className = 'quest-title';
            questTitle.innerHTML = `
                <h3>🎯 當前任務: ${this.currentQuest.questData.title}</h3>
                <p>難度: ${'★'.repeat(this.currentQuest.questData.difficulty)} | 獎勵: ${this.currentQuest.questData.rewards.exp} EXP + ${this.currentQuest.questData.rewards.gold} 金幣</p>
            `;
            exercisesContainer.appendChild(questTitle);
            
            // 添加訓練項目 - 使用正確的HTML結構
            workoutPlan.forEach((exercise, index) => {
                this.addExerciseItem(exercise, index);
            });
            
            // 自動保存訓練計劃
            this.autoSaveWorkoutPlan();
        }

    // 添加運動項目到表單
    addExerciseItem(exercise, index) {
        const exercisesContainer = document.getElementById('workout-exercises');
        const exerciseItem = document.createElement('div');
        exerciseItem.className = 'workout-exercise-item';
        exerciseItem.dataset.index = index;

        exerciseItem.innerHTML = `
            <div class="exercise-item-header">
                <span class="exercise-number">${index + 1}</span>
                <button type="button" class="remove-exercise-btn" title="移除此運動">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="exercise-item-body">
                <div class="input-group">
                    <label>運動類型</label>
                    <select name="exercise-type[]" class="exercise-selector" required>
                        <option value="squat" ${exercise.exerciseType === 'squat' ? 'selected' : ''}>深蹲</option>
                        <option value="bicep-curl" ${exercise.exerciseType === 'bicep-curl' ? 'selected' : ''}>二頭彎舉</option>
                        <option value="shoulder-press" ${exercise.exerciseType === 'shoulder-press' ? 'selected' : ''}>肩推</option>
                        <option value="push-up" ${exercise.exerciseType === 'push-up' ? 'selected' : ''}>伏地挺身</option>
                        <option value="pull-up" ${exercise.exerciseType === 'pull-up' ? 'selected' : ''}>引體向上</option>
                        <option value="dumbbell-row" ${exercise.exerciseType === 'dumbbell-row' ? 'selected' : ''}>啞鈴划船</option>
                        <option value="table-tennis" ${exercise.exerciseType === 'table-tennis' ? 'selected' : ''}>桌球揮拍</option>
                        <option value="basketball" ${exercise.exerciseType === 'basketball' ? 'selected' : ''}>籃球投籃</option>
                        <option value="basketball-dribble" ${exercise.exerciseType === 'basketball-dribble' ? 'selected' : ''}>籃球運球</option>
                    </select>
                </div>
                <div class="exercise-params">
                    <div class="input-group">
                        <label>重量 (kg)</label>
                        <input type="number" name="weight[]" value="${exercise.weight || 0}" min="0" max="200">
                    </div>
                    <div class="input-group">
                        <label>次數/組</label>
                        <input type="number" name="reps[]" value="${exercise.reps}" min="1" max="100" required>
                    </div>
                    <div class="input-group">
                        <label>組數</label>
                        <input type="number" name="sets[]" value="${exercise.sets}" min="1" max="10" required>
                    </div>
                </div>
            </div>
        `;

        exercisesContainer.appendChild(exerciseItem);
    }

    // 顯示任務信息
    displayQuestInfo() {
        if (!this.currentQuest) return;

        const questData = this.currentQuest.questData;
        
        // 創建任務信息顯示區域
        const questInfoContainer = this.createQuestInfoDisplay(questData);
        
        // 插入到訓練計劃容器前面
        const workoutContainer = document.querySelector('.workout-plan-container');
        if (workoutContainer) {
            workoutContainer.insertBefore(questInfoContainer, workoutContainer.firstChild);
        }
    }

    // 創建任務信息顯示元素
    createQuestInfoDisplay(questData) {
        const container = document.createElement('div');
        container.className = 'current-quest-info';
        container.innerHTML = `
            <div class="quest-info-header">
                <h3><i class="fas fa-scroll"></i> 當前任務</h3>
                <button type="button" class="close-quest-btn" title="取消任務">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="quest-info-body">
                <div class="quest-title">${questData.title}</div>
                <div class="quest-description">${questData.description}</div>
                <div class="quest-details">
                    <span class="quest-difficulty">難度: ${'★'.repeat(questData.difficulty)}</span>
                    <span class="quest-time">預估時間: ${questData.estimatedTime}分鐘</span>
                    <span class="quest-rewards">獎勵: ${questData.rewards.exp} EXP + ${questData.rewards.gold} 金幣</span>
                </div>
            </div>
        `;

        // 綁定取消任務事件
        const closeBtn = container.querySelector('.close-quest-btn');
        closeBtn.addEventListener('click', () => {
            this.cancelQuest();
        });

        return container;
    }

    // 自動保存訓練計劃
    autoSaveWorkoutPlan() {
        if (!this.currentQuest || !this.currentQuest.workoutPlan) {
            console.log('沒有任務數據，無法自動保存訓練計劃');
            return;
        }

        // 直接設置全域 workoutPlan 變數
        if (typeof window.workoutPlan !== 'undefined') {
            // 將任務的 workoutPlan 轉換為 realtime.js 期望的格式
            window.workoutPlan = this.currentQuest.workoutPlan.map((exercise, index) => ({
                type: exercise.exerciseType,
                weight: exercise.weight || 0,
                reps: exercise.reps,
                sets: 1, // 每個項目都是1組
                originalSets: exercise.sets, // 記錄原始組數
                setNumber: exercise.setNumber || 1,
                exerciseIndex: exercise.exerciseIndex || index,
                studentId: exercise.studentId || window.studentId
            }));
            
            // 重置當前運動索引
            if (typeof window.currentExerciseIndex !== 'undefined') {
                window.currentExerciseIndex = 0;
            }
            
            // 初始化第一個運動
            if (typeof window.initCurrentExercise === 'function' && window.workoutPlan.length > 0) {
                window.initCurrentExercise();
            }
            
            // 更新訓練計劃顯示
            if (typeof window.updateWorkoutPlanDisplay === 'function') {
                window.updateWorkoutPlanDisplay();
            }
            
            // 更新訓練計劃摘要
            if (typeof window.updateWorkoutPlanSummary === 'function') {
                window.updateWorkoutPlanSummary();
            }
            
            console.log('任務訓練計劃已自動載入到全域變數:', window.workoutPlan);
            
            // 顯示提示
            if (window.showToast) {
                showToast('任務訓練計劃已自動載入');
            }
        } else {
            console.error('找不到全域 workoutPlan 變數');
            
            // 備用方案：觸發保存按鈕
            const saveBtn = document.getElementById('save-workout-plan');
            if (saveBtn) {
                saveBtn.click();
                
                if (window.showToast) {
                    showToast('任務訓練計劃已自動載入');
                }
            }
        }
    }

    // 取消任務
    cancelQuest() {
        this.currentQuest = null;
        
        // 移除任務信息顯示
        const questInfo = document.querySelector('.current-quest-info');
        if (questInfo) {
            questInfo.remove();
        }
        
        // 清空訓練計劃表單
        this.clearWorkoutForm();
        
        if (window.showToast) {
            showToast('已取消當前任務');
        }
    }

    // 清空訓練計劃表單
    clearWorkoutForm() {
        const exercisesContainer = document.getElementById('workout-exercises');
        if (exercisesContainer) {
            exercisesContainer.innerHTML = `
                <div class="workout-exercise-item" data-index="0">
                    <div class="exercise-item-header">
                        <span class="exercise-number">1</span>
                        <button type="button" class="remove-exercise-btn" title="移除此運動">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="exercise-item-body">
                        <div class="input-group">
                            <label for="exercise-type">運動類型</label>
                            <select id="exercise-type" name="exercise-type[]" class="exercise-selector" required>
                                <option value="squat">深蹲</option>
                                <option value="bicep-curl">二頭彎舉</option>
                                <option value="shoulder-press">肩推</option>
                                <option value="push-up">伏地挺身</option>
                                <option value="pull-up">引體向上</option>
                                <option value="dumbbell-row">啞鈴划船</option>
                                <option value="table-tennis">桌球揮拍</option>
                                <option value="basketball">籃球投籃</option>
                                <option value="basketball-dribble">籃球運球</option>
                            </select>
                        </div>
                        <div class="exercise-params">
                            <div class="input-group">
                                <label for="weight">重量 (kg)</label>
                                <input type="number" id="weight" name="weight[]" placeholder="0" min="0" max="200" value="0">
                            </div>
                            <div class="input-group">
                                <label for="reps">次數/組</label>
                                <input type="number" id="reps" name="reps[]" placeholder="10" min="1" max="100" value="10" required>
                            </div>
                            <div class="input-group">
                                <label for="sets">組數</label>
                                <input type="number" id="sets" name="sets[]" placeholder="3" min="1" max="10" value="3" required>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // 綁定事件
    bindEvents() {
        // 監聽訓練完成事件
        document.addEventListener('questCompleted', (event) => {
            this.handleQuestCompletion(event.detail);
        });
    }

    // 處理任務完成
    handleQuestCompletion(completionData) {
        if (!this.currentQuest) return;

        // 通知任務板任務已完成
        if (window.questBoard) {
            window.questBoard.completeQuest(this.currentQuest.questId);
        }

        // 顯示完成提示
        if (window.showToast) {
            showToast(`任務「${this.currentQuest.questData.title}」已完成！`);
        }

        // 清理當前任務
        this.currentQuest = null;
        
        // 移除任務信息顯示
        const questInfo = document.querySelector('.current-quest-info');
        if (questInfo) {
            questInfo.remove();
        }
    }

    // 獲取當前任務
    getCurrentQuest() {
        return this.currentQuest;
    }
}

// 確保在DOM載入完成後創建實例
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.questHandler = new QuestHandler();
        });
    } else {
        window.questHandler = new QuestHandler();
    }
}


// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestHandler;
}