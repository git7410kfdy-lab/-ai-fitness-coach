// 冒險者工會任務板模組
class QuestBoard {
    constructor() {
        this.quests = [];
        this.userLevel = 1;
        this.userExp = 0;
        this.completedQuests = new Set();
        this.init();
    }

    init() {
        this.generateQuests();
        this.loadProgress();
        this.unlockQuests();
        this.renderQuestBoard();
        this.bindEvents();
    }

    // 生成任務數據
    generateQuests() {
        this.quests = [
            {
                id: 'quest_001',
                title: '新手冒險者試煉',
                description: '完成基礎體能訓練，證明你的決心',
                difficulty: 1,
                exercises: [
                    { type: 'squat', name: '深蹲', reps: 10, sets: 2, weight: 0 },
                    { type: 'push-up', name: '伏地挺身', reps: 8, sets: 2, weight: 0 }
                ],
                rewards: { exp: 50, gold: 100 },
                estimatedTime: 15,
                category: 'beginner',
                status: 'available'
            },
            {
                id: 'quest_002',
                title: '力量覺醒',
                description: '挑戰更高強度的力量訓練',
                difficulty: 2,
                exercises: [
                    { type: 'squat', name: '深蹲', reps: 15, sets: 3, weight: 5 },
                    { type: 'bicep-curl', name: '二頭彎舉', reps: 12, sets: 3, weight: 3 },
                    { type: 'shoulder-press', name: '肩推', reps: 10, sets: 2, weight: 3 }
                ],
                rewards: { exp: 80, gold: 150 },
                estimatedTime: 25,
                category: 'intermediate',
                status: 'available'
            },
            {
                id: 'quest_003',
                title: '上肢強化特訓',
                description: '專注於上肢肌群的全面發展',
                difficulty: 3,
                exercises: [
                    { type: 'push-up', name: '伏地挺身', reps: 20, sets: 3, weight: 0 },
                    { type: 'pull-up', name: '引體向上', reps: 8, sets: 3, weight: 0 },
                    { type: 'dumbbell-row', name: '啞鈴划船', reps: 15, sets: 3, weight: 5 }
                ],
                rewards: { exp: 120, gold: 200 },
                estimatedTime: 30,
                category: 'intermediate',
                status: 'available'
            },
            {
                id: 'quest_004',
                title: '運動技能大師',
                description: '掌握多種運動技能，成為全能戰士',
                difficulty: 4,
                exercises: [
                    { type: 'squat', name: '深蹲', reps: 25, sets: 4, weight: 10 },
                    { type: 'table-tennis', name: '桌球揮拍', reps: 50, sets: 3, weight: 0 },
                    { type: 'basketball', name: '籃球投籃', reps: 20, sets: 2, weight: 0 }
                ],
                rewards: { exp: 150, gold: 250 },
                estimatedTime: 40,
                category: 'advanced',
                status: 'locked'
            },
            {
                id: 'quest_005',
                title: '傳說級挑戰',
                description: '只有真正的勇者才能完成的終極試煉',
                difficulty: 5,
                exercises: [
                    { type: 'squat', name: '深蹲', reps: 30, sets: 5, weight: 15 },
                    { type: 'push-up', name: '伏地挺身', reps: 25, sets: 4, weight: 0 },
                    { type: 'bicep-curl', name: '二頭彎舉', reps: 20, sets: 4, weight: 8 },
                    { type: 'basketball-dribble', name: '籃球運球', reps: 100, sets: 2, weight: 0 }
                ],
                rewards: { exp: 300, gold: 500 },
                estimatedTime: 60,
                category: 'legendary',
                status: 'locked'
            },
            {
                id: 'quest_006',
                title: '核心力量專精',
                description: '強化核心肌群，提升整體穩定性',
                difficulty: 2,
                exercises: [
                    { type: 'squat', name: '深蹲', reps: 20, sets: 3, weight: 5 },
                    { type: 'shoulder-press', name: '肩推', reps: 15, sets: 3, weight: 5 }
                ],
                rewards: { exp: 90, gold: 160 },
                estimatedTime: 20,
                category: 'intermediate',
                status: 'available'
            }
        ];
    }

    // 渲染任務板
    renderQuestBoard() {
        const questBoard = document.getElementById('quest-board');
        if (!questBoard) return;

        questBoard.innerHTML = `
            <div class="quest-board-header">
                <h2>🏛️ 冒險者工會任務板</h2>
                <div class="adventurer-info">
                    <span class="adventurer-level">等級 ${this.userLevel}</span>
                    <div class="exp-bar">
                        <div class="exp-fill" style="width: ${(this.userExp % 100)}%"></div>
                    </div>
                    <span class="exp-text">${this.userExp}/100 EXP</span>
                </div>
            </div>
            <div class="quest-filters">
                <button class="filter-btn active" data-category="all">全部任務</button>
                <button class="filter-btn" data-category="beginner">新手</button>
                <button class="filter-btn" data-category="intermediate">進階</button>
                <button class="filter-btn" data-category="advanced">高級</button>
                <button class="filter-btn" data-category="legendary">傳說</button>
            </div>
            <div class="quest-grid">
                ${this.quests.map(quest => this.renderQuestCard(quest)).join('')}
            </div>
        `;
    }

    // 渲染單個任務卡片
    renderQuestCard(quest) {
        const difficultyStars = '⭐'.repeat(quest.difficulty);
        const statusClass = quest.status === 'locked' ? 'locked' : 
                           quest.status === 'completed' ? 'completed' : 'available';
        
        const exerciseList = quest.exercises.map(ex => 
            `<li>${ex.name} ${ex.reps}次 × ${ex.sets}組${ex.weight > 0 ? ` (${ex.weight}kg)` : ''}</li>`
        ).join('');

        return `
            <div class="quest-card ${statusClass}" data-quest-id="${quest.id}">
                <div class="quest-header">
                    <h3 class="quest-title">${quest.title}</h3>
                    <div class="quest-difficulty">${difficultyStars}</div>
                </div>
                <p class="quest-description">${quest.description}</p>
                <div class="quest-exercises">
                    <h4>訓練內容：</h4>
                    <ul>${exerciseList}</ul>
                </div>
                <div class="quest-info">
                    <div class="quest-time">⏱️ ${quest.estimatedTime} 分鐘</div>
                    <div class="quest-rewards">
                        <span class="exp-reward">💎 ${quest.rewards.exp} EXP</span>
                        <span class="gold-reward">🪙 ${quest.rewards.gold} 金幣</span>
                    </div>
                </div>
                <div class="quest-actions">
                    ${this.getQuestActionButton(quest)}
                </div>
            </div>
        `;
    }

    // 獲取任務操作按鈕
    getQuestActionButton(quest) {
        switch(quest.status) {
            case 'locked':
                return '<button class="quest-btn locked" disabled>🔒 未解鎖</button>';
            case 'completed':
                return '<button class="quest-btn completed" disabled>✅ 已完成</button>';
            case 'available':
            default:
                return `<button class="quest-btn accept" onclick="questBoard.acceptQuest('${quest.id}')">⚔️ 接受任務</button>`;
        }
    }

    // 接受任務
    acceptQuest(questId) {
        const quest = this.quests.find(q => q.id === questId);
        if (!quest || quest.status !== 'available') return;

        // 將任務數據轉換為訓練計劃格式
        const workoutPlan = quest.exercises.map((exercise, index) => ({
            exerciseType: exercise.type,
            name: exercise.name,  // 添加這一行
            weight: exercise.weight,
            reps: exercise.reps,
            sets: exercise.sets,
            originalSets: exercise.sets,
            setNumber: 1,
            exerciseIndex: index,
            questId: questId,
            questTitle: quest.title
        }));

        // 保存到 localStorage
        localStorage.setItem('currentQuest', JSON.stringify({
            questId: questId,
            questData: quest,
            workoutPlan: workoutPlan
        }));

        // 跳轉到即時訓練頁面
        window.location.href = '/realtime';
    }

    // 篩選任務
    filterQuests(category) {
        const questCards = document.querySelectorAll('.quest-card');
        const filterBtns = document.querySelectorAll('.filter-btn');
        
        // 更新按鈕狀態
        filterBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // 篩選卡片
        questCards.forEach(card => {
            const questId = card.dataset.questId;
            const quest = this.quests.find(q => q.id === questId);
            
            if (category === 'all' || quest.category === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // 綁定事件
    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                const category = e.target.dataset.category;
                this.filterQuests(category);
            }
        });
    }

    // 完成任務（從其他頁面調用）
    completeQuest(questId) {
        const quest = this.quests.find(q => q.id === questId);
        if (!quest) return;

        quest.status = 'completed';
        this.completedQuests.add(questId);
        this.userExp += quest.rewards.exp;
        
        // 檢查升級
        while (this.userExp >= 100) {
            this.userExp -= 100;
            this.userLevel++;
        }

        // 解鎖新任務
        this.unlockQuests();
        
        // 保存進度
        this.saveProgress();
        
        // 重新渲染
        this.renderQuestBoard();
    }

    // 解鎖任務邏輯
    unlockQuests() {
        // 根據等級和完成的任務解鎖新任務
        this.quests.forEach(quest => {
            if (quest.status === 'locked') {
                if (quest.difficulty <= this.userLevel || 
                    (quest.id === 'quest_004' && this.completedQuests.size >= 3)) {
                    quest.status = 'available';
                }
            }
        });
    }

    // 保存進度
    saveProgress() {
        const progress = {
            userLevel: this.userLevel,
            userExp: this.userExp,
            completedQuests: Array.from(this.completedQuests),
            questStatuses: this.quests.map(q => ({ id: q.id, status: q.status }))
        };
        localStorage.setItem('questProgress', JSON.stringify(progress));
    }

    // 載入進度
    loadProgress() {
        const saved = localStorage.getItem('questProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.userLevel = progress.userLevel || 1;
            this.userExp = progress.userExp || 0;
            this.completedQuests = new Set(progress.completedQuests || []);
            
            // 恢復任務狀態
            if (progress.questStatuses) {
                progress.questStatuses.forEach(status => {
                    const quest = this.quests.find(q => q.id === status.id);
                    if (quest) quest.status = status.status;
                });
            }
        }
    }
}

// 創建全局實例
window.questBoard = new QuestBoard();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestBoard;
}