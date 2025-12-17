from flask import Blueprint, request, jsonify
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.database import get_db_connection
import logging
from datetime import datetime, timedelta
import json

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)

# 運動類型與肌肉群對應關係
EXERCISE_MUSCLE_MAP = {
    'squat': {
        'primary': ['quadriceps', 'glutes'],
        'secondary': ['lower_back', 'core'],
        'base_calorie': 0.5
    },
    'push-up': {
        'primary': ['chest', 'triceps'],
        'secondary': ['shoulders', 'core'],
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

@analytics_bp.route('/api/comprehensive-analytics', methods=['GET'])
def get_comprehensive_analytics():
    """獲取綜合健身分析數據，結合體態數據和運動記錄"""
    try:
        # 獲取用戶ID參數
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'message': '缺少用戶ID參數'
            }), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'message': '資料庫連接失敗'
            }), 500
            
        cursor = conn.cursor(dictionary=True)
        
        # 1. 獲取用戶最新體態數據
        logger.info(f"查詢用戶ID: {user_id}, 類型: {type(user_id)}")
        
        # 嘗試通過用戶名查找用戶ID
        cursor.execute(
            "SELECT user_id FROM users WHERE username = %s",
            (user_id,)
        )
        user_record = cursor.fetchone()
        if user_record:
            actual_user_id = user_record['user_id']
            logger.info(f"找到用戶ID: {actual_user_id}")
        else:
            # 如果沒找到，嘗試直接使用原始ID
            actual_user_id = user_id
            logger.info(f"使用原始用戶ID: {actual_user_id}")
        
        cursor.execute(
            "SELECT * FROM user_body_stats WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1",
            (actual_user_id,)
        )
        latest_body_stats = cursor.fetchone()
        logger.info(f"最新體態數據: {latest_body_stats}")
        
        # 2. 獲取用戶所有體態數據（用於趨勢分析）
        cursor.execute(
            "SELECT * FROM user_body_stats WHERE user_id = %s ORDER BY updated_at ASC",
            (actual_user_id,)
        )
        all_body_stats = cursor.fetchall()
        
        # 3. 獲取運動記錄數據 - 使用用戶名查詢
        cursor.execute(
            "SELECT * FROM exercise_info WHERE student_id = %s ORDER BY timestamp DESC",
            (user_id,)  # 直接使用傳入的用戶名
        )
        exercise_records = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # 4. 計算綜合統計數據
        analytics_data = calculate_comprehensive_analytics(
            latest_body_stats, all_body_stats, exercise_records
        )
        
        return jsonify({
            'success': True,
            'data': analytics_data
        })
        
    except Exception as e:
        logger.error(f"獲取綜合分析數據失敗: {e}")
        return jsonify({
            'success': False,
            'message': '獲取分析數據失敗'
        }), 500

def calculate_comprehensive_analytics(latest_body_stats, all_body_stats, exercise_records):
    """計算綜合分析數據"""
    
    # 基礎統計
    total_weight = sum(record.get('weight', 0) for record in exercise_records)
    total_exercises = len(exercise_records)
    
    # 計算總卡路里（基於體態數據調整）
    total_calories = 0
    user_weight = float(latest_body_stats['weight']) if latest_body_stats else 70.0  # 默認70kg，轉換為float
    
    for record in exercise_records:
        exercise_type = record.get('exercise_type', 'unknown')
        reps = float(record.get('reps', 0))  # 轉換為float
        weight = float(record.get('weight', 0))  # 轉換為float
        
        # 基礎卡路里計算
        base_calorie = EXERCISE_MUSCLE_MAP.get(exercise_type, {}).get('base_calorie', 0.3)
        # 根據用戶體重調整卡路里消耗
        weight_factor = user_weight / 70.0  # 以70kg為基準
        calories = base_calorie * reps * weight_factor * (1 + weight / 100.0)
        total_calories += calories
    
    # 計算訓練時間（估算）
    total_training_time = total_exercises * 2  # 假設每組運動2分鐘
    
    # 計算訓練頻率
    if exercise_records:
        first_date = min(record['timestamp'] for record in exercise_records)
        last_date = max(record['timestamp'] for record in exercise_records)
        days_span = (last_date - first_date).days + 1
        weeks_span = max(1, days_span / 7.0)  # 確保除法結果為浮點數
        training_frequency = total_exercises / weeks_span if weeks_span > 0 else 0
    else:
        training_frequency = 0
    
    # 體態趨勢分析
    body_trends = analyze_body_trends(all_body_stats)
    
    # 運動表現趨勢
    exercise_trends = analyze_exercise_trends(exercise_records)
    
    # 肌肉群發展分析
    muscle_development = analyze_muscle_development(exercise_records)
    
    # 運動類型統計
    exercise_stats = analyze_exercise_types(exercise_records)
    
    # 最近訓練記錄
    recent_exercises = get_recent_exercises(exercise_records, limit=10)
    
    # BMI變化趨勢
    bmi_trend = calculate_bmi_trend(all_body_stats)
    
    return {
        'basic_stats': {
            'total_weight': total_weight,
            'total_calories': total_calories,
            'total_training_time': total_training_time,
            'training_frequency': round(training_frequency, 1),
            'total_exercises': total_exercises
        },
        'body_stats': {
            'current': latest_body_stats,
            'trends': body_trends,
            'bmi_trend': bmi_trend
        },
        'exercise_analysis': {
            'trends': exercise_trends,
            'muscle_development': muscle_development,
            'exercise_stats': exercise_stats,
            'recent_exercises': recent_exercises
        },
        'insights': generate_insights(latest_body_stats, exercise_records, muscle_development)
    }

def analyze_body_trends(all_body_stats):
    """分析體態變化趨勢"""
    if not all_body_stats:
        return []
    
    # 返回圖表所需的數據格式
    trend_data = []
    for record in all_body_stats:  # 使用所有記錄而不是只有最近7筆
        trend_data.append({
            'date': record['updated_at'].strftime('%Y-%m-%d'),
            'weight': float(record['weight']),
            'bmi': float(record['bmi']),
            'height': float(record['height']),
            'age': int(record['age'])
        })
    
    return trend_data

def analyze_exercise_trends(exercise_records):
    """分析運動表現趨勢"""
    if not exercise_records:
        return []
    
    # 按日期分組計算每日數據
    daily_data = {}
    for record in exercise_records:
        date_str = record['timestamp'].strftime('%Y-%m-%d')
        if date_str not in daily_data:
            daily_data[date_str] = {
                'total_weight': 0, 
                'total_calories': 0, 
                'exercise_count': 0,
                'total_reps': 0
            }
        
        exercise_type = record.get('exercise_type', 'unknown')
        reps = float(record.get('reps', 0))
        weight = float(record.get('weight', 0))
        
        # 累加數據
        daily_data[date_str]['total_weight'] += weight
        daily_data[date_str]['exercise_count'] += 1
        daily_data[date_str]['total_reps'] += reps
        
        # 計算卡路里
        base_calorie = EXERCISE_MUSCLE_MAP.get(exercise_type, {}).get('base_calorie', 0.3)
        calories = base_calorie * reps * 1.2
        daily_data[date_str]['total_calories'] += calories
    
    # 轉換為趨勢數據（最近14天）
    trend_data = []
    for i in range(13, -1, -1):
        date = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        data = daily_data.get(date_str, {
            'total_weight': 0, 
            'total_calories': 0, 
            'exercise_count': 0,
            'total_reps': 0
        })
        trend_data.append({
            'date': date_str,
            'total_weight': round(data['total_weight'], 1),
            'total_calories': round(data['total_calories'], 1),
            'exercise_count': data['exercise_count'],
            'total_reps': int(data['total_reps']),
            'avg_calories_per_exercise': round(data['total_calories'] / max(1, data['exercise_count']), 1) if data['exercise_count'] > 0 else 0
        })
    
    return trend_data

def analyze_muscle_development(exercise_records):
    """分析肌肉群發展"""
    muscle_groups = {
        'chest': 0, 'arms': 0, 'shoulders': 0, 'core': 0, 'legs': 0, 'back': 0
    }
    
    for record in exercise_records:
        exercise_type = record.get('exercise_type', 'unknown')
        reps = float(record.get('reps', 0))  # 轉換為float
        
        if exercise_type in EXERCISE_MUSCLE_MAP:
            muscle_info = EXERCISE_MUSCLE_MAP[exercise_type]
            
            # 主要肌肉群獲得更多分數
            for muscle in muscle_info['primary']:
                if 'chest' in muscle or 'triceps' in muscle:
                    muscle_groups['chest'] += reps * 1.5
                elif 'biceps' in muscle or 'forearms' in muscle:
                    muscle_groups['arms'] += reps * 1.5
                elif 'deltoids' in muscle or 'trapezius' in muscle:
                    muscle_groups['shoulders'] += reps * 1.5
                elif 'core' in muscle or 'lower_back' in muscle:
                    muscle_groups['core'] += reps * 1.5
                elif 'quadriceps' in muscle or 'glutes' in muscle:
                    muscle_groups['legs'] += reps * 1.5
                elif 'latissimus' in muscle or 'rhomboids' in muscle:
                    muscle_groups['back'] += reps * 1.5
            
            # 次要肌肉群獲得較少分數
            for muscle in muscle_info['secondary']:
                if 'chest' in muscle or 'triceps' in muscle:
                    muscle_groups['chest'] += reps * 0.5
                elif 'biceps' in muscle or 'forearms' in muscle:
                    muscle_groups['arms'] += reps * 0.5
                elif 'deltoids' in muscle or 'trapezius' in muscle:
                    muscle_groups['shoulders'] += reps * 0.5
                elif 'core' in muscle or 'lower_back' in muscle:
                    muscle_groups['core'] += reps * 0.5
                elif 'quadriceps' in muscle or 'glutes' in muscle:
                    muscle_groups['legs'] += reps * 0.5
                elif 'latissimus' in muscle or 'rhomboids' in muscle:
                    muscle_groups['back'] += reps * 0.5
    
    # 正規化分數
    muscle_values = list(muscle_groups.values())
    max_score = max(muscle_values) if muscle_values and max(muscle_values) > 0 else 1
    for muscle in muscle_groups:
        muscle_groups[muscle] = round((muscle_groups[muscle] / max_score) * 100, 1)
    
    return muscle_groups

def analyze_exercise_types(exercise_records):
    """分析運動類型統計"""
    exercise_counts = {}
    for record in exercise_records:
        exercise_type = record.get('exercise_type', 'unknown')
        if exercise_type not in exercise_counts:
            exercise_counts[exercise_type] = 0
        exercise_counts[exercise_type] += 1
    
    # 轉換為列表格式並排序
    stats = []
    for exercise_type, count in exercise_counts.items():
        stats.append({
            'name': exercise_type,
            'count': count
        })
    
    return sorted(stats, key=lambda x: x['count'], reverse=True)

def get_recent_exercises(exercise_records, limit=10):
    """獲取最近的訓練記錄"""
    recent = exercise_records[:limit]
    return [{
        'date': record['timestamp'].strftime('%m/%d'),
        'exercise': record.get('exercise_type', 'unknown'),
        'reps': record.get('reps', 0),
        'weight': record.get('weight', 0)
    } for record in recent]

def calculate_bmi_trend(all_body_stats):
    """計算BMI變化趨勢"""
    if not all_body_stats:
        return []
    
    trend = []
    for record in all_body_stats[-7:]:  # 最近7筆記錄
        trend.append({
            'date': record['updated_at'].strftime('%m/%d'),
            'bmi': round(float(record['bmi']), 1)  # 轉換為float
        })
    
    return trend

def generate_insights(latest_body_stats, exercise_records, muscle_development):
    """生成健身建議和洞察"""
    insights = []
    
    # BMI建議
    if latest_body_stats:
        bmi = float(latest_body_stats['bmi'])  # 轉換為float
        if bmi < 18.5:
            insights.append({
                'type': 'warning',
                'title': 'BMI偏低',
                'message': '建議增加力量訓練和營養攝取，幫助增重和肌肉發展。'
            })
        elif bmi > 25:
            insights.append({
                'type': 'info',
                'title': 'BMI偏高',
                'message': '建議增加有氧運動，配合均衡飲食來控制體重。'
            })
        else:
            insights.append({
                'type': 'success',
                'title': 'BMI正常',
                'message': '您的BMI在健康範圍內，繼續保持良好的運動習慣！'
            })
    
    # 肌肉發展建議
    if muscle_development:
        min_muscle = min(muscle_development.values())
        max_muscle = max(muscle_development.values())
        
        if max_muscle - min_muscle > 50:
            weak_muscles = [muscle for muscle, score in muscle_development.items() if score == min_muscle]
            insights.append({
                'type': 'info',
                'title': '肌肉發展不均衡',
                'message': f'建議加強 {"、".join(weak_muscles)} 的訓練，以達到更均衡的發展。'
            })
    
    # 訓練頻率建議
    if len(exercise_records) > 0:
        recent_week = [r for r in exercise_records if (datetime.now() - r['timestamp']).days <= 7]
        if len(recent_week) < 3:
            insights.append({
                'type': 'warning',
                'title': '訓練頻率偏低',
                'message': '建議每週至少進行3次訓練，以維持良好的健身效果。'
            })
        elif len(recent_week) > 6:
            insights.append({
                'type': 'info',
                'title': '訓練頻率很高',
                'message': '記得給身體適當的休息時間，避免過度訓練。'
            })
    
    return insights