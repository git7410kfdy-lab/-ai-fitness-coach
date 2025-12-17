# AI 健身教練 - 模組化重構說明

## 概述

本項目將原本的 `realtime.js` 單一文件重構為多個模組化的 JavaScript 文件，提高代碼的可維護性、可讀性和可擴展性。

## 模組結構

### 核心模組

1. **socket-manager.js** - Socket.IO 連接管理
   - 管理 WebSocket 連接
   - 處理即時通信事件
   - 發送偵測請求和接收結果

2. **game-manager.js** - 遊戲系統管理
   - 關卡和怪物系統
   - Combo 連擊系統
   - 經驗值和進度管理

3. **ui-manager.js** - 用戶界面管理
   - DOM 元素操作
   - UI 狀態更新
   - 視覺效果控制

4. **exercise-manager.js** - 運動管理
   - 運動類型切換
   - 偵測控制
   - 運動參數設置

5. **map-manager.js** - 地圖系統管理
   - 關卡選擇和導航
   - 地圖滾動控制
   - 關卡解鎖邏輯

6. **three-manager.js** - 3D 渲染管理
   - Three.js 場景管理
   - 3D 模型載入
   - 動畫控制

7. **workout-manager.js** - 訓練計劃管理
   - 訓練計劃設置
   - 進度追蹤
   - 數據統計

### 整合模組

8. **main-app.js** - 主應用程式
   - 模組整合和協調
   - 應用程式初始化
   - 事件綁定和管理

9. **module-loader.js** - 模組載入器
   - 動態載入模組
   - 依賴關係管理
   - 載入狀態追蹤

10. **init.js** - 初始化腳本
    - 應用程式啟動
    - 載入進度顯示
    - 錯誤處理

## 文件結構

```
static/js/modules/
├── socket-manager.js      # Socket.IO 管理
├── game-manager.js        # 遊戲系統
├── ui-manager.js          # UI 管理
├── exercise-manager.js    # 運動管理
├── map-manager.js         # 地圖系統
├── three-manager.js       # 3D 渲染
├── workout-manager.js     # 訓練計劃
├── main-app.js           # 主應用程式
├── module-loader.js      # 模組載入器
└── README.md             # 說明文件

static/js/
└── init.js               # 初始化腳本

app/templates/
├── realtime.html         # 原始 HTML 文件
└── realtime_modular.html # 模組化 HTML 文件
```

## 使用方法

### 1. 使用新的模組化版本

在 HTML 中引入新的模組化系統：

```html
<!-- 模組載入器 -->
<script src="{{ url_for('static', filename='js/modules/module-loader.js') }}"></script>
<!-- 初始化腳本 -->
<script src="{{ url_for('static', filename='js/init.js') }}"></script>
```

### 2. 模組載入順序

模組會按照以下順序自動載入：

1. 核心模組（socket-manager, ui-manager 等）
2. 主應用程式（main-app）
3. 應用程式初始化

### 3. 事件系統

各模組之間通過事件系統進行通信：

```javascript
// 發送事件
this.emit('eventName', data);

// 監聽事件
this.on('eventName', (data) => {
    // 處理事件
});
```

## 模組 API

### SocketManager

```javascript
// 初始化連接
socketManager.initialize();

// 發送偵測請求
socketManager.sendDetectionRequest(data);

// 重置計數
socketManager.resetCount();
```

### GameManager

```javascript
// 初始化遊戲
gameManager.initialize();

// 減少怪物血量
gameManager.damageMonster(damage);

// 重置關卡
gameManager.resetLevel();
```

### UIManager

```javascript
// 更新視頻幀
uiManager.updateVideoFrame(imageData);

// 顯示通知
uiManager.showNotification(title, message);

// 更新運動計數
uiManager.updateExerciseCount(count);
```

### ExerciseManager

```javascript
// 切換運動類型
exerciseManager.switchExercise('squat');

// 開始偵測
exerciseManager.startDetection();

// 停止偵測
exerciseManager.stopDetection();
```

## 兼容性

- 保持與現有 CSS 樣式的兼容性
- 保持與現有 HTML 結構的兼容性
- 支援現有的第三方庫（Three.js, Socket.IO 等）

## 優勢

1. **模組化設計**：每個模組負責特定功能，易於維護
2. **依賴管理**：清晰的模組依賴關係
3. **事件驅動**：模組間通過事件通信，降低耦合度
4. **可擴展性**：易於添加新功能和模組
5. **錯誤處理**：完善的錯誤處理和載入狀態管理
6. **性能優化**：按需載入和初始化

## 遷移指南

### 從原始版本遷移

1. 將 `realtime.html` 替換為 `realtime_modular.html`
2. 確保所有模組文件都已正確放置
3. 測試所有功能是否正常運作
4. 根據需要調整配置

### 自定義模組

如需添加新模組：

1. 創建新的模組文件
2. 實現模組類和必要方法
3. 在 `module-loader.js` 中註冊新模組
4. 在 `main-app.js` 中整合新模組

## 故障排除

### 常見問題

1. **模組載入失敗**
   - 檢查文件路徑是否正確
   - 確認網路連接正常
   - 查看瀏覽器控制台錯誤信息

2. **功能異常**
   - 檢查模組初始化順序
   - 確認事件監聽器是否正確綁定
   - 查看模組間的依賴關係

3. **性能問題**
   - 檢查是否有重複的事件監聽器
   - 確認資源是否正確釋放
   - 優化模組載入順序

## 開發建議

1. **遵循模組化原則**：每個模組應該有單一職責
2. **使用事件通信**：避免直接調用其他模組的方法
3. **錯誤處理**：每個模組都應該有適當的錯誤處理
4. **文檔維護**：及時更新模組文檔和 API 說明
5. **測試覆蓋**：為每個模組編寫適當的測試

## 版本信息

- **版本**：1.0.0
- **創建日期**：2024年
- **最後更新**：2024年
- **兼容性**：支援現代瀏覽器（Chrome, Firefox, Safari, Edge）