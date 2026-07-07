import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8000;

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// ── Backend lifecycle ──────────────────────────────────────────────

function getBackendPath(): string | null {
  if (isDev) return null; // dev: user starts backend manually
  // In packaged app, PyInstaller output lives in Resources/backend/
  const bin = process.platform === 'win32' ? 'melodyscribe_server.exe' : 'melodyscribe_server';
  return path.join(process.resourcesPath, 'backend', 'melodyscribe_server', bin);
}

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendPath = getBackendPath();
    if (!backendPath) {
      // Dev mode — assume backend already running on port 8000
      resolve();
      return;
    }

    backendProcess = spawn(backendPath, [], {
      env: { ...process.env, MELODYSCRIBE_PORT: String(BACKEND_PORT) },
      detached: false,
    });

    backendProcess.stderr?.on('data', (d: Buffer) => {
      console.error('[backend]', d.toString().trim());
    });

    backendProcess.on('error', (err) => {
      console.error('Backend process error:', err);
      reject(err);
    });

    // Wait until the TCP port accepts connections (max 15 s)
    waitForPort(BACKEND_PORT, 15_000).then(resolve).catch(reject);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

/** Poll until TCP port accepts a connection or timeout is reached. */
function waitForPort(port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const socket = new net.Socket();
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Backend did not start on port ${port} within ${timeoutMs} ms`));
        } else {
          setTimeout(check, 300);
        }
      });
      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

// ── Window ─────────────────────────────────────────────────────────

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
};

// ── Project file IPC (U20) ─────────────────────────────────────────

type ProjectReadResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; error: 'invalid_extension' | 'not_found' | 'unreadable' };

const MELODY_FILTER = [{ name: 'MelodyScribe Project', extensions: ['melody'] }];

ipcMain.handle('project:read', async (_event, filePath: string): Promise<ProjectReadResult> => {
  if (typeof filePath !== 'string' || !filePath.endsWith('.melody')) {
    return { ok: false, error: 'invalid_extension' };
  }
  try {
    const data = await fs.readFile(filePath);
    return { ok: true, data };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { ok: false, error: code === 'ENOENT' ? 'not_found' : 'unreadable' };
  }
});

ipcMain.handle(
  'project:save-dialog',
  async (_event, defaultName: string, data: Uint8Array): Promise<string | null> => {
    const options = { defaultPath: defaultName, filters: MELODY_FILTER };
    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return null;
    await fs.writeFile(filePath, Buffer.from(data));
    return filePath;
  }
);

ipcMain.handle(
  'project:open-dialog',
  async (): Promise<{ path: string; data: Uint8Array } | null> => {
    const options = { filters: MELODY_FILTER, properties: ['openFile' as const] };
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (canceled || filePaths.length === 0) return null;
    const data = await fs.readFile(filePaths[0]);
    return { path: filePaths[0], data };
  }
);

// ── App events ──────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (err) {
    // Log but don't block — window shows, user sees API errors
    console.error('Failed to start backend:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('quit', stopBackend);
