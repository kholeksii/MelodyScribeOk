import { contextBridge, ipcRenderer } from 'electron';

// Keep in sync with src/services/electronBridge.ts (ElectronAPI interface)
const electronAPI = {
  /** Read a .melody file by absolute path; typed error when missing/unreadable. */
  readProjectFile: (filePath: string) => ipcRenderer.invoke('project:read', filePath),
  /** Native save dialog; returns the chosen absolute path or null if canceled. */
  saveProjectFile: (defaultName: string, data: Uint8Array) =>
    ipcRenderer.invoke('project:save-dialog', defaultName, data),
  /** Native open dialog; returns {path, data} or null if canceled. */
  openProjectFile: () => ipcRenderer.invoke('project:open-dialog'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
