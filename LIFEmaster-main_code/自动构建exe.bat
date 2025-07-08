@echo off
chcp 65001 > nul
title LifeMaster 可执行文件构建工具 - 自动模式

echo.
echo ====================================================
echo           LifeMaster EXE 构建工具 - 自动模式
echo ====================================================
echo.

:: 检查Python是否可用
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Python 未安装或未添加到 PATH
    echo 请安装 Python 3.8+ 并添加到系统路径
    pause
    exit /b 1
)

:: 检查是否在正确目录
if not exist "app.py" (
    echo ✗ 请在项目根目录运行此脚本
    echo 当前目录应包含 app.py 文件
    pause
    exit /b 1
)

echo 正在自动开始构建过程...
echo.

:: 运行构建脚本
python build_exe.py
set BUILD_RESULT=%errorlevel%

echo.
echo ====================================================
echo                   构建完成
echo ====================================================
echo.

if %BUILD_RESULT% equ 0 (
    if exist "dist\LifeMaster.exe" (
        echo ✓ 构建成功！
        echo 可执行文件位置: dist\LifeMaster.exe
        echo 使用说明: README_exe.md
        echo.
        echo 📂 打开dist目录查看文件？ (Y/N)
        set /p OPEN_DIR=
        if /i "%OPEN_DIR%"=="Y" (
            explorer dist
        )
    ) else (
        echo ✗ 构建过程完成但exe文件未找到
    )
) else (
    echo ✗ 构建失败，错误代码: %BUILD_RESULT%
    echo.
    echo 常见解决方案:
    echo 1. 确保所有依赖都已安装: pip install -r requirements.txt
    echo 2. 确保PyInstaller已安装: pip install pyinstaller
    echo 3. 检查是否有杀毒软件拦截
    echo 4. 尝试以管理员身份运行
)

echo.
echo 窗口将在15秒后自动关闭...
timeout /t 15
