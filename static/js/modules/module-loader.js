/**
 * Module Loader
 * 負責動態載入所有模組並確保正確的載入順序
 */

class ModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
        this.moduleBasePath = '/static/js/modules/';
        
        // 模組依賴關係定義
        this.moduleDependencies = {
            'socket-manager': [],
            'ui-manager': [],
            'exercise-manager': ['ui-manager'],
            'game-manager': ['ui-manager'],
            'map-manager': ['ui-manager', 'game-manager'],
            'three-manager': [],
            'workout-manager': ['ui-manager'],
            'main-app': [
                'socket-manager',
                'ui-manager', 
                'exercise-manager',
                'game-manager',
                'map-manager',
                'three-manager',
                'workout-manager'
            ]
        };
        
        // 模組文件映射
        this.moduleFiles = {
            'socket-manager': 'socket-manager.js',
            'ui-manager': 'ui-manager.js',
            'exercise-manager': 'exercise-manager.js',
            'game-manager': 'game-manager.js',
            'map-manager': 'map-manager.js',
            'three-manager': 'three-manager.js',
            'workout-manager': 'workout-manager.js',
            'main-app': 'main-app.js'
        };
        
        // 模組類名映射
        this.moduleClasses = {
            'socket-manager': 'SocketManager',
            'ui-manager': 'UIManager',
            'exercise-manager': 'ExerciseManager',
            'game-manager': 'GameManager',
            'map-manager': 'MapManager',
            'three-manager': 'ThreeManager',
            'workout-manager': 'WorkoutManager',
            'main-app': 'MainApp'
        };
    }

    /**
     * 載入單個模組
     */
    async loadModule(moduleName) {
        // 如果已經載入，直接返回
        if (this.loadedModules.has(moduleName)) {
            return Promise.resolve();
        }
        
        // 如果正在載入，返回現有的 Promise
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }
        
        // 檢查模組是否存在
        if (!this.moduleFiles[moduleName]) {
            throw new Error(`未知的模組: ${moduleName}`);
        }
        
        // 創建載入 Promise
        const loadingPromise = this._loadModuleWithDependencies(moduleName);
        this.loadingPromises.set(moduleName, loadingPromise);
        
        try {
            await loadingPromise;
            this.loadedModules.add(moduleName);
            console.log(`模組 ${moduleName} 載入完成`);
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
        
        return loadingPromise;
    }

    /**
     * 載入模組及其依賴
     */
    async _loadModuleWithDependencies(moduleName) {
        // 先載入依賴
        const dependencies = this.moduleDependencies[moduleName] || [];
        
        for (const dependency of dependencies) {
            await this.loadModule(dependency);
        }
        
        // 載入模組本身
        await this._loadModuleScript(moduleName);
        
        // 驗證模組類是否可用
        this._validateModuleClass(moduleName);
    }

    /**
     * 載入模組腳本文件
     */
    async _loadModuleScript(moduleName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const fileName = this.moduleFiles[moduleName];
            const scriptUrl = this.moduleBasePath + fileName;
            
            script.src = scriptUrl;
            script.async = true;
            
            script.onload = () => {
                console.log(`腳本載入成功: ${scriptUrl}`);
                resolve();
            };
            
            script.onerror = () => {
                const error = new Error(`腳本載入失敗: ${scriptUrl}`);
                console.error(error.message);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * 驗證模組類是否可用
     */
    _validateModuleClass(moduleName) {
        const className = this.moduleClasses[moduleName];
        
        if (!className) {
            throw new Error(`模組 ${moduleName} 沒有對應的類名`);
        }
        
        if (typeof window[className] !== 'function') {
            throw new Error(`模組類 ${className} 不可用`);
        }
    }

    /**
     * 載入所有模組
     */
    async loadAllModules() {
        console.log('開始載入所有模組...');
        
        try {
            // 按依賴順序載入所有模組
            const moduleNames = Object.keys(this.moduleDependencies);
            
            for (const moduleName of moduleNames) {
                await this.loadModule(moduleName);
            }
            
            console.log('所有模組載入完成');
            return true;
            
        } catch (error) {
            console.error('模組載入失敗:', error);
            throw error;
        }
    }

    /**
     * 載入核心模組（不包括 main-app）
     */
    async loadCoreModules() {
        console.log('開始載入核心模組...');
        
        const coreModules = [
            'socket-manager',
            'ui-manager',
            'exercise-manager',
            'game-manager',
            'map-manager',
            'three-manager',
            'workout-manager'
        ];
        
        try {
            for (const moduleName of coreModules) {
                await this.loadModule(moduleName);
            }
            
            console.log('核心模組載入完成');
            return true;
            
        } catch (error) {
            console.error('核心模組載入失敗:', error);
            throw error;
        }
    }

    /**
     * 檢查模組是否已載入
     */
    isModuleLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }

    /**
     * 檢查所有模組是否已載入
     */
    areAllModulesLoaded() {
        const allModules = Object.keys(this.moduleDependencies);
        return allModules.every(module => this.isModuleLoaded(module));
    }

    /**
     * 獲取已載入的模組列表
     */
    getLoadedModules() {
        return Array.from(this.loadedModules);
    }

    /**
     * 獲取載入狀態
     */
    getLoadingStatus() {
        const allModules = Object.keys(this.moduleDependencies);
        const loadedCount = this.loadedModules.size;
        const totalCount = allModules.length;
        
        return {
            loaded: loadedCount,
            total: totalCount,
            percentage: Math.round((loadedCount / totalCount) * 100),
            isComplete: loadedCount === totalCount,
            loadedModules: this.getLoadedModules(),
            pendingModules: allModules.filter(module => !this.isModuleLoaded(module))
        };
    }

    /**
     * 重新載入模組
     */
    async reloadModule(moduleName) {
        console.log(`重新載入模組: ${moduleName}`);
        
        // 移除已載入標記
        this.loadedModules.delete(moduleName);
        this.loadingPromises.delete(moduleName);
        
        // 移除舊的腳本標籤
        const fileName = this.moduleFiles[moduleName];
        const scriptUrl = this.moduleBasePath + fileName;
        const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
        
        if (existingScript) {
            existingScript.remove();
        }
        
        // 重新載入
        await this.loadModule(moduleName);
    }

    /**
     * 創建模組實例
     */
    createModuleInstance(moduleName, ...args) {
        if (!this.isModuleLoaded(moduleName)) {
            throw new Error(`模組 ${moduleName} 尚未載入`);
        }
        
        const className = this.moduleClasses[moduleName];
        const ModuleClass = window[className];
        
        if (!ModuleClass) {
            throw new Error(`模組類 ${className} 不存在`);
        }
        
        return new ModuleClass(...args);
    }

    /**
     * 設置模組基礎路徑
     */
    setBasePath(basePath) {
        this.moduleBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
    }

    /**
     * 添加自定義模組
     */
    addCustomModule(moduleName, fileName, className, dependencies = []) {
        this.moduleFiles[moduleName] = fileName;
        this.moduleClasses[moduleName] = className;
        this.moduleDependencies[moduleName] = dependencies;
    }

    /**
     * 移除模組
     */
    removeModule(moduleName) {
        this.loadedModules.delete(moduleName);
        this.loadingPromises.delete(moduleName);
        delete this.moduleFiles[moduleName];
        delete this.moduleClasses[moduleName];
        delete this.moduleDependencies[moduleName];
    }

    /**
     * 清理所有載入的模組
     */
    cleanup() {
        console.log('清理模組載入器...');
        
        // 清理載入狀態
        this.loadedModules.clear();
        this.loadingPromises.clear();
        
        // 移除所有模組腳本
        Object.values(this.moduleFiles).forEach(fileName => {
            const scriptUrl = this.moduleBasePath + fileName;
            const script = document.querySelector(`script[src="${scriptUrl}"]`);
            if (script) {
                script.remove();
            }
        });
        
        console.log('模組載入器清理完成');
    }
}

// 創建全局模組載入器實例
window.moduleLoader = new ModuleLoader();

// 導出 ModuleLoader 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleLoader;
} else {
    window.ModuleLoader = ModuleLoader;
}

// 提供便捷的全局載入函數
window.loadModules = async function(modules) {
    if (!modules) {
        return await window.moduleLoader.loadAllModules();
    }
    
    if (typeof modules === 'string') {
        return await window.moduleLoader.loadModule(modules);
    }
    
    if (Array.isArray(modules)) {
        for (const module of modules) {
            await window.moduleLoader.loadModule(module);
        }
        return true;
    }
    
    throw new Error('無效的模組參數');
};

// 提供便捷的模組實例創建函數
window.createModule = function(moduleName, ...args) {
    return window.moduleLoader.createModuleInstance(moduleName, ...args);
};