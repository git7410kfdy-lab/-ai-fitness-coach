from flask import Blueprint, jsonify, request, session
from app.database import get_db_connection
import logging
from datetime import datetime, timedelta
from app.database import get_db_connection
from app.services.table_tennis_service import TableTennisService
import uuid


fitness_bp = Blueprint('fitness', __name__)
logger = logging.getLogger(__name__)

def find_available_camera_index():
    """自動檢測可用的攝影機索引，從索引3開始檢測"""
    # 優先檢測索引3，因為這是已知可用的攝影機
    for index in range(3, 10):  # 檢查索引3到9
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            # 嘗試讀取一幀來確認攝影機真的可用
            ret, _ = cap.read()
            cap.release()
            if ret:
                logger.info(f"找到可用的攝影機索引: {index}")
                return index
        cap.release()
    
    # 如果索引3-9都不可用，再檢查0-2
    logger.warning("索引3-9未找到可用攝影機，檢查索引0-2")
    for index in range(3):  # 檢查索引0到2
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            # 嘗試讀取一幀來確認攝影機真的可用
            ret, _ = cap.read()
            cap.release()
            if ret:
                logger.info(f"找到可用的攝影機索引: {index}")
                return index
        cap.release()
    
    logger.error("未找到任何可用的攝影機")
    return None

# 運動類型與肌肉群對應關係
EXERCISE_MUSCLE_MAP = {
    'squat': {
        'primary': ['quadriceps', 'glutes'],   # 主肌肉群
        'secondary': ['lower_back', 'core'],   # 次主肌肉群
        'base_calorie': 0.5                     # 基礎卡路里消耗
    },
    'push-up': {
        'primary': ['chest', 'triceps'],        # 主肌肉群
        'secondary': ['shoulders', 'core'],     # 次主肌肉群
        'base_calorie': 0.3
    },
    'bicep-curl': {
        'primary': ['biceps'],
        'secondary': ['forearms'],
        'base_calorie': 0.2
    },
    'shoulder-press': {
        'primary': ['deltoids'],
        'secondary': ['triceps', 'trapezius'],
        'base_calorie': 0.25
    },
    'dumbbell-row': {
        'primary': ['latissimus', 'rhomboids'],
        'secondary': ['biceps', 'forearms'],
        'base_calorie': 0.3
    }
}

# 肌肉群最佳訓練頻率（每週次數）
MUSCLE_OPTIMAL_FREQUENCY = {
    'quadriceps': 2, 'glutes': 2, 'lower_back': 2, 'core': 3,
    'chest': 2, 'triceps': 3, 'shoulders': 3, 'biceps': 3,
    'forearms': 3, 'deltoids': 3, 'trapezius': 2, 'latissimus': 2,
    'rhomboids': 2
}

@fitness_bp.route('/api/fitness/dashboard', methods=['GET'])
def fitness_dashboard():
    conn = None
    cursor = None
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': '未提供用戶ID'}), 400
        
        # 添加詳細日誌記錄
        logger.info(f"API接收到用戶ID: {user_id} (類型: {type(user_id)})")
        
        # 確保user_id是字符串類型
        user_id = str(user_id).strip()
        
        conn = get_db_connection()
        if not conn:
            logger.error(f"用戶 {user_id} 的數據庫連接失敗")
            return jsonify({'success': False, 'message': '數據庫連接失敗'}), 500
            
        cursor = conn.cursor(dictionary=True)
        
        # 1. 檢查是否有數據 (使用用戶名作為student_id)
        cursor.execute("SELECT COUNT(*) as count FROM exercise_info WHERE student_id = %s", (user_id,))
        count_result = cursor.fetchone()
        record_count = count_result['count'] if count_result else 0
        logger.info(f"用戶 {user_id} 的運動記錄數量: {record_count}")
        
        # 如果沒有找到記錄，嘗試通過users表查找對應的student_id
        if record_count == 0:
            cursor.execute("SELECT username FROM users WHERE username = %s", (user_id,))
            user_result = cursor.fetchone()
            if user_result:
                # 用戶存在但沒有運動記錄
                logger.info(f"用戶 {user_id} 存在但沒有運動記錄")
            else:
                logger.warning(f"用戶 {user_id} 不存在於系統中")
        
        # 如果沒有數據，返回空結果但仍然成功
        if record_count == 0:
            logger.warning(f"用戶 {user_id} 沒有運動記錄")
            return jsonify({
                'success': True,
                'total_weight': 0,
                'total_calories': 0,
                'total_training_time': 0,
                'training_frequency': 0,
                'calories_trend': [],
                'muscle_growth': {
                    'arms': 0, 'chest': 0, 'core': 0, 'legs': 0, 'shoulders': 0
                },
                'exercise_stats': [],
                'recent_exercises': []
            })
        
        # 2. 計算總重量
        cursor.execute("""
            SELECT SUM(weight) as total_weight
            FROM exercise_info
            WHERE student_id = %s
        """, (user_id,))
        total_weight = cursor.fetchone()['total_weight'] or 0
        logger.info(f"用戶 {user_id} 的總重量計算結果: {total_weight}")
        
        # 2. 計算總卡路里
        cursor.execute("""
            SELECT SUM(weight * reps * sets * 0.1) as total_calories
            FROM exercise_info
            WHERE student_id = %s
        """, (user_id,))
        total_calories = cursor.fetchone()['total_calories'] or 0

        # 3. 計算總訓練時間
        cursor.execute("""
            SELECT TIMESTAMPDIFF(MINUTE, MIN(timestamp), MAX(timestamp)) as total_duration
            FROM exercise_info
            WHERE student_id = %s
        """, (user_id,))
        total_training_time = cursor.fetchone()['total_duration'] or 0
        
        # 4. 計算訓練頻率
        cursor.execute("""
            SELECT COUNT(DISTINCT DATE(timestamp)) as training_days
            FROM exercise_info
            WHERE student_id = %s AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """, (user_id,))
        training_frequency = cursor.fetchone()['training_days'] or 0
        
        # 5. 計算熱量消耗趨勢
        cursor.execute("""
            SELECT DATE(timestamp) as date, 
                   SUM(weight * reps * sets * 0.1) as daily_calories
            FROM exercise_info
            WHERE student_id = %s AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(timestamp)
            ORDER BY date
        """, (user_id,))
        
        calories_result = cursor.fetchall()
        logger.info(f"用戶 {user_id} 的熱量趨勢查詢結果: {calories_result}")

        # 確保至少有一個數據點
        if not calories_result:
            logger.warning(f"用戶 {user_id} 沒有熱量消耗記錄，將使用默認值")
            calories_trend = [0]  # 至少提供一個默認值
        else:
            calories_trend = [float(row['daily_calories'] or 0) for row in calories_result]
        
        logger.info(f"用戶 {user_id} 的熱量趨勢數據: {calories_trend}")
        
        # 6. 計算肌肉群發展
        cursor.execute("""
            SELECT exercise_type, COUNT(*) as count
            FROM exercise_info
            WHERE student_id = %s
            GROUP BY exercise_type
        """, (user_id,))
        
        muscle_growth = {'arms': 0, 'chest': 0, 'legs': 0, 'shoulders': 0, 'core': 0}
        for row in cursor.fetchall():
            exercise_type = row['exercise_type']
            count = row['count']
            
            # 根據運動類型映射到肌肉群
            if exercise_type in ['bicep-curl', 'tricep-extension']:
                muscle_growth['arms'] += count * 2
            elif exercise_type in ['push-up', 'bench-press']:
                muscle_growth['chest'] += count * 3
            elif exercise_type in ['squat', 'lunge']:
                muscle_growth['legs'] += count * 4
            elif exercise_type in ['shoulder-press']:
                muscle_growth['shoulders'] += count * 3
            else:
                muscle_growth['core'] += count * 1
        
        # 6. 獲取運動類型統計
        cursor.execute("""
            SELECT exercise_type, COUNT(*) as count
            FROM exercise_info
            WHERE student_id = %s
            GROUP BY exercise_type
            ORDER BY count DESC
            LIMIT 5
        """, (user_id,))
        exercise_stats = [{'name': row['exercise_type'], 'count': row['count']} 
                         for row in cursor.fetchall()]
        
        # 7. 獲取最近訓練記錄
        cursor.execute("""
            SELECT exercise_type, timestamp as date, reps, sets
            FROM exercise_info
            WHERE student_id = %s
            ORDER BY timestamp DESC
            LIMIT 5
        """, (user_id,))
        recent_exercises = [{
            'date': row['date'].strftime('%Y-%m-%d'),
            'exercise': row['exercise_type'],
            'reps': row['reps']
        } for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        # 返回結果前記錄
        logger.info(f"成功獲取用戶 {user_id} 的健身數據，calories_trend={calories_trend}")
        
        return jsonify({
            'success': True,
            'total_weight': float(total_weight),
            'total_calories': float(total_calories),
            'total_training_time': int(total_training_time),
            'training_frequency': int(training_frequency),
            'calories_trend': [float(x) for x in calories_trend],
            'muscle_growth': {
                'arms': int(muscle_growth['arms']),
                'chest': int(muscle_growth['chest']),
                'core': int(muscle_growth['core']),
                'legs': int(muscle_growth['legs']),
                'shoulders': int(muscle_growth['shoulders'])
            },
            'exercise_stats': exercise_stats,
            'recent_exercises': recent_exercises
        })
        
    except Exception as e:
        logger.error(f"獲取用戶 {user_id if 'user_id' in locals() else '未知'} 的健身數據失敗: {str(e)}")
        return jsonify({'success': False, 'message': f'獲取數據失敗: {str(e)}'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()




@fitness_bp.route('/api/fitness/recommendations', methods=['GET'])
def get_fitness_recommendations():
    """獲取用戶健身建議"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '未提供用戶ID'}), 400
    
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("無法連接到數據庫")
            return jsonify({'success': False, 'message': '數據庫連接失敗'}), 500
            
        cursor = conn.cursor(dictionary=True)
        
        # 獲取用戶運動記錄
        cursor.execute("""
            SELECT exercise_type, COUNT(*) as count, 
                   AVG(weight) as avg_weight, AVG(reps) as avg_reps, AVG(sets) as avg_sets
            FROM exercise_info 
            WHERE student_id = %s 
            GROUP BY exercise_type
        """, (user_id,))
        
        exercise_summary = cursor.fetchall()
        
        # 分析訓練不平衡
        muscle_training_count = {}
        for exercise in exercise_summary:
            exercise_type = exercise['exercise_type']
            if exercise_type in EXERCISE_MUSCLE_MAP:
                for muscle in EXERCISE_MUSCLE_MAP[exercise_type]['primary']:
                    if muscle not in muscle_training_count:
                        muscle_training_count[muscle] = 0
                    muscle_training_count[muscle] += exercise['count']
        
        # 找出訓練最少的肌肉群
        least_trained_muscles = []
        if muscle_training_count:
            min_count = min(muscle_training_count.values())
            least_trained_muscles = [muscle for muscle, count in muscle_training_count.items() if count <= min_count * 1.2]
        
        # 生成訓練建議
        recommendations = []
        
        # 1. 訓練不平衡建議
        if least_trained_muscles:
            recommended_exercises = []
            for muscle in least_trained_muscles:
                for exercise_type, info in EXERCISE_MUSCLE_MAP.items():
                    if muscle in info['primary'] and exercise_type not in recommended_exercises:
                        recommended_exercises.append(exercise_type)
            
            if recommended_exercises:
                recommendations.append({
                    'type': 'balance',
                    'message': f'您的{", ".join(least_trained_muscles)}肌群訓練較少，建議增加以下運動：{", ".join(recommended_exercises)}'
                })
        
        # 2. 進階訓練建議
        for exercise in exercise_summary:
            exercise_type = exercise['exercise_type']
            avg_weight = exercise['avg_weight']
            avg_reps = exercise['avg_reps']
            
            if avg_reps > 12:
                recommendations.append({
                    'type': 'progression',
                    'message': f'您的{exercise_type}平均次數已達{round(avg_reps, 1)}次，建議增加重量並減少次數到8-10次/組'
                })
            elif avg_weight > 0 and exercise['count'] > 10:
                recommendations.append({
                    'type': 'progression',
                    'message': f'您已完成{exercise["count"]}次{exercise_type}訓練，可以嘗試將重量從{round(avg_weight, 1)}kg提高5-10%'
                })
        
        # 關閉資源
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'recommendations': recommendations,
                'least_trained_muscles': least_trained_muscles,
                'exercise_summary': exercise_summary
            }
        })
        
    except Exception as e:
        logger.error(f"獲取健身建議時出錯: {e}")
        if conn:
            cursor.close()
            conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500


# 在現有的藍圖中添加桌球揮拍相關路由
@fitness_bp.route('/table-tennis/start', methods=['POST'])
def start_table_tennis():
    """開始桌球揮拍偵測"""
    try:
        # 獲取會話ID，如果不存在則創建
        session_id = request.cookies.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # 獲取攝像頭尺寸
        width = request.json.get('width', 640)
        height = request.json.get('height', 480)
        
        # 獲取桌球服務實例
        table_tennis_service = TableTennisService.get_instance()
        
        # 獲取或創建檢測器
        detector = table_tennis_service.get_detector(session_id, width, height)
        
        response = jsonify({
            'success': True,
            'message': '桌球揮拍偵測已開始',
            'session_id': session_id
        })
        
        # 設置會話ID cookie
        response.set_cookie('session_id', session_id)
        
        return response
    except Exception as e:
        logger.error(f"啟動桌球揮拍偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'啟動失敗: {str(e)}'
        }), 500

@fitness_bp.route('/table-tennis/stop', methods=['POST'])
def stop_table_tennis():
    """停止桌球揮拍偵測"""
    try:
        # 獲取會話ID
        session_id = request.cookies.get('session_id')
        if not session_id:
            return jsonify({
                'success': False,
                'message': '無效的會話'
            }), 400
        
        # 獲取桌球服務實例
        table_tennis_service = TableTennisService.get_instance()
        
        # 移除檢測器
        result = table_tennis_service.remove_detector(session_id)
        
        if result:
            return jsonify({
                'success': True,
                'message': '桌球揮拍偵測已停止'
            })
        else:
            return jsonify({
                'success': False,
                'message': '找不到對應的檢測器'
            }), 404
    except Exception as e:
        logger.error(f"停止桌球揮拍偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'停止失敗: {str(e)}'
        }), 500

@fitness_bp.route('/table-tennis/reset', methods=['POST'])
def reset_table_tennis():
    """重置桌球揮拍偵測"""
    try:
        # 獲取會話ID
        session_id = request.cookies.get('session_id')
        if not session_id:
            return jsonify({
                'success': False,
                'message': '無效的會話'
            }), 400
        
        # 獲取桌球服務實例
        table_tennis_service = TableTennisService.get_instance()
        
        # 重置檢測器
        result = table_tennis_service.reset_detector(session_id)
        
        if result:
            return jsonify({
                'success': True,
                'message': '桌球揮拍偵測已重置'
            })
        else:
            return jsonify({
                'success': False,
                'message': '找不到對應的檢測器'
            }), 404
    except Exception as e:
        logger.error(f"重置桌球揮拍偵測時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'重置失敗: {str(e)}'
        }), 500

@fitness_bp.route('/table-tennis/count', methods=['GET'])
def get_table_tennis_count():
    """獲取桌球揮拍次數"""
    try:
        # 獲取會話ID
        session_id = request.cookies.get('session_id')
        if not session_id:
            return jsonify({
                'success': False,
                'message': '無效的會話'
            }), 400
        
        # 獲取桌球服務實例
        table_tennis_service = TableTennisService.get_instance()
        
        # 獲取揮拍次數
        count = table_tennis_service.get_count(session_id)
        
        return jsonify({
            'success': True,
            'count': count
        })
    except Exception as e:
        logger.error(f"獲取桌球揮拍次數時發生錯誤: {e}")
        return jsonify({
            'success': False,
            'message': f'獲取失敗: {str(e)}'
        }), 500


@fitness_bp.route('/video_feed')
def video_feed():
    """提供視頻流"""
    exercise_type = request.args.get('exercise_type', 'squat')
    
    # 如果是桌球揮拍，使用桌球偵測器處理視頻
    if exercise_type == 'table-tennis':
        return Response(generate_table_tennis_frames(),
                        mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        # 原有的視頻處理邏輯
        return Response(generate_frames(exercise_type),
                        mimetype='multipart/x-mixed-replace; boundary=frame')


def generate_table_tennis_frames():
    """生成桌球揮拍視頻幀"""
    # 獲取會話ID
    session_id = request.cookies.get('session_id')
    if not session_id:
        return
    
    # 獲取桌球服務實例
    table_tennis_service = TableTennisService.get_instance()
    
    # 獲取攝像頭
    camera_index = find_available_camera_index()
    if camera_index is None:
        logger.error("無法找到可用的攝影機")
        return
    
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        logger.error(f"無法開啟攝像頭索引 {camera_index}")
        return
    
    logger.info(f"桌球攝像頭初始化成功，使用索引 {camera_index}")
    
    # 獲取攝像頭尺寸
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # 獲取或創建檢測器
    detector = table_tennis_service.get_detector(session_id, width, height)
    
    try:
        while True:
            success, frame = cap.read()
            if not success:
                logger.error("無法讀取攝像頭畫面")
                break
            
            # 水平翻轉畫面，使其更直觀
            frame = cv2.flip(frame, 1)
            
            # 使用桌球偵測器處理畫面
            processed_frame = detector.detect_and_display_landmarks(frame)
            
            # 轉換為 JPEG 格式
            ret, buffer = cv2.imencode('.jpg', processed_frame)
            if not ret:
                continue
            
            # 生成幀數據
            frame_data = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
    finally:
        cap.release()