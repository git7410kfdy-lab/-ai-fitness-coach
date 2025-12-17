# -*- coding: utf-8 -*-
"""
持續抵擋模式路由
Continuous Defense Mode Routes

提供持續抵擋模式的 API 端點
"""

import uuid
import logging
from flask import Blueprint, request, jsonify, session
from functools import wraps
from typing import Dict, Any

from ..services.continuous_defense_service import continuous_defense_service

# 設置日誌
logger = logging.getLogger(__name__)

# 創建藍圖
continuous_defense_bp = Blueprint('continuous_defense', __name__, url_prefix='/api/continuous-defense')

def require_session(f):
    """裝飾器：要求用戶會話"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({
                'success': False,
                'error': '需要用戶會話',
                'code': 'SESSION_REQUIRED'
            }), 401
        return f(*args, **kwargs)
    return decorated_function

def handle_service_error(f):
    """裝飾器：處理服務錯誤"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"服務錯誤: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'code': 'INVALID_REQUEST'
            }), 400
        except Exception as e:
            logger.error(f"未預期錯誤: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': '內部服務器錯誤',
                'code': 'INTERNAL_ERROR'
            }), 500
    return decorated_function

@continuous_defense_bp.route('/create-session', methods=['POST'])
@require_session
@handle_service_error
def create_session():
    """創建新的遊戲會話"""
    data = request.get_json() or {}
    
    user_id = session['user_id']
    difficulty = data.get('difficulty', 'normal')
    session_id = str(uuid.uuid4())
    
    # 驗證難度設置
    valid_difficulties = ['easy', 'normal', 'hard', 'nightmare']
    if difficulty not in valid_difficulties:
        return jsonify({
            'success': False,
            'error': f'無效的難度設置: {difficulty}',
            'code': 'INVALID_DIFFICULTY'
        }), 400
    
    # 創建會話
    session_data = continuous_defense_service.create_session(
        session_id=session_id,
        user_id=user_id,
        difficulty=difficulty
    )
    
    logger.info(f"創建持續抵擋模式會話: {session_id}, 用戶: {user_id}, 難度: {difficulty}")
    
    return jsonify({
        'success': True,
        'data': session_data,
        'message': '會話創建成功'
    })

@continuous_defense_bp.route('/start-game', methods=['POST'])
@require_session
@handle_service_error
def start_game():
    """開始遊戲"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 開始遊戲
    session_data = continuous_defense_service.start_game(session_id)
    
    logger.info(f"開始持續抵擋模式遊戲: {session_id}")
    
    return jsonify({
        'success': True,
        'data': session_data,
        'message': '遊戲開始'
    })

@continuous_defense_bp.route('/stop-game', methods=['POST'])
@require_session
@handle_service_error
def stop_game():
    """停止遊戲"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    reason = data.get('reason', 'manual')
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 停止遊戲
    session_data = continuous_defense_service.stop_game(session_id, reason)
    
    logger.info(f"停止持續抵擋模式遊戲: {session_id}, 原因: {reason}")
    
    return jsonify({
        'success': True,
        'data': session_data,
        'message': '遊戲停止'
    })

@continuous_defense_bp.route('/update-state', methods=['POST'])
@require_session
@handle_service_error
def update_game_state():
    """更新遊戲狀態"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 更新遊戲狀態
    session_data = continuous_defense_service.update_game_state(session_id)
    
    return jsonify({
        'success': True,
        'data': session_data
    })

@continuous_defense_bp.route('/monster-attack', methods=['POST'])
@require_session
@handle_service_error
def monster_attack():
    """處理怪物攻擊"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 處理怪物攻擊
    session_data = continuous_defense_service.process_monster_attack(session_id)
    
    return jsonify({
        'success': True,
        'data': session_data
    })

@continuous_defense_bp.route('/exercise-detection', methods=['POST'])
@require_session
@handle_service_error
def exercise_detection():
    """處理運動檢測結果"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    exercise_data = data.get('exercise_data', {})
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    if not exercise_data:
        return jsonify({
            'success': False,
            'error': '缺少運動數據',
            'code': 'MISSING_EXERCISE_DATA'
        }), 400
    
    # 處理運動檢測
    session_data = continuous_defense_service.process_exercise_detection(
        session_id, exercise_data
    )
    
    return jsonify({
        'success': True,
        'data': session_data
    })

@continuous_defense_bp.route('/session-status/<session_id>', methods=['GET'])
@require_session
@handle_service_error
def get_session_status(session_id):
    """獲取會話狀態"""
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 獲取會話狀態
    session_data = continuous_defense_service.get_session_status(session_id)
    
    return jsonify({
        'success': True,
        'data': session_data
    })

@continuous_defense_bp.route('/delete-session', methods=['DELETE'])
@require_session
@handle_service_error
def delete_session():
    """刪除會話"""
    data = request.get_json() or {}
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({
            'success': False,
            'error': '缺少會話 ID',
            'code': 'MISSING_SESSION_ID'
        }), 400
    
    # 刪除會話
    success = continuous_defense_service.delete_session(session_id)
    
    if success:
        logger.info(f"刪除持續抵擋模式會話: {session_id}")
        return jsonify({
            'success': True,
            'message': '會話已刪除'
        })
    else:
        return jsonify({
            'success': False,
            'error': '會話不存在',
            'code': 'SESSION_NOT_FOUND'
        }), 404

@continuous_defense_bp.route('/config', methods=['GET'])
@require_session
@handle_service_error
def get_config():
    """獲取遊戲配置"""
    difficulty = request.args.get('difficulty', 'normal')
    
    # 獲取難度配置
    config = continuous_defense_service.difficulty_configs.get(
        difficulty, 
        continuous_defense_service.default_config
    )
    
    return jsonify({
        'success': True,
        'data': {
            'difficulty': difficulty,
            'config': {
                'target_time': config.target_time,
                'monster_attack_interval': config.monster_attack_interval,
                'monster_damage': config.monster_damage,
                'shield_repair_rate': config.shield_repair_rate,
                'shield_repair_interval': config.shield_repair_interval,
                'max_shield': config.max_shield,
                'max_hp': config.max_hp,
                'exercise_quality_threshold': config.exercise_quality_threshold
            },
            'available_difficulties': list(continuous_defense_service.difficulty_configs.keys())
        }
    })

@continuous_defense_bp.route('/leaderboard', methods=['GET'])
@require_session
@handle_service_error
def get_leaderboard():
    """獲取排行榜（簡化版本）"""
    # 這裡可以實現排行榜邏輯
    # 目前返回空數據，後續可以擴展
    return jsonify({
        'success': True,
        'data': {
            'leaderboard': [],
            'user_rank': None,
            'total_players': 0
        },
        'message': '排行榜功能開發中'
    })

@continuous_defense_bp.route('/statistics', methods=['GET'])
@require_session
@handle_service_error
def get_statistics():
    """獲取用戶統計數據（簡化版本）"""
    user_id = session['user_id']
    
    # 這裡可以實現統計數據邏輯
    # 目前返回空數據，後續可以擴展
    return jsonify({
        'success': True,
        'data': {
            'total_games': 0,
            'total_wins': 0,
            'total_losses': 0,
            'best_score': 0,
            'total_playtime': 0,
            'favorite_difficulty': 'normal'
        },
        'message': '統計功能開發中'
    })

# 錯誤處理
@continuous_defense_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': '端點不存在',
        'code': 'ENDPOINT_NOT_FOUND'
    }), 404

@continuous_defense_bp.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': '方法不被允許',
        'code': 'METHOD_NOT_ALLOWED'
    }), 405

@continuous_defense_bp.errorhandler(500)
def internal_error(error):
    logger.error(f"內部服務器錯誤: {str(error)}", exc_info=True)
    return jsonify({
        'success': False,
        'error': '內部服務器錯誤',
        'code': 'INTERNAL_ERROR'
    }), 500

# 健康檢查端點
@continuous_defense_bp.route('/health', methods=['GET'])
def health_check():
    """健康檢查"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'service': 'continuous-defense-mode',
        'active_sessions': len(continuous_defense_service.sessions)
    })

# 清理端點（管理用途）
@continuous_defense_bp.route('/cleanup', methods=['POST'])
@require_session
@handle_service_error
def cleanup_sessions():
    """清理過期會話"""
    data = request.get_json() or {}
    max_age_hours = data.get('max_age_hours', 24)
    
    # 只允許管理員執行清理
    if session.get('role') != 'admin':
        return jsonify({
            'success': False,
            'error': '權限不足',
            'code': 'INSUFFICIENT_PERMISSIONS'
        }), 403
    
    cleaned_count = continuous_defense_service.cleanup_expired_sessions(max_age_hours)
    
    return jsonify({
        'success': True,
        'data': {
            'cleaned_sessions': cleaned_count,
            'remaining_sessions': len(continuous_defense_service.sessions)
        },
        'message': f'清理了 {cleaned_count} 個過期會話'
    })

logger.info("持續抵擋模式路由已加載")