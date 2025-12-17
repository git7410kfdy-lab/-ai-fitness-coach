// 籃球特殊功能管理模組

function showBasketballPostureCheckPopup() {
    console.log('顯示籃球姿勢檢查彈窗');
    
    // 創建彈窗HTML
    const popupHTML = `
        <div id="basketball-posture-popup" class="basketball-popup-overlay">
            <div class="basketball-popup-content">
                <div class="basketball-popup-header">
                    <h3>籃球投籃姿勢檢查</h3>
                    <button class="basketball-popup-close" onclick="hideBasketballPrompt()">&times;</button>
                </div>
                <div class="basketball-popup-body">
                    <p>請確認您的投籃姿勢是否正確：</p>
                    <ul>
                        <li>雙腳與肩同寬</li>
                        <li>投籃手肘對準籃框</li>
                        <li>非投籃手輔助穩定球</li>
                        <li>投籃時手腕下壓</li>
                    </ul>
                </div>
                <div class="basketball-popup-footer">
                    <button class="btn btn-primary" onclick="hideBasketballPrompt()">確認</button>
                </div>
            </div>
        </div>
    `;
    
    // 將彈窗添加到頁面
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // 添加樣式
    addBasketballPopupStyles();
}

function hideBasketballPrompt() {
    const popup = document.getElementById('basketball-posture-popup');
    if (popup) {
        popup.remove();
    }
}

function showBasketballPrompt() {
    console.log('顯示籃球投籃檢視提示視窗');
    
    const modal = document.getElementById('basketball-prompt-modal');
    
    if (modal) {
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
        }, 10);
        
        console.log('籃球投籃檢視提示視窗已顯示');
    } else {
        console.error('找不到籃球投籃檢視提示視窗元素');
    }
}

function closeBasketballPrompt() {
    if (basketballPromptModal) {
        basketballPromptModal.classList.remove('active');
    }
}

function initBasketballPromptModal() {
    basketballPromptModal = document.getElementById('basketball-prompt-modal');
    
    if (basketballPromptModal) {
        const closeBtn = basketballPromptModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeBasketballPrompt);
        }
        
        const confirmBtn = basketballPromptModal.querySelector('.confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                closeBasketballPrompt();
                // 可以在這裡添加確認後的邏輯
            });
        }
    }
}

function addBasketballPopupStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .basketball-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .basketball-popup-content {
            background: white;
            border-radius: 10px;
            padding: 20px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .basketball-popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .basketball-popup-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }
        
        .basketball-popup-body ul {
            list-style-type: disc;
            padding-left: 20px;
        }
        
        .basketball-popup-footer {
            text-align: center;
            margin-top: 20px;
        }
    `;
    document.head.appendChild(style);
}

// 導出函數
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showBasketballPostureCheckPopup,
        hideBasketballPrompt,
        showBasketballPrompt,
        closeBasketballPrompt,
        initBasketballPromptModal
    };
}