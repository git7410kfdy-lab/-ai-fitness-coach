import logging
import traceback
from app.database import get_db_connection

logger = logging.getLogger(__name__)

def init_game_database():
    """初始化遊戲數據庫"""
    try:
        # 導入遊戲數據庫初始化腳本
        from scripts.init_game_db import create_game_tables, ensure_user_completed_levels_table, ensure_users_table
        
        # 創建遊戲相關的表格
        create_game_tables()
            
        # 特別確保 user_completed_levels 表結構正確
        ensure_user_completed_levels_table()
            
        # 確保 users 表結構正確
        ensure_users_table()
            
    except Exception as e:
        logger.error(f"初始化遊戲數據庫時出錯: {e}")