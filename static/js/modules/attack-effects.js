/**
 * Attack Effects Manager Module
 * 負責管理攻擊特效系統，包括多種攻擊類型和視覺效果
 */

class AttackEffectsManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.effects = [];
        this.isInitialized = false;
        
        // 攻擊類型配置
        this.attackTypes = {
            // 上肢運動 - 拳頭攻擊
            'push_up': {
                type: 'punch',
                color: '#FF6B35',
                secondaryColor: '#FF8E53',
                size: 80,
                duration: 800,
                particles: 15,
                sound: 'punch'
            },
            'pull_up': {
                type: 'punch',
                color: '#4ECDC4',
                secondaryColor: '#45B7B8',
                size: 85,
                duration: 850,
                particles: 18,
                sound: 'punch'
            },
            
            // 下肢運動 - 閃電攻擊
            'squat': {
                type: 'lightning',
                color: '#FFE66D',
                secondaryColor: '#FF6B6B',
                size: 60,
                duration: 600,
                particles: 25,
                sound: 'lightning'
            },
            'lunge': {
                type: 'lightning',
                color: '#A8E6CF',
                secondaryColor: '#88D8A3',
                size: 65,
                duration: 650,
                particles: 22,
                sound: 'lightning'
            },
            
            // 球類運動 - 火焰攻擊
            'basketball_shooting': {
                type: 'fireball',
                color: '#FF6B35',
                secondaryColor: '#FFD93D',
                size: 70,
                duration: 900,
                particles: 30,
                sound: 'fire'
            },
            'basketball_dribble': {
                type: 'fireball',
                color: '#FF8E53',
                secondaryColor: '#FFE66D',
                size: 65,
                duration: 850,
                particles: 28,
                sound: 'fire'
            },
            
            // 桌球 - 水花攻擊
            'table_tennis': {
                type: 'water',
                color: '#4ECDC4',
                secondaryColor: '#96CEB4',
                size: 55,
                duration: 700,
                particles: 35,
                sound: 'water'
            },
            
            // 排球 - 風刃攻擊
            'volleyball': {
                type: 'wind',
                color: '#FFEAA7',
                secondaryColor: '#DDA0DD',
                size: 75,
                duration: 750,
                particles: 20,
                sound: 'wind'
            },
            
            // 默認攻擊
            'default': {
                type: 'energy',
                color: '#74B9FF',
                secondaryColor: '#0984E3',
                size: 60,
                duration: 700,
                particles: 20,
                sound: 'energy'
            }
        };
        
        // 動畫參數
        this.animationId = null;
        this.lastTime = 0;
        
        // 性能控制
        this.maxEffects = 5; // 最大同時特效數量
        this.performanceMode = false; // 性能模式
        
        // 音效系統
        this.sounds = {
            punch: new Audio('/static/sounds/punch.mp3'),
            lightning: new Audio('/static/sounds/lightning.mp3'),
            fire: new Audio('/static/sounds/fire.mp3'),
            water: new Audio('/static/sounds/water.mp3'),
            wind: new Audio('/static/sounds/wind.mp3'),
            energy: new Audio('/static/sounds/energy.mp3')
        };
        
        // 設置音效音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.3;
        });
    }
    
    /**
     * 初始化攻擊特效系統
     */
    init() {
        if (this.isInitialized) return;
        
        console.log('初始化攻擊特效系統');
        
        // 創建畫布
        this.createCanvas();
        
        this.isInitialized = true;
    }
    
    /**
     * 創建攻擊特效畫布
     */
    createCanvas() {
        console.log('[AttackEffectsManager] 開始創建畫布');
        
        // 檢查是否已存在畫布
        this.canvas = document.getElementById('attack-effects-canvas');
        
        if (!this.canvas) {
            console.log('[AttackEffectsManager] 畫布不存在，正在創建新畫布');
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'attack-effects-canvas';
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '9999';
            document.body.appendChild(this.canvas);
            console.log('[AttackEffectsManager] 畫布已創建並添加到頁面');
        } else {
            console.log('[AttackEffectsManager] 使用現有畫布');
        }
        
        this.ctx = this.canvas.getContext('2d');
        console.log('[AttackEffectsManager] 畫布上下文已獲取:', !!this.ctx);
        
        this.resizeCanvas();
        console.log('[AttackEffectsManager] 畫布大小已調整:', { width: this.canvas.width, height: this.canvas.height });
        
        // 監聽窗口大小變化
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    /**
     * 調整畫布大小
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log('[AttackEffectsManager] 畫布大小調整為:', { width: this.canvas.width, height: this.canvas.height });
    }
    
    /**
     * 獲取元素中心位置
     */
    getElementCenter(elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`找不到元素: ${elementId}`);
            console.log('當前頁面中的所有元素 ID:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return { x: 0, y: 0 };
        }
        
        const rect = element.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        console.log(`元素 ${elementId} 中心位置:`, center, '元素尺寸:', { width: rect.width, height: rect.height });
        return center;
    }
    
    /**
     * 觸發攻擊特效
     */
    triggerAttack(exerciseType, fromElementId = 'video-feed', toElementId = 'monster-container') {
        // 觸發攻擊特效
        
        if (!this.isInitialized) {
            this.init();
        }
        
        const attackConfig = this.attackTypes[exerciseType] || this.attackTypes.default;
        
        const startPos = this.getElementCenter(fromElementId);
        const endPos = this.getElementCenter(toElementId);
        
        // 檢查特效數量限制
        if (this.effects.length >= this.maxEffects) {
            this.effects.shift();
        }
        
        // 創建攻擊特效
        const effect = this.createAttackEffect(attackConfig, startPos, endPos);
        this.effects.push(effect);
        
        // 重新啟動動畫循環（如果已停止）
        this.startAnimation();
        
        // 播放音效
        this.playSound(attackConfig.sound);
        
        // 觸發怪物受擊效果
        setTimeout(() => {
            this.triggerMonsterHit();
        }, effect.duration * 0.7);
    }
    
    /**
     * 創建攻擊特效對象
     */
    createAttackEffect(config, startPos, endPos) {
        const effect = {
            type: config.type,
            startPos: { ...startPos },
            endPos: { ...endPos },
            currentPos: { ...startPos },
            color: config.color,
            secondaryColor: config.secondaryColor,
            size: config.size,
            duration: config.duration,
            particles: [],
            startTime: performance.now(),
            progress: 0,
            isActive: true
        };
        
        // 根據攻擊類型創建特效
        switch (config.type) {
            case 'punch':
                this.createPunchEffect(effect, config);
                break;
            case 'lightning':
                this.createLightningEffect(effect, config);
                break;
            case 'fireball':
                this.createFireballEffect(effect, config);
                break;
            case 'water':
                this.createWaterEffect(effect, config);
                break;
            case 'wind':
                this.createWindEffect(effect, config);
                break;
            default:
                this.createEnergyEffect(effect, config);
        }
        
        return effect;
    }
    
    /**
     * 創建拳頭攻擊特效
     */
    createPunchEffect(effect, config) {
        effect.fistSize = config.size;
        effect.trail = [];
        
        // 創建拳頭軌跡粒子
        for (let i = 0; i < config.particles; i++) {
            effect.particles.push({
                x: effect.startPos.x + (Math.random() - 0.5) * 20,
                y: effect.startPos.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1,
                decay: 0.02,
                size: Math.random() * 8 + 4
            });
        }
    }
    
    /**
     * 創建閃電攻擊特效
     */
    createLightningEffect(effect, config) {
        effect.segments = [];
        effect.branches = [];
        
        // 創建主閃電路徑
        const distance = Math.sqrt(
            Math.pow(effect.endPos.x - effect.startPos.x, 2) +
            Math.pow(effect.endPos.y - effect.startPos.y, 2)
        );
        
        const segmentCount = Math.floor(distance / 20);
        for (let i = 0; i <= segmentCount; i++) {
            const t = i / segmentCount;
            effect.segments.push({
                x: effect.startPos.x + (effect.endPos.x - effect.startPos.x) * t + (Math.random() - 0.5) * 30,
                y: effect.startPos.y + (effect.endPos.y - effect.startPos.y) * t + (Math.random() - 0.5) * 30
            });
        }
        
        // 創建閃電分支
        for (let i = 0; i < 5; i++) {
            const branchStart = effect.segments[Math.floor(Math.random() * effect.segments.length)];
            effect.branches.push({
                startX: branchStart.x,
                startY: branchStart.y,
                endX: branchStart.x + (Math.random() - 0.5) * 100,
                endY: branchStart.y + (Math.random() - 0.5) * 100,
                life: Math.random() * 0.5 + 0.5
            });
        }
    }
    
    /**
     * 創建火球攻擊特效
     */
    createFireballEffect(effect, config) {
        effect.fireSize = config.size;
        effect.flames = [];
        
        // 創建火焰粒子
        for (let i = 0; i < config.particles; i++) {
            effect.flames.push({
                x: 0,
                y: 0,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: Math.random() * 0.8 + 0.2,
                decay: 0.015,
                size: Math.random() * 15 + 5,
                heat: Math.random()
            });
        }
    }
    
    /**
     * 創建水花攻擊特效
     */
    createWaterEffect(effect, config) {
        effect.droplets = [];
        
        // 創建水滴粒子
        for (let i = 0; i < config.particles; i++) {
            effect.droplets.push({
                x: 0,
                y: 0,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                decay: 0.02,
                size: Math.random() * 6 + 3,
                bounce: Math.random() * 0.3 + 0.7
            });
        }
    }
    
    /**
     * 創建風刃攻擊特效
     */
    createWindEffect(effect, config) {
        effect.windLines = [];
        
        // 創建風線
        for (let i = 0; i < config.particles; i++) {
            effect.windLines.push({
                startX: 0,
                startY: 0,
                endX: 0,
                endY: 0,
                life: 1,
                decay: 0.025,
                thickness: Math.random() * 3 + 1,
                speed: Math.random() * 5 + 3
            });
        }
    }
    
    /**
     * 創建能量攻擊特效
     */
    createEnergyEffect(effect, config) {
        effect.energySize = config.size;
        effect.rings = [];
        
        // 創建能量環
        for (let i = 0; i < 3; i++) {
            effect.rings.push({
                radius: i * 20 + 10,
                life: 1,
                decay: 0.02,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }
    
    /**
     * 播放音效
     */
    playSound(soundType) {
        try {
            const sound = this.sounds[soundType];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => {
                    console.warn('無法播放音效:', e);
                });
            }
        } catch (e) {
            console.warn('音效播放錯誤:', e);
        }
    }
    
    /**
     * 觸發怪物受擊效果
     */
    triggerMonsterHit() {
        const monsterContainer = document.getElementById('monster-container');
        if (monsterContainer) {
            // 添加受擊動畫類
            monsterContainer.classList.add('monster-hit');
            
            // 移除動畫類
            setTimeout(() => {
                monsterContainer.classList.remove('monster-hit');
            }, 500);
        }
    }
    
    /**
     * 開始動畫循環
     */
    startAnimation() {
        if (this.animationId) {
            return; // 已經在運行
        }
        
        const animate = (currentTime) => {
            this.update(currentTime);
            this.render();
            
            // 如果還有活躍特效，繼續動畫
            if (this.effects.length > 0) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.animationId = null;
            }
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    /**
      * 停止動畫循環
      */
     stopAnimation() {
         if (this.animationId) {
             cancelAnimationFrame(this.animationId);
             this.animationId = null;
         }
     }
     
     /**
      * 清理所有特效
      */
     clearAllEffects() {
         this.effects = [];
         this.stopAnimation();
         if (this.ctx) {
             this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
         }
         console.log('[AttackEffectsManager] 所有特效已清理');
     }
     
     /**
      * 銷毀攻擊特效系統
      */
     destroy() {
         this.clearAllEffects();
         
         if (this.canvas && this.canvas.parentNode) {
             this.canvas.parentNode.removeChild(this.canvas);
         }
         
         this.canvas = null;
         this.ctx = null;
         this.isInitialized = false;
         
         console.log('[AttackEffectsManager] 攻擊特效系統已銷毀');
     }
     
     /**
      * 性能監控
      */
     checkPerformance() {
         const activeEffects = this.effects.length;
         
         // 如果特效數量過多，啟用性能模式
         if (activeEffects > 3 && !this.performanceMode) {
             this.performanceMode = true;
             this.maxEffects = 3;
             console.warn('[AttackEffectsManager] 啟用性能模式：特效數量過多');
         } else if (activeEffects <= 1 && this.performanceMode) {
             this.performanceMode = false;
             this.maxEffects = 5;
             console.log('[AttackEffectsManager] 關閉性能模式：特效數量正常');
         }
     }
    
    /**
     * 更新特效
     */
    update(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 性能監控
        this.checkPerformance();
        
        // 更新所有特效
        this.effects = this.effects.filter(effect => {
            if (!effect.isActive) return false;
            
            const elapsed = currentTime - effect.startTime;
            effect.progress = Math.min(elapsed / effect.duration, 1);
            
            // 更新位置
            effect.currentPos.x = effect.startPos.x + 
                (effect.endPos.x - effect.startPos.x) * this.easeOutCubic(effect.progress);
            effect.currentPos.y = effect.startPos.y + 
                (effect.endPos.y - effect.startPos.y) * this.easeOutCubic(effect.progress);
            
            // 更新特效類型特定的屬性
            this.updateEffectType(effect, deltaTime);
            
            // 檢查是否完成
            if (effect.progress >= 1) {
                effect.isActive = false;
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * 更新特定類型的特效
     */
    updateEffectType(effect, deltaTime) {
        switch (effect.type) {
            case 'punch':
                this.updatePunchEffect(effect, deltaTime);
                break;
            case 'lightning':
                this.updateLightningEffect(effect, deltaTime);
                break;
            case 'fireball':
                this.updateFireballEffect(effect, deltaTime);
                break;
            case 'water':
                this.updateWaterEffect(effect, deltaTime);
                break;
            case 'wind':
                this.updateWindEffect(effect, deltaTime);
                break;
            case 'energy':
                this.updateEnergyEffect(effect, deltaTime);
                break;
        }
    }
    
    /**
     * 更新拳頭特效
     */
    updatePunchEffect(effect, deltaTime) {
        // 更新軌跡
        effect.trail.push({ x: effect.currentPos.x, y: effect.currentPos.y, life: 1 });
        if (effect.trail.length > 10) {
            effect.trail.shift();
        }
        
        effect.trail.forEach(point => {
            point.life -= 0.1;
        });
        
        // 更新粒子
        effect.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
        });
    }
    
    /**
     * 更新閃電特效
     */
    updateLightningEffect(effect, deltaTime) {
        // 更新閃電分支
        effect.branches.forEach(branch => {
            branch.life -= 0.05;
        });
        
        effect.branches = effect.branches.filter(branch => branch.life > 0);
    }
    
    /**
     * 更新火球特效
     */
    updateFireballEffect(effect, deltaTime) {
        effect.flames.forEach(flame => {
            flame.x = effect.currentPos.x + flame.vx;
            flame.y = effect.currentPos.y + flame.vy;
            flame.life -= flame.decay;
            flame.vx *= 0.98;
            flame.vy *= 0.98;
        });
    }
    
    /**
     * 更新水花特效
     */
    updateWaterEffect(effect, deltaTime) {
        effect.droplets.forEach(droplet => {
            droplet.x = effect.currentPos.x + droplet.vx;
            droplet.y = effect.currentPos.y + droplet.vy;
            droplet.life -= droplet.decay;
            droplet.vy += 0.2; // 重力
        });
    }
    
    /**
     * 更新風刃特效
     */
    updateWindEffect(effect, deltaTime) {
        effect.windLines.forEach(line => {
            const angle = Math.atan2(
                effect.endPos.y - effect.startPos.y,
                effect.endPos.x - effect.startPos.x
            );
            
            line.startX = effect.currentPos.x;
            line.startY = effect.currentPos.y;
            line.endX = effect.currentPos.x + Math.cos(angle) * line.speed * 10;
            line.endY = effect.currentPos.y + Math.sin(angle) * line.speed * 10;
            line.life -= line.decay;
        });
    }
    
    /**
     * 更新能量特效
     */
    updateEnergyEffect(effect, deltaTime) {
        effect.rings.forEach(ring => {
            ring.rotation += 0.1;
            ring.life -= ring.decay;
        });
    }
    
    /**
     * 渲染特效
     */
    render() {
        if (!this.ctx) {
            console.warn('[AttackEffectsManager] 渲染失敗：上下文不存在');
            return;
        }
        
        // 清除畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染所有特效
        this.effects.forEach((effect) => {
            this.renderEffect(effect);
        });
    }
    
    /**
     * 渲染單個特效
     */
    renderEffect(effect) {
        this.ctx.save();
        
        switch (effect.type) {
            case 'punch':
                this.renderPunchEffect(effect);
                break;
            case 'lightning':
                this.renderLightningEffect(effect);
                break;
            case 'fireball':
                this.renderFireballEffect(effect);
                break;
            case 'water':
                this.renderWaterEffect(effect);
                break;
            case 'wind':
                this.renderWindEffect(effect);
                break;
            case 'energy':
                this.renderEnergyEffect(effect);
                break;
        }
        
        this.ctx.restore();
    }
    
    /**
     * 渲染拳頭特效
     */
    renderPunchEffect(effect) {
        // 渲染拳頭軌跡
        effect.trail.forEach((point, index) => {
            if (point.life <= 0) return;
            
            this.ctx.globalAlpha = point.life * 0.5;
            this.ctx.fillStyle = effect.color;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 5 * point.life, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // 渲染主拳頭
        this.ctx.globalAlpha = 1 - effect.progress;
        this.ctx.fillStyle = effect.color;
        this.ctx.strokeStyle = effect.secondaryColor;
        this.ctx.lineWidth = 3;
        
        // 繪製拳頭形狀
        const size = effect.fistSize * (1 + effect.progress * 0.5);
        this.ctx.beginPath();
        this.ctx.roundRect(
            effect.currentPos.x - size/2,
            effect.currentPos.y - size/2,
            size, size * 0.8, 10
        );
        this.ctx.fill();
        this.ctx.stroke();
        
        // 渲染粒子
        effect.particles.forEach(particle => {
            if (particle.life <= 0) return;
            
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = effect.secondaryColor;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    /**
     * 渲染閃電特效
     */
    renderLightningEffect(effect) {
        this.ctx.globalAlpha = 1 - effect.progress;
        this.ctx.strokeStyle = effect.color;
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = effect.color;
        this.ctx.shadowBlur = 10;
        
        // 渲染主閃電
        this.ctx.beginPath();
        effect.segments.forEach((segment, index) => {
            if (index === 0) {
                this.ctx.moveTo(segment.x, segment.y);
            } else {
                this.ctx.lineTo(segment.x, segment.y);
            }
        });
        this.ctx.stroke();
        
        // 渲染分支
        effect.branches.forEach(branch => {
            if (branch.life <= 0) return;
            
            this.ctx.globalAlpha = branch.life * (1 - effect.progress);
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(branch.startX, branch.startY);
            this.ctx.lineTo(branch.endX, branch.endY);
            this.ctx.stroke();
        });
    }
    
    /**
     * 渲染火球特效
     */
    renderFireballEffect(effect) {
        // 渲染火焰粒子
        effect.flames.forEach(flame => {
            if (flame.life <= 0) return;
            
            const hue = flame.heat > 0.5 ? 15 : 45; // 橙色到黃色
            this.ctx.globalAlpha = flame.life;
            this.ctx.fillStyle = `hsl(${hue}, 100%, ${50 + flame.heat * 30}%)`;
            this.ctx.beginPath();
            this.ctx.arc(flame.x, flame.y, flame.size * flame.life, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // 渲染主火球
        this.ctx.globalAlpha = 1 - effect.progress;
        const gradient = this.ctx.createRadialGradient(
            effect.currentPos.x, effect.currentPos.y, 0,
            effect.currentPos.x, effect.currentPos.y, effect.fireSize
        );
        gradient.addColorStop(0, effect.color);
        gradient.addColorStop(0.5, effect.secondaryColor);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.currentPos.x, effect.currentPos.y, effect.fireSize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * 渲染水花特效
     */
    renderWaterEffect(effect) {
        // 渲染水滴
        effect.droplets.forEach(droplet => {
            if (droplet.life <= 0) return;
            
            this.ctx.globalAlpha = droplet.life;
            this.ctx.fillStyle = effect.color;
            this.ctx.beginPath();
            this.ctx.arc(droplet.x, droplet.y, droplet.size * droplet.life, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // 渲染主水球
        this.ctx.globalAlpha = 1 - effect.progress;
        const gradient = this.ctx.createRadialGradient(
            effect.currentPos.x, effect.currentPos.y, 0,
            effect.currentPos.x, effect.currentPos.y, 40
        );
        gradient.addColorStop(0, effect.color);
        gradient.addColorStop(1, effect.secondaryColor);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.currentPos.x, effect.currentPos.y, 40 * (1 - effect.progress), 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * 渲染風刃特效
     */
    renderWindEffect(effect) {
        effect.windLines.forEach(line => {
            if (line.life <= 0) return;
            
            this.ctx.globalAlpha = line.life * (1 - effect.progress);
            this.ctx.strokeStyle = effect.color;
            this.ctx.lineWidth = line.thickness;
            this.ctx.beginPath();
            this.ctx.moveTo(line.startX, line.startY);
            this.ctx.lineTo(line.endX, line.endY);
            this.ctx.stroke();
        });
    }
    
    /**
     * 渲染能量特效
     */
    renderEnergyEffect(effect) {
        // 渲染能量環
        effect.rings.forEach(ring => {
            if (ring.life <= 0) return;
            
            this.ctx.globalAlpha = ring.life * (1 - effect.progress);
            this.ctx.strokeStyle = effect.color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(effect.currentPos.x, effect.currentPos.y, ring.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // 渲染主能量球
        this.ctx.globalAlpha = 1 - effect.progress;
        const gradient = this.ctx.createRadialGradient(
            effect.currentPos.x, effect.currentPos.y, 0,
            effect.currentPos.x, effect.currentPos.y, effect.energySize
        );
        gradient.addColorStop(0, effect.color);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.currentPos.x, effect.currentPos.y, effect.energySize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    

    
    /**
     * 緩動函數
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    /**
     * 清理資源
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        this.effects = [];
        this.isInitialized = false;
    }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttackEffectsManager;
} else if (typeof window !== 'undefined') {
    window.AttackEffectsManager = AttackEffectsManager;
}