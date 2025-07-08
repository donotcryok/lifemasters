#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LifeMaster 主启动文件
用于 PyInstaller 打包
"""

import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

def setup_environment():
    """设置运行环境"""
    # 获取当前执行文件的目录
    if getattr(sys, 'frozen', False):
        # 如果是打包的exe文件
        current_dir = os.path.dirname(sys.executable)
    else:
        # 如果是Python脚本
        current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 切换到应用目录
    os.chdir(current_dir)
    
    # 添加到Python路径
    sys.path.insert(0, current_dir)
    
    # 设置环境变量
    os.environ.setdefault('FLASK_ENV', 'production')
    os.environ.setdefault('FLASK_DEBUG', 'False')
    
    return current_dir

def open_browser_delayed():
    """延迟打开浏览器"""
    time.sleep(3)  # 等待服务器完全启动
    try:
        url = 'http://localhost:5000/前端/sign_in.html'
        webbrowser.open(url)
        print(f"✓ 浏览器已打开: {url}")
    except Exception as e:
        print(f"⚠ 自动打开浏览器失败: {e}")
        print("请手动访问: http://localhost:5000/前端/sign_in.html")

def main():
    """主函数"""
    try:
        print("=" * 60)
        print("         LifeMaster - 电子手账应用")
        print("=" * 60)
        print()
          # 设置环境
        app_dir = setup_environment()
        print(f"应用目录: {app_dir}")
        
        # 检查必要文件（打包后不需要检查app.py）
        if not getattr(sys, 'frozen', False):
            # 只在非打包环境下检查文件
            required_files = ['app.py']
            for file_path in required_files:
                if not os.path.exists(file_path):
                    print(f"✗ 找不到必要文件: {file_path}")
                    input("按回车键退出...")
                    return
        
        # 检查前端目录（在打包环境中，这些文件在临时目录中）
        frontend_dir = os.path.join(app_dir, '前端')
        if getattr(sys, 'frozen', False):
            # 在打包环境中，前端文件在临时目录
            frontend_dir = os.path.join(sys._MEIPASS, '前端')
        
        if not os.path.exists(frontend_dir):
            print(f"✗ 找不到前端目录: {frontend_dir}")
            print(f"当前目录内容: {os.listdir(app_dir)}")
            if getattr(sys, 'frozen', False):
                print(f"临时目录内容: {os.listdir(sys._MEIPASS)}")
            input("按回车键退出...")
            return
        
        print("✓ 文件检查通过")
        
        # 导入Flask应用
        try:
            from app import app
            print("✓ 应用模块加载成功")
        except ImportError as e:
            print(f"✗ 导入应用失败: {e}")
            input("按回车键退出...")
            return
        
        # 启动浏览器线程
        browser_thread = threading.Thread(target=open_browser_delayed, daemon=True)
        browser_thread.start()
        
        print()
        print("正在启动服务器...")
        print("服务器地址: http://localhost:5000")
        print("前端地址: http://localhost:5000/前端/sign_in.html")
        print()
        print("⚠ 请不要关闭此窗口，关闭将退出应用")
        print("按 Ctrl+C 可安全退出")
        print("-" * 60)
        
        # 启动Flask应用
        app.run(
            host='127.0.0.1',
            port=5000,
            debug=False,
            use_reloader=False,
            threaded=True
        )
        
    except KeyboardInterrupt:
        print("\n用户中断，正在退出...")
    except Exception as e:
        print(f"\n✗ 启动失败: {e}")
        print("\n可能的解决方案:")
        print("1. 检查端口5000是否被占用")
        print("2. 检查.env配置文件")
        print("3. 确保数据库连接正常")
        input("\n按回车键退出...")

if __name__ == '__main__':
    main()
