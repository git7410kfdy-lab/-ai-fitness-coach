import cv2
import numpy as np
import time
import logging
from collections import deque
from app.services.pose_detection import calculate_angle, get_pose_angles
from ultralytics import YOLO
import os
import threading
from datetime import datetime

logger = logging.getLogger(__name__)

class TaekwondoDetailService:
    """跆拳道詳細姿態偵測服務"""
    
    def __init__(self):
        self.pose_model = None
        self.angle_history = {}  # 存儲角度歷史數據
        self.velocity_history = {}  # 存儲角速度歷史數據
        self.acceleration_history = {}  # 存儲角加速度歷史數據
        self.last_angles = {}  # 上一幀的角度
        self.last_velocities = {}  # 上一幀的角速度
        self.last_timestamp = None
        self.action_count = 0
        self.current_action = "待檢測"
        self.action_confidence = 0.0
        
        # 初始化歷史數據緩衝區（保存最近30幀的數據）
        self.history_size = 30
        self.angle_joints = ['左手肘', '右手肘', '左膝蓋', '右膝蓋', '左肩膀', '右肩膀', '左髖部', '右髖部']
        
        # 影片錄製相關
        self.is_recording = False
        self.original_video_writer = None
        self.skeleton_video_writer = None
        self.recording_start_time = None
        self.recorded_frames = []
        self.skeleton_frames = []
        self.recording_fps = 15  # 降低幀率以匹配實際檢測速度
        self.recording_lock = threading.Lock()
        self.frame_timestamps = []  # 記錄每幀的時間戳
        
        # 軌跡追蹤
        self.joint_trajectories = {}  # 存儲關節軌跡
        self.trajectory_max_length = 15  # 軌跡最大長度
        
        # 速度顏色映射
        self.velocity_color_map = {
            'low': (0, 255, 0),      # 綠色 - 低速
            'medium': (0, 255, 255),  # 黃色 - 中速
            'high': (0, 165, 255),    # 橙色 - 高速
            'very_high': (0, 0, 255)  # 紅色 - 極高速
        }
        
        for joint in self.angle_joints:
            self.angle_history[joint] = deque(maxlen=self.history_size)
            self.velocity_history[joint] = deque(maxlen=self.history_size)
            self.acceleration_history[joint] = deque(maxlen=self.history_size)
        
        self.load_pose_model()
    
    def load_pose_model(self):
        """載入姿態檢測模型"""
        try:
            # 嘗試載入本地模型
            model_path = os.path.join('static', 'models', 'YOLO_MODLE', 'pose', 'yolov8n-pose.pt')
            if os.path.exists(model_path):
                self.pose_model = YOLO(model_path)
                logger.info(f"已載入本地姿態檢測模型: {model_path}")
            else:
                # 使用預設模型
                self.pose_model = YOLO('yolov8n-pose.pt')
                logger.info("已載入預設姿態檢測模型")
        except Exception as e:
            logger.error(f"載入姿態檢測模型失敗: {e}")
            raise
    
    def calculate_velocity(self, current_angle, previous_angle, time_delta):
        """計算角速度 (度/秒)"""
        if time_delta <= 0:
            return 0.0
        return (current_angle - previous_angle) / time_delta
    
    def calculate_acceleration(self, current_velocity, previous_velocity, time_delta):
        """計算角加速度 (度/秒²)"""
        if time_delta <= 0:
            return 0.0
        return (current_velocity - previous_velocity) / time_delta
    
    def smooth_data(self, data_history, window_size=5):
        """使用移動平均平滑數據"""
        if len(data_history) < window_size:
            return list(data_history)[-1] if data_history else 0.0
        
        recent_data = list(data_history)[-window_size:]
        return sum(recent_data) / len(recent_data)
    
    def detect_taekwondo_action(self, angles, velocities):
        """檢測跆拳道動作"""
        # 簡單的動作識別邏輯
        # 這裡可以根據具體需求實現更複雜的動作識別
        
        # 檢測踢腿動作
        if angles.get('左膝蓋', 0) < 90 or angles.get('右膝蓋', 0) < 90:
            if abs(velocities.get('左膝蓋', 0)) > 50 or abs(velocities.get('右膝蓋', 0)) > 50:
                return "踢腿", 0.8
        
        # 檢測出拳動作
        if angles.get('左手肘', 0) < 120 or angles.get('右手肘', 0) < 120:
            if abs(velocities.get('左手肘', 0)) > 80 or abs(velocities.get('右手肘', 0)) > 80:
                return "出拳", 0.7
        
        # 檢測防守姿勢
        if (angles.get('左手肘', 0) > 90 and angles.get('右手肘', 0) > 90 and
            angles.get('左膝蓋', 0) > 120 and angles.get('右膝蓋', 0) > 120):
            return "防守姿勢", 0.6
        
        return "基本姿勢", 0.5
    
    def process_frame(self, frame):
        """處理影像幀並返回分析結果"""
        current_time = time.time()
        
        try:
            # 使用YOLO模型進行姿態檢測
            results = self.pose_model(frame, conf=0.3, verbose=False)
            
            if len(results) > 0 and hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
                # 獲取關鍵點
                keypoints = results[0].keypoints.xy[0].cpu().numpy()
                
                # 計算角度
                angles = get_pose_angles(keypoints)
                
                # 計算時間差
                time_delta = 0.033  # 假設30fps，約33ms
                if self.last_timestamp:
                    time_delta = current_time - self.last_timestamp
                
                # 計算角速度和角加速度
                velocities = {}
                accelerations = {}
                
                for joint in self.angle_joints:
                    current_angle = angles.get(joint, 0)
                    
                    # 計算角速度
                    if joint in self.last_angles:
                        velocity = self.calculate_velocity(
                            current_angle, self.last_angles[joint], time_delta
                        )
                        velocities[joint] = velocity
                        
                        # 計算角加速度
                        if joint in self.last_velocities:
                            acceleration = self.calculate_acceleration(
                                velocity, self.last_velocities[joint], time_delta
                            )
                            accelerations[joint] = acceleration
                        else:
                            accelerations[joint] = 0.0
                    else:
                        velocities[joint] = 0.0
                        accelerations[joint] = 0.0
                    
                    # 更新歷史數據
                    self.angle_history[joint].append(current_angle)
                    self.velocity_history[joint].append(velocities[joint])
                    self.acceleration_history[joint].append(accelerations[joint])
                
                # 平滑數據
                smoothed_velocities = {}
                smoothed_accelerations = {}
                for joint in self.angle_joints:
                    smoothed_velocities[joint] = self.smooth_data(self.velocity_history[joint])
                    smoothed_accelerations[joint] = self.smooth_data(self.acceleration_history[joint])
                
                # 動作識別
                action, confidence = self.detect_taekwondo_action(angles, smoothed_velocities)
                self.current_action = action
                self.action_confidence = confidence
                
                # 更新上一幀數據
                self.last_angles = angles.copy()
                self.last_velocities = velocities.copy()
                self.last_timestamp = current_time
                
                # 創建兩個版本的幀
                # 1. 原始幀（帶基本骨架）
                original_annotated_frame = self.draw_pose_landmarks(frame.copy(), keypoints)
                
                # 2. 增強分析幀（帶速度視覺化）
                enhanced_frame = self.draw_enhanced_pose_landmarks(frame.copy(), keypoints, smoothed_velocities, angles)
                
                # 如果正在錄製，保存幀
                if self.is_recording:
                    self.save_recording_frames(original_annotated_frame, enhanced_frame)
                
                return {
                    'success': True,
                    'frame': enhanced_frame,  # 顯示增強版本
                    'original_frame': original_annotated_frame,
                    'angles': angles,
                    'velocities': smoothed_velocities,
                    'accelerations': smoothed_accelerations,
                    'action': action,
                    'confidence': confidence,
                    'count': self.action_count
                }
            else:
                return {
                    'success': False,
                    'frame': frame,
                    'message': '未檢測到姿態'
                }
                
        except Exception as e:
            logger.error(f"處理幀時出錯: {e}")
            return {
                'success': False,
                'frame': frame,
                'message': f'處理錯誤: {str(e)}'
            }
    
    def get_velocity_color(self, velocity):
        """根據角速度獲取顏色"""
        abs_velocity = abs(velocity)
        if abs_velocity < 20:
            return self.velocity_color_map['low']
        elif abs_velocity < 50:
            return self.velocity_color_map['medium']
        elif abs_velocity < 100:
            return self.velocity_color_map['high']
        else:
            return self.velocity_color_map['very_high']
    
    def update_joint_trajectories(self, keypoints, velocities):
        """更新關節軌跡"""
        # 關節索引映射
        joint_indices = {
            '左手肘': 7, '右手肘': 8,
            '左膝蓋': 13, '右膝蓋': 14,
            '左肩膀': 5, '右肩膀': 6,
            '左髖部': 11, '右髖部': 12
        }
        
        for joint_name, index in joint_indices.items():
            if index < len(keypoints):
                point = keypoints[index]
                velocity = velocities.get(joint_name, 0)
                
                if joint_name not in self.joint_trajectories:
                    self.joint_trajectories[joint_name] = deque(maxlen=self.trajectory_max_length)
                
                # 添加軌跡點（包含位置、速度和時間戳）
                trajectory_point = {
                    'position': tuple(map(int, point[:2])),
                    'velocity': velocity,
                    'timestamp': time.time()
                }
                self.joint_trajectories[joint_name].append(trajectory_point)
    
    def draw_enhanced_pose_landmarks(self, frame, keypoints, velocities, angles=None):
        """繪製增強的姿態關鍵點和骨架（包含速度視覺化）"""
        if len(keypoints) < 17:
            return frame
        
        # 如果沒有傳入angles，使用last_angles
        if angles is None:
            angles = self.last_angles
        
        # 更新軌跡
        self.update_joint_trajectories(keypoints, velocities)
        
        # 定義骨架連接和對應的關節
        skeleton_connections = [
            ([5, 7], '左肩膀'), ([7, 9], '左手肘'),  # 左臂
            ([6, 8], '右肩膀'), ([8, 10], '右手肘'),  # 右臂
            ([5, 6], None),  # 肩膀連接
            ([5, 11], '左肩膀'), ([6, 12], '右肩膀'),  # 軀幹上部
            ([11, 12], None),  # 髖部連接
            ([11, 13], '左髖部'), ([13, 15], '左膝蓋'),  # 左腿
            ([12, 14], '右髖部'), ([14, 16], '右膝蓋')  # 右腿
        ]
        
        # 繪製軌跡
        self.draw_joint_trajectories(frame)
        
        # 繪製骨架（根據速度著色）
        for connection, joint_name in skeleton_connections:
            if len(keypoints) > max(connection):
                pt1 = tuple(map(int, keypoints[connection[0]]))
                pt2 = tuple(map(int, keypoints[connection[1]]))
                
                # 根據關節速度選擇顏色
                if joint_name and joint_name in velocities:
                    color = self.get_velocity_color(velocities[joint_name])
                    thickness = max(2, min(8, int(abs(velocities[joint_name]) / 20) + 2))
                else:
                    color = (0, 255, 0)  # 預設綠色
                    thickness = 2
                
                cv2.line(frame, pt1, pt2, color, thickness)
        
        # 繪製關鍵點（根據速度著色和大小）
        joint_indices = {
            5: '左肩膀', 6: '右肩膀', 7: '左手肘', 8: '右手肘',
            11: '左髖部', 12: '右髖部', 13: '左膝蓋', 14: '右膝蓋'
        }
        
        for i, point in enumerate(keypoints):
            if len(point) >= 2:
                if i in joint_indices:
                    joint_name = joint_indices[i]
                    if joint_name in velocities:
                        color = self.get_velocity_color(velocities[joint_name])
                        radius = max(5, min(15, int(abs(velocities[joint_name]) / 15) + 5))
                    else:
                        color = (0, 0, 255)
                        radius = 5
                else:
                    color = (0, 0, 255)
                    radius = 5
                
                cv2.circle(frame, tuple(map(int, point)), radius, color, -1)
                # 添加白色邊框
                cv2.circle(frame, tuple(map(int, point)), radius + 1, (255, 255, 255), 2)
        
        # 添加速度圖例
        self.draw_velocity_legend(frame)
        
        # 添加關節角度數值顯示
        self.draw_joint_angles_on_frame(frame, keypoints, angles)
        
        return frame
    
    def draw_joint_trajectories(self, frame):
        """繪製關節軌跡（只顯示高速和極高速）"""
        for joint_name, trajectory in self.joint_trajectories.items():
            if len(trajectory) < 2:
                continue
            
            # 繪製軌跡線
            points = [point['position'] for point in trajectory]
            for i in range(1, len(points)):
                # 根據軌跡點的速度選擇顏色
                velocity = trajectory[i]['velocity']
                abs_velocity = abs(velocity)
                
                # 只繪製極高速（紅色）的軌跡
                if abs_velocity >= 100:  # 只有極高速
                    color = self.get_velocity_color(velocity)
                    
                    # 軌跡透明度隨時間衰減
                    alpha = (i / len(points)) * 0.7 + 0.3
                    thickness = max(3, int(alpha * 5))  # 增加線條粗細使其更明顯
                    
                    cv2.line(frame, points[i-1], points[i], color, thickness)
    
    def draw_velocity_legend(self, frame):
        """繪製速度圖例"""
        legend_x = frame.shape[1] - 200
        legend_y = 30
        
        # 背景
        cv2.rectangle(frame, (legend_x - 10, legend_y - 10), 
                     (legend_x + 180, legend_y + 120), (0, 0, 0), -1)
        cv2.rectangle(frame, (legend_x - 10, legend_y - 10), 
                     (legend_x + 180, legend_y + 120), (255, 255, 255), 2)
        
        # 標題
        cv2.putText(frame, "Speed Legend", (legend_x, legend_y + 15), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # 圖例項目
        legend_items = [
            ("Low (0-20deg/s)", self.velocity_color_map['low']),
            ("Med (20-50deg/s)", self.velocity_color_map['medium']),
            ("High (50-100deg/s)", self.velocity_color_map['high']),
            ("V.High (>100deg/s)", self.velocity_color_map['very_high'])
        ]
        
        for i, (text, color) in enumerate(legend_items):
            y_pos = legend_y + 35 + i * 20
            cv2.circle(frame, (legend_x + 10, y_pos), 5, color, -1)
            cv2.putText(frame, text, (legend_x + 25, y_pos + 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)
    
    def draw_joint_angles_on_frame(self, frame, keypoints, angles):
        """在影片上顯示關節角度數值"""
        if len(keypoints) < 17:
            return
        
        # 關節索引和對應的角度名稱（使用英文避免編碼問題）
        joint_angle_mapping = {
            5: ('L.Shoulder', angles.get('左肩膀', 0)),    # 左肩膀
            6: ('R.Shoulder', angles.get('右肩膀', 0)),    # 右肩膀
            7: ('L.Elbow', angles.get('左手肘', 0)),       # 左手肘
            8: ('R.Elbow', angles.get('右手肘', 0)),       # 右手肘
            11: ('L.Hip', angles.get('左髖部', 0)),        # 左髖部
            12: ('R.Hip', angles.get('右髖部', 0)),        # 右髖部
            13: ('L.Knee', angles.get('左膝蓋', 0)),       # 左膝蓋
            14: ('R.Knee', angles.get('右膝蓋', 0))        # 右膝蓋
        }
        
        for joint_idx, (joint_name, angle_value) in joint_angle_mapping.items():
            if joint_idx < len(keypoints):
                point = keypoints[joint_idx]
                if len(point) >= 2:
                    x, y = int(point[0]), int(point[1])
                    
                    # 確保座標在畫面範圍內
                    if 0 <= x < frame.shape[1] and 0 <= y < frame.shape[0]:
                        # 格式化角度文字（使用deg避免特殊字符）
                        angle_text = f"{int(angle_value)}deg"
                        
                        # 計算文字位置（避免重疊）
                        text_x = x + 15
                        text_y = y - 10
                        
                        # 確保文字不超出畫面邊界
                        if text_x + 50 > frame.shape[1]:
                            text_x = x - 50
                        if text_y < 20:
                            text_y = y + 25
                        
                        # 繪製背景矩形
                        text_size = cv2.getTextSize(angle_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                        bg_x1 = text_x - 2
                        bg_y1 = text_y - text_size[1] - 2
                        bg_x2 = text_x + text_size[0] + 2
                        bg_y2 = text_y + 2
                        
                        # 繪製半透明背景
                        overlay = frame.copy()
                        cv2.rectangle(overlay, (bg_x1, bg_y1), (bg_x2, bg_y2), (0, 0, 0), -1)
                        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
                        
                        # 繪製角度文字
                        cv2.putText(frame, angle_text, (text_x, text_y), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                        
                        # 繪製關節名稱（較小字體）
                        name_y = text_y + 15
                        cv2.putText(frame, joint_name, (text_x, name_y), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.3, (200, 200, 200), 1, cv2.LINE_AA)
    
    def draw_pose_landmarks(self, frame, keypoints):
        """繪製基本姿態關鍵點和骨架（用於原始影片）"""
        if len(keypoints) < 17:
            return frame
        
        # 定義骨架連接
        skeleton = [
            [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],  # 上半身
            [5, 11], [6, 12], [11, 12],  # 軀幹
            [11, 13], [13, 15], [12, 14], [14, 16]  # 下半身
        ]
        
        # 繪製骨架
        for connection in skeleton:
            if len(keypoints) > max(connection):
                pt1 = tuple(map(int, keypoints[connection[0]]))
                pt2 = tuple(map(int, keypoints[connection[1]]))
                cv2.line(frame, pt1, pt2, (0, 255, 0), 2)
        
        # 繪製關鍵點
        for i, point in enumerate(keypoints):
            if len(point) >= 2:
                cv2.circle(frame, tuple(map(int, point)), 5, (0, 0, 255), -1)
        
        return frame
    
    def start_recording(self, output_dir="recordings"):
        """開始錄製影片"""
        try:
            with self.recording_lock:
                if self.is_recording:
                    logger.warning("錄製已在進行中")
                    return False
                
                # 使用絕對路徑創建輸出目錄
                abs_output_dir = os.path.abspath(output_dir)
                if not os.path.exists(abs_output_dir):
                    os.makedirs(abs_output_dir)
                    logger.info(f"創建錄製目錄: {abs_output_dir}")
                
                # 生成檔案名稱
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                original_filename = f"taekwondo_original_{timestamp}.mp4"
                skeleton_filename = f"taekwondo_analysis_{timestamp}.mp4"
                
                self.original_video_path = os.path.join(abs_output_dir, original_filename)
                self.skeleton_video_path = os.path.join(abs_output_dir, skeleton_filename)
                
                logger.info(f"錄製檔案路徑:")
                logger.info(f"  原始影片: {self.original_video_path}")
                logger.info(f"  分析影片: {self.skeleton_video_path}")
                
                # 影片設定 - 使用更兼容的編碼器
                fourcc = cv2.VideoWriter_fourcc(*'XVID')  # 使用XVID編碼器
                frame_size = (720, 720)  # 根據實際需要調整
                
                # 初始化影片寫入器
                self.original_video_writer = cv2.VideoWriter(
                    self.original_video_path, fourcc, self.recording_fps, frame_size
                )
                self.skeleton_video_writer = cv2.VideoWriter(
                    self.skeleton_video_path, fourcc, self.recording_fps, frame_size
                )
                
                if not self.original_video_writer.isOpened() or not self.skeleton_video_writer.isOpened():
                    logger.error("無法初始化影片寫入器")
                    return False
                
                self.is_recording = True
                self.recording_start_time = time.time()
                self.recorded_frames = []
                self.skeleton_frames = []
                self.frame_count = 0
                self.frame_timestamps = []
                
                logger.info(f"開始錄製影片: {original_filename}, {skeleton_filename}")
                logger.info(f"影片寫入器狀態:")
                logger.info(f"  原始影片寫入器已開啟: {self.original_video_writer.isOpened()}")
                logger.info(f"  分析影片寫入器已開啟: {self.skeleton_video_writer.isOpened()}")
                return True
                
        except Exception as e:
            logger.error(f"開始錄製失敗: {e}")
            return False
    
    def save_recording_frames(self, original_frame, skeleton_frame):
        """保存錄製幀"""
        try:
            if not self.is_recording:
                return
            
            # 確保幀大小正確
            target_size = (720, 720)
            original_resized = cv2.resize(original_frame, target_size)
            skeleton_resized = cv2.resize(skeleton_frame, target_size)
            
            # 寫入影片
            frames_written = 0
            if self.original_video_writer and self.original_video_writer.isOpened():
                self.original_video_writer.write(original_resized)
                frames_written += 1
            else:
                logger.warning("原始影片寫入器未開啟")
            
            if self.skeleton_video_writer and self.skeleton_video_writer.isOpened():
                self.skeleton_video_writer.write(skeleton_resized)
                frames_written += 1
            else:
                logger.warning("分析影片寫入器未開啟")
            
            # 每100幀記錄一次進度
            if hasattr(self, 'frame_count'):
                self.frame_count += 1
            else:
                self.frame_count = 1
            
            # 記錄幀時間戳
            self.frame_timestamps.append(time.time())
            
            if self.frame_count % 100 == 0:
                logger.info(f"已錄製 {self.frame_count} 幀")
                # 計算實際幀率
                if len(self.frame_timestamps) >= 100:
                    time_span = self.frame_timestamps[-1] - self.frame_timestamps[-100]
                    actual_fps = 100 / time_span
                    logger.info(f"實際錄製幀率: {actual_fps:.2f} fps")
                
        except Exception as e:
            logger.error(f"保存錄製幀失敗: {e}", exc_info=True)
    
    def stop_recording(self):
        """停止錄製影片"""
        try:
            with self.recording_lock:
                if not self.is_recording:
                    logger.warning("沒有正在進行的錄製")
                    return None
                
                self.is_recording = False
                
                logger.info(f"停止錄製，總共錄製了 {getattr(self, 'frame_count', 0)} 幀")
                
                # 釋放影片寫入器
                if self.original_video_writer:
                    self.original_video_writer.release()
                    self.original_video_writer = None
                    logger.info("原始影片寫入器已釋放")
                
                if self.skeleton_video_writer:
                    self.skeleton_video_writer.release()
                    self.skeleton_video_writer = None
                    logger.info("分析影片寫入器已釋放")
                
                recording_duration = time.time() - self.recording_start_time
                
                # 檢查檔案是否真的存在
                original_exists = os.path.exists(self.original_video_path) if hasattr(self, 'original_video_path') else False
                skeleton_exists = os.path.exists(self.skeleton_video_path) if hasattr(self, 'skeleton_video_path') else False
                
                logger.info(f"錄製完成，時長: {recording_duration:.2f}秒")
                logger.info(f"檔案檢查結果:")
                logger.info(f"  原始影片存在: {original_exists} - {getattr(self, 'original_video_path', 'N/A')}")
                logger.info(f"  分析影片存在: {skeleton_exists} - {getattr(self, 'skeleton_video_path', 'N/A')}")
                
                if original_exists:
                    original_size = os.path.getsize(self.original_video_path)
                    logger.info(f"  原始影片大小: {original_size} bytes")
                
                if skeleton_exists:
                    skeleton_size = os.path.getsize(self.skeleton_video_path)
                    logger.info(f"  分析影片大小: {skeleton_size} bytes")
                
                if not original_exists or not skeleton_exists:
                    logger.error("錄製的影片檔案不存在！")
                    return None
                
                return {
                    'original_video': self.original_video_path,
                    'skeleton_video': self.skeleton_video_path,
                    'duration': recording_duration,
                    'fps': self.recording_fps
                }
                
        except Exception as e:
            logger.error(f"停止錄製失敗: {e}", exc_info=True)
            return None
    
    def get_recording_status(self):
        """獲取錄製狀態"""
        return {
            'is_recording': self.is_recording,
            'duration': time.time() - self.recording_start_time if self.is_recording else 0
        }
    
    def reset(self):
        """重置檢測狀態"""
        # 如果正在錄製，先停止錄製
        if self.is_recording:
            self.stop_recording()
        
        self.angle_history.clear()
        self.velocity_history.clear()
        self.acceleration_history.clear()
        self.last_angles.clear()
        self.last_velocities.clear()
        self.last_timestamp = None
        self.action_count = 0
        self.current_action = "待檢測"
        self.action_confidence = 0.0
        
        # 清理軌跡數據
        self.joint_trajectories.clear()
        
        # 重新初始化歷史數據緩衝區
        for joint in self.angle_joints:
            self.angle_history[joint] = deque(maxlen=self.history_size)
            self.velocity_history[joint] = deque(maxlen=self.history_size)
            self.acceleration_history[joint] = deque(maxlen=self.history_size)
        
        logger.info("跆拳道檢測狀態已重置")

# 全局實例
_taekwondo_service = None

def get_taekwondo_service():
    """獲取跆拳道服務實例（單例模式）"""
    global _taekwondo_service
    if _taekwondo_service is None:
        _taekwondo_service = TaekwondoDetailService()
    return _taekwondo_service