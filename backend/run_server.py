"""Entry point for PyInstaller bundle — starts the FastAPI server."""
import sys
import os

# When frozen by PyInstaller, resources are in sys._MEIPASS
if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS  # type: ignore[attr-defined]
    os.chdir(base_dir)

import uvicorn

if __name__ == '__main__':
    port = int(os.environ.get('MELODYSCRIBE_PORT', '8000'))
    uvicorn.run(
        'app.main:app',
        host='127.0.0.1',
        port=port,
        log_level='warning',
    )
