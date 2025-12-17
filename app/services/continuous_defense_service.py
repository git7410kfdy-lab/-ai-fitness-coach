# -*- coding: utf-8 -*-
"""
持續抵擋模式服務
Continuous Defense Mode Service

處理持續抵擋模式的遊戲邏輯、玩家狀態管理和數據持久化
"""

import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from threading import Lock

# 設置日誌
logger = logging.getLogger(__name__)

@dataclass
class PlayerState:
    """玩家狀態數據類"""
    hp: int = 100
    max_hp: int = 100
    shield: int = 100
    max_shield: int = 100
    is_exercising: bool = False
    last_exercise_time: float = 0
    exercise_quality: float = 0
    total_exercise_time: float = 0
    exercise_count: int = 0

@dataclass
class MonsterState:
    """怪物狀態數據類"""
    attack_count: int = 0
    last_attack_time: float = 0
    is_attacking: bool = False
    position_x: float = 0
    position_y: float = 0
    is_moving: bool = False

@dataclass
class GameState:
    """遊戲狀態數據類"""
    is_active: bool = False
    start_time: float = 0
    elapsed_time: float = 0
    target_time: float = 60
    is_completed: bool = False
    is_game_over: bool = False
    difficulty_level: str = 'normal'
    score: int = 0

@dataclass
class GameConfig:
    """遊戲配置數據類"""
    target_time: float = 60
    monster_attack_interval: float = 2.0
    monster_damage: int = 15
    shield_repair_rate: int = 10
    shield_repair_interval: float = 3.0
    max_shield: int = 100
    max_hp: int = 100
    exercise_quality_threshold: float = 3.0
    shield_repair_quality_multiplier: float = 1.0

class ContinuousDefenseService:
    """持續抵擋模式服務類"""
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}  # 存儲所有活躍會話
        self.session_lock = Lock()  # 線程安全鎖
        
        # 預設配置
        self.default_config = GameConfig()
        
        # 難度配置
        self.difficulty_configs = {
            'easy': GameConfig(
                target_time=45,
                monster_attack_interval=3.0,
                monster_damage=10,
                shield_repair_rate=15,
                shield_repair_interval=2.5
            ),
            'normal': GameConfig(
                target_time=60,
                monster_attack_interval=2.0,
                monster_damage=15,
                shield_repair_rate=10,
                shield_repair_interval=3.0
            ),
            'hard': GameConfig(
                target_time=90,
                monster_attack_interval=1.5,
                monster_damage=20,
                shield_repair_rate=8,
                shield_repair_interval=3.5
            ),
            'nightmare': GameConfig(
                target_time=120,
                monster_attack_interval=1.0,
                monster_damage=25,
                shield_repair_rate=5,
                shield_repair_interval=4.0
            )
        }
        
        logger.info("持續抵擋模式服務初始化完成")
    
    def create_session(self, session_id: str, user_id: str, difficulty: str = 'normal') -> Dict[str, Any]:
        """創建新的遊戲會話"""
        with self.session_lock:
            # 獲取難度配置
            config = self.difficulty_configs.get(difficulty, self.default_config)
            
            # 創建會話數據
            session_data = {
                'session_id': session_id,
                'user_id': user_id,
                'created_at': time.time(),
                'last_updated': time.time(),
                'player_state': PlayerState(
                    max_hp=config.max_hp,
                    hp=config.max_hp,
                    max_shield=config.max_shield,
                    shield=config.max_shield
                ),
                'monster_state': MonsterState(),
                'game_state': GameState(
                    target_time=config.target_time,
                    difficulty_level=difficulty
                ),
                'config': config,
                'events': [],  # 遊戲事件記錄
                'statistics': {
                    'total_damage_taken': 0,
                    'total_shield_repaired': 0,
                    'total_attacks_survived': 0,
                    'max_combo': 0,
                    'current_combo': 0,
                    'exercise_sessions': 0
                }
            }
            
            self.sessions[session_id] = session_data
            
            logger.info(f"創建新會話: {session_id}, 用戶: {user_id}, 難度: {difficulty}")
            
            return self._serialize_session_data(session_data)
    
    def start_game(self, session_id: str) -> Dict[str, Any]:
        """開始遊戲"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            game_state = session['game_state']
            
            # 檢查遊戲狀態
            if game_state.is_active:
                raise ValueError("遊戲已經在進行中")
            
            # 重置遊戲狀態
            game_state.is_active = True
            game_state.start_time = time.time()
            game_state.elapsed_time = 0
            game_state.is_completed = False
            game_state.is_game_over = False
            game_state.score = 0
            
            # 重置玩家狀態
            player_state = session['player_state']
            config = session['config']
            player_state.hp = config.max_hp
            player_state.shield = config.max_shield
            player_state.is_exercising = False
            player_state.last_exercise_time = 0
            player_state.exercise_quality = 0
            player_state.total_exercise_time = 0
            player_state.exercise_count = 0
            
            # 重置怪物狀態
            monster_state = session['monster_state']
            monster_state.attack_count = 0
            monster_state.last_attack_time = time.time()
            monster_state.is_attacking = False
            
            # 重置統計數據
            stats = session['statistics']
            stats.update({
                'total_damage_taken': 0,
                'total_shield_repaired': 0,
                'total_attacks_survived': 0,
                'max_combo': 0,
                'current_combo': 0,
                'exercise_sessions': 0
            })
            
            # 記錄事件
            self._add_event(session, 'game_started', {
                'difficulty': game_state.difficulty_level,
                'target_time': game_state.target_time
            })
            
            session['last_updated'] = time.time()
            
            logger.info(f"遊戲開始: {session_id}")
            
            return self._serialize_session_data(session)
    
    def stop_game(self, session_id: str, reason: str = 'manual') -> Dict[str, Any]:
        """停止遊戲"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            game_state = session['game_state']
            
            if not game_state.is_active:
                raise ValueError("遊戲未在進行中")
            
            # 更新遊戲狀態
            game_state.is_active = False
            game_state.elapsed_time = time.time() - game_state.start_time
            
            # 記錄事件
            self._add_event(session, 'game_stopped', {
                'reason': reason,
                'elapsed_time': game_state.elapsed_time,
                'final_hp': session['player_state'].hp,
                'final_shield': session['player_state'].shield
            })
            
            session['last_updated'] = time.time()
            
            logger.info(f"遊戲停止: {session_id}, 原因: {reason}")
            
            return self._serialize_session_data(session)
    
    def update_game_state(self, session_id: str) -> Dict[str, Any]:
        """更新遊戲狀態"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            game_state = session['game_state']
            
            if not game_state.is_active:
                return self._serialize_session_data(session)
            
            current_time = time.time()
            game_state.elapsed_time = current_time - game_state.start_time
            
            # 檢查勝利條件
            if game_state.elapsed_time >= game_state.target_time:
                game_state.is_completed = True
                game_state.is_active = False
                
                # 計算最終分數
                self._calculate_final_score(session)
                
                # 記錄勝利事件
                self._add_event(session, 'victory', {
                    'elapsed_time': game_state.elapsed_time,
                    'final_score': game_state.score,
                    'final_hp': session['player_state'].hp,
                    'final_shield': session['player_state'].shield
                })
                
                logger.info(f"遊戲勝利: {session_id}, 分數: {game_state.score}")
            
            # 檢查失敗條件
            elif session['player_state'].hp <= 0:
                game_state.is_game_over = True
                game_state.is_active = False
                
                # 計算最終分數
                self._calculate_final_score(session)
                
                # 記錄失敗事件
                self._add_event(session, 'defeat', {
                    'elapsed_time': game_state.elapsed_time,
                    'final_score': game_state.score,
                    'attacks_survived': session['monster_state'].attack_count
                })
                
                logger.info(f"遊戲失敗: {session_id}, 存活時間: {game_state.elapsed_time:.1f}秒")
            
            session['last_updated'] = current_time
            
            return self._serialize_session_data(session)
    
    def process_monster_attack(self, session_id: str) -> Dict[str, Any]:
        """處理怪物攻擊"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            game_state = session['game_state']
            
            if not game_state.is_active:
                return self._serialize_session_data(session)
            
            current_time = time.time()
            monster_state = session['monster_state']
            player_state = session['player_state']
            config = session['config']
            
            # 檢查攻擊間隔
            if current_time - monster_state.last_attack_time < config.monster_attack_interval:
                return self._serialize_session_data(session)
            
            # 執行攻擊
            monster_state.attack_count += 1
            monster_state.last_attack_time = current_time
            monster_state.is_attacking = True
            
            damage = config.monster_damage
            
            # 護盾吸收傷害
            shield_damage = min(damage, player_state.shield)
            player_state.shield -= shield_damage
            remaining_damage = damage - shield_damage
            
            # 剩餘傷害作用於血量
            if remaining_damage > 0:
                player_state.hp = max(0, player_state.hp - remaining_damage)
                session['statistics']['total_damage_taken'] += remaining_damage
                
                # 重置連擊
                session['statistics']['current_combo'] = 0
            
            session['statistics']['total_attacks_survived'] = monster_state.attack_count
            
            # 記錄攻擊事件
            self._add_event(session, 'monster_attack', {
                'attack_number': monster_state.attack_count,
                'damage': damage,
                'shield_damage': shield_damage,
                'hp_damage': remaining_damage,
                'remaining_hp': player_state.hp,
                'remaining_shield': player_state.shield
            })
            
            session['last_updated'] = current_time
            
            logger.info(f"怪物攻擊: {session_id}, 第{monster_state.attack_count}次, 傷害: {damage}")
            
            return self._serialize_session_data(session)
    
    def process_exercise_detection(self, session_id: str, exercise_data: Dict[str, Any]) -> Dict[str, Any]:
        """處理運動檢測結果"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            game_state = session['game_state']
            
            if not game_state.is_active:
                return self._serialize_session_data(session)
            
            current_time = time.time()
            player_state = session['player_state']
            config = session['config']
            
            exercise_type = exercise_data.get('type', '')
            quality = exercise_data.get('quality', 0)
            is_correct = exercise_data.get('is_correct', False)
            
            # 只處理雙手輪流擺動
            if exercise_type != 'alternating-arm-swing':
                return self._serialize_session_data(session)
            
            # 更新運動狀態
            if is_correct and quality >= config.exercise_quality_threshold:
                player_state.is_exercising = True
                player_state.last_exercise_time = current_time
                player_state.exercise_quality = quality
                player_state.exercise_count += 1
                
                # 檢查護盾修復條件
                if current_time - player_state.last_exercise_time <= config.shield_repair_interval:
                    # 計算修復量
                    repair_amount = int(config.shield_repair_rate * 
                                      (quality / 10.0) * 
                                      config.shield_repair_quality_multiplier)
                    
                    old_shield = player_state.shield
                    player_state.shield = min(config.max_shield, player_state.shield + repair_amount)
                    actual_repair = player_state.shield - old_shield
                    
                    if actual_repair > 0:
                        session['statistics']['total_shield_repaired'] += actual_repair
                        session['statistics']['current_combo'] += 1
                        session['statistics']['max_combo'] = max(
                            session['statistics']['max_combo'],
                            session['statistics']['current_combo']
                        )
                        
                        # 記錄護盾修復事件
                        self._add_event(session, 'shield_repair', {
                            'repair_amount': actual_repair,
                            'quality': quality,
                            'current_shield': player_state.shield,
                            'combo': session['statistics']['current_combo']
                        })
                        
                        logger.debug(f"護盾修復: {session_id}, +{actual_repair}, 品質: {quality:.1f}")
                
                session['statistics']['exercise_sessions'] += 1
                
            else:
                player_state.is_exercising = False
                # 如果運動品質不佳，減少連擊
                if session['statistics']['current_combo'] > 0:
                    session['statistics']['current_combo'] = max(0, 
                        session['statistics']['current_combo'] - 1)
            
            session['last_updated'] = current_time
            
            return self._serialize_session_data(session)
    
    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """獲取會話狀態"""
        with self.session_lock:
            if session_id not in self.sessions:
                raise ValueError(f"會話 {session_id} 不存在")
            
            session = self.sessions[session_id]
            
            # 如果遊戲進行中，更新經過時間
            if session['game_state'].is_active:
                current_time = time.time()
                session['game_state'].elapsed_time = current_time - session['game_state'].start_time
                session['last_updated'] = current_time
            
            return self._serialize_session_data(session)
    
    def delete_session(self, session_id: str) -> bool:
        """刪除會話"""
        with self.session_lock:
            if session_id in self.sessions:
                del self.sessions[session_id]
                logger.info(f"會話已刪除: {session_id}")
                return True
            return False
    
    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """獲取所有會話（管理用途）"""
        with self.session_lock:
            return [self._serialize_session_data(session) for session in self.sessions.values()]
    
    def cleanup_expired_sessions(self, max_age_hours: int = 24) -> int:
        """清理過期會話"""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        expired_sessions = []
        
        with self.session_lock:
            for session_id, session in self.sessions.items():
                if current_time - session['last_updated'] > max_age_seconds:
                    expired_sessions.append(session_id)
            
            for session_id in expired_sessions:
                del self.sessions[session_id]
        
        if expired_sessions:
            logger.info(f"清理了 {len(expired_sessions)} 個過期會話")
        
        return len(expired_sessions)
    
    def _serialize_session_data(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """序列化會話數據"""
        return {
            'session_id': session['session_id'],
            'user_id': session['user_id'],
            'created_at': session['created_at'],
            'last_updated': session['last_updated'],
            'player_state': asdict(session['player_state']),
            'monster_state': asdict(session['monster_state']),
            'game_state': asdict(session['game_state']),
            'config': asdict(session['config']),
            'statistics': session['statistics'],
            'recent_events': session['events'][-10:]  # 只返回最近10個事件
        }
    
    def _add_event(self, session: Dict[str, Any], event_type: str, data: Dict[str, Any]):
        """添加遊戲事件"""
        event = {
            'type': event_type,
            'timestamp': time.time(),
            'data': data
        }
        
        session['events'].append(event)
        
        # 限制事件數量，避免內存過度使用
        if len(session['events']) > 100:
            session['events'] = session['events'][-50:]  # 保留最近50個事件
    
    def _calculate_final_score(self, session: Dict[str, Any]):
        """計算最終分數"""
        game_state = session['game_state']
        player_state = session['player_state']
        stats = session['statistics']
        
        # 基礎分數
        base_score = 1000
        
        # 時間獎勵（完成度）
        completion_ratio = min(1.0, game_state.elapsed_time / game_state.target_time)
        time_bonus = int(base_score * completion_ratio)
        
        # 血量獎勵
        hp_bonus = int((player_state.hp / player_state.max_hp) * 500)
        
        # 護盾獎勵
        shield_bonus = int((player_state.shield / player_state.max_shield) * 300)
        
        # 連擊獎勵
        combo_bonus = stats['max_combo'] * 50
        
        # 存活獎勵
        survival_bonus = stats['total_attacks_survived'] * 25
        
        # 運動獎勵
        exercise_bonus = stats['exercise_sessions'] * 10
        
        # 難度獎勵
        difficulty_multiplier = {
            'easy': 0.8,
            'normal': 1.0,
            'hard': 1.3,
            'nightmare': 1.6
        }.get(game_state.difficulty_level, 1.0)
        
        # 計算總分
        total_score = int((time_bonus + hp_bonus + shield_bonus + combo_bonus + 
                          survival_bonus + exercise_bonus) * difficulty_multiplier)
        
        game_state.score = max(0, total_score)
        
        logger.info(f"分數計算完成: {session['session_id']}, 總分: {game_state.score}")

# 創建全局服務實例
continuous_defense_service = ContinuousDefenseService()

# 導出服務實例
__all__ = ['continuous_defense_service', 'ContinuousDefenseService']