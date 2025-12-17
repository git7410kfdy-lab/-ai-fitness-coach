import cv2
import logging
import threading
import time
import queue

logger = logging.getLogger(__name__)

# 全域變數
camera = None
frame_buffer = None  # 幀緩衝
frame_available = threading.Event()   # 幀可用事件
camera_lock = threading.Lock()    # 攝影機鎖
frame_buffer = queue.Queue(maxsize=2)

def find_available_camera():
    """自動檢測可用的攝影機索引，從索引3開始檢測"""
    # 優先檢測索引3，因為這是已知可用的攝影機
    for index in range(3, 10):  # 檢查索引3到9
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            # 嘗試讀取一幀來確認攝影機真的可用
            ret, _ = cap.read()
            cap.release()
            if ret:
                logger.info(f"找到可用的攝影機索引: {index}")
                return index
        cap.release()
    
    # 如果索引3-9都不可用，再檢查0-2
    logger.warning("索引3-9未找到可用攝影機，檢查索引0-2")
    for index in range(3):  # 檢查索引0到2
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            # 嘗試讀取一幀來確認攝影機真的可用
            ret, _ = cap.read()
            cap.release()
            if ret:
                logger.info(f"找到可用的攝影機索引: {index}")
                return index
        cap.release()
    
    logger.error("未找到任何可用的攝影機")
    return None

# 初始化攝影機
def get_camera():
    """取得攝影機實例"""
    global camera
    
    with camera_lock:  # 加鎖
        if camera is None: # 檢查是否已初始化
            try:
                # 自動檢測可用的攝影機索引
                camera_index = find_available_camera()
                if camera_index is None:
                    logger.error("無法找到可用的攝影機")
                    return None
                
                camera = cv2.VideoCapture(camera_index)  # 使用檢測到的索引
                if not camera.isOpened():       # 檢查是否成功打開
                    logger.error(f"無法打開攝影機索引 {camera_index}")  # 記錄錯誤
                    return None
                
                # 設定攝影機參數為720p
                camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)    
                camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                camera.set(cv2.CAP_PROP_FPS, 30)
                # 設定緩衝區大小以減少延遲
                camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # 啟動幀獲取線程
                threading.Thread(target=capture_frames, daemon=True).start()
                logger.info(f"網路攝影機初始化成功，使用索引 {camera_index}")
            except Exception as e:
                logger.error(f"初始化攝影機時出錯: {e}")
                return None
    
    return camera

def capture_frames():     # 捕獲幀
    """持續捕獲幀的線程函數"""
    global camera, frame_buffer
    
    logger.info("開始捕捉視訊幀")
    
    while True:
        if camera is None or not camera.isOpened():
            logger.warning("攝影機未打開，嘗試重新打開")
            with camera_lock:
                try:
                    if camera is not None:
                        camera.release()
                    
                    # 重新檢測可用的攝影機索引
                    camera_index = find_available_camera()
                    if camera_index is None:
                        logger.error("無法找到可用的攝影機")
                        time.sleep(1)
                        continue
                    
                    camera = cv2.VideoCapture(camera_index)
                    if not camera.isOpened():
                        logger.error(f"無法重新開啟攝影機索引 {camera_index}")
                        time.sleep(1)
                        continue
                    
                    logger.info(f"成功重新開啟攝影機索引 {camera_index}")
                except Exception as e:
                    logger.error(f"重新開啟攝影機時出錯: {e}")
                    time.sleep(1)
                    continue
        
        try:
            ret, frame = camera.read()
            if not ret:
                # 減少無法讀取幀的日誌輸出頻率
                if not hasattr(capture_frames, 'error_count'):
                    capture_frames.error_count = 0
                capture_frames.error_count += 1
                
                if capture_frames.error_count % 100 == 0:
                    logger.warning(f"無法讀取幀 (已發生 {capture_frames.error_count} 次)")
                time.sleep(0.1)
                continue
            
            # 更新幀緩衝
            frame_buffer = frame.copy()
            
            # 通知等待的線程有新幀可用
            frame_available.set()
            
            # 控制幀率
            time.sleep(0.01)
        except Exception as e:
            logger.error(f"捕捉幀時出錯: {e}")
            time.sleep(0.1)


# 取得當前幀
def get_current_frame():
    """取得當前幀"""
    global frame_buffer
    
    if frame_buffer is None:
        # 等待幀可用
        if not frame_available.wait(timeout=1.0):
            logger.warning("等待幀逾時")
            return None
        frame_available.clear()
    
    return frame_buffer.copy() if frame_buffer is not None else None


def wait_for_frame(timeout=1.0):
    """等待新幀可用"""
    frame_available.wait(timeout)
    frame_available.clear()

def release_camera():
    """釋放攝影機資源"""
    global camera
    
    with camera_lock:
        if camera is not None and camera.isOpened():
            camera.release()
            camera = None
            logger.info("攝影機資源已釋放")
