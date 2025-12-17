/**
 * Three.js Manager Module
 * 負責管理 Three.js 相關功能，包括怪物模型載入、動畫控制和 3D 場景管理
 */

class ThreeManager {
    constructor() {
        // Three.js 相關變量
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.mixer = null;
        this.clock = null;
        
        // 怪物模型相關
        this.monsterModel = null;
        this.monsterAnimations = {};
        this.currentAnimation = null;
        this.isModelLoaded = false;
        
        // 載入狀態
        this.isThreeJsLoaded = false;
        this.isGLTFLoaderLoaded = false;
        this.loadingPromise = null;
        
        // 動畫狀態
        this.animationState = {
            isPlaying: false,
            currentAction: null,
            previousAction: null,
            fadeTime: 0.5
        };
        
        // 場景配置
        this.sceneConfig = {
            container: '#monster-container',
            width: 300,
            height: 300,
            backgroundColor: 0x000000,
            cameraPosition: { x: 0, y: 1, z: 3 },
            lightIntensity: 1.0
        };
        
        // 怪物配置
        this.monsterConfig = {
            modelPath: '/static/models/monster.glb',
            scale: { x: 1, y: 1, z: 1 },
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        };
        
        // 事件回調
        this.callbacks = {
            onModelLoaded: null,
            onModelError: null,
            onAnimationStart: null,
            onAnimationEnd: null,
            onSceneReady: null
        };
    }

    /**
     * 初始化 Three.js 管理器
     */
    async init() {
        console.log('初始化 Three.js 管理器');
        
        try {
            await this.loadThreeJsIfNeeded();
            this.initScene();
            await this.loadMonsterModel();
            this.startRenderLoop();
            
            if (this.callbacks.onSceneReady) {
                this.callbacks.onSceneReady();
            }
        } catch (error) {
            console.error('Three.js 初始化失敗:', error);
            if (this.callbacks.onModelError) {
                this.callbacks.onModelError(error);
            }
        }
    }

    /**
     * 載入 Three.js 庫（如果需要）
     */
    async loadThreeJsIfNeeded() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }
        
        if (this.isThreeJsLoaded && this.isGLTFLoaderLoaded) {
            return Promise.resolve();
        }
        
        this.loadingPromise = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalToLoad = 2;
            
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === totalToLoad) {
                    this.isThreeJsLoaded = true;
                    this.isGLTFLoaderLoaded = true;
                    console.log('Three.js 和 GLTFLoader 載入完成');
                    resolve();
                }
            };
            
            // 檢查 Three.js 是否已載入
            if (typeof THREE !== 'undefined') {
                checkComplete();
            } else {
                const threeScript = document.createElement('script');
                threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
                threeScript.onload = checkComplete;
                threeScript.onerror = () => reject(new Error('Three.js 載入失敗'));
                document.head.appendChild(threeScript);
            }
            
            // 檢查 GLTFLoader 是否已載入
            if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
                checkComplete();
            } else {
                const gltfScript = document.createElement('script');
                gltfScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
                gltfScript.onload = checkComplete;
                gltfScript.onerror = () => reject(new Error('GLTFLoader 載入失敗'));
                document.head.appendChild(gltfScript);
            }
        });
        
        return this.loadingPromise;
    }

    /**
     * 初始化 Three.js 場景
     */
    initScene() {
        const container = document.querySelector(this.sceneConfig.container);
        if (!container) {
            throw new Error('找不到 Three.js 容器元素');
        }
        
        // 創建場景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.sceneConfig.backgroundColor);
        
        // 創建相機
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.sceneConfig.width / this.sceneConfig.height,
            0.1,
            1000
        );
        this.camera.position.set(
            this.sceneConfig.cameraPosition.x,
            this.sceneConfig.cameraPosition.y,
            this.sceneConfig.cameraPosition.z
        );
        
        // 創建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.sceneConfig.width, this.sceneConfig.height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 添加到容器
        container.appendChild(this.renderer.domElement);
        
        // 添加燈光
        this.setupLighting();
        
        // 創建時鐘
        this.clock = new THREE.Clock();
        
        console.log('Three.js 場景初始化完成');
    }

    /**
     * 設置場景燈光
     */
    setupLighting() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // 方向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, this.sceneConfig.lightIntensity);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 點光源
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
        pointLight.position.set(0, 5, 0);
        this.scene.add(pointLight);
    }

    /**
     * 載入怪物模型
     */
    async loadMonsterModel() {
        if (!this.isThreeJsLoaded || !this.isGLTFLoaderLoaded) {
            throw new Error('Three.js 或 GLTFLoader 尚未載入');
        }
        
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            
            loader.load(
                this.monsterConfig.modelPath,
                (gltf) => {
                    this.onModelLoaded(gltf);
                    resolve(gltf);
                },
                (progress) => {
                    console.log('模型載入進度:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('模型載入失敗:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * 模型載入完成處理
     */
    onModelLoaded(gltf) {
        this.monsterModel = gltf.scene;
        
        // 設置模型屬性
        this.monsterModel.scale.set(
            this.monsterConfig.scale.x,
            this.monsterConfig.scale.y,
            this.monsterConfig.scale.z
        );
        
        this.monsterModel.position.set(
            this.monsterConfig.position.x,
            this.monsterConfig.position.y,
            this.monsterConfig.position.z
        );
        
        this.monsterModel.rotation.set(
            this.monsterConfig.rotation.x,
            this.monsterConfig.rotation.y,
            this.monsterConfig.rotation.z
        );
        
        // 啟用陰影
        this.monsterModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // 添加到場景
        this.scene.add(this.monsterModel);
        
        // 設置動畫
        if (gltf.animations && gltf.animations.length > 0) {
            this.setupAnimations(gltf.animations);
        }
        
        this.isModelLoaded = true;
        console.log('怪物模型載入完成');
        
        if (this.callbacks.onModelLoaded) {
            this.callbacks.onModelLoaded(this.monsterModel);
        }
    }

    /**
     * 設置動畫
     */
    setupAnimations(animations) {
        this.mixer = new THREE.AnimationMixer(this.monsterModel);
        
        animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            this.monsterAnimations[clip.name] = action;
        });
        
        console.log('可用動畫:', Object.keys(this.monsterAnimations));
        
        // 播放默認動畫（如果有 idle 動畫）
        if (this.monsterAnimations['idle']) {
            this.playAnimation('idle', true);
        } else if (Object.keys(this.monsterAnimations).length > 0) {
            const firstAnimation = Object.keys(this.monsterAnimations)[0];
            this.playAnimation(firstAnimation, true);
        }
    }

    /**
     * 播放動畫
     */
    playAnimation(animationName, loop = false) {
        if (!this.mixer || !this.monsterAnimations[animationName]) {
            console.warn(`動畫 ${animationName} 不存在`);
            return false;
        }
        
        const newAction = this.monsterAnimations[animationName];
        
        // 停止當前動畫
        if (this.animationState.currentAction) {
            this.animationState.previousAction = this.animationState.currentAction;
            this.animationState.currentAction.fadeOut(this.animationState.fadeTime);
        }
        
        // 播放新動畫
        this.animationState.currentAction = newAction;
        newAction.reset();
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        newAction.fadeIn(this.animationState.fadeTime);
        newAction.play();
        
        this.animationState.isPlaying = true;
        this.currentAnimation = animationName;
        
        console.log(`播放動畫: ${animationName}`);
        
        if (this.callbacks.onAnimationStart) {
            this.callbacks.onAnimationStart(animationName);
        }
        
        // 如果不是循環動畫，設置結束回調
        if (!loop) {
            newAction.clampWhenFinished = true;
            this.mixer.addEventListener('finished', (e) => {
                if (e.action === newAction) {
                    this.onAnimationFinished(animationName);
                }
            });
        }
        
        return true;
    }

    /**
     * 動畫結束處理
     */
    onAnimationFinished(animationName) {
        console.log(`動畫結束: ${animationName}`);
        this.animationState.isPlaying = false;
        
        if (this.callbacks.onAnimationEnd) {
            this.callbacks.onAnimationEnd(animationName);
        }
        
        // 回到默認動畫
        if (this.monsterAnimations['idle']) {
            this.playAnimation('idle', true);
        }
    }

    /**
     * 停止動畫
     */
    stopAnimation() {
        if (this.animationState.currentAction) {
            this.animationState.currentAction.stop();
            this.animationState.isPlaying = false;
            this.currentAnimation = null;
        }
    }

    /**
     * 暫停動畫
     */
    pauseAnimation() {
        if (this.mixer) {
            this.mixer.timeScale = 0;
        }
    }

    /**
     * 恢復動畫
     */
    resumeAnimation() {
        if (this.mixer) {
            this.mixer.timeScale = 1;
        }
    }

    /**
     * 設置動畫速度
     */
    setAnimationSpeed(speed) {
        if (this.mixer) {
            this.mixer.timeScale = speed;
        }
    }

    /**
     * 開始渲染循環
     */
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            const delta = this.clock.getDelta();
            
            // 更新動畫
            if (this.mixer) {
                this.mixer.update(delta);
            }
            
            // 渲染場景
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        
        animate();
        console.log('Three.js 渲染循環已開始');
    }

    /**
     * 調整渲染器大小
     */
    resize(width, height) {
        if (this.camera && this.renderer) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            
            this.sceneConfig.width = width;
            this.sceneConfig.height = height;
        }
    }

    /**
     * 設置怪物位置
     */
    setMonsterPosition(x, y, z) {
        if (this.monsterModel) {
            this.monsterModel.position.set(x, y, z);
            this.monsterConfig.position = { x, y, z };
        }
    }

    /**
     * 設置怪物旋轉
     */
    setMonsterRotation(x, y, z) {
        if (this.monsterModel) {
            this.monsterModel.rotation.set(x, y, z);
            this.monsterConfig.rotation = { x, y, z };
        }
    }

    /**
     * 設置怪物縮放
     */
    setMonsterScale(x, y, z) {
        if (this.monsterModel) {
            this.monsterModel.scale.set(x, y, z);
            this.monsterConfig.scale = { x, y, z };
        }
    }

    /**
     * 設置相機位置
     */
    setCameraPosition(x, y, z) {
        if (this.camera) {
            this.camera.position.set(x, y, z);
            this.sceneConfig.cameraPosition = { x, y, z };
        }
    }

    /**
     * 設置相機看向目標
     */
    setCameraLookAt(x, y, z) {
        if (this.camera) {
            this.camera.lookAt(x, y, z);
        }
    }

    /**
     * 獲取可用動畫列表
     */
    getAvailableAnimations() {
        return Object.keys(this.monsterAnimations);
    }

    /**
     * 檢查動畫是否存在
     */
    hasAnimation(animationName) {
        return this.monsterAnimations.hasOwnProperty(animationName);
    }

    /**
     * 獲取當前動畫
     */
    getCurrentAnimation() {
        return this.currentAnimation;
    }

    /**
     * 檢查是否正在播放動畫
     */
    isAnimationPlaying() {
        return this.animationState.isPlaying;
    }

    /**
     * 檢查模型是否已載入
     */
    isModelReady() {
        return this.isModelLoaded;
    }

    /**
     * 檢查 Three.js 是否已載入
     */
    isReady() {
        return this.isThreeJsLoaded && this.isGLTFLoaderLoaded;
    }

    /**
     * 獲取場景狀態
     */
    getSceneState() {
        return {
            isReady: this.isReady(),
            isModelLoaded: this.isModelLoaded,
            currentAnimation: this.currentAnimation,
            isAnimationPlaying: this.animationState.isPlaying,
            availableAnimations: this.getAvailableAnimations(),
            sceneConfig: { ...this.sceneConfig },
            monsterConfig: { ...this.monsterConfig }
        };
    }

    /**
     * 清理資源
     */
    dispose() {
        // 停止動畫
        this.stopAnimation();
        
        // 清理模型
        if (this.monsterModel) {
            this.scene.remove(this.monsterModel);
            this.monsterModel = null;
        }
        
        // 清理動畫混合器
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        
        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
            const container = document.querySelector(this.sceneConfig.container);
            if (container && this.renderer.domElement.parentNode === container) {
                container.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }
        
        // 清理場景
        if (this.scene) {
            this.scene.clear();
            this.scene = null;
        }
        
        // 重置狀態
        this.camera = null;
        this.clock = null;
        this.isModelLoaded = false;
        this.monsterAnimations = {};
        this.currentAnimation = null;
        
        console.log('Three.js 資源已清理');
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

// 導出 ThreeManager 類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreeManager;
} else {
    window.ThreeManager = ThreeManager;
}