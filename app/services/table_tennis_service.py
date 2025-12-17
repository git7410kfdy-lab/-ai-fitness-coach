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

class TableTennisService:
    _instance = None
    _model = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = TableTennisService()
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
            self.detector_instances[session_id] = HandDominanceDetector(width, height)
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
        """獲取特定會話的揮拍次數"""
        if session_id in self.detector_instances:
            return self.detector_instances[session_id].stroke_count
        return 0

class HandDominanceDetector:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.dominant_hand = None  # 慣用手，初始為 None
        self.hand_timer = None
        self.stroke_count = 0  # 初始化計次數
        self.angle_threshold = (110, 140)  # 手肘角度範圍
        self.tracking_enabled = False
        self.last_crossed = False  # 添加標記，用於追蹤手腕是否已經過中線
        
        self.target_hand = None
        self.tracking_start = False
        self.tracking_enabled = False  # 不再檢查肘部角度條件，直接記錄手腕移動座標並繪製路徑。
        
        self.left_hand_coords = []
        self.right_hand_coords = []
        self.start_time = None  # 新增一個變數紀錄dominan_hand確定的時間
        self.assist_hand_angle_timer = None  # 初始化 assist_hand_angle_timer
        
        # 使用共享模型實例
        self.pose_model = TableTennisService.get_model()

    # 從 Table_Tennis.py 複製所有方法，但移除 __init__ 中的模型加載部分
    def record_hand_coordinates(self, wrist_point):
        """在慣用手確認後呼叫此函式，持續將座標點記錄於對應的 list 中"""
        if self.dominant_hand == "左手":
            self.left_hand_coords.append(wrist_point)
        elif self.dominant_hand == "右手":
            self.right_hand_coords.append(wrist_point)

    # 複製其他所有方法...
    # 這裡需要複製 Table_Tennis.py 中的所有方法，包括:
    # draw_elbow_angle, get_elbow_angle, check_wrist_crossing, Assisting_hand, 
    # calculate_angle, is_point_in_circle, detect_dominant_hand, 
    # detect_and_display_landmarks, reset_dominant_hand, release_resources

    def draw_elbow_angle(self, frame, keypoints):
        if self.dominant_hand == "左手":
            shoulder_idx = PoseLandmark.LEFT_SHOULDER
            elbow_idx = PoseLandmark.LEFT_ELBOW
            wrist_idx = PoseLandmark.LEFT_WRIST
            
        elif self.dominant_hand == "右手":
            shoulder_idx = PoseLandmark.RIGHT_SHOULDER
            elbow_idx = PoseLandmark.RIGHT_ELBOW
            wrist_idx = PoseLandmark.RIGHT_WRIST
            
        else:
            return

        shoulder = keypoints[shoulder_idx]
        elbow = keypoints[elbow_idx]
        wrist = keypoints[wrist_idx]

        s_x, s_y = int(shoulder[0]), int(shoulder[1])
        e_x, e_y = int(elbow[0]), int(elbow[1])
        w_x, w_y = int(wrist[0]), int(wrist[1])

        v1 = (s_x - e_x, s_y - e_y)  # 肩->肘向量
        v2 = (w_x - e_x, w_y - e_y)  # 腕->肘向量

        def vector_angle(v1, v2):
            dot = v1[0]*v2[0] + v1[1]*v2[1]
            mag1 = (v1[0]**2 + v1[1]**2)**0.5
            mag2 = (v2[0]**2 + v2[1]**2)**0.5
            if mag1 == 0 or mag2 == 0:
                return 0, mag1, mag2
            cos_angle = dot / (mag1 * mag2)
            cos_angle = max(min(cos_angle, 1), -1)
            angle = math.degrees(math.acos(cos_angle))
            return angle, mag1, mag2

        def calc_direction_angle(v):
            rad = math.atan2(-v[1], v[0])
            deg = math.degrees(rad)
            # 將角度規範在 [0,360) 之間
            if deg < 0:
                deg += 360
            return deg

        angle, mag1, mag2 = vector_angle(v1, v2)
        angle1 = calc_direction_angle(v1)
        radius = int(mag1)
        cross = v1[0]*v2[1] - v1[1]*v2[0]
        if cross < 0:
            angle1 = (angle1 + 180) % 360  # 保證角度在 [0, 360) 之間
        overlay = frame.copy()
        alpha = 0.5

        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        # 顯示實際彎曲角度
        text = f"{angle:.1f}°"
        cv2.putText(frame, text, (e_x, e_y - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color=(0, 255, 255))



    def get_elbow_angle(self, shoulder, elbow, wrist):
        if shoulder is None or elbow is None or wrist is None:
            return None  # 如果任何一個關鍵點為 None，返回 None
        
        s_x, s_y = int(shoulder[0]), int(shoulder[1])
        e_x, e_y = int(elbow[0]), int(elbow[1])
        w_x, w_y = int(wrist[0]), int(wrist[1])

        v1 = (s_x - e_x, s_y - e_y)  # 肩->肘向量
        v2 = (w_x - e_x, w_y - e_y)  # 腕->肘向量
        
        def vector_angle(v1, v2):
            dot = v1[0] * v2[0] + v1[1] * v2[1]
            mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
            mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)
            if mag1 == 0 or mag2 == 0:
                return None  # 無法計算角度時返回 None
            cos_angle = dot / (mag1 * mag2)
            cos_angle = max(min(cos_angle, 1), -1)
            angle = math.degrees(math.acos(cos_angle))
            return angle

        return vector_angle(v1, v2)

    def check_wrist_crossing(self, frame, keypoints):
        """檢查手腕是否在肩膀中線和水平線附近，並檢查手肘角度"""
        left_shoulder = keypoints[PoseLandmark.LEFT_SHOULDER]
        right_shoulder = keypoints[PoseLandmark.RIGHT_SHOULDER]

        # 計算肩膀中線的 x 座標
        mid_x = (left_shoulder[0] + right_shoulder[0]) / 2

        # 計算肩膀水平線的 y 座標
        shoulder_y = int((left_shoulder[1] + right_shoulder[1]) / 2)

        if self.dominant_hand == "左手":
            wrist = keypoints[PoseLandmark.LEFT_WRIST]
            elbow = keypoints[PoseLandmark.LEFT_ELBOW]
            shoulder = left_shoulder
        else:
            wrist = keypoints[PoseLandmark.RIGHT_WRIST]
            elbow = keypoints[PoseLandmark.RIGHT_ELBOW]
            shoulder = right_shoulder

        wrist_x = wrist[0]
        wrist_y = wrist[1]
        
        # 計算手肘角度
        elbow_angle = self.get_elbow_angle(shoulder, elbow, wrist)
        
        # 設定檢測範圍（擴大15%）
        x_range = self.width * 0.15  # 畫面寬度的15%
        y_range = self.height * 0.15  # 畫面高度的15%
        
        # 檢查手腕是否在肩膀中線和水平線附近
        is_near_mid_x = abs(wrist_x - mid_x) <= x_range
        is_near_shoulder_y = abs(wrist_y - shoulder_y) <= y_range
        

        # 修改這裡：檢查 elbow_angle 是否為 None
        # 當手腕在肩膀中線和水平線附近，且手肘角度在指定範圍時增加計數
        if is_near_mid_x and is_near_shoulder_y and elbow_angle is not None and 30 <= elbow_angle <= 170:
            if not self.last_crossed:  # 只有當上次沒有計數時才增加計數
                self.stroke_count += 1
                logger.info(f"手腕在肩膀中線和水平線附近且手肘角度在範圍內，增加次數: {self.stroke_count}")
                self.last_crossed = True  # 設置標誌，表示已經計數
        else:
            self.last_crossed = False

        # 繪製中線及其範圍
        cv2.line(frame, (int(mid_x), 0), (int(mid_x), self.height), (255, 0, 0), 2, cv2.LINE_AA)

        # 繪製水平線及其範圍
        left_x = 0
        right_x = self.width
        cv2.line(frame, (left_x, shoulder_y), (right_x, shoulder_y), (0, 255, 0), 2, cv2.LINE_AA)
        
        # 繪製檢測區域（十字交叉區域）
        overlay = frame.copy()
        
        if self.dominant_hand == "右手":
            cv2.rectangle(overlay, 
                    (int(mid_x), 0), 
                    (int(mid_x + x_range), int(shoulder_y)), 
                    (0, 255, 255), -1)
        else:
            # 繪製第二象限（左上）的矩形
            cv2.rectangle(overlay, 
                        (int(mid_x - x_range), 0), 
                        (int(mid_x), int(shoulder_y)), 
                        (0, 255, 255), -1)
        
        # 添加透明效
                # 添加透明效果
        alpha = 0.3
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        
        # 繪製手腕位置
        cv2.circle(frame, (int(wrist_x), int(wrist_y)), 10, (0, 0, 255), -1)
        
        # 顯示手肘角度
        if elbow_angle is not None:
            cv2.putText(frame, f"Elbow: {elbow_angle:.1f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # 顯示計數
        cv2.putText(frame, f"Count: {self.stroke_count}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return frame

    def Assisting_hand(self, frame, keypoints):
        """
        當dominant_hand確定後，檢查另一隻手(assisting hand)的肘部角度。
        若該角度在160~180度間，則在左上角顯示Assisting hand的手肘角度。
        """
        if self.dominant_hand is None:
            return

        # 判斷另一隻手為何
        if self.dominant_hand == "左手":
            # dominant_hand是左手，另一隻為右手
            shoulder_idx = PoseLandmark.RIGHT_SHOULDER
            elbow_idx = PoseLandmark.RIGHT_ELBOW
            wrist_idx = PoseLandmark.RIGHT_WRIST
        else:
            # dominant_hand是右手，另一隻為左手
            shoulder_idx = PoseLandmark.LEFT_SHOULDER
            elbow_idx = PoseLandmark.LEFT_ELBOW
            wrist_idx = PoseLandmark.LEFT_WRIST

        shoulder = keypoints[shoulder_idx]
        elbow = keypoints[elbow_idx]
        wrist = keypoints[wrist_idx]

        # 檢查關鍵點是否有效
        if shoulder is None or elbow is None or wrist is None:
            return

        s_x, s_y = int(shoulder[0]), int(shoulder[1])
        e_x, e_y = int(elbow[0]), int(elbow[1])
        w_x, w_y = int(wrist[0]), int(wrist[1])

        v1 = (s_x - e_x, s_y - e_y)  # 肩->肘向量
        v2 = (w_x - e_x, w_y - e_y)  # 腕->肘向量
        
        def vector_angle(v1, v2):
            dot = v1[0]*v2[0] + v1[1]*v2[1]
            mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
            mag2 = math.sqrt(v2[0]**2 + v2[1]**2)
            if mag1 == 0 or mag2 == 0:
                return 0
            cos_angle = dot / (mag1 * mag2)
            cos_angle = max(min(cos_angle, 1), -1)
            angle = math.degrees(math.acos(cos_angle))
            return angle

        angle = vector_angle(v1, v2)

        # 若需要顯示輔助手的角度，可以取消下面的註釋
        # if 10 <= angle <= 180:
        #     cv2.circle(frame, (e_x, e_y), 10, (0, 0, 255), 3)
        #     text = f"Assisting hand elbow angle: {angle:.1f}°"
        #     cv2.putText(frame, text, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 
        #                 1, (0, 0, 255), 2)


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
        results = self.pose_model(frame, conf=0.3, verbose=False)
        
        if len(results) > 0 and len(results[0].keypoints) > 0:
            # 獲取第一個檢測到的人的關鍵點
            keypoints = results[0].keypoints.xy[0].cpu().numpy()
            
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
                cv2.circle(frame, circle_left, radius, (0, 255, 0), 2)
                cv2.circle(frame, circle_right, radius, (0, 0, 255), 2)
                
                in_left = self.is_point_in_circle(left_wrist_pos, circle_left, radius)
                in_right = self.is_point_in_circle(right_wrist_pos, circle_right, radius)
                
                current_time = time.time()
                
                if in_left or in_right:
                    if self.hand_timer is None:
                        self.hand_timer = current_time
                    elif current_time - self.hand_timer >= 3.0:
                        self.dominant_hand = "左手" if in_left else "右手"
                        self.tracking_enabled = True
                        logger.info(f"已確定慣用手: {self.dominant_hand}")
                    else:
                        remaining = 3.0 - (current_time - self.hand_timer)
                        cv2.putText(frame, f"Hold: {remaining:.1f}s", 
                                  (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 
                                  1, (0, 255, 0), 2)
                else:
                    self.hand_timer = None
            
            else:
                if self.dominant_hand == "右手":
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
                
                cv2.putText(frame, f"Angle: {angle:.1f}", 
                          (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 
                          1, (0, 255, 0), 2)
                
                if self.angle_threshold[0] <= angle <= self.angle_threshold[1]:
                    cv2.putText(frame, "Good Position!", 
                              (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 
                              1, (0, 255, 0), 2)
                    if not self.tracking_enabled:
                        self.stroke_count += 1
                        self.tracking_enabled = True
                else:
                    cv2.putText(frame, "Adjust Position", 
                              (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 
                              1, (0, 0, 255), 2)
                    self.tracking_enabled = False
                
                cv2.putText(frame, f"Stroke Count: {self.stroke_count}", 
                          (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 
                          1, (0, 255, 0), 2)
        
        return frame




    def detect_and_display_landmarks(self, frame):
        # 使用YOLO-Pose模型進行姿態檢測
        results = self.pose_model(frame, conf=0.3, verbose=False)
        elapsed = 0  # 初始化 elapsed
        
        # 如果檢測到人體姿態
        if len(results) > 0 and len(results[0].keypoints) > 0:
            # 獲取第一個檢測到的人的關鍵點
            keypoints = results[0].keypoints.xy[0].cpu().numpy()
            
            # 可以選擇繪製關鍵點和骨架
            # for i, point in enumerate(keypoints):
            #     if point[0] > 0 and point[1] > 0:  # 確保點是有效的
            #         cv2.circle(frame, (int(point[0]), int(point[1])), 5, (0, 255, 0), -1)
            
            # 獲取左右手腕關鍵點
            left_wrist = keypoints[PoseLandmark.LEFT_WRIST]
            right_wrist = keypoints[PoseLandmark.RIGHT_WRIST]

            circle_right = (int(self.width * 0.2), int(self.height * 0.5))  # 左側圓心座標
            circle_left = (int(self.width * 0.8), int(self.height * 0.5))   # 右側圓心座標
            radius = int(self.height * 0.1)

            # 若慣用手未確定，才顯示圈圈及計時
            if self.dominant_hand is None:
                # 畫出左右圈圈
                cv2.circle(frame, circle_left, radius, (0, 255, 0), 2)   # 左側綠圈
                cv2.circle(frame, circle_right, radius, (0, 0, 255), 2)  # 右側紅圈

                # 左手腕檢測
                left_wrist_point = (int(left_wrist[0]), int(left_wrist[1]))
                # 檢測左手是否進入左側圓圈
                if (left_wrist_point[0] - circle_left[0])**2 + (left_wrist_point[1] - circle_left[1])**2 < radius**2:
                    if self.target_hand == "左手":
                        if time.time() - self.hand_timer >= 3:
                            self.dominant_hand = "左手"
                            logger.info("選定慣用手：左手")
                            self.target_hand = None
                            self.start_time = time.time()
                    else:
                        self.hand_timer = time.time()
                        self.target_hand = "左手"
                        self.start_time = time.time()

                # 右手腕檢測
                right_wrist_point = (int(right_wrist[0]), int(right_wrist[1]))
                # 檢測右手是否進入右側圓圈
                if (right_wrist_point[0] - circle_right[0])**2 + (right_wrist_point[1] - circle_right[1])**2 < radius**2:
                    if self.target_hand == "右手":
                        if time.time() - self.hand_timer >= 3:
                            self.dominant_hand = "右手"
                            logger.info("選定慣用手：右手")
                            self.target_hand = None
                            self.start_time = time.time()
                    else:
                        self.hand_timer = time.time()
                        self.target_hand = "右手"
                        self.start_time = time.time()

                # 顯示倒數計時 (當慣用手未決定時才顯示)
                if self.hand_timer and self.dominant_hand is None:
                    countdown = 3 - int(time.time() - self.hand_timer)
                    if self.target_hand == "左手":
                        cv2.putText(frame, str(countdown), (circle_left[0] - 20, circle_left[1] - 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                    elif self.target_hand == "右手":
                        cv2.putText(frame, str(countdown), (circle_right[0] - 20, circle_right[1] - 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                # 慣用手確定後，不再繪製兩側的圈圈
                # 持續追蹤該手腕座標並繪製軌跡線
                if self.dominant_hand == "左手":
                    wrist = keypoints[PoseLandmark.LEFT_WRIST]
                    dominant_angle = self.get_elbow_angle(
                        keypoints[PoseLandmark.LEFT_SHOULDER],
                        keypoints[PoseLandmark.LEFT_ELBOW],
                        wrist
                    )
                    assist_angle = self.get_elbow_angle(
                        keypoints[PoseLandmark.RIGHT_SHOULDER],
                        keypoints[PoseLandmark.RIGHT_ELBOW],
                        keypoints[PoseLandmark.RIGHT_WRIST]
                    )
                    # 修改這裡：檢查角度是否為 None
                    if (dominant_angle is not None and assist_angle is not None and 
                        85 <= dominant_angle <= 95 and 150 <= assist_angle <= 170):
                        if self.assist_hand_angle_timer is None:
                            self.assist_hand_angle_timer = time.time()  # 初始化計時器
                        elapsed = time.time() - self.assist_hand_angle_timer

                        if elapsed >= 3 and not self.tracking_start:  # 倒數完成且未啟動追蹤
                            self.tracking_enabled = True
                            self.tracking_start = True  # 標記追蹤已啟動
                    else:
                        # 條件不滿足時，僅重置倒數計時器
                        self.assist_hand_angle_timer = None

                    # 如果啟用追蹤，持續記錄手腕座標並繪製路徑
                    if self.tracking_enabled:
                        current_point = (int(wrist[0]), int(wrist[1]))
                        self.record_hand_coordinates(current_point)
                        if len(self.left_hand_coords) > 1:
                            cv2.polylines(frame, [np.array(self.left_hand_coords, dtype=np.int32)],
                                    False, (0, 255, 0), 3)
                    else:
                        # 顯示倒數計時提示
                        if self.assist_hand_angle_timer is not None:
                            countdown = 3 - (time.time() - self.assist_hand_angle_timer)
                            cv2.putText(frame, f"Countdown: {countdown:.1f}s", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
                    
                elif self.dominant_hand == "右手":
                    wrist = keypoints[PoseLandmark.RIGHT_WRIST]
                    
                    dominant_angle = self.get_elbow_angle(
                        keypoints[PoseLandmark.RIGHT_SHOULDER],
                        keypoints[PoseLandmark.RIGHT_ELBOW],
                        wrist
                    )
                    assist_angle = self.get_elbow_angle(
                        keypoints[PoseLandmark.LEFT_SHOULDER],
                        keypoints[PoseLandmark.LEFT_ELBOW],
                        keypoints[PoseLandmark.LEFT_WRIST]
                    )

                    # 修改這裡：檢查角度是否為 None
                    if (dominant_angle is not None and assist_angle is not None and 
                        85 <= dominant_angle <= 95 and 150 <= assist_angle <= 170):
                        if self.assist_hand_angle_timer is None:
                            self.assist_hand_angle_timer = time.time()  # 初始化計時器
                        elapsed = time.time() - self.assist_hand_angle_timer

                        if elapsed >= 3 and not self.tracking_start:  # 倒數完成且未啟動追蹤
                            self.tracking_enabled = True
                            self.tracking_start = True  # 標記追蹤已啟動
                    else:
                        # 條件不滿足時，僅重置倒數計時器
                        self.assist_hand_angle_timer = None

                    # 如果啟用追蹤，持續記錄手腕座標並繪製路徑
                    if self.tracking_enabled:
                        current_point = (int(wrist[0]), int(wrist[1]))
                        self.record_hand_coordinates(current_point)
                        if len(self.right_hand_coords) > 1:
                            cv2.polylines(frame, [np.array(self.right_hand_coords, dtype=np.int32)],
                                    False, (0, 255, 0), 3)
                    else:
                        # 顯示倒數計時提示
                        if self.assist_hand_angle_timer is not None:
                            countdown = 3 - (time.time() - self.assist_hand_angle_timer)
                            cv2.putText(frame, f"Countdown: {countdown:.1f}s", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
                    
                # 繪製dominant_hand的彎曲角度
                if self.dominant_hand is not None:
                    self.draw_elbow_angle(frame, keypoints)
                    # 呼叫Assisting_hand 函式繪製與顯示輔助手的角度資訊
                    self.Assisting_hand(frame, keypoints)

                    # 檢測手腕是否超過肩膀中線
                    self.check_wrist_crossing(frame, keypoints)

        return frame

        # 使用YOLO-Pose模型進行姿態檢測
        results = self.pose_model(frame, conf=0.3, verbose=False)
        elapsed = 0  # 初始化 elapsed
        
        # 如果檢測到人體姿態
        if len(results) > 0 and len(results[0].keypoints) > 0:
            # 獲取第一個檢測到的人的關鍵點
            keypoints = results[0].keypoints.xy[0].cpu().numpy()
            
            # 實現剩餘邏輯...
            
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
        self.tracking_start = False
        self.tracking_enabled = False
        self.last_crossed = False
        self.stroke_count = 0
        logger.info("重置慣用手設置，請重新選擇。")
      
      
        
    def release_resources(self):
        """釋放資源"""
        # 對於YOLO模型，可能不需要特別的釋放操作
        # 但為了保持API兼容性，我們保留此方法
        logger.info("釋放資源")