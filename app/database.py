import mysql.connector
import sys
import os
import logging
from mysql.connector import Error
from .config import Config  # 引入 Config 類
logger = logging.getLogger(__name__)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def get_db_connection():
    """獲取數據庫連接"""
    try:
        db_config = Config.DB_CONFIG  # 使用 Config 中的 DB_CONFIG
        conn = mysql.connector.connect(
            host=db_config['host'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password']
        )
        if conn.is_connected():
            return conn
    except Error as e:
        logger.error(f"數據庫連接失敗: {e}")
        return None

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
    """檢查使用者表格是否存在"""
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
        logger.error(f"檢查表格結構錯誤: {e}")
        return False