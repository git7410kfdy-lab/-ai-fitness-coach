import cv2

def test_camera():
    """
    使用 OpenCV 打開攝像頭並顯示實時影像窗口。
    按 'q' 鍵退出窗口。
    """
    # 嘗試打開攝像頭 (設備索引為 0，通常是默認攝像頭)
    cap = cv2.VideoCapture(1)
    
    if not cap.isOpened():  # 如果攝像頭無法打開
        print("攝像頭資源未能成功打開")
        return
    
    print("成功打開攝像頭，按 'q' 鍵退出。")
    
    while True:
        # 從攝像頭讀取一幀影像
        ret, frame = cap.read()
        
        if not ret:  # 如果無法讀取影像幀
            print("無法獲取影像，可能是設備問題")
            break
        
        # 顯示影像窗口
        cv2.imshow("Camera Test", frame)
        
        # 每 1 毫秒監聽鍵盤事件，如果按下 'q'，退出循環
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("退出攝像頭測試")
            break
    
    # 釋放攝像頭資源並關閉所有窗口
    cap.release()
    cv2.destroyAllWindows()

# 調用測試攝像頭函數
test_camera()
