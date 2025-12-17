import cv2
import numpy as np
import time
import logging
from app import socketio

# 設置日誌
logger = logging.getLogger(__name__)

class AlternatingArmSwingService:
    """雙手輪流擺動熱身運動檢測服務
    
    這是一個坐姿雙手向前伸直左右手輪流上下擺動的熱身動作檢測服務。
    主要功能：
    - 檢測手臂是否伸直
    - 檢測肩膀角度
    - 檢測雙手是否輪流擺動
    - 計時模式：持續做對的運動會累積時間
    - 評估動作品質
    """
    
    def __init__(self):
        self.detection_active = False
        self.start_time = None
        self.accumulated_time = 0  # 累積的有效運動時間
        self.target_time = 30  # 目標時間（秒）
        self.last_update_time = 0
        self.quality_score = 0
        
        # 手臂狀態追蹤
        self.left_arm_state = "center"  # up, down, center
        self.right_arm_state = "center"
        self.last_left_state = "center"
        self.last_right_state = "center"
        self.alternating_detected = False
        
        # 動作檢測參數
        self.arm_extension_threshold = 130  # 手臂伸直角度閾值（進一步降低）
        self.shoulder_angle_threshold = 40  # 肩膀角度閾值（放寬）
        self.swing_angle_threshold = 8     # 擺動角度閾值（進一步降低）
        
        # 輪流擺動檢測優化參數
        self.state_change_buffer = []  # 狀態變化緩衝區
        self.buffer_size = 5  # 緩衝區大小
        self.alternating_count = 0  # 輪流擺動計數
        self.min_alternating_count = 2  # 最小輪流擺動次數
        
        # 品質評分參數
        self.quality_thresholds = {
            'excellent': 80,  # 優秀（降低要求）
            'good': 65,       # 良好
            'fair': 50,       # 一般
            'poor': 35        # 需改進
        }
        
        # 時間更新間隔
        self.update_interval = 0.1  # 100ms更新一次
        
    def reset_state(self):
        """重置檢測狀態"""
        self.detection_active = False
        self.start_time = None
        self.accumulated_time = 0
        self.last_update_time = 0
        self.quality_score = 0
        self.left_arm_state = "center"
        self.right_arm_state = "center"
        self.last_left_state = "center"
        self.last_right_state = "center"
        self.alternating_detected = False
        self.state_change_buffer = []
        self.alternating_count = 0
        logger.info("雙手輪流擺動熱身運動狀態已重置")
    
    def set_target_time(self, target_time):
        """設置目標時間"""
        self.target_time = target_time
        logger.info(f"目標時間設置為: {target_time}秒")
    
    def calculate_arm_extension(self, shoulder, elbow, wrist):
        """計算手臂伸直程度"""
        if any(np.isnan(point).any() for point in [shoulder, elbow, wrist]):
            return 0, False
        
        # 計算上臂向量（肩膀到肘部）
        upper_arm = elbow - shoulder
        # 計算前臂向量（肘部到手腕）
        forearm = wrist - elbow
        
        # 計算兩向量的夾角
        dot_product = np.dot(upper_arm, forearm)
        norms = np.linalg.norm(upper_arm) * np.linalg.norm(forearm)
        
        if norms == 0:
            return 0, False
        
        cos_angle = np.clip(dot_product / norms, -1.0, 1.0)
        angle = np.degrees(np.arccos(cos_angle))
        
        # 判斷是否伸直（角度接近180度）
        is_extended = angle >= self.arm_extension_threshold
        
        return angle, is_extended
    
    def calculate_shoulder_angle(self, left_shoulder, right_shoulder, left_wrist, right_wrist):
        """計算肩膀角度（檢查是否向前伸直）"""
        if any(np.isnan(point).any() for point in [left_shoulder, right_shoulder, left_wrist, right_wrist]):
            return 0, 0
        
        # 計算肩膀中心點
        shoulder_center = (left_shoulder + right_shoulder) / 2
        
        # 計算左右手臂向量（從肩膀到手腕）
        left_arm_vector = left_wrist - left_shoulder
        right_arm_vector = right_wrist - right_shoulder
        
        # 計算水平向量（向前）
        horizontal_vector = np.array([1, 0])
        
        # 計算左右手臂與水平線的角度
        left_angle = np.degrees(np.arctan2(left_arm_vector[1], left_arm_vector[0]))
        right_angle = np.degrees(np.arctan2(right_arm_vector[1], right_arm_vector[0]))
        
        # 調整角度範圍
        left_angle = -left_angle  # 反轉y軸
        right_angle = -right_angle
        
        return left_angle, right_angle
    
    def detect_arm_swing_state(self, arm_angle):
        """檢測手臂擺動狀態"""
        if arm_angle > self.swing_angle_threshold:
            return "up"
        elif arm_angle < -self.swing_angle_threshold:
            return "down"
        else:
            return "center"
    
    def detect_alternating_motion(self, left_state, right_state):
        """檢測是否為輪流擺動（優化版本）"""
        # 記錄當前狀態組合
        current_state = (left_state, right_state)
        
        # 添加到緩衝區
        self.state_change_buffer.append(current_state)
        if len(self.state_change_buffer) > self.buffer_size:
            self.state_change_buffer.pop(0)
        
        # 檢查緩衝區中是否有輪流擺動模式
        return self.check_alternating_pattern()
    
    def check_alternating_pattern(self):
        """檢查緩衝區中的輪流擺動模式"""
        if len(self.state_change_buffer) < 3:
            return False
        
        # 檢查是否有明顯的輪流擺動模式
        alternating_patterns = 0
        
        for i in range(len(self.state_change_buffer) - 1):
            left_curr, right_curr = self.state_change_buffer[i]
            left_next, right_next = self.state_change_buffer[i + 1]
            
            # 檢查是否有狀態變化且呈現輪流模式
            if self.is_alternating_change(left_curr, right_curr, left_next, right_next):
                alternating_patterns += 1
        
        # 如果在緩衝區中有足夠的輪流模式，則認為是輪流擺動
        return alternating_patterns >= 1
    
    def is_alternating_change(self, left_curr, right_curr, left_next, right_next):
        """檢查兩個狀態之間是否為輪流變化"""
        # 檢查是否有一隻手臂向上，另一隻向下（當前或下一個狀態）
        current_alternating = (left_curr == "up" and right_curr == "down") or \
                             (left_curr == "down" and right_curr == "up")
        next_alternating = (left_next == "up" and right_next == "down") or \
                          (left_next == "down" and right_next == "up")
        
        # 檢查是否有手臂狀態變化
        left_changed = left_curr != left_next
        right_changed = right_curr != right_next
        
        # 如果當前或下一個狀態有輪流擺動，且有手臂狀態變化
        return (current_alternating or next_alternating) and (left_changed or right_changed)
    
    def calculate_quality_score(self, is_correct_motion):
        """計算動作品質分數（簡化版本）
        
        根據用戶要求：
        - 有目標時間持續累積的時候就給5分
        - 沒有持續的時候就給1分
        """
        if is_correct_motion:
            return 5  # 動作正確，時間持續累積時給5分
        else:
            return 1  # 動作不正確，時間不累積時給1分
    
    def update_timer(self, is_correct_motion):
        """更新計時器（修復版本）"""
        current_time = time.time()
        
        if self.start_time is None:
            self.start_time = current_time
            self.last_update_time = current_time
            return
        
        # 計算時間差
        time_delta = current_time - self.last_update_time
        
        # 如果動作正確且時間間隔足夠，累積時間
        if is_correct_motion and time_delta >= self.update_interval:
            self.accumulated_time += time_delta
            
            # 發送時間更新到前端
            progress = min(self.accumulated_time / self.target_time, 1.0)
            socketio.emit('timer_update', {
                'accumulated_time': round(self.accumulated_time, 1),
                'target_time': self.target_time,
                'progress': round(progress * 100, 1),
                'completed': self.accumulated_time >= self.target_time
            }, namespace='/exercise')
            
            # 檢查是否完成目標
            if self.accumulated_time >= self.target_time:
                self.complete_exercise()
            
            # 只有在動作正確且累積時間時才更新最後更新時間
            self.last_update_time = current_time
    
    def complete_exercise(self):
        """完成運動"""
        logger.info(f"雙手輪流擺動熱身運動完成！累積時間: {self.accumulated_time:.1f}秒")
        socketio.emit('exercise_completed', {
            'message': '恭喜！您已完成雙手輪流擺動熱身運動！',
            'exercise_type': 'Alternating Arm Swing Warmup',
            'accumulated_time': round(self.accumulated_time, 1),
            'target_time': self.target_time
        }, namespace='/exercise')
    
    def process_exercise(self, frame, annotated_frame, keypoints, angles):
        """處理雙手輪流擺動熱身運動"""
        if keypoints is None or len(keypoints) < 17:
            logger.warning("雙手輪流擺動檢測的關鍵點不足!")
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
        
        # 計算手臂伸直程度
        left_extension_angle, left_is_extended = self.calculate_arm_extension(left_shoulder, left_elbow, left_wrist)
        right_extension_angle, right_is_extended = self.calculate_arm_extension(right_shoulder, right_elbow, right_wrist)
        
        # 計算肩膀角度
        left_shoulder_angle, right_shoulder_angle = self.calculate_shoulder_angle(
            left_shoulder, right_shoulder, left_wrist, right_wrist
        )
        
        # 檢測手臂擺動狀態
        self.left_arm_state = self.detect_arm_swing_state(left_shoulder_angle)
        self.right_arm_state = self.detect_arm_swing_state(right_shoulder_angle)
        
        # 檢測輪流擺動
        self.alternating_detected = self.detect_alternating_motion(self.left_arm_state, self.right_arm_state)
        
        # 判斷是否為正確動作（大幅簡化版本）
        # 雙手輪流擺動熱身運動的要求：
        # 1. 手臂基本伸展（降低伸直要求）
        # 2. 有明顯的手臂擺動動作
        
        # 更寬鬆的手臂伸展檢查（降低角度要求）
        left_basic_extension = left_extension_angle >= 120  # 大幅降低要求
        right_basic_extension = right_extension_angle >= 120
        basic_extension_ok = left_basic_extension or right_basic_extension
        
        # 檢查是否有明顯的擺動動作（更寬鬆）
        has_clear_movement = (abs(left_shoulder_angle) > 5 or 
                             abs(right_shoulder_angle) > 5 or
                             self.left_arm_state != "center" or 
                             self.right_arm_state != "center")
        
        # 大幅簡化的正確動作判斷
        is_correct_motion = basic_extension_ok and has_clear_movement
        
        # 計算品質分數（基於動作是否正確）
        self.quality_score = self.calculate_quality_score(is_correct_motion)
        
        # 更新計時器
        self.update_timer(is_correct_motion)
        
        # 在畫面上顯示信息
        self.draw_exercise_info(annotated_frame, left_extension_angle, right_extension_angle,
                               left_shoulder_angle, right_shoulder_angle, is_correct_motion)
        
        # 發送品質分數到前端（包含運動類型信息）
        socketio.emit('pose_quality', {
            'score': self.quality_score,
            'exercise_type': 'Alternating Arm Swing Warmup'
        }, namespace='/exercise')
        
        # 更新狀態
        self.last_left_state = self.left_arm_state
        self.last_right_state = self.right_arm_state
    
    def draw_exercise_info(self, frame, left_ext_angle, right_ext_angle, 
                          left_shoulder_angle, right_shoulder_angle, is_correct):
        """在畫面上顯示運動信息"""
        height, width = frame.shape[:2]
        
        # 顯示運動名稱
        cv2.putText(frame, "Alternating Arm Swing Warmup", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # 顯示計時信息
        time_text = f"Time: {self.accumulated_time:.1f}s / {self.target_time}s"
        cv2.putText(frame, time_text, (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        # 顯示進度
        progress = min(self.accumulated_time / self.target_time, 1.0) * 100
        progress_text = f"Progress: {progress:.1f}%"
        cv2.putText(frame, progress_text, (10, 90), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        # 顯示動作狀態
        status_color = (0, 255, 0) if is_correct else (0, 0, 255)
        status_text = "Correct Motion" if is_correct else "Incorrect Motion"
        cv2.putText(frame, status_text, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        
        # 顯示手臂狀態
        cv2.putText(frame, f"Left Arm: {self.left_arm_state}", (10, 150), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Right Arm: {self.right_arm_state}", (10, 170), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # 顯示品質分數
        cv2.putText(frame, f"Quality: {self.quality_score}/5", (10, 200), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # 顯示輪流擺動狀態
        alternating_text = "Alternating: YES" if self.alternating_detected else "Alternating: NO"
        alternating_color = (0, 255, 0) if self.alternating_detected else (0, 0, 255)
        cv2.putText(frame, alternating_text, (10, 230), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, alternating_color, 2)
    
    def start_detection(self):
        """開始檢測"""
        self.detection_active = True
        self.reset_state()
        logger.info("雙手輪流擺動熱身運動檢測已開始")
    
    def stop_detection(self):
        """停止檢測"""
        self.detection_active = False
        logger.info("雙手輪流擺動熱身運動檢測已停止")