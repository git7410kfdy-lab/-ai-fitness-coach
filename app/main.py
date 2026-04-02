from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from app.coach_logic import FitnessCoach
from .database import get_db_connection
import mysql.connector
import os

app = FastAPI()

# 🔓 必須加上這個，前端 fetch 才會通
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_data(student_id: str):
    try:
        conn = mysql.connector.connect(
            host="127.0.0.1",
            user="root",         # 這裡請改回你的資料庫帳號
            password="", # 這裡請改回你的資料庫密碼
            database="nkust_exercise"
        )
        cursor = conn.cursor(dictionary=True)
        # 自動根據傳入的 student_id 抓取紀錄
        query = """
            SELECT timestamp, exercise_type, weight, reps, sets, rpe, 
                   total_count, game_level, completion_time
            FROM exercise_info 
            WHERE student_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 15
        """
        cursor.execute(query, (student_id,))
        records = cursor.fetchall()

        clean_results = []

        for r in records:
             # 1. 處理時間戳記字串
            ts_str = r['timestamp'].strftime('%Y-%m-%d %H:%M') if r.get('timestamp') else "未知時間"
    
            # 2. 處理 RPE
            rpe_val = str(r['rpe']) if r.get('rpe') is not None else "尚未填寫"

            # 3. 【核心修正】處理 completion_time
            # 先抓出原始值
            raw_ct = r.get('completion_time')
            # 如果它是 datetime 物件（會導致 int() 報錯），我們就給它 0，或者你可以改成存字串
            if hasattr(raw_ct, 'strftime'): 
                safe_completion_time = 0  # 設為 0 以防 analyze_exercise_science 計算噴錯
            else:
                try:
                    safe_completion_time = int(raw_ct) if raw_ct is not None else 0
                except (ValueError, TypeError):
                    safe_completion_time = 0


            clean_r = {
                "timestamp": ts_str,  
                "exercise_type": r.get('exercise_type'),
                "weight": float(r.get('weight', 0)),
                "reps": int(r.get('reps', 0)),
                "sets": int(r.get('sets', 0)),
                "rpe": rpe_val,
                "info": f"{r.get('weight', 0)}kg x {r.get('reps', 0)}次 x {r.get('sets', 0)}組", 
        
                
                "total_count": int(r.get('total_count', 0)) if isinstance(r.get('total_count'), (int, float)) else 0,
                "game_level": r.get('game_level', 'Normal'),
                "completion_time": safe_completion_time 
            }
            clean_results.append(clean_r)
        cursor.close()
        conn.close()
        return list(reversed(clean_results))
    except Exception as e:
        print(f"❌ 資料庫錯誤: {e}")
        return []
    
# --- 新增：Gemini Skills (Tools) ---
def analyze_exercise_performance(total_count: int, completion_time: int, game_level: str, exercise_type: str):
    """
    【Skill】運動表現與效率分析。
    功能：根據完成次數與時間計算「每分鐘輸出率 (Output Rate)」，並結合遊戲難度評估體能狀況。
    當數據中包含 game_level 或 completion_time 時調用。
    """
    try:
        # 1. 計算每秒平均次數 (Pace/Tempo)
        # 假設 completion_time 單位是秒
        pace = total_count / completion_time if completion_time > 0 else 0
        reps_per_minute = round(pace * 60, 1)

        # 2. 難度加權評估
        # 這裡可以根據你的 game_level 給予不同的評價
        difficulty_multiplier = {"Easy": 1.0, "Normal": 1.2, "Hard": 1.5}
        score = total_count * difficulty_multiplier.get(game_level, 1.0)

        # 3. 生成科學建議邏輯
        feedback = ""
        if reps_per_minute > 40:
            feedback = "你的動作節奏極快，請確保在高速下 YOLOv8 偵測的動作幅度依然完整，避免代償。"
        elif reps_per_minute < 15:
            feedback = "節奏較慢，這有助於增加肌肉在張力下的時間 (TUT)，對肌肥大很有幫助。"
        
        return {
            "pace_analysis": f"平均每分鐘完成 {reps_per_minute} 次",
            "performance_score": f"難度加權得分: {score}",
            "scientific_note": feedback
        }
    except Exception as e:
        return f"效能分析出錯: {e}"

import math

def analyze_exercise_science(data: dict):
    """
    【Skill】運動科學數據轉換與分析
    輸入資料庫的一筆紀錄，轉換為專業生理指標。
    """
    weight = data.get('weight', 0)
    reps = data.get('reps', 0)
    total_count = data.get('total_count', 0)
    completion_time = data.get('completion_time', 0)
    rpe = data.get('rpe')
    
    # 1. 預估 1RM (Brzycki 公式) - 評估最大肌力
    # 只有當重量 > 0 且次數 > 1 時計算
    one_rm = weight / (1.0278 - (0.0278 * reps)) if reps > 1 else weight
    
    # 2. 計算功率輸出 (Power Output) 
    # 功 = 重量 * 次數，功率 = 功 / 時間 (這裡簡化處理作為參考指標)
    work_done = (weight if weight > 0 else 1) * total_count
    power_index = round(work_done / completion_time, 2) if completion_time > 0 else 0

    # 3. 動作節奏 (Tempo)
    seconds_per_rep = round(completion_time / total_count, 2) if total_count > 0 else 0

    # 4. 強度區間判斷
    intensity_zone = "爆發力/力量" if reps <= 5 else "肌肥大" if reps <= 12 else "肌肉耐力"

    analysis_result = {
        "one_rm_est": f"{round(one_rm, 1)}kg",
        "power_index": power_index,
        "tempo": f"{seconds_per_rep}s/rep",
        "intensity_zone": intensity_zone,
        "advice": ""
    }

    # 根據 RPE 給予科學建議
    if rpe and rpe != "尚未填寫":
        rpe_int = int(rpe)
        if rpe_int >= 9:
            analysis_result["advice"] = "當前強度極高，神經系統疲勞度大，建議延長組間休息至 3-5 分鐘。"
        elif 7 <= rpe_int <= 8:
            analysis_result["advice"] = "理想訓練強度，建議維持目前的負荷進行週期化訓練。"
        else:
            analysis_result["advice"] = "強度較輕，可嘗試增加重量或縮短組間休息以增加代謝壓力。"

    return analysis_result

def fetch_user_exercise_history(student_id: str):
    """
    【Skill】抓取該學生的歷史運動紀錄。
    當需要分析進度、提供客製化建議或檢查 RPE 是否缺失時，調用此函式。
    """
    return get_db_data(student_id) # 直接調用你原本寫好的 get_db_data

def update_user_rpe(student_id: str, rpe_score: int):
    """
    【Skill】更新該學生最後一筆紀錄的 RPE 分數。
    當用戶回報感受分數時，自動執行此函式更新資料庫。
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        sql = """
            UPDATE exercise_info 
            SET rpe = %s 
            WHERE student_id = %s AND (rpe IS NULL OR rpe = '尚未填寫')
            ORDER BY timestamp DESC LIMIT 1
        """
        cursor.execute(sql, (rpe_score, student_id))
        conn.commit()
        cursor.close()
        conn.close()
        return "成功更新 RPE"
    except Exception as e:
        return f"更新失敗: {e}"
    
tools_list = [fetch_user_exercise_history, update_user_rpe, analyze_exercise_science, analyze_exercise_performance]

coach = FitnessCoach(tools=tools_list)
    

@app.post("/ask")
async def ask_coach(user_id: str = Body(..., embed=True), message: str = Body(..., embed=True)):
    print(f"📢 收到來自 {user_id} 的訊息: {message}")

    # 1. 告訴 AI 目前的 User ID 是誰，這樣它 call Skill 時才知道要帶入哪個 student_id
    # 我們可以透過 System Prompt 或直接在訊息中提示
    full_query = f"[User ID: {user_id}] {message}"

    # 2. 直接呼叫 coach 邏輯
    # 注意：你的 coach_logic.py 必須已經註冊了上面的兩個函式作為 tools
    reply = coach.get_response(full_query)

    return {"reply": reply}

