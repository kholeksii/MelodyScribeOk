# Tauri vs Electron — Evaluation for MelodyScribe

## Summary

**Recommendation: stay with Electron for v1. Re-evaluate for v2 if distributing broadly.**

---

## Size comparison

| Runtime | Installed size | Download |
|---------|---------------|----------|
| Electron (current) | ~150–200 MB | ~80 MB |
| Tauri v2 | ~8–15 MB | ~3 MB |

Electron bundles Chromium + Node.js. Tauri uses the OS webview (WebKit on macOS/Linux, WebView2 on Windows) + a small Rust binary.

---

## Feature comparison

| Feature | Electron | Tauri v2 |
|---------|----------|-----------|
| Our React+TypeScript frontend | ✅ unchanged | ✅ unchanged |
| Python sidecar (PyInstaller) | `child_process.spawn` — trivial | `tauri::plugin::shell` — supported but more ceremony |
| Maturity | Very stable, large ecosystem | v2 stable since 2024, growing |
| Cross-platform | macOS / Windows / Linux | macOS / Windows / Linux |
| Native Rust backend | ❌ | ✅ (can replace some Python code long-term) |
| Auto-updater | `electron-updater` | built-in `tauri-plugin-updater` |
| Learning curve for changes | Low — Node.js | High — Rust required for native layer |
| Code-signing / notarization | electron-builder handles | `tauri build` handles |

---

## Migration effort

Switching from Electron to Tauri requires:
1. Install Rust toolchain (`rustup`)
2. `npm create tauri-app@latest` — generates `src-tauri/`
3. Replace `electron/main.ts` → `src-tauri/src/main.rs` (~150 lines Rust)
4. Replace `electron-builder.yml` → `tauri.conf.json`
5. Python sidecar: declare in `tauri.conf.json` → `"bundle": { "externalBin": ["..."] }`, then invoke via `Command.sidecar()` in JS

The React frontend (`src/`) is **unchanged** — Tauri uses it as-is through `vite`.

Estimated effort: **2–3 days** for someone unfamiliar with Rust.

---

## Recommendation

- **v1**: Ship with Electron. `build.sh` already produces a working `.dmg`.  
  The 150 MB download is fine for a private family app.

- **v2** (if distributing): migrate to Tauri. Main gains: tiny installer, better startup time, no Chromium update debt.

---

## Migration skeleton

A minimal `src-tauri/` is kept in `frontend/src-tauri-skeleton/` as a reference.  
To activate: `mv frontend/src-tauri-skeleton frontend/src-tauri && rustup update`.

Key file — `src-tauri/src/main.rs`:
```rust
// Python sidecar launch (Tauri equivalent of child_process.spawn)
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn start_backend(app: tauri::AppHandle) {
    let (mut rx, _child) = app
        .shell()
        .sidecar("melodyscribe_server")
        .expect("sidecar not configured")
        .spawn()
        .expect("Failed to spawn backend");
    // rx receives stdout/stderr events
}
```

Key config — `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": ["../backend/dist/melodyscribe_server/melodyscribe_server"]
  }
}
```
