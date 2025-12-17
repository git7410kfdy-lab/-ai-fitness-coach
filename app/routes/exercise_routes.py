from flask import Blueprint, render_template, request, jsonify, Response, send_file
from flask_socketio import emit
import cv2
import logging
import time
import threading
from app import socketio
from app.services import exercise_service
from app.services.camera_service import get_camera, get_current_frame, release_camera
import base64
from datetime import datetime
import queue
from app.services.db_service import get_db_connection

from flask import send_file # 需要導入 send_file
import os
from PIL import Image # 需要安裝 Pillow: pip install Pillow
import io


from app.services.table_tennis_service import TableTennisService
from app.services.basketball_service import BasketballService
from app.services.basketball_dribble_service import BasketballDribbleService
from app.services.volleyball_service import VolleyballService
from app.services.taekwondo_service import get_taekwondo_service
import uuid


# 初始化桌球揮拍相關的全域變數
# table_tennis_active: 用於追蹤桌球揮拍檢測是否啟用
# table_tennis_session_id: 用於識別當前桌球揮拍檢測會話
table_tennis_active = False
table_tennis_session_id = None

# 初始化籃球投籃相關的全域變數
# basketball_active: 用於追蹤籃球投籃檢測是否啟用
# basketball_session_id: 用於識別當前籃球投籃檢測會話
basketball_active = False
basketball_session_id = None

# 在全局變量部分添加
# 初始化籃球運球相關的全域變數
basketball_dribble_active = False
basketball_dribble_session_id = None

# 初始化排球相關的全域變數
# volleyball_overhand_active: 用於追蹤排球高手托球檢測是否啟用
# volleyball_overhand_session_id: 用於識別當前排球高手托球檢測會話
volleyball_overhand_active = False
volleyball_overhand_session_id = None

# volleyball_lowhand_active: 用於追蹤排球低手接球檢測是否啟用
# volleyball_lowhand_session_id: 用於識別當前排球低手接球檢測會話
volleyball_lowhand_active = False
volleyball_lowhand_session_id = None

# 初始化雙手輪流擺動熱身運動相關的全域變數
# alternating_arm_swing_active: 用於追蹤雙手輪流擺動熱身運動檢測是否啟用
# alternating_arm_swing_session_id: 用於識別當前雙手輪流擺動熱身運動檢測會話
alternating_arm_swing_active = False
alternating_arm_swing_session_id = None

# 初始化平板支撐相關的全域變數
# plank_active: 用於追蹤平板支撐檢測是否啟用
# plank_session_id: 用於識別當前平板支撐檢測會話
plank_active = False
plank_session_id = None

# 初始化跆拳道詳細檢測相關的全域變數
# taekwondo_detail_active: 用於追蹤跆拳道詳細檢測是否啟用
# taekwondo_detail_session_id: 用於識別當前跆拳道詳細檢測會話
taekwondo_detail_active = False
taekwondo_detail_session_id = None

# 檢查並初始化運動模型
# 如果運動服務尚未載入模型，則進行初始化
if not hasattr(exercise_service, 'exercise_models') or exercise_service.exercise_models is None:
    exercise_service.init_models()

# 創建運動藍圖，設定URL前綴為/exercise
exercise_bp = Blueprint('exercise', __name__, url_prefix='/exercise')
# 初始化日誌記錄器
logger = logging.getLogger(__name__)

# 創建影像緩衝區，用於存儲原始和處理後的影像幀
# 減少緩衝區大小以降低記憶體使用
frame_buffer = queue.Queue(maxsize=1)
processed_frame_buffer = queue.Queue(maxsize=1)

# 初始化影像處理相關的全域變數
processing_active = False   # 追蹤影像處理狀態
processing_thread = None    # 儲存影像處理執行緒
detection_active = False    #  追蹤姿態檢測狀態

# 優化相關的全局變量
thread_reuse_enabled = True  # 啟用線程重用
thread_pool = {}  # 線程池
thread_lock = threading.Lock()  # 線程鎖
video_capture_thread = None  # 影像擷取線程
frame_processing_thread = None  # 幀處理線程

@exercise_bp.route('/video_feed')
def video_feed():
    """影像串流路由 - 提供即時影像串流"""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@exercise_bp.route('/realtime')
def realtime():
    """即時檢測頁面 - 渲染即時檢測的網頁"""
    return render_template('realtime.html')

@exercise_bp.route('/taekwondo_detail')
def taekwondo_detail():
    """跆拳道詳細姿態偵測頁面 - 渲染跆拳道詳細分析的網頁"""
    return render_template('taekwondo_detail.html')

def get_or_create_thread(thread_name, target_function, *args, **kwargs):
    """獲取或創建線程 - 優化版本"""
    global thread_pool, thread_lock
    
    with thread_lock:
        # 檢查線程池中是否有可重用的線程
        if thread_name in thread_pool:
            thread = thread_pool[thread_name]
            if thread and thread.is_alive():
                logger.debug(f"重用現有線程: {thread_name}")
                return thread
            else:
                # 清理已死亡的線程
                del thread_pool[thread_name]
        
        # 創建新線程
        thread = threading.Thread(target=target_function, args=args, kwargs=kwargs, daemon=True)
        thread_pool[thread_name] = thread
        logger.info(f"創建新線程: {thread_name}")
        return thread

def cleanup_thread(thread_name):
    """清理指定線程"""
    global thread_pool, thread_lock
    
    with thread_lock:
        if thread_name in thread_pool:
            thread = thread_pool[thread_name]
            if thread and thread.is_alive():
                # 線程仍在運行，不清理
                return False
            del thread_pool[thread_name]
            logger.info(f"已清理線程: {thread_name}")
            return True
    return False

def generate_frames():
    """生成影像幀 - 從舊版app.py移植
    
    持續從已處理的影像緩衝區獲取影像幀並生成串流
    """
    while True:
        if not processed_frame_buffer.empty():
            # 從處理後的幀緩衝區獲取幀
            frame = processed_frame_buffer.get()
            if frame is not None:
                # 編碼並發送幀
                _, buffer = cv2.imencode('.jpg', frame)
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            # 如果緩衝區為空，短暫等待
            time.sleep(0.01)  # 短暫等待，避免CPU過載

def get_default_camera_index():
    """獲取默認攝像頭索引"""
    # 默認使用索引0，用戶可以通過前端手動指定其他索引
    default_index = 0
    logger.info(f"使用默認攝像頭索引: {default_index}")
    return default_index

def video_capture_thread(camera_index=6):
    """影像擷取執行緒 - 從舊版app.py移植
    
    Args:
        camera_index (int, optional): 攝影機索引值，如果為None則使用默認索引
    """
    global frame_buffer, detection_active
    
    # 如果沒有指定攝影機索引，則使用默認索引
    if camera_index is None:
        camera_index = get_default_camera_index()
    
    logger.info(f"開始影像擷取執行緒，使用攝影機索引 {camera_index}")
    
    # 嘗試開啟指定的攝影機索引
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        logger.error(f"無法開啟攝影機索引 {camera_index}，請檢查攝影機是否連接正常或嘗試其他索引")
        return
    
    logger.info(f"成功開啟攝影機索引 {camera_index}")
    
    # 設定攝影機參數為720p
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    # 設定緩衝區大小以減少延遲
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    logger.info("攝影機初始化成功")
    
    while detection_active:
        ret, frame = cap.read()
        if not ret:
            logger.warning("無法讀取影像幀")
            time.sleep(0.1)
            continue
        
        # 調整幀大小為720p正方形
        frame = cv2.resize(frame, (720, 720))
        
        # 優化幀緩衝區處理 - 直接替換而不是檢查
        try:
            frame_buffer.get_nowait()  # 移除舊幀
        except queue.Empty:
            pass
        frame_buffer.put(frame)  # 放入新幀
        
        time.sleep(0.03)  # 針對720p處理進一步降低幀率以減少CPU使用
    
    # 釋放攝影機
    cap.release()
    logger.info("影像擷取執行緒已停止")


def frame_processing_thread(exercise_type='squat'):                                # 影像幀處理執行緒函數，預設運動類型為深蹲
    """影像幀處理執行緒
    
    此函數負責處理從攝影機捕獲的影像幀，並根據不同的運動類型進行相應的處理。
    
    Args:
        exercise_type (str): 運動類型，預設為'squat'（深蹲）
                           可選值包括：'table-tennis'（桌球）, 'basketball'（籃球）等
    """
    global frame_buffer, processed_frame_buffer, detection_active, table_tennis_active, table_tennis_session_id
    global basketball_active, basketball_session_id
    global basketball_dribble_active, basketball_dribble_session_id  # 添加籃球運球全局變量
    global volleyball_overhand_active, volleyball_overhand_session_id  # 添加排球高手托球全局變量
    global volleyball_lowhand_active, volleyball_lowhand_session_id  # 添加排球低手接球全局變量
    global alternating_arm_swing_active, alternating_arm_swing_session_id  # 添加雙手輪流擺動熱身運動全局變量
    global plank_active, plank_session_id  # 添加平板支撐全局變量
    global taekwondo_detail_active, taekwondo_detail_session_id  # 添加跆拳道詳細檢測全局變量
    
    logger.info(f"開始影像幀處理執行緒，運動類型: {exercise_type}")                  # 記錄執行緒啟動日誌
    
    frame_count = 0                                                               # 初始化幀計數器
    log_interval = 100                                                           # 設定日誌記錄間隔為100幀
    
    table_tennis_service = None                                                  # 初始化桌球服務實例
    table_tennis_detector = None                                                 # 初始化桌球動作檢測器
    
    basketball_service = None                                                    # 初始化籃球服務實例
    basketball_detector = None                                                   # 初始化籃球動作檢測器

    basketball_dribble_service = None  # 初始化籃球運球服務
    basketball_dribble_detector = None  # 初始化籃球運球檢測器
    
    volleyball_service = None  # 初始化排球服務
    volleyball_detector = None  # 初始化排球檢測器
    
    if exercise_type == 'table-tennis':
        # 現有桌球邏輯...
        table_tennis_active = True
        table_tennis_service = TableTennisService.get_instance()
        if table_tennis_session_id is None:
            table_tennis_session_id = str(uuid.uuid4())
    elif exercise_type == 'basketball':
        # 現有籃球投籃邏輯...
        basketball_active = True
        basketball_service = BasketballService.get_instance()
        if basketball_session_id is None:
            basketball_session_id = str(uuid.uuid4())
    elif exercise_type == 'basketball-dribble':  # 新增籃球運球類型
        basketball_dribble_active = True
        basketball_dribble_service = BasketballDribbleService.get_instance()
        if basketball_dribble_session_id is None:
            basketball_dribble_session_id = str(uuid.uuid4())
    elif exercise_type == 'volleyball-overhand':  # 新增排球高手托球類型
        volleyball_overhand_active = True
        volleyball_service = VolleyballService.get_instance()
        if volleyball_overhand_session_id is None:
            volleyball_overhand_session_id = str(uuid.uuid4())
    elif exercise_type == 'volleyball-lowhand':  # 新增排球低手接球類型
        volleyball_lowhand_active = True
        volleyball_service = VolleyballService.get_instance()
        if volleyball_lowhand_session_id is None:
            volleyball_lowhand_session_id = str(uuid.uuid4())
    elif exercise_type == 'alternating-arm-swing':  # 新增雙手輪流擺動熱身運動類型
        alternating_arm_swing_active = True
        if alternating_arm_swing_session_id is None:
            alternating_arm_swing_session_id = str(uuid.uuid4())
    elif exercise_type == 'plank':  # 新增平板支撐類型
        plank_active = True
        if plank_session_id is None:
            plank_session_id = str(uuid.uuid4())
    elif exercise_type == 'taekwondo-detail':  # 新增跆拳道詳細檢測類型
        taekwondo_detail_active = True
        if taekwondo_detail_session_id is None:
            taekwondo_detail_session_id = str(uuid.uuid4())
    
    while detection_active:
        if not frame_buffer.empty():
            try:
                # 從原始幀緩衝區獲取幀
                frame = frame_buffer.get()
                
                # 根據運動類型處理幀
                if exercise_type == 'table-tennis' and table_tennis_active:
                    # 桌球揮拍模式
                    if table_tennis_detector is None and table_tennis_service is not None:
                        # 初始化檢測器
                        height, width = frame.shape[:2]
                        table_tennis_detector = table_tennis_service.get_detector(table_tennis_session_id, width, height)
                    
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用桌球偵測器處理畫面
                    if table_tennis_detector:
                        processed_frame = table_tennis_detector.detect_and_display_landmarks(frame)
                        
                        # 獲取當前揮拍次數
                        current_count = table_tennis_detector.stroke_count
                        
                        # 發送揮拍次數到前端
                        if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                            socketio.emit('exercise_count', {'count': current_count}, namespace='/exercise')
                    else:
                        processed_frame = frame

                elif exercise_type == 'basketball' and basketball_active:
                    # 籃球投籃模式
                    if basketball_detector is None and basketball_service is not None:
                        # 初始化檢測器
                        height, width = frame.shape[:2]
                        basketball_detector = basketball_service.get_detector(basketball_session_id, width, height)
                    
                    # 使用籃球偵測器處理畫面
                    if basketball_detector:
                        processed_frame = basketball_detector.detect_and_display_landmarks(frame)
                        
                        # 獲取當前投籃次數
                        current_count = basketball_detector.shooting_count
                        
                        # 發送投籃次數到前端
                        if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                            socketio.emit('exercise_count', {'count': current_count}, namespace='/exercise')
                    else:
                        processed_frame = frame

                elif exercise_type == 'basketball-dribble' and basketball_dribble_active:
                    # 籃球運球模式
                    if basketball_dribble_detector is None and basketball_dribble_service is not None:
                        # 初始化檢測器
                        height, width = frame.shape[:2]
                        basketball_dribble_detector = basketball_dribble_service.get_detector(basketball_dribble_session_id, width, height)
                    
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用籃球運球偵測器處理畫面
                    if basketball_dribble_detector:
                        # 使用YOLO-Pose模型進行姿態檢測
                        results = basketball_dribble_detector.pose_model(frame, conf=0.3, verbose=False)
                        
                        # 如果檢測到人體姿態
                        if len(results) > 0 and hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
                            try:
                                # 獲取第一個檢測到的人的關鍵點
                                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                                
                                # 如果已確定慣用手，處理運球動作
                                if basketball_dribble_detector.dominant_hand:
                                    processed_frame = basketball_dribble_detector.process_frame(frame, keypoints, time.time())
                                else:
                                    # 否則檢測慣用手
                                    processed_frame = basketball_dribble_detector.detect_dominant_hand(frame)
                                    
                                # 發送當前模式到前端
                                if frame_count % 30 == 0:  # 每30幀發送一次
                                    socketio.emit('dribble_mode', {'mode': basketball_dribble_detector.current_mode}, namespace='/exercise')
                            except Exception as e:
                                processed_frame = frame
                                logger.error(f"處理關鍵點時出錯: {e}")
                                cv2.putText(processed_frame, f"Error: {str(e)}", (10, 30), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                        else:
                            processed_frame = frame
                            cv2.putText(processed_frame, "未檢測到姿態", (10, 30), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    else:
                        processed_frame = frame

                elif exercise_type == 'volleyball-overhand' and volleyball_overhand_active:
                    # 排球高手托球模式
                    if volleyball_detector is None and volleyball_service is not None:
                        # 初始化檢測器
                        height, width = frame.shape[:2]
                        volleyball_detector = volleyball_service.get_detector(volleyball_overhand_session_id, width, height, 'overhand')
                    
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用排球檢測器處理畫面
                    if volleyball_detector:
                        processed_frame = volleyball_detector.detect_and_display_landmarks(frame)
                        
                        # 獲取當前托球次數
                        current_count = volleyball_detector.stroke_count
                        
                        # 發送托球次數到前端
                        if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                            socketio.emit('exercise_count', {'count': current_count}, namespace='/exercise')
                    else:
                        processed_frame = frame

                elif exercise_type == 'volleyball-lowhand' and volleyball_lowhand_active:
                    # 排球低手接球模式
                    if volleyball_detector is None and volleyball_service is not None:
                        # 初始化檢測器
                        height, width = frame.shape[:2]
                        volleyball_detector = volleyball_service.get_detector(volleyball_lowhand_session_id, width, height, 'lowhand')
                    
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用排球檢測器處理畫面
                    if volleyball_detector:
                        processed_frame = volleyball_detector.detect_and_display_landmarks(frame)
                        
                        # 獲取當前成功次數
                        current_count = volleyball_detector.success_count
                        
                        # 發送成功次數到前端
                        if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                            socketio.emit('exercise_count', {'count': current_count}, namespace='/exercise')
                        
                        # 發送當前維持時間到前端
                        if frame_count % 30 == 0:  # 每30幀發送一次
                            current_time = volleyball_detector.total_correct_time
                            target_time = volleyball_detector.target_time
                            socketio.emit('lowhand_progress', {
                                'current_time': current_time,
                                'target_time': target_time,
                                'is_correct': volleyball_detector.is_posture_correct
                            }, namespace='/exercise')
                    else:
                        processed_frame = frame

                elif exercise_type == 'alternating-arm-swing' and alternating_arm_swing_active:
                    # 雙手輪流擺動熱身運動模式
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用原有的處理邏輯
                    processed_frame = exercise_service.process_frame_realtime(frame, exercise_type)
                    
                    # 發送累積時間到前端
                    if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                        current_time = exercise_service.get_alternating_arm_swing_time()
                        socketio.emit('alternating_arm_swing_time', {'time': current_time}, namespace='/exercise')

                elif exercise_type == 'plank' and plank_active:
                    # 平板支撐模式
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用平板支撐處理邏輯
                    processed_frame = exercise_service.process_frame_realtime(frame, exercise_type)
                    
                    # 發送累積時間和品質分數到前端
                    if frame_count % 10 == 0:  # 每10幀發送一次，減少網絡負載
                        current_time = exercise_service.get_plank_time()
                        quality_score = exercise_service.get_plank_quality()
                        socketio.emit('plank_time', {'time': current_time}, namespace='/exercise')
                        socketio.emit('pose_quality', {'score': quality_score}, namespace='/exercise')

                elif exercise_type == 'taekwondo-detail' and taekwondo_detail_active:
                    # 跆拳道詳細檢測模式
                    # 水平翻轉畫面，使其更直觀
                    frame = cv2.flip(frame, 1)
                    
                    # 使用跆拳道檢測服務處理畫面
                    taekwondo_service = get_taekwondo_service()
                    result = taekwondo_service.process_frame(frame)
                    
                    if result['success']:
                        processed_frame = result['frame']
                        
                        # 發送角度數據到前端
                        if frame_count % 5 == 0:  # 每5幀發送一次，提高響應性
                            angles = result['angles']
                            socketio.emit('taekwondo_angles', {
                                'left_elbow': round(angles.get('左手肘', 0), 1),
                                'right_elbow': round(angles.get('右手肘', 0), 1),
                                'left_knee': round(angles.get('左膝蓋', 0), 1),
                                'right_knee': round(angles.get('右膝蓋', 0), 1),
                                'left_shoulder': round(angles.get('左肩膀', 0), 1),
                                'right_shoulder': round(angles.get('右肩膀', 0), 1),
                                'left_hip': round(angles.get('左髖部', 0), 1),
                                'right_hip': round(angles.get('右髖部', 0), 1)
                            }, namespace='/exercise')
                            
                            # 發送角速度數據到前端
                            velocities = result['velocities']
                            socketio.emit('taekwondo_velocities', {
                                'left_elbow': round(velocities.get('左手肘', 0), 1),
                                'right_elbow': round(velocities.get('右手肘', 0), 1),
                                'left_knee': round(velocities.get('左膝蓋', 0), 1),
                                'right_knee': round(velocities.get('右膝蓋', 0), 1),
                                'left_shoulder': round(velocities.get('左肩膀', 0), 1),
                                'right_shoulder': round(velocities.get('右肩膀', 0), 1),
                                'left_hip': round(velocities.get('左髖部', 0), 1),
                                'right_hip': round(velocities.get('右髖部', 0), 1)
                            }, namespace='/exercise')
                            
                            # 發送角加速度數據到前端
                            accelerations = result['accelerations']
                            socketio.emit('taekwondo_accelerations', {
                                'left_elbow': round(accelerations.get('左手肘', 0), 1),
                                'right_elbow': round(accelerations.get('右手肘', 0), 1),
                                'left_knee': round(accelerations.get('左膝蓋', 0), 1),
                                'right_knee': round(accelerations.get('右膝蓋', 0), 1),
                                'left_shoulder': round(accelerations.get('左肩膀', 0), 1),
                                'right_shoulder': round(accelerations.get('右肩膀', 0), 1),
                                'left_hip': round(accelerations.get('左髖部', 0), 1),
                                'right_hip': round(accelerations.get('右髖部', 0), 1)
                            }, namespace='/exercise')
                            
                            # 發送動作識別結果到前端
                            socketio.emit('taekwondo_action', {
                                'action': result['action'],
                                'confidence': round(result['confidence'] * 100, 1),
                                'count': result['count']
                            }, namespace='/exercise')
                    else:
                        processed_frame = result['frame']
                        # 在畫面上顯示錯誤信息
                        cv2.putText(processed_frame, result.get('message', '檢測失敗'), 
                                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

                else:
                    # 其他運動模式，使用原有的處理邏輯
                    processed_frame = exercise_service.process_frame_realtime(frame, exercise_type)
                
                # 優化幀緩衝區處理
                try:
                    processed_frame_buffer.get_nowait()  # 移除舊幀
                except queue.Empty:
                    pass
                processed_frame_buffer.put(processed_frame)
                
                # 針對720p影像優化編碼參數
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 25,  # 進一步降低品質以處理720p
                               int(cv2.IMWRITE_JPEG_OPTIMIZE), 1]   # 啟用JPEG優化
                _, buffer = cv2.imencode('.jpg', processed_frame, encode_param)
                frame_data = buffer.tobytes()
                
                # 移除不必要的雜湊計算
                frame_base64 = base64.b64encode(frame_data).decode('utf-8')
                
                # 減少日誌輸出頻率，只在每1000幀記錄一次
                if frame_count % 1000 == 0:
                    logger.debug(f"已處理 {frame_count} 幀")
                
                socketio.emit('video_frame', {'frame': frame_base64}, namespace='/exercise')
                
                frame_count += 1
                
                # 針對720p處理添加幀率控制
                time.sleep(0.02)
                
                # 處理運動計數（非桌球揮拍模式）
                if exercise_type != 'table-tennis':
                    try:
                        count = exercise_service.get_current_count()
                        if count > 0:
                            # 減少運動計數日誌輸出頻率
                            if frame_count % 500 == 0:
                                logger.info(f"運動計數: {count}")
                            socketio.emit('exercise_count', {'count': count}, namespace='/exercise')
                    except Exception as e:
                        # 減少錯誤日誌輸出頻率
                        if frame_count % 500 == 0:
                            logger.error(f"獲取運動計數錯誤: {e}")
            except Exception as e:
                logger.error(f"處理幀時出錯: {e}")
                time.sleep(0.1)
    
    # 清理資源
    if exercise_type == 'table-tennis' and table_tennis_service and table_tennis_session_id:
        table_tennis_service.remove_detector(table_tennis_session_id)
        table_tennis_active = False
    
    if exercise_type == 'basketball' and basketball_service and basketball_session_id:
        basketball_service.remove_detector(basketball_session_id)
        basketball_active = False
    
    if exercise_type == 'basketball-dribble' and basketball_dribble_service and basketball_dribble_session_id:
        basketball_dribble_service.remove_detector(basketball_dribble_session_id)
        basketball_dribble_active = False
    
    if exercise_type == 'volleyball-overhand' and volleyball_service and volleyball_overhand_session_id:
        volleyball_service.remove_detector(volleyball_overhand_session_id)
        volleyball_overhand_active = False
    
    if exercise_type == 'volleyball-lowhand' and volleyball_service and volleyball_lowhand_session_id:
        volleyball_service.remove_detector(volleyball_lowhand_session_id)
        volleyball_lowhand_active = False
    
    if exercise_type == 'alternating-arm-swing' and alternating_arm_swing_session_id:
        alternating_arm_swing_active = False
        exercise_service.set_alternating_arm_swing_active(False)
    
    logger.info("幀處理執行緒已停止")



@exercise_bp.route('/api/exercise/record_plan', methods=['POST'])
def record_workout_plan():
    import traceback
    data = request.get_json()
    print('收到資料:', data)
    student_id = data.get('student_id')
    plan = data.get('plan', [])
    if not student_id or not plan:
        return jsonify({'success': False, 'message': '缺少學號或計劃資料'}), 400
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        for exercise in plan:
            cursor.execute(
                """
                INSERT INTO exercise_info (student_id, exercise_type, weight, reps, sets, timestamp, total_count, game_level)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    student_id,
                    exercise.get('type', 'squat'),
                    exercise.get('weight', 0),
                    exercise.get('reps', 10),
                    exercise.get('sets', 1),
                    now,
                    exercise.get('reps', 10),
                    exercise.get('game_level', 1)
                )
            )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': '訓練計劃已記錄'})
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': str(e)}), 500



@socketio.on('start_detection', namespace='/exercise')
def handle_start_detection(data):
    """處理開始檢測請求"""
    global detection_active, table_tennis_active, table_tennis_session_id
    global basketball_active, basketball_session_id
    global basketball_dribble_active, basketball_dribble_session_id
    global taekwondo_detail_active, taekwondo_detail_session_id
    
    try:
        logger.info(f'收到開始檢測請求: {data}')
        
        # 獲取運動類型和其他參數
        exercise_type = data.get('exercise_type', 'squat')
        detection_line = data.get('detection_line', 0.5)
        camera_index = data.get('camera_index', None)  # 新增攝像頭索引參數
        description = data.get('description', '')  # 新增運動描述參數
        
        # 獲取訓練計劃參數
        weight = data.get('weight', 0)
        reps = data.get('reps', 10)
        sets = data.get('sets', 1)
        student_id = data.get('student_id')
        save_to_db = data.get('save_to_db', False)
        
        # 確保參數為整數類型
        try:
            weight = int(weight) if weight is not None else 0
            reps = int(reps) if reps is not None else 10
            sets = int(sets) if sets is not None else 1
        except (ValueError, TypeError):
            logger.warning(f"參數轉換失敗，使用默認值: weight={weight}, reps={reps}, sets={sets}")
            weight = 0
            reps = 10
            sets = 1
        
        logger.info(f'處理運動參數 - 學號: {student_id}, 運動類型: {exercise_type}, 重量: {weight}, 次數: {reps}, 組數: {sets}, 攝像頭索引: {camera_index}')
        
        # 記錄訓練計劃到資料庫
        if student_id and save_to_db:
            try:
                connection = get_db_connection()
                if connection:
                    cursor = connection.cursor()
                    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    
                    # 插入訓練計劃記錄
                    insert_query = """
                        INSERT INTO exercise_info (student_id, exercise_type, weight, reps, sets, timestamp, total_count, game_level)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    
                    cursor.execute(insert_query, (
                        student_id, 
                        exercise_type, 
                        weight, 
                        reps, 
                        sets, 
                        timestamp, 
                        0,  # total_count 初始為0
                        data.get('level', 1)  # game_level
                    ))
                    
                    connection.commit()
                    record_id = cursor.lastrowid
                    
                    cursor.close()
                    connection.close()
                    
                    logger.info(f'成功記錄訓練計劃到資料庫，記錄ID: {record_id}')
                    
                    # 發送成功通知到前端
                    emit('workout_plan_saved', {
                        'status': 'success',
                        'record_id': record_id,
                        'message': '訓練計劃已保存到資料庫'
                    })
                else:
                    logger.error('無法獲取資料庫連接')
                    emit('workout_plan_saved', {
                        'status': 'error',
                        'message': '資料庫連接失敗'
                    })
                    
            except Exception as db_error:
                logger.error(f'記錄訓練計劃到資料庫時出錯: {db_error}', exc_info=True)
                emit('workout_plan_saved', {
                    'status': 'error',
                    'message': f'保存失敗: {str(db_error)}'
                })
        elif not student_id:
            logger.warning('未提供學號，跳過資料庫記錄')
        elif not save_to_db:
            logger.info('未要求保存到資料庫，跳過資料庫記錄')
        
        # 重置計數和狀態
        if exercise_type == 'table-tennis':
            # 桌球揮拍模式，重置桌球相關狀態
            table_tennis_active = True
            table_tennis_session_id = str(uuid.uuid4())
            # 發送初始數據到前端
            emit('exercise_count', {'count': 0})
        elif exercise_type == 'basketball':
            # 籃球投籃模式，重置籃球相關狀態
            basketball_active = True
            basketball_session_id = str(uuid.uuid4())
            # 發送初始數據到前端
            emit('exercise_count', {'count': 0})
        elif exercise_type == 'basketball-dribble':
            # 籃球運球模式，重置籃球運球相關狀態
            basketball_dribble_active = True
            basketball_dribble_session_id = str(uuid.uuid4())
            # 發送初始數據到前端
            emit('exercise_count', {'count': 0})
            emit('dribble_mode', {'mode': 'high'})  # 初始模式
        elif exercise_type == 'alternating-arm-swing':
            # 雙手輪流擺動熱身運動模式，基於時間而非次數
            alternating_arm_swing_active = True
            alternating_arm_swing_session_id = str(uuid.uuid4())
            
            # 獲取目標時間參數（從前端發送的時間參數）
            target_time = data.get('time', 30)  # 默認30秒
            try:
                target_time = float(target_time) if target_time is not None else 30.0
            except (ValueError, TypeError):
                logger.warning(f"目標時間轉換失敗，使用默認值: {target_time}")
                target_time = 30.0
            
            # 重置運動狀態並設置目標時間
            exercise_service.reset_alternating_arm_swing()
            exercise_service.set_alternating_arm_swing_target_time(target_time)
            exercise_service.set_alternating_arm_swing_active(True)
            
            logger.info(f'雙手輪流擺動熱身運動已啟動，目標時間: {target_time}秒')
            
            # 發送初始數據到前端
            emit('alternating_arm_swing_time', {'time': 0.0})
            emit('alternating_arm_swing_target', {'target_time': target_time})
        elif exercise_type == 'plank':
            # 平板支撐模式，基於時間而非次數
            plank_active = True
            plank_session_id = str(uuid.uuid4())
            
            # 獲取目標時間參數（從前端發送的時間參數）
            target_time = data.get('target_time', 30)  # 默認30秒
            try:
                target_time = float(target_time) if target_time is not None else 30.0
            except (ValueError, TypeError):
                logger.warning(f"目標時間轉換失敗，使用默認值: {target_time}")
                target_time = 30.0
            
            # 重置運動狀態並設置目標時間和描述
            exercise_service.reset_plank()
            exercise_service.set_plank_target_time(target_time)
            exercise_service.set_plank_description(description)  # 設置運動描述
            exercise_service.set_plank_active(True)
            
            logger.info(f'平板支撐已啟動，目標時間: {target_time}秒，描述: {description}')
            
            # 發送初始數據到前端
            emit('plank_time', {'time': 0.0})
            emit('plank_target', {'target_time': target_time})
            emit('pose_quality', {'score': 1})  # 初始分數為1分
        elif exercise_type == 'taekwondo-detail':
            # 跆拳道詳細檢測模式
            taekwondo_detail_active = True
            taekwondo_detail_session_id = str(uuid.uuid4())
            
            # 重置跆拳道檢測狀態
            taekwondo_service = get_taekwondo_service()
            taekwondo_service.reset()
            
            # 檢查是否需要自動開始錄製
            auto_start_recording = data.get('auto_start_recording', False)
            if auto_start_recording:
                recording_success = taekwondo_service.start_recording()
                if recording_success:
                    emit('recording_started', {'status': 'success'})
                    logger.info('跆拳道詳細檢測已啟動，自動開始錄製')
                else:
                    emit('recording_started', {'status': 'error', 'message': '自動開始錄製失敗'})
                    logger.error('自動開始錄製失敗')
            else:
                logger.info('跆拳道詳細檢測已啟動')
            
            # 發送初始數據到前端
            emit('taekwondo_angles', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0,
                'left_shoulder': 0, 'right_shoulder': 0, 'left_hip': 0, 'right_hip': 0
            })
            emit('taekwondo_velocities', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0,
                'left_shoulder': 0, 'right_shoulder': 0, 'left_hip': 0, 'right_hip': 0
            })
            emit('taekwondo_accelerations', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0,
                'left_shoulder': 0, 'right_shoulder': 0, 'left_hip': 0, 'right_hip': 0
            })
            emit('taekwondo_action', {'action': '待檢測', 'confidence': 0, 'count': 0})
        else:
            # 其他運動模式，使用原有的重置邏輯
            exercise_service.reset_detection_state_complete()
            exercise_service.set_current_exercise_type(exercise_type)
            
            # 設置運動參數
            exercise_service.set_exercise_params(reps, sets)
            
            # 設置檢測線
            exercise_service.set_detection_line(detection_line)
            
            # 確保 exercise_service 中的 detection_active 也被設置
            exercise_service.detection_active = True
            
            # 發送初始數據到前端
            emit('exercise_count', {'count': 0})
            
            # 發送剩餘組數
            emit('remaining_sets_update', {'sets': sets})
            
            # 發送初始品質評分
            emit('pose_quality', {'score': 0})
            
            # 發送初始角度數據
            initial_angles = {
                '左手肘': 0, '右手肘': 0, '左膝蓋': 0, '右膝蓋': 0,
                '左肩膀': 0, '右肩膀': 0, '左髖部': 0, '右髖部': 0
            }
            emit('angle_data', {'angles': initial_angles})
        
        # 發送初始教練提示
        emit('coach_tip', {'tip': f'已開始{exercise_type}運動檢測，請保持正確姿勢'})
        
        # 啟動檢測執行緒
        if not detection_active:
            detection_active = True
            
            # 啟動執行緒 - 使用手動指定的攝影機索引
            video_thread = threading.Thread(target=video_capture_thread, args=(camera_index,), name="VideoCapture")
            video_thread.daemon = True
            video_thread.start()
            
            process_thread = threading.Thread(target=frame_processing_thread, args=(exercise_type,), name="FrameProcessing")
            process_thread.daemon = True
            process_thread.start()
            
            logger.info(f"已啟動{exercise_type}運動檢測")
            
            # 記錄活躍執行緒
            active_threads = threading.enumerate()
            logger.info(f"活躍執行緒: {[t.name for t in active_threads]}")
        
        # 發送成功回應
        emit('start_detection_response', {'status': 'success'})
        logger.info("已發送開始檢測成功回應")
        
    except Exception as e:
        logger.error(f"啟動檢測失敗: {e}", exc_info=True)
        emit('start_detection_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'啟動檢測失敗: {str(e)}'})



@socketio.on('stop_detection', namespace='/exercise')
def handle_stop_detection(data=None):
    """處理停止檢測請求"""
    global detection_active, table_tennis_active, table_tennis_session_id
    global basketball_active, basketball_session_id
    global basketball_dribble_active, basketball_dribble_session_id  # 添加籃球運球變量
    global volleyball_overhand_active, volleyball_overhand_session_id  # 添加排球高手托球變量
    global volleyball_lowhand_active, volleyball_lowhand_session_id  # 添加排球低手接球變量
    global alternating_arm_swing_active, alternating_arm_swing_session_id  # 添加雙手輪流擺動熱身運動變量
    global plank_active, plank_session_id  # 添加平板支撐變量
    global taekwondo_detail_active, taekwondo_detail_session_id  # 添加跆拳道詳細檢測變量
    
    try:
        logger.info('收到停止檢測請求')
        detection_active = False
        
        # 清理桌球揮拍資源
        if table_tennis_active and table_tennis_session_id:
            try:
                table_tennis_service = TableTennisService.get_instance()
                table_tennis_service.remove_detector(table_tennis_session_id)
            except Exception as e:
                logger.error(f"清理桌球揮拍資源時出錯: {e}")
            finally:
                table_tennis_active = False
                table_tennis_session_id = None
        
        # 清理籃球投籃資源
        if basketball_active and basketball_session_id:
            try:
                basketball_service = BasketballService.get_instance()
                basketball_service.remove_detector(basketball_session_id)
            except Exception as e:
                logger.error(f"清理籃球投籃資源時出錯: {e}")
            finally:
                basketball_active = False
                basketball_session_id = None
                
        # 清理籃球運球資源
        if basketball_dribble_active and basketball_dribble_session_id:
            try:
                basketball_dribble_service = BasketballDribbleService.get_instance()
                basketball_dribble_service.remove_detector(basketball_dribble_session_id)
            except Exception as e:
                logger.error(f"清理籃球運球資源時出錯: {e}")
            finally:
                basketball_dribble_active = False
                basketball_dribble_session_id = None
                
        # 清理排球高手托球資源
        if volleyball_overhand_active and volleyball_overhand_session_id:
            try:
                volleyball_service = VolleyballService.get_instance()
                volleyball_service.remove_detector(volleyball_overhand_session_id)
            except Exception as e:
                logger.error(f"清理排球高手托球資源時出錯: {e}")
            finally:
                volleyball_overhand_active = False
                volleyball_overhand_session_id = None
                
        # 清理排球低手接球資源
        if volleyball_lowhand_active and volleyball_lowhand_session_id:
            try:
                volleyball_service = VolleyballService.get_instance()
                volleyball_service.remove_detector(volleyball_lowhand_session_id)
            except Exception as e:
                logger.error(f"清理排球低手接球資源時出錯: {e}")
            finally:
                volleyball_lowhand_active = False
                volleyball_lowhand_session_id = None
        
        # 清理雙手輪流擺動熱身運動資源
        if alternating_arm_swing_active and alternating_arm_swing_session_id:
            try:
                exercise_service.set_alternating_arm_swing_active(False)
            except Exception as e:
                logger.error(f"清理雙手輪流擺動熱身運動資源時出錯: {e}")
            finally:
                alternating_arm_swing_active = False
                alternating_arm_swing_session_id = None
        
        # 清理平板支撐資源
        if plank_active and plank_session_id:
            try:
                exercise_service.set_plank_active(False)
            except Exception as e:
                logger.error(f"清理平板支撐資源時出錯: {e}")
            finally:
                plank_active = False
                plank_session_id = None
        
        # 清理跆拳道詳細檢測資源
        if taekwondo_detail_active and taekwondo_detail_session_id:
            try:
                taekwondo_service = get_taekwondo_service()
                
                # 處理錄製停止和影片保留選項
                keep_video = True  # 預設保留影片
                if data and 'keep_video' in data:
                    keep_video = data['keep_video']
                
                # 停止錄製
                recording_data = taekwondo_service.stop_recording()
                
                if recording_data and not keep_video:
                    # 用戶選擇不保留影片，刪除檔案
                    try:
                        if os.path.exists(recording_data['original_video']):
                            os.remove(recording_data['original_video'])
                            logger.info(f"已刪除原始影片: {recording_data['original_video']}")
                        
                        if os.path.exists(recording_data['skeleton_video']):
                            os.remove(recording_data['skeleton_video'])
                            logger.info(f"已刪除分析影片: {recording_data['skeleton_video']}")
                        
                        emit('recording_deleted', {'status': 'success', 'message': '影片已刪除'})
                    except Exception as delete_error:
                        logger.error(f"刪除影片檔案失敗: {delete_error}")
                        emit('recording_deleted', {'status': 'error', 'message': '刪除影片失敗'})
                elif recording_data and keep_video:
                    # 用戶選擇保留影片，發送下載信息
                    original_filename = os.path.basename(recording_data['original_video'])
                    skeleton_filename = os.path.basename(recording_data['skeleton_video'])
                    
                    emit('recording_stopped', {
                        'status': 'success',
                        'original_video': original_filename,
                        'skeleton_video': skeleton_filename,
                        'duration': recording_data['duration'],
                        'fps': recording_data['fps']
                    })
                
                # 重置檢測狀態
                taekwondo_service.reset()
            except Exception as e:
                logger.error(f"清理跆拳道詳細檢測資源時出錯: {e}")
            finally:
                taekwondo_detail_active = False
                taekwondo_detail_session_id = None
        
        # 確保 exercise_service 中的 detection_active 也被設置
        exercise_service.detection_active = False
        logger.info("已停止運動檢測")
        emit('stop_detection_response', {'status': 'success'})
    except Exception as e:
        logger.error(f"停止檢測失敗: {e}", exc_info=True)
        emit('stop_detection_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'停止檢測失敗: {str(e)}'})




# 添加桌球揮拍重置功能
@socketio.on('reset_table_tennis', namespace='/exercise')
def handle_reset_table_tennis():
    """處理重置桌球揮拍請求"""
    global table_tennis_session_id
    
    try:
        logger.info('收到重置桌球揮拍請求')
        
        if table_tennis_session_id:
            table_tennis_service = TableTennisService.get_instance()
            result = table_tennis_service.reset_detector(table_tennis_session_id)
            
            if result:
                emit('reset_response', {'status': 'success'})
                # 重置計數顯示
                emit('exercise_count', {'count': 0})
                logger.info("已重置桌球揮拍檢測")
            else:
                emit('reset_response', {'status': 'error', 'message': '找不到對應的檢測器'})
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置桌球揮拍失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置桌球揮拍失敗: {str(e)}'})


@socketio.on('set_detection_line', namespace='/exercise')
def handle_set_detection_line(data):
    """處理設置檢測線請求"""
    logger.info(f'收到設置檢測線請求: {data}')
    line_position = data.get('line_position', 0.5)
    exercise_service.set_detection_line(line_position)

@socketio.on('switch_exercise_fast', namespace='/exercise')
def handle_switch_exercise_fast(data):
    """處理快速運動切換請求 - 不停止檢測線程"""
    global detection_active
    
    try:
        logger.info(f'收到快速運動切換請求: {data}')
        
        new_exercise_type = data.get('exercise_type', 'squat')
        detection_line = data.get('detection_line', 0.5)
        
        # 檢查是否正在檢測
        if not detection_active:
            logger.warning('檢測未啟動，無法進行快速切換')
            emit('switch_exercise_response', {
                'status': 'error', 
                'message': '檢測未啟動，請先開始檢測'
            })
            return
        
        # 獲取當前運動類型
        current_type = exercise_service.get_current_exercise_type()
        
        # 如果運動類型相同，直接返回
        if current_type == new_exercise_type:
            logger.info(f'運動類型未改變: {new_exercise_type}')
            emit('switch_exercise_response', {
                'status': 'success',
                'message': f'已確認當前運動類型: {new_exercise_type}'
            })
            return
        
        # 快速切換運動類型（不重置檢測線程）
        exercise_service.set_current_exercise_type(new_exercise_type)
        
        # 只在必要時重新設置檢測線
        if data.get('reset_detection_line', False):
            exercise_service.set_detection_line(detection_line)
        
        # 發送切換成功響應
        emit('switch_exercise_response', {
            'status': 'success',
            'exercise_type': new_exercise_type,
            'message': f'已快速切換到 {new_exercise_type}'
        })
        
        # 發送初始數據
        emit('exercise_count', {'count': 0})
        emit('pose_quality', {'score': 0})
        emit('coach_tip', {'tip': f'已切換到{new_exercise_type}運動，請保持正確姿勢'})
        
        logger.info(f'快速切換運動類型成功: {current_type} -> {new_exercise_type}')
        
    except Exception as e:
        logger.error(f"快速切換運動失敗: {e}", exc_info=True)
        emit('switch_exercise_response', {
            'status': 'error', 
            'message': f'切換失敗: {str(e)}'
        })

@socketio.on('connect', namespace='/exercise')
def handle_connect():
    """處理客戶端連接"""
    logger.info('客戶端已連接')

# 確保以下函數在 exercise_routes.py 中正確實現

def get_current_frame():
    """從 frame_buffer 取得最新影像"""
    timeout = 5  # 等待 5 秒
    start_time = time.time()
    while frame_buffer.empty():
        if time.time() - start_time > timeout:
            logger.error("等待影像超時，佇列仍為空")
            return None
        time.sleep(0.1)
    return frame_buffer.get()

# 在文件末尾添加以下代碼

@socketio.on('request_angle_data', namespace='/exercise')
def handle_request_angle_data():
    """處理請求角度數據"""
    logger.info('收到請求角度數據')
    # 從 exercise_service 獲取當前角度數據
    angles = exercise_service.get_current_angles()
    emit('angle_data', angles)

@socketio.on('request_quality_score', namespace='/exercise')
def handle_request_quality_score():
    """處理請求品質評分"""
    logger.info('收到請求品質評分')
    exercise_type = exercise_service.get_current_exercise_type()
    score = exercise_service.get_current_quality_score()
    
    if exercise_type == 'squat':
        emit('squat_quality', {'score': score})
    elif exercise_type == 'shoulder-press':
        emit('shoulder_press_score', {'score': score})
    elif exercise_type == 'bicep-curl':
        emit('bicep_curl_score', {'score': score})

@socketio.on('request_coach_tip', namespace='/exercise')
def handle_request_coach_tip():
    """處理請求教練提示"""
    logger.info('收到請求教練提示')
    tip = exercise_service.get_current_coach_tip()
    emit('coach_tip', {'tip': tip})

# 添加籃球投籃重置功能
@socketio.on('reset_basketball', namespace='/exercise')
def handle_reset_basketball():
    """處理重置籃球投籃請求"""
    global basketball_session_id
    
    try:
        logger.info('收到重置籃球投籃請求')
        
        if basketball_session_id:
            basketball_service = BasketballService.get_instance()
            result = basketball_service.reset_detector(basketball_session_id)
            
            if result:
                emit('reset_response', {'status': 'success'})
                # 重置計數顯示
                emit('exercise_count', {'count': 0})
                logger.info("已重置籃球投籃檢測")
            else:
                emit('reset_response', {'status': 'error', 'message': '找不到對應的檢測器'})
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置籃球投籃失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置籃球投籃失敗: {str(e)}'})

# 添加籃球運球重置功能
@socketio.on('reset_basketball_dribble', namespace='/exercise')
def handle_reset_basketball_dribble():
    """處理重置籃球運球請求"""
    global basketball_dribble_session_id
    
    try:
        logger.info('收到重置籃球運球請求')
        
        if basketball_dribble_session_id:
            basketball_dribble_service = BasketballDribbleService.get_instance()
            result = basketball_dribble_service.reset_detector(basketball_dribble_session_id)
            
            if result:
                emit('reset_response', {'status': 'success'})
                # 重置計數顯示
                emit('exercise_count', {'count': 0})
                logger.info("已重置籃球運球檢測")
            else:
                emit('reset_response', {'status': 'error', 'message': '找不到對應的檢測器'})
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置籃球運球失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置籃球運球失敗: {str(e)}'})

# 添加排球高手托球重置功能
@socketio.on('reset_volleyball_overhand', namespace='/exercise')
def handle_reset_volleyball_overhand():
    """處理重置排球高手托球請求"""
    global volleyball_overhand_session_id
    
    try:
        logger.info('收到重置排球高手托球請求')
        
        if volleyball_overhand_session_id:
            volleyball_service = VolleyballService.get_instance()
            result = volleyball_service.reset_detector(volleyball_overhand_session_id)
            
            if result:
                emit('reset_response', {'status': 'success'})
                # 重置計數顯示
                emit('exercise_count', {'count': 0})
                logger.info("已重置排球高手托球檢測")
            else:
                emit('reset_response', {'status': 'error', 'message': '找不到對應的檢測器'})
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置排球高手托球失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置排球高手托球失敗: {str(e)}'})

# 添加排球低手接球重置功能
@socketio.on('reset_volleyball_lowhand', namespace='/exercise')
def handle_reset_volleyball_lowhand():
    """處理重置排球低手接球請求"""
    global volleyball_lowhand_session_id
    
    try:
        logger.info('收到重置排球低手接球請求')
        
        if volleyball_lowhand_session_id:
            volleyball_service = VolleyballService.get_instance()
            result = volleyball_service.reset_detector(volleyball_lowhand_session_id)
            
            if result:
                emit('reset_response', {'status': 'success'})
                # 重置計數顯示
                emit('exercise_count', {'count': 0})
                # 重置進度顯示
                emit('lowhand_progress', {
                    'current_time': 0,
                    'target_time': 25.0,
                    'is_correct': False
                })
                logger.info("已重置排球低手接球檢測")
            else:
                emit('reset_response', {'status': 'error', 'message': '找不到對應的檢測器'})
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置排球低手接球失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置排球低手接球失敗: {str(e)}'})

# 添加平板支撐重置功能
@socketio.on('reset_plank', namespace='/exercise')
def handle_reset_plank():
    """處理重置平板支撐請求"""
    global plank_session_id
    
    try:
        logger.info('收到重置平板支撐請求')
        
        if plank_session_id:
            # 重置平板支撐狀態
            exercise_service.reset_plank()
            
            emit('reset_response', {'status': 'success'})
            # 重置時間顯示
            emit('plank_time', {'time': 0.0})
            # 重置狀態顯示
            emit('plank_status', {
                'posture_status': '等待檢測',
                'quality_score': 0.0,
                'body_angle': 0.0,
                'stability': '-'
            })
            logger.info("已重置平板支撐檢測")
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置平板支撐失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置平板支撐失敗: {str(e)}'})

# 添加設置平板支撐目標時間功能
@socketio.on('set_plank_target', namespace='/exercise')
def handle_set_plank_target(data):
    """處理設置平板支撐目標時間請求"""
    try:
        target_time = data.get('target_time', 30)
        logger.info(f'收到設置平板支撐目標時間請求: {target_time}秒')
        
        # 設置目標時間
        exercise_service.set_plank_target_time(target_time)
        
        emit('plank_target', {'target_time': target_time})
        logger.info(f"已設置平板支撐目標時間為: {target_time}秒")
    except Exception as e:
        logger.error(f"設置平板支撐目標時間失敗: {e}", exc_info=True)
        emit('error', {'message': f'設置目標時間失敗: {str(e)}'})

# 添加跆拳道詳細檢測重置功能
@socketio.on('reset_taekwondo_detail', namespace='/exercise')
def handle_reset_taekwondo_detail():
    """處理重置跆拳道詳細檢測請求"""
    global taekwondo_detail_session_id
    
    try:
        logger.info('收到重置跆拳道詳細檢測請求')
        
        if taekwondo_detail_session_id:
            # 重置跆拳道檢測狀態
            taekwondo_service = get_taekwondo_service()
            taekwondo_service.reset()
            
            emit('reset_response', {'status': 'success'})
            # 重置所有數據顯示
            emit('taekwondo_angles', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0,
                'left_shoulder': 0, 'right_shoulder': 0, 'left_hip': 0, 'right_hip': 0
            })
            emit('taekwondo_velocities', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0
            })
            emit('taekwondo_accelerations', {
                'left_elbow': 0, 'right_elbow': 0, 'left_knee': 0, 'right_knee': 0
            })
            emit('taekwondo_action', {'action': '待檢測', 'confidence': 0, 'count': 0})
            logger.info("已重置跆拳道詳細檢測")
        else:
            emit('reset_response', {'status': 'error', 'message': '無效的會話'})
    except Exception as e:
        logger.error(f"重置跆拳道詳細檢測失敗: {e}", exc_info=True)
        emit('reset_response', {'status': 'error', 'message': str(e)})
        emit('error', {'message': f'重置跆拳道詳細檢測失敗: {str(e)}'})

# 添加攝像頭檢測功能
@socketio.on('detect_cameras', namespace='/exercise')
def handle_detect_cameras():
    """處理檢測可用攝像頭請求"""
    try:
        logger.info('收到檢測攝像頭請求')
        
        # 檢測可用攝像頭
        available_cameras = []
        
        # 嘗試檢測最多8個攝像頭索引
        for i in range(8):
            try:
                cap = cv2.VideoCapture(i)
                if cap.isOpened():
                    # 嘗試讀取一幀來確認攝像頭可用
                    ret, frame = cap.read()
                    if ret:
                        # 獲取攝像頭信息
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        fps = int(cap.get(cv2.CAP_PROP_FPS))
                        
                        camera_info = {
                            'index': i,
                            'name': f'Camera {i}',
                            'resolution': f'{width}x{height}',
                            'fps': fps,
                            'available': True
                        }
                        available_cameras.append(camera_info)
                        logger.info(f"檢測到攝像頭 {i}: {width}x{height} @ {fps}fps")
                cap.release()
            except Exception as e:
                logger.debug(f"攝像頭 {i} 檢測失敗: {e}")
                continue
        
        # 發送檢測結果
        emit('camera_detection_response', {
            'status': 'success',
            'cameras': available_cameras,
            'count': len(available_cameras)
        })
        
        logger.info(f"攝像頭檢測完成，找到 {len(available_cameras)} 個可用攝像頭")
        
    except Exception as e:
        logger.error(f"檢測攝像頭失敗: {e}", exc_info=True)
        emit('camera_detection_response', {
            'status': 'error',
            'message': f'檢測攝像頭失敗: {str(e)}',
            'cameras': [],
            'count': 0
        })

# 添加錄製相關功能
@socketio.on('start_recording', namespace='/exercise')
def handle_start_recording():
    """處理開始錄製請求"""
    global taekwondo_detail_session_id
    
    try:
        logger.info('收到開始錄製請求')
        
        if not taekwondo_detail_session_id:
            emit('recording_started', {'status': 'error', 'message': '無效的會話'})
            return
        
        # 獲取跆拳道服務實例
        taekwondo_service = get_taekwondo_service()
        
        # 開始錄製
        success = taekwondo_service.start_recording()
        
        if success:
            emit('recording_started', {'status': 'success'})
            logger.info("錄製已開始")
        else:
            emit('recording_started', {'status': 'error', 'message': '開始錄製失敗'})
            
    except Exception as e:
        logger.error(f"開始錄製失敗: {e}", exc_info=True)
        emit('recording_started', {'status': 'error', 'message': str(e)})

@socketio.on('stop_recording', namespace='/exercise')
def handle_stop_recording():
    """處理停止錄製請求"""
    global taekwondo_detail_session_id
    
    try:
        logger.info('收到停止錄製請求')
        
        if not taekwondo_detail_session_id:
            emit('recording_stopped', {'status': 'error', 'message': '無效的會話'})
            return
        
        # 獲取跆拳道服務實例
        taekwondo_service = get_taekwondo_service()
        
        # 停止錄製
        recording_data = taekwondo_service.stop_recording()
        
        if recording_data:
            # 提取檔案名稱（不包含完整路徑）
            original_filename = os.path.basename(recording_data['original_video'])
            skeleton_filename = os.path.basename(recording_data['skeleton_video'])
            
            emit('recording_stopped', {
                'status': 'success',
                'original_video': original_filename,
                'skeleton_video': skeleton_filename,
                'duration': recording_data['duration'],
                'fps': recording_data['fps']
            })
            logger.info("錄製已停止")
        else:
            emit('recording_stopped', {'status': 'error', 'message': '停止錄製失敗'})
            
    except Exception as e:
        logger.error(f"停止錄製失敗: {e}", exc_info=True)
        emit('recording_stopped', {'status': 'error', 'message': str(e)})

@exercise_bp.route('/download_recording/<filename>')
def download_recording(filename):
    """下載錄製的影片文件"""
    try:
        # 安全檢查：確保檔案名稱不包含路徑遍歷
        if '..' in filename or '/' in filename or '\\' in filename:
            logger.warning(f"非法的檔案名稱: {filename}")
            return jsonify({'error': '非法的檔案名稱'}), 400
        
        # 檢查檔案類型
        if not filename.lower().endswith('.mp4'):
            logger.warning(f"不支援的檔案類型: {filename}")
            return jsonify({'error': '不支援的檔案類型'}), 400
        
        # 使用絕對路徑檢查檔案
        recordings_dir = os.path.abspath('recordings')
        file_path = os.path.join(recordings_dir, filename)
        
        logger.info(f"尋找檔案: {file_path}")
        logger.info(f"錄製目錄: {recordings_dir}")
        
        # 列出錄製目錄中的所有檔案
        if os.path.exists(recordings_dir):
            files_in_dir = os.listdir(recordings_dir)
            logger.info(f"錄製目錄中的檔案: {files_in_dir}")
        else:
            logger.warning(f"錄製目錄不存在: {recordings_dir}")
            return jsonify({'error': '錄製目錄不存在'}), 404
        
        if not os.path.exists(file_path):
            logger.warning(f"檔案不存在: {file_path}")
            return jsonify({'error': f'檔案不存在: {filename}'}), 404
        
        logger.info(f"開始下載檔案: {filename}")
        
        # 發送檔案
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='video/mp4'
        )
        
    except Exception as e:
        logger.error(f"下載檔案失敗: {e}", exc_info=True)
        return jsonify({'error': '下載失敗'}), 500

@exercise_bp.route('/picture')
def picture_page():
    """渲染圖片展示頁面"""
    logger.info("請求 picture.html 頁面")
    return render_template('picture.html')

@exercise_bp.route('/four_grid_image')
def four_grid_image():
    """從 captures 資料夾讀取圖片並生成四格圖"""
    logger.info("請求四格圖片")
    capture_dir = os.path.join('static', 'captures')
    output_image_path = os.path.join(capture_dir, 'four_grid_output.jpg') # 定義輸出圖片路徑

    try:
        # 確保 captures 資料夾存在
        if not os.path.exists(capture_dir):
            logger.error(f"Captures 資料夾不存在: {capture_dir}")
            # 可以返回一個預設的 "圖片未找到" 圖片或 404 錯誤
            # return "Captures directory not found", 404
            # 為了範例，我們創建一個空的佔位圖
            img = Image.new('RGB', (400, 300), color = (128, 128, 128))
            draw = ImageDraw.Draw(img)
            draw.text((10,10), "Captures folder not found", fill=(255,255,0))
            buf = io.BytesIO()
            img.save(buf, format='JPEG')
            buf.seek(0)
            return send_file(buf, mimetype='image/jpeg')


        # 獲取 captures 資料夾中所有 jpg 圖片，按修改時間排序
        # *** 您可能需要根據實際的檔名規則篩選籃球投籃的圖片 ***
        # 例如: images = [f for f in os.listdir(capture_dir) if f.startswith('basketball_shot_') and f.endswith('.jpg')]
        images = sorted(
            [f for f in os.listdir(capture_dir) if f.endswith('.jpg') and f != 'four_grid_output.jpg'], # 排除上次生成的圖片
            key=lambda f: os.path.getmtime(os.path.join(capture_dir, f)),
            reverse=True
        )

        if not images:
            logger.warning("Captures 資料夾中沒有找到圖片")
            # 返回佔位圖
            img = Image.new('RGB', (400, 300), color = (128, 128, 128))
            draw = ImageDraw.Draw(img)
            draw.text((10,10), "No images found in captures", fill=(255,255,0)) # 需要 from PIL import ImageDraw
            buf = io.BytesIO()
            img.save(buf, format='JPEG')
            buf.seek(0)
            return send_file(buf, mimetype='image/jpeg')

        # 選擇最新的4張圖片（如果有的話）
        selected_images = images[:4]
        image_paths = [os.path.join(capture_dir, img_name) for img_name in selected_images]

        # --- 開始創建四格圖 ---
        pil_images = [Image.open(p) for p in image_paths]

        # 假設所有圖片大小相同，取第一張的大小
        # 如果圖片大小不同，需要先 resize
        width, height = pil_images[0].size
        grid_img = Image.new('RGB', (width * 2, height * 2)) # 創建 2x2 的畫布

        # 將圖片貼到畫布上
        grid_img.paste(pil_images[0], (0, 0))
        if len(pil_images) > 1:
            grid_img.paste(pil_images[1], (width, 0))
        if len(pil_images) > 2:
            grid_img.paste(pil_images[2], (0, height))
        if len(pil_images) > 3:
            grid_img.paste(pil_images[3], (width, height))
        # --- 結束創建四格圖 ---

        # 將合併後的圖片儲存到記憶體中
        img_io = io.BytesIO()
        grid_img.save(img_io, 'JPEG', quality=85)
        img_io.seek(0)

        # 將圖片作為回應發送
        return send_file(img_io, mimetype='image/jpeg')

    except Exception as e:
        logger.error(f"生成四格圖片時出錯: {e}", exc_info=True)
        # 返回錯誤信息或佔位圖
        img = Image.new('RGB', (400, 300), color = (200, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.text((10,10), f"Error generating image: {e}", fill=(255,255,0))
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)
        return send_file(buf, mimetype='image/jpeg')
