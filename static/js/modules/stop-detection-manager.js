/**
 * 停止偵測管理模組
 * 專門處理停止偵測按鈕的事件綁定和狀態管理
 */

class StopDetectionManager {
    constructor() {
        this.stopButton = null;
        this.isInitialized = false;
        this.onStopCallback = null;
    }

    /**
     * 初始化停止偵測管理器
     * @param {Function} stopCallback - 停止偵測的回調函數
     */
    init(stopCallback) {
        console.log('[StopDetectionManager] 初始化停止偵測管理器');
        this.onStopCallback = stopCallback;
        this.findAndBindStopButton();
        this.isInitialized = true;
    }

    /**
     * 查找並綁定停止按鈕
     */
    findAndBindStopButton() {
        // 嘗試多種方式查找停止按鈕
        this.stopButton = document.getElementById('stop-detection') ||
                         document.querySelector('[id="stop-detection"]') ||
                         document.querySelector('.button.secondary[id="stop-detection"]') ||
                         document.querySelector('button[id="stop-detection"]');

        if (this.stopButton) {
            console.log('[StopDetectionManager] 找到停止按鈕，綁定事件');
            this.bindStopButtonEvent();
        } else {
            console.warn('[StopDetectionManager] 未找到停止按鈕，嘗試延遲查找');
            // 延遲查找，可能DOM還未完全加載
            setTimeout(() => {
                this.findAndBindStopButton();
            }, 500);
        }
    }

    /**
     * 綁定停止按鈕事件
     */
    bindStopButtonEvent() {
        if (!this.stopButton) {
            console.error('[StopDetectionManager] 停止按鈕不存在，無法綁定事件');
            return;
        }

        // 移除舊的事件監聽器
        this.stopButton.removeEventListener('click', this.handleStopClick.bind(this));
        
        // 添加新的事件監聽器
        this.stopButton.addEventListener('click', this.handleStopClick.bind(this));
        
        // 確保按鈕可見且可點擊
        this.stopButton.style.pointerEvents = 'auto';
        this.stopButton.style.opacity = '1';
        
        console.log('[StopDetectionManager] 停止按鈕事件綁定完成');
    }

    /**
     * 處理停止按鈕點擊事件
     * @param {Event} event - 點擊事件
     */
    handleStopClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('[StopDetectionManager] 停止按鈕被點擊');
        
        if (this.onStopCallback && typeof this.onStopCallback === 'function') {
            try {
                this.onStopCallback();
                console.log('[StopDetectionManager] 停止偵測回調執行成功');
            } catch (error) {
                console.error('[StopDetectionManager] 停止偵測回調執行失敗:', error);
            }
        } else {
            console.error('[StopDetectionManager] 停止偵測回調函數未設置');
        }
    }

    /**
     * 更新停止按鈕狀態
     * @param {boolean} enabled - 是否啟用按鈕
     */
    updateButtonState(enabled) {
        if (this.stopButton) {
            this.stopButton.disabled = !enabled;
            if (enabled) {
                this.stopButton.classList.remove('disabled');
                this.stopButton.style.opacity = '1';
            } else {
                this.stopButton.classList.add('disabled');
                this.stopButton.style.opacity = '0.5';
            }
            console.log(`[StopDetectionManager] 停止按鈕狀態更新: ${enabled ? '啟用' : '禁用'}`);
        }
    }

    /**
     * 強制重新綁定停止按鈕
     */
    rebindStopButton() {
        console.log('[StopDetectionManager] 強制重新綁定停止按鈕');
        this.findAndBindStopButton();
    }

    /**
     * 檢查停止按鈕是否正常工作
     * @returns {boolean} 是否正常
     */
    isStopButtonWorking() {
        if (!this.stopButton) {
            console.warn('[StopDetectionManager] 停止按鈕不存在');
            return false;
        }

        const hasEventListener = this.stopButton.onclick !== null || 
                               this.stopButton.addEventListener !== undefined;
        
        console.log(`[StopDetectionManager] 停止按鈕狀態檢查: 存在=${!!this.stopButton}, 可點擊=${!this.stopButton.disabled}, 有事件=${hasEventListener}`);
        
        return !!this.stopButton && !this.stopButton.disabled && hasEventListener;
    }

    /**
     * 獲取停止按鈕元素
     * @returns {HTMLElement|null} 停止按鈕元素
     */
    getStopButton() {
        return this.stopButton;
    }
}

// 創建全局實例
const stopDetectionManager = new StopDetectionManager();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StopDetectionManager, stopDetectionManager };
} else {
    window.StopDetectionManager = StopDetectionManager;
    window.stopDetectionManager = stopDetectionManager;
}