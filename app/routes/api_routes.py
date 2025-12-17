from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user, login_required
from app.services.db_service import get_db_connection
import logging

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/user/status', methods=['GET'])
def get_user_status():
    """取得目前使用者狀態"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'username': current_user.username,
            'role': current_user.role,
            'userId': current_user.id
        })
    else:
        return jsonify({
            'authenticated': False
        })

@api_bp.route('/discussions', methods=['GET'])
def get_discussions():
    """取得課程討論列表"""
    course_id = request.args.get('course_id', type=int)
    
    if not course_id:
        return jsonify({'success': False, 'error': '缺少課程ID'})
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '資料庫連線失敗'})
            
        cursor = conn.cursor(dictionary=True)
        
        # 首先檢查表結構
        cursor.execute("SHOW COLUMNS FROM discussions")
        columns = [column['Field'] for column in cursor.fetchall()]
        logger.info(f"discussions表的列: {columns}")
        
        # 根據實際表結構調整查詢 - 使用LEFT JOIN同時處理學生和教師發布的討論
        query = """
        SELECT d.*, 
               COALESCE(s.username, t.username) as author_name,
               CASE 
                   WHEN d.teacher_id IS NOT NULL THEN 'teacher'
                   ELSE 'student'
               END as author_role
        FROM discussions d
        LEFT JOIN users s ON d.student_id = s.user_id
        LEFT JOIN users t ON d.teacher_id = t.user_id
        WHERE d.course_id = %s
        ORDER BY d.created_at DESC
        """
        
        cursor.execute(query, (course_id,))
        discussions = cursor.fetchall()
        
        # 處理日期格式
        for discussion in discussions:
            if 'created_at' in discussion and discussion['created_at']:
                discussion['created_at'] = discussion['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'discussions': discussions})
    
    except Exception as e:
        logger.error(f"取得討論清單時出錯: {e}")
        return jsonify({'success': False, 'error': f'取得討論清單失敗: {str(e)}'})

@api_bp.route('/responses', methods=['GET'])
def get_responses():
    """取得討論回應列表"""
    discussion_id = request.args.get('discussion_id', type=int)
    
    if not discussion_id:
        return jsonify({'success': False, 'error': '缺少討論ID'})
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '資料庫連線失敗'})
            
        cursor = conn.cursor(dictionary=True)
        
        # 首先檢查表結構
        cursor.execute("SHOW COLUMNS FROM responses")
        columns = [column['Field'] for column in cursor.fetchall()]
        logger.info(f"responses表的列: {columns}")
        
        # 檢查users表結構
        cursor.execute("SHOW COLUMNS FROM users")
        user_columns = [column['Field'] for column in cursor.fetchall()]
        logger.info(f"users表的列: {user_columns}")
        
        # 獲取所有回复
        cursor.execute(
            """
            SELECT r.*, u.username as author_name
            FROM responses r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.discussion_id = %s
            ORDER BY r.created_at ASC
            """, 
            (discussion_id,)
        )
        responses = cursor.fetchall()
        logger.info(f"獲取到 {len(responses)} 條回覆")
        
        # 處理日期格式和確保author_name有值
        for response in responses:
            if 'created_at' in response and response['created_at']:
                response['created_at'] = response['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            # 確保author_name有值
            if not response.get('author_name'):
                # 嘗試單獨查詢用戶名
                cursor.execute("SELECT username FROM users WHERE user_id = %s", (response['user_id'],))
                user = cursor.fetchone()
                if user and user['username']:
                    response['author_name'] = user['username']
                else:
                    response['author_name'] = f"用户{response['user_id']}"
            
            # 添加角色訊息
            response['author_role'] = 'teacher' if response.get('is_teacher') == 1 else 'student'
        
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'responses': responses})
    
    except Exception as e:
        logger.error(f"取得回覆清單時出錯: {e}")
        return jsonify({'success': False, 'error': f'取得回覆清單失敗: {str(e)}'})




@api_bp.route('/discussions', methods=['POST'])
@login_required
def create_discussion():
    """建立新討論"""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': '無效的請求數據'})
    
    course_id = data.get('course_id')
    title = data.get('title')
    content = data.get('content')
    
    if not all([course_id, title, content]):
        return jsonify({'success': False, 'error': '缺少必要字段'})
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '資料庫連線失敗'})
            
        cursor = conn.cursor()
        
        # 根據使用者角色決定使用哪個字段
        if current_user.role == 'teacher':
            query = """
            INSERT INTO discussions (course_id, teacher_id, title, content)
            VALUES (%s, %s, %s, %s)
            """
        else:
            query = """
            INSERT INTO discussions (course_id, student_id, title, content)
            VALUES (%s, %s, %s, %s)
            """
        
        cursor.execute(query, (course_id, current_user.id, title, content))
        discussion_id = cursor.lastrowid
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'discussion_id': discussion_id})
    
    except Exception as e:
        logger.error(f"創建討論時出錯: {e}")
        return jsonify({'success': False, 'error': f'創建討論時出錯: {str(e)}'})



@api_bp.route('/discussions/<int:discussion_id>', methods=['DELETE'])
@login_required
def delete_discussion(discussion_id):
    """刪除討論"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': '資料庫連線失敗'})
            
        cursor = conn.cursor(dictionary=True)
        
        # 檢查討論是否存在
        cursor.execute("SELECT * FROM discussions WHERE discussion_id = %s", (discussion_id,))
        discussion = cursor.fetchone()
        
        if not discussion:
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'error': '討論不存在'})
        

        # 檢查目前使用者是否有權限刪除（只有教師或討論創建者可以刪除）
        if current_user.role != 'teacher' and (
            (discussion.get('teacher_id') and discussion['teacher_id'] != current_user.username) and
            (discussion.get('student_id') and discussion['student_id'] != current_user.username)
        ):
            cursor.close()
            conn.close()
            return jsonify({'success': False, 'error': '无权限删除此讨论'}), 403
        
        # 先刪除與討論相關的所有回复
        cursor.execute("DELETE FROM responses WHERE discussion_id = %s", (discussion_id,))
        
        # 然後刪除討論
        cursor.execute("DELETE FROM discussions WHERE discussion_id = %s", (discussion_id,))
        
        # 提交更改
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'success': True})
    
    except Exception as e:
        logger.error(f"刪除討論時出錯: {e}")
        return jsonify({'success': False, 'error': f'刪除討論失敗: {str(e)}'})



# 新增回覆路由
@api_bp.route('/responses', methods=['POST'])
@login_required
def create_response():
    """创建新回复"""
    data = request.get_json()   # 獲取請求數據
    
    if not data:    # 如果請求數據無效，則返回錯誤信息
        return jsonify({'success': False, 'error': '無效的請求數據'})   # 返回到客戶端的錯誤信息
    
    discussion_id = data.get('discussion_id')  # 新增討論ID字段
    content = data.get('content')   # 新增回覆內容字段
    
    if not all([discussion_id, content]):  # 檢查必要字段是否存在
        return jsonify({'success': False, 'error': '缺少必要字段'})
    
    try:
        conn = get_db_connection() # 獲取數據庫連接
        if not conn:    # 如果連接失敗，則返回錯誤信息
            return jsonify({'success': False, 'error': '資料庫連線失敗'}) # 返回到客戶端的錯誤信息
            
        cursor = conn.cursor()  # 獲取數據庫游標
        
        # 設定is_teacher字段
        is_teacher = 1 if current_user.role == 'teacher' else 0  
        
        # 使用用戶名而不是用戶ID
        user_name = current_user.username
        
        # 插入新回复
        query = """
        INSERT INTO responses (discussion_id, user_id, content, is_teacher)
        VALUES (%s, %s, %s, %s)
        """
        
        # 執行插入
        cursor.execute(query, (discussion_id, user_name, content, is_teacher))
        response_id = cursor.lastrowid  # 獲取新插入的回覆ID
        
        # 提交更改
        conn.commit()
        cursor.close()  # 關閉游標
        conn.close()   # 關閉連接
        
        # 返回成功信息
        return jsonify({'success': True, 'response_id': response_id})
    
    # 捕獲任何可能的錯誤
    except Exception as e:
        logger.error(f"建立回應時出錯: {e}")
        return jsonify({'success': False, 'error': f'建立回應失敗: {str(e)}'})


# 刪除回覆路由
@api_bp.route('/responses/<int:response_id>', methods=['DELETE'])
@login_required
def delete_response(response_id):
    """刪除回覆"""
    try:
        conn = get_db_connection()   # 獲取數據庫連接
        if not conn:                # 如果連接失敗，則返回錯誤信息
            return jsonify({'success': False, 'error': '資料庫連線失敗'})   # 返回到客戶端的錯誤信息
            
        cursor = conn.cursor(dictionary=True)  # 獲取數據庫游標
        
        # 檢查回覆是否存在且使用者是否有權限刪除
        cursor.execute("SELECT user_id, is_teacher FROM responses WHERE response_id = %s", (response_id,))
        response = cursor.fetchone() # 獲取回覆信息
        
        if not response:    # 如果回覆不存在，則返回錯誤信息
            cursor.close()     # 關閉游標
            conn.close()       # 關閉連接
            return jsonify({'success': False, 'error': '回复不存在'})  # 返回到客戶端的錯誤信息
        
        # 只有回覆作者或教師可以刪除
        if response['user_id'] != current_user.username and current_user.role != 'teacher':
            cursor.close()  # 關閉游標
            conn.close()    # 關閉連接
            return jsonify({'success': False, 'error': '無權限刪除此回复'}), 403   # 返回到客戶端的錯誤信息
        
        # 刪除回覆
        cursor.execute("DELETE FROM responses WHERE response_id = %s", (response_id,))
        
       
        conn.commit() # 提交更改
        cursor.close() # 關閉游標
        conn.close()    # 關閉連接
        
        return jsonify({'success': True})  # 返回到客戶端的成功信息
    
    except Exception as e:   # 捕獲任何可能的錯誤
        logger.error(f"刪除回覆時出錯: {e}")
        return jsonify({'success': False, 'error': f'刪除回覆時出錯: {str(e)}'})