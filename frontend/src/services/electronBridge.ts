// Renderer-side view of the API exposed by electron/preload.ts (U20).
// In a plain browser (vite dev without Electron) the API is absent and
// callers must fall back to browser file inputs/downloads.

export type ProjectReadError = 'invalid_extension' | 'not_found' | 'unreadable';

export type ProjectReadResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; error: ProjectReadError };

export interface ElectronAPI {
  readProjectFile(path: string): Promise<ProjectReadResult>;
  saveProjectFile(defaultName: string, data: Uint8Array): Promise<string | null>;
  openProjectFile(): Promise<{ path: string; data: Uint8Array } | null>;
}

export function getElectronAPI(): ElectronAPI | null {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

/** "/Users/x/Songs/tune.melody" → "tune.melody" (handles both separators). */
export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}
