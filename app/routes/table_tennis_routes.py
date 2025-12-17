from flask import Blueprint, Response, jsonify, request
import cv2
import time
import numpy as np
import threading
import logging
import sys
import os

# 導入 Table_Tennis 模組
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from Table_Tennis import HandDominanceDetector

# 配置 logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# 創建藍圖
table_tennis_bp = Blueprint('table_tennis', __name__)

# 全局變量
camera = None
detector = None
is_detecting = False
lock = threading.Lock()
frame_count = 0
last_count = 0
stroke_count = 0

def find_available_camera_index():
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

def get_camera():
    """獲取攝像頭實例"""
    global camera
    if camera is None:
        # 自動檢測可用的攝影機索引
        camera_index = find_available_camera_index()
        if camera_index is None:
            logger.error("無法找到可用的攝影機")
            return None
        
        camera = cv2.VideoCapture(camera_index)  # 使用檢測到的索引
        if not camera.isOpened():
            logger.error(f"無法開啟攝像頭索引 {camera_index}")
            return None
        
        logger.info(f"桌球攝像頭初始化成功，使用索引 {camera_index}")
    return camera

def release_camera():
    """釋放攝像頭資源"""
    global camera
    if camera is not None:
        camera.release()
        camera = None

def initialize_detector():
    """初始化桌球偵測器"""
    global detector
    if detector is None:
        cap = get_camera()
        if cap:
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            detector = HandDominanceDetector(width, height)
            logger.info("桌球偵測器初始化成功")
        else:
            logger.error("無法初始化桌球偵測器：攝像頭未開啟")
    return detector

def generate_frames():
    """生成視頻幀"""
    global is_detecting, frame_count, last_count, stroke_count
    
    cap = get_camera()
    if not cap:
        return
    
    det = initialize_detector()
    if not det:
        return
    
    while is_detecting:
        success, frame = cap.read()
        if not success:
            logger.error("無法讀取攝像頭畫面")
            break
        
        # 水平翻轉畫面，使其更直觀
        frame = cv2.flip(frame, 1)
        
        # 使用桌球偵測器處理畫面
        with lock:
            processed_frame = det.detect_and_display_landmarks(frame)
            current_count = det.stroke_count
            if current_count != last_count:
                stroke_count = current_count
                last_count = current_count
        
        # 轉換為 JPEG 格式
        ret, buffer = cv2.imencode('.jpg', processed_frame)
        if not ret:
            continue
        
        # 生成幀數據
        frame_data = buffer.tobytes()
        
        # 增加幀計數
        frame_count += 1
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')

@table_tennis_bp.route('/video_feed')
def video_feed():
    """提供視頻流"""
    global is_detecting
    is_detecting = True
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@table_tennis_bp.route('/start', methods=['POST'])
def start_detection():
    """開始桌球偵測"""
    global is_detecting
    
    try:
        # 初始化攝像頭和偵測器
        get_camera()
        initialize_detector()
        
        # 設置偵測狀態
        is_detecting = True
        
        return jsonify({
            'success': True,
            'message': '桌球偵測已開始'
        })
    except Exception as e:
        logger.error(f"啟動桌球偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'啟動失敗: {str(e)}'
        }), 500

@table_tennis_bp.route('/stop', methods=['POST'])
def stop_detection():
    """停止桌球偵測"""
    global is_detecting, detector
    
    try:
        # 停止偵測
        is_detecting = False
        
        # 釋放資源
        if detector:
            detector.release_resources()
            detector = None
        
        release_camera()
        
        return jsonify({
            'success': True,
            'message': '桌球偵測已停止'
        })
    except Exception as e:
        logger.error(f"停止桌球偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'停止失敗: {str(e)}'
        }), 500

@table_tennis_bp.route('/reset', methods=['POST'])
def reset_detection():
    """重置桌球偵測"""
    global detector, stroke_count, last_count
    
    try:
        with lock:
            if detector:
                detector.reset_dominant_hand()
                stroke_count = 0
                last_count = 0
        
        return jsonify({
            'success': True,
            'message': '桌球偵測已重置'
        })
    except Exception as e:
        logger.error(f"重置桌球偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'重置失敗: {str(e)}'
        }), 500

@table_tennis_bp.route('/get_count', methods=['GET'])
def get_count():
    """獲取當前揮拍次數"""
    global stroke_count
    
    return jsonify({
        'success': True,
        'count': stroke_count
    })