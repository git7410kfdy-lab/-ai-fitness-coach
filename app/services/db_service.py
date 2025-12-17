import logging
import mysql.connector
from mysql.connector import Error
from flask import current_app
from app.database import get_db_connection  # 使用統一的資料庫連接函數

logger = logging.getLogger(__name__)

# get_db_connection 函數現在從 app.database 導入，確保所有模組使用相同的資料庫配置

def test_db_connection():
    """測試數據庫連接"""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            return result[0] == 1
        return False
    except Exception as e:
        logger.error(f"測試連接錯誤: {e}")
        return False

def check_users_table():
    """檢查用戶表是否存在"""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("DESCRIBE users")
            columns = cursor.fetchall()
            cursor.close()
            conn.close()
            return len(columns) > 0
        return False
    except Exception as e:
        logger.error(f"檢查表結構錯誤: {e}")
        return False