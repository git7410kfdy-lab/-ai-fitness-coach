/**
 * 運動選項管理模組
 * 統一管理所有運動類型的選項，確保一致性
 */

class ExerciseOptions {
    constructor() {
        this.exerciseTypes = [
            { value: 'squat', label: '深蹲' },
            { value: 'bicep-curl', label: '二頭彎舉' },
            { value: 'shoulder-press', label: '肩推' },
            { value: 'push-up', label: '伏地挺身' },
            { value: 'pull-up', label: '引體向上' },
            { value: 'dumbbell-row', label: '啞鈴划船' },
            { value: 'arm-swing-warmup', label: '坐姿手臂擺動暖身' },
            { value: 'alternating-arm-swing', label: '雙手輪流擺動熱身' },
            { value: 'plank', label: '平板支撐' },
            { value: 'table-tennis', label: '桌球揮拍' },
            { value: 'basketball', label: '籃球投籃' },
            { value: 'basketball-dribble', label: '籃球運球' },
            { value: 'volleyball-overhand', label: '排球高手托球' },
            { value: 'volleyball-lowhand', label: '排球低手接球' }
        ];
    }

    /**
     * 獲取所有運動類型
     * @returns {Array} 運動類型陣列
     */
    getAllExerciseTypes() {
        return this.exerciseTypes;
    }

    /**
     * 根據值獲取運動類型標籤
     * @param {string} value - 運動類型值
     * @returns {string} 運動類型標籤
     */
    getExerciseLabel(value) {
        const exercise = this.exerciseTypes.find(type => type.value === value);
        return exercise ? exercise.label : value;
    }

    /**
     * 創建運動類型選項的HTML字符串
     * @param {string} selectedValue - 預選的值
     * @returns {string} HTML選項字符串
     */
    createOptionsHTML(selectedValue = '') {
        return this.exerciseTypes.map(type => 
            `<option value="${type.value}" ${type.value === selectedValue ? 'selected' : ''}>${type.label}</option>`
        ).join('');
    }

    /**
     * 填充選擇框元素
     * @param {HTMLSelectElement} selectElement - 選擇框元素
     * @param {string} selectedValue - 預選的值
     */
    populateSelectElement(selectElement, selectedValue = '') {
        if (!selectElement) {
            console.error('ExerciseOptions: 選擇框元素不存在');
            return;
        }

        selectElement.innerHTML = this.createOptionsHTML(selectedValue);
    }

    /**
     * 驗證運動類型是否有效
     * @param {string} value - 運動類型值
     * @returns {boolean} 是否有效
     */
    isValidExerciseType(value) {
        return this.exerciseTypes.some(type => type.value === value);
    }

    /**
     * 獲取運動類型的分類
     * @param {string} value - 運動類型值
     * @returns {string} 運動分類
     */
    getExerciseCategory(value) {
        const categories = {
            'squat': 'strength',
            'bicep-curl': 'strength',
            'shoulder-press': 'strength',
            'push-up': 'strength',
            'pull-up': 'strength',
            'dumbbell-row': 'strength',
            'arm-swing-warmup': 'warmup',
            'alternating-arm-swing': 'warmup',
            'table-tennis': 'sport',
            'basketball': 'sport',
            'basketball-dribble': 'sport',
            'volleyball-overhand': 'sport',
            'volleyball-lowhand': 'sport'
        };
        return categories[value] || 'unknown';
    }
}

// 運動選項管理模組
// 統一管理所有運動類型選項，避免重複定義

const exerciseOptions = {
    // 所有可用的運動類型
    allExercises: [
        { value: 'squat', text: '深蹲' },
        { value: 'bicep-curl', text: '二頭彎舉' },
        { value: 'shoulder-press', text: '肩推' },
        { value: 'push-up', text: '伏地挺身' },
        { value: 'pull-up', text: '引體向上' },
        { value: 'dumbbell-row', text: '啞鈴划船' },
        { value: 'arm-swing-warmup', text: '坐姿手臂擺動暖身' },
        { value: 'alternating-arm-swing', text: '雙手輪流擺動熱身' },
        { value: 'plank', text: '平板支撐' },
        { value: 'table-tennis', text: '桌球揮拍' },
        { value: 'basketball', text: '籃球投籃' },
        { value: 'basketball-dribble', text: '籃球運球' },
        { value: 'volleyball-overhand', text: '排球高手托球' },
        { value: 'volleyball-lowhand', text: '排球低手接球' }
    ],

    // 獲取所有運動選項
    getAllExercises() {
        return this.allExercises;
    },

    // 根據值獲取文字
    getExerciseText(value) {
        const exercise = this.allExercises.find(ex => ex.value === value);
        return exercise ? exercise.text : value;
    },

    // 根據文字獲取值
    getExerciseValue(text) {
        const exercise = this.allExercises.find(ex => ex.text === text);
        return exercise ? exercise.value : text;
    },

    // 初始化運動選項下拉選單
    initializeSelectOptions(selector = '.exercise-selector, [name="exercise-type[]"], #exercise-type') {
        const selects = document.querySelectorAll(selector);
        
        selects.forEach(select => {
            // 保存當前選中的值
            const currentValue = select.value;
            
            // 清空現有選項
            select.innerHTML = '';
            
            // 添加所有運動選項
            this.allExercises.forEach(exercise => {
                const option = document.createElement('option');
                option.value = exercise.value;
                option.textContent = exercise.text;
                if (exercise.value === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        });
        
        console.log(`運動選項已初始化，更新了 ${selects.length} 個選擇框`);
    },
    
    // 新增方法：為特定選擇框初始化選項
    initializeSpecificSelect(selectElement) {
        if (!selectElement) return;
        
        // 清空現有選項
        selectElement.innerHTML = '';
        
        // 添加所有運動選項
        this.allExercises.forEach(exercise => {
            const option = document.createElement('option');
            option.value = exercise.value;
            option.textContent = exercise.text;
            
            // 如果是深蹲，設為預設選中
            if (exercise.value === 'squat') {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
        
        console.log('特定選擇框的運動選項已初始化');
    }
};

// 將模組暴露到全域
window.exerciseOptions = exerciseOptions;

// DOM 載入完成後自動初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延遲初始化，確保所有元素都已載入
    setTimeout(() => {
        exerciseOptions.initializeSelectOptions();
    }, 100);
});

// 也在頁面完全載入後再次初始化，確保動態添加的元素也能被處理
window.addEventListener('load', function() {
    setTimeout(() => {
        exerciseOptions.initializeSelectOptions();
    }, 200);
});