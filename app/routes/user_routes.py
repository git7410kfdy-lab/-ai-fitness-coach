from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from app.database import get_db_connection  # 使用統一的資料庫連接函數
import logging
import mysql.connector
from datetime import datetime
from app.models.user import User

# 建立藍圖
user_bp = Blueprint('user', __name__)
logger = logging.getLogger(__name__)

@user_bp.route('/profile')
@login_required
def profile():
    """使用者個人資料頁面"""
    return render_template('user/profile.html', user=current_user)

@user_bp.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    """編輯使用者個人資料"""
    if request.method == 'POST':
        # 獲取表單數據
        name = request.form.get('name')
        email = request.form.get('email')
        
        try:
            # 更新使用者資訊
            conn = get_db_connection()
            if not conn:
                flash('資料庫連接失敗', 'danger')
                return redirect(url_for('user.profile'))
                
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET name = %s, email = %s WHERE id = %s",
                (name, email, current_user.id)
            )
            conn.commit()
            cursor.close()
            conn.close()
            
            flash('個人資料更新成功', 'success')
            return redirect(url_for('user.profile'))
        except Exception as e:
            logger.error(f"更新使用者資料失敗: {e}")
            flash('更新個人資料失敗', 'danger')
            return redirect(url_for('user.edit_profile'))
    
    return render_template('user/edit_profile.html', user=current_user)

@user_bp.route('/exercise/history')
@login_required
def exercise_history():
    """使用者運動歷史紀錄"""
    try:
        conn = get_db_connection()
        if not conn:
            flash('資料庫連接失敗', 'danger')
            return render_template('user/exercise_history.html', records=[])
            
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT * FROM exercise_records 
            WHERE user_id = %s 
            ORDER BY date DESC
            """,
            (current_user.id,)
        )
        records = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return render_template('user/exercise_history.html', records=records)
    except Exception as e:
        logger.error(f"取得運動歷史紀錄失敗: {e}")
        flash('取得運動歷史紀錄失敗', 'danger')
        return render_template('user/exercise_history.html', records=[])

@user_bp.route('/api/user/stats')
@login_required
def user_stats():
    """取得使用者統計資料"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '資料庫連接失敗'}), 500
            
        cursor = conn.cursor(dictionary=True)
        
        # 獲取總運動次數
        cursor.execute(
            "SELECT COUNT(*) as total FROM exercise_records WHERE user_id = %s",
            (current_user.id,)
        )
        total_count = cursor.fetchone()['total']
        
        # 獲取總運動時間
        cursor.execute(
            "SELECT SUM(duration) as total_duration FROM exercise_records WHERE user_id = %s",
            (current_user.id,)
        )
        result = cursor.fetchone()
        total_duration = result['total_duration'] if result['total_duration'] else 0
        
        # 獲取各類運動的次數
        cursor.execute(
            """
            SELECT exercise_type, COUNT(*) as count 
            FROM exercise_records 
            WHERE user_id = %s 
            GROUP BY exercise_type
            """,
            (current_user.id,)
        )
        exercise_counts = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_count': total_count,
                'total_duration': total_duration,
                'exercise_counts': exercise_counts
            }
        })
    except Exception as e:
        logger.error(f"獲取使用者統計數據失敗: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@user_bp.route('/settings')
@login_required
def settings():
    """使用者設定頁面"""
    return render_template('user/settings.html', user=current_user)

@user_bp.route('/settings/change-password', methods=['POST'])
@login_required
def change_password():
    """修改使用者密碼"""
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # 驗證新密碼
    if new_password != confirm_password:
        flash('新密碼和確認密碼不匹配', 'danger')
        return redirect(url_for('user.settings'))
    
    # 驗證當前密碼
    from app import bcrypt
    if not bcrypt.check_password_hash(current_user.password, current_password):
        flash('當前密碼不正確', 'danger')
        return redirect(url_for('user.settings'))
    
    try:
        # 更新密碼
        hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        
        conn = get_db_connection()
        if not conn:
            flash('資料庫連接失敗', 'danger')
            return redirect(url_for('user.settings'))
            
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password = %s WHERE id = %s",
            (hashed_password, current_user.id)
        )
        conn.commit()
        cursor.close()
        conn.close()
        
        flash('密碼修改成功', 'success')
        return redirect(url_for('user.settings'))
    except Exception as e:
        logger.error(f"修改密碼失敗: {e}")
        flash('修改密碼失敗', 'danger')
        return redirect(url_for('user.settings'))

@user_bp.route('/api/body-stats', methods=['POST'])
@login_required
def save_body_stats():
    """保存使用者體態數據"""
    try:
        data = request.get_json()
        
        # 驗證必要欄位
        required_fields = ['height', 'weight', 'age']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False, 
                    'message': f'缺少必要欄位: {field}'
                }), 400
        
        # 記錄日誌（使用當前登入用戶）
        logger.info(f"用戶 {current_user.username} (ID: {current_user.id}) 正在保存體態數據")
        
        height = float(data['height'])
        weight = float(data['weight'])
        age = int(data['age'])
        
        # 驗證數據範圍
        if not (140 <= height <= 220):
            return jsonify({
                'success': False, 
                'message': '身高必須在140-220公分之間'
            }), 400
            
        if not (40 <= weight <= 150):
            return jsonify({
                'success': False, 
                'message': '體重必須在40-150公斤之間'
            }), 400
            
        if not (16 <= age <= 80):
            return jsonify({
                'success': False, 
                'message': '年齡必須在16-80歲之間'
            }), 400
        
        # 計算BMI
        height_m = height / 100
        bmi = weight / (height_m ** 2)
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False, 
                'message': '資料庫連接失敗'
            }), 500
            
        cursor = conn.cursor()
        
        # 總是插入新記錄以追蹤體態變化歷史
        cursor.execute(
            """
            INSERT INTO user_body_stats (user_id, user_name, height, weight, age, bmi, created_at, updated_at) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (current_user.id, current_user.username, height, weight, age, round(bmi, 2), datetime.now(), datetime.now())
        )
        logger.info(f"為用戶 {current_user.username} (ID: {current_user.id}) 創建新的體態記錄")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': '體態數據保存成功',
            'data': {
                'height': height,
                'weight': weight,
                'age': age,
                'bmi': round(bmi, 2)
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False, 
            'message': '數據格式錯誤'
        }), 400
    except Exception as e:
        logger.error(f"保存體態數據失敗: {e}")
        return jsonify({
            'success': False, 
            'message': '保存體態數據失敗'
        }), 500

@user_bp.route('/api/body-stats', methods=['GET'])
@login_required
def get_body_stats():
    """獲取使用者體態數據"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False, 
                'message': '資料庫連接失敗'
            }), 500
            
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM user_body_stats WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1",
            (current_user.id,)
        )
        body_stats = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if body_stats:
            return jsonify({
                'success': True,
                'data': {
                    'user_id': body_stats['user_id'],
                    'user_name': body_stats.get('user_name', current_user.username),
                    'height': body_stats['height'],
                    'weight': body_stats['weight'],
                    'age': body_stats['age'],
                    'bmi': body_stats['bmi'],
                    'updated_at': body_stats['updated_at'].isoformat() if body_stats['updated_at'] else None
                }
            })
        else:
            return jsonify({
                'success': True,
                'data': None,
                'message': '尚未設定體態數據'
            })
            
    except Exception as e:
        logger.error(f"獲取體態數據失敗: {e}")
        return jsonify({
            'success': False, 
            'message': '獲取體態數據失敗'
        }), 500