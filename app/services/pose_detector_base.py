import cv2
import numpy as np
import time
import logging
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class PoseLandmark:
    """YOLO-Pose 關鍵點索引定義"""
    NOSE = 0
    LEFT_EYE = 1
    RIGHT_EYE = 2
    LEFT_EAR = 3
    RIGHT_EAR = 4
    LEFT_SHOULDER = 5
    RIGHT_SHOULDER = 6
    LEFT_ELBOW = 7
    RIGHT_ELBOW = 8
    LEFT_WRIST = 9
    RIGHT_WRIST = 10
    LEFT_HIP = 11
    RIGHT_HIP = 12
    LEFT_KNEE = 13
    RIGHT_KNEE = 14
    LEFT_ANKLE = 15
    RIGHT_ANKLE = 16

class VolleyballService:
    """排球服務類別，管理 YOLO-Pose 模型"""
    _model = None
    _detectors = {}
    
    @classmethod
    def get_model(cls):
        if cls._model is None:
            try:
                cls._model = YOLO('yolov8n-pose.pt')
                logger.info("YOLO-Pose 模型載入成功")
            except Exception as e:
                logger.error(f"載入 YOLO-Pose 模型失敗: {e}")
                raise
        return cls._model
    
    @classmethod
    def get_detector(cls, detector_type, session_id, width, height):
        key = f"{detector_type}_{session_id}"
        if key not in cls._detectors:
            if detector_type == "overhand":
                from .Volleyball_Overhand import OverhandDetector
                cls._detectors[key] = OverhandDetector(width, height)
            elif detector_type == "lowhand":
                from .Volleyball_lowhand import LowhandDetector
                cls._detectors[key] = LowhandDetector(width, height)
        return cls._detectors[key]

class PoseDetectorBase:
    """姿態檢測基礎類別"""
    
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.pose_model = VolleyballService.get_model()
        
    def get_yolo_keypoints(self, frame):
        """共用的 YOLO-Pose 關節點檢測函數"""
        if frame is None or frame.size == 0:
            logger.error("get_yolo_keypoints 收到無效的 frame")
            return None, frame
        
        # 水平翻轉畫面
        frame = cv2.flip(frame, 1)
        
        try:
            results = self.pose_model(frame, conf=0.3, verbose=False)
            
            if len(results) > 0:
                for result in results:
                    if hasattr(result, 'keypoints') and result.keypoints is not None:
                        keypoints = result.keypoints.xy.cpu().numpy()
                        
                        if keypoints.shape[1] < max(PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST) + 1:
                            logger.warning("關鍵點數據不完整")
                            continue
                            
                        return keypoints[0], frame
                        
        except Exception as e:
            logger.error(f"YOLO-Pose 檢測失敗: {e}")
            
        return None, frame
    
    def calculate_angle(self, a, b, c):
        """計算三點間的角度"""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360-angle
            
        return angle
    
    def draw_skeleton(self, frame, keypoints, color=(255, 0, 0)):
        """繪製骨架線"""
        def draw_line(point1, point2, line_color=color):
            if np.all(point1 != 0) and np.all(point2 != 0):
                cv2.line(frame, (int(point1[0]), int(point1[1])), 
                         (int(point2[0]), int(point2[1])), line_color, 2)
        
        # 獲取關鍵點
        left_wrist = keypoints[PoseLandmark.LEFT_WRIST]
        right_wrist = keypoints[PoseLandmark.RIGHT_WRIST]
        left_elbow = keypoints[PoseLandmark.LEFT_ELBOW]
        right_elbow = keypoints[PoseLandmark.RIGHT_ELBOW]
        left_shoulder = keypoints[PoseLandmark.LEFT_SHOULDER]
        right_shoulder = keypoints[PoseLandmark.RIGHT_SHOULDER]
        
        # 繪製手臂骨架
        draw_line(left_shoulder, left_elbow, color)
        draw_line(left_elbow, left_wrist, color)
        draw_line(right_shoulder, right_elbow, color)
        draw_line(right_elbow, right_wrist, color)
        
        return left_wrist, right_wrist, left_elbow, right_elbow, left_shoulder, right_shoulder