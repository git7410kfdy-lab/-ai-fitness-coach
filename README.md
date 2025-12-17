# AI Fitness Coach - AI 健身教練

基於 YOLOv8 姿態檢測的即時運動分析 Web 應用程式，提供遊戲化健身體驗。

## 功能特色

- **即時姿態檢測**：使用 YOLOv8 模型即時分析運動動作
- **多種運動支援**：
  - 健身運動：深蹲、二頭彎舉、肩推、伏地挺身、引體向上、啞鈴划船
  - 球類運動：桌球、籃球、排球
  - 武術訓練：跆拳道
- **遊戲化系統**：關卡挑戰、怪物戰鬥、Combo 連擊、經驗值系統
- **3D 視覺效果**：Three.js 渲染的 3D 場景與角色
- **訓練計劃追蹤**：個人化訓練進度與數據分析

## 文件

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 完整系統架構文件
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code 開發指引

## 技術架構

### 後端
- **Flask 2.3.3** - Web 框架
- **Flask-SocketIO 5.3.4** - WebSocket 即時通訊
- **YOLOv8 (ultralytics)** - 姿態檢測模型
- **PyTorch 2.0.1** - 深度學習框架
- **OpenCV** - 影像處理
- **MySQL** - 資料庫

### 前端
- **原生 JavaScript (ES6 模組)** - 模組化架構
- **Three.js** - 3D 渲染
- **Socket.IO Client** - WebSocket 客戶端

## 安裝與執行

### 環境需求
- Python 3.8+
- MySQL 資料庫
- 支援 WebSocket 的現代瀏覽器

### 安裝步驟

1. 複製專案
```bash
git clone https://github.com/wei979/ai-fitness-coach.git
cd ai-fitness-coach
```

2. 安裝 Python 依賴
```bash
pip install -r requirements.txt
```

3. 設定資料庫
- 建立 MySQL 資料庫 `nkust_exercise`
- 修改 `app/config.py` 中的資料庫連線設定

4. 下載 YOLO 模型

從 MEGA 雲端下載模型檔案：
**[下載連結](https://mega.nz/folder/QQkhmYgY#yIPeXFUzVsRas563N0Ra5g)**

下載後：
- 解壓縮 `YOLO_MODLE.zip` 到 `static/models/` 目錄
- 將 `yolov8n-pose.pt` 放置於專案根目錄

完成後目錄結構如下：
```
static/models/YOLO_MODLE/
├── pose/yolov8n-pose.pt
├── squat_model/best.pt
├── bicep_curl/bicep_best.pt
├── shoulder_press/best.pt
├── push_up/push_up_best.pt
├── pull_up/best.pt
└── dumbbell_row/row_best.pt
```

5. 啟動伺服器
```bash
python run.py
```

6. 開啟瀏覽器訪問 http://localhost:5000

## 專案結構

```
├── app/
│   ├── __init__.py          # Flask 應用工廠
│   ├── config.py             # 設定檔
│   ├── database.py           # 資料庫連線
│   ├── routes/               # 路由藍圖
│   │   ├── main_routes.py    # 主頁面路由
│   │   ├── auth_routes.py    # 認證路由
│   │   ├── api_routes.py     # REST API
│   │   ├── exercise_routes.py # 運動偵測路由
│   │   └── game_routes.py    # 遊戲系統路由
│   ├── services/             # 服務層
│   │   ├── pose_detection.py # 姿態檢測核心
│   │   ├── exercise_service.py # 運動偵測服務
│   │   └── ...               # 各運動專屬服務
│   ├── models/               # 資料模型
│   ├── templates/            # HTML 模板
│   └── utils/                # 工具函式
├── static/
│   ├── css/                  # 樣式檔
│   ├── js/
│   │   └── modules/          # 前端模組
│   └── models/               # 3D 模型與 YOLO 模型
├── run.py                    # 應用程式入口
├── requirements.txt          # Python 依賴
├── ARCHITECTURE.md           # 系統架構文件
└── CLAUDE.md                 # Claude Code 指引
```

## 前端模組架構

採用事件驅動設計，各模組透過事件系統通信：

- `socket-manager.js` - WebSocket 連接管理
- `game-manager.js` - 遊戲關卡與 Combo 系統
- `ui-manager.js` - DOM 操作與視覺效果
- `exercise-manager.js` - 運動類型切換與偵測控制
- `three-manager.js` - Three.js 3D 場景渲染
- `main-app.js` - 模組整合與初始化

## 授權

本專案僅供學術研究與教育用途。

## 開發團隊

國立高雄科技大學 (NKUST)
