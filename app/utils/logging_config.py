import logging
import sys
import re

# 创建自定义日志过滤器，更严格地过滤掉图像编码数据
class ImageDataFilter(logging.Filter):
    # 增加一個較大的長度閾值
    MAX_MSG_LENGTH = 1000 # 可以根據實際情況調整這個值
    TRUNCATE_LENGTH = 200 # 截斷後保留的長度

    def filter(self, record):
        # 检查日志消息是否包含大量的编码数据
        if record.msg and isinstance(record.msg, str):
            msg_len = len(record.msg)

            # 1. 检查是否包含base64编码特征
            if 'data:image' in record.msg or '/9j/' in record.msg:
                # (Optional: You can keep the modification for debugging if needed,
                # but returning False is the key to suppression)
                # hash_match = re.search(r'\[哈希值: (\d+)\]', record.msg)
                # if hash_match:
                #     record.msg = f"[图像数据已过滤，哈希值: {hash_match.group(1)}]"
                # else:
                #     record.msg = "[图像数据已过滤]"
                return False # <-- 修改：返回 False 以阻止此日志记录

            # 2. 检测base64字符串特征 (保留原有邏輯，稍微調整閾值)
            if msg_len > 100:
                base64_chars = set('+/=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')
                base64_ratio = sum(1 for c in record.msg if c in base64_chars) / msg_len
                if base64_ratio > 0.5:
                    # record.msg = f"[可能的编码数据已过滤，长度: {msg_len}]" # (Optional modification)
                    return False # <-- 修改：返回 False 以阻止此日志记

            # 3. 檢測非常長的消息
            if msg_len > self.MAX_MSG_LENGTH:
                # record.msg = record.msg[:self.TRUNCATE_LENGTH] + f"... [长消息已截断，原长: {msg_len}]" # (Optional modification)
                return False # <-- 修改：返回 False 以阻止此日志记录

        # 允许其他所有日志记录通过
        return True

# ... configure_logging 函數保持不變 ...
def configure_logging():
    """配置日志系统"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # 添加自定义过滤器到根日志记录器
    root_logger = logging.getLogger()
    has_image_filter = any(isinstance(f, ImageDataFilter) for f in root_logger.filters)
    if not has_image_filter:
        root_logger.addFilter(ImageDataFilter())
        logging.info("ImageDataFilter 已添加到根記錄器")

    # 設置某些模塊的日誌級別為更高級別，減少不必要的輸出
    # 同時設置父 logger 和子 logger，確保生效
    logging.getLogger('engineio').setLevel(logging.ERROR)
    logging.getLogger('engineio.client').setLevel(logging.ERROR) # 如果有的話
    logging.getLogger('engineio.server').setLevel(logging.ERROR) # 明確設置 server logger
    logging.getLogger('socketio').setLevel(logging.ERROR)
    logging.getLogger('socketio.client').setLevel(logging.ERROR) # 如果有的話
    logging.getLogger('socketio.server').setLevel(logging.ERROR) # 明確設置 server logger
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    # 添加驗證日誌
    logger = logging.getLogger(__name__) # 獲取一個 logger 實例來記錄驗證信息
    logger.info(f"Root logger level: {logging.getLogger().level}")
    logger.info(f"SocketIO logger level: {logging.getLogger('socketio').level}")
    logger.info(f"SocketIO Server logger level: {logging.getLogger('socketio.server').level}") # 驗證 server logger
    logger.info(f"EngineIO logger level: {logging.getLogger('engineio').level}")
    logger.info(f"EngineIO Server logger level: {logging.getLogger('engineio.server').level}") # 驗證 server logger
    logger.info(f"Werkzeug logger level: {logging.getLogger('werkzeug').level}")