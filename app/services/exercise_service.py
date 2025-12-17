import cv2
import numpy as np
import time
import logging
import os
from ultralytics import YOLO
from app import socketio


from app.services.pose_detection import pose_model as imported_pose_model
from app.services.arm_swing_warmup_service import arm_swing_warmup_service
from app.services.alternating_arm_swing_service import AlternatingArmSwingService
from app.services.plank_service import plank_service
import threading
import queue
import torch 
from flask import current_app


# 設置日誌
logger = logging.getLogger(__name__)

# 創建雙手輪流擺動熱身運動服務實例
alternating_arm_swing_service = AlternatingArmSwingService()

# 全局變量
angles = {}  # 添加這行來解決 'angles' is not defined 錯誤
detection_active = False
exercise_count = 0
last_pose = None
mid_pose_detected = False
squat_state = "up"
last_squat_time = 0
detection_line_set = False
detection_line_y = 0
knee_line_coords = None
squat_quality_score = 0
detection_line_set_shoulder = False
detection_line_y_shoulder = 0
detection_line_set_bicep = False
elbow_line_coords = None
bicep_quality_score = 0
bicep_state = "down"
last_curl_time = 0
shoulder_quality_score = 0
last_shoulder_press_time = 0  # 肩推計數時間間隔控制
current_exercise_type = 'squat'  # 預設運動類型
target_reps = 10  # 預設目標重複次數
target_sets = 3   # 預設目標組數
current_set = 1   # 當前組數
remaining_sets = 3  # 添加這個變量，它在reset_detection_state中被引用

# 新增三個運動的狀態變量
pushup_state = "up"
pullup_state = "down"
dumbbell_row_state = "start"
last_pushup_time = 0
last_pullup_time = 0
last_dumbbell_row_time = 0

# 啞鈴划船混合計數系統變量
dumbbell_row_pose_score_history = []  # 姿勢分數歷史
dumbbell_row_pose_state = "low"  # 姿勢分數狀態：'low', 'high', 'transition'
last_pose_count_time = 0  # 姿勢分數計數時間
yolo_detected_this_cycle = False  # 當前週期YOLO是否已檢測
pose_score_threshold_high = 4  # 高分閾值
pose_score_threshold_low = 2   # 低分閾值
history_buffer_size = 10  # 歷史緩衝區大小

# 智能手臂選擇系統變量
current_active_arm = "right"  # 當前選擇的手臂：'left' 或 'right'
arm_switch_threshold = 1.0    # 手臂切換閾值（分數差距）
last_arm_switch_time = 0      # 上次切換時間
arm_switch_cooldown = 2.0     # 切換冷卻時間（秒）

# 新增三個運動的檢測線變量
detection_line_set_pushup = False
detection_line_y_pushup = 0
detection_line_set_pullup = False
detection_line_y_pullup = 0
detection_line_set_dumbbell_row = False
detection_line_y_dumbbell_row = 0
back_detection_line_x = 0

# 新增三個運動的品質評分變量
pushup_quality_score = 0
pullup_quality_score = 0
dumbbell_row_quality_score = 0

# 移除維持狀態檢測相關變數，改用姿勢分數判斷護盾狀態

# 添加幀緩衝區（如果需要）
frame_buffer = queue.Queue(maxsize=2)
processed_frame_buffer = queue.Queue(maxsize=2)

# 優化相關的緩存變量
model_cache = {}  # 模型緩存
thread_pool_cache = {}  # 線程池緩存
last_switch_time = 0  # 上次切換時間
switch_cooldown = 0.1  # 切換冷卻時間（秒）
detection_state_cache = {}  # 檢測狀態緩存

# 性能監控變量
performance_metrics = {
    'switch_count': 0,
    'fast_switch_count': 0,
    'total_switch_time': 0,
    'average_switch_time': 0,
    'last_performance_log': 0
}


exercise_models = {}
# 確保pose_model有一個初始值
pose_model = imported_pose_model
# 添加模型初始化標誌
models_initialized = False

def init_models():
    """初始化所有模型"""
    global exercise_models, pose_model, models_initialized
    
    # 如果模型已經初始化，直接返回
    if models_initialized:
        logger.info("模型已經初始化，跳過重複載入")
        return True
    
    try:
        # 確保 exercise_models 已初始化
        exercise_models = {}
        
        # 優先使用從pose_detection導入的模型
        if imported_pose_model is not None:
            pose_model = imported_pose_model
            logger.info("成功使用pose_detection中的姿態檢測模型")
        
        # 如果pose_model仍為None，則嘗試初始化
        if pose_model is None:
            logger.info("姿態檢測模型未初始化，嘗試重新初始化...")
            try:
                # 嘗試從配置獲取模型路徑
                base_dir = current_app.config['BASE_DIR']
                pose_path = os.path.join(base_dir, 'static', 'models', 'YOLO_MODLE', 'pose', 'yolov8n-pose.pt')
                
                # 如果文件不存在，使用預設路徑
                if not os.path.exists(pose_path):
                    logger.warning(f"姿態檢測模型文件不存在: {pose_path}，使用預設模型")
                    pose_model = YOLO('yolov8n-pose.pt')
                else:
                    pose_model = YOLO(pose_path)
                logger.info("姿態檢測模型加載完成")
            except Exception as e:
                logger.error(f"加載姿態檢測模型時出錯: {e}", exc_info=True)
                # 確保有一個預設模型
                try:
                    pose_model = YOLO('yolov8n-pose.pt')
                    logger.info("使用預設模型成功")
                except Exception as e2:
                    logger.error(f"加載預設模型也失敗: {e2}", exc_info=True)
                    return False
        
        # 驗證模型是否可用
        if pose_model is None:
            logger.error("所有嘗試都失敗，無法加載姿態檢測模型")
            return False

        # 載入所有運動模型
        load_exercise_models()
            
        # 設置初始化標誌
        models_initialized = True
        logger.info("所有模型初始化完成")
        return True
    except Exception as e:
        logger.error(f"初始化模型時出錯: {e}", exc_info=True)
        return False

def convert_to_serializable(data):
    """將數據轉換為可序列化的格式"""
    if isinstance(data, dict):
        return {k: convert_to_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_to_serializable(item) for item in data]
    elif isinstance(data, np.ndarray):
        return data.tolist()
    elif isinstance(data, (np.float32, np.float64)):
        return float(data)
    elif isinstance(data, (np.int32, np.int64)):
        return int(data)
    else:
        return data


# 移除check_holding_state函數，改用姿勢分數直接判斷護盾狀態


def load_exercise_models():
    """載入運動分類模型"""
    global exercise_models
    
    # 如果模型已經載入，跳過重複載入
    if exercise_models:
        logger.debug("運動分類模型已載入，跳過重複載入")
        return
    
    try:
        # 從配置獲取模型路徑
        model_paths = current_app.config['MODEL_PATHS']
        base_dir = current_app.config['BASE_DIR']
        
        # 確保模型目錄存在
        for exercise_type, rel_path in model_paths.items():
            # 構建絕對路徑
            abs_path = os.path.join(base_dir, rel_path)
            
            try:
                # 檢查文件是否存在
                if not os.path.exists(abs_path):
                    logger.warning(f"模型文件不存在: {abs_path}")
                    continue
                
                # 載入模型
                model = YOLO(abs_path)
                exercise_models[exercise_type] = model
                logger.info(f"YOLO model for {exercise_type} loaded successfully from {abs_path}")
            except Exception as e:
                logger.error(f"載入{exercise_type}模型時出錯: {e}")
    except Exception as e:
        logger.error(f"初始化運動分類模型時出錯: {e}")

def set_detection_line(detection_line_value=0.5):
    """設置檢測線
    
    Args:
        detection_line_value: 檢測線的位置值，預設為0.5
    """
    global detection_line_set, detection_line_y, knee_line_coords
    
    # 保存檢測線值
    global detection_line
    detection_line = detection_line_value
    
    # 獲取當前幀
    from app.routes.exercise_routes import get_current_frame
    frame = get_current_frame()
    
    if frame is None:
        logger.error("無法獲取幀來設置檢測線")
        return False
    
    # 調整幀大小為720p
    frame = cv2.resize(frame, (720, 720))
    
    # 使用YOLO檢測姿勢
    results = pose_model(frame)
    
    if not results or len(results) == 0:
        logger.error("無法檢測到姿勢來設置檢測線")
        return False
    
    # 獲取關鍵點
    if results[0].keypoints is not None:
        keypoints = results[0].keypoints.xy.cpu().numpy()[0]
        
        if len(keypoints) >= 17:
            # 獲取膝蓋關鍵點
            left_knee = keypoints[13][:2]
            right_knee = keypoints[14][:2]
            
            # 檢查關鍵點有效性
            if not np.isnan(left_knee).any() and not np.isnan(right_knee).any():
                # 設置膝蓋線
                knee_line_coords = (
                    (int(left_knee[0]), int(left_knee[1])),
                    (int(right_knee[0]), int(right_knee[1]))
                )
                # 設置檢測線Y坐標（膝蓋高度）
                detection_line_y = int((left_knee[1] + right_knee[1]) / 2)
                detection_line_set = True
                
                logger.info(f"檢測線已設置在 y={detection_line_y}，值為 {detection_line}")
                
                # 通知前端
                socketio.emit('detection_line_set', {
                    'success': True,
                    'detection_line_y': float(detection_line_y),  # 確保轉換為Python原生類型
                    'detection_line': detection_line
                }, namespace='/exercise')
                
                return True
    
    logger.error("無法設置檢測線")
    return False

def calculate_angle(a, b, c):
    # 將 a, b, c 轉換為 numpy 陣列
    a, b, c = np.array(a), np.array(b), np.array(c)
    # 計算向量 BA 和 BC（即從 b 到 a 以及從 b 到 c 的向量）
    ba = a - b
    bc = c - b
    # 計算向量的點積
    dot_product = np.dot(ba, bc)
    # 計算向量的長度
    norm_ba = np.linalg.norm(ba)
    norm_bc = np.linalg.norm(bc)
    # 防止除以 0 的情況（如果某向量長度為 0，就直接返回 0 度）
    if norm_ba == 0 or norm_bc == 0:
        return 0.0
    # 計算夾角的 cosine 值，並利用 clip 限制範圍在 [-1, 1]
    cos_theta = np.clip(dot_product / (norm_ba * norm_bc), -1.0, 1.0)
    # 利用 arccos 求出角度，再轉換為度數
    angle = np.degrees(np.arccos(cos_theta))
    return angle

def reset_detection_state():
    """重置偵測狀態 - 輕量級重置"""
    global exercise_count, last_pose, mid_pose_detected
    
    # 只重置基本計數狀態，保留其他配置
    exercise_count = 0
    last_pose = None
    mid_pose_detected = False
    
    logger.debug("基本偵測狀態已重置")

def reset_exercise_specific_state(previous_type, new_type):
    """根據運動類型重置特定狀態 - 優化版本"""
    global squat_state, detection_line_set, detection_line_y, knee_line_coords, squat_quality_score
    global detection_line_set_shoulder, detection_line_y_shoulder, shoulder_quality_score, shoulder_state
    global detection_line_set_bicep, elbow_line_coords, bicep_state, bicep_quality_score
    global last_curl_time, last_shoulder_press_time, last_squat_time
    
    # 重置計數和基本狀態
    reset_detection_state()
    
    # 根據新運動類型重置特定狀態
    if new_type == 'squat':
        squat_state = 'init'
        squat_quality_score = 0
        last_squat_time = 0
        # 保留檢測線設置以減少重新設置時間
        if previous_type not in ['squat']:
            detection_line_set = False
            detection_line_y = 0
            knee_line_coords = None
    
    elif new_type == 'shoulder-press':
        shoulder_state = 'init'
        shoulder_quality_score = 0
        last_shoulder_press_time = 0
        if previous_type not in ['shoulder-press']:
            detection_line_set_shoulder = False
            detection_line_y_shoulder = 0
    
    elif new_type == 'bicep-curl':
        bicep_state = 'init'
        bicep_quality_score = 0
        last_curl_time = 0
        if previous_type not in ['bicep-curl']:
            detection_line_set_bicep = False
            elbow_line_coords = None
    
    elif new_type == 'arm-swing-warmup':
        arm_swing_warmup_service.reset_state()
    
    logger.info(f"已重置 {new_type} 特定狀態")

def log_performance_metrics():
    """記錄性能指標"""
    global performance_metrics
    current_time = time.time()
    
    # 每60秒記錄一次性能指標
    if current_time - performance_metrics['last_performance_log'] > 60:
        if performance_metrics['switch_count'] > 0:
            performance_metrics['average_switch_time'] = performance_metrics['total_switch_time'] / performance_metrics['switch_count']
        
        logger.info(f"性能指標 - 總切換次數: {performance_metrics['switch_count']}, "
                   f"快速切換次數: {performance_metrics['fast_switch_count']}, "
                   f"平均切換時間: {performance_metrics['average_switch_time']:.3f}秒")
        
        performance_metrics['last_performance_log'] = current_time

def can_switch_exercise():
    """檢查是否可以進行運動切換（防止頻繁切換）"""
    global last_switch_time, switch_cooldown
    current_time = time.time()
    
    if current_time - last_switch_time < switch_cooldown:
        logger.debug(f"切換冷卻中，剩餘時間: {switch_cooldown - (current_time - last_switch_time):.2f}秒")
        return False
    
    return True

def set_current_exercise_type(exercise_type):
    """設置當前運動類型 - 優化版本"""
    global current_exercise_type, last_switch_time
    
    # 如果運動類型沒有改變，直接返回
    if current_exercise_type == exercise_type:
        logger.debug(f"運動類型未改變，保持為: {exercise_type}")
        return
    
    # 檢查切換冷卻
    if not can_switch_exercise():
        logger.warning(f"切換過於頻繁，忽略切換請求: {exercise_type}")
        return
    
    previous_type = current_exercise_type
    current_exercise_type = exercise_type
    last_switch_time = time.time()
    logger.info(f"運動類型從 {previous_type} 切換到 {exercise_type}")
    
    # 只重置必要的狀態，而不是完全重置
    reset_exercise_specific_state(previous_type, exercise_type)

def get_current_exercise_type():
    """獲取當前運動類型"""
    global current_exercise_type
    return current_exercise_type

def set_exercise_params(reps, sets):
    """設置運動參數"""
    global target_reps, target_sets, remaining_sets
    target_reps = reps
    target_sets = sets
    remaining_sets = sets
    logger.info(f"設置運動參數: {reps}次 x {sets}組")




def process_squat_exercise(frame, annotated_frame, angles, hip_midpoint, detection_line_set, detection_line_y):
    """Handle squat exercise processing logic using original frame for classification"""
    global exercise_count, last_pose, squat_state, last_squat_time, squat_quality_score

    # 使用exercise_models而不是models
    current_model = exercise_models.get("squat")
    if not current_model:
        logger.warning("Squat model not found!")
        return

    # Use squat model for classification on original frame
    squat_results = current_model(frame, conf=0.5, verbose=False)

    # 添加調試日誌
    #logger.info(f"深蹲檢測結果: {len(squat_results)} 個結果")
    
    # 確保每一幀都計算品質分數，不僅僅在姿勢變化時
    # 獲取平均膝蓋角度和髖部角度
    avg_knee_angle = (angles.get('左膝蓋', 180) + angles.get('右膝蓋', 180)) / 2
    avg_hip_angle = (angles.get('左髖部', 180) + angles.get('右髖部', 180)) / 2
    
    # 減少角度數據日誌輸出頻率
    if not hasattr(set_detection_line, 'frame_count'):
        set_detection_line.frame_count = 0
    set_detection_line.frame_count += 1
    
    if set_detection_line.frame_count % 200 == 0:
        logger.info(f"膝蓋角度: {avg_knee_angle:.1f}°, 髖部角度: {avg_hip_angle:.1f}°")
    
    # 檢查是否有有效的髖部中點和檢測線
    if detection_line_set and hip_midpoint:
        # 檢查髖部是否低於基準線
        hip_below_line = hip_midpoint[1] > detection_line_y
        
        # 計算品質分數 (不依賴於姿勢分類) - 調整為更寬鬆的評分標準
        if hip_below_line:
            if avg_knee_angle < 173:  # Excellent squat standard (放寬自120度)
                current_quality = 5
                quality_text = "優秀"
                quality_color = (0, 255, 0)  # 綠色
            elif avg_knee_angle < 177:  # Good squat standard (放寬自140度)
                current_quality = 4
                quality_text = "良好"
                quality_color = (0, 255, 255)  # 黃色
            elif avg_knee_angle < 185:  # Acceptable squat (放寬自160度)
                current_quality = 3
                quality_text = "一般"
                quality_color = (0, 165, 255)  # 橙色
            else:  # Needs improvement (170度以上)
                current_quality = 2
                quality_text = "需改進"
                quality_color = (0, 0, 255)  # 紅色
        else:
            current_quality = 1  # Hip not above baseline
            quality_text = "不夠深"
            quality_color = (0, 0, 255)  # 紅色
        
        # 更新全局品質分數
        squat_quality_score = current_quality
        
        # 在畫面上顯示品質分數
        #cv2.putText(annotated_frame, f"品質分數: {squat_quality_score}/5 - {quality_text}", 
        #            (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, quality_color, 2)
        
        # 在畫面上顯示膝蓋角度
        #cv2.putText(annotated_frame, f"膝蓋角度: {avg_knee_angle:.1f}°", 
        #            (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # 發送品質分數到前端 (每一幀都發送)
        socketio.emit('pose_quality', {'score': squat_quality_score})
        socketio.emit('pose_quality', {'score': squat_quality_score}, namespace='/exercise')
        # 減少品質分數日誌輸出頻率
        if set_detection_line.frame_count % 300 == 0:
            logger.info(f"深蹲品質分數: {squat_quality_score}/5")
    else:
        logger.warning("無法計算深蹲品質分數: 檢測線未設置或髖部中點無效")
        # 在畫面上顯示無法評分的信息
        cv2.putText(annotated_frame, "無法評分: 檢測線未設置或髖部中點無效", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        # 發送0分表示無法評分
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')

    if len(squat_results) > 0 and len(squat_results[0].boxes) > 0:
        best_box = squat_results[0].boxes[0]
        class_id = int(best_box.cls)
        conf = float(best_box.conf)
        class_name = current_model.names[class_id]

        # Get bounding box coordinates
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].cpu().numpy())

        # Draw YOLO detection box on annotated frame
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f'{class_name} {conf:.2f}'
        cv2.putText(annotated_frame, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # 姿勢計數邏輯 (保持不變)
        if last_pose is None:
            last_pose = class_id
        elif last_pose == 0 and class_id == 1:  # From prepare to squat
            squat_state = "down"
            # 姿勢變化時已經在上面計算了品質分數，這裡不需要重複計算
            
        elif last_pose == 1 and class_id == 0:  # From squat back to prepare
            current_time = time.time()
            if current_time - last_squat_time > 0.8:  # Time interval to prevent false counts
                exercise_count += 1
                last_squat_time = current_time
                squat_state = "up"
                #logger.info(f"Squat completed, count: {exercise_count}")
                socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')

        last_pose = class_id

        # Mark hip position relative to baseline
        if hip_midpoint and detection_line_set:
            if hip_midpoint[1] > detection_line_y:
                cv2.putText(annotated_frame, "Hip BELOW line", (200, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            else:
                cv2.putText(annotated_frame, "Hip ABOVE line", (200, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)




def process_bicep_curl(frame, annotated_frame, keypoints, angles):
    """處理二頭彎舉運動的邏輯,使用原始影格進行分類"""
    global exercise_count, last_pose, bicep_quality_score, detection_line_set_bicep, elbow_line_coords, last_curl_time, bicep_state

    # 收集調試信息
    debug_info = []
    debug_info.append("二頭彎舉檢測已啟動")

    if keypoints is None or len(keypoints) < 17:
        logger.warning("二頭彎舉檢測的關鍵點不足!")
        return

    current_model = exercise_models.get("bicep-curl")
    if not current_model:
        logger.warning("找不到二頭彎舉模型!")
        return

    # 提取關鍵點信息,不考慮分類模型結果
    left_shoulder = keypoints[5][:2]
    right_shoulder = keypoints[6][:2]
    left_elbow = keypoints[7][:2]
    right_elbow = keypoints[8][:2]
    left_wrist = keypoints[9][:2]
    right_wrist = keypoints[10][:2]

    # 檢查關鍵點有效性
    left_arm_valid = not np.isnan(left_shoulder).any() and not np.isnan(left_elbow).any() and not np.isnan(left_wrist).any()
    right_arm_valid = not np.isnan(right_shoulder).any() and not np.isnan(right_elbow).any() and not np.isnan(right_wrist).any()

    debug_info.append(f"左手臂有效: {left_arm_valid}")
    debug_info.append(f"右手臂有效: {right_arm_valid}")

    # 嘗試執行分類模型
    try:
        bicep_curl_results = current_model(frame, conf=0.3, verbose=False)
        has_classification = len(bicep_curl_results) > 0 and len(bicep_curl_results[0].boxes) > 0
        debug_info.append(f"檢測到分類: {has_classification}")
    except Exception as e:
        logger.error(f"執行二頭彎舉模型時出錯: {e}")
        has_classification = False
        debug_info.append(f"分類錯誤: {str(e)}")

    # 如果尚未設置,則設置二頭彎舉檢測線
    if not detection_line_set_bicep and (left_arm_valid or right_arm_valid):
        if left_arm_valid:
            left_elbow_point = tuple(map(int, left_elbow))
        else:
            left_elbow_point = (int(frame.shape[1] * 0.4), int(frame.shape[0] * 0.5))
        if right_arm_valid:
            right_elbow_point = tuple(map(int, right_elbow))
        else:
            right_elbow_point = (int(frame.shape[1] * 0.6), int(frame.shape[0] * 0.5))
        elbow_line_coords = (left_elbow_point, right_elbow_point)
        detection_line_set_bicep = True
        logger.info("二頭彎舉偵測基準線已設置")

    # 如果已設置則繪製檢測線
    if detection_line_set_bicep and elbow_line_coords:
        cv2.line(annotated_frame, elbow_line_coords[0], elbow_line_coords[1], (255, 0, 255), 2)
        cv2.putText(annotated_frame, "手肘參考線", (elbow_line_coords[0][0], elbow_line_coords[0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)

    # 繪製並檢查手臂位置(左)
    if left_arm_valid:
        left_shoulder_point = tuple(map(int, left_shoulder))
        left_elbow_point = tuple(map(int, left_elbow))
        left_wrist_point = tuple(map(int, left_wrist))

        cv2.circle(annotated_frame, left_shoulder_point, 5, (0, 255, 255), -1) 
        cv2.circle(annotated_frame, left_elbow_point, 5, (0, 255, 255), -1)     
        cv2.circle(annotated_frame, left_wrist_point, 5, (0, 255, 255), -1) 
        cv2.line(annotated_frame, left_shoulder_point, left_elbow_point, (0, 255, 0), 2)
        cv2.line(annotated_frame, left_elbow_point, left_wrist_point, (0, 255, 0), 2)
        angles['左手肘'] = calculate_angle(left_shoulder, left_elbow, left_wrist)
        debug_info.append(f"左手肘角度: {angles['左手肘']:.1f}°")

    # 繪製並檢查手臂位置(右)
    if right_arm_valid:
        right_shoulder_point = tuple(map(int, right_shoulder))
        right_elbow_point = tuple(map(int, right_elbow))
        right_wrist_point = tuple(map(int, right_wrist))
        cv2.circle(annotated_frame, right_shoulder_point, 5, (0, 255, 255), -1)
        cv2.circle(annotated_frame, right_elbow_point, 5, (0, 255, 255), -1)
        cv2.circle(annotated_frame, right_wrist_point, 5, (0, 255, 255), -1)
        cv2.line(annotated_frame, right_shoulder_point, right_elbow_point, (0, 255, 0), 2)
        cv2.line(annotated_frame, right_elbow_point, right_wrist_point, (0, 255, 0), 2)
        angles['右手肘'] = calculate_angle(right_shoulder, right_elbow, right_wrist)
        debug_info.append(f"右手肘角度: {angles['右手肘']:.1f}°")

    # 計算平均手肘角度
    if '左手肘' in angles and '右手肘' in angles:
        avg_elbow_angle = (angles['左手肘'] + angles['右手肘']) / 2
    elif '左手肘' in angles:
        avg_elbow_angle = angles['左手肘']
    elif '右手肘' in angles:
        avg_elbow_angle = angles['右手肘']
    else:
        avg_elbow_angle = 180
        debug_info.append("無可用的手肘角度")

    # Scoring logic - evaluate form; 此處評分邏輯可依需求保留或調整
    should_score = (left_arm_valid or right_arm_valid) and detection_line_set_bicep

    # === 修改記數邏輯：放下 (無偵測) → 舉 (有偵測) → 放下 (無偵測)才算1下，且1秒內最多只計數一次 ===
    current_time = time.time()
    if has_classification:
        if bicep_state == "down":
            bicep_state = "up"
            debug_info.append("Transition: Down -> Up")
    else:
        if bicep_state == "up":
            # 檢查是否已超過1秒
            if current_time - last_curl_time >= 2.0:
                exercise_count += 1
                last_curl_time = current_time
                socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
                logger.info(f"Bicep curl rep counted, count: {exercise_count}")
                bicep_state = "down"
                debug_info.append("Transition: Up -> Down (rep counted)")
            else:
                debug_info.append("Rep not counted due to 1 sec limit")
        else:
            bicep_state = "down"

    # === 顯示 YOLO 偵測框 ===
    if has_classification:
        best_box = bicep_curl_results[0].boxes[0]
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].cpu().numpy())
        conf = float(best_box.conf)
        class_name = current_model.names[int(best_box.cls)]
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f'{class_name} {conf:.2f}'
        cv2.putText(annotated_frame, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Perform scoring calculation (保留原有評分邏輯)
    if should_score:
        if avg_elbow_angle < 60:
            bicep_quality_score = 5
        elif avg_elbow_angle < 90:
            bicep_quality_score = 4
        elif avg_elbow_angle < 120:
            bicep_quality_score = 3
        elif avg_elbow_angle < 150:
            bicep_quality_score = 2
        else:
            bicep_quality_score = 1


        shoulder_stability_score = 5  # 預設為最佳
        if left_arm_valid and '左肩膀' in angles:
            shoulder_angle = angles['左肩膀']
            shoulder_deviation = abs(90 - shoulder_angle)
            if shoulder_deviation > 30:
                shoulder_stability_score = 2
            elif shoulder_deviation > 15:
                shoulder_stability_score = 3

        if right_arm_valid and '右肩膀' in angles:
            shoulder_angle = angles['右肩膀']
            shoulder_deviation = abs(90 - shoulder_angle)
            right_stability = 5
            if shoulder_deviation > 30:
                right_stability = 2
            elif shoulder_deviation > 15:
                right_stability = 3
            if right_stability < shoulder_stability_score:
                shoulder_stability_score = right_stability

        combined_score = (bicep_quality_score * 0.7) + (shoulder_stability_score * 0.3)
        final_score = round(combined_score)
        score_description = get_score_description(final_score)

        # 檢測維持狀態
        # 修改：同時發送到默認命名空間和 /exercise 命名空間
        socketio.emit('pose_quality', {'score': final_score})
        socketio.emit('pose_quality', {'score': final_score}, namespace='/exercise')
        
        # 減少二頭彎舉品質評分日誌輸出頻率
        if not hasattr(process_bicep_curl, 'frame_count'):
            process_bicep_curl.frame_count = 0
        process_bicep_curl.frame_count += 1
        
        if process_bicep_curl.frame_count % 200 == 0:
            logger.info(f"二頭彎舉品質評分: {final_score}/5")
        
        # 保留原有的事件發送
        socketio.emit('bicep_curl_score', {'score': final_score}, namespace='/exercise')
        
        #cv2.putText(annotated_frame, f'Score: {final_score}/5 - {score_description}', (10, 120),
        #            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        #cv2.putText(annotated_frame, f'Elbow: {avg_elbow_angle:.1f}° | Stability: {shoulder_stability_score}/5',
        #            (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    else:
        reason = "無法進行評分: "
        if not (left_arm_valid or right_arm_valid):
            reason += "手臂關節點檢測失敗 "
        elif not detection_line_set_bicep:
            reason += "偵測線未設置 "
        cv2.putText(annotated_frame, reason, (10, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')
        logger.info(reason)

    # Display debug info
    for i, text in enumerate(debug_info):
        cv2.putText(annotated_frame, text, (10, 200 + i * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)



def process_squat(frame, keypoints, angles):
    """處理深蹲運動"""
    global exercise_count, squat_state, detection_line_set, detection_line_y, knee_line_coords, mid_pose_detected, remaining_sets, target_reps
    
    annotated_frame = frame.copy()
    
    # 提取關鍵點信息
    if keypoints is None or len(keypoints) < 17:
        logger.warning("深蹲檢測的關鍵點不足")
        return annotated_frame
    
    # 提取髖部和膝蓋關鍵點
    left_hip = keypoints[11][:2]
    right_hip = keypoints[12][:2]
    left_knee = keypoints[13][:2]
    right_knee = keypoints[14][:2]
    left_ankle = keypoints[15][:2]
    right_ankle = keypoints[16][:2]
    
    # 檢查關鍵點有效性
    knee_valid = not np.isnan(left_knee).any() and not np.isnan(right_knee).any()
    
    # 計算膝蓋中點
    if knee_valid:
        knee_midpoint = ((left_knee[0] + right_knee[0]) / 2, (left_knee[1] + right_knee[1]) / 2)
        
        # 設置檢測線（如果尚未設置）
        if not detection_line_set:
            detection_line_y = int(knee_midpoint[1])
            knee_line_coords = (
                (int(left_knee[0]), int(left_knee[1])),
                (int(right_knee[0]), int(right_knee[1]))
            )
            detection_line_set = True
            logger.info(f"深蹲檢測線已設置在 y={detection_line_y}")
        
        # 繪製檢測線
        if detection_line_set and knee_line_coords:
            cv2.line(annotated_frame, knee_line_coords[0], knee_line_coords[1], (0, 255, 255), 2)
            cv2.line(annotated_frame, (0, detection_line_y), (annotated_frame.shape[1], detection_line_y), (0, 0, 255), 2)
            midpoint_x = (knee_line_coords[0][0] + knee_line_coords[1][0]) // 2
            cv2.circle(annotated_frame, (midpoint_x, detection_line_y), 5, (0, 255, 255), -1)
            cv2.putText(annotated_frame, "Detection Line", (midpoint_x - 40, detection_line_y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        
        # 計算膝蓋角度
        angles['左膝蓋'] = calculate_angle(left_hip, left_knee, left_ankle)
        angles['右膝蓋'] = calculate_angle(right_hip, right_knee, right_ankle)
        avg_knee_angle = (angles['左膝蓋'] + angles['右膝蓋']) / 2
        
        # 深蹲計數邏輯
        if detection_line_set:
            # 檢查膝蓋是否低於檢測線
            if knee_midpoint[1] > detection_line_y:
                # 在深蹲位置
                if squat_state == 'up' or squat_state == 'init':
                    squat_state = 'down'
                    mid_pose_detected = True
                    logger.info("檢測到深蹲姿勢")
            else:
                # 在站立位置
                if squat_state == 'down' and mid_pose_detected:
                    squat_state = 'up'
                    exercise_count += 1
                    mid_pose_detected = False
                    logger.info(f"完成一次深蹲，計數: {exercise_count}")
                    
                    # 檢查是否完成一組
                    if exercise_count >= target_reps:
                        remaining_sets -= 1
                        exercise_count = 0
                        logger.info(f"完成一組深蹲，剩餘組數: {remaining_sets}")
                        socketio.emit('set_completed', {
                            'remaining_sets': remaining_sets
                        }, namespace='/exercise')
        
        # 顯示膝蓋角度
        #cv2.putText(annotated_frame, f"膝蓋角度: {int(avg_knee_angle)}", (10, 60),
        #            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    # 顯示深蹲次數
    #cv2.putText(annotated_frame, f"深蹲次數: {exercise_count}", (10, 30),
    #            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    # 顯示剩餘組數
    #cv2.putText(annotated_frame, f"剩餘組數: {remaining_sets}", (10, 90),
    #            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    return annotated_frame


def calculate_shoulder_press_score(avg_elbow_angle, min_angle=90, max_angle=180):
    """Calculate the percentage score for elbow extension in shoulder press"""
    score = (avg_elbow_angle - min_angle) / (max_angle - min_angle) * 100
    score = max(0, min(100, score))
    return score


def convert_percent_to_rating(percent):
    """Convert a percentage score to a 1-5 rating scale"""
    if percent >= 90:
        return 5  # Excellent
    elif percent >= 75:
        return 4  # Good
    elif percent >= 60:
        return 3  # Satisfactory
    elif percent >= 40:
        return 2  # Needs improvement
    else:
        return 1  # Poor


def get_score_description(score):
    """Return a text description for the score"""
    descriptions = {
        5: "Excellent",
        4: "Good",
        3: "Satisfactory",
        2: "Needs Improvement",
        1: "Poor Form"
    }
    return descriptions.get(score, "")



def process_other_exercise(frame, annotated_frame, exercise_type):
    """Handle processing for other exercise types using original frame for classification"""
    global exercise_count, last_pose, mid_pose_detected

    current_model = exercise_models.get(exercise_type)
    if not current_model:
        logger.warning(f"Model for {exercise_type} not found!")
        return

    exercise_results = current_model(frame, conf=0.5, verbose=False)
    logger.info(f"運動分類結果：檢測到 {len(exercise_results[0].boxes)} 個框")

    if len(exercise_results[0].boxes) > 0:
        best_box = exercise_results[0].boxes[0]
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].cpu().numpy())
        conf = float(best_box.conf)
        class_id = int(best_box.cls)
        class_name = current_model.names[class_id]

        # Draw detection box and label on annotated frame
        #cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f'{class_name} {conf:.2f}'
        #cv2.putText(annotated_frame, label, (x1, y1 - 10),
        #            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        # 基於檢測結果計算品質分數
        quality_score = min(5, max(1, int(conf * 5)))  # 將置信度轉換為1-5分
        
        # 發送品質分數事件
        socketio.emit('pose_quality', {'score': quality_score})
        socketio.emit('pose_quality', {'score': quality_score}, namespace='/exercise')

        # Perform classification counting logic
        num_classes = len(current_model.names)
        if num_classes == 1:
            if class_id == 0:
                exercise_count += 1
                socketio.emit('exercise_count_update', {'count': exercise_count},namespace='/exercise')
        elif num_classes == 2:
            if last_pose is not None:
                if last_pose == 0 and class_id == 1:
                    mid_pose_detected = True
                elif last_pose == 1 and class_id == 0 and mid_pose_detected:
                    exercise_count += 1
                    mid_pose_detected = False
                    socketio.emit('exercise_count_update', {'count': exercise_count},namespace='/exercise')
            last_pose = class_id
    else:
        # 沒有檢測到運動時發送0分
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')



def set_bicep_detection_line():
    """設置二頭彎舉檢測線"""
    global detection_line_set_bicep, elbow_line_coords
    
    # 獲取當前幀
    from app.routes.exercise_routes import get_current_frame
    frame = get_current_frame()
    
    if frame is None:
        logger.error("無法獲取幀來設置二頭彎舉檢測線")
        return False
    
    # 調整幀大小為720p
    frame = cv2.resize(frame, (720, 720))
    
    # 使用YOLO檢測姿勢
    results = pose_model(frame)
    
    if not results or len(results) == 0:
        logger.error("無法檢測到姿勢來設置二頭彎舉檢測線")
        return False
    
    # 獲取關鍵點
    if results[0].keypoints is not None:
        keypoints = results[0].keypoints.xy.cpu().numpy()[0]
        
        if len(keypoints) >= 17:
            # 獲取肘部關鍵點
            left_elbow = keypoints[7][:2]
            right_elbow = keypoints[8][:2]
            
            # 檢查關鍵點有效性
            if not np.isnan(left_elbow).any() and not np.isnan(right_elbow).any():
                # 設置肘部線
                elbow_line_coords = (
                    (int(left_elbow[0]), int(left_elbow[1])),
                    (int(right_elbow[0]), int(right_elbow[1]))
                )
                detection_line_set_bicep = True
                
                logger.info("二頭彎舉檢測線已設置")
                
                # 通知前端
                socketio.emit('bicep_detection_line_set', {
                    'success': True
                }, namespace='/exercise')
                
                return True
    
    logger.error("無法設置二頭彎舉檢測線")
    return False

def create_error_frame(frame, error_message):
    """創建帶有錯誤信息的幀"""
    if frame is None:
        # 創建一個空白幀
        frame = np.zeros((480, 480, 3), dtype=np.uint8)
    
    # 添加錯誤信息
    cv2.putText(frame, error_message, (10, 240),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    return frame
def set_shoulder_detection_line():
    """設置肩推檢測線"""
    global detection_line_set_shoulder, detection_line_y_shoulder
    
    # 獲取當前影格
    from app.routes.exercise_routes import get_current_frame
    frame = get_current_frame()
    
    if frame is None:
        logger.error("無法獲取影格來設置肩推檢測線")
        return False
    
    # 調整影格大小為720p
    frame = cv2.resize(frame, (720, 720))
    
    # 使用YOLO檢測姿勢
    results = pose_model(frame)
    
    if not results or len(results) == 0:
        logger.error("無法檢測到姿勢來設置肩推檢測線")
        return False
    
    # 獲取關鍵點
    if results[0].keypoints is not None:
        keypoints = results[0].keypoints.xy.cpu().numpy()[0]
        
        if len(keypoints) >= 17:
            # 獲取肩膀關鍵點
            left_shoulder = keypoints[5][:2]
            right_shoulder = keypoints[6][:2]
            
            # 計算肩膀中點
            shoulder_midpoint = ((left_shoulder[0] + right_shoulder[0]) / 2, 
                                (left_shoulder[1] + right_shoulder[1]) / 2)
            
            # 設置檢測線（稍微高於肩膀）
            detection_line_y_shoulder = int(shoulder_midpoint[1]) - 20
            detection_line_set_shoulder = True
            
            logger.info(f"肩推檢測線已設置在 y={detection_line_y_shoulder}")
            
            # 通知前端
            socketio.emit('shoulder_detection_line_set', {
                'success': True,
                'detection_line_y': detection_line_y_shoulder
            }, namespace='/exercise')
            
            return True
    
    logger.error("無法設置肩推檢測線")
    return False


def process_frame_realtime(frame, exercise_type):
    global exercise_count, last_pose, mid_pose_detected, squat_state, last_squat_time
    global detection_line_set, detection_line_y, knee_line_coords, squat_quality_score
    global detection_line_set_shoulder, detection_line_y_shoulder, pose_model

    try:
        if pose_model is None:
            logger.warning("姿態檢測模型未初始化，嘗試重新初始化...")
            try:
                pose_model = YOLO('yolov8n-pose.pt')
                logger.info("姿態檢測模型重新初始化成功")
            except Exception as e:
                logger.error(f"重新初始化姿態檢測模型失敗: {e}")
                # 建立一個帶有錯誤資訊的幀
                return create_error_frame(frame, "姿態檢測模型載入失敗")

        frame = cv2.resize(frame, (1080, 1080))
        annotated_frame = frame.copy()

        # 姿勢檢測
        pose_results = pose_model(frame, conf=0.3, verbose=False)

        # 如果已設置檢測線則繪製
        if detection_line_set and knee_line_coords:
            # 繪製膝蓋線
            cv2.line(annotated_frame, knee_line_coords[0], knee_line_coords[1], (0, 255, 255), 2)
            # 繪製水平基準線(紅色)
            cv2.line(annotated_frame, (0, detection_line_y), (annotated_frame.shape[1], detection_line_y),
                     (0, 0, 255), 2)
            # 標記基準線中點
            midpoint_x = (knee_line_coords[0][0] + knee_line_coords[1][0]) // 2
            cv2.circle(annotated_frame, (midpoint_x, detection_line_y), 5, (0, 255, 255), -1)
            cv2.putText(annotated_frame, "檢測線", (midpoint_x - 40, detection_line_y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

        if detection_line_set_shoulder:
            # 如果已設置則繪製肩推檢測線
            cv2.line(annotated_frame, (0, detection_line_y_shoulder),
                     (annotated_frame.shape[1], detection_line_y_shoulder), (0, 0, 255), 2)
            cv2.putText(annotated_frame, "目標線", (10, detection_line_y_shoulder - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

        angles = {}
        valid_knee_detection = False
        knee_midpoint = None
        hip_midpoint = None
        keypoints = None  # 初始化keypoints變量

        if not pose_results or len(pose_results) == 0:
            logger.warning("YOLO pose detection returned empty results!")
        else:
            # Process keypoint data
            if pose_results[0].keypoints is not None:
                keypoints = pose_results[0].keypoints.xy.cpu().numpy()[0]
                #logger.info(f"取得關鍵點數量: {len(keypoints)}")

                if len(keypoints) >= 17:
                    # Extract keypoints
                    left_shoulder = keypoints[5][:2]
                    right_shoulder = keypoints[6][:2]
                    left_elbow = keypoints[7][:2]
                    right_elbow = keypoints[8][:2]
                    left_wrist = keypoints[9][:2]
                    right_wrist = keypoints[10][:2]
                    left_hip = keypoints[11][:2]
                    right_hip = keypoints[12][:2]
                    left_knee = keypoints[13][:2]
                    right_knee = keypoints[14][:2]
                    left_ankle = keypoints[15][:2]
                    right_ankle = keypoints[16][:2]

                    # Calculate joint angles
                    angles['左手肘'] = calculate_angle(left_shoulder, left_elbow, left_wrist)
                    angles['右手肘'] = calculate_angle(right_shoulder, right_elbow, right_wrist)
                    angles['左膝蓋'] = calculate_angle(left_hip, left_knee, left_ankle)
                    angles['右膝蓋'] = calculate_angle(right_hip, right_knee, right_ankle)
                    avg_knee_angle = (angles['左膝蓋'] + angles['右膝蓋']) / 2
                    angles['左肩膀'] = calculate_angle(left_hip, left_shoulder, left_elbow)
                    angles['右肩膀'] = calculate_angle(right_hip, right_shoulder, right_elbow)
                    angles['左髖部'] = calculate_angle(left_shoulder, left_hip, left_knee)
                    angles['右髖部'] = calculate_angle(right_shoulder, right_hip, right_knee)

                    # Send angle data to frontend
                    socketio.emit('angle_data', convert_to_serializable(angles), namespace='/exercise')

                    current_quality = get_current_quality_score()
                    # 確保使用5分制發送品質分數
                    socketio.emit('pose_quality', {'score': current_quality})
                    #logger.info(f"發送品質分數: {current_quality}/5")

                    # Calculate hip midpoint
                    if not np.isnan(left_hip).any() and not np.isnan(right_hip).any():
                        hip_midpoint = ((int(left_hip[0]) + int(right_hip[0])) // 2,
                                        (int(left_hip[1]) + int(right_hip[1])) // 2)
                        # Draw hip midpoint
                        cv2.circle(annotated_frame, hip_midpoint, 5, (255, 0, 255), -1)

                    # Process knee coordinates and set detection line for squats (only once)
                    if not np.isnan(left_knee).any() and not np.isnan(right_knee).any():
                        l_knee = tuple(map(int, left_knee))
                        r_knee = tuple(map(int, right_knee))

                        # Calculate knee midpoint
                        knee_midpoint = ((l_knee[0] + r_knee[0]) // 2, (l_knee[1] + r_knee[1]) // 2)

                        # Set squat detection line only once if not already set
                        if not detection_line_set and knee_midpoint and exercise_type == "squat":
                            knee_line_coords = (l_knee, r_knee)
                            detection_line_y = int(knee_midpoint[1] * 0.8)
                            detection_line_set = True
                            logger.info(f"深蹲檢測基準線已設置在Y={detection_line_y}位置")

                            # Draw the initial detection line
                            cv2.line(annotated_frame, knee_line_coords[0], knee_line_coords[1], (0, 255, 255), 2)
                            cv2.line(annotated_frame, (0, detection_line_y),
                                     (annotated_frame.shape[1], detection_line_y), (0, 0, 255), 2)
                            cv2.circle(annotated_frame, knee_midpoint, 5, (0, 255, 255), -1)
                            cv2.putText(annotated_frame, "Detection Line Set",
                                        (knee_midpoint[0] - 60, knee_midpoint[1] - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

                        valid_knee_detection = True

                    # Set shoulder press detection line only once if not already set
                    if exercise_type == "shoulder-press" and not detection_line_set_shoulder:
                        if not np.isnan(left_shoulder).any() and not np.isnan(right_shoulder).any():
                            # Convert to integers for drawing
                            left_shoulder_point = (int(left_shoulder[0]), int(left_shoulder[1]))
                            right_shoulder_point = (int(right_shoulder[0]), int(right_shoulder[1]))

                            # Draw shoulder connection line
                            cv2.line(annotated_frame, left_shoulder_point, right_shoulder_point, (255, 255, 0), 2)

                            # Calculate target line height (above shoulders)
                            shoulder_midpoint_y = (left_shoulder[1] + right_shoulder[1]) / 2
                            shoulder_to_head_distance = frame.shape[0] * 0.15 * 1.2  # Adjusted factor

                            # Set detection line above shoulders
                            detection_line_y_shoulder = max(int(shoulder_midpoint_y - shoulder_to_head_distance),
                                                            int(frame.shape[0] * 0.1))  # Minimum 10% from top

                            # Set shoulder detection flag
                            detection_line_set_shoulder = True
                            logger.info(f"肩推檢測基準線已設置在Y={detection_line_y_shoulder}位置")


        if exercise_type == 'squat':
            # 處理深蹲運動
            process_squat_exercise(frame, annotated_frame, angles, hip_midpoint, detection_line_set, detection_line_y)
            current_quality = squat_quality_score
            #logger.info(f"當前深蹲品質分數: {current_quality}")

        elif exercise_type == "shoulder-press":
            process_shoulder_press(frame, annotated_frame, keypoints, angles, detection_line_y_shoulder)
            current_quality = shoulder_quality_score

        elif exercise_type == "bicep-curl":
            process_bicep_curl(frame, annotated_frame, keypoints, angles)
            current_quality = bicep_quality_score

        elif exercise_type == "push-up":
            process_pushup_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = pushup_quality_score

        elif exercise_type == "pull-up":
            process_pullup_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = pullup_quality_score

        elif exercise_type == "dumbbell-row":
            process_dumbbell_row_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = dumbbell_row_quality_score

        elif exercise_type == "arm-swing-warmup":
            arm_swing_warmup_service.process_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = arm_swing_warmup_service.get_quality_score()

        elif exercise_type == "alternating-arm-swing":
            alternating_arm_swing_service.process_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = alternating_arm_swing_service.quality_score

        elif exercise_type == "plank":
            plank_service.process_exercise(frame, annotated_frame, keypoints, angles)
            current_quality = plank_service.quality_score

        else:
            process_other_exercise(frame, annotated_frame, exercise_type)
            current_quality = 0
            

        # Display exercise count
        cv2.putText(annotated_frame, f'Count: {exercise_count}', (10, annotated_frame.shape[0] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Add status indicators for debugging
        status_text = []
        status_text.append(f"Squat Line: {'Yes' if detection_line_set else 'No'}")
        status_text.append(f"Shoulder Line: {'Yes' if detection_line_set_shoulder else 'No'}")
        status_text.append(f"Exercise: {exercise_type}")
        status_text.append(f"Frame: {annotated_frame.shape}")

        # 優化品質分數發送 - 減少頻繁通信
        global quality_frame_count
        if 'quality_frame_count' not in globals():
            quality_frame_count = 0
        quality_frame_count += 1
        
        # 每50幀發送一次品質分數
        if quality_frame_count % 50 == 0:
            socketio.emit('pose_quality', {'score': current_quality})
            socketio.emit('pose_quality', {'score': current_quality}, namespace='/exercise')
            #if quality_frame_count % 500 == 0:  # 每500幀記錄一次日誌
            #   logger.info(f"發送品質分數: {current_quality}/5 (已發送到兩個命名空間)")

        
        #for i, text in enumerate(status_text):  # 將每個文本放在不同的行
        #    cv2.putText(annotated_frame, text, (10, 20 + i * 20),
        #                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        return annotated_frame

    except Exception as e:

        # 如果有錯誤，創建一個錯誤幀
        if 'frame' in locals():
            error_frame = frame.copy() if frame is not None else np.zeros((480, 480, 3), dtype=np.uint8)
            cv2.putText(error_frame, f"Error: {str(e)}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            return error_frame
        logger.error(f"處理幀時出錯: {e}", exc_info=True)
        return create_error_frame(frame, f"處理錯誤: {str(e)}")


def send_quality_score(score, feedback=None):
    """發送品質分數到前端"""
    # 確保分數在0-5範圍內
    score = max(0, min(5, score))
    
    # 準備發送的數據
    data = {
        'score': score
    }
    if feedback:
        data['feedback'] = feedback
    
    # 同時發送到默認命名空間和 /exercise 命名空間
    socketio.emit('pose_quality', data)
    socketio.emit('pose_quality', data, namespace='/exercise')
    #logger.info(f"發送品質分數: {score}/5, 反饋: {feedback} (已發送到兩個命名空間)")
    
    return score

def process_shoulder_press(frame, annotated_frame, keypoints, angles, detection_line_y_shoulder):
    """Handle shoulder press exercise processing logic using original frame for classification"""
    global exercise_count, last_pose, shoulder_quality_score, last_shoulder_press_time, shoulder_press_state
    
    if 'shoulder_press_state' not in globals():
        shoulder_press_state = 'down'

    # 初始化上次肩推時間變數（如果不存在）
    if 'last_shoulder_press_time' not in globals():
        last_shoulder_press_time = 0

    # 添加除錯資訊收集
    debug_info = []
    debug_info.append(f"Detection line Y: {detection_line_y_shoulder}")

    # 檢查關鍵點是否足夠
    if keypoints is None or len(keypoints) < 17:
        logger.warning("Insufficient keypoints for shoulder press detection!")
        return

    current_model = exercise_models.get("shoulder-press")
    if not current_model:
        logger.warning("Shoulder press model not found!")
        return

    # 定義骨架連接（基於COCO 17個關鍵點）
    skeleton_connections = [
        (5, 7), (7, 9),    # 左肩-左肘-左手腕
        (6, 8), (8, 10),   # 右肩-右肘-右手腕
        (5, 6),            # 左肩-右肩
        (11, 12),          # 左髖-右髖
        (5, 11), (6, 12),  # 肩-髖
        (11, 13), (13, 15), # 左髖-左膝-左踝
        (12, 14), (14, 16), # 右髖-右膝-右踝
    ]

    # 繪製骨架連接線
    for connection in skeleton_connections:
        pt1 = tuple(map(int, keypoints[connection[0]][:2]))
        pt2 = tuple(map(int, keypoints[connection[1]][:2]))
        if not (np.isnan(pt1).any() or np.isnan(pt2).any()):
            cv2.line(annotated_frame, pt1, pt2, (0, 255, 0), 2)  # 綠色連線

    # 繪製關鍵點
    for kp in keypoints:
        if not np.isnan(kp).any():
            cv2.circle(annotated_frame, tuple(map(int, kp[:2])), 5, (0, 0, 255), -1)  # 紅色圓點

    # 提取關鍵點資訊
    left_shoulder = keypoints[5][:2]
    right_shoulder = keypoints[6][:2]
    left_elbow = keypoints[7][:2]
    right_elbow = keypoints[8][:2]
    left_wrist = keypoints[9][:2]
    right_wrist = keypoints[10][:2]

    # 檢查關鍵點有效性
    left_shoulder_valid = not np.isnan(left_shoulder).any()
    right_shoulder_valid = not np.isnan(right_shoulder).any()
    left_wrist_valid = not np.isnan(left_wrist).any()
    right_wrist_valid = not np.isnan(right_wrist).any()

    debug_info.append(f"Shoulder L/R valid: {left_shoulder_valid}/{right_shoulder_valid}")
    debug_info.append(f"Wrist L/R valid: {left_wrist_valid}/{right_wrist_valid}")

    # 嘗試執行分類模型
    try:
        shoulder_press_results = current_model(frame, conf=0.3, verbose=False)
        has_classification = len(shoulder_press_results) > 0 and len(shoulder_press_results[0].boxes) > 0
        debug_info.append(f"Classification detected: {has_classification}")
    except Exception as e:
        logger.error(f"Error running shoulder press model: {e}")
        has_classification = False
        debug_info.append(f"Classification error: {str(e)}")

    # 繪製肩膀連線
    if left_shoulder_valid and right_shoulder_valid:
        left_shoulder_point = (int(left_shoulder[0]), int(left_shoulder[1]))
        right_shoulder_point = (int(right_shoulder[0]), int(right_shoulder[1]))
        cv2.line(annotated_frame, left_shoulder_point, right_shoulder_point, (255, 255, 0), 2)

    # 檢測線邏輯
    if detection_line_y_shoulder is None or detection_line_y_shoulder <= 0:
        if left_shoulder_valid and right_shoulder_valid:
            shoulder_midpoint_y = (left_shoulder[1] + right_shoulder[1]) / 2
            shoulder_to_head_distance = frame.shape[0] * 0.15 * 1.2
            detection_line_y_shoulder = max(int(shoulder_midpoint_y - shoulder_to_head_distance),
                                            int(frame.shape[0] * 0.1))
            #logger.info(f"自動設置肩推檢測線在Y={detection_line_y_shoulder}位置")
        else:
            detection_line_y_shoulder = int(frame.shape[0] * 0.2)
            #logger.info(f"使用預設檢測線在Y={detection_line_y_shoulder}位置")

    # 繪製檢測線
    cv2.line(annotated_frame, (0, detection_line_y_shoulder),
             (annotated_frame.shape[1], detection_line_y_shoulder), (0, 0, 255), 2)
    cv2.putText(annotated_frame, "Target Line", (10, detection_line_y_shoulder - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

    # 繪製和檢查手腕位置
    left_wrist_below = False
    right_wrist_below = False

    if left_wrist_valid:
        left_wrist_point = (int(left_wrist[0]), int(left_wrist[1]))
        left_wrist_below = left_wrist[1] < detection_line_y_shoulder
        wrist_color_left = (0, 255, 0) if left_wrist_below else (0, 0, 255)
        cv2.circle(annotated_frame, left_wrist_point, 5, wrist_color_left, -1)
        debug_info.append(f"Left wrist Y: {left_wrist[1]} (Below line: {left_wrist_below})")

    if right_wrist_valid:
        right_wrist_point = (int(right_wrist[0]), int(right_wrist[1]))
        right_wrist_below = right_wrist[1] < detection_line_y_shoulder
        wrist_color_right = (0, 255, 0) if right_wrist_below else (0, 0, 255)
        cv2.circle(annotated_frame, right_wrist_point, 5, wrist_color_right, -1)
        debug_info.append(f"Right wrist Y: {right_wrist[1]} (Below line: {right_wrist_below})")

    # 計算肘部角度
    if '左手肘' in angles and '右手肘' in angles:
        avg_elbow_angle = (angles.get('左手肘', 180) + angles.get('右手肘', 180)) / 2.0
        debug_info.append(f"Avg elbow angle: {avg_elbow_angle:.1f}°")
    else:
        avg_elbow_angle = 180
        debug_info.append("Elbow angles not available")

    # 評分邏輯
    should_score = False
    if (left_wrist_valid and left_wrist_below) or (right_wrist_valid and right_wrist_below):
        should_score = True

    if has_classification:
        best_box = shoulder_press_results[0].boxes[0]
        class_id = int(best_box.cls)
        conf = float(best_box.conf)
        class_name = current_model.names[class_id]
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].cpu().numpy())
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f'{class_name} {conf:.2f}'
        cv2.putText(annotated_frame, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    else:
        debug_info.append("No classification, using pose data only")

    if should_score and (left_shoulder_valid and right_shoulder_valid) and (left_wrist_valid or right_wrist_valid):
        alignment_percent = 0
        if left_wrist_valid and left_shoulder_valid:
            left_wrist_shoulder_diff = abs(left_wrist[0] - left_shoulder[0])
            max_allowed_diff = frame.shape[1] * 0.2
            left_alignment = min(100, max(0, 100 - (left_wrist_shoulder_diff / max_allowed_diff * 100)))
            alignment_percent = left_alignment

        if right_wrist_valid and right_shoulder_valid:
            right_wrist_shoulder_diff = abs(right_wrist[0] - right_shoulder[0])
            max_allowed_diff = frame.shape[1] * 0.2
            right_alignment = min(100, max(0, 100 - (right_wrist_shoulder_diff / max_allowed_diff * 100)))
            if left_wrist_valid:
                alignment_percent = (alignment_percent + right_alignment) / 2
            else:
                alignment_percent = right_alignment

        elbow_extension_percent = calculate_shoulder_press_score(avg_elbow_angle)
        total_percent = (elbow_extension_percent + alignment_percent) / 2
        shoulder_quality_score = convert_percent_to_rating(total_percent)
        score_description = get_score_description(shoulder_quality_score)

        # 修改：使用統一的 pose_quality 事件發送5分制分數
        socketio.emit('pose_quality', {'score': shoulder_quality_score})
        #logger.info(f"肩推評分: {shoulder_quality_score}/5 ({int(total_percent)}%)")
        
        # 保留原有的事件發送，確保兼容性
        socketio.emit('shoulder_press_score', {'score': shoulder_quality_score}, namespace='/exercise')
        
        # 新增：基於品質分數的計數邏輯
        current_time = time.time()
        # 當YOLO模型沒有偵測到動作但品質分數大於3分時，也算作完成一個肩推動作
        if not has_classification:
            if shoulder_quality_score > 3:
                if shoulder_press_state == 'down' and current_time - last_shoulder_press_time > 1.5:
                    exercise_count += 1
                    last_shoulder_press_time = current_time
                    shoulder_press_state = 'up'
                    #logger.info(f"基於品質分數計數 - 肩推完成，計數: {exercise_count} (分數: {shoulder_quality_score}/5)")
                    socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
                elif shoulder_press_state == 'up' and current_time - last_shoulder_press_time <= 1.5:
                    logger.debug(f"維持'up'狀態，不計數 (間隔: {current_time - last_shoulder_press_time:.1f}s)")
            else:
                if shoulder_press_state == 'up':
                    shoulder_press_state = 'down'
        elif has_classification:
            # 對於YOLO檢測，也應用狀態邏輯
            if shoulder_press_state == 'down' and current_time - last_shoulder_press_time > 1.5:
                exercise_count += 1
                last_shoulder_press_time = current_time
                shoulder_press_state = 'up'
                socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
            else:
                shoulder_press_state = 'down'
    else:
        reason = "無法進行評分: "
        if not (left_shoulder_valid and right_shoulder_valid):
            reason += "肩膀檢測失敗 "
        elif not (left_wrist_valid or right_wrist_valid):
            reason += "手腕檢測失敗 "
        elif not ((left_wrist_valid and left_wrist_below) or (right_wrist_valid and right_wrist_below)):
            reason += "請將手腕舉高超過目標線 "
        shoulder_quality_score = 0  # 更新全域變數
        socketio.emit('pose_quality', {'score': 0})  # 添加：發送0分
        if shoulder_press_state == 'up':
            shoulder_press_state = 'down'
        socketio.emit('shoulder_press_score', {'score': 0}, namespace='/exercise')
        #logger.info(reason)

    # 顯示除錯資訊（可選）
    # for i, text in enumerate(debug_info):
    #     cv2.putText(annotated_frame, text, (10, 200 + i * 20),
    #                 cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)


def reset_detection_state_complete():
    """完整重置所有偵測狀態"""
    global exercise_count, last_pose, mid_pose_detected, squat_state, detection_line_set
    global detection_line_y, knee_line_coords, squat_quality_score, remaining_sets
    global detection_line_set_shoulder, detection_line_y_shoulder
    global detection_line_set_bicep, elbow_line_coords, bicep_state, shoulder_state
    global bicep_quality_score, shoulder_quality_score, last_curl_time, last_shoulder_press_time
    global pushup_state, pullup_state, dumbbell_row_state
    global detection_line_set_pushup, detection_line_y_pushup
    global detection_line_set_pullup, detection_line_y_pullup
    global detection_line_set_dumbbell_row, detection_line_y_dumbbell_row
    global pushup_quality_score, pullup_quality_score, dumbbell_row_quality_score
    global last_pushup_time, last_pullup_time, last_dumbbell_row_time
    
    # 重置基本狀態
    exercise_count = 0
    last_pose = None
    mid_pose_detected = False
    
    # 重置深蹲相關狀態
    squat_state = 'init'
    detection_line_set = False
    detection_line_y = 0
    knee_line_coords = None
    squat_quality_score = 0
    
    # 重置肩推相關狀態
    shoulder_state = 'init'
    detection_line_set_shoulder = False
    detection_line_y_shoulder = 0
    shoulder_quality_score = 0
    
    # 重置二頭彎舉相關狀態
    bicep_state = 'init'
    detection_line_set_bicep = False
    elbow_line_coords = None
    bicep_quality_score = 0
    last_curl_time = 0
    
    # 重置伏地挺身相關狀態
    pushup_state = 'up'
    detection_line_set_pushup = False
    detection_line_y_pushup = 0
    pushup_quality_score = 0
    last_pushup_time = 0
    
    # 重置引體向上相關狀態
    pullup_state = 'down'
    detection_line_set_pullup = False
    detection_line_y_pullup = 0
    pullup_quality_score = 0
    last_pullup_time = 0
    
    # 重置啞鈴划船相關狀態
    dumbbell_row_state = 'forward'
    detection_line_set_dumbbell_row = False
    detection_line_y_dumbbell_row = 0
    dumbbell_row_quality_score = 0
    last_dumbbell_row_time = 0
    
    # 重置啞鈴划船混合計數系統狀態
    global dumbbell_row_pose_score_history, dumbbell_row_pose_state, last_pose_count_time, yolo_detected_this_cycle
    dumbbell_row_pose_score_history = []
    dumbbell_row_pose_state = "low"
    last_pose_count_time = 0
    yolo_detected_this_cycle = False
    
    # 重置智能手臂選擇系統狀態
    global current_active_arm, last_arm_switch_time
    current_active_arm = "right"
    last_arm_switch_time = 0
    
    # 重置肩推計數時間
    last_shoulder_press_time = 0
    
    # 重置組數
    remaining_sets = target_sets
    
    logger.info("所有偵測狀態已重置")



def get_current_angles():
    """獲取當前角度數據"""
    global current_angles
    if not hasattr(get_current_angles, 'current_angles'):
        get_current_angles.current_angles = {
            '左手肘': 0, '右手肘': 0, '左膝蓋': 0, '右膝蓋': 0,
            '左肩膀': 0, '右肩膀': 0, '左髖部': 0, '右髖部': 0
        }
    return get_current_angles.current_angles


def get_current_quality_score():
    """獲取當前品質評分"""
    global squat_quality_score, bicep_quality_score, shoulder_quality_score
    global pushup_quality_score, pullup_quality_score, dumbbell_row_quality_score
    exercise_type = get_current_exercise_type()
    
    if exercise_type == 'squat':
        return squat_quality_score
    elif exercise_type == 'bicep-curl':
        return bicep_quality_score
    elif exercise_type == 'shoulder-press':
        return shoulder_quality_score
    elif exercise_type == 'pushup':
        return pushup_quality_score
    elif exercise_type == 'pullup':
        return pullup_quality_score
    elif exercise_type == 'dumbbell-row':
        return dumbbell_row_quality_score
    elif exercise_type == 'arm-swing-warmup':
        return arm_swing_warmup_service.get_quality_score()
    return 0

def get_current_coach_tip():
    """獲取當前教練提示"""
    global current_coach_tip
    if not hasattr(get_current_coach_tip, 'current_coach_tip'):
        get_current_coach_tip.current_coach_tip = "請保持正確姿勢，開始運動"
    return get_current_coach_tip.current_coach_tip

def update_coach_tip(tip):
    """更新教練提示"""
    get_current_coach_tip.current_coach_tip = tip
    # 傳送到前端
    socketio.emit('coach_tip', {'tip': tip}, namespace='/exercise')

# 添加日誌以跟踪運動計數更新
def update_count(self, new_count):
    """更新運動計數"""
    if new_count > self.count:
        #logger.info(f"運動計數更新: {self.count} -> {new_count}")
        self.count = new_count
        return True
    return False

def get_current_count():
    """獲取當前運動計數"""
    global exercise_count
    exercise_type = get_current_exercise_type()
    
    # 對於手臂擺動暖身運動，使用其專用的計數器
    if exercise_type == 'arm-swing-warmup':
        return arm_swing_warmup_service.get_exercise_count()
    
    #logger.debug(f"獲取當前運動計數: {exercise_count}")
    return exercise_count


def process_pushup_exercise(frame, annotated_frame, keypoints, angles):
    """處理伏地挺身運動的姿態檢測和評分"""
    global exercise_count, pushup_state, last_pushup_time, pushup_quality_score
    global detection_line_set_pushup, detection_line_y_pushup
    
    # 初始化上次伏地挺身時間變數（如果不存在）
    if 'last_pushup_time' not in globals():
        last_pushup_time = 0
    
    # 檢查關鍵點是否足夠
    if keypoints is None or len(keypoints) < 17:
        logger.warning("伏地挺身檢測關鍵點不足！")
        pushup_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        return
    
    # 提取關鍵點
    nose = keypoints[0][:2]
    left_shoulder = keypoints[5][:2]
    right_shoulder = keypoints[6][:2]
    left_elbow = keypoints[7][:2]
    right_elbow = keypoints[8][:2]
    left_wrist = keypoints[9][:2]
    right_wrist = keypoints[10][:2]
    left_hip = keypoints[11][:2]
    right_hip = keypoints[12][:2]
    left_knee = keypoints[13][:2]
    right_knee = keypoints[14][:2]
    left_ankle = keypoints[15][:2]
    right_ankle = keypoints[16][:2]
    
    # 檢查關鍵點有效性
    required_points = [nose, left_shoulder, right_shoulder, left_hip, right_hip, left_ankle, right_ankle]
    if any(np.isnan(point).any() for point in required_points):
        pushup_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        return
    
    # 繪製骨架
    skeleton_connections = [
        (5, 7), (7, 9),    # 左肩-左肘-左手腕
        (6, 8), (8, 10),   # 右肩-右肘-右手腕
        (5, 6),            # 左肩-右肩
        (11, 12),          # 左髖-右髖
        (5, 11), (6, 12),  # 肩-髖
        (11, 13), (13, 15), # 左髖-左膝-左踝
        (12, 14), (14, 16), # 右髖-右膝-右踝
    ]
    
    for connection in skeleton_connections:
        pt1 = tuple(map(int, keypoints[connection[0]][:2]))
        pt2 = tuple(map(int, keypoints[connection[1]][:2]))
        if not (np.isnan(pt1).any() or np.isnan(pt2).any()):
            cv2.line(annotated_frame, pt1, pt2, (0, 255, 0), 2)
    
    # 繪製關鍵點
    for kp in keypoints:
        if not np.isnan(kp).any():
            cv2.circle(annotated_frame, tuple(map(int, kp[:2])), 5, (0, 0, 255), -1)
    
    # 設置檢測線（地面參考線）
    if not detection_line_set_pushup:
        # 使用腳踝位置設置地面參考線
        ankle_y = max(left_ankle[1], right_ankle[1])
        detection_line_y_pushup = int(ankle_y)
        detection_line_set_pushup = True
        logger.info(f"伏地挺身地面參考線已設置在 Y={detection_line_y_pushup}")
    
    # 繪製地面參考線
    cv2.line(annotated_frame, (0, detection_line_y_pushup),
             (annotated_frame.shape[1], detection_line_y_pushup), (255, 0, 0), 2)
    cv2.putText(annotated_frame, "Ground Line", (10, detection_line_y_pushup - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    
    # 計算身體角度（鼻子到髖部中點到腳踝中點的角度）
    hip_midpoint = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
    ankle_midpoint = ((left_ankle[0] + right_ankle[0]) / 2, (left_ankle[1] + right_ankle[1]) / 2)
    
    # 計算身體與地面的角度
    body_vector = (ankle_midpoint[0] - nose[0], ankle_midpoint[1] - nose[1])
    ground_vector = (100, 0)  # 水平向量
    
    # 計算角度
    dot_product = body_vector[0] * ground_vector[0] + body_vector[1] * ground_vector[1]
    body_magnitude = np.sqrt(body_vector[0]**2 + body_vector[1]**2)
    ground_magnitude = np.sqrt(ground_vector[0]**2 + ground_vector[1]**2)
    
    if body_magnitude > 0 and ground_magnitude > 0:
        cos_angle = dot_product / (body_magnitude * ground_magnitude)
        cos_angle = np.clip(cos_angle, -1, 1)
        body_angle = np.degrees(np.arccos(cos_angle))
    else:
        body_angle = 90
    
    # 計算鼻子到地面的距離比例
    nose_to_ground_distance = abs(nose[1] - detection_line_y_pushup)
    frame_height = frame.shape[0]
    distance_ratio = nose_to_ground_distance / frame_height
    
    # 評分邏輯：身體角度越小（越接近地面）分數越高
    # 理想的伏地挺身身體角度應該在10-30度之間
    if body_angle <= 15:  # 非常好的伏地挺身
        angle_score = 5
    elif body_angle <= 25:  # 好的伏地挺身
        angle_score = 4
    elif body_angle <= 35:  # 中等的伏地挺身
        angle_score = 3
    elif body_angle <= 45:  # 較差的伏地挺身
        angle_score = 2
    else:  # 很差的伏地挺身
        angle_score = 1
    
    # 距離評分：鼻子越接近地面分數越高
    if distance_ratio <= 0.1:  # 非常接近地面
        distance_score = 5
    elif distance_ratio <= 0.2:  # 接近地面
        distance_score = 4
    elif distance_ratio <= 0.3:  # 中等距離
        distance_score = 3
    elif distance_ratio <= 0.4:  # 較遠
        distance_score = 2
    else:  # 很遠
        distance_score = 1
    
    # 綜合評分
    pushup_quality_score = int((angle_score + distance_score) / 2)
    pushup_quality_score = max(1, min(5, pushup_quality_score))
    
    # 發送姿態品質分數
    socketio.emit('pose_quality', {'score': pushup_quality_score})
    
    # 顯示調試信息
    cv2.putText(annotated_frame, f"Body Angle: {body_angle:.1f}°", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Distance Ratio: {distance_ratio:.2f}", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Score: {pushup_quality_score}/5", (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # 計數邏輯：基於姿態品質分數
    current_time = time.time()
    if pushup_quality_score >= 4:  # 高品質伏地挺身
        if pushup_state == "up" and body_angle <= 25:  # 從上位置到下位置
            pushup_state = "down"
        elif pushup_state == "down" and body_angle >= 35:  # 從下位置回到上位置
            if current_time - last_pushup_time > 1.0:  # 防止重複計數
                exercise_count += 1
                last_pushup_time = current_time
                pushup_state = "up"
                logger.info(f"伏地挺身完成，計數: {exercise_count} (分數: {pushup_quality_score}/5)")
                socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
    
    # 繪製身體線條
    nose_point = tuple(map(int, nose))
    hip_point = tuple(map(int, hip_midpoint))
    ankle_point = tuple(map(int, ankle_midpoint))
    
    cv2.line(annotated_frame, nose_point, ankle_point, (255, 255, 0), 3)
    cv2.circle(annotated_frame, nose_point, 8, (0, 255, 255), -1)
    cv2.circle(annotated_frame, hip_point, 8, (255, 0, 255), -1)
    cv2.circle(annotated_frame, ankle_point, 8, (255, 255, 0), -1)


def process_pullup_exercise(frame, annotated_frame, keypoints, angles):
    """處理引體向上運動的姿態檢測和評分"""
    global exercise_count, pullup_state, last_pullup_time, pullup_quality_score
    global detection_line_set_pullup, detection_line_y_pullup
    
    # 初始化上次引體向上時間變數（如果不存在）
    if 'last_pullup_time' not in globals():
        last_pullup_time = 0
    
    # 檢查關鍵點是否足夠
    if keypoints is None or len(keypoints) < 17:
        logger.warning("引體向上檢測關鍵點不足！")
        pullup_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        return
    
    # 提取關鍵點
    nose = keypoints[0][:2]
    left_shoulder = keypoints[5][:2]
    right_shoulder = keypoints[6][:2]
    left_elbow = keypoints[7][:2]
    right_elbow = keypoints[8][:2]
    left_wrist = keypoints[9][:2]
    right_wrist = keypoints[10][:2]
    left_hip = keypoints[11][:2]
    right_hip = keypoints[12][:2]
    
    # 檢查關鍵點有效性
    required_points = [nose, left_shoulder, right_shoulder, left_wrist, right_wrist, left_hip, right_hip]
    if any(np.isnan(point).any() for point in required_points):
        pullup_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        return
    
    # 簡化骨架繪製，只繪製手臂相關的連線
    skeleton_connections = [
        (5, 7), (7, 9),    # 左肩-左肘-左手腕
        (6, 8), (8, 10),   # 右肩-右肘-右手腕
        (5, 6),            # 左肩-右肩
    ]
    
    for connection in skeleton_connections:
        pt1 = tuple(map(int, keypoints[connection[0]][:2]))
        pt2 = tuple(map(int, keypoints[connection[1]][:2]))
        if not (np.isnan(pt1).any() or np.isnan(pt2).any()):
            cv2.line(annotated_frame, pt1, pt2, (0, 255, 0), 2)
    
    # 只繪製重要的關鍵點（肩膀、手肘、手腕）
    important_points = [5, 6, 7, 8, 9, 10]  # 肩膀、手肘、手腕
    for i in important_points:
        if i < len(keypoints) and not np.isnan(keypoints[i]).any():
            cv2.circle(annotated_frame, tuple(map(int, keypoints[i][:2])), 5, (0, 0, 255), -1)
    
    # 計算身體中心點（肩部和髖部的中點）
    shoulder_midpoint = ((left_shoulder[0] + right_shoulder[0]) / 2, (left_shoulder[1] + right_shoulder[1]) / 2)
    hip_midpoint = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
    body_center = ((shoulder_midpoint[0] + hip_midpoint[0]) / 2, (shoulder_midpoint[1] + hip_midpoint[1]) / 2)
    
    # 設置檢測線（初始身體中心位置）
    if not detection_line_set_pullup:
        detection_line_y_pullup = int(body_center[1])
        detection_line_set_pullup = True
        logger.info(f"引體向上參考線已設置在 Y={detection_line_y_pullup}")
    
    # 繪製參考線
    cv2.line(annotated_frame, (0, detection_line_y_pullup),
             (annotated_frame.shape[1], detection_line_y_pullup), (255, 0, 0), 2)
    cv2.putText(annotated_frame, "Reference Line", (10, detection_line_y_pullup - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    
    # 計算身體中心相對於參考線的位移
    vertical_displacement = detection_line_y_pullup - body_center[1]  # 正值表示向上移動
    
    # 計算手臂角度（評估引體向上的完成度）
    left_arm_angle = angles.get('left_elbow', 180)
    right_arm_angle = angles.get('right_elbow', 180)
    avg_arm_angle = (left_arm_angle + right_arm_angle) / 2
    
    # 評分邏輯：身體向上位移越大分數越高
    # 位移評分
    if vertical_displacement >= 50:  # 向上移動超過50像素
        displacement_score = 5
    elif vertical_displacement >= 30:  # 向上移動30-50像素
        displacement_score = 4
    elif vertical_displacement >= 15:  # 向上移動15-30像素
        displacement_score = 3
    elif vertical_displacement >= 5:   # 向上移動5-15像素
        displacement_score = 2
    else:  # 向上移動不足5像素或向下移動
        displacement_score = 1
    
    # 手臂角度評分（引體向上時手臂應該彎曲）
    if avg_arm_angle <= 90:  # 手臂彎曲度很好
        arm_score = 5
    elif avg_arm_angle <= 110:  # 手臂彎曲度良好
        arm_score = 4
    elif avg_arm_angle <= 130:  # 手臂彎曲度中等
        arm_score = 3
    elif avg_arm_angle <= 150:  # 手臂彎曲度較差
        arm_score = 2
    else:  # 手臂幾乎沒有彎曲
        arm_score = 1
    
    # 綜合評分
    pullup_quality_score = int((displacement_score + arm_score) / 2)
    pullup_quality_score = max(1, min(5, pullup_quality_score))
    
    # 發送姿態品質分數
    socketio.emit('pose_quality', {'score': pullup_quality_score})
    
    # 顯示調試信息
    cv2.putText(annotated_frame, f"Vertical Disp: {vertical_displacement:.1f}px", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Arm Angle: {avg_arm_angle:.1f}°", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Score: {pullup_quality_score}/5", (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # 計數邏輯：基於姿態品質分數和位移
    current_time = time.time()
    if pullup_quality_score >= 4:  # 高品質引體向上
        if pullup_state == "down" and vertical_displacement >= 30:  # 從下位置向上拉
            pullup_state = "up"
        elif pullup_state == "up" and vertical_displacement <= 10:  # 從上位置回到下位置
            if current_time - last_pullup_time > 2.0:  # 防止重複計數
                exercise_count += 1
                last_pullup_time = current_time
                pullup_state = "down"
                logger.info(f"引體向上完成，計數: {exercise_count} (分數: {pullup_quality_score}/5)")
                socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
    
    # 繪製身體中心點和參考點
    body_center_point = tuple(map(int, body_center))
    shoulder_point = tuple(map(int, shoulder_midpoint))
    hip_point = tuple(map(int, hip_midpoint))
    
    cv2.circle(annotated_frame, body_center_point, 10, (0, 255, 255), -1)
    cv2.circle(annotated_frame, shoulder_point, 8, (255, 0, 255), -1)
    cv2.circle(annotated_frame, hip_point, 8, (255, 255, 0), -1)
    
    # 繪製位移箭頭
    if vertical_displacement > 5:
        arrow_start = (int(body_center[0]), detection_line_y_pullup)
        arrow_end = (int(body_center[0]), int(body_center[1]))
        cv2.arrowedLine(annotated_frame, arrow_start, arrow_end, (0, 255, 0), 3)


def calculate_arm_quality_score(shoulder, elbow, wrist, arm_angle, detection_line_y, side_name):
    """計算單個手臂的啞鈴划船品質分數"""
    try:
        # 檢查關鍵點有效性
        if np.isnan(shoulder).any() or np.isnan(elbow).any() or np.isnan(wrist).any():
            return 0
        
        # 計算手肘相對於檢測線的高度
        elbow_elevation = detection_line_y - elbow[1]  # 正值表示手肘在參考線上方
        
        # 手肘高度評分（主要評分標準，權重更高）
        if elbow_elevation >= 15:  # 手肘明顯高於參考線
            elevation_score = 5
        elif elbow_elevation >= 5:   # 手肘稍高於參考線
            elevation_score = 4
        elif elbow_elevation >= -5:  # 手肘接近參考線
            elevation_score = 3
        elif elbow_elevation >= -15: # 手肘稍低於參考線
            elevation_score = 2
        else:  # 手肘明顯低於參考線
            elevation_score = 1
        
        # 手臂角度評分（划船時手臂應該彎曲）
        if 70 <= arm_angle <= 110:  # 理想的手臂彎曲角度
            arm_score = 5
        elif 60 <= arm_angle <= 120:  # 良好的手臂彎曲角度
            arm_score = 4
        elif 50 <= arm_angle <= 130:  # 中等的手臂彎曲角度
            arm_score = 3
        elif 40 <= arm_angle <= 140:  # 較差的手臂彎曲角度
            arm_score = 2
        else:  # 手臂角度不理想
            arm_score = 1
        
        # 綜合評分（手肘高度佔70%，手臂角度佔30%）
        weighted_score = (elevation_score * 0.7) + (arm_score * 0.3)
        final_score = max(1, min(5, int(round(weighted_score))))
        
        #logger.debug(f"{side_name}手臂品質分數: {final_score}/5 (手肘高度: {elbow_elevation:.1f}px, 手臂角度: {arm_angle:.1f}°)")
        return final_score
        
    except Exception as e:
        logger.warning(f"計算{side_name}手臂品質分數時出錯: {e}")
        return 0

def select_best_arm(left_arm_data, right_arm_data):
    """智能選擇品質更好的手臂"""
    global current_active_arm, last_arm_switch_time, arm_switch_threshold, arm_switch_cooldown
    
    try:
        current_time = time.time()
        
        # 計算兩隻手臂的品質分數
        left_score = left_arm_data['score']
        right_score = right_arm_data['score']
        
        # 如果兩隻手臂都無效，保持當前選擇
        if left_score == 0 and right_score == 0:
            return current_active_arm
        
        # 如果只有一隻手臂有效，選擇有效的那隻
        if left_score == 0:
            return "right"
        if right_score == 0:
            return "left"
        
        # 檢查是否在冷卻期內
        if current_time - last_arm_switch_time < arm_switch_cooldown:
            return current_active_arm
        
        # 計算分數差距
        score_diff = abs(left_score - right_score)
        
        # 如果分數差距小於閾值，保持當前選擇
        if score_diff < arm_switch_threshold:
            return current_active_arm
        
        # 選擇分數更高的手臂
        best_arm = "left" if left_score > right_score else "right"
        
        # 如果需要切換手臂
        if best_arm != current_active_arm:
            logger.info(f"智能手臂切換: {current_active_arm} -> {best_arm} (左手: {left_score}/5, 右手: {right_score}/5)")
            current_active_arm = best_arm
            last_arm_switch_time = current_time
        
        return best_arm
        
    except Exception as e:
        logger.warning(f"智能手臂選擇時出錯: {e}")
        return current_active_arm

def update_pose_score_history(score):
    """更新姿勢分數歷史"""
    global dumbbell_row_pose_score_history, history_buffer_size
    
    dumbbell_row_pose_score_history.append(score)
    # 保持歷史緩衝區大小
    if len(dumbbell_row_pose_score_history) > history_buffer_size:
        dumbbell_row_pose_score_history.pop(0)

def detect_pose_score_cycle():
    """檢測姿勢分數完整動作週期"""
    global dumbbell_row_pose_score_history, dumbbell_row_pose_state
    global pose_score_threshold_high, pose_score_threshold_low
    
    if len(dumbbell_row_pose_score_history) < 5:  # 需要足夠的歷史數據
        return False
    
    current_score = dumbbell_row_pose_score_history[-1]
    recent_scores = dumbbell_row_pose_score_history[-5:]  # 最近5幀
    
    # 狀態機邏輯
    if dumbbell_row_pose_state == "low":
        # 檢測從低分到高分的轉換
        if current_score >= pose_score_threshold_high:
            high_count = sum(1 for s in recent_scores if s >= pose_score_threshold_high)
            if high_count >= 3:  # 連續3幀高分確認轉換
                dumbbell_row_pose_state = "high"
                logger.debug(f"姿勢分數狀態轉換: low -> high (分數: {current_score})")
    
    elif dumbbell_row_pose_state == "high":
        # 檢測從高分到低分的轉換（完成一個動作週期）
        if current_score <= pose_score_threshold_low:
            low_count = sum(1 for s in recent_scores if s <= pose_score_threshold_low)
            if low_count >= 3:  # 連續3幀低分確認完成週期
                dumbbell_row_pose_state = "low"
                logger.debug(f"姿勢分數狀態轉換: high -> low (分數: {current_score})")
                return True  # 檢測到完整動作週期
    
    return False

def pose_score_assisted_counting():
    """姿勢分數輔助計數邏輯"""
    global exercise_count, last_pose_count_time, yolo_detected_this_cycle
    
    current_time = time.time()
    
    # 檢查時間間隔，防止重複計數
    if current_time - last_pose_count_time < 1.5:
        return False
    
    # 檢測完整動作週期
    if detect_pose_score_cycle():
        # 如果YOLO在這個週期內沒有檢測到，則由姿勢分數計數
        if not yolo_detected_this_cycle:
            exercise_count += 1
            last_pose_count_time = current_time
            logger.info(f"啞鈴划船完成（姿勢分數輔助），計數: {exercise_count}")
            socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
            return True
        else:
            # 重置YOLO檢測標記，準備下一個週期
            yolo_detected_this_cycle = False
    
    return False

def process_dumbbell_row_exercise(frame, annotated_frame, keypoints, angles):
    """處理啞鈴划船運動的姿態檢測和評分"""
    global exercise_count, dumbbell_row_state, last_dumbbell_row_time, dumbbell_row_quality_score
    global detection_line_set_dumbbell_row, detection_line_y_dumbbell_row
    
    # 初始化上次啞鈴划船時間變數（如果不存在）
    if 'last_dumbbell_row_time' not in globals():
        last_dumbbell_row_time = 0
    
    # 檢查關鍵點是否足夠
    if keypoints is None or len(keypoints) < 17:
        logger.warning("啞鈴划船檢測關鍵點不足！")
        dumbbell_row_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')
        return
    
    # 提取關鍵點
    nose = keypoints[0][:2]
    left_shoulder = keypoints[5][:2]
    right_shoulder = keypoints[6][:2]
    left_elbow = keypoints[7][:2]
    right_elbow = keypoints[8][:2]
    left_wrist = keypoints[9][:2]
    right_wrist = keypoints[10][:2]
    left_hip = keypoints[11][:2]
    right_hip = keypoints[12][:2]
    
    # 檢查關鍵點有效性
    required_points = [left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist, left_hip, right_hip]
    if any(np.isnan(point).any() for point in required_points):
        dumbbell_row_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')
        return
    
    # 檢查左右手臂的有效性
    left_arm_valid = not (np.isnan(left_shoulder).any() or np.isnan(left_elbow).any() or np.isnan(left_wrist).any())
    right_arm_valid = not (np.isnan(right_shoulder).any() or np.isnan(right_elbow).any() or np.isnan(right_wrist).any())
    
    # 如果兩隻手臂都無效，直接返回
    if not left_arm_valid and not right_arm_valid:
        dumbbell_row_quality_score = 0
        socketio.emit('pose_quality', {'score': 0})
        socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')
        return
    
    # 計算肩部中點（在智能手臂選擇之前需要用到）
    shoulder_midpoint = ((left_shoulder[0] + right_shoulder[0]) / 2, (left_shoulder[1] + right_shoulder[1]) / 2)
    
    # 計算兩隻手臂的品質分數
    left_arm_data = {'score': 0}
    right_arm_data = {'score': 0}
    
    if left_arm_valid:
        left_arm_angle = angles.get('left_elbow', 180)
        left_arm_data['score'] = calculate_arm_quality_score(
            left_shoulder, left_elbow, left_wrist, left_arm_angle, 
            detection_line_y_dumbbell_row if detection_line_set_dumbbell_row else shoulder_midpoint[1] + 150, 
            "左"
        )
    
    if right_arm_valid:
        right_arm_angle = angles.get('right_elbow', 180)
        right_arm_data['score'] = calculate_arm_quality_score(
            right_shoulder, right_elbow, right_wrist, right_arm_angle,
            detection_line_y_dumbbell_row if detection_line_set_dumbbell_row else shoulder_midpoint[1] + 150,
            "右"
        )
    
    # 智能選擇品質更好的手臂
    selected_arm = select_best_arm(left_arm_data, right_arm_data)
    
    # 根據選擇的手臂設置相應變數
    if selected_arm == "left" and left_arm_valid:
        active_shoulder = left_shoulder
        active_elbow = left_elbow
        active_wrist = left_wrist
        active_arm_angle = angles.get('left_elbow', 180)
        active_side = "左手"
    elif selected_arm == "right" and right_arm_valid:
        active_shoulder = right_shoulder
        active_elbow = right_elbow
        active_wrist = right_wrist
        active_arm_angle = angles.get('right_elbow', 180)
        active_side = "右手"
    else:
        # 備用邏輯：如果智能選擇失敗，選擇任何有效的手臂
        if right_arm_valid:
            active_shoulder = right_shoulder
            active_elbow = right_elbow
            active_wrist = right_wrist
            active_arm_angle = angles.get('right_elbow', 180)
            active_side = "右手"
        elif left_arm_valid:
            active_shoulder = left_shoulder
            active_elbow = left_elbow
            active_wrist = left_wrist
            active_arm_angle = angles.get('left_elbow', 180)
            active_side = "左手"
        else:
            dumbbell_row_quality_score = 0
            socketio.emit('pose_quality', {'score': 0})
            socketio.emit('pose_quality', {'score': 0}, namespace='/exercise')
            return
    
    # 繪製骨架
    skeleton_connections = [
        (5, 7), (7, 9),    # 左肩-左肘-左手腕
        (6, 8), (8, 10),   # 右肩-右肘-右手腕
        (5, 6),            # 左肩-右肩
        (11, 12),          # 左髖-右髖
        (5, 11), (6, 12),  # 肩-髖
    ]
    
    for connection in skeleton_connections:
        pt1 = tuple(map(int, keypoints[connection[0]][:2]))
        pt2 = tuple(map(int, keypoints[connection[1]][:2]))
        if not (np.isnan(pt1).any() or np.isnan(pt2).any()):
            cv2.line(annotated_frame, pt1, pt2, (0, 255, 0), 2)
    
    # 繪製關鍵點
    for kp in keypoints:
        if not np.isnan(kp).any():
            cv2.circle(annotated_frame, tuple(map(int, kp[:2])), 5, (0, 0, 255), -1)
    
    # 計算髖部中點
    hip_midpoint = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
    
    # 設置檢測線（肩部水平線往下調整50像素）
    if not detection_line_set_dumbbell_row:
        detection_line_y_dumbbell_row = int(shoulder_midpoint[1] + 150)  # 往下調整150像素
        detection_line_set_dumbbell_row = True
        logger.info(f"啞鈴划船參考線已設置在 Y={detection_line_y_dumbbell_row}")
    
    # 繪製參考線
    cv2.line(annotated_frame, (0, detection_line_y_dumbbell_row),
             (annotated_frame.shape[1], detection_line_y_dumbbell_row), (255, 0, 0), 2)
    cv2.putText(annotated_frame, "Shoulder Line", (10, detection_line_y_dumbbell_row - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    
    # 計算活動手肘相對於肩部的位置（單手檢測）
    elbow_elevation = detection_line_y_dumbbell_row - active_elbow[1]  # 正值表示手肘在參考線上方
    
    # 使用活動手臂的角度
    arm_angle = active_arm_angle
    
    # 計算身體前傾角度（評估划船姿勢）
    body_vector = (hip_midpoint[0] - shoulder_midpoint[0], hip_midpoint[1] - shoulder_midpoint[1])
    vertical_vector = (0, 100)  # 垂直向量
    
    # 計算身體前傾角度
    dot_product = body_vector[0] * vertical_vector[0] + body_vector[1] * vertical_vector[1]
    body_magnitude = np.sqrt(body_vector[0]**2 + body_vector[1]**2)
    vertical_magnitude = np.sqrt(vertical_vector[0]**2 + vertical_vector[1]**2)
    
    if body_magnitude > 0 and vertical_magnitude > 0:
        cos_angle = dot_product / (body_magnitude * vertical_magnitude)
        cos_angle = np.clip(cos_angle, -1, 1)
        body_lean_angle = np.degrees(np.arccos(cos_angle))
    else:
        body_lean_angle = 0
    
    # 評分邏輯：手肘向後拉得越高分數越高（單手檢測）
    # 手肘高度評分（主要評分標準，權重更高）
    if elbow_elevation >= 15:  # 手肘明顯高於參考線
        elevation_score = 5
    elif elbow_elevation >= 5:   # 手肘稍高於參考線
        elevation_score = 4
    elif elbow_elevation >= -5:  # 手肘接近參考線
        elevation_score = 3
    elif elbow_elevation >= -15: # 手肘稍低於參考線
        elevation_score = 2
    else:  # 手肘明顯低於參考線
        elevation_score = 1
    
    # 手臂角度評分（划船時手臂應該彎曲）
    if 70 <= arm_angle <= 110:  # 理想的手臂彎曲角度
        arm_score = 5
    elif 60 <= arm_angle <= 120:  # 良好的手臂彎曲角度
        arm_score = 4
    elif 50 <= arm_angle <= 130:  # 中等的手臂彎曲角度
        arm_score = 3
    elif 40 <= arm_angle <= 140:  # 較差的手臂彎曲角度
        arm_score = 2
    else:  # 手臂角度不理想
        arm_score = 1
    
    # 身體姿勢評分（適度前傾）
    if 15 <= body_lean_angle <= 45:  # 理想的前傾角度
        posture_score = 5
    elif 10 <= body_lean_angle <= 50:  # 良好的前傾角度
        posture_score = 4
    elif 5 <= body_lean_angle <= 60:   # 中等的前傾角度
        posture_score = 3
    elif body_lean_angle <= 70:       # 較差的前傾角度
        posture_score = 2
    else:  # 姿勢不理想
        posture_score = 1
    
    # 綜合評分（手肘高度權重更高，因為這是啞鈴划船的關鍵動作）
    # 手肘高度佔60%，手臂角度佔25%，身體姿勢佔15%
    weighted_score = (elevation_score * 0.6) + (arm_score * 0.25) + (posture_score * 0.15)
    dumbbell_row_quality_score = int(round(weighted_score))
    dumbbell_row_quality_score = max(1, min(5, dumbbell_row_quality_score))
    
    # 發送姿態品質分數（每一幀都發送，參考深蹲的頻率）
    socketio.emit('pose_quality', {'score': dumbbell_row_quality_score})
    socketio.emit('pose_quality', {'score': dumbbell_row_quality_score}, namespace='/exercise')
    
    # 顯示調試信息
    cv2.putText(annotated_frame, f"{active_side} Elbow Elevation: {elbow_elevation:.1f}px", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"{active_side} Arm Angle: {arm_angle:.1f}°", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Body Lean: {body_lean_angle:.1f}°", (10, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(annotated_frame, f"Score: {dumbbell_row_quality_score}/5", (10, 120),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    
    # 顯示智能手臂選擇信息
    cv2.putText(annotated_frame, f"Smart Arm: {selected_arm.upper()}", (10, 150),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    cv2.putText(annotated_frame, f"L:{left_arm_data['score']}/5 R:{right_arm_data['score']}/5", (10, 180),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
    
    # 嘗試使用YOLO模型檢測啞鈴划船動作
    current_model = exercise_models.get("dumbbell-row")
    yolo_detected = False
    
    if current_model:
        try:
            dumbbell_row_results = current_model(frame, conf=0.3, verbose=False)
            if len(dumbbell_row_results) > 0 and len(dumbbell_row_results[0].boxes) > 0:
                yolo_detected = True
                best_box = dumbbell_row_results[0].boxes[0]
                class_id = int(best_box.cls)
                conf = float(best_box.conf)
                class_name = current_model.names[class_id]
                
                # 繪製YOLO檢測框
                x1, y1, x2, y2 = map(int, best_box.xyxy[0].cpu().numpy())
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f'{class_name} {conf:.2f}'
                cv2.putText(annotated_frame, label, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # YOLO模型計數邏輯（優先使用）
                global yolo_detected_this_cycle
                current_time = time.time()
                if dumbbell_row_state == "forward" and class_id == 1:  # 檢測到划船動作
                    dumbbell_row_state = "back"
                elif dumbbell_row_state == "back" and class_id == 0:  # 回到準備姿勢
                    if current_time - last_dumbbell_row_time > 1.5:  # 防止重複計數
                        exercise_count += 1
                        last_dumbbell_row_time = current_time
                        dumbbell_row_state = "forward"
                        yolo_detected_this_cycle = True  # 標記YOLO已檢測到動作
                        logger.info(f"啞鈴划船完成（YOLO檢測），計數: {exercise_count} (分數: {dumbbell_row_quality_score}/5)")
                        socketio.emit('exercise_count_update', {'count': exercise_count}, namespace='/exercise')
        except Exception as e:
            logger.warning(f"YOLO啞鈴划船檢測失敗: {e}")
            yolo_detected = False
    
    # 更新姿勢分數歷史
    update_pose_score_history(dumbbell_row_quality_score)
    
    # 使用混合計數系統（姿勢分數輔助計數）
    pose_score_assisted_counting()
    
    # 繪製關鍵點和連線（只繪製活動手臂）
    shoulder_point = tuple(map(int, shoulder_midpoint))
    hip_point = tuple(map(int, hip_midpoint))
    active_shoulder_point = tuple(map(int, active_shoulder))
    active_elbow_point = tuple(map(int, active_elbow))
    active_wrist_point = tuple(map(int, active_wrist))
    
    # 繪製身體中心點
    cv2.circle(annotated_frame, shoulder_point, 8, (255, 0, 255), -1)
    cv2.circle(annotated_frame, hip_point, 8, (255, 255, 0), -1)
    
    # 繪製活動手臂的關鍵點
    cv2.circle(annotated_frame, active_shoulder_point, 6, (0, 255, 255), -1)
    cv2.circle(annotated_frame, active_elbow_point, 8, (0, 255, 0), -1)  # 活動手肘用綠色突出
    cv2.circle(annotated_frame, active_wrist_point, 6, (0, 255, 255), -1)
    
    # 繪製活動手臂的連線
    cv2.line(annotated_frame, active_shoulder_point, active_elbow_point, (0, 255, 0), 3)
    cv2.line(annotated_frame, active_elbow_point, active_wrist_point, (0, 255, 0), 3)
    
    # 繪製身體姿勢線
    cv2.line(annotated_frame, shoulder_point, hip_point, (255, 255, 0), 3)
    
    # 標示活動手臂
    cv2.putText(annotated_frame, f"Active: {active_side}", (10, 210),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)


# 手臂擺動暖身運動的便捷函數
def reset_arm_swing_warmup():
    """重置手臂擺動暖身運動狀態"""
    arm_swing_warmup_service.reset_state()
    logger.info("手臂擺動暖身運動狀態已重置")

def get_arm_swing_warmup_count():
    """獲取手臂擺動暖身運動計數"""
    return arm_swing_warmup_service.get_exercise_count()

def get_arm_swing_warmup_quality():
    """獲取手臂擺動暖身運動品質分數"""
    return arm_swing_warmup_service.get_quality_score()

def set_arm_swing_warmup_active(active):
    """設置手臂擺動暖身運動檢測狀態"""
    arm_swing_warmup_service.set_detection_active(active)
    logger.info(f"手臂擺動暖身運動檢測狀態設置為: {active}")

def is_arm_swing_warmup_active():
    """檢查手臂擺動暖身運動檢測是否啟動"""
    return arm_swing_warmup_service.is_detection_active()


# 雙手輪流擺動熱身運動的便捷函數
def reset_alternating_arm_swing():
    """重置雙手輪流擺動熱身運動狀態"""
    alternating_arm_swing_service.reset_state()
    logger.info("雙手輪流擺動熱身運動狀態已重置")

def get_alternating_arm_swing_time():
    """獲取雙手輪流擺動熱身運動累積時間"""
    return alternating_arm_swing_service.accumulated_time

def get_alternating_arm_swing_quality():
    """獲取雙手輪流擺動熱身運動品質分數"""
    return alternating_arm_swing_service.quality_score

def set_alternating_arm_swing_active(active):
    """設置雙手輪流擺動熱身運動檢測狀態"""
    if active:
        alternating_arm_swing_service.start_detection()
    else:
        alternating_arm_swing_service.stop_detection()
    logger.info(f"雙手輪流擺動熱身運動檢測狀態設置為: {active}")

def is_alternating_arm_swing_active():
    """檢查雙手輪流擺動熱身運動檢測是否啟動"""
    return alternating_arm_swing_service.detection_active

def set_alternating_arm_swing_target_time(target_time):
    """設置雙手輪流擺動熱身運動目標時間"""
    alternating_arm_swing_service.set_target_time(target_time)
    logger.info(f"雙手輪流擺動熱身運動目標時間設置為: {target_time}秒")

def process_alternating_arm_swing(frame, annotated_frame, keypoints, angles):
    """處理雙手輪流擺動熱身運動的便捷函數"""
    return alternating_arm_swing_service.process_exercise(frame, annotated_frame, keypoints, angles)


# 平板支撐運動的便捷函數
def reset_plank():
    """重置平板支撐運動狀態"""
    plank_service.reset_state()
    logger.info("平板支撐運動狀態已重置")

def get_plank_time():
    """獲取平板支撐運動累積時間"""
    return plank_service.accumulated_time

def get_plank_quality():
    """獲取平板支撐運動品質分數"""
    return plank_service.quality_score

def set_plank_active(active):
    """設置平板支撐運動檢測狀態"""
    if active:
        plank_service.start_detection()
    else:
        plank_service.stop_detection()
    logger.info(f"平板支撐運動檢測狀態設置為: {active}")

def is_plank_active():
    """檢查平板支撐運動檢測是否啟動"""
    return plank_service.detection_active

def set_plank_target_time(target_time):
    """設置平板支撐運動目標時間"""
    plank_service.set_target_time(target_time)
    logger.info(f"平板支撐運動目標時間設置為: {target_time}秒")

def set_plank_description(description):
    """設置平板支撐運動描述"""
    plank_service.set_description(description)
    logger.info(f"平板支撐運動描述設置為: {description}")

def process_plank(frame, annotated_frame, keypoints, angles):
    """處理平板支撐運動的便捷函數"""
    return plank_service.process_exercise(frame, annotated_frame, keypoints, angles)