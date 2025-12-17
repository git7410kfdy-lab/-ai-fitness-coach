import os

class Config:
    """基本設定類"""
    SECRET_KEY = "your_secret_key"
    
    # 獲取專案根目錄
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 資料庫設定
    DB_CONFIG = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': '1234',
        'database': 'nkust_exercise'
    } #no!!
    @staticmethod
    def init_app(app):
        pass
    
    # 檔案上傳設定
    UPLOAD_FOLDER = 'uploads'
    OUTPUT_FOLDER = 'output'
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    
    # 模型路徑設定 - 使用相對路徑
    MODEL_PATHS = {
        'squat': os.path.join('static', 'models', 'YOLO_MODLE', 'squat_model', 'best.pt'),
        'bicep-curl': os.path.join('static', 'models', 'YOLO_MODLE', 'bicep_curl', 'bicep_best.pt'),
        'shoulder-press': os.path.join('static', 'models', 'YOLO_MODLE', 'shoulder_press', 'best.pt'),
        'push-up': os.path.join('static', 'models', 'YOLO_MODLE', 'push_up', 'push_up_best.pt'),
        'pull-up': os.path.join('static', 'models', 'YOLO_MODLE', 'pull_up', 'best.pt'),
        'dumbbell-row': os.path.join('static', 'models', 'YOLO_MODLE', 'dumbbell_row', 'row_best.pt'),
        'pose': os.path.join('static', 'models', 'YOLO_MODLE', 'pose', 'yolov8n-pose.pt')
    }
    
    # 確保上傳目錄存在
    @staticmethod
    def init_app(app):
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
        
        # 確保模型目錄存在
        models_dir = os.path.join('static', 'models', 'YOLO_MODLE')
        os.makedirs(models_dir, exist_ok=True)
        
        # 確保各個模型子目錄存在
        for model_type in ['squat_model', 'bicep_curl', 'shoulder_press', 'push_up', 'pull_up', 'dumbbell_row', 'pose']:
            os.makedirs(os.path.join(models_dir, model_type), exist_ok=True)

class DevelopmentConfig(Config):
    """開發環境設定"""
    DEBUG = True

class ProductionConfig(Config):
    """生產環境設定"""
    DEBUG = False