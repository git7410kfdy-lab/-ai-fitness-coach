from .pose_detector_base import PoseDetectorBase, PoseLandmark
import cv2
import time
import numpy as np
import logging

"""
這邊是寫排球動作的低手接球 主要判斷手腕是否合在一起並且 手肘要伸直 140 -175度之間，維持20-30秒
還沒有寫測試 也沒有血 VolleyballService 的單元 但你basketball_serverice  是寫投籃 這邊看看你有沒有要再修正名稱
在幫我看一下 謝謝
"""

# 配置logger
logger = logging.getLogger(__name__)

class LowhandDetector(PoseDetectorBase):
    """排球低手接球檢測器"""
    
    def __init__(self, width, height):
        super().__init__(width, height)
        self.correct_posture_start_time = None
        self.total_correct_time = 0
        self.target_time = 25.0  # 目標維持時間 25 秒
        self.is_posture_correct = False
        self.success_count = 0  # 成功完成的次數
        self.last_completed = False  # 上次是否已完成
        
    def detect_and_display_landmarks(self, frame):
        """檢測並顯示關鍵點，實現低手接球檢測"""
        try:
            # 使用基類的姿勢檢測方法
            keypoints, frame = self.get_yolo_keypoints(frame)
            
            if keypoints is None:
                # 即使沒有檢測到姿勢也要顯示計數
                self.display_count_and_status(frame)
                cv2.putText(frame, "No pose detected", (10, 130), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
                return frame
            
            # 提取手腕、手肘、肩膀的關鍵點
            left_wrist = keypoints[PoseLandmark.LEFT_WRIST]
            right_wrist = keypoints[PoseLandmark.RIGHT_WRIST]
            left_elbow = keypoints[PoseLandmark.LEFT_ELBOW]
            right_elbow = keypoints[PoseLandmark.RIGHT_ELBOW]
            left_shoulder = keypoints[PoseLandmark.LEFT_SHOULDER]
            right_shoulder = keypoints[PoseLandmark.RIGHT_SHOULDER]
            
            # 繪製骨架線條
            self.draw_skeleton(frame, keypoints)
            
            # 計算並顯示手肘角度（縮小字體）
            left_elbow_angle = self.calculate_angle(left_shoulder, left_elbow, left_wrist)
            right_elbow_angle = self.calculate_angle(right_shoulder, right_elbow, right_wrist)
            
            # 在手肘位置顯示角度（更小的字體）
            cv2.putText(frame, f"L: {left_elbow_angle:.0f}°", 
                       (int(left_elbow[0]), int(left_elbow[1]) - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
            cv2.putText(frame, f"R: {right_elbow_angle:.0f}°", 
                       (int(right_elbow[0]), int(right_elbow[1]) - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
            
            # 計算手腕之間的距離
            wrist_distance = np.sqrt((left_wrist[0] - right_wrist[0])**2 + 
                                   (left_wrist[1] - right_wrist[1])**2)
            
            # 判斷是否為正確的低手接球姿勢
            # 條件：手腕距離小於100像素，且兩個手肘角度都在140-175度之間
            wrists_close = wrist_distance < 100
            left_angle_correct = 140 <= left_elbow_angle <= 175
            right_angle_correct = 140 <= right_elbow_angle <= 175
            
            current_posture_correct = wrists_close and left_angle_correct and right_angle_correct
            
            # 顯示姿勢狀態（縮小）
            status_color = (0, 255, 0) if current_posture_correct else (0, 0, 255)
            status_text = "OK" if current_posture_correct else "Fix"
            cv2.putText(frame, f"Posture: {status_text}", (10, 120), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, status_color, 1)
            
            # ==================== 計數邏輯 ====================
            current_time = time.time()
            
            if current_posture_correct:
                if not self.is_posture_correct:
                    # 剛開始正確姿勢
                    self.correct_posture_start_time = current_time
                    self.is_posture_correct = True
                    self.last_completed = False  # 重置完成標記
                    logger.info("開始低手接球姿勢計時")
                else:
                    # 持續正確姿勢
                    hold_time = current_time - self.correct_posture_start_time
                    self.total_correct_time = hold_time
                    
                    # *** 關鍵計數邏輯 ***
                    # 當達到目標時間且還沒有計數時，進行計數
                    if hold_time >= self.target_time and not self.last_completed:
                        self.success_count += 1
                        self.last_completed = True
                        logger.info(f"低手接球完成！第 {self.success_count} 次成功")
            else:
                if self.is_posture_correct:
                    # 姿勢變為不正確，重置計時但保持計數
                    self.is_posture_correct = False
                    self.correct_posture_start_time = None
                    self.total_correct_time = 0
                    self.last_completed = False  # 重置完成標記
                    logger.info("姿勢中斷，重置計時")
            
            # 顯示所有信息
            self.display_count_and_status(frame)
            self.display_progress_bar(frame)
            
            # 在手腕位置繪製圓圈（縮小）
            cv2.circle(frame, (int(left_wrist[0]), int(left_wrist[1])), 5, (255, 0, 0), -1)
            cv2.circle(frame, (int(right_wrist[0]), int(right_wrist[1])), 5, (255, 0, 0), -1)
            
            # 繪製手腕之間的連線（更細）
            cv2.line(frame, (int(left_wrist[0]), int(left_wrist[1])), 
                    (int(right_wrist[0]), int(right_wrist[1])), (255, 255, 0), 1)
            
        except Exception as e:
            logger.error(f"檢測過程中發生錯誤: {e}")
            # 即使出錯也顯示計數信息
            self.display_count_and_status(frame)
            cv2.putText(frame, f"Error: {str(e)[:30]}", (10, 150), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 255), 1)
            
        return frame
    
    def display_count_and_status(self, frame):
        """顯示計數和狀態信息（緊湊版本）"""
        # ==================== 成功計數顯示 ====================
        # 縮小字體顯示成功次數
        count_text = f"Count: {self.success_count}"
        font_scale = 0.5
        thickness = 1
        
        # 計算文字尺寸
        (text_width, text_height), baseline = cv2.getTextSize(
            count_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        
        # 繪製背景矩形（更小）
        padding = 3
        cv2.rectangle(frame, 
                     (5 - padding, 15 - text_height - padding),
                     (5 + text_width + padding, 15 + baseline + padding),
                     (0, 0, 0), -1)  # 黑色背景
        
        # 顯示計數
        cv2.putText(frame, count_text, (5, 15), 
                   cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), thickness)
        
        # ==================== 完成提示 ====================
        if self.last_completed and self.is_posture_correct:
            celebration_text = f"GREAT! #{self.success_count}"
            cv2.putText(frame, celebration_text, (5, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
        
        # ==================== 計時信息 ====================
        # 目標時間（縮小）
        cv2.putText(frame, f"Target: {self.target_time:.0f}s", 
                   (5, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        # 當前維持時間
        current_hold_time = self.total_correct_time if self.is_posture_correct else 0
        time_color = (0, 255, 0) if current_hold_time >= self.target_time else (255, 255, 0)
        cv2.putText(frame, f"Hold: {current_hold_time:.1f}s", 
                   (5, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.4, time_color, 1)
    
    def display_progress_bar(self, frame):
        """顯示進度條（縮小版本）"""
        current_hold_time = self.total_correct_time if self.is_posture_correct else 0
        progress = min(current_hold_time / self.target_time, 1.0)
        
        # 進度條參數（縮小）
        bar_width = 150
        bar_height = 12
        bar_x = 5
        bar_y = 75
        
        # 繪製進度條背景
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), 
                     (50, 50, 50), -1)
        
        # 繪製進度條邊框
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), 
                     (255, 255, 255), 1)
        
        # 繪製進度條填充
        fill_width = int(bar_width * progress)
        if fill_width > 0:
            # 根據進度選擇顏色
            if progress >= 1.0:
                color = (0, 255, 0)  # 綠色 - 完成
            elif progress >= 0.7:
                color = (0, 255, 255)  # 黃綠色 - 接近完成
            else:
                color = (0, 165, 255)  # 橙色 - 進行中
                
            cv2.rectangle(frame, (bar_x + 1, bar_y + 1), 
                         (bar_x + fill_width - 1, bar_y + bar_height - 1), color, -1)
        
        # 顯示進度百分比（縮小）
        progress_text = f"{int(progress * 100)}%"
        cv2.putText(frame, progress_text, (bar_x + bar_width + 5, bar_y + 9), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)
    
    def get_count(self):
        """獲取成功完成的次數"""
        return self.success_count
    
    def reset_timer(self):
        """重置計時器和計數"""
        self.correct_posture_start_time = None
        self.total_correct_time = 0
        self.is_posture_correct = False
        self.success_count = 0
        self.last_completed = False
        logger.info("低手接球計時器和計數已重置")
    
    def reset_count_only(self):
        """只重置計數，保留當前計時狀態"""
        self.success_count = 0
        logger.info("低手接球計數已重置")
    
    def get_current_status(self):
        """獲取當前狀態"""
        return {
            'success_count': self.success_count,
            'current_hold_time': self.total_correct_time,
            'target_time': self.target_time,
            'is_posture_correct': self.is_posture_correct,
            'progress_percentage': (self.total_correct_time / self.target_time) * 100 if self.target_time > 0 else 0,
            'is_completed': self.last_completed,
            'remaining_time': max(0, self.target_time - self.total_correct_time) if self.is_posture_correct else self.target_time
        }

    def capture_image(self, frame, save_path="captured_image.jpg"):
        """
        使用 OpenCV 保存當前影像
        :param frame: 當前影像幀
        :param save_path: 保存影像的路徑，預設為 'captured_image.jpg'
        """
        cv2.imwrite(save_path, frame)
        logger.info(f"影像已保存至 {save_path}")

    def is_point_in_circle(self, point, center, radius):
        """檢查點是否在圓圈內"""
        return ((point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2) <= radius ** 2

    def detect_dominant_hand(self, frame):
        """檢測慣用手"""
        if frame is None or frame.size == 0:
            logger.error("detect_dominant_hand 收到無效的 frame")
            return frame
        
        # 使用YOLO-Pose模型進行姿態檢測
        results = self.pose_model(frame, conf=0.3, verbose=False)
        
        # 如果檢測到人體姿態
        if len(results) > 0 and hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
            # 檢查關鍵點是否為空
            if len(results[0].keypoints) == 0 or results[0].keypoints.shape[1] == 0:
                cv2.putText(frame, "No keypoints detected", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                return frame
                
            # 獲取第一個檢測到的人的關鍵點
            try:
                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                
                # 確保關鍵點數組有足夠的元素
                if len(keypoints) <= PoseLandmark.RIGHT_WRIST:
                    cv2.putText(frame, "Incomplete keypoints", (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    return frame
                
                # 繪製骨架
                annotated_frame = results[0].plot()
                
                # 獲取關鍵點座標
                left_wrist = keypoints[PoseLandmark.LEFT_WRIST]
                right_wrist = keypoints[PoseLandmark.RIGHT_WRIST]
                left_elbow = keypoints[PoseLandmark.LEFT_ELBOW]
                right_elbow = keypoints[PoseLandmark.RIGHT_ELBOW]
                left_shoulder = keypoints[PoseLandmark.LEFT_SHOULDER]
                right_shoulder = keypoints[PoseLandmark.RIGHT_SHOULDER]
                
                height, width = frame.shape[:2]
                left_wrist_pos = (int(left_wrist[0]), int(left_wrist[1]))
                right_wrist_pos = (int(right_wrist[0]), int(right_wrist[1]))
                
                circle_right = (int(width * 0.2), int(height * 0.5))
                circle_left = (int(width * 0.8), int(height * 0.5))
                radius = int(height * 0.1)
                
                if self.dominant_hand is None:
                    cv2.circle(annotated_frame, circle_left, radius, (0, 255, 0), 2)
                    cv2.circle(annotated_frame, circle_right, radius, (0, 0, 255), 2)
                    
                    in_left = self.is_point_in_circle(left_wrist_pos, circle_left, radius)
                    in_right = self.is_point_in_circle(right_wrist_pos, circle_right, radius)
                    
                    current_time = time.time()
                    
                    if in_left or in_right:
                        if self.hand_timer is None:
                            self.hand_timer = current_time
                        elif current_time - self.hand_timer >= 3.0:
                            self.dominant_hand = "left" if in_left else "right"
                            self.tracking_enabled = True
                            logger.info(f"已確定慣用手: {self.dominant_hand}")
                        else:
                            remaining = 3.0 - (current_time - self.hand_timer)
                    else:
                        self.hand_timer = None
                
                else:
                    if self.dominant_hand == "right":
                        angle = self.calculate_angle(
                            (right_shoulder[0], right_shoulder[1]),
                            (right_elbow[0], right_elbow[1]),
                            (right_wrist[0], right_wrist[1])
                        )
                    else:
                        angle = self.calculate_angle(
                            (left_shoulder[0], left_shoulder[1]),
                            (left_elbow[0], left_elbow[1]),
                            (left_wrist[0], left_wrist[1])
                        )
                
                return annotated_frame
            
            except Exception as e:
                logger.error(f"處理關鍵點時出錯: {e}")
                cv2.putText(frame, f"Error: {str(e)}", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
                return frame
        else:
            # 如果沒有檢測到人體姿態或關鍵點
            cv2.putText(frame, "No pose detected", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        
        return frame

    def reset_dominant_hand(self):
        """重置所有狀態變量"""
        self.dominant_hand = None
        self.hand_timer = None
        self.target_hand = None
        self.left_hand_coords = []
        self.right_hand_coords = []
        self.start_time = None
        self.assist_hand_angle_timer = None
        self.target_hand = None
        self.tracking_start = False
        self.tracking_enabled = False
        
        self.wrist_trajectory = []
        logger.info("重置慣用手設置，請重新選擇。")

    def release_resources(self):
        """釋放資源"""
        # 對於YOLO模型，可能不需要特別的釋放操作
        logger.info("釋放資源")