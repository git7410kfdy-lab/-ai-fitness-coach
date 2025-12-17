/**
 * 怪獸容器位置控制器
 * 負責管理怪獸容器在固定位置和浮動位置之間的切換
 */
class MonsterPositionController {
    constructor() {
        this.isFloating = false;
        this.monsterContainer = null;
        this.originalParent = null;
        this.originalStyles = {};
        this.floatingContainer = null;
        this.toggleButton = null;
        this.hpContainers = [];
        this.originalHpStyles = [];
        
        this.init();
    }

    /**
     * 初始化控制器
     */
    init() {
        this.monsterContainer = document.getElementById('monster-container');
        if (!this.monsterContainer) {
            console.error('Monster container not found');
            return;
        }

        this.originalParent = this.monsterContainer.parentElement;
        this.initHpContainers();
        this.saveOriginalStyles();
        this.createToggleButton();
        this.createFloatingContainer();
        this.bindEvents();
    }

    /**
     * 初始化血量和護盾容器
     */
    initHpContainers() {
        // 找到所有血量和護盾容器
        const monsterArea = this.monsterContainer.closest('.monster-area');
        if (monsterArea) {
            this.hpContainers = Array.from(monsterArea.querySelectorAll('.hp-container'));
        }
    }

    /**
     * 保存原始樣式
     */
    saveOriginalStyles() {
        const computedStyle = window.getComputedStyle(this.monsterContainer);
        this.originalStyles = {
            position: computedStyle.position,
            top: computedStyle.top,
            right: computedStyle.right,
            width: computedStyle.width,
            height: computedStyle.height,
            zIndex: computedStyle.zIndex,
            transform: computedStyle.transform,
            boxShadow: computedStyle.boxShadow
        };

        // 保存血量和護盾容器的原始樣式
        this.originalHpStyles = this.hpContainers.map(container => {
            const style = window.getComputedStyle(container);
            return {
                element: container,
                fontSize: style.fontSize,
                padding: style.padding,
                marginBottom: style.marginBottom,
                height: style.height
            };
        });
    }

    /**
     * 創建切換按鈕
     */
    createToggleButton() {
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'monster-position-toggle';
        this.toggleButton.className = 'monster-position-toggle-btn';
        this.toggleButton.innerHTML = `
            <i class="fas fa-expand-arrows-alt"></i>
            <span>浮動顯示怪物視窗</span>
        `;
        this.toggleButton.title = '切換怪獸容器位置';
        
        // 將按鈕添加到右側面板的頂部
        const rightSidePanel = document.querySelector('.right-side-panel');
        if (rightSidePanel) {
            rightSidePanel.insertBefore(this.toggleButton, rightSidePanel.firstChild);
        }
    }

    /**
     * 創建浮動容器
     */
    createFloatingContainer() {
        this.floatingContainer = document.createElement('div');
        this.floatingContainer.id = 'floating-monster-container';
        this.floatingContainer.className = 'floating-monster-container';
        this.floatingContainer.style.display = 'none';
        
        // 添加到body中
        document.body.appendChild(this.floatingContainer);
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => {
                this.togglePosition();
            });
        }

        // 監聽窗口大小變化，調整浮動位置
        window.addEventListener('resize', () => {
            if (this.isFloating) {
                this.updateFloatingPosition();
            }
        });
    }

    /**
     * 切換位置
     */
    togglePosition() {
        if (this.isFloating) {
            this.moveToOriginalPosition();
        } else {
            this.moveToFloatingPosition();
        }
    }

    /**
     * 移動到浮動位置
     */
    moveToFloatingPosition() {
        if (!this.monsterContainer || !this.floatingContainer) return;

        // 移動血量和護盾容器到浮動容器中
        this.hpContainers.forEach(container => {
            this.floatingContainer.appendChild(container);
        });
        
        // 移動怪獸容器到浮動容器中
        this.floatingContainer.appendChild(this.monsterContainer);
        this.floatingContainer.style.display = 'block';
        
        // 應用浮動樣式
        this.applyFloatingStyles();
        this.updateFloatingPosition();
        
        this.isFloating = true;
        this.updateToggleButton();
        
        // 觸發自定義事件
        this.dispatchPositionChangeEvent('floating');
    }

    /**
     * 移動到原始位置
     */
    moveToOriginalPosition() {
        if (!this.monsterContainer || !this.originalParent) return;

        // 找到原始的monster-area容器
        const monsterArea = this.originalParent;
        
        // 先移動怪獸容器回原始位置
        this.originalParent.appendChild(this.monsterContainer);
        
        // 然後移動血量和護盾容器回原始位置（在怪獸容器之前）
        this.hpContainers.forEach(container => {
            monsterArea.insertBefore(container, this.monsterContainer);
        });
        
        // 隱藏浮動容器
        this.floatingContainer.style.display = 'none';
        
        // 恢復原始樣式
        this.restoreOriginalStyles();
        
        this.isFloating = false;
        this.updateToggleButton();
        
        // 觸發自定義事件
        this.dispatchPositionChangeEvent('original');
    }

    /**
     * 應用浮動樣式
     */
    applyFloatingStyles() {
        // 重置容器樣式
        Object.assign(this.monsterContainer.style, {
            position: 'relative',
            top: 'auto',
            right: 'auto',
            width: '100%',
            height: 'auto',
            zIndex: 'auto',
            transform: 'none',
            boxShadow: 'none'
        });

        // 應用血量和護盾容器的浮動樣式
        this.hpContainers.forEach(container => {
            Object.assign(container.style, {
                fontSize: '0.8rem',
                padding: '6px',
                marginBottom: '6px'
            });
            
            // 調整血量條高度
            const hpBar = container.querySelector('.hp-bar');
            if (hpBar) {
                hpBar.style.height = '16px';
            }
            
            // 調整標籤和數值的字體大小
            const hpLabel = container.querySelector('.hp-label');
            const hpValue = container.querySelector('.hp-value');
            if (hpLabel) hpLabel.style.fontSize = '0.75rem';
            if (hpValue) hpValue.style.fontSize = '0.7rem';
        });
    }

    /**
     * 恢復原始樣式
     */
    restoreOriginalStyles() {
        Object.assign(this.monsterContainer.style, this.originalStyles);
        
        // 恢復血量和護盾容器的原始樣式
        this.originalHpStyles.forEach(styleData => {
            const { element, fontSize, padding, marginBottom, height } = styleData;
            Object.assign(element.style, {
                fontSize: '',
                padding: '',
                marginBottom: ''
            });
            
            // 恢復血量條高度
            const hpBar = element.querySelector('.hp-bar');
            if (hpBar) {
                hpBar.style.height = '';
            }
            
            // 恢復標籤和數值的字體大小
            const hpLabel = element.querySelector('.hp-label');
            const hpValue = element.querySelector('.hp-value');
            if (hpLabel) hpLabel.style.fontSize = '';
            if (hpValue) hpValue.style.fontSize = '';
        });
    }

    /**
     * 更新浮動位置
     */
    updateFloatingPosition() {
        if (!this.floatingContainer) return;

        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;

        const videoRect = videoContainer.getBoundingClientRect();
        const containerWidth = 320; // 浮動容器寬度（包含padding）
        const containerHeight = 350; // 浮動容器高度（包含padding和血量護盾條）
        const margin = 20; // 邊距

        // 計算位置：視頻容器右側，垂直居中
        const left = videoRect.right + margin;
        const top = videoRect.top + (videoRect.height - containerHeight) / 2;
        
        // 確保不超出視窗邊界
        const maxLeft = window.innerWidth - containerWidth - margin;
        const maxTop = window.innerHeight - containerHeight - margin;
        const finalLeft = Math.min(left, maxLeft);
        const finalTop = Math.max(margin, Math.min(top, maxTop));

        Object.assign(this.floatingContainer.style, {
            position: 'fixed',
            left: `${finalLeft}px`,
            top: `${finalTop}px`,
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            zIndex: '1000',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '10px',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
            border: '2px solid rgba(74, 144, 226, 0.3)',
            padding: '10px',
            backdropFilter: 'blur(10px)',
            pointerEvents: 'auto',
            transition: 'all 0.3s ease'
        });
    }

    /**
     * 更新切換按鈕
     */
    updateToggleButton() {
        if (!this.toggleButton) return;

        const icon = this.toggleButton.querySelector('i');
        const text = this.toggleButton.querySelector('span');
        
        if (this.isFloating) {
            icon.className = 'fas fa-compress-arrows-alt';
            text.textContent = '固定顯示';
            this.toggleButton.classList.add('active');
        } else {
            icon.className = 'fas fa-expand-arrows-alt';
            text.textContent = '浮動顯示';
            this.toggleButton.classList.remove('active');
        }
    }

    /**
     * 觸發位置變更事件
     */
    dispatchPositionChangeEvent(position) {
        const event = new CustomEvent('monsterPositionChanged', {
            detail: {
                position: position,
                isFloating: this.isFloating,
                container: this.monsterContainer
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 獲取當前狀態
     */
    getState() {
        return {
            isFloating: this.isFloating,
            container: this.monsterContainer,
            toggleButton: this.toggleButton
        };
    }

    /**
     * 銷毀控制器
     */
    destroy() {
        if (this.isFloating) {
            this.moveToOriginalPosition();
        }
        
        if (this.toggleButton) {
            this.toggleButton.remove();
        }
        
        if (this.floatingContainer) {
            this.floatingContainer.remove();
        }
        
        window.removeEventListener('resize', this.updateFloatingPosition);
    }
}

// 導出類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MonsterPositionController;
} else {
    window.MonsterPositionController = MonsterPositionController;
}