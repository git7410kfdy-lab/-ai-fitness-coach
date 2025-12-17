/**
 * 學號管理模組
 * 處理學號輸入、驗證和數據傳送
 */

// 全局變數
let currentStudentId = '';

/**
 * 初始化學號管理器
 */
function initStudentManager() {
    console.log('初始化學號管理器');
    
    // 綁定學號輸入事件
    const studentIdInput = document.getElementById('student-id-input');
    if (studentIdInput) {
        studentIdInput.addEventListener('input', handleStudentIdInput);
        studentIdInput.addEventListener('blur', validateStudentId);
    }
    
    // 從localStorage恢復學號
    const savedStudentId = localStorage.getItem('student_id');
    if (savedStudentId && studentIdInput) {
        studentIdInput.value = savedStudentId;
        currentStudentId = savedStudentId;
    }
}

/**
 * 處理學號輸入
 */
function handleStudentIdInput(event) {
    const studentId = event.target.value.trim();
    currentStudentId = studentId;
    
    // 保存到localStorage
    if (studentId) {
        localStorage.setItem('student_id', studentId);
    } else {
        localStorage.removeItem('student_id');
    }
    
    console.log('學號已更新:', currentStudentId);
}

/**
 * 驗證學號格式
 */
function validateStudentId() {
    const studentIdInput = document.getElementById('student-id-input');
    if (!studentIdInput) return true;
    
    const studentId = studentIdInput.value.trim();
    
    // 基本驗證：不能為空
    if (!studentId) {
        showStudentIdError('請輸入學號');
        return false;
    }
    
    // 長度驗證
    if (studentId.length < 3) {
        showStudentIdError('學號長度不能少於3位');
        return false;
    }
    
    // 可以添加更多驗證規則，例如格式檢查
    if (studentId.length > 20) {
        showStudentIdError('學號長度不能超過20位');
        return false;
    }
    
    // 檢查是否包含特殊字符（可選）
    const validPattern = /^[a-zA-Z0-9]+$/;
    if (!validPattern.test(studentId)) {
        showStudentIdError('學號只能包含字母和數字');
        return false;
    }
    
    // 清除錯誤提示
    clearStudentIdError();
    return true;
}


//檢查學號是否已輸入且有效

function isStudentIdValid() {
    const studentId = getCurrentStudentId();
    return studentId && studentId.trim().length >= 3;
}

//強制驗證學號（用於開始訓練前）
function requireValidStudentId() {
    if (!isStudentIdValid()) {
        const studentIdInput = document.getElementById('student-id-input');
        if (studentIdInput) {
            studentIdInput.focus();
            showStudentIdError('開始訓練前請先輸入有效的學號');
        }
        return false;
    }
    return true;
}


//顯示學號錯誤提示

function showStudentIdError(message) {
    const studentIdInput = document.getElementById('student-id-input');
    if (!studentIdInput) return;
    
    // 移除現有錯誤提示
    clearStudentIdError();
    
    // 添加錯誤樣式
    studentIdInput.classList.add('error');
    
    // 創建錯誤提示元素
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.id = 'student-id-error';
    
    // 插入錯誤提示
    studentIdInput.parentNode.appendChild(errorElement);
}

/**
 * 清除學號錯誤提示
 */
function clearStudentIdError() {
    const studentIdInput = document.getElementById('student-id-input');
    const errorElement = document.getElementById('student-id-error');
    
    if (studentIdInput) {
        studentIdInput.classList.remove('error');
    }
    
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * 獲取當前學號
 */
function getCurrentStudentId() {
    return currentStudentId;
}

/**
 * 設置學號
 */
function setStudentId(studentId) {
    currentStudentId = studentId;
    const studentIdInput = document.getElementById('student-id-input');
    if (studentIdInput) {
        studentIdInput.value = studentId;
    }
    
    if (studentId) {
        localStorage.setItem('student_id', studentId);
    }
}

/**
 * 檢查是否已輸入學號
 */
function hasValidStudentId() {
    return currentStudentId && currentStudentId.trim().length > 0;
}

/**
 * 在開始檢測前驗證學號
 */
function validateStudentIdBeforeStart() {
    if (!hasValidStudentId()) {
        showNotification('請先輸入學號才能開始訓練', 'error');
        const studentIdInput = document.getElementById('student-id-input');
        if (studentIdInput) {
            studentIdInput.focus();
        }
        return false;
    }
    return validateStudentId();
}

/**
 * 準備發送到後端的學號數據
 */
function prepareStudentData() {
    return {
        student_id: currentStudentId
    };
}

// 導出函數供其他模組使用
if (typeof window !== 'undefined') {
    window.StudentManager = {
        init: initStudentManager,
        getCurrentStudentId,
        setStudentId,
        hasValidStudentId,
        validateStudentIdBeforeStart,
        prepareStudentData
    };
}