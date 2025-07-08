#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LifeMaster 应用打包脚本
使用 PyInstaller 将 Flask 应用打包为 exe 文件
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

def install_requirements():
    """安装必要的打包依赖"""
    print("正在安装打包依赖...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✓ PyInstaller 安装成功")
    except subprocess.CalledProcessError:
        print("✗ PyInstaller 安装失败")
        return False
    return True

def clean_build_dirs():
    """清理之前的构建目录"""
    print("正在清理构建目录...")
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"✓ 清理目录: {dir_name}")

def create_spec_file():
    """创建 PyInstaller 配置文件"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('前端', '前端'),
        ('migrations', 'migrations'),
        ('.env', '.'),
    ],
    hiddenimports=[
        'flask',
        'flask_sqlalchemy', 
        'flask_migrate',
        'flask_jwt_extended',
        'flask_cors',
        'pymysql',
        'sqlalchemy',
        'werkzeug.security',
        'datetime',
        'uuid',
        'dotenv',
        'collections',
        'collections.abc',
        'threading',
        'webbrowser',
        'pathlib',
        'app',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LifeMaster',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='前端/图片素材/tree.png' if os.path.exists('前端/图片素材/tree.png') else None,
)
'''
    
    with open('lifemaster.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    print("✓ 创建 spec 文件")

def create_launcher():
    """创建启动器脚本"""
    launcher_content = '''#!/usr/bin/env python3
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
'''
    
    with open('launcher.py', 'w', encoding='utf-8') as f:
        f.write(launcher_content)
    print("✓ 创建启动器脚本")

def build_executable():
    """构建可执行文件"""
    print("正在构建可执行文件...")
    try:
        # 使用更简单的方式，直接调用不重定向输出
        cmd = [
            sys.executable, "-m", "PyInstaller", 
            "--clean", 
            "--noconfirm",
            "--log-level=INFO",
            "lifemaster.spec"
        ]
        
        print(f"执行命令: {' '.join(cmd)}")
        print("构建过程可能需要几分钟，请耐心等待...")
        print("=" * 50)
        
        # 直接调用，不重定向输出，让用户看到实时进度
        result = subprocess.call(cmd)
        
        print("=" * 50)
        
        if result == 0:
            print("✓ 构建成功!")
            if os.path.exists("dist/LifeMaster.exe"):
                print("✓ 可执行文件已生成: dist/LifeMaster.exe")
                file_size = os.path.getsize("dist/LifeMaster.exe") / (1024 * 1024)
                print(f"✓ 文件大小: {file_size:.1f} MB")
                return True
            else:
                print("✗ 可执行文件未找到")
                return False
        else:
            print(f"✗ 构建失败，返回码: {result}")
            return False
            
    except KeyboardInterrupt:
        print("\n用户中断构建")
        return False
    except FileNotFoundError:
        print("✗ PyInstaller 未安装或未找到")
        print("请运行: pip install pyinstaller")
        return False
    except Exception as e:
        print(f"✗ 构建过程中发生错误: {e}")
        print("错误类型:", type(e).__name__)
        return False

def create_requirements_for_exe():
    """创建简化的 requirements.txt 用于打包"""
    simplified_requirements = [
        "flask==2.2.3",
        "flask-cors==3.0.10", 
        "flask-jwt-extended==4.4.4",
        "flask-migrate==4.0.4",
        "flask-sqlalchemy==3.0.3",
        "PyMySQL==1.0.3",
        "python-dotenv==1.0.0",
        "SQLAlchemy==2.0.41",
        "Werkzeug==3.0.1",
        "alembic==1.16.1",
        "gunicorn==21.2.0"
    ]
    
    with open('requirements_exe.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(simplified_requirements))
    print("✓ 创建简化的 requirements.txt")

def create_env_example():
    """创建环境变量示例文件"""
    env_content = '''# LifeMaster 环境配置
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=lifemaster

# JWT 密钥
JWT_SECRET_KEY=your-secret-key-here-12345

# Flask 配置
FLASK_ENV=production
FLASK_DEBUG=False
'''
    
    # 如果 .env 文件不存在，创建一个
    if not os.path.exists('.env'):
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_content)
        print("✓ 创建 .env 配置文件")
    
    # 创建示例文件
    with open('.env.example', 'w', encoding='utf-8') as f:
        f.write(env_content)
    print("✓ 创建 .env.example 示例文件")

def create_readme():
    """创建使用说明"""
    readme_content = '''# LifeMaster 可执行文件使用说明

## 系统要求
- Windows 10/11 (64位)
- 至少 2GB 可用内存
- MySQL 数据库（可选，也可使用 SQLite）

## 安装和运行

### 1. 首次运行前的准备
1. 确保解压到一个固定目录（建议：C:\\LifeMaster\\）
2. 如果使用 MySQL：
   - 安装 MySQL 服务器
   - 创建数据库 `lifemaster`
   - 修改 `.env` 文件中的数据库配置

### 2. 运行应用
双击 `LifeMaster.exe` 即可启动应用

应用启动后会：
1. 自动启动后端服务器 (localhost:5000)
2. 自动打开浏览器访问登录页面
3. 初始化数据库表（首次运行）

### 3. 使用说明
- 首次使用请先注册账号
- 登录后可以使用手账、待办事项、记账等功能
- 关闭控制台窗口即可退出应用

### 4. 故障排除
1. **端口占用**: 如果 5000 端口被占用，请关闭占用该端口的程序
2. **数据库连接失败**: 检查 MySQL 服务是否启动，配置是否正确
3. **浏览器未自动打开**: 手动访问 http://localhost:5000/前端/sign_in.html

### 5. 文件说明
- `LifeMaster.exe`: 主程序
- `.env`: 环境配置文件
- `前端/`: 前端文件目录
- `migrations/`: 数据库迁移文件

## 技术支持
如遇问题请检查：
1. 控制台错误信息
2. .env 配置是否正确
3. 网络和端口是否可用

---
LifeMaster - 电子手账，记录生活确幸
'''
    
    with open('README_exe.md', 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print("✓ 创建使用说明文档")

def main():
    """主函数"""
    print("=" * 60)
    print("LifeMaster 可执行文件构建工具")
    print("=" * 60)
    
    # 检查当前目录
    if not os.path.exists('app.py'):
        print("✗ 请在项目根目录运行此脚本")
        return False
    
    # 步骤1: 安装依赖
    if not install_requirements():
        return False
    
    # 步骤2: 清理构建目录
    clean_build_dirs()
    
    # 步骤3: 创建必要文件
    create_requirements_for_exe()
    create_env_example()
    create_launcher()
    create_spec_file()
    create_readme()
    
    # 步骤4: 构建
    if build_executable():
        print("\n" + "=" * 60)
        print("🎉 构建完成!")
        print("=" * 60)
        print("可执行文件位置: dist/LifeMaster.exe")
        print("使用说明: README_exe.md")
        print("\n📋 后续步骤:")
        print("1. 将 dist/ 目录中的所有文件复制到目标机器")
        print("2. 根据需要修改 .env 配置文件")
        print("3. 双击 LifeMaster.exe 启动应用")
        return True
    else:
        print("\n✗ 构建失败，请检查错误信息")
        return False

if __name__ == '__main__':
    success = main()
    input(f"\n{'构建完成' if success else '构建失败'}，按回车键退出...")
