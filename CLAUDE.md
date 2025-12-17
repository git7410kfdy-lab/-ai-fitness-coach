# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

AI 健身教練 Web 應用程式，使用 YOLOv8 姿態檢測模型即時分析使用者運動動作，提供遊戲化健身體驗。支援多種運動類型（深蹲、二頭彎舉、肩推、伏地挺身、引體向上、啞鈴划船等）以及桌球、籃球、排球等運動訓練。

## 開發指令

### 啟動伺服器
```bash
python run.py
```
伺服器預設運行於 http://localhost:5000

### 安裝依賴
```bash
pip install -r requirements.txt
```

### 資料庫
- MySQL 資料庫 `nkust_exercise`
- 資料庫設定位於 `app/config.py`
- 啟動時自動呼叫 `app/utils/db_init.py` 初始化遊戲資料庫

## 架構

### 後端 (Flask + Socket.IO)

**應用程式工廠**: `app/__init__.py`
- 使用 `create_app()` 建立 Flask 應用實例
- 整合 Flask-SocketIO（threading 模式）、Flask-Login、Flask-Bcrypt
- 啟動時載入 YOLO 姿態檢測模型

**路由藍圖** (`app/routes/`):
- `main_routes.py` - 主頁面路由
- `auth_routes.py` - 認證（登入/註冊/登出）
- `api_routes.py` - REST API (`/api`)
- `exercise_routes.py` - 運動偵測相關
- `game_routes.py` - 遊戲系統
- `user_routes.py` - 使用者管理 (`/user`)
- `fitness_routes.py` - 健身功能
- `analytics_routes.py` - 數據分析
- `continuous_defense_routes.py` - 連續防禦模式

**服務層** (`app/services/`):
- `pose_detection.py` - YOLO 姿態檢測核心，計算關節角度
- `exercise_service.py` - 運動偵測主服務，管理各運動狀態與計數
- `pose_detector_base.py` - 姿態偵測基礎類別
- 各運動專屬服務：`basketball_service.py`、`volleyball_service.py`、`table_tennis_service.py`、`taekwondo_service.py` 等

### 前端模組化架構 (`static/js/modules/`)

採用事件驅動設計，各模組透過事件系統通信：

- `socket-manager.js` - WebSocket 連接管理
- `game-manager.js` - 遊戲關卡、怪物、Combo 連擊系統
- `ui-manager.js` - DOM 操作與視覺效果
- `exercise-manager.js` - 運動類型切換與偵測控制
- `map-manager.js` - 地圖導航與關卡解鎖
- `three-manager.js` - Three.js 3D 場景渲染
- `workout-manager.js` - 訓練計劃與進度追蹤
- `main-app.js` - 模組整合與初始化
- `module-loader.js` - 動態模組載入

**頁面對應**:
- `realtime.html` - 原始版本
- `realtime_modular.html` - 模組化版本

### 模型檔案

YOLO 模型位於 `static/models/YOLO_MODLE/`:
- `pose/yolov8n-pose.pt` - 姿態檢測
- `squat_model/best.pt` - 深蹲
- `bicep_curl/bicep_best.pt` - 二頭彎舉
- `shoulder_press/best.pt` - 肩推
- `push_up/push_up_best.pt` - 伏地挺身
- `pull_up/best.pt` - 引體向上
- `dumbbell_row/row_best.pt` - 啞鈴划船

3D 模型位於 `static/models/`（.glb 格式）

## 主要技術

- **後端**: Flask 2.3.3, Flask-SocketIO 5.3.4
- **AI**: YOLOv8 (ultralytics)、PyTorch 2.0.1
- **影像處理**: OpenCV
- **前端**: 原生 JavaScript (ES6 模組)、Three.js
- **資料庫**: MySQL

## 語言

程式碼註釋與介面文字主要使用繁體中文。
