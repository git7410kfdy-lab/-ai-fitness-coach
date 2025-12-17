# 系統架構文件

本文件詳細說明 AI 健身教練系統的整體架構，供開發人員交接與維護參考。

---

## 目錄

1. [系統概覽](#系統概覽)
2. [技術架構圖](#技術架構圖)
3. [後端架構](#後端架構)
4. [前端架構](#前端架構)
5. [資料流程](#資料流程)
6. [資料庫結構](#資料庫結構)
7. [API 端點清單](#api-端點清單)
8. [Socket.IO 事件](#socketio-事件)
9. [AI 模型整合](#ai-模型整合)
10. [部署說明](#部署說明)

---

## 系統概覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI 健身教練系統                               │
├─────────────────────────────────────────────────────────────────────┤
│  使用者透過瀏覽器存取 → WebSocket 即時通訊 → 後端 AI 姿態分析        │
│  → 運動計數與品質評估 → 遊戲化回饋 → 前端 3D 視覺呈現                │
└─────────────────────────────────────────────────────────────────────┘
```

### 核心功能

| 功能模組 | 說明 |
|---------|------|
| 即時姿態檢測 | 使用 YOLOv8 模型分析攝影機畫面中的人體姿態 |
| 運動計數 | 根據關節角度變化自動計算運動次數 |
| 品質評估 | 評估運動動作的正確性並給予回饋 |
| 遊戲化系統 | 關卡挑戰、怪物戰鬥、Combo 連擊、經驗值系統 |
| 3D 視覺效果 | Three.js 渲染的 3D 場景與角色動畫 |

---

## 技術架構圖

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              前端 (Browser)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ UI Manager  │  │ Socket Mgr  │  │ Game Manager│  │ Three.js    │     │
│  │ (DOM 操作)  │  │ (WebSocket) │  │ (遊戲邏輯)  │  │ (3D 渲染)   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │ WebSocket / HTTP
┌───────────────────────────────────┼──────────────────────────────────────┐
│                              後端 (Flask)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Routes      │  │ Socket.IO   │  │ Services    │  │ Models      │     │
│  │ (路由藍圖)  │  │ (即時通訊)  │  │ (業務邏輯)  │  │ (資料模型)  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│  ┌────────────────────────────────┴────────────────────────────────┐    │
│  │                        AI 服務層                                 │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│  │  │ YOLOv8   │  │ 姿態檢測 │  │ 角度計算 │  │ 運動計數 │        │    │
│  │  │ 模型     │  │ 服務     │  │ 引擎     │  │ 服務     │        │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────────┐
│                           MySQL 資料庫                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ users   │  │ game_   │  │ user_   │  │ exercise│  │ achieve │       │
│  │         │  │ levels  │  │ progress│  │ _records│  │ ments   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 後端架構

### 目錄結構

```
app/
├── __init__.py              # Flask 應用工廠，初始化擴展
├── config.py                # 配置檔（資料庫、模型路徑）
├── database.py              # 資料庫連線工具
│
├── routes/                  # 路由藍圖
│   ├── main_routes.py       # 主頁面路由 (/, /realtime, /login)
│   ├── auth_routes.py       # 認證路由 (/auth/login, /auth/register)
│   ├── api_routes.py        # REST API (/api/*)
│   ├── exercise_routes.py   # 運動偵測路由 (/exercise/*)
│   ├── game_routes.py       # 遊戲系統路由 (/game/*, /api/game/*)
│   ├── user_routes.py       # 使用者管理 (/user/*)
│   ├── fitness_routes.py    # 健身功能路由
│   ├── analytics_routes.py  # 數據分析路由
│   └── continuous_defense_routes.py  # 連續防禦模式
│
├── services/                # 服務層（業務邏輯）
│   ├── pose_detection.py    # 姿態檢測核心服務
│   ├── exercise_service.py  # 運動偵測主服務
│   ├── pose_detector_base.py # 姿態偵測基礎類別
│   ├── camera_service.py    # 攝影機管理服務
│   ├── db_service.py        # 資料庫服務
│   │
│   │ # 各運動專屬服務
│   ├── basketball_service.py       # 籃球投籃
│   ├── basketball_dribble_service.py # 籃球運球
│   ├── volleyball_service.py       # 排球
│   ├── table_tennis_service.py     # 桌球
│   ├── taekwondo_service.py        # 跆拳道
│   ├── plank_service.py            # 平板支撐
│   └── continuous_defense_service.py # 連續防禦
│
├── models/                  # 資料模型
│   └── user.py              # 使用者模型（Flask-Login）
│
├── templates/               # Jinja2 HTML 模板
│   ├── index.html           # 首頁
│   ├── realtime.html        # 即時偵測頁面（原版）
│   ├── realtime_modular.html # 即時偵測頁面（模組化版）
│   ├── game_level.html      # 遊戲關卡頁面
│   ├── login.html           # 登入頁面
│   └── register.html        # 註冊頁面
│
└── utils/                   # 工具函式
    ├── db_init.py           # 資料庫初始化
    └── logging_config.py    # 日誌配置
```

### 路由藍圖對照表

| 藍圖名稱 | URL 前綴 | 主要功能 |
|---------|---------|---------|
| `main_bp` | `/` | 首頁、即時偵測頁面、靜態頁面 |
| `auth_bp` | `/auth` | 登入、註冊、登出 |
| `api_bp` | `/api` | REST API（使用者狀態、討論區） |
| `exercise_bp` | `/exercise` | 運動偵測控制、影像串流 |
| `game_bp` | `/game`, `/api/game` | 遊戲地圖、關卡、進度 |
| `user_bp` | `/user` | 使用者資料、運動歷史 |
| `fitness_bp` | `/fitness` | 健身相關功能 |
| `analytics_bp` | `/analytics` | 數據分析與統計 |

### 服務層說明

#### pose_detection.py - 姿態檢測核心

```python
# 主要功能
load_models()           # 載入 YOLOv8 姿態檢測模型
calculate_angle(a,b,c)  # 計算三點之間的角度
get_pose_angles(keypoints)  # 從關鍵點計算各關節角度
```

#### exercise_service.py - 運動偵測服務

```python
# 全域狀態變數
detection_active        # 偵測是否啟用
exercise_count          # 運動計數
current_exercise_type   # 當前運動類型

# 各運動狀態
squat_state            # 深蹲狀態 ('up'/'down')
bicep_state            # 二頭彎舉狀態
pushup_state           # 伏地挺身狀態
# ...等

# 主要函式
init_models()          # 初始化所有運動模型
process_frame()        # 處理單幀影像
reset_detection_state() # 重置偵測狀態
```

---

## 前端架構

### 模組結構

```
static/js/modules/
├── socket-manager.js        # WebSocket 連接管理
├── game-manager.js          # 遊戲邏輯（關卡、怪物、Combo）
├── ui-manager.js            # DOM 操作與視覺效果
├── exercise-manager.js      # 運動類型切換與偵測控制
├── map-manager.js           # 地圖導航與關卡解鎖
├── three-manager.js         # Three.js 3D 場景渲染
├── workout-manager.js       # 訓練計劃與進度追蹤
├── attack-effects.js        # 攻擊特效系統
├── attack-combo-system.js   # Combo 連擊系統
├── monster-attack-system.js # 怪物攻擊系統
├── continuous-defense-mode.js # 連續防禦模式
├── main-app.js              # 模組整合與初始化
├── module-loader.js         # 動態模組載入
└── init.js                  # 應用程式啟動
```

### 模組通訊架構

```
┌─────────────────────────────────────────────────────────────┐
│                      main-app.js                            │
│                    (模組協調中心)                            │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Socket  │ │  UI    │ │ Game   │ │Exercise│ │ Three  │
│Manager │ │Manager │ │Manager │ │Manager │ │Manager │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
    │           │           │           │           │
    └───────────┴───────────┴───────────┴───────────┘
                        │
                  事件驅動通訊
                  (Event Emitter)
```

### 核心模組說明

#### SocketManager
- 管理 WebSocket 連線（使用 `/exercise` 命名空間）
- 處理即時影像串流接收
- 發送運動偵測控制指令

#### GameManager
- 管理關卡進度與怪物狀態
- 處理 Combo 連擊系統
- 計算經驗值與成就

#### UIManager
- 更新介面顯示（計數、血量、Combo）
- 控制視覺特效與動畫
- 管理通知與提示訊息

#### ThreeManager
- 初始化 Three.js 場景
- 載入與控制 3D 模型動畫
- 渲染怪物與攻擊特效

---

## 資料流程

### 運動偵測流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 攝影機   │───▶│ 影像擷取 │───▶│ YOLOv8   │───▶│ 關節     │
│ 輸入     │    │ 服務     │    │ 姿態偵測 │    │ 角度計算 │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
┌──────────┐    ┌──────────┐    ┌──────────┐         │
│ 前端     │◀───│ WebSocket│◀───│ 運動     │◀────────┘
│ 更新顯示 │    │ 傳送     │    │ 計數判斷 │
└──────────┘    └──────────┘    └──────────┘
```

### Socket.IO 資料流

```
前端                                後端
  │                                  │
  │──── start_detection ────────────▶│ 開始偵測
  │                                  │
  │◀─── video_frame ─────────────────│ 影像幀（Base64）
  │◀─── exercise_count ──────────────│ 運動計數
  │◀─── pose_quality ────────────────│ 姿態品質
  │◀─── angle_data ──────────────────│ 關節角度
  │                                  │
  │──── stop_detection ─────────────▶│ 停止偵測
  │──── reset_count ────────────────▶│ 重置計數
  │                                  │
```

---

## 資料庫結構

### 資料表關係圖

```
┌─────────────┐       ┌─────────────────┐
│   users     │       │  game_levels    │
├─────────────┤       ├─────────────────┤
│ user_id  PK │       │ level_id     PK │
│ username    │       │ level_name      │
│ password    │       │ monster_count   │
│ email       │       │ monster_hp      │
│ role        │       │ exp_reward      │
└──────┬──────┘       └────────┬────────┘
       │                       │
       │    ┌──────────────────┘
       │    │
       ▼    ▼
┌─────────────────┐    ┌─────────────────┐
│ user_progress   │    │exercise_records │
├─────────────────┤    ├─────────────────┤
│ user_id      FK │    │ record_id    PK │
│ current_level   │    │ user_id      FK │
│ total_exp       │    │ exercise_type   │
└─────────────────┘    │ count           │
                       │ date            │
                       └─────────────────┘
```

### 主要資料表

| 資料表 | 說明 |
|-------|------|
| `users` | 使用者帳號資訊 |
| `game_levels` | 遊戲關卡設定 |
| `user_progress` | 使用者遊戲進度 |
| `user_completed_levels` | 已完成關卡紀錄 |
| `exercise_records` | 運動歷史紀錄 |
| `achievements` | 成就定義 |
| `user_achievements` | 使用者已解鎖成就 |

---

## API 端點清單

### 認證相關 (`/auth`)

| 方法 | 端點 | 說明 |
|-----|------|------|
| GET | `/auth/login` | 登入頁面 |
| POST | `/auth/login` | 處理登入 |
| GET | `/auth/register` | 註冊頁面 |
| POST | `/auth/register` | 處理註冊 |
| GET | `/auth/logout` | 登出 |

### 遊戲系統 (`/api/game`)

| 方法 | 端點 | 說明 |
|-----|------|------|
| GET | `/api/game/levels` | 取得所有關卡資訊 |
| GET | `/api/game/user_progress` | 取得使用者進度 |
| POST | `/api/game/update_progress` | 更新使用者進度 |
| POST | `/api/game/complete_level` | 完成關卡 |

### 使用者相關 (`/user`)

| 方法 | 端點 | 說明 |
|-----|------|------|
| GET | `/user/profile` | 個人資料頁面 |
| POST | `/user/profile/edit` | 編輯個人資料 |
| GET | `/user/exercise/history` | 運動歷史紀錄 |

### 運動偵測 (`/exercise`)

| 方法 | 端點 | 說明 |
|-----|------|------|
| GET | `/exercise/video_feed` | 影像串流 |
| POST | `/exercise/start` | 開始偵測 |
| POST | `/exercise/stop` | 停止偵測 |

---

## Socket.IO 事件

### 客戶端 → 伺服器

| 事件名稱 | 資料格式 | 說明 |
|---------|---------|------|
| `start_detection` | `{exercise_type: string}` | 開始運動偵測 |
| `stop_detection` | `{}` | 停止運動偵測 |
| `reset_count` | `{}` | 重置運動計數 |
| `switch_exercise` | `{exercise_type: string}` | 切換運動類型 |

### 伺服器 → 客戶端

| 事件名稱 | 資料格式 | 說明 |
|---------|---------|------|
| `video_frame` | `{image: base64}` | 處理後的影像幀 |
| `exercise_count` | `{count: int}` | 運動計數更新 |
| `pose_quality` | `{quality: string}` | 姿態品質評估 |
| `angle_data` | `{angles: object}` | 關節角度資料 |
| `coach_tip` | `{tip: string}` | 教練提示訊息 |

---

## AI 模型整合

### 模型檔案位置

```
static/models/YOLO_MODLE/
├── pose/
│   └── yolov8n-pose.pt      # 姿態檢測模型
├── squat_model/
│   └── best.pt              # 深蹲偵測模型
├── bicep_curl/
│   └── bicep_best.pt        # 二頭彎舉模型
├── shoulder_press/
│   └── best.pt              # 肩推模型
├── push_up/
│   └── push_up_best.pt      # 伏地挺身模型
├── pull_up/
│   └── best.pt              # 引體向上模型
└── dumbbell_row/
    └── row_best.pt          # 啞鈴划船模型
```

### 支援的運動類型

| 運動類型 | 模型 | 偵測方式 |
|---------|------|---------|
| 深蹲 (squat) | YOLO 分類 | 膝蓋角度變化 |
| 二頭彎舉 (bicep-curl) | YOLO 分類 | 手肘角度變化 |
| 肩推 (shoulder-press) | YOLO 分類 | 肩膀角度變化 |
| 伏地挺身 (push-up) | YOLO 分類 | 手肘角度變化 |
| 引體向上 (pull-up) | YOLO 分類 | 手肘角度變化 |
| 啞鈴划船 (dumbbell-row) | YOLO 分類 | 手臂姿態變化 |
| 平板支撐 (plank) | 姿態檢測 | 身體角度維持 |

### 關節角度計算

```python
# 計算的關節角度
angles = {
    '左手肘': calculate_angle(left_shoulder, left_elbow, left_wrist),
    '右手肘': calculate_angle(right_shoulder, right_elbow, right_wrist),
    '左膝蓋': calculate_angle(left_hip, left_knee, left_ankle),
    '右膝蓋': calculate_angle(right_hip, right_knee, right_ankle),
    '左肩膀': calculate_angle(left_hip, left_shoulder, left_elbow),
    '右肩膀': calculate_angle(right_hip, right_shoulder, right_elbow),
    '左髖部': calculate_angle(left_shoulder, left_hip, left_knee),
    '右髖部': calculate_angle(right_shoulder, right_hip, right_knee)
}
```

---

## 部署說明

### 環境需求

- Python 3.8+
- MySQL 8.0+
- NVIDIA GPU（建議，用於 AI 加速）
- CUDA 12.x（若使用 GPU）

### 安裝步驟

```bash
# 1. 建立虛擬環境
python -m venv venv
venv\Scripts\activate  # Windows

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 安裝 GPU 版本 PyTorch（可選）
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# 4. 下載 YOLO 模型
# 從 MEGA 雲端下載：https://mega.nz/folder/QQkhmYgY#yIPeXFUzVsRas563N0Ra5g

# 5. 設定資料庫
# 建立 MySQL 資料庫 nkust_exercise
# 修改 app/config.py 中的資料庫設定

# 6. 啟動伺服器
python run.py
```

### 生產環境建議

- 使用 Gunicorn + Nginx 部署
- 設定 SSL 憑證（HTTPS）
- 使用環境變數管理敏感設定
- 設定適當的日誌等級

---

## 維護注意事項

1. **模型更新**：更新 YOLO 模型時需重啟伺服器
2. **資料庫遷移**：新增資料表時需更新 `db_init.py`
3. **前端模組**：新增模組需在 `module-loader.js` 註冊
4. **Socket 事件**：新增事件需同步更新前後端

---

*文件最後更新：2024 年*
*維護單位：國立高雄科技大學 (NKUST)*
