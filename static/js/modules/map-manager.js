/**
 * Map Manager Module
 * 負責管理地圖系統、關卡選擇和地圖滾動功能
 */

class MapManager {
    constructor() {
        // 地圖狀態
        this.currentLevel = 1;
        this.selectedLevel = 1;
        this.unlockedLevels = [1]; // 已解鎖的關卡
        
        // 滾動狀態
        this.miniMapScrollPosition = 0;
        this.fullMapScrollPosition = 0;
        this.scrollStep = 100;
        
        // 地圖配置
        this.mapConfig = {
            miniMap: {
                container: '#mini-map',
                scrollContainer: '.mini-map-scroll',
                leftBtn: '#mini-map-left',
                rightBtn: '#mini-map-right',
                levelDots: '.level-dot'
            },
            fullMap: {
                container: '#full-map',
                scrollContainer: '.full-map-scroll',
                leftBtn: '#full-map-left',
                rightBtn: '#full-map-right',
                levelItems: '.level-item'
            }
        };
        
        // 關卡數據
        this.levels = [
            {
                id: 1,
                name: '新手村',
                description: '適合初學者的訓練場地',
                monsters: 3,
                difficulty: '簡單',
                rewards: ['經驗值 +50', '金幣 +100'],
                unlocked: true,
                completed: false
            },
            {
                id: 2,
                name: '森林',
                description: '充滿挑戰的森林訓練',
                monsters: 4,
                difficulty: '普通',
                rewards: ['經驗值 +75', '金幣 +150'],
                unlocked: false,
                completed: false
            },
            {
                id: 3,
                name: '山洞',
                description: '黑暗中的力量考驗',
                monsters: 5,
                difficulty: '困難',
                rewards: ['經驗值 +100', '金幣 +200'],
                unlocked: false,
                completed: false
            },
            {
                id: 4,
                name: '城堡',
                description: '最終的王者挑戰',
                monsters: 6,
                difficulty: '極難',
                rewards: ['經驗值 +150', '金幣 +300', '特殊獎勵'],
                unlocked: false,
                completed: false
            }
        ];
        
        // 觸摸滑動狀態
        this.touchState = {
            startX: 0,
            startY: 0,
            isScrolling: false,
            target: null
        };
        
        // 事件回調
        this.callbacks = {
            onLevelSelected: null,
            onLevelUnlocked: null,
            onMapScrolled: null
        };
    }

    /**
     * 初始化地圖管理器
     */
    init() {
        console.log('初始化地圖管理器');
        this.initMiniMapScroll();
        this.initFullMapScroll();
        this.setupMapModal();
        this.updateMapDisplay();
    }

    /**
     * 初始化小地圖滾動
     */
    initMiniMapScroll() {
        const leftBtn = document.querySelector(this.mapConfig.miniMap.leftBtn);
        const rightBtn = document.querySelector(this.mapConfig.miniMap.rightBtn);
        const scrollContainer = document.querySelector(this.mapConfig.miniMap.scrollContainer);
        
        if (leftBtn) {
            leftBtn.addEventListener('click', () => {
                this.scrollMiniMap('left');
            });
        }
        
        if (rightBtn) {
            rightBtn.addEventListener('click', () => {
                this.scrollMiniMap('right');
            });
        }
        
        // 觸摸滑動支持
        if (scrollContainer) {
            this.setupTouchScroll(scrollContainer, 'mini');
        }
        
        // 關卡點擊事件
        this.setupLevelClickEvents('mini');
    }

    /**
     * 初始化詳細地圖滾動
     */
    initFullMapScroll() {
        const leftBtn = document.querySelector(this.mapConfig.fullMap.leftBtn);
        const rightBtn = document.querySelector(this.mapConfig.fullMap.rightBtn);
        const scrollContainer = document.querySelector(this.mapConfig.fullMap.scrollContainer);
        
        if (leftBtn) {
            leftBtn.addEventListener('click', () => {
                this.scrollFullMap('left');
            });
        }
        
        if (rightBtn) {
            rightBtn.addEventListener('click', () => {
                this.scrollFullMap('right');
            });
        }
        
        // 觸摸滑動支持
        if (scrollContainer) {
            this.setupTouchScroll(scrollContainer, 'full');
        }
        
        // 關卡點擊事件
        this.setupLevelClickEvents('full');
    }

    /**
     * 設置觸摸滑動
     */
    setupTouchScroll(container, mapType) {
        container.addEventListener('touchstart', (e) => {
            this.touchState.startX = e.touches[0].clientX;
            this.touchState.startY = e.touches[0].clientY;
            this.touchState.isScrolling = false;
            this.touchState.target = mapType;
        });
        
        container.addEventListener('touchmove', (e) => {
            if (!this.touchState.isScrolling) {
                const deltaX = Math.abs(e.touches[0].clientX - this.touchState.startX);
                const deltaY = Math.abs(e.touches[0].clientY - this.touchState.startY);
                
                if (deltaX > deltaY && deltaX > 10) {
                    this.touchState.isScrolling = true;
                    e.preventDefault();
                }
            }
            
            if (this.touchState.isScrolling) {
                e.preventDefault();
            }
        });
        
        container.addEventListener('touchend', (e) => {
            if (this.touchState.isScrolling && this.touchState.target === mapType) {
                const deltaX = e.changedTouches[0].clientX - this.touchState.startX;
                
                if (Math.abs(deltaX) > 50) {
                    if (deltaX > 0) {
                        // 向右滑動，顯示左邊內容
                        if (mapType === 'mini') {
                            this.scrollMiniMap('left');
                        } else {
                            this.scrollFullMap('left');
                        }
                    } else {
                        // 向左滑動，顯示右邊內容
                        if (mapType === 'mini') {
                            this.scrollMiniMap('right');
                        } else {
                            this.scrollFullMap('right');
                        }
                    }
                }
            }
            
            this.touchState.isScrolling = false;
            this.touchState.target = null;
        });
    }

    /**
     * 設置關卡點擊事件
     */
    setupLevelClickEvents(mapType) {
        const selector = mapType === 'mini' ? this.mapConfig.miniMap.levelDots : this.mapConfig.fullMap.levelItems;
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            element.addEventListener('click', (e) => {
                const levelId = parseInt(element.dataset.levelId);
                if (levelId && this.isLevelUnlocked(levelId)) {
                    this.selectLevel(levelId);
                    
                    // 如果是小地圖，直接初始化關卡
                    if (mapType === 'mini') {
                        this.initLevel(levelId);
                    }
                }
            });
        });
    }

    /**
     * 滾動小地圖
     */
    scrollMiniMap(direction) {
        const scrollContainer = document.querySelector(this.mapConfig.miniMap.scrollContainer);
        if (!scrollContainer) return;
        
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        
        if (direction === 'left') {
            this.miniMapScrollPosition = Math.max(0, this.miniMapScrollPosition - this.scrollStep);
        } else {
            this.miniMapScrollPosition = Math.min(maxScroll, this.miniMapScrollPosition + this.scrollStep);
        }
        
        scrollContainer.scrollTo({
            left: this.miniMapScrollPosition,
            behavior: 'smooth'
        });
        
        this.updateScrollButtons('mini');
        
        if (this.callbacks.onMapScrolled) {
            this.callbacks.onMapScrolled('mini', this.miniMapScrollPosition);
        }
    }

    /**
     * 滾動詳細地圖
     */
    scrollFullMap(direction) {
        const scrollContainer = document.querySelector(this.mapConfig.fullMap.scrollContainer);
        if (!scrollContainer) return;
        
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        
        if (direction === 'left') {
            this.fullMapScrollPosition = Math.max(0, this.fullMapScrollPosition - this.scrollStep);
        } else {
            this.fullMapScrollPosition = Math.min(maxScroll, this.fullMapScrollPosition + this.scrollStep);
        }
        
        scrollContainer.scrollTo({
            left: this.fullMapScrollPosition,
            behavior: 'smooth'
        });
        
        this.updateScrollButtons('full');
        
        if (this.callbacks.onMapScrolled) {
            this.callbacks.onMapScrolled('full', this.fullMapScrollPosition);
        }
    }

    /**
     * 更新滾動按鈕狀態
     */
    updateScrollButtons(mapType) {
        const config = mapType === 'mini' ? this.mapConfig.miniMap : this.mapConfig.fullMap;
        const scrollPosition = mapType === 'mini' ? this.miniMapScrollPosition : this.fullMapScrollPosition;
        
        const leftBtn = document.querySelector(config.leftBtn);
        const rightBtn = document.querySelector(config.rightBtn);
        const scrollContainer = document.querySelector(config.scrollContainer);
        
        if (leftBtn && rightBtn && scrollContainer) {
            const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
            
            leftBtn.disabled = scrollPosition <= 0;
            rightBtn.disabled = scrollPosition >= maxScroll;
        }
    }

    /**
     * 設置地圖模態視窗
     */
    setupMapModal() {
        const openMapBtn = document.getElementById('open-map-btn');
        const closeMapBtn = document.getElementById('close-map-btn');
        const startChallengeBtn = document.getElementById('start-challenge-btn');
        const mapModal = document.getElementById('map-modal');
        
        if (openMapBtn) {
            openMapBtn.addEventListener('click', () => {
                this.showMapModal();
            });
        }
        
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                this.hideMapModal();
            });
        }
        
        if (startChallengeBtn) {
            startChallengeBtn.addEventListener('click', () => {
                this.startSelectedChallenge();
            });
        }
        
        // 點擊模態視窗外部關閉
        if (mapModal) {
            mapModal.addEventListener('click', (e) => {
                if (e.target === mapModal) {
                    this.hideMapModal();
                }
            });
        }
    }

    /**
     * 顯示地圖模態視窗
     */
    showMapModal() {
        const mapModal = document.getElementById('map-modal');
        if (mapModal) {
            mapModal.style.display = 'block';
            
            // 更新地圖顯示
            this.updateMapDisplay();
            
            // 添加顯示動畫
            setTimeout(() => {
                mapModal.classList.add('modal-show');
            }, 10);
        }
    }

    /**
     * 隱藏地圖模態視窗
     */
    hideMapModal() {
        const mapModal = document.getElementById('map-modal');
        if (mapModal) {
            mapModal.classList.remove('modal-show');
            
            setTimeout(() => {
                mapModal.style.display = 'none';
            }, 300);
        }
    }

    /**
     * 選擇關卡
     */
    selectLevel(levelId) {
        if (!this.isLevelUnlocked(levelId)) {
            console.log(`關卡 ${levelId} 尚未解鎖`);
            return false;
        }
        
        this.selectedLevel = levelId;
        console.log(`選擇關卡 ${levelId}`);
        
        // 更新 UI 顯示
        this.highlightSelectedLevel();
        this.updateLevelInfo();
        
        // 觸發回調
        if (this.callbacks.onLevelSelected) {
            this.callbacks.onLevelSelected(levelId);
        }
        
        return true;
    }

    /**
     * 初始化關卡
     */
    initLevel(levelId) {
        if (!this.selectLevel(levelId)) {
            return false;
        }
        
        this.currentLevel = levelId;
        console.log(`初始化關卡 ${levelId}`);
        
        // 顯示關卡開始通知
        this.showLevelStartNotification(levelId);
        
        // 更新當前關卡高亮
        this.highlightCurrentLevel();
        
        return true;
    }

    /**
     * 開始選中的挑戰
     */
    startSelectedChallenge() {
        if (this.selectedLevel && this.isLevelUnlocked(this.selectedLevel)) {
            this.initLevel(this.selectedLevel);
            this.hideMapModal();
        }
    }

    /**
     * 解鎖關卡
     */
    unlockLevel(levelId) {
        if (!this.unlockedLevels.includes(levelId)) {
            this.unlockedLevels.push(levelId);
            
            // 更新關卡數據
            const level = this.levels.find(l => l.id === levelId);
            if (level) {
                level.unlocked = true;
            }
            
            console.log(`解鎖關卡 ${levelId}`);
            
            // 更新地圖顯示
            this.updateMapDisplay();
            
            // 觸發回調
            if (this.callbacks.onLevelUnlocked) {
                this.callbacks.onLevelUnlocked(levelId);
            }
        }
    }

    /**
     * 完成關卡
     */
    completeLevel(levelId) {
        const level = this.levels.find(l => l.id === levelId);
        if (level) {
            level.completed = true;
            console.log(`完成關卡 ${levelId}`);
            
            // 解鎖下一關卡
            const nextLevelId = levelId + 1;
            if (nextLevelId <= this.levels.length) {
                this.unlockLevel(nextLevelId);
            }
            
            // 更新地圖顯示
            this.updateMapDisplay();
        }
    }

    /**
     * 檢查關卡是否已解鎖
     */
    isLevelUnlocked(levelId) {
        return this.unlockedLevels.includes(levelId);
    }

    /**
     * 檢查關卡是否已完成
     */
    isLevelCompleted(levelId) {
        const level = this.levels.find(l => l.id === levelId);
        return level ? level.completed : false;
    }

    /**
     * 高亮顯示選中的關卡
     */
    highlightSelectedLevel() {
        // 移除所有選中狀態
        document.querySelectorAll('.level-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 添加選中狀態
        document.querySelectorAll(`[data-level-id="${this.selectedLevel}"]`).forEach(item => {
            item.classList.add('selected');
        });
    }

    /**
     * 高亮顯示當前關卡
     */
    highlightCurrentLevel() {
        // 小地圖高亮
        document.querySelectorAll('.mini-map .level-dot').forEach(dot => {
            dot.classList.remove('current');
            if (parseInt(dot.dataset.levelId) === this.currentLevel) {
                dot.classList.add('current');
            }
        });
        
        // 詳細地圖高亮
        document.querySelectorAll('.full-map .level-item').forEach(item => {
            item.classList.remove('current');
            if (parseInt(item.dataset.levelId) === this.currentLevel) {
                item.classList.add('current');
            }
        });
    }

    /**
     * 更新關卡信息顯示
     */
    updateLevelInfo() {
        const level = this.levels.find(l => l.id === this.selectedLevel);
        if (!level) return;
        
        // 更新關卡詳細信息
        const levelNameElement = document.getElementById('selected-level-name');
        const levelDescElement = document.getElementById('selected-level-description');
        const levelDifficultyElement = document.getElementById('selected-level-difficulty');
        const levelMonstersElement = document.getElementById('selected-level-monsters');
        const levelRewardsElement = document.getElementById('selected-level-rewards');
        
        if (levelNameElement) levelNameElement.textContent = level.name;
        if (levelDescElement) levelDescElement.textContent = level.description;
        if (levelDifficultyElement) levelDifficultyElement.textContent = level.difficulty;
        if (levelMonstersElement) levelMonstersElement.textContent = `${level.monsters} 隻怪物`;
        
        if (levelRewardsElement) {
            levelRewardsElement.innerHTML = level.rewards.map(reward => `<li>${reward}</li>`).join('');
        }
    }

    /**
     * 更新地圖顯示
     */
    updateMapDisplay() {
        // 更新關卡解鎖狀態
        this.levels.forEach(level => {
            const elements = document.querySelectorAll(`[data-level-id="${level.id}"]`);
            elements.forEach(element => {
                element.classList.toggle('unlocked', level.unlocked);
                element.classList.toggle('completed', level.completed);
                element.classList.toggle('locked', !level.unlocked);
            });
        });
        
        // 更新滾動按鈕
        this.updateScrollButtons('mini');
        this.updateScrollButtons('full');
    }

    /**
     * 顯示關卡開始通知
     */
    showLevelStartNotification(levelId) {
        const level = this.levels.find(l => l.id === levelId);
        if (!level) return;
        
        const message = `開始挑戰：${level.name}`;
        
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = 'level-start-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 顯示動畫
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自動隱藏
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 獲取關卡信息
     */
    getLevelInfo(levelId) {
        return this.levels.find(l => l.id === levelId);
    }

    /**
     * 獲取所有關卡
     */
    getAllLevels() {
        return [...this.levels];
    }

    /**
     * 獲取已解鎖的關卡
     */
    getUnlockedLevels() {
        return this.levels.filter(l => l.unlocked);
    }

    /**
     * 獲取已完成的關卡
     */
    getCompletedLevels() {
        return this.levels.filter(l => l.completed);
    }

    /**
     * 獲取地圖狀態
     */
    getMapState() {
        return {
            currentLevel: this.currentLevel,
            selectedLevel: this.selectedLevel,
            unlockedLevels: [...this.unlockedLevels],
            miniMapScrollPosition: this.miniMapScrollPosition,
            fullMapScrollPosition: this.fullMapScrollPosition
        };
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

// 導出 MapManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapManager;
} else {
    window.MapManager = MapManager;
}