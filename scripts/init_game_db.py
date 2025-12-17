import mysql.connector
import logging
import sys
import os
from app.config import Config  # 引入 Config 類
from app.database import get_db_connection
# 添加專案根目錄到Python路徑
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 配置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)



def create_game_tables():
    """創建遊戲相關的表"""
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("無法連接到數據庫")
            return False

            
        cursor = conn.cursor()

        # 添加新的表格創建
        if not ensure_exercise_info_table():
            logger.error("創建 exercise_info 表失敗")
            return False
        
        # 創建關卡表
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS game_levels (
            level_id INT AUTO_INCREMENT PRIMARY KEY,
            level_name VARCHAR(100) NOT NULL,
            description TEXT,
            required_exp INT NOT NULL,
            monster_count INT NOT NULL,
            monster_hp INT NOT NULL,
            background_image VARCHAR(255),
            is_boss_level BOOLEAN DEFAULT FALSE,
            unlock_requirement TEXT
        )
        """)
        
        # 創建用戶遊戲進度表
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_game_progress (
            progress_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            current_level INT NOT NULL DEFAULT 1,
            total_exp INT NOT NULL DEFAULT 0,
            monsters_defeated INT NOT NULL DEFAULT 0,
            last_played DATETIME,
            FOREIGN KEY (current_level) REFERENCES game_levels(level_id)
        )
        """)
        
        # 創建用戶成就表
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_achievements (
            achievement_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            achievement_name VARCHAR(100) NOT NULL,
            achievement_description TEXT,
            unlocked_at DATETIME NOT NULL,
            icon_path VARCHAR(255)
        )
        """)
        
        conn.commit()
        
        # 插入初始關卡數據
        insert_initial_levels(cursor, conn)
        ensure_user_game_progress_table()

        # 確保 user_completed_levels 表結構正確
        ensure_user_completed_levels_table()
        
        # 確保 user_achievements 表結構正確
        ensure_user_achievements_table()
        
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"創建遊戲表時出錯: {e}")
        return False


def insert_initial_levels(cursor, conn):
    """插入初始關卡數據"""
    try:
        # 檢查是否已有關卡數據
        cursor.execute("SELECT COUNT(*) FROM game_levels")
        count = cursor.fetchone()[0]
        
        if count > 0:
            # 只在第一次檢查時記錄，避免重複日誌
            return
        
        # 插入10個關卡
        levels_data = [
            # level_id自動生成
            ("初學者訓練", "完成基礎訓練，學習如何擊敗怪物", 100, 1, 50, "/static/img/game/level_1.jpg", False, "無"),
            ("森林小徑", "穿越森林小徑，擊敗潛伏的小型怪物", 250, 2, 75, "/static/img/game/level_2.jpg", False, "完成第1關"),
            ("山谷挑戰", "在山谷中與更強大的怪物戰鬥", 500, 2, 100, "/static/img/game/level_3.jpg", False, "完成第2關"),
            ("洞穴探險", "探索黑暗的洞穴，擊敗隱藏的怪物", 750, 3, 100, "/static/img/game/level_4.jpg", False, "完成第3關"),
            ("沼澤地帶", "穿越危險的沼澤，擊敗沼澤怪物", 1000, 3, 125, "/static/img/game/level_5.jpg", False, "完成第4關"),
            ("古老遺跡", "探索神秘的遺跡，與守護者戰鬥", 1500, 3, 150, "/static/img/game/level_6.jpg", True, "完成第5關"),
            ("冰封峽谷", "在寒冷的峽谷中與冰霜生物戰鬥", 2000, 4, 175, "/static/img/game/level_7.jpg", False, "完成第6關"),
            ("火山熔岩", "穿越炙熱的火山，與火焰怪物戰鬥", 2500, 4, 200, "/static/img/game/level_8.jpg", False, "完成第7關"),
            ("天空之城", "攀登至天空之城，與飛行怪物戰鬥", 3000, 5, 200, "/static/img/game/level_9.jpg", False, "完成第8關"),
            ("最終挑戰", "面對最終BOSS，完成終極挑戰", 4000, 1, 500, "/static/img/game/level_10.jpg", True, "完成第9關")
        ]
        
        insert_query = """
        INSERT INTO game_levels 
        (level_name, description, required_exp, monster_count, monster_hp, background_image, is_boss_level, unlock_requirement)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, levels_data)
        conn.commit()
        
        logger.info(f"成功插入{len(levels_data)}個初始關卡")
    except Exception as e:
        logger.error(f"插入初始關卡數據時出錯: {e}")
        conn.rollback()

def ensure_user_game_progress_table():
    """確保 user_game_progress 表結構正確"""
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("無法連接到數據庫")
            return False
            
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("SHOW TABLES LIKE 'user_game_progress'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            # 創建用戶遊戲進度表
            cursor.execute("""
            CREATE TABLE user_game_progress (
                progress_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                current_level INT NOT NULL DEFAULT 1,
                total_exp INT NOT NULL DEFAULT 0,
                monsters_defeated INT NOT NULL DEFAULT 0,
                last_played DATETIME
            )
            """)
            logger.info("創建 user_game_progress 表")
        else:
            # 檢查表結構
            cursor.execute("DESCRIBE user_game_progress")
            columns = {row[0]: row for row in cursor.fetchall()}
            
            # 檢查是否缺少必要的列
            if 'last_played' not in columns:
                cursor.execute("ALTER TABLE user_game_progress ADD COLUMN last_played DATETIME")
                logger.info("添加 last_played 列到 user_game_progress 表")
            
            if 'monsters_defeated' not in columns:
                cursor.execute("ALTER TABLE user_game_progress ADD COLUMN monsters_defeated INT NOT NULL DEFAULT 0")
                logger.info("添加 monsters_defeated 列到 user_game_progress 表")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"確保 user_game_progress 表結構正確時出錯: {e}")
        return False

if __name__ == "__main__":
    logger.info("開始初始化遊戲數據庫...")
    if create_game_tables():
        logger.info("遊戲數據庫初始化成功")
    else:
        logger.error("遊戲數據庫初始化失敗")

def ensure_user_completed_levels_table():
    """確保 user_completed_levels 表結構正確"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("SHOW TABLES LIKE 'user_completed_levels'")
        table_exists = cursor.fetchone()
        
        changes_made = False
        
        if not table_exists:
            # 創建用戶完成關卡表 - 使用 completed_at 而不是 completion_time
            cursor.execute("""
            CREATE TABLE user_completed_levels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                level_id INT NOT NULL,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                exp_earned INT NOT NULL DEFAULT 0,
                exercise_type VARCHAR(50),
                exercise_count INT DEFAULT 0,
                shield_value INT DEFAULT 0,
                shield_weight FLOAT DEFAULT 1.0,
                INDEX (user_id)
            )
            """)
            logger.info("創建 user_completed_levels 表")
            changes_made = True
        else:
            # 檢查表結構
            cursor.execute("DESCRIBE user_completed_levels")
            columns = {row[0]: row for row in cursor.fetchall()}
            
            # 檢查是否有 completion_time 欄位，如果有則重命名為 completed_at
            if 'completion_time' in columns and 'completed_at' not in columns:
                cursor.execute("ALTER TABLE user_completed_levels CHANGE COLUMN completion_time completed_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("將 completion_time 列重命名為 completed_at")
                changes_made = True
            
            # 檢查是否缺少必要的列
            if 'shield_value' not in columns:
                cursor.execute("ALTER TABLE user_completed_levels ADD COLUMN shield_value INT DEFAULT 0")
                logger.info("添加 shield_value 列到 user_completed_levels 表")
                changes_made = True
            
            if 'shield_weight' not in columns:
                cursor.execute("ALTER TABLE user_completed_levels ADD COLUMN shield_weight FLOAT DEFAULT 1.0")
                logger.info("添加 shield_weight 列到 user_completed_levels 表")
                changes_made = True
        
        if changes_made:
            conn.commit()
        
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"確保 user_completed_levels 表結構正確時出錯: {e}")
        if conn:
            conn.rollback()
            cursor.close()
            conn.close()
        return False


def ensure_exercise_info_table():
    """確保 exercise_info 表結構正確"""
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("無法連接到數據庫")
            return False
            
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("SHOW TABLES LIKE 'exercise_info'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            # 創建運動記錄表
            cursor.execute("""
            CREATE TABLE exercise_info (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) NOT NULL,
                exercise_type VARCHAR(50) NOT NULL,
                weight INT NOT NULL DEFAULT 0,
                reps INT NOT NULL DEFAULT 10,
                sets INT NOT NULL DEFAULT 3,
                timestamp DATETIME NOT NULL,
                total_count INT NOT NULL DEFAULT 0,
                game_level INT DEFAULT NULL
            )
            """)
            logger.info("創建 exercise_info 表")
        else:
            # 檢查表結構
            cursor.execute("DESCRIBE exercise_info")
            columns = {row[0]: row for row in cursor.fetchall()}
            
            # 檢查是否缺少必要的列
            if 'completion_time' not in columns:
                cursor.execute("ALTER TABLE exercise_info ADD COLUMN completion_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                logger.info("添加 completion_time 列到 exercise_info 表")
            
            if 'game_level' not in columns:
                cursor.execute("ALTER TABLE exercise_info ADD COLUMN game_level INT DEFAULT NULL")
                logger.info("添加 game_level 列到 exercise_info 表")
            
            if 'total_count' not in columns:
                cursor.execute("ALTER TABLE exercise_info ADD COLUMN total_count INT NOT NULL DEFAULT 0")
                logger.info("添加 total_count 列到 exercise_info 表")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        logger.error(f"確保 exercise_info 表結構正確時出錯: {e}")
        return False


def ensure_user_achievements_table():
    """確保 user_achievements 表結構正確"""
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("無法連接到數據庫")
            return False
            
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("SHOW TABLES LIKE 'user_achievements'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            # 創建用戶成就表
            cursor.execute("""
            CREATE TABLE user_achievements (
                achievement_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                achievement_name VARCHAR(100) NOT NULL,
                achievement_description TEXT,
                unlocked_at DATETIME NOT NULL,
                icon_path VARCHAR(255)
            )
            """)
            logger.info("創建 user_achievements 表")
        else:
            # 檢查表結構
            cursor.execute("DESCRIBE user_achievements")
            columns = {row[0]: row for row in cursor.fetchall()}
            
            # 檢查是否缺少必要的列
            if 'achievement_name' not in columns:
                cursor.execute("ALTER TABLE user_achievements ADD COLUMN achievement_name VARCHAR(100) NOT NULL AFTER user_id")
                logger.info("添加 achievement_name 列到 user_achievements 表")
            
            if 'achievement_description' not in columns:
                cursor.execute("ALTER TABLE user_achievements ADD COLUMN achievement_description TEXT AFTER achievement_name")
                logger.info("添加 achievement_description 列到 user_achievements 表")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"確保 user_achievements 表結構正確時出錯: {e}")
        return False


def ensure_users_table():
    """確保 users 表結構正確"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        # 檢查表是否存在
        cursor.execute("SHOW TABLES LIKE 'users'")
        table_exists = cursor.fetchone()
        
        changes_made = False
        
        if not table_exists:
            # 創建用戶表 - 使用與數據庫一致的欄位名稱
            cursor.execute("""
            CREATE TABLE users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            logger.info("創建 users 表")
            changes_made = True
        
        if changes_made:
            conn.commit()
        
        cursor.close()
        conn.close()
        
        return True
    except Exception as e:
        logger.error(f"確保 users 表結構正確時出錯: {e}")
        return False