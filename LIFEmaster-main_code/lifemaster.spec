# -*- mode: python ; coding: utf-8 -*-

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
