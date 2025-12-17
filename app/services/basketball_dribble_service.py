import logging
import uuid
from Processing.basketball_dribble import DribbleDetector

# 配置日誌
logger = logging.getLogger(__name__)

class BasketballDribbleService:
    """籃球運球服務類，用於管理籃球運球檢測器實例"""
    
    _instance = None
    
    @classmethod
    def get_instance(cls):
        """獲取單例實例"""
        if cls._instance is None:
            cls._instance = BasketballDribbleService()
        return cls._instance
    
    def __init__(self):
        """初始化籃球運球服務"""
        self.detectors = {}  # 使用字典存儲多個檢測器實例
        logger.info("籃球運球服務已初始化")
    
    def get_detector(self, session_id, width, height):
        """獲取或創建籃球運球檢測器
        
        Args:
            session_id (str): 會話ID
            width (int): 影像寬度
            height (int): 影像高度
            
        Returns:
            DribbleDetector: 籃球運球檢測器實例
        """
        if session_id in self.detectors:
            return self.detectors[session_id]
        
        # 創建新的檢測器
        try:
            detector = DribbleDetector(width, height)
            self.detectors[session_id] = detector
            logger.info(f"已創建新的籃球運球檢測器，會話ID: {session_id}")
            return detector
        except Exception as e:
            logger.error(f"創建籃球運球檢測器時出錯: {e}")
            return None
    
    def remove_detector(self, session_id):
        """移除籃球運球檢測器
        
        Args:
            session_id (str): 會話ID
            
        Returns:
            bool: 是否成功移除
        """
        if session_id in self.detectors:
            try:
                # 釋放資源
                self.detectors[session_id].release_resources()
                del self.detectors[session_id]
                logger.info(f"已移除籃球運球檢測器，會話ID: {session_id}")
                return True
            except Exception as e:
                logger.error(f"移除籃球運球檢測器時出錯: {e}")
                return False
        return False
    
    def reset_detector(self, session_id):
        """重置籃球運球檢測器
        
        Args:
            session_id (str): 會話ID
            
        Returns:
            bool: 是否成功重置
        """
        if session_id in self.detectors:
            try:
                # 重置檢測器的相關屬性
                detector = self.detectors[session_id]
                detector.dominant_hand = None
                detector.hand_timer = None
                detector.stroke_count = 0
                detector.left_hand_coords = []
                detector.right_hand_coords = []
                detector.mode_timer = detector.mode_timer = detector.mode_timer
                logger.info(f"已重置籃球運球檢測器，會話ID: {session_id}")
                return True
            except Exception as e:
                logger.error(f"重置籃球運球檢測器時出錯: {e}")
                return False
        return False