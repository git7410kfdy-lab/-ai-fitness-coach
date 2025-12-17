
import cv2
import time
import numpy as np
import math
import logging
import torch
from ultralytics import YOLO
import os

# 配置logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# YOLO-Pose 關鍵點索引定義
class PoseLandmark:
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
    # 為了與原代碼兼容，添加 LEFT_INDEX 和 RIGHT_INDEX
    LEFT_INDEX = 9  # 使用左手腕代替
    RIGHT_INDEX = 10  # 使用右手腕代替

class BasketballService:
    _instance = None
    _model = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = BasketballService()
        return cls._instance
    
    @classmethod
    def get_model(cls):
        if cls._model is None:
            try:
                # 確保模型文件路徑正確
                model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'yolov8n-pose.pt')
                cls._model = YOLO(model_path)
                logger.info("成功載入YOLO-Pose模型")
            except Exception as e:
                logger.error(f"載入YOLO-Pose模型失敗: {e}")
                raise
        return cls._model
    
    def __init__(self):
        self.detector_instances = {}  # 使用字典存儲不同會話的檢測器實例
    
    def get_detector(self, session_id, width, height):
        """獲取或創建特定會話的檢測器實例"""
        if session_id not in self.detector_instances:
            self.detector_instances[session_id] = ShootingDetector(width, height)
        return self.detector_instances[session_id]
    
    def remove_detector(self, session_id):
        """移除特定會話的檢測器實例"""
        if session_id in self.detector_instances:
            detector = self.detector_instances[session_id]
            detector.release_resources()
            del self.detector_instances[session_id]
            return True
        return False
    
    def reset_detector(self, session_id):
        """重置特定會話的檢測器"""
        if session_id in self.detector_instances:
            self.detector_instances[session_id].reset_dominant_hand()
            return True
        return False
    
    def get_count(self, session_id):
        """獲取特定會話的投籃次數"""
        if session_id in self.detector_instances:
            return self.detector_instances[session_id].shooting_count
        return 0

class ShootingDetector:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.dominant_hand = None
        self.hand_timer = None
        self.stroke_count = 0
        
        self.tracking_enabled = False
        self.target_hand = None
        self.tracking_start = False
        self.tracking_enabled = False
        self.left_hand_coords = []
        self.right_hand_coords = []
        self.start_time = None
        self.assist_hand_angle_timer = None
        
        # 載入 YOLO-Pose 模型
        self.pose_model = BasketballService.get_model()
            
        self.last_shooting_time = 0  # 初始化為 0 而不是 None
        # 新增計時器和模式變數
        self.mode_timer = time.time()  # 初始化計時器
        self.current_mode = "shoot done"  # 初始模式為 high_position_dribble
        # 初始化手腕軌跡列表
        self.wrist_trajectory = []  # 用於記錄手腕的移動軌跡
        # 初始化投籃次數
        self.shooting_count = 0
        # 初始化準備狀態
        self.ready_for_shoot = False
        self.shooting_in_progress = False
        self.prep_start_time = None

    def detect_and_display_landmarks(self, frame):
        """檢測並顯示關鍵點"""
        if frame is None or frame.size == 0:
            logger.error("detect_and_display_landmarks 收到無效的 frame")
            return frame
        
        # 水平翻轉畫面，使其更直觀
        frame = cv2.flip(frame, 1)
        
        # 使用YOLO-Pose模型進行姿態檢測
        results = self.pose_model(frame, conf=0.3, verbose=False)
        
        # 如果檢測到人體姿態
        if len(results) > 0 and hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
            # 檢查關鍵點是否為空
            if len(results[0].keypoints) > 0 and results[0].keypoints.shape[1] > 0:
                try:
                    # 獲取第一個檢測到的人的關鍵點
                    keypoints = results[0].keypoints.xy[0].cpu().numpy()
                    
                    # 如果已確定慣用手，處理投籃動作
                    if self.dominant_hand:
                        processed_frame, shooting_completed = self.shooting_action_motion(frame, keypoints)
                        
                        # 如果完成一次投籃動作，檢查時間間隔增加計數
                        current_time = time.time()
                        # 確保 last_shooting_time 不是 None
                        if shooting_completed and (current_time - self.last_shooting_time > 2):  # 限制 2 秒內只能記錄一次
                            self.shooting_count += 1
                            self.last_shooting_time = current_time  # 更新上一次完成投籃的時間
                            logger.info(f"投籃次數: {self.shooting_count}")
                            
                            # 重置手腕軌跡
                            self.wrist_trajectory = []
                        
                        # 顯示投籃次數
                        cv2.putText(processed_frame, f"Shooting Count: {self.shooting_count}", 
                                    (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 
                                    1, (255, 255, 255), 2)
                        
                        return processed_frame
                    else:
                        # 否則檢測慣用手
                        return self.detect_dominant_hand(frame)
                except Exception as e:
                    # 減少錯誤日誌輸出頻率
                    if not hasattr(self, 'keypoint_error_count'):
                        self.keypoint_error_count = 0
                    self.keypoint_error_count += 1
                    if self.keypoint_error_count % 50 == 0:  # 每50次錯誤記錄一次
                        logger.error(f"處理關鍵點時出錯: {e} (第{self.keypoint_error_count}次)")
                        cv2.putText(frame, f"Error: {str(e)}", (10, 30), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    return frame
            else:
                cv2.putText(frame, "No keypoints detected", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        else:
            # 如果沒有檢測到人體姿態，顯示原始畫面
            cv2.putText(frame, "No person detected", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
        return frame

    def process_frame(self, frame, keypoints, target_reps):
        """處理每一幀影像，檢測投籃動作並計算完成次數"""
        # 呼叫 shooting_action_motion 方法檢測投籃動作
        frame, shooting_completed = self.shooting_action_motion(frame, keypoints)

        # 如果完成一次投籃動作，檢查時間間隔增加計數
        current_time = time.time()
        if shooting_completed and (current_time - self.last_shooting_time > 2):  # 限制 2 秒內只能記錄一次
            self.shooting_count += 1
            self.last_shooting_time = current_time  # 更新上一次完成投籃的時間
            logger.info(f"投籃次數: {self.shooting_count}")

            # 重置手腕軌跡
            self.wrist_trajectory = []

            if self.shooting_count >= target_reps:
                # 減少日誌輸出頻率
                if not hasattr(self, 'target_completed_logged') or not self.target_completed_logged:
                    logger.info("目標次數已完成！")
                    self.target_completed_logged = True

        return frame

    def capture_image(self, frame, save_path="captured_image.jpg"):
        """
        使用 OpenCV 保存當前影像
        :param frame: 當前影像幀
        :param save_path: 保存影像的路徑，預設為 'captured_image.jpg'
        """
        cv2.imwrite(save_path, frame)
        # 減少影像保存日誌輸出
        if not hasattr(self, 'image_save_count'):
            self.image_save_count = 0
        self.image_save_count += 1
        if self.image_save_count % 10 == 0:  # 每10次保存記錄一次
            logger.info(f"影像已保存至 {save_path} (第{self.image_save_count}次)")

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

    def is_point_in_circle(self, point, center, radius):
        """檢查點是否在圓圈內"""
        return ((point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2) <= radius ** 2

    def detect_dominant_hand(self, frame):
        """檢測慣用手"""
        if frame is None or frame.size == 0:
            # 減少錯誤日誌輸出頻率
            if not hasattr(self, 'invalid_frame_count'):
                self.invalid_frame_count = 0
            self.invalid_frame_count += 1
            if self.invalid_frame_count % 100 == 0:  # 每100次錯誤記錄一次
                logger.error(f"detect_dominant_hand 收到無效的 frame (第{self.invalid_frame_count}次)")
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
                
                # 檢查關鍵點數組是否有足夠的元素
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

    def shooting_action_motion(self, frame, keypoints):
        va_angle = 70
        right_angle = 100
        max_angle = 180
        min_stretch_angle = 165  # 下一個動作的最小角度
        # 初始化完成狀態
        shooting_completed = False
        
        if frame is None or frame.size == 0:
            # 減少錯誤日誌輸出頻率
            if not hasattr(self, 'shooting_invalid_frame_count'):
                self.shooting_invalid_frame_count = 0
            self.shooting_invalid_frame_count += 1
            if self.shooting_invalid_frame_count % 100 == 0:  # 每100次錯誤記錄一次
                logger.error(f"shooting_action_motion 收到無效的 frame (第{self.shooting_invalid_frame_count}次)")
            return frame, False  # 返回原始 frame 和 False
        
        # 檢查關鍵點是否有效
        if keypoints is None or len(keypoints) == 0:
            # 減少錯誤日誌輸出頻率
            if not hasattr(self, 'invalid_keypoints_count'):
                self.invalid_keypoints_count = 0
            self.invalid_keypoints_count += 1
            if self.invalid_keypoints_count % 100 == 0:  # 每100次錯誤記錄一次
                logger.error(f"無效的關鍵點數據 (第{self.invalid_keypoints_count}次)")
            return frame, False
        
        # 繪製骨架
        annotated_frame = frame.copy()
        
        # 檢查慣用手是否已確定
        if self.dominant_hand is None:
            return annotated_frame, False
            
        # 獲取關鍵點
        if self.dominant_hand == "left":
            shoulder_idx = PoseLandmark.LEFT_SHOULDER
            elbow_idx = PoseLandmark.LEFT_ELBOW
            wrist_idx = PoseLandmark.LEFT_WRIST
            hip_idx = PoseLandmark.LEFT_HIP
            top_idx = PoseLandmark.LEFT_INDEX
        else:  # "right"
            shoulder_idx = PoseLandmark.RIGHT_SHOULDER
            elbow_idx = PoseLandmark.RIGHT_ELBOW
            wrist_idx = PoseLandmark.RIGHT_WRIST
            hip_idx = PoseLandmark.RIGHT_HIP
            top_idx = PoseLandmark.RIGHT_INDEX
            
        # 檢查關鍵點索引是否有效
        if max(shoulder_idx, elbow_idx, wrist_idx, hip_idx, top_idx) >= len(keypoints):
            logger.error("關鍵點索引超出範圍")
            return annotated_frame, False
            
        shoulder = keypoints[shoulder_idx]
        elbow = keypoints[elbow_idx]
        wrist = keypoints[wrist_idx]
        hip = keypoints[hip_idx]
        top = keypoints[top_idx]
        
        # 檢查關鍵點是否有效
        if shoulder is None or elbow is None or wrist is None or hip is None or top is None:
            logger.error("關鍵點數據為空")
            return annotated_frame, False
            
        # 將座標轉換為整數
        s_x, s_y = int(shoulder[0]), int(shoulder[1])
        e_x, e_y = int(elbow[0]), int(elbow[1])
        w_x, w_y = int(wrist[0]), int(wrist[1])
        h_x, h_y = int(hip[0]), int(hip[1])
        top_x, top_y = int(top[0]), int(top[1])
        
        v1 = (s_x - e_x, s_y - e_y)
        
        # 計算角度
        elbow_angle = self.calculate_angle((s_x, s_y), (e_x, e_y), (w_x, w_y))
        shoulder_angle = self.calculate_angle((h_x, h_y), (s_x, s_y), (e_x, e_y))
        wrist_angle = self.calculate_angle((e_x, e_y), (w_x, w_y), (top_x, top_y))
        
        # 在影像上繪製角度
        cv2.putText(annotated_frame, f"Elbow Angle: {int(elbow_angle)}°", (e_x, e_y - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(annotated_frame, f"Shoulder Angle: {int(shoulder_angle)}°", (s_x, s_y - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                    
        # 繪製關節點和連接線
        cv2.circle(annotated_frame, (s_x, s_y), 2, (0, 0, 255), 2)  # 肩膀
        cv2.circle(annotated_frame, (e_x, e_y), 2, (0, 255, 0), 2)  # 手肘
        cv2.circle(annotated_frame, (w_x, w_y), 2, (255, 0, 0), 2)  # 手腕
        cv2.line(annotated_frame, (s_x, s_y), (e_x, e_y), (255, 255, 255), 2)  # 肩膀到手肘
        cv2.line(annotated_frame, (e_x, e_y), (w_x, w_y), (255, 255, 255), 2)  # 手肘到手腕

        # 第一階段：檢查是否維持預備動作 3 秒
        if (
            elbow_angle < right_angle
            and elbow_angle > va_angle
            and shoulder_angle > va_angle
            and shoulder_angle < right_angle
            and wrist_angle > va_angle
        ):
            if not hasattr(self, "prep_start_time") or self.prep_start_time is None:
                self.prep_start_time = time.time()  # 記錄開始時間
            # 計算已經過的時間
            elapsed_time = time.time() - self.prep_start_time
            # 如果已經維持 3 秒，進入下一階段
            if elapsed_time >= 3.0:
                logger.info("投籃動作預備完成，進入下一階段")
                cv2.putText(annotated_frame, "Ready for shooting!", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                self.prep_start_time = None  # 重置計時器
                self.ready_for_shoot = True  # 標記準備完成
            else:
                # 顯示倒數時間
                remaining_time = 3.0 - elapsed_time
                cv2.putText(annotated_frame, f"Time count down: {remaining_time:.1f}s", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        else:
            # 如果條件不滿足，重置計時器
            self.prep_start_time = None

        # 第二階段：檢查是否完成伸展動作
        if hasattr(self, "ready_for_shoot") and self.ready_for_shoot:
            self.wrist_trajectory.append((w_x, w_y))  # 記錄手腕位置
            for i in range(1, len(self.wrist_trajectory)):
                cv2.line(
                    annotated_frame,
                    self.wrist_trajectory[i - 1],
                    self.wrist_trajectory[i],
                    (0, 255, 255),
                    2,)
                    
            if (shoulder_angle >= va_angle and elbow_angle >= right_angle):  # 檢查伸展角度
                logger.info("投籃動作完成！")
                self.ready_for_shoot = False  # 重置狀態
                self.shooting_in_progress = False  # 標記投籃動作已完成
                shooting_completed = True  # 標記完成一次投籃
                # 拍攝影像
                try:
                    save_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'captures')
                    os.makedirs(save_dir, exist_ok=True)
                    save_path = os.path.join(save_dir, f"shooting_completed_{int(time.time())}.jpg")
                    self.capture_image(annotated_frame, save_path=save_path)
                    logger.info(f"已拍攝完成投籃動作的影像: {save_path}")
                except Exception as e:
                    logger.error(f"拍攝影像失敗: {e}")
               
        return annotated_frame, shooting_completed


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
        self.shooting_count = 0
        self.last_shooting_time = 0  # 重置為 0 而不是 None
        self.ready_for_shoot = False
        self.wrist_trajectory = []
        logger.info("重置慣用手設置，請重新選擇。")

    def release_resources(self):
        """釋放資源"""
        # 對於YOLO模型，可能不需要特別的釋放操作
        logger.info("釋放資源")