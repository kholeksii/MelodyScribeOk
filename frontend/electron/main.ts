import { app, BrowserWindow } from 'electron';
import * as path from 'path';
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
