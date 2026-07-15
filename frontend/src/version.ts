// Single source of truth for the running app's version, resolved at build
// time from package.json plus the git commit and build date.
export const APP_VERSION = __APP_VERSION__;
export const APP_PR = __APP_PR__;
export const APP_GIT_SHA = __APP_GIT_SHA__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;

// major.minor from package.json, trailing digit is the latest merged PR
// number instead of a hand-maintained patch — makes "which PR is this
// build on" visible at a glance (U40). Falls back to the full semver patch
// when built outside git (no PR number available, e.g. from a tarball).
const [major, minor] = APP_VERSION.split('.');
const displayVersion = APP_PR > 0 ? `${major}.${minor}.${APP_PR}` : APP_VERSION;

/** Short label, e.g. "v0.2.43". */
export const versionLabel = `v${displayVersion}`;

/** Full build identifier, e.g. "v0.2.43 · a1b2c3d · 2026-07-08". */
export const fullVersion = `v${displayVersion} · ${APP_GIT_SHA} · ${APP_BUILD_DATE}`;
