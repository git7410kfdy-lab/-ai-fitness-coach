import cv2
import numpy as np
import time
import logging
from app import socketio

# 設置日誌
logger = logging.getLogger(__name__)

class ArmSwingWarmupService:
    """坐姿手臂擺動暖身運動檢測服務
    
    這是一個坐在地板上雙手左右打開上下擺動的暖身動作檢測服務。
    主要功能：
    - 檢測雙手擺動幅度，擺動越大姿勢品質分數越高
    - 提供動作計數功能
    - 評估動作對稱性
    - 不使用YOLO模型，純粹基於角度計算
    """
    
    def __init__(self):
        self.exercise_count = 0
        self.last_pose = None
        self.swing_state = "center"  # center, left, right
        self.last_swing_time = 0
        self.quality_score = 0
        self.detection_active = False
        
        # 擺動檢測參數
        self.min_swing_angle = 30  # 最小擺動角度
        self.max_swing_angle = 90  # 最大擺動角度
        self.swing_threshold = 0.8  # 擺動檢測時間間隔
        
        # 姿勢狀態追蹤
        self.left_swing_detected = False
        self.right_swing_detected = False
        self.center_position_detected = False
        
        # 品質評分參數
        self.quality_thresholds = {
            'excellent': 80,  # 優秀
            'good': 60,       # 良好
            'fair': 40,       # 一般
            'poor': 20        # 需改進
        }
    
    def reset_state(self):
        """重置檢測狀態"""
        self.exercise_count = 0
        self.last_pose = None
        self.swing_state = "center"
        self.last_swing_time = 0
        self.quality_score = 0
        self.left_swing_detected = False
        self.right_swing_detected = False
        self.center_position_detected = False
        logger.info("手臂擺動暖身運動狀態已重置")
    
    def calculate_arm_angle(self, shoulder, elbow, wrist):
        """計算手臂角度"""
        if any(np.isnan(point).any() for point in [shoulder, elbow, wrist]):
            return 0
        
        # 計算肩膀到手腕的向量與水平線的角度
        arm_vector = wrist - shoulder
        
        # 使用atan2計算角度，更準確
        angle = np.degrees(np.arctan2(arm_vector[1], arm_vector[0]))
        
        # 轉換角度：水平向右為0度，向上為正，向下為負
        # atan2返回的角度範圍是-180到180度
        # 我們需要調整為：向上為正角度，向下為負角度
        if angle > 180:
            angle -= 360
        
        # 反轉y軸方向（因為圖像坐標系y軸向下為正）
        angle = -angle
        
        return angle
    
    def calculate_swing_amplitude(self, left_arm_angle, right_arm_angle):
        """計算擺動幅度"""
        # 計算雙臂的平均擺動角度
        avg_angle = abs(left_arm_angle) + abs(right_arm_angle)
        return avg_angle / 2
    
    def calculate_quality_score(self, left_arm_angle, right_arm_angle, symmetry_score):
        """計算姿勢品質分數 - 基於肩膀角度評分"""
        # 計算雙臂平均角度
        avg_angle = (left_arm_angle + right_arm_angle) / 2
        
        # 基於角度位置的分數 (手臂水平偏上為高分，手臂放下為低分)
        if avg_angle >= 60:  # 手臂高舉 (水平偏上)
            angle_score = 90
        elif avg_angle >= 30:  # 手臂中等高度
            angle_score = 70
        elif avg_angle >= 0:   # 手臂水平
            angle_score = 50
        elif avg_angle >= -30: # 手臂稍微下垂
            angle_score = 30
        else:  # 手臂完全放下
            angle_score = 10
        
        # 基於對稱性的分數 (0-10分)
        symmetry_bonus = symmetry_score * 10
        
        total_score = angle_score + symmetry_bonus
        
        # 轉換為1-5分制
        if total_score >= 85:
            return 5
        elif total_score >= 65:
            return 4
        elif total_score >= 45:
            return 3
        elif total_score >= 25:
            return 2
        else:
            return 1
    
    def calculate_symmetry_score(self, left_arm_angle, right_arm_angle):
        """計算雙臂對稱性分數"""
        if abs(left_arm_angle) == 0 or abs(right_arm_angle) == 0:
            return 0
        
        # 計算角度差異
        angle_diff = abs(abs(left_arm_angle) - abs(right_arm_angle))
        
        # 對稱性分數 (角度差異越小，分數越高)
        symmetry_score = max(0, 1 - (angle_diff / 45))  # 45度為最大容忍差異
        
        return symmetry_score
    
    def detect_swing_phase(self, left_arm_angle, right_arm_angle):
        """檢測擺動階段"""
        # 判斷當前擺動狀態
        avg_angle = (left_arm_angle + right_arm_angle) / 2
        
        if avg_angle > 10:  # 手臂舉到水平偏高（降低閾值）
            return "up"
        elif avg_angle < -10:  # 手臂放下
            return "down"
        else:  # 中間位置
            return "center"
    
    def process_exercise(self, frame, annotated_frame, keypoints, angles):
        """處理手臂擺動暖身運動"""
        if keypoints is None or len(keypoints) < 17:
            logger.warning("手臂擺動檢測的關鍵點不足!")
            return
        
        # 獲取關鍵點
        left_shoulder = keypoints[5][:2]   # 左肩
        right_shoulder = keypoints[6][:2]  # 右肩
        left_elbow = keypoints[7][:2]      # 左肘
        right_elbow = keypoints[8][:2]     # 右肘
        left_wrist = keypoints[9][:2]      # 左手腕
        right_wrist = keypoints[10][:2]    # 右手腕
        
        # 檢查關鍵點有效性
        required_points = [left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist]
        if any(np.isnan(point).any() for point in required_points):
            logger.warning("關鍵點數據無效")
            return
        
        # 計算手臂角度
        left_arm_angle = self.calculate_arm_angle(left_shoulder, left_elbow, left_wrist)
        right_arm_angle = self.calculate_arm_angle(right_shoulder, right_elbow, right_wrist)
        
        # 計算擺動幅度和對稱性
        swing_amplitude = self.calculate_swing_amplitude(left_arm_angle, right_arm_angle)
        symmetry_score = self.calculate_symmetry_score(left_arm_angle, right_arm_angle)
        
        # 計算品質分數 (基於肩膀角度)
        self.quality_score = self.calculate_quality_score(left_arm_angle, right_arm_angle, symmetry_score)
        
        # 檢測擺動階段
        current_phase = self.detect_swing_phase(left_arm_angle, right_arm_angle)
        
        # 動作計數邏輯 - 簡化為：手臂舉到水平偏高就計數
        current_time = time.time()
        if self.last_pose != current_phase and current_time - self.last_swing_time > self.swing_threshold:
            # 當手臂從非up狀態轉換到up狀態時計數
            if self.last_pose != "up" and current_phase == "up":
                self.exercise_count += 1
                self.last_swing_time = current_time
                logger.info(f"手臂擺動完成，計數: {self.exercise_count}")
                socketio.emit('exercise_count_update', {'count': self.exercise_count}, namespace='/exercise')
            
            # 更新狀態
            self.swing_state = current_phase
        
        self.last_pose = current_phase
        
        # 在畫面上顯示信息
        self.draw_exercise_info(annotated_frame, left_arm_angle, right_arm_angle, swing_amplitude, symmetry_score)
        
        # 發送品質分數到前端
        socketio.emit('pose_quality', {'score': self.quality_score}, namespace='/exercise')
        
        # 發送角度數據
        angle_data = {
            '左手臂角度': float(left_arm_angle),
            '右手臂角度': float(right_arm_angle),
            '擺動幅度': float(swing_amplitude),
            '對稱性分數': float(symmetry_score)
        }
        socketio.emit('angle_data', angle_data, namespace='/exercise')
    
    def draw_exercise_info(self, frame, left_arm_angle, right_arm_angle, swing_amplitude, symmetry_score):
        """在畫面上繪製運動信息"""
        # 品質分數顏色
        if self.quality_score >= 4:
            quality_color = (0, 255, 0)  # 綠色
            quality_text = "優秀"
        elif self.quality_score >= 3:
            quality_color = (0, 255, 255)  # 黃色
            quality_text = "良好"
        elif self.quality_score >= 2:
            quality_color = (0, 165, 255)  # 橙色
            quality_text = "一般"
        else:
            quality_color = (0, 0, 255)  # 紅色
            quality_text = "需改進"
        
        # 顯示品質分數
        cv2.putText(frame, f"品質分數: {self.quality_score}/5 - {quality_text}", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, quality_color, 2)
        
        # 顯示手臂角度
        cv2.putText(frame, f"左手臂角度: {left_arm_angle:.1f}°", 
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, f"右手臂角度: {right_arm_angle:.1f}°", 
                    (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # 顯示擺動幅度
        cv2.putText(frame, f"擺動幅度: {swing_amplitude:.1f}°", 
                    (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # 顯示對稱性分數
        cv2.putText(frame, f"對稱性: {symmetry_score:.2f}", 
                    (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # 顯示當前狀態
        cv2.putText(frame, f"狀態: {self.swing_state}", 
                    (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # 顯示計數
        cv2.putText(frame, f"計數: {self.exercise_count}", 
                    (10, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    
    def get_exercise_count(self):
        """獲取運動計數"""
        return self.exercise_count
    
    def get_quality_score(self):
        """獲取品質分數"""
        return self.quality_score
    
    def set_detection_active(self, active):
        """設置檢測狀態"""
        self.detection_active = active
        if active:
            logger.info("手臂擺動暖身運動檢測已啟動")
        else:
            logger.info("手臂擺動暖身運動檢測已停止")
    
    def is_detection_active(self):
        """檢查檢測是否啟動"""
        return self.detection_active

# 創建全局實例
arm_swing_warmup_service = ArmSwingWarmupService()

# 提供便捷的函數接口
def process_arm_swing_warmup(frame, annotated_frame, keypoints, angles):
    """處理坐姿手臂擺動暖身運動的便捷函數"""
    return arm_swing_warmup_service.process_exercise(frame, annotated_frame, keypoints, angles)

def reset_arm_swing_warmup_state():
    """重置坐姿手臂擺動暖身運動狀態的便捷函數"""
    return arm_swing_warmup_service.reset_state()

def get_arm_swing_warmup_count():
    """獲取坐姿手臂擺動暖身運動計數的便捷函數"""
    return arm_swing_warmup_service.get_exercise_count()

def get_arm_swing_warmup_quality():
    """獲取坐姿手臂擺動暖身運動品質分數的便捷函數"""
    return arm_swing_warmup_service.get_quality_score()

def set_arm_swing_warmup_active(active):
    """設置坐姿手臂擺動暖身運動檢測狀態的便捷函數"""
    return arm_swing_warmup_service.set_detection_active(active)