import cv2
import time
import numpy as np
import math
import logging
import torch
from ultralytics import YOLO
import os
from .Volleyball_Overhand import OverhandDetector
from .Volleyball_lowhand import LowhandDetector

# 配置logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

class VolleyballService:
    _instance = None
    _model = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = VolleyballService()
        return cls._instance
    
    def __init__(self):
        if VolleyballService._instance is not None:
            raise Exception("This class is a singleton!")
        
        self.detectors = {}  # 存儲不同會話的檢測器
        self.model_path = 'models/yolo11n-pose.pt'
        self._load_model()
        
    def _load_model(self):
        """載入YOLO-Pose模型"""
        try:
            if VolleyballService._model is None:
                if os.path.exists(self.model_path):
                    VolleyballService._model = YOLO(self.model_path)
                    logger.info(f"成功載入YOLO-Pose模型: {self.model_path}")
                else:
                    # 如果本地模型不存在，使用預訓練模型
                    VolleyballService._model = YOLO('yolo11n-pose.pt')
                    logger.info("使用預訓練YOLO-Pose模型")
        except Exception as e:
            logger.error(f"載入YOLO-Pose模型失敗: {e}")
            raise
    
    def get_detector(self, session_id, width, height, detector_type='overhand'):
        """獲取或創建檢測器
        
        Args:
            session_id: 會話ID
            width: 影像寬度
            height: 影像高度
            detector_type: 檢測器類型 ('overhand' 或 'lowhand')
        """
        if session_id not in self.detectors:
            if detector_type == 'overhand':
                detector = OverhandDetector(width, height)
            elif detector_type == 'lowhand':
                detector = LowhandDetector(width, height)
            else:
                raise ValueError(f"不支援的檢測器類型: {detector_type}")
            
            # 設置模型
            detector.pose_model = VolleyballService._model
            self.detectors[session_id] = detector
            logger.info(f"創建新的排球檢測器 - 會話ID: {session_id}, 類型: {detector_type}")
        
        return self.detectors[session_id]
    
    def reset_detector(self, session_id):
        """重置檢測器"""
        if session_id in self.detectors:
            detector = self.detectors[session_id]
            if hasattr(detector, 'reset_timer'):
                detector.reset_timer()
            if hasattr(detector, 'stroke_count'):
                detector.stroke_count = 0
            if hasattr(detector, 'last_above_head'):
                detector.last_above_head = False
            if hasattr(detector, 'count_cooldown'):
                detector.count_cooldown = 0
            logger.info(f"重置排球檢測器 - 會話ID: {session_id}")
            return True
        return False
    
    def remove_detector(self, session_id):
        """移除檢測器"""
        if session_id in self.detectors:
            del self.detectors[session_id]
            logger.info(f"移除排球檢測器 - 會話ID: {session_id}")
            return True
        return False
    
    def get_count(self, session_id):
        """獲取特定會話的排球計數"""
        if session_id in self.detectors:
            detector = self.detectors[session_id]
            if hasattr(detector, 'get_count'):
                return detector.get_count()
            elif hasattr(detector, 'stroke_count'):
                return detector.stroke_count
            elif hasattr(detector, 'success_count'):
                return detector.success_count
        return 0
    
    def get_detector_count(self, session_id):
        """獲取檢測器計數（向後兼容）"""
        return self.get_count(session_id)
    
    def cleanup(self):
        """清理資源"""
        self.detectors.clear()
        logger.info("排球服務資源已清理")