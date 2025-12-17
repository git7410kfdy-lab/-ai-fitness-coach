from flask import Blueprint, jsonify, request, render_template
from flask_login import current_user, login_required
from app.database import get_db_connection  # 使用統一的資料庫連接函數
import mysql.connector
import logging
from datetime import datetime

dashboard_bp = Blueprint('dashboard', __name__)
logger = logging.getLogger(__name__)

@dashboard_bp.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    """取得儀表板資料"""
    try:
        # 連結數據庫
        connection = get_db_connection()
        if not connection:
            logger.error("無法連線到資料庫")
            return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 查詢exercise_info表中的所有紀錄
        cursor.execute("""
            SELECT id, student_id, weight, reps, sets, exercise_type, timestamp as date
            FROM exercise_info
            ORDER BY timestamp DESC
        """)
        
        records = cursor.fetchall()
        
        # 轉換日期格式，確保JSON可序列化
        for record in records:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        connection.close()
        
        logger.info(f"成功取得{len(records)}筆運動紀錄")
        
        # 返回JSON格式的數據
        return jsonify({
            'success': True,
            'records': records
        })
    
    except Exception as e:
        logger.error(f"取得儀表板資料時發生錯誤: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@dashboard_bp.route('/api/exercise_data', methods=['GET'])
def get_exercise_data():
    """取得運動數據，專門為前端圖表設計"""
    try:
        # 取得用戶ID參數
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': '未提供用戶ID'}), 400
            
        # 連接數據庫
        connection = get_db_connection()
        if not connection:
            logger.error("無法連接到數據庫")
            return jsonify({'success': False, 'message': '數據庫連接失敗'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 查詢exercise_info表中的數據，按日期分組，並根據用戶ID過濾
        cursor.execute("""
            SELECT 
                DATE(timestamp) as date,
                exercise_type,
                SUM(sets) as total_sets,
                SUM(reps) as total_reps
            FROM exercise_info
            WHERE student_id = %s
            GROUP BY DATE(timestamp), exercise_type
            ORDER BY date DESC
            LIMIT 30
        """, (user_id,))
        
        records = cursor.fetchall()
        
        # 轉換日期格式，確保JSON可序列化
        for record in records:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
        
        cursor.close()
        connection.close()
        
        logger.info(f"成功取得用戶 {user_id} 的 {len(records)} 條運動紀錄(按日期分組)")
        
        # 返回JSON格式的數據
        return jsonify({
            'success': True,
            'data': records
        })
    
    except Exception as e:
        logger.error(f"取得運動數據時出錯: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500