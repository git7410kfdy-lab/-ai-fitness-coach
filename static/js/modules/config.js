// 配置和常量模塊
// 從 realtime.js 第1-200行提取的全局變量和配置

// Socket.IO 連接
let socket = null;

// 檢測狀態
let isDetecting = false;
let hasReceivedResponse = false;

// 運動相關變量
let exerciseCounter = 0;
let currentExerciseType = 'squat';
let detectionLine = 0.5;

// 訓練計劃相關 - 直接設置為全域變數
window.workoutPlan = [];
window.currentExerciseIndex = 0;
window.currentExerciseReps = 0;
window.currentExerciseSets = 0;
window.remainingSets = 3;

// 怪物相關變量
let monsterHP = 100;
let initialMonsterHP = 100;
let monsterShield = 0;
let initialMonsterShield = 0;
let currentLevel = 1;
let currentMonsterIndex = 0;
let totalMonsters = 3;

// Combo技能系統變量
let comboSequence = [];
let comboCount = 0;
let lastExerciseType = null;
let comboMultiplier = 1.0;

// Combo 系統常量和變量
const MAX_COMBO_HISTORY = 3;
let exerciseComboHistory = [];
let lastQuality = 0;
let isHandlingCompletion = false;
let planIncludesBasketball = false;
let autoSwitchExercise = true;
let isSwitchingExercise = false;

// UI元素引用
let basketballPromptModal = null;

// 運動模式標誌
let tableTennisActive = false;
let basketballActive = false;
let basketballDribbleActive = false;

// UI元素引用
let videoFeed = null;
let startButton = null;
let stopButton = null;
let resetButton = null;
let exerciseSelect = null;
let switchExerciseButton = null;
let detectionStatus = null;
let coachTipText = null;

// Combo UI元素
let comboSlot1 = null;
let comboSlot2 = null;
let comboSlot3 = null;
let comboSkillResult = null;
let comboDescription = null;



// 技能定義
const COMBO_SKILLS = {
    'power_strike': {
        name: '力量打擊',
        sequence: ['squat', 'shoulder-press', 'bicep-curl'],
        damage: 25,
        description: '深蹲 → 肩推 → 二頭彎舉：造成25點傷害',
        icon: '💪',
        color: '#e74c3c'
    },
    'speed_combo': {
        name: '速度連擊',
        sequence: ['push-up', 'push-up', 'push-up'],
        damage: 20,
        description: '連續三次伏地挺身：造成20點傷害',
        icon: '⚡',
        color: '#f39c12'
    },
    'balanced_assault': {
        name: '平衡突擊',
        sequence: ['squat', 'push-up', 'bicep-curl'],
        damage: 30,
        description: '深蹲 → 伏地挺身 → 二頭彎舉：造成30點傷害',
        icon: '⚖️',
        color: '#9b59b6'
    },
    'ultimate_combo': {
        name: '終極連招',
        sequence: ['squat', 'shoulder-press', 'push-up'],
        damage: 35,
        description: '深蹲 → 肩推 → 伏地挺身：造成35點傷害',
        icon: '🔥',
        color: '#e67e22'
    }
};

// 運動類型映射
const EXERCISE_NAMES = {
    'squat': '深蹲',
    'bicep-curl': '二頭彎舉',
    'shoulder-press': '肩推',
    'push-up': '伏地挺身',
    'pull-up': '引體向上',
    'dumbbell-row': '啞鈴划船',
    'table-tennis': '桌球揮拍',
    'basketball': '籃球投籃',
    'basketball-dribble': '籃球運球',
    'volleyball-overhand': '排球高手托球',
    'volleyball-lowhand': '排球低手接球'
};

// 關卡配置
const LEVEL_CONFIG = {
    1: { hp: 100, shield: 0, name: '森林入口' },
    2: { hp: 150, shield: 20, name: '山脈守衛' },
    3: { hp: 200, shield: 40, name: '湖泊巨獸' },
    4: { hp: 250, shield: 60, name: '洞窟惡魔' },
    5: { hp: 300, shield: 80, name: '龍王' }
};

// 導出所有配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 變量
        socket, isDetecting, hasReceivedResponse,
        exerciseCounter, currentExerciseType, detectionLine,
        workoutPlan, currentExerciseIndex, currentExerciseReps, currentExerciseSets, remainingSets,
        monsterHP, initialMonsterHP, monsterShield, initialMonsterShield, currentLevel,
        comboSequence, comboCount, lastExerciseType, comboMultiplier,
        tableTennisActive, basketballActive, basketballDribbleActive,
        videoFeed, startButton, stopButton, resetButton, exerciseSelect, switchExerciseButton,
        detectionStatus, coachTipText,
        comboSlot1, comboSlot2, comboSlot3, comboSkillResult, comboDescription,
        
        // 常量
        COMBO_SKILLS, EXERCISE_NAMES, LEVEL_CONFIG
    };
}