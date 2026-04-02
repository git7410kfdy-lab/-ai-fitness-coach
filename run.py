# 修改導入語句，確保從正確的模組導入
from app import create_app, socketio
import logging
import sys
import traceback
import os
import requests
from flask import Flask, session, request, jsonify

# 導入日誌配置模組
from app.utils.logging_config import configure_logging, ImageDataFilter

# 配置日誌
configure_logging()
logger = logging.getLogger(__name__)

# 創建Flask應用實例
logger.info("正在初始化應用...")
app = create_app()

# --- 這裡開始是新增的 AI 教練區塊 ---
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')

    student_id = session.get('user_id', 'guest') 


    try:
        # 【連線到你剛才寫的那份 FastAPI】
        # 這樣才會觸發你寫的 print 和 get_db_data
        response = requests.post(
            "http://127.0.0.1:8000/ask", 
            json={
                "user_id": student_id, 
                "message": user_message
            },
            timeout=30
        )
        return jsonify(response.json())
        
    except Exception as e:
        print(f"❌ 無法連線至 FastAPI: {e}")
        # 如果連不上 FastAPI，才用原本的方式保底回覆
        reply = coach.get_response(user_message)
        return jsonify({"reply": reply})
# --- 新增結束 ---

# 確保靜態檔案路徑設置正確
app.static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
app.static_url_path = '/static'

if __name__ == '__main__':
    try:
        # 只在主進程中初始化遊戲資料庫，避免在debug模式重載時重複初始化
        from app.utils.db_init import init_game_database
        init_game_database()
        
        logger.info("啟動服務器 - http://localhost:5000")
        socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
    except Exception as e:
        logger.error(f"應用啟動失敗: {str(e)}")
        traceback.print_exc()