#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LifeMaster 启动器
"""

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

# 添加当前目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

def start_server():
    """启动 Flask 服务器"""
    try:
        # 设置环境变量
        os.environ.setdefault('FLASK_APP', 'app.py')
        os.environ.setdefault('FLASK_ENV', 'production')
        
        # 导入应用
        from app import app
        
        print("正在启动 LifeMaster 服务器...")
        print("服务器地址: http://localhost:5000")
        print("按 Ctrl+C 退出应用")
        
        # 启动 Flask 应用
        app.run(host='127.0.0.1', port=5000, debug=False)
        
    except Exception as e:
        print(f"启动服务器时发生错误: {e}")
        input("按回车键退出...")
        sys.exit(1)

def open_browser():
    """延迟打开浏览器"""
    time.sleep(2)  # 等待服务器启动
    try:
        webbrowser.open('http://localhost:5000/前端/sign_in.html')
        print("✓ 已打开浏览器")
    except Exception as e:
        print(f"打开浏览器失败: {e}")
        print("请手动访问: http://localhost:5000/前端/sign_in.html")

def main():
    """主函数"""
    print("=" * 50)
    print("欢迎使用 LifeMaster - 电子手账应用")
    print("=" * 50)
    
    # 检查必要文件
    required_files = ['app.py', '前端/sign_in.html']
    for file_path in required_files:
        if not os.path.exists(file_path):
            print(f"✗ 找不到必要文件: {file_path}")
            input("按回车键退出...")
            sys.exit(1)
    
    # 在后台线程中启动浏览器
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # 启动服务器（主线程）
    start_server()

if __name__ == '__main__':
    main()
