/**
 * 模組初始化腳本
 * 負責在頁面載入時自動載入和初始化所有模組
 */

(function() {
    'use strict';
    
    // 全局應用程式實例
    let app = null;
    
    // 初始化狀態
    let isInitializing = false;
    let isInitialized = false;
    
    /**
     * 顯示載入進度
     */
    function showLoadingProgress(status) {
        const progressElement = document.getElementById('loading-progress');
        if (progressElement) {
            const percentage = status.percentage || 0;
            const loadedCount = status.loaded || 0;
            const totalCount = status.total || 0;
            
            progressElement.innerHTML = `
                <div class="loading-bar">
                    <div class="loading-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="loading-text">
                    載入模組中... ${loadedCount}/${totalCount} (${percentage}%)
                </div>
            `;
        }
    }
    
    /**
     * 隱藏載入畫面
     */
    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        const errorElement = document.getElementById('loading-error');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="error-message">
                    <h3>載入失敗</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()">重新載入</button>
                </div>
            `;
            errorElement.style.display = 'block';
        } else {
            console.error('載入失敗:', message);
            alert('載入失敗: ' + message);
        }
    }
    
    /**
     * 初始化應用程式
     */
    async function initializeApp() {
        if (isInitializing || isInitialized) {
            return app;
        }
        
        isInitializing = true;
        
        try {
            console.log('開始初始化應用程式...');
            
            // 檢查是否已載入模組載入器
            if (typeof window.moduleLoader === 'undefined') {
                throw new Error('模組載入器未載入');
            }
            
            // 載入所有模組
            console.log('載入模組...');
            
            // 監聽載入進度
            const checkProgress = setInterval(() => {
                const status = window.moduleLoader.getLoadingStatus();
                showLoadingProgress(status);
                
                if (status.isComplete) {
                    clearInterval(checkProgress);
                }
            }, 100);
            
            await window.moduleLoader.loadAllModules();
            clearInterval(checkProgress);
            
            // 創建主應用程式實例
            console.log('創建應用程式實例...');
            app = window.createModule('main-app');
            
            // 初始化應用程式
            console.log('初始化應用程式...');
            await app.init({
                socketUrl: window.location.protocol + '//' + window.location.host,
                autoConnect: true,
                enableThreeJs: true,
                enableWorkoutPlan: true,
                debugMode: false
            });
            
            // 設置全局事件監聽器
            setupGlobalEventListeners();
            
            // 隱藏載入畫面
            hideLoadingScreen();
            
            isInitialized = true;
            console.log('應用程式初始化完成');
            
            // 觸發自定義事件
            window.dispatchEvent(new CustomEvent('app:ready', {
                detail: { app: app }
            }));
            
            return app;
            
        } catch (error) {
            console.error('應用程式初始化失敗:', error);
            showError(error.message);
            throw error;
        } finally {
            isInitializing = false;
        }
    }
    
    /**
     * 設置全局事件監聽器
     */
    function setupGlobalEventListeners() {
        // 頁面卸載時清理資源
        window.addEventListener('beforeunload', () => {
            if (app) {
                app.cleanup();
            }
        });
        
        // 頁面可見性變化
        document.addEventListener('visibilitychange', () => {
            if (app) {
                if (document.hidden) {
                    // 頁面隱藏時暫停某些功能
                    console.log('頁面隱藏，暫停部分功能');
                } else {
                    // 頁面顯示時恢復功能
                    console.log('頁面顯示，恢復功能');
                }
            }
        });
        
        // 網路狀態變化
        window.addEventListener('online', () => {
            if (app && !app.isConnected) {
                console.log('網路恢復，嘗試重新連接');
                app.connect().catch(error => {
                    console.error('重新連接失敗:', error);
                });
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('網路斷開');
            if (app) {
                app.emit('network:offline');
            }
        });
        
        // 錯誤處理
        window.addEventListener('error', (event) => {
            console.error('全局錯誤:', event.error);
            if (app) {
                app.emit('app:error', event.error);
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未處理的 Promise 拒絕:', event.reason);
            if (app) {
                app.emit('app:error', event.reason);
            }
        });
    }
    
    /**
     * 檢查瀏覽器兼容性
     */
    function checkBrowserCompatibility() {
        const requiredFeatures = [
            'Promise',
            'fetch',
            'WebSocket',
            'localStorage',
            'sessionStorage'
        ];
        
        const missingFeatures = requiredFeatures.filter(feature => {
            return typeof window[feature] === 'undefined';
        });
        
        if (missingFeatures.length > 0) {
            throw new Error(`瀏覽器不支援以下功能: ${missingFeatures.join(', ')}`);
        }
        
        // 檢查 ES6 支援
        try {
            eval('const test = () => {};');
        } catch (error) {
            throw new Error('瀏覽器不支援 ES6 語法');
        }
    }
    
    /**
     * 載入必要的樣式
     */
    function loadRequiredStyles() {
        // 載入進度樣式
        const style = document.createElement('style');
        style.textContent = `
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }
            
            .loading-container {
                text-align: center;
                color: white;
            }
            
            .loading-title {
                font-size: 2rem;
                margin-bottom: 2rem;
                font-weight: bold;
            }
            
            .loading-bar {
                width: 300px;
                height: 6px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            
            .loading-fill {
                height: 100%;
                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            
            .loading-text {
                font-size: 1rem;
                opacity: 0.8;
            }
            
            .error-message {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                text-align: center;
                color: #333;
            }
            
            .error-message h3 {
                color: #e74c3c;
                margin-bottom: 1rem;
            }
            
            .error-message button {
                background: #3498db;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 1rem;
            }
            
            .error-message button:hover {
                background: #2980b9;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 創建載入畫面
     */
    function createLoadingScreen() {
        const loadingScreen = document.createElement('div');
        loadingScreen.id = 'loading-screen';
        loadingScreen.innerHTML = `
            <div class="loading-container">
                <div class="loading-title">AI 健身遊戲</div>
                <div id="loading-progress">
                    <div class="loading-bar">
                        <div class="loading-fill" style="width: 0%"></div>
                    </div>
                    <div class="loading-text">正在載入...</div>
                </div>
                <div id="loading-error" style="display: none;"></div>
            </div>
        `;
        document.body.appendChild(loadingScreen);
    }
    
    /**
     * 主初始化函數
     */
    async function main() {
        try {
            // 檢查瀏覽器兼容性
            checkBrowserCompatibility();
            
            // 載入樣式
            loadRequiredStyles();
            
            // 創建載入畫面
            createLoadingScreen();
            
            // 等待 DOM 載入完成
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // 初始化應用程式
            await initializeApp();
            
        } catch (error) {
            console.error('初始化失敗:', error);
            showError(error.message);
        }
    }
    
    // 提供全局訪問接口
    window.getApp = function() {
        return app;
    };
    
    window.isAppReady = function() {
        return isInitialized && app !== null;
    };
    
    window.initApp = initializeApp;
    
    // 自動開始初始化
    main();
    
})();

// 提供便捷的全局函數
window.waitForApp = function() {
    return new Promise((resolve) => {
        if (window.isAppReady()) {
            resolve(window.getApp());
        } else {
            window.addEventListener('app:ready', (event) => {
                resolve(event.detail.app);
            }, { once: true });
        }
    });
};

// 調試用函數
window.debugApp = function() {
    const app = window.getApp();
    if (app) {
        console.log('應用程式狀態:', app.getAppState());
        return app.getAppState();
    } else {
        console.log('應用程式尚未初始化');
        return null;
    }
};