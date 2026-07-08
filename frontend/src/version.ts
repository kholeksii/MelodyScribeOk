// Single source of truth for the running app's version, resolved at build
// time from package.json plus the git commit and build date.
export const APP_VERSION = __APP_VERSION__;
export const APP_GIT_SHA = __APP_GIT_SHA__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;

/** Short label, e.g. "v0.1.0". */
export const versionLabel = `v${APP_VERSION}`;

/** Full build identifier, e.g. "v0.1.0 · a1b2c3d · 2026-07-08". */
export const fullVersion = `v${APP_VERSION} · ${APP_GIT_SHA} · ${APP_BUILD_DATE}`;
