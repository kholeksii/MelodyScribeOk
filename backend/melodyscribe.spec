# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for MelodyScribe backend server."""

import sys
from pathlib import Path

block_cipher = None

# Collect all data files needed at runtime
datas = []

# music21 corpus and config
try:
    import music21
    m21_path = Path(music21.__file__).parent
    datas += [(str(m21_path), 'music21')]
except ImportError:
    pass

# librosa data files (resampling filters, etc.)
try:
    import librosa
    lib_path = Path(librosa.__file__).parent
    datas += [(str(lib_path / 'util' / 'example_data'), 'librosa/util/example_data')]
except Exception:
    pass

a = Analysis(
    ['run_server.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=[
        # FastAPI / uvicorn
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.middleware.cors',
        'pydantic',
        'pydantic.v1',
        'python_multipart',
        'multipart',
        # Audio
        'librosa',
        'librosa.core',
        'librosa.feature',
        'librosa.onset',
        'librosa.util',
        'librosa.effects',
        'soundfile',
        'audioread',
        'scipy',
        'scipy.signal',
        'scipy.fft',
        'numpy',
        'aubio',
        # music21
        'music21',
        'music21.stream',
        'music21.note',
        'music21.meter',
        'music21.tempo',
        'music21.key',
        'music21.converter',
        'music21.musicxml',
        # App modules
        'app',
        'app.main',
        'app.api',
        'app.api.routes.audio',
        'app.api.routes.transcribe',
        'app.api.routes.verify',
        'app.api.routes.export',
        'app.services.audio_service',
        'app.services.segmentation_service',
        'app.services.theory_checker',
        'app.services.pdf_service',
        'app.core.pitch_detector',
        'app.core.onset_detector',
        'app.core.tempo_detector',
        'app.core.key_detector',
        'app.core.quantizer',
        'app.models.note',
        'app.models.project',
        'app.config',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='melodyscribe_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Keep console for debug; set False for silent production
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='melodyscribe_server',
)
