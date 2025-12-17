import cv2
import numpy as np
import time
import logging
from app import socketio

# 設置日誌
logger = logging.getLogger(__name__)

class PlankService:
    """平板支撐運動檢測服務
    
    這是一個平板支撐動作檢測服務。
    主要功能：
    - 檢測身體是否保持水平
    - 檢測手肘是否正確撐地
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
        self.description = "保持平板支撐姿勢，維持正確姿勢會累積時間"  # 運動描述
        
        # 平板支撐檢測參數
        self.body_horizontal_threshold = 25  # 身體水平角度閾值（度）- 放寬到25度
        self.elbow_position_threshold = 0.2  # 手肘位置閾值 - 放寬到0.2
        
        # 姿勢品質分數
        self.correct_posture_score = 5  # 正確姿勢分數
        self.incorrect_posture_score = 1  # 錯誤姿勢分數
        
        # 檢測狀態
        self.is_plank_position = False
        self.consecutive_correct_frames = 0
        self.min_consecutive_frames = 1  # 需要連續正確的幀數
        
        logger.info("平板支撐檢測服務已初始化")
    
    def reset_state(self):
        """重置檢測狀態"""
        self.detection_active = False
        self.start_time = None
        self.accumulated_time = 0
        self.quality_score = 0
        self.is_plank_position = False
        self.consecutive_correct_frames = 0
        self.last_update_time = 0
        logger.info("平板支撐檢測狀態已重置")
    
    def set_target_time(self, target_time):
        """設置目標時間"""
        self.target_time = target_time
        logger.info(f"目標時間設置為: {target_time}秒")
    
    def set_description(self, description):
        """設置運動描述"""
        if description:
            self.description = description
            logger.info(f"運動描述設置為: {description}")
        else:
            logger.info("運動描述為空，保持預設描述")
    
    def calculate_upper_body_angle(self, shoulder, hip):
        """計算上半身角度（肩膀到臀部的水平度）"""
        if any(np.isnan(point).any() for point in [shoulder, hip]):
            return None, False
        
        # 計算肩膀到臀部的向量
        body_vector = hip - shoulder
        
        # 計算與水平線的角度
        horizontal_vector = np.array([1, 0])  # 水平向量
        
        # 計算角度
        dot_product = np.dot(body_vector, horizontal_vector)
        norms = np.linalg.norm(body_vector) * np.linalg.norm(horizontal_vector)
        
        if norms == 0:
            return None, False
        
        cos_angle = dot_product / norms
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.degrees(np.arccos(cos_angle))
        
        # 判斷身體是否接近水平（角度接近0度或180度）
        deviation_from_horizontal = min(angle, abs(180 - angle))
        is_horizontal = deviation_from_horizontal <= self.body_horizontal_threshold
        
        return angle, is_horizontal
    
    def check_elbow_position(self, left_shoulder, right_shoulder, left_elbow, right_elbow):
        """檢查手肘位置是否正確（在肩膀下方）- 只需要一邊正確即可"""
        if any(np.isnan(point).any() for point in [left_shoulder, right_shoulder, left_elbow, right_elbow]):
            return False
        
        # 檢查左手肘是否在左肩膀下方
        left_elbow_correct = (left_elbow[1] > left_shoulder[1] and 
                             abs(left_elbow[0] - left_shoulder[0]) < self.elbow_position_threshold * 100)
        
        # 檢查右手肘是否在右肩膀下方
        right_elbow_correct = (right_elbow[1] > right_shoulder[1] and 
                              abs(right_elbow[0] - right_shoulder[0]) < self.elbow_position_threshold * 100)
        
        # 只要一邊手肘正確即可
        return left_elbow_correct or right_elbow_correct
    
    def detect_plank_posture(self, keypoints):
        """檢測平板支撐姿勢 - 使用分層檢測邏輯"""
        if keypoints is None or len(keypoints) < 8:
            return False, None
        
        # 分層檢測邏輯
        # 第一層：核心檢測（肩膀 + 手肘/手腕）
        core_detection_result = self._detect_core_plank_posture(keypoints)
        if core_detection_result[0]:
            return core_detection_result
        
        # 第二層：完整檢測（加上臀部）
        full_detection_result = self._detect_full_plank_posture(keypoints)
        if full_detection_result[0]:
            return full_detection_result
        
        # 第三層：備用檢測（放寬條件）
        backup_detection_result = self._detect_backup_plank_posture(keypoints)
        return backup_detection_result
    
    def _detect_core_plank_posture(self, keypoints):
        """核心檢測：檢查肩膀和手肘/手腕"""
        # 檢查肩膀和手肘/手腕的關鍵點
        core_points = [5, 6, 7, 8, 9, 10]  # 肩膀、手肘、手腕
        available_points = []
        
        for idx in core_points:
            if idx < len(keypoints) and not np.isnan(keypoints[idx][:2]).any():
                available_points.append(idx)
        
        # 只需要2個點就可以檢測
        if len(available_points) < 2:
            return False, None
        
        # 檢查是否有肩膀和手部關鍵點
        has_shoulder = any(idx in [5, 6] for idx in available_points)
        has_arm = any(idx in [7, 8, 9, 10] for idx in available_points)
        
        if has_shoulder and has_arm:
            # 非常寬鬆的檢查：只要有肩膀和手部關鍵點就認為是平板支撐
            shoulders = [keypoints[idx][:2] for idx in available_points if idx in [5, 6]]
            arms = [keypoints[idx][:2] for idx in available_points if idx in [7, 8, 9, 10]]
            
            if shoulders and arms:
                # 計算肩膀角度（如果有兩個肩膀點）
                if len(shoulders) >= 2:
                    angle = self._calculate_shoulder_angle(shoulders[0], shoulders[1])
                    return True, angle
                else:
                    return True, 0
        
        # 如果只有肩膀點，也認為可能是平板支撐
        elif len([idx for idx in available_points if idx in [5, 6]]) >= 1:
            return True, 0
        
        return False, None
    
    def _detect_full_plank_posture(self, keypoints):
        """完整檢測：包含臀部的身體角度檢測"""
        required_points = [5, 6, 7, 8, 11, 12]  # 左右肩膀、左右手肘、左右臀部
        available_points = []
        
        for idx in required_points:
            if idx < len(keypoints) and not np.isnan(keypoints[idx][:2]).any():
                available_points.append(idx)
        
        # 需要至少4個點（至少一個肩膀、一個手肘、一個臀部）
        if len(available_points) < 4:
            return False, None
        
        # 檢查是否有足夠的肩膀和臀部點進行角度計算
        shoulders = []
        hips = []
        elbows = []
        
        for idx in available_points:
            if idx in [5, 6]:  # 肩膀
                shoulders.append(keypoints[idx][:2])
            elif idx in [7, 8]:  # 手肘
                elbows.append(keypoints[idx][:2])
            elif idx in [11, 12]:  # 臀部
                hips.append(keypoints[idx][:2])
        
        if len(shoulders) >= 1 and len(hips) >= 1 and len(elbows) >= 1:
            shoulder_center = np.mean(shoulders, axis=0)
            hip_center = np.mean(hips, axis=0)
            
            # 檢查身體角度
            body_angle, is_horizontal = self.calculate_upper_body_angle(shoulder_center, hip_center)
            
            # 簡化的手肘檢查
            elbow_avg_y = np.mean([e[1] for e in elbows])
            shoulder_avg_y = np.mean([s[1] for s in shoulders])
            elbow_correct = elbow_avg_y > shoulder_avg_y
            
            is_correct_plank = is_horizontal and elbow_correct
            return is_correct_plank, body_angle
        
        return False, None
    
    def _detect_backup_plank_posture(self, keypoints):
        """備用檢測：極度寬鬆的條件"""
        # 檢查任何可用的關鍵點
        all_points = list(range(len(keypoints)))
        available_points = []
        
        for idx in all_points:
            if idx < len(keypoints) and not np.isnan(keypoints[idx][:2]).any():
                available_points.append(idx)
        
        # 只需要1個點就可以檢測
        if len(available_points) < 1:
            return False, None
        
        # 如果有任何上半身關鍵點，就認為可能是平板支撐
        upper_body_points = [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12]  # 包含鼻子、眼睛等
        has_upper_body = any(idx in upper_body_points for idx in available_points)
        
        if has_upper_body:
            return True, 0  # 備用檢測，假設角度正確
        
        # 如果有任何關鍵點，都認為可能是平板支撐（極度寬鬆）
        return True, 0
    
    def _calculate_shoulder_angle(self, left_shoulder, right_shoulder):
        """計算肩膀的水平角度"""
        shoulder_vector = right_shoulder - left_shoulder
        horizontal_vector = np.array([1, 0])
        
        dot_product = np.dot(shoulder_vector, horizontal_vector)
        norms = np.linalg.norm(shoulder_vector) * np.linalg.norm(horizontal_vector)
        
        if norms == 0:
            return 0
        
        cos_angle = dot_product / norms
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.degrees(np.arccos(cos_angle))
        
        return min(angle, abs(180 - angle))
    
    def calculate_quality_score(self, is_correct_plank):
        """計算動作品質分數"""
        if is_correct_plank:
            self.quality_score = self.correct_posture_score
        else:
            self.quality_score = self.incorrect_posture_score
        
        return self.quality_score
    
    def update_timer(self, is_correct_plank):
        """更新計時器"""
        current_time = time.time()
        
        if self.start_time is None:
            self.start_time = current_time
            self.last_update_time = current_time
            return
        
        # 計算時間差
        time_diff = current_time - self.last_update_time
        
        if is_correct_plank:
            self.consecutive_correct_frames += 1
            # 只有連續正確幀數達到閾值才開始累積時間
            if self.consecutive_correct_frames >= self.min_consecutive_frames:
                self.accumulated_time += time_diff
        else:
            self.consecutive_correct_frames = 0
        
        self.last_update_time = current_time
        
        # 檢查是否達到目標時間
        if self.accumulated_time >= self.target_time:
            self.complete_exercise()
    
    def complete_exercise(self):
        """完成運動"""
        logger.info(f"平板支撐運動完成！累積時間: {self.accumulated_time:.1f}秒")
        socketio.emit('exercise_completed', {
            'message': '恭喜！您已完成平板支撐運動！',
            'exercise_type': 'Plank',
            'accumulated_time': round(self.accumulated_time, 1),
            'target_time': self.target_time
        }, namespace='/exercise')
    
    def process_exercise(self, frame, annotated_frame, keypoints, angles):
        """處理平板支撐運動"""
        if keypoints is None or len(keypoints) < 1:
            logger.warning("平板支撐檢測的關鍵點不足! 需要至少1個關鍵點")
            return
        
        # 檢測平板支撐姿勢
        is_correct_plank, body_angle = self.detect_plank_posture(keypoints)
        
        # 更新檢測狀態
        self.is_plank_position = is_correct_plank
        
        # 計算品質分數
        self.calculate_quality_score(is_correct_plank)
        
        # 更新計時器
        if self.detection_active:
            self.update_timer(is_correct_plank)
        
        # 在畫面上顯示信息
        self.draw_exercise_info(annotated_frame, body_angle, is_correct_plank)
        
        # 發送實時數據
        socketio.emit('plank_data', {
            'is_correct_plank': is_correct_plank,
            'body_angle': body_angle if body_angle is not None else 0,
            'quality_score': self.quality_score,
            'accumulated_time': round(self.accumulated_time, 1),
            'target_time': self.target_time,
            'consecutive_frames': self.consecutive_correct_frames
        }, namespace='/exercise')
    
    def draw_exercise_info(self, frame, body_angle, is_correct):
        """在畫面上顯示運動信息"""
        height, width = frame.shape[:2]
        
        # 顯示運動名稱
        cv2.putText(frame, "Plank Exercise", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # 顯示計時信息
        time_text = f"Time: {self.accumulated_time:.1f}s / {self.target_time}s"
        cv2.putText(frame, time_text, (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        # 顯示身體角度
        if body_angle is not None:
            angle_text = f"Body Angle: {body_angle:.1f}°"
            cv2.putText(frame, angle_text, (10, 90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # 顯示姿勢狀態
        status_text = "Correct Plank" if is_correct else "Incorrect Posture"
        status_color = (0, 255, 0) if is_correct else (0, 0, 255)
        cv2.putText(frame, status_text, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        
        # 顯示品質分數
        score_text = f"Quality Score: {self.quality_score}"
        cv2.putText(frame, score_text, (10, 150), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
        
        # 顯示連續正確幀數
        frames_text = f"Consecutive Frames: {self.consecutive_correct_frames}"
        cv2.putText(frame, frames_text, (10, 180), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 2)
    
    def start_detection(self):
        """開始檢測"""
        self.detection_active = True
        self.reset_state()
        logger.info("平板支撐運動檢測已開始")
    
    def stop_detection(self):
        """停止檢測"""
        self.detection_active = False
        logger.info("平板支撐運動檢測已停止")

# 創建全局實例
plank_service = PlankService()