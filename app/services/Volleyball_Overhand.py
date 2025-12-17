from .pose_detector_base import PoseDetectorBase, PoseLandmark
import cv2
import time
import numpy as np
import logging

"""
這邊是寫排球動作的高手托球 主要判斷手腕是否 超過頭頂就顯示角度 然後 手要上下 移動超過頭頂的線是完成一下
上面的測試寫在 test.py 裡面 還沒有寫計算次數的 可能要再修改 
謝謝
"""

# 配置logger
logger = logging.getLogger(__name__)

class OverhandDetector(PoseDetectorBase):
    """排球高手托球檢測器"""
    
    def __init__(self, width, height):
        super().__init__(width, height)
        self.stroke_count = 0
        self.last_above_head = False
        self.count_cooldown = 0
        self.cooldown_time = 1.0  # 1秒冷卻時間避免重複計算
        
    def detect_and_display_landmarks(self, frame):
        """檢測並顯示關鍵點，計算托球次數"""
        keypoints, frame = self.get_yolo_keypoints(frame)
        
        if keypoints is None:
            cv2.putText(frame, "No pose detected", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            return frame
        
        try:
            # 獲取關鍵點
            nose = keypoints[PoseLandmark.NOSE]
            left_wrist = keypoints[PoseLandmark.LEFT_WRIST]
            right_wrist = keypoints[PoseLandmark.RIGHT_WRIST]
            
            # 繪製頭部上方的檢測線
            if np.all(nose != 0):
                nose_x, nose_y = int(nose[0]), int(nose[1])
                line_y = nose_y - 80  # 降低檢測線高度，使其更接近頭部
                line_start = (nose_x - 100, line_y)
                line_end = (nose_x + 100, line_y)
                cv2.line(frame, line_start, line_end, (0, 255, 0), 2)
                cv2.putText(frame, "Above Head Line", (line_start[0], line_start[1] - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                # 判斷雙手是否超過檢測線
                current_above_head = (left_wrist[1] < line_y and right_wrist[1] < line_y)
                
                # 計算托球次數
                current_time = time.time()
                if current_above_head and not self.last_above_head and current_time > self.count_cooldown:
                    self.stroke_count += 1
                    self.count_cooldown = current_time + self.cooldown_time
                    logger.info(f"托球次數: {self.stroke_count}")
                
                self.last_above_head = current_above_head
                
                # 根據是否符合條件選擇顏色
                hand_color = (0, 255, 0) if current_above_head else (0, 0, 255)
                
                # 繪製骨架
                self.draw_skeleton(frame, keypoints, hand_color)
                
                # 顯示托球次數
                cv2.putText(frame, f"Count: {self.stroke_count}", (10, 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # 顯示狀態
                status = "Above Head" if current_above_head else "Below Head"
                cv2.putText(frame, f"Status: {status}", (10, 90), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, hand_color, 2)
                
        except Exception as e:
            logger.error(f"處理關鍵點時出錯: {e}")
            cv2.putText(frame, f"Error: {str(e)}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        return frame
    
    def reset_count(self):
        """重置計數"""
        self.stroke_count = 0
        self.last_above_head = False
        self.count_cooldown = 0
        logger.info("托球次數已重置")

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
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                return frame
                
            # 獲取第一個檢測到的人的關鍵點
            try:
                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                
                # 確保關鍵點數組有足夠的元素
                if len(keypoints) <= PoseLandmark.RIGHT_WRIST:
                    cv2.putText(frame, "Incomplete keypoints", (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
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
                            cv2.putText(annotated_frame, f"Hold: {remaining:.1f}s", 
                                      (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 
                                      1, (0, 255, 0), 2)
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
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                return frame
        else:
            # 如果沒有檢測到人體姿態或關鍵點
            cv2.putText(frame, "No pose detected", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
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