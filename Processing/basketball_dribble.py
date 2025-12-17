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

class DribbleDetector:
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
        try:
            # 確保模型文件路徑正確
            model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'yolov8n-pose.pt')
            self.pose_model = YOLO(model_path)
            logger.info("成功載入YOLO-Pose模型")
        except Exception as e:
            logger.error(f"載入YOLO-Pose模型失敗: {e}")
            raise

        # 新增計時器和模式變數
        self.mode_timer = time.time()  # 初始化計時器
        self.current_mode = "high"  # 初始模式為 high_position_dribble

    def switch_mode(self):
        """切換模式"""
        if self.current_mode == "high":
            self.current_mode = "low"
            logger.info("切換到 low_position_dribble 模式")
        else:
            self.current_mode = "high"
            logger.info("切換到 high_position_dribble 模式")
        self.mode_timer = time.time()  # 重置計時器

    def process_frame(self, frame, keypoints, start_time):
        """根據當前模式執行對應的 dribble 檢查"""
        if self.current_mode == "high":
            frame = self.high_position_dribble(frame, keypoints, start_time)
        else:
            frame = self.low_position_dribble(frame, keypoints, start_time)
            
        # 計算剩餘時間
        current_time = time.time()
        elapsed_time = current_time - self.mode_timer
        remaining_time = max(0, 30 - int(elapsed_time))  # 倒數 30 秒

        # 在影像上顯示倒數時間
        cv2.putText(frame, f"Time left: {remaining_time}s", 
                    (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 
                    1, (255, 255, 255), 2)

        # 檢查是否需要切換模式
        if elapsed_time >= 30:  # 超過 30 秒
            self.switch_mode()

        return frame

    def record_hand_coordinates(self, wrist_point):
        """
        在慣用手確認後呼叫此函式，持續將座標點記錄於對應的 list 中
        """
        if self.dominant_hand == "left":
            self.left_hand_coords.append(wrist_point)
        elif self.dominant_hand == "right":
            self.right_hand_coords.append(wrist_point)

    def draw_elbow_angle(self, frame, keypoints):
        if self.dominant_hand == "left":
            shoulder_idx = PoseLandmark.LEFT_SHOULDER
            elbow_idx = PoseLandmark.LEFT_ELBOW
            wrist_idx = PoseLandmark.LEFT_WRIST
            
        elif self.dominant_hand == "right":
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

        start_angle = 45
        end_angle = 175
        rotate_angle = angle1
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        # 顯示實際彎曲角度
        text = f"{angle:.1f}°"
        cv2.putText(frame, text, (e_x, e_y - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color=(0, 255, 255))

    def get_elbow_angle(self, shoulder, elbow, wrist):
        if not (shoulder is not None and elbow is not None and wrist is not None):
            return None  # 如果任何一個 Landmark 為 None，返回 None
            
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

    def Assisting_hand(self, frame, keypoints):
        """
        當dominant_hand確定後，檢查另一隻手(assisting hand)的肘部角度。
        若該角度在160~180度間，則在左上角顯示Assisting hand的手肘角度。
        """
        if self.dominant_hand is None:
            return

        # 判斷另一隻手為何
        if self.dominant_hand == "left":
            # dominant_hand是左手，另一隻為右手
            shoulder_idx = PoseLandmark.RIGHT_SHOULDER
            elbow_idx = PoseLandmark.RIGHT_ELBOW
            wrist_idx = PoseLandmark.RIGHT_WRIST
        else:
            # dominant_hand是右手，另一隻為左手
            shoulder_idx = PoseLandmark.LEFT_SHOULDER
            elbow_idx = PoseLandmark.LEFT_ELBOW
            wrist_idx = PoseLandmark.LEFT_WRIST

        # 檢查關鍵點是否存在
        if len(keypoints) <= max(shoulder_idx, elbow_idx, wrist_idx):
            return

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

        # # 若角度在10~180度之間，在左上角顯示並在肘部位置畫一個明顯的圈圈
        # if 10 <= angle <= 180:
        #     # 在肘部畫一個明顯的圈圈(例如紅色，半徑10像素，粗度3)
        #     cv2.circle(frame, (e_x, e_y), 10, (0, 0, 255), 3)

        #     # 顯示文字，字體加大，顏色加深(例如紅色(0,0,255))，加大字體大小與厚度
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
        if frame is None or frame.size == 0:
            logger.error("detect_dominant_hand 收到無效的 frame")
            return frame
        
        # 使用YOLO-Pose模型進行姿態檢測
        results = self.pose_model(frame, verbose=False)
        
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

    def high_position_dribble(self, frame, keypoints, start_time):
        if frame is None or frame.size == 0:
            logger.error("high_position_dribble 收到無效的 frame")
            return frame
        
        # 檢查關鍵點是否有效
        if keypoints is None or len(keypoints) == 0:
            logger.error("無效的關鍵點數據")
            return frame
        
        # 繪製骨架
        annotated_frame = frame.copy()
        
        # 檢查慣用手是否已確定
        if self.dominant_hand is None:
            return annotated_frame
            
        # 獲取關鍵點
        if self.dominant_hand == "right":
            wrist_idx = PoseLandmark.RIGHT_WRIST
            knee_idx = PoseLandmark.RIGHT_KNEE
            hip_idx = PoseLandmark.RIGHT_HIP
        else:  # "left"
            wrist_idx = PoseLandmark.LEFT_WRIST
            knee_idx = PoseLandmark.LEFT_KNEE
            hip_idx = PoseLandmark.LEFT_HIP
            
        # 檢查關鍵點索引是否有效
        if max(wrist_idx, knee_idx, hip_idx) >= len(keypoints):
            logger.error("關鍵點索引超出範圍")
            return annotated_frame
            
        wrist = keypoints[wrist_idx]
        knee = keypoints[knee_idx]
        hip = keypoints[hip_idx]
        
        # 檢查關鍵點是否有效
        if wrist is None or knee is None or hip is None:
            logger.error("關鍵點數據為空")
            return annotated_frame
            
        # 將座標轉換為整數
        wrist_x, wrist_y = int(wrist[0]), int(wrist[1])
        knee_y = int(knee[1])
        hip_y = int(hip[1])
        
        # 在 wrist_y 畫紅色圈
        cv2.circle(annotated_frame, (wrist_x, wrist_y), 10, (0, 0, 255), -1)

        # 在 knee_y 和 hip_y 畫橫軸
        cv2.line(annotated_frame, (0, knee_y), (self.width, knee_y), (255, 0, 0), 2)  # 膝蓋橫軸
        cv2.line(annotated_frame, (0, hip_y), (self.width, hip_y), (0, 255, 0), 2)  # 髖部橫軸

        # 判斷手腕位置
        if wrist_y > knee_y:
            # 手腕低於膝蓋
            cv2.putText(annotated_frame, "Wrist too low!", (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 
                        1, (0, 0, 255), 2)
            logger.warning("慣用手手腕低於膝蓋！")
        elif wrist_y < hip_y:
            # 手腕高於髖部
            cv2.putText(annotated_frame, "Wrist too high!", (10, 210), cv2.FONT_HERSHEY_SIMPLEX, 
                        1, (0, 0, 255), 2)
            logger.warning("慣用手手腕高於髖部！")
        else:
            # 手腕在髖部和膝蓋之間
            cv2.putText(annotated_frame, "Good dribble position!", (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 
                        1, (0, 255, 0), 2)
            
        return annotated_frame

    def low_position_dribble(self, frame, keypoints, start_time):
        if frame is None or frame.size == 0:
            logger.error("low_position_dribble 收到無效的 frame")
            return frame
            
        # 檢查關鍵點是否有效
        if keypoints is None or len(keypoints) == 0:
            logger.error("無效的關鍵點數據")
            return frame
        
        # 繪製骨架
        annotated_frame = frame.copy()
        
        # 檢查慣用手是否已確定
        if self.dominant_hand is None:
            return annotated_frame
            
        # 獲取關鍵點
        if self.dominant_hand == "right":
            wrist_idx = PoseLandmark.RIGHT_WRIST
            knee_idx = PoseLandmark.RIGHT_KNEE
            hip_idx = PoseLandmark.RIGHT_HIP
        else:  # "left"
            wrist_idx = PoseLandmark.LEFT_WRIST
            knee_idx = PoseLandmark.LEFT_KNEE
            hip_idx = PoseLandmark.LEFT_HIP
            
        # 檢查關鍵點索引是否有效
        if max(wrist_idx, knee_idx, hip_idx) >= len(keypoints):
            logger.error("關鍵點索引超出範圍")
            return annotated_frame
            
        wrist = keypoints[wrist_idx]
        knee = keypoints[knee_idx]
        hip = keypoints[hip_idx]
        
        # 檢查關鍵點是否有效
        if wrist is None or knee is None or hip is None:
            logger.error("關鍵點數據為空")
            return annotated_frame
            
        # 將座標轉換為整數
        wrist_x, wrist_y = int(wrist[0]), int(wrist[1])
        knee_y = int(knee[1])
        
        # 在 wrist_y 畫紅色圈
        cv2.circle(annotated_frame, (wrist_x, wrist_y), 10, (0, 0, 255), -1)

        # 在 knee_y 畫橫軸
        cv2.line(annotated_frame, (0, knee_y), (self.width, knee_y), (255, 0, 0), 2)  # 膝蓋橫軸

        # 判斷手腕位置
        if wrist_y > knee_y:
            # 手腕低於膝蓋
            cv2.putText(annotated_frame, "Position good", (10, 180), cv2.FONT_HERSHEY_SIMPLEX, 
                        1, (0, 255, 0), 2)
            logger.info("慣用手手腕低於膝蓋，位置良好！")
        else:
            # 手腕高於膝蓋
            cv2.putText(annotated_frame, "Wrist too high!", (10, 210), cv2.FONT_HERSHEY_SIMPLEX, 
                        1, (0, 0, 255), 2)
            logger.warning("慣用手手腕高於膝蓋！")
            
        return annotated_frame

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
        logger.info("重置慣用手設置，請重新選擇。")

    def release_resources(self):
        """釋放資源"""
        # 對於YOLO模型，可能不需要特別的釋放操作
        logger.info("釋放資源")


def main():
    """測試函數"""
    # 初始化攝像頭
    cap = cv2.VideoCapture(1)
    if not cap.isOpened():
        logger.error("無法開啟攝像頭")
        return
    
    # 獲取攝像頭尺寸
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # 初始化檢測器
    detector = DribbleDetector(width, height)
    start_time = time.time()
    
    try:
        while True:
            # 讀取一幀
            ret, frame = cap.read()
            if not ret:
                logger.error("無法讀取攝像頭畫面")
                break
            
            # 水平翻轉畫面，使其更直觀
            frame = cv2.flip(frame, 1)
            
            # 使用YOLO-Pose模型進行姿態檢測
            results = detector.pose_model(frame, verbose=False)
            
            # 如果檢測到人體姿態
            if len(results) > 0 and hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
                # 檢查關鍵點是否為空
                if len(results[0].keypoints) > 0 and results[0].keypoints.shape[1] > 0:
                    try:
                        # 獲取第一個檢測到的人的關鍵點
                        keypoints = results[0].keypoints.xy[0].cpu().numpy()
                        
                        # 如果已確定慣用手，處理運球動作
                        if detector.dominant_hand:
                            processed_frame = detector.process_frame(frame, keypoints, start_time)
                        else:
                            # 否則檢測慣用手
                            processed_frame = detector.detect_dominant_hand(frame)
                    except Exception as e:
                        processed_frame = frame
                        logger.error(f"處理關鍵點時出錯: {e}")
                        cv2.putText(processed_frame, f"Error: {str(e)}", (10, 30), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                else:
                    processed_frame = frame
                    cv2.putText(processed_frame, "No keypoints detected", (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                # 如果沒有檢測到人體姿態，顯示原始畫面
                processed_frame = frame
                cv2.putText(processed_frame, "No person detected", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # 顯示處理後的畫面
            cv2.imshow("Basketball Dribble Detection", processed_frame)
            
            # 按 'q' 退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
            # 按 'r' 重置
            if cv2.waitKey(1) & 0xFF == ord('r'):
                detector.reset_dominant_hand()
                logger.info("已重置檢測器")
    
    finally:
        # 釋放資源
        cap.release()
        cv2.destroyAllWindows()
        detector.release_resources()


if __name__ == "__main__":
    main()