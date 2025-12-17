import logging
import sys
import os
from flask import Flask, render_template
from flask_socketio import SocketIO
from flask_login import LoginManager
from flask_bcrypt import Bcrypt

# 初始化擴展，但不綁定到應用實例
socketio = SocketIO(
    async_mode='threading',  # 使用threading模式
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

login_manager = LoginManager()
# 設置登入視圖，需要在初始化後設置
setattr(login_manager, 'login_view', 'auth.login')  # 使用setattr動態設置屬性
# 設置未授權處理函數，為API請求返回JSON
@login_manager.unauthorized_handler
def unauthorized():
    from flask import request, jsonify
    # 如果是API請求，返回JSON錯誤
    if request.path.startswith('/user/api/') or request.path.startswith('/api/'):
        return jsonify({
            'success': False,
            'message': '請先登入',
            'error': 'unauthorized'
        }), 401
    # 否則重定向到登入頁面
    from flask import redirect, url_for
    return redirect(url_for('auth.login'))

bcrypt = Bcrypt()

# 添加使用者載入回調函數
@login_manager.user_loader
def load_user(user_id):
    # 從app.models.user模組導入load_user函數
    from app.models.user import load_user as model_load_user
    return model_load_user(user_id)

def create_app(config_name='development'):
    """應用程式工廠函數"""
    app = Flask(__name__)
    
    # 根據環境選擇配置
    if config_name == 'production':
        app.config.from_object('app.config.ProductionConfig')
    else:
        app.config.from_object('app.config.DevelopmentConfig')
    
    # 初始化應用
    from app.config import Config
    Config.init_app(app)

    # 日誌配置已在 run.py 中完成，這裡不再重複配置
    
    # 初始化擴充
    socketio.init_app(app)
    login_manager.init_app(app)
    bcrypt.init_app(app)
    
    # 註冊藍圖
    from app.routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')

    from app.routes.main_routes import main_bp
    app.register_blueprint(main_bp)

    from app.routes.exercise_routes import exercise_bp
    app.register_blueprint(exercise_bp)

    from app.routes.api_routes import api_bp
    app.register_blueprint(api_bp)

    from app.routes.dashboard_routes import dashboard_bp  
    app.register_blueprint(dashboard_bp)  
    
    from app.routes.user_routes import user_bp
    from app.routes.game_routes import game_bp  # 新增遊戲藍圖導入
    
    app.register_blueprint(user_bp, url_prefix='/user')
    app.register_blueprint(game_bp)  # 註冊遊戲藍圖

    from app.routes.fitness_routes import fitness_bp
    app.register_blueprint(fitness_bp)
    
    from app.routes.analytics_routes import analytics_bp
    app.register_blueprint(analytics_bp)
    
    from app.routes.continuous_defense_routes import continuous_defense_bp
    app.register_blueprint(continuous_defense_bp)
    
    # 初始化模型 - 統一在應用上下文中載入
    with app.app_context():
        # 載入姿態檢測模型
        from app.services.pose_detection import load_models
        try:
            load_models()
            app.logger.info("姿態檢測模型載入成功")
        except Exception as e:
            app.logger.error(f"載入姿態檢測模型失敗: {e}")
        
        # 載入運動分類模型（只載入一次）
        from app.services import exercise_service
        try:
            if hasattr(exercise_service, 'init_models'):
                exercise_service.init_models()
                app.logger.info("運動檢測模型載入成功")
            else:
                exercise_service.load_exercise_models()
                app.logger.info("運動檢測模型載入成功")
        except Exception as e:
            app.logger.error(f"載入運動檢測模型失敗: {e}")
    
    # 設置錯誤處理
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404
    
    @app.errorhandler(500)
    def internal_server_error(e):
        return render_template('500.html'), 500
    
    return app